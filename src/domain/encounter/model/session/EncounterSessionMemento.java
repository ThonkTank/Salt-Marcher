package src.domain.encounter.model.session;

import java.util.List;
import java.util.Optional;
import src.domain.encounter.model.generation.EncounterGenerationInputs;

/** Complete owned runtime state for one encounter context. */
public record EncounterSessionMemento(
        int formatVersion,
        int mode,
        String status,
        EncounterGenerationInputs builderInputs,
        List<EncounterCreatureData> roster,
        Optional<RemovedRosterEntryData> pendingUndo,
        long nextUndoToken,
        List<GeneratedEncounterData> generatedAlternatives,
        List<String> generatedAdvisories,
        int selectedAlternativeIndex,
        int generatedAdjustedXp,
        String generatedDifficulty,
        String generatedTitle,
        boolean generationHistoryPresent,
        long activeSavedPlanId,
        List<InitiativeEntryData> initiativeEntries,
        List<Combatant> combatants,
        int currentTurnIndex,
        int round,
        ResultStateData resultState
) {
    public static final int CURRENT_FORMAT_VERSION = 1;

    public EncounterSessionMemento {
        if (formatVersion != CURRENT_FORMAT_VERSION) {
            throw new IllegalArgumentException("Unsupported encounter runtime format");
        }
        status = status == null ? "" : status;
        builderInputs = builderInputs == null ? EncounterGenerationInputs.empty() : builderInputs;
        roster = copy(roster);
        pendingUndo = pendingUndo == null ? Optional.empty() : pendingUndo;
        generatedAlternatives = copy(generatedAlternatives);
        generatedAdvisories = copy(generatedAdvisories);
        generatedDifficulty = generatedDifficulty == null ? "" : generatedDifficulty;
        generatedTitle = generatedTitle == null ? "" : generatedTitle;
        initiativeEntries = copy(initiativeEntries);
        combatants = copy(combatants);
        resultState = resultState == null ? ResultStateData.empty() : resultState;
    }

    private static <T> List<T> copy(List<T> values) {
        return values == null ? List.of() : List.copyOf(values);
    }

    record BuilderSlice(
            EncounterGenerationInputs builderInputs,
            List<EncounterCreatureData> roster,
            Optional<RemovedRosterEntryData> pendingUndo,
            long nextUndoToken,
            List<GeneratedEncounterData> generatedAlternatives,
            List<String> generatedAdvisories,
            int selectedAlternativeIndex,
            int generatedAdjustedXp,
            String generatedDifficulty,
            String generatedTitle,
            boolean generationHistoryPresent,
            long activeSavedPlanId
    ) {
        BuilderSlice {
            roster = copy(roster);
            pendingUndo = pendingUndo == null ? Optional.empty() : pendingUndo;
            generatedAlternatives = copy(generatedAlternatives);
            generatedAdvisories = copy(generatedAdvisories);
        }
    }
}
