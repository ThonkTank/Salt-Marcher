package features.worldplanner.api;

public record WorldNpcSummary(
        long npcId,
        String displayName,
        long creatureStatblockId,
        String appearanceNotes,
        String behaviorNotes,
        String historyNotes,
        String generalNotes,
        long factionId,
        int dispositionModifier,
        int effectiveDisposition,
        WorldDispositionKind disposition,
        WorldNpcLifecycleStatus status
) {
    public WorldNpcSummary(
            long npcId,
            String displayName,
            long creatureStatblockId,
            String appearanceNotes,
            String behaviorNotes,
            String historyNotes,
            String generalNotes,
            WorldNpcLifecycleStatus status
    ) {
        this(npcId, displayName, creatureStatblockId, appearanceNotes, behaviorNotes,
                historyNotes, generalNotes, 0L, 0, 0, WorldDispositionKind.NEUTRAL, status);
    }

    public WorldNpcSummary {
        disposition = disposition == null ? WorldDispositionKind.NEUTRAL : disposition;
    }
}
