package src.domain.dungeoneditor.application;

import java.util.ArrayList;
import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.dungeoneditor.published.DungeonEditorMapProjectionSnapshot;
import src.domain.dungeoneditor.session.value.DungeonEditorSessionSnapshot;
import src.domain.dungeoneditor.session.value.DungeonEditorSessionValues;
import src.domain.dungeoneditor.workspace.value.DungeonEditorWorkspaceValues;

public final class DungeonEditorProjectionAssemblyProjector {

    private DungeonEditorProjectionAssemblyProjector() {
    }

    public static ProjectionAccumulator assemble(
            DungeonEditorSessionSnapshot.SurfaceData surface,
            DungeonEditorSessionValues.Selection selection,
            DungeonEditorSessionValues.Preview preview
    ) {
        ProjectionAccumulator projection = new ProjectionAccumulator(
                new ArrayList<>(),
                new ArrayList<>(),
                new ArrayList<>(),
                new ArrayList<>(),
                new ArrayList<>(),
                new ArrayList<>());
        DungeonEditorWorkspaceValues.MapSnapshot map = surface.map();
        renderAreas(map, selection, projection);
        renderClusterLabels(map, selection, projection.labels());
        addPreviewAndBoundaries(map, selection, preview, surface.previewMap(), projection);
        renderFeatures(map, selection, projection);
        renderHandles(map, selection, preview, projection.markers());
        addPreviewMapDiff(map, selection, preview, surface.previewMap(), projection);
        addFallbackGraphLinks(projection.graphNodes(), projection.graphLinks());
        return projection;
    }

    private static void renderAreas(
            DungeonEditorWorkspaceValues.MapSnapshot map,
            DungeonEditorSessionValues.Selection selection,
            ProjectionAccumulator projection
    ) {
        for (DungeonEditorWorkspaceValues.Area area : map.areas()) {
            boolean selected = DungeonEditorProjectionSelectionProjector.selectedArea(area, selection);
            List<DungeonEditorMapProjectionSnapshot.CellProjection> areaCells = area.cells().stream()
                    .map(cell -> DungeonEditorProjectionElementProjector.cell(area, cell, selected, false, 0, 0, 0))
                    .toList();
            projection.cells().addAll(areaCells);
            if (areaCells.isEmpty()) {
                continue;
            }
            DungeonEditorProjectionGeometryProjector.CellCenter center =
                    DungeonEditorProjectionGeometryProjector.centerOf(areaCells);
            projection.graphNodes().add(new DungeonEditorMapProjectionSnapshot.GraphNodeProjection(
                    area.id(),
                    area.clusterId(),
                    area.label(),
                    center.q(),
                    center.r(),
                    selected));
        }
    }

    private static void renderClusterLabels(
            DungeonEditorWorkspaceValues.MapSnapshot map,
            DungeonEditorSessionValues.Selection selection,
            List<DungeonEditorMapProjectionSnapshot.LabelProjection> labels
    ) {
        List<Long> renderedClusterIds = new ArrayList<>();
        for (DungeonEditorWorkspaceValues.Handle handle : map.editorHandles()) {
            if (!handle.ref().kind().isClusterLabel()) {
                continue;
            }
            long clusterId = handle.ref().clusterId();
            if (clusterId <= 0L || renderedClusterIds.contains(clusterId)) {
                continue;
            }
            renderedClusterIds.add(clusterId);
            labels.add(DungeonEditorProjectionElementProjector.clusterLabel(
                    handle,
                    DungeonEditorProjectionSelectionProjector.selectedClusterLabel(handle, selection),
                    false,
                    0,
                    0,
                    0));
        }
    }

    private static void addPreviewAndBoundaries(
            DungeonEditorWorkspaceValues.MapSnapshot map,
            DungeonEditorSessionValues.Selection selection,
            DungeonEditorSessionValues.Preview preview,
            DungeonEditorWorkspaceValues.@Nullable MapSnapshot previewMap,
            ProjectionAccumulator projection
    ) {
        DungeonEditorProjectionPreviewProjector.addEditorPreview(
                projection.cells(),
                projection.edges(),
                projection.labels(),
                map.areas(),
                map.boundaries(),
                map.editorHandles(),
                selection,
                preview,
                previewMap);
        for (DungeonEditorWorkspaceValues.Boundary boundary : map.boundaries()) {
            if (boundary.edge() == null || boundary.edge().from() == null || boundary.edge().to() == null) {
                continue;
            }
            projection.edges().add(DungeonEditorProjectionElementProjector.edge(
                    boundary,
                    0,
                    0,
                    0,
                    false,
                    DungeonEditorProjectionSelectionProjector.selectedBoundary(boundary, selection)));
        }
    }

