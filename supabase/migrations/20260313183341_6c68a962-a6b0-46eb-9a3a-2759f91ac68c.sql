CREATE TABLE public.search_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  name text NOT NULL,
  address text NOT NULL DEFAULT '',
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  user_id text NOT NULL DEFAULT 'default',
  search_count integer NOT NULL DEFAULT 1
);

ALTER TABLE public.search_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to search_history" ON public.search_history
  FOR ALL TO public USING (true) WITH CHECK (true);

CREATE UNIQUE INDEX search_history_unique_place ON public.search_history (user_id, lat, lng);