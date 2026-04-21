package src.domain.encounter.generation.factory;

import java.util.List;
import src.domain.encounter.generation.policy.EncounterDifficultyTargets;
import src.domain.encounter.generation.policy.EncounterDraftScorer;
import src.domain.encounter.generation.value.EncounterDifficultyIntent;
import src.domain.encounter.generation.value.EncounterDraft;
import src.domain.encounter.generation.value.EncounterDraftBuildRequest;
import src.domain.encounter.generation.value.EncounterDraftComposition;
import src.domain.encounter.generation.value.EncounterDraftCompositionStats;
import src.domain.encounter.generation.value.EncounterDraftEntries;
import src.domain.encounter.generation.value.EncounterDraftEntry;
import src.domain.encounter.generation.value.EncounterDraftMetrics;
import src.domain.encounter.generation.value.EncounterDraftTitle;
import src.domain.encounter.generation.value.EncounterDraftXpProfile;

final class EncounterDraftCreator {

    private static final int MAX_DEADLY_MULTIPLE = 2;

    private EncounterDraftCreator() {
    }

    static List<EncounterDraft> create(
            EncounterDraftComposition composition,
            EncounterDraftBuildRequest request
    ) {
        if (!composition.valid()) {
            return List.of();
        }
        EncounterDraftXpProfile xpProfile = xpProfile(composition.stats(), request);
        int maxAllowedAdjustedXp = EncounterDifficultyTargets.maxAdjustedXp(
                EncounterDifficultyIntent.DEADLY,
                request.thresholds());
        if (xpProfile.adjustedXp() > maxAllowedAdjustedXp * MAX_DEADLY_MULTIPLE) {
            return List.of();
        }
        EncounterDifficultyIntent achievedDifficulty = EncounterDifficultyTargets.bandFor(
                xpProfile.adjustedXp(),
                request.thresholds());
        int score = EncounterDraftScorer.score(new EncounterDraftScorer.ScoreInput(
                composition,
                new EncounterDraftScorer.ScoreContext(
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
        double multiplier = EncounterDifficultyTargets.multiplierFor(stats.creatureCount(), request.partySize());
        int adjustedXp = (int) Math.round(stats.totalBaseXp() * multiplier);
        int targetAdjustedXp = EncounterDifficultyTargets.targetAdjustedXp(
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
