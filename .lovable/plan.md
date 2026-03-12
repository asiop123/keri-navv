
Målet är att få exakt beteende du beskriver: när du trycker på kartan ska även “Resplan”-delen kunna försvinna helt (inte bara expanderingen).

1) Vad som sannolikt är fel nu
- Nuvarande logik stänger bara:
  - `showDetails` (expanderad resplan-lista)
  - `selectedLocation` (platskortet)
- Själva bottensheeten med knappen “📋 Resplan” renderas ändå alltid i details-läget, därför upplevs det som att “det inte funkar”.

2) Plan för fix
- Inför en separat state i `RoutePlanning.tsx`, t.ex. `showBottomSheet` (default `true` i details-vyn).
- När användaren trycker på kartan:
  - stäng `selectedLocation`
  - stäng `showDetails`
  - sätt `showBottomSheet(false)` så hela resplanspanelen försvinner.
- Rendera bottensheeten endast när `showBottomSheet === true`.
- När panelen är dold: visa en liten flytande knapp (“Visa resplan”) ovanpå kartan för att öppna igen (`setShowBottomSheet(true)`).

3) Stabilisering av klick/touch (för att fungera hos dig)
- Byt global “outside click” från `mousedown` till `pointerdown` (fångar både mus + touch).
- Behåll map-tap callback från `TomTomMap` men använd en gemensam dismiss-funktion så all stängningslogik går via samma kodväg.
- Säkerställ att klick inne i panel/kort inte triggar stängning via ref-kontroller (`contains(target)`).

4) Filer som uppdateras
- `src/pages/RoutePlanning.tsx` (huvudlogik + rendering av bottensheet/återöppna-knapp)
- Ev. liten justering i `src/components/TomTomMap.tsx` om vi behöver förenkla dubbla tap-lyssnare, men helst minimalt.

5) Verifiering (end-to-end)
- Öppna en rutt i `/ruttplanering`.
- Öppna “📋 Resplan”.
- Tryck på kartan:
  - resplanlista stängs
  - platskort stängs
  - hela resplanpanelen döljs
- Tryck “Visa resplan”:
  - panelen kommer tillbaka.
- Testa på både desktop-klick och mobil-touch.
