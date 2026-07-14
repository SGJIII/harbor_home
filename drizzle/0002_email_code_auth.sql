CREATE TABLE login_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  code_hash text NOT NULL,
  request_ip_hash text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE app_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id text NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX login_codes_email_created_idx ON login_codes(email, created_at DESC);
CREATE INDEX app_sessions_profile_idx ON app_sessions(profile_id, expires_at DESC);

CREATE OR REPLACE FUNCTION verify_email_login(
  p_email text,
  p_code_hash text,
  p_session_hash text,
  p_session_expires_at timestamptz,
  p_is_admin boolean
) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
  v_code login_codes%ROWTYPE;
  v_profile_id text;
BEGIN
  SELECT * INTO v_code FROM login_codes
  WHERE email = p_email AND consumed_at IS NULL AND expires_at > now()
  ORDER BY created_at DESC LIMIT 1 FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'That code is invalid or expired. Request a new one.');
  END IF;
  IF v_code.attempts >= 5 THEN
    UPDATE login_codes SET consumed_at = now() WHERE id = v_code.id;
    RETURN jsonb_build_object('ok', false, 'error', 'Too many attempts. Request a new code.');
  END IF;
  IF v_code.code_hash <> p_code_hash THEN
    UPDATE login_codes SET attempts = attempts + 1 WHERE id = v_code.id;
    RETURN jsonb_build_object('ok', false, 'error', 'That code is invalid or expired.');
  END IF;

  UPDATE login_codes SET consumed_at = now() WHERE id = v_code.id;
  INSERT INTO profiles(id, email, name, role, status)
  VALUES (
    gen_random_uuid()::text,
    p_email,
    split_part(p_email, '@', 1),
    CASE WHEN p_is_admin THEN 'admin'::app_role ELSE 'guest'::app_role END,
    CASE WHEN p_is_admin THEN 'active'::access_status ELSE 'pending'::access_status END
  )
  ON CONFLICT (email) DO UPDATE SET
    role = CASE WHEN p_is_admin THEN 'admin'::app_role ELSE profiles.role END,
    status = CASE WHEN p_is_admin THEN 'active'::access_status ELSE profiles.status END,
    updated_at = now()
  RETURNING id INTO v_profile_id;

  DELETE FROM app_sessions WHERE profile_id = v_profile_id AND (revoked_at IS NOT NULL OR expires_at <= now());
  INSERT INTO app_sessions(profile_id, token_hash, expires_at)
  VALUES (v_profile_id, p_session_hash, p_session_expires_at);
  INSERT INTO audit_log(actor_id, action, subject_type, subject_id, detail)
  VALUES (v_profile_id, 'email_sign_in', 'profile', v_profile_id, jsonb_build_object('email', p_email));

  RETURN jsonb_build_object('ok', true, 'profileId', v_profile_id);
END;
$$;
