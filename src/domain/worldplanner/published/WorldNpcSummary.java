package src.domain.worldplanner.published;

public record WorldNpcSummary(
        long npcId,
        String displayName,
        long creatureStatblockId,
        String appearanceNotes,
        String behaviorNotes,
        String historyNotes,
        String generalNotes,
        WorldNpcLifecycleStatus status
) { }
