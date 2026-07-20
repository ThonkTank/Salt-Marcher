package features.sessiongeneration.domain.generation;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;

import features.sessiongeneration.adapter.resource.TsvGenerationCatalog;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.OptionalInt;
import org.junit.jupiter.api.Test;

final class GenerationContentFingerprintTest {

    @Test
    void goldenV1FingerprintPinsExplicitCanonicalEncoding() {
        assertEquals(
                "v1:516fa4819d031daa841d10ca6c89b58277440077c1270fd7fc11d8b24e453b81",
                GenerationContentFingerprint.v1(goldenRun()));
    }

    @Test
    void v1NormalizesDecimalsAndLineEndingsAndExcludesFormattedText() {
        GeneratedRun source = goldenRun();
        List<GeneratedRun.LootLine> lineFeedLoot = new ArrayList<>(source.loot());
        GeneratedRun.LootLine first = lineFeedLoot.getFirst();
        lineFeedLoot.set(0, new GeneratedRun.LootLine(
                first.lineId(), first.treasureId(), first.role(), first.itemId(), first.text() + "\ncontinued",
                first.quantity(), first.unitCp(), first.actualCp(), first.totalCapacity(), first.allowedContainers(),
                first.magicRarity(), first.cursed()));
        GeneratedRun lineFeed = copy(source, source.session(), lineFeedLoot, source.formattedText());
        GeneratedRun normalized = copy(
                lineFeed,
                new GeneratedRun.SessionContext(
                        source.session().partyCount(), new BigDecimal("0.6000"),
                        source.session().encounterCount(), source.session().dayXpBudget(),
                        source.session().sessionXpTarget(), new BigDecimal("3.5000"),
                        source.session().normalBudgetCp(), source.session().overstockBudgetCp(),
                        source.session().nonMagicSlots(), source.session().normalMagic(),
                        source.session().overstockMagic(), source.session().treasureCount()),
                lineFeed.loot().stream().map(line -> new GeneratedRun.LootLine(
                        line.lineId(), line.treasureId(), line.role(), line.itemId(),
                        line.text().replace("\n", "\r\n"), line.quantity(), line.unitCp(), line.actualCp(),
                        line.totalCapacity().setScale(4), line.allowedContainers(), line.magicRarity(), line.cursed()))
                        .toList(),
                "different optional rendering\r\n");

        assertEquals(
                GenerationContentFingerprint.v1(lineFeed),
                GenerationContentFingerprint.v1(normalized));
    }

    @Test
    void v1PreservesSemanticListOrder() {
        GeneratedRun source = goldenRun();
        List<GeneratedRun.Audit> reversed = new ArrayList<>(source.audits());
        java.util.Collections.reverse(reversed);
        GeneratedRun reordered = new GeneratedRun(
                source.runId(), source.engineVersion(), source.catalogVersion(), source.catalogContentHash(),
                source.seed(), source.party(), source.session(), source.encounterTargets(), source.encounters(),
                source.treasures(), source.loot(), source.packing(), source.rewards(), source.formattedText(), reversed);

        assertNotEquals(
                GenerationContentFingerprint.v1(source),
                GenerationContentFingerprint.v1(reordered));
    }

    private static GeneratedRun goldenRun() {
        return new SessionGenerationEngine().generate(
                new GenerationInput(
                        List.of(new GeneratedRun.PartyLevel(3, 2), new GeneratedRun.PartyLevel(4, 2)),
                        new BigDecimal("0.6"), OptionalInt.of(3), 179974L),
                new TsvGenerationCatalog().load());
    }

    private static GeneratedRun copy(
            GeneratedRun source,
            GeneratedRun.SessionContext session,
            List<GeneratedRun.LootLine> loot,
            String formattedText
    ) {
        return new GeneratedRun(
                source.runId(), source.engineVersion(), source.catalogVersion(), source.catalogContentHash(),
                source.seed(), source.party(), session, source.encounterTargets(), source.encounters(),
                source.treasures(), loot, source.packing(), source.rewards(), formattedText, source.audits());
    }
}
