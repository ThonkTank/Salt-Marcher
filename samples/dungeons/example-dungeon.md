---
id: goblin-hideout
name: Goblin Hideout
parentId: harbor-district
kind: dungeon
grid:
  columns: 24
  rows: 18
  tileSize: 5
rooms:
  - id: R1
    name: Tunnel Mouth
    summary: Narrow cave mouth hidden behind fishing nets.
    sensory:
      sight: Lanternlight flickers across damp stone.
      smell: Brine and stale smoke.
      sound: Muffled goblin chatter echoes deeper within.
    features:
      - id: F1
        label: F1
        name: Concealed Pit
        tag: hazard
        description: A pit trap covered with loose planks and nets.
      - id: T1
        label: T1
        name: Passage to Warrens
        tag: exit
        leadsTo: R2
  - id: R2
    name: Warrens
    summary: A cramped chamber filled with crude bedding and weapon racks.
    features:
      - id: F2
        label: F2
        name: Weapon Cache
        tag: loot
        description: Crates of stolen blades and crossbows.
tokens:
  - id: goblin-scout
    label: Goblin Scout
    kind: npc
    position:
      x: 10
      y: 6
  - id: hero-party
    label: Player Party
    kind: pc
    position:
      x: 2
      y: 4
fog:
  enabled: true
  revealedRooms:
    - R1
version: 1
---
