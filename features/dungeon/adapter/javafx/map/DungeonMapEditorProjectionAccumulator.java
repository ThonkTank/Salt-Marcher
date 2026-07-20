package features.dungeon.adapter.javafx.map;

import java.util.ArrayList;
import java.util.List;
import features.dungeon.api.DungeonEditorMapSnapshot;
import features.dungeon.api.DungeonEditorPreview;
import features.dungeon.api.DungeonEditorStateSnapshot;
import features.dungeon.api.DungeonEditorSurface;

final class DungeonMapEditorProjectionAccumulator {
    private final DungeonMapRoomLabelPlanner roomLabelPlanner;
    private final DungeonMapPreviewDiffProjector previewDiffProjector;
    private final List<DungeonMapRenderState.Cell> cells = new ArrayList<>();
    private final List<DungeonMapRenderState.Edge> edges = new ArrayList<>();
    private final List<DungeonMapRenderState.Label> labels = new ArrayList<>();
    private final List<DungeonMapRenderState.Marker> markers = new ArrayList<>();
    private final List<DungeonMapRenderState.GraphNode> graphNodes = new ArrayList<>();
    private final List<DungeonMapRenderState.GraphLink> graphLinks = new ArrayList<>();

    DungeonMapEditorProjectionAccumulator(
            DungeonMapRoomLabelPlanner roomLabelPlanner,
            DungeonMapPreviewDiffProjector previewDiffProjector
    ) {
        this.roomLabelPlanner = roomLabelPlanner;
        this.previewDiffProjector = previewDiffProjector;
    }

    void addAreas(DungeonEditorMapSnapshot map, DungeonEditorStateSnapshot.Selection selection) {
        DungeonMapEditorAreaProjector.addAreas(cells, labels, graphNodes, map, selection, roomLabelPlanner);
    }

    void addClusterLabels(DungeonEditorMapSnapshot map, DungeonEditorStateSnapshot.Selection selection) {
        DungeonMapEditorAreaProjector.addClusterLabels(labels, map, selection);
    }

    void addPreviewAndBoundaries(
            DungeonEditorMapSnapshot map,
            DungeonEditorStateSnapshot.Selection selection,
            PreviewRenderFrame previewRender
    ) {
        DungeonMapPreparedPreviewProjector.addPreparedPreview(cells, edges, labels, markers, previewRender);
        for (DungeonEditorMapSnapshot.Boundary boundary : map.boundaries()) {
            if (DungeonMapRenderElementFactory.invalidEdge(boundary.edge())) {
                continue;
            }
            edges.add(DungeonMapRenderEdges.edge(
                    boundary,
                    0,
                    0,
                    0,
                    false,
                    DungeonMapRenderSelection.selectedBoundary(boundary, selection)));
        }
    }

    void addFeatures(DungeonEditorMapSnapshot map, DungeonEditorStateSnapshot.Selection selection) {
        DungeonMapEditorFeatureProjector.addFeatures(cells, markers, map, selection);
    }

    void addHandles(
            DungeonEditorMapSnapshot map,
            DungeonEditorStateSnapshot.Selection selection,
            DungeonEditorPreview preview
    ) {
        DungeonMapEditorHandleProjector.addHandles(markers, map, selection, preview);
    }

    void addPreviewRenderDiff(
            PreviewRenderDiffFrame previewRenderDiff,
            DungeonEditorStateSnapshot.Selection selection
    ) {
        previewDiffProjector.addPreviewRenderDiff(
                cells,
                edges,
                labels,
                markers,
                previewRenderDiff,
                selection,
                roomLabelPlanner);
    }

    void addFallbackGraphLinks() {
        if (!graphLinks.isEmpty() || graphNodes.size() <= 1) {
            return;
        }
        for (int index = 1; index < graphNodes.size(); index++) {
            graphLinks.add(new DungeonMapRenderState.GraphLink(
                    graphNodes.get(index - 1).id(),
                    graphNodes.get(index).id(),
                    false));
        }
    }

    DungeonMapRenderState renderState(
            DungeonEditorSurface surface,
            DungeonEditorMapSnapshot map,
            boolean editorMode
    ) {
        return new DungeonMapRenderState(
                surface.mapName(),
                true,
                map.width(),
                map.height(),
                DungeonMapRenderState.Topology.fromName(map.topology()),
                DungeonMapRenderState.ViewMode.grid(),
                DungeonMapRenderState.LevelOverlaySettings.off(),
                0,
                editorMode,
                DungeonMapRenderState.selectToolLabel(),
                "No dungeon map geometry available.",
                List.copyOf(cells),
                List.copyOf(edges),
                List.copyOf(labels),
                List.copyOf(markers),
                List.copyOf(graphNodes),
                List.copyOf(graphLinks),
                null);
    }
}
