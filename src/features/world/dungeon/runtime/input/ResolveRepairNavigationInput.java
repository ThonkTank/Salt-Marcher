package features.world.dungeon.runtime.input;

public record ResolveRepairNavigationInput(
        Long preferredMapId
) {
    public record NavigationInput(
            Long mapId,
            features.world.dungeon.geometry.GridPoint cell,
            int levelZ,
            String heading
    ) {
        public NavigationInput {
            heading = heading == null ? "" : heading.trim();
        }
    }
}
