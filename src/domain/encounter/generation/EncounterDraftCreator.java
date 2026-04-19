package src.domain.encounter.generation;

import src.domain.encounter.api.EncounterDifficultyBand;

import java.util.List;
import java.util.Optional;

final class EncounterDraftCreator {

    private static final int MAX_DEADLY_MULTIPLE = 2;

    private EncounterDraftCreator() {
    }

    static Optional<EncounterDraft> create(
            EncounterDraftComposition composition,
            EncounterDraftBuildRequest request
    ) {
        if (!composition.valid()) {
            return Optional.empty();
        }
        EncounterDraftXpProfile xpProfile = xpProfile(composition.stats(), request);
        if (exceedsDeadlyLimit(xpProfile.adjustedXp(), request.thresholds())) {
            return Optional.empty();
        }
        EncounterDifficultyBand achievedDifficulty = EncounterDifficultyTargets.bandFor(
                xpProfile.adjustedXp(),
                request.thresholds());
        int score = EncounterDraftScorer.score(new EncounterDraftScorer.ScoreInput(
                composition,
                new EncounterDraftScorer.ScoreContext(
                        request.targetDifficulty(),
                        achievedDifficulty,
                        request.thresholds(),
                        xpProfile)));
        List<EncounterDraftEntry> entries = EncounterDraftEntries.sorted(composition.entries());
        return Optional.of(new EncounterDraft(
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

    private static boolean exceedsDeadlyLimit(
            int adjustedXp,
            EncounterDifficultyMath.Thresholds thresholds
    ) {
        int maxAllowedAdjustedXp = EncounterDifficultyTargets.maxAdjustedXp(EncounterDifficultyBand.DEADLY, thresholds);
        return adjustedXp > maxAllowedAdjustedXp * MAX_DEADLY_MULTIPLE;
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
