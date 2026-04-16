# Developer Dictionary

Kleines Glossar zu den Kernbegriffen aus [AGENTS.md](/home/aaron/Schreibtisch/projects/SaltMarcher/AGENTS.md).

## Architektur

| Begriff | Kurz erklaert |
| --- | --- |
| MVCI | Presentation-Pattern mit `Model`, `View`, `Controller` und `Interactor`. |
| Clean Architecture | Backend-Struktur mit klar nach innen gerichteten Abhaengigkeiten. |
| Feature | Fachlicher Bereich mit eigener View-, Domain- und Data-Struktur. |
| Feature API | Einzige oeffentliche Backend-Grenze eines Features unter `src/domain/<feature>/`. |
| Dependency Rule | Aussen liegende Schichten duerfen nach innen zeigen, nie umgekehrt. |
| Standard Flow | UI-Ereignis laeuft ueber Controller und Interactor in Domain und Data und wieder zurueck. |

## Presentation

| Begriff | Kurz erklaert |
| --- | --- |
| Model | JavaFX-Observables fuer reinen UI-Zustand, ohne Fachlogik. |
| View | Layout, Bindings und UI-Ereignisse. |
| Controller | Verdrahtet Aktionen, Lifecycle und Hintergrundarbeit auf Presentation-Seite. |
| Interactor | Uebersetzt zwischen UI-Modell und Feature API. |
| Reactive UI | Die View reagiert ueber Bindings auf Zustandsaenderungen statt Struktur staendig umzubauen. |
| View Contribution | Oeffentlicher Feature-Einstiegspunkt fuer die Shell-Registrierung. |

## Backend

| Begriff | Kurz erklaert |
| --- | --- |
| Domain | Fachlicher Kern mit Regeln, Use Cases und Repository-Interfaces. |
| Entity | Zentrales Fachobjekt mit Verhalten und Invarianten. |
| Value Object | Unveraenderlicher Fachwert mit Bedeutung und Validierung. |
| Use Case | Eine klar abgegrenzte fachliche Aktion oder Abfrage. |
| Repository Interface | Von der Domain benoetigter Vertrag fuer Laden oder Speichern. |
| Data Layer | Technische Adapter fuer Datenquellen, Persistenz und externe Systeme. |
| Data Source | Konkreter Zugriff auf lokale oder entfernte Daten. |
| Mapper | Uebersetzt zwischen Data-Modellen und Domain-Objekten. |

## Shell und Bootstrap

| Begriff | Kurz erklaert |
| --- | --- |
| Bootstrap | Startet die Anwendung und entdeckt Feature-Beitraege generisch. |
| Shell | Passive Host-Oberflaeche mit festen Slots, aber ohne Feature-Logik. |
| Shell Slot | Fester Platzhalter der Shell wie `COCKPIT_MAIN` oder `TOP_BAR`. |
| Shell Runtime Context | Schmale Laufzeit-Schnittstelle der Shell fuer Feature-Screens. |
| Inspector | Gemeinsamer, von der Shell verwalteter Verlauf fuer Detaileintraege. |
| Shell Screen | Feature-seitige Beschreibung, welcher Node in welchen Slot geht. |

## Contribution-Typen

| Begriff | Kurz erklaert |
| --- | --- |
| ShellViewContribution | Vertrag, den ein Feature fuer Shell-Registrierung implementiert. |
| ShellContributionSpec | Metadaten-Objekt, das den Beitragstyp beschreibt. |
| ShellTabSpec | Registriert einen navigierbaren Tab in der linken Navigation. |
| ShellTopBarSpec | Registriert dauerhaft sichtbaren Inhalt in der oberen Leiste. |
| ShellRuntimeStateSpec | Registriert globalen Inhalt fuer den gemeinsamen Runtime-State-Bereich. |
| ShellTabMode.RUNTIME | Tab nutzt den geteilten Runtime-State-Bereich der Shell. |
| ShellTabMode.EDITOR | Tab darf eigenen State-Inhalt fuer den rechten unteren Bereich liefern. |
| ContributionKey | Eindeutiger technischer Schluessel eines Beitrags. |
| NavigationGroupSpec | Offene Metadaten fuer Gruppierung und Sortierung in der Navigation. |
