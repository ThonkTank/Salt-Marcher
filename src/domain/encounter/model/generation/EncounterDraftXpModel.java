package src.domain.encounter.model.generation;

final class EncounterDraftXpModel {

    private EncounterDraftXpModel() {
    }

    static EncounterDraftXpProfile xpProfile(
            EncounterDraftCompositionStats stats,
            EncounterDraftBuildRequest request
    ) {
        double multiplier = EncounterDifficultyBandModel.multiplierFor(stats.creatureCount(), request.partySize());
        int adjustedXp = (int) Math.round(stats.totalBaseXp() * multiplier);
        int targetAdjustedXp =
                EncounterDifficultyBandModel.of(request.targetDifficulty(), request.thresholds()).targetAdjustedXp();
        return new EncounterDraftXpProfile(adjustedXp, targetAdjustedXp, multiplier);
    }

    static EncounterDraftMetrics metrics(
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
