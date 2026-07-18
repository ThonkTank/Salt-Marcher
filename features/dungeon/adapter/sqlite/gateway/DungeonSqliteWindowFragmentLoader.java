package features.dungeon.adapter.sqlite.gateway;

import features.dungeon.adapter.sqlite.mapper.DungeonStairSourceValidation;
import features.dungeon.adapter.sqlite.mapper.DungeonTransitionSourceValidation;
import features.dungeon.adapter.sqlite.mapper.DungeonWindowEntityMapper;
import features.dungeon.adapter.sqlite.model.DungeonFeatureMarkerRecord;
import features.dungeon.adapter.sqlite.model.DungeonPersistenceSchema;
import features.dungeon.adapter.sqlite.model.DungeonTransitionRecord;
import features.dungeon.adapter.sqlite.model.DungeonWindowEntityRecord;
import features.dungeon.application.authored.command.DungeonPatchEntityRef;
import features.dungeon.application.authored.port.DungeonEntitySnapshot;
import features.dungeon.application.authored.port.DungeonWindowEntityFragment;
import features.dungeon.api.DungeonChunkKey;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.Direction;
import features.dungeon.domain.core.graph.DungeonTopologyElementKind;
import features.dungeon.domain.core.graph.DungeonTopologyRef;
import features.dungeon.domain.core.structure.feature.FeatureMarkerKind;
import features.dungeon.domain.core.structure.stair.StairShape;
import features.dungeon.domain.core.structure.transition.Transition;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/** Batched family/detail loader for exact clipped window facts. */
final class DungeonSqliteWindowFragmentLoader {

    private DungeonSqliteWindowFragmentLoader() {
    }

    static List<DungeonWindowEntityFragment> loadAll(
            Connection connection,
            long mapId,
            List<DungeonChunkKey> requestedChunks,
            Map<DungeonPatchEntityRef, List<DungeonChunkKey>> memberships,
            DungeonSqliteQueryCounter queries
    ) throws SQLException {
        Map<DungeonPatchEntityRef.Kind, List<Long>> ids = idsByKind(memberships.keySet());
        Map<Long, RoomBuilder> rooms = loadRooms(connection, mapId, requestedChunks, ids.get(Kind.ROOM), queries);
        Map<Long, ClusterBuilder> clusters = loadClusters(
                connection, mapId, requestedChunks, ids.get(Kind.ROOM_CLUSTER), queries);
        Map<Long, CorridorBuilder> corridors = loadCorridors(
                connection, mapId, requestedChunks, ids.get(Kind.CORRIDOR), queries);
        Map<Long, StairBuilder> stairs = loadStairs(
                connection, mapId, requestedChunks, ids.get(Kind.STAIR), queries);
        Map<Long, DungeonWindowEntityFragment.Transition> transitions = loadTransitions(
                connection, mapId, ids.get(Kind.TRANSITION), memberships, queries);
        Map<Long, DungeonWindowEntityFragment.FeatureMarker> markers = loadMarkers(
                connection, mapId, ids.get(Kind.FEATURE_MARKER), memberships, queries);

        List<DungeonWindowEntityFragment> result = new ArrayList<>();
        for (Map.Entry<DungeonPatchEntityRef, List<DungeonChunkKey>> entry : memberships.entrySet()) {
            DungeonPatchEntityRef ref = entry.getKey();
            DungeonWindowEntityFragment fragment = switch (ref.kind()) {
                case ROOM -> require(rooms.get(ref.id()), ref).build(entry.getValue());
                case ROOM_CLUSTER -> require(clusters.get(ref.id()), ref).build(entry.getValue());
                case CORRIDOR -> require(corridors.get(ref.id()), ref).build(entry.getValue());
                case STAIR -> require(stairs.get(ref.id()), ref).build(entry.getValue());
                case TRANSITION -> require(transitions.get(ref.id()), ref);
                case FEATURE_MARKER -> require(markers.get(ref.id()), ref);
            };
            result.add(fragment);
        }
        return List.copyOf(result);
    }

