package features.party.api;

import java.util.List;
import java.util.Objects;

/** Immutable planning facts derived from one PartyRoster capture. */
public record PartyPlanningFactsResponse(
        ReadStatus status,
        List<PartyMemberSummary> activeMembers,
        List<ResolvedParticipant> participants,
        AdventuringDayPlanningSummary adventuringDay,
        String message
) {

    public PartyPlanningFactsResponse {
        status = Objects.requireNonNull(status, "status");
        activeMembers = activeMembers == null ? List.of() : List.copyOf(activeMembers);
        participants = participants == null ? List.of() : List.copyOf(participants);
        adventuringDay = adventuringDay == null ? AdventuringDayPlanningSummary.empty() : adventuringDay;
        message = message == null ? "" : message.trim();
        if (status != ReadStatus.SUCCESS
                && (!activeMembers.isEmpty() || !participants.isEmpty()
                || !adventuringDay.equals(AdventuringDayPlanningSummary.empty()))) {
            throw new IllegalArgumentException("failed planning read must not expose partial facts");
        }
    }

    public static PartyPlanningFactsResponse failure(String message) {
        return new PartyPlanningFactsResponse(
                ReadStatus.STORAGE_ERROR, List.of(), List.of(), AdventuringDayPlanningSummary.empty(), message);
    }

    public record ResolvedParticipant(long requestedId, PartyMemberSummary member) {
        public ResolvedParticipant {
            if (requestedId <= 0L) {
                throw new IllegalArgumentException("requested participant id must be positive");
            }
        }

        public boolean available() {
            return member != null;
        }
    }
}
