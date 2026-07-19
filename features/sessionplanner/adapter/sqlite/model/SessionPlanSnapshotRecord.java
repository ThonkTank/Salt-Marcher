package features.sessionplanner.adapter.sqlite.model;

import java.util.List;

public record SessionPlanSnapshotRecord(
        SessionPlanRecord plan,
        List<SessionParticipantRecord> participants,
        List<SessionEncounterRecord> encounters,
        List<SessionRestPlacementRecord> rests,
        List<SessionManualLootNoteRecord> manualLootNotes,
        List<SessionGeneratedRewardRecord> generatedRewards
) {

    public SessionPlanSnapshotRecord {
        participants = participants == null ? List.of() : List.copyOf(participants);
        encounters = encounters == null ? List.of() : List.copyOf(encounters);
        rests = rests == null ? List.of() : List.copyOf(rests);
        manualLootNotes = manualLootNotes == null ? List.of() : List.copyOf(manualLootNotes);
        generatedRewards = generatedRewards == null ? List.of() : List.copyOf(generatedRewards);
    }
}
