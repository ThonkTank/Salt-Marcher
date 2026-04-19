package src.view.mapshared.api;

import java.util.List;

public record MapWorkspaceSceneViewData(
        String topology,
        List<MapCellViewModel> cells,
        List<MapEdgeViewModel> edges
) {
    private static final String DEFAULT_TOPOLOGY = "SQUARE";

    public MapWorkspaceSceneViewData {
        topology = normalizedTopology(topology);
        cells = immutableList(cells);
        edges = immutableList(edges);
    }

    public static MapWorkspaceSceneViewData empty() {
        return new MapWorkspaceSceneViewData(DEFAULT_TOPOLOGY, List.of(), List.of());
    }

    @Override
    public List<MapCellViewModel> cells() {
        return List.copyOf(cells);
    }

    @Override
    public List<MapEdgeViewModel> edges() {
        return List.copyOf(edges);
    }

    private static String normalizedTopology(String candidate) {
        return candidate == null || candidate.isBlank() ? DEFAULT_TOPOLOGY : candidate;
    }

    private static <T> List<T> immutableList(List<T> values) {
        return values == null ? List.of() : List.copyOf(values);
    }
}
