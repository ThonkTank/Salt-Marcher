package features.worldplanner.domain.world;

public record WorldNpc(
        long npcId,
        String displayName,
        long creatureStatblockId,
        String appearanceNotes,
        String behaviorNotes,
        String historyNotes,
        String generalNotes,
        WorldNpcLifecycleState status
) {
    public WorldNpc {
        if (!WorldPlannerIds.isPositive(npcId)) {
            throw new IllegalArgumentException("npcId must be positive");
        }
        if (!WorldPlannerIds.isPositive(creatureStatblockId)) {
            throw new IllegalArgumentException("creatureStatblockId must be positive");
        }
        displayName = normalize(displayName, "NPC #" + npcId);
        appearanceNotes = text(appearanceNotes);
        behaviorNotes = text(behaviorNotes);
        historyNotes = text(historyNotes);
        generalNotes = text(generalNotes);
        if (status == null) {
            throw new IllegalArgumentException("status must be present");
        }
    }

    public WorldNpc updateNotes(Notes notes) {
        Notes safeNotes = notes == null ? Notes.empty() : notes;
        return new WorldNpc(
                npcId,
                displayName,
                creatureStatblockId,
                safeNotes.appearanceNotes(),
                safeNotes.behaviorNotes(),
                safeNotes.historyNotes(),
                safeNotes.generalNotes(),
                status);
    }

    public WorldNpc markDefeated() {
        return withStatus(WorldNpcLifecycleState.DEFEATED);
    }

    public WorldNpc reactivate() {
        return withStatus(WorldNpcLifecycleState.ACTIVE);
    }

    private WorldNpc withStatus(WorldNpcLifecycleState nextStatus) {
        return new WorldNpc(
                npcId,
                displayName,
                creatureStatblockId,
                appearanceNotes,
                behaviorNotes,
                historyNotes,
                generalNotes,
                nextStatus);
    }

    static String normalize(String value, String fallback) {
        String normalized = text(value);
        return normalized.isBlank() ? fallback : normalized;
    }

    static String text(String value) {
        return value == null ? "" : value.trim();
    }

    public record Notes(
            String appearanceNotes,
            String behaviorNotes,
            String historyNotes,
            String generalNotes
    ) {

        public Notes {
            appearanceNotes = text(appearanceNotes);
            behaviorNotes = text(behaviorNotes);
            historyNotes = text(historyNotes);
            generalNotes = text(generalNotes);
        }

        static Notes empty() {
            return new Notes("", "", "", "");
        }
    }
}
