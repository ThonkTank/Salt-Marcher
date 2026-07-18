package features.dungeon.adapter.sqlite.gateway;

import features.dungeon.adapter.sqlite.model.DungeonClusterBoundaryRecord;
import features.dungeon.adapter.sqlite.model.DungeonCorridorAnchorBindingRecord;
import features.dungeon.adapter.sqlite.model.DungeonCorridorAnchorRefRecord;
import features.dungeon.adapter.sqlite.model.DungeonCorridorDoorBindingRecord;
import features.dungeon.adapter.sqlite.model.DungeonCorridorRecord;
import features.dungeon.adapter.sqlite.model.DungeonCorridorWaypointRecord;
import features.dungeon.adapter.sqlite.model.DungeonFeatureMarkerRecord;
import features.dungeon.adapter.sqlite.model.DungeonPersistenceSchema;
import features.dungeon.adapter.sqlite.model.DungeonRoomCellRecord;
import features.dungeon.adapter.sqlite.model.DungeonRoomClusterRecord;
import features.dungeon.adapter.sqlite.model.DungeonRoomExitDescriptionRecord;
import features.dungeon.adapter.sqlite.model.DungeonRoomRecord;
import features.dungeon.adapter.sqlite.model.DungeonStairExitRecord;
import features.dungeon.adapter.sqlite.model.DungeonStairPathNodeRecord;
import features.dungeon.adapter.sqlite.model.DungeonStairRecord;
import features.dungeon.adapter.sqlite.model.DungeonTransitionRecord;
import features.dungeon.adapter.sqlite.model.DungeonWindowEntityRecord;
import features.dungeon.application.authored.command.DungeonPatchEntityRef;
import features.dungeon.application.authored.port.DungeonIdentityClosureResult;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** Loads complete exact-identity graphs with a fixed statement set per requested family. */
final class DungeonSqliteClosureBatchLoader {

    private DungeonSqliteClosureBatchLoader() {
    }

    static LoadResult loadAll(
            Connection connection,
            long mapId,
            List<DungeonPatchEntityRef> refs,
            DungeonSqliteQueryCounter queries
    ) throws SQLException {
        Map<DungeonPatchEntityRef.Kind, List<Long>> ids = idsByKind(refs);
        Map<Long, RoomShell> requestedRoomShells = loadRoomShellsByIds(
                connection, mapId, ids.get(Kind.ROOM), queries);
        Map<Long, ClusterShell> clusterShells = loadClusterShells(
                connection, mapId, ids.get(Kind.ROOM_CLUSTER), queries);
        Map<Long, RoomShell> memberRoomShells = loadRoomShellsByClusters(
                connection, mapId, ids.get(Kind.ROOM_CLUSTER), queries);
        Map<Long, RoomShell> allRoomShells = new LinkedHashMap<>(requestedRoomShells);
        allRoomShells.putAll(memberRoomShells);
        Set<Long> malformedRoomIds = new LinkedHashSet<>();
        hydrateRoomChildren(connection, allRoomShells, malformedRoomIds, queries);
        Map<Long, DungeonRoomRecord> roomRecords = roomRecords(allRoomShells);
        Set<Long> malformedClusterIds = new LinkedHashSet<>();
        hydrateClusterBoundaries(connection, mapId, clusterShells, malformedClusterIds, queries);

        Set<Long> malformedCorridorIds = new LinkedHashSet<>();
        Map<Long, DungeonWindowEntityRecord.Corridor> corridorRecords = loadCorridors(
                connection, mapId, ids.get(Kind.CORRIDOR), malformedCorridorIds, queries);
        Map<Long, DungeonWindowEntityRecord.Stair> stairRecords = loadStairs(
                connection, mapId, ids.get(Kind.STAIR), queries);
        Map<Long, DungeonTransitionRecord> transitions = loadTransitions(
                connection, mapId, ids.get(Kind.TRANSITION), queries);
        Set<Long> incompleteMarkerIds = new LinkedHashSet<>();
        Map<Long, DungeonFeatureMarkerRecord> markers = loadMarkers(
                connection, mapId, ids.get(Kind.FEATURE_MARKER), incompleteMarkerIds, queries);

        Map<DungeonPatchEntityRef, DungeonWindowEntityRecord> result = new LinkedHashMap<>();
        Map<DungeonPatchEntityRef, DungeonIdentityClosureResult.Reason> rejections = new LinkedHashMap<>();
        for (DungeonPatchEntityRef ref : refs) {
            DungeonWindowEntityRecord record = switch (ref.kind()) {
                case ROOM -> roomRecord(roomRecords.get(ref.id()));
                case ROOM_CLUSTER -> clusterRecord(clusterShells.get(ref.id()), roomRecords);
                case CORRIDOR -> corridorRecords.get(ref.id());
                case STAIR -> stairRecords.get(ref.id());
                case TRANSITION -> value(transitions.get(ref.id()), DungeonWindowEntityRecord.Transition::new);
                case FEATURE_MARKER -> value(markers.get(ref.id()), DungeonWindowEntityRecord.FeatureMarker::new);
            };
            if (record != null) {
                result.put(ref, record);
                validateRequiredSource(record, rejections);
            }
        }
        for (RoomShell room : requestedRoomShells.values()) {
            if (blank(room.name) || malformedRoomIds.contains(room.id)) {
                rejections.put(
                        DungeonPatchEntityRef.room(room.id),
                        DungeonIdentityClosureResult.Reason.MALFORMED_ENTITY);
            }
        }
        for (ClusterShell cluster : clusterShells.values()) {
            boolean malformedMember = memberRoomShells.values().stream()
                    .filter(room -> room.clusterId == cluster.id)
                    .anyMatch(room -> blank(room.name) || malformedRoomIds.contains(room.id));
            if (blank(cluster.name) || malformedClusterIds.contains(cluster.id) || malformedMember) {
                rejections.put(
                        DungeonPatchEntityRef.roomCluster(cluster.id),
                        DungeonIdentityClosureResult.Reason.MALFORMED_ENTITY);
            }
        }
        for (Long corridorId : malformedCorridorIds) {
            rejections.put(
                    DungeonPatchEntityRef.corridor(corridorId),
                    DungeonIdentityClosureResult.Reason.MALFORMED_ENTITY);
        }
        for (Long markerId : incompleteMarkerIds) {
            rejections.put(
                    DungeonPatchEntityRef.featureMarker(markerId),
                    DungeonIdentityClosureResult.Reason.INCOMPLETE_ENTITY);
        }
        return new LoadResult(result, rejections);
    }

