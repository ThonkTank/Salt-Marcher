package features.dungeon.application.editor.helper;

import features.dungeon.application.editor.session.DungeonEditorSessionValues;
import features.dungeon.application.editor.session.DungeonEditorWorkspaceGeometry;
import features.dungeon.application.editor.session.DungeonEditorWorkspaceValues;
import features.dungeon.application.editor.session.DungeonEditorWorkspaceValues.Area;
import features.dungeon.application.editor.session.DungeonEditorWorkspaceValues.Boundary;
import features.dungeon.application.editor.session.DungeonEditorWorkspaceValues.Feature;
import features.dungeon.application.editor.session.DungeonEditorWorkspaceValues.MapSnapshot;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.Direction;
import features.dungeon.domain.core.geometry.DungeonBoundaryKey;
import features.dungeon.domain.core.geometry.Edge;
import features.dungeon.domain.core.geometry.EdgeKey;
import features.dungeon.domain.core.graph.DungeonTopologyElementKind;
import features.dungeon.domain.core.graph.DungeonTopologyRef;
import features.dungeon.domain.core.projection.DungeonAreaType;
import features.dungeon.domain.core.projection.DungeonFeatureType;
import features.dungeon.domain.core.structure.corridor.CorridorRoute;
import features.dungeon.domain.core.structure.corridor.CorridorDeletionTarget;
import features.dungeon.domain.core.structure.corridor.CorridorRoutingPolicy;
import features.dungeon.domain.core.structure.stair.StairGeometrySpec;
import features.dungeon.domain.core.structure.stair.StairShape;
import features.dungeon.domain.core.structure.stair.CorridorBoundStairGeometry;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import org.jspecify.annotations.Nullable;

/** Builds transient creation previews from the immutable loaded editor workset. */
public final class PreviewDungeonEditorSurfaceCreateHelper {
    private static final long PREVIEW_ID = Long.MAX_VALUE;
    private final CorridorRoutingPolicy corridorRouting;

    public PreviewDungeonEditorSurfaceCreateHelper(CorridorRoutingPolicy corridorRouting) {
        this.corridorRouting = java.util.Objects.requireNonNull(corridorRouting, "corridorRouting");
    }

    public @Nullable MapSnapshot roomRectangle(
            MapSnapshot committed,
            DungeonEditorSessionValues.RoomRectanglePreview preview
    ) {
        Set<Cell> rectangle = rectangle(preview.start(), preview.end());
        if (rectangle.isEmpty()) {
            return null;
        }
        List<Area> next = preview.deleteMode()
                ? deletedRoomCells(committed.areas(), rectangle)
                : paintedRoomCells(committed.areas(), rectangle);
        return withAreas(committed, next);
    }

    public @Nullable MapSnapshot clusterBoundaries(
            MapSnapshot committed,
            DungeonEditorSessionValues.ClusterBoundariesPreview preview
    ) {
        List<Edge> unitEdges = DungeonEditorWorkspaceGeometry.unitEdges(preview.edges());
        if (unitEdges.isEmpty()) {
            return null;
        }
        Set<EdgeKey> keys = unitEdges.stream().map(EdgeKey::from).collect(java.util.stream.Collectors.toSet());
        List<Boundary> next = new ArrayList<>();
        for (Boundary boundary : committed.boundaries()) {
            if (!keys.contains(EdgeKey.from(boundary.edge()))) {
                next.add(boundary);
            }
        }
        if (!preview.deleteMode()) {
            for (Edge edge : unitEdges) {
                long id = DungeonBoundaryKey.from(edge).stableId();
                next.add(new Boundary(
                        preview.boundaryKind(),
                        id,
                        preview.boundaryKind().isDoor() ? "Door" : "Wall",
                        edge,
                        DungeonTopologyRef.empty()));
            }
        }
        return new MapSnapshot(
                committed.topology(), committed.width(), committed.height(), committed.areas(),
                List.copyOf(next), committed.features(), committed.editorHandles());
    }

