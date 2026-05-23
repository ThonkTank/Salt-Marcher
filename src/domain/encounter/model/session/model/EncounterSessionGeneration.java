package src.domain.encounter.model.session.model;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import src.domain.encounter.model.generation.model.EncounterGenerationInputs;
import src.domain.encounter.model.generation.model.EncounterGenerationRequest;

final class EncounterSessionGeneration {

    private static final String NO_PARTY_STATUS = "Die aktive Party hat keine Mitglieder.";
    private static final String GENERATION_FAILURE_STATUS = "Encounter konnte nicht generiert werden.";
    private static final String HISTORY_CLEARED_STATUS = "Generator-Historie geleert.";

    private final List<GeneratedEncounterData> generatedAlternatives = new ArrayList<>();
    private EncounterGenerationInputs builderInputs = EncounterGenerationInputs.empty();
    private List<String> generatedAdvisories = List.of();
    private int selectedAlternativeIndex;
    private int generatedAdjustedXp;
    private String generatedDifficulty = "";
    private String generatedTitle = "";
    private boolean generationHistoryPresent;

    void updateBuilderInputs(EncounterGenerationInputs nextInputs) {
        builderInputs = nextInputs == null ? EncounterGenerationInputs.empty() : nextInputs;
    }

    void generate(
            EncounterSession.SessionRepository access,
            Optional<EncounterGenerationRequest> request,
            EncounterSessionContext context,
            EncounterSessionRosterMutation roster
    ) {
        context.refresh(access, true);
        if (!context.hasActiveParty()) {
            context.setStatus(NO_PARTY_STATUS);
            return;
        }
        EncounterGenerationRequest generation = request.isPresent()
                ? request.orElseThrow()
                : EncounterSessionGenerationRequest.create(builderInputs);
        GenerationResultData result = access.generate(generation);
        if (!result.success() || result.alternatives().isEmpty()) {
            clearGeneratedEncounterState();
            generatedAdvisories = List.of();
            context.setStatus(result.message().isBlank() ? GENERATION_FAILURE_STATUS : result.message());
            return;
        }
        generatedAlternatives.clear();
        generatedAlternatives.addAll(result.alternatives());
        generationHistoryPresent = true;
        selectedAlternativeIndex = 0;
        applyGeneratedEncounter(generatedAlternatives.getFirst(), roster);
        context.setStatus(EncounterSessionGenerationMessages.successText(result));
    }

    void clearGenerationHistory(EncounterSessionContext context) {
        if (!generationHistoryPresent && generatedAlternatives.isEmpty()) {
            return;
        }
        clearGeneratedEncounterState();
        context.setStatus(HISTORY_CLEARED_STATUS);
    }

    void shiftGeneratedAlternative(int delta, EncounterSessionRosterMutation roster) {
        if (generatedAlternatives.isEmpty()) {
            return;
        }
        selectedAlternativeIndex = Math.floorMod(selectedAlternativeIndex + delta, generatedAlternatives.size());
        applyGeneratedEncounter(generatedAlternatives.get(selectedAlternativeIndex), roster);
    }

    void clearGeneratedSelection() {
        generatedAlternatives.clear();
        generationHistoryPresent = false;
        selectedAlternativeIndex = 0;
        generatedAdjustedXp = 0;
        generatedDifficulty = "";
        generatedTitle = "";
        generatedAdvisories = List.of();
    }

    void openSavedPlan(String title) {
        generatedAlternatives.clear();
        generationHistoryPresent = false;
        generatedAdjustedXp = 0;
        generatedDifficulty = "";
        generatedTitle = title;
        generatedAdvisories = List.of();
        selectedAlternativeIndex = 0;
    }

    EncounterGenerationInputs builderInputs() {
        return builderInputs;
    }

    EncounterSessionGenerationState state() {
        return new EncounterSessionGenerationState(
                builderInputs,
                generatedAdvisories,
                generatedAdjustedXp,
                generatedDifficulty,
                generatedTitle,
                selectedAlternativeIndex,
                generatedAlternatives.size(),
                generationHistoryPresent);
    }

    private void clearGeneratedEncounterState() {
        generatedAlternatives.clear();
        selectedAlternativeIndex = 0;
        generationHistoryPresent = false;
        generatedAdjustedXp = 0;
        generatedDifficulty = "";
        generatedTitle = "";
    }

    private void applyGeneratedEncounter(GeneratedEncounterData generated, EncounterSessionRosterMutation roster) {
        roster.replaceWithGenerated(generated.roster());
        generatedAdjustedXp = generated.adjustedXp();
        generatedDifficulty = generated.difficultyLabel();
        generatedTitle = generated.title();
        generatedAdvisories = generated.advisoryMessages();
    }

}
