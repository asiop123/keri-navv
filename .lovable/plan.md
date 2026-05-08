## Mål
Fixa de tre säkerhetsproblemen från skanningen utan att lämna appen i ett trasigt läge.

## 1. TomTom-nyckel → Edge Function-proxy
- Skapa edge function `tomtom-proxy` som tar emot path + query och anropar TomTom med `TOMTOM_API_KEY` (server-secret).
- Be dig lägga till `TOMTOM_API_KEY` som secret (du måste sedan **rotera nyckeln** i TomTom Developer Portal eftersom den redan är exponerad).
- Uppdatera `src/services/tomtom.ts` och `src/components/TomTomMap.tsx` så de anropar proxyn istället för att använda nyckeln direkt.
- Karttiles via TomTom kan inte gå genom en edge-proxy (URL byggs av Leaflet med nyckeln). Lösning: skapa en kort-livad signerad endpoint som returnerar tile-URL med nyckel, eller acceptera tile-nyckel separat med domänrestriktion i TomTom-portalen. Vi använder domänrestriktion för tiles och proxar enbart routing/geocoding-anropen där pengarna är.

## 2. Riktig autentisering (Supabase Auth)
- Aktivera Email + Google-inloggning (Lovable Cloud managed).
- Skapa `/auth`-sida med login + signup.
- `RoleProvider` läser inloggad användare från Supabase istället för en knapp.
- Ta bort rollväxlaren i `AppSidebar`.
- Skydda alla routes — oinloggade omdirigeras till `/auth`.

## 3. Roller i databasen (utan recursion)
Migration:
```
create type public.app_role as enum ('chef', 'chauffeur');

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text,
  created_at timestamptz default now()
);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  role app_role not null,
  unique (user_id, role)
);

create function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

-- Auto-skapa profil + standardroll 'chauffeur' vid signup
create function public.handle_new_user() ...
create trigger on_auth_user_created after insert on auth.users ...
```

## 4. Lås befintliga tabeller med RLS
Ersätt alla `USING (true)` policies:

| Tabell | Policy |
|---|---|
| `profiles` | Var och en ser/uppdaterar sin egen; chef ser alla |
| `user_roles` | Var och en ser sina egna; bara chef kan tilldela |
| `vehicle_positions` | Förare skriver sin egen (`driver_id = auth.uid()::text`); chef läser alla |
| `driver_events` | Samma mönster |
| `chef_notifications` | Bara chef läser/uppdaterar (`chef_id = auth.uid()::text`) |
| `saved_trips` | Endast ägare (`user_id = auth.uid()::text`) |
| `search_history` | Endast ägare |

`user_id`/`driver_id`/`chef_id` ändras till default `auth.uid()::text` och NOT NULL där det går.

## 5. Koduppdateringar
- Byt alla hårdkodade `'user-chef'` / `'user-chauffeur'` / `'default'` IDn mot `auth.uid()` från sessionen.
- `gpsTracking.ts`, `searchHistory.ts`, `tripStorage.ts`, `RoutePlanning.tsx`, `FleetTracker.tsx` m.fl. — använd inloggat user-ID.

## Tekniska detaljer
- `onAuthStateChange` sätts upp INNAN `getSession()` i en `AuthProvider`.
- `has_role()` är `security definer` för att undvika RLS-rekursion.
- Profiler skapas via trigger på `auth.users` (kör inte `SELECT auth.users` från klienten).
- Edge function `tomtom-proxy` använder CORS-headers från `@supabase/supabase-js/cors` och `verify_jwt = true` så bara inloggade kan slå i den.

## Vad jag behöver av dig
1. Bekräfta planen → jag kör migrationen och koden.
2. Lägg till secret `TOMTOM_API_KEY` när jag frågar.
3. **Rotera** den gamla TomTom-nyckeln i TomTom Developer Portal när allt är driftsatt.

## Vad som kommer att ske första gången du testar
- Du loggas ut och måste skapa ett konto (första kontot kan jag manuellt sätta som `chef` via en SQL-insert; säg till om du vill).
- All gammal mock-data är fortfarande synlig (den är bara i `mockData.ts`), men databasrader skapade som `'default'`/`'user-chef'` kommer inte längre att vara synliga eftersom de inte matchar någon `auth.uid()`.
