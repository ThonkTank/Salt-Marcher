package features.dungeon.application.authored;

import features.dungeon.api.DungeonAreaKind;
import features.dungeon.api.DungeonAreaSnapshot;
import features.dungeon.api.DungeonBoundarySnapshot;
import features.dungeon.api.DungeonCellRef;
import features.dungeon.api.DungeonChunkKey;
import features.dungeon.api.DungeonEditorHandleKind;
import features.dungeon.api.DungeonEditorHandleRef;
import features.dungeon.api.DungeonEditorHandleSnapshot;
import features.dungeon.api.DungeonEdgeRef;
import features.dungeon.api.DungeonFeatureKind;
import features.dungeon.api.DungeonFeatureSnapshot;
import features.dungeon.api.DungeonTopologyElementKind;
import features.dungeon.api.DungeonTopologyElementRef;
import features.dungeon.api.DungeonTopologyKind;
import features.dungeon.api.DungeonViewportContinuation;
import features.dungeon.api.DungeonViewportRequest;
import features.dungeon.api.DungeonViewportSnapshot;
import features.dungeon.application.authored.port.DungeonWindow;
import features.dungeon.application.authored.port.DungeonWindowContinuation;
import features.dungeon.application.authored.port.DungeonWindowEntityFragment;
import features.dungeon.application.editor.session.DungeonEditorDungeonState;
import features.dungeon.application.editor.session.DungeonEditorWorkspaceValues;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.Direction;
import features.dungeon.domain.core.geometry.DungeonBoundaryKey;
import features.dungeon.domain.core.geometry.DungeonTopology;
import features.dungeon.domain.core.geometry.Edge;
import features.dungeon.domain.core.geometry.EdgeKey;
import features.dungeon.domain.core.component.boundary.BoundaryMap;
import features.dungeon.domain.core.component.boundary.BoundarySegment;
import features.dungeon.domain.core.graph.DungeonTopologyRef;
import features.dungeon.domain.core.projection.DungeonAreaType;
import features.dungeon.domain.core.projection.DungeonFeatureType;
import features.dungeon.domain.core.structure.room.RoomClusterBoundaryMaterialization.BoundaryKind;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

/** Projects typed partial authored facts without constructing a partial aggregate. */
final class DungeonWindowProjection {
    private static final Comparator<Cell> CELL_ORDER = Comparator
            .comparingInt(Cell::level)
            .thenComparingInt(Cell::r)
            .thenComparingInt(Cell::q);
    DungeonEditorDungeonState.SnapshotFacts editorSnapshot(DungeonWindow window, int level) {
        Projection projection = project(window, level);
        return new DungeonEditorDungeonState.SnapshotFacts(
                new DungeonEditorWorkspaceValues.MapId(window.mapHeader().mapId().value()),
                window.requestGeneration(),
                window.mapHeader().revision(),
                window.mapHeader().mapName(),
                DungeonPublishedMapProjectionServiceAssembly.revision(window.mapHeader().revision()),
                projection.workspace());
    }

    DungeonViewportSnapshot viewport(DungeonViewportRequest request, DungeonWindow window) {
        Projection projection = project(window, request.level());
        Map<DungeonChunkKey, Long> chunkRevisions = new LinkedHashMap<>();
        window.chunkHeaders().forEach(header -> chunkRevisions.put(header.key(), header.contentRevision()));
        return new DungeonViewportSnapshot(
                window.mapHeader().mapId().value(),
                window.mapHeader().revision(),
                window.requestGeneration(),
                request.level(),
                DungeonTopologyKind.SQUARE,
                Set.copyOf(chunkRevisions.keySet()),
                Map.copyOf(chunkRevisions),
                projection.publicAreas(),
                projection.publicBoundaries(),
                projection.publicFeatures(),
                projection.publicHandles(),
                continuations(window),
                projection.bounds());
    }

