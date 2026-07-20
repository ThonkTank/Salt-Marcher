package features.dungeon.adapter.javafx.travel;

import features.dungeon.api.DungeonTravelActionId;

public record DungeonTravelStateViewInputEvent(
        DungeonTravelActionId actionId
) {

    public DungeonTravelStateViewInputEvent {
        actionId = java.util.Objects.requireNonNull(actionId, "actionId");
    }
}
