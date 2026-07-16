package features.dungeon.api;

public record TravelDungeonAction(
        String label,
        String description
) {

    public TravelDungeonAction {
        label = label == null || label.isBlank() ? "Aktion" : label.trim();
        description = description == null ? "" : description.trim();
    }
}