    private Projection project(DungeonWindow window, int level) {
        Objects.requireNonNull(window, "window");
        List<DungeonEditorWorkspaceValues.Area> areas = new ArrayList<>();
        List<DungeonEditorWorkspaceValues.Boundary> boundaries = new ArrayList<>();
        List<DungeonEditorWorkspaceValues.Feature> features = new ArrayList<>();
        List<DungeonEditorWorkspaceValues.Handle> handles = new ArrayList<>();
        Set<features.dungeon.application.authored.command.DungeonPatchEntityRef> fragmentRefs = window.fragments()
                .stream()
                .map(DungeonWindowEntityFragment::entityRef)
                .collect(java.util.stream.Collectors.toUnmodifiableSet());
        Set<features.dungeon.application.authored.command.DungeonPatchEntityRef> continuedRefs = window.continuations()
                .stream()
                .map(DungeonWindowContinuation::entityRef)
                .collect(java.util.stream.Collectors.toUnmodifiableSet());

        for (DungeonWindowEntityFragment fragment : window.fragments()) {
            switch (fragment) {
                case DungeonWindowEntityFragment.Room room -> addRoom(areas, room);
                case DungeonWindowEntityFragment.RoomCluster cluster -> {
                    addClusterBoundaries(boundaries, cluster);
                    boolean incomplete = continuedRefs.contains(cluster.entityRef())
                            || cluster.dependencyHeaders().stream().anyMatch(dependency -> !fragmentRefs.contains(dependency));
                    addClusterHandles(handles, cluster, incomplete);
                }
                case DungeonWindowEntityFragment.Corridor corridor ->
                        addCorridor(areas, boundaries, handles, corridor);
                case DungeonWindowEntityFragment.Stair stair -> addStair(features, handles, stair);
                case DungeonWindowEntityFragment.Transition transition -> addTransition(features, transition);
                case DungeonWindowEntityFragment.FeatureMarker marker -> addMarker(features, marker);
            }
        }
        areas = mergeClusterMemberCells(areas, window.fragments());
        boundaries = deduplicateBoundaries(boundaries);
        handles = deduplicateDoorHandles(handles);
        WorkspaceBounds dimensions = workspaceBounds(areas, boundaries, features, handles, level);
        DungeonEditorWorkspaceValues.MapSnapshot workspace = new DungeonEditorWorkspaceValues.MapSnapshot(
                DungeonTopology.SQUARE,
                dimensions.width(),
                dimensions.height(),
                List.copyOf(areas),
                List.copyOf(boundaries),
                List.copyOf(features),
                List.copyOf(handles));
        return new Projection(
                workspace,
                publicAreas(areas),
                publicBoundaries(boundaries),
                publicFeatures(features),
                publicHandles(handles),
                dimensions.publicBounds());
    }

    private static List<DungeonEditorWorkspaceValues.Area> mergeClusterMemberCells(
            List<DungeonEditorWorkspaceValues.Area> areas,
            List<DungeonWindowEntityFragment> fragments
    ) {
        Map<Long, LinkedHashSet<Cell>> cellsByRoom = new LinkedHashMap<>();
        for (DungeonWindowEntityFragment fragment : fragments) {
            if (!(fragment instanceof DungeonWindowEntityFragment.RoomCluster cluster)) {
                continue;
            }
            cluster.memberCells().forEach(member -> cellsByRoom
                    .computeIfAbsent(member.roomId(), ignored -> new LinkedHashSet<>())
                    .add(member.cell()));
        }
        List<DungeonEditorWorkspaceValues.Area> result = new ArrayList<>();
        for (DungeonEditorWorkspaceValues.Area area : areas) {
            if (!area.kind().isRoom() || !cellsByRoom.containsKey(area.id())) {
                result.add(area);
                continue;
            }
            LinkedHashSet<Cell> cells = new LinkedHashSet<>(area.cells());
            cells.addAll(cellsByRoom.get(area.id()));
            result.add(new DungeonEditorWorkspaceValues.Area(
                    area.kind(), area.id(), area.clusterId(), area.label(), List.copyOf(cells), area.topologyRef()));
        }
        return List.copyOf(result);
    }

    private static List<DungeonEditorWorkspaceValues.Boundary> deduplicateBoundaries(
            List<DungeonEditorWorkspaceValues.Boundary> boundaries
    ) {
        Map<DungeonBoundaryKey, DungeonEditorWorkspaceValues.Boundary> unique = new LinkedHashMap<>();
        for (DungeonEditorWorkspaceValues.Boundary boundary : boundaries) {
            DungeonBoundaryKey identity = DungeonBoundaryKey.from(boundary.edge());
            DungeonEditorWorkspaceValues.Boundary existing = unique.get(identity);
            if (existing == null
                    || (!existing.kind().isDoor() && boundary.kind().isDoor())
                    || boundary.label().startsWith("Corridor")) {
                unique.put(identity, boundary);
            }
        }
        return List.copyOf(unique.values());
    }

    private static List<DungeonEditorWorkspaceValues.Handle> deduplicateDoorHandles(
            List<DungeonEditorWorkspaceValues.Handle> handles
    ) {
        List<DungeonEditorWorkspaceValues.Handle> nonDoors = new ArrayList<>();
        Map<DoorIdentity, DungeonEditorWorkspaceValues.Handle> doors = new LinkedHashMap<>();
        for (DungeonEditorWorkspaceValues.Handle handle : handles) {
            if (handle.ref().kind() != DungeonEditorHandleKind.DOOR) {
                nonDoors.add(handle);
                continue;
            }
            DoorIdentity identity = DoorIdentity.of(handle.ref());
            DungeonEditorWorkspaceValues.Handle existing = doors.get(identity);
            if (existing == null || handle.ref().corridorId() > 0L) {
                doors.put(identity, handle);
            }
        }
        nonDoors.addAll(doors.values());
        return List.copyOf(nonDoors);
    }

    private static void addRoom(
            List<DungeonEditorWorkspaceValues.Area> result,
            DungeonWindowEntityFragment.Room room
    ) {
        long id = room.entityRef().id();
        result.add(new DungeonEditorWorkspaceValues.Area(
                DungeonAreaType.ROOM,
                id,
                room.clusterId(),
                room.name(),
                room.floorCells(),
                roomRef(id)));
    }

    private static void addClusterBoundaries(
            List<DungeonEditorWorkspaceValues.Boundary> result,
            DungeonWindowEntityFragment.RoomCluster cluster
    ) {
        for (DungeonWindowEntityFragment.ClusterBoundaryFact boundary : cluster.boundaries()) {
            if (boundary.kind() == DungeonWindowEntityFragment.BoundaryKind.OPEN) {
                continue;
            }
            Edge edge = boundary.direction().edgeOf(boundary.cell());
            long id = boundary.topologyRef().present()
                    ? boundary.topologyRef().id()
                    : DungeonBoundaryKey.from(edge).stableId();
            BoundaryKind kind = boundary.kind() == DungeonWindowEntityFragment.BoundaryKind.DOOR
                    ? BoundaryKind.DOOR
                    : BoundaryKind.WALL;
            result.add(new DungeonEditorWorkspaceValues.Boundary(
                    kind,
                    id,
                    kind.isDoor() ? "Door" : "Wall",
                    edge,
                    boundary.topologyRef()));
        }
    }

    private static void addClusterHandles(
            List<DungeonEditorWorkspaceValues.Handle> result,
            DungeonWindowEntityFragment.RoomCluster cluster,
            boolean incomplete
    ) {
        long clusterId = cluster.entityRef().id();
        long roomId = cluster.memberCells().stream()
                .mapToLong(DungeonWindowEntityFragment.ClusterMemberCellFact::roomId)
                .min()
                .orElse(0L);
        if (roomId <= 0L || cluster.memberCells().isEmpty()) {
            return;
        }
        addExactLocalDoorHandles(result, cluster);
        if (incomplete) {
            return;
        }
        List<Cell> memberCells = cluster.memberCells().stream()
                .map(DungeonWindowEntityFragment.ClusterMemberCellFact::cell)
                .toList();
        Cell labelCell = centroid(memberCells);
        result.add(handle(
                DungeonEditorHandleKind.CLUSTER_LABEL,
                roomRef(roomId),
                clusterId,
                clusterId,
                0L,
                roomId,
                0,
                labelCell,
                Direction.NORTH,
                cluster.name(),
                null,
                List.of()));

        Map<EdgeKey, DungeonWindowEntityFragment.ClusterBoundaryFact> factsByEdge = new LinkedHashMap<>();
        List<BoundarySegment> segments = new ArrayList<>();
        for (DungeonWindowEntityFragment.ClusterBoundaryFact boundary : cluster.boundaries()) {
            Edge edge = boundary.direction().edgeOf(boundary.cell());
            EdgeKey key = EdgeKey.from(edge);
            factsByEdge.put(key, boundary);
            segments.add(new BoundarySegment(key, switch (boundary.kind()) {
                case WALL -> features.dungeon.domain.core.component.boundary.BoundaryKind.WALL;
                case DOOR -> features.dungeon.domain.core.component.boundary.BoundaryKind.DOOR;
                case OPEN -> features.dungeon.domain.core.component.boundary.BoundaryKind.OPEN;
            }));
        }
        BoundaryMap boundaryMap = new BoundaryMap(segments);
        List<Integer> levels = cluster.memberCells().stream()
                .map(member -> member.cell().level())
                .distinct()
                .sorted()
                .toList();
        List<Cell> corners = levels.stream()
                .flatMap(memberLevel -> boundaryMap.boundaryCornersAt(memberLevel).stream())
                .map(features.dungeon.domain.core.component.boundary.BoundaryCorner::cell)
                .sorted(CELL_ORDER)
                .toList();
        for (int index = 0; index < corners.size(); index++) {
            Cell corner = corners.get(index);
            result.add(handle(
                    DungeonEditorHandleKind.CLUSTER_CORNER,
                    roomRef(roomId),
                    roomId,
                    clusterId,
                    0L,
                    roomId,
                    index,
                    corner,
                    Direction.NORTH,
                    "Ecke " + (index + 1),
                    null,
                    List.of()));
        }
        int wallRunIndex = 0;
        for (int memberLevel : levels) {
            for (features.dungeon.domain.core.component.boundary.WallRun run : boundaryMap.wallRunsAt(memberLevel)) {
                List<Edge> sourceEdges = run.edgeKeys().stream()
                        .map(key -> new Edge(key.lower(), key.upper()))
                        .toList();
                Edge sourceEdge = sourceEdges.get(sourceEdges.size() / 2);
                DungeonWindowEntityFragment.ClusterBoundaryFact sourceFact = factsByEdge.get(EdgeKey.from(sourceEdge));
                Direction direction = sourceFact == null ? boundaryDirection(sourceEdge) : sourceFact.direction();
                result.add(handle(
                        DungeonEditorHandleKind.CLUSTER_WALL_RUN,
                        roomRef(roomId),
                        clusterId,
                        clusterId,
                        0L,
                        roomId,
                        wallRunIndex,
                        run.anchorCell(),
                        direction,
                        "Wandlauf " + (wallRunIndex + 1),
                        sourceEdge,
                        sourceEdges));
                wallRunIndex++;
            }
        }
    }

    private static void addExactLocalDoorHandles(
            List<DungeonEditorWorkspaceValues.Handle> result,
            DungeonWindowEntityFragment.RoomCluster cluster
    ) {
        Map<Cell, Long> roomByCell = new LinkedHashMap<>();
        cluster.memberCells().forEach(member -> roomByCell.putIfAbsent(member.cell(), member.roomId()));
        int doorIndex = 0;
        for (DungeonWindowEntityFragment.ClusterBoundaryFact boundary : cluster.boundaries()) {
            Long roomId = roomByCell.get(boundary.cell());
            if (boundary.kind() != DungeonWindowEntityFragment.BoundaryKind.DOOR
                    || !boundary.topologyRef().present()
                    || roomId == null
                    || roomId <= 0L) {
                continue;
            }
            Edge edge = boundary.direction().edgeOf(boundary.cell());
            Cell handleCell = boundary.direction().neighborOf(boundary.cell());
            result.add(handle(
                    DungeonEditorHandleKind.DOOR,
                    boundary.topologyRef(),
                    boundary.topologyRef().id(),
                    cluster.entityRef().id(),
                    0L,
                    roomId,
                    doorIndex,
                    handleCell,
                    boundary.direction(),
                    "Tür " + boundary.topologyRef().id(),
                    edge,
                    List.of(edge)));
            doorIndex++;
        }
    }

