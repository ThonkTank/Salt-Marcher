package src.domain.dungeoneditor.application;

import java.util.List;
import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.published.DungeonFeatureKind;
import src.domain.dungeon.published.DungeonFeatureSnapshot;
import src.domain.dungeon.published.DungeonMapId;
import src.domain.dungeon.published.DungeonMapSnapshot;
import src.domain.dungeon.published.DungeonMapSummary;
import src.domain.dungeon.published.DungeonSnapshot;
import src.domain.dungeon.published.DungeonTopologyKind;
import src.domain.dungeoneditor.workspace.value.DungeonEditorWorkspaceValues;

final class DungeonEditorWorkspaceMapBoundaryTranslator {

    private DungeonEditorWorkspaceMapBoundaryTranslator() {
    }

    static DungeonEditorWorkspaceValues.@Nullable MapId toWorkspaceMapId(@Nullable DungeonMapId mapId) {
        return mapId == null ? null : new DungeonEditorWorkspaceValues.MapId(mapId.value());
    }

    static @Nullable DungeonMapId toDomainMapId(DungeonEditorWorkspaceValues.@Nullable MapId mapId) {
        return mapId == null ? null : new DungeonMapId(mapId.value());
    }

    static DungeonEditorWorkspaceValues.MapSummary toWorkspaceMapSummary(@Nullable DungeonMapSummary map) {
        return map == null
                ? new DungeonEditorWorkspaceValues.MapSummary(new DungeonEditorWorkspaceValues.MapId(1L), "Dungeon Map", 0L)
                : new DungeonEditorWorkspaceValues.MapSummary(
                        Objects.requireNonNull(toWorkspaceMapId(map.mapId())),
                        map.mapName(),
                        map.revision());
    }

    static DungeonEditorWorkspaceValues.MapSnapshot toWorkspaceMapSnapshot(@Nullable DungeonMapSnapshot map) {
        DungeonMapSnapshot safeMap = map == null ? DungeonMapSnapshot.empty() : map;
        return new DungeonEditorWorkspaceValues.MapSnapshot(
                toWorkspaceTopology(safeMap.topology()),
                safeMap.width(),
                safeMap.height(),
                safeMap.areas().stream().map(DungeonEditorWorkspaceMapBoundaryTranslator::toWorkspaceArea).toList(),
                safeMap.boundaries().stream().map(DungeonEditorWorkspaceMapBoundaryTranslator::toWorkspaceBoundary).toList(),
                safeMap.features().stream().map(DungeonEditorWorkspaceMapBoundaryTranslator::toWorkspaceFeature).toList(),
                safeMap.editorHandles().stream().map(DungeonEditorWorkspaceMapBoundaryTranslator::toWorkspaceHandle).toList());
    }

    static DungeonEditorWorkspaceValues.@Nullable MapSnapshot toWorkspacePreviewMap(@Nullable DungeonSnapshot snapshot) {
        return snapshot == null ? null : toWorkspaceMapSnapshot(snapshot.map());
    }

    private static DungeonEditorWorkspaceValues.Area toWorkspaceArea(
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
                        area.cells().stream().map(DungeonEditorWorkspaceCellBoundaryTranslator::toWorkspaceCell).toList(),
                        DungeonEditorWorkspaceTopologyBoundaryTranslator.toWorkspaceTopologyRef(area.topologyRef()));
    }

    private static DungeonEditorWorkspaceValues.Boundary toWorkspaceBoundary(
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
                        DungeonEditorWorkspaceCellBoundaryTranslator.toWorkspaceEdge(boundary.edge()),
                        DungeonEditorWorkspaceTopologyBoundaryTranslator.toWorkspaceTopologyRef(boundary.topologyRef()));
    }

    private static DungeonEditorWorkspaceValues.Feature toWorkspaceFeature(
            @Nullable DungeonFeatureSnapshot feature
    ) {
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
                        feature.cells().stream().map(DungeonEditorWorkspaceCellBoundaryTranslator::toWorkspaceCell).toList(),
                        feature.description(),
                        feature.destinationLabel(),
                        DungeonEditorWorkspaceTopologyBoundaryTranslator.toWorkspaceTopologyRef(feature.topologyRef()));
    }

    private static DungeonEditorWorkspaceValues.Handle toWorkspaceHandle(
            @Nullable src.domain.dungeon.published.DungeonEditorHandleSnapshot handle
    ) {
        return handle == null
                ? new DungeonEditorWorkspaceValues.Handle(
                        DungeonEditorWorkspaceHandleBoundaryTranslator.toWorkspaceHandleRef(null),
                        "CLUSTER_LABEL",
                        DungeonEditorWorkspaceValues.Cell.empty())
                : new DungeonEditorWorkspaceValues.Handle(
                        DungeonEditorWorkspaceHandleBoundaryTranslator.toWorkspaceHandleRef(handle.ref()),
                        handle.label(),
                        DungeonEditorWorkspaceCellBoundaryTranslator.toWorkspaceCell(handle.cell()));
    }

    private static DungeonEditorWorkspaceValues.TopologyKind toWorkspaceTopology(@Nullable DungeonTopologyKind topology) {
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
