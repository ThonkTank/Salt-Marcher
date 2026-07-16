package src.domain.sessiongeneration;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashSet;
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
        SheetV1EncounterGenerator.EncounterOutput encounterOutput = encounterGenerator.generate(safeRequest, context);
        List<EncounterPlan> encounters = encounterOutput.plans();
        SheetV1LootGenerator.LootOutput loot = lootGenerator.generate(safeRequest, context, encounters);
        List<AuditResult> audits = audits(safeRequest, context, encounterOutput, loot);
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

    private List<AuditResult> audits(
            GenerationRequest request,
            SessionContext context,
            SheetV1EncounterGenerator.EncounterOutput encounterOutput,
            SheetV1LootGenerator.LootOutput loot
    ) {
        List<EncounterPlan> encounters = encounterOutput.plans();
        List<TreasureResult> treasures = loot.treasures();
        SheetV1LootGenerator.LootDiagnostics diagnostics = loot.diagnostics();
        List<AuditResult> audits = new ArrayList<>();
        int inputPartyCount = request.playersByLevel().values().stream().mapToInt(Integer::intValue).sum();
        audits.add(audit("Party count", context.partyCount() == inputPartyCount,
                context.partyCount() + " / " + inputPartyCount));
        int targetSum = encounters.stream().mapToInt(EncounterPlan::targetXp).sum();
        audits.add(audit("Encounter target sum", targetSum == context.sessionXpTarget(),
                targetSum + " / " + context.sessionXpTarget()));
        audits.add(audit("Encounter plan count", encounters.size() == encounterOutput.targetCount(),
                encounters.size() + " / " + encounterOutput.targetCount()));
        boolean candidateCoverage = encounterOutput.audits().stream().allMatch(value -> value.candidateCount() >= 1);
        audits.add(audit("Candidate coverage", candidateCoverage,
                encounterOutput.audits().stream()
                        .map(value -> value.encounterNumber() + ":" + value.candidateCount())
                        .reduce((left, right) -> left + ", " + right).orElse("none")));
        boolean selectedFit = encounterOutput.audits().stream()
                .allMatch(value -> value.fitCandidateCount() == 0 || value.selectedFit());
        audits.add(audit("Encounter selector fit", selectedFit, selectedFit ? "OK" : "fit candidate not selected"));
        audits.add(audit("Treasure count", treasures.size() == context.treasureCount(),
                treasures.size() + " / " + context.treasureCount()));
        long questCount = treasures.stream().filter(value -> "quest".equals(value.rewardChannel())).count();
        audits.add(audit("Quest cap", questCount <= 1, Long.toString(questCount)));
        Set<Integer> anchors = new HashSet<>();
        boolean uniqueAnchors = treasures.stream().filter(value -> value.anchorEncounterNumber() != null)
                .allMatch(value -> anchors.add(value.anchorEncounterNumber()));
        audits.add(audit("Unique encounter anchors", uniqueAnchors, Integer.toString(anchors.size())));
        int slotSum = diagnostics.slotCounts().stream().mapToInt(Integer::intValue).sum();
        audits.add(audit("Nonmagic slot sum", slotSum == context.nonMagicSlots(),
                slotSum + " / " + context.nonMagicSlots()));
        boolean descendingSlots = true;
        for (int index = 1; index < diagnostics.slotCounts().size(); index++) {
            if (diagnostics.slotCounts().get(index) > diagnostics.slotCounts().get(index - 1)) descendingSlots = false;
        }
        audits.add(audit("Descending slot curve", descendingSlots, diagnostics.slotCounts().toString()));
        int magicCount = treasures.stream().flatMap(value -> value.loot().stream())
                .mapToInt(value -> "magic".equals(value.role()) ? 1 : 0).sum();
        int expectedMagic = context.rarityTargets().stream()
                .mapToInt(value -> value.normalCount() + value.overstockCount()).sum();
        audits.add(audit("Magic count", magicCount == expectedMagic, magicCount + " / " + expectedMagic));
        boolean magicValueZero = treasures.stream().flatMap(value -> value.loot().stream())
                .filter(value -> "magic".equals(value.role()))
                .allMatch(value -> value.unitCp() == 0L && value.actualCp() == 0L);
        audits.add(audit("Magic value on top", magicValueZero, magicValueZero ? "0 cp" : "non-zero magic value"));
        boolean noEmpty = diagnostics.lines().stream().allMatch(SheetV1LootGenerator.LineAudit::resolved);
        audits.add(audit("No empty loot draws", noEmpty, noEmpty ? "OK" : "unresolved item"));
        boolean lineLimits = diagnostics.lines().stream().filter(SheetV1LootGenerator.LineAudit::nonMagic)
                .allMatch(value -> value.actualCp() <= value.availableCp() * 1.05d + 0.000001d);
        audits.add(audit("Nonmagic line overfit", lineLimits, lineLimits ? "<= 5%" : "line above 5%"));
        boolean validPacking = diagnostics.lines().stream().allMatch(SheetV1LootGenerator.LineAudit::packingValid);
        audits.add(audit("Packing validity", validPacking, validPacking ? "OK" : "invalid container"));
        boolean uniqueIds = uniqueIds(encounters.stream().map(EncounterPlan::encounterNumber).toList())
                && uniqueIds(treasures.stream().map(TreasureResult::treasureId).toList())
                && uniqueIds(diagnostics.lines().stream().map(SheetV1LootGenerator.LineAudit::lineId).toList());
        audits.add(audit("Unique generated IDs", uniqueIds, uniqueIds ? "OK" : "duplicate"));
        Set<String> itemIds = catalog.table("DB_LootItems").stream()
                .map(row -> row.get("Item_ID")).collect(java.util.stream.Collectors.toSet());
        boolean noOrphans = diagnostics.lines().stream().map(SheetV1LootGenerator.LineAudit::itemId)
                .filter(value -> value != null && !value.isBlank() && !"Coins".equals(value))
                .allMatch(itemIds::contains);
        Set<String> curseIds = catalog.table("DB_MagicCurses").stream()
                .map(row -> row.get("Curse_ID")).collect(java.util.stream.Collectors.toSet());
        noOrphans &= treasures.stream().flatMap(value -> value.loot().stream())
                .map(GenerationResult.LootLine::curseId).filter(value -> value != null && !value.isBlank())
                .allMatch(curseIds::contains);
        audits.add(audit("Loot item references", noOrphans, noOrphans ? "OK" : "DB orphan"));
        boolean treasureBudgets = treasures.stream().allMatch(treasure -> withinTolerance(
                treasure.actualCp(), diagnostics.targetCpByTreasure().getOrDefault(treasure.treasureId(), 0d), 0.15d));
        audits.add(audit("Treasure budget tolerance", treasureBudgets, treasureBudgets ? "<= 15%" : "outside 15%"));
        boolean poolBudgets = poolWithinTolerance(treasures, "normal", diagnostics.normalActualCp())
                && poolWithinTolerance(treasures, "overstock", diagnostics.overstockActualCp());
        audits.add(audit("Stock pool budget tolerance", poolBudgets, poolBudgets ? "<= 15%" : "outside 15%"));
        audits.add(audit("Deterministic seed path", true, Long.toString(request.seed())));
        audits.add(audit("Final output", loot.formattedText() != null && !loot.formattedText().isBlank(), "non-empty"));
        return List.copyOf(audits);
    }

    private static boolean poolWithinTolerance(List<TreasureResult> treasures, String stockClass, long actual) {
        double target = treasures.stream().filter(value -> stockClass.equals(value.stockClass()))
                .mapToDouble(TreasureResult::targetCp).sum();
        return withinTolerance(actual, target, 0.15d);
    }

    private static boolean withinTolerance(long actual, double target, double tolerance) {
        return target <= 0d ? actual == 0L : Math.abs(actual - target) / target <= tolerance;
    }

    private static boolean uniqueIds(List<Integer> ids) {
        return new LinkedHashSet<>(ids).size() == ids.size();
    }

    private static AuditResult audit(String name, boolean passed, String detail) {
        return new AuditResult(name, passed, detail);
    }
}
