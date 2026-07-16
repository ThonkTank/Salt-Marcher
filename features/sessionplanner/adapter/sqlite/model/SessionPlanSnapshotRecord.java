package features.sessionplanner.adapter.sqlite.model;

import java.util.List;

public record SessionPlanSnapshotRecord(
        SessionPlanRecord plan,
        List<SessionParticipantRecord> participants,
        List<SessionEncounterRecord> encounters,
        List<SessionRestPlacementRecord> rests,
        List<SessionLootPlaceholderRecord> lootPlaceholders,
        List<SessionGeneratedRewardRecord> generatedRewards
) {

    public SessionPlanSnapshotRecord {
        participants = participants == null ? List.of() : List.copyOf(participants);
        encounters = encounters == null ? List.of() : List.copyOf(encounters);
        rests = rests == null ? List.of() : List.copyOf(rests);
        lootPlaceholders = lootPlaceholders == null ? List.of() : List.copyOf(lootPlaceholders);
        generatedRewards = generatedRewards == null ? List.of() : List.copyOf(generatedRewards);
    }
}
