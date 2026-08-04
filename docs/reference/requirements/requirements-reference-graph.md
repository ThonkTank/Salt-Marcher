# Reference Graph Requirements

## Goal

Make dense rules and campaign prose explorable without leaving the running
Session. A recognized term provides a concise preview at the pointer and a
full entry in the center Details tab while preserving the surrounding work.

## Recognition

- Published terms include canonical names and explicit aliases from the local
  reference index. Matching is Unicode-normalized, case-insensitive where the
  entry permits it, and respects word boundaries.
- When terms overlap, the longest valid term wins. The matcher emits stable,
  non-overlapping spans and never rewrites the source text.
- A term that can identify several entries opens a candidate chooser; the UI
  must not silently choose one meaning.
- Static SRD terms, creature names, and campaign-owned location and faction
  names share one index. Campaign names use exact matching to avoid surprising
  prose matches.
- Editable controls remain plain text while editing. Read-only Session prose,
  statblocks, active condition labels, group notes, and reference documents
  participate in recognition.

## Interaction

- Hovering or focusing a recognized term opens a preview card after a short
  intent delay. Moving from a card to a term inside that card opens a child
  card without closing its ancestors.
- Nesting has no product-level depth limit. The implementation may suppress a
  target already present in its ancestor path to prevent recursive cycles.
- Clicking a recognized term opens the full document in the Session center
  Details tab and records it in that Scene's backward/forward detail history.
- A card kept under direct pointer intent for five seconds becomes persistent.
  An explicit pin action provides the same result without waiting.
- Persistent cards are movable, can be raised above one another, remain while
  changing Session tabs or Scene focus, and are closed explicitly. Their state
  is memory-only and clears on application restart.
- Hover and focus interactions are keyboard-accessible and tolerate a pointer
  path between a term, its card, and nested child cards.

## Content and failure behavior

- Full rule documents expose normalized sections, facts, source version, and
  attribution. Creature documents reuse the canonical statblock projection.
- Deleted or unavailable campaign targets retain an intelligible unavailable
  state; cached content is not presented as current campaign truth.
- Index and detail failures do not block the Session workspace. Source text
  remains readable and the failed preview reports a typed unavailable state.
- Import is an explicit developer operation. Runtime lookup is fully offline
  and performs no network access.

## Acceptance

- `Prone` in read-only Session text is recognized and opens its condition
  detail in the center panel.
- A preview whose text contains `Stunned` can open a nested `Stunned` preview.
- `Opportunity Attack` wins over an overlapping shorter `Attack` match.
- A five-second direct hover creates one movable persistent card; leaving
  early creates none.
- Switching center tabs or Scene focus does not close persistent cards, while
  restarting the application does.
- Creating, renaming, or deleting a campaign location or faction refreshes
  recognition without rebuilding the static artifact.
- Runtime behavior remains functional with network access disabled.
