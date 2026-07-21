package features.dungeon.adapter.sqlite.gateway;

import features.dungeon.adapter.sqlite.model.DungeonCorridorAnchorBindingRecord;
import features.dungeon.adapter.sqlite.model.DungeonCorridorAnchorRefRecord;
import features.dungeon.adapter.sqlite.model.DungeonCorridorRecord;
import features.dungeon.adapter.sqlite.model.DungeonPersistenceSchema;
import features.dungeon.adapter.sqlite.model.DungeonRoomCellRecord;
import features.dungeon.adapter.sqlite.model.DungeonWindowEntityRecord;
import features.dungeon.application.authored.command.DungeonPatch;
import features.dungeon.application.authored.command.DungeonPatchEntityRef;
import features.dungeon.application.authored.command.DungeonPatchResultFacts;
import features.dungeon.application.authored.command.CorridorChange;
import features.dungeon.application.authored.command.RoomClusterChange;
import features.dungeon.application.authored.command.RoomRegionChange;
import features.dungeon.api.DungeonChunkKey;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.Direction;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** Reconciles only patch-declared spatial identities and touched chunks. */
final class DungeonSqlitePatchSpatialWriter {

    private DungeonSqlitePatchSpatialWriter() {
    }

    static PreparedReconciliation prepare(Connection connection, DungeonPatch patch) throws SQLException {
        ImpactCandidates impact = impactCandidates(connection, patch);
        List<DungeonPatchEntityRef> refs = impact.refs();
        Map<DungeonPatchEntityRef, Set<DungeonChunkKey>> oldMemberships = loadMemberships(
                connection, patch.mapId().value(), refs);
        Set<Long> corridorIds = corridorIds(refs);
        Map<RouteKey, RouteRow> oldRoutes = loadRouteRows(connection, patch.mapId().value(), corridorIds);
        Map<DependencyKey, DependencyRow> oldDependencies = loadDependencyRows(
                connection, patch.mapId().value(), corridorIds);
        return new PreparedReconciliation(impact, oldMemberships, oldRoutes, oldDependencies);
    }

    static Map<DungeonChunkKey, Long> reconcile(
            Connection connection,
            DungeonPatch patch,
            PreparedReconciliation prepared
    ) throws SQLException {
        ImpactCandidates impact = prepared.impact();
        List<DungeonPatchEntityRef> refs = impact.refs();
        Map<DungeonPatchEntityRef, Set<DungeonChunkKey>> oldMemberships = prepared.oldMemberships();
        Map<RouteKey, RouteRow> oldRoutes = prepared.oldRoutes();
        Map<DependencyKey, DependencyRow> oldDependencies = prepared.oldDependencies();

        DungeonSqliteClosureBatchLoader.LoadResult closure = DungeonSqliteClosureBatchLoader.loadAll(
                connection, patch.mapId().value(), refs, new DungeonSqliteQueryCounter());
        Map<DungeonPatchEntityRef, Set<DungeonChunkKey>> preliminaryMemberships = new LinkedHashMap<>();
        Map<RouteKey, RouteRow> preliminaryRoutes = new LinkedHashMap<>();
        Map<DependencyKey, DependencyRow> preliminaryDependencies = new LinkedHashMap<>();
        Map<RouteKey, RouteRow> nextRoutes = new LinkedHashMap<>();
        Map<DependencyKey, DependencyRow> nextDependencies = new LinkedHashMap<>();
        for (DungeonPatchEntityRef ref : refs) {
            DungeonWindowEntityRecord record = closure.records().get(ref);
            preliminaryMemberships.put(ref, record == null
                    ? Set.of()
                    : memberships(patch.mapId().value(), record, Set.of(),
                            preliminaryRoutes, preliminaryDependencies, new LinkedHashMap<>()));
        }
        Set<DungeonChunkKey> blockerChunks = blockerChunks(oldMemberships, preliminaryMemberships);
        Set<Cell> blockers = loadRoomCells(connection, patch.mapId().value(), blockerChunks);
        Map<DungeonPatchEntityRef, Set<DungeonChunkKey>> nextMemberships = new LinkedHashMap<>();
        Map<DungeonPatchEntityRef, Map<DungeonChunkKey, CellExtent>> nextExtents = new LinkedHashMap<>();
        for (DungeonPatchEntityRef ref : refs) {
            DungeonWindowEntityRecord record = closure.records().get(ref);
            Map<DungeonChunkKey, CellExtent> extents = new LinkedHashMap<>();
            nextMemberships.put(ref, record == null
                    ? Set.of()
                    : memberships(patch.mapId().value(), record, blockers,
                            nextRoutes, nextDependencies, extents));
            nextExtents.put(ref, Map.copyOf(extents));
        }

        List<DungeonPatchEntityRef> affected = affectedRefs(
                impact, oldMemberships, nextMemberships, oldRoutes, nextRoutes);
        assertDeclaredEntities(patch, affected);
        oldMemberships = membershipsFor(oldMemberships, affected);
        nextMemberships = membershipsFor(nextMemberships, affected);
        nextExtents = extentsFor(nextExtents, affected);
        Set<Long> affectedCorridors = corridorIds(affected);
        oldRoutes = routesFor(oldRoutes, affectedCorridors);
        nextRoutes = routesFor(nextRoutes, affectedCorridors);
        oldDependencies = dependenciesFor(oldDependencies, affectedCorridors);
        nextDependencies = dependenciesFor(nextDependencies, affectedCorridors);
        assertExactChunks(patch, oldMemberships, nextMemberships, oldRoutes, nextRoutes);
        upsertTouchedChunks(connection, patch);
        Set<Integer> affectedLevels = affectedLevels(oldMemberships, nextExtents);
        reconcileMembershipRows(connection, patch.mapId().value(), oldMemberships, nextExtents);
        reconcileRouteRows(connection, oldRoutes, nextRoutes);
        reconcileDependencyRows(connection, oldDependencies, nextDependencies);
        recomputeLevelBounds(connection, patch.mapId().value(), affectedLevels);
        Map<DungeonChunkKey, Long> result = new LinkedHashMap<>();
        patch.touchedChunks().stream().sorted(DungeonChunkKeyOrder.ORDER)
                .forEach(key -> result.put(key, patch.committedRevision()));
        return Map.copyOf(result);
    }

