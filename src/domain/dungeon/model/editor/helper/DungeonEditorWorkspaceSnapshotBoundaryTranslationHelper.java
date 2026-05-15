package src.domain.dungeon.model.editor.helper;

import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.published.DungeonFeatureKind;
import src.domain.dungeon.published.DungeonFeatureSnapshot;
import src.domain.dungeon.published.DungeonTopologyKind;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues;

public final class DungeonEditorWorkspaceSnapshotBoundaryTranslationHelper {

    private DungeonEditorWorkspaceSnapshotBoundaryTranslationHelper() {
    }

    static DungeonEditorWorkspaceValues.Area toWorkspaceArea(
            src.domain.dungeon.published.@Nullable DungeonAreaSnapshot area
    ) {
        return area == null
                ? new DungeonEditorWorkspaceValues.Area(
                        DungeonEditorWorkspaceValues.AreaKind.ROOM,
                        1L,
                        0L,
                        "ROOM",
                        List.of(),
                        DungeonEditorWorkspaceValues.TopologyElementRef.empty())
                : new DungeonEditorWorkspaceValues.Area(
                        toWorkspaceAreaKind(area.kind()),
                        area.id(),
                        area.clusterId(),
                        area.label(),
                        area.cells().stream().map(DungeonEditorWorkspaceCellBoundaryTranslationHelper::toWorkspaceCell).toList(),
                        DungeonEditorWorkspaceTopologyBoundaryTranslationHelper.toWorkspaceTopologyRef(area.topologyRef()));
    }

    static DungeonEditorWorkspaceValues.Boundary toWorkspaceBoundary(
            src.domain.dungeon.published.@Nullable DungeonBoundarySnapshot boundary
    ) {
        return boundary == null
                ? new DungeonEditorWorkspaceValues.Boundary(
                        DungeonEditorWorkspaceValues.BoundaryKind.defaultKind(),
                        1L,
                        "boundary",
                        new DungeonEditorWorkspaceValues.Edge(
                                DungeonEditorWorkspaceValues.Cell.empty(),
                                DungeonEditorWorkspaceValues.Cell.empty()),
                        DungeonEditorWorkspaceValues.TopologyElementRef.empty())
                : new DungeonEditorWorkspaceValues.Boundary(
                        DungeonEditorWorkspaceValues.BoundaryKind.fromExternalKind(boundary.kind()),
                        boundary.id(),
                        boundary.label(),
                        DungeonEditorWorkspaceCellBoundaryTranslationHelper.toWorkspaceEdge(boundary.edge()),
                        DungeonEditorWorkspaceTopologyBoundaryTranslationHelper.toWorkspaceTopologyRef(boundary.topologyRef()));
    }

    static DungeonEditorWorkspaceValues.Feature toWorkspaceFeature(@Nullable DungeonFeatureSnapshot feature) {
        return feature == null
                ? new DungeonEditorWorkspaceValues.Feature(
                        DungeonEditorWorkspaceValues.FeatureKind.STAIR,
                        1L,
                        "STAIR",
                        List.of(),
                        "",
                        "",
                        DungeonEditorWorkspaceValues.TopologyElementRef.empty())
                : new DungeonEditorWorkspaceValues.Feature(
                        toWorkspaceFeatureKind(feature.kind()),
                        feature.id(),
                        feature.label(),
                        feature.cells().stream().map(DungeonEditorWorkspaceCellBoundaryTranslationHelper::toWorkspaceCell).toList(),
                        feature.description(),
                        feature.destinationLabel(),
                        DungeonEditorWorkspaceTopologyBoundaryTranslationHelper.toWorkspaceTopologyRef(feature.topologyRef()));
    }

    static DungeonEditorWorkspaceValues.Handle toWorkspaceHandle(
            src.domain.dungeon.published.@Nullable DungeonEditorHandleSnapshot handle
    ) {
        return handle == null
                ? new DungeonEditorWorkspaceValues.Handle(
                        DungeonEditorWorkspaceHandleBoundaryTranslationHelper.toWorkspaceHandleRef(null),
                        "CLUSTER_LABEL",
                        DungeonEditorWorkspaceValues.Cell.empty())
                : new DungeonEditorWorkspaceValues.Handle(
                        DungeonEditorWorkspaceHandleBoundaryTranslationHelper.toWorkspaceHandleRef(handle.ref()),
                        handle.label(),
                        DungeonEditorWorkspaceCellBoundaryTranslationHelper.toWorkspaceCell(handle.cell()));
    }

    static DungeonEditorWorkspaceValues.TopologyKind toWorkspaceTopology(@Nullable DungeonTopologyKind topology) {
        return topology == DungeonTopologyKind.HEX
                ? DungeonEditorWorkspaceValues.TopologyKind.HEX
                : DungeonEditorWorkspaceValues.TopologyKind.SQUARE;
    }

    private static DungeonEditorWorkspaceValues.AreaKind toWorkspaceAreaKind(
            src.domain.dungeon.published.@Nullable DungeonAreaKind kind
    ) {
        return kind == src.domain.dungeon.published.DungeonAreaKind.CORRIDOR
                ? DungeonEditorWorkspaceValues.AreaKind.CORRIDOR
                : DungeonEditorWorkspaceValues.AreaKind.ROOM;
    }

    private static DungeonEditorWorkspaceValues.FeatureKind toWorkspaceFeatureKind(@Nullable DungeonFeatureKind kind) {
        return kind == DungeonFeatureKind.TRANSITION
                ? DungeonEditorWorkspaceValues.FeatureKind.TRANSITION
                : DungeonEditorWorkspaceValues.FeatureKind.STAIR;
    }
}
