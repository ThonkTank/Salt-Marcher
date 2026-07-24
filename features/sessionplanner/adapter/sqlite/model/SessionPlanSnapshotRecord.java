package features.sessionplanner.adapter.sqlite.model;

import java.util.List;

public record SessionPlanSnapshotRecord(
        SessionPlanRecord plan,
        List<SessionParticipantRecord> participants,
        List<SessionEncounterRecord> encounters,
        List<SessionRestPlacementRecord> rests,
        List<SessionManualLootNoteRecord> manualLootNotes,
        List<SessionTreasureRecord> treasures,
        List<SessionTreasureItemRecord> treasureItems,
        List<SessionTreasurePackingRecord> treasurePacking
) {

    public SessionPlanSnapshotRecord {
        participants = participants == null ? List.of() : List.copyOf(participants);
        encounters = encounters == null ? List.of() : List.copyOf(encounters);
        rests = rests == null ? List.of() : List.copyOf(rests);
        manualLootNotes = manualLootNotes == null ? List.of() : List.copyOf(manualLootNotes);
        treasures = treasures == null ? List.of() : List.copyOf(treasures);
        treasureItems = treasureItems == null ? List.of() : List.copyOf(treasureItems);
        treasurePacking = treasurePacking == null ? List.of() : List.copyOf(treasurePacking);
    }
}
