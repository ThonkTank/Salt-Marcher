package clean.featuretabs.mapcatalog.input;

@SuppressWarnings("unused")
public record LoadMapsInput() {

    public record MapInput(
            String mapKey,
            String mapKind,
            String title,
            String summary
    ) {
    }

    public record LoadedMapsInput(
            java.util.List<MapInput> maps
    ) {
    }
}
