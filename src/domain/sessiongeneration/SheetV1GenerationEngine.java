package src.domain.sessiongeneration;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.atomic.AtomicLong;
import src.domain.sessiongeneration.GenerationResult.AuditResult;
import src.domain.sessiongeneration.GenerationResult.EncounterPlan;
import src.domain.sessiongeneration.GenerationResult.SessionContext;
import src.domain.sessiongeneration.GenerationResult.TreasureResult;

public final class SheetV1GenerationEngine {

    private final SessionGenerationCatalog catalog;
    private final SheetV1SessionContextCalculator contextCalculator;
    private final SheetV1EncounterGenerator encounterGenerator;
    private final SheetV1LootGenerator lootGenerator;
    private final AtomicLong nextGenerationId = new AtomicLong(1L);

    public SheetV1GenerationEngine(SessionGenerationCatalog catalog) {
        this.catalog = java.util.Objects.requireNonNull(catalog, "catalog");
        contextCalculator = new SheetV1SessionContextCalculator(catalog);
        encounterGenerator = new SheetV1EncounterGenerator(catalog, contextCalculator);
        lootGenerator = new SheetV1LootGenerator(catalog);
    }

    public GenerationResult generate(GenerationRequest request) {
        return generate(request, nextGenerationId.getAndIncrement());
    }

    public GenerationResult generate(GenerationRequest request, long generationId) {
        if (generationId <= 0L) throw new IllegalArgumentException("generationId must be positive");
        nextGenerationId.updateAndGet(current -> Math.max(current, generationId + 1L));
        GenerationRequest safeRequest = java.util.Objects.requireNonNull(request, "request");
        SessionContext context = contextCalculator.calculate(safeRequest);
        List<EncounterPlan> encounters = encounterGenerator.generate(safeRequest, context);
        SheetV1LootGenerator.LootOutput loot = lootGenerator.generate(safeRequest, context, encounters);
        List<AuditResult> audits = audits(context, encounters, loot.treasures(), loot.formattedText());
        return new GenerationResult(
                generationId,
                safeRequest,
                context,
                encounters,
                loot.treasures(),
                loot.summary(),
                loot.formattedText(),
                audits,
                catalog.contentHash());
    }

    private static List<AuditResult> audits(
            SessionContext context,
            List<EncounterPlan> encounters,
            List<TreasureResult> treasures,
            String formattedText
    ) {
        List<AuditResult> audits = new ArrayList<>();
        int targetSum = encounters.stream().mapToInt(EncounterPlan::targetXp).sum();
        audits.add(audit("Encounter target sum", targetSum == context.sessionXpTarget(),
                targetSum + " / " + context.sessionXpTarget()));
        audits.add(audit("Encounter plan count", !encounters.isEmpty(), Integer.toString(encounters.size())));
        audits.add(audit("Treasure count", treasures.size() == context.treasureCount(),
                treasures.size() + " / " + context.treasureCount()));
        long questCount = treasures.stream().filter(value -> "quest".equals(value.rewardChannel())).count();
        audits.add(audit("Quest cap", questCount <= 1, Long.toString(questCount)));
        Set<Integer> anchors = new HashSet<>();
        boolean uniqueAnchors = treasures.stream().filter(value -> value.anchorEncounterNumber() != null)
                .allMatch(value -> anchors.add(value.anchorEncounterNumber()));
        audits.add(audit("Unique encounter anchors", uniqueAnchors, Integer.toString(anchors.size())));
        int magicCount = treasures.stream().flatMap(value -> value.loot().stream())
                .mapToInt(value -> "magic".equals(value.role()) ? 1 : 0).sum();
        int expectedMagic = context.rarityTargets().stream()
                .mapToInt(value -> value.normalCount() + value.overstockCount()).sum();
        audits.add(audit("Magic count", magicCount == expectedMagic, magicCount + " / " + expectedMagic));
        boolean noEmpty = treasures.stream().flatMap(value -> value.loot().stream())
                .noneMatch(value -> value.item() == null || value.item().isBlank()
                        || "[unresolved]".equals(value.item()) || value.text().contains("[unresolved]"));
        audits.add(audit("No empty loot draws", noEmpty, noEmpty ? "OK" : "unresolved item"));
        audits.add(audit("Final output", formattedText != null && !formattedText.isBlank(), "non-empty"));
        return List.copyOf(audits);
    }

    private static AuditResult audit(String name, boolean passed, String detail) {
        return new AuditResult(name, passed, detail);
    }
}
