package features.world.dungeon.transition.input;

public record CreateTransitionInput(
        long mapId,
        String description,
        DestinationInput destination,
        boolean bidirectional,
        long doorId,
        int levelZ
) {
    public CreateTransitionInput {
        description = description == null ? "" : description.trim();
    }

    public record DestinationInput(
            String typeKey,
            long mapId,
            Long transitionId,
            long tileId
    ) {
        public DestinationInput {
            typeKey = typeKey == null ? "" : typeKey.trim();
        }
    }
}
