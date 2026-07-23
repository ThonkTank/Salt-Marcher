Status: Draft
Owner: Aaron (Product Owner)
Last Reviewed: 2026-07-23
Source of Truth: Owner-confirmed observable cross-workflow needs for the
complete local SaltMarcher GM core. This complete candidate still awaits final
whole-baseline owner confirmation and is not yet an architecture input.

# SaltMarcher Program Capability Requirements

## Goal

Define one coherent needs baseline for preparing, running, and following up on a
local tabletop Campaign before deriving technical needs or deciding feature,
module, persistence, integration, or technology boundaries.

The [Project Vision](../vision.md) remains the owner of users, top-level jobs,
and product non-goals. This document owns confirmed observable behavior that
spans or precedes individual feature requirements.

## Scope Boundary

- The binding horizon is the complete local GM-operated core product.
- Player-operated applications, remote play, and unspecified distant
  extensions are parked and cannot constrain the core architecture.
- A passive GM-controlled second-monitor output remains eligible for the core
  because it accepts no player input.
- Current code, feature names, feature requirements, architecture, and storage
  are not target constraints.

## Non-Goals

- choosing source modules, feature boundaries, APIs, schemas, databases,
  transaction mechanisms, frameworks, or other technologies
- scheduling implementation or preserving current implementation behavior that
  the owner has not confirmed as need
- treating this unconfirmed candidate as the baseline for architecture review

## Confirmed Workflow: Campaign Foundation And Knowledge

### Campaign Lifecycle

The GM can create a Campaign with only a name and keep several Campaigns in
SaltMarcher. Switching happens immediately through options or settings. Running
Scene, Encounter, and travel state in the Campaign being left remains preserved
and resumes when the GM returns; switching requires no warning, confirmation,
or prior closure.

### Reusable And Campaign-Specific Knowledge

Rules, general Creature data, and Item definitions are reusable references
across Campaigns. PCs, NPCs, places, factions, quests, rumours, possessions, and
concrete Item instances belong to one Campaign. A Campaign-specific object may
be copied into another Campaign, where it becomes fully independent. Objects of
the same kind may share a name.

Quests, rumours, and similarly complex narrative concepts are lightweight,
note-first GM records which may be attached to places, factions, or NPCs.
SaltMarcher does not require encoded completion conditions, NPC trigger graphs,
or automatic resolution; the GM resolves the record manually.

Campaign content references reusable definitions rather than owning copies.
Current and future play reads the current definition. Updating a definition does
not retroactively recalculate completed Scenes or their historical facts.

### Roster, Current Party, And Planning Party

Each Campaign has one `Roster` containing every Campaign PC, whether currently
participating or not. At most one current `Party` contains those Roster
characters whose players currently participate at the table. Groups assigned
to different Running Scenes are subdivisions of that Party, not separate
Parties.

A Session may be authored without a Party. Before generation, the GM selects a
planning-only expected Party from the Roster. This selection enables planning
calculations but neither is nor changes the current table Party.

### Minimal Creation And Explicit Deletion

A Campaign object requires only a name; every other property is optional and may
be completed later. When the GM creates an object from a Running Scene, the
creation dialog attaches it to that Scene by default and lets the GM opt out.

Explicit deletion removes an object from preparation, Running Scenes, and
Running Encounters, including runtime state that depends on it. Completed
history retains the historical fact but displays the missing identity as
`[UNKNOWN]`. If the object remains recoverable in trash, the history may link to
that recoverable object.

### Acceptance Criteria

- the GM can create a usable empty Campaign by entering only a name
- the GM can switch Campaigns immediately and later resume the exact Running
  Scene, Encounter, and travel state left in each Campaign
- a Session can be manually authored without selecting any Party
- generation uses a Session-owned expected Party selected from the Roster and
  does not change the current table Party
- copying Campaign-specific content into another Campaign creates an
  independently editable object
- a changed reusable definition affects current and future reads without
  changing completed Scene facts
- the GM can attach a note-first Quest or rumour to a place, faction, or NPC and
  resolve it manually without authoring automated completion conditions
- name-only creation from a Running Scene attaches there by default and exposes
  an opt-out before confirmation
- explicit deletion removes current references and dependent Encounter runtime
  while completed history keeps its fact with an unknown or recoverable-trash
  reference

## Confirmed Workflow: Session Preparation And Supporting Content

### Planning Workspace And Timeline

