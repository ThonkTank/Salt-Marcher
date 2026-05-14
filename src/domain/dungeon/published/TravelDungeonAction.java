package src.domain.dungeon.published;

public record TravelDungeonAction(
        String actionId,
        String label,
        String description
) {

    public TravelDungeonAction {
        actionId = actionId == null ? "" : actionId.trim();
        label = label == null || label.isBlank() ? "Aktion" : label.trim();
        description = description == null ? "" : description.trim();
    }
}
