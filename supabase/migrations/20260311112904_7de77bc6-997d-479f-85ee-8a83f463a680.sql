ALTER TABLE public.saved_trips ADD COLUMN IF NOT EXISTS trip_source text NOT NULL DEFAULT 'searched';
ALTER TABLE public.saved_trips ADD COLUMN IF NOT EXISTS driven_distance_km numeric;
ALTER TABLE public.saved_trips ADD COLUMN IF NOT EXISTS driven_time_seconds integer;
ALTER TABLE public.saved_trips ADD COLUMN IF NOT EXISTS gps_points jsonb DEFAULT '[]'::jsonb;