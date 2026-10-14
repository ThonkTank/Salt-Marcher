# QA workflow maintenance — package 2.1.5

Routine product exploration uses an identified original build, isolated data, actual UI, a short report and evidence appropriate to the question. Reproducible observations can lead directly to focused product corrections; a completed formal comparison wave is not a prerequisite. Substantial changes receive an independent targeted retest.

Reuse the existing native operator. Infrastructure work targets an identified missing or changed capability and its dependencies. Unchanged capabilities do not require a repeated full qualification, a fixed number of infrastructure reviewers or another complete GM workflow. Keep actual process closure and protected resource execution.

Retain raw traces. Complete time, interaction and transport audits are required when the claim depends on them, rather than for every visible UI observation. Qualitative comparisons remain available without formal waves. Start a formal comparison only for a documented comparison question and the related product decision; existing quantitative contracts and limits remain unchanged.

The local live ledger separates current operator readiness and open work from referenced historical setup records. Completed infrastructure findings and archived task details remain recoverable in the exact prior ledger. Versioned investigation entries replace the unused fixed coverage checklist and do not limit future questions. Preserve open task assignments, trial outcomes, original evidence and independent control records.

Tester and reviewer instructions explicitly separate routine exploration/targeted retests from formal measurement and rating duties. Documentary reviews do not substitute for required independent UI retests. Open questions and unexpected findings remain permitted beyond formal scoring dimensions.

The existing status CLI defaults to current work without archived tasks or control records; `status --full` retains the previous complete ledger output. Both modes are read-only. Approval-waiting or resource-deferred tasks remain visible and are not treated as running heavy jobs. Findings link to their assigned task instead of repeating task progress.

Validation: package check passed and 137 offline tests passed, including two read-only CLI behavior tests. The adapter, launcher, measurement/evaluation scripts, schemas, scenarios and frozen candidate artifacts were checked unchanged. The status CLI changed; protocol parameters changed only in patch version. No new GUI qualification, product study, automation or development freeze was introduced. Private scenarios, answers, raw personal UI data and control judgments are retained locally.
