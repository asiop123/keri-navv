CREATE TABLE public.saved_trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  user_id text NOT NULL DEFAULT 'default',
  start_name text NOT NULL,
  end_name text NOT NULL,
  waypoint_names jsonb NOT NULL DEFAULT '[]'::jsonb,
  distance_km numeric NOT NULL,
  travel_time_seconds integer NOT NULL,
  total_weight_kg numeric NOT NULL DEFAULT 0,
  vehicle_id text NOT NULL DEFAULT '',
  vehicle_label text NOT NULL DEFAULT '',
  route_type text NOT NULL DEFAULT 'normal',
  timeline jsonb NOT NULL DEFAULT '[]'::jsonb,
  route jsonb NOT NULL DEFAULT '{}'::jsonb
);

ALTER TABLE public.saved_trips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to saved_trips"
  ON public.saved_trips FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

CREATE INDEX idx_saved_trips_user_id ON public.saved_trips(user_id);
CREATE INDEX idx_saved_trips_created_at ON public.saved_trips(created_at DESC);