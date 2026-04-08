package features.world.dungeon.transition.input;

public record CreateStairTransitionInput(
        long mapId,
        String description,
        CreateTransitionInput.DestinationInput destination,
        boolean bidirectional,
        PlacePreparedStairTransitionInput.DraftInput draft
) {
    public CreateStairTransitionInput {
        description = description == null ? "" : description.trim();
    }
}
