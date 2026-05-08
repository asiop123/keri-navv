
-- 1. Roles enum
create type public.app_role as enum ('chef', 'chauffeur');

-- 2. Profiles table
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- 3. user_roles table
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique(user_id, role)
);
alter table public.user_roles enable row level security;

-- 4. has_role function (security definer to avoid RLS recursion)
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

-- 5. updated_at helper
create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
set search_path = public
as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger update_profiles_updated_at
before update on public.profiles
for each row execute function public.update_updated_at_column();

-- 6. RLS policies for profiles & user_roles
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_select_chef" on public.profiles for select using (public.has_role(auth.uid(), 'chef'));
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);

create policy "user_roles_select_own" on public.user_roles for select using (auth.uid() = user_id);
create policy "user_roles_select_chef" on public.user_roles for select using (public.has_role(auth.uid(), 'chef'));
create policy "user_roles_manage_chef" on public.user_roles for all
  using (public.has_role(auth.uid(), 'chef'))
  with check (public.has_role(auth.uid(), 'chef'));

-- 7. Auto-create profile + default chauffeur role on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'display_name',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)
    )
  );
  insert into public.user_roles (user_id, role)
  values (new.id, 'chauffeur');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 8. Lock down existing tables: replace USING (true) policies

-- vehicle_positions
drop policy if exists "Allow all access to vehicle_positions" on public.vehicle_positions;
alter table public.vehicle_positions alter column driver_id set default (auth.uid())::text;
create policy "vehicle_positions_insert_own" on public.vehicle_positions
  for insert with check (driver_id = (auth.uid())::text);
create policy "vehicle_positions_select_own" on public.vehicle_positions
  for select using (driver_id = (auth.uid())::text);
create policy "vehicle_positions_select_chef" on public.vehicle_positions
  for select using (public.has_role(auth.uid(), 'chef'));

-- driver_events
drop policy if exists "Allow all access to driver_events" on public.driver_events;
alter table public.driver_events alter column driver_id set default (auth.uid())::text;
create policy "driver_events_insert_own" on public.driver_events
  for insert with check (driver_id = (auth.uid())::text);
create policy "driver_events_select_own" on public.driver_events
  for select using (driver_id = (auth.uid())::text);
create policy "driver_events_select_chef" on public.driver_events
  for select using (public.has_role(auth.uid(), 'chef'));

-- chef_notifications
drop policy if exists "Allow all access to chef_notifications" on public.chef_notifications;
create policy "chef_notifications_select_chef" on public.chef_notifications
  for select using (public.has_role(auth.uid(), 'chef') and chef_id = (auth.uid())::text);
create policy "chef_notifications_update_chef" on public.chef_notifications
  for update using (public.has_role(auth.uid(), 'chef') and chef_id = (auth.uid())::text);
create policy "chef_notifications_insert_driver" on public.chef_notifications
  for insert with check (driver_id = (auth.uid())::text);

-- saved_trips
drop policy if exists "Allow all access to saved_trips" on public.saved_trips;
alter table public.saved_trips alter column user_id set default (auth.uid())::text;
create policy "saved_trips_all_own" on public.saved_trips
  for all using (user_id = (auth.uid())::text)
  with check (user_id = (auth.uid())::text);

-- search_history
drop policy if exists "Allow all access to search_history" on public.search_history;
alter table public.search_history alter column user_id set default (auth.uid())::text;
create policy "search_history_all_own" on public.search_history
  for all using (user_id = (auth.uid())::text)
  with check (user_id = (auth.uid())::text);
