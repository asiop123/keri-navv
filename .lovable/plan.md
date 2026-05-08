## Problem

Google Maps API-nyckeln (`AIzaSyDtwH0gOPIznevKsiEncudw9kaoH6Q8p_Y`) ligger hårdkodad på 5 ställen i koden:

- `src/pages/RoutePlanning.tsx` (Street View)
- `src/components/AddressAutocomplete.tsx` (Places sökning)
- `src/components/FleetTracker.tsx` (kartvisning)
- `src/components/StreetViewPanorama.tsx` (360-vy)

Det är dåligt för säkerhet (vem som helst som inspekterar koden ser nyckeln) och för underhåll (måste bytas på 5 ställen).

TomTom hanteras redan korrekt via en edge function (`tomtom-proxy`) med secret `TOMTOM_API_KEY`. Google Maps saknar samma skydd.

## Lösning

### Steg 1 — Lägg till `GOOGLE_MAPS_API_KEY` som secret
Be dig spara nyckeln i Lovable Cloud så den inte ligger i kodbasen.

### Steg 2 — Två sätt att använda nyckeln

**A. Klient‑sidan (Maps JS + Places + Street View widget)**
Google Maps JS SDK *måste* köras i webbläsaren med en nyckel synlig i nätverksanropen — det går inte att helt dölja. Bästa praxis är istället:
- Lagra nyckeln som secret
- En liten edge function `google-maps-key` returnerar nyckeln endast till inloggade användare
- Frontend hämtar nyckeln en gång vid app‑start och cacheas i minnet
- Lås nyckeln i Google Cloud Console till din Lovable‑domän + HTTP referrer (rekommendation jag ger dig efteråt)

**B. Server‑sidan (Street View statiska bilder)**
Street View Static API kan proxas helt — nyckeln läcker aldrig:
- Edge function `streetview-proxy` tar `lat,lng,size` och returnerar bilden
- `<img src="">` pekar på edge function istället för `maps.googleapis.com`

### Steg 3 — Refaktor
- Ta bort alla hårdkodade `GOOGLE_MAPS_KEY` konstanter
- Skapa `src/lib/googleMaps.ts` med en `loadGoogleMapsKey()` helper (cacheas)
- `AddressAutocomplete`, `FleetTracker`, `StreetViewPanorama` använder helpern
- `RoutePlanning.tsx` använder `streetview-proxy`‑URLen istället

### Steg 4 — Efteråt
Den gamla nyckeln bör roteras i Google Cloud Console (eftersom den exponerats i git‑historiken) och låsas till din lovable‑domän.

## Frågor innan jag bygger

1. Har du tillgång till samma Google Cloud‑projekt så du kan rotera nyckeln efteråt? (Rekommenderas men inte blockerande.)
2. Ska jag göra både A och B, eller bara A (snabbast — räcker för att få bort hårdkodningen)?
