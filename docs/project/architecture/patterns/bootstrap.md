Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-09
Source of Truth: Bootstrap startup and generic discovery responsibility.

# Bootstrap Standard

## Goal

Bootstrap discovers and registers shell-facing UI contributions and service
contributions generically. It owns desktop launch framing around shell startup
without becoming a feature registry, feature behavior host, or second UI layer.

## Responsibilities

- create the shell with the shared service registry
- discover service contributions and UI contributions generically
- register contributions by public shell contract
- keep startup ordering deterministic
- select the startup left-bar landing target
- apply desktop launch resources such as the stylesheet and icon

Routine feature addition must not require handwritten bootstrap wiring.

## Boundaries

Bootstrap may use public shell contracts and shell startup surfaces. It must
not import feature implementation code, own feature behavior, or store
long-lived feature state.

## Verification

Bootstrap behavior and dependency direction are covered by `check`.

## References

- [Source Architecture](../source-architecture.md)
- [Layering Architecture Standard](layering-architecture.md)
- [Shell Layer Standard](shell-layer.md)
