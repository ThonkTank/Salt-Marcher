package src.data.worldplanner.model;

public record WorldNpcRecord(
        long npcId,
        String displayName,
        long creatureStatblockId,
        String appearanceNotes,
        String behaviorNotes,
        String historyNotes,
        String generalNotes,
        int dispositionModifier,
        String status
) {
    public WorldNpcRecord(
            long npcId,
            String displayName,
            long creatureStatblockId,
            String appearanceNotes,
            String behaviorNotes,
            String historyNotes,
            String generalNotes,
            String status
    ) {
        this(npcId, displayName, creatureStatblockId, appearanceNotes, behaviorNotes,
                historyNotes, generalNotes, 0, status);
    }
}
