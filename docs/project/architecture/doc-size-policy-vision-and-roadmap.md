Status: Deprecated
Owner: Aaron (Product Owner)
Last Reviewed: 2026-07-10
Source of Truth: Completed implementation roadmap that replaced the 350-line
hard cap with scope-based document-size rules.
Successor: `docs/project/documentation-specification.md`, section
"Document Size & Focus".

# Document Size & Focus — Target Vision and Roadmap

## 1. Problem

The current hard cap of 350 lines per document optimizes a proxy (length)
instead of the goal (focus). Observed failure modes:

- **Lossy compression.** Agents delete or condense owner-relevant facts to
  stay under the cap. Silent information loss is the worst possible outcome
  of a documentation system.
- **Documentation refusal.** Agents skip documenting because the target
  document is "full". A fact that should exist doesn't.
- **Scatter.** Agents place facts wherever line budget remains, breaking the
  one-home-per-fact principle and making information unfindable.

All three are rational agent responses to a gate that blocks writes by size.
The gate, not the agents, is the defect.

## 2. Target Vision

This target vision has been folded into
`docs/project/documentation-specification.md` section "Document Size & Focus".
This section is retained only as roadmap history.

### V1 — Completeness outranks brevity; focus outranks both

A document may never lose owner-relevant facts to satisfy a size rule.
Focus is achieved by **cutting scope, never by cutting content**: a document
that grows too large is split along topic seams into two focused documents.
A 500-line document about one topic is healthy; a 300-line document about
three topics is defective.

### V2 — Scope defines the document, not length

Every document's `Source of Truth` front-matter sentence is its contract.
Content belongs in exactly the document whose contract covers it — never in
"whichever document has room". If no contract covers a fact, a new document
is created and indexed. "The document is full" is never a valid reason to
relocate, omit, or compress a fact.

### V3 — Size is a signal, never a gate

- **Soft threshold (400 lines):** crossing it is a *signal*, not a failure.
  The required response is filing a split issue (label `doc-split`) in the
  same change. Writing continues unblocked.
- **No hard cap.** No size check may ever fail a build or block a
  documentation write. The only hard rule is: a document above the soft
  threshold must have an open or completed split issue.

### V4 — Splits are content-preserving and judged

A split is a refactoring with an invariant: **zero information loss**.
The judge verifies that every fact from the original appears in exactly one
successor, each successor has a disjoint `Source of Truth` sentence, and all
inbound links plus directory indexes are updated in the same commit.
Compression during a split is a blocking review finding.

### V5 — The cheap path is the correct path

The system is designed so the laziest compliant agent behavior is the desired
one: write the fact where it belongs, file a split issue if the threshold is
crossed, move on. Any policy under which "omit" or "scatter" is cheaper than
"write correctly" is a policy defect and gets fixed at the policy level.

## 3. Roadmap

Status: Complete in working tree on 2026-07-10. Completion evidence is tracked
in `doc-size-policy-ledger.md`.

Milestones are ordered by damage stopped per effort. Each has a binding exit
criterion; later milestones must not start before earlier ones are green.

### M0 — Stop the bleeding (gate inversion)

Convert the 350-line hard gate into the V3 soft-signal rule: threshold 400,
warn-only, plus the "split issue required above threshold" check. Update the
one enforcement document that owns this rule; delete contradicting prose.
Add one sentence to the agent instructions: *"Never omit, compress, or
relocate documentation because of size. File a `doc-split` issue instead."*

**Exit:** No mechanical check can block a documentation write by size; agent
instructions contain the anti-omission rule; CI green.

### M1 — Split protocol

One short document (`docs/project/architecture/doc-split-protocol.md`)
defining: when to split (threshold or judge finding "mixed scope"), how to
find the seam (by sub-topic of the Source of Truth sentence, never by line
count), the zero-loss invariant, and the same-commit obligations (links,
indexes, front matter). Plus a five-point judge checklist for reviewing
splits.

**Exit:** Protocol is Active; judge checklist referenced from review
instructions; one pilot split executed against it and accepted.

### M2 — Mechanical support

Extend the documentation gate with three cheap checks, each with a
self-test: (a) list documents above 400 lines lacking a linked open/closed
`doc-split` issue, (b) index completeness after splits (every doc listed in
its directory README), (c) no two documents with identical `Source of Truth`
sentences.

**Exit:** All three checks run in CI with self-tests green; false-positive
rate reviewed once by judge.

### M3 — Damage repair

Audit the harm the old cap caused, then repair it. Method: scan git history
for documentation commits with net deletions on files near 350 lines
(compression suspects) and inventory facts living outside their contract
document (scatter suspects). Repair feature by feature, starting with `hex`
as pilot (consistent with the migration roadmap), each repair as a judged,
content-restoring change.

**Exit:** Hex documentation audited and repaired; remaining features have a
prioritized repair list as `doc-repair` issues; no known lost owner-relevant
fact without an issue.

### M4 — Specification amendment and unblock

Fold V1–V5 into `documentation-specification.md` (new section "Document Size
& Focus", superseding this file's vision section). Only after M4 does the
goal-interview work start, so all newly captured intent lands in a system
that can hold it without loss.

**Exit:** Specification Active with the new section; this document's roadmap
section marked complete; goal interview scheduled.

## 4. Non-Goals

- No document-size dashboards or telemetry beyond the M2 checks.
- No retroactive rewriting of healthy documents to a "house length".
- No per-document-type custom thresholds; one threshold, one rule.

## 5. Owner Actions

Exactly two: accept this document (making it Active), and behaviorally accept
the M3 hex pilot repair. Everything else is agent- and judge-territory.

## References

- [Document Size Policy Ledger](doc-size-policy-ledger.md)
- [Documentation Standard](documentation.md)
- [Agent Instruction Standard](agent-instructions.md)
