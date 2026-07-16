package features.encounter.domain.session;

import java.util.List;

public record EncounterTuningPreviewData(
        Outcome outcome,
        List<PreviewPoint> difficultyLabels,
        List<PreviewPoint> balanceLabels,
        List<PreviewPoint> amountLabels,
        List<PreviewPoint> diversityLabels,
        String message
) {

    public enum Outcome {
        AVAILABLE,
        PARTY_MISSING,
        FAILED
    }

    public EncounterTuningPreviewData {
        outcome = outcome == null ? Outcome.FAILED : outcome;
        difficultyLabels = difficultyLabels == null ? List.of() : List.copyOf(difficultyLabels);
        balanceLabels = balanceLabels == null ? List.of() : List.copyOf(balanceLabels);
        amountLabels = amountLabels == null ? List.of() : List.copyOf(amountLabels);
        diversityLabels = diversityLabels == null ? List.of() : List.copyOf(diversityLabels);
        message = message == null ? "" : message;
    }

    public static EncounterTuningPreviewData available(
            List<PreviewPoint> difficultyLabels,
            List<PreviewPoint> balanceLabels,
            List<PreviewPoint> amountLabels,
            List<PreviewPoint> diversityLabels,
            String message
    ) {
        return new EncounterTuningPreviewData(
                Outcome.AVAILABLE,
                difficultyLabels,
                balanceLabels,
                amountLabels,
                diversityLabels,
                message);
    }

    public static EncounterTuningPreviewData noActiveParty(
            List<PreviewPoint> difficultyLabels,
            List<PreviewPoint> balanceLabels,
            List<PreviewPoint> amountLabels,
            List<PreviewPoint> diversityLabels,
            String message
    ) {
        return new EncounterTuningPreviewData(
                Outcome.PARTY_MISSING,
                difficultyLabels,
                balanceLabels,
                amountLabels,
                diversityLabels,
                message);
    }

    public static EncounterTuningPreviewData storageError(String message) {
        return new EncounterTuningPreviewData(Outcome.FAILED, List.of(), List.of(), List.of(), List.of(), message);
    }

    public static EncounterTuningPreviewData storageError(
            List<PreviewPoint> difficultyLabels,
            List<PreviewPoint> balanceLabels,
            List<PreviewPoint> amountLabels,
            List<PreviewPoint> diversityLabels,
            String message
    ) {
        return new EncounterTuningPreviewData(
                Outcome.FAILED,
                difficultyLabels,
                balanceLabels,
                amountLabels,
                diversityLabels,
                message);
    }

    public boolean available() {
        return outcome == Outcome.AVAILABLE;
    }

    public boolean activePartyMissing() {
        return outcome == Outcome.PARTY_MISSING;
    }

    public static final class PreviewPoint {

        private final double value;
        private final String label;

        public PreviewPoint(double value, String label) {
            this.value = value;
            this.label = label == null ? "" : label;
        }

        public double value() {
            return value;
        }

        public String label() {
            return label;
        }
    }
}
