# Aletheia C5 Crash-Safe Host-Lease Custody Candidate

Status: **unevaluated experimental candidate; not adopted**

Stable product base: `fb229a119d1c64dbf15282a3608576334c607007`

Frozen concept handoff: `/tmp/aletheia-c5-frozen-concept.md`

C5 restarts from C4's independently falsified supervisor-only custody premise.
It changes one variable: supervisor and watchdog now retain the same applicable
locked open-file descriptions, while the command closes every lease descriptor
before `execvp`. A retains intent and host in both controllers; admitted non-A
retains host. Either controller can therefore die independently without
releasing a lease while an old admitted command-group process remains.

The watchdog treats supervisor-pipe EOF as supervisor loss. The supervisor
polls both command and watchdog children and treats premature watchdog exit as
controller loss. On controller loss, timeout, or leader exit with lingering
descendants, the surviving controller sends `TERM` only to the candidate-owned
command group, waits at most one second, sends `KILL` if needed, and positively
waits for whole-group absence before releasing custody. Timeout remains `124`;
watchdog loss overrides the command result with `64`; otherwise the command
result is preserved. There is no shell supervisor, daemon, global process
snapshot, coordinator, registry, queue, fairness, or deadlock guarantee.

## Frozen protocol, security, and threat boundary

The stable files remain
`/tmp/saltmarcher-aletheia-host-lease-$UID/{intent,host}`. A locks intent then
host with a caller-declared acquisition timeout capped at 15 minutes and holds
both through its finite command. Non-A probes intent, unlocks it, waits for
host, then reacquires and rechecks intent. It returns retryable `75` when A has
intent; timeout returns `124`; other command results are preserved. Non-A
commands are capped at 15 minutes.

The helper sets `umask 077`, accepts only a clean absolute directory path,
creates or opens it without following symlinks, and validates an owned real
`0700` directory. Fixed relative lock names use `O_NOFOLLOW`; the named and
opened objects must be identical, owned, singly linked, real `0600` regular
files. Stable locks are never unlinked.

The bounded claim covers independent loss of at most one supervisor or
watchdog. It does not cover correlated loss of both, host/cgroup/session loss,
common-mode kernel/OOM failure, or hostile isolation. Only the SaltMarcher
Product Owner may accept cooperative same-user local use with this limitation.

## Provenance and build

Direct API decisions use the preserved official Linux man-pages 6.13 extract
at
`/home/aaron/Schreibtisch/projects/references/agent-methods/linux-man-pages-6.13-process-supervision.md`
(SHA-256 `6b0903b7575c205ff0c910f5e2cefa178f9c453bd3cfc183aca511b966838536`)
and archive SHA-256
`a2c8a0c2efe8a978ce51ce800461eb9e8931f12cc7ba4b7faa3082b69ba7f12c`.
The util-linux 2.40.4 source SHA-256 is
`d550bd2c9fb93f8d03c37bdfaa988820e8265d20ab64959307c3058165e37d13`.

The frozen local toolchain is GCC `15.2.1-7.fc42`, glibc
`2.41-18.fc42`, Linux `6.19.14-108.fc42.x86_64`, and util-linux
`2.40.4-10.fc42`, with their package license declarations. Candidate source is
MIT licensed. Generated C5 and known-bad C4 binaries are ignored and uncommitted.
The registered run compiles each exact source once before warm-up:

```text
cc -std=c17 -D_POSIX_C_SOURCE=200809L -O2 -Wall -Wextra -Werror -pedantic \
  tools/quality/aletheia-c5/host-lease-native.c \
  -o tools/quality/aletheia-c5/host-lease-native
```

The known-bad control is built from C4 artifact commit
`cee32886ae10ff36c7d340f1fa73b29b9d94ad91`; the harness refuses a drifted
C4 worktree.

## Frozen canary

`canary.py` retains seed `240426`, a `0.35 s` scaled batch, one whole warm-up,
six recorded repetitions, seeded AB/BA order, and no discard. It retains all
C4 workload, control, security, overhead, cleanup, and pairwise C2/C3
interoperability cases, replacing C4 pairings with C5 pairings.

It adds three causal controls at 6/6 each. Supervisor-death and watchdog-death
subjects create a TERM-resistant descendant; one controller is SIGKILLed and
A plus non-A contenders start immediately. `/proc` FD evidence must prove dual
custody before failure, surviving-controller custody through cleanup, no new
workload start or non-A admission before old-group disappearance, and ordinary
recovery afterward. The exact known-bad C4 must allow start/admission before
old-group disappearance in 6/6 supervisor-death repetitions. A normal leader
exit with a lingering resistant descendant must likewise delay release until
whole-group quiescence in 6/6.

All prior immutable thresholds remain, including zero cooperating overlap and
admission during A intent, control discrimination, all rows passing, cleanup
within five seconds, recovery within four batches and at most `1400 ms`, at
least 50% median A-wait reduction, separate nearest-rank p95 start overhead at
most `50 ms`, exact topology, all nine invalid paths, and every pairwise mixed
direction.

After committing source, harness, worker, and this README, run the matrix once:

```bash
python3 tools/quality/aletheia-c5/canary.py run \
  --output tools/quality/aletheia-c5/results/raw.jsonl \
  --summary tools/quality/aletheia-c5/results/summary.json
```

Budget: 90 minutes wall, 0.5 CPU-hour, 10 MB retained artifacts, `$0`, and zero
egress. A literal miss remains a failure. Only a localized implementation or
harness defect permits retaining that run, a new candidate commit, and one full
rerun; candidate behavior and thresholds are never tuned after a result.

Rollback terminates only recorded C5 PIDs/groups, proves both locks independently
acquirable with no holder, leaves stable files untouched until removing the
run scratch directory, and restores current uncoordinated behavior. This is
C-only non-production tooling and changes no shipped source, resource,
dependency, packaging, build, product contract, or `check` input. The test
agent does not evaluate, adopt, merge, publish, or assign maturity.