    private static Map<Long, RoomBuilder> loadRooms(
            Connection connection, long mapId, List<DungeonChunkKey> chunks, List<Long> ids,
            DungeonSqliteQueryCounter queries
    ) throws SQLException {
        if (ids.isEmpty()) {
            return Map.of();
        }
        Map<Long, RoomBuilder> result = new LinkedHashMap<>();
        try (PreparedStatement statement = queries.prepare(connection,
                "SELECT room_id, cluster_id, name, visual_description FROM "
                        + DungeonPersistenceSchema.ROOMS_TABLE
                        + " WHERE dungeon_map_id=? AND room_id IN (" + placeholders(ids.size()) + ")"
                        + " ORDER BY room_id")) {
            bindMapAndIds(statement, mapId, ids);
            try (ResultSet rows = statement.executeQuery()) {
                while (rows.next()) {
                    long id = rows.getLong("room_id");
                    result.put(id, new RoomBuilder(
                            id, rows.getLong("cluster_id"), rows.getString("name"),
                            rows.getString("visual_description")));
                }
            }
        }
        String range = coordinatePredicate("c.level_z", "c.cell_x", "c.cell_y", chunks.size());
        try (PreparedStatement statement = queries.prepare(connection,
                "SELECT c.room_id, c.level_z, c.cell_x, c.cell_y FROM "
                        + DungeonPersistenceSchema.ROOM_CELLS_TABLE + " c"
                        + " JOIN " + DungeonPersistenceSchema.ROOMS_TABLE + " r ON r.room_id=c.room_id"
                        + " WHERE r.dungeon_map_id=? AND c.room_id IN (" + placeholders(ids.size()) + ")"
                        + " AND (" + range + ") ORDER BY c.room_id, c.level_z, c.cell_y, c.cell_x")) {
            int next = bindMapAndIds(statement, mapId, ids);
            bindCoordinateRanges(statement, next, chunks);
            try (ResultSet rows = statement.executeQuery()) {
                while (rows.next()) {
                    RoomBuilder builder = result.get(rows.getLong("room_id"));
                    if (builder != null) {
                        builder.cells.add(cell(rows));
                    }
                }
            }
        }
        try (PreparedStatement statement = queries.prepare(connection,
                "SELECT e.room_id, e.level_z, e.cell_x, e.cell_y, e.edge_direction, e.description FROM "
                        + DungeonPersistenceSchema.ROOM_EXIT_DESCRIPTIONS_TABLE + " e"
                        + " JOIN " + DungeonPersistenceSchema.ROOMS_TABLE + " r ON r.room_id=e.room_id"
                        + " WHERE r.dungeon_map_id=? AND e.room_id IN (" + placeholders(ids.size()) + ")"
                        + " AND (" + coordinatePredicate("e.level_z", "e.cell_x", "e.cell_y", chunks.size()) + ")"
                        + " ORDER BY e.room_id, e.sort_order, e.level_z, e.cell_y, e.cell_x")) {
            int next = bindMapAndIds(statement, mapId, ids);
            bindCoordinateRanges(statement, next, chunks);
            try (ResultSet rows = statement.executeQuery()) {
                while (rows.next()) {
                    RoomBuilder builder = result.get(rows.getLong("room_id"));
                    if (builder != null) {
                        builder.exits.add(new DungeonWindowEntityFragment.RoomExitFact(
                                cell(rows), direction(rows.getString("edge_direction")), rows.getString("description")));
                    }
                }
            }
        }
        return result;
    }

    private static Map<Long, ClusterBuilder> loadClusters(
            Connection connection, long mapId, List<DungeonChunkKey> chunks, List<Long> ids,
            DungeonSqliteQueryCounter queries
    ) throws SQLException {
        if (ids.isEmpty()) {
            return Map.of();
        }
        Map<Long, ClusterBuilder> result = new LinkedHashMap<>();
        try (PreparedStatement statement = queries.prepare(connection,
                "SELECT cluster_id, name FROM " + DungeonPersistenceSchema.ROOM_CLUSTERS_TABLE
                        + " WHERE dungeon_map_id=? AND cluster_id IN (" + placeholders(ids.size()) + ")"
                        + " ORDER BY cluster_id")) {
            bindMapAndIds(statement, mapId, ids);
            try (ResultSet rows = statement.executeQuery()) {
                while (rows.next()) {
                    long id = rows.getLong("cluster_id");
                    result.put(id, new ClusterBuilder(id, rows.getString("name")));
                }
            }
        }
        try (PreparedStatement statement = queries.prepare(connection,
                "SELECT r.cluster_id, r.room_id, r.name AS room_name, c.level_z, c.cell_x, c.cell_y"
                        + " FROM " + DungeonPersistenceSchema.ROOMS_TABLE + " r"
                        + " JOIN " + DungeonPersistenceSchema.ROOM_CELLS_TABLE + " c ON c.room_id=r.room_id"
                        + " WHERE r.dungeon_map_id=? AND r.cluster_id IN (" + placeholders(ids.size()) + ")"
                        + " AND (" + coordinatePredicate("c.level_z", "c.cell_x", "c.cell_y", chunks.size()) + ")"
                        + " ORDER BY r.cluster_id, c.level_z, c.cell_y, c.cell_x, r.room_id")) {
            int next = bindMapAndIds(statement, mapId, ids);
            bindCoordinateRanges(statement, next, chunks);
            try (ResultSet rows = statement.executeQuery()) {
                while (rows.next()) {
                    ClusterBuilder builder = result.get(rows.getLong("cluster_id"));
                    if (builder != null) {
                        long roomId = rows.getLong("room_id");
                        builder.members.add(new DungeonWindowEntityFragment.ClusterMemberCellFact(
                                roomId, rows.getString("room_name"), cell(rows)));
                        builder.dependencies.add(DungeonPatchEntityRef.room(roomId));
                    }
                }
            }
        }
        try (PreparedStatement statement = queries.prepare(connection,
                "SELECT cluster_id, level_z, cell_x, cell_y, edge_direction, edge_type, topology_element_id"
                        + " FROM " + DungeonPersistenceSchema.ROOM_CLUSTER_EDGES_TABLE
                        + " WHERE dungeon_map_id=? AND cluster_id IN (" + placeholders(ids.size()) + ")"
                        + " AND (" + coordinatePredicate("level_z", "cell_x", "cell_y", chunks.size()) + ")"
                        + " ORDER BY cluster_id, level_z, cell_y, cell_x, edge_direction")) {
            int next = bindMapAndIds(statement, mapId, ids);
            bindCoordinateRanges(statement, next, chunks);
            try (ResultSet rows = statement.executeQuery()) {
                while (rows.next()) {
                    ClusterBuilder builder = result.get(rows.getLong("cluster_id"));
                    if (builder != null) {
                        Cell cell = cell(rows);
                        Direction direction = direction(rows.getString("edge_direction"));
                        DungeonWindowEntityFragment.BoundaryKind kind = DungeonWindowEntityFragment.BoundaryKind
                                .valueOf(rows.getString("edge_type").toUpperCase(Locale.ROOT));
                        builder.boundaries.add(new DungeonWindowEntityFragment.ClusterBoundaryFact(
                                cell, direction, kind,
                                boundaryTopology(kind, cell, direction,
                                        DungeonSqliteStatementSupport.nullableLong(rows, "topology_element_id"))));
                    }
                }
            }
        }
        return result;
    }