`Session` is an unnamed, date-independent planning workspace rather than a
Campaign content object. It holds one current plan that the GM may reuse or
replace. The plan is an ordered timeline of expected Scene occurrences. Each
entry may contain notes and reference zero or one location; the same location
may appear in several entries. The GM can add, remove, reorder, and annotate
entries at any time.

Timeline entries are not stored Scenes. A Scene exists only as resumable runtime
state. The primary Running Scene is always available in the Scene tab and only
changes its contents; the GM neither starts nor ends it. Splitting characters
out of that Scene creates additional Running Scenes.

The GM can prepare the complete timeline, monster groups, treasures, and
location placements manually without a planning Party, Adventure Day, name,
date, or generation.

### Assisted Generation

Generation uses a planning-only expected Party selected from the Roster and
does not change the current table Party. It requires an Adventure Day. For the
selected characters and levels, the Adventure Day provides the DMG-guided
Encounter amount, XP budget, and loot budget used to create monster groups and
treasures.

The GM may optionally provide a desired Scene count and select locations,
factions, NPCs, Items, or other Campaign content. Every selected object is a
binding constraint and must occur in the suggested Scenes. SaltMarcher may add
other existing or newly created Campaign content. Before generation it checks
whether all constraints fit the Adventure Day. If not, it explains the conflict
and disables generation instead of producing a partial result.

Generation returns a timeline with concrete monster groups and treasures. The
GM can edit, regenerate, reject, accept, and place each result independently.
Regenerating one result leaves every other result, manual edit, placement, and
timeline change untouched.

### Accepted World Content And Treasures

Placing a monster group or treasure accepts it as persistent World content. It
remains editable and survives replacement of the current plan. Replacing the
plan removes its timeline, timeline notes, and unaccepted drafts without
changing any accepted placement.

When the Party reaches a prepared location, its placed monster groups and
treasures appear in the Running Scene UI. SaltMarcher does not begin combat or
award anything automatically; the GM decides what happens.

A treasure may contain Items, including coins, trade goods, magic Items,
equipment, and other possessions. The GM can independently add, remove,
replace, and edit each Item before or after placement and move Items between
treasures and locations.

### Weather, Music, And Notes

Weather is not Session preparation. It develops autonomously from location
terrain and other available climate data; its live behavior follows the
confirmed Scene-time, climate, and override requirements below.

Songs are stored locally. When adding a song, the GM assigns mood, intensity,
vibe tags, and genre and can manage that data later. Scene sliders supply mood
and intensity input; locations, NPCs, factions, monsters, and other Scene
content contribute vibe tags and genres. The exact mood axes and categorization
model remain subject to product testing.

The GM may enable or disable autoplay. When enabled, the currently focused
Running Scene drives the automatically generated music queue. Scene changes
update that queue, and a song that no longer fits fades out gradually. Manual
stop, skip, back, selection, queue, and loop actions take precedence until the
manual choice ends, after which autoplay resumes if still enabled.

Every authored or generated object may carry free-form GM notes. Notes relevant
to a Running Scene are visible and editable there, and the GM can search notes
across every kind of object.

### Acceptance Criteria

- the GM can build all preparation manually in an unnamed, undated planning
  workspace without choosing a Party or using generation
- the GM can freely edit and reorder a timeline whose entries each reference
  zero or one location
- replacing the current plan removes only its timeline and unaccepted work and
  preserves all accepted World placements
- generation remains unavailable with an explanation when its binding inputs
  cannot fit the selected Party's Adventure Day
- a generated monster group or treasure can be changed or regenerated without
  changing any other generated or manual preparation
- reaching a prepared location exposes placed content without starting or
  awarding it automatically
- treasure Items remain individually editable and movable after placement
- weather requires no Session preparation
- the focused Running Scene drives optional autoplay while manual music
  controls take precedence
- the GM can edit relevant notes in a Running Scene and search notes across all
  object kinds

## Confirmed Workflow: Live Table Play

### Continuous Scene State And Party Splits

The primary Running Scene is always available as mutable runtime state in the
Scene workspace; the GM neither creates nor completes it. A Scene has zero or
one current location. Split Scenes need no name or label.

Every active Party character belongs to exactly one Running Scene. Activating a
Roster character assigns that character to the GM-focused Scene. Inactive
Roster characters belong to no Scene and retain their last location and other
state.