    private static void addCorridor(
            List<DungeonEditorWorkspaceValues.Area> areas,
            List<DungeonEditorWorkspaceValues.Boundary> boundaries,
            List<DungeonEditorWorkspaceValues.Handle> handles,
            DungeonWindowEntityFragment.Corridor corridor
    ) {
        long corridorId = corridor.entityRef().id();
        List<Cell> corridorCells = corridor.routeCells().stream()
                .map(DungeonWindowEntityFragment.CorridorRouteCellFact::cell)
                .distinct()
                .toList();
        if (!corridorCells.isEmpty()) {
            areas.add(new DungeonEditorWorkspaceValues.Area(
                    DungeonAreaType.CORRIDOR,
                    corridorId,
                    0L,
                    "Corridor " + corridorId,
                    corridorCells,
                    new DungeonTopologyRef(
                            features.dungeon.domain.core.graph.DungeonTopologyElementKind.CORRIDOR,
                            corridorId)));
        }
        for (DungeonWindowEntityFragment.CorridorDoorFact door : corridor.doorBindings()) {
            Edge edge = door.direction().edgeOf(door.absoluteCell());
            long id = door.topologyRef().present()
                    ? door.topologyRef().id()
                    : DungeonBoundaryKey.from(edge).stableId();
            boundaries.add(new DungeonEditorWorkspaceValues.Boundary(
                    BoundaryKind.DOOR,
                    id,
                    "Corridor Door",
                    edge,
                    door.topologyRef()));
            handles.add(handle(
                    DungeonEditorHandleKind.DOOR,
                    door.topologyRef(),
                    door.topologyRef().present() ? door.topologyRef().id() : corridorId,
                    door.clusterId(),
                    corridorId,
                    door.roomId(),
                    door.sortOrder(),
                    door.direction().neighborOf(door.absoluteCell()),
                    door.direction(),
                    "Tür " + corridorId + "." + (door.sortOrder() + 1),
                    edge,
                    List.of(edge)));
        }
        corridor.anchorBindings().forEach(anchor -> handles.add(handle(
                DungeonEditorHandleKind.CORRIDOR_ANCHOR,
                anchor.topologyRef(),
                anchor.anchorId(),
                0L,
                corridorId,
                0L,
                anchor.sortOrder(),
                anchor.cell(),
                Direction.NORTH,
                "Korridoranker " + (anchor.sortOrder() + 1),
                null,
                List.of())));
        corridor.waypoints().forEach(waypoint -> handles.add(handle(
                DungeonEditorHandleKind.CORRIDOR_WAYPOINT,
                corridorRef(corridorId),
                corridorId,
                waypoint.clusterId(),
                corridorId,
                0L,
                waypoint.sortOrder(),
                waypoint.absoluteCell(),
                Direction.NORTH,
                "Wegpunkt " + (waypoint.sortOrder() + 1),
                null,
                List.of())));
    }

    private static void addStair(
            List<DungeonEditorWorkspaceValues.Feature> features,
            List<DungeonEditorWorkspaceValues.Handle> handles,
            DungeonWindowEntityFragment.Stair stair
    ) {
        long stairId = stair.entityRef().id();
        List<Cell> cells = new ArrayList<>();
        stair.path().forEach(path -> cells.add(path.cell()));
        stair.exits().forEach(exit -> cells.add(exit.cell()));
        List<Cell> distinctCells = cells.stream().distinct().sorted(CELL_ORDER).toList();
        String destinations = stair.exits().stream()
                .map(DungeonWindowEntityFragment.StairExitFact::label)
                .distinct()
                .sorted(String.CASE_INSENSITIVE_ORDER)
                .collect(java.util.stream.Collectors.joining(", "));
        features.add(new DungeonEditorWorkspaceValues.Feature(
                DungeonFeatureType.STAIR,
                stairId,
                stair.name(),
                distinctCells,
                stair.name() + " verbindet " + stair.exits().size() + " Ausgaenge.",
                destinations,
                stairRef(stairId),
                null));
        int index = 0;
        for (DungeonWindowEntityFragment.StairPathFact path : stair.path()) {
            handles.add(handle(
                    DungeonEditorHandleKind.STAIR_ANCHOR,
                    stairRef(stairId),
                    stairId,
                    0L,
                    stair.corridorId() == null ? 0L : stair.corridorId(),
                    0L,
                    index++,
                    path.cell(),
                    stair.direction(),
                    "Treppenanker " + index,
                    null,
                    List.of()));
        }
        for (DungeonWindowEntityFragment.StairExitFact exit : stair.exits()) {
            handles.add(handle(
                    DungeonEditorHandleKind.STAIR_ANCHOR,
                    stairRef(stairId),
                    stairId,
                    0L,
                    stair.corridorId() == null ? 0L : stair.corridorId(),
                    0L,
                    index++,
                    exit.cell(),
                    stair.direction(),
                    exit.label(),
                    null,
                    List.of()));
        }
    }

