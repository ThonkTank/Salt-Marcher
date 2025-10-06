// salt-marcher/tests/apps/almanac/state-gateway.test.ts
// Prüft die Bereichsfilterung des Almanac-State-Gateways bei Zeitfortschritt.
import { beforeEach, describe, expect, it } from "vitest";

import {
    InMemoryCalendarRepository,
    InMemoryEventRepository,
} from "../../../src/apps/almanac/data/in-memory-repository";
import { InMemoryStateGateway } from "../../../src/apps/almanac/data/in-memory-gateway";
import { createEvent } from "../../../src/apps/almanac/domain/calendar-event";
import {
    createHourTimestamp,
    createDayTimestamp,
    createMinuteTimestamp,
    type CalendarTimestamp,
} from "../../../src/apps/almanac/domain/calendar-timestamp";
import {
    gregorianSchema,
    GREGORIAN_CALENDAR_ID,
} from "../../../src/apps/almanac/fixtures/gregorian.fixture";

const startOfJanFirst = createMinuteTimestamp(GREGORIAN_CALENDAR_ID, 2024, "jan", 1, 0, 0);

const toIdList = (events: Array<{ id: string }>) => events.map(event => event.id);

describe("InMemoryStateGateway.advanceTimeBy", () => {
    let calendarRepo: InMemoryCalendarRepository;
    let eventRepo: InMemoryEventRepository;
    let gateway: InMemoryStateGateway;

    beforeEach(async () => {
        calendarRepo = new InMemoryCalendarRepository();
        eventRepo = new InMemoryEventRepository();
        gateway = new InMemoryStateGateway(calendarRepo, eventRepo);

        calendarRepo.seed([gregorianSchema]);
        eventRepo.seed([
            createEvent(
                "evt-before",
                GREGORIAN_CALENDAR_ID,
                "Night Watch",
                createHourTimestamp(GREGORIAN_CALENDAR_ID, 2024, "jan", 1, 0)
            ),
            createEvent(
                "evt-hour",
                GREGORIAN_CALENDAR_ID,
                "Sunrise Patrol",
                createHourTimestamp(GREGORIAN_CALENDAR_ID, 2024, "jan", 1, 6)
            ),
            createEvent(
                "evt-minute",
                GREGORIAN_CALENDAR_ID,
                "Morning Bell",
                createMinuteTimestamp(GREGORIAN_CALENDAR_ID, 2024, "jan", 1, 0, 15)
            ),
            createEvent(
                "evt-day",
                GREGORIAN_CALENDAR_ID,
                "Festival Day",
                createDayTimestamp(GREGORIAN_CALENDAR_ID, 2024, "jan", 2)
            ),
            createEvent(
                "evt-outside",
                GREGORIAN_CALENDAR_ID,
                "Next Week Planning",
                createDayTimestamp(GREGORIAN_CALENDAR_ID, 2024, "jan", 8)
            ),
        ]);

        await gateway.setActiveCalendar(gregorianSchema.id, startOfJanFirst);
    });

    it("liefert nur Ereignisse zwischen altem und neuem Zeitpunkt", async () => {
        const result = await gateway.advanceTimeBy(1, "day");

        expect(result.timestamp.year).toBe(2024);
        expect(result.timestamp.monthId).toBe("jan");
        expect(result.timestamp.day).toBe(2);

        expect(toIdList(result.triggeredEvents)).toEqual(["evt-minute", "evt-hour", "evt-day"]);
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

        expect(toIdList(reversed)).toEqual(["evt-minute", "evt-hour", "evt-day"]);
    });

    it("liefert bei Minutenfortschritt auch minutenpräzise Ereignisse", async () => {
        const result = await gateway.advanceTimeBy(15, "minute");

        expect(result.timestamp.hour).toBe(0);
        expect(result.timestamp.minute).toBe(15);
        expect(toIdList(result.triggeredEvents)).toEqual(["evt-minute"]);
    });
});
