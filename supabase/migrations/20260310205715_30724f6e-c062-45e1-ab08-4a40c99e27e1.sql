
DROP POLICY IF EXISTS "Allow all access to saved_trips" ON public.saved_trips;

CREATE POLICY "Allow all access to saved_trips"
  ON public.saved_trips FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);