    private static void addTransition(
            List<DungeonEditorWorkspaceValues.Feature> result,
            DungeonWindowEntityFragment.Transition transition
    ) {
        long id = transition.entityRef().id();
        Cell cell = transition.anchor().cell();
        Edge edge = transition.anchor().isEdge()
                ? transition.anchor().edgeDirection().edgeOf(cell)
                : null;
        result.add(new DungeonEditorWorkspaceValues.Feature(
                DungeonFeatureType.TRANSITION,
                id,
                "Übergang " + id,
                edge == null ? List.of(cell) : List.of(),
                transition.description(),
                transition.destination().label(),
                transitionRef(id),
                edge));
    }

    private static void addMarker(
            List<DungeonEditorWorkspaceValues.Feature> result,
            DungeonWindowEntityFragment.FeatureMarker marker
    ) {
        DungeonFeatureType kind = switch (marker.kind()) {
            case OBJECT -> DungeonFeatureType.OBJECT;
            case ENCOUNTER -> DungeonFeatureType.ENCOUNTER;
            case POI -> DungeonFeatureType.POI;
        };
        long id = marker.entityRef().id();
        result.add(new DungeonEditorWorkspaceValues.Feature(
                kind,
                id,
                marker.label(),
                List.of(marker.anchor()),
                marker.description(),
                "",
                new DungeonTopologyRef(
                        features.dungeon.domain.core.graph.DungeonTopologyElementKind.FEATURE_MARKER,
                        id),
                null));
    }

    private static DungeonEditorWorkspaceValues.Handle handle(
            DungeonEditorHandleKind kind,
            DungeonTopologyRef topologyRef,
            long ownerId,
            long clusterId,
            long corridorId,
            long roomId,
            int index,
            Cell cell,
            Direction direction,
            String label,
            Edge sourceEdge,
            List<Edge> sourceEdges
    ) {
        return new DungeonEditorWorkspaceValues.Handle(
                new DungeonEditorWorkspaceValues.HandleRef(
                        kind,
                        topologyRef,
                        ownerId,
                        clusterId,
                        corridorId,
                        roomId,
                        index,
                        cell,
                        direction,
                        sourceEdge,
                        sourceEdges),
                label,
                cell);
    }

    private static Cell centroid(List<Cell> cells) {
        long q = 0L;
        long r = 0L;
        for (Cell cell : cells) {
            q += cell.q();
            r += cell.r();
        }
        Cell first = cells.getFirst();
        return new Cell((int) Math.round((double) q / cells.size()),
                (int) Math.round((double) r / cells.size()), first.level());
    }

    private static Direction boundaryDirection(Edge edge) {
        int deltaQ = edge.to().q() - edge.from().q();
        int deltaR = edge.to().r() - edge.from().r();
        if (Math.abs(deltaQ) >= Math.abs(deltaR)) {
            return deltaR >= 0 ? Direction.SOUTH : Direction.NORTH;
        }
        return deltaQ >= 0 ? Direction.EAST : Direction.WEST;
    }

