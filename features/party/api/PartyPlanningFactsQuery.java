package features.party.api;

import java.util.LinkedHashSet;
import java.util.List;

/** One coherent Party-owner read for downstream planning. */
public record PartyPlanningFactsQuery(List<Long> participantIds, int plannedGroupXp) {

    public PartyPlanningFactsQuery {
        participantIds = participantIds == null ? List.of() : List.copyOf(participantIds);
        if (participantIds.stream().anyMatch(id -> id == null || id.longValue() <= 0L)
                || new LinkedHashSet<>(participantIds).size() != participantIds.size()) {
            throw new IllegalArgumentException("participant ids must be positive and unique");
        }
        plannedGroupXp = Math.max(0, plannedGroupXp);
    }
}
