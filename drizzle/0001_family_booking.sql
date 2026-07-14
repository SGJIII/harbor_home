CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TYPE access_status AS ENUM ('pending', 'active', 'suspended');
CREATE TYPE app_role AS ENUM ('admin', 'guest');
CREATE TYPE publish_status AS ENUM ('draft', 'active');
CREATE TYPE booking_status AS ENUM ('confirmed', 'moved', 'cancelled');
CREATE TYPE event_status AS ENUM ('draft', 'published', 'cancelled');
CREATE TYPE rsvp_status AS ENUM ('attending', 'not-attending');

CREATE TABLE profiles (
  id text PRIMARY KEY,
  email text NOT NULL UNIQUE,
  name text NOT NULL,
  relationship text NOT NULL DEFAULT '',
  status access_status NOT NULL DEFAULT 'pending',
  role app_role NOT NULL DEFAULT 'guest',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  color text NOT NULL DEFAULT 'sea'
);

CREATE TABLE profile_categories (
  profile_id text NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  PRIMARY KEY (profile_id, category_id)
);

CREATE TABLE properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  eyebrow text NOT NULL DEFAULT '',
  general_location text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  timezone text NOT NULL DEFAULT 'America/New_York',
  summary text NOT NULL DEFAULT '',
  source_links jsonb NOT NULL DEFAULT '[]',
  image_keys jsonb NOT NULL DEFAULT '[]',
  status publish_status NOT NULL DEFAULT 'draft',
  accent text NOT NULL DEFAULT 'ocean',
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  slug text NOT NULL,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  bed text NOT NULL DEFAULT '',
  capacity integer CHECK (capacity IS NULL OR capacity > 0),
  bathroom text NOT NULL DEFAULT '',
  amenities jsonb NOT NULL DEFAULT '[]',
  status publish_status NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (property_id, slug)
);

CREATE TABLE property_priorities (
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  rank integer NOT NULL DEFAULT 0,
  PRIMARY KEY (property_id, category_id)
);

CREATE TABLE room_fallbacks (
  source_room_id uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  fallback_room_id uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  position integer NOT NULL CHECK (position > 0),
  PRIMARY KEY (source_room_id, fallback_room_id),
  UNIQUE (source_room_id, position),
  CHECK (source_room_id <> fallback_room_id)
);

CREATE TABLE availability_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  check_in date NOT NULL,
  check_out date NOT NULL,
  reason text NOT NULL,
  created_by text REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (check_out > check_in)
);

CREATE TABLE block_categories (
  block_id uuid NOT NULL REFERENCES availability_blocks(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  PRIMARY KEY (block_id, category_id)
);

CREATE TABLE events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  check_in date NOT NULL,
  check_out date NOT NULL,
  status event_status NOT NULL DEFAULT 'draft',
  created_by text REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (check_out > check_in)
);

CREATE TABLE event_rooms (
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  room_id uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  PRIMARY KEY (event_id, room_id)
);

CREATE TABLE event_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE event_access (
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  profile_id text NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  granted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, profile_id)
);

CREATE TABLE event_rsvps (
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  profile_id text NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status rsvp_status NOT NULL,
  party_size integer NOT NULL DEFAULT 1 CHECK (party_size > 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, profile_id)
);

CREATE TABLE bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id text NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
  room_id uuid NOT NULL REFERENCES rooms(id) ON DELETE RESTRICT,
  event_id uuid REFERENCES events(id) ON DELETE SET NULL,
  check_in date NOT NULL,
  check_out date NOT NULL,
  party_size integer NOT NULL CHECK (party_size > 0),
  status booking_status NOT NULL DEFAULT 'confirmed',
  moved_from_room_id uuid REFERENCES rooms(id),
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (check_out > check_in)
);

ALTER TABLE bookings ADD CONSTRAINT no_overlapping_confirmed_room_bookings
  EXCLUDE USING gist (
    room_id WITH =,
    daterange(check_in, check_out, '[)') WITH &&
  ) WHERE (status = 'confirmed');

CREATE TABLE event_rsvp_rooms (
  event_id uuid NOT NULL,
  profile_id text NOT NULL,
  room_id uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  PRIMARY KEY (event_id, profile_id, room_id),
  FOREIGN KEY (event_id, profile_id) REFERENCES event_rsvps(event_id, profile_id) ON DELETE CASCADE
);

CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id text NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  kind text NOT NULL,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id text REFERENCES profiles(id),
  action text NOT NULL,
  subject_type text NOT NULL,
  subject_id text,
  detail jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE email_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient text NOT NULL,
  subject text NOT NULL,
  text_body text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE admin_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  message text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}',
  resolved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX rooms_property_idx ON rooms(property_id);
