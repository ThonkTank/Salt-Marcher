# Handoff: Influence Map Implementation

> **Status:** ✅ Abgeschlossen (2026-01-06)
> **Vorgaenger:** Research zu XCOM-Style Combat Director Architektur
> **Ergebnis:** Action Layer System in influenceMaps.ts implementiert

---

## Zusammenfassung

Statt des urspruenglich geplanten XCOM-Style 5-Layer-Systems (THREAT, TARGET, COVER, FLANK, SUPPORT) wurde ein **Action Layer System** implementiert, das Action-Schemas mit `_layer` Daten erweitert.

**Entscheidung:** Das Action Layer System ist fuer unseren Use-Case besser geeignet, da es:
- Direkt auf D&D 5e Actions aufbaut
- On-demand Target-Resolution mit Caching ermoeglicht
- Mit dem bestehenden Situational Modifiers Plugin-System integriert

---

## Implementierte Architektur

### Action Layer System

```
initializeLayers(state)
│
├─ Fuer jedes Profile:
│   ├─ buildActionLayerData() fuer jede Action
│   │   ├─ rangeCells, normalRangeCells
│   │   ├─ grid: Map<positionKey, CellRangeData>
│   │   └─ againstTarget: Map<targetId, TargetResolvedData>
│   └─ buildEffectLayers() (Pack Tactics, etc.)
│
└─ Queries:
    ├─ getThreatAt(cell, profile, state)
    ├─ getAvailableActionsAt(cell, profile, state)
    └─ resolveAgainstTarget(action, attacker, target, state)
```

### Kern-Dateien

| Datei | Status | Beschreibung |
|-------|--------|--------------|
| `influenceMaps.ts` | ✅ IMPLEMENTIERT | Action Layer System |
| `turnExecution.ts` | ✅ MIGRIERT | Nutzt `*WithLayers` Types |
| `combatantAI.ts` | ✅ AKTUALISIERT | Re-Exports auf Layer-System |
| `actionScoring.ts` | ✅ AKTUALISIERT | Reaction System (Phase 6) |
| `cellPositioning.ts` | ✅ GELOESCHT | Ersetzt durch influenceMaps.ts |

---

## Nicht implementierte Konzepte

Folgende Konzepte aus der urspruenglichen Research wurden **NICHT implementiert**:

| Konzept | Grund |
|---------|-------|
| 5-Layer System (THREAT, TARGET, COVER, FLANK, SUPPORT) | Zu komplex fuer aktuellen Scope |
| Behavior Profiles (TACTICAL, BERSERKER, COWARD, etc.) | Kann spaeter hinzugefuegt werden |
| Difficulty Modes (merciless, dramatic, etc.) | Kann spaeter hinzugefuegt werden |
| `propagateInfluence()` mit Exponential Decay | Action-based Approach stattdessen |

**Dokumentation geloescht:**
- `docs/research/combat-director-concept/behaviorProfiles.md`
- `docs/research/combat-director-concept/difficultyModes.md`

---

## Aktuelle Dokumentation

| Dokument | Beschreibung |
|----------|--------------|
| [combatantAI.md](../services/combatantAI/combatantAI.md) | Hub-Dokument mit allen Exports |
| [influenceMaps.md](../services/combatantAI/influenceMaps.md) | Action Layer System |
| [actionScoring.md](../services/combatantAI/actionScoring.md) | DPR-Scoring, Reaction System |
| [turnExecution.md](../services/combatantAI/turnExecution.md) | Turn-Planung, OA-System |

---

## Zukuenftige Erweiterungen (optional)

Falls spaeter benoetigt, koennen folgende Features hinzugefuegt werden:

1. **Behavior Profiles** - Gewichtungsfaktoren fuer AI-Entscheidungen
2. **Difficulty Modes** - AI-Spielstaerke anpassen
3. **Cover Layer** - Terrain-basierte Cover-Positionen

Die Research-Dokumentation in `docs/research/` bleibt als Referenz erhalten.
