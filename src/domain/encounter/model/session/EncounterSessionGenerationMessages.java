package src.domain.encounter.model.session;


final class EncounterSessionGenerationMessages {

    private EncounterSessionGenerationMessages() {
    }

    static String successText(GenerationResultData result) {
        StringBuilder text = new StringBuilder(result.alternatives().size() + " Encounter-Optionen generiert.");
        if (result.diagnostics().isPresent()) {
            GenerationDiagnosticsData diagnostics = result.diagnostics().orElseThrow();
            text.append(" Ziel: ")
                    .append(diagnostics.difficultyLabel())
                    .append(", Tuning: ")
                    .append(diagnostics.tuningLabel())
                    .append('.');
        }
        if (result.fallbackUsed()) {
            text.append(" Fallback verwendet.");
        }
        return text.toString();
    }
}
