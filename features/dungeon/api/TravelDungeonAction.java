package features.dungeon.api;

public record TravelDungeonAction(
        DungeonTravelActionId actionId,
        String label,
        String description
) {

    public TravelDungeonAction {
        actionId = java.util.Objects.requireNonNull(actionId, "actionId");
        label = label == null || label.isBlank() ? "Aktion" : label.trim();
        description = description == null ? "" : description.trim();
    }
}
