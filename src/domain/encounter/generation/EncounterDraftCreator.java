package src.domain.encounter.generation;

import src.domain.encounter.api.EncounterDifficultyBand;

import java.util.List;

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
                EncounterDifficultyBand.DEADLY,
                request.thresholds());
        if (xpProfile.adjustedXp() > maxAllowedAdjustedXp * MAX_DEADLY_MULTIPLE) {
            return List.of();
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
