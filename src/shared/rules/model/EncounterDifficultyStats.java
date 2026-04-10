package shared.rules.model;

@SuppressWarnings("unused")
public record EncounterDifficultyStats(
        int adjXp,
        String difficulty,
        int easyTh,
        int mediumTh,
        int hardTh,
        int deadlyTh) {
}