    private static Map<Long, CorridorBuilder> loadCorridors(
            Connection connection, long mapId, List<DungeonChunkKey> chunks, List<Long> ids,
            DungeonSqliteQueryCounter queries
    ) throws SQLException {
        if (ids.isEmpty()) {
            return Map.of();
        }
        Map<Long, CorridorBuilder> result = new LinkedHashMap<>();
        try (PreparedStatement statement = queries.prepare(connection,
                "SELECT corridor_id, level_z FROM " + DungeonPersistenceSchema.CORRIDORS_TABLE
                        + " WHERE dungeon_map_id=? AND corridor_id IN (" + placeholders(ids.size()) + ")"
                        + " ORDER BY corridor_id")) {
            bindMapAndIds(statement, mapId, ids);
            try (ResultSet rows = statement.executeQuery()) {
                while (rows.next()) {
                    long id = rows.getLong("corridor_id");
                    result.put(id, new CorridorBuilder(id, rows.getInt("level_z")));
                }
            }
        }
        try (PreparedStatement statement = queries.prepare(connection,
                "SELECT m.corridor_id, m.room_id FROM " + DungeonPersistenceSchema.CORRIDOR_MEMBERS_TABLE + " m"
                        + " JOIN " + DungeonPersistenceSchema.CORRIDORS_TABLE + " c ON c.corridor_id=m.corridor_id"
                        + " WHERE c.dungeon_map_id=? AND m.corridor_id IN (" + placeholders(ids.size()) + ")"
                        + " ORDER BY m.corridor_id, m.member_order, m.room_id")) {
            bindMapAndIds(statement, mapId, ids);
            try (ResultSet rows = statement.executeQuery()) {
                while (rows.next()) {
                    CorridorBuilder builder = result.get(rows.getLong("corridor_id"));
                    if (builder != null) {
                        long roomId = rows.getLong("room_id");
                        builder.roomIds.add(roomId);
                        builder.dependencies.add(DungeonPatchEntityRef.room(roomId));
                    }
                }
            }
        }
        String waypointCenters = scopedClusterCenters(
                DungeonPersistenceSchema.CORRIDOR_WAYPOINTS_TABLE, ids.size());
        try (PreparedStatement statement = queries.prepare(connection,
                "SELECT facts.* FROM (SELECT w.corridor_id, w.sort_order, w.cluster_id,"
                        + " w.relative_x, w.relative_y, w.relative_z,"
                        + " center.cell_x+w.relative_x AS cell_x, center.cell_y+w.relative_y AS cell_y,"
                        + " w.relative_z AS level_z FROM " + DungeonPersistenceSchema.CORRIDOR_WAYPOINTS_TABLE + " w"
                        + " JOIN " + DungeonPersistenceSchema.CORRIDORS_TABLE + " c ON c.corridor_id=w.corridor_id"
                        + " JOIN (" + waypointCenters + ") center"
                        + " ON center.cluster_id=w.cluster_id AND center.center_order=1"
                        + " WHERE c.dungeon_map_id=? AND w.corridor_id IN (" + placeholders(ids.size()) + ")) facts"
                        + " WHERE (" + coordinatePredicate("level_z", "cell_x", "cell_y", chunks.size()) + ")"
                        + " ORDER BY corridor_id, sort_order")) {
            int next = bindIds(statement, 1, ids);
            next = bindMapAndIds(statement, next, mapId, ids);
            bindCoordinateRanges(statement, next, chunks);
            try (ResultSet rows = statement.executeQuery()) {
                while (rows.next()) {
                    CorridorBuilder builder = result.get(rows.getLong("corridor_id"));
                    if (builder != null) {
                        long clusterId = rows.getLong("cluster_id");
                        builder.waypoints.add(new DungeonWindowEntityFragment.CorridorWaypointFact(
                                rows.getInt("sort_order"), clusterId,
                                new Cell(rows.getInt("relative_x"), rows.getInt("relative_y"), rows.getInt("relative_z")),
                                cell(rows)));
                        builder.dependencies.add(DungeonPatchEntityRef.roomCluster(clusterId));
                    }
                }
            }
        }
        String doorCenters = scopedClusterCenters(
                DungeonPersistenceSchema.CORRIDOR_DOOR_OVERRIDES_TABLE, ids.size());
        try (PreparedStatement statement = queries.prepare(connection,
                "SELECT facts.* FROM (SELECT d.corridor_id, d.sort_order, d.room_id, d.cluster_id,"
                        + " d.relative_cell_x, d.relative_cell_y, d.relative_cell_z,"
                        + " d.edge_direction, d.topology_element_id,"
                        + " center.cell_x+d.relative_cell_x AS cell_x,"
                        + " center.cell_y+d.relative_cell_y AS cell_y, d.relative_cell_z AS level_z"
                        + " FROM " + DungeonPersistenceSchema.CORRIDOR_DOOR_OVERRIDES_TABLE + " d"
                        + " JOIN " + DungeonPersistenceSchema.CORRIDORS_TABLE + " c ON c.corridor_id=d.corridor_id"
                        + " JOIN (" + doorCenters + ") center"
                        + " ON center.cluster_id=d.cluster_id AND center.center_order=1"
                        + " WHERE c.dungeon_map_id=? AND d.corridor_id IN (" + placeholders(ids.size()) + ")) facts"
                        + " WHERE (" + coordinatePredicate("level_z", "cell_x", "cell_y", chunks.size()) + ")"
                        + " ORDER BY corridor_id, sort_order")) {
            int next = bindIds(statement, 1, ids);
            next = bindMapAndIds(statement, next, mapId, ids);
            bindCoordinateRanges(statement, next, chunks);
            try (ResultSet rows = statement.executeQuery()) {
                while (rows.next()) {
                    CorridorBuilder builder = result.get(rows.getLong("corridor_id"));
                    if (builder != null) {
                        long roomId = rows.getLong("room_id");
                        long clusterId = rows.getLong("cluster_id");
                        Long topologyId = DungeonSqliteStatementSupport.nullableLong(rows, "topology_element_id");
                        builder.doors.add(new DungeonWindowEntityFragment.CorridorDoorFact(
                                rows.getInt("sort_order"), roomId, clusterId,
                                new Cell(
                                        rows.getInt("relative_cell_x"),
                                        rows.getInt("relative_cell_y"),
                                        rows.getInt("relative_cell_z")),
                                cell(rows), direction(rows.getString("edge_direction")),
                                topology(DungeonTopologyElementKind.DOOR, topologyId)));
                        builder.dependencies.add(DungeonPatchEntityRef.room(roomId));
                        builder.dependencies.add(DungeonPatchEntityRef.roomCluster(clusterId));
                    }
                }
            }
        }
        try (PreparedStatement statement = queries.prepare(connection,
                "SELECT a.corridor_id, a.sort_order, a.anchor_id, a.host_corridor_id,"
                        + " a.cell_z AS level_z, a.cell_x, a.cell_y, a.topology_element_id"
                        + " FROM " + DungeonPersistenceSchema.CORRIDOR_ANCHORS_TABLE + " a"
                        + " JOIN " + DungeonPersistenceSchema.CORRIDORS_TABLE + " c ON c.corridor_id=a.corridor_id"
                        + " WHERE c.dungeon_map_id=? AND a.corridor_id IN (" + placeholders(ids.size()) + ")"
                        + " AND (" + coordinatePredicate("a.cell_z", "a.cell_x", "a.cell_y", chunks.size()) + ")"
                        + " ORDER BY a.corridor_id, a.sort_order, a.anchor_id")) {
            int next = bindMapAndIds(statement, mapId, ids);
            bindCoordinateRanges(statement, next, chunks);
            try (ResultSet rows = statement.executeQuery()) {
                while (rows.next()) {
                    CorridorBuilder builder = result.get(rows.getLong("corridor_id"));
                    if (builder != null) {
                        long hostId = rows.getLong("host_corridor_id");
                        builder.anchors.add(new DungeonWindowEntityFragment.CorridorAnchorFact(
                                rows.getInt("sort_order"), rows.getLong("anchor_id"), hostId, cell(rows),
                                topology(DungeonTopologyElementKind.CORRIDOR_ANCHOR,
                                        DungeonSqliteStatementSupport.nullableLong(rows, "topology_element_id"))));
                        if (hostId != builder.id) {
                            builder.dependencies.add(DungeonPatchEntityRef.corridor(hostId));
                        }
                    }
                }
            }
        }
        try (PreparedStatement statement = queries.prepare(connection,
                "SELECT ar.corridor_id, ar.sort_order, ar.host_corridor_id, ar.topology_element_id,"
                        + " a.anchor_id, a.cell_z AS level_z, a.cell_x, a.cell_y"
                        + " FROM " + DungeonPersistenceSchema.CORRIDOR_ANCHOR_REFS_TABLE + " ar"
                        + " JOIN " + DungeonPersistenceSchema.CORRIDORS_TABLE + " c ON c.corridor_id=ar.corridor_id"
                        + " JOIN " + DungeonPersistenceSchema.CORRIDOR_ANCHORS_TABLE + " a"
                        + " ON a.host_corridor_id=ar.host_corridor_id"
                        + " AND a.topology_element_id=ar.topology_element_id"
                        + " WHERE c.dungeon_map_id=? AND ar.corridor_id IN (" + placeholders(ids.size()) + ")"
                        + " AND (" + coordinatePredicate("a.cell_z", "a.cell_x", "a.cell_y", chunks.size()) + ")"
                        + " ORDER BY ar.corridor_id, ar.sort_order, ar.topology_element_id")) {
            int next = bindMapAndIds(statement, mapId, ids);
            bindCoordinateRanges(statement, next, chunks);
            try (ResultSet rows = statement.executeQuery()) {
                while (rows.next()) {
                    CorridorBuilder builder = result.get(rows.getLong("corridor_id"));
                    if (builder != null) {
                        long hostId = rows.getLong("host_corridor_id");
                        long topologyId = rows.getLong("topology_element_id");
                        builder.anchorRefs.add(new DungeonWindowEntityFragment.CorridorAnchorRefFact(
                                rows.getInt("sort_order"), hostId, rows.getLong("anchor_id"), cell(rows),
                                new DungeonTopologyRef(DungeonTopologyElementKind.CORRIDOR_ANCHOR, topologyId)));
                        builder.dependencies.add(DungeonPatchEntityRef.corridor(hostId));
                    }
                }
            }
        }
        try (PreparedStatement statement = queries.prepare(connection,
                "SELECT corridor_id, segment_order, cell_order, level_z, cell_x, cell_y FROM "
                        + DungeonPersistenceSchema.CORRIDOR_ROUTE_CELLS_TABLE
                        + " WHERE dungeon_map_id=? AND corridor_id IN (" + placeholders(ids.size()) + ")"
                        + " AND (" + chunkPredicate(chunks.size()) + ")"
                        + " ORDER BY corridor_id, segment_order, cell_order")) {
            int next = bindMapAndIds(statement, mapId, ids);
            bindChunkKeys(statement, next, chunks);
            try (ResultSet rows = statement.executeQuery()) {
                while (rows.next()) {
                    CorridorBuilder builder = result.get(rows.getLong("corridor_id"));
                    if (builder != null) {
                        builder.routeCells.add(new DungeonWindowEntityFragment.CorridorRouteCellFact(
                                rows.getInt("segment_order"), rows.getInt("cell_order"), cell(rows)));
                    }
                }
            }
        }
        return result;
    }

