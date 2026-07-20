package features.encounter.api;

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

    @Override
    public List<PreviewLabel> difficultyLabels() {
        return copyOf(difficultyLabels);
    }

    @Override
    public List<PreviewLabel> balanceLabels() {
        return copyOf(balanceLabels);
    }

    @Override
    public List<PreviewLabel> amountLabels() {
        return copyOf(amountLabels);
    }

    @Override
    public List<PreviewLabel> diversityLabels() {
        return copyOf(diversityLabels);
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
