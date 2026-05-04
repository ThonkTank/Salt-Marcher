package src.view.statetabs.encounter;

public record EncounterBuilderStateViewInputEvent(
        boolean generateRequested,
        int alternativeShift,
        boolean saveRequested,
        long openedPlanId,
        long creatureId,
        int rosterDelta,
        boolean creatureRemovalRequested,
        long undoToken,
        boolean clearHistoryRequested,
        boolean openCreatureDetailsRequested,
        boolean startInitiativeRequested
) {

    public EncounterBuilderStateViewInputEvent {
        openedPlanId = Math.max(0L, openedPlanId);
        creatureId = Math.max(0L, creatureId);
        undoToken = Math.max(0L, undoToken);
    }
}
