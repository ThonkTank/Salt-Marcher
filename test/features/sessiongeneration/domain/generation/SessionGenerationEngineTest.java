package features.sessiongeneration.domain.generation;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import features.sessiongeneration.adapter.resource.TsvGenerationCatalog;
import features.sessiongeneration.domain.generation.GeneratedRun.AuditStatus;
import features.sessiongeneration.domain.catalog.GenerationCatalog.Rarity;
import java.math.BigDecimal;
import java.util.List;
import java.util.OptionalInt;
import org.junit.jupiter.api.Test;

final class SessionGenerationEngineTest {

    @Test
    void catalogSnapshotHasVerifiedManifestShape() {
        var catalog = new TsvGenerationCatalog().load();

        assertEquals("catalog-2026-07-16", catalog.version());
        assertEquals("10e7b8c2f3d43c0868e2ce0c3bf8471b72ed4d5327fc633452e0245d32f416f6",
                catalog.contentHash());
        assertEquals(20, catalog.progression().size());
        assertEquals(34, catalog.challengeRanks().size());
        assertEquals(680, catalog.roleBands().size());
        assertEquals(24, catalog.patterns().size());
        assertEquals(679, catalog.loot().size());
        assertEquals(59, catalog.lootModifiers().size());
        assertEquals(1698, catalog.lootRelations().size());
        assertEquals(8, catalog.themes().size());
        assertEquals(552, catalog.magic().size());
        assertEquals(450, catalog.spells().size());
        assertEquals(28, catalog.containers().size());
        assertEquals(45, catalog.enspelledRules().size());
        assertEquals(300, catalog.curses().size());
    }

    @Test
    void goldenPartyAllocatesExactEncounterTargetsAndTypedBlocks() {
        GeneratedRun result = generate(179974L);

        assertEquals(3480L, result.session().sessionXpTarget());
        assertEquals(List.of(680L, 1000L, 1800L),
                result.encounterTargets().stream().map(GeneratedRun.EncounterTarget::targetXp).toList());
        assertEquals(3, result.encounters().size());
        assertTrue(result.encounters().stream().allMatch(encounter -> !encounter.blocks().isEmpty()));
        assertTrue(result.encounters().stream().flatMap(encounter -> encounter.blocks().stream())
                .allMatch(block -> block.unitXp() > 0 && block.quantity() > 0 && block.role() != null));
    }

    @Test
    void keyedEntropyMakesWholeGenerationDeterministicAndHardAuditsPass() {
        GeneratedRun first = generate(179974L);
        GeneratedRun second = generate(179974L);

        assertEquals(first, second);
        assertFalse(first.audits().isEmpty());
        assertTrue(first.audits().stream().noneMatch(audit -> audit.status() == AuditStatus.FAIL),
                () -> "failed audits: " + first.audits());
        assertTrue(first.loot().stream().filter(line -> line.role() == GeneratedRun.LootRole.MAGIC)
                .allMatch(line -> line.actualCp() == 0 && line.totalCapacity().signum() == 0));
        assertTrue(first.packing().stream().allMatch(GeneratedRun.PackingRow::valid));
    }

    @Test
    void adornedAndUsefulVariantRoutesAreTypedBudgetedAndDeterministic() {
        var catalog = new TsvGenerationCatalog().load();
        GeneratedRun.LootLine adorned = null;
        long adornedSeed = -1L;
        GeneratedRun.LootLine variant = null;
        long variantSeed = -1L;
        for (long seed = 0L; seed < 10_000L && (adorned == null || variant == null); seed++) {
            GeneratedRun.LootLine line = oneMundaneLine(seed, catalog);
            if (line.itemId().startsWith("procedural:adorned:")) {
                adorned = line;
                adornedSeed = seed;
            }
            if (line.itemId().contains(":modifier:variant:")) {
                variant = line;
                variantSeed = seed;
            }
        }

        assertTrue(adorned != null, "deterministic corpus reaches procedural adorned selection");
        assertTrue(variant != null, "deterministic corpus reaches useful variant selection");
        assertTrue(adorned.actualCp() <= 52_500L);
        assertTrue(variant.actualCp() <= 52_500L);
        assertEquals(adorned, oneMundaneLine(adornedSeed, catalog));
        assertEquals(variant, oneMundaneLine(variantSeed, catalog));
    }