    record LoadResult(
            Map<DungeonPatchEntityRef, DungeonWindowEntityRecord> records,
            Map<DungeonPatchEntityRef, DungeonIdentityClosureResult.Reason> rejections
    ) {
        LoadResult {
            records = Map.copyOf(records);
            rejections = Map.copyOf(rejections);
        }
    }

    private static void validateRequiredSource(
            DungeonWindowEntityRecord record,
            Map<DungeonPatchEntityRef, DungeonIdentityClosureResult.Reason> rejections
    ) {
        if (record instanceof DungeonWindowEntityRecord.RoomCluster cluster) {
            for (DungeonClusterBoundaryRecord boundary : cluster.value().boundaries()) {
                String kind = boundary.edgeType().trim().toUpperCase(java.util.Locale.ROOT);
                if (("WALL".equals(kind) || "DOOR".equals(kind)) && boundary.topologyElementId() == null) {
                    rejections.put(record.ref(), DungeonIdentityClosureResult.Reason.INCOMPLETE_ENTITY);
                }
                if ("OPEN".equals(kind) && boundary.topologyElementId() != null) {
                    rejections.put(record.ref(), DungeonIdentityClosureResult.Reason.MALFORMED_ENTITY);
                }
            }
        } else if (record instanceof DungeonWindowEntityRecord.Corridor corridor) {
            boolean missingDoorTopology = corridor.value().doorBindings().stream()
                    .anyMatch(binding -> binding.topologyElementId() == null);
            boolean missingAnchorTopology = corridor.value().anchorBindings().stream()
                    .anyMatch(binding -> binding.topologyElementId() == null);
            boolean missingRefTopology = corridor.value().anchorRefs().stream()
                    .anyMatch(ref -> ref.topologyElementId() == null);
            if (missingDoorTopology || missingAnchorTopology || missingRefTopology) {
                rejections.put(record.ref(), DungeonIdentityClosureResult.Reason.INCOMPLETE_ENTITY);
            }
        } else if (record instanceof DungeonWindowEntityRecord.Stair stair && blank(stair.value().name())) {
            rejections.put(record.ref(), DungeonIdentityClosureResult.Reason.MALFORMED_ENTITY);
        }
    }

    private static boolean blank(String value) {
        return value == null || value.isBlank();
    }

    private static boolean cardinal(String value) {
        String normalized = value == null ? "" : value.trim().toUpperCase(java.util.Locale.ROOT);
        return Set.of("NORTH", "EAST", "SOUTH", "WEST").contains(normalized);
    }

    private static boolean boundaryKind(String value) {
        String normalized = value == null ? "" : value.trim().toUpperCase(java.util.Locale.ROOT);
        return Set.of("WALL", "DOOR", "OPEN").contains(normalized);
    }

    private static Map<Long, RoomShell> loadRoomShellsByIds(
            Connection connection, long mapId, List<Long> ids, DungeonSqliteQueryCounter queries
    ) throws SQLException {
        if (ids.isEmpty()) {
            return Map.of();
        }
        return loadRoomShells(connection,
                "dungeon_map_id=? AND room_id IN (" + placeholders(ids.size()) + ")",
                statement -> bindMapAndIds(statement, mapId, ids), queries);
    }

    private static Map<Long, RoomShell> loadRoomShellsByClusters(
            Connection connection, long mapId, List<Long> clusterIds, DungeonSqliteQueryCounter queries
    ) throws SQLException {
        if (clusterIds.isEmpty()) {
            return Map.of();
        }
        return loadRoomShells(connection,
                "dungeon_map_id=? AND cluster_id IN (" + placeholders(clusterIds.size()) + ")",
                statement -> bindMapAndIds(statement, mapId, clusterIds), queries);
    }

