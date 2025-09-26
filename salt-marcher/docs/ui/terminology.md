# UI Terminology Reference

## Purpose & Audience
This reference defines the canonical English terms and phrases used across Salt Marcher's runtime UI and related tests. It targets developers, UX writers, and reviewers who introduce or review labels, notices, or comments inside UI-facing modules.

## Directory Map
| Path | Description | Primary Docs |
| --- | --- | --- |
| `docs/ui/terminology.md` | Central glossary for UI nouns, verbs, and example copy. | _This document_ |
| `docs/ui/README.md` | Overview of shared UI components and governance. | [`README.md`](README.md) |
| `../../style-guide.md` | Repository-wide documentation and language standards. | [`style-guide.md`](../../style-guide.md) |
| `../../src/ui/copy.ts` | Source of exported copy constants referenced by runtime code. | [`copy.ts`](../../src/ui/copy.ts) |

## Key Workflows
1. **Confirm the target term.** Identify whether the change concerns maps, library resources, encounters, or shared system copy.
2. **Select the approved phrase.** Use the glossary below to source the noun, verb, and sample UI sentence; adapt pluralisation exactly as listed.
3. **Update code and tests together.** Apply the phrase via the exported copy objects (`MAP_MANAGER_COPY`, `MAP_HEADER_COPY`, `LIBRARY_COPY`, etc.) and adjust assertions to match.
4. **Document new additions.** When introducing a new UI concept, extend this glossary, update `src/ui/copy.ts`, and cross-link relevant modules before merging.

## Linked Docs
- [Documentation Style Guide](../../style-guide.md) – language policy and structural requirements.
- [UI overview](README.md) – structure and responsibilities of UI components.
- [Map manager overview](map-manager-overview.md) – deeper dive into map management workflows.

## Standards & Conventions
### Core Vocabulary
| Concept | Preferred Term | Example Phrase |
| --- | --- | --- |
| Map lifecycle | Map / Maps | "Select a map before deleting." |
| Map header action | Open map | "Open map" (button label) |
| Map header action | Create | "Create" (button label) |
| Map header action | Save | "Save" (dropdown option) |
| Map header action | Save as | "Save as" (dropdown option) |
| Map header trigger | Apply | "Apply" (save trigger button) |
| Map header select | Choose a save action… | "Choose a save action…" (enhanced select placeholder) |
| Map empty state | No maps available. | "No maps available." |
| Map creation success | Map created. | "Map created." |
| Missing hex block | No hex3x3 block found in this file. | "No hex3x3 block found in this file." |
| Map deletion warning | Delete map? | "Delete map?" (modal title) |
| Map deletion body | Confirmation instructions | "This will delete your map permanently. To continue, enter “NAME”." |
| Map deletion success | Map deleted. | "Map deleted." |
| Map deletion failure | Deleting the map failed. | "Deleting the map failed." |
| Resource library | Library | "Library" (view title) |
| Creature records | Creatures | "Creatures" (library mode toggle) |
| Spell records | Spells | "Spells" (library mode toggle) |
| Terrain records | Terrain / Terrains | "No terrains available." |
| Regional records | Region / Regions | "Regions" (library mode toggle) |
| Adventure events | Encounter / Encounters | "Create encounter" (button label) |
| Creation action | Create entry | "Create entry" (library action button) |
| Search affordance | Search the library or enter a name… | Search bar placeholder |
| Search dropdown | Search… | "Search…" (enhanced select placeholder) |
| Map search modal | Search maps… | "Search maps…" (modal placeholder) |

### Usage Guidelines
- **Language:** Runtime UI copy, notices, and inline comments must use U.S. English. Avoid German loanwords and keep punctuation consistent with the examples above.
- **Central copy objects:** Prefer the exported constants in code (`MAP_MANAGER_COPY`, `MAP_HEADER_COPY`, `LIBRARY_COPY`, `CONFIRM_DELETE_COPY`, etc.). Introducing new UI flows should follow the same pattern so tests can import a single source of truth.
- **Pluralisation:** Use the plural forms supplied in the table (`Terrains`, `Regions`, `Encounters`). For dynamic messages, construct sentences from these exact tokens to prevent drift.
- **Testing:** Assertions that validate UI text should import the relevant copy object rather than hard-coding literals, ensuring updates stay synchronised.
- **Extending the glossary:** When a new term is approved, append it to the table above, include an example phrase, update `src/ui/copy.ts`, and link to the module where it is used.
