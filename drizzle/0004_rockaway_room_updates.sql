UPDATE rooms SET
  description = 'A private one-bedroom hideaway with its own full bathroom.',
  bed = 'Bed size to be confirmed',
  capacity = 2,
  bathroom = 'Private full bath',
  amenities = '["Private entrance","Full bath"]',
  status = 'active',
  updated_at = now()
WHERE id = '30000000-0000-4000-8000-000000000001';

UPDATE rooms SET
  name = 'Downstairs office',
  description = 'Private office—not available for guest bookings.',
  bed = 'Not bookable',
  capacity = NULL,
  bathroom = 'Not bookable',
  amenities = '["Office","Not bookable"]',
  status = 'draft',
  updated_at = now()
WHERE id = '30000000-0000-4000-8000-000000000002';

UPDATE rooms SET
  name = 'Upstairs queen room',
  description = 'A private queen bedroom upstairs in the main house.',
  bed = 'Queen bed',
  capacity = 2,
  bathroom = 'Shared bath',
  amenities = '["Queen bed","Main house","Upstairs"]',
  status = 'active',
  updated_at = now()
WHERE id = '30000000-0000-4000-8000-000000000003';

DELETE FROM room_fallbacks
WHERE source_room_id = '30000000-0000-4000-8000-000000000001'
   OR fallback_room_id = '30000000-0000-4000-8000-000000000002';

INSERT INTO room_fallbacks(source_room_id, fallback_room_id, position) VALUES
  ('30000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000003', 1)
ON CONFLICT (source_room_id, fallback_room_id) DO UPDATE SET position = EXCLUDED.position;

INSERT INTO audit_log(actor_id, action, subject_type, subject_id, detail) VALUES
  (NULL, 'rockaway_rooms_updated', 'property', '20000000-0000-4000-8000-000000000001', '{"aduPulloutRemoved":true,"downstairsConvertedToOffice":true,"upstairsBed":"queen"}');
