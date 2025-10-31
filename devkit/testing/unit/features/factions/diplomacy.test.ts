// devkit/testing/unit/features/factions/diplomacy.test.ts
// Unit tests for Diplomatic Events System

import { describe, it, expect } from "vitest";
import {
    proposeTreaty,
    violateTreaty,
    nullifyTreaty,
    checkTreatyExpiration,
    renewTreaty,
    getActiveTreaties,
    getTreatiesWithFaction,
    hasTreaty,
    generateDiplomaticEvent,
    negotiateTerms,
} from "../../../../../src/features/factions/diplomacy";
import type { FactionData, DiplomaticTreaty } from "../../../../../src/workmodes/library/factions/types";

describe("Diplomatic Events System", () => {
    describe("proposeTreaty", () => {
        it("accepts treaty with sufficient relationship", () => {
            const proposer: FactionData = {
                name: "Kingdom A",
                faction_relationships: [{ faction_name: "Kingdom B", value: 60, type: "allied" }],
            };

            const receiver: FactionData = {
                name: "Kingdom B",
                faction_relationships: [{ faction_name: "Kingdom A", value: 60, type: "allied" }],
            };

            const result = proposeTreaty(proposer, receiver, "alliance", "Mutual defense pact", "1492-03-15");

            expect(result.accepted).toBe(true);
            expect(result.treaty).toBeDefined();
            expect(result.treaty?.type).toBe("alliance");
            expect(proposer.treaties).toHaveLength(1);
            expect(receiver.treaties).toHaveLength(1);
        });

        it("rejects treaty with insufficient relationship", () => {
            const proposer: FactionData = {
                name: "Kingdom A",
                faction_relationships: [{ faction_name: "Kingdom B", value: 10, type: "neutral" }],
            };

            const receiver: FactionData = {
                name: "Kingdom B",
            };

            const result = proposeTreaty(proposer, receiver, "alliance", "Alliance terms", "1492-03-15");

            expect(result.accepted).toBe(false);
            expect(result.reason).toContain("Relationship too low");
        });

        it("accepts non-aggression pact even with slight hostility", () => {
            const proposer: FactionData = {
                name: "Kingdom A",
                faction_relationships: [{ faction_name: "Kingdom B", value: -10, type: "rivalry" }],
            };

            const receiver: FactionData = {
                name: "Kingdom B",
            };

            const result = proposeTreaty(proposer, receiver, "non_aggression", "Cease hostilities", "1492-03-15");

            expect(result.accepted).toBe(true);
        });

        it("requires high relationship for vassal treaty", () => {
            const proposer: FactionData = {
                name: "Empire",
                faction_relationships: [{ faction_name: "Small Kingdom", value: 40, type: "trade" }],
            };

            const receiver: FactionData = {
                name: "Small Kingdom",
            };

            const result = proposeTreaty(proposer, receiver, "vassal", "Become vassal state", "1492-03-15");

            expect(result.accepted).toBe(false);
        });
    });

    describe("violateTreaty", () => {
        it("marks treaty as violated and damages relationships", () => {
            const violator: FactionData = {
                name: "Betrayer",
                faction_relationships: [{ faction_name: "Victim", value: 40, type: "trade" }],
                treaties: [
                    {
                        id: "treaty-1",
                        type: "non_aggression",
                        partners: ["Betrayer", "Victim"],
                        terms: "No conflict",
                        signed: "1492-01-01",
                        status: "active",
                    },
                ],
            };

            const victim: FactionData = {
                name: "Victim",
                faction_relationships: [],
                treaties: [
                    {
                        id: "treaty-1",
                        type: "non_aggression",
                        partners: ["Betrayer", "Victim"],
                        terms: "No conflict",
                        signed: "1492-01-01",
                        status: "active",
                    },
                ],
            };

            const treaty = violator.treaties[0];

            violateTreaty(violator, treaty, [violator, victim]);

            expect(violator.treaties[0].status).toBe("violated");
            expect(victim.treaties[0].status).toBe("violated");
            // Relationship should have decreased significantly
            const relationship = violator.faction_relationships?.find((r) => r.faction_name === "Victim");
            expect(relationship?.value).toBeLessThan(0);
        });
    });

    describe("nullifyTreaty", () => {
        it("ends treaty by mutual agreement", () => {
            const faction1: FactionData = {
                name: "Faction 1",
                treaties: [
                    {
                        id: "treaty-1",
                        type: "trade_agreement",
                        partners: ["Faction 1", "Faction 2"],
                        terms: "Trade terms",
                        signed: "1492-01-01",
                        status: "active",
                    },
                ],
            };

            const faction2: FactionData = {
                name: "Faction 2",
                treaties: [
                    {
                        id: "treaty-1",
                        type: "trade_agreement",
                        partners: ["Faction 1", "Faction 2"],
                        terms: "Trade terms",
                        signed: "1492-01-01",
                        status: "active",
                    },
                ],
            };

            const result = nullifyTreaty(faction1, faction2, "treaty-1");

            expect(result).toBe(true);
            expect(faction1.treaties[0].status).toBe("nullified");
            expect(faction2.treaties[0].status).toBe("nullified");
        });
    });

    describe("checkTreatyExpiration", () => {
        it("detects expired treaty", () => {
            const treaty: DiplomaticTreaty = {
                id: "treaty-1",
                type: "alliance",
                partners: ["A", "B"],
                terms: "Terms",
                signed: "1492-01-01",
                expires: "1492-12-31",
                status: "active",
            };

            const expired = checkTreatyExpiration(treaty, "1493-01-01");
            expect(expired).toBe(true);
        });

        it("detects non-expired treaty", () => {
            const treaty: DiplomaticTreaty = {
                id: "treaty-1",
                type: "alliance",
                partners: ["A", "B"],
                terms: "Terms",
                signed: "1492-01-01",
                expires: "1493-12-31",
                status: "active",
            };

            const expired = checkTreatyExpiration(treaty, "1493-01-01");
            expect(expired).toBe(false);
        });

        it("returns false for permanent treaties", () => {
            const treaty: DiplomaticTreaty = {
                id: "treaty-1",
                type: "alliance",
                partners: ["A", "B"],
                terms: "Terms",
                signed: "1492-01-01",
                status: "active",
            };

            const expired = checkTreatyExpiration(treaty, "1500-01-01");
            expect(expired).toBe(false);
        });
    });

    describe("renewTreaty", () => {
        it("renews treaty with good relations", () => {
            const faction1: FactionData = {
                name: "Faction 1",
                faction_relationships: [{ faction_name: "Faction 2", value: 40, type: "trade" }],
                treaties: [
                    {
                        id: "treaty-1",
                        type: "alliance",
                        partners: ["Faction 1", "Faction 2"],
                        terms: "Terms",
                        signed: "1492-01-01",
                        expires: "1492-12-31",
                        status: "active",
                    },
                ],
            };

            const faction2: FactionData = {
                name: "Faction 2",
                treaties: [
                    {
                        id: "treaty-1",
                        type: "alliance",
                        partners: ["Faction 1", "Faction 2"],
                        terms: "Terms",
                        signed: "1492-01-01",
                        expires: "1492-12-31",
                        status: "active",
                    },
                ],
            };

            const result = renewTreaty(faction1, faction2, "treaty-1", "1493-12-31");

            expect(result).toBe(true);
            expect(faction1.treaties[0].expires).toBe("1493-12-31");
            expect(faction2.treaties[0].expires).toBe("1493-12-31");
        });

        it("refuses to renew with hostile relations", () => {
            const faction1: FactionData = {
                name: "Faction 1",
                faction_relationships: [{ faction_name: "Faction 2", value: -30, type: "rivalry" }],
                treaties: [
                    {
                        id: "treaty-1",
                        type: "alliance",
                        partners: ["Faction 1", "Faction 2"],
                        terms: "Terms",
                        signed: "1492-01-01",
                        status: "active",
                    },
                ],
            };

            const faction2: FactionData = {
                name: "Faction 2",
                treaties: [
                    {
                        id: "treaty-1",
                        type: "alliance",
                        partners: ["Faction 1", "Faction 2"],
                        terms: "Terms",
                        signed: "1492-01-01",
                        status: "active",
                    },
                ],
            };

            const result = renewTreaty(faction1, faction2, "treaty-1");

            expect(result).toBe(false);
        });
    });

    describe("getActiveTreaties", () => {
        it("returns only active treaties", () => {
            const faction: FactionData = {
                name: "Test",
                treaties: [
                    { id: "1", type: "alliance", partners: ["A", "B"], terms: "T", signed: "1492-01-01", status: "active" },
                    { id: "2", type: "trade_agreement", partners: ["A", "C"], terms: "T", signed: "1492-02-01", status: "violated" },
                    { id: "3", type: "mutual_defense", partners: ["A", "D"], terms: "T", signed: "1492-03-01", status: "active" },
                ],
            };

            const active = getActiveTreaties(faction);

            expect(active).toHaveLength(2);
            expect(active.map((t) => t.id)).toEqual(["1", "3"]);
        });
    });

    describe("getTreatiesWithFaction", () => {
        it("returns treaties with specific faction", () => {
            const faction: FactionData = {
                name: "Kingdom A",
                treaties: [
                    { id: "1", type: "alliance", partners: ["Kingdom A", "Kingdom B"], terms: "T", signed: "1492-01-01", status: "active" },
                    { id: "2", type: "trade_agreement", partners: ["Kingdom A", "Kingdom C"], terms: "T", signed: "1492-02-01", status: "active" },
                ],
            };

            const treaties = getTreatiesWithFaction(faction, "Kingdom B");

            expect(treaties).toHaveLength(1);
            expect(treaties[0].id).toBe("1");
        });
    });

    describe("hasTreaty", () => {
        it("checks if specific treaty type exists", () => {
            const faction: FactionData = {
                name: "Test",
                treaties: [
                    { id: "1", type: "alliance", partners: ["Test", "Partner"], terms: "T", signed: "1492-01-01", status: "active" },
                ],
            };

            expect(hasTreaty(faction, "Partner", "alliance")).toBe(true);
            expect(hasTreaty(faction, "Partner", "trade_agreement")).toBe(false);
            expect(hasTreaty(faction, "Other", "alliance")).toBe(false);
        });
    });

    describe("generateDiplomaticEvent", () => {
        it("generates alliance opportunity for high relationship without treaty", () => {
            const faction: FactionData = {
                name: "Kingdom A",
                faction_relationships: [{ faction_name: "Kingdom B", value: 70, type: "allied" }],
                treaties: [],
            };

            const event = generateDiplomaticEvent(faction, []);

            expect(event?.type).toBe("alliance_opportunity");
            expect(event?.targetFaction).toBe("Kingdom B");
        });

        it("generates betrayal warning for weakening alliance", () => {
            const faction: FactionData = {
                name: "Kingdom A",
                faction_relationships: [{ faction_name: "Kingdom B", value: 25, type: "neutral" }],
                treaties: [
                    { id: "1", type: "alliance", partners: ["Kingdom A", "Kingdom B"], terms: "T", signed: "1492-01-01", status: "active" },
                ],
            };

            const event = generateDiplomaticEvent(faction, []);

            expect(event?.type).toBe("betrayal_warning");
            expect(event?.targetFaction).toBe("Kingdom B");
        });

        it("returns null if no diplomatic events triggered", () => {
            const faction: FactionData = {
                name: "Kingdom A",
                faction_relationships: [],
                treaties: [],
            };

            const event = generateDiplomaticEvent(faction, []);

            expect(event).toBeNull();
        });
    });

    describe("negotiateTerms", () => {
        it("accepts generous terms with allied faction", () => {
            const faction1: FactionData = {
                name: "Kingdom A",
                faction_relationships: [{ faction_name: "Kingdom B", value: 70, type: "allied" }],
            };

            const faction2: FactionData = {
                name: "Kingdom B",
            };

            const result = negotiateTerms(faction1, faction2, 1000);

            expect(result.accepted).toBe(true);
        });

        it("counter-offers with neutral faction", () => {
            const faction1: FactionData = {
                name: "Kingdom A",
                faction_relationships: [{ faction_name: "Kingdom B", value: 20, type: "neutral" }],
            };

            const faction2: FactionData = {
                name: "Kingdom B",
            };

            const result = negotiateTerms(faction1, faction2, 1000);

            expect(result.accepted).toBe(false);
            expect(result.counterOffer).toBe(700); // 70% of original
        });

        it("demands more from hostile faction", () => {
            const faction1: FactionData = {
                name: "Kingdom A",
                faction_relationships: [{ faction_name: "Kingdom B", value: -40, type: "hostile" }],
            };

            const faction2: FactionData = {
                name: "Kingdom B",
            };

            const result = negotiateTerms(faction1, faction2, 1000);

            expect(result.accepted).toBe(false);
            expect(result.counterOffer).toBe(1500); // 150% of original
        });
    });
});
