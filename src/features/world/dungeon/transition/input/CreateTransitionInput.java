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

        public static DestinationInput overworld(long tileId) {
            return new DestinationInput("OVERWORLD_TILE", 0L, null, tileId);
        }

        public static DestinationInput dungeon(long mapId, Long transitionId) {
            return new DestinationInput("DUNGEON_MAP", mapId, transitionId, 0L);
        }

        public boolean isOverworldTile() {
            return "OVERWORLD_TILE".equals(typeKey);
        }

        public boolean isDungeonMap() {
            return "DUNGEON_MAP".equals(typeKey);
        }
    }
}
