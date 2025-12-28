# Encounter-Distance

> **Helper fuer:** Encounter-Service (Step 4.5)
> **Input:** `FlavouredGroup[]`, `EncounterContext`, `PartyState`
> **Output:** `EncounterPerception` (inkl. `initialDistance`)
> **Aufgerufen von:** [Encounter.md](Encounter.md)
>
> **Referenzierte Schemas:**
> - [activity.md](../../entities/activity.md) - Activity mit awareness/detectability
> - [terrain-definition.md](../../entities/terrain-definition.md) - Terrain-Visibility
>
> **Verwandte Dokumente:**
> - [Encounter.md](Encounter.md) - Pipeline-Uebersicht
> - [groupActivity.md](groupActivity.md) - Activity-Generierung (Step 4.1-4.2)
> - [Difficulty.md](Difficulty.md) - Sweet-Spot und Pain-Point Berechnung

Perception-Berechnung fuer Encounters: In welcher Entfernung nimmt die Party das Encounter wahr?

---

## Step 4.5: Perception-Berechnung

**Zweck:** In welcher Entfernung nimmt die Party das Encounter wahr?

**Input:** `FlavouredGroup[]`, `EncounterContext`, `PartyState`

**Output:** `EncounterPerception` (inkl. `initialDistance`)

Die `initialDistance` bestimmt, in welcher Entfernung die Party die Encounter-Gruppe wahrnimmt. Die Berechnung basiert auf **Umgebungsfaktoren** (Terrain, Weather, Activity, Gruppen-/Kreatur-Groesse).

