package src.view.leftbartabs.dungeontravel;

public record DungeonTravelStatePublishedEvent(
        String actionId
) {

    public DungeonTravelStatePublishedEvent {
        actionId = actionId == null ? "" : actionId.trim();
    }
}