    @Test
    void fixedSeedSuiteKeepsDistributionsAndHardCapsWithinBroadTolerance() {
        var catalog = new TsvGenerationCatalog().load();
        int carrier = 0;
        int useful = 0;
        int flavor = 0;
        int bulk = 0;
        int cursed = 0;
        int seeds = 1_000;
        for (long seed = 0; seed < seeds; seed++) {
            List<GeneratedRun.LootLine> loot = statisticalLoot(seed, catalog);
            GeneratedRun.LootLine mundane = loot.getFirst();
            switch (mundane.role()) {
                case CARRIER -> carrier++;
                case USEFUL -> useful++;
                case FLAVOR -> flavor++;
                case MAGIC -> throw new AssertionError("first line must be mundane");
            }
            if (mundane.role() == GeneratedRun.LootRole.CARRIER) {
                var definition = catalog.loot().stream().filter(item -> item.id().equals(mundane.itemId())).findFirst();
                if (definition.isPresent() && definition.get().valueForm().equals("Quantity_Good")
                        && definition.get().baseWeight().multiply(BigDecimal.valueOf(mundane.quantity()))
                                .compareTo(new BigDecimal("20")) >= 0) {
                    bulk++;
                }
            }
            if (loot.getLast().cursed()) cursed++;
            assertTrue(mundane.actualCp() <= 52_500L);
            assertTrue(new PackingStage().pack(loot, catalog.containers(), new KeyedEntropy(seed)).stream()
                    .allMatch(GeneratedRun.PackingRow::valid));
        }
        assertEquals(0.60, carrier / (double) seeds, 0.12);
        assertEquals(0.30, useful / (double) seeds, 0.10);
        assertEquals(0.10, flavor / (double) seeds, 0.07);
        assertEquals(0.25, bulk / (double) Math.max(1, carrier), 0.16);
        assertEquals(0.20, cursed / (double) seeds, 0.08);

        for (long seed = 0; seed < 32; seed++) {
            GeneratedRun result = generate(seed);
            assertTrue(result.audits().stream().noneMatch(audit -> audit.status() == AuditStatus.FAIL),
                    () -> "seed " + result.seed() + " failed " + result.audits()
                            + " treasures=" + result.treasures() + " loot=" + result.loot());
        }
    }

    private static GeneratedRun generate(long seed) {
        var input = new GenerationInput(
                List.of(new GeneratedRun.PartyLevel(3, 2), new GeneratedRun.PartyLevel(4, 2)),
                new BigDecimal("0.6"),
                OptionalInt.of(3),
                seed);
        return new SessionGenerationEngine().generate(input, new TsvGenerationCatalog().load());
    }

    private static GeneratedRun.LootLine oneMundaneLine(
            long seed,
            features.sessiongeneration.domain.catalog.GenerationCatalog.CatalogSnapshot catalog
    ) {
        return statisticalLoot(seed, catalog).getFirst();
    }

    private static List<GeneratedRun.LootLine> statisticalLoot(
            long seed,
            features.sessiongeneration.domain.catalog.GenerationCatalog.CatalogSnapshot catalog
    ) {
        var session = new GeneratedRun.SessionContext(
                4, new BigDecimal("0.6"), 1, 5_800L, 3_480L, new BigDecimal("3.50"),
                50_000L, 0L, 1, 1, 0, 1);
        var treasure = new GeneratedRun.TreasurePlan(
                1, GeneratedRun.StockClass.NORMAL, GeneratedRun.RewardChannel.QUEST, 0,
                "Armaments", "Armaments", 50_000L, 1, 1);
        return new LootGenerationStage().generate(
                session, List.of(Rarity.COMMON), List.of(treasure), catalog, new KeyedEntropy(seed));
    }
}
