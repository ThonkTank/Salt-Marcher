# Independent scene desktop acceptance cases

Original source: `tests/e2e/scene-desktop.e2e.ts` at
`e77a997db9e94966488086c6a55ff3d9eeb9f6f7`. Each row retains its original
acceptance title and assertions in a separately registered v8 fixture suite.
The registry completeness check verifies this inventory. Initial campaign
entry and explicit scene selection belong to each spec; internal restarts
retain that scenario's own profile.

| Original line | Registered suite | Spec | Acceptance case |
| --- | --- | --- | --- |
| 14 | `sceneDesktopPartyLayout` | `tests/e2e/scene-desktop-party-layout.e2e.ts` | shows party details and accepts a group drop without preparing initiative |
| 104 | `sceneDesktopWindowGeometry` | `tests/e2e/scene-desktop-window-geometry.e2e.ts` | preserves separate arrangements and intentional closure through navigation and process restart |
| 236 | `sceneDesktopReferences` | `tests/e2e/scene-desktop-references.e2e.ts` | reads independent item and location documents with history and restored scroll |
| 364 | `sceneDesktopMapCombat` | `tests/e2e/scene-desktop-map-combat.e2e.ts` | keeps map presentation and combat alive independently of their windows |
| 527 | `sceneDesktopTravel` | `tests/e2e/scene-desktop-travel.e2e.ts` | continues travel with its window closed and restores an explicitly paused journey after restart |
| 639 | `sceneDesktopCharacterLibrary` | `tests/e2e/scene-desktop-character-library.e2e.ts` | manages the campaign library and keeps scene quickinfos beside existing windows |
| 707 | `sceneDesktopPartyActions` | `tests/e2e/scene-desktop-party-actions.e2e.ts` | batches rosters, changes XP through bars, confirms rests and reverses scene creation |
| 835 | `sceneDesktopShortcuts` | `tests/e2e/scene-desktop-shortcuts.e2e.ts` | opens quickinfos with Alt+P from the catalog and releases repeated map windows |
| 880 | `sceneDesktopGroupLifecycle` | `tests/e2e/scene-desktop-group-lifecycle.e2e.ts` | restores archived groups and deletes only after confirmation across restart |
| 974 | `sceneDesktopCombatResolution` | `tests/e2e/scene-desktop-combat-resolution.e2e.ts` | resolves result drafts and awards XP exactly once through completion and restart |
| 1114 | `sceneDesktopLocationDraft` | `tests/e2e/scene-desktop-location-draft.e2e.ts` | changes scene location without resolving an independent XP draft |

## Setup dependencies removed

- Window geometry opens its own Party and Groups windows.
- Map/combat opens Longsword in its own reference window before asserting that
  combat and map actions preserve that document.
- Travel prepares and starts its own fixture combat before entering resolution
  and the existing travel sequence.
- Library and Party actions select their own named fixture scenes; shortcuts,
  lifecycle, resolution and location drafts start from their own campaign.
- The three former initial process restarts only inherited preceding tests'
  state. They are replaced by normal initial campaign entry. Every restart
  within an acceptance scenario and its persistence assertions remains.

## Runtime and isolation evidence — 2026-09-13

The checked-in [run outcomes](party-remediation-desktop-runs.json) retain exact
run/build/registry identities, order, attempts, durations and warning counts.
All eleven normal-order and all eleven reverse-order cases passed on the first
attempt, with no regression warnings. The controlled document abort produced
exactly one intended failure; Party layout (including both-theme accessibility)
and Party actions still passed. The reference spec was restored byte-for-byte
before the reversed-order run, which also passes that original reference case.

Measurements used the same Linux host, Node 22.22.2, pnpm 10.15.1, Electron
43.2.0 / Chrome 150.0.7871.129, v8 fixtures, and identical application bytes
built at `e77a997db`. The detached baseline dependency symlink is untracked, so
its build metadata reports dirty although tracked sources are unchanged. The
app-build fingerprint is `fa16f62e8e5e90ef3d3d10cbaaaafdb84ac777a68595504623ef974561685bdf`.
The candidate reused those bytes. A separate diagnostic shortcuts run overlaps
part of the first run; it is excluded from the timing table. The reverse run
is the uninterrupted sequential comparison. These are host observations, not
statistical performance guarantees.

| Case | Normal (ms) | Reverse (ms) | CI weight (s) | Functional shard |
| --- | ---: | ---: | ---: | --- |
| `sceneDesktopPartyLayout` | 99704 | 99610 | 100 | `dialogs-generation-loot` |
| `sceneDesktopWindowGeometry` | 85135 | 85290 | 86 | `group-loot-travel` |
| `sceneDesktopReferences` | 87736 | 87721 | 88 | `dialogs-generation-loot` |
| `sceneDesktopMapCombat` | 86163 | 86043 | 87 | `dialogs-generation-loot` |
| `sceneDesktopTravel` | 85046 | 85074 | 86 | `dialogs-generation-loot` |
| `sceneDesktopCharacterLibrary` | 88300 | 87851 | 89 | `group-loot-travel` |
| `sceneDesktopPartyActions` | 84606 | 84556 | 85 | `campaign-workspaces` |
| `sceneDesktopShortcuts` | 83324 | 82292 | 84 | `group-loot-travel` |
| `sceneDesktopGroupLifecycle` | 87205 | 87090 | 88 | `group-loot-travel` |
| `sceneDesktopCombatResolution` | 82930 | 82732 | 83 | `dialogs-generation-loot` |
| `sceneDesktopLocationDraft` | 81236 | 81894 | 82 | `hex-npc-restart` |

Combined baseline: **174819 ms** for eleven cases in one registered suite.
Isolated normal: **951385 ms**; isolated reverse: **950153 ms**. Reverse minus baseline:
**775334 ms**. Duration includes fixture materialization, process startup,
assertions, internal restarts, teardown and runner orchestration.

A command-level trace locates a **70.020 s `deleteSession()`** at shutdown,
after the utility process has already reported closed. No other logged gap
exceeds 2.243 s. Ten additional session endings therefore explain approximately
700 s of the added cost; this is an estimate from one observed shutdown, not
ten separately measured values. The remaining difference combines extra fresh
fixtures/startup/setup and removed inherited restarts, and is not presented as
pure startup time. WebDriver's displayed test duration also includes shutdown.
No lifecycle or timeout changes were made to hide this overhead.

CI weights round up the larger of the two measured durations. Only the eleven
new cases are assigned, longest first, to the least-loaded of the four existing
functional shards. Existing unrelated assignments and the visual matrix remain
unchanged. The resulting estimated functional totals are campaign-workspaces: 679 s, hex-npc-restart: 729 s, dialogs-generation-loot: 708 s, group-loot-travel: 693 s.
This bounds parallel CI impact while preserving the required isolated profiles;
it does not eliminate the additional total work.

## Reproduction

Build the baseline at `e77a997db` in a detached worktree, then run
`corepack pnpm test:e2e:built -- --suite sceneDesktop`. In the candidate, use the
same built application bytes and pass the eleven registered names in the table
as repeated `--suite` arguments, first in table order and then in reverse order.
The regular runner materializes a separate profile for every suite; its internal
`reloadSession()` calls preserve that scenario's profile.

For the failure experiment, save the reference spec bytes, insert
`throw new Error('Controlled reference scenario abort')` immediately after the
first reference document is displayed, and run References, PartyLayout and
PartyActions in that order through the same runner. Expect exit 1 with exactly
one failed and two passed suites. Restore the exact original bytes in a finally
block before running the full reversed order. No abort hook, skipped assertion
or disabled test is shipped.
