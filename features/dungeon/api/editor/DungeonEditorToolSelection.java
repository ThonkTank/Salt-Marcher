package features.dungeon.api.editor;

/** Active tool family and its currently selected option. */
public record DungeonEditorToolSelection(
        DungeonEditorToolFamily family,
        DungeonEditorToolOptions options
) {
    public DungeonEditorToolSelection {
        family = family == null ? DungeonEditorToolFamily.SELECT : family;
        options = compatibleOptions(family, options);
    }

    public static DungeonEditorToolSelection select() {
        return family(DungeonEditorToolFamily.SELECT);
    }

    public static DungeonEditorToolSelection family(DungeonEditorToolFamily family) {
        DungeonEditorToolFamily safeFamily = family == null ? DungeonEditorToolFamily.SELECT : family;
        return new DungeonEditorToolSelection(safeFamily, defaultOptions(safeFamily));
    }

    private static DungeonEditorToolOptions compatibleOptions(
            DungeonEditorToolFamily family,
            DungeonEditorToolOptions options
    ) {
        if (family == DungeonEditorToolFamily.WALL && options instanceof DungeonEditorToolOptions.Wall
                || family == DungeonEditorToolFamily.STAIR && options instanceof DungeonEditorToolOptions.Stair
                || family == DungeonEditorToolFamily.FEATURE && options instanceof DungeonEditorToolOptions.Feature
                || noOptionsFamily(family) && options instanceof DungeonEditorToolOptions.None) {
            return options;
        }
        return defaultOptions(family);
    }

    private static boolean noOptionsFamily(DungeonEditorToolFamily family) {
        return family != DungeonEditorToolFamily.WALL
                && family != DungeonEditorToolFamily.STAIR
                && family != DungeonEditorToolFamily.FEATURE;
    }

    private static DungeonEditorToolOptions defaultOptions(DungeonEditorToolFamily family) {
        return switch (family) {
            case WALL -> new DungeonEditorToolOptions.Wall(DungeonEditorToolOptions.Wall.Mode.PATH);
            case STAIR -> new DungeonEditorToolOptions.Stair(DungeonEditorToolOptions.Stair.Shape.STRAIGHT);
            case FEATURE -> new DungeonEditorToolOptions.Feature(
                    DungeonEditorToolOptions.Feature.Kind.POINT_OF_INTEREST);
            default -> DungeonEditorToolOptions.none();
        };
    }
}
