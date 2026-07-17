package features.worldplanner.api;

public record UpdateWorldNpcCommand(
        long npcId,
        String displayName,
        long creatureStatblockId,
        String appearanceNotes,
        String behaviorNotes,
        String historyNotes,
        String generalNotes
) {
}
