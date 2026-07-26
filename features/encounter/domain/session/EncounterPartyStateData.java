package features.encounter.domain.session;

import java.util.List;
import java.util.Optional;

/** One Encounter-local translation of one revisioned Party facts capture. */
public record EncounterPartyStateData(
        long sourceRevision,
        List<PartyMemberData> members,
        Optional<BudgetData> budget
) {
    public EncounterPartyStateData {
        sourceRevision = Math.max(0L, sourceRevision);
        members = members == null ? List.of() : List.copyOf(members);
        budget = budget == null ? Optional.empty() : budget;
    }

    @Override
    public List<PartyMemberData> members() {
        return List.copyOf(members);
    }
}
