package clean.world.mapcatalog.input;

public record LoadMapsInput() {

    public sealed interface MapKind permits HexmapKind, DungeonKind {
    }

    public record HexmapKind() implements MapKind {
    }

    public record DungeonKind() implements MapKind {
    }

    public record MapRef(
            MapKind kind,
            long mapId
    ) {
    }

    public record MapSummary(
            MapRef ref,
            String title,
            String summary
    ) {
    }

    public record LoadedMapsInput(
            java.util.List<MapSummary> maps,
            String errorMessage
    ) {
    }
}