    static Map<DungeonChunkKey, Long> reconcile(Connection connection, DungeonPatch patch) throws SQLException {
        return reconcile(connection, patch, prepare(connection, patch));
    }

    private static ImpactCandidates impactCandidates(Connection connection, DungeonPatch patch) throws SQLException {
        LinkedHashSet<DungeonPatchEntityRef> direct = new LinkedHashSet<>();
        Set<Long> roomIds = new LinkedHashSet<>();
        Set<Long> clusterIds = new LinkedHashSet<>();
        Set<Long> changedHostCorridorIds = new LinkedHashSet<>();
        Set<Cell> changedRoomCells = new LinkedHashSet<>();
        patch.changes().forEach(change -> {
            direct.add(change.entityRef());
            if (change instanceof RoomRegionChange room) {
                roomIds.add(room.entityRef().id());
                addRoomImpact(room.before(), clusterIds, changedRoomCells);
                addRoomImpact(room.after(), clusterIds, changedRoomCells);
            } else if (change instanceof RoomClusterChange cluster) {
                clusterIds.add(cluster.entityRef().id());
            } else if (change instanceof CorridorChange corridor
                    && anchorsChanged(corridor)) {
                changedHostCorridorIds.add(corridor.entityRef().id());
            }
        });
        clusterIds.addAll(loadOwningClusters(connection, patch.mapId().value(), roomIds));
        LinkedHashSet<Long> corridorCandidates = new LinkedHashSet<>();
        direct.stream().filter(ref -> ref.kind() == DungeonPatchEntityRef.Kind.CORRIDOR)
                .forEach(ref -> corridorCandidates.add(ref.id()));
        corridorCandidates.addAll(loadRoomCorridors(connection, patch.mapId().value(), roomIds));
        corridorCandidates.addAll(loadClusterCorridors(connection, patch.mapId().value(), clusterIds));
        corridorCandidates.addAll(loadAnchorDependents(
                connection, patch.mapId().value(), changedHostCorridorIds));
        corridorCandidates.addAll(loadRouteDependencyDependents(
                connection, patch.mapId().value(), changedRoomCells));

        LinkedHashSet<DungeonPatchEntityRef> refs = new LinkedHashSet<>(direct);
        clusterIds.stream().filter(id -> id > 0L).map(DungeonPatchEntityRef::roomCluster).forEach(refs::add);
        corridorCandidates.stream().filter(id -> id > 0L).map(DungeonPatchEntityRef::corridor).forEach(refs::add);
        return new ImpactCandidates(sorted(refs), Set.copyOf(direct), Set.copyOf(clusterIds));
    }

    private static void addRoomImpact(
            features.dungeon.domain.core.structure.room.RoomRegion room,
            Set<Long> clusterIds,
            Set<Cell> cells
    ) {
        if (room != null) {
            clusterIds.add(room.clusterId());
            cells.addAll(room.floorCells());
        }
    }

    private static boolean anchorsChanged(CorridorChange change) {
        List<features.dungeon.domain.core.component.CorridorAnchor> before = change.before() == null
                ? List.of() : change.before().bindings().anchorBindings();
        List<features.dungeon.domain.core.component.CorridorAnchor> after = change.after() == null
                ? List.of() : change.after().bindings().anchorBindings();
        return !before.equals(after);
    }

    private static List<DungeonPatchEntityRef> affectedRefs(
            ImpactCandidates impact,
            Map<DungeonPatchEntityRef, Set<DungeonChunkKey>> oldMemberships,
            Map<DungeonPatchEntityRef, Set<DungeonChunkKey>> nextMemberships,
            Map<RouteKey, RouteRow> oldRoutes,
            Map<RouteKey, RouteRow> nextRoutes
    ) {
        LinkedHashSet<DungeonPatchEntityRef> refs = new LinkedHashSet<>(impact.directRefs());
        impact.clusterIds().stream().filter(id -> id > 0L)
                .map(DungeonPatchEntityRef::roomCluster).forEach(refs::add);
        for (DungeonPatchEntityRef candidate : impact.refs()) {
            if (candidate.kind() == DungeonPatchEntityRef.Kind.CORRIDOR
                    && (impact.directRefs().contains(candidate)
                    || !oldMemberships.getOrDefault(candidate, Set.of())
                            .equals(nextMemberships.getOrDefault(candidate, Set.of()))
                    || !routesFor(oldRoutes, Set.of(candidate.id()))
                            .equals(routesFor(nextRoutes, Set.of(candidate.id()))))) {
                refs.add(candidate);
            }
        }
        return sorted(refs);
    }

