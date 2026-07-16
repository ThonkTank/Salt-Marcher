package features.encounter.domain.session;

public record GenerationDiagnosticsData(String difficultyLabel, String tuningLabel) {
    public GenerationDiagnosticsData {
        difficultyLabel = difficultyLabel == null ? "" : difficultyLabel;
        tuningLabel = tuningLabel == null ? "" : tuningLabel;
    }
}
