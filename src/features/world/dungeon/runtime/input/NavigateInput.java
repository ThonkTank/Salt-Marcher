package features.world.dungeon.runtime.input;

public record NavigateInput(
        long mapId,
        NavigationInput currentNavigation,
        ActionInput action
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

    public record ActionInput(
            String kind,
            features.world.dungeon.geometry.GridPoint cell,
            int levelZ,
            String headingOverride,
            Long doorId,
            Long transitionId
    ) {
        public ActionInput {
            kind = kind == null ? "" : kind.trim();
            headingOverride = headingOverride == null ? "" : headingOverride.trim();
        }
    }
}
