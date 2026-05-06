package src.domain.encounter.session.value;

import static src.domain.encounter.session.value.EncounterSessionValues.*;

import java.util.List;

public record EncounterSessionSnapshotData(
        int mode,
        String status,
        BuilderStateData builderState,
        List<InitiativeEntryData> initiativeEntries,
        CombatProjectionData combatProjection,
        List<PartyMemberData> missingCombatPartyMembers,
        ResultStateData resultState
) {
    public EncounterSessionSnapshotData {
        status = status == null ? "" : status;
        builderState = builderState == null
                ? new BuilderStateData(List.of(), List.of(), "", null, null, List.of(), List.of(), false, false, false, false, false, null)
                : builderState;
        initiativeEntries = initiativeEntries == null ? List.of() : List.copyOf(initiativeEntries);
        combatProjection = combatProjection == null ? CombatProjectionData.empty() : combatProjection;
        missingCombatPartyMembers = missingCombatPartyMembers == null ? List.of() : List.copyOf(missingCombatPartyMembers);
        resultState = resultState == null ? ResultStateData.empty() : resultState;
    }
}
