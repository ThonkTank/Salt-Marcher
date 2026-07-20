package features.encounter.domain.session;

public record DifficultySummaryData(
        int easy,
        int medium,
        int hard,
        int deadly,
        int adjustedXp,
        String difficulty
) {
    public DifficultySummaryData {
        difficulty = difficulty == null ? "" : difficulty;
    }

    public static DifficultySummaryData empty() {
        return new DifficultySummaryData(0, 0, 0, 0, 0, "");
    }
}