    private static Map<Long, RoomShell> loadRoomShells(
            Connection connection,
            String predicate,
            SqlBinder binder,
            DungeonSqliteQueryCounter queries
    ) throws SQLException {
        try (PreparedStatement statement = queries.prepare(connection,
                "SELECT room_id, dungeon_map_id, cluster_id, name, visual_description FROM "
                        + DungeonPersistenceSchema.ROOMS_TABLE + " WHERE " + predicate + " ORDER BY room_id")) {
            binder.bind(statement);
            try (ResultSet rows = statement.executeQuery()) {
                Map<Long, RoomShell> result = new LinkedHashMap<>();
                while (rows.next()) {
                    long id = rows.getLong("room_id");
                    result.put(id, new RoomShell(
                            id, rows.getLong("dungeon_map_id"), rows.getLong("cluster_id"),
                            rows.getString("name"), rows.getString("visual_description")));
                }
                return result;
            }
        }
    }

    private static void hydrateRoomChildren(
            Connection connection,
            Map<Long, RoomShell> rooms,
            Set<Long> malformedRoomIds,
            DungeonSqliteQueryCounter queries
    ) throws SQLException {
        if (rooms.isEmpty()) {
            return;
        }
        List<Long> ids = List.copyOf(rooms.keySet());
        try (PreparedStatement statement = queries.prepare(connection,
                "SELECT room_id, level_z, cell_x, cell_y FROM " + DungeonPersistenceSchema.ROOM_CELLS_TABLE
                        + " WHERE room_id IN (" + placeholders(ids.size()) + ")"
                        + " ORDER BY room_id, level_z, cell_y, cell_x")) {
            bindIds(statement, ids);
            try (ResultSet rows = statement.executeQuery()) {
                while (rows.next()) {
                    RoomShell room = rooms.get(rows.getLong("room_id"));
                    if (room != null) {
                        room.cells.add(new DungeonRoomCellRecord(
                                room.id, rows.getInt("level_z"), rows.getInt("cell_x"), rows.getInt("cell_y")));
                    }
                }
            }
        }
        try (PreparedStatement statement = queries.prepare(connection,
                "SELECT room_id, level_z, cell_x, cell_y, edge_direction, description FROM "
                        + DungeonPersistenceSchema.ROOM_EXIT_DESCRIPTIONS_TABLE
                        + " WHERE room_id IN (" + placeholders(ids.size()) + ")"
                        + " ORDER BY room_id, sort_order, level_z, cell_y, cell_x, edge_direction")) {
            bindIds(statement, ids);
            try (ResultSet rows = statement.executeQuery()) {
                while (rows.next()) {
                    RoomShell room = rooms.get(rows.getLong("room_id"));
                    if (room != null) {
                        String edgeDirection = rows.getString("edge_direction");
                        if (!cardinal(edgeDirection)) {
                            malformedRoomIds.add(room.id);
                        }
                        room.exits.add(new DungeonRoomExitDescriptionRecord(
                                room.id, rows.getInt("level_z"), rows.getInt("cell_x"), rows.getInt("cell_y"),
                                edgeDirection, rows.getString("description")));
                    }
                }
            }
        }
    }

    private static Map<Long, DungeonRoomRecord> roomRecords(Map<Long, RoomShell> shells) {
        Map<Long, DungeonRoomRecord> result = new LinkedHashMap<>();
        shells.forEach((id, shell) -> result.put(id, shell.record()));
        return result;
    }

    private static Map<Long, ClusterShell> loadClusterShells(
            Connection connection, long mapId, List<Long> ids, DungeonSqliteQueryCounter queries
    ) throws SQLException {
        if (ids.isEmpty()) {
            return Map.of();
        }
        try (PreparedStatement statement = queries.prepare(connection,
                "SELECT cluster_id, dungeon_map_id, name FROM " + DungeonPersistenceSchema.ROOM_CLUSTERS_TABLE
                        + " WHERE dungeon_map_id=? AND cluster_id IN (" + placeholders(ids.size()) + ")"
                        + " ORDER BY cluster_id")) {
            bindMapAndIds(statement, mapId, ids);
            try (ResultSet rows = statement.executeQuery()) {
                Map<Long, ClusterShell> result = new LinkedHashMap<>();
                while (rows.next()) {
                    long id = rows.getLong("cluster_id");
                    result.put(id, new ClusterShell(id, rows.getLong("dungeon_map_id"), rows.getString("name")));
                }
                return result;
            }
        }
    }

