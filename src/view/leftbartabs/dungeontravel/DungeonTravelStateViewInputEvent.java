package src.view.leftbartabs.dungeontravel;

public record DungeonTravelStateViewInputEvent(
        String actionId
) {

    public DungeonTravelStateViewInputEvent {
        actionId = actionId == null ? "" : actionId.trim();
    }
}
