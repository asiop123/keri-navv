

## Plan: Interaktiv Street View-panorama

Byta ut de statiska Street View-bilderna mot en interaktiv Google Street View-panorama där användaren kan vrida, zooma och "gå runt" — precis som i Google Maps.

### Teknisk approach

**Ny komponent: `src/components/StreetViewPanorama.tsx`**
- Använder `google.maps.StreetViewPanorama` från Google Maps JS SDK (redan laddad i projektet via AddressAutocomplete)
- Tar emot `lat`, `lng`, och valfri `heading` som props
- Renderar en interaktiv panoramavy i en `div`-container
- Fallback-meddelande om Street View inte finns för platsen

**Uppdatera `src/pages/RoutePlanning.tsx`**
- Ersätt den statiska `<img>`-taggen vid destinationskortet (rad 660-665) med `<StreetViewPanorama>`
- Ersätt den statiska `<img>`-taggen vid platsdetalj-kortet (rad 798-801) med `<StreetViewPanorama>`
- Gör panoraman expanderbar till helskärm med en knapp

**Uppdatera `src/components/FleetTracker.tsx`**
- Ersätt den statiska Street View-bilden (rad 333-336) med `<StreetViewPanorama>`

### Resultat
Användaren kan vrida sig 360°, zooma in/ut och navigera längs gatan direkt i appen — både för destinationen i ruttplaneringen och fordon i fleet-trackern.