    private static void hydrateClusterBoundaries(
            Connection connection,
            long mapId,
            Map<Long, ClusterShell> clusters,
            Set<Long> malformedClusterIds,
            DungeonSqliteQueryCounter queries
    ) throws SQLException {
        if (clusters.isEmpty()) {
            return;
        }
        List<Long> ids = List.copyOf(clusters.keySet());
        try (PreparedStatement statement = queries.prepare(connection,
                "SELECT cluster_id, level_z, cell_x, cell_y, edge_direction, edge_type, topology_element_id"
                        + " FROM " + DungeonPersistenceSchema.ROOM_CLUSTER_EDGES_TABLE
                        + " WHERE dungeon_map_id=? AND cluster_id IN (" + placeholders(ids.size()) + ")"
                        + " ORDER BY cluster_id, level_z, cell_y, cell_x, edge_direction")) {
            bindMapAndIds(statement, mapId, ids);
            try (ResultSet rows = statement.executeQuery()) {
                while (rows.next()) {
                    ClusterShell cluster = clusters.get(rows.getLong("cluster_id"));
                    if (cluster != null) {
                        String edgeDirection = rows.getString("edge_direction");
                        String edgeType = rows.getString("edge_type");
                        if (!cardinal(edgeDirection) || !boundaryKind(edgeType)) {
                            malformedClusterIds.add(cluster.id);
                        }
                        cluster.boundaries.add(new DungeonClusterBoundaryRecord(
                                cluster.id, rows.getInt("level_z"), rows.getInt("cell_x"), rows.getInt("cell_y"),
                                edgeDirection, edgeType,
                                DungeonSqliteStatementSupport.nullableLong(rows, "topology_element_id")));
                    }
                }
            }
        }
    }

    private static DungeonWindowEntityRecord roomRecord(DungeonRoomRecord room) {
        return room == null ? null : new DungeonWindowEntityRecord.Room(room);
    }

    private static DungeonWindowEntityRecord clusterRecord(
            ClusterShell shell,
            Map<Long, DungeonRoomRecord> rooms
    ) {
        if (shell == null) {
            return null;
        }
        List<DungeonRoomRecord> members = rooms.values().stream()
                .filter(room -> room.clusterId() == shell.id)
                .toList();
        DungeonRoomCellRecord center = members.stream()
                .flatMap(room -> room.floorCells().stream())
                .min(java.util.Comparator.comparingInt(DungeonRoomCellRecord::levelZ)
                        .thenComparingInt(DungeonRoomCellRecord::cellY)
                        .thenComparingInt(DungeonRoomCellRecord::cellX))
                .orElse(new DungeonRoomCellRecord(0L, 0, 0, 0));
        return new DungeonWindowEntityRecord.RoomCluster(
                new DungeonRoomClusterRecord(
                        shell.id, shell.mapId, shell.name,
                        center.cellX(), center.cellY(), center.levelZ(), shell.boundaries),
                members);
    }

    private static Map<Long, DungeonWindowEntityRecord.Corridor> loadCorridors(
            Connection connection,
            long mapId,
            List<Long> ids,
            Set<Long> malformedCorridorIds,
            DungeonSqliteQueryCounter queries
    ) throws SQLException {
        if (ids.isEmpty()) {
            return Map.of();
        }
        Map<Long, CorridorShell> corridors = new LinkedHashMap<>();
        try (PreparedStatement statement = queries.prepare(connection,
                "SELECT corridor_id, dungeon_map_id, level_z FROM " + DungeonPersistenceSchema.CORRIDORS_TABLE
                        + " WHERE dungeon_map_id=? AND corridor_id IN (" + placeholders(ids.size()) + ")"
                        + " ORDER BY corridor_id")) {
            bindMapAndIds(statement, mapId, ids);
            try (ResultSet rows = statement.executeQuery()) {
                while (rows.next()) {
                    long id = rows.getLong("corridor_id");
                    corridors.put(id, new CorridorShell(id, rows.getLong("dungeon_map_id"), rows.getInt("level_z")));
                }
            }
        }
        loadCorridorMembers(connection, ids, corridors, queries);
        loadCorridorWaypoints(connection, ids, corridors, queries);
        loadCorridorDoors(connection, ids, corridors, malformedCorridorIds, queries);
        loadCorridorAnchors(connection, ids, corridors, queries);
        loadCorridorRefs(connection, ids, corridors, queries);
        Map<Long, DungeonCorridorRecord> hosts = loadReferencedAnchorHosts(connection, mapId, corridors, queries);
        Map<Long, DungeonWindowEntityRecord.Corridor> result = new LinkedHashMap<>();
        corridors.forEach((id, shell) -> {
            Set<Long> hostIds = new LinkedHashSet<>();
            shell.refs.forEach(ref -> hostIds.add(ref.hostCorridorId()));
            List<DungeonCorridorRecord> hostRecords = hostIds.stream()
                    .filter(hostId -> hostId != id)
                    .map(hosts::get)
                    .filter(java.util.Objects::nonNull)
                    .toList();
            result.put(id, new DungeonWindowEntityRecord.Corridor(shell.record(), hostRecords));
        });
        return result;
    }

