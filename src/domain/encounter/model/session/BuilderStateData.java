package src.domain.encounter.model.session;

import java.util.List;
import java.util.Optional;
import src.domain.encounter.model.generation.EncounterGenerationInputs;
import src.domain.encounter.model.plan.EncounterPlanSummary;

public record BuilderStateData(
        List<PartyMemberData> party,
        List<EncounterCreatureData> roster,
        String templateLabel,
        DifficultySummaryData difficulty,
        EncounterGenerationInputs builderInputs,
        List<String> generationAdvisoryMessages,
        List<EncounterPlanSummary> savedPlans,
        boolean canStartCombat,
        boolean canPreviousAlternative,
        boolean canNextAlternative,
        boolean canSavePlan,
        boolean canClearGenerationHistory,
        Optional<RemovedRosterEntryData> pendingUndo
) {
    public BuilderStateData {
        party = party == null ? List.of() : List.copyOf(party);
        roster = roster == null ? List.of() : List.copyOf(roster);
        templateLabel = templateLabel == null ? "" : templateLabel;
        difficulty = difficulty == null ? DifficultySummaryData.empty() : difficulty;
        builderInputs = builderInputs == null ? EncounterGenerationInputs.empty() : builderInputs;
        generationAdvisoryMessages = generationAdvisoryMessages == null ? List.of() : List.copyOf(generationAdvisoryMessages);
        savedPlans = savedPlans == null ? List.of() : List.copyOf(savedPlans);
        pendingUndo = pendingUndo == null ? Optional.empty() : pendingUndo;
    }

    public static BuilderStateData empty() {
        return new BuilderStateData(
                List.of(),
                List.of(),
                "",
                DifficultySummaryData.empty(),
                EncounterGenerationInputs.empty(),
                List.of(),
                List.of(),
                false,
                false,
                false,
                false,
                false,
                Optional.empty());
    }
}
