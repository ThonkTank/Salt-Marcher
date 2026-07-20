package features.sessionplanner.api;

import java.math.BigDecimal;
import java.util.List;

/** Collection-free master rows plus rest separators. */
public record SessionPlannerSceneTimelineProjection(
        List<SceneHeader> sceneHeaders,
        List<RestGap> restGaps
) {
    public SessionPlannerSceneTimelineProjection {
        sceneHeaders = copy(sceneHeaders);
        restGaps = copy(restGaps);
    }

    public static SessionPlannerSceneTimelineProjection empty() {
        return new SessionPlannerSceneTimelineProjection(List.of(), List.of());
    }

    public record SceneHeader(
            long sceneToken,
            String displayTitle,
            long linkedEncounterPlanId,
            boolean linkedEncounterPlan,
            String linkedEncounterName,
            String linkedEncounterGeneratedLabel,
            int linkedEncounterCreatureCount,
            int linkedEncounterAdjustedXp,
            String linkedEncounterDifficultyLabel,
            String linkedEncounterStatus,
            BigDecimal budgetPercentage,
            int targetXp,
            boolean selected,
            String locationLabel,
            boolean canMoveUp,
            boolean canMoveDown
    ) {
        public SceneHeader {
            sceneToken = Math.max(0L, sceneToken);
            displayTitle = text(displayTitle);
            linkedEncounterPlanId = Math.max(0L, linkedEncounterPlanId);
            linkedEncounterName = text(linkedEncounterName);
            linkedEncounterGeneratedLabel = text(linkedEncounterGeneratedLabel);
            linkedEncounterCreatureCount = Math.max(0, linkedEncounterCreatureCount);
            linkedEncounterAdjustedXp = Math.max(0, linkedEncounterAdjustedXp);
            linkedEncounterDifficultyLabel = text(linkedEncounterDifficultyLabel);
            linkedEncounterStatus = text(linkedEncounterStatus);
            budgetPercentage = budgetPercentage == null ? BigDecimal.ZERO : budgetPercentage;
            targetXp = Math.max(0, targetXp);
            locationLabel = text(locationLabel);
        }
    }

    public record RestGap(int gapIndex, long leftSceneToken, long rightSceneToken, SessionPlannerRestKind restKind) {
        public RestGap {
            gapIndex = Math.max(0, gapIndex);
            leftSceneToken = Math.max(0L, leftSceneToken);
            rightSceneToken = Math.max(0L, rightSceneToken);
            restKind = restKind == null ? SessionPlannerRestKind.NONE : restKind;
        }
    }

    private static String text(String value) {
        return value == null ? "" : value.trim();
    }

    private static <T> List<T> copy(List<T> values) {
        return values == null ? List.of() : List.copyOf(values);
    }
}
