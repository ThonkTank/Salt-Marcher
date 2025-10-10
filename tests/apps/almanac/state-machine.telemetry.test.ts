// tests/apps/almanac/state-machine.telemetry.test.ts
// Validates that the Almanac state machine emits telemetry for advances, jumps and failures.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/apps/almanac/telemetry", () => {
    const emitAlmanacEvent = vi.fn();
    const reportAlmanacGatewayIssue = vi.fn();
    return {
        emitAlmanacEvent,
        reportAlmanacGatewayIssue,
    };
});

import { emitAlmanacEvent, reportAlmanacGatewayIssue } from "../../../src/apps/almanac/telemetry";
import { InMemoryStateGateway } from "../../../src/apps/almanac/data/calendar-state-gateway";
import {
  AlmanacMemoryBackend,
  InMemoryCalendarRepository,
  InMemoryEventRepository,
  InMemoryPhenomenonRepository,
} from "../../../src/apps/almanac/data/repositories";
import { AlmanacStateMachine } from "../../../src/apps/almanac/mode/state-machine";
import { gregorianSchema, getDefaultCurrentTimestamp } from "../../../src/apps/almanac/fixtures/gregorian.fixture";
import { createSampleEvents } from "../../../src/apps/almanac/fixtures/gregorian.fixture";
import { CalendarGatewayError } from "../../../src/apps/almanac/data/calendar-state-gateway";
import { AlmanacRepositoryError } from "../../../src/apps/almanac/data/repositories";
import { createDayTimestamp } from "../../../src/apps/almanac/domain/calendar-core";

class ConflictPhenomenonRepository extends InMemoryPhenomenonRepository {
    constructor(backend: AlmanacMemoryBackend) {
        super(backend);
    }

    override async upsertPhenomenon(): Promise<never> {
        throw new AlmanacRepositoryError("phenomenon_conflict", "Duplicate calendar links", {
            duplicates: ["cal-1"],
        });
    }
}

describe("AlmanacStateMachine telemetry", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    async function createMachine(options?: { conflictingPhenomena?: boolean }) {
        const backend = new AlmanacMemoryBackend();
        const calendarRepo = new InMemoryCalendarRepository(backend);
        const eventRepo = new InMemoryEventRepository(backend);
        const phenomenonRepo = options?.conflictingPhenomena
            ? new ConflictPhenomenonRepository(backend)
            : new InMemoryPhenomenonRepository(backend);
        const gateway = new InMemoryStateGateway(calendarRepo, eventRepo, phenomenonRepo);

        calendarRepo.seed([gregorianSchema]);
        eventRepo.seed(createSampleEvents(2024));

        await gateway.setActiveCalendar(
            gregorianSchema.id,
            { initialTimestamp: getDefaultCurrentTimestamp(2024) },
        );
        await gateway.setCurrentTimestamp(getDefaultCurrentTimestamp(2024));

        const machine = new AlmanacStateMachine(calendarRepo, eventRepo, gateway, phenomenonRepo);
        await machine.dispatch({ type: "INIT_ALMANAC" });
        return { machine, gateway } as const;
    }

    it("emits telemetry when advancing time", async () => {
        const { machine } = await createMachine();

        await machine.dispatch({ type: "TIME_ADVANCE_REQUESTED", amount: 1, unit: "day" });

        expect(emitAlmanacEvent).toHaveBeenCalledWith(
            expect.objectContaining({
                type: "calendar.time.advance",
                reason: "advance",
            }),
        );
    });

    it("emits telemetry when jumping to a timestamp", async () => {
        const { machine } = await createMachine();
        const target = createDayTimestamp(gregorianSchema.id, 2024, "jan", 5);

        await machine.dispatch({ type: "TIME_JUMP_REQUESTED", timestamp: target });

        expect(emitAlmanacEvent).toHaveBeenCalledWith(
            expect.objectContaining({
                type: "calendar.time.advance",
                reason: "jump",
                skippedEvents: expect.any(Number),
            }),
        );
    });

    it("reports telemetry when gateway operations fail", async () => {
        const { machine, gateway } = await createMachine();
        vi.spyOn(gateway, "advanceTimeBy").mockRejectedValueOnce(
            new CalendarGatewayError("io_error", "advance failed"),
        );

        await machine.dispatch({ type: "TIME_ADVANCE_REQUESTED", amount: 1, unit: "day" });

        expect(reportAlmanacGatewayIssue).toHaveBeenCalledWith(
            expect.objectContaining({
                operation: "stateMachine.timeAdvance",
                code: "io_error",
            }),
        );

        expect(machine.getState().almanacUiState.error).toBe("advance failed");
    });

    it("emits conflict telemetry for phenomenon errors", async () => {
        const { machine } = await createMachine({ conflictingPhenomena: true });

        await machine.dispatch({
            type: "PHENOMENON_SAVE_REQUESTED",
            draft: {
                id: "phen-1",
                name: "Storm",
                category: "weather",
                visibility: "all_calendars",
                appliesToCalendarIds: [],
                notes: "",
            },
        });

        expect(emitAlmanacEvent).toHaveBeenCalledWith(
            expect.objectContaining({
                type: "calendar.event.conflict",
                code: "phenomenon",
            }),
        );
    });
});