The GM uses the same action to move selected characters into a new or existing
Scene. An empty Scene is removed and a remaining populated Scene becomes the
primary Scene. If the current Party is empty, one empty primary Scene remains
available.

Changing a Scene's location replaces its location-derived NPCs, Features,
treasures, monster groups, and other content. The GM may instead pin any
Scene-capable content to that Scene or assign it to travel with exactly one
Party subgroup. Content that leaves or outlives a Scene remains at its location
and is never implicitly deleted.

### Masks And Prepared Monster Groups

Persistent preparation creates editable monster groups at locations, not
Encounters. At a Scene's current location, the GM selects individual monsters
or groups and Scene participants to start an Encounter.

Encounter, Chase, and possible future masks add focused runtime behavior over
the continuously visible Scene. Several masks of the same or different types
may coexist, and one PC, NPC, or monster may participate in several masks.
Moving a character to another Scene removes that character from every mask
without blocking the move.

The GM ends an Encounter through the confirmed completion workflow. Its
confirmed consequences apply while the Running Scene continues.

### Live Search, Creation, Notes, And Music

The GM can search all content without leaving the Scene and add a result
directly to it. The GM can also create lightweight, note-first Campaign content
there, including NPCs, locations, factions, Quests, rumours, and similar
objects. Complete data records such as Items and monsters remain outside
Scene-local creation.

Relevant object notes remain visible and editable in the Scene, while notes
across every object kind remain searchable. The focused Scene drives optional
music autoplay. Scene changes update the queue, obsolete songs fade out, and
the GM's manual player actions take precedence.

### Independent Time And Weather

Every Scene advances its own time through travel, exploration, and mask
activity. Encounter and Chase rounds last six seconds. Travel duration is
calculated from applicable factors. The GM may override any input factor, the
final duration, or both; a final-duration override is authoritative while it
remains active. The GM chooses exploration duration.

The GM may increment Scene time forward or backward. When groups with different
times reunite, the GM manually chooses their temporal resolution. Moving
temporal focus backward never deletes history, reverses World state, or rolls
back another Scene. A fact recorded later at the table may carry an earlier
in-world time and is treated as having happened then. Only an explicit deletion
operation removes its selected target.

Weather advances independently from each Scene's time, location, terrain, and
climate data. A GM override remains until the GM disables it, after which
autonomous weather resumes.

### Passive Second Display

The passive second display immediately follows the focused Scene. During travel
it automatically shows the map; at a location it automatically shows background
art. The map combines the durable map knowledge of all characters in the
focused Scene. Current visibility is the union of what at least one of those
characters can perceive and updates with position, line of sight, light,
hidden state, weather, elevation, and similar visibility changes.

NPC artwork appears only when highlighted by the GM. During an Encounter or
Chase, the GM may enable automatic artwork for the current actor. The display
contains only maps and NPC or location artwork; it never exposes mechanics,
text, or private notes. The GM can blank it or manually replace the automatic
visual at any time.

### Acceptance Criteria

- one empty primary Scene remains usable when no Party character is active
- every active Party character appears in exactly one Scene, and activation
  assigns that character to the focused Scene
- the GM can split and reunite the Party through the same character-move action
  without implicitly deleting content left at a location
- entering a location makes its prepared monster groups available without
  creating or starting a persistent Encounter
- several masks and shared mask participants may coexist while the Scene
  remains continuously usable
- moving a character to another Scene removes that character from every mask
  without blocking the move
- the GM can search all content, add a result, and create note-first Campaign
  content without leaving the Scene
- split Scenes may advance to different times, and their later reunification
  never deletes history or reverses confirmed World state
- automatic weather follows each Scene independently and resumes when the GM
  releases a manual override
- the passive second display switches with Scene focus, distinguishes current
  perception from remembered knowledge without revealing unknown or hidden
  live details, never exposes textual or mechanical state, and can be blanked
  or replaced by the GM

## Confirmed Workflow: Spatial Travel And Campaign-Time Progression

### Places, Subplaces, And Scene Continuity

Travel is one live GM workflow for the focused Scene across ordinary places,
Hex maps, and Dungeons. A full place is a Scene boundary. Subplaces, Dungeon
navigation areas, and exact cells refine position within that Scene without
creating another one. Characters at different full places require different
Scenes.

Moving only part of a Scene's Party subgroup to another full place creates or
joins another Scene. Moving the complete subgroup changes the existing Scene's
place. Places may be nested on Hex and Dungeon maps. The GM may assign an
unmapped place administratively, but that action is not travel and advances no
time automatically.