CREATE INDEX blocks_property_dates_idx ON availability_blocks(property_id, check_in, check_out);
CREATE INDEX bookings_room_dates_idx ON bookings(room_id, check_in, check_out);
CREATE INDEX bookings_profile_dates_idx ON bookings(profile_id, check_in, check_out);
CREATE INDEX notifications_profile_idx ON notifications(profile_id, created_at DESC);
CREATE INDEX audit_created_idx ON audit_log(created_at DESC);

-- All availability decisions happen in one database transaction. A failed
-- priority move returns an error and records an alert without changing bookings.
CREATE OR REPLACE FUNCTION book_standard(
  p_profile_id text,
  p_room_id uuid,
  p_check_in date,
  p_check_out date,
  p_party_size integer
) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
  v_property_id uuid;
  v_capacity integer;
  v_profile_status access_status;
  v_request_rank integer := 0;
  v_occupant_rank integer;
  v_start date := p_check_in;
  v_end date := p_check_out;
  v_new_start date;
  v_new_end date;
  v_booking_id uuid;
  v_fallback_id uuid;
  v_conflict bookings%ROWTYPE;
BEGIN
  IF p_check_out <= p_check_in OR p_check_out - p_check_in > 7 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Stays must be between one and seven nights.');
  END IF;
  IF p_party_size < 1 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Party size must be at least one.');
  END IF;

  SELECT r.property_id, r.capacity INTO v_property_id, v_capacity
  FROM rooms r JOIN properties p ON p.id = r.property_id
  WHERE r.id = p_room_id AND r.status = 'active' AND p.status = 'active'
  FOR UPDATE OF r;
  IF NOT FOUND OR v_capacity IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'That room is not available for booking.');
  END IF;
  IF p_party_size > v_capacity THEN
    RETURN jsonb_build_object('ok', false, 'error', 'This room cannot hold that many guests.');
  END IF;

  -- Lock configured fallback rooms in a stable order as well as the requested
  -- room so concurrent requests cannot race the move plan.
  PERFORM 1 FROM rooms r
  JOIN room_fallbacks rf ON rf.fallback_room_id = r.id
  WHERE rf.source_room_id = p_room_id
  ORDER BY r.id
  FOR UPDATE OF r;

  SELECT status INTO v_profile_status FROM profiles WHERE id = p_profile_id FOR UPDATE;
  IF v_profile_status IS DISTINCT FROM 'active' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Your booking access is not active.');
  END IF;

  IF EXISTS (
    SELECT 1 FROM availability_blocks ab
    JOIN block_categories bc ON bc.block_id = ab.id
    JOIN profile_categories pc ON pc.category_id = bc.category_id AND pc.profile_id = p_profile_id
    WHERE ab.property_id = v_property_id
      AND daterange(ab.check_in, ab.check_out, '[)') && daterange(p_check_in, p_check_out, '[)')
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'A category blackout applies to these dates.');
  END IF;

  LOOP
    SELECT LEAST(v_start, min(b.check_in)), GREATEST(v_end, max(b.check_out))
      INTO v_new_start, v_new_end
    FROM bookings b
    WHERE b.profile_id = p_profile_id AND b.status = 'confirmed' AND b.event_id IS NULL
      AND b.check_in <= v_end AND b.check_out >= v_start;
    v_new_start := COALESCE(v_new_start, v_start);
    v_new_end := COALESCE(v_new_end, v_end);
    EXIT WHEN v_new_start = v_start AND v_new_end = v_end;
    v_start := v_new_start;
    v_end := v_new_end;
  END LOOP;
  IF v_end - v_start > 7 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Adjacent or overlapping stays cannot exceed seven consecutive nights.');
  END IF;

  IF EXISTS (
    SELECT 1 FROM events e JOIN event_rooms er ON er.event_id = e.id
    WHERE e.status = 'published' AND er.room_id = p_room_id
      AND daterange(e.check_in, e.check_out, '[)') && daterange(p_check_in, p_check_out, '[)')
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'That room is held for a private gathering.');
  END IF;

  SELECT COALESCE(max(pp.rank), 0) INTO v_request_rank
  FROM property_priorities pp
  JOIN profile_categories pc ON pc.category_id = pp.category_id
  WHERE pp.property_id = v_property_id AND pc.profile_id = p_profile_id;

  CREATE TEMP TABLE IF NOT EXISTS booking_move_plan (
    booking_id uuid PRIMARY KEY,
    fallback_room_id uuid NOT NULL
  ) ON COMMIT DROP;
  TRUNCATE booking_move_plan;

  FOR v_conflict IN
    SELECT b.* FROM bookings b
    WHERE b.room_id = p_room_id AND b.status = 'confirmed'
      AND daterange(b.check_in, b.check_out, '[)') && daterange(p_check_in, p_check_out, '[)')
    ORDER BY b.created_at, b.id
    FOR UPDATE
  LOOP
    IF v_conflict.event_id IS NOT NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Event reservations cannot be displaced.');
    END IF;
    SELECT COALESCE(max(pp.rank), 0) INTO v_occupant_rank
    FROM property_priorities pp
    JOIN profile_categories pc ON pc.category_id = pp.category_id
    WHERE pp.property_id = v_property_id AND pc.profile_id = v_conflict.profile_id;
    IF v_request_rank <= v_occupant_rank THEN
      RETURN jsonb_build_object('ok', false, 'error', 'That room is already booked by an equal- or higher-priority guest.');
    END IF;

    SELECT rf.fallback_room_id INTO v_fallback_id
    FROM room_fallbacks rf
    JOIN rooms r ON r.id = rf.fallback_room_id
    WHERE rf.source_room_id = p_room_id
      AND r.status = 'active' AND r.capacity >= v_conflict.party_size
      AND NOT EXISTS (
        SELECT 1 FROM bookings occupied
        WHERE occupied.room_id = r.id AND occupied.status = 'confirmed'
          AND daterange(occupied.check_in, occupied.check_out, '[)') && daterange(v_conflict.check_in, v_conflict.check_out, '[)')
      )
      AND NOT EXISTS (
        SELECT 1 FROM booking_move_plan planned
        JOIN bookings planned_booking ON planned_booking.id = planned.booking_id
        WHERE planned.fallback_room_id = r.id
          AND daterange(planned_booking.check_in, planned_booking.check_out, '[)') && daterange(v_conflict.check_in, v_conflict.check_out, '[)')
      )
      AND NOT EXISTS (
        SELECT 1 FROM events e JOIN event_rooms er ON er.event_id = e.id
        WHERE e.status = 'published' AND er.room_id = r.id
          AND daterange(e.check_in, e.check_out, '[)') && daterange(v_conflict.check_in, v_conflict.check_out, '[)')
      )
    ORDER BY rf.position
    LIMIT 1;

    IF v_fallback_id IS NULL THEN
      INSERT INTO admin_alerts(kind, message, detail) VALUES (
        'priority_move_failed',
        'A priority booking could not rehome every affected guest.',
        jsonb_build_object('roomId', p_room_id, 'requesterId', p_profile_id, 'checkIn', p_check_in, 'checkOut', p_check_out)
      );
      RETURN jsonb_build_object('ok', false, 'error', 'No suitable fallback is open, so nobody was moved. The hosts were alerted.');
    END IF;
    INSERT INTO booking_move_plan(booking_id, fallback_room_id) VALUES (v_conflict.id, v_fallback_id);
    v_fallback_id := NULL;
  END LOOP;

  UPDATE bookings b SET
    moved_from_room_id = b.room_id,
    room_id = plan.fallback_room_id,
    updated_at = now()
  FROM booking_move_plan plan WHERE b.id = plan.booking_id;

  INSERT INTO notifications(profile_id, title, message, kind)
  SELECT b.profile_id, 'Your room changed',
    'Your dates are unchanged, but a host priority rule moved your stay to ' || r.name || '.', 'move'
  FROM booking_move_plan plan JOIN bookings b ON b.id = plan.booking_id JOIN rooms r ON r.id = plan.fallback_room_id;

  INSERT INTO email_outbox(recipient, subject, text_body)
  SELECT p.email, 'Your room changed',
    'Your dates are unchanged. Your stay is now in ' || r.name || '.'
  FROM booking_move_plan plan JOIN bookings b ON b.id = plan.booking_id
  JOIN profiles p ON p.id = b.profile_id JOIN rooms r ON r.id = plan.fallback_room_id;

  INSERT INTO audit_log(actor_id, action, subject_type, subject_id, detail)
  SELECT p_profile_id, 'booking_moved', 'booking', b.id::text,
    jsonb_build_object('toRoomId', plan.fallback_room_id, 'fromRoomId', p_room_id)
  FROM booking_move_plan plan JOIN bookings b ON b.id = plan.booking_id;

  INSERT INTO bookings(profile_id, property_id, room_id, check_in, check_out, party_size)
  VALUES (p_profile_id, v_property_id, p_room_id, p_check_in, p_check_out, p_party_size)
  RETURNING id INTO v_booking_id;

  INSERT INTO notifications(profile_id, title, message, kind)
  VALUES (p_profile_id, 'Stay confirmed', 'Your room is reserved.', 'booking');
  INSERT INTO email_outbox(recipient, subject, text_body)
  SELECT email, 'Stay confirmed', 'Your room is reserved from ' || p_check_in || ' through ' || p_check_out || '.'
  FROM profiles WHERE id = p_profile_id;
  INSERT INTO audit_log(actor_id, action, subject_type, subject_id, detail)
  VALUES (p_profile_id, 'booking_confirmed', 'booking', v_booking_id::text,
    jsonb_build_object('roomId', p_room_id, 'checkIn', p_check_in, 'checkOut', p_check_out, 'partySize', p_party_size));

  RETURN jsonb_build_object('ok', true, 'bookingId', v_booking_id, 'movedCount', (SELECT count(*) FROM booking_move_plan));