    private static List<DungeonPatchEntityRef> sorted(Iterable<DungeonPatchEntityRef> source) {
        LinkedHashSet<DungeonPatchEntityRef> refs = new LinkedHashSet<>();
        source.forEach(refs::add);
        return refs.stream().sorted(Comparator.comparing((DungeonPatchEntityRef ref) -> ref.kind().name())
                .thenComparingLong(DungeonPatchEntityRef::id)).toList();
    }

    private static Set<Long> loadOwningClusters(
            Connection connection,
            long mapId,
            Set<Long> roomIds
    ) throws SQLException {
        Set<Long> result = new LinkedHashSet<>();
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT cluster_id FROM dungeon_rooms WHERE dungeon_map_id=? AND room_id=?")) {
            for (long roomId : roomIds) {
                statement.setLong(1, mapId);
                statement.setLong(2, roomId);
                try (ResultSet rows = statement.executeQuery()) {
                    if (rows.next()) {
                        result.add(rows.getLong(1));
                    }
                }
            }
        }
        return Set.copyOf(result);
    }

    private static Set<Long> loadRoomCorridors(
            Connection connection,
            long mapId,
            Set<Long> roomIds
    ) throws SQLException {
        Set<Long> result = new LinkedHashSet<>();
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT m.corridor_id FROM dungeon_corridor_members m "
                        + "JOIN dungeon_corridors c ON c.corridor_id=m.corridor_id "
                        + "WHERE c.dungeon_map_id=? AND m.room_id=?")) {
            for (long roomId : roomIds) {
                statement.setLong(1, mapId);
                statement.setLong(2, roomId);
                addIds(statement, result);
            }
        }
        return Set.copyOf(result);
    }

    private static Set<Long> loadClusterCorridors(
            Connection connection,
            long mapId,
            Set<Long> clusterIds
    ) throws SQLException {
        Set<Long> result = new LinkedHashSet<>();
        String sql = "SELECT m.corridor_id FROM dungeon_corridor_members m "
                + "JOIN dungeon_corridors c ON c.corridor_id=m.corridor_id "
                + "JOIN dungeon_rooms r ON r.room_id=m.room_id "
                + "WHERE c.dungeon_map_id=? AND r.cluster_id=? "
                + "UNION SELECT w.corridor_id FROM dungeon_corridor_waypoints w "
                + "JOIN dungeon_corridors c ON c.corridor_id=w.corridor_id "
                + "WHERE c.dungeon_map_id=? AND w.cluster_id=? "
                + "UNION SELECT d.corridor_id FROM dungeon_corridor_door_overrides d "
                + "JOIN dungeon_corridors c ON c.corridor_id=d.corridor_id "
                + "WHERE c.dungeon_map_id=? AND d.cluster_id=?";
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            for (long clusterId : clusterIds) {
                statement.setLong(1, mapId);
                statement.setLong(2, clusterId);
                statement.setLong(3, mapId);
                statement.setLong(4, clusterId);
                statement.setLong(5, mapId);
                statement.setLong(6, clusterId);
                addIds(statement, result);
            }
        }
        return Set.copyOf(result);
    }

    private static Set<Long> loadAnchorDependents(
            Connection connection,
            long mapId,
            Set<Long> hostCorridorIds
    ) throws SQLException {
        Set<Long> result = new LinkedHashSet<>();
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT a.corridor_id FROM dungeon_corridor_anchor_refs a "
                        + "JOIN dungeon_corridors c ON c.corridor_id=a.corridor_id "
                        + "WHERE c.dungeon_map_id=? AND a.host_corridor_id=?")) {
            for (long hostId : hostCorridorIds) {
                statement.setLong(1, mapId);
                statement.setLong(2, hostId);
                addIds(statement, result);
            }
        }
        return Set.copyOf(result);
    }

    private static Set<Long> loadRouteDependencyDependents(
            Connection connection,
            long mapId,
            Set<Cell> cells
    ) throws SQLException {
        Set<Long> result = new LinkedHashSet<>();
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT corridor_id FROM dungeon_corridor_route_dependencies "
                        + "WHERE dungeon_map_id=? AND level_z=? AND cell_x=? AND cell_y=?")) {
            for (Cell cell : cells) {
                statement.setLong(1, mapId);
                statement.setInt(2, cell.level());
                statement.setInt(3, cell.q());
                statement.setInt(4, cell.r());
                addIds(statement, result);
            }
        }
        return Set.copyOf(result);
    }

    private static void addIds(PreparedStatement statement, Set<Long> result) throws SQLException {
        try (ResultSet rows = statement.executeQuery()) {
            while (rows.next()) {
                result.add(rows.getLong(1));
            }
        }
    }

    private static Set<Long> corridorIds(List<DungeonPatchEntityRef> refs) {
        Set<Long> result = new LinkedHashSet<>();
        refs.stream().filter(ref -> ref.kind() == DungeonPatchEntityRef.Kind.CORRIDOR)
                .forEach(ref -> result.add(ref.id()));
        return Set.copyOf(result);
    }

    private static Set<DungeonChunkKey> blockerChunks(
            Map<DungeonPatchEntityRef, Set<DungeonChunkKey>> oldMemberships,
            Map<DungeonPatchEntityRef, Set<DungeonChunkKey>> nextMemberships
    ) {
        Set<DungeonChunkKey> result = new LinkedHashSet<>();
        for (DungeonPatchEntityRef ref : oldMemberships.keySet()) {
            Set<DungeonChunkKey> occupied = new LinkedHashSet<>(oldMemberships.getOrDefault(ref, Set.of()));
            occupied.addAll(nextMemberships.getOrDefault(ref, Set.of()));
            if (ref.kind() != DungeonPatchEntityRef.Kind.CORRIDOR) {
                result.addAll(occupied);
                continue;
            }
            Map<Integer, ChunkBounds> boundsByLevel = new LinkedHashMap<>();
            for (DungeonChunkKey chunk : occupied) {
                boundsByLevel.compute(chunk.level(), (ignored, bounds) -> bounds == null
                        ? ChunkBounds.at(chunk.chunkQ(), chunk.chunkR())
                        : bounds.include(chunk.chunkQ(), chunk.chunkR()));
            }
            long mapId = occupied.isEmpty() ? 0L : occupied.iterator().next().mapId();
            boundsByLevel.forEach((level, bounds) -> bounds.addChunks(result, mapId, level));
        }
        return Set.copyOf(result);
    }

    private static Map<DungeonPatchEntityRef, Set<DungeonChunkKey>> loadMemberships(
            Connection connection, long mapId, List<DungeonPatchEntityRef> refs) throws SQLException {
        Map<DungeonPatchEntityRef, Set<DungeonChunkKey>> result = new LinkedHashMap<>();
        refs.forEach(ref -> result.put(ref, new LinkedHashSet<>()));
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT level_z,chunk_q,chunk_r FROM dungeon_entity_chunks "
                        + "WHERE dungeon_map_id=? AND entity_kind=? AND entity_id=?")) {
            for (DungeonPatchEntityRef ref : refs) {
                statement.setLong(1, mapId); statement.setString(2, ref.kind().name()); statement.setLong(3, ref.id());
                try (ResultSet rows = statement.executeQuery()) {
                    while (rows.next()) result.get(ref).add(new DungeonChunkKey(
                            mapId, rows.getInt(1), rows.getInt(2), rows.getInt(3)));
                }
            }
        }
        Map<DungeonPatchEntityRef, Set<DungeonChunkKey>> copy = new LinkedHashMap<>();
        result.forEach((key, value) -> copy.put(key, Set.copyOf(value)));
        return Map.copyOf(copy);
    }

    private static Map<RouteKey, RouteRow> loadRouteRows(Connection connection, long mapId, Set<Long> ids)
            throws SQLException {
        Map<RouteKey, RouteRow> result = new LinkedHashMap<>();
        if (ids.isEmpty()) return result;
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT corridor_id,segment_order,cell_order,level_z,cell_x,cell_y,chunk_q,chunk_r "
                        + "FROM dungeon_corridor_route_cells WHERE dungeon_map_id=? AND corridor_id=?")) {
            for (long id : ids) {
                statement.setLong(1, mapId); statement.setLong(2, id);
                try (ResultSet rows = statement.executeQuery()) {
                    while (rows.next()) {
                        RouteRow row = new RouteRow(mapId, rows.getLong(1), rows.getInt(2), rows.getInt(3),
                                rows.getInt(4), rows.getInt(5), rows.getInt(6), rows.getInt(7), rows.getInt(8));
                        result.put(row.key(), row);
                    }
                }
            }
        }
        return result;
    }

    private static Map<DependencyKey, DependencyRow> loadDependencyRows(
            Connection connection,
            long mapId,
            Set<Long> ids
    ) throws SQLException {
        Map<DependencyKey, DependencyRow> result = new LinkedHashMap<>();
        if (ids.isEmpty()) return result;
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT corridor_id,level_z,cell_x,cell_y FROM dungeon_corridor_route_dependencies "
                        + "WHERE dungeon_map_id=? AND corridor_id=?")) {
            for (long id : ids) {
                statement.setLong(1, mapId);
                statement.setLong(2, id);
                try (ResultSet rows = statement.executeQuery()) {
                    while (rows.next()) {
                        DependencyRow row = new DependencyRow(
                                mapId, rows.getLong(1), rows.getInt(2), rows.getInt(3), rows.getInt(4));
                        result.put(row.key(), row);
                    }
                }
            }
        }
        return result;
    }

    private static Set<Cell> loadRoomCells(Connection connection, long mapId, Set<DungeonChunkKey> chunks)
            throws SQLException {
        if (chunks.isEmpty()) return Set.of();
        StringBuilder sql = new StringBuilder("SELECT rc.level_z,rc.cell_x,rc.cell_y FROM dungeon_room_cells rc "
                + "JOIN dungeon_rooms r ON r.room_id=rc.room_id WHERE r.dungeon_map_id=? AND (");
        for (int index = 0; index < chunks.size(); index++) {
            if (index > 0) sql.append(" OR ");
            sql.append("(rc.level_z=? AND rc.cell_x BETWEEN ? AND ? AND rc.cell_y BETWEEN ? AND ?)");
        }
        sql.append(')');
        Set<Cell> result = new LinkedHashSet<>();
        try (PreparedStatement statement = connection.prepareStatement(sql.toString())) {
            statement.setLong(1, mapId); int parameter = 2;
            for (DungeonChunkKey chunk : chunks) {
                statement.setInt(parameter++, chunk.level());
                statement.setInt(parameter++, chunk.chunkQ() * DungeonChunkKey.CHUNK_SIZE);
                statement.setInt(parameter++, chunk.chunkQ() * DungeonChunkKey.CHUNK_SIZE + DungeonChunkKey.CHUNK_SIZE - 1);
                statement.setInt(parameter++, chunk.chunkR() * DungeonChunkKey.CHUNK_SIZE);
                statement.setInt(parameter++, chunk.chunkR() * DungeonChunkKey.CHUNK_SIZE + DungeonChunkKey.CHUNK_SIZE - 1);
            }
            try (ResultSet rows = statement.executeQuery()) {
                while (rows.next()) result.add(new Cell(rows.getInt(2), rows.getInt(3), rows.getInt(1)));
            }
        }
        return Set.copyOf(result);
    }

    private static Set<DungeonChunkKey> memberships(long mapId,
            DungeonWindowEntityRecord record, Set<Cell> blockers, Map<RouteKey, RouteRow> routes,
            Map<DependencyKey, DependencyRow> dependencies,
            Map<DungeonChunkKey, CellExtent> extents) {
        Set<DungeonChunkKey> result = new LinkedHashSet<>();
        if (record instanceof DungeonWindowEntityRecord.Room room) {
            room.value().floorCells().forEach(cell -> add(result, extents, mapId, cell.levelZ(), cell.cellX(), cell.cellY()));
        } else if (record instanceof DungeonWindowEntityRecord.RoomCluster cluster) {
            cluster.memberRooms().forEach(room -> room.floorCells()
                    .forEach(cell -> add(result, extents, mapId, cell.levelZ(), cell.cellX(), cell.cellY())));
            cluster.value().boundaries().forEach(boundary -> {
                Cell boundaryCell = new Cell(boundary.cellX(), boundary.cellY(), boundary.levelZ());
                Direction.parse(boundary.edgeDirection()).edgeOf(boundaryCell).touchingCells()
                        .forEach(cell -> add(result, extents, mapId, cell.level(), cell.q(), cell.r()));
            });
        } else if (record instanceof DungeonWindowEntityRecord.Corridor corridor) {
            corridorMembership(result, extents, routes, dependencies, mapId, corridor, blockers);
        } else if (record instanceof DungeonWindowEntityRecord.Stair stair) {
            stair.value().pathNodes().forEach(node -> add(result, extents, mapId, node.cellZ(), node.cellX(), node.cellY()));
            stair.value().exits().forEach(exit -> add(result, extents, mapId, exit.cellZ(), exit.cellX(), exit.cellY()));
        } else if (record instanceof DungeonWindowEntityRecord.Transition transition) {
            if (transition.value().cellX() != null && transition.value().cellY() != null
                    && transition.value().levelZ() != null) {
                add(result, extents, mapId, transition.value().levelZ(), transition.value().cellX(), transition.value().cellY());
            }
        } else if (record instanceof DungeonWindowEntityRecord.FeatureMarker marker) {
            add(result, extents, mapId, marker.value().levelZ(), marker.value().cellX(), marker.value().cellY());
        }
        return Set.copyOf(result);
    }

    private static void corridorMembership(Set<DungeonChunkKey> membership,
            Map<DungeonChunkKey, CellExtent> extents,
            Map<RouteKey, RouteRow> routeRows, Map<DependencyKey, DependencyRow> dependencyRows,
            long mapId, DungeonWindowEntityRecord.Corridor graph,
            Set<Cell> blockers) {
        DungeonCorridorRecord corridor = graph.value();
        List<Cell> waypoints = new ArrayList<>();
        corridor.waypoints().forEach(waypoint -> {
            Cell cell = new Cell(waypoint.relativeX(), waypoint.relativeY(), waypoint.relativeZ());
            waypoints.add(cell);
            add(membership, extents, mapId, cell.level(), cell.q(), cell.r());
        });
        List<Cell> doors = new ArrayList<>();
        corridor.doorBindings().forEach(door -> {
            Cell roomCell = new Cell(
                    door.relativeCellX(), door.relativeCellY(), door.relativeCellZ());
            add(membership, extents, mapId, roomCell.level(), roomCell.q(), roomCell.r());
            doors.add(Direction.parse(door.edgeDirection()).neighborOf(roomCell));
        });
        Map<AnchorTopologyKey, DungeonCorridorAnchorBindingRecord> anchors = new LinkedHashMap<>();
        List<DungeonCorridorRecord> all = new ArrayList<>(graph.anchorHosts()); all.add(corridor);
        all.forEach(candidate -> candidate.anchorBindings().forEach(anchor -> {
            if (anchor.topologyElementId() != null) anchors.put(
                    new AnchorTopologyKey(anchor.hostCorridorId(), anchor.topologyElementId()), anchor);
        }));
        corridor.anchorBindings().forEach(anchor -> add(
                membership, extents, mapId, anchor.cellZ(), anchor.cellX(), anchor.cellY()));
        List<Cell> anchorEndpoints = new ArrayList<>();
        for (DungeonCorridorAnchorRefRecord ref : corridor.anchorRefs()) {
            if (ref.topologyElementId() == null) continue;
            DungeonCorridorAnchorBindingRecord anchor = anchors.get(
                    new AnchorTopologyKey(ref.hostCorridorId(), ref.topologyElementId()));
            if (anchor != null) {
                Cell cell = new Cell(anchor.cellX(), anchor.cellY(), anchor.cellZ());
                anchorEndpoints.add(cell); add(membership, extents, mapId, cell.level(), cell.q(), cell.r());
            }
        }
        for (Cell cell : DungeonSqliteCorridorRouteFacts.dependencyCells(waypoints, doors, anchorEndpoints)) {
            DependencyRow row = new DependencyRow(
                    mapId, corridor.corridorId(), cell.level(), cell.q(), cell.r());
            dependencyRows.put(row.key(), row);
        }
        for (DungeonSqliteCorridorRouteFacts.RouteCell route
                : DungeonSqliteCorridorRouteFacts.routeCells(waypoints, doors, anchorEndpoints, blockers)) {
            Cell cell = route.cell(); DungeonChunkKey chunk = containing(mapId, cell.level(), cell.q(), cell.r());
            add(membership, extents, mapId, cell.level(), cell.q(), cell.r());
            RouteRow row = new RouteRow(mapId, corridor.corridorId(), route.segmentOrder(), route.cellOrder(),
                    cell.level(), cell.q(), cell.r(), chunk.chunkQ(), chunk.chunkR());
            routeRows.put(row.key(), row);
        }
    }

    private static void assertDeclaredEntities(
            DungeonPatch patch,
            List<DungeonPatchEntityRef> affected
    ) {
        DungeonPatchResultFacts canonical = new DungeonPatchResultFacts(affected);
        if (!patch.resultFacts().equals(canonical)) {
            throw new IllegalStateException(
                    "patch result facts do not match derived spatial dependencies: expected "
                            + canonical.affectedEntities() + " but got "
                            + patch.resultFacts().affectedEntities());
        }
    }

    private static Map<DungeonPatchEntityRef, Set<DungeonChunkKey>> membershipsFor(
            Map<DungeonPatchEntityRef, Set<DungeonChunkKey>> source,
            List<DungeonPatchEntityRef> refs
    ) {
        Map<DungeonPatchEntityRef, Set<DungeonChunkKey>> result = new LinkedHashMap<>();
        for (DungeonPatchEntityRef ref : refs) {
            result.put(ref, source.getOrDefault(ref, Set.of()));
        }
        return result;
    }

    private static Map<DungeonPatchEntityRef, Map<DungeonChunkKey, CellExtent>> extentsFor(
            Map<DungeonPatchEntityRef, Map<DungeonChunkKey, CellExtent>> source,
            List<DungeonPatchEntityRef> refs
    ) {
        Map<DungeonPatchEntityRef, Map<DungeonChunkKey, CellExtent>> result = new LinkedHashMap<>();
        for (DungeonPatchEntityRef ref : refs) {
            result.put(ref, source.getOrDefault(ref, Map.of()));
        }
        return result;
    }

    private static Map<RouteKey, RouteRow> routesFor(
            Map<RouteKey, RouteRow> source,
            Set<Long> corridorIds
    ) {
        Map<RouteKey, RouteRow> result = new LinkedHashMap<>();
        source.forEach((key, row) -> {
            if (corridorIds.contains(key.corridorId())) {
                result.put(key, row);
            }
        });
        return result;
    }

    private static Map<DependencyKey, DependencyRow> dependenciesFor(
            Map<DependencyKey, DependencyRow> source,
            Set<Long> corridorIds
    ) {
        Map<DependencyKey, DependencyRow> result = new LinkedHashMap<>();
        source.forEach((key, row) -> {
            if (corridorIds.contains(key.corridorId())) {
                result.put(key, row);
            }
        });
        return result;
    }

    private static void assertExactChunks(DungeonPatch patch,
            Map<DungeonPatchEntityRef, Set<DungeonChunkKey>> oldMemberships,
            Map<DungeonPatchEntityRef, Set<DungeonChunkKey>> nextMemberships,
            Map<RouteKey, RouteRow> oldRoutes, Map<RouteKey, RouteRow> nextRoutes) {
        Set<DungeonChunkKey> declared = patch.touchedChunks();
        Set<DungeonChunkKey> derived = new LinkedHashSet<>();
        oldMemberships.values().forEach(derived::addAll); nextMemberships.values().forEach(derived::addAll);
        oldRoutes.values().forEach(row -> derived.add(row.chunk()));
        nextRoutes.values().forEach(row -> derived.add(row.chunk()));
        if (!declared.equals(derived)) {
            Set<DungeonChunkKey> missing = new LinkedHashSet<>(derived); missing.removeAll(declared);
            Set<DungeonChunkKey> extra = new LinkedHashSet<>(declared); extra.removeAll(derived);
            throw new IllegalStateException(
                    "patch touched chunks do not match derived spatial impact: missing="
                            + missing + ", extra=" + extra);
        }
    }

    private static void upsertTouchedChunks(Connection connection, DungeonPatch patch) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "INSERT INTO dungeon_chunks(dungeon_map_id,level_z,chunk_q,chunk_r,content_revision) VALUES(?,?,?,?,?) "
                        + "ON CONFLICT(dungeon_map_id,level_z,chunk_q,chunk_r) DO UPDATE "
                        + "SET content_revision=excluded.content_revision")) {
            for (DungeonChunkKey key : patch.touchedChunks()) {
                statement.setLong(1, key.mapId()); statement.setInt(2, key.level());
                statement.setInt(3, key.chunkQ()); statement.setInt(4, key.chunkR());
                statement.setLong(5, patch.committedRevision()); statement.addBatch();
            }
            statement.executeBatch();
        }
    }

    private static void reconcileMembershipRows(Connection connection, long mapId,
            Map<DungeonPatchEntityRef, Set<DungeonChunkKey>> oldRows,
            Map<DungeonPatchEntityRef, Map<DungeonChunkKey, CellExtent>> nextRows) throws SQLException {
        try (PreparedStatement delete = connection.prepareStatement(
                "DELETE FROM dungeon_entity_chunks WHERE dungeon_map_id=? AND entity_kind=? AND entity_id=?");
             PreparedStatement insert = connection.prepareStatement(
                     "INSERT INTO dungeon_entity_chunks(dungeon_map_id,entity_kind,entity_id,level_z,chunk_q,chunk_r,"
                             + "minimum_q,minimum_r,maximum_q,maximum_r,entity_chunk_count) "
                             + "VALUES(?,?,?,?,?,?,?,?,?,?,?)")) {
            for (DungeonPatchEntityRef ref : oldRows.keySet()) {
                delete.setLong(1, mapId);
                delete.setString(2, ref.kind().name());
                delete.setLong(3, ref.id());
                delete.addBatch();
                Map<DungeonChunkKey, CellExtent> next = nextRows.getOrDefault(ref, Map.of());
                for (Map.Entry<DungeonChunkKey, CellExtent> entry : next.entrySet()) {
                    bindMembership(insert, ref, entry.getKey(), entry.getValue(), next.size());
                    insert.addBatch();
                }
            }
            delete.executeBatch(); insert.executeBatch();
        }
    }

    private static void bindMembership(PreparedStatement statement, DungeonPatchEntityRef ref, DungeonChunkKey key,
            CellExtent extent, int entityChunkCount)
            throws SQLException {
        statement.setLong(1, key.mapId()); statement.setString(2, ref.kind().name()); statement.setLong(3, ref.id());
        statement.setInt(4, key.level()); statement.setInt(5, key.chunkQ()); statement.setInt(6, key.chunkR());
        statement.setInt(7, extent.minimumQ()); statement.setInt(8, extent.minimumR());
        statement.setInt(9, extent.maximumQ()); statement.setInt(10, extent.maximumR());
        statement.setInt(11, entityChunkCount);
    }

    private static Set<Integer> affectedLevels(
            Map<DungeonPatchEntityRef, Set<DungeonChunkKey>> oldRows,
            Map<DungeonPatchEntityRef, Map<DungeonChunkKey, CellExtent>> nextRows
    ) {
        Set<Integer> levels = new LinkedHashSet<>();
        oldRows.values().forEach(chunks -> chunks.forEach(chunk -> levels.add(chunk.level())));
        nextRows.values().forEach(chunks -> chunks.keySet().forEach(chunk -> levels.add(chunk.level())));
        return Set.copyOf(levels);
    }

    private static void recomputeLevelBounds(Connection connection, long mapId, Set<Integer> levels)
            throws SQLException {
        try (PreparedStatement delete = connection.prepareStatement(
                    "DELETE FROM dungeon_authored_level_bounds WHERE dungeon_map_id=? AND level_z=?");
             PreparedStatement extrema = connection.prepareStatement(
                    "SELECT MIN(minimum_q),MIN(minimum_r),MAX(maximum_q),MAX(maximum_r) "
                            + "FROM dungeon_entity_chunks WHERE dungeon_map_id=? AND level_z=?");
             PreparedStatement insert = connection.prepareStatement(
                    "INSERT INTO dungeon_authored_level_bounds(dungeon_map_id,level_z,minimum_q,minimum_r,maximum_q,maximum_r) "
                            + "VALUES(?,?,?,?,?,?)")) {
            for (int level : levels) {
                delete.setLong(1, mapId); delete.setInt(2, level); delete.executeUpdate();
                extrema.setLong(1, mapId); extrema.setInt(2, level);
                try (ResultSet row = extrema.executeQuery()) {
                    if (row.next() && row.getObject(1) != null) {
                        insert.setLong(1, mapId); insert.setInt(2, level);
                        insert.setInt(3, row.getInt(1)); insert.setInt(4, row.getInt(2));
                        insert.setInt(5, row.getInt(3)); insert.setInt(6, row.getInt(4));
                        insert.executeUpdate();
                    }
                }
            }
        }
    }

    private static void reconcileRouteRows(Connection connection, Map<RouteKey, RouteRow> oldRows,
            Map<RouteKey, RouteRow> nextRows) throws SQLException {
        try (PreparedStatement delete = connection.prepareStatement(
                "DELETE FROM dungeon_corridor_route_cells WHERE dungeon_map_id=? AND corridor_id=? "
                        + "AND segment_order=? AND cell_order=?");
             PreparedStatement insert = connection.prepareStatement(
                     "INSERT INTO dungeon_corridor_route_cells(dungeon_map_id,corridor_id,segment_order,cell_order,"
                             + "level_z,cell_x,cell_y,chunk_q,chunk_r) VALUES(?,?,?,?,?,?,?,?,?)")) {
            for (var entry : oldRows.entrySet()) {
                RouteRow next = nextRows.get(entry.getKey());
                if (next == null || !entry.getValue().equals(next)) {
                    bindRouteKey(delete, entry.getKey(), 1);
                    delete.addBatch();
                }
            }
            for (var entry : nextRows.entrySet()) {
                RouteRow old = oldRows.get(entry.getKey()); RouteRow next = entry.getValue();
                if (old == null || !old.equals(next)) {
                    bindRouteInsert(insert, next);
                    insert.addBatch();
                }
            }
            delete.executeBatch();
            insert.executeBatch();
        }
    }

    private static void reconcileDependencyRows(
            Connection connection,
            Map<DependencyKey, DependencyRow> oldRows,
            Map<DependencyKey, DependencyRow> nextRows
    ) throws SQLException {
        try (PreparedStatement delete = connection.prepareStatement(
                "DELETE FROM dungeon_corridor_route_dependencies WHERE dungeon_map_id=? AND corridor_id=? "
                        + "AND level_z=? AND cell_x=? AND cell_y=?");
             PreparedStatement insert = connection.prepareStatement(
                     "INSERT INTO dungeon_corridor_route_dependencies("
                             + "dungeon_map_id,corridor_id,level_z,cell_x,cell_y) VALUES(?,?,?,?,?)")) {
            for (DependencyKey key : difference(oldRows.keySet(), nextRows.keySet())) {
                bindDependency(delete, key);
                delete.addBatch();
            }
            for (DependencyKey key : difference(nextRows.keySet(), oldRows.keySet())) {
                bindDependency(insert, key);
                insert.addBatch();
            }
            delete.executeBatch();
            insert.executeBatch();
        }
    }

    private static void bindDependency(PreparedStatement statement, DependencyKey key) throws SQLException {
        statement.setLong(1, key.mapId());
        statement.setLong(2, key.corridorId());
        statement.setInt(3, key.level());
        statement.setInt(4, key.x());
        statement.setInt(5, key.y());
    }

    private static void bindRouteKey(PreparedStatement statement, RouteKey key, int start) throws SQLException {
        statement.setLong(start, key.mapId()); statement.setLong(start + 1, key.corridorId());
        statement.setInt(start + 2, key.segment()); statement.setInt(start + 3, key.order());
    }

    private static void bindRouteInsert(PreparedStatement statement, RouteRow row) throws SQLException {
        bindRouteKey(statement, row.key(), 1); statement.setInt(5, row.level()); statement.setInt(6, row.x());
        statement.setInt(7, row.y()); statement.setInt(8, row.chunkQ()); statement.setInt(9, row.chunkR());
    }

    private static <T> Set<T> difference(Set<T> left, Set<T> right) {
        Set<T> result = new LinkedHashSet<>(left); result.removeAll(right); return result;
    }

    private static void add(Set<DungeonChunkKey> result, Map<DungeonChunkKey, CellExtent> extents,
            long mapId, int level, int x, int y) {
        DungeonChunkKey chunk = containing(mapId, level, x, y);
        result.add(chunk);
        extents.compute(chunk, (ignored, extent) -> extent == null
                ? CellExtent.at(x, y) : extent.include(x, y));
    }

    private static DungeonChunkKey containing(long mapId, int level, int x, int y) {
        return new DungeonChunkKey(mapId, level, Math.floorDiv(x, DungeonChunkKey.CHUNK_SIZE),
                Math.floorDiv(y, DungeonChunkKey.CHUNK_SIZE));
    }

    private record AnchorTopologyKey(long hostCorridorId, long topologyId) { }
    private record ImpactCandidates(
            List<DungeonPatchEntityRef> refs,
            Set<DungeonPatchEntityRef> directRefs,
            Set<Long> clusterIds
    ) {
        private ImpactCandidates {
            refs = List.copyOf(refs);
            directRefs = Set.copyOf(directRefs);
            clusterIds = Set.copyOf(clusterIds);
        }
    }
    record PreparedReconciliation(
            ImpactCandidates impact,
            Map<DungeonPatchEntityRef, Set<DungeonChunkKey>> oldMemberships,
            Map<RouteKey, RouteRow> oldRoutes,
            Map<DependencyKey, DependencyRow> oldDependencies
    ) {
        PreparedReconciliation {
            oldMemberships = Map.copyOf(oldMemberships);
            oldRoutes = Map.copyOf(oldRoutes);
            oldDependencies = Map.copyOf(oldDependencies);
        }
    }
    private record ChunkBounds(int minQ, int maxQ, int minR, int maxR) {
        static ChunkBounds at(int q, int r) {
            return new ChunkBounds(q, q, r, r);
        }

        ChunkBounds include(int q, int r) {
            return new ChunkBounds(
                    Math.min(minQ, q), Math.max(maxQ, q), Math.min(minR, r), Math.max(maxR, r));
        }

        void addChunks(Set<DungeonChunkKey> target, long mapId, int level) {
            for (int q = minQ; q <= maxQ; q++) {
                for (int r = minR; r <= maxR; r++) {
                    target.add(new DungeonChunkKey(mapId, level, q, r));
                }
            }
        }
    }
    private record CellExtent(int minimumQ, int minimumR, int maximumQ, int maximumR) {
        static CellExtent at(int q, int r) {
            return new CellExtent(q, r, q, r);
        }

        CellExtent include(int q, int r) {
            return new CellExtent(Math.min(minimumQ, q), Math.min(minimumR, r),
                    Math.max(maximumQ, q), Math.max(maximumR, r));
        }
    }
    private record RouteKey(long mapId, long corridorId, int segment, int order) { }
    private record DependencyKey(long mapId, long corridorId, int level, int x, int y) { }
    private record DependencyRow(long mapId, long corridorId, int level, int x, int y) {
        DependencyKey key() { return new DependencyKey(mapId, corridorId, level, x, y); }
    }
    private record RouteRow(long mapId, long corridorId, int segment, int order, int level, int x, int y,
            int chunkQ, int chunkR) {
        RouteKey key() { return new RouteKey(mapId, corridorId, segment, order); }
        DungeonChunkKey chunk() { return new DungeonChunkKey(mapId, level, chunkQ, chunkR); }
    }
    private static final class DungeonChunkKeyOrder {
        private static final Comparator<DungeonChunkKey> ORDER = Comparator.comparingLong(DungeonChunkKey::mapId)
                .thenComparingInt(DungeonChunkKey::level).thenComparingInt(DungeonChunkKey::chunkR)
                .thenComparingInt(DungeonChunkKey::chunkQ);
    }
}
