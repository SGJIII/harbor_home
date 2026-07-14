ALTER TABLE properties ADD COLUMN available_from date;
ALTER TABLE properties ADD COLUMN available_until date;
ALTER TABLE properties ADD CONSTRAINT properties_available_window_check
  CHECK (available_from IS NULL OR available_until IS NULL OR available_until > available_from);

CREATE OR REPLACE FUNCTION enforce_property_booking_window()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_available_from date;
  v_available_until date;
BEGIN
  SELECT available_from, available_until
    INTO v_available_from, v_available_until
  FROM properties
  WHERE id = NEW.property_id;

  IF v_available_from IS NOT NULL AND NEW.check_in < v_available_from THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Booking begins before the property is available.';
  END IF;
  IF v_available_until IS NOT NULL AND NEW.check_out > v_available_until THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Booking ends after the property availability window.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER booking_property_window_before_write
  BEFORE INSERT OR UPDATE OF property_id, check_in, check_out ON bookings
  FOR EACH ROW EXECUTE FUNCTION enforce_property_booking_window();

UPDATE properties SET
  eyebrow = 'BEACH HOME · AVAILABLE JUNE 2027',
  available_from = '2027-06-01',
  available_until = NULL,
  version = version + 1,
  updated_at = now()
WHERE id = '20000000-0000-4000-8000-000000000001';

UPDATE rooms SET
  bed = 'King bed',
  capacity = 2,
  bathroom = 'Full bath next door',
  amenities = '["King bed","Main house","Full bath next door"]',
  status = 'active',
  updated_at = now()
WHERE id = '30000000-0000-4000-8000-000000000002';

UPDATE rooms SET
  name = 'Fourth-floor queen room',
  description = 'A private queen bedroom on the fourth floor of the main house.',
  bed = 'Queen bed',
  capacity = 2,
  bathroom = 'Shared bath',
  amenities = '["Queen bed","Main house","Fourth floor"]',
  status = 'active',
  updated_at = now()
WHERE id = '30000000-0000-4000-8000-000000000003';

UPDATE rooms SET
  description = 'A non-foldout living-room couch best for kids or an easy late-night crash pad.',
  bed = 'Non-foldout living-room couch',
  capacity = 3,
  bathroom = 'Shared bath',
  amenities = '["Shared space","Best for kids","Does not fold out"]',
  status = 'active',
  updated_at = now()
WHERE id = '30000000-0000-4000-8000-000000000004';

UPDATE properties SET
  name = 'Luna',
  eyebrow = 'PLAYA PELADA · FEB–MAY 2027',
  general_location = 'Playa Pelada, Nosara, Costa Rica',
  address = 'Playa Pelada, Provincia de Guanacaste, Costa Rica',
  timezone = 'America/Costa_Rica',
  available_from = '2027-02-15',
  available_until = '2027-05-02',
  summary = 'An ocean-view villa near Playa Pelada with an infinity pool, two family-bookable rooms, and a third room reserved for the hosts.',
  source_links = '[{"label":"View Airbnb listing","url":"https://www.airbnb.com/rooms/54020123","type":"airbnb"}]',
  status = 'active',
  version = version + 1,
  updated_at = now()
WHERE id = '20000000-0000-4000-8000-000000000002';

UPDATE rooms SET
  description = 'An airy queen-bed loft with access to the main-floor full bathroom.',
  bed = 'Queen bed',
  capacity = 2,
  bathroom = 'Shared main-floor full bath',
  amenities = '["Loft","Queen bed","Ocean-view villa","Shared infinity pool"]',
  status = 'active',
  updated_at = now()
WHERE id = '30000000-0000-4000-8000-000000000005';

UPDATE rooms SET
  name = 'Lower-level king room',
  description = 'A king bedroom below the main floor, sharing the downstairs full bathroom.',
  bed = 'King bed',
  capacity = 2,
  bathroom = 'Shared downstairs full bath',
  amenities = '["King bed","Lower level","Ocean-view villa","Shared infinity pool"]',
  status = 'active',
  updated_at = now()
WHERE id = '30000000-0000-4000-8000-000000000006';

DELETE FROM room_fallbacks
WHERE source_room_id IN (
  '30000000-0000-4000-8000-000000000005',
  '30000000-0000-4000-8000-000000000006'
);

DELETE FROM property_priorities
WHERE property_id = '20000000-0000-4000-8000-000000000002';

INSERT INTO audit_log(actor_id, action, subject_type, subject_id, detail) VALUES
  (NULL, 'property_details_updated', 'property', '20000000-0000-4000-8000-000000000001', '{"availableFrom":"2027-06-01","source":"host supplied"}'),
  (NULL, 'property_details_updated', 'property', '20000000-0000-4000-8000-000000000002', '{"availableFrom":"2027-02-15","availableUntil":"2027-05-02","source":"host supplied and public Airbnb metadata"}');
