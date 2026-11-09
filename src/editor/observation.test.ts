import { expect, it, vi } from "vitest";
import { editorBudgets } from "./budgets";
import { Observation } from "./observation";

it("reads incremental observations without consuming the retained journal", () => {
  const observation = new Observation(true);
  observation.event("ready", { sessionId: "first" });
  observation.input(17, new Event("pointerdown"), "edit");
  const first = observation.read();
  const cursor = observation.eventCount;
  observation.event("noop", { input: 17 });
  observation.input(18, new Event("pointerup"), "pointerup");
  const complete = observation.read();

  expect(observation.read({ events: false })).toEqual([]);
  expect(observation.read({ events: false, sinceEvent: cursor })).toEqual([]);
  expect(observation.read({ sinceEvent: cursor })).toEqual(
    complete.slice(cursor),
  );
  expect(observation.read({ sinceEvent: observation.eventCount })).toEqual([]);
  expect(observation.read({ sinceEvent: 0 })).toEqual(complete);
  expect(observation.read()).toEqual([...first, ...complete.slice(cursor)]);
  expect(observation.eventCount).toBe(4);
  expect(
    complete.filter((event) => event.kind === "input").map((event) => event.id),
  ).toEqual([17, 18]);
  expect(observation.dropped).toBe(0);
});

it("omits events without copying the journal and still returns owned event records", () => {
  const observation = new Observation(true);
  observation.event("ready");
  let reads = 0;
  const journal = observation["events"];
  Object.defineProperty(journal[0], "copyProbe", {
    enumerable: true,
    get: () => ++reads,
  });
  expect(observation.read({ events: false })).toEqual([]);
  expect(reads).toBe(0);
  const returned = observation.read();
  expect(reads).toBe(1);
  returned[0].kind = "modified copy";
  expect(observation.read()[0].kind).toBe("ready");
  expect(observation.eventCount).toBe(1);
});

it("keeps the journal cap and dropped counter across lightweight and incremental reads", () => {
  const observation = new Observation(true);
  for (let index = 0; index < editorBudgets.observationEvents; index++)
    observation.event("frame", { index });
  const last = observation.read({ sinceEvent: observation.eventCount - 1 });
  expect(last).toHaveLength(1);
  expect(last[0].index).toBe(editorBudgets.observationEvents - 1);
  expect(observation.read({ events: false })).toEqual([]);
  observation.input(7, new Event("pointerup"), "pointerup");
  expect(observation.eventCount).toBe(editorBudgets.observationEvents);
  expect(observation.dropped).toBe(1);
  expect(observation.read({ sinceEvent: observation.eventCount - 1 })).toEqual(
    last,
  );
  expect(observation.read()).toHaveLength(editorBudgets.observationEvents);
  expect(observation.dropped).toBe(1);
});

it("does not collect events or trace marks in a normal start", () => {
  const mark = vi.spyOn(performance, "mark");
  const observation = new Observation();
  for (let index = 0; index <= editorBudgets.observationEvents; index++)
    observation.event("frame", { index });
  observation.input(21, new Event("pointerdown"), "edit");
  observation.mark("noop", "21", { input: 21 });
  observation.input(22, new Event("pointerup"), "pointerup");
  expect(observation.read()).toEqual([]);
  expect(observation.eventCount).toBe(0);
  expect(observation.dropped).toBe(0);
  expect(mark).not.toHaveBeenCalled();
  mark.mockRestore();
});

const submission = {
  sessionId: "a",
  frame: 3,
  viewGeneration: 2,
  revision: 7,
  exactRevision: -1,
  at: 10,
  uploadedBytes: 0,
};
const dose = {
  sessionId: "a",
  gestureId: 1,
  intervalId: 2,
  revision: 7,
  changed: true,
  bounds: [0, 0, 1, 1] as [number, number, number, number],
  at: 2,
  projectedAt: 3,
  inputIds: [21],
};
const current = {
  status: "current" as const,
  sessionId: "a",
  frame: 3,
  viewGeneration: 2,
};

it("requires the actual current local submission and never publishes an outside or stale region", () => {
  const observation = new Observation(true);
  observation.dose(dose);
  for (const region of [
    { ...current, status: "outside" as const },
    { ...current, status: "missing" as const },
    { ...current, status: "stale" as const },
    { ...current, sessionId: "old" },
    { ...current, frame: 2 },
    { ...current, viewGeneration: 1 },
  ])
    observation.submitted(submission, () => region);
  expect(
    observation.read().filter((event) => event.kind === "brush-submit"),
  ).toEqual([]);
  observation.submitted(submission, () => current);
  expect(
    observation.read().filter((event) => event.kind === "brush-submit"),
  ).toMatchObject([
    { intervalId: 2, revision: 7, frame: 3, viewGeneration: 2 },
  ]);
  expect(
    observation
      .read()
      .some((event) =>
        ["model", "input-covered", "brush-covered", "edit-submit"].includes(
          event.kind,
        ),
      ),
  ).toBe(false);
});

