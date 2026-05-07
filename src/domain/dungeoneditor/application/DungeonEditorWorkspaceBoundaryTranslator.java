package src.domain.dungeoneditor.application;

import java.util.List;
import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.published.DungeonBoundaryKind;
import src.domain.dungeon.published.DungeonCellRef;
import src.domain.dungeon.published.DungeonEdgeRef;
import src.domain.dungeon.published.DungeonEditorHandleKind;
import src.domain.dungeon.published.DungeonEditorHandleRef;
import src.domain.dungeon.published.DungeonEditorHandleSnapshot;
import src.domain.dungeon.published.DungeonEditorOperation;
import src.domain.dungeon.published.DungeonFeatureKind;
import src.domain.dungeon.published.DungeonFeatureSnapshot;
import src.domain.dungeon.published.DungeonInspectorSnapshot;
import src.domain.dungeon.published.DungeonMapId;
import src.domain.dungeon.published.DungeonMapSnapshot;
import src.domain.dungeon.published.DungeonMapSummary;
import src.domain.dungeon.published.DungeonSnapshot;
import src.domain.dungeon.published.DungeonTopologyElementKind;
import src.domain.dungeon.published.DungeonTopologyElementRef;
import src.domain.dungeon.published.DungeonTopologyKind;
import src.domain.dungeoneditor.workspace.value.DungeonEditorWorkspaceValues;

public final class DungeonEditorWorkspaceBoundaryTranslator {

    private DungeonEditorWorkspaceBoundaryTranslator() {
    }

    public static DungeonEditorWorkspaceValues.@Nullable MapId toWorkspaceMapId(@Nullable DungeonMapId mapId) {
        return mapId == null ? null : new DungeonEditorWorkspaceValues.MapId(mapId.value());
    }

    public static @Nullable DungeonMapId toDomainMapId(DungeonEditorWorkspaceValues.@Nullable MapId mapId) {
        return mapId == null ? null : new DungeonMapId(mapId.value());
    }

    public static DungeonEditorWorkspaceValues.MapSummary toWorkspaceMapSummary(@Nullable DungeonMapSummary map) {
        return map == null
                ? new DungeonEditorWorkspaceValues.MapSummary(new DungeonEditorWorkspaceValues.MapId(1L), "Dungeon Map", 0L)
                : new DungeonEditorWorkspaceValues.MapSummary(
                        Objects.requireNonNull(toWorkspaceMapId(map.mapId())),
                        map.mapName(),
                        map.revision());
    }

    public static DungeonEditorWorkspaceValues.MapSnapshot toWorkspaceMapSnapshot(@Nullable DungeonMapSnapshot map) {
        DungeonMapSnapshot safeMap = map == null ? DungeonMapSnapshot.empty() : map;
        return new DungeonEditorWorkspaceValues.MapSnapshot(
                toWorkspaceTopology(safeMap.topology()),
                safeMap.width(),
                safeMap.height(),
                safeMap.areas().stream().map(DungeonEditorWorkspaceBoundaryTranslator::toWorkspaceArea).toList(),
                safeMap.boundaries().stream().map(DungeonEditorWorkspaceBoundaryTranslator::toWorkspaceBoundary).toList(),
                safeMap.features().stream().map(DungeonEditorWorkspaceBoundaryTranslator::toWorkspaceFeature).toList(),
                safeMap.editorHandles().stream().map(DungeonEditorWorkspaceBoundaryTranslator::toWorkspaceHandle).toList());
    }

    public static DungeonEditorWorkspaceValues.@Nullable MapSnapshot toWorkspacePreviewMap(@Nullable DungeonSnapshot snapshot) {
        return snapshot == null ? null : toWorkspaceMapSnapshot(snapshot.map());
    }

    public static DungeonEditorWorkspaceValues.@Nullable Inspector toWorkspaceInspector(
            @Nullable DungeonInspectorSnapshot inspector
    ) {
        if (inspector == null) {
            return null;
        }
        return new DungeonEditorWorkspaceValues.Inspector(
                inspector.title(),
                inspector.summary(),
                inspector.facts(),
                inspector.roomNarrations().stream()
                        .map(DungeonEditorWorkspaceBoundaryTranslator::toWorkspaceRoomNarrationCard)
                        .toList());
    }

    public static DungeonCellRef toDomainCell(DungeonEditorWorkspaceValues.Cell cell) {
        DungeonEditorWorkspaceValues.Cell safeCell = cell == null
                ? DungeonEditorWorkspaceValues.Cell.empty()
                : cell;
        return new DungeonCellRef(safeCell.q(), safeCell.r(), safeCell.level());
    }

    public static DungeonEdgeRef toDomainEdge(DungeonEditorWorkspaceValues.Edge edge) {
        DungeonEditorWorkspaceValues.Edge safeEdge = edge == null
                ? new DungeonEditorWorkspaceValues.Edge(
                        DungeonEditorWorkspaceValues.Cell.empty(),
                        DungeonEditorWorkspaceValues.Cell.empty())
                : edge;
        return new DungeonEdgeRef(toDomainCell(safeEdge.from()), toDomainCell(safeEdge.to()));
    }

    public static DungeonTopologyElementRef toDomainTopologyRef(DungeonEditorWorkspaceValues.TopologyElementRef ref) {
        DungeonEditorWorkspaceValues.TopologyElementRef safeRef = ref == null
                ? DungeonEditorWorkspaceValues.TopologyElementRef.empty()
                : ref;
        return new DungeonTopologyElementRef(toDomainTopologyKind(safeRef.kind()), safeRef.id());
    }

    public static DungeonEditorHandleRef toDomainHandleRef(DungeonEditorWorkspaceValues.HandleRef ref) {
        DungeonEditorWorkspaceValues.HandleRef safeRef = ref == null
                ? DungeonEditorWorkspaceValues.HandleRef.empty()
                : ref;
        return new DungeonEditorHandleRef(
                toDomainHandleKind(safeRef.kind()),
                toDomainTopologyRef(safeRef.topologyRef()),
                safeRef.ownerId(),
                safeRef.clusterId(),
                safeRef.corridorId(),
                safeRef.roomId(),
                safeRef.index(),
                toDomainCell(safeRef.cell()),
                safeRef.direction());
    }

    public static DungeonEditorOperation.CorridorEndpoint toDomainCorridorEndpoint(
            DungeonEditorWorkspaceValues.CorridorEndpoint endpoint
    ) {
        return switch (endpoint) {
            case DungeonEditorWorkspaceValues.CorridorDoorEndpoint door -> new DungeonEditorOperation.CorridorDoorEndpoint(
                    door.roomId(),
                    door.clusterId(),
                    toDomainCell(door.roomCell()),
                    door.direction(),
                    toDomainTopologyRef(door.topologyRef()));
            case DungeonEditorWorkspaceValues.CorridorAnchorEndpoint anchor ->
                    new DungeonEditorOperation.CorridorAnchorEndpoint(
                            anchor.hostCorridorId(),
                            toDomainCell(anchor.anchorCell()),
                            toDomainTopologyRef(anchor.topologyRef()));
        };
    }

    public static DungeonBoundaryKind toDomainBoundaryKind(DungeonEditorWorkspaceValues.BoundaryKind boundaryKind) {
        return boundaryKind == DungeonEditorWorkspaceValues.BoundaryKind.DOOR
                ? DungeonBoundaryKind.DOOR
                : DungeonBoundaryKind.WALL;
    }

