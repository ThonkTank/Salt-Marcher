Status: Active
Owner: SaltMarcher Product Owner
Last Reviewed: 2026-07-24
Charter Version: C-0.2.0
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

The program ends only when every interview-derived GM-Core need is implemented,
integrated, and practically verified through production routes; required user
acceptance exists; no severe finding or required need remains open; local
`./gradlew check` and required CI are green; and the published, installed
program is ready for use. Aletheia B runs until this same boundary is met.
