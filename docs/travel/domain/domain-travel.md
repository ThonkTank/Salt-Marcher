# Travel Context Domain

## Context Role

Context Role: Focused Scene Travel Controller
Context Name: Travel

Travel is a renderer orchestration feature. It owns the provider-neutral
controller state machine for one focused Scene and delegates map reads, route
evaluation, and commands to one injected provider port. It owns no authored map
truth, Party position, route validation, movement command, or persistence.

`TravelControllerState<P, S, M, E>` is immutable and contains:

- explicit lifecycle: inactive, loading, ready, stale, unavailable, or error
- provider state and selected map projection
- selected position, interaction mode, waypoints, and route evaluation
- presentation multiplier and transient token preview

## Ownership And Composition

- `features/travel` owns `TravelProviderPort`, the pure controller reducer,
  request-generation gates, and provider-command delegation
- `features/party` owns active party identity and persisted runtime position
- `features/hex` owns the current Hex adapter, chunk projection, movement
  semantics, and Hex presentation
- `features/workspace/integrations` lazily selects the Hex adapter and supplies
  Session's map and scenario render slots
- `features/session` owns only layout and those provider-neutral render slots

Travel has no SQLite adapter. Its state is rebuilt from injected readbacks and
is not restored as separate truth.

## Invariants

- exactly one provider controller is active for the focused Scene
- stale context, map, and evaluation responses cannot replace newer requests
- active editor selection never chooses the global travel context
- the controller may dispatch only the selected provider's bounded map,
  placement, route, and runtime commands
- command success returns provider and Session projections from one utility
  operation; the renderer performs no second Session read
- rejected evaluation is structured domain data and renderer copy is selected
  from a reason code

## References

- [Travel Docs](../README.md)
- [Travel Provider Port](../contract/contract-travel-provider-port.md)
- [Global Travel State Requirements](../../project/requirements/requirements-travel-state-tab.md)
- [Hex Travel State Requirements](../../hex/requirements/requirements-hex-travel-state.md)
- [Party Domain](../../party/domain/domain-party.md)
