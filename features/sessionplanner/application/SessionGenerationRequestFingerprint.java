package features.sessionplanner.application;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.OptionalInt;
import java.util.TreeMap;
import features.sessiongeneration.api.GenerationRequest;
import features.sessionplanner.domain.session.SessionActivePartyMembersFact;
import features.sessionplanner.domain.session.SessionPartyMemberProfile;
import features.sessionplanner.domain.session.SessionPlan;

record SessionGenerationRequestFingerprint(
        long sessionId,
        SessionPlan sessionSnapshot,
        List<Participant> participants,
        BigDecimal encounterDays,
        OptionalInt encounterCount,
        long seed
) {

    SessionGenerationRequestFingerprint {
        participants = List.copyOf(participants);
        encounterDays = encounterDays.stripTrailingZeros();
    }

    static Optional<SessionGenerationRequestFingerprint> from(
            SessionPlan session,
            SessionPlannerForeignFacts facts,
            OptionalInt encounterCount,
            long seed
    ) {
        SessionActivePartyMembersFact activeParty = facts.activePartyMembers();
        if (!activeParty.available() || session.participantRefs().isEmpty()) {
            return Optional.empty();
        }
        List<Participant> participants = new ArrayList<>();
        for (long participantId : session.participantRefs()) {
            SessionPartyMemberProfile member = activeParty.resolve(participantId);
            if (member == null || member.currentLevel() < 1 || member.currentLevel() > 20) {
                return Optional.empty();
            }
            participants.add(new Participant(participantId, member.currentLevel()));
        }
        participants.sort(Comparator.comparingLong(Participant::id));
        return Optional.of(new SessionGenerationRequestFingerprint(
                session.sessionId(),
                session,
                participants,
                session.encounterDays().value(),
                encounterCount,
                seed));
    }

    GenerationRequest toRequest() {
        Map<Integer, Integer> counts = new TreeMap<>();
        participants.forEach(participant -> counts.merge(participant.level(), 1, Integer::sum));
        List<GenerationRequest.PartyLevel> party = counts.entrySet().stream()
                .map(entry -> new GenerationRequest.PartyLevel(entry.getKey(), entry.getValue()))
                .toList();
        return new GenerationRequest(party, encounterDays, encounterCount, seed);
    }

    record Participant(long id, int level) {
    }
}