END;
$$;

CREATE OR REPLACE FUNCTION publish_event(p_event_id uuid, p_actor_id text)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE v_conflicts integer;
BEGIN
  SELECT count(*) INTO v_conflicts
  FROM events e JOIN event_rooms er ON er.event_id = e.id
  JOIN bookings b ON b.room_id = er.room_id AND b.status = 'confirmed'
  WHERE e.id = p_event_id
    AND daterange(e.check_in, e.check_out, '[)') && daterange(b.check_in, b.check_out, '[)');
  IF v_conflicts > 0 THEN
    INSERT INTO admin_alerts(kind, message, detail)
    VALUES ('event_conflict', 'Resolve room conflicts before publishing this private gathering.', jsonb_build_object('eventId', p_event_id, 'conflictCount', v_conflicts));
    RETURN jsonb_build_object('ok', false, 'error', 'Existing bookings must be moved or cancelled before publishing.', 'conflictCount', v_conflicts);
  END IF;
  UPDATE events SET status = 'published', updated_at = now() WHERE id = p_event_id AND status = 'draft';
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'Only a draft event can be published.'); END IF;
  INSERT INTO audit_log(actor_id, action, subject_type, subject_id, detail)
  VALUES (p_actor_id, 'event_published', 'event', p_event_id::text, '{}');
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION rsvp_event(
  p_event_id uuid,
  p_profile_id text,
  p_status rsvp_status,
  p_party_size integer,
  p_room_ids uuid[]
) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
  v_event events%ROWTYPE;
  v_room_id uuid;
  v_booking_id uuid;
