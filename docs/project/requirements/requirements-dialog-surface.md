Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-15
Source of Truth: Observable behavior of the shared JavaFX dialog surface.

# Dialog Surface

## Component Purpose

The shared surface centralizes dialog-like layout for embedded state-tab surfaces
and popup content. JavaFX section composition stays in the owning surface,
while the surface owns header visibility, footer visibility, and body scroll
policy.

## Rules

- Use scrolling when the whole body may
  exceed the available height.
- Keep action buttons in the footer so navigation remains visible.
- Do not put feature services, domain objects, or command decisions in this
  primitive.
- Use the shared anchored-popup host when a dialog surface appears in a JavaFX
  popup.
- The primitive must not own feature callbacks or domain-facing behavior.

## Acceptance Criteria

- the shared surface centralizes dialog-like layout instead of duplicating
  header, body, and fixed-footer structure in each embedded state or popup
  surface
- large dialog bodies scroll so the
  footer actions remain visible
- feature services, domain objects, and command decisions stay outside this
  primitive
- layout state remains presentation state rather than feature truth
- popup-hosted dialog content uses the shared anchored host rather than opening
  raw JavaFX popups directly from feature layout code

## References

- [Anchored Popup](requirements-anchored-popup.md)
- [Travel State Tab UI](requirements-travel-state-tab.md)
