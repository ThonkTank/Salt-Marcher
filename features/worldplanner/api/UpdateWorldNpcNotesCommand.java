package features.worldplanner.api;

public record UpdateWorldNpcNotesCommand(
        long npcId,
        String appearanceNotes,
        String behaviorNotes,
        String historyNotes,
        String generalNotes
) { }