BEGIN
  SELECT * INTO v_event FROM events WHERE id = p_event_id AND status = 'published' FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'This gathering is not available.'); END IF;
  IF NOT EXISTS (SELECT 1 FROM event_access WHERE event_id = p_event_id AND profile_id = p_profile_id)
     AND NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_profile_id AND role = 'admin' AND status = 'active') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'This private invitation has not been redeemed.');
  END IF;
  IF p_party_size < 1 THEN RETURN jsonb_build_object('ok', false, 'error', 'Party size must be at least one.'); END IF;

  UPDATE bookings SET status = 'cancelled', cancelled_at = now(), updated_at = now()
  WHERE event_id = p_event_id AND profile_id = p_profile_id AND status = 'confirmed';
  DELETE FROM event_rsvp_rooms WHERE event_id = p_event_id AND profile_id = p_profile_id;

  INSERT INTO event_rsvps(event_id, profile_id, status, party_size)
  VALUES (p_event_id, p_profile_id, p_status, p_party_size)
  ON CONFLICT (event_id, profile_id) DO UPDATE SET
    status = EXCLUDED.status, party_size = EXCLUDED.party_size, updated_at = now();

  IF p_status = 'attending' THEN
    FOREACH v_room_id IN ARRAY p_room_ids LOOP
      IF NOT EXISTS (
        SELECT 1 FROM event_rooms er JOIN rooms r ON r.id = er.room_id
        WHERE er.event_id = p_event_id AND er.room_id = v_room_id
          AND r.status = 'active' AND r.capacity >= p_party_size
      ) THEN
        RAISE EXCEPTION 'That event room is unavailable or too small.' USING ERRCODE = 'check_violation';
      END IF;
      INSERT INTO bookings(profile_id, property_id, room_id, event_id, check_in, check_out, party_size)
      VALUES (p_profile_id, v_event.property_id, v_room_id, p_event_id, v_event.check_in, v_event.check_out, p_party_size)
      RETURNING id INTO v_booking_id;
      INSERT INTO event_rsvp_rooms(event_id, profile_id, room_id) VALUES (p_event_id, p_profile_id, v_room_id);
    END LOOP;
  END IF;

  INSERT INTO notifications(profile_id, title, message, kind)
  VALUES (p_profile_id, 'Party response saved', 'Your response to ' || v_event.title || ' has been saved.', 'event');
  INSERT INTO audit_log(actor_id, action, subject_type, subject_id, detail)
  VALUES (p_profile_id, 'event_rsvp_updated', 'event', p_event_id::text,
    jsonb_build_object('status', p_status, 'partySize', p_party_size, 'roomIds', p_room_ids));
  RETURN jsonb_build_object('ok', true);