**Hinweis:** Sweet-Spot und Pain-Point (optimale Kampfdistanzen) werden in [Difficulty.md#sweet-spot-pain-point](Difficulty.md#sweet-spot-pain-point) berechnet und fuer Positioning verwendet.

---

## Faktoren-Uebersicht

| Faktor | Einfluss | Beispiel |
|--------|----------|----------|
| **Activity** | Lautstaerke/Auffaelligkeit | sleeping=nah, patrolling=weit |
| **Terrain** | Sichtweite als Obergrenze | Wald=kurz, Ebene=weit |
| **Weather** | Reduktion bei schlechter Sicht | Nebel, Regen reduzieren |
| **Gruppen-Groesse** | Grosse Gruppen sind weiter sichtbar | 100+ Kreaturen = x10 |
| **Kreatur-Groesse** | Riesige Kreaturen sind weiter sichtbar | Gargantuan = x3 |

---

## Bidirektionale Wahrnehmung berechnen

Die Wahrnehmungs-Berechnung verwendet zwei getrennte Wuerfe, die bestimmen bei **welcher Distanz** sich die beiden Seiten gegenseitig bemerken:

1. **Perception-Check** (Encounter -> Party): Bestimmt `encounterAwareDistance`
2. **Stealth-Check** (Encounter versteckt sich): Bestimmt `partyAwareDistance`

**Wer zuerst?** Hoehere Distanz = fruehere Wahrnehmung.

### maxDistance berechnen

Zuerst wird die maximale Sichtdistanz aus Umgebungsfaktoren berechnet:

```typescript
function calculateDistanceModifier(
  group: FlavouredGroup,
  context: EncounterContext
): DistanceModifier {
  // === Terrain-Visibility (Basis) ===
  // Ebene: 8000ft, Wald: 150ft, Berg: 10000ft
  const terrainVisibility = context.tile.terrain.encounterVisibility ?? 120;

  // === Weather-Modifier ===
  // Klar: 1.0, Leichter Regen: 0.85, Starker Regen: 0.6, Nebel: 0.4, Blizzard: 0.2
  const weatherMod = getWeatherVisibilityModifier(context.weather);

  // === Gruppen-Groessen-Modifier ===
  // 1-5: x1.0, 6-20: x2.0, 21-100: x5.0, 100+: x10.0
  const groupMod = getGroupSizeModifier(getTotalCreatureCount(group));

  // === Kreatur-Groessen-Modifier ===
  // Tiny-Medium: x1.0, Large: x1.5, Huge: x2.0, Gargantuan: x3.0
  const sizeMod = getCreatureSizeModifier(getLargestCreatureSize(group));

  // === Sichtbare Signaturen ===
  // Staubwolke: +50%, Rauchsaeule: +100%, Banner: +25%
  const signatureMod = calculateSignatureBonus(group, context);

  // === Maximale Sichtdistanz ===
  // Alle Modifier multipliziert, Weather reduziert, Rest erhoeht
  const maxDistance = terrainVisibility * weatherMod * groupMod * sizeMod * signatureMod;

  return { weatherMod, maxDistance, groupMod, sizeMod, signatureMod };
}

interface DistanceModifier {
  weatherMod: number;
  maxDistance: number;
  groupMod: number;
  sizeMod: number;
  signatureMod: number;
}
```

### Perception-Distanzen berechnen

```typescript
function calculatePerceptionDistances(
  group: FlavouredGroup,
  context: EncounterContext,
  partyState: PartyState,
  activity: Activity
): PerceptionResult {
  // 1. Maximale Sichtdistanz berechnen
  const distanceModifier = calculateDistanceModifier(group, context);

  // 2. Perception-Check fuer encounterAwareDistance
  //    Encounter versucht, Party wahrzunehmen
  const bestPPBonus = Math.max(...group.creatures.map(c => c.passivePerception - 10));
  const perceptionRoll = d20() + bestPPBonus;

  // Activity-Modifier: awareness 0-100 = % des Endergebnisses
  const effectivePerception = perceptionRoll * (activity.awareness / 100);
  const perceptionExcess = effectivePerception - partyState.passiveStealth;

  // 3. Stealth-Check fuer partyAwareDistance
  //    Encounter versucht, sich zu verstecken
  const bestStealthBonus = Math.max(...group.creatures.map(c => c.stealthBonus ?? 0));
  const stealthRoll = d20() + bestStealthBonus;

  // Activity-Modifier: detectability invertiert = % des Endergebnisses
  const effectiveStealth = stealthRoll * ((100 - activity.detectability) / 100);
  const stealthExcess = effectiveStealth - partyState.bestPassivePerception;

  // 4. Ueberschuss als Prozent der maxDistance
  const SCALING_FACTOR = 10;  // 10 Punkte Ueberschuss = 100% maxDistance

  const encounterAwareDistance = perceptionExcess > 0
    ? distanceModifier.maxDistance * Math.min(perceptionExcess / SCALING_FACTOR, 1)
    : 0;

  const partyAwareDistance = stealthExcess > 0
    ? distanceModifier.maxDistance * Math.max(1 - (stealthExcess / SCALING_FACTOR), 0.05)
    : distanceModifier.maxDistance;  // Stealth gescheitert -> volle Distanz

  return {
    encounterAwareDistance: roundTo5ft(encounterAwareDistance),
    partyAwareDistance: roundTo5ft(partyAwareDistance),
    encounterAware: encounterAwareDistance > 0,
    partyAware: true  // Party sieht immer (bei irgendeiner Distanz)
  };
}

function roundTo5ft(distance: number): number {
  return Math.round(distance / 5) * 5;
}
```

---

## Formel-Zusammenfassung

| Property | Formel | Effekt auf Distanz |
|----------|:------:|-------------------|
| `awareness` | result x (awareness/100) | Hoeher -> Encounter sieht Party frueher (groessere Distanz) |
| `detectability` | result x ((100-detect)/100) | Hoeher -> Party sieht Encounter frueher (groessere Distanz) |

**Scaling:** 10 Punkte Ueberschuss entspricht 100% der maxDistance.

---

## Berechnungs-Beispiele

### Wald-Ambush (visibility 150ft, klar)

**Setup:**
- Terrain: Wald (visibility 150ft), Weather: Klar (1.0)
- Encounter: 5 Goblins (groupMod 1.0), Medium (sizeMod 1.0), keine Signatur
- **maxDistance** = 150 x 1.0 x 1.0 x 1.0 = **150ft**

**Ambush (awareness=95, detectability=10):**
- Party PS: 12, Party PP: 14
- Encounter: PP 12 (+2), Stealth +4
- **Perception**: (d20+2) x 0.95 = 15 x 0.95 = 14.25. Excess: 2.25 -> 22.5ft
- **Stealth**: (d20+4) x 0.9 = 18 x 0.9 = 16.2. Excess: 2.2 -> 150 - 33ft = 117ft
- **Ergebnis**: `encounterAwareDistance: 25ft`, `partyAwareDistance: 115ft`
- **Interpretation**: Party sieht nichts bis 115ft, Encounter wartet bis 25ft -> **Ambush!**

### Ebene-Raid mit Rauchsaeule (visibility 8000ft, klar)

**Setup:**
- Terrain: Ebene (visibility 8000ft), Weather: Klar (1.0)
- Encounter: 50 Orcs (groupMod 5.0), Medium, Rauchsaeule (+100%)
- **maxDistance** = 8000 x 1.0 x 5.0 x 1.0 x 2.0 = **80,000ft (~15 Meilen)**

**Raiding (awareness=60, detectability=90):**
- Encounter: PP 10 (+0), Stealth +2
- **Perception**: (d20+0) x 0.6 = 12 x 0.6 = 7.2. Excess: -4.8 -> **0ft**
- **Stealth**: (d20+2) x 0.1 = 15 x 0.1 = 1.5. Excess: -12.5 -> **maxDistance**
- **Ergebnis**: `encounterAwareDistance: 0ft`, `partyAwareDistance: 80,000ft`
- **Interpretation**: Party sieht Rauch von 15 Meilen, Orcs bemerken nichts

### Nebel-Encounter (visibility 150ft, Nebel 0.4)

**Setup:**
- Terrain: Wald (visibility 150ft), Weather: Nebel (0.4)
- Encounter: 3 Woelfe (groupMod 1.0), Medium, keine Signatur
- **maxDistance** = 150 x 0.4 x 1.0 x 1.0 = **60ft**

**Hunting (awareness=90, detectability=30):**
- Encounter: PP 13 (+3), Stealth +4
- **Perception**: (d20+3) x 0.9 = 17 x 0.9 = 15.3. Excess: 3.3 -> 33ft
- **Stealth**: (d20+4) x 0.7 = 18 x 0.7 = 12.6. Excess: -1.4 -> **maxDistance**
- **Ergebnis**: `encounterAwareDistance: 35ft`, `partyAwareDistance: 60ft`
- **Interpretation**: Party sieht Woelfe bei 60ft, Woelfe bemerken Party bei 35ft -> **Beide aware, Party zuerst**

---

## Activity-Effekte auf Wahrnehmung

| Activity | Awareness | Detectability | encounterAwareDistance | partyAwareDistance |
|----------|:---------:|:-------------:|:----------------------:|:------------------:|
| sleeping | 10 | 20 | Sehr kurz (10% Perception) | Kurz (80% Stealth) |
| ambushing | 95 | 10 | Sehr lang (95% Perception) | Sehr kurz (90% Stealth) |
| patrolling | 80 | 60 | Lang (80% Perception) | Moderat (40% Stealth) |
| raiding | 60 | 90 | Moderat (60% Perception) | Sehr lang (10% Stealth) |
| war_chanting | 45 | 100 | Kurz (45% Perception) | Maximum (0% Stealth) |

---

## Terrain-Visibility

Terrain-Sichtweite wird aus `terrain.encounterVisibility` gelesen.

-> **Source of Truth:** [terrain-definition.md#default-presets](../../entities/terrain-definition.md#default-presets)

| Terrain | Visibility | Begruendung |
|---------|:----------:|-------------|
| Ebene | 8000 ft (~1.5 mi) | Freie Sicht bis zum Horizont |
| Wald | 150 ft | Dichtes Blattwerk und Staemme |
| Berg | 10000 ft (~2 mi) | Erhoeht, weite Sicht |

---

## Gruppen-Groessen-Modifier

| Anzahl | Modifier | Beispiel |
|:------:|:--------:|----------|
| 1-5 | x1.0 | Kleine Patrouille |
| 6-20 | x2.0 | Groessere Gruppe |
| 21-100 | x5.0 | Trupp, Karawane |
| 100+ | x10.0 | Armee, grosse Horde |

---

## Kreatur-Groessen-Modifier

| Size | Modifier |
|------|:--------:|
| Tiny-Medium | x1.0 |
| Large | x1.5 |
| Huge | x2.0 |
| Gargantuan | x3.0 |

---

## Sichtbare Signaturen

| Signatur | Bonus | Ausloeser |
|----------|:-----:|-----------|
| Staubwolke | +50% | Grosse Gruppen auf trockenem Terrain |
| Rauchsaeule | +100% | Lager mit Feuer |
| Banner/Flaggen | +25% | Militaerische Gruppen |

---

## Weather-Modifier

| Wetter | Modifier |
|--------|:--------:|
| Klar | 1.0 |
| Leichter Regen | 0.85 |
| Starker Regen | 0.6 |
| Nebel | 0.4 |
| Blizzard | 0.2 |

---

## EncounterPerception Schema

```typescript
interface EncounterPerception {
  detectionMethod: 'visual' | 'auditory' | 'olfactory' | 'tremorsense' | 'magical';

  // Bidirektionale Wahrnehmungs-Distanzen
  encounterAwareDistance: number;       // Distanz, bei der Encounter die Party sieht (0 = nie)
  partyAwareDistance: number;           // Distanz, bei der Party das Encounter sieht
  initialDistance: number;              // = max(encounterAwareDistance, partyAwareDistance)

  // Abgeleitete Flags (fuer Kompatibilitaet)
  partyAware: boolean;                  // = partyAwareDistance > 0 (immer true)
  encounterAware: boolean;              // = encounterAwareDistance > 0

  creaturePassivePerceptions: number[];

  // Wuerfel-Ergebnisse (fuer Debug/Transparenz)
  rolls?: {
    perceptionRoll: number;             // d20 + PP-Bonus
    stealthRoll: number;                // d20 + Stealth-Bonus
    effectivePerception: number;        // perceptionRoll x (awareness/100)
    effectiveStealth: number;           // stealthRoll x ((100-detectability)/100)
  };

  modifiers?: {
    noiseBonus?: number;
    scentBonus?: number;
    stealthPenalty?: number;
  };
}
```

**Ergebnis:** Die berechnete Perception wird im FlavouredEncounter gespeichert und von Difficulty fuer den Distance-Modifier verwendet.

**Interpretation:** Wer die hoehere Distanz hat, nimmt den anderen zuerst wahr. Bei `encounterAwareDistance > partyAwareDistance` wird die Party ueberrascht.

---

## Perception-Aggregation (Multi-Group) {#perception-aggregation}

Bei Multi-Group-Encounters wird die **maximale Distanz** aller Gruppen verwendet:

```typescript
function aggregateEncounterDistance(groups: FlavouredGroup[]): number {
  // Lauteste/auffaelligste Gruppe bestimmt die Encounter-Distanz
  return Math.max(...groups.map(g => g.perception.initialDistance));
}
```

**Beispiel:** Banditen (laut, 200ft) + Gefangene (leise, 50ft) -> Encounter startet bei 200ft, alle Gruppen werden sichtbar.

Das aggregierte Ergebnis wird im `FlavouredEncounter.encounterDistance` Feld gespeichert.

---

## Tasks

| # | Status | Domain | Layer | Beschreibung | Prio | MVP? | Deps | Spec | Imp. |
|--:|:------:|--------|-------|--------------|:----:|:----:|------|------|------|