    private static Map<Long, StairBuilder> loadStairs(
            Connection connection, long mapId, List<DungeonChunkKey> chunks, List<Long> ids,
            DungeonSqliteQueryCounter queries
    ) throws SQLException {
        if (ids.isEmpty()) {
            return Map.of();
        }
        Map<Long, StairBuilder> result = new LinkedHashMap<>();
        try (PreparedStatement statement = queries.prepare(connection,
                "SELECT s.stair_id, s.name, s.shape, s.direction, s.dimension1, s.dimension2, s.corridor_id,"
                        + " CASE WHEN s.corridor_id IS NULL OR c.corridor_id IS NOT NULL"
                        + " THEN 1 ELSE 0 END AS corridor_present,"
                        + " (SELECT COUNT(*) FROM " + DungeonPersistenceSchema.STAIR_PATH_NODES_TABLE + " p"
                        + " WHERE p.stair_id=s.stair_id) AS path_count,"
                        + " (SELECT COUNT(DISTINCT printf('%d:%d:%d', p.cell_x, p.cell_y, p.cell_z)) FROM "
                        + DungeonPersistenceSchema.STAIR_PATH_NODES_TABLE + " p"
                        + " WHERE p.stair_id=s.stair_id) AS distinct_path_count,"
                        + " (SELECT COUNT(*) FROM " + DungeonPersistenceSchema.STAIR_EXITS_TABLE + " e"
                        + " WHERE e.stair_id=s.stair_id) AS exit_count,"
                        + " (SELECT COUNT(DISTINCT e.cell_z) FROM " + DungeonPersistenceSchema.STAIR_EXITS_TABLE + " e"
                        + " WHERE e.stair_id=s.stair_id) AS exit_level_count,"
                        + " (SELECT COUNT(*) FROM " + DungeonPersistenceSchema.STAIR_EXITS_TABLE + " e"
                        + " WHERE e.stair_id=s.stair_id"
                        + " AND (e.stair_exit_id<=0 OR e.label IS NULL OR trim(e.label)='')) AS invalid_exit_count"
                        + " FROM " + DungeonPersistenceSchema.STAIRS_TABLE + " s"
                        + " LEFT JOIN " + DungeonPersistenceSchema.CORRIDORS_TABLE + " c"
                        + " ON c.dungeon_map_id=s.dungeon_map_id AND c.corridor_id=s.corridor_id"
                        + " WHERE s.dungeon_map_id=? AND s.stair_id IN (" + placeholders(ids.size()) + ")"
                        + " ORDER BY s.stair_id")) {
            bindMapAndIds(statement, mapId, ids);
            try (ResultSet rows = statement.executeQuery()) {
                while (rows.next()) {
                    long id = rows.getLong("stair_id");
                    StairShape shape;
                    try {
                        shape = DungeonStairSourceValidation.validate(
                                rows.getString("name"),
                                rows.getString("shape"),
                                rows.getInt("direction"),
                                rows.getInt("dimension1"),
                                rows.getInt("dimension2"),
                                rows.getLong("path_count"),
                                rows.getLong("distinct_path_count"),
                                rows.getLong("exit_count"),
                                rows.getLong("exit_level_count"),
                                rows.getLong("invalid_exit_count"),
                                rows.getInt("corridor_present") == 1);
                    } catch (DungeonStairSourceValidation.Failure failure) {
                        throw new IllegalStateException("Invalid dungeon stair record " + id, failure);
                    }
                    result.put(id, new StairBuilder(
                            id, rows.getString("name"), shape,
                            direction(rows.getInt("direction")), rows.getInt("dimension1"), rows.getInt("dimension2"),
                            DungeonSqliteStatementSupport.nullableLong(rows, "corridor_id")));
                }
            }
        }
        try (PreparedStatement statement = queries.prepare(connection,
                "SELECT n.stair_id, n.sort_order, n.cell_z AS level_z, n.cell_x, n.cell_y FROM "
                        + DungeonPersistenceSchema.STAIR_PATH_NODES_TABLE + " n"
                        + " JOIN " + DungeonPersistenceSchema.STAIRS_TABLE + " s ON s.stair_id=n.stair_id"
                        + " WHERE s.dungeon_map_id=? AND n.stair_id IN (" + placeholders(ids.size()) + ")"
                        + " AND (" + coordinatePredicate("n.cell_z", "n.cell_x", "n.cell_y", chunks.size()) + ")"
                        + " ORDER BY n.stair_id, n.sort_order")) {
            int next = bindMapAndIds(statement, mapId, ids);
            bindCoordinateRanges(statement, next, chunks);
            try (ResultSet rows = statement.executeQuery()) {
                while (rows.next()) {
                    StairBuilder builder = result.get(rows.getLong("stair_id"));
                    if (builder != null) {
                        builder.path.add(new DungeonWindowEntityFragment.StairPathFact(
                                rows.getInt("sort_order"), cell(rows)));
                    }
                }
            }
        }
        try (PreparedStatement statement = queries.prepare(connection,
                "SELECT e.stair_id, e.stair_exit_id, e.cell_z AS level_z, e.cell_x, e.cell_y, e.label FROM "
                        + DungeonPersistenceSchema.STAIR_EXITS_TABLE + " e"
                        + " JOIN " + DungeonPersistenceSchema.STAIRS_TABLE + " s ON s.stair_id=e.stair_id"
                        + " WHERE s.dungeon_map_id=? AND e.stair_id IN (" + placeholders(ids.size()) + ")"
                        + " AND (" + coordinatePredicate("e.cell_z", "e.cell_x", "e.cell_y", chunks.size()) + ")"
                        + " ORDER BY e.stair_id, e.cell_z, e.cell_y, e.cell_x, e.stair_exit_id")) {
            int next = bindMapAndIds(statement, mapId, ids);
            bindCoordinateRanges(statement, next, chunks);
            try (ResultSet rows = statement.executeQuery()) {
                while (rows.next()) {
                    StairBuilder builder = result.get(rows.getLong("stair_id"));
                    if (builder != null) {
                        builder.exits.add(new DungeonWindowEntityFragment.StairExitFact(
                                rows.getLong("stair_exit_id"), cell(rows), rows.getString("label")));
                    }
                }
            }
        }
        return result;
    }