Weather, music tags, ambience context, and loot-, Encounter-, and
faction-appearance factors may flow from containing places into children. The
GM chooses additive or replacing behavior separately for each factor family
and place; additive behavior is the default.

### Travel, Interruptions, And Overrides

For adjacent movement the GM selects a destination. For a longer journey the
GM selects travel points and uses a route within the current map. Cross-map
route planning is optional future convenience rather than binding core scope.

Travel advances position, Scene time, weather, tracks, perception, events, and
applicable autonomous World behavior. The GM may pause, resume, reroute, end,
or change the real-time presentation speed without changing in-world duration.
Every route point and interruption is a committed checkpoint.

Events, Traps, relevant tracks, and perceived NPCs stop further route progress
at a checkpoint for GM inspection. Perceiving an NPC exposes it in the Scene
but does not start an Encounter without explicit GM confirmation.

The GM may override any travel-duration input, the calculated final duration,
or both. While present, a final-duration override wins over all inputs. The GM
may undo and redo several travel checkpoints. Undo removes the journey segment
and every result introduced only by that segment, while preserving facts
already established by a later authoritative Scene.

### Independent Scene Time And World Progression

Split Scenes advance independently. Autonomous World behavior for one
in-world period occurs once and is reused when an earlier Scene reaches that
period. The furthest-advanced Scene is authoritative for shared World facts.

The target outcome is that the complete Campaign World progresses with
GM-confirmed campaign time. Optional Actor Autonomy remains individually
GM-enabled and bounded. Party involvement pauses before autonomous danger
resolution; permitted non-Party behavior may continue. Computation strategy
and scale handling remain later technical decisions rather than product-scope
reductions.

The GM normally avoids introducing an earlier-time contradiction. If a change
would conflict with already dependent later history, SaltMarcher warns but
allows it, marks the affected history as conflicting, and lets the GM resolve
it manually. The marker remains until the GM explicitly confirms resolution.

### Hex Maps, Knowledge, And Visibility

SaltMarcher supports several continuous Hex maps. Each has no fixed authored
extent and provides predetermined mouse-wheel zoom levels from local
three-mile Hexes to world scale. Coarse facts supply finer defaults; detailed
edits recalculate their coarse aggregate.

The GM can author terrain, rivers, roads, cliffs, ravines, location markers,
assets, and faction influence; import and export maps; and control Fog of War,
unknown regions, and manual reveal. Weather and elevation influence sight
distance. Procedural Hex generation and autonomous faction simulation are
distant extensions.

Map knowledge belongs to individual characters. The passive map for the
focused Scene shows the union of its characters' knowledge. A general GM
reveal action adds selected knowledge to relevant characters without requiring
character-to-character transfer bookkeeping.

### Climate, Weather, And Ambience

A Hex map has a quick fallback climate plus paintable or otherwise modulatable
regional climate zones. Seasonal baselines and coherent moving phenomena
produce gradual, geographically sensible weather without unrelated random
weather per Hex or burdensome meteorological setup. The GM may author weather
events with an affected area, type, intensity, movement, time extent, notes,
and mechanical effects and may pause, edit, or end them.

Structured weather effects initially cover visibility, travel, perception,
temperature, ambience, and music. Combat-facing effects may remain prominent
notes for GM adjudication. A mechanically relevant weather change updates its
effects and creates a Scene-associated notification which remains until the
weather ends or the GM dismisses it; it does not itself stop travel. New
influence families, such as creature preferences for weather or time of day,
remain locally extensible needs.

Music and ambience use locally managed and categorized files. Weather and
environment layers combine automatically, and SaltMarcher balances the mix.
The GM may add sounds to or suppress sounds from the automatic selection.
Those choices persist until released, after which automation resumes from the
Scene's current place, weather, and time.

### Acceptance Criteria

- the GM can move a complete or partial Scene subgroup through one travel
  workflow without leaving the Scene workspace
- adjacent movement and routed travel advance position and in-world time
  together to explicit checkpoints
- an event, Trap, relevant track, or perceived NPC stops further progress for
  GM inspection without deciding its fictional outcome
- the GM can override travel factors or final duration and can undo and redo
  several checkpoints without erasing facts already established by a later
  authoritative Scene
- split Scenes reuse World behavior already processed for the same in-world
  period and expose conflicts for manual resolution rather than silently
  rewriting established history
