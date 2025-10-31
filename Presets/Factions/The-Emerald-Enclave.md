---
name: The Emerald Enclave
motto: Nature's balance must be preserved
headquarters: Moonstone Hollow
territory: Northern Woodlands and Coastal Regions
influence_tags:
  - value: Religious
  - value: Scholarly
culture_tags:
  - value: Elven
  - value: Human
  - value: Mixed
goal_tags:
  - value: Defense
  - value: Stability
summary: A druidic circle dedicated to protecting the natural world from exploitation and corruption. They maintain sacred groves, monitor wildlife populations, and intervene when civilization threatens to upset the balance.
resources:
  gold: 5000
  food: 2000
  equipment: 500
  magic: 150
  influence: 75
faction_relationships:
  - faction_name: The Zhentarim
    value: -60
    type: hostile
    notes: They exploit natural resources without regard for consequences
  - faction_name: Harpers
    value: 40
    type: allied
    notes: Shared goals of protecting the innocent and maintaining balance
  - faction_name: Lords' Alliance
    value: 10
    type: neutral
    notes: Occasional cooperation on threats to civilization
members:
  - name: Archdruid Silvara Moonwhisper
    is_named: true
    statblock_ref: Archdruid
    role: Leader
    status: Active
    position:
      type: poi
      location_name: Moonstone Hollow
    notes: A wise elven druid who has guided the Enclave for over 200 years
  - name: Ranger Patrol
    is_named: false
    quantity: 12
    statblock_ref: Scout
    role: Scout
    status: Active
    position:
      type: expedition
      route: Patrolling the Northern Border
    job:
      type: patrol
      building: Ranger Station
      progress: 40
  - name: Grove Guardians
    is_named: false
    quantity: 8
    statblock_ref: Druid
    role: Guard
    status: Active
    position:
      type: poi
      location_name: Sacred Grove Alpha
    job:
      type: guard
      building: Sacred Grove
      progress: 100
  - name: Brok Stonefist
    is_named: true
    statblock_ref: Berserker
    role: Champion
    status: Active
    position:
      type: hex
      coords:
        q: 5
        r: -3
        s: -2
    job:
      type: training
      building: Training Grounds
      progress: 65
    notes: Former mercenary who found redemption protecting nature
  - name: Herbalist Apprentices
    is_named: false
    quantity: 6
    statblock_ref: Commoner
    role: Worker
    status: Active
    position:
      type: poi
      location_name: Moonstone Hollow
    job:
      type: gathering
      building: Herb Garden
      progress: 30
smType: faction
---

# The Emerald Enclave

> Nature's balance must be preserved

## Overview
- **Headquarters:** Moonstone Hollow
- **Territory:** Northern Woodlands and Coastal Regions
- **Influence:** Religious, Scholarly
- **Culture:** Elven, Human, Mixed
- **Goals:** Defense, Stability

## Summary
A druidic circle dedicated to protecting the natural world from exploitation and corruption. They maintain sacred groves, monitor wildlife populations, and intervene when civilization threatens to upset the balance.

## Resources
- **gold**: 5000
- **food**: 2000
- **equipment**: 500
- **magic**: 150
- **influence**: 75

## Faction Relationships

- **The Zhentarim** (-60) [hostile] — They exploit natural resources without regard for consequences
- **Harpers** (+40) [allied] — Shared goals of protecting the innocent and maintaining balance
- **Lords' Alliance** (+10) [neutral] — Occasional cooperation on threats to civilization

## Members & Units

- **Archdruid Silvara Moonwhisper** ([Archdruid] · Leader · Active) 📍 Moonstone Hollow — A wise elven druid who has guided the Enclave for over 200 years
- **Ranger Patrol** (×12 · [Scout] · Scout · Active) 📍 Expedition: Patrolling the Northern Border 💼 patrol at Ranger Station (40%)
- **Grove Guardians** (×8 · [Druid] · Guard · Active) 📍 Sacred Grove Alpha 💼 guard at Sacred Grove (100%)
- **Brok Stonefist** ([Berserker] · Champion · Active) 📍 Hex (5, -3, -2) 💼 training at Training Grounds (65%) — Former mercenary who found redemption protecting nature
- **Herbalist Apprentices** (×6 · [Commoner] · Worker · Active) 📍 Moonstone Hollow 💼 gathering at Herb Garden (30%)
