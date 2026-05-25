package src.domain.sessionplanner;

import java.util.ArrayList;
import java.util.List;
import src.domain.sessionplanner.model.session.model.SessionActivePartyMembersFact;
import src.domain.sessionplanner.model.session.model.SessionPartyMemberProfile;
import src.domain.sessionplanner.model.session.model.SessionPlan;
import src.domain.sessionplanner.model.session.port.SessionPartyFactsPort;
import src.domain.sessionplanner.published.SessionPlannerParticipantsProjection;

final class SessionPlannerParticipantsProjectionServiceAssembly {

    private SessionPlannerParticipantsProjectionServiceAssembly() {
    }

    static SessionPlannerParticipantsProjection projectParticipants(
            SessionPlan session,
            SessionPartyFactsPort partyFacts
    ) {
        SessionPlannerProjectionContextServiceAssembly.ProjectionContext context =
                SessionPlannerProjectionContextServiceAssembly.buildParticipantContext(session, partyFacts);
        return new SessionPlannerParticipantsProjection(
                buildPartyState(session, context.resolvedLevels(), context.participants(), context.partyMembersFact()),
                buildActivePartyMembers(context.partyMembersFact().members()),
                context.participants());
    }

    static List<SessionPlannerParticipantsProjection.SessionParticipant> buildParticipants(
            SessionPlan session,
            SessionActivePartyMembersFact activeMembers
    ) {
        List<SessionPlannerParticipantsProjection.SessionParticipant> participants = new ArrayList<>();
        for (Long participantRef : session.participantRefs()) {
            SessionPartyMemberProfile member = activeMembers.resolve(participantRef);
            if (member == null) {
                participants.add(new SessionPlannerParticipantsProjection.SessionParticipant(
                        participantRef,
                        "Charakter #" + participantRef,
                        0,
                        false,
                        "Nicht mehr in der aktiven Party verfuegbar."));
            } else {
                participants.add(new SessionPlannerParticipantsProjection.SessionParticipant(
                        member.characterId(),
                        member.displayName(),
                        member.currentLevel(),
                        true,
                        ""));
            }
        }
        return List.copyOf(participants);
    }

    private static SessionPlannerParticipantsProjection.PartyState buildPartyState(
            SessionPlan session,
            List<Integer> resolvedLevels,
            List<SessionPlannerParticipantsProjection.SessionParticipant> participants,
            SessionActivePartyMembersFact partyMembersFact
    ) {
        int sessionSize = session.participantRefs().size();
        int averageLevel = resolvedLevels.isEmpty()
                ? 0
                : (int) Math.round(resolvedLevels.stream().mapToInt(Integer::intValue).average().orElse(0.0));
        String headline = sessionSize <= 0
                ? "Keine Session-Teilnehmer"
                : sessionSize + " Session-Teilnehmer";
        return new SessionPlannerParticipantsProjection.PartyState(
                resolvedLevels,
                sessionSize,
                averageLevel,
                sessionSize > 0
                        && participants.stream()
                        .allMatch(SessionPlannerParticipantsProjection.SessionParticipant::available),
                headline,
                partyStateDetail(sessionSize, averageLevel, resolvedLevels, participants, partyMembersFact));
    }

    private static String partyStateDetail(
            int sessionSize,
            int averageLevel,
            List<Integer> resolvedLevels,
            List<SessionPlannerParticipantsProjection.SessionParticipant> participants,
            SessionActivePartyMembersFact partyMembersFact
    ) {
        if (sessionSize <= 0) {
            return "Session hat noch keine Teilnehmer.";
        }
        if (!partyMembersFact.available()) {
            return partyMembersFact.statusText().isBlank()
                    ? "Aktive Party ist derzeit nicht lesbar."
                    : partyMembersFact.statusText();
        }
        long missing = participants.stream().filter(participant -> !participant.available()).count();
        if (missing > 0) {
            return resolvedLevels.size() + " aufgeloest · " + missing + " fehlend";
        }
        return "Durchschnittsstufe " + averageLevel + " · Level " + joinLevels(resolvedLevels);
    }

    private static List<SessionPlannerParticipantsProjection.ActivePartyMember> buildActivePartyMembers(
            List<SessionPartyMemberProfile> members
    ) {
        List<SessionPlannerParticipantsProjection.ActivePartyMember> activePartyMembers = new ArrayList<>();
        for (SessionPartyMemberProfile member
                : members == null ? List.<SessionPartyMemberProfile>of() : members) {
            activePartyMembers.add(new SessionPlannerParticipantsProjection.ActivePartyMember(
                    member.characterId(),
                    member.displayName(),
                    member.currentLevel()));
        }
        return List.copyOf(activePartyMembers);
    }

    private static String joinLevels(List<Integer> levels) {
        return levels.stream()
                .map(String::valueOf)
                .reduce((left, right) -> left + ", " + right)
                .orElse("-");
    }
}