- coarse and fine Hex-map edits propagate across zoom levels while preserving
  GM control over terrain, routes, locations, influence, visibility, and reveal
- the focused Scene's passive map shows only the union of its characters'
  knowledge and current perception
- weather changes coherently across regions and time, applies its structured
  effects, and keeps a dismissible notification visible while mechanically
  relevant
- manual ambience additions and suppressions coexist with automatic selection
  and balancing until the GM releases them

## Confirmed Workflow: Follow-Up, Progression, And Reward Ledger

### Encounter Consequences And XP

Ending an Encounter carries forward tracked HP, rule-derived deaths, and XP
while the Running Scene continues. Conditions, capture, location, resource use,
notes, and other narrative consequences remain ordinary GM edits rather than
inferred completion results.

A dead PC or NPC remains as a dead character in the Roster or at its place, may
be revived by the GM, and is never automatically deleted.

Encounter XP defaults to participating PCs in the initiative order. The GM may
add or remove recipients before distribution. SaltMarcher divides XP equally
and rounds each individual share up. Crossing an XP threshold immediately
changes the character's derived level state without GM confirmation.

An XP correction immediately recalculates derived level state while history
retains the original award and linked correction. If an inactive character
receives XP, the GM is informed once when that character is next activated;
the information then clears automatically.

### Rewards And Narrative Notes

Encounter and manually resolved Quest rewards use one GM-facing distribution
dialog. A Treasure may be distributed partially or completely, and
undistributed Items may remain with the Treasure or at its place. The GM chooses
every Item recipient; SaltMarcher does not choose one automatically.

Quests, rumours, and similarly complex narrative concepts are lightweight
records attached to places, factions, or NPCs. They contain open-or-closed
state, free text, optional structured Rewards, and, for a Quest, a structured
contributor set. A new Quest begins without contributors unless its creation
context supplies selected characters.

SaltMarcher does not model Quest completion conditions, NPC trigger graphs, or
automatic narrative resolution. The GM resolves the note manually. Structured
narrative Rewards are XP and Items, where Items include coins, equipment, trade
goods, magic Items, and other concrete goods. Quest contributors default the
XP recipient set, which remains GM-adjustable; XP follows the same equal
rounded-up distribution rule as Encounter XP.

### Character Loot Ledger

Awarded Items appear in a searchable and filterable character-specific loot
ledger. It is a GM reminder and Reward-accounting surface, not a player-operated
or rules-complete inventory simulation. The GM may add, remove, or correct
ledger Items manually without a Reward source. Coins, trade goods, and
equivalent Items support quantity stacks which may be split and merged.

`Received`, `given away`, and `sold` are non-mechanical reminders. Sold or
given-away Items remain visible and continue to count as received loot. A sale
or handoff records a structured counterparty link to an existing NPC, place, or
faction when available, plus optional free text. A sale also records its actual
price, which becomes authoritative for final loot valuation of that sold Item.
A separate per-instance value override is not required.

Item provenance records available Treasure, Encounter or Quest, Scene or
place, in-world time, and award time, with optional free-form provenance for
manual and exceptional cases.

### Cumulative Loot Guidance

Expected loot follows a versioned D&D 5e 2014 rule profile based on the owner's
confirmed DMG guidance: character-level expectations produce a loot-per-XP
value. Session planning compares cumulative received loot with cumulative
expected loot for all XP the characters have received so far.

Session generation automatically adjusts proposed Rewards to compensate for
the cumulative loot surplus or deficit. The GM retains the previously confirmed
ability to inspect and edit each proposed Reward independently. The exact
published-rule derivation remains a later source-backed rule decision rather
than an assumed formula in this requirements document.

### Corrections And History

A later correction immediately updates current Item, XP, HP, death, or other
corrected truth while explanatory history retains the original fact and a
linked correction. Existing explicit-deletion and travel-undo exceptions remain
governed by their previously confirmed behavior.

### Acceptance Criteria

- Encounter completion preserves tracked HP, derives death, distributes XP to
  a GM-adjustable participant set, and leaves the Running Scene active
- equal XP shares round up, threshold-derived level state updates immediately,
  and a correction retains its linked explanatory history
- an inactive XP recipient produces one information message on next activation
- Encounter and manually resolved Quest Rewards use the same distribution
  interaction without automatic Item-recipient selection
- Quests and rumours remain manually resolved note-first records without
  completion-condition or NPC-trigger automation
