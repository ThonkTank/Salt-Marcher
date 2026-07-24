package features.sessionplanner.adapter.sqlite.mapper;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import features.sessionplanner.adapter.sqlite.model.SessionEncounterRecord;
import features.sessionplanner.adapter.sqlite.model.SessionTreasureRecord;
import features.sessionplanner.adapter.sqlite.model.SessionTreasureItemRecord;
import features.sessionplanner.adapter.sqlite.model.SessionTreasurePackingRecord;
import features.sessionplanner.adapter.sqlite.model.SessionManualLootNoteRecord;
import features.sessionplanner.adapter.sqlite.model.SessionParticipantRecord;
import features.sessionplanner.adapter.sqlite.model.SessionPlanRecord;
import features.sessionplanner.adapter.sqlite.model.SessionPlanSnapshotRecord;
import features.sessionplanner.adapter.sqlite.model.SessionRestPlacementRecord;
import features.sessionplanner.domain.session.EncounterDays;
import features.sessionplanner.domain.session.SessionEncounter;
import features.sessionplanner.domain.session.SessionEncounterAllocation;
import features.sessionplanner.domain.session.SessionTreasure;
import features.sessionplanner.domain.session.SessionManualLootNote;
import features.sessionplanner.domain.session.SessionPlan;
import features.sessionplanner.domain.session.SessionRevision;
import features.sessionplanner.domain.session.SessionRestPlacement;

public final class SessionPlanMapper {

    private SessionPlanMapper() {
    }

    public static SessionPlanSnapshotRecord toSnapshot(SessionPlan plan) {
        return new SessionPlanSnapshotRecord(
                new SessionPlanRecord(
                        plan.sessionId(),
                        plan.revision().value(),
                        plan.displayName(),
                        plan.encounterDays().displayText(),
                        plan.selectedEncounterId(),
                        plan.statusText(),
                        plan.nextEncounterId(),
                        plan.nextLootId()),
                toParticipantRecords(plan),
                toEncounterRecords(plan),
                toRestRecords(plan),
                toManualLootNoteRecords(plan),
                toTreasureRecords(plan),
                toTreasureItemRecords(plan),
                toTreasurePackingRecords(plan));
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
                new SessionRevision(plan.revision()),
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
                toDomainManualLootNotes(snapshot.manualLootNotes()),
                toDomainTreasures(snapshot.treasures(), snapshot.treasureItems(), snapshot.treasurePacking()),
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

    private static List<SessionManualLootNoteRecord> toManualLootNoteRecords(SessionPlan plan) {
        return mapIndexed(plan.manualLootNotes(), (note, index) -> new SessionManualLootNoteRecord(
                note.noteId(),
                note.sceneId(),
                note.authoredText(),
                index));
    }

    private static List<SessionTreasureRecord> toTreasureRecords(SessionPlan plan) {
        return mapIndexed(plan.treasures(), (treasure, index) -> new SessionTreasureRecord(
                treasure.treasureId(), treasure.sceneId(), treasure.title(), treasure.note(),
                treasure.stockClass(), treasure.channel(), treasure.theme(), treasure.magicType(),
                treasure.targetCp(), treasure.nonMagicSlots(), treasure.magicSlots(), index));
    }

    private static List<SessionTreasureItemRecord> toTreasureItemRecords(SessionPlan plan) {
        List<SessionTreasureItemRecord> records = new ArrayList<>();
        for (SessionTreasure treasure : plan.treasures()) {
            for (int index = 0; index < treasure.items().size(); index++) {
                SessionTreasure.Item item = treasure.items().get(index);
                records.add(new SessionTreasureItemRecord(
                        treasure.treasureId(), item.lineId(), item.role(), item.itemId(), item.text(), item.quantity(),
                        item.unitCp(), item.actualCp(), item.totalCapacity().toPlainString(), item.allowedContainers(),
                        item.magicRarity(), item.cursed(), index));
            }
        }
        return List.copyOf(records);
    }

    private static List<SessionTreasurePackingRecord> toTreasurePackingRecords(SessionPlan plan) {
        List<SessionTreasurePackingRecord> records = new ArrayList<>();
        for (SessionTreasure treasure : plan.treasures()) {
            for (int index = 0; index < treasure.packing().size(); index++) {
                SessionTreasure.Packing row = treasure.packing().get(index);
                records.add(new SessionTreasurePackingRecord(
                        treasure.treasureId(), row.lineId(), row.containerType(), row.containerCount(),
                        row.containerId(), row.valid(), index));
            }
        }
        return List.copyOf(records);
    }

    private static List<SessionTreasure> toDomainTreasures(
            List<SessionTreasureRecord> treasures,
            List<SessionTreasureItemRecord> items,
            List<SessionTreasurePackingRecord> packing
    ) {
        return treasures.stream().map(treasure -> {
            List<SessionTreasureItemRecord> lines = items.stream()
                    .filter(item -> item.treasureId() == treasure.treasureId()).toList();
            return new SessionTreasure(
                    treasure.treasureId(), treasure.sceneId(), treasure.title(), treasure.note(),
                    treasure.stockClass(), treasure.channel(), treasure.theme(), treasure.magicType(),
                    treasure.targetCp(), treasure.nonMagicSlots(), treasure.magicSlots(),
                    lines.stream().map(item -> new SessionTreasure.Item(
                            item.lineId(), item.role(), item.itemId(), item.text(), item.quantity(), item.unitCp(),
                            item.actualCp(), parseDecimal(item.totalCapacity()), item.allowedContainers(),
                            item.magicRarity(), item.cursed())).toList(),
                    packing.stream().filter(row -> row.treasureId() == treasure.treasureId())
                            .map(row -> new SessionTreasure.Packing(
                                    row.lineId(), row.containerType(), row.containerCount(), row.containerId(),
                                    row.valid())).toList());
        }).toList();
    }

    private static List<SessionManualLootNote> toDomainManualLootNotes(
            List<SessionManualLootNoteRecord> records
    ) {
        return records.stream()
                .map(record -> new SessionManualLootNote(
                        record.noteId(),
                        record.sceneId(),
                        record.noteText()))
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
