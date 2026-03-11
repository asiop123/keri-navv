

## Rastplatser: Bättre data, bättre design + facilitetfilter

### Problem
1. TomTom ger ofta irrelevanta eller dåliga rastplatsresultat (bensinstationer, små parkeringar)
2. Designen på rastplatsvisningen kan förbättras
3. Det saknas möjlighet att filtrera på faciliteter (toalett, mat, dusch)

### Lösning

#### 1. Bättre rastplatsdata
- **Utöka sökradien** från 20km till 30km och **öka limit** från 8 till 15 för att hitta fler relevanta platser
- **Prioritera lastbilsstopp och rastplatser** över bensinstationer och generella parkeringar i sorteringen
- **Hämta mer detaljer** från TomTom POI-resultaten: öppettider, telefonnummer, adress
- **Lägg till Google Places sökning** som komplement — sök efter "truck stop" / "rastplats" nära samma punkt för att hitta platser TomTom missar

#### 2. Facilitetfilter
Nytt filter-UI i sökformuläret (collapsible sektion) med toggles:
- 🚻 **Toalett** 
- 🍽️ **Mat/restaurang**
- 🚿 **Dusch**
- ⛽ **Drivmedel**
- 🅿️ **Lastbilsparkering**

Filtren sparas i state och skickas till `searchRestStops()` som extra parameter. TomTom:s POI-data inkluderar ibland kategoriinformation vi kan matcha mot. För Google Places kan vi filtrera på `types`.

Filtren appliceras vid ruttberäkning — bara stopp som matchar valda faciliteter visas som föreslagna rastplatser.

#### 3. Bättre design i tidslinjen och detaljkortet
- Visa facilitetikoner (🚻🍽️🚿) bredvid rastplatsnamnet i tidslinjen
- Detaljkortet: visa adress, faciliteter som chips/badges, avstånd från rutten
- Tydligare färgkodning av lämplighetsgrad med ikoner istället för bara färg

### Teknisk design

#### Ny typ: `RestStopFacilities`
```text
interface RestStopFacilities {
  toilet: boolean;
  food: boolean;
  shower: boolean;
  fuel: boolean;
  truckParking: boolean;
}
```

Läggs till på `RestStopInfo` i `src/types/index.ts`.

#### Ändringar i `src/services/tomtom.ts`
- `searchRestStops()` tar nytt `filters?: RestStopFacilities` parameter
- Utöka sökradien och limit
- Försök identifiera faciliteter från TomTom:s `poi.categories` och `poi.classifications`
- Komplettera med Google Places Nearby Search för "truck stop", "rest area" nära samma koordinat
- Filtrera bort stopp som inte matchar krävda faciliteter
- Bättre sortering: lastbilsstopp > rastplatser > bensinstation > parkering, sedan lämplighet

#### Ändringar i `src/pages/RoutePlanning.tsx`
- Nytt state: `restStopFilters: RestStopFacilities` med alla false som default
- Filter-UI: collapsible sektion med toggle-knappar under sökformuläret
- Skicka filtren till `generateTimeline()` → `searchRestStops()`
- Tidslinjen visar facilitetikoner bredvid rastplatsnamn
- Detaljkortet visar faciliteter som badges

#### Ändringar i `src/types/index.ts`
- Lägg till `RestStopFacilities` interface
- Lägg till `facilities?: RestStopFacilities` på `RestStopInfo`
- Lägg till `address?: string` på `RestStopInfo`

### Filer att ändra
- **`src/types/index.ts`** — Ny `RestStopFacilities`, utöka `RestStopInfo`
- **`src/services/tomtom.ts`** — Bättre sökning, Google Places komplement, filtrering
- **`src/pages/RoutePlanning.tsx`** — Filter-UI, bättre tidslinje- och detaljkortdesign