    public @Nullable MapSnapshot stair(
            MapSnapshot committed,
            DungeonEditorSessionValues.StairCreatePreview preview
    ) {
        StairShape shape = StairShape.supportedEditorShape(preview.shapeName());
        Direction direction = Direction.supportedCardinal(preview.directionName());
        if (!preview.valid() || shape == null || direction == null) {
            return null;
        }
        StairGeometrySpec spec = new StairGeometrySpec(
                shape, preview.specAnchor(), direction, preview.dimension1(), preview.dimension2());
        LinkedHashSet<Cell> cells = new LinkedHashSet<>(spec.generatedPath());
        cells.addAll(spec.generatedExitCells());
        if (cells.isEmpty()) {
            return null;
        }
        List<Feature> features = new ArrayList<>(committed.features());
        features.add(new Feature(
                DungeonFeatureType.STAIR,
                PREVIEW_ID,
                "Stair preview",
                List.copyOf(cells),
                "",
                "",
                new DungeonTopologyRef(DungeonTopologyElementKind.STAIR, PREVIEW_ID),
                null));
        return new MapSnapshot(
                committed.topology(), committed.width(), committed.height(), committed.areas(),
                committed.boundaries(), List.copyOf(features), committed.editorHandles());
    }

    public @Nullable MapSnapshot corridor(
            MapSnapshot committed,
            DungeonEditorSessionValues.CorridorCreatePreview preview
    ) {
        Cell start = endpointCell(preview.start());
        Cell end = endpointCell(preview.end());
        if (start == null || end == null) {
            return null;
        }
        if (features.dungeon.domain.core.structure.corridor.CorridorEndpointOrdering.canonicalOrder(
                        endpointRole(preview.start()),
                        endpointRole(preview.end()))
                == features.dungeon.domain.core.structure.corridor.CorridorEndpointOrdering.InputOrder.SWAP) {
            Cell originalStart = start;
            start = end;
            end = originalStart;
        }
        Set<Cell> blockedRooms = new LinkedHashSet<>();
        committed.areas().stream()
                .filter(area -> area.kind().isRoom())
                .forEach(area -> blockedRooms.addAll(area.cells()));
        Set<Cell> blocked = Set.copyOf(blockedRooms);
        CorridorRoute authoredRoute = corridorRouting.route(start, end, blocked);
        if (!authoredRoute.present()) {
            return null;
        }
        CorridorRoute surfaceRoute = start.level() == end.level()
                ? authoredRoute
                : corridorRouting.routeWithLevelTransition(start, end, blocked);
        if (!surfaceRoute.present()) {
            return null;
        }
        List<Area> areas = new ArrayList<>(committed.areas());
        areas.add(new Area(
                DungeonAreaType.CORRIDOR,
                PREVIEW_ID,
                0L,
                "Corridor preview",
                surfaceRoute.cells(),
                new DungeonTopologyRef(DungeonTopologyElementKind.CORRIDOR, PREVIEW_ID)));
        List<Feature> features = new ArrayList<>(committed.features());
        CorridorBoundStairGeometry.fromRoute(authoredRoute.cells(), end.level())
                .map(PreviewDungeonEditorSurfaceCreateHelper::corridorBoundStairFeature)
                .ifPresent(features::add);
        return new MapSnapshot(
                committed.topology(),
                committed.width(),
                committed.height(),
                List.copyOf(areas),
                committed.boundaries(),
                List.copyOf(features),
                committed.editorHandles());
    }

    private static Feature corridorBoundStairFeature(CorridorBoundStairGeometry geometry) {
        List<Cell> cells = java.util.stream.Stream.concat(
                        geometry.path().stream(), java.util.stream.Stream.of(geometry.upperExit()))
                .distinct()
                .sorted(java.util.Comparator.comparingInt(Cell::level)
                        .thenComparingInt(Cell::r)
                        .thenComparingInt(Cell::q))
                .toList();
        return new Feature(
                DungeonFeatureType.STAIR,
                PREVIEW_ID,
                "Corridor-bound stair preview",
                cells,
                "",
                "",
                new DungeonTopologyRef(DungeonTopologyElementKind.STAIR, PREVIEW_ID),
                null);
    }

