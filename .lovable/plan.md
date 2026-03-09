

# FleetFlow – Flottstyrningsapp (Frontend MVP)

## Designtema
- **Marinblå** (#1A3B5D) primärfärg – navigation, rubriker, knappar
- **Senapsgul** (#E6B422) – call-to-actions, aktiva element
- **Ljusgrå** (#F5F7FA) bakgrund, vit för kort, antracitgrå (#2C3E50) text
- **Statusfärger**: Grön/Gul/Röd genomgående
- Stora knappar med ikoner, hög kontrast, responsiv design
- Inter-typsnitt

## Rollväxlare
Eftersom vi inte har auth ännu, byggs en enkel rollväxlare (Chef/Chaufför) i navigationen som byter hela vyn. Mockdata för en chef och en chaufför.

## Gemensam Navigation
- Responsiv sidebar (desktop) / bottom navigation (mobil)
- Chef-meny: Översikt, Fordon, Uppgifter, Dokument, Påminnelser
- Chaufför-meny: Min dag, Ruttplanering, Fordon, Dokument, Påminnelser

## 1. Fordonshantering
- **Lista** med alla fordon som kort: regnr, typ, vikt, nästa besiktning med färgkodad status
- **Lägg till fordon** – formulär med alla fält (regnr, längd, vikt, maxlast, axeltryck, besiktning, skatt, försäkring)
- **Fordonsdetalj** – visa all data, kopplad förare, dokument
- **Koppla förare** till fordon
- Mockdata: Volvo FH16 (ABC123) och Scania R500 (DEF456)

## 2. Ruttplanering (Placeholder-karta)
- **Skapa resa**: formulär med start, mellanstopp, slutdestination
- **Välj fordon** från lista (hämtar automatiskt fordonets data)
- **Ange lastvikt** → totalvikt beräknas
- **Välj rutttyp**: Snabbast / Normal
- **Tidslinje-vy**: Genererad dag-för-dag-plan med körpass, raster och viloperioder baserat på EU:s kör- och vilotidsregler (4.5h körning → 45 min rast, max 9/10h körning, 11h dygnsvila)
- **BK-indikator**: Visa totalvikt mot BK-klasser med färgkodning (grön/gul/röd)
- **Placeholder-karta**: Statisk kartbild eller enkel visualisering (ej riktigt kart-API ännu)
- Mockresa: Stockholm → Norrköping → Göteborg

## 3. Påminnelser
- **Samlad lista** med alla påminnelser – sorterade efter datum
- **Färgkodning**: Grön (>30 dagar), Gul (7–30 dagar), Röd (<7 dagar/passerat)
- **Typer**: Besiktning, skatt, körkort, YKB, ADR, underhåll
- Kopplade till fordon eller förare
- Varningstext vid röd status
- Möjlighet att lägga till manuella påminnelser

## 4. Dokumenthantering
- **Lista** med alla dokument – filterbar per typ (registreringsbevis, förarbevis, försäkring, CMR)
- **Ladda upp** dokument (simulerad – filinput med förhandsvisning)
- **Dokumentkort** med typ, titel, kopplat fordon/förare, utgångsdatum med färgkodning
- Automatisk koppling till påminnelse vid utgångsdatum
- Chef ser alla, chaufför ser bara sina (baserat på rollväxlaren)

## 5. Chef – Översiktssida
- Dashboard med sammanfattningskort: antal fordon, aktiva uppgifter, kommande påminnelser
- Lista på förare och deras tilldelade fordon
- Senaste påminnelserna med statusfärger

## 6. Chaufför – Min dag
- Dagens tilldelade fordon och uppgifter
- Nästa kommande påminnelser
- Snabbknapp till "Planera resa"

## Testdata
All mockdata förfylld: 2 fordon, 2 användare, påminnelser med varierande datum, ett par dokument, en exempelresa.