- the GM can search and filter each character's Item ledger, correct it
  manually, and split or merge quantity stacks
- sold and given-away Items remain visible as non-mechanical reminders and keep
  their provenance, counterparty, and applicable sale information
- Session generation compensates proposed Rewards for the cumulative difference
  between expected loot for received XP and actual received loot

## Confirmed Workflow: Local Data Lifecycle

### Continuous Preservation And Resume

SaltMarcher preserves confirmed GM work automatically as soon as practical.
Normal use does not depend on a manual Save action, should almost never lose
confirmed work, and does not impose unnecessary user-visible load.

After restart, SaltMarcher restores as much of the prior useful working state
as possible, including the active Campaign, focused Running Scene, and live
Encounter, Chase, and Travel contexts. There is no product-level list of
runtime state which SaltMarcher deliberately discards on restart.

Backup schedules, retention, snapshot controls, restore granularity, and
persistence mechanisms remain technical decisions. The required outcome is
recovery of Campaign work and local assets without requiring the GM to
understand or operate backup internals.

When local data is damaged, SaltMarcher automatically opens the newest uniquely
safe recoverable state, tells the GM what it recovered and what could not be
preserved, and asks the GM to choose only when no single recovery choice is
clearly safe.

### Complete Campaign Portability

A complete Campaign export includes Campaign data, maps, images, local audio,
required reusable Creature, Item, and rule definitions, and resumable working
state. Partial Campaign export is not required.

On another compatible SaltMarcher installation, that export restores the same
Campaign content, local assets, and resumable state without access to the
original computer. Import always creates a new independent Campaign and never
merges Campaign content into an existing Campaign.

Campaign-owned data remains isolated between Campaigns. Large reusable Monster,
Item, rule, and similar reference collections are installation-wide and shared
between Campaigns rather than duplicated per Campaign.

If an imported Campaign requires a missing shared definition, the definition
joins the shared collection. If an imported definition conflicts with an
existing one, the GM explicitly chooses whether to discard either variant or
retain both as separate definitions. SaltMarcher shows the consequences for
the imported and existing Campaigns before applying that decision and never
chooses silently.

Managing Monster and Item definitions, including whole-data-set refresh, is a
late quality-of-life feature rather than a core need. If definitions are
changed later, current and future reads use their current definition while
completed history remains unchanged.

### Campaign Deletion

Deleting a Campaign moves its complete data into recoverable trash. Permanent
deletion requires a separate explicit GM action.

### Acceptance Criteria

- confirmed work persists without a manual Save action and survives normal
  restart with the useful runtime state restored wherever possible
- damaged local data automatically opens the newest uniquely safe recovery,
  discloses any loss, and asks only when recovery is ambiguous
- a complete export restores the same Campaign, assets, definitions, and
  resumable state on another compatible installation without the source
  computer
- import creates a new Campaign without merging Campaign-owned data into an
  existing Campaign
- a shared-definition conflict requires an informed explicit GM decision and
  may retain both definitions independently
- Campaign deletion remains recoverable until the GM separately requests
  permanent deletion

## Confirmed Program-Wide Quality And Product Boundaries

### Offline Desktop Operation And Trust

The complete local GM core works offline when its required rules, media, and
Campaign data are present locally. Network use occurs only through explicit
imports, downloads, GM-approved extension permissions, or future online
capabilities.

Linux, Windows, and macOS are supported desktop targets with portable Campaign
behavior across them. The GM installs a self-contained application without
separately administering a database server, web server, runtime, or other
infrastructure. It runs fluidly on an ordinary current laptop without requiring
a dedicated GPU or server hardware.

One local GM is the sole Campaign writer in the confirmed core. The passive
second display reads live state; concurrent multi-process, multi-computer, or
multi-user Campaign editing is not required.

Campaign data, notes, maps, images, audio, and usage data leave the computer
only through a concrete, understandable GM action. There is no mandatory cloud
dependency, hidden upload, or telemetry enabled by default.

### Responsiveness, Scale, And Failure Isolation

Ordinary live-play actions respond without perceptible delay. Longer
generation, import, and simulation work is visible and cancellable and does not
make the Running Scene unusable. Resource-intensive simulation adapts to
available resources rather than blocking live play.