    private static void addPreviewMapDiff(
            DungeonEditorWorkspaceValues.MapSnapshot map,
            DungeonEditorSessionValues.Selection selection,
            DungeonEditorSessionValues.Preview preview,
            DungeonEditorWorkspaceValues.@Nullable MapSnapshot previewMap,
            ProjectionAccumulator projection
    ) {
        if (preview != DungeonEditorSessionValues.Preview.none() || previewMap == null) {
            return;
        }
        DungeonEditorProjectionDiffProjector.addPreviewAreaDiff(
                projection.cells(),
                projection.labels(),
                map.areas(),
                previewMap.areas(),
                selection);
        DungeonEditorProjectionDiffProjector.addPreviewBoundaryDiff(
                projection.edges(),
                map.boundaries(),
                previewMap.boundaries(),
                selection);
        DungeonEditorProjectionDiffProjector.addPreviewHandleDiff(
                projection.markers(),
                map.editorHandles(),
                previewMap.editorHandles(),
                selection);
    }

    private static void renderFeatures(
            DungeonEditorWorkspaceValues.MapSnapshot map,
            DungeonEditorSessionValues.Selection selection,
            ProjectionAccumulator projection
    ) {
        for (DungeonEditorWorkspaceValues.Feature feature : map.features()) {
            boolean selected = DungeonEditorProjectionSelectionProjector.selectedFeature(feature, selection);
            List<DungeonEditorMapProjectionSnapshot.CellProjection> featureCells = feature.cells().stream()
                    .map(cell -> DungeonEditorProjectionElementProjector.featureCell(feature, cell, selected))
                    .toList();
            projection.cells().addAll(featureCells);
            if (featureCells.isEmpty()) {
                continue;
            }
            DungeonEditorProjectionGeometryProjector.CellCenter center =
                    DungeonEditorProjectionGeometryProjector.centerOf(featureCells);
            projection.labels().add(new DungeonEditorMapProjectionSnapshot.LabelProjection(
                    feature.label(),
                    center.q(),
                    center.r(),
                    featureCells.getFirst().level(),
                    feature.id(),
                    0L,
                    DungeonEditorProjectionPublishedBoundaryTranslator.safeTopologyRef(feature.topologyRef()),
                    selected,
                    false));
            projection.markers().add(DungeonEditorProjectionElementProjector.featureMarker(
                    feature,
                    center,
                    featureCells.getFirst().level(),
                    selected));
        }
    }

    private static void renderHandles(
            DungeonEditorWorkspaceValues.MapSnapshot map,
            DungeonEditorSessionValues.Selection selection,
            DungeonEditorSessionValues.Preview preview,
            List<DungeonEditorMapProjectionSnapshot.MarkerProjection> markers
    ) {
        for (DungeonEditorWorkspaceValues.Handle handle : map.editorHandles()) {
            if (handle.ref().kind().isClusterLabel()) {
                continue;
            }
            markers.add(DungeonEditorProjectionElementProjector.handleMarker(handle, selection, false));
        }
        DungeonEditorProjectionPreviewProjector.addHandleMovePreview(markers, preview);
    }

    private static void addFallbackGraphLinks(
            List<DungeonEditorMapProjectionSnapshot.GraphNodeProjection> graphNodes,
            List<DungeonEditorMapProjectionSnapshot.GraphLinkProjection> graphLinks
    ) {
        if (!graphLinks.isEmpty() || graphNodes.size() <= 1) {
            return;
        }
        for (int index = 1; index < graphNodes.size(); index++) {
            graphLinks.add(new DungeonEditorMapProjectionSnapshot.GraphLinkProjection(
                    graphNodes.get(index - 1).id(),
                    graphNodes.get(index).id(),
                    false));
        }
    }

    record ProjectionAccumulator(
            List<DungeonEditorMapProjectionSnapshot.CellProjection> cells,
            List<DungeonEditorMapProjectionSnapshot.EdgeProjection> edges,
            List<DungeonEditorMapProjectionSnapshot.LabelProjection> labels,
            List<DungeonEditorMapProjectionSnapshot.MarkerProjection> markers,
            List<DungeonEditorMapProjectionSnapshot.GraphNodeProjection> graphNodes,
            List<DungeonEditorMapProjectionSnapshot.GraphLinkProjection> graphLinks
    ) {
    }
}
