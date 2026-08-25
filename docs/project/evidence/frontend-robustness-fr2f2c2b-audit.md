# FR2F2C2B Current-Format completion audit

Date: 2026-08-25

Baseline: `e6b4a82eca09fcb12cf89c095220edb56d009b6b`

Verdict: the `FR2F2C` Current-Format owner/applicability packet is complete.
This closes neither the remaining `FR2F3`/`FR2G` gates nor exact cross-platform
`RP-R`/`RP-L` `QS-05` qualification.

## Reviewed current truth

- The executable manifest has 20 Campaign registrations and five installation
  dependencies.
- The root, Live, Spatial, Preparation, and Economy cohorts already provide one
  primary fixture for 19 Campaign registrations and all stable installation
  dependencies.
- `world-location-save-journal` is the only reconciliation state class. Its
  product contract explicitly forbids manufacturing stable fixture rows and
  instead requires a controlled committed-base/interrupted-placement journey.
- The root fixture already exercises the installation Campaign registry but did
  not declare that dependency in its versioned coverage metadata.

## Closed guarantee

The versioned A/B completion fixture adds the sole remaining primary Campaign
owner, `world-location-save-journal`. For each Campaign it:

1. materializes the complete Economy cohort;
2. invokes `WorldLocationSaveCommandHandler` with production Location and
   journal owners;
3. throws a controlled fault only when placement begins, after the base
   Location and provisional receipt have committed together;
4. closes the Campaign owner completely;
5. reopens and reads the provisional `partially-saved` receipt with
   `placement_pending`, the single durable Location, and no Hex placement;
6. executes the exact same command through the production
   `WorldLocationPlacementService` and Hex editing owner;
7. proves Location revision did not advance again, exactly one placement was
   added, and the journal became `saved/applied`; and
8. executes the command once more and proves an idempotent receipt-only replay
   with no additional Hex revision.

Independent final reopen checks the complete saved receipt, Location, Hex
placement, active Campaign authority, and all prior Economy/Preparation/Spatial
sentinels. The older Spatial projection removes only singular declared
downstream Location choices and marker placements, restoring their directly
caused map/chunk revisions. Its pre-placement and post-reconciliation semantic
objects are deep-equal, while raw final snapshots remain intact for C2B.

The complete normalized Current-Format projections retain these reproducible
semantic hashes:

- Campaign A:
  `862037f4b248feb7fd0455baad01658ffb7e56846458e22682198248d15ff596`;
- Campaign B:
  `516a909a2b25549561f66148a77c0ae30d23de195e1d04a461733bdcea610ebf`.

The final gate assembles primary coverage from the loaded versioned fixture
objects. It fails unless every manifest Campaign registration and installation
authority occurs exactly once. The result is exactly 20 Campaign owners and
five installation authorities; extended cross-cohort dependencies are not
miscounted as primary ownership.

## Negative audit

The focused protocol rejects:

- a missing primary disposition;
- a duplicate primary disposition;
- an unknown primary identity;
- stale completion-fixture coverage before any Campaign publication;
- reuse of an interrupted command identity with a changed Location request,
  without attempting placement; and
- public removal of the reconciled Hex placement.

All four focused cases pass. Two independently created data roots produced
different Campaign and Location UUIDs but the same A/B semantic hashes and the
same exact-one coverage result.

## Deliberately open

- The controlled throw occurs at the production command boundary but is not an
  operating-system kill of the Utility process. Owners are fully closed and
  reopened before reconciliation; actual process-loss, scheduler, and UI
  journeys remain assigned to `FR2F3`, `FR4D`, and `FR5C`.
- The save is deliberately sequential, not atomic: base Location plus journal
  commit first, Hex placement second. The proof guarantees visible recoverable
  partial truth and one-effect reconciliation, not transactional placement.
- Exact-one coverage proves the current manifest/applicability boundary. It
  does not make the absent `RP-R`/`RP-L` technical-profile classes
  representable.
- No production timing, focused-Scene next-action, warm-switch latency,
  resource-cycle, cross-platform runtime, or manual UI evidence is claimed.
- This remains a qualification adapter around public production owners, not a
  renderer consumer cutover.

## Proof packet

- `pnpm exec tsc --noEmit`
- `pnpm exec vitest run tests/integration/current-format-completion-qualification.test.ts`
  (`4/4` tests)
- two clean-root executions of
  `pnpm exec tsx scripts/qualify-current-format-completion.ts --data-root <root>`
  with matching A/B hashes and exact-one result
- `pnpm check:frontend-robustness` (`31/31` files, `203/203` tests)
- `pnpm check`: formatting, all lint partitions, typecheck, and architecture
  tests passed; the portable Unit phase stopped with `803/809` tests green.
  The unchanged 16 ms Reference Matcher budget measured `56.39 ms`. Five
  unchanged Encounter Generator Settings cases failed under suite load (four
  30-second timeouts and one cascading close-count assertion). An isolated
  one-worker rerun reduced this to three timeouts plus the Matcher budget, with
  `12/16` tests green. Neither affected file nor its production paths is changed
  here. The clean Candidate CI run remains the delivery gate.

This packet changes qualification scripts, tests, evidence, and versioned
fixture coverage metadata only. It is not app-relevant and therefore uses the
documentation/test delivery path rather than an application handoff.
