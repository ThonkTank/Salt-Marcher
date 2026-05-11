package src.domain.dungeoneditor.model.workspace.helper;

import java.util.ArrayList;
import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.dungeoneditor.published.DungeonEditorMapProjectionSnapshot;
import src.domain.dungeoneditor.model.session.model.DungeonEditorSessionSnapshot;
import src.domain.dungeoneditor.model.session.model.DungeonEditorSessionValues;
import src.domain.dungeoneditor.model.workspace.model.DungeonEditorWorkspaceValues;

public final class DungeonEditorProjectionAssemblyProjectionHelper {

    private DungeonEditorProjectionAssemblyProjectionHelper() {
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
            boolean selected = DungeonEditorProjectionSelectionProjectionHelper.selectedArea(area, selection);
            List<DungeonEditorMapProjectionSnapshot.CellProjection> areaCells = area.cells().stream()
                    .map(cell -> DungeonEditorProjectionElementProjectionHelper.cell(area, cell, selected, false, 0, 0, 0))
                    .toList();
            projection.cells().addAll(areaCells);
            if (areaCells.isEmpty()) {
                continue;
            }
            DungeonEditorProjectionGeometryProjectionHelper.CellCenter center =
                    DungeonEditorProjectionGeometryProjectionHelper.centerOf(areaCells);
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
            labels.add(DungeonEditorProjectionElementProjectionHelper.clusterLabel(
                    handle,
                    DungeonEditorProjectionSelectionProjectionHelper.selectedClusterLabel(handle, selection),
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
        DungeonEditorProjectionPreviewProjectionHelper.addEditorPreview(
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
            projection.edges().add(DungeonEditorProjectionElementProjectionHelper.edge(
                    boundary,
                    0,
                    0,
                    0,
                    false,
                    DungeonEditorProjectionSelectionProjectionHelper.selectedBoundary(boundary, selection)));
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
        DungeonEditorProjectionDiffProjectionHelper.addPreviewAreaDiff(
                projection.cells(),
                projection.labels(),
                map.areas(),
                previewMap.areas(),
                selection);
        DungeonEditorProjectionDiffProjectionHelper.addPreviewBoundaryDiff(
                projection.edges(),
                map.boundaries(),
                previewMap.boundaries(),
                selection);
        DungeonEditorProjectionDiffProjectionHelper.addPreviewHandleDiff(
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
            boolean selected = DungeonEditorProjectionSelectionProjectionHelper.selectedFeature(feature, selection);
            List<DungeonEditorMapProjectionSnapshot.CellProjection> featureCells = feature.cells().stream()
                    .map(cell -> DungeonEditorProjectionElementProjectionHelper.featureCell(feature, cell, selected))
                    .toList();
            projection.cells().addAll(featureCells);
            if (featureCells.isEmpty()) {
                continue;
            }
            DungeonEditorProjectionGeometryProjectionHelper.CellCenter center =
                    DungeonEditorProjectionGeometryProjectionHelper.centerOf(featureCells);
            projection.labels().add(new DungeonEditorMapProjectionSnapshot.LabelProjection(
                    feature.label(),
                    center.q(),
                    center.r(),
                    featureCells.getFirst().level(),
                    feature.id(),
                    0L,
                    DungeonEditorProjectionPublishedBoundaryTranslationHelper.safeTopologyRef(feature.topologyRef()),
                    selected,
                    false));
            projection.markers().add(DungeonEditorProjectionElementProjectionHelper.featureMarker(
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
            markers.add(DungeonEditorProjectionElementProjectionHelper.handleMarker(handle, selection, false));
        }
        DungeonEditorProjectionPreviewProjectionHelper.addHandleMovePreview(markers, preview);
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
