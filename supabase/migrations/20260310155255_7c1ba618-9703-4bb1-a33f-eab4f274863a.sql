
-- Vehicle positions table (real-time GPS tracking)
CREATE TABLE public.vehicle_positions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vehicle_id TEXT NOT NULL,
  driver_id TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  speed_kmh DOUBLE PRECISION DEFAULT 0,
  heading DOUBLE PRECISION DEFAULT 0,
  accuracy_m DOUBLE PRECISION,
  recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Driver events (hard braking, long stops, etc.)
CREATE TABLE public.driver_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vehicle_id TEXT NOT NULL,
  driver_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('hard_brake', 'hard_acceleration', 'speeding', 'long_stop', 'idle')),
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high')),
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  speed_before DOUBLE PRECISION,
  speed_after DOUBLE PRECISION,
  duration_seconds INTEGER,
  description TEXT,
  notified BOOLEAN DEFAULT false,
  recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Chef notifications
CREATE TABLE public.chef_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chef_id TEXT NOT NULL,
  driver_id TEXT NOT NULL,
  vehicle_id TEXT NOT NULL,
  event_id UUID REFERENCES public.driver_events(id),
  notification_type TEXT NOT NULL CHECK (notification_type IN ('long_stop', 'hard_brake', 'speeding', 'alert')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_vehicle_positions_vehicle ON public.vehicle_positions(vehicle_id, recorded_at DESC);
CREATE INDEX idx_vehicle_positions_latest ON public.vehicle_positions(vehicle_id, recorded_at DESC);
CREATE INDEX idx_driver_events_vehicle ON public.driver_events(vehicle_id, recorded_at DESC);
CREATE INDEX idx_driver_events_unnotified ON public.driver_events(notified) WHERE notified = false;
CREATE INDEX idx_chef_notifications_chef ON public.chef_notifications(chef_id, created_at DESC);
CREATE INDEX idx_chef_notifications_unread ON public.chef_notifications(chef_id, is_read) WHERE is_read = false;

-- Enable RLS
ALTER TABLE public.vehicle_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chef_notifications ENABLE ROW LEVEL SECURITY;

-- For now, allow all authenticated users (we'll tighten this with proper auth later)
CREATE POLICY "Allow all access to vehicle_positions" ON public.vehicle_positions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to driver_events" ON public.driver_events FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to chef_notifications" ON public.chef_notifications FOR ALL USING (true) WITH CHECK (true);

-- Enable realtime for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.vehicle_positions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chef_notifications;
