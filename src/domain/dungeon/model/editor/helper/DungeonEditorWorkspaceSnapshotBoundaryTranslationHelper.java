package src.domain.dungeon.model.editor.helper;

import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.map.model.DungeonAreaType;
import src.domain.dungeon.model.map.model.DungeonFeatureType;
import src.domain.dungeon.model.map.model.DungeonTopology;
import src.domain.dungeon.model.map.model.DungeonTopologyRef;
import src.domain.dungeon.published.DungeonFeatureSnapshot;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues;

public final class DungeonEditorWorkspaceSnapshotBoundaryTranslationHelper {

    private DungeonEditorWorkspaceSnapshotBoundaryTranslationHelper() {
    }

    static DungeonEditorWorkspaceValues.Area toWorkspaceArea(
            src.domain.dungeon.published.@Nullable DungeonAreaSnapshot area
    ) {
        return area == null
                ? new DungeonEditorWorkspaceValues.Area(
                        DungeonAreaType.ROOM,
                        1L,
                        0L,
                        "ROOM",
                        List.of(),
                        DungeonTopologyRef.empty())
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
                        DungeonTopologyRef.empty())
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
                        DungeonFeatureType.STAIR,
                        1L,
                        "STAIR",
                        List.of(),
                        "",
                        "",
                        DungeonTopologyRef.empty())
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

    static DungeonTopology toWorkspaceTopology(
            src.domain.dungeon.published.@Nullable DungeonTopologyKind topology
    ) {
        return topology == src.domain.dungeon.published.DungeonTopologyKind.HEX
                ? DungeonTopology.HEX
                : DungeonTopology.SQUARE;
    }

    private static DungeonAreaType toWorkspaceAreaKind(
            src.domain.dungeon.published.@Nullable DungeonAreaKind kind
    ) {
        return kind == src.domain.dungeon.published.DungeonAreaKind.CORRIDOR
                ? DungeonAreaType.CORRIDOR
                : DungeonAreaType.ROOM;
    }

    private static DungeonFeatureType toWorkspaceFeatureKind(
            src.domain.dungeon.published.@Nullable DungeonFeatureKind kind
    ) {
        return kind == src.domain.dungeon.published.DungeonFeatureKind.TRANSITION
                ? DungeonFeatureType.TRANSITION
                : DungeonFeatureType.STAIR;
    }
}
