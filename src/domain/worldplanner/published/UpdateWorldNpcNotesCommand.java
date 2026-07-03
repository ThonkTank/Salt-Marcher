package src.domain.worldplanner.published;

public record UpdateWorldNpcNotesCommand(
        long npcId,
        String appearanceNotes,
        String behaviorNotes,
        String historyNotes,
        String generalNotes
) { }
