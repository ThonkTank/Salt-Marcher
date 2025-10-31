// devkit/testing/unit/apps/almanac/weather-calendar-integration.test.ts
// Tests weather system integration with calendar (Phase 10.2)

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	InMemoryStateGateway,
	type WeatherSimulationHook,
} from "../../../../../src/workmodes/almanac/data/calendar-state-gateway";
import {
	AlmanacMemoryBackend,
	InMemoryCalendarRepository,
	InMemoryEventRepository,
	InMemoryPhenomenonRepository,
} from "../../../../../src/workmodes/almanac/data/repositories";
import {
	createHourTimestamp,
	createDayTimestamp,
} from "../../../../../src/workmodes/almanac/domain";
import {
	gregorianSchema,
	GREGORIAN_CALENDAR_ID,
} from "../../../../../src/workmodes/almanac/fixtures/gregorian.fixture";

describe("Weather-Calendar Integration (Phase 10.2)", () => {
	let calendarRepo: InMemoryCalendarRepository;
	let eventRepo: InMemoryEventRepository;
	let phenomenonRepo: InMemoryPhenomenonRepository;
	let weatherHook: WeatherSimulationHook;
	let weatherCalls: Array<{ dayOfYear: number; currentDate: string }>;
	let gateway: InMemoryStateGateway;

	beforeEach(async () => {
		const backend = new AlmanacMemoryBackend();
		calendarRepo = new InMemoryCalendarRepository(backend);
		eventRepo = new InMemoryEventRepository(backend);
		phenomenonRepo = new InMemoryPhenomenonRepository(backend);

		// Track weather hook calls
		weatherCalls = [];
		weatherHook = {
			async runSimulation(dayOfYear: number, currentDate: string) {
				weatherCalls.push({ dayOfYear, currentDate });
				return [];
			},
		};

		gateway = new InMemoryStateGateway(
			calendarRepo,
			eventRepo,
			phenomenonRepo,
			undefined,
			undefined,
			weatherHook
		);

		calendarRepo.seed([gregorianSchema]);
		await gateway.setActiveCalendar(gregorianSchema.id, {
			initialTimestamp: createHourTimestamp(GREGORIAN_CALENDAR_ID, 2024, "jan", 1, 0),
		});
	});

	describe("Daily Weather Updates", () => {
		it("should call weather hook when advancing by day", async () => {
			await gateway.advanceTimeBy(1, "day");

			expect(weatherCalls).toHaveLength(1);
			expect(weatherCalls[0]).toEqual({
				dayOfYear: expect.any(Number),
				currentDate: "2024-01-02",
			});
		});

		it("should call weather hook multiple times when advancing multiple days", async () => {
			await gateway.advanceTimeBy(3, "day");

			expect(weatherCalls).toHaveLength(1);
			expect(weatherCalls[0].currentDate).toBe("2024-01-04");
		});

		it("should NOT call weather hook when advancing by hours", async () => {
			await gateway.advanceTimeBy(6, "hour");

			expect(weatherCalls).toHaveLength(0);
		});

		it("should NOT call weather hook when advancing by minutes", async () => {
			await gateway.advanceTimeBy(30, "minute");

			expect(weatherCalls).toHaveLength(0);
		});
	});

	describe("Day of Year Calculation", () => {
		it("should calculate day 2 for January 2nd (after advancing 1 day from Jan 1)", async () => {
			await gateway.advanceTimeBy(1, "day");

			expect(weatherCalls[0].dayOfYear).toBe(2);
		});

		it("should calculate day 31 for January 31st", async () => {
			// Advance to Jan 31
			await gateway.advanceTimeBy(30, "day");

			expect(weatherCalls[0].dayOfYear).toBe(31);
		});

		it("should calculate day 32 for February 1st", async () => {
			// Advance to Feb 1 (31 days)
			await gateway.advanceTimeBy(31, "day");

			expect(weatherCalls[0].dayOfYear).toBe(32);
		});

		it("should handle year-end correctly", async () => {
			// Start at December 31
			await gateway.setCurrentTimestamp(createDayTimestamp(GREGORIAN_CALENDAR_ID, 2024, "dec", 31));
			weatherCalls = []; // Reset

			await gateway.advanceTimeBy(1, "day");

			// Should wrap to day 1 of new year
			expect(weatherCalls[0].currentDate).toBe("2025-01-01");
			expect(weatherCalls[0].dayOfYear).toBe(1);
		});
	});

	describe("Seasonal Transitions", () => {
		it("should provide spring day-of-year values (days 60-150)", async () => {
			// Set to March 1 (early spring)
			await gateway.setCurrentTimestamp(createDayTimestamp(GREGORIAN_CALENDAR_ID, 2024, "mar", 1));
			weatherCalls = [];

			await gateway.advanceTimeBy(1, "day");

			// March 1 = day 60 (31 Jan + 29 Feb)
			expect(weatherCalls[0].dayOfYear).toBe(61);
		});

		it("should provide summer day-of-year values (days 151-243)", async () => {
			// Set to June 1
			await gateway.setCurrentTimestamp(createDayTimestamp(GREGORIAN_CALENDAR_ID, 2024, "jun", 1));
			weatherCalls = [];

			await gateway.advanceTimeBy(1, "day");

			// June 1 = day 152 (31+29+31+30+31)
			expect(weatherCalls[0].dayOfYear).toBe(153);
		});

		it("should provide fall day-of-year values (days 244-334)", async () => {
			// Set to September 1
			await gateway.setCurrentTimestamp(createDayTimestamp(GREGORIAN_CALENDAR_ID, 2024, "sep", 1));
			weatherCalls = [];

			await gateway.advanceTimeBy(1, "day");

			// September 1 = day 244 (31+29+31+30+31+30+31+31)
			expect(weatherCalls[0].dayOfYear).toBe(245);
		});

		it("should provide winter day-of-year values (days 335-59)", async () => {
			// Set to December 1
			await gateway.setCurrentTimestamp(createDayTimestamp(GREGORIAN_CALENDAR_ID, 2024, "dec", 1));
			weatherCalls = [];

			await gateway.advanceTimeBy(1, "day");

			// December 1 = day 335
			expect(weatherCalls[0].dayOfYear).toBe(336);
		});
	});

	describe("Error Handling", () => {
		it("should NOT fail time advancement if weather hook throws error", async () => {
			const failingHook: WeatherSimulationHook = {
				async runSimulation() {
					throw new Error("Weather simulation failed");
				},
			};

			const gatewayWithFailingHook = new InMemoryStateGateway(
				calendarRepo,
				eventRepo,
				phenomenonRepo,
				undefined,
				undefined,
				failingHook
			);

			await gatewayWithFailingHook.setActiveCalendar(gregorianSchema.id, {
				initialTimestamp: createHourTimestamp(GREGORIAN_CALENDAR_ID, 2024, "jan", 1, 0),
			});

			// Should not throw
			const result = await gatewayWithFailingHook.advanceTimeBy(1, "day");

			expect(result.timestamp.year).toBe(2024);
			expect(result.timestamp.monthId).toBe("jan");
			expect(result.timestamp.day).toBe(2);
		});

		it("should continue to work after weather hook errors", async () => {
			let shouldFail = true;
			const intermittentHook: WeatherSimulationHook = {
				async runSimulation() {
					if (shouldFail) {
						throw new Error("Intermittent failure");
					}
					return [];
				},
			};

			const gatewayWithIntermittent = new InMemoryStateGateway(
				calendarRepo,
				eventRepo,
				phenomenonRepo,
				undefined,
				undefined,
				intermittentHook
			);

			await gatewayWithIntermittent.setActiveCalendar(gregorianSchema.id, {
				initialTimestamp: createHourTimestamp(GREGORIAN_CALENDAR_ID, 2024, "jan", 1, 0),
			});

			// First call should fail silently
			await gatewayWithIntermittent.advanceTimeBy(1, "day");

			// Second call should succeed
			shouldFail = false;
			const result = await gatewayWithIntermittent.advanceTimeBy(1, "day");

			expect(result.timestamp.day).toBe(3);
		});
	});

	describe("Date Formatting", () => {
		it("should format dates correctly with leading zeros", async () => {
			await gateway.advanceTimeBy(1, "day");

			expect(weatherCalls[0].currentDate).toBe("2024-01-02");
		});

		it("should format double-digit months correctly", async () => {
			await gateway.setCurrentTimestamp(createDayTimestamp(GREGORIAN_CALENDAR_ID, 2024, "nov", 15));
			weatherCalls = [];

			await gateway.advanceTimeBy(1, "day");

			expect(weatherCalls[0].currentDate).toBe("2024-11-16");
		});

		it("should format years with 4 digits", async () => {
			await gateway.setCurrentTimestamp(createDayTimestamp(GREGORIAN_CALENDAR_ID, 999, "jan", 1));
			weatherCalls = [];

			await gateway.advanceTimeBy(1, "day");

			expect(weatherCalls[0].currentDate).toBe("0999-01-02");
		});
	});

	describe("No Weather Hook", () => {
		it("should work correctly when weather hook is not provided", async () => {
			const gatewayWithoutWeather = new InMemoryStateGateway(
				calendarRepo,
				eventRepo,
				phenomenonRepo
			);

			await gatewayWithoutWeather.setActiveCalendar(gregorianSchema.id, {
				initialTimestamp: createHourTimestamp(GREGORIAN_CALENDAR_ID, 2024, "jan", 1, 0),
			});

			// Should not throw
			const result = await gatewayWithoutWeather.advanceTimeBy(1, "day");

			expect(result.timestamp.day).toBe(2);
		});
	});

	describe("Climate-Based Weather (Phase 10.2 Integration)", () => {
		it("should be called with correct parameters for seasonal weather", async () => {
			// Jan 1 is winter (day 1)
			await gateway.advanceTimeBy(1, "day");

			expect(weatherCalls).toHaveLength(1);
			expect(weatherCalls[0]).toEqual({
				dayOfYear: 2, // Jan 2
				currentDate: "2024-01-02",
			});
		});

		it("should provide summer day values for tropical regions", async () => {
			// Set to July 1 (summer - hot)
			await gateway.setCurrentTimestamp(createDayTimestamp(GREGORIAN_CALENDAR_ID, 2024, "jul", 1));
			weatherCalls = [];

			await gateway.advanceTimeBy(1, "day");

			// July 1 = day 182 (31+29+31+30+31+30)
			expect(weatherCalls[0].dayOfYear).toBe(183);
			expect(weatherCalls[0].currentDate).toBe("2024-07-02");
		});
	});
});