    public static DungeonInspectorSnapshot.RoomExitNarration toDomainRoomExit(
            DungeonEditorWorkspaceValues.RoomExitNarration exit
    ) {
        DungeonEditorWorkspaceValues.RoomExitNarration safeExit = exit == null
                ? new DungeonEditorWorkspaceValues.RoomExitNarration(
                        "",
                        DungeonEditorWorkspaceValues.Cell.empty(),
                        "",
                        "")
                : exit;
        return new DungeonInspectorSnapshot.RoomExitNarration(
                safeExit.label(),
                toDomainCell(safeExit.cell()),
                safeExit.direction(),
                safeExit.description());
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
                        area.cells().stream().map(DungeonEditorWorkspaceBoundaryTranslator::toWorkspaceCell).toList(),
                        toWorkspaceTopologyRef(area.topologyRef()));
    }

    private static DungeonEditorWorkspaceValues.Boundary toWorkspaceBoundary(
            src.domain.dungeon.published.@Nullable DungeonBoundarySnapshot boundary
    ) {
        return boundary == null
                ? new DungeonEditorWorkspaceValues.Boundary(
                        DungeonEditorWorkspaceValues.BoundaryKind.WALL,
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
                        toWorkspaceEdge(boundary.edge()),
                        toWorkspaceTopologyRef(boundary.topologyRef()));
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
                        feature.cells().stream().map(DungeonEditorWorkspaceBoundaryTranslator::toWorkspaceCell).toList(),
                        feature.description(),
                        feature.destinationLabel(),
                        toWorkspaceTopologyRef(feature.topologyRef()));
    }

    private static DungeonEditorWorkspaceValues.Handle toWorkspaceHandle(
            @Nullable DungeonEditorHandleSnapshot handle
    ) {
        return handle == null
                ? new DungeonEditorWorkspaceValues.Handle(
                        DungeonEditorWorkspaceValues.HandleRef.empty(),
                        "CLUSTER_LABEL",
                        DungeonEditorWorkspaceValues.Cell.empty())
                : new DungeonEditorWorkspaceValues.Handle(
                        toWorkspaceHandleRef(handle.ref()),
                        handle.label(),
                        toWorkspaceCell(handle.cell()));
    }

    private static DungeonEditorWorkspaceValues.RoomNarrationCard toWorkspaceRoomNarrationCard(
            DungeonInspectorSnapshot.@Nullable RoomNarrationCard card
    ) {
        DungeonInspectorSnapshot.RoomNarrationCard safeCard = card == null
                ? new DungeonInspectorSnapshot.RoomNarrationCard(0L, "Raum", "", List.of())
                : card;
        return new DungeonEditorWorkspaceValues.RoomNarrationCard(
                safeCard.roomId(),
                safeCard.roomName(),
                safeCard.visualDescription(),
                safeCard.exits().stream().map(DungeonEditorWorkspaceBoundaryTranslator::toWorkspaceRoomExit).toList());
    }

    private static DungeonEditorWorkspaceValues.RoomExitNarration toWorkspaceRoomExit(
            DungeonInspectorSnapshot.@Nullable RoomExitNarration exit
    ) {
        DungeonInspectorSnapshot.RoomExitNarration safeExit = exit == null
                ? new DungeonInspectorSnapshot.RoomExitNarration("", new DungeonCellRef(0, 0, 0), "", "")
                : exit;
        return new DungeonEditorWorkspaceValues.RoomExitNarration(
                safeExit.label(),
                toWorkspaceCell(safeExit.cell()),
                safeExit.direction(),
                safeExit.description());
    }

    public static DungeonEditorWorkspaceValues.Cell toWorkspaceCell(@Nullable DungeonCellRef cell) {
        return cell == null
                ? DungeonEditorWorkspaceValues.Cell.empty()
                : new DungeonEditorWorkspaceValues.Cell(cell.q(), cell.r(), cell.level());
    }

    public static DungeonEditorWorkspaceValues.Edge toWorkspaceEdge(@Nullable DungeonEdgeRef edge) {
        return edge == null
                ? new DungeonEditorWorkspaceValues.Edge(
                        DungeonEditorWorkspaceValues.Cell.empty(),
                        DungeonEditorWorkspaceValues.Cell.empty())
                : new DungeonEditorWorkspaceValues.Edge(
                        toWorkspaceCell(edge.from()),
                        toWorkspaceCell(edge.to()));
    }

    public static DungeonEditorWorkspaceValues.TopologyElementRef toWorkspaceTopologyRef(
            @Nullable DungeonTopologyElementRef ref
    ) {
        return ref == null
                ? DungeonEditorWorkspaceValues.TopologyElementRef.empty()
                : new DungeonEditorWorkspaceValues.TopologyElementRef(
                        toWorkspaceTopologyKind(ref.kind()),
                        ref.id());
    }

    public static DungeonEditorWorkspaceValues.HandleRef toWorkspaceHandleRef(@Nullable DungeonEditorHandleRef ref) {
        return ref == null
                ? DungeonEditorWorkspaceValues.HandleRef.empty()
                : new DungeonEditorWorkspaceValues.HandleRef(
                        toWorkspaceHandleKind(ref.kind()),
                        toWorkspaceTopologyRef(ref.topologyRef()),
                        ref.ownerId(),
                        ref.clusterId(),
                        ref.corridorId(),
                        ref.roomId(),
                        ref.index(),
                        toWorkspaceCell(ref.cell()),
                        ref.direction());
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

    private static DungeonEditorWorkspaceValues.TopologyElementKind toWorkspaceTopologyKind(
            @Nullable DungeonTopologyElementKind kind
    ) {
        if (kind == null) {
            return DungeonEditorWorkspaceValues.TopologyElementKind.EMPTY;
        }
        return switch (kind) {
            case ROOM -> DungeonEditorWorkspaceValues.TopologyElementKind.ROOM;
            case CORRIDOR -> DungeonEditorWorkspaceValues.TopologyElementKind.CORRIDOR;
            case CORRIDOR_ANCHOR -> DungeonEditorWorkspaceValues.TopologyElementKind.CORRIDOR_ANCHOR;
            case DOOR -> DungeonEditorWorkspaceValues.TopologyElementKind.DOOR;
            case WALL -> DungeonEditorWorkspaceValues.TopologyElementKind.WALL;
            case STAIR -> DungeonEditorWorkspaceValues.TopologyElementKind.STAIR;
            case TRANSITION -> DungeonEditorWorkspaceValues.TopologyElementKind.TRANSITION;
            case EMPTY -> DungeonEditorWorkspaceValues.TopologyElementKind.EMPTY;
        };
    }

    private static DungeonEditorWorkspaceValues.HandleKind toWorkspaceHandleKind(@Nullable DungeonEditorHandleKind kind) {
        if (kind == null) {
            return DungeonEditorWorkspaceValues.HandleKind.CLUSTER_LABEL;
        }
        return switch (kind) {
            case CLUSTER_LABEL -> DungeonEditorWorkspaceValues.HandleKind.CLUSTER_LABEL;
            case DOOR -> DungeonEditorWorkspaceValues.HandleKind.DOOR;
            case CORRIDOR_ANCHOR -> DungeonEditorWorkspaceValues.HandleKind.CORRIDOR_ANCHOR;
            case CORRIDOR_WAYPOINT -> DungeonEditorWorkspaceValues.HandleKind.CORRIDOR_WAYPOINT;
            case STAIR_ANCHOR -> DungeonEditorWorkspaceValues.HandleKind.STAIR_ANCHOR;
        };
    }

    private static DungeonTopologyElementKind toDomainTopologyKind(
            DungeonEditorWorkspaceValues.TopologyElementKind kind
    ) {
        DungeonEditorWorkspaceValues.TopologyElementKind safeKind = kind == null
                ? DungeonEditorWorkspaceValues.TopologyElementKind.EMPTY
                : kind;
        return switch (safeKind) {
            case ROOM -> DungeonTopologyElementKind.ROOM;
            case CORRIDOR -> DungeonTopologyElementKind.CORRIDOR;
            case CORRIDOR_ANCHOR -> DungeonTopologyElementKind.CORRIDOR_ANCHOR;
            case DOOR -> DungeonTopologyElementKind.DOOR;
            case WALL -> DungeonTopologyElementKind.WALL;
            case STAIR -> DungeonTopologyElementKind.STAIR;
            case TRANSITION -> DungeonTopologyElementKind.TRANSITION;
            case EMPTY -> DungeonTopologyElementKind.EMPTY;
        };
    }

    private static DungeonEditorHandleKind toDomainHandleKind(DungeonEditorWorkspaceValues.HandleKind kind) {
        DungeonEditorWorkspaceValues.HandleKind safeKind = kind == null
                ? DungeonEditorWorkspaceValues.HandleKind.CLUSTER_LABEL
                : kind;
        return switch (safeKind) {
            case CLUSTER_LABEL -> DungeonEditorHandleKind.CLUSTER_LABEL;
            case DOOR -> DungeonEditorHandleKind.DOOR;
            case CORRIDOR_ANCHOR -> DungeonEditorHandleKind.CORRIDOR_ANCHOR;
            case CORRIDOR_WAYPOINT -> DungeonEditorHandleKind.CORRIDOR_WAYPOINT;
            case STAIR_ANCHOR -> DungeonEditorHandleKind.STAIR_ANCHOR;
        };
    }
}