    public @Nullable MapSnapshot deleteCorridor(
            MapSnapshot committed,
            DungeonEditorSessionValues.DeleteCorridorPreview preview
    ) {
        CorridorDeletionTarget target = preview.target();
        if (!target.hasCorridor()) {
            return null;
        }
        long corridorId = target.corridorId();
        if (target.wholeCorridor()) {
            List<Long> corridorStairIds = committed.editorHandles().stream()
                    .filter(handle -> handle.ref().kind() == features.dungeon.api.DungeonEditorHandleKind.STAIR_ANCHOR)
                    .filter(handle -> handle.ref().corridorId() == corridorId)
                    .map(handle -> handle.ref().ownerId())
                    .distinct()
                    .toList();
            return new MapSnapshot(
                    committed.topology(),
                    committed.width(),
                    committed.height(),
                    committed.areas().stream()
                            .filter(area -> !area.kind().isCorridor() || area.id() != corridorId)
                            .toList(),
                    committed.boundaries(),
                    committed.features().stream()
                            .filter(feature -> !corridorStairIds.contains(feature.id()))
                            .toList(),
                    committed.editorHandles().stream()
                            .filter(handle -> handle.ref().corridorId() != corridorId)
                            .toList());
        }
        List<DungeonEditorWorkspaceValues.Handle> handles = committed.editorHandles().stream()
                .filter(handle -> !deletedTargetHandle(handle, target))
                .toList();
        if (handles.equals(committed.editorHandles())) {
            return null;
        }
        List<Area> areas = reroutedCorridorAreas(committed, handles, corridorId);
        return new MapSnapshot(
                committed.topology(), committed.width(), committed.height(), areas,
                committed.boundaries(), committed.features(), handles);
    }

    private static List<Area> paintedRoomCells(List<Area> areas, Set<Cell> rectangle) {
        Set<Long> affectedClusters = new LinkedHashSet<>();
        for (Area area : areas) {
            if (area.kind().isRoom() && area.cells().stream().anyMatch(rectangle::contains)) {
                affectedClusters.add(area.clusterId());
            }
        }
        if (affectedClusters.isEmpty()) {
            List<Area> result = new ArrayList<>(areas);
            result.add(new Area(
                    DungeonAreaType.ROOM,
                    PREVIEW_ID,
                    PREVIEW_ID,
                    "Raum Vorschau",
                    List.copyOf(rectangle),
                    new DungeonTopologyRef(DungeonTopologyElementKind.ROOM, PREVIEW_ID)));
            return List.copyOf(result);
        }
        long targetClusterId = affectedClusters.stream().mapToLong(Long::longValue).min().orElse(PREVIEW_ID);
        List<Area> result = new ArrayList<>();
        boolean painted = false;
        for (Area area : areas) {
            if (area.kind().isRoom() && affectedClusters.contains(area.clusterId())) {
                LinkedHashSet<Cell> cells = new LinkedHashSet<>(area.cells());
                if (!painted && area.clusterId() == targetClusterId) {
                    cells.addAll(rectangle);
                    painted = true;
                }
                result.add(new Area(
                        area.kind(), area.id(), targetClusterId, area.label(), List.copyOf(cells), area.topologyRef()));
            } else {
                result.add(area);
            }
        }
        return List.copyOf(result);
    }

    private static List<Area> deletedRoomCells(List<Area> areas, Set<Cell> rectangle) {
        List<Area> result = new ArrayList<>();
        for (Area area : areas) {
            if (!area.kind().isRoom()) {
                result.add(area);
                continue;
            }
            List<Cell> cells = area.cells().stream().filter(cell -> !rectangle.contains(cell)).toList();
            if (!cells.isEmpty()) {
                result.add(new Area(
                        area.kind(), area.id(), area.clusterId(), area.label(), cells, area.topologyRef()));
            }
        }
        return List.copyOf(result);
    }

    private static Set<Cell> rectangle(Cell start, Cell end) {
        if (start.level() != end.level()) {
            return Set.of();
        }
        LinkedHashSet<Cell> result = new LinkedHashSet<>();
        for (int r = Math.min(start.r(), end.r()); r <= Math.max(start.r(), end.r()); r++) {
            for (int q = Math.min(start.q(), end.q()); q <= Math.max(start.q(), end.q()); q++) {
                result.add(new Cell(q, r, start.level()));
            }
        }
        return Set.copyOf(result);
    }

    private static @Nullable Cell endpointCell(DungeonEditorWorkspaceValues.CorridorEndpoint endpoint) {
        return switch (endpoint) {
            case DungeonEditorWorkspaceValues.CorridorDoorEndpoint door ->
                    door.direction().neighborOf(door.roomCell());
            case DungeonEditorWorkspaceValues.CorridorAnchorEndpoint anchor -> anchor.anchorCell();
            case null -> null;
        };
    }

