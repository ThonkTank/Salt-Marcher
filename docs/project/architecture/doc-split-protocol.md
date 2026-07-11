Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-10
Source of Truth: Protocol and judge checklist for content-preserving
SaltMarcher documentation splits.

# Document Split Protocol

## Purpose

This protocol governs documentation splits caused by the 400-line soft
threshold or by a judge finding that one document mixes scopes. A split is a
content-preserving refactor, not a compression pass.

## Split Triggers

Split a document when either condition applies:

- the document crosses the 400-line soft threshold and has no better focused
  split already scheduled
- a judge finds mixed scope, such as multiple artifact classes, audiences,
  review owners, or `Source of Truth` contracts in one document

## Seam Selection

Choose the seam by sub-topic of the original `Source of Truth` contract. Do
not choose a seam by line count. The original document remains the router for
the scope it still owns, and each successor receives a disjoint
`Source of Truth` sentence.

## Zero-Loss Rule

Every fact from the original must appear in exactly one successor document or
remain in the narrowed original. Compression, summarization that drops facts,
or moving facts to a document outside their ownership contract is a blocking
review finding.

## Same-Commit Obligations

The split commit must update:

- front matter for every affected document
- inbound links that pointed to the moved material when those links exist
- the directory README or owning index
- references between the original and successor documents
- the roadmap or ledger row when the split is roadmap-governed

## Judge Checklist

The judge checks:

1. The split trigger is named: 400-line signal or mixed-scope finding.
2. The seam follows topic ownership, not line count.
3. Every original fact is preserved exactly once.
4. Successor `Source of Truth` sentences are disjoint.
5. Inbound links and indexes are updated in the same commit.

## References

- [Document Size Policy Roadmap](doc-size-policy-vision-and-roadmap.md)
- [Documentation Standard](documentation.md)