it("requires every commit region and retains pointerup separately from held doses", () => {
  const observation = new Observation(true);
  observation.dose({ ...dose, inputIds: [] });
  observation.commit({
    input: 22,
    sessionId: "a",
    gestureId: 1,
    revision: 7,
    sequence: 5,
    bounds: [
      [0, 0, 1, 1],
      [2, 2, 3, 3],
    ],
  });
  observation.submitted(submission, (bounds) =>
    bounds[0] === 0 ? current : { ...current, status: "stale" },
  );
  expect(
    observation.read().filter((event) => event.kind === "brush-submit"),
  ).toHaveLength(1);
  expect(
    observation.read().filter((event) => event.kind === "edit-submit"),
  ).toHaveLength(0);
  observation.submitted(submission, () => current);
  expect(
    observation.read().filter((event) => event.kind === "edit-submit"),
  ).toMatchObject([{ input: 22, sequence: 5, frame: 3 }]);
});

const commit = {
  input: 22,
  sessionId: "a",
  gestureId: 1,
  revision: 7,
  sequence: 5,
  bounds: [[0, 0, 1, 1]] as [number, number, number, number][],
};

it("finishes on already drawn terrain without manufacturing another frame", () => {
  const clock = vi.spyOn(performance, "now").mockReturnValue(10);
  try {
    const observation = new Observation(true);
    observation.dose(dose);
    observation.submitted(submission, () => current);
    clock.mockReturnValue(20);
    observation.commit(commit, () => current);
    const events = observation.read();
    expect(events.filter((event) => event.kind === "submit")).toHaveLength(1);
    expect(
      events.filter((event) => event.kind === "edit-submit"),
    ).toMatchObject([
      {
        at: 20,
        input: 22,
        frame: 3,
        revision: 7,
        submittedAt: 10,
        completedAt: 20,
        completionEvidence: "commit-current-terrain-v1",
      },
    ]);
    observation.submitted({ ...submission, frame: 4, at: 30 }, () => ({
      ...current,
      frame: 4,
    }));
    expect(
      observation.read().filter((event) => event.kind === "edit-submit"),
    ).toHaveLength(1);
  } finally {
    clock.mockRestore();
  }
});

it.each([
  { ...current, status: "outside" as const },
  { ...current, status: "missing" as const },
  { ...current, status: "stale" as const },
  { ...current, sessionId: "old" },
  { ...current, frame: 2 },
  { ...current, viewGeneration: 1 },
])("does not reuse an old draw for an unproven commit region: %o", (region) => {
  const observation = new Observation(true);
  observation.submitted(submission, () => current);
  observation.commit(commit, () => region);
  expect(observation.read().some((event) => event.kind === "edit-submit")).toBe(
    false,
  );
});

it("keeps changed terrain pending and clears cached associations on document switches", () => {
  const clock = vi.spyOn(performance, "now").mockReturnValue(20);
  try {
    const observation = new Observation(true);
    observation.submitted(submission, () => current);
    observation.commit({ ...commit, revision: 8 }, () => current);
    expect(
      observation.read().some((event) => event.kind === "edit-submit"),
    ).toBe(false);
    clock.mockReturnValue(30);
    observation.submitted(
      { ...submission, frame: 4, revision: 8, at: 30 },
      () => ({
        ...current,
        frame: 4,
      }),
    );
    expect(
      observation.read().filter((event) => event.kind === "edit-submit"),
    ).toMatchObject([
      { frame: 4, revision: 8, submittedAt: 30, completedAt: 30 },
    ]);
    observation.reset();
    observation.commit({ ...commit, input: 23 }, () => current);
    expect(
      observation.read().filter((event) => event.kind === "edit-submit"),
    ).toHaveLength(1);
  } finally {
    clock.mockRestore();
  }
});

it("retains an applied dose after projection failure without inventing its submission", () => {
  const observation = new Observation(true);
  observation.dose({ ...dose, projectedAt: null });
  observation.submitted(submission, () => current);
  expect(
    observation.read().filter((event) => event.kind === "brush-interval"),
  ).toMatchObject([{ changed: true, at: 2, projectedAt: null }]);
  expect(
    observation.read().some((event) => event.kind === "brush-submit"),
  ).toBe(false);
});

it("retires offscreen and old-session associations without inventing submissions", () => {
  const observation = new Observation(true);
  observation.dose(dose);
  observation.event("brush-feedback-obsolete", {
    ...dose,
    reason: "outside-view",
  });
  observation.submitted(submission, () => current);
  observation.dose({ ...dose, intervalId: 3 });
  observation.reset();
  observation.submitted(submission, () => current);
  expect(
    observation.read().some((event) => event.kind === "brush-submit"),
  ).toBe(false);
});

it("observes navigation milestones once and does not query or retain work while disabled", () => {
  const observation = new Observation(true);
  observation.navigation(4, { sessionId: "a", camera: {} });
  const ready = { ...submission, ready: true, sourcesReady: true };
  observation.readiness({ ...ready, sessionId: "old" });
  observation.readiness({ ...ready, ready: false });
  observation.readiness(ready);
  observation.readiness(ready);
  expect(observation.read().map((event) => event.kind)).toEqual([
    "camera",
    "sources-ready",
    "input-ready",
  ]);
  const disabled = new Observation();
  const inspect = vi.fn(() => current);
  disabled.dose(dose);
  disabled.submitted(submission, inspect);
  disabled.commit(commit, inspect);
  disabled.navigation(4, { sessionId: "a", camera: {} });
  disabled.readiness(ready);
  expect(inspect).not.toHaveBeenCalled();
  expect(disabled.read()).toEqual([]);
});
