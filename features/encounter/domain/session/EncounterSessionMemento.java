package features.encounter.domain.session;

import java.util.List;
import java.util.Optional;
import features.encounter.domain.generation.EncounterGenerationInputs;

/** Complete stable runtime state for one context; persistence maps every collection relationally. */
public record EncounterSessionMemento(
        int mode,
        String status,
        EncounterGenerationInputs builderInputs,
        List<GeneratedEncounterData> generatedAlternatives,
        List<String> generatedAdvisories,
        int selectedAlternativeIndex,
        int generatedAdjustedXp,
        String generatedDifficulty,
        String generatedTitle,
        boolean generationHistoryPresent,
        boolean dirty,
        List<EncounterCreatureData> roster,
        Optional<RemovedRosterEntryData> pendingUndo,
        long nextUndoToken,
        long activeSavedPlanId,
        List<InitiativeEntryData> initiativeEntries,
        List<Combatant> combatants,
        int currentTurnIndex,
        int round,
        ResultStateData resultState
) {

    public EncounterSessionMemento {
        status = status == null ? "" : status;
        builderInputs = builderInputs == null ? EncounterGenerationInputs.empty() : builderInputs;
        generatedAlternatives = generatedAlternatives == null ? List.of() : List.copyOf(generatedAlternatives);
        generatedAdvisories = generatedAdvisories == null ? List.of() : List.copyOf(generatedAdvisories);
        selectedAlternativeIndex = generatedAlternatives.isEmpty()
                ? 0
                : Math.max(0, Math.min(selectedAlternativeIndex, generatedAlternatives.size() - 1));
        generatedAdjustedXp = Math.max(0, generatedAdjustedXp);
        generatedDifficulty = generatedDifficulty == null ? "" : generatedDifficulty;
        generatedTitle = generatedTitle == null ? "" : generatedTitle;
        roster = roster == null ? List.of() : List.copyOf(roster);
        pendingUndo = pendingUndo == null ? Optional.empty() : pendingUndo;
        nextUndoToken = Math.max(0L, nextUndoToken);
        activeSavedPlanId = Math.max(0L, activeSavedPlanId);
        initiativeEntries = initiativeEntries == null ? List.of() : List.copyOf(initiativeEntries);
        combatants = combatants == null ? List.of() : List.copyOf(combatants);
        currentTurnIndex = Math.max(-1, currentTurnIndex);
        round = Math.max(1, round);
        resultState = resultState == null ? ResultStateData.empty() : resultState;
    }
}
