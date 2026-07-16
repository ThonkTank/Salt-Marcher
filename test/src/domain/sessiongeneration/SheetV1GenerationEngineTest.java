package src.domain.sessiongeneration;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import src.data.sessiongeneration.TsvSessionGenerationCatalog;

class SheetV1GenerationEngineTest {

    private final SheetV1GenerationEngine engine =
            new SheetV1GenerationEngine(new TsvSessionGenerationCatalog());

    @Test
    void reproducesGoldenMasterSessionAndEncounterPlan() {
        GenerationResult result = engine.generate(GenerationRequest.sheetV1(
                Map.of(3, 2, 4, 2), new BigDecimal("0.6"), 3, 179974L));

        assertEquals(4, result.session().partyCount());
        assertEquals(3480, result.session().sessionXpTarget());
        assertEquals(List.of(680, 1000, 1800),
                result.encounters().stream().map(GenerationResult.EncounterPlan::targetXp).toList());
        assertEquals(List.of(700, 1000, 1875),
                result.encounters().stream().map(GenerationResult.EncounterPlan::adjustedXp).toList(),
                result.encounters().toString());
        assertEquals(List.of("EASY", "MEDIUM", "DEADLY"),
                result.encounters().stream().map(GenerationResult.EncounterPlan::difficulty).toList());
        assertEquals("1x CR 3", blockText(result.encounters().get(0)));
        assertEquals("8x CR 1/4", blockText(result.encounters().get(1)));
        assertEquals("4x CR 1/2, 7x CR 1/4", blockText(result.encounters().get(2)));
        assertEquals("""
                Rewards: 1313 gp + 230 gp Overstock
                Magic Items: 1 [Common]

                QUEST REWARD
                   A Pouch with:
                      Cochineal Dye [á 9 lb, 450 gp]
                   A Chest with:
                      3x Obsidian Ritual Bowl [á 150 gp]
                   7 Barrels with:
                      Honey Wine [á 295 lb, 59 gp]
                   Ear Horn of Hearing [Common]

                1. EASY [700 XP]: 1x CR 3
                   Loot
                   —

                2. MEDIUM [1.000 XP]: 8x CR 1/4
                   Loot
                   —

                3. DEADLY [1.875 XP]: 4x CR 1/2, 7x CR 1/4
                   Loot [Overstock]
                   A Pouch with:
                      13x Bad News Bullets [á 10 gp]
                   1x Painted Court Fan [á 100 gp]

                ENVIRONMENTAL REWARDS
                —""", result.formattedText());
    }

    @Test
    void sameRequestIsDeterministicApartFromRunIdentity() {
        GenerationRequest request = GenerationRequest.sheetV1(
                Map.of(3, 2, 4, 2), new BigDecimal("0.6"), 3, 179974L);

        GenerationResult first = engine.generate(request);
        GenerationResult second = engine.generate(request);

        assertEquals(first.session(), second.session());
        assertEquals(first.encounters(), second.encounters());
        assertEquals(first.treasures(), second.treasures());
        assertEquals(first.formattedText(), second.formattedText());
        assertEquals(first.audits(), second.audits());
        assertFalse(first.formattedText().isBlank());
        assertTrue(first.audits().stream().allMatch(GenerationResult.AuditResult::passed));
    }

    @Test
    void seedSuiteProducesApplicableResolvedLoot() {
        for (long seed = 1; seed <= 250; seed++) {
            GenerationResult result = engine.generate(GenerationRequest.sheetV1(
                    Map.of(3, 2, 4, 2), new BigDecimal("0.6"), 3, seed));

            assertTrue(result.applicable(), "seed " + seed + ": " + result.audits() + "\n" + result.formattedText());
            assertFalse(result.formattedText().contains("[unresolved]"), "seed " + seed);
        }
    }

    private static String blockText(GenerationResult.EncounterPlan plan) {
        return plan.blocks().stream()
                .map(block -> block.quantity() + "x CR " + block.challengeRating())
                .reduce((left, right) -> left + ", " + right)
                .orElse("");
    }
}