SaltMarcher supports practically large, long-lived Campaigns without artificial
content limits. Under exceptional load it degrades predictably instead of
truncating data or failing unpredictably. Representative Campaign sizes and
measurable response budgets are established during technical-needs derivation
and verified with realistic scenarios rather than guessed by the GM.

Failure of supporting music, weather, maps, generation, or World progression
affects only that capability. Running Scenes, Encounters, manual editing, and
preservation of confirmed work remain usable, with a clear error and retry for
the affected function.

Cancellation or failure of a long operation keeps only independently accepted
results; unconfirmed partial results are discarded cleanly. If new work cannot
be persisted safely, SaltMarcher reports that immediately and never presents it
as stored. Safe reading, export, and retry remain available.

Application updates preserve Campaigns and resumable runtime state. A failed
data conversion leaves prior data untouched and usable with the prior
application version. Damage to one record does not prevent the remaining
Campaign from opening: SaltMarcher isolates and identifies the record and
offers recovery or explicit deletion.

Data belonging to a disabled, missing, or temporarily unavailable capability
remains intact, stays in complete exports, and becomes usable again when the
capability returns.

### Modular Change And Third-Party Extensions

Capability areas can be added, omitted, removed, or replaced without breaking
unrelated workflows or Campaign data. New runtime masks, content kinds,
influences, and supporting systems can integrate without rebuilding existing
features.

The GM can install third-party extensions, plugins, or scripts. Every extension
is installed explicitly and discloses requested Campaign-data, file, network,
and other access before activation. Extensions have no default network or
unrestricted file access; additional permissions require explicit GM consent.

A faulty, damaged, missing, or update-incompatible extension is disabled and
identified without preventing SaltMarcher or the Campaign from opening. Its
data remains intact, and application updates do not let an incompatible
extension rewrite Campaign data.

Extensions may add content kinds, runtime masks, generators, importers, and
presentations. They cannot silently bypass explicit deletion, local data
control, truthful history, or another confirmed safety boundary.

### Rules, Localization, Accessibility, And Displays

D&D 5e 2014 is the only binding core rules profile. Supporting several D&D
versions or other game systems is parked as very late quality-of-life work and
does not require a generic multi-system core now.

The interface is localizable for additional languages. Campaign-authored text
remains arbitrary user content independent of interface language.

The complete core supports keyboard operation, scalable text and interface,
sufficient contrast, and information which does not rely on color alone. These
alternatives do not clutter the default interface or slow its low-friction
workflows. The interface remains usable at common laptop resolutions, on
high-density displays, and across multiple monitors. Touch, mobile, and
smartphone layouts are not core targets.

### Calendar, Encounter Tables, Dice, And PC Data

Each Campaign has a configurable fantasy calendar with authored month lengths,
day length, weekdays, and year counting. The GM can author calendar events such
as holidays. Events may be bound to time, place, or both and become relevant
according to each Running Scene's time and location without automatically
deciding narrative consequences.

Named, GM-editable Encounter Tables contain weighted Monster or group entries.
Factions, places, and other context use them as foundational sources for
Encounter candidate pools and generation, alongside applicable contextual
influences.

SaltMarcher has no general-purpose GM dice roller. Ordinary table dice stay
physical; automatic generators and simulations may use internal randomness.

A PC tracks every structured statistic required by enabled automatic systems.
Only its name is universally required; an automatic workflow may require its
relevant optional statistics before running. SaltMarcher does not thereby
become a complete character-sheet, spell, class-feature, or rules-complete
inventory manager.

### Acceptance Criteria

- ordinary core preparation and play remain usable without network access
- the same complete Campaign can be used across supported desktop systems
  without separately administered infrastructure
- common live actions remain responsive while long operations expose progress,
  cancellation, and non-blocking behavior
- a supporting-capability failure leaves unrelated live and manual workflows
  usable and retains confirmed work
- cancelled work leaks no unaccepted partial result into Campaign truth
- updates, damaged individual records, and missing capabilities preserve the
  last safe unaffected Campaign data
- an optional capability can be removed or replaced without breaking unrelated
  workflows, and its retained data returns with the capability
- an extension obtains network, file, or Campaign-data access only after
  explicit disclosure and GM consent
- an incompatible extension cannot block Campaign opening or silently bypass
  deletion, privacy, or history boundaries
- keyboard, scaling, contrast, and non-color alternatives preserve the same
  efficient workflows across supported display configurations
- Calendar events respond to applicable Scene time and place without executing
  a narrative decision automatically