    private static void loadCorridorMembers(
            Connection connection, List<Long> ids, Map<Long, CorridorShell> corridors,
            DungeonSqliteQueryCounter queries
    ) throws SQLException {
        try (PreparedStatement statement = queries.prepare(connection,
                "SELECT corridor_id, room_id FROM " + DungeonPersistenceSchema.CORRIDOR_MEMBERS_TABLE
                        + " WHERE corridor_id IN (" + placeholders(ids.size()) + ")"
                        + " ORDER BY corridor_id, member_order, room_id")) {
            bindIds(statement, ids);
            try (ResultSet rows = statement.executeQuery()) {
                while (rows.next()) {
                    CorridorShell corridor = corridors.get(rows.getLong("corridor_id"));
                    if (corridor != null) {
                        corridor.roomIds.add(rows.getLong("room_id"));
                    }
                }
            }
        }
    }

    private static void loadCorridorWaypoints(
            Connection connection, List<Long> ids, Map<Long, CorridorShell> corridors,
            DungeonSqliteQueryCounter queries
    ) throws SQLException {
        try (PreparedStatement statement = queries.prepare(connection,
                "SELECT corridor_id, cluster_id, relative_x, relative_y, relative_z FROM "
                        + DungeonPersistenceSchema.CORRIDOR_WAYPOINTS_TABLE
                        + " WHERE corridor_id IN (" + placeholders(ids.size()) + ")"
                        + " ORDER BY corridor_id, sort_order")) {
            bindIds(statement, ids);
            try (ResultSet rows = statement.executeQuery()) {
                while (rows.next()) {
                    CorridorShell corridor = corridors.get(rows.getLong("corridor_id"));
                    if (corridor != null) {
                        corridor.waypoints.add(new DungeonCorridorWaypointRecord(
                                corridor.id, rows.getLong("cluster_id"), rows.getInt("relative_x"),
                                rows.getInt("relative_y"), rows.getInt("relative_z")));
                    }
                }
            }
        }
    }

    private static void loadCorridorDoors(
            Connection connection, List<Long> ids, Map<Long, CorridorShell> corridors,
            Set<Long> malformedCorridorIds,
            DungeonSqliteQueryCounter queries
    ) throws SQLException {
        try (PreparedStatement statement = queries.prepare(connection,
                "SELECT corridor_id, room_id, cluster_id, relative_cell_x, relative_cell_y, relative_cell_z,"
                        + " edge_direction, topology_element_id FROM "
                        + DungeonPersistenceSchema.CORRIDOR_DOOR_OVERRIDES_TABLE
                        + " WHERE corridor_id IN (" + placeholders(ids.size()) + ")"
                        + " ORDER BY corridor_id, sort_order, room_id")) {
            bindIds(statement, ids);
            try (ResultSet rows = statement.executeQuery()) {
                while (rows.next()) {
                    CorridorShell corridor = corridors.get(rows.getLong("corridor_id"));
                    if (corridor != null) {
                        String edgeDirection = rows.getString("edge_direction");
                        if (!cardinal(edgeDirection)) {
                            malformedCorridorIds.add(corridor.id);
                        }
                        corridor.doors.add(new DungeonCorridorDoorBindingRecord(
                                corridor.id, rows.getLong("room_id"), rows.getLong("cluster_id"),
                                rows.getInt("relative_cell_x"), rows.getInt("relative_cell_y"),
                                rows.getInt("relative_cell_z"),
                                edgeDirection,
                                DungeonSqliteStatementSupport.nullableLong(rows, "topology_element_id")));
                    }
                }
            }
        }
    }

    private static void loadCorridorAnchors(
            Connection connection, List<Long> ids, Map<Long, CorridorShell> corridors,
            DungeonSqliteQueryCounter queries
    ) throws SQLException {
        try (PreparedStatement statement = queries.prepare(connection,
                "SELECT corridor_id, anchor_id, host_corridor_id, cell_x, cell_y, cell_z, topology_element_id"
                        + " FROM " + DungeonPersistenceSchema.CORRIDOR_ANCHORS_TABLE
                        + " WHERE corridor_id IN (" + placeholders(ids.size()) + ")"
                        + " ORDER BY corridor_id, sort_order, anchor_id")) {
            bindIds(statement, ids);
            try (ResultSet rows = statement.executeQuery()) {
                while (rows.next()) {
                    CorridorShell corridor = corridors.get(rows.getLong("corridor_id"));
                    if (corridor != null) {
                        corridor.anchors.add(anchor(rows));
                    }
                }
            }
        }
    }

    private static void loadCorridorRefs(
            Connection connection, List<Long> ids, Map<Long, CorridorShell> corridors,
            DungeonSqliteQueryCounter queries
    ) throws SQLException {
        try (PreparedStatement statement = queries.prepare(connection,
                "SELECT corridor_id, host_corridor_id, topology_element_id FROM "
                        + DungeonPersistenceSchema.CORRIDOR_ANCHOR_REFS_TABLE
                        + " WHERE corridor_id IN (" + placeholders(ids.size()) + ")"
                        + " ORDER BY corridor_id, sort_order, topology_element_id")) {
            bindIds(statement, ids);
            try (ResultSet rows = statement.executeQuery()) {
                while (rows.next()) {
                    CorridorShell corridor = corridors.get(rows.getLong("corridor_id"));
                    if (corridor != null) {
                        corridor.refs.add(new DungeonCorridorAnchorRefRecord(
                                corridor.id, rows.getLong("host_corridor_id"),
                                DungeonSqliteStatementSupport.nullableLong(rows, "topology_element_id")));
                    }
                }
            }
        }
    }

