ALTER TABLE trip_stops
ADD COLUMN IF NOT EXISTS ticket_section     TEXT,
ADD COLUMN IF NOT EXISTS ticket_row         TEXT,
ADD COLUMN IF NOT EXISTS ticket_seats       TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS ticket_confirmation TEXT;