    private static Map<Long, DungeonWindowEntityFragment.Transition> loadTransitions(
            Connection connection, long mapId, List<Long> ids,
            Map<DungeonPatchEntityRef, List<DungeonChunkKey>> memberships,
            DungeonSqliteQueryCounter queries
    ) throws SQLException {
        if (ids.isEmpty()) {
            return Map.of();
        }
        Map<Long, DungeonWindowEntityFragment.Transition> result = new LinkedHashMap<>();
        try (PreparedStatement statement = queries.prepare(connection,
                "SELECT transition_id, dungeon_map_id, description, cell_x, cell_y, level_z, anchor_type,"
                        + " anchor_edge_direction, destination_type, target_overworld_map_id,"
                        + " target_overworld_tile_id, target_dungeon_map_id, target_transition_id, linked_transition_id"
                        + " FROM " + DungeonPersistenceSchema.TRANSITIONS_TABLE
                        + " WHERE dungeon_map_id=? AND transition_id IN (" + placeholders(ids.size()) + ")"
                        + " ORDER BY transition_id")) {
            bindMapAndIds(statement, mapId, ids);
            try (ResultSet rows = statement.executeQuery()) {
                while (rows.next()) {
                    long id = rows.getLong("transition_id");
                    Integer cellX = DungeonSqliteStatementSupport.nullableInteger(rows, "cell_x");
                    Integer cellY = DungeonSqliteStatementSupport.nullableInteger(rows, "cell_y");
                    Integer levelZ = DungeonSqliteStatementSupport.nullableInteger(rows, "level_z");
                    String anchorType = rows.getString("anchor_type");
                    String anchorEdgeDirection = rows.getString("anchor_edge_direction");
                    String destinationType = rows.getString("destination_type");
                    Long targetOverworldMapId = DungeonSqliteStatementSupport.nullableLong(
                            rows, "target_overworld_map_id");
                    Long targetOverworldTileId = DungeonSqliteStatementSupport.nullableLong(
                            rows, "target_overworld_tile_id");
                    Long targetDungeonMapId = DungeonSqliteStatementSupport.nullableLong(
                            rows, "target_dungeon_map_id");
                    Long targetTransitionId = DungeonSqliteStatementSupport.nullableLong(
                            rows, "target_transition_id");
                    Long linkedTransitionId = DungeonSqliteStatementSupport.nullableLong(
                            rows, "linked_transition_id");
                    DungeonTransitionRecord record = new DungeonTransitionRecord(
                            id, rows.getLong("dungeon_map_id"), rows.getString("description"),
                            cellX, cellY, levelZ, anchorType, anchorEdgeDirection, destinationType,
                            targetOverworldMapId, targetOverworldTileId, targetDungeonMapId,
                            targetTransitionId, linkedTransitionId);
                    Transition value;
                    try {
                        DungeonTransitionSourceValidation.validate(record);
                        value = ((DungeonEntitySnapshot.TransitionSnapshot) DungeonWindowEntityMapper
                                .toSnapshot(new DungeonWindowEntityRecord.Transition(record))).value();
                    } catch (RuntimeException exception) {
                        throw new IllegalStateException("Malformed dungeon transition record " + id, exception);
                    }
                    List<DungeonPatchEntityRef> dependencies = new ArrayList<>();
                    if (value.linkedTransitionId() != null) {
                        dependencies.add(DungeonPatchEntityRef.transition(value.linkedTransitionId()));
                    }
                    if (value.destination().isDungeonMap() && value.destination().mapId() == mapId
                            && value.destination().transitionId() != null) {
                        dependencies.add(DungeonPatchEntityRef.transition(value.destination().transitionId()));
                    }
                    result.put(id, new DungeonWindowEntityFragment.Transition(
                            DungeonPatchEntityRef.transition(id), value.description(), value.anchor(), value.destination(),
                            value.linkedTransitionId(), memberships.get(DungeonPatchEntityRef.transition(id)), dependencies));
                }
            }
        }
        return result;
    }

