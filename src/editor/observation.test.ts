import { expect, it } from "vitest";
import { editorBudgets } from "./budgets";
import { Observation } from "./observation";

it("reads incremental observations without consuming the retained journal", () => {
  const observation = new Observation();
  observation.event("ready", { sessionId: "first" });
  const firstInput = observation.input(new Event("pointerdown"), "edit");
  const first = observation.read();
  const cursor = observation.eventCount;
  observation.event("model", { input: firstInput });
  const lastInput = observation.input(new Event("pointerup"), "pointerup");
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
  expect(observation.lastInputId).toBe(lastInput);
  expect(observation.dropped).toBe(0);
});

it("omits events without copying the journal and still returns owned event records", () => {
  const observation = new Observation();
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
  const observation = new Observation();
  for (let index = 0; index < editorBudgets.observationEvents; index++)
    observation.event("frame", { index });
  const last = observation.read({ sinceEvent: observation.eventCount - 1 });
  expect(last).toHaveLength(1);
  expect(last[0].index).toBe(editorBudgets.observationEvents - 1);
  expect(observation.read({ events: false })).toEqual([]);
  const input = observation.input(new Event("pointerup"), "pointerup");
  expect(observation.eventCount).toBe(editorBudgets.observationEvents);
  expect(observation.lastInputId).toBe(input);
  expect(observation.dropped).toBe(1);
  expect(observation.read({ sinceEvent: observation.eventCount - 1 })).toEqual(
    last,
  );
  expect(observation.read()).toHaveLength(editorBudgets.observationEvents);
  expect(observation.dropped).toBe(1);
});
