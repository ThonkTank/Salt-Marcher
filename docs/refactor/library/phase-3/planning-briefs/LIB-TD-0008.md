# LIB-TD-0008 Planning Brief

## Kurzüberblick
Aufbau eines Modal-Lifecycle-Adapters, der Create-Dialogs an Kernel-Hooks bindet und sauberes Dispose gewährleistet.

## Stakeholder
- Modal/UI Team (Owner)
- Renderer Kernel Team
- UX Writer (Bestätigung bestehender Texte)

## Zeitplanung
- Woche 1: Modal-Inventar erstellen, Lifecycle-Anforderungen definieren.
- Woche 2: Adapter-API designen, Abort-Policy abstimmen.
- Woche 3: Kill-Switch-Plan und Regressionstestspezifikation finalisieren.

## Vorbereitungen
- Liste aller `new Create*Modal`-Aufrufe inkl. Kontext zusammentragen.
- Abstimmung mit Event-Bus-Team zu Debounce/Watcher-Übergabe.
- Prüfen, ob UI-Prompts für Abbruch bereits vorhanden sind.

## Offene Punkte
- Umgang mit simultan geöffneten Modals (z. B. Item + Creature) final klären.