    private static Map<Long, DungeonCorridorRecord> loadReferencedAnchorHosts(
            Connection connection,
            long mapId,
            Map<Long, CorridorShell> corridors,
            DungeonSqliteQueryCounter queries
    ) throws SQLException {
        Set<Long> hostIds = new LinkedHashSet<>();
        corridors.values().forEach(corridor -> corridor.refs.forEach(ref -> hostIds.add(ref.hostCorridorId())));
        if (hostIds.isEmpty()) {
            return Map.of();
        }
        List<Long> ids = hostIds.stream().sorted().toList();
        Map<Long, CorridorShell> hosts = new LinkedHashMap<>();
        try (PreparedStatement statement = queries.prepare(connection,
                "SELECT corridor_id, dungeon_map_id, level_z FROM " + DungeonPersistenceSchema.CORRIDORS_TABLE
                        + " WHERE dungeon_map_id=? AND corridor_id IN (" + placeholders(ids.size()) + ")"
                        + " ORDER BY corridor_id")) {
            bindMapAndIds(statement, mapId, ids);
            try (ResultSet rows = statement.executeQuery()) {
                while (rows.next()) {
                    long id = rows.getLong("corridor_id");
                    hosts.put(id, new CorridorShell(id, rows.getLong("dungeon_map_id"), rows.getInt("level_z")));
                }
            }
        }
        loadCorridorAnchors(connection, ids, hosts, queries);
        Map<Long, DungeonCorridorRecord> result = new LinkedHashMap<>();
        hosts.forEach((id, shell) -> result.put(id, shell.record()));
        return result;
    }

    private static DungeonCorridorAnchorBindingRecord anchor(ResultSet rows) throws SQLException {
        return new DungeonCorridorAnchorBindingRecord(
                rows.getLong("corridor_id"), rows.getLong("anchor_id"), rows.getLong("host_corridor_id"),
                rows.getInt("cell_x"), rows.getInt("cell_y"), rows.getInt("cell_z"),
                DungeonSqliteStatementSupport.nullableLong(rows, "topology_element_id"));
    }

    private static Map<Long, DungeonWindowEntityRecord.Stair> loadStairs(
            Connection connection, long mapId, List<Long> ids, DungeonSqliteQueryCounter queries
    ) throws SQLException {
        if (ids.isEmpty()) {
            return Map.of();
        }
        Map<Long, StairShell> stairs = new LinkedHashMap<>();
        try (PreparedStatement statement = queries.prepare(connection,
                "SELECT s.stair_id, s.dungeon_map_id, s.name, s.shape, s.direction, s.dimension1, s.dimension2,"
                        + " s.corridor_id, CASE WHEN s.corridor_id IS NULL OR c.corridor_id IS NOT NULL"
                        + " THEN 1 ELSE 0 END AS corridor_present FROM " + DungeonPersistenceSchema.STAIRS_TABLE + " s"
                        + " LEFT JOIN " + DungeonPersistenceSchema.CORRIDORS_TABLE + " c"
                        + " ON c.dungeon_map_id=s.dungeon_map_id AND c.corridor_id=s.corridor_id"
                        + " WHERE s.dungeon_map_id=? AND s.stair_id IN (" + placeholders(ids.size()) + ")"
                        + " ORDER BY s.stair_id")) {
            bindMapAndIds(statement, mapId, ids);
            try (ResultSet rows = statement.executeQuery()) {
                while (rows.next()) {
                    long id = rows.getLong("stair_id");
                    stairs.put(id, new StairShell(
                            id, rows.getLong("dungeon_map_id"), rows.getString("name"), rows.getString("shape"),
                            rows.getInt("direction"), rows.getInt("dimension1"), rows.getInt("dimension2"),
                            DungeonSqliteStatementSupport.nullableLong(rows, "corridor_id"),
                            rows.getInt("corridor_present") == 1));
                }
            }
        }
        try (PreparedStatement statement = queries.prepare(connection,
                "SELECT stair_id, cell_x, cell_y, cell_z FROM " + DungeonPersistenceSchema.STAIR_PATH_NODES_TABLE
                        + " WHERE stair_id IN (" + placeholders(ids.size()) + ")"
                        + " ORDER BY stair_id, sort_order")) {
            bindIds(statement, ids);
            try (ResultSet rows = statement.executeQuery()) {
                while (rows.next()) {
                    StairShell stair = stairs.get(rows.getLong("stair_id"));
                    if (stair != null) {
                        stair.path.add(new DungeonStairPathNodeRecord(
                                stair.id, rows.getInt("cell_x"), rows.getInt("cell_y"), rows.getInt("cell_z")));
                    }
                }
            }
        }
        try (PreparedStatement statement = queries.prepare(connection,
                "SELECT stair_id, stair_exit_id, cell_x, cell_y, cell_z, label FROM "
                        + DungeonPersistenceSchema.STAIR_EXITS_TABLE
                        + " WHERE stair_id IN (" + placeholders(ids.size()) + ")"
                        + " ORDER BY stair_id, cell_z, cell_y, cell_x, stair_exit_id")) {
            bindIds(statement, ids);
            try (ResultSet rows = statement.executeQuery()) {
                while (rows.next()) {
                    StairShell stair = stairs.get(rows.getLong("stair_id"));
                    if (stair != null) {
                        stair.exits.add(new DungeonStairExitRecord(
                                stair.id, rows.getLong("stair_exit_id"), rows.getInt("cell_x"),
                                rows.getInt("cell_y"), rows.getInt("cell_z"), rows.getString("label")));
                    }
                }
            }
        }
        Map<Long, DungeonWindowEntityRecord.Stair> result = new LinkedHashMap<>();
        stairs.forEach((id, shell) -> result.put(id, shell.record()));
        return result;
    }

