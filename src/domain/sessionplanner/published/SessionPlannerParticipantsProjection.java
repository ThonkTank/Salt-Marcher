package src.domain.sessionplanner.published;

import java.util.List;

public record SessionPlannerParticipantsProjection(
        PartyState party,
        List<ActivePartyMember> activePartyMembers,
        List<SessionParticipant> participants
) {

    public SessionPlannerParticipantsProjection {
        party = party == null ? PartyState.empty() : party;
        activePartyMembers = copy(activePartyMembers);
        participants = copy(participants);
    }

    @Override
    public List<ActivePartyMember> activePartyMembers() {
        return List.copyOf(activePartyMembers);
    }

    @Override
    public List<SessionParticipant> participants() {
        return List.copyOf(participants);
    }

    public static SessionPlannerParticipantsProjection empty() {
        return new SessionPlannerParticipantsProjection(PartyState.empty(), List.of(), List.of());
    }

    public record PartyState(
            List<Integer> activePartyLevels,
            int activePartySize,
            int averageLevel,
            boolean ready,
            String headline,
            String detail
    ) {

        public PartyState {
            activePartyLevels = copy(activePartyLevels);
            activePartySize = Math.max(0, activePartySize);
            averageLevel = Math.max(0, averageLevel);
            headline = headline == null ? "" : headline;
            detail = detail == null ? "" : detail;
        }

        public static PartyState empty() {
            return new PartyState(List.of(), 0, 0, false, "Keine Session-Teilnehmer", "Session hat noch keine Teilnehmer.");
        }

        @Override
        public List<Integer> activePartyLevels() {
            return List.copyOf(activePartyLevels);
        }
    }

    public record ActivePartyMember(
            long characterId,
            String name,
            int level
    ) {

        public ActivePartyMember {
            characterId = Math.max(0L, characterId);
            name = name == null ? "" : name.trim();
            level = Math.max(0, level);
        }
    }

    public record SessionParticipant(
            long characterId,
            String name,
            int level,
            boolean available,
            String statusText
    ) {

        public SessionParticipant {
            characterId = Math.max(0L, characterId);
            name = name == null ? "" : name.trim();
            level = Math.max(0, level);
            statusText = statusText == null ? "" : statusText.trim();
        }
    }

    private static <T> List<T> copy(List<T> values) {
        return values == null ? List.of() : List.copyOf(values);
    }
}
