Status: Active
Owner: SaltMarcher Product Owner
Last Reviewed: 2026-07-26
Charter Version: C-0.3.0
Source of Truth: User-given authority and completion boundary for the coupled GM-Core workstreams.

# GM-Core Aletheia Program Charter

Aletheia A owns product work. The user interviews and the needs and acceptance
criteria traceably derived from them determine product scope, behavior, and
acceptance. Existing implementation, architecture documents, or green tests do
not establish product completeness by themselves.

Aletheia B observes A and may propose incremental changes to A's separately
versioned process. B owns neither product decisions nor product requirements and
cannot approve its own process proposal. The independent process evaluator
applies the separately versioned evaluation contract.

The process documents remain separately auditable and may be revised, replaced,
or removed from practical evidence. Product truth, process evidence, and
hypotheses remain distinguishable. Practical counterevidence may reopen
fundamental product or process decisions; prior investment is not authority.

A advances every feature through evidence-producing implementation waves. Each
implemented candidate is classified as exactly one of `Rejected`, `Proof of
Concept`, `Preliminary`, or `Final`. `Rejected` requires an implementation
restart. `Proof of Concept` means the intended behavior is demonstrated but the
implementation is inadequate and may remain only as a temporary candidate.
`Preliminary` means no immediate replacement is required, but later evidence or
planning may reopen and replace it. Every classification except `Final`
explicitly leaves fundamental redesign and overhaul open at any later wave; no
temporary implementation becomes product truth or a mandatory foundation
through investment alone.

`Final` is deliberately rare and is the highest implementation-quality seal.
It requires the best attainable implementation form: current requirements are
realized as cleanly, simply, correctly, and robustly as possible; credible
superior forms have been compared and exhausted; and practical change scenarios
show flexibility under plausible future new or changed requirements. It also
requires a dependency-horizon audit showing that no remaining planned or
foreseeable integration slice must access the code in a way that could require
changing it. Uncertainty on any condition requires `Preliminary`, never
optimistic finalization; a premature `Final` classification is itself a severe
process finding. New binding needs or practical counterevidence can still
reopen a `Final` result.

B researches and refines how A applies these maturity classifications and wave
boundaries through the separately evaluated process documents. A maturity label
never substitutes for product proof, acceptance, or the completion boundary.

The program ends only when every interview-derived GM-Core need is implemented,
integrated, and practically verified through production routes; required user
acceptance exists; no severe finding or required need remains open; local
`./gradlew check` and required CI are green; and the published, installed
program is ready for use. Aletheia B runs until this same boundary is met.
