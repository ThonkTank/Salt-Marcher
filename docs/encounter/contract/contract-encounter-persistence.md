# Encounter Persistence

This document is normative for the `encounter` feature's saved-plan
persistence path.

## Adapter Boundary

- The encounter SQLite adapter satisfies encounter-owned application ports and
  remains private to the encounter composition entry point.
- The application composition supplies `EncounterApi` explicitly; registry,
  discovery, repository, gateway, mapper, and schema types are not public
  boundaries.
- SQL records and adapter failures MUST NOT cross `EncounterApi`.

## Mandatory Schema

- The feature-owned persistence schema declaration is the canonical in-code
  schema owner.
- The schema owns:
  - `saved_encounter_plans`
  - `saved_encounter_plan_creatures`
  - `generated_encounter_plan_batches`
  - `generated_encounter_plan_origins`
- `saved_encounter_plans` stores plan identity, display name, generated label,
  and timestamps.
- `saved_encounter_plan_creatures` stores ordered creature identity, quantity,
  and the last-known display name captured when the plan was saved. Creature
  identity is a positive external reference validated through `CreaturesApi`
  before it enters prepared Encounter truth; the Encounter row retains that ID
  and display-name snapshot but does not duplicate statblocks.
- `generated_encounter_plan_batches` stores the immutable source identity,
  normalized batch fingerprint, and declared encounter cardinality.
- `generated_encounter_plan_origins` stores the stable batch order,
  encounter number, normalized spec fingerprint, and saved-plan reference.

## Saved-Plan Mapping

This contract governs only the saved-plan and generated-batch payload. That
payload stores saved encounter-plan roster truth and does not contain:

- generated-alternative lists
- active generator filters
- initiative values
- combat HP or turn order
- defeated-result state
- loot or XP-award resolution

Initiative, combat, and result state for a running Encounter are separate
Encounter-owned runtime-context truth. They are persisted relationally under
the [Encounter Runtime Context Contract](contract-encounter-runtime-contexts.md)
and MUST NOT be copied into a saved-plan or generated-batch payload.

Optional generated origin consists only of engine version, preparation and
generation-run identities, normalized batch and roster fingerprints and
cardinality, encounter order and number, normalized-intent fingerprint, and
saved-plan reference. It does not copy a Session Generation result.
Preparation-level uniqueness plus ordered origin uniqueness makes identical
completed commits idempotent and makes subset, superset, reordered, relabeled,
or changed-roster retries distinguishable.

The Encounter SQLite adapter maps private rows into `EncounterPlan` aggregate
values. The stored name remains a last-known fallback; current creature facts
are reloaded through one `CreaturesApi` ID-union snapshot when summaries are
requested. Base XP, adjusted XP, and difficulty are derived for that read from
the current active Party composition and current Creature facts. Those derived
summary values are not persisted as historical truth.

## Validation And Error Behavior

Owner startup readiness validates the feature-declared current target schema
signature exactly, including columns, declared types, nullability, defaults,
primary and foreign keys, checks, table flags, and named or automatic indexes.
Semantic row validation remains on typed provider read/write paths and fails
closed through the feature contract. Compatibility obligations begin with the
first released format.
Before the first released format, the current owner target is v1; its one construction
step requires an empty Encounter namespace, creates the complete fresh
current-format schema, and carries no obligation to read, repair, convert, or
preserve an earlier development format. An unversioned partial namespace, a
different owner version, or a current-format store with an invalid target
signature fails closed without schema or row repair.

- encounter-plan writes MUST reject empty or malformed roster rows instead of
  silently persisting partial encounter truth
- the Campaign database MUST NOT declare a foreign key from an Encounter row
  to installation-owned Creature storage; only Encounter-owned parent-child
  relationships are enforced within the Campaign transaction
- generated alternatives, initiative state, combat HP, result state, and loot
  state MUST be rejected from the saved-plan and generated-batch payload;
  runtime-context persistence remains governed separately
- schema-readiness and storage failures MUST surface through Encounter API
  result statuses rather than leaking SQLite exceptions to consumers
- one generated batch MUST insert all plan roots, roster rows, and origin data
  in one transaction; any failure MUST leave no member of the batch visible
- a partial existing origin set, mismatched cardinality, reordered request, or
  mismatched batch or spec fingerprint MUST fail closed instead of guessing or
  creating duplicate plans

## Stability Rules

- The saved-plan write port remains an internal collaborator injected by the
  encounter composition entry point.
- Saved-plan storage remains encounter-owned even when generated plans are
  built from party, creatures, or encounter-table source data.
- Creature identity validation and current-fact refresh cross the public
  `CreaturesApi`; neither Encounter schema initialization nor saved-plan reads
  attach, query, or constrain the installation database.
- The persistence adapter accepts the already-resolved reference and enforces
  its positive identity, positive quantity, deterministic order, and snapshot
  shape inside the Campaign transaction; it does not perform a second foreign
  database lookup during that transaction.
- Generated-origin and saved-plan truth share the one current-format
  Encounter-owned schema; they MUST NOT create parallel stores or duplicate
  mutable plan truth.
- After the first released format, support for an earlier format belongs in an
  explicit owning compatibility contract.
  This contract grants no compatibility by itself.


## References

- [Encounter Domain Model](../domain/domain-encounter.md) (line 1)
- [Encounter Feature Spec](../requirements/requirements-encounter.md) (line 1)
- [Generated Import Contract](contract-encounter-generated-import.md)
- [Encounter Runtime Context Contract](contract-encounter-runtime-contexts.md)
