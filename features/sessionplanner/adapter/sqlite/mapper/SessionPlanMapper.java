package features.sessionplanner.adapter.sqlite.mapper;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import features.sessionplanner.adapter.sqlite.model.SessionEncounterRecord;
import features.sessionplanner.adapter.sqlite.model.SessionLootPlaceholderRecord;
import features.sessionplanner.adapter.sqlite.model.SessionParticipantRecord;
import features.sessionplanner.adapter.sqlite.model.SessionPlanRecord;
import features.sessionplanner.adapter.sqlite.model.SessionPlanSnapshotRecord;
import features.sessionplanner.adapter.sqlite.model.SessionRestPlacementRecord;
import features.sessionplanner.domain.session.EncounterDays;
import features.sessionplanner.domain.session.SessionEncounter;
import features.sessionplanner.domain.session.SessionEncounterAllocation;
import features.sessionplanner.domain.session.SessionLootPlaceholder;
import features.sessionplanner.domain.session.SessionPlan;
import features.sessionplanner.domain.session.SessionRestPlacement;

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
        List<SessionEncounter> encounters = snapshot.encounters().stream()
                .map(record -> new SessionEncounter(
                        record.encounterId(),
                        record.encounterPlanId(),
                        new SessionEncounterAllocation(parseDecimal(record.budgetPercentage())),
                        record.sceneTitle(),
                        record.sceneNotes(),
                        record.locationId()))
                .toList();
        return new SessionPlan(
                plan.sessionId(),
                plan.displayName(),
                snapshot.participants().stream()
                        .map(SessionParticipantRecord::characterId)
                        .toList(),
                new EncounterDays(parseDecimal(plan.encounterDays())),
                encounters,
                snapshot.rests().stream()
                        .map(record -> SessionRestPlacement.fromPersistence(
                                record.leftEncounterId(),
                                record.rightEncounterId(),
                                record.restKind()))
                        .toList(),
                toDomainLoot(snapshot.lootPlaceholders(), encounters),
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
                encounter.sceneTitle(),
                encounter.sceneNotes(),
                encounter.locationId(),
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
                placeholder.encounterId(),
                placeholder.label(),
                index));
    }

    private static List<SessionLootPlaceholder> toDomainLoot(
            List<SessionLootPlaceholderRecord> records,
            List<SessionEncounter> encounters
    ) {
        long fallbackEncounterId = encounters.isEmpty() ? 0L : encounters.getFirst().encounterId();
        return records.stream()
                .map(record -> new SessionLootPlaceholder(
                        record.lootId(),
                        record.encounterId() > 0L ? record.encounterId() : fallbackEncounterId,
                        record.label()))
                .toList();
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
