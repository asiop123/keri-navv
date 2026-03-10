

## Analys

Jag har gått igenom koden noggrant. Funktionen är **redan implementerad korrekt**:

1. **`handleSwitchRoute`** i RoutePlanning.tsx byter den klickade rutten till `routeResult` (mörkblå) och flyttar den gamla till `alternativeRoutes` (ljusblå/grå)
2. **`addRouteToMap`** i TomTomMap.tsx ritar om kartan: alternativ ljust först, sedan vald rutt mörkt ovanpå
3. **Click-events** på alternativa linjer och etiketter triggar bytet

### Vad som händer vid klick:
- Vald rutt → mörk blå (`#2563eb`, tjock)
- Gamla valda → ljusare (`#93c5fd`, tunnare, 0.6 opacity)
- Kartan ritas om med rätt färger

**Det finns inget att ändra i koden** — Google Maps-stilen med byte mellan mörk/ljus är redan på plats.

### Rekommendation
Testa funktionen: sök en rutt (t.ex. Stockholm → Göteborg), vänta på att två rutter visas, och klicka sedan på den ljusare linjen eller dess etikett på kartan. Den ska bli mörk och den andra ska bli ljus.

Om det inte fungerar som förväntat, beskriv gärna exakt vad du ser så kan jag felsöka vidare.

