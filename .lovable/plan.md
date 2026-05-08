## Mål

Bygg en bättre körvy (HUD) med sväng-för-sväng + röst, EU-vilolagsräknare, och ett **demo-läge** så du kan testa allt från skrivbordet utan riktig GPS.

## 1. Demo-läge (bygger detta först så du kan utvärdera resten)

- Knapp **"▶ Demo-körning"** i bottom-sheet bredvid "Starta körning" när rutt är vald.
- Simulerar att lastbilen kör längs vald rutt i ~10× hastighet.
- Skickar fejk-position (interpolerad längs `route.geometry`) till samma state som riktig GPS.
- HUD, röst, vilolagschip, sväng-instruktioner — allt aktiveras precis som vid riktig körning.
- Stopp-knapp avslutar demo och nollställer.

## 2. Sväng-för-sväng-navigation

Idag visar HUD:en bara avstånd till nästa stopp. Vi använder inte TomTom:s `guidance.instructions`.

- Lägg till `instructionsType=text&language=sv-SE` i `calculateRoute`-anropet (i `tomtom-proxy`).
- Parsa instruktionerna och spara `instructions[]` i route-resultatet.
- Ny hook `useTurnByTurn(instructions, userPosition)` returnerar `{ next, distanceToNext, maneuverIcon }`.
- HUD:n byggs om:
  - **Stor pil-ikon** (← ↑ → enligt `maneuver`)
  - **"200 m"** i jättestort
  - "Sväng höger på E4" som undertext
  - Liten rad nederst: nästa stopp + km kvar

## 3. Röststöd (svenska)

- `src/lib/voice.ts` — wrapper kring webbläsarens `speechSynthesis`, sv-SE.
- Säger sväng-instruktioner vid 500 m, 200 m och vid svängen.
- Säger vilolagsvarningar ("Du måste ta rast om 30 minuter").
- Mute-knapp i HUD.

## 4. EU-vilolagen — aktiv övervakning

Idag finns reglerna dokumenterade men appen påminner inte under körning.

- Ny hook `useDrivingTimer` räknar:
  - Sammanhängande körtid (max 4h30 utan 45-min rast)
  - Daglig körtid (max 9h, 2× per vecka 10h)
  - Tid sedan senaste dygnsvila
- Chip i HUD: **🟢 3h12 / 4h30** → gul vid 4h00 → röd + röst vid 4h25.
- Vid 4h25: föreslå närmaste lämpliga rastplats automatiskt (befintlig `findRestStops`).
- Knapp "☕ Jag tar rast nu" — loggar starttid, räknar ner 45 min, återupptar automatiskt.

## 5. Småfix på köpet

- **Off-route**: Om chauffören är >150 m från rutten i 30 sek → räkna om automatiskt.
- **Ankomst**: Inom 100 m från waypoint → "Framme vid X — markera som klar?".
- **GPS-bortfall**: Banner "GPS svag — sista position 2 min sedan".

## Teknisk översikt

```text
supabase/functions/tomtom-proxy/index.ts
  + lägg till instructionsType=text&language=sv-SE i calculateRoute

src/services/tomtom.ts
  + parsa guidance.instructions → typed array
  + RouteResult får fältet instructions[]

src/hooks/useTurnByTurn.ts        (ny)
src/hooks/useDrivingTimer.ts      (ny)
src/hooks/useDemoDriver.ts        (ny — interpolerar fejk-GPS längs rutt)
src/lib/voice.ts                  (ny)

src/pages/RoutePlanning.tsx
  - HUD-blocket (rad 2670-2705) byggs om till sväng-pil + avstånd + röst
  - lägg till "Demo-körning"-knapp i bottom-sheet
  - off-route + ankomst-detektor
```

Inga DB-ändringar, inga nya secrets — TomTom-proxy + speechSynthesis räcker.

## Leveransordning

1. **Demo-läge + sväng-för-sväng + röst** (så du kan testa direkt)
2. **Vilolagsräknare** (i nästa runda när du sett att HUD-en är OK)
3. **Off-route / ankomst / GPS-banner** (sist, polish)
