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

## Literal retained test result

The frozen candidate is
`ccce150ec5cf783d67794a75324555cc40b234c9`. The exact command above ran once
and exited `0`: **literal PASS**. It retained 217 raw rows: 31 warm-up and 186
recorded. Every recorded row and all 19 aggregate verdicts passed; there was no
candidate change, threshold change, discard, or rerun after this result.

- Candidate supervisor-death custody, watchdog-death custody, and normal
  leader-exit group quiescence each passed `6/6`. No contender workload began
  and no non-A admission occurred before old-group disappearance. Every
  observed surviving-controller custody sample held both applicable locks.
- The exact known-bad C4 control failed causally in `6/6`: a contender began
  before its old TERM-resistant group disappeared every time; one repetition
  also admitted non-A early.
- All inherited cleanup, topology, security, FD, contamination, recovery, and
  pairwise interoperability controls passed. Three-contender median A-wait
  reduction was `67.046%`; recovery remained `6/6` below `1400 ms`.
- Paired runtime-start overhead nearest-rank p95 was `5.350 ms` for A and
  `10.934 ms` for non-A, below the separate `50 ms` ceilings.
- Total registered cost was `131.513 s` wall, `36.414 s` CPU, `348099` retained
  raw-plus-summary bytes, `$0`, and zero egress. Both compilations took
  `1.877 s` wall. Standard error was empty.
- Rollback found no remaining run scratch directory and no live generated C5
  or known-bad C4 executable. The harness had already proved both run-specific
  locks independently acquirable before removing the scratch tree.

Exact tested-input and retained-output SHA-256 values:

```text
e75616755dec9203cdc954b95f1703525a2d307145bdc2e6020916dc749b6a71  host-lease-native.c
99096a2979ddc04eedba61513592ee97814e76f8768d9b694e45a26ca99bc52e  generated host-lease-native
b73e4dcb0d88d2ae32fffc9459dd6e5f3919f801b8e6e406605cb782e03ea2e1  canary.py
03fcc3999460fc4c505f5511097ef1e2958c15379847967844702b8682f801f3  synthetic-worker
e635dff8e7077c3803041e8aa4f68a57ececfb1e7ff4c01eeeeebac05f9cd0d1  generated known-bad-c4
b6299cac880367492b8ac674c02626f122db6de4de105a48ddda89828de8aeb0  results/raw.jsonl
a89d9b6bd940e82e16d33a79a7ce3a79d85882eb1944d600425e82147eda09bd  results/summary.json
e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855  results/run-stderr.txt
```

These are test-agent facts only. Maturity, qualification, and any bounded use
remain for a fresh independent evaluator and the Product Owner respectively.
