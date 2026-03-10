

## Problem

Du vill ha Google Maps-stil: **båda rutterna syns på kartan**, den valda är mörkare/tydligare, den andra är ljusare/blekare. Man klickar på den ljusa för att byta — precis som i Google Maps.

## Plan

### 1. Visa alternativa rutter på kartan igen (TomTomMap.tsx)
- Rita alternativa rutter **före** huvudrutten (så huvudrutten hamnar ovanpå)
- **Vald rutt**: Mörk blå, tjock linje (`#2563eb`, width 6, opacity 1)
- **Ej vald rutt**: Ljusgrå/blekblå, tunnare linje (`#93c5fd`, width 5, opacity 0.6) — synlig men tydligt sekundär
- Ingen offset — de ska ligga på sina faktiska vägar

### 2. Klickbar alternativ rutt
- Lägg till click-event på alternativa ruttlinjerna som triggar `onAlternativeClick`
- Cursor: pointer på alternativa linjer

### 3. Etiketter
- Vald rutt: Mörk blå etikett (som nu)
- Alternativ: Grå/ljus etikett med tid/avstånd, klickbar

### 4. Tur och retur
- Behåll logiken som döljer alternativ vid tur-och-retur (redan implementerat i RoutePlanning.tsx)

### Filer att ändra
- `src/components/TomTomMap.tsx` — rita alternativa rutter med ljus stil + click-handler

