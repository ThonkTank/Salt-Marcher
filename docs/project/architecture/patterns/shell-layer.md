Status: Active Target
Owner: SaltMarcher Team
Last Reviewed: 2026-07-18
Source of Truth: Shell host responsibilities and stable public shell contracts.

# Shell Layer Standard

## Goal

SaltMarcher uses a passive cockpit shell. The shell owns hosting, navigation,
view activation, details/history, state-pane arbitration, and shell-scoped UI
capabilities. Application startup and shutdown remain in `app`. The shell does
not own feature logic, business behavior, or feature state mutation.

## Shell Responsibilities

- host left-bar, top-bar, main, details/history, and state-pane surfaces
- activate and deactivate explicitly supplied bindings
- expose public shell contracts under `shell/api/**`
- provide shell-owned inspector, navigation, and session capabilities through
  narrow shell contracts
- keep concrete shell host internals private from feature code

## Cockpit Layout

The shell renders a fixed cockpit frame. Its geometry and the role of each surface are stable
and shared by every feature: features supply content into named slots, they do not control the
frame. Getting this model right matters — treating the panels as a horizontal strip or
repurposing a reserved panel produces layouts that fight the shell.

**Chrome (outside the grid)**

- **Left bar** — tab selection / feature navigation. Populated by `ShellLeftBarTabSpec`
  contributions, rendered by `ShellNavigationSidebar`. Each tab carries a `ShellLeftBarTabMode`
  (`RUNTIME` | `EDITOR`).
- **Top bar** — global, permanent popups that stay available across tab switches (for example
  the party popup). Populated by `ShellTopBarSpec` contributions, rendered by
  `ShellToolbarStrip`.

**2×2 panel grid** (`ShellWorkspacePane`): a horizontal split between a left column
`VBox(CONTROLS, MAIN)` and a right column `SplitPane(DETAILS, STATE)`.

```
 Left bar │ ┌ Top bar — permanent popups (e.g. party) ──────────────┐
  (tabs)  │ ├───────────────────────────┬───────────────────────────┤
          │ │ CONTROLS (narrow, horiz.) │ DETAILS  (small window)   │
          │ ├───────────────────────────┼───────────────────────────┤
          │ │ MAIN     (large primary)  │ STATE    (narrow, vertical)│
          │ └───────────────────────────┴───────────────────────────┘
```

- **CONTROLS** (`COCKPIT_CONTROLS`, top-left) — a narrow, horizontally arranged control strip.
- **MAIN** (`COCKPIT_MAIN`, bottom-left) — the large primary work surface; feature-local
  master/detail and editors live here.
- **DETAILS** (`COCKPIT_DETAILS`, top-right) — a small window: the shell-owned content
  inspector (`InspectorPane`) for inspecting content entities (locations, NPCs, monster stat
  blocks, item descriptions). Reserved — see below.
- **STATE** (`COCKPIT_STATE`, bottom-right) — a narrow, vertical status / summary column.

**Slot ↔ contribution rules** (enforced by `ShellSlotValidator`):

| Contribution (`ShellContributionSpec`) | must provide | must NOT provide |
| --- | --- | --- |
| `ShellLeftBarTabSpec` | `COCKPIT_MAIN` | `TOP_BAR`, `COCKPIT_DETAILS` |
| `ShellTopBarSpec` | `TOP_BAR` | all `COCKPIT_*` |
| `ShellStateTabSpec` | `COCKPIT_STATE` | `TOP_BAR`, `COCKPIT_CONTROLS`, `COCKPIT_MAIN`, `COCKPIT_DETAILS` |

A left-bar tab therefore owns MAIN and may additionally fill CONTROLS and STATE, but never
DETAILS or TOP_BAR.

**`COCKPIT_DETAILS` is reserved.** No contribution type may target it — it is exclusively
shell-owned and hosts the content inspector. Features surface content into it only through the
`InspectorSink` / `InspectorEntrySpec` contract (reference:
`features/worldplanner/adapter/javafx/WorldPlannerInspectorController`), never by claiming the
slot. Do not repurpose DETAILS as a feature editor or as a second content column; feature-local
detail and editor UI belongs inside MAIN (or STATE).

**Source of truth (implementation):** `shell/host/ShellWorkspacePane.java` (grid + dividers),
`shell/api/ShellSlot.java` (slot enum), `shell/host/ShellSlotValidator.java` (slot rules),
`shell/host/ShellToolbarStrip.java` (top bar), `shell/host/ShellNavigationSidebar.java`
(left bar).

## Boundaries

Features communicate with the shell only through `shell.api` contracts. The
shell MUST NOT import concrete feature implementations, locate feature
services, or store long-lived feature state. Concrete shell internals MAY use
feature-neutral platform mechanisms such as UI dispatch and local diagnostics;
public `shell.api` contracts MUST NOT expose platform implementation types.
Those concrete dependencies target only `platform.ui` and
`platform.diagnostics`.

## Verification

JUnit behavior tests and ArchUnit dependency checks cover the retained public
shell outcomes.

## References

- [Source Architecture](../source-architecture.md)
- [Feature Boundary Standard](feature-boundaries.md)
- [Application Composition Standard](application-composition.md)