    private static WorkspaceBounds workspaceBounds(
            List<DungeonEditorWorkspaceValues.Area> areas,
            List<DungeonEditorWorkspaceValues.Boundary> boundaries,
            List<DungeonEditorWorkspaceValues.Feature> features,
            List<DungeonEditorWorkspaceValues.Handle> handles,
            int level
    ) {
        BoundsAccumulator bounds = new BoundsAccumulator();
        areas.forEach(area -> area.cells().forEach(cell -> bounds.include(cell, level)));
        boundaries.forEach(boundary -> {
            bounds.include(boundary.edge().from(), level);
            bounds.include(boundary.edge().to(), level);
        });
        features.forEach(feature -> {
            feature.cells().forEach(cell -> bounds.include(cell, level));
            if (feature.anchorEdge() != null) {
                bounds.include(feature.anchorEdge().from(), level);
                bounds.include(feature.anchorEdge().to(), level);
            }
        });
        handles.forEach(handle -> bounds.include(handle.cell(), level));
        return bounds.snapshot();
    }

    private static List<DungeonAreaSnapshot> publicAreas(List<DungeonEditorWorkspaceValues.Area> areas) {
        return areas.stream().map(area -> new DungeonAreaSnapshot(
                area.kind() == DungeonAreaType.CORRIDOR ? DungeonAreaKind.CORRIDOR : DungeonAreaKind.ROOM,
                area.id(),
                area.clusterId(),
                area.label(),
                area.cells().stream().map(DungeonWindowProjection::cellRef).toList(),
                topologyRef(area.topologyRef()))).toList();
    }

    private static List<DungeonBoundarySnapshot> publicBoundaries(
            List<DungeonEditorWorkspaceValues.Boundary> boundaries
    ) {
        return boundaries.stream().map(boundary -> new DungeonBoundarySnapshot(
                boundary.kind().externalKind(),
                boundary.id(),
                boundary.label(),
                edgeRef(boundary.edge()),
                topologyRef(boundary.topologyRef()))).toList();
    }

    private static List<DungeonFeatureSnapshot> publicFeatures(
            List<DungeonEditorWorkspaceValues.Feature> features
    ) {
        return features.stream().map(feature -> new DungeonFeatureSnapshot(
                switch (feature.kind()) {
                    case STAIR -> DungeonFeatureKind.STAIR;
                    case TRANSITION -> DungeonFeatureKind.TRANSITION;
                    case OBJECT -> DungeonFeatureKind.OBJECT;
                    case ENCOUNTER -> DungeonFeatureKind.ENCOUNTER;
                    case POI -> DungeonFeatureKind.POI;
                },
                feature.id(),
                feature.label(),
                feature.cells().stream().map(DungeonWindowProjection::cellRef).toList(),
                feature.description(),
                feature.destinationLabel(),
                topologyRef(feature.topologyRef()),
                feature.anchorEdge() == null ? null : edgeRef(feature.anchorEdge()))).toList();
    }

    private static List<DungeonEditorHandleSnapshot> publicHandles(
            List<DungeonEditorWorkspaceValues.Handle> handles
    ) {
        return handles.stream().map(handle -> {
            var ref = handle.ref();
            DungeonCellRef cell = cellRef(handle.cell());
            return new DungeonEditorHandleSnapshot(
                    new DungeonEditorHandleRef(
                            ref.kind(),
                            topologyRef(ref.topologyRef()),
                            ref.ownerId(),
                            ref.clusterId(),
                            ref.corridorId(),
                            ref.roomId(),
                            ref.index(),
                            cell,
                            ref.direction().name(),
                            ref.sourceEdge() == null ? null : edgeRef(ref.sourceEdge()),
                            ref.sourceEdges().stream().map(DungeonWindowProjection::edgeRef).toList()),
                    handle.label(),
                    cell);
        }).toList();
    }

    private static List<DungeonViewportContinuation> continuations(DungeonWindow window) {
        List<DungeonViewportContinuation> result = new ArrayList<>();
        for (DungeonWindowContinuation continuation : window.continuations()) {
            DungeonTopologyElementRef topology = topologyRef(continuation.entityRef().kind(), continuation.entityRef().id());
            for (DungeonChunkKey chunk : continuation.offWindowChunks()) {
                result.add(new DungeonViewportContinuation(
                        continuation.entityRef().kind().name(),
                        continuation.entityRef().id(),
                        topology,
                        chunk));
            }
        }
        return List.copyOf(result);
    }

