---
name: callchain-tool
description: Uses SaltMarcher's Joern callchain tool for method-level static caller/callee context before indexing, rendering, interpreting, or citing its output. Use when a code change or review needs call-path evidence; do not use for simple search or runtime proof.
---

# Callchain Tool

Read `tools/callchain/README.md` for setup, index and render commands, options,
and generated output paths.

## Use It For

- method-level refactor orientation
- caller/callee blast-radius inspection
- review of a selected entrypoint, callback, or dependency path

Use normal file search for type lookup, documentation ownership, or simple
references. Use runtime tests or tracing for executed behavior.

## Workflow

1. Refresh the index after source changes that can affect the selected method,
   its callers, or its callees.
2. Prefer a package-qualified `Class#method` selector. If several candidates
   remain, inspect `candidates.tsv` and confirm overloads against source.
3. Start shallow; increase depth only when additional context changes the
   decision. Include external methods only when library or JDK calls matter.
4. Check reflection, JavaFX dispatch, ServiceLoader discovery, listener
   registration, and other dynamic seams directly in source.

## Evidence

Treat every reported edge as `Candidate` static-analysis evidence until source
confirms it. A missing edge is unknown when dynamic dispatch may apply.
Callchain output is not architecture truth, a verification gate, dependency
truth, language-server hierarchy, or runtime trace.

When the tool affects a decision, report the selector, depth, external-call
setting, index freshness, relevant candidate edges, source confirmation, and
decision impact. Do not commit generated output unless the user explicitly
requests a tracked artifact.

## References

- [Callchain README](../../../callchain/README.md)
- [Agent Guide](../../../../AGENTS.md)
