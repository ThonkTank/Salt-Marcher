# Independent GM UX exploration

Status: active; no whole-product acceptance or competitive speed advantage claimed.
Owner: independent GM UX QA.
Last Reviewed: 2026-10-12.
Source of Truth: real Desktop interactions, named regressions and exact-SHA delivery evidence.

## Prose retrieval while running a Scene

Base: remote Main `9de85c1a26f526acbc1af332ac5962e185c0aab2`.
Disposable fixture: `scene-desktop-character-library-v1`; no installed Campaign
data used. Separate checkout preserves the original local dirty paths.

| Problem reproduced | Comparison | Change | Evidence |
| --- | --- | --- | --- |
| `Kai 30` returns no lookup result although the harbor note contains it and is reachable by name. | The same fixture as one Markdown document, viewed as plain text: Ctrl+F and `Kai 30` visibly reaches the matching line. [Obsidian Search](https://obsidian.md/help/plugins/search) also documents note-content search. | Campaign-bound Core search over location notes/tags, faction notes, NPC notes/appearance/behavior/history; no bulk prose transport to the renderer. | Native `sceneDesktopReferences` looks up `Salzmarschhafen Kai 30`, opens its actual document and compares the complete live Session before/after. |
| Lookup silently stops at 100 identities; canonically equivalent Unicode queries differ. | A text search must not hide the 101st relevant record. | Explicit further-results action; paginated Core read; common Unicode normalization for lookup, preserving exact inline recognition. | 105 same-name locations remain independently searchable; query/Campaign races, failed reads, explicit retry and saved-note invalidation tested. |
| Opening a matched long note shows its beginning, leaving the sought line outside the viewport; authored blank lines collapse. | Plain-text Ctrl+F reveals the sought line directly. | One transient, Campaign/Scene/reader-bound intent scrolls to and highlights the original text range; reader paragraphs preserve line breaks. Stored reader identities and document versions are unchanged. | Native assertion checks `Kai 30` highlight geometry lies inside the visible reader; screenshot `.tmp/gm-ux-search-after.png`. Existing reader/history/Scene/restart regression remains required. |
| Opening lookup focuses its frame and requires another pointer action before typing. | Plain-text Ctrl+F is ready for typing; Obsidian documents keyboard-driven lookup. | Opening/restoring lookup selects its input; Ctrl/Command+K restores it and Enter opens a sole result after its search settles. Editors, dialogs, IME and ambiguity remain protected. | The before-build native focus assertion fails with frame focus. The shipping regression checks immediate input focus, Enter navigation and shortcut restoration; negative editor/ambiguity tests protect ongoing work. |
| Fast Enter is ignored while the lookup request is pending; the sole location appears but no reader opens. | A GM should not have to repeat a deliberate keyboard action because of a debounce. | A pending Enter opens the sole complete result once; query, Campaign, revision, minimization, blur, Escape, read failure and ambiguity cancel it. | Reproduced while retrieving a newly created place by name. Unit cancellation cases and the native narration journey cover the corrected behavior. |
| A place created through the UI stores narration, but its lookup reader omits it and searching its unique words returns no result. | A two-section Markdown note keeps prepared narration alongside GM notes; Kanka's public full-text lookup finds body text. | Search saved read-aloud prose and show distinct `Vorlesetext` and `GM-Notizen` sections, retaining blank lines. | Real UI creates Glassteg with narration and secret notes; reader retrieval, early Enter and live-Combat preservation are exercised together. |

Local proof routes: `tests/unit/desktop-search.test.tsx`,
`tests/unit/reference-search-focus.test.ts`,
`tests/unit/reference-matcher.test.ts`,
`tests/unit/scene-desktop-reader.test.tsx`,
`tests/integration/reference-service.test.ts`, and
`tests/e2e/scene-desktop-references.e2e.ts`. Temporary logs and baseline images
are QA artifacts, not installed-runtime or Main-delivery evidence.

The combined native journey passed with immediate lookup input focus, canonically equivalent
Unicode input, Enter navigation, a geometrically visible match, exact reader
scroll after restart, independent reader history, Scene switching, both-theme
accessibility and the 101st of 105 note hits reached via the real UI. Focused
unit/integration verification on the first candidate: 35 passing cases; matcher verification: seven
passing cases. The lookup fixture itself has no active Combat. A separate native
map/combat journey starts a fight, changes monster HP, then retrieves a note;
the complete live Session remains equal before/after. It also keeps the fight
alive through map-window changes, restart and Scene switching. The extended
journey creates Glassteg through the real editor, then retrieves its narration
by unique prose and early Enter, with the complete active-Combat Session
preserved. Final focused unit/integration verification: 35 passing cases
across seven files; both native Desktop journeys pass. Typecheck, changed-file
lint, formatting and the unchanged bundle limits pass. Reachable renderer
size is 1,705,131 bytes; this remains within the recorded growth allowance.

The native test emits an explicitly single-sample interaction measurement.
This includes WebDriver input and waiting; it is neither a human study nor a
competitive speed benchmark. An existing 16-ms matcher CPU test failed both in
a concurrent run and an isolated run (18.7 ms). Empty recognition automata now
return before projecting or walking the text; its unchanged gate passes after
the optimization. No test threshold or absolute bundle budget was relaxed.
The measured bundle baseline records the new lookup code with explicit
dependency and chunk rationale; no dependency was added.

## Comparison and remaining scope

[Kanka's public Company campaign](https://app.kanka.io/w/22628) was exercised
in a real browser: open Search, query `entityName`, switch to full text with
Ctrl+F, open the Welcome Note. Its excerpt identifies the matching passage and
the document visibly highlights it. This is direct retrieval evidence, not a
matched-data speed benchmark. Advertising cookies were rejected after the user
granted full access.

[LegendKeeper's public Selenia project](https://www.legendkeeper.com/p/cl98b4ybqjd8909902o0vb1cl/cku5kwapk000203ccuwml4023/cl98b4zvs0003039ciskujx5c/)
was also exercised: a Moonlight Citadel map pin opens an adjacent preview; its
Lore tab shows the place description while the world map stays visible. This
informs the next map/context exploration; no SaltMarcher parity claim yet.
[Kanka's preparation guide](https://kanka.io/learn/prep) and
[LegendKeeper's note-taking guide](https://www.legendkeeper.com/how-to-make-good-dnd-notes/)
inform exploration; documentation remains distinct from practical evidence.

The first candidate `b527c9c` was pushed and full Check dispatched. That run was
cancelled after native exploration exposed early-Enter and narration defects;
it is not qualified, handed off, installed or promoted as the final fix.

Full preparation, improvisation, travel interruptions, split-party timing,
combat and reward corrections, follow-up, portability, large Campaigns and the
remaining product goals still require practical independent exploration.
Neither this slice nor green automated checks establish whole-product success.
Candidate qualification, canonical handoff, installed runtime and green Main
remain separate required delivery evidence.

Exact-SHA Check `38286240157` passed the product assertions and the other
partitions, but rejected two stale-element warnings in the extended
map/combat test. Early Enter replaces an existing reader asynchronously; its
text assertion had retained the old element. The regression now waits for
the actual Glassteg document through a DOM read before obtaining fresh element
handles. The zero-warning gate remains unchanged. This failed run does not
qualify installation or Main promotion.