    private static Map<Long, DungeonTransitionRecord> loadTransitions(
            Connection connection, long mapId, List<Long> ids, DungeonSqliteQueryCounter queries
    ) throws SQLException {
        if (ids.isEmpty()) {
            return Map.of();
        }
        try (PreparedStatement statement = queries.prepare(connection,
                "SELECT transition_id, dungeon_map_id, description, cell_x, cell_y, level_z, anchor_type,"
                        + " anchor_edge_direction, destination_type, target_overworld_map_id,"
                        + " target_overworld_tile_id, target_dungeon_map_id, target_transition_id, linked_transition_id"
                        + " FROM " + DungeonPersistenceSchema.TRANSITIONS_TABLE
                        + " WHERE dungeon_map_id=? AND transition_id IN (" + placeholders(ids.size()) + ")"
                        + " ORDER BY transition_id")) {
            bindMapAndIds(statement, mapId, ids);
            try (ResultSet rows = statement.executeQuery()) {
                Map<Long, DungeonTransitionRecord> result = new LinkedHashMap<>();
                while (rows.next()) {
                    long id = rows.getLong("transition_id");
                    result.put(id, new DungeonTransitionRecord(
                            id, rows.getLong("dungeon_map_id"), rows.getString("description"),
                            DungeonSqliteStatementSupport.nullableInteger(rows, "cell_x"),
                            DungeonSqliteStatementSupport.nullableInteger(rows, "cell_y"),
                            DungeonSqliteStatementSupport.nullableInteger(rows, "level_z"),
                            rows.getString("anchor_type"), rows.getString("anchor_edge_direction"),
                            rows.getString("destination_type"),
                            DungeonSqliteStatementSupport.nullableLong(rows, "target_overworld_map_id"),
                            DungeonSqliteStatementSupport.nullableLong(rows, "target_overworld_tile_id"),
                            DungeonSqliteStatementSupport.nullableLong(rows, "target_dungeon_map_id"),
                            DungeonSqliteStatementSupport.nullableLong(rows, "target_transition_id"),
                            DungeonSqliteStatementSupport.nullableLong(rows, "linked_transition_id")));
                }
                return result;
            }
        }
    }

    private static Map<Long, DungeonFeatureMarkerRecord> loadMarkers(
            Connection connection,
            long mapId,
            List<Long> ids,
            Set<Long> incompleteMarkerIds,
            DungeonSqliteQueryCounter queries
    ) throws SQLException {
        if (ids.isEmpty()) {
            return Map.of();
        }
        try (PreparedStatement statement = queries.prepare(connection,
                "SELECT feature_marker_id, dungeon_map_id, marker_kind, cell_x, cell_y, level_z, label, description"
                        + " FROM " + DungeonPersistenceSchema.FEATURE_MARKERS_TABLE
                        + " WHERE dungeon_map_id=? AND feature_marker_id IN (" + placeholders(ids.size()) + ")"
                        + " ORDER BY feature_marker_id")) {
            bindMapAndIds(statement, mapId, ids);
            try (ResultSet rows = statement.executeQuery()) {
                Map<Long, DungeonFeatureMarkerRecord> result = new LinkedHashMap<>();
                while (rows.next()) {
                    long id = rows.getLong("feature_marker_id");
                    String description = rows.getString("description");
                    if (description == null) {
                        incompleteMarkerIds.add(id);
                    }
                    result.put(id, new DungeonFeatureMarkerRecord(
                            id, rows.getLong("dungeon_map_id"), rows.getString("marker_kind"),
                            rows.getInt("cell_x"), rows.getInt("cell_y"), rows.getInt("level_z"),
                            rows.getString("label"), description));
                }
                return result;
            }
        }
    }

