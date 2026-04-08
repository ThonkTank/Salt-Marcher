package features.world.dungeon.runtime.input;

public record ResolveNavigationInput(
        Long preferredMapId,
        features.world.dungeon.geometry.GridPoint preferredCell,
        int preferredLevelZ,
        String preferredHeading
) {
    public ResolveNavigationInput {
        preferredHeading = preferredHeading == null ? "" : preferredHeading.trim();
    }

    public record NavigationInput(
            Long mapId,
            features.world.dungeon.geometry.GridPoint cell,
            int levelZ,
            String heading
    ) {
        public NavigationInput {
            heading = heading == null ? "" : heading.trim();
        }

        public static NavigationInput empty() {
            return new NavigationInput(null, null, 0, "");
        }

        public static NavigationInput navigation(
                Long mapId,
                features.world.dungeon.geometry.GridPoint cell,
                int levelZ,
                String heading
        ) {
            return new NavigationInput(mapId, cell, levelZ, heading);
        }
    }
}
