package features.sessionplanner.api;

import java.math.BigDecimal;
import java.util.List;

public record SessionPlannerSceneTimelineProjection(
        List<SessionScene> sessionScenes,
        List<RestGap> restGaps
) {
    public SessionPlannerSceneTimelineProjection {
        sessionScenes = copy(sessionScenes);
        restGaps = copy(restGaps);
    }

    @Override
    public List<SessionScene> sessionScenes() {
        return List.copyOf(sessionScenes);
    }

    @Override
    public List<RestGap> restGaps() {
        return List.copyOf(restGaps);
    }

    public static SessionPlannerSceneTimelineProjection empty() {
        return new SessionPlannerSceneTimelineProjection(List.of(), List.of());
    }

    public record SessionScene(
            long sceneToken,
            long linkedEncounterPlanId,
            boolean linkedEncounterPlan,
            String linkedEncounterName,
            String linkedEncounterGeneratedLabel,
            int linkedEncounterCreatureCount,
            int linkedEncounterTotalBaseXp,
            int linkedEncounterAdjustedXp,
            double linkedEncounterXpMultiplier,
            String linkedEncounterDifficultyLabel,
            BigDecimal budgetPercentage,
            int targetXp,
            boolean selected,
            String sceneTitle,
            String sceneNotes,
            long locationId,
            List<LootEntry> lootEntries
    ) {

        public SessionScene {
            sceneToken = Math.max(0L, sceneToken);
            linkedEncounterPlanId = Math.max(0L, linkedEncounterPlanId);
            linkedEncounterName = linkedEncounterName == null ? "" : linkedEncounterName.trim();
            linkedEncounterGeneratedLabel =
                    linkedEncounterGeneratedLabel == null ? "" : linkedEncounterGeneratedLabel.trim();
            linkedEncounterCreatureCount = Math.max(0, linkedEncounterCreatureCount);
            linkedEncounterTotalBaseXp = Math.max(0, linkedEncounterTotalBaseXp);
            linkedEncounterAdjustedXp = Math.max(0, linkedEncounterAdjustedXp);
            linkedEncounterXpMultiplier = linkedEncounterXpMultiplier <= 0.0 ? 1.0 : linkedEncounterXpMultiplier;
            linkedEncounterDifficultyLabel =
                    linkedEncounterDifficultyLabel == null ? "" : linkedEncounterDifficultyLabel.trim();
            budgetPercentage = budgetPercentage == null ? BigDecimal.ZERO : budgetPercentage;
            targetXp = Math.max(0, targetXp);
            sceneTitle = sceneTitle == null ? "" : sceneTitle.trim();
            sceneNotes = sceneNotes == null ? "" : sceneNotes.trim();
            locationId = Math.max(0L, locationId);
            lootEntries = copy(lootEntries);
        }

        @Override
        public List<LootEntry> lootEntries() {
            return List.copyOf(lootEntries);
        }
    }

    public record RestGap(
            int gapIndex,
            long leftSceneToken,
            long rightSceneToken,
            SessionPlannerRestKind restKind
    ) {

        public RestGap {
            gapIndex = Math.max(0, gapIndex);
            leftSceneToken = Math.max(0L, leftSceneToken);
            rightSceneToken = Math.max(0L, rightSceneToken);
            restKind = restKind == null ? SessionPlannerRestKind.NONE : restKind;
        }
    }

    public record LootEntry(
            Kind kind,
            long token,
            String label
    ) {

        public LootEntry {
            kind = kind == null ? Kind.MANUAL_NOTE : kind;
            token = Math.max(0L, token);
            label = label == null ? "" : label.trim();
        }

        public enum Kind {
            MANUAL_NOTE,
            GENERATED_REWARD
        }
    }

    private static <T> List<T> copy(List<T> values) {
        return values == null ? List.of() : List.copyOf(values);
    }
}