- Encounter Tables can provide weighted candidates to factions, places, and
  generation
- ordinary dice rolling remains outside SaltMarcher while automatic systems may
  randomize internally
- an automatic PC workflow clearly requires its missing relevant statistics
  without making unrelated optional character data mandatory

## Confirmed Cross-Workflow Behavior

### Complete Encounter Outcome

The GM confirms one complete Encounter outcome. Encounter completion and the
selected participant XP distribution become effective together or remain
wholly unchanged. Tracked HP and rule-derived deaths carry forward; SaltMarcher
does not infer named-NPC lifecycle, finite-stock, condition, capture, location,
resource-use, or other narrative consequences from completion. The associated
Running Scene remains active. Reward distribution, character loot ledger,
progression, and correction behavior follow the confirmed follow-up workflow
above.

### Authoritative Party With Dependent Running Contexts

Party activation, deactivation, or deletion is authoritative immediately and is
not rolled back by an unavailable Running Scene or Encounter. Activation
assigns the character to the focused Running Scene; deactivated or deleted
characters immediately stop counting as current Party members and leave their
Running Scene and masks according to the confirmed live-play behavior above.

Only Running Scenes that reference the changed character and their Encounters
reconcile. Until reconciliation succeeds, affected contexts are visibly pending
and stale Encounter context is not presented as synchronized. Initialization,
refresh, and explicit retry resume the saved work without repeating the Party
change. Unaffected contexts do not change.

### Scene Save Before Encounter Synchronization

A valid Running Scene change remains saved and usable when its Encounter cannot
accept the corresponding context. The exact Scene state remains visibly pending,
stale Encounter context is never presented as synchronized, and retry continues
from the saved Scene change.

### Explanatory Campaign History

The GM can inspect an ordinarily immutable chronological history of meaningful
confirmed Campaign consequences, including campaign-time progression, travel,
Encounter completion, XP, Party membership, manually confirmed NPC or
finite-stock effects, and GM corrections.

A correction appends a linked entry rather than rewriting prior history. The
history is not required to replay the Campaign, reconstruct every intermediate
application state, or restore an arbitrary whole-Campaign snapshot.

Moving a Scene's in-world time backward or manually resolving different Scene
times never deletes history or reverses confirmed World consequences. A fact
recorded later at the table may carry an earlier in-world time and is treated
as having happened then. Travel undo is the narrow exception described above:
it removes the undone segment and results introduced only by it. An explicit
GM deletion may remove its selected target even when that produces marked
history conflicts which the GM must later resolve.

## Whole-Baseline Confirmation State

All seven interview workflows and the repository-inventory completeness audit
have owner-confirmed interpretations. The whole-document consistency review
found no unresolved product decision: later clarifications govern earlier
questions, and the cross-workflow Encounter outcome now excludes narrative
effects which the GM manages separately.

Exact responsiveness and scale budgets, the detailed weather model, the
published-rule derivation, persistence and backup mechanisms, and extension
technology remain deliberate technical-needs, source-backed rule, or product-
testing work. They do not change the observable needs recorded here. Only one
final explicit owner confirmation remains before this document becomes the
`Active Target` for technical-needs derivation.

## Acceptance Of This Baseline

This document may become `Active Target` only after every interview workflow has
an explicitly confirmed interpretation, every known capability is included,
excluded, or parked, all cross-workflow handoffs have observable desired
behavior, and no unresolved product decision blocks technical-needs derivation.

## References

- [Program Needs Interview Series](../interviews/program-needs/README.md)
- [Program Needs Foundation And Coverage](../interviews/program-needs/2026-07-22-foundation-and-coverage.md)
- [Session And Scene Preparation Interview](../interviews/program-needs/2026-07-22-session-and-scene-preparation.md)
- [Running Scene And Live Play Interview](../interviews/program-needs/2026-07-22-running-scene-and-live-play.md)
- [Spatial Travel And Progression Interview](../interviews/program-needs/2026-07-22-spatial-travel-and-progression.md)
- [Follow-Up, Progression, And History Interview](../interviews/program-needs/2026-07-22-follow-up-progression-and-history.md)
- [Local Data Lifecycle Interview](../interviews/program-needs/2026-07-23-local-data-lifecycle.md)
- [Cross-Workflow Quality Interview](../interviews/program-needs/2026-07-23-cross-workflow-quality.md)
- [Project Vision](../vision.md)
- [Documentation Standard](../documentation.md)
