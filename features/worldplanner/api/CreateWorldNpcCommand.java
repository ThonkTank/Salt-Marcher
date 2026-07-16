package features.worldplanner.api;

public record CreateWorldNpcCommand(
        String displayName,
        long creatureStatblockId,
        String appearanceNotes,
        String behaviorNotes,
        String historyNotes,
        String generalNotes
) { }