    private static DungeonTopologyElementRef topologyRef(
            features.dungeon.application.authored.command.DungeonPatchEntityRef.Kind kind,
            long id
    ) {
        return new DungeonTopologyElementRef(switch (kind) {
            case ROOM, ROOM_CLUSTER -> DungeonTopologyElementKind.ROOM;
            case CORRIDOR -> DungeonTopologyElementKind.CORRIDOR;
            case STAIR -> DungeonTopologyElementKind.STAIR;
            case TRANSITION -> DungeonTopologyElementKind.TRANSITION;
            case FEATURE_MARKER -> DungeonTopologyElementKind.FEATURE_MARKER;
        }, id);
    }

    private static DungeonTopologyElementRef topologyRef(DungeonTopologyRef ref) {
        if (ref == null || !ref.present()) {
            return DungeonTopologyElementRef.empty();
        }
        return new DungeonTopologyElementRef(
                DungeonTopologyElementKind.valueOf(ref.kind().name()),
                ref.id());
    }

    private static DungeonCellRef cellRef(Cell cell) {
        return new DungeonCellRef(cell.q(), cell.r(), cell.level());
    }

    private static DungeonEdgeRef edgeRef(Edge edge) {
        return new DungeonEdgeRef(cellRef(edge.from()), cellRef(edge.to()));
    }

    private static DungeonTopologyRef roomRef(long id) {
        return new DungeonTopologyRef(features.dungeon.domain.core.graph.DungeonTopologyElementKind.ROOM, id);
    }

    private static DungeonTopologyRef corridorRef(long id) {
        return new DungeonTopologyRef(features.dungeon.domain.core.graph.DungeonTopologyElementKind.CORRIDOR, id);
    }

    private static DungeonTopologyRef stairRef(long id) {
        return new DungeonTopologyRef(features.dungeon.domain.core.graph.DungeonTopologyElementKind.STAIR, id);
    }

    private static DungeonTopologyRef transitionRef(long id) {
        return new DungeonTopologyRef(features.dungeon.domain.core.graph.DungeonTopologyElementKind.TRANSITION, id);
    }

    private record DoorIdentity(DungeonTopologyRef topologyRef, DungeonBoundaryKey edgeKey) {
        private static DoorIdentity of(DungeonEditorWorkspaceValues.HandleRef ref) {
            return ref.topologyRef().present()
                    ? new DoorIdentity(ref.topologyRef(), null)
                    : new DoorIdentity(DungeonTopologyRef.empty(), DungeonBoundaryKey.from(ref.sourceEdge()));
        }
    }

    private record Projection(
            DungeonEditorWorkspaceValues.MapSnapshot workspace,
            List<DungeonAreaSnapshot> publicAreas,
            List<DungeonBoundarySnapshot> publicBoundaries,
            List<DungeonFeatureSnapshot> publicFeatures,
            List<DungeonEditorHandleSnapshot> publicHandles,
            DungeonViewportSnapshot.AuthoredBounds bounds
    ) {
    }

    private record WorkspaceBounds(
            boolean present,
            int minimumQ,
            int minimumR,
            int maximumQ,
            int maximumR
    ) {
        int width() {
            return present ? maximumQ - minimumQ + 1 : 1;
        }

        int height() {
            return present ? maximumR - minimumR + 1 : 1;
        }

        DungeonViewportSnapshot.AuthoredBounds publicBounds() {
            return new DungeonViewportSnapshot.AuthoredBounds(
                    present, minimumQ, minimumR, maximumQ, maximumR);
        }
    }

    private static final class BoundsAccumulator {
        private boolean present;
        private int minimumQ;
        private int minimumR;
        private int maximumQ;
        private int maximumR;

        private void include(Cell cell, int level) {
            if (cell == null || cell.level() != level) {
                return;
            }
            if (!present) {
                present = true;
                minimumQ = maximumQ = cell.q();
                minimumR = maximumR = cell.r();
                return;
            }
            minimumQ = Math.min(minimumQ, cell.q());
            minimumR = Math.min(minimumR, cell.r());
            maximumQ = Math.max(maximumQ, cell.q());
            maximumR = Math.max(maximumR, cell.r());
        }

        private WorkspaceBounds snapshot() {
            return new WorkspaceBounds(present, minimumQ, minimumR, maximumQ, maximumR);
        }
    }
}
