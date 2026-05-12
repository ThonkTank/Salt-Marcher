package src.domain.encounter.model.generation.helper;

import java.util.List;
import src.domain.encounter.model.generation.model.EncounterDifficultyIntent;
import src.domain.encounter.model.generation.model.EncounterDraft;
import src.domain.encounter.model.generation.model.EncounterDraftBuildRequest;
import src.domain.encounter.model.generation.model.EncounterDraftComposition;
import src.domain.encounter.model.generation.model.EncounterDraftCompositionStats;
import src.domain.encounter.model.generation.model.EncounterDraftEntries;
import src.domain.encounter.model.generation.model.EncounterDraftEntry;
import src.domain.encounter.model.generation.model.EncounterDraftMetrics;
import src.domain.encounter.model.generation.model.EncounterDraftTitle;
import src.domain.encounter.model.generation.model.EncounterDraftXpProfile;

final class EncounterDraftCreationHelper {

    private static final int MAX_DEADLY_MULTIPLE = 2;

    private EncounterDraftCreationHelper() {
    }

    static List<EncounterDraft> create(
            EncounterDraftComposition composition,
            EncounterDraftBuildRequest request
    ) {
        if (!composition.valid()) {
            return List.of();
        }
        EncounterDraftXpProfile xpProfile = xpProfile(composition.stats(), request);
        int maxAllowedAdjustedXp = EncounterDifficultyTargetHelper.maxAdjustedXp(
                EncounterDifficultyIntent.DEADLY,
                request.thresholds());
        if (xpProfile.adjustedXp() > maxAllowedAdjustedXp * MAX_DEADLY_MULTIPLE) {
            return List.of();
        }
        EncounterDifficultyIntent achievedDifficulty = EncounterDifficultyTargetHelper.bandFor(
                xpProfile.adjustedXp(),
                request.thresholds());
        int score = EncounterDraftScoringHelper.score(new EncounterDraftScoringHelper.ScoreInput(
                composition,
                new EncounterDraftScoringHelper.ScoreContext(
                        request.targetDifficulty(),
                        achievedDifficulty,
                        request.thresholds(),
                        xpProfile,
                        request.tuning(),
                        request.partySize())));
        List<EncounterDraftEntry> entries = EncounterDraftEntries.sorted(composition.entries());
        return List.of(new EncounterDraft(
                EncounterDraftTitle.from(entries),
                achievedDifficulty,
                metrics(composition.stats(), xpProfile, score),
                entries));
    }

    private static EncounterDraftXpProfile xpProfile(
            EncounterDraftCompositionStats stats,
            EncounterDraftBuildRequest request
    ) {
        double multiplier = EncounterDifficultyTargetHelper.multiplierFor(stats.creatureCount(), request.partySize());
        int adjustedXp = (int) Math.round(stats.totalBaseXp() * multiplier);
        int targetAdjustedXp = EncounterDifficultyTargetHelper.targetAdjustedXp(
                request.targetDifficulty(),
                request.thresholds());
        return new EncounterDraftXpProfile(adjustedXp, targetAdjustedXp, multiplier);
    }

    private static EncounterDraftMetrics metrics(
            EncounterDraftCompositionStats stats,
            EncounterDraftXpProfile xpProfile,
            int score
    ) {
        return new EncounterDraftMetrics(
                stats.creatureCount(),
                stats.totalBaseXp(),
                xpProfile.adjustedXp(),
                xpProfile.multiplier(),
                score,
                xpProfile.targetAdjustedXp());
    }
}
