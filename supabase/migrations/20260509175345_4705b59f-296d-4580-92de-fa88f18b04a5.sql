-- Restrict Realtime channel subscriptions to authenticated users.
-- Combined with table-level RLS on vehicle_positions, driver_events, and chef_notifications,
-- this ensures users can only receive row-change broadcasts for rows they are allowed to read.

-- Allow authenticated users to receive realtime messages.
-- Postgres-changes payloads are still filtered by source-table RLS (auth.uid() scoped policies),
-- so chefs see all rows, drivers see only their own.
DROP POLICY IF EXISTS "Authenticated users can receive realtime" ON realtime.messages;
CREATE POLICY "Authenticated users can receive realtime"
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (true);

-- Only authenticated users can publish into realtime (used for broadcast/presence).
DROP POLICY IF EXISTS "Authenticated users can publish realtime" ON realtime.messages;
CREATE POLICY "Authenticated users can publish realtime"
  ON realtime.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (true);