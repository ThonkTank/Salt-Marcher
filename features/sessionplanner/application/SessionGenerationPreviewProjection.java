package features.sessionplanner.application;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import features.sessiongeneration.api.GenerationResult;
import features.sessionplanner.api.SessionGenerationPreviewSnapshot;
import features.sessionplanner.api.SessionGenerationPreviewStatus;

final class SessionGenerationPreviewProjection {

    private SessionGenerationPreviewProjection() {
    }

    static SessionGenerationPreviewSnapshot toSnapshot(
            GenerationResult result,
            SessionGenerationPreviewStatus status,
            String message,
            long sessionId,
            long attemptToken,
            boolean applyEnabled
    ) {
        Map<Integer, List<String>> lootByTreasure = new LinkedHashMap<>();
        result.lootItems().forEach(item -> lootByTreasure
                .computeIfAbsent(item.treasureId(), ignored -> new ArrayList<>())
                .add(item.text()));
        return new SessionGenerationPreviewSnapshot(
                status,
                message,
                sessionId,
                result.runId().value(),
                result.seed(),
                result.catalogContentHash(),
                new SessionGenerationPreviewSnapshot.Summary(
                        result.session().partyCount(),
                        result.session().encounterCount(),
                        result.session().sessionXpTarget(),
                        result.session().normalBudgetCp(),
                        result.session().overstockBudgetCp(),
                        result.session().treasureCount()),
                result.encounters().stream().map(encounter -> new SessionGenerationPreviewSnapshot.EncounterCard(
                        encounter.encounterNumber(),
                        encounter.targetXp(),
                        encounter.difficulty().name(),
                        roleSummary(encounter.blocks()),
                        encounter.monsterSummary())).toList(),
                result.treasures().stream().map(treasure -> new SessionGenerationPreviewSnapshot.TreasureCard(
                        treasure.treasureId(),
                        treasure.channel().name(),
                        treasure.stockClass().name(),
                        treasure.targetCp(),
                        treasure.theme(),
                        lootByTreasure.getOrDefault(treasure.treasureId(), List.of()))).toList(),
                result.audits().stream().map(audit -> new SessionGenerationPreviewSnapshot.AuditLine(
                        audit.code(), audit.status().name(), audit.detail())).toList(),
                attemptToken,
                applyEnabled);
    }

    static SessionGenerationPreviewSnapshot emptyStatus(
            SessionGenerationPreviewStatus status,
            String message,
            long sessionId,
            long seed
    ) {
        return new SessionGenerationPreviewSnapshot(
                status,
                message,
                sessionId,
                "",
                seed,
                "",
                SessionGenerationPreviewSnapshot.Summary.empty(),
                List.of(),
                List.of(),
                List.of(),
                0L,
                false);
    }

    static SessionGenerationPreviewSnapshot withStatus(
            SessionGenerationPreviewSnapshot current,
            SessionGenerationPreviewStatus status,
            String message,
            long fallbackSessionId,
            long fallbackSeed
    ) {
        boolean hasStablePreview = !current.generationId().isBlank();
        return new SessionGenerationPreviewSnapshot(
                status,
                message,
                hasStablePreview ? current.sessionId() : fallbackSessionId,
                current.generationId(),
                hasStablePreview ? current.seed() : fallbackSeed,
                current.catalogHash(),
                current.summary(),
                current.encounters(),
                current.treasures(),
                current.audits(),
                current.attemptToken(),
                false);
    }

    static Map<Long, String> rewardLabels(GenerationResult result) {
        Map<Long, String> labels = new LinkedHashMap<>();
        result.treasures().forEach(treasure -> labels.put(
                (long) treasure.treasureId(),
                rewardLabel(treasure, result.lootItems())));
        return labels;
    }

    static String rewardLabel(
            GenerationResult.Treasure treasure,
            List<GenerationResult.LootItem> loot
    ) {
        String items = loot.stream()
                .filter(item -> item.treasureId() == treasure.treasureId())
                .map(GenerationResult.LootItem::text)
                .filter(text -> text != null && !text.isBlank())
                .reduce((left, right) -> left + " · " + right)
                .orElse("Generierte Belohnung");
        return treasure.channel().name() + " · " + items;
    }

    static boolean noHardFailure(GenerationResult result) {
        return result.audits().stream()
                .noneMatch(audit -> audit.status() == GenerationResult.AuditStatus.FAIL);
    }

    private static String roleSummary(List<GenerationResult.EncounterBlock> blocks) {
        return blocks.stream()
                .map(block -> block.requestedRole().name() + " × " + block.count())
                .reduce((left, right) -> left + " · " + right)
                .orElse("");
    }
}