EXCEPTION WHEN exclusion_violation THEN
  RETURN jsonb_build_object('ok', false, 'error', 'One of those event rooms was just taken. Choose another room.');
WHEN check_violation THEN
  RETURN jsonb_build_object('ok', false, 'error', 'That event room is unavailable or too small.');
END;
$$;

-- Stable ids make the versioned property specification and tests easy to compare.
INSERT INTO categories(id, slug, name, description, color) VALUES
  ('10000000-0000-4000-8000-000000000001', 'parent', 'Parent', 'Parents of Sam or Lisa', 'sand'),
  ('10000000-0000-4000-8000-000000000002', 'mom', 'Mom', 'Sam''s mom or Lisa''s mom', 'coral'),
  ('10000000-0000-4000-8000-000000000003', 'family', 'Family', 'Extended family', 'sea'),
  ('10000000-0000-4000-8000-000000000004', 'friend', 'Friend', 'Friends and chosen family', 'sage');

INSERT INTO properties(id, slug, name, eyebrow, general_location, address, timezone, summary, source_links, status, accent) VALUES
  ('20000000-0000-4000-8000-000000000001', 'rockaway-house', 'Rockaway House', 'BEACH HOME · QUEENS, NY', 'Far Rockaway, Queens', '6319 Ocean Ave S, Far Rockaway, NY 11692', 'America/New_York', 'A bright beachside home with room for the whole crew, steps from the ocean and boardwalk.', '[{"label":"View Zillow details","url":"https://www.zillow.com/homedetails/6319-Ocean-Ave-S-Far-Rockaway-NY-11692/122027290_zpid/","type":"zillow"}]', 'active', 'ocean'),
  ('20000000-0000-4000-8000-000000000002', 'second-getaway', 'Second Getaway', 'DETAILS NEEDED', 'Location pending', '', 'America/New_York', 'A second property with a queen loft and lower-level king room. Complete the listing before publishing.', '[{"label":"Private Airbnb trip link","url":"https://www.airbnb.com/l/cR0afkhh","type":"airbnb"}]', 'draft', 'dune');

INSERT INTO rooms(id, property_id, slug, name, description, bed, capacity, bathroom, amenities, status) VALUES
  ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'adu', 'Rockaway ADU', 'Private one-bedroom hideaway with its own bath and a pullout couch.', '1 bedroom + pullout couch', 4, 'Private full bath', '["Private entrance","Sleeps four","Full bath"]', 'active'),
  ('30000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', 'downstairs', 'Downstairs guest room', 'Main-house room with a full bathroom next door.', 'Bed details needed', NULL, 'Full bath next door', '["Main house","Near full bath"]', 'draft'),
  ('30000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000001', 'second-spare', 'Second spare bedroom', 'A second private bedroom in the main house.', 'Bed details needed', NULL, 'Shared bath', '["Main house"]', 'draft'),
  ('30000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000001', 'living-couch', 'Main house couch', 'A sleep spot in the main living room.', 'Living-room couch', NULL, 'Shared bath', '["Shared space"]', 'draft'),
  ('30000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000002', 'queen-loft', 'Queen loft', 'An airy queen-bed loft.', 'Queen bed', NULL, 'Details needed', '["Loft"]', 'draft'),
  ('30000000-0000-4000-8000-000000000006', '20000000-0000-4000-8000-000000000002', 'lower-king', 'Lower-level king', 'A king-bed room underneath the main floor.', 'King bed', NULL, 'Details needed', '["King bed","Lower level"]', 'draft');

INSERT INTO property_priorities(property_id, category_id, rank) VALUES
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 100),
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003', 20),
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000004', 10);

INSERT INTO room_fallbacks(source_room_id, fallback_room_id, position) VALUES
  ('30000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000002', 1),
  ('30000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000003', 2);