    private static Map<Long, DungeonWindowEntityFragment.FeatureMarker> loadMarkers(
            Connection connection, long mapId, List<Long> ids,
            Map<DungeonPatchEntityRef, List<DungeonChunkKey>> memberships,
            DungeonSqliteQueryCounter queries
    ) throws SQLException {
        if (ids.isEmpty()) {
            return Map.of();
        }
        Map<Long, DungeonWindowEntityFragment.FeatureMarker> result = new LinkedHashMap<>();
        try (PreparedStatement statement = queries.prepare(connection,
                "SELECT feature_marker_id, marker_kind, cell_x, cell_y, level_z, label, description FROM "
                        + DungeonPersistenceSchema.FEATURE_MARKERS_TABLE
                        + " WHERE dungeon_map_id=? AND feature_marker_id IN (" + placeholders(ids.size()) + ")"
                        + " ORDER BY feature_marker_id")) {
            bindMapAndIds(statement, mapId, ids);
            try (ResultSet rows = statement.executeQuery()) {
                while (rows.next()) {
                    long id = rows.getLong("feature_marker_id");
                    FeatureMarkerKind kind = FeatureMarkerKind.valueOf(
                            rows.getString("marker_kind").toUpperCase(Locale.ROOT));
                    String description = rows.getString("description");
                    if (description == null) {
                        throw new IllegalStateException("feature marker description is missing");
                    }
                    result.put(id, new DungeonWindowEntityFragment.FeatureMarker(
                            DungeonPatchEntityRef.featureMarker(id), kind, cell(rows), rows.getString("label"),
                            description,
                            memberships.get(DungeonPatchEntityRef.featureMarker(id)), List.of()));
                }
            }
        }
        return result;
    }

