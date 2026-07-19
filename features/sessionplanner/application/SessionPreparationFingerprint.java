package features.sessionplanner.application;

import features.sessiongeneration.api.GenerationPreparationIdentity;
import features.sessiongeneration.api.GenerationRequest;
import features.sessionplanner.domain.session.SessionActivePartyMembersFact;
import features.sessionplanner.domain.session.SessionPartyMemberProfile;
import features.sessionplanner.domain.session.SessionPlan;
import features.sessionplanner.domain.session.SessionRevision;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.OptionalInt;
import java.util.TreeMap;

public record SessionPreparationFingerprint(
        String identity,
        long sessionId,
        SessionRevision sourceRevision,
        SessionPlan sourceSession,
        List<Participant> participants,
        BigDecimal adventureDayFraction,
        OptionalInt encounterCount,
        long seed
) {

    private static final String VERSION = "session-preparation-v1";

    public SessionPreparationFingerprint {
        if (identity == null || !identity.matches("v1:[0-9a-f]{64}")) {
            throw new IllegalArgumentException("preparation identity must use canonical v1 SHA-256");
        }
        participants = List.copyOf(participants);
        adventureDayFraction = normalizeDecimal(adventureDayFraction);
    }

    static Optional<SessionPreparationFingerprint> capture(
            SessionPlan session,
            SessionPlannerForeignFacts facts,
            OptionalInt encounterCount,
            long seed
    ) {
        if (session == null || facts == null || encounterCount == null) {
            return Optional.empty();
        }
        SessionActivePartyMembersFact activeParty = facts.activePartyMembers();
        if (!activeParty.available() || session.participantRefs().isEmpty()) {
            return Optional.empty();
        }
        List<Participant> participants = new ArrayList<>();
        for (long participantId : session.participantRefs()) {
            SessionPartyMemberProfile member = activeParty.resolve(participantId);
            if (participantId <= 0L || member == null || member.currentLevel() < 1 || member.currentLevel() > 20) {
                return Optional.empty();
            }
            participants.add(new Participant(participantId, member.currentLevel()));
        }
        participants.sort(Comparator.comparingLong(Participant::stableId));
        if (participants.stream().map(Participant::stableId).distinct().count() != participants.size()) {
            return Optional.empty();
        }
        BigDecimal fraction = normalizeDecimal(session.encounterDays().value());
        String identity = fingerprint(session.sessionId(), session.revision(), participants, fraction, encounterCount, seed);
        return Optional.of(new SessionPreparationFingerprint(
                identity,
                session.sessionId(),
                session.revision(),
                session,
                participants,
                fraction,
                encounterCount,
                seed));
    }

    GenerationRequest toGenerationRequest() {
        Map<Integer, Integer> counts = new TreeMap<>();
        participants.forEach(participant -> counts.merge(participant.level(), 1, Integer::sum));
        return new GenerationRequest(
                new GenerationPreparationIdentity(identity),
                counts.entrySet().stream()
                        .map(entry -> new GenerationRequest.PartyLevel(entry.getKey(), entry.getValue()))
                        .toList(),
                adventureDayFraction,
                encounterCount,
                seed);
    }

    private static String fingerprint(
            long sessionId,
            SessionRevision revision,
            List<Participant> participants,
            BigDecimal fraction,
            OptionalInt encounterCount,
            long seed
    ) {
        CanonicalSha256DigestWriter output = new CanonicalSha256DigestWriter()
                .writeText(VERSION)
                .writeLong(sessionId)
                .writeLong(revision.value())
                .writeInt(participants.size());
        for (Participant participant : participants) {
            output.writeLong(participant.stableId()).writeInt(participant.level());
        }
        output.writeText(normalizeDecimal(fraction).toPlainString())
                .writeBoolean(encounterCount.isPresent());
        if (encounterCount.isPresent()) {
            output.writeInt(encounterCount.getAsInt());
        }
        return output.writeLong(seed).finishV1();
    }

    private static BigDecimal normalizeDecimal(BigDecimal value) {
        BigDecimal normalized = value.stripTrailingZeros();
        return normalized.signum() == 0 ? BigDecimal.ZERO : normalized;
    }

    public record Participant(long stableId, int level) {

        public Participant {
            if (stableId <= 0L || level < 1 || level > 20) {
                throw new IllegalArgumentException("captured participant is invalid");
            }
        }
    }
}
