# Task-Tool

> CLI-Tool für Task-Management in der Development-Roadmap.

**Siehe auch:** [CLAUDE.md](../../CLAUDE.md#4-task-workflow-pflicht) (Workflow-Regeln, Kurzreferenz)

---

## Überblick

Das Task-Tool verwaltet Tasks und Bugs in `docs/architecture/Development-Roadmap.md`. Es ermöglicht:

- **Lesen/Sortieren:** Priorisierte Ausgabe mit Filtern
- **Claim-System:** Exklusiver Zugriff via 4-Zeichen-Schlüssel
- **Bearbeiten:** Status, Dependencies, Beschreibung ändern
- **Erstellen/Löschen:** Tasks und Bugs verwalten
- **Propagation:** Änderungen automatisch in referenzierte Dateien synchronisieren

---

## Architektur

### Dateistruktur

```
scripts/task/
├── task.mjs                    # CLI-Einstiegspunkt
├── core/
│   ├── table/
│   │   ├── parser.mjs          # Markdown-Tabellen parsen
│   │   ├── builder.mjs         # Markdown-Tabellen generieren
│   │   ├── schema.mjs          # Tabellen-Schema (Spalten, Status)
│   │   └── src-table-parser.mjs # Source-File Task-Header parsen
│   ├── deps/
│   │   └── propagation.mjs     # Dependency-Status-Propagation
│   └── result.mjs              # Result<T,E> Monad
├── services/
│   ├── sort-service.mjs        # Priorisierung und Filter
│   ├── lookup-service.mjs      # Task-Details und Dependencies
│   ├── claim-service.mjs       # Claim-Management
│   ├── edit-service.mjs        # Task-Bearbeitung
│   ├── add-service.mjs         # Task/Bug-Erstellung
│   ├── remove-service.mjs      # Task/Bug-Löschung
│   └── sync-service.mjs        # Propagation zu Dateien
└── adapters/
    └── fs-task-adapter.mjs     # Dateisystem-Zugriff
```

### Datenfluss

```
┌─────────────────────────────────────────────────────────────┐
│ task.mjs (CLI)                                              │
│   parse args → route to service → format output             │
└─────────────────────────────────────────────────────────────┘
       │
       ↓
┌─────────────────────────────────────────────────────────────┐
│ services/                                                   │
│   Geschäftslogik für jeden Befehl                          │
│   Liest/Schreibt über Adapter                              │
└─────────────────────────────────────────────────────────────┘
       │                    │
       ↓                    ↓
┌──────────────────┐  ┌──────────────────┐
│ core/table/      │  │ adapters/        │
│ Parse + Build    │  │ Filesystem I/O   │
└──────────────────┘  └──────────────────┘
```

---

## Befehle

### sort - Tasks priorisiert ausgeben

Gibt Tasks sortiert nach Priorität aus.

```bash
node scripts/task/task.mjs sort [keyword] [options]
```

**Argumente:**
| Argument | Beschreibung |
|----------|--------------|
| `keyword` | Optional: Filtert alle Felder (beschreibung, domain, layer, spec, impl) - case-insensitive |

**Optionen:**
| Option | Beschreibung |
|--------|--------------|
| `-s, --status <X>` | Nur Tasks mit Status X |
| `-d, --domain <X>` | Nur Tasks mit Domain X |
| `-l, --layer <X>` | Nur Tasks mit Layer X |
| `--mvp` / `--no-mvp` | Nur MVP / Nur Nicht-MVP |
| `-p, --prio <X>` | Nur Tasks mit Priorität X |
| `--bugs` | Bugs statt Tasks anzeigen |

**Sortierreihenfolge:**
1. Status-Priorität: 🟢 > 🔶 > ⬜ > ⚠️ > andere
2. Priorität: hoch > mittel > niedrig
3. MVP: Ja > Nein
4. Dependencies: Weniger Deps > Mehr Deps

**Beispiele:**
```bash
node scripts/task/task.mjs sort                    # Alle Tasks
node scripts/task/task.mjs sort encounter          # Tasks mit "encounter" (in jedem Feld)
node scripts/task/task.mjs sort NPCs               # Tasks mit Domain "NPCs"
node scripts/task/task.mjs sort --status 🔶        # Nur partial
node scripts/task/task.mjs sort --mvp --prio hoch  # MVP + hohe Prio
```

---

### show - Task-Details anzeigen

Zeigt vollständige Task-Details mit Dependency-Baum.

```bash
node scripts/task/task.mjs show <ID>
```

**Output enthält:**
- Alle Task-Felder
- Dependency-Baum (rekursiv)
- Dependent-Tasks (was von dieser Task abhängt)
- Claim-Status (falls geclaimed)

**Beispiel:**
```bash
node scripts/task/task.mjs show 14
# Output:
# Task #14: generateEncounterLoot implementieren
# Status: ⬜  Prio: mittel  MVP: Ja
# Domain: Encounter  Layer: services
# Deps: #10 (⬜ lootGenerator Service)
# Spec: encounterLoot.md#Step 4.4: Loot-Generierung
# Impl: -
```

---

### claim - Task claimen

Reserviert eine Task für exklusive Bearbeitung.

```bash
node scripts/task/task.mjs claim <ID>
```

**Verhalten:**
1. Generiert 4-Zeichen alphanumerischen Schlüssel
2. Speichert Claim mit Timestamp in `.task-claims.json`
3. Setzt Task-Status auf 🔒
4. Merkt vorherigen Status für Release

**Claim-Regeln:**
- Claims verfallen nach **2 Stunden**
- Nur ein Claim pro Task
- Schlüssel muss für edit/release angegeben werden

**Beispiel:**
```bash
node scripts/task/task.mjs claim 14
# Output: Key: a4x2 (2h gültig)
```

---

### release - Claim freigeben

Gibt einen Claim frei (mit oder ohne Status-Änderung).

```bash
node scripts/task/task.mjs claim <key>
```

**Verhalten:**
- Entfernt Claim aus `.task-claims.json`
- Stellt vorherigen Status wieder her (falls nicht explizit geändert)

---

### edit - Task(s) bearbeiten

Ändert Task-Eigenschaften. Unterstützt Bulk-Bearbeitung mehrerer Tasks.

```bash
node scripts/task/task.mjs edit <ID> [ID2 ID3...] [--key <key>] [options]
```

**Optionen:**
| Option | Beschreibung |
|--------|--------------|
| `--key <key>` | Nur erforderlich wenn Task geclaimed ist (🔒) |
| `--status <X>` | Neuer Status |
| `--deps <X>` | Neue Dependencies (komma-separiert) |
| `--beschreibung <X>` | Neue Beschreibung |
| `--prio <X>` | Neue Priorität |
| `--mvp` / `--no-mvp` | MVP-Flag setzen |

**Beispiele:**
```bash
node scripts/task/task.mjs edit 14 --status 🔶           # Ohne Claim
node scripts/task/task.mjs edit 14 --status ✅ --key a4x2  # Mit Claim
node scripts/task/task.mjs edit 53 54 55 --status 🔶     # Bulk Edit
```

**Automatismen bei Status-Änderung:**
- Status-Änderung entfernt automatisch den Claim (außer auf 🔒)
- Propagiert Status zu Dependents (⛔ bei Blockierung)
- Synchronisiert zu referenzierten Dateien

---

### add - Tasks/Bugs erstellen

Erstellt neue Tasks oder Bugs.

```bash
node scripts/task/task.mjs add --tasks '<JSON>'
node scripts/task/task.mjs add --bugs '<JSON>'
```

**Task-JSON-Format:**
```json
[{
  "domain": "Travel",
  "layer": "features",
  "beschreibung": "Route-Validierung implementieren",
  "deps": "#100, #101",
  "specs": "Travel.md#Zustände",
  "impl": "travel-engine.ts.validateRoute() [neu]"
}]
```

**Multi-Value-Support:** `domain`, `layer`, `specs` und `impl` unterstützen komma-separierte Werte:
```json
{
  "specs": "groupActivity.md#Step-4.1, groupSeed.md#Selection",
  "impl": "groupActivity.ts.selectActivity(), groupSeed.ts.buildPool() [ändern]"
}
```

**Bug-JSON-Format:**
```json
[{
  "beschreibung": "Bug-Beschreibung",
  "deps": "#428"
}]
```

**Pflichtfelder (Tasks):** `domain`, `layer`, `beschreibung`, `deps` (oder "-"), `specs`, `impl`

**Impl-Tags:**
| Tag | Bedeutung | Validierung |
|-----|-----------|-------------|
| `[neu]` | Datei existiert noch nicht | Nur Format geprüft |
| `[ändern]` | Existierende Funktion ändern | Datei + Funktion müssen existieren |
| `[fertig]` | Funktion fertig | Datei + Funktion müssen existieren |

---

### remove - Tasks/Bugs löschen

Löscht Tasks oder Bugs. Unterstützt Bulk-Löschung mehrerer IDs.

```bash
node scripts/task/task.mjs remove <ID> [ID2 ID3...]
node scripts/task/task.mjs remove <ID> --resolve   # Bug resolven
node scripts/task/task.mjs remove 53 54 55         # Bulk Remove
```

**Bug-Resolution (`--resolve`):**
- Entfernt Bug aus `.task-claims.json`
- Entfernt Bug-Referenz aus allen Task-Dependencies
- Löscht Bug-Zeile aus Roadmap

---

## Datenmodell

### Roadmap-Tabellen

**Tasks-Tabelle:**
```markdown
| # | Status | Domain | Layer | Beschreibung | Prio | MVP? | Deps | Spec | Imp. |
|--:|:------:|--------|-------|--------------|:----:|:----:|------|------|------|
| 1 | ⬜ | encounter | services | Context-Filter... | mittel | Nein | - | groupActivity.md#... | groupActivity.ts... |
```

**Bugs-Tabelle:**
```markdown
| b# | Status | Beschreibung | Prio | Deps |
|---:|:------:|--------------|:----:|------|
| b1 | ⬜ | disposition Feld... | hoch | #2 |
```

### Claim-Datei

**Pfad:** `docs/architecture/.task-claims.json`

```json
{
  "claims": {
    "14": {
      "key": "a4x2",
      "timestamp": 1766526461977,
      "previousStatus": "⬜"
    },
    "b1": {
      "key": "f7a6",
      "timestamp": 1766530365127,
      "previousStatus": "⬜"
    }
  },
  "keys": {
    "a4x2": "14",
    "f7a6": "b1"
  }
}
```

**Felder:**
| Feld | Beschreibung |
|------|--------------|
| `claims.<id>.key` | 4-Zeichen Schlüssel |
| `claims.<id>.timestamp` | Claim-Zeitpunkt (ms) |
| `claims.<id>.previousStatus` | Status vor dem Claim |
| `keys.<key>` | Reverse-Lookup: Key → ID |

### Status-Symbole

| Symbol | Bedeutung | Workflow |
|:------:|-----------|----------|
| ⬜ | Offen | `vorbereitung.txt` |
| 🟢 | Bereit | `umsetzung.txt` |
| 🔶 | Partial | `konformitaet.txt` |
| ⚠️ | Broken | `reparatur.txt` |
| 📋 | Review | `review.txt` |
| ⛔ | Blockiert | ABBRUCH |
| 🔒 | Geclaimed | - |
| ✅ | Fertig | - |

---

## Automatismen

### Task-Duplikation

Tasks werden automatisch in **alle** referenzierten Dateien dupliziert (Spec und Impl unterstützen mehrere komma-separierte Einträge):

| Spalte | Ziel | Bedingung |
|--------|------|-----------|
| `Spec` | Markdown-Datei(en) | Immer (pro Eintrag) |
| `Impl` mit `[ändern]`/`[fertig]` | TypeScript-Datei(en) | Datei + Funktion existiert (pro Eintrag) |
| `Impl` mit `[neu]` | - | Keine Duplikation |

### Pfad-Auflösung

**Spec-Referenzen:**
- **Auflösung:** Relativ zu `docs/`
- **Format:** `services/encounter/groupActivity.md#section`
- **Beispiel:** `encounterLoot.md#Step-4.4` → `docs/services/encounter/encounterLoot.md`
- **Validierung:** Datei muss existieren, sonst Fehler

**Impl-Referenzen:**
- **Auflösung:** Erst direkter Pfad in `src/`, dann Glob-Suche
- **Format:** `[pfad/]dateiname.ts[.funktionsname()]`
- **Beispiel einfach:** `groupActivity.ts.selectActivity()` → sucht `src/**/groupActivity.ts`
- **Beispiel vollständig:** `types/entities/creature.ts` → `src/types/entities/creature.ts`
- **Bei mehreren Matches:** Fehler (mehrdeutig) - vollständigen Pfad verwenden
- **Funktion-Suche:** Regex-Pattern für Deklarationen

**Funktions-Erkennung (Regex):**
```
function funktionsname(     # Standard-Funktion
const funktionsname =       # Arrow-Funktion
export function funktionsname(
export const funktionsname =
```

**Duplikat-Format in TypeScript:**
```typescript
// Ziel: Was diese Datei macht
// Siehe: docs/pfad/zum/spec.md
//
// TASKS:
// | # | Status | Domain | Layer | Beschreibung | Prio | MVP? | Deps | Spec | Imp. |
// |--:|:------:|--------|-------|--------------|:----:|:----:|------|------|------|
// | 14 | ⬜ | Enc | srv | Task-Beschr. | hoch | Ja | - | ... | ... |
```

### Dependency-Propagation

**Bei Status-Änderung:**
1. Task wird ⛔ → Alle Dependents werden ⛔
2. Task wird ✅ → Dependents prüfen ob alle Deps erfüllt
3. Bug wird erstellt → Referenzierte Tasks werden ⚠️
4. Bug wird resolved → Tasks aus Bug-Deps werden aktualisiert

### Claim-Expiry

- Claims verfallen nach 2 Stunden
- Bei `sort`/`show`: Abgelaufene Claims werden automatisch entfernt
- Automatische Wiederherstellung des vorherigen Status

---

## Fehlerbehandlung

### Häufige Fehler

| Fehler | Ursache | Lösung |
|--------|---------|--------|
| `TASK_NOT_FOUND` | ID existiert nicht | `sort` für gültige IDs |
| `ALREADY_CLAIMED` | Task von anderem Agent geclaimed | Andere Task wählen |
| `INVALID_KEY` | Falscher Claim-Key | Key aus Claim-Output verwenden |
| `CLAIM_EXPIRED` | Claim älter als 2h | Neu claimen |
| `DEPS_NOT_MET` | Dependencies nicht erfüllt | Deps zuerst bearbeiten |
| `FILE_NOT_FOUND` | Impl-Datei existiert nicht | `[neu]` Tag verwenden |
| `FUNC_NOT_FOUND` | Funktion in Datei nicht gefunden | Funktionsname prüfen |

### Validierung

**Bei `add`:**
- JSON-Syntax wird geprüft
- Pflichtfelder müssen vorhanden sein
- `[ändern]`/`[fertig]`: Datei + Funktion werden geprüft
- Dependency-IDs werden auf Existenz geprüft

**Bei `edit`:**
- Claim-Key muss gültig und nicht abgelaufen sein
- Status-Übergänge werden validiert
- Zyklische Dependencies werden verhindert

---

## Beispiel-Session

```bash
# 1. Verfügbare Tasks finden
node scripts/task/task.mjs sort encounter --mvp

# 2. Task-Details anschauen
node scripts/task/task.mjs show 14

# 3. Task claimen
node scripts/task/task.mjs claim 14
# → Key: a4x2 (2h gültig)

# 4. Nach Implementierung: Status ändern
node scripts/task/task.mjs edit 14 --status ✅ --key a4x2

# 5. Neuen Bug melden
node scripts/task/task.mjs add --bugs '[{"beschreibung": "Fehler in Loot-Berechnung", "deps": "#14"}]'

# 6. Bug resolven
node scripts/task/task.mjs remove b2 --resolve
```