    private static Map<DungeonPatchEntityRef.Kind, List<Long>> idsByKind(Set<DungeonPatchEntityRef> refs) {
        Map<DungeonPatchEntityRef.Kind, List<Long>> result = new EnumMap<>(DungeonPatchEntityRef.Kind.class);
        for (DungeonPatchEntityRef.Kind kind : DungeonPatchEntityRef.Kind.values()) {
            result.put(kind, new ArrayList<>());
        }
        for (DungeonPatchEntityRef ref : refs) {
            result.get(ref.kind()).add(ref.id());
        }
        result.replaceAll((kind, values) -> values.stream().sorted().distinct().toList());
        return result;
    }

    private static String scopedClusterCenters(String controlTable, int corridorCount) {
        return "SELECT r.cluster_id, c.level_z, c.cell_x, c.cell_y,"
                + " ROW_NUMBER() OVER (PARTITION BY r.cluster_id"
                + " ORDER BY c.level_z, c.cell_y, c.cell_x) AS center_order"
                + " FROM " + DungeonPersistenceSchema.ROOMS_TABLE + " r"
                + " JOIN " + DungeonPersistenceSchema.ROOM_CELLS_TABLE + " c ON c.room_id=r.room_id"
                + " WHERE r.cluster_id IN (SELECT DISTINCT scoped.cluster_id FROM " + controlTable + " scoped"
                + " WHERE scoped.corridor_id IN (" + placeholders(corridorCount) + "))";
    }

    private static DungeonTopologyRef boundaryTopology(
            DungeonWindowEntityFragment.BoundaryKind kind,
            Cell cell,
            Direction direction,
            Long storedId
    ) {
        if (kind == DungeonWindowEntityFragment.BoundaryKind.OPEN) {
            if (storedId != null) {
                throw new IllegalStateException("open boundary must not own topology identity");
            }
            return DungeonTopologyRef.empty();
        }
        if (storedId == null) {
            throw new IllegalStateException("renderable boundary topology identity is missing");
        }
        return new DungeonTopologyRef(
                kind == DungeonWindowEntityFragment.BoundaryKind.DOOR
                        ? DungeonTopologyElementKind.DOOR
                        : DungeonTopologyElementKind.WALL,
                storedId);
    }

    private static DungeonTopologyRef topology(DungeonTopologyElementKind kind, Long id) {
        if (id == null) {
            throw new IllegalStateException(kind + " topology identity is missing");
        }
        return new DungeonTopologyRef(kind, id);
    }

    private static Direction direction(String value) {
        return Direction.valueOf(value.trim().toUpperCase(Locale.ROOT));
    }

    private static Direction direction(int code) {
        return switch (code) {
            case 0 -> Direction.NORTH;
            case 1 -> Direction.EAST;
            case 2 -> Direction.SOUTH;
            case 3 -> Direction.WEST;
            default -> throw new IllegalArgumentException("invalid stored direction code: " + code);
        };
    }

    private static Cell cell(ResultSet rows) throws SQLException {
        return new Cell(rows.getInt("cell_x"), rows.getInt("cell_y"), rows.getInt("level_z"));
    }

    private static String placeholders(int count) {
        return String.join(",", java.util.Collections.nCopies(count, "?"));
    }

    private static int bindMapAndIds(PreparedStatement statement, long mapId, List<Long> ids) throws SQLException {
        return bindMapAndIds(statement, 1, mapId, ids);
    }

    private static int bindMapAndIds(
            PreparedStatement statement,
            int firstParameter,
            long mapId,
            List<Long> ids
    ) throws SQLException {
        int parameter = firstParameter;
        statement.setLong(parameter++, mapId);
        return bindIds(statement, parameter, ids);
    }

    private static int bindIds(PreparedStatement statement, int firstParameter, List<Long> ids) throws SQLException {
        int parameter = firstParameter;
        for (Long id : ids) {
            statement.setLong(parameter++, id);
        }
        return parameter;
    }

    private static String chunkPredicate(int count) {
        return String.join(" OR ", java.util.Collections.nCopies(
                count, "(level_z=? AND chunk_q=? AND chunk_r=?)"));
    }

    private static void bindChunkKeys(
            PreparedStatement statement,
            int firstParameter,
            List<DungeonChunkKey> chunks
    ) throws SQLException {
        int parameter = firstParameter;
        for (DungeonChunkKey chunk : chunks) {
            statement.setInt(parameter++, chunk.level());
            statement.setInt(parameter++, chunk.chunkQ());
            statement.setInt(parameter++, chunk.chunkR());
        }
    }