    private static Map<DungeonPatchEntityRef.Kind, List<Long>> idsByKind(List<DungeonPatchEntityRef> refs) {
        Map<DungeonPatchEntityRef.Kind, List<Long>> result = new EnumMap<>(DungeonPatchEntityRef.Kind.class);
        for (DungeonPatchEntityRef.Kind kind : DungeonPatchEntityRef.Kind.values()) {
            result.put(kind, new ArrayList<>());
        }
        refs.forEach(ref -> result.get(ref.kind()).add(ref.id()));
        result.replaceAll((kind, values) -> values.stream().sorted().distinct().toList());
        return result;
    }

    private static String placeholders(int count) {
        return String.join(",", java.util.Collections.nCopies(count, "?"));
    }

    private static int bindMapAndIds(PreparedStatement statement, long mapId, List<Long> ids) throws SQLException {
        statement.setLong(1, mapId);
        int parameter = 2;
        for (Long id : ids) {
            statement.setLong(parameter++, id);
        }
        return parameter;
    }

    private static void bindIds(PreparedStatement statement, List<Long> ids) throws SQLException {
        int parameter = 1;
        for (Long id : ids) {
            statement.setLong(parameter++, id);
        }
    }

    private static <T, R> R value(T value, java.util.function.Function<T, R> mapper) {
        return value == null ? null : mapper.apply(value);
    }

    private static final class RoomShell {
        private final long id;
        private final long mapId;
        private final long clusterId;
        private final String name;
        private final String description;
        private final List<DungeonRoomCellRecord> cells = new ArrayList<>();
        private final List<DungeonRoomExitDescriptionRecord> exits = new ArrayList<>();

        private RoomShell(long id, long mapId, long clusterId, String name, String description) {
            this.id = id;
            this.mapId = mapId;
            this.clusterId = clusterId;
            this.name = name;
            this.description = description;
        }

        private DungeonRoomRecord record() {
            return new DungeonRoomRecord(id, mapId, clusterId, name, description, cells, exits);
        }
    }

    private static final class ClusterShell {
        private final long id;
        private final long mapId;
        private final String name;
        private final List<DungeonClusterBoundaryRecord> boundaries = new ArrayList<>();

        private ClusterShell(long id, long mapId, String name) {
            this.id = id;
            this.mapId = mapId;
            this.name = name;
        }
    }

    private static final class CorridorShell {
        private final long id;
        private final long mapId;
        private final int level;
        private final List<Long> roomIds = new ArrayList<>();
        private final List<DungeonCorridorWaypointRecord> waypoints = new ArrayList<>();
        private final List<DungeonCorridorDoorBindingRecord> doors = new ArrayList<>();
        private final List<DungeonCorridorAnchorBindingRecord> anchors = new ArrayList<>();
        private final List<DungeonCorridorAnchorRefRecord> refs = new ArrayList<>();

        private CorridorShell(long id, long mapId, int level) {
            this.id = id;
            this.mapId = mapId;
            this.level = level;
        }

        private DungeonCorridorRecord record() {
            return new DungeonCorridorRecord(id, mapId, level, roomIds, waypoints, doors, anchors, refs);
        }
    }

    private static final class StairShell {
        private final long id;
        private final long mapId;
        private final String name;
        private final String shape;
        private final int direction;
        private final int dimension1;
        private final int dimension2;
        private final Long corridorId;
        private final boolean corridorPresent;
        private final List<DungeonStairPathNodeRecord> path = new ArrayList<>();
        private final List<DungeonStairExitRecord> exits = new ArrayList<>();

        private StairShell(
                long id, long mapId, String name, String shape, int direction,
                int dimension1, int dimension2, Long corridorId, boolean corridorPresent
        ) {
            this.id = id;
            this.mapId = mapId;
            this.name = name;
            this.shape = shape;
            this.direction = direction;
            this.dimension1 = dimension1;
            this.dimension2 = dimension2;
            this.corridorId = corridorId;
            this.corridorPresent = corridorPresent;
        }

        private DungeonWindowEntityRecord.Stair record() {
            return new DungeonWindowEntityRecord.Stair(
                    new DungeonStairRecord(
                            id, mapId, name, shape, direction, dimension1, dimension2, corridorId, path, exits),
                    corridorPresent);
        }
    }

    @FunctionalInterface
    private interface SqlBinder {
        void bind(PreparedStatement statement) throws SQLException;
    }

    private static final class Kind {
        private static final DungeonPatchEntityRef.Kind ROOM = DungeonPatchEntityRef.Kind.ROOM;
        private static final DungeonPatchEntityRef.Kind ROOM_CLUSTER = DungeonPatchEntityRef.Kind.ROOM_CLUSTER;
        private static final DungeonPatchEntityRef.Kind CORRIDOR = DungeonPatchEntityRef.Kind.CORRIDOR;
        private static final DungeonPatchEntityRef.Kind STAIR = DungeonPatchEntityRef.Kind.STAIR;
        private static final DungeonPatchEntityRef.Kind TRANSITION = DungeonPatchEntityRef.Kind.TRANSITION;
        private static final DungeonPatchEntityRef.Kind FEATURE_MARKER = DungeonPatchEntityRef.Kind.FEATURE_MARKER;
    }
}
