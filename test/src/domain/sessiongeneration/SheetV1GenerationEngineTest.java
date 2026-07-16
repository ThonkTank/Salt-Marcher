package src.domain.sessiongeneration;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;
import src.data.sessiongeneration.TsvSessionGenerationCatalog;

class SheetV1GenerationEngineTest {

    private final TsvSessionGenerationCatalog catalog = new TsvSessionGenerationCatalog();
    private final SheetV1GenerationEngine engine = new SheetV1GenerationEngine(catalog);

    @Test
    void reproducesTheFormulaRecalculatedMaster() {
        GenerationResult result = engine.generate(GenerationRequest.sheetV1(
                Map.of(3, 2, 4, 2), new BigDecimal("0.6"), 3, 179974L));

        assertEquals(4, result.session().partyCount());
        assertEquals(3480, result.session().sessionXpTarget());
        assertEquals(List.of(680, 1000, 1800),
                result.encounters().stream().map(GenerationResult.EncounterPlan::targetXp).toList());
        assertEquals(List.of(700, 1000, 1800),
                result.encounters().stream().map(GenerationResult.EncounterPlan::adjustedXp).toList(),
                result.encounters().toString());
        assertEquals(List.of("EASY", "MEDIUM", "DEADLY"),
                result.encounters().stream().map(GenerationResult.EncounterPlan::difficulty).toList());
        assertEquals("1x CR 3", blockText(result.encounters().get(0)));
        assertEquals("5x CR 1/2", blockText(result.encounters().get(1)));
        assertEquals("1x CR 2, 9x CR 1/4", blockText(result.encounters().get(2)));
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

                2. MEDIUM [1.000 XP]: 5x CR 1/2
                   Loot
                   —

                3. DEADLY [1.800 XP]: 1x CR 2, 9x CR 1/4
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
    void seedSuiteProducesResolvedLootAndOnlyBudgetToleranceCanRejectApplication() {
        for (long seed = 1; seed <= 250; seed++) {
            GenerationResult result = engine.generate(GenerationRequest.sheetV1(
                    Map.of(3, 2, 4, 2), new BigDecimal("0.6"), 3, seed));

            assertFalse(result.formattedText().contains("[unresolved]"), "seed " + seed);
            Set<String> failures = result.audits().stream().filter(audit -> !audit.passed())
                    .map(GenerationResult.AuditResult::name).collect(java.util.stream.Collectors.toSet());
            assertTrue(Set.of("Treasure budget tolerance", "Stock pool budget tolerance").containsAll(failures),
                    "seed " + seed + ": " + result.audits());
        }
    }

    @Test
    void distributesEveryMagicTargetRoundRobinWithinItsStockClass() {
        GenerationResult result = engine.generate(GenerationRequest.sheetV1(
                Map.of(4, 4), BigDecimal.ONE, 3, 3L));

        int expected = result.session().rarityTargets().stream()
                .mapToInt(target -> target.normalCount() + target.overstockCount()).sum();
        long actual = result.treasures().stream().flatMap(treasure -> treasure.loot().stream())
                .filter(line -> "magic".equals(line.role())).count();

        assertEquals(2, expected);
        assertEquals(expected, actual);
    }

    @Test
    void separatesNormalAndOverstockMagicInTheSummary() {
        GenerationResult result = engine.generate(GenerationRequest.sheetV1(
                Map.of(4, 4), BigDecimal.ONE, 3, 9003L));

        int overstockMagic = result.session().rarityTargets().stream()
                .mapToInt(GenerationResult.RarityTarget::overstockCount).sum();

        assertEquals(1, overstockMagic);
        assertTrue(result.formattedText().lines()
                .anyMatch(line -> line.startsWith("Magic Items: ") && line.contains(" Overstock")));
    }

    @Test
    void exercisesAdvancedSheetV1BranchesAcrossSeeds() {
        Set<String> variantNames = new HashSet<>();
        catalog.table("DB_LootModifiers").stream()
                .filter(row -> "variant".equals(row.get("Modifier_Kind")))
                .forEach(row -> variantNames.add(row.get("Name")));
        Map<String, Integer> spellLevels = new HashMap<>();
        catalog.table("DB_Spells").forEach(row -> spellLevels.put(
                row.get("Spell"), (int) Double.parseDouble(row.get("Level"))));
        Map<String, int[]> ranges = Map.of(
                "Common", new int[]{0, 1},
                "Uncommon", new int[]{2, 3},
                "Rare", new int[]{4, 5},
                "Very Rare", new int[]{6, 8},
                "Legendary", new int[]{9, 9});
        boolean enspelled = false;
        boolean upperSpellRange = false;
        boolean diverseCoinProfile = false;
        boolean usefulVariant = false;
        boolean cumulativePacking = false;
        boolean structuredCurse = false;

        for (long seed = 1; seed <= 10_000
                && !(enspelled && upperSpellRange && diverseCoinProfile
                && usefulVariant && cumulativePacking && structuredCurse); seed++) {
            int level = switch ((int) (seed % 3L)) {
                case 0 -> 4;
                case 1 -> 10;
                default -> 17;
            };
            GenerationResult result = engine.generate(GenerationRequest.sheetV1(
                    Map.of(level, 4), BigDecimal.ONE, 3, seed));
            for (GenerationResult.TreasureResult treasure : result.treasures()) {
                Map<String, Integer> lastContainerEnd = new HashMap<>();
                for (GenerationResult.LootLine line : treasure.loot()) {
                    if (line.item().startsWith("Enspelled ") && !line.item().contains("[unresolved]")) {
                        assertFalse(line.baseLootItemId().isBlank(), line.toString());
                        assertEquals("enspelled", line.magicSource());
                        enspelled = true;
                    }
                    if (line.cursed()) {
                        assertFalse(line.curseId().isBlank(), line.toString());
                        structuredCurse = true;
                    }
                    diverseCoinProfile |= "Coins".equals(line.item()) && line.text().contains("\n")
                            && (line.text().contains("Platinum") || line.text().contains("Electrum"));
                    usefulVariant |= "useful".equals(line.role())
                            && variantNames.stream().anyMatch(name -> line.item().startsWith(name + " "));
                    if (line.item().startsWith("Spell Scroll — ")) {
                        String spell = line.item().substring("Spell Scroll — ".length());
                        int levelValue = spellLevels.getOrDefault(spell, -1);
                        int[] range = ranges.get(line.rarity());
                        assertTrue(range != null && levelValue >= range[0] && levelValue <= range[1], line.toString());
                        upperSpellRange |= range != null && range[1] > range[0] && levelValue == range[1];
                    }
                    java.util.regex.Matcher matcher = java.util.regex.Pattern
                            .compile("^(.+) 1(?:-(\\d+))?$").matcher(line.container());
                    if (matcher.matches()) {
                        String type = matcher.group(1);
                        int end = matcher.group(2) == null ? 1 : Integer.parseInt(matcher.group(2));
                        Integer previous = lastContainerEnd.put(type, end);
                        if (previous != null) {
                            assertTrue(end >= previous, treasure.toString());
                            cumulativePacking = true;
                        }
                    }
                }
            }
        }

        assertTrue(enspelled, "seed suite did not exercise enspelled_item");
        assertTrue(upperSpellRange, "seed suite did not exercise Info_2 spell levels");
        assertTrue(diverseCoinProfile, "seed suite did not exercise a three-denomination coin profile");
        assertTrue(usefulVariant, "seed suite did not exercise a useful variant");
        assertTrue(cumulativePacking, "seed suite did not exercise cumulative container indices");
        assertTrue(structuredCurse, "seed suite did not retain a selected Curse ID");
    }

    @Test
    void publishesTheHardSheetV1AuditSurface() {
        GenerationResult result = engine.generate(GenerationRequest.sheetV1(
                Map.of(3, 2, 4, 2), new BigDecimal("0.6"), 3, 179974L));
        Set<String> names = result.audits().stream().map(GenerationResult.AuditResult::name).collect(
                java.util.stream.Collectors.toSet());

        assertTrue(names.containsAll(Set.of(
                "Party count", "Candidate coverage", "Encounter selector fit", "Nonmagic slot sum",
                "Descending slot curve", "Magic value on top", "Nonmagic line overfit", "Packing validity",
                "Unique generated IDs", "Loot item references", "Treasure budget tolerance",
                "Stock pool budget tolerance", "Deterministic seed path")));
    }

    @Test
    void buildsTopFourCartesianEncounterCandidates() {
        GenerationResult result = engine.generate(GenerationRequest.sheetV1(
                Map.of(3, 2, 4, 2), new BigDecimal("0.6"), 3, 179974L));

        GenerationResult.AuditResult coverage = result.audits().stream()
                .filter(audit -> "Candidate coverage".equals(audit.name())).findFirst().orElseThrow();

        assertEquals("1:86, 2:128, 3:443", coverage.detail());
    }

    @Test
    void reproducesTheSeededThreeDenominationCoinProfile() {
        GenerationResult result = engine.generate(GenerationRequest.sheetV1(
                Map.of(3, 2, 4, 2), new BigDecimal("0.6"), 3, 39L));

        GenerationResult.LootLine coins = result.treasures().stream().flatMap(treasure -> treasure.loot().stream())
                .filter(line -> "Coins".equals(line.item())).findFirst().orElseThrow();

        assertEquals("10 Platinum Coins\n8 Gold Coins\n28 Electrum Coins", coins.text());
        assertEquals("Pouch 1", coins.container());
        assertEquals(12_200L, coins.actualCp());
    }

    private static String blockText(GenerationResult.EncounterPlan plan) {
        return plan.blocks().stream()
                .map(block -> block.quantity() + "x CR " + block.challengeRating())
                .reduce((left, right) -> left + ", " + right)
                .orElse("");
    }
}