    private static String coordinatePredicate(String level, String x, String y, int count) {
        List<String> clauses = new ArrayList<>();
        for (int index = 0; index < count; index++) {
            clauses.add("(" + level + "=? AND " + x + " BETWEEN ? AND ? AND " + y + " BETWEEN ? AND ?)");
        }
        return String.join(" OR ", clauses);
    }

    private static void bindCoordinateRanges(
            PreparedStatement statement, int firstParameter, List<DungeonChunkKey> chunks
    ) throws SQLException {
        int parameter = firstParameter;
        for (DungeonChunkKey chunk : chunks) {
            long minimumX = (long) chunk.chunkQ() * DungeonChunkKey.CHUNK_SIZE;
            long minimumY = (long) chunk.chunkR() * DungeonChunkKey.CHUNK_SIZE;
            statement.setInt(parameter++, chunk.level());
            statement.setLong(parameter++, minimumX);
            statement.setLong(parameter++, minimumX + DungeonChunkKey.CHUNK_SIZE - 1L);
            statement.setLong(parameter++, minimumY);
            statement.setLong(parameter++, minimumY + DungeonChunkKey.CHUNK_SIZE - 1L);
        }
    }


    private static <T> T require(T value, DungeonPatchEntityRef ref) {
        if (value == null) {
            throw new IllegalStateException("Dungeon membership references missing or unclipped entity " + ref);
        }
        return value;
    }

    private static final class RoomBuilder {
        private final long id;
        private final long clusterId;
        private final String name;
        private final String description;
        private final List<Cell> cells = new ArrayList<>();
        private final List<DungeonWindowEntityFragment.RoomExitFact> exits = new ArrayList<>();

        private RoomBuilder(long id, long clusterId, String name, String description) {
            this.id = id;
            this.clusterId = clusterId;
            this.name = name;
            this.description = description;
        }

        private DungeonWindowEntityFragment.Room build(List<DungeonChunkKey> memberships) {
            return new DungeonWindowEntityFragment.Room(
                    DungeonPatchEntityRef.room(id), clusterId, name, description, cells, exits, memberships,
                    List.of(DungeonPatchEntityRef.roomCluster(clusterId)));
        }
    }

    private static final class ClusterBuilder {
        private final long id;
        private final String name;
        private final List<DungeonWindowEntityFragment.ClusterMemberCellFact> members = new ArrayList<>();
        private final List<DungeonWindowEntityFragment.ClusterBoundaryFact> boundaries = new ArrayList<>();
        private final Set<DungeonPatchEntityRef> dependencies = new LinkedHashSet<>();

        private ClusterBuilder(long id, String name) {
            this.id = id;
            this.name = name;
        }

        private DungeonWindowEntityFragment.RoomCluster build(List<DungeonChunkKey> memberships) {
            return new DungeonWindowEntityFragment.RoomCluster(
                    DungeonPatchEntityRef.roomCluster(id), name, members, boundaries, memberships,
                    List.copyOf(dependencies));
        }
    }

    private static final class CorridorBuilder {
        private final long id;
        private final int level;
        private final List<Long> roomIds = new ArrayList<>();
        private final List<DungeonWindowEntityFragment.CorridorWaypointFact> waypoints = new ArrayList<>();
        private final List<DungeonWindowEntityFragment.CorridorDoorFact> doors = new ArrayList<>();
        private final List<DungeonWindowEntityFragment.CorridorAnchorFact> anchors = new ArrayList<>();
        private final List<DungeonWindowEntityFragment.CorridorAnchorRefFact> anchorRefs = new ArrayList<>();
        private final List<DungeonWindowEntityFragment.CorridorRouteCellFact> routeCells = new ArrayList<>();
        private final Set<DungeonPatchEntityRef> dependencies = new LinkedHashSet<>();

        private CorridorBuilder(long id, int level) {
            this.id = id;
            this.level = level;
        }

        private DungeonWindowEntityFragment.Corridor build(List<DungeonChunkKey> memberships) {
            return new DungeonWindowEntityFragment.Corridor(
                    DungeonPatchEntityRef.corridor(id), level, roomIds,
                    waypoints, doors, anchors, anchorRefs, routeCells,
                    memberships, List.copyOf(dependencies));
        }
    }

    private static final class StairBuilder {
        private final long id;
        private final String name;
        private final StairShape shape;
        private final Direction direction;
        private final int dimension1;
        private final int dimension2;
        private final Long corridorId;
        private final List<DungeonWindowEntityFragment.StairPathFact> path = new ArrayList<>();
        private final List<DungeonWindowEntityFragment.StairExitFact> exits = new ArrayList<>();

        private StairBuilder(
                long id, String name, StairShape shape, Direction direction,
                int dimension1, int dimension2, Long corridorId
        ) {
            this.id = id;
            this.name = name;
            this.shape = shape;
            this.direction = direction;
            this.dimension1 = dimension1;
            this.dimension2 = dimension2;
            this.corridorId = corridorId;
        }

        private DungeonWindowEntityFragment.Stair build(List<DungeonChunkKey> memberships) {
            List<DungeonPatchEntityRef> dependencies = corridorId == null
                    ? List.of()
                    : List.of(DungeonPatchEntityRef.corridor(corridorId));
            return new DungeonWindowEntityFragment.Stair(
                    DungeonPatchEntityRef.stair(id), name, shape, direction, dimension1, dimension2, corridorId,
                    path, exits, memberships, dependencies);
        }
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
