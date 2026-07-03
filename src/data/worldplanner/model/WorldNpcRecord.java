package src.data.worldplanner.model;

public record WorldNpcRecord(
        long npcId,
        String displayName,
        long creatureStatblockId,
        String appearanceNotes,
        String behaviorNotes,
        String historyNotes,
        String generalNotes,
        String status
) { }
