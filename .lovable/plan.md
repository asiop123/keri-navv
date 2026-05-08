## Mål
Du ska kunna logga in direkt och börja redigera utan att behöva verifiera e-post. Du får två demoknappar på `/auth` — en för chef, en för chaufför.

## Vad som ändras

**1. Stäng av e-postverifiering**
Konton aktiveras direkt efter signup. Du kommer in på sekunden.

**2. Skapa två demokonton i databasen**
- `chef@demo.se` / lösenord `demo1234` — roll: **chef**
- `chauffeur@demo.se` / lösenord `demo1234` — roll: **chaufför**

Dessa skapas som riktiga konton i auth-systemet med profil + roll. Chef-rollen läggs till manuellt i `user_roles` (eftersom triggern bara sätter chaufför som standard).

**3. Lägg till demoknappar på `/auth`**
Två stora knappar överst på inloggningskortet:
- "Logga in som Chef (demo)"
- "Logga in som Chaufför (demo)"

Klick = auto-fyller fälten och loggar in direkt. Praktiskt för dig att hoppa mellan rollerna under utveckling.

**4. Ditt eget konto (valfritt)**
Du kan fortfarande skapa ett eget konto via "Skapa konto"-fliken. Det kontot blir chaufför som standard. Vill du senare göra ditt eget konto till chef gör jag det med ett enkelt SQL-anrop.

## Efter implementation
1. Öppna `/auth`
2. Klicka "Logga in som Chef (demo)"
3. Du landar på chef-dashboarden och kan redigera fritt
4. Logga ut och testa chaufför-vyn på samma sätt

## Säkerhetsnot
Auto-bekräftad e-post är okej för utveckling, men **innan du publicerar live** bör vi slå på e-postverifiering igen och ta bort demoknapparna. Påminn mig så fixar vi det då.