    private static features.dungeon.domain.core.structure.corridor.CorridorEndpointOrdering.EndpointRole endpointRole(
            DungeonEditorWorkspaceValues.CorridorEndpoint endpoint
    ) {
        return switch (endpoint) {
            case DungeonEditorWorkspaceValues.CorridorDoorEndpoint ignored ->
                    features.dungeon.domain.core.structure.corridor.CorridorEndpointOrdering.EndpointRole.DOOR;
            case DungeonEditorWorkspaceValues.CorridorAnchorEndpoint ignored ->
                    features.dungeon.domain.core.structure.corridor.CorridorEndpointOrdering.EndpointRole.ANCHOR;
            case null -> features.dungeon.domain.core.structure.corridor.CorridorEndpointOrdering.EndpointRole.EMPTY;
        };
    }

    private boolean deletedTargetHandle(
            DungeonEditorWorkspaceValues.Handle handle,
            CorridorDeletionTarget target
    ) {
        DungeonEditorWorkspaceValues.HandleRef ref = handle.ref();
        if (ref.corridorId() != target.corridorId()) {
            return false;
        }
        if (target.doorBinding()) {
            return ref.kind() == features.dungeon.api.DungeonEditorHandleKind.DOOR
                    && (target.topologyRefId() > 0L && ref.topologyRef().id() == target.topologyRefId()
                    || target.roomId() > 0L && ref.roomId() == target.roomId());
        }
        if (target.corridorAnchor()) {
            return ref.kind() == features.dungeon.api.DungeonEditorHandleKind.CORRIDOR_ANCHOR
                    && ref.topologyRef().id() == target.topologyRefId();
        }
        return target.corridorWaypoint()
                && ref.kind() == features.dungeon.api.DungeonEditorHandleKind.CORRIDOR_WAYPOINT
                && ref.index() == target.waypointIndex();
    }

    private List<Area> reroutedCorridorAreas(
            MapSnapshot committed,
            List<DungeonEditorWorkspaceValues.Handle> handles,
            long corridorId
    ) {
        List<Cell> endpoints = handles.stream()
                .filter(handle -> handle.ref().corridorId() == corridorId)
                .filter(handle -> handle.ref().kind() == features.dungeon.api.DungeonEditorHandleKind.DOOR
                        || handle.ref().kind() == features.dungeon.api.DungeonEditorHandleKind.CORRIDOR_ANCHOR)
                .sorted(java.util.Comparator.comparingInt(handle -> handle.ref().index()))
                .map(DungeonEditorWorkspaceValues.Handle::cell)
                .toList();
        List<Cell> waypoints = handles.stream()
                .filter(handle -> handle.ref().corridorId() == corridorId)
                .filter(handle -> handle.ref().kind() == features.dungeon.api.DungeonEditorHandleKind.CORRIDOR_WAYPOINT)
                .sorted(java.util.Comparator.comparingInt(handle -> handle.ref().index()))
                .map(DungeonEditorWorkspaceValues.Handle::cell)
                .toList();
        if (endpoints.size() < 2) {
            return committed.areas();
        }
        List<Cell> nodes = new ArrayList<>();
        nodes.add(endpoints.getFirst());
        nodes.addAll(waypoints);
        nodes.add(endpoints.getLast());
        Set<Cell> roomCells = new LinkedHashSet<>();
        committed.areas().stream().filter(area -> area.kind().isRoom()).forEach(area -> roomCells.addAll(area.cells()));
        LinkedHashSet<Cell> routeCells = new LinkedHashSet<>();
        for (int index = 1; index < nodes.size(); index++) {
            CorridorRoute segment = corridorRouting.routeWithLevelTransition(
                    nodes.get(index - 1), nodes.get(index), Set.copyOf(roomCells));
            if (!segment.present()) {
                return committed.areas();
            }
            routeCells.addAll(segment.cells());
        }
        return committed.areas().stream()
                .map(area -> area.kind().isCorridor() && area.id() == corridorId
                        ? new Area(area.kind(), area.id(), area.clusterId(), area.label(),
                                List.copyOf(routeCells), area.topologyRef())
                        : area)
                .toList();
    }

    private static MapSnapshot withAreas(MapSnapshot committed, List<Area> areas) {
        return new MapSnapshot(
                committed.topology(), committed.width(), committed.height(), areas,
                committed.boundaries(), committed.features(), committed.editorHandles());
    }
}
