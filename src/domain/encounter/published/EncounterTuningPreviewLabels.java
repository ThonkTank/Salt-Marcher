package src.domain.encounter.published;

import java.util.List;

public record EncounterTuningPreviewLabels(
        List<PreviewLabel> difficultyLabels,
        List<PreviewLabel> balanceLabels,
        List<PreviewLabel> amountLabels,
        List<PreviewLabel> diversityLabels
) {

    public EncounterTuningPreviewLabels {
        difficultyLabels = copyOf(difficultyLabels);
        balanceLabels = copyOf(balanceLabels);
        amountLabels = copyOf(amountLabels);
        diversityLabels = copyOf(diversityLabels);
    }

    private static List<PreviewLabel> copyOf(List<PreviewLabel> labels) {
        return labels == null ? List.of() : List.copyOf(labels);
    }

    public record PreviewLabel(double value, String label) {
        public PreviewLabel {
            label = label == null ? "" : label;
        }
    }
}
