// salt-marcher/tests/apps/almanac/state-gateway.test.ts
// Prüft die Bereichsfilterung des Almanac-State-Gateways bei Zeitfortschritt.
import { beforeEach, describe, expect, it } from "vitest";

import {
    InMemoryCalendarRepository,
    InMemoryEventRepository,
    InMemoryPhenomenonRepository,
} from "../../../src/apps/almanac/data/in-memory-repository";
import { InMemoryStateGateway } from "../../../src/apps/almanac/data/in-memory-gateway";
import { createSingleEvent } from "../../../src/apps/almanac/domain/calendar-event";
import {
    createHourTimestamp,
    createDayTimestamp,
    type CalendarTimestamp,
    compareTimestampsWithSchema,
} from "../../../src/apps/almanac/domain/calendar-timestamp";
import { getEventAnchorTimestamp } from "../../../src/apps/almanac/domain/calendar-event";
import {
    gregorianSchema,
    GREGORIAN_CALENDAR_ID,
} from "../../../src/apps/almanac/fixtures/gregorian.fixture";

const startOfJanFirst = createHourTimestamp(GREGORIAN_CALENDAR_ID, 2024, "jan", 1, 0);

const toIdList = (events: Array<{ id: string }>) => events.map(event => event.id);

describe("InMemoryStateGateway.advanceTimeBy", () => {
    let calendarRepo: InMemoryCalendarRepository;
    let eventRepo: InMemoryEventRepository;
    let phenomenonRepo: InMemoryPhenomenonRepository;
    let gateway: InMemoryStateGateway;

    beforeEach(async () => {
        calendarRepo = new InMemoryCalendarRepository();
        eventRepo = new InMemoryEventRepository();
        eventRepo.bindCalendarRepository(calendarRepo);
        phenomenonRepo = new InMemoryPhenomenonRepository();
        gateway = new InMemoryStateGateway(calendarRepo, eventRepo, phenomenonRepo);

        calendarRepo.seed([gregorianSchema]);
        eventRepo.seed([
            createSingleEvent(
                "evt-before",
                GREGORIAN_CALENDAR_ID,
                "Night Watch",
                createHourTimestamp(GREGORIAN_CALENDAR_ID, 2024, "jan", 1, 0)
            ),
            createSingleEvent(
                "evt-hour",
                GREGORIAN_CALENDAR_ID,
                "Sunrise Patrol",
                createHourTimestamp(GREGORIAN_CALENDAR_ID, 2024, "jan", 1, 6)
            ),
            createSingleEvent(
                "evt-day",
                GREGORIAN_CALENDAR_ID,
                "Festival Day",
                createDayTimestamp(GREGORIAN_CALENDAR_ID, 2024, "jan", 2)
            ),
            createSingleEvent(
                "evt-outside",
                GREGORIAN_CALENDAR_ID,
                "Next Week Planning",
                createDayTimestamp(GREGORIAN_CALENDAR_ID, 2024, "jan", 8)
            ),
        ]);

        phenomenonRepo.seed([
            {
                id: "phen-harvest",
                name: "Harvest Festival",
                category: "holiday",
                visibility: "selected",
                appliesToCalendarIds: [GREGORIAN_CALENDAR_ID],
                rule: { type: 'annual_offset', offsetDayOfYear: 2 },
                timePolicy: "all_day",
                priority: 3,
                schemaVersion: "1.0.0",
            },
        ]);

        await gateway.setActiveCalendar(gregorianSchema.id, { initialTimestamp: startOfJanFirst });
    });

    it("liefert nur Ereignisse zwischen altem und neuem Zeitpunkt", async () => {
        const result = await gateway.advanceTimeBy(1, "day");

        expect(result.timestamp.year).toBe(2024);
        expect(result.timestamp.monthId).toBe("jan");
        expect(result.timestamp.day).toBe(2);

        expect(toIdList(result.triggeredEvents)).toEqual(["evt-hour", "evt-day"]);
    });

    it("behandelt auch umgekehrte Zeitspannen korrekt", async () => {
        await gateway.advanceTimeBy(1, "day");

        const backwardsStart: CalendarTimestamp = createDayTimestamp(
            GREGORIAN_CALENDAR_ID,
            2024,
            "jan",
            2
        );
        const backwardsEnd: CalendarTimestamp = createHourTimestamp(
            GREGORIAN_CALENDAR_ID,
            2024,
            "jan",
            1,
            0
        );

        const reversed = await eventRepo.getEventsInRange(
            gregorianSchema.id,
            gregorianSchema,
            backwardsStart,
            backwardsEnd
        );

        const [normalisedStart] =
            compareTimestampsWithSchema(gregorianSchema, backwardsStart, backwardsEnd) <= 0
                ? [backwardsStart, backwardsEnd]
                : [backwardsEnd, backwardsStart];
        const filtered = reversed.filter(event =>
            compareTimestampsWithSchema(
                gregorianSchema,
                getEventAnchorTimestamp(event) ?? event.date,
                normalisedStart
            ) > 0
        );

        expect(toIdList(filtered)).toEqual(["evt-hour", "evt-day"]);
    });

    it("liefert anstehende Phänomene im Snapshot", async () => {
        const snapshot = await gateway.loadSnapshot();

        expect(snapshot.upcomingPhenomena).toHaveLength(1);
        expect(snapshot.upcomingPhenomena[0]?.phenomenonId).toBe("phen-harvest");
        expect(snapshot.upcomingPhenomena[0]?.timestamp.day).toBe(2);
    });

    it("führt Phänomene beim Zeitfortschritt", async () => {
        const result = await gateway.advanceTimeBy(1, "day");

        expect(result.triggeredPhenomena).toHaveLength(1);
        expect(result.triggeredPhenomena[0]?.phenomenonId).toBe("phen-harvest");
        expect(result.upcomingPhenomena[0]?.phenomenonId).toBe("phen-harvest");
    });
});
