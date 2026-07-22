Status: Active Evidence
Owner: Aaron
Last Reviewed: 2026-07-22
Source of Truth: Confirmed scope, method, carried-forward owner answers, and
discovery prompts for the program-wide SaltMarcher needs interview.

# Program Needs Foundation And Coverage 2026-07-22

## Owner Motivation

> [Owner, wörtlich] Ich glaube ein grundlegendes Problem ist, dass bisher alle
> Features des Programms in Isolation geplant und umgesetzt wurden, und diesen
> Fehler wiederholen wir grade. Wir sollten das Bedürfniss Interview erstmal auf
> alle Features erweitern, die das Programm am Ende haben soll. Modularität ist
> trotzdem ein wichtiges feature, damit wir einzelne Aspekte ohne große Probleme
> bearbeiten können, aber für etwas wie grundlegende Architektur und Technologie
> Entscheidungen wäre ein gesammtbild der Ziele wahrscheinlich wichtig.

## Confirmed Analysis Boundary

The owner selected and confirmed:

- `GM-Kernprodukt`: the complete local GM tool is binding; player-operated and
  remote-play extensions remain parked separately
- `Bestätigtes behalten`: confirmed vision and owner answers remain valid;
  feature requirements, architecture, and code serve only as prompts and
  counterexamples
- `Als verfrüht schließen`: architecture PR #547 must not become target truth
- `Erst Breite, dann Tiefe`: establish the complete GM lifecycle and capability
  map before deepening only gaps and architecture-significant interactions
- `Kleine Themenblöcke`: ask three to five closely related concrete questions
  per interview turn
- `Pro Workflow bestätigen`: confirm one compact interpretation after each
  coherent GM workflow and perform one final overall confirmation

## Carried-Forward Confirmed Cross-Workflow Answers

The following owner-confirmed answers were produced after the Dungeon-focused
interview. They remain product evidence but prescribe no root, storage, module,
transaction, or integration technology.

### Encounter Outcome

One explicit overall confirmation applies Encounter result and completion,
calculated Party XP, and selected named-NPC lifecycle or finite-stock
consequences together or applies none of them. The associated Running Scene
continues. Loot persistence is not part of this confirmation.

### Scene And Encounter Reconciliation

A valid Scene change is saved first and remains usable. Failed Encounter
synchronization is visibly pending; stale Encounter context is never presented
as synchronized. Initialization, refresh, or explicit retry resumes the saved
reconciliation.

### Party Membership Reconciliation

Party activation, deactivation, or deletion becomes authoritative immediately.
Activation assigns no Running Scene automatically. After deactivation or
deletion, only Running Scenes that reference that character and their Encounters
reconcile to the accepted Party state. Failure does not roll back Party and does
not change unaffected running contexts.

### Campaign History

The GM needs an immutable chronological journal of meaningful confirmed World
consequences such as time, travel, Encounter completion, XP, membership,
NPC/stock consequences, and GM corrections. Corrections append linked entries.
A whole-campaign historical snapshot, event replay, or arbitrary past restore
is not required.

## Breadth-First Discovery Prompts

The following census prevents omissions. It is not a confirmed feature list and
does not imply separate modules.

### Already Represented In Current Product Documents

- Party and adventuring-day information
- Creatures, Items, Encounter Tables, saved Encounters, World records, and the
  shared Catalog workspace
- Session planning, deterministic session generation, runtime Scenes, Encounter
  building/combat/resolution, and generated rewards
- Dungeon and Hex authoring, travel, shared map presentation, global travel
  context, perception, and optional Actor Autonomy

### Vision And Inventory Gaps Requiring Program-Level Confirmation

- multiple Campaigns and the boundary between reusable reference knowledge and
  Campaign-specific authored facts
- calendar, campaign time, events, weather generation and override
- music library, tags, automatic ambience choice, and manual table control
- loot generation, actual possession or award, finite resources, and later
  correction
- fast rules/reference lookup beyond the current Creature and Item subsets
- campaign notes, rumours, quests, changing relationships, and improvised
  content created during play
- cross-feature history and session follow-up
- local import/export, reference refresh, backup, restore, and failure recovery
- passive second-monitor presentation without player input

## First Breadth Block: Campaign Foundation And Knowledge

The next owner-answer block must clarify:

1. what the GM creates or selects when beginning a new Campaign and what minimum
   information must exist before preparation or play can start
2. which information is reusable reference knowledge across Campaigns and which
   information belongs to exactly one Campaign
3. whether and how the GM keeps multiple Campaigns, switches between them, and
   avoids accidental cross-Campaign changes
4. how quickly the GM can create an intentionally incomplete NPC, place, item,
   faction, quest, rumour, or similar fact during play and complete it later

No interpretation of these four questions is confirmed yet.

## References

- [Program Needs Interview Series](README.md)
- [Project Vision](../../vision.md)
- [Goal Interview 2026-07-10](../2026-07-10-goal-interview.md)
- [Dungeon Needs Interview 2026-07-20](../2026-07-20-dungeon-needs-interview.md)
