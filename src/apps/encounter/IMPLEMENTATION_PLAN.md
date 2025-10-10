# Encounter-Kalkulation – Implementierungsplan

## Ziel
Eine erweiterte Encounter-Ansicht planen, in der Spielleiter Begegnungen bewerten können, indem sie Spielercharaktere unterschiedlicher Stufen erfassen, XP-Werte vergeben und zusätzliche Regelanpassungen vornehmen.

## Kernfunktionen
1. **Spielercharakter-Verwaltung**
   - Eingabeformular für Charaktername, Level und optional aktuellen XP-Stand.
   - Übersichtliche Tabelle/Liste mit allen hinzugefügten Charakteren.
   - Möglichkeit, Einträge zu bearbeiten oder zu löschen.
2. **XP-Erfassung für das Encounter**
   - Feld zur Eingabe des Gesamt-XP-Werts des Encounters.
   - Sofortige Anzeige des basalen XP pro Charakter (ohne Modifikatoren).
3. **Regelmodifikatoren**
   - Button „Regel hinzufügen“ öffnet Editor mit Feldern für Titel, Gültigkeitsbereich (gesamt vs. pro Spieler), Modifikatortyp (fester Wert, % vom Gesamtwert, % vom XP-Betrag bis zum nächsten Level) und Modifikatorwert.
   - Optionaler Notiz-/Beschreibungstext pro Regel.
   - Toggle „Aktiv“ je Regel; inaktive Regeln bleiben gespeichert, beeinflussen das Ergebnis jedoch nicht.
   - Sortier-/Reorder-Möglichkeiten (Drag & Drop oder Auf/Ab-Buttons), um Regelreihenfolge zu steuern.
   - Anzeige des kumulierten Effekts aller aktiven Regeln inklusive Zwischenschritten (Basis-XP, pro Spieler angewandte Abzüge, endgültiger Gesamtwert).
4. **Ergebniszusammenfassung**
   - Darstellung des finalen XP-Werts nach allen Modifikationen.
   - Breakdown nach Charakter (inkl. angewandter Modifikatoren) und nach Regel.
   - Hinweis, wenn negative Werte entstehen oder Limits überschritten werden.

## UI-Skizze
- **Header**: Encounter-Titel + kurzer Hinweis auf aktuelle XP.
- **Section „Spielercharaktere“**: Formular + Liste mit Spalten für Name, Level, aktueller XP-Stand, Bedienelemente (Bearbeiten/Löschen).
- **Section „XP & Regeln“**: Eingabefeld für Encounter-XP, Liste der Regeln mit Parametern (Titel, Bereich, Modifikatortyp, Wert, optional Notizen) und Toggle, Button „Regel hinzufügen“.
- **Section „Ergebnis“**: Zusammenfassung, Breakdown-Tabellen (inkl. "XP bis Level-up" pro Charakter), Callout für Warnungen.

## Zustands- und Datenmodell
```ts
const DND5E_XP_THRESHOLDS: Record<number, number> = {
  1: 0,
  2: 300,
  3: 900,
  4: 2700,
  5: 6500,
  6: 14000,
  7: 23000,
  8: 34000,
  9: 48000,
  10: 64000,
  11: 85000,
  12: 100000,
  13: 120000,
  14: 140000,
  15: 165000,
  16: 195000,
  17: 225000,
  18: 265000,
  19: 305000,
  20: 355000,
};

type EncounterRuleModifierType =
  | "flat" // fixer Wert (kann negativ sein)
  | "flatPerAverageLevel" // fixer Wert skaliert mit Durchschnittslevel
  | "flatPerTotalLevel" // fixer Wert skaliert mit Gesamtstufen (individuell)
  | "percentTotal" // % des aktuellen Gesamtwerts
  | "percentNextLevel"; // % des XP-Betrags bis zum nächsten Level

interface EncounterXpRule {
  id: string;
  title: string;
  modifierType: EncounterRuleModifierType;
  modifierValue: number; // Prozentwert oder fixer Wert je nach Typ
  enabled: boolean;
  notes?: string;
}

interface EncounterPartyMember {
  id: string;
  name: string;
  level: number;
  currentXp?: number; // optional, falls Spieler nicht exakt auf der Schwelle steht
}

interface EncounterXpState {
  party: EncounterPartyMember[];
  encounterXp: number;
  rules: EncounterXpRule[];
}
```
- Berechnungs-Selector leitet aus `EncounterXpState` die aggregierten Werte ab (z. B. `effectiveEncounterXp`, `xpPerCharacter`).
- Für `scope === "perPlayer"` + `modifierType === "percentNextLevel"` wird pro Charakter der XP-Betrag bis zur nächsten Schwelle ermittelt (`nextLevelXp - currentXpOrThreshold`) und daraus der prozentuale Wert berechnet.
- `percentTotal`-Regeln werden auf den aktuellen Gesamtwert (inkl. vorheriger aktiver Regeln) angewandt, `flat` addieren/subtrahieren direkt.
- Validierung stellt sicher, dass Level ≥ 1, XP ≥ 0 und Prozentwerte in sinnvollem Rahmen liegen; bei Level 20 entfällt der Abzug zum nächsten Level.
- Fallback, wenn `currentXp` nicht gesetzt ist: Es wird der Mindestwert des aktuellen Levels aus `DND5E_XP_THRESHOLDS` angenommen.

## Integrationsaspekte
- Presenter erweitert bestehende Session-Daten um den neuen XP-Block.
- View nutzt zentralen State-Store (`session-store.ts`) für Persistenz (neue Slice hinzufügen).
- Eventuelle Synchronisation mit Cartographer optional durch Flags, aktuell Fokus auf lokale Eingabe.

## Implementierungsschritte
1. ✅ **State-Erweiterung**: Modelle und Aktionen im `session-store` für Party, Encounter-XP und Regeln ergänzen; XP-Schwellentabelle als Konstante hinterlegen.
2. ✅ **Presenter-Anpassung**: Selektoren für Berechnungen, Validierung und Fehlermeldungen implementieren, inklusive Utility `calculateXpToNextLevel(level, currentXp?)`.
3. ✅ **UI-Komponenten**: Neue Unterkomponenten für Party-Liste, Regel-Editor und Ergebnis-Panel in `view.ts` (oder ausgelagerte Dateien) aufbauen.
4. ✅ **Interaktion & Persistenz**: Bindings zwischen View und Store herstellen, inklusive Formularvalidierung und Undo/Reset-Funktionen.
5. ✅ **Tests & Dokumentation**: Unit-Tests für Berechnungslogik, README-Abschnitt zur Nutzung des XP-Tools ergänzen.

## Offene Fragen
- Sollen Level-/XP-Schwellen aus `core` importiert werden oder lokal konfigurierbar sein?
- Wie werden hausregel-spezifische Templates geteilt (z. B. Presets pro Kampagne)?
- Bedarf es einer Export-Funktion (Markdown/Clipboard) für den finalen Encounter-Bericht?
