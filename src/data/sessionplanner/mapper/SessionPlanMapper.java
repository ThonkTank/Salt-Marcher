package src.data.sessionplanner.mapper;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import src.data.sessionplanner.model.SessionEncounterRecord;
import src.data.sessionplanner.model.SessionLootPlaceholderRecord;
import src.data.sessionplanner.model.SessionParticipantRecord;
import src.data.sessionplanner.model.SessionPlanRecord;
import src.data.sessionplanner.model.SessionPlanSnapshotRecord;
import src.data.sessionplanner.model.SessionRestPlacementRecord;
import src.domain.sessionplanner.model.session.EncounterDays;
import src.domain.sessionplanner.model.session.SessionEncounter;
import src.domain.sessionplanner.model.session.SessionEncounterAllocation;
import src.domain.sessionplanner.model.session.SessionLootPlaceholder;
import src.domain.sessionplanner.model.session.SessionPlan;
import src.domain.sessionplanner.model.session.SessionRestPlacement;

public final class SessionPlanMapper {

    private SessionPlanMapper() {
    }

    public static SessionPlanSnapshotRecord toSnapshot(SessionPlan plan) {
        return new SessionPlanSnapshotRecord(
                new SessionPlanRecord(
                        plan.sessionId(),
                        plan.displayName(),
                        plan.encounterDays().displayText(),
                        plan.selectedEncounterId(),
                        plan.statusText(),
                        plan.nextEncounterId(),
                        plan.nextLootId()),
                toParticipantRecords(plan),
                toEncounterRecords(plan),
                toRestRecords(plan),
                toLootRecords(plan));
    }

    public static SessionPlan toDomain(SessionPlanSnapshotRecord snapshot) {
        SessionPlanRecord plan = snapshot.plan();
        return new SessionPlan(
                plan.sessionId(),
                plan.displayName(),
                snapshot.participants().stream()
                        .map(SessionParticipantRecord::characterId)
                        .toList(),
                new EncounterDays(parseDecimal(plan.encounterDays())),
                snapshot.encounters().stream()
                        .map(record -> new SessionEncounter(
                                record.encounterId(),
                                record.encounterPlanId(),
                                new SessionEncounterAllocation(parseDecimal(record.budgetPercentage()))))
                        .toList(),
                snapshot.rests().stream()
                        .map(record -> SessionRestPlacement.fromPersistence(
                                record.leftEncounterId(),
                                record.rightEncounterId(),
                                record.restKind()))
                        .toList(),
                snapshot.lootPlaceholders().stream()
                        .map(record -> new SessionLootPlaceholder(record.lootId(), record.label()))
                        .toList(),
                plan.selectedEncounterId(),
                plan.statusText(),
                plan.nextEncounterId(),
                plan.nextLootId());
    }

    private static List<SessionParticipantRecord> toParticipantRecords(SessionPlan plan) {
        return mapIndexed(plan.participantRefs(), (participant, index) -> new SessionParticipantRecord(
                participant,
                index));
    }

    private static List<SessionEncounterRecord> toEncounterRecords(SessionPlan plan) {
        return mapIndexed(plan.encounters(), (encounter, index) -> new SessionEncounterRecord(
                encounter.encounterId(),
                encounter.encounterPlanId(),
                encounter.allocation().budgetPercentage().toPlainString(),
                index));
    }

    private static List<SessionRestPlacementRecord> toRestRecords(SessionPlan plan) {
        return mapIndexed(plan.restPlacements(), (placement, index) -> new SessionRestPlacementRecord(
                placement.leftEncounterId(),
                placement.rightEncounterId(),
                placement.persistenceKind(),
                index));
    }

    private static List<SessionLootPlaceholderRecord> toLootRecords(SessionPlan plan) {
        return mapIndexed(plan.lootPlaceholders(), (placeholder, index) -> new SessionLootPlaceholderRecord(
                placeholder.lootId(),
                placeholder.label(),
                index));
    }

    private static BigDecimal parseDecimal(String value) {
        try {
            return new BigDecimal(value);
        } catch (NumberFormatException exception) {
            throw new IllegalStateException("Malformed persisted decimal value: " + value, exception);
        }
    }

    private static <T, R> List<R> mapIndexed(List<T> values, IndexedMapper<T, R> mapper) {
        if (values == null || values.isEmpty()) {
            return List.of();
        }
        List<R> mapped = new ArrayList<>(values.size());
        for (int index = 0; index < values.size(); index++) {
            mapped.add(mapper.map(values.get(index), index));
        }
        return List.copyOf(mapped);
    }

    @FunctionalInterface
    private interface IndexedMapper<T, R> {

        R map(T value, int index);
    }
}
