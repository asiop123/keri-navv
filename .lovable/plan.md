

## Fler turer: Tur och retur-knapp + Flerstegsresor

### Problem
Idag kan man bara planera en enkel rutt (A → B med mellanstop). Det finns ingen snabb tur-och-retur-funktion och inget sätt att kedja ihop flera turer till en hel dagsplan.

### Lösning

#### 1. Tur och retur-knapp (toggle)
- Lägg till en "Tur & retur"-toggle i sökformuläret (under destinationsfältet eller i options-panelen)
- När aktiverad: systemet lägger automatiskt till startpunkten som sista waypoint i ruttberäkningen
- Visuellt: en tydlig toggle/switch med ikon (↩️) bredvid destinationsfältet
- Tidslinjen beräknas korrekt för hela tur-och-retur-resan inklusive kör/vilotider

#### 2. Flerstegsresor ("Lägg till tur")
- I detaljvyn (efter att en rutt beräknats), lägg till en knapp "Lägg till tur" som låter användaren lägga till nästa ben i resan
- State ändras till en array av turer (`trips: TripLeg[]`) istället för en enda `routeResult`
- Varje tur har sin egen rutt och tidslinje, men tidslinjen beräknas **sekventiellt** — tur 2 startar när tur 1 är klar
- Tidslinjen visas som en sammanhängande lista med tydliga avskiljare mellan turer
- Kartan visar alla turer samtidigt (olika färgnyanser per tur)

### Teknisk design

#### Ny state-struktur i RoutePlanning.tsx
```text
interface TripLeg {
  id: string;
  startName: string;
  endName: string;
  route: RouteResult;
  alternativeRoutes: RouteResult[];
  timeline: TimelineEntry[];
}

// Ny state:
trips: TripLeg[]           // Array av alla turer
activeTripIndex: number    // Vilken tur som redigeras
isRoundTrip: boolean       // Toggle för tur och retur
```

#### Tur och retur-logik
- Vid `handleSearch`: om `isRoundTrip` är true, appenda startkoordinaten som sista waypoint till TomTom API-anropet
- Stopptid vid destinationen sätts till ett konfigurerbart värde (default 30 min)

#### Lägg till tur
- Knapp i detaljvyn: "Lägg till tur"
- Öppnar sökfältet igen, men med startpunkt = föregående turs slutdestination
- Avgångstid = föregående turs ankomsttid (sista timeline-entry)
- Ny rutt beräknas och läggs till i `trips`-arrayen
- Tidslinjen slås ihop till en samlad vy

#### Kartan (TomTomMap.tsx)
- Skicka `trips`-arrayen till kartan
- Varje tur ritas med en distinkt färgnyans (blå, grön, lila...)
- Alternativ fortfarande ljusare per tur

### Filer att ändra
- **`src/pages/RoutePlanning.tsx`** — Ny state-struktur, tur-och-retur-toggle, "lägg till tur"-knapp, sammansatt tidslinje
- **`src/components/TomTomMap.tsx`** — Stöd för att rita flera turer med olika färger

