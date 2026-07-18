package features.dungeon.adapter.sqlite.gateway;

import features.dungeon.adapter.sqlite.mapper.DungeonPatchRecordMapper;
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
import features.dungeon.adapter.sqlite.model.DungeonStairPathNodeRecord;
import features.dungeon.adapter.sqlite.model.DungeonStairExitRecord;
import features.dungeon.adapter.sqlite.model.DungeonStairRecord;
import features.dungeon.adapter.sqlite.model.DungeonTransitionRecord;
import features.dungeon.application.authored.command.CorridorChange;
import features.dungeon.application.authored.command.DungeonPatch;
import features.dungeon.application.authored.command.DungeonPatchChange;
import features.dungeon.application.authored.command.FeatureMarkerChange;
import features.dungeon.application.authored.command.RoomClusterChange;
import features.dungeon.application.authored.command.RoomRegionChange;
import features.dungeon.application.authored.command.StairChange;
import features.dungeon.application.authored.command.TransitionChange;
import features.dungeon.domain.core.component.StairExit;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.graph.DungeonTopologyRef;
import features.dungeon.domain.core.structure.room.RoomCluster;
import features.dungeon.domain.core.structure.stair.Stair;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Types;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

/** Exact single-entity authored-row mutations used by the patch transaction. */
final class DungeonSqlitePatchEntityWriter {

    private DungeonSqlitePatchEntityWriter() {
    }

    static void validateStoredBeforeGraph(Connection connection, DungeonPatch patch) throws SQLException {
        List<CorridorChange> corridors = changes(patch, CorridorChange.class);
        Map<AnchorKey, Long> anchorTopology = loadAnchorTopology(connection, corridors);
        for (DungeonPatchChange change : patch.changes()) {
            switch (change) {
                case RoomClusterChange cluster -> validateCluster(connection, cluster);
                case RoomRegionChange room -> validateRoom(connection, room);
                case CorridorChange corridor -> validateCorridor(connection, corridor, anchorTopology);
                case StairChange stair -> validateStair(connection, stair);
                case TransitionChange transition -> validateTransition(connection, transition);
                case FeatureMarkerChange marker -> validateMarker(connection, marker);
            }
        }
        validateStoredTopology(connection, patch, anchorTopology);
        validateReferences(connection, patch);
        validateInboundRelations(connection, patch);
    }

    private static void validateStoredTopology(Connection c, DungeonPatch patch, Map<AnchorKey, Long> topology)
            throws SQLException {
        Set<TopologyKey> before = topologyKeysForState(patch, topology, true);
        Set<TopologyKey> after = topologyKeysForState(patch, topology, false);
        Set<TopologyKey> all = new LinkedHashSet<>(before);
        all.addAll(after);
        for (TopologyKey key : all) {
            StoredTopology stored = existingTopology(c, patch.mapId().value(), key);
            if (!before.contains(key)) {
                if (stored != null && !matchesStoredTopology(c, patch.mapId().value(), key, stored)) {
                    throw new IllegalStateException("insert collides with existing Dungeon topology identity: "
                            + key.kind() + ":" + key.id());
                }
                continue;
            }
            if (stored == null || !matchesStoredTopology(c, patch.mapId().value(), key, stored)) {
                throw new IllegalStateException("stored before graph does not match patch before facts: topology "
                        + key.kind() + ":" + key.id() + "; stored=" + stored);
            }
        }
    }

    private static Set<TopologyKey> topologyKeysForState(DungeonPatch patch, Map<AnchorKey, Long> topology,
            boolean before) {
        Set<TopologyKey> result = new LinkedHashSet<>();
        for (DungeonPatchChange change : patch.changes()) {
            switch (change) {
                case RoomClusterChange value -> {
                    if ((before ? value.before() : value.after()) != null) {
                        addBoundaryTopology(result, before ? value.before() : value.after());
                    }
                }
                case RoomRegionChange value -> {
                    if ((before ? value.before() : value.after()) != null) result.add(
                            new TopologyKey("ROOM", value.entityRef().id()));
                }
                case CorridorChange value -> {
                    if ((before ? value.before() : value.after()) != null) {
                        result.add(new TopologyKey("CORRIDOR", value.entityRef().id()));
                        addCorridorTopology(result, resolvedCorridor(DungeonPatchRecordMapper.corridor(
                                before ? value.before() : value.after()), topology));
                    }
                }
                case StairChange value -> {
                    if ((before ? value.before() : value.after()) != null) result.add(
                            new TopologyKey("STAIR", value.entityRef().id()));
                }
                case TransitionChange value -> {
                    if ((before ? value.before() : value.after()) != null) result.add(
                            new TopologyKey("TRANSITION", value.entityRef().id()));
                }
                case FeatureMarkerChange value -> {
                    if ((before ? value.before() : value.after()) != null) result.add(
                            new TopologyKey("FEATURE_MARKER", value.entityRef().id()));
                }
            }
        }
        return Set.copyOf(result);
    }

    private static void validateCluster(Connection c, RoomClusterChange change) throws SQLException {
        long id = change.entityRef().id();
        if (change.before() == null) {
            requireAbsent(c, "dungeon_room_clusters", "cluster_id", id);
            return;
        }
        DungeonRoomClusterRecord expected = DungeonPatchRecordMapper.cluster(change.before());
        requireRows("room cluster", rows(c,
                "SELECT dungeon_map_id,name FROM dungeon_room_clusters WHERE cluster_id=?", id),
                List.of(row(expected.mapId(), expected.name())));
        List<List<Object>> boundaries = new ArrayList<>();
        for (DungeonClusterBoundaryRecord boundary : expected.boundaries()) {
            boundaries.add(row(boundary.levelZ(), boundary.cellX(), boundary.cellY(), boundary.edgeDirection(),
                    boundary.edgeType(), boundary.topologyElementId()));
        }
        requireRows("room cluster boundaries", rows(c,
                "SELECT level_z,cell_x,cell_y,edge_direction,edge_type,topology_element_id "
                        + "FROM dungeon_room_cluster_edges WHERE dungeon_map_id=? AND cluster_id=? "
                        + "ORDER BY level_z,cell_y,cell_x,edge_direction", expected.mapId(), id), boundaries);
    }

    private static void validateRoom(Connection c, RoomRegionChange change) throws SQLException {
        long id = change.entityRef().id();
        if (change.before() == null) {
            requireAbsent(c, "dungeon_rooms", "room_id", id);
            return;
        }
        DungeonRoomRecord expected = DungeonPatchRecordMapper.room(change.before());
        requireRows("room", rows(c,
                "SELECT dungeon_map_id,cluster_id,name,visual_description FROM dungeon_rooms WHERE room_id=?", id),
                List.of(row(expected.mapId(), expected.clusterId(), expected.name(), expected.visualDescription())));
        List<List<Object>> cells = expected.floorCells().stream()
                .map(cell -> row(cell.levelZ(), cell.cellX(), cell.cellY())).toList();
        requireRows("room cells", rows(c,
                "SELECT level_z,cell_x,cell_y FROM dungeon_room_cells WHERE room_id=? "
                        + "ORDER BY level_z,cell_y,cell_x", id), cells);
        List<List<Object>> exits = new ArrayList<>();
        for (DungeonRoomExitDescriptionRecord exit : expected.exitDescriptions()) {
            exits.add(row(exit.levelZ(), exit.cellX(), exit.cellY(), exit.edgeDirection(), exit.description()));
        }
        requireRows("room narration exits", rows(c,
                "SELECT level_z,cell_x,cell_y,edge_direction,description "
                        + "FROM dungeon_room_exit_descriptions WHERE room_id=? ORDER BY sort_order", id), exits);
    }

    private static void validateCorridor(Connection c, CorridorChange change, Map<AnchorKey, Long> topology)
            throws SQLException {
        long id = change.entityRef().id();
        if (change.before() == null) {
            requireAbsent(c, "dungeon_corridors", "corridor_id", id);
            return;
        }
        DungeonCorridorRecord expected = resolvedCorridor(DungeonPatchRecordMapper.corridor(change.before()), topology);
        requireRows("corridor", rows(c,
                "SELECT dungeon_map_id,level_z FROM dungeon_corridors WHERE corridor_id=?", id),
                List.of(row(expected.mapId(), expected.levelZ())));
        requireRows("corridor members", rows(c,
                "SELECT room_id FROM dungeon_corridor_members WHERE corridor_id=? ORDER BY member_order", id),
                ordered(expected.roomIds(), value -> row(value)));
        requireRows("corridor waypoints", rows(c,
                "SELECT cluster_id,relative_x,relative_y,relative_z FROM dungeon_corridor_waypoints "
                        + "WHERE corridor_id=? ORDER BY sort_order", id),
                ordered(expected.waypoints(), value -> row(value.clusterId(), value.relativeX(), value.relativeY(),
                        value.relativeZ())));
        requireRows("corridor doors", rows(c,
                "SELECT room_id,cluster_id,relative_cell_x,relative_cell_y,relative_cell_z,edge_direction,"
                        + "topology_element_id FROM dungeon_corridor_door_overrides "
                        + "WHERE corridor_id=? ORDER BY sort_order", id),
                ordered(expected.doorBindings(), value -> row(value.roomId(), value.clusterId(), value.relativeCellX(),
                        value.relativeCellY(), value.relativeCellZ(), value.edgeDirection(), value.topologyElementId())));
        requireRows("corridor anchors", rows(c,
                "SELECT anchor_id,host_corridor_id,cell_x,cell_y,cell_z,topology_element_id "
                        + "FROM dungeon_corridor_anchors WHERE corridor_id=? ORDER BY sort_order", id),
                ordered(expected.anchorBindings(), value -> row(value.anchorId(), value.hostCorridorId(), value.cellX(),
                        value.cellY(), value.cellZ(), value.topologyElementId())));
        requireRows("corridor anchor refs", rows(c,
                "SELECT host_corridor_id,topology_element_id FROM dungeon_corridor_anchor_refs "
                        + "WHERE corridor_id=? ORDER BY sort_order", id),
                ordered(expected.anchorRefs(), value -> row(value.hostCorridorId(), value.topologyElementId())));
    }

    private static void validateStair(Connection c, StairChange change) throws SQLException {
        long id = change.entityRef().id();
        if (change.before() == null) {
            requireAbsent(c, "dungeon_stairs", "stair_id", id);
            return;
        }
        DungeonStairRecord expected = DungeonPatchRecordMapper.stair(change.before());
        requireRows("stair", rows(c,
                "SELECT dungeon_map_id,name,shape,direction,dimension1,dimension2,corridor_id "
                        + "FROM dungeon_stairs WHERE stair_id=?", id),
                List.of(row(expected.mapId(), expected.name(), expected.shape(), expected.direction(),
                        expected.dimension1(), expected.dimension2(), expected.corridorId())));
        requireRows("stair path", rows(c,
                "SELECT cell_x,cell_y,cell_z FROM dungeon_stair_path_nodes "
                        + "WHERE stair_id=? ORDER BY sort_order", id),
                ordered(expected.pathNodes(), value -> row(value.cellX(), value.cellY(), value.cellZ())));
        validateStairExits(c, expected);
    }

    private static void validateStairExits(Connection c, DungeonStairRecord expected) throws SQLException {
        List<List<Object>> actual = rows(c,
                "SELECT stair_exit_id,cell_x,cell_y,cell_z,label FROM dungeon_stair_exits "
                        + "WHERE stair_id=? ORDER BY stair_exit_id", expected.stairId());
        if (actual.size() != expected.exits().size()) {
            mismatch("stair exits");
        }
        List<List<Object>> remaining = new ArrayList<>(actual);
        for (DungeonStairExitRecord exit : expected.exits()) {
            boolean removed = remaining.removeIf(row -> (exit.exitId() <= 0L || sameNumber(row.get(0), exit.exitId()))
                    && sameNumber(row.get(1), exit.cellX()) && sameNumber(row.get(2), exit.cellY())
                    && sameNumber(row.get(3), exit.cellZ()) && Objects.equals(row.get(4), exit.label()));
            if (!removed) {
                mismatch("stair exits");
            }
        }
    }

    private static void validateTransition(Connection c, TransitionChange change) throws SQLException {
        long id = change.entityRef().id();
        if (change.before() == null) {
            requireAbsent(c, "dungeon_transitions", "transition_id", id);
            return;
        }
        DungeonTransitionRecord e = DungeonPatchRecordMapper.transition(change.before());
        requireRows("transition", rows(c,
                "SELECT dungeon_map_id,description,cell_x,cell_y,level_z,anchor_type,anchor_edge_direction,"
                        + "destination_type,target_overworld_map_id,target_overworld_tile_id,target_dungeon_map_id,"
                        + "target_transition_id,linked_transition_id FROM dungeon_transitions WHERE transition_id=?", id),
                List.of(row(e.mapId(), e.description(), e.cellX(), e.cellY(), e.levelZ(), e.anchorType(),
                        e.anchorEdgeDirection(), e.destinationType(), e.targetOverworldMapId(), e.targetOverworldTileId(),
                        e.targetDungeonMapId(), e.targetTransitionId(), e.linkedTransitionId())));
    }

    private static void validateMarker(Connection c, FeatureMarkerChange change) throws SQLException {
        long id = change.entityRef().id();
        if (change.before() == null) {
            requireAbsent(c, "dungeon_feature_markers", "feature_marker_id", id);
            return;
        }
        DungeonFeatureMarkerRecord e = DungeonPatchRecordMapper.featureMarker(change.before());
        requireRows("feature marker", rows(c,
                "SELECT dungeon_map_id,marker_kind,cell_x,cell_y,level_z,label,description "
                        + "FROM dungeon_feature_markers WHERE feature_marker_id=?", id),
                List.of(row(e.mapId(), e.markerKind(), e.cellX(), e.cellY(), e.levelZ(), e.label(), e.description())));
    }

    private static void validateReferences(Connection c, DungeonPatch patch) throws SQLException {
        long mapId = patch.mapId().value();
        for (RoomRegionChange change : changes(patch, RoomRegionChange.class)) {
            if (change.after() != null) {
                requireOwnedAfter(c, patch, "dungeon_room_clusters", "cluster_id", change.after().clusterId(), mapId);
            }
        }
        for (CorridorChange change : changes(patch, CorridorChange.class)) {
            if (change.after() == null) continue;
            DungeonCorridorRecord corridor = DungeonPatchRecordMapper.corridor(change.after());
            for (long roomId : corridor.roomIds()) {
                requireOwnedAfter(c, patch, "dungeon_rooms", "room_id", roomId, mapId);
            }
            for (DungeonCorridorWaypointRecord waypoint : corridor.waypoints()) {
                requireOwnedAfter(c, patch, "dungeon_room_clusters", "cluster_id", waypoint.clusterId(), mapId);
            }
            for (DungeonCorridorDoorBindingRecord door : corridor.doorBindings()) {
                requireOwnedAfter(c, patch, "dungeon_rooms", "room_id", door.roomId(), mapId);
                requireOwnedAfter(c, patch, "dungeon_room_clusters", "cluster_id", door.clusterId(), mapId);
            }
            for (DungeonCorridorAnchorBindingRecord anchor : corridor.anchorBindings()) {
                requireOwnedAfter(c, patch, "dungeon_corridors", "corridor_id", anchor.hostCorridorId(), mapId);
            }
            for (DungeonCorridorAnchorRefRecord ref : corridor.anchorRefs()) {
                requireOwnedAfter(c, patch, "dungeon_corridors", "corridor_id", ref.hostCorridorId(), mapId);
            }
            for (var ref : change.after().bindings().anchorRefs()) {
                if (ref.present()) {
                    requireAnchorAfter(c, patch, ref.hostCorridorId(), ref.anchorId(), mapId);
                }
            }
        }
        for (StairChange change : changes(patch, StairChange.class)) {
            if (change.after() != null && change.after().corridorId() != null) {
                requireOwnedAfter(c, patch, "dungeon_corridors", "corridor_id",
                        change.after().corridorId(), mapId);
            }
        }
        for (TransitionChange change : changes(patch, TransitionChange.class)) {
            if (change.after() == null) continue;
            DungeonTransitionRecord transition = DungeonPatchRecordMapper.transition(change.after());
            if (transition.targetDungeonMapId() != null) {
                requireSingleOwner(c, "dungeon_maps", "dungeon_map_id", transition.targetDungeonMapId(),
                        transition.targetDungeonMapId());
            }
            if (transition.targetTransitionId() != null) {
                if (transition.targetDungeonMapId() != null && transition.targetDungeonMapId() == mapId) {
                    requireOwnedAfter(c, patch, "dungeon_transitions", "transition_id",
                            transition.targetTransitionId(), mapId);
                } else {
                    requireSingleOwner(c, "dungeon_transitions", "transition_id", transition.targetTransitionId(),
                            transition.targetDungeonMapId());
                }
            }
            if (transition.linkedTransitionId() != null) {
                DungeonPatchChange linkedChange = patch.changes().stream()
                        .filter(candidate -> candidate instanceof TransitionChange
                                && candidate.entityRef().id() == transition.linkedTransitionId())
                        .findFirst().orElse(null);
                if (linkedChange != null) {
                    if (afterState(linkedChange) == null) {
                        throw new IllegalStateException("transition links to a removed post-patch transition");
                    }
                } else {
                    requireExists(c, "dungeon_transitions", "transition_id", transition.linkedTransitionId());
                }
            }
        }
    }

    private static void requireAnchorAfter(Connection c, DungeonPatch patch, long hostCorridorId, long anchorId,
            long mapId) throws SQLException {
        List<CorridorChange> changes = changes(patch, CorridorChange.class);
        boolean presentAfter = changes.stream().filter(change -> change.after() != null)
                .flatMap(change -> change.after().bindings().anchorBindings().stream())
                .anyMatch(anchor -> anchor.hostCorridorId() == hostCorridorId && anchor.anchorId() == anchorId);
        if (presentAfter) {
            return;
        }
        boolean changedAnchor = changes.stream().filter(change -> change.before() != null)
                .flatMap(change -> change.before().bindings().anchorBindings().stream())
                .anyMatch(anchor -> anchor.hostCorridorId() == hostCorridorId && anchor.anchorId() == anchorId);
        if (changedAnchor) {
            throw new IllegalStateException("corridor anchor ref names a missing post-patch anchor");
        }
        List<List<Object>> anchors = rows(c, "SELECT c.dungeon_map_id FROM dungeon_corridor_anchors a "
                + "JOIN dungeon_corridors c ON c.corridor_id=a.corridor_id "
                + "WHERE a.host_corridor_id=? AND a.anchor_id=?", hostCorridorId, anchorId);
        if (anchors.size() != 1 || ((Number) anchors.getFirst().getFirst()).longValue() != mapId) {
            throw new IllegalStateException("corridor anchor ref has missing or foreign anchor ownership");
        }
    }

    private static void validateInboundRelations(Connection c, DungeonPatch patch) throws SQLException {
        for (RoomClusterChange change : changes(patch, RoomClusterChange.class)) {
            if (change.after() == null) {
                requireInboundOwnersChanged(c, patch, "SELECT room_id FROM dungeon_rooms WHERE cluster_id=?",
                        change.entityRef().id(), RoomRegionChange.class);
                requireInboundOwnersChanged(c, patch,
                        "SELECT DISTINCT corridor_id FROM dungeon_corridor_waypoints WHERE cluster_id=? UNION "
                                + "SELECT DISTINCT corridor_id FROM dungeon_corridor_door_overrides WHERE cluster_id=?",
                        change.entityRef().id(), CorridorChange.class);
            }
        }
        for (RoomRegionChange change : changes(patch, RoomRegionChange.class)) {
            if (change.after() == null) {
                requireInboundOwnersChanged(c, patch,
                        "SELECT DISTINCT corridor_id FROM dungeon_corridor_members WHERE room_id=? UNION "
                                + "SELECT DISTINCT corridor_id FROM dungeon_corridor_door_overrides WHERE room_id=?",
                        change.entityRef().id(), CorridorChange.class);
            }
        }
        for (CorridorChange change : changes(patch, CorridorChange.class)) {
            if (change.after() == null) {
                requireInboundOwnersChanged(c, patch,
                        "SELECT DISTINCT corridor_id FROM dungeon_corridor_anchors WHERE host_corridor_id=? "
                                + "AND corridor_id<>? UNION SELECT DISTINCT corridor_id "
                                + "FROM dungeon_corridor_anchor_refs WHERE host_corridor_id=? AND corridor_id<>?",
                        change.entityRef().id(), CorridorChange.class);
                requireInboundOwnersChanged(c, patch, "SELECT stair_id FROM dungeon_stairs WHERE corridor_id=?",
                        change.entityRef().id(), StairChange.class);
            }
        }
        for (TransitionChange change : changes(patch, TransitionChange.class)) {
            if (change.after() == null) {
                requireInboundOwnersChanged(c, patch,
                        "SELECT transition_id FROM dungeon_transitions WHERE transition_id<>? "
                                + "AND (target_transition_id=? OR linked_transition_id=?)",
                        change.entityRef().id(), TransitionChange.class);
            }
        }
    }

    private static void requireInboundOwnersChanged(Connection c, DungeonPatch patch, String sql, long id,
            Class<? extends DungeonPatchChange> ownerType) throws SQLException {
        int parameters = countParameters(sql);
        Object[] values = new Object[parameters];
        java.util.Arrays.fill(values, id);
        for (List<Object> result : rows(c, sql, values)) {
            long ownerId = ((Number) result.getFirst()).longValue();
            boolean changed = patch.changes().stream().filter(ownerType::isInstance)
                    .anyMatch(change -> change.entityRef().id() == ownerId);
            if (!changed) {
                throw new IllegalStateException("patch would mutate an undeclared inbound Dungeon relation");
            }
        }
    }

    private static int countParameters(String sql) {
        int count = 0;
        for (int index = 0; index < sql.length(); index++) if (sql.charAt(index) == '?') count++;
        return count;
    }

    private static void requireOwnedAfter(Connection c, DungeonPatch patch, String table, String idColumn,
            long id, long mapId) throws SQLException {
        DungeonPatchChange changed = patch.changes().stream()
                .filter(change -> change.entityRef().id() == id && tableMatches(change, table))
                .findFirst().orElse(null);
        if (changed != null) {
            if (afterState(changed) == null) {
                throw new IllegalStateException("patch references an entity removed in the same transaction");
            }
            return;
        }
        requireSingleOwner(c, table, idColumn, id, mapId);
    }

    private static boolean tableMatches(DungeonPatchChange change, String table) {
        return switch (change) {
            case RoomClusterChange ignored -> "dungeon_room_clusters".equals(table);
            case RoomRegionChange ignored -> "dungeon_rooms".equals(table);
            case CorridorChange ignored -> "dungeon_corridors".equals(table);
            case StairChange ignored -> "dungeon_stairs".equals(table);
            case TransitionChange ignored -> "dungeon_transitions".equals(table);
            case FeatureMarkerChange ignored -> "dungeon_feature_markers".equals(table);
        };
    }

    private static Object afterState(DungeonPatchChange change) {
        return switch (change) {
            case RoomClusterChange value -> value.after();
            case RoomRegionChange value -> value.after();
            case CorridorChange value -> value.after();
            case StairChange value -> value.after();
            case TransitionChange value -> value.after();
            case FeatureMarkerChange value -> value.after();
        };
    }

    private static void requireAbsent(Connection c, String table, String idColumn, long id) throws SQLException {
        if (!rows(c, "SELECT dungeon_map_id FROM " + table + " WHERE " + idColumn + "=?", id).isEmpty()) {
            throw new IllegalStateException("insert collides with an existing global Dungeon identity");
        }
    }

    private static void requireExists(Connection c, String table, String idColumn, long id) throws SQLException {
        if (rows(c, "SELECT 1 FROM " + table + " WHERE " + idColumn + "=?", id).size() != 1) {
            throw new IllegalStateException("referenced Dungeon identity does not exist exactly once");
        }
    }

    private static void requireSingleOwner(Connection c, String table, String idColumn, long id, Long mapId)
            throws SQLException {
        List<List<Object>> owners = rows(c,
                "SELECT dungeon_map_id FROM " + table + " WHERE " + idColumn + "=?", id);
        if (owners.size() != 1 || mapId == null
                || ((Number) owners.getFirst().getFirst()).longValue() != mapId) {
            throw new IllegalStateException("referenced Dungeon identity has missing or foreign map ownership");
        }
    }

    private static <T> List<List<Object>> ordered(List<T> values,
            java.util.function.Function<T, List<Object>> mapper) {
        List<List<Object>> result = new ArrayList<>();
        for (T value : values) {
            result.add(List.copyOf(mapper.apply(value)));
        }
        return List.copyOf(result);
    }

    private static List<Object> row(Object... values) {
        return java.util.Arrays.asList(values);
    }

    private static List<List<Object>> rows(Connection c, String sql, Object... parameters) throws SQLException {
        List<List<Object>> result = new ArrayList<>();
        try (PreparedStatement statement = c.prepareStatement(sql)) {
            for (int index = 0; index < parameters.length; index++) {
                statement.setObject(index + 1, parameters[index]);
            }
            try (ResultSet rows = statement.executeQuery()) {
                int columns = rows.getMetaData().getColumnCount();
                while (rows.next()) {
                    List<Object> values = new ArrayList<>();
                    for (int column = 1; column <= columns; column++) {
                        Object value = rows.getObject(column);
                        if (value instanceof Number number) {
                            value = "INTEGER".equalsIgnoreCase(rows.getMetaData().getColumnTypeName(column))
                                    ? number.longValue() : value;
                        }
                        values.add(value);
                    }
                    result.add(java.util.Collections.unmodifiableList(values));
                }
            }
        }
        return List.copyOf(result);
    }

    private static void requireRows(String graph, List<List<Object>> actual, List<List<Object>> expected) {
        List<List<Object>> normalizedExpected = normalized(expected);
        if (!Objects.equals(actual, normalizedExpected)) {
            throw new IllegalStateException("stored before graph does not match patch before facts: "
                    + graph + "; actual=" + actual + "; expected=" + normalizedExpected);
        }
    }

    private static boolean sameNumber(Object value, long expected) {
        return value instanceof Number number && number.longValue() == expected;
    }

    private static List<List<Object>> normalized(List<List<Object>> rows) {
        List<List<Object>> result = new ArrayList<>();
        for (List<Object> row : rows) {
            List<Object> values = new ArrayList<>();
            for (Object value : row) values.add(value instanceof Number number ? number.longValue() : value);
            result.add(java.util.Collections.unmodifiableList(values));
        }
        return List.copyOf(result);
    }

    private static void mismatch(String graph) {
        throw new IllegalStateException("stored before graph does not match patch before facts: " + graph);
    }

    static MutationFacts apply(Connection connection, DungeonPatch patch) throws SQLException {
        List<RoomClusterChange> clusters = changes(patch, RoomClusterChange.class);
        List<RoomRegionChange> rooms = changes(patch, RoomRegionChange.class);
        List<CorridorChange> corridors = changes(patch, CorridorChange.class);
        List<StairChange> stairs = changes(patch, StairChange.class);
        List<TransitionChange> transitions = changes(patch, TransitionChange.class);
        List<FeatureMarkerChange> markers = changes(patch, FeatureMarkerChange.class);
        Map<AnchorKey, Long> anchorTopology = loadAnchorTopology(connection, corridors);
        Set<TopologyKey> topology = topologyKeys(clusters, rooms, corridors, stairs, transitions, markers, anchorTopology);

        // Parent shells first make every subsequent keyed child update FK-safe.
        for (RoomClusterChange change : clusters) {
            if (change.after() != null) {
                upsertCluster(connection, change.before() == null ? null : DungeonPatchRecordMapper.cluster(change.before()),
                        DungeonPatchRecordMapper.cluster(change.after()));
            }
        }
        for (RoomRegionChange change : rooms) {
            if (change.after() != null) {
                upsertRoom(connection, change.before() == null ? null : DungeonPatchRecordMapper.room(change.before()),
                        DungeonPatchRecordMapper.room(change.after()));
            }
        }
        for (CorridorChange change : corridors) {
            if (change.after() != null) {
                DungeonCorridorRecord before = change.before() == null ? null : resolvedCorridor(
                        DungeonPatchRecordMapper.corridor(change.before()), anchorTopology);
                DungeonCorridorRecord after = resolvedCorridor(
                        DungeonPatchRecordMapper.corridor(change.after()), anchorTopology);
                upsertCorridor(connection, before, after);
            }
        }

        for (RoomClusterChange change : clusters) {
            if (change.after() != null) {
                reconcileClusterBoundaries(connection,
                        change.before() == null ? List.of() : DungeonPatchRecordMapper.cluster(change.before()).boundaries(),
                        DungeonPatchRecordMapper.cluster(change.after()).boundaries(), change.after().mapId(),
                        change.after().clusterId());
            }
        }
        for (RoomRegionChange change : rooms) {
            if (change.after() != null) {
                DungeonRoomRecord before = change.before() == null ? null : DungeonPatchRecordMapper.room(change.before());
                DungeonRoomRecord after = DungeonPatchRecordMapper.room(change.after());
                reconcileRoomCells(connection, before == null ? List.of() : before.floorCells(), after.floorCells());
                reconcileRoomExits(connection, before == null ? List.of() : before.exitDescriptions(),
                        after.exitDescriptions());
            }
        }
        for (CorridorChange change : corridors) {
            if (change.after() != null) {
                DungeonCorridorRecord before = change.before() == null ? null : resolvedCorridor(
                        DungeonPatchRecordMapper.corridor(change.before()), anchorTopology);
                DungeonCorridorRecord after = resolvedCorridor(
                        DungeonPatchRecordMapper.corridor(change.after()), anchorTopology);
                reconcileCorridorChildren(connection, before, after);
            }
        }
        for (StairChange change : stairs) {
            if (change.after() != null) {
                DungeonStairRecord before = change.before() == null ? null : DungeonPatchRecordMapper.stair(change.before());
                DungeonStairRecord after = DungeonPatchRecordMapper.stair(change.after());
                upsertStair(connection, before, after);
                reconcileStairPath(connection, before == null ? List.of() : before.pathNodes(), after.pathNodes());
                reconcileStairExits(connection, change.before(), change.after());
            }
        }
        for (TransitionChange change : transitions) {
            if (change.after() != null) {
                upsertTransition(connection,
                        change.before() == null ? null : DungeonPatchRecordMapper.transition(change.before()),
                        DungeonPatchRecordMapper.transition(change.after()));
            }
        }
        for (FeatureMarkerChange change : markers) {
            if (change.after() != null) {
                upsertMarker(connection,
                        change.before() == null ? null : DungeonPatchRecordMapper.featureMarker(change.before()),
                        DungeonPatchRecordMapper.featureMarker(change.after()));
            }
        }

        deleteRemoved(connection, stairs, corridors, rooms, clusters, transitions, markers);
        reconcileTopology(connection, patch.mapId().value(), topology);
        return new MutationFacts(Set.copyOf(topology));
    }

    private static <T extends DungeonPatchChange> List<T> changes(DungeonPatch patch, Class<T> type) {
        return patch.changes().stream().filter(type::isInstance).map(type::cast).toList();
    }

    private static void upsertCluster(Connection connection, DungeonRoomClusterRecord before,
            DungeonRoomClusterRecord after) throws SQLException {
        if (before != null && Objects.equals(before.name(), after.name())) {
            return;
        }
        try (PreparedStatement statement = connection.prepareStatement(
                "INSERT INTO dungeon_room_clusters(cluster_id,dungeon_map_id,name) VALUES(?,?,?) "
                        + "ON CONFLICT(cluster_id) DO UPDATE SET name=excluded.name "
                        + "WHERE dungeon_room_clusters.dungeon_map_id=excluded.dungeon_map_id")) {
            statement.setLong(1, after.clusterId());
            statement.setLong(2, after.mapId());
            statement.setString(3, after.name());
            requireMutation(statement.executeUpdate(), 1, "room cluster upsert");
        }
    }

    private static void upsertRoom(Connection connection, DungeonRoomRecord before, DungeonRoomRecord after)
            throws SQLException {
        if (before != null && before.clusterId() == after.clusterId()
                && Objects.equals(before.name(), after.name())
                && Objects.equals(before.visualDescription(), after.visualDescription())) {
            return;
        }
        try (PreparedStatement statement = connection.prepareStatement(
                "INSERT INTO dungeon_rooms(room_id,dungeon_map_id,cluster_id,name,visual_description) VALUES(?,?,?,?,?) "
                        + "ON CONFLICT(room_id) DO UPDATE SET cluster_id=excluded.cluster_id,name=excluded.name,"
                        + "visual_description=excluded.visual_description "
                        + "WHERE dungeon_rooms.dungeon_map_id=excluded.dungeon_map_id")) {
            statement.setLong(1, after.roomId());
            statement.setLong(2, after.mapId());
            statement.setLong(3, after.clusterId());
            statement.setString(4, after.name());
            statement.setString(5, after.visualDescription());
            requireMutation(statement.executeUpdate(), 1, "room upsert");
        }
    }

    private static void upsertCorridor(Connection connection, DungeonCorridorRecord before,
            DungeonCorridorRecord after) throws SQLException {
        if (before != null && before.levelZ() == after.levelZ()) {
            return;
        }
        try (PreparedStatement statement = connection.prepareStatement(
                "INSERT INTO dungeon_corridors(corridor_id,dungeon_map_id,level_z) VALUES(?,?,?) "
                        + "ON CONFLICT(corridor_id) DO UPDATE SET level_z=excluded.level_z "
                        + "WHERE dungeon_corridors.dungeon_map_id=excluded.dungeon_map_id")) {
            statement.setLong(1, after.corridorId());
            statement.setLong(2, after.mapId());
            statement.setInt(3, after.levelZ());
            requireMutation(statement.executeUpdate(), 1, "corridor upsert");
        }
    }

    private static void reconcileRoomCells(Connection connection, List<DungeonRoomCellRecord> before,
            List<DungeonRoomCellRecord> after) throws SQLException {
        Map<CellKey, DungeonRoomCellRecord> oldRows = keyed(before, CellKey::from);
        Map<CellKey, DungeonRoomCellRecord> newRows = keyed(after, CellKey::from);
        try (PreparedStatement delete = connection.prepareStatement(
                "DELETE FROM dungeon_room_cells WHERE room_id=? AND level_z=? AND cell_x=? AND cell_y=?");
             PreparedStatement insert = connection.prepareStatement(
                     "INSERT INTO dungeon_room_cells(room_id,level_z,cell_x,cell_y) VALUES(?,?,?,?)")) {
            for (var entry : oldRows.entrySet()) {
                if (!newRows.containsKey(entry.getKey())) {
                    bindCell(delete, entry.getValue());
                    delete.addBatch();
                }
            }
            for (var entry : newRows.entrySet()) {
                if (!oldRows.containsKey(entry.getKey())) {
                    bindCell(insert, entry.getValue());
                    insert.addBatch();
                }
            }
            delete.executeBatch();
            insert.executeBatch();
        }
    }

    private static void bindCell(PreparedStatement statement, DungeonRoomCellRecord row) throws SQLException {
        statement.setLong(1, row.roomId());
        statement.setInt(2, row.levelZ());
        statement.setInt(3, row.cellX());
        statement.setInt(4, row.cellY());
    }

    private static void reconcileRoomExits(Connection connection, List<DungeonRoomExitDescriptionRecord> before,
            List<DungeonRoomExitDescriptionRecord> after) throws SQLException {
        Map<ExitKey, OrderedExit> oldRows = orderedExits(before);
        Map<ExitKey, OrderedExit> newRows = orderedExits(after);
        try (PreparedStatement delete = connection.prepareStatement(
                "DELETE FROM dungeon_room_exit_descriptions WHERE room_id=? AND level_z=? AND cell_x=? "
                        + "AND cell_y=? AND edge_direction=?");
             PreparedStatement update = connection.prepareStatement(
                     "UPDATE dungeon_room_exit_descriptions SET description=?,sort_order=? WHERE room_id=? "
                             + "AND level_z=? AND cell_x=? AND cell_y=? AND edge_direction=?");
             PreparedStatement insert = connection.prepareStatement(
                     "INSERT INTO dungeon_room_exit_descriptions(room_id,level_z,cell_x,cell_y,edge_direction,"
                             + "description,sort_order) VALUES(?,?,?,?,?,?,?)")) {
            for (var entry : oldRows.entrySet()) {
                if (!newRows.containsKey(entry.getKey())) {
                    bindExitKey(delete, entry.getValue().row(), 1);
                    delete.addBatch();
                }
            }
            for (var entry : newRows.entrySet()) {
                OrderedExit old = oldRows.get(entry.getKey());
                OrderedExit next = entry.getValue();
                if (old == null) {
                    bindExitKey(insert, next.row(), 1);
                    insert.setString(6, next.row().description());
                    insert.setInt(7, next.order());
                    insert.addBatch();
                } else if (!old.equals(next)) {
                    update.setString(1, next.row().description());
                    update.setInt(2, next.order());
                    bindExitKey(update, next.row(), 3);
                    update.addBatch();
                }
            }
            delete.executeBatch();
            update.executeBatch();
            insert.executeBatch();
        }
    }

    private static Map<ExitKey, OrderedExit> orderedExits(List<DungeonRoomExitDescriptionRecord> rows) {
        Map<ExitKey, OrderedExit> result = new LinkedHashMap<>();
        for (int index = 0; index < rows.size(); index++) {
            result.put(ExitKey.from(rows.get(index)), new OrderedExit(rows.get(index), index));
        }
        return result;
    }

    private static void bindExitKey(PreparedStatement statement, DungeonRoomExitDescriptionRecord row, int start)
            throws SQLException {
        statement.setLong(start, row.roomId());
        statement.setInt(start + 1, row.levelZ());
        statement.setInt(start + 2, row.cellX());
        statement.setInt(start + 3, row.cellY());
        statement.setString(start + 4, row.edgeDirection());
    }

    private static void reconcileClusterBoundaries(Connection connection, List<DungeonClusterBoundaryRecord> before,
            List<DungeonClusterBoundaryRecord> after, long mapId, long clusterId) throws SQLException {
        Map<BoundaryKey, DungeonClusterBoundaryRecord> oldRows = keyed(before, BoundaryKey::from);
        Map<BoundaryKey, DungeonClusterBoundaryRecord> newRows = keyed(after, BoundaryKey::from);
        try (PreparedStatement delete = connection.prepareStatement(
                "DELETE FROM dungeon_room_cluster_edges WHERE dungeon_map_id=? AND cluster_id=? AND level_z=? "
                        + "AND cell_x=? AND cell_y=? AND edge_direction=?");
             PreparedStatement update = connection.prepareStatement(
                     "UPDATE dungeon_room_cluster_edges SET edge_type=?,topology_element_id=? WHERE dungeon_map_id=? "
                             + "AND cluster_id=? AND level_z=? AND cell_x=? AND cell_y=? AND edge_direction=?");
             PreparedStatement insert = connection.prepareStatement(
                     "INSERT INTO dungeon_room_cluster_edges(dungeon_map_id,cluster_id,level_z,cell_x,cell_y,"
                             + "edge_direction,edge_type,topology_element_id) VALUES(?,?,?,?,?,?,?,?)")) {
            for (var entry : oldRows.entrySet()) {
                if (!newRows.containsKey(entry.getKey())) {
                    bindBoundaryKey(delete, mapId, clusterId, entry.getValue(), 1);
                    delete.addBatch();
                }
            }
            for (var entry : newRows.entrySet()) {
                DungeonClusterBoundaryRecord old = oldRows.get(entry.getKey());
                DungeonClusterBoundaryRecord next = entry.getValue();
                if (old == null) {
                    bindBoundaryKey(insert, mapId, clusterId, next, 1);
                    insert.setString(7, next.edgeType());
                    nullableLong(insert, 8, next.topologyElementId());
                    insert.addBatch();
                } else if (!old.equals(next)) {
                    update.setString(1, next.edgeType());
                    nullableLong(update, 2, next.topologyElementId());
                    bindBoundaryKey(update, mapId, clusterId, next, 3);
                    update.addBatch();
                }
            }
            delete.executeBatch();
            update.executeBatch();
            insert.executeBatch();
        }
    }

    private static void bindBoundaryKey(PreparedStatement statement, long mapId, long clusterId,
            DungeonClusterBoundaryRecord row, int start) throws SQLException {
        statement.setLong(start, mapId);
        statement.setLong(start + 1, clusterId);
        statement.setInt(start + 2, row.levelZ());
        statement.setInt(start + 3, row.cellX());
        statement.setInt(start + 4, row.cellY());
        statement.setString(start + 5, row.edgeDirection());
    }

    private static void reconcileCorridorChildren(Connection connection, DungeonCorridorRecord before,
            DungeonCorridorRecord after) throws SQLException {
        reconcileCorridorMembers(connection, before == null ? List.of() : before.roomIds(), after);
        reconcileWaypoints(connection, before == null ? List.of() : before.waypoints(), after);
        reconcileDoors(connection, before == null ? List.of() : before.doorBindings(), after);
        reconcileAnchors(connection, before == null ? List.of() : before.anchorBindings(), after);
        reconcileAnchorRefs(connection, before == null ? List.of() : before.anchorRefs(), after);
    }

    private static void reconcileCorridorMembers(Connection connection, List<Long> before,
            DungeonCorridorRecord after) throws SQLException {
        Map<Long, Integer> oldRows = orderedLongs(before);
        Map<Long, Integer> newRows = orderedLongs(after.roomIds());
        try (PreparedStatement delete = connection.prepareStatement(
                "DELETE FROM dungeon_corridor_members WHERE corridor_id=? AND room_id=?");
             PreparedStatement update = connection.prepareStatement(
                     "UPDATE dungeon_corridor_members SET member_order=? WHERE corridor_id=? AND room_id=?");
             PreparedStatement insert = connection.prepareStatement(
                     "INSERT INTO dungeon_corridor_members(corridor_id,room_id,member_order) VALUES(?,?,?)")) {
            for (var entry : oldRows.entrySet()) {
                if (!newRows.containsKey(entry.getKey())) {
                    delete.setLong(1, after.corridorId()); delete.setLong(2, entry.getKey()); delete.addBatch();
                }
            }
            for (var entry : newRows.entrySet()) {
                Integer old = oldRows.get(entry.getKey());
                if (old == null) {
                    insert.setLong(1, after.corridorId()); insert.setLong(2, entry.getKey());
                    insert.setInt(3, entry.getValue()); insert.addBatch();
                } else if (!old.equals(entry.getValue())) {
                    update.setInt(1, entry.getValue()); update.setLong(2, after.corridorId());
                    update.setLong(3, entry.getKey()); update.addBatch();
                }
            }
            delete.executeBatch(); update.executeBatch(); insert.executeBatch();
        }
    }

    private static void reconcileWaypoints(Connection connection, List<DungeonCorridorWaypointRecord> before,
            DungeonCorridorRecord after) throws SQLException {
        reconcileOrderedCorridorRows(connection, after.corridorId(), before, after.waypoints(),
                "dungeon_corridor_waypoints",
                "cluster_id=?,relative_x=?,relative_y=?,relative_z=?",
                "corridor_id,sort_order,cluster_id,relative_x,relative_y,relative_z",
                (statement, row, start) -> {
                    statement.setLong(start, row.clusterId()); statement.setInt(start + 1, row.relativeX());
                    statement.setInt(start + 2, row.relativeY()); statement.setInt(start + 3, row.relativeZ());
                });
    }

    private static void reconcileDoors(Connection connection, List<DungeonCorridorDoorBindingRecord> before,
            DungeonCorridorRecord after) throws SQLException {
        Map<Long, OrderedDoor> oldRows = orderedDoors(before);
        Map<Long, OrderedDoor> newRows = orderedDoors(after.doorBindings());
        try (PreparedStatement delete = connection.prepareStatement(
                "DELETE FROM dungeon_corridor_door_overrides WHERE corridor_id=? AND room_id=?");
             PreparedStatement update = connection.prepareStatement(
                     "UPDATE dungeon_corridor_door_overrides SET cluster_id=?,relative_cell_x=?,relative_cell_y=?,"
                             + "relative_cell_z=?,edge_direction=?,topology_element_id=?,sort_order=? "
                             + "WHERE corridor_id=? AND room_id=?");
             PreparedStatement insert = connection.prepareStatement(
                     "INSERT INTO dungeon_corridor_door_overrides(corridor_id,room_id,cluster_id,relative_cell_x,"
                             + "relative_cell_y,relative_cell_z,edge_direction,topology_element_id,sort_order) "
                             + "VALUES(?,?,?,?,?,?,?,?,?)")) {
            for (var entry : oldRows.entrySet()) if (!newRows.containsKey(entry.getKey())) {
                delete.setLong(1, after.corridorId()); delete.setLong(2, entry.getKey()); delete.addBatch();
            }
            for (var entry : newRows.entrySet()) {
                OrderedDoor old = oldRows.get(entry.getKey()); OrderedDoor next = entry.getValue();
                if (old == null) {
                    bindDoor(insert, after.corridorId(), next, true); insert.addBatch();
                } else if (!old.equals(next)) {
                    bindDoor(update, after.corridorId(), next, false); update.addBatch();
                }
            }
            delete.executeBatch(); update.executeBatch(); insert.executeBatch();
        }
    }

    private static void bindDoor(PreparedStatement statement, long corridorId, OrderedDoor ordered, boolean insert)
            throws SQLException {
        DungeonCorridorDoorBindingRecord row = ordered.row();
        int i = 1;
        if (insert) { statement.setLong(i++, corridorId); statement.setLong(i++, row.roomId()); }
        statement.setLong(i++, row.clusterId()); statement.setInt(i++, row.relativeCellX());
        statement.setInt(i++, row.relativeCellY()); statement.setInt(i++, row.relativeCellZ());
        statement.setString(i++, row.edgeDirection()); nullableLong(statement, i++, row.topologyElementId());
        statement.setInt(i++, ordered.order());
        if (!insert) { statement.setLong(i++, corridorId); statement.setLong(i, row.roomId()); }
    }

    private static void reconcileAnchors(Connection connection, List<DungeonCorridorAnchorBindingRecord> before,
            DungeonCorridorRecord after) throws SQLException {
        Map<Long, OrderedAnchor> oldRows = orderedAnchors(before);
        Map<Long, OrderedAnchor> newRows = orderedAnchors(after.anchorBindings());
        try (PreparedStatement delete = connection.prepareStatement(
                "DELETE FROM dungeon_corridor_anchors WHERE corridor_id=? AND anchor_id=?");
             PreparedStatement update = connection.prepareStatement(
                     "UPDATE dungeon_corridor_anchors SET host_corridor_id=?,cell_x=?,cell_y=?,cell_z=?,"
                             + "topology_element_id=?,sort_order=? WHERE corridor_id=? AND anchor_id=?");
             PreparedStatement insert = connection.prepareStatement(
                     "INSERT INTO dungeon_corridor_anchors(corridor_id,anchor_id,host_corridor_id,cell_x,cell_y,"
                             + "cell_z,topology_element_id,sort_order) VALUES(?,?,?,?,?,?,?,?)")) {
            for (var entry : oldRows.entrySet()) if (!newRows.containsKey(entry.getKey())) {
                delete.setLong(1, after.corridorId()); delete.setLong(2, entry.getKey()); delete.addBatch();
            }
            for (var entry : newRows.entrySet()) {
                OrderedAnchor old = oldRows.get(entry.getKey()); OrderedAnchor next = entry.getValue();
                if (old == null) { bindAnchor(insert, after.corridorId(), next, true); insert.addBatch(); }
                else if (!old.equals(next)) { bindAnchor(update, after.corridorId(), next, false); update.addBatch(); }
            }
            delete.executeBatch(); update.executeBatch(); insert.executeBatch();
        }
    }

    private static void bindAnchor(PreparedStatement statement, long corridorId, OrderedAnchor ordered,
            boolean insert) throws SQLException {
        DungeonCorridorAnchorBindingRecord row = ordered.row(); int i = 1;
        if (insert) { statement.setLong(i++, corridorId); statement.setLong(i++, row.anchorId()); }
        statement.setLong(i++, row.hostCorridorId()); statement.setInt(i++, row.cellX());
        statement.setInt(i++, row.cellY()); statement.setInt(i++, row.cellZ());
        nullableLong(statement, i++, row.topologyElementId()); statement.setInt(i++, ordered.order());
        if (!insert) { statement.setLong(i++, corridorId); statement.setLong(i, row.anchorId()); }
    }

    private static void reconcileAnchorRefs(Connection connection, List<DungeonCorridorAnchorRefRecord> before,
            DungeonCorridorRecord after) throws SQLException {
        Map<AnchorRefKey, OrderedAnchorRef> oldRows = orderedAnchorRefs(before);
        Map<AnchorRefKey, OrderedAnchorRef> newRows = orderedAnchorRefs(after.anchorRefs());
        try (PreparedStatement delete = connection.prepareStatement(
                "DELETE FROM dungeon_corridor_anchor_refs WHERE corridor_id=? AND topology_element_id=?");
             PreparedStatement update = connection.prepareStatement(
                     "UPDATE dungeon_corridor_anchor_refs SET host_corridor_id=?,sort_order=? "
                             + "WHERE corridor_id=? AND topology_element_id=?");
             PreparedStatement insert = connection.prepareStatement(
                     "INSERT INTO dungeon_corridor_anchor_refs(corridor_id,host_corridor_id,topology_element_id,"
                             + "sort_order) VALUES(?,?,?,?)")) {
            for (var entry : oldRows.entrySet()) if (!newRows.containsKey(entry.getKey())) {
                delete.setLong(1, after.corridorId()); delete.setLong(2, entry.getKey().topologyId()); delete.addBatch();
            }
            for (var entry : newRows.entrySet()) {
                OrderedAnchorRef old = oldRows.get(entry.getKey()); OrderedAnchorRef next = entry.getValue();
                if (old == null) {
                    insert.setLong(1, after.corridorId()); insert.setLong(2, next.row().hostCorridorId());
                    insert.setLong(3, entry.getKey().topologyId()); insert.setInt(4, next.order()); insert.addBatch();
                } else if (!old.equals(next)) {
                    update.setLong(1, next.row().hostCorridorId()); update.setInt(2, next.order());
                    update.setLong(3, after.corridorId()); update.setLong(4, entry.getKey().topologyId());
                    update.addBatch();
                }
            }
            delete.executeBatch(); update.executeBatch(); insert.executeBatch();
        }
    }

    private static <T> void reconcileOrderedCorridorRows(Connection connection, long corridorId, List<T> before,
            List<T> after, String table, String updateColumns, String insertColumns, RowBinder<T> binder)
            throws SQLException {
        int common = Math.min(before.size(), after.size());
        try (PreparedStatement delete = connection.prepareStatement(
                "DELETE FROM " + table + " WHERE corridor_id=? AND sort_order=?");
             PreparedStatement update = connection.prepareStatement(
                     "UPDATE " + table + " SET " + updateColumns + " WHERE corridor_id=? AND sort_order=?");
             PreparedStatement insert = connection.prepareStatement(
                     "INSERT INTO " + table + "(" + insertColumns + ") VALUES(?,?,?,?,?,?)")) {
            for (int i = 0; i < common; i++) if (!before.get(i).equals(after.get(i))) {
                binder.bind(update, after.get(i), 1); update.setLong(5, corridorId); update.setInt(6, i); update.addBatch();
            }
            for (int i = common; i < before.size(); i++) {
                delete.setLong(1, corridorId); delete.setInt(2, i); delete.addBatch();
            }
            for (int i = common; i < after.size(); i++) {
                insert.setLong(1, corridorId); insert.setInt(2, i); binder.bind(insert, after.get(i), 3); insert.addBatch();
            }
            update.executeBatch(); delete.executeBatch(); insert.executeBatch();
        }
    }

    private static void upsertStair(Connection connection, DungeonStairRecord before, DungeonStairRecord after)
            throws SQLException {
        boolean sameScalars = before != null && Objects.equals(before.name(), after.name())
                && Objects.equals(before.shape(), after.shape()) && before.direction() == after.direction()
                && before.dimension1() == after.dimension1() && before.dimension2() == after.dimension2()
                && Objects.equals(before.corridorId(), after.corridorId());
        if (sameScalars) return;
        try (PreparedStatement statement = connection.prepareStatement(
                "INSERT INTO dungeon_stairs(stair_id,dungeon_map_id,name,shape,direction,dimension1,dimension2,"
                        + "corridor_id) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(stair_id) DO UPDATE SET "
                        + "name=excluded.name,shape=excluded.shape,direction=excluded.direction,"
                        + "dimension1=excluded.dimension1,dimension2=excluded.dimension2,corridor_id=excluded.corridor_id "
                        + "WHERE dungeon_stairs.dungeon_map_id=excluded.dungeon_map_id")) {
            statement.setLong(1, after.stairId()); statement.setLong(2, after.mapId());
            statement.setString(3, after.name()); statement.setString(4, after.shape());
            statement.setInt(5, after.direction()); statement.setInt(6, after.dimension1());
            statement.setInt(7, after.dimension2()); nullableLong(statement, 8, after.corridorId());
            requireMutation(statement.executeUpdate(), 1, "stair upsert");
        }
    }

    private static void reconcileStairPath(Connection connection, List<DungeonStairPathNodeRecord> before,
            List<DungeonStairPathNodeRecord> after) throws SQLException {
        long stairId = after.isEmpty() ? before.getFirst().stairId() : after.getFirst().stairId();
        int common = Math.min(before.size(), after.size());
        try (PreparedStatement update = connection.prepareStatement(
                "UPDATE dungeon_stair_path_nodes SET cell_x=?,cell_y=?,cell_z=? WHERE stair_id=? AND sort_order=?");
             PreparedStatement delete = connection.prepareStatement(
                     "DELETE FROM dungeon_stair_path_nodes WHERE stair_id=? AND sort_order=?");
             PreparedStatement insert = connection.prepareStatement(
                     "INSERT INTO dungeon_stair_path_nodes(stair_id,sort_order,cell_x,cell_y,cell_z) VALUES(?,?,?,?,?)")) {
            for (int i = 0; i < common; i++) if (!before.get(i).equals(after.get(i))) {
                var row = after.get(i); update.setInt(1, row.cellX()); update.setInt(2, row.cellY());
                update.setInt(3, row.cellZ()); update.setLong(4, stairId); update.setInt(5, i); update.addBatch();
            }
            for (int i = common; i < before.size(); i++) {
                delete.setLong(1, stairId); delete.setInt(2, i); delete.addBatch();
            }
            for (int i = common; i < after.size(); i++) {
                var row = after.get(i); insert.setLong(1, stairId); insert.setInt(2, i);
                insert.setInt(3, row.cellX()); insert.setInt(4, row.cellY()); insert.setInt(5, row.cellZ());
                insert.addBatch();
            }
            update.executeBatch(); delete.executeBatch(); insert.executeBatch();
        }
    }

    private static void reconcileStairExits(Connection connection, Stair before, Stair after) throws SQLException {
        Map<StairExitKey, StoredExit> stored = loadStoredExits(connection, after.stairId(), before);
        Map<StairExitKey, StairExit> desired = new LinkedHashMap<>();
        for (StairExit exit : after.exits()) desired.put(StairExitKey.from(exit), exit);
        try (PreparedStatement delete = connection.prepareStatement(
                "DELETE FROM dungeon_stair_exits WHERE stair_exit_id=?");
             PreparedStatement update = connection.prepareStatement(
                     "UPDATE dungeon_stair_exits SET cell_x=?,cell_y=?,cell_z=?,label=? WHERE stair_exit_id=?");
             PreparedStatement insert = connection.prepareStatement(
                     "INSERT INTO dungeon_stair_exits(stair_exit_id,stair_id,cell_x,cell_y,cell_z,label) "
                             + "VALUES(?,?,?,?,?,?)");
             PreparedStatement generated = connection.prepareStatement(
                     "INSERT INTO dungeon_stair_exits(stair_id,cell_x,cell_y,cell_z,label) VALUES(?,?,?,?,?)")) {
            for (var entry : stored.entrySet()) if (!desired.containsKey(entry.getKey())) {
                delete.setLong(1, entry.getValue().id()); delete.addBatch();
            }
            for (var entry : desired.entrySet()) {
                StoredExit old = stored.get(entry.getKey()); StairExit next = entry.getValue(); Cell cell = next.position();
                if (old == null) {
                    if (next.exitId() > 0L) {
                        insert.setLong(1, next.exitId()); insert.setLong(2, after.stairId());
                        insert.setInt(3, cell.q()); insert.setInt(4, cell.r()); insert.setInt(5, cell.level());
                        insert.setString(6, next.label()); insert.addBatch();
                    } else {
                        generated.setLong(1, after.stairId()); generated.setInt(2, cell.q());
                        generated.setInt(3, cell.r()); generated.setInt(4, cell.level());
                        generated.setString(5, next.label()); generated.addBatch();
                    }
                } else if (!old.same(next)) {
                    update.setInt(1, cell.q()); update.setInt(2, cell.r()); update.setInt(3, cell.level());
                    update.setString(4, next.label()); update.setLong(5, old.id()); update.addBatch();
                }
            }
            delete.executeBatch(); update.executeBatch(); insert.executeBatch(); generated.executeBatch();
        }
    }

    private static Map<StairExitKey, StoredExit> loadStoredExits(Connection connection, long stairId, Stair before)
            throws SQLException {
        Map<Long, StairExit> positiveBefore = new LinkedHashMap<>();
        Set<Cell> anonymousBefore = new LinkedHashSet<>();
        if (before != null) for (StairExit exit : before.exits()) {
            if (exit.exitId() > 0L) positiveBefore.put(exit.exitId(), exit); else anonymousBefore.add(exit.position());
        }
        Map<StairExitKey, StoredExit> result = new LinkedHashMap<>();
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT stair_exit_id,cell_x,cell_y,cell_z,label FROM dungeon_stair_exits WHERE stair_id=? "
                        + "ORDER BY stair_exit_id")) {
            statement.setLong(1, stairId);
            try (ResultSet rows = statement.executeQuery()) {
                while (rows.next()) {
                    long id = rows.getLong(1); Cell cell = new Cell(rows.getInt(2), rows.getInt(3), rows.getInt(4));
                    StairExitKey key = positiveBefore.containsKey(id) ? StairExitKey.id(id)
                            : anonymousBefore.contains(cell) ? StairExitKey.position(cell) : StairExitKey.id(id);
                    result.put(key, new StoredExit(id, cell, rows.getString(5)));
                }
            }
        }
        return result;
    }

    private static void upsertTransition(Connection connection, DungeonTransitionRecord before,
            DungeonTransitionRecord after) throws SQLException {
        if (before != null && before.equals(after)) return;
        String sql = "INSERT INTO dungeon_transitions(transition_id,dungeon_map_id,description,cell_x,cell_y,level_z,"
                + "anchor_type,anchor_edge_direction,destination_type,target_overworld_map_id,target_overworld_tile_id,"
                + "target_dungeon_map_id,target_transition_id,linked_transition_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?) "
                + "ON CONFLICT(transition_id) DO UPDATE SET description=excluded.description,cell_x=excluded.cell_x,"
                + "cell_y=excluded.cell_y,level_z=excluded.level_z,anchor_type=excluded.anchor_type,"
                + "anchor_edge_direction=excluded.anchor_edge_direction,destination_type=excluded.destination_type,"
                + "target_overworld_map_id=excluded.target_overworld_map_id,"
                + "target_overworld_tile_id=excluded.target_overworld_tile_id,"
                + "target_dungeon_map_id=excluded.target_dungeon_map_id,"
                + "target_transition_id=excluded.target_transition_id,linked_transition_id=excluded.linked_transition_id "
                + "WHERE dungeon_transitions.dungeon_map_id=excluded.dungeon_map_id";
        try (PreparedStatement s = connection.prepareStatement(sql)) {
            bindTransition(s, after);
            requireMutation(s.executeUpdate(), 1, "transition upsert");
        }
    }

    private static void bindTransition(PreparedStatement s, DungeonTransitionRecord r) throws SQLException {
        s.setLong(1, r.transitionId()); s.setLong(2, r.mapId()); s.setString(3, r.description());
        nullableInt(s, 4, r.cellX()); nullableInt(s, 5, r.cellY()); nullableInt(s, 6, r.levelZ());
        s.setString(7, r.anchorType()); s.setString(8, r.anchorEdgeDirection()); s.setString(9, r.destinationType());
        nullableLong(s, 10, r.targetOverworldMapId()); nullableLong(s, 11, r.targetOverworldTileId());
        nullableLong(s, 12, r.targetDungeonMapId()); nullableLong(s, 13, r.targetTransitionId());
        nullableLong(s, 14, r.linkedTransitionId());
    }

    private static void upsertMarker(Connection connection, DungeonFeatureMarkerRecord before,
            DungeonFeatureMarkerRecord after) throws SQLException {
        if (before != null && before.equals(after)) return;
        try (PreparedStatement s = connection.prepareStatement(
                "INSERT INTO dungeon_feature_markers(feature_marker_id,dungeon_map_id,marker_kind,cell_x,cell_y,"
                        + "level_z,label,description) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(dungeon_map_id,feature_marker_id) "
                        + "DO UPDATE SET marker_kind=excluded.marker_kind,cell_x=excluded.cell_x,cell_y=excluded.cell_y,"
                        + "level_z=excluded.level_z,label=excluded.label,description=excluded.description")) {
            s.setLong(1, after.markerId()); s.setLong(2, after.mapId()); s.setString(3, after.markerKind());
            s.setInt(4, after.cellX()); s.setInt(5, after.cellY()); s.setInt(6, after.levelZ());
            s.setString(7, after.label()); s.setString(8, after.description());
            requireMutation(s.executeUpdate(), 1, "feature marker upsert");
        }
    }

    private static void deleteRemoved(Connection c, List<StairChange> stairs, List<CorridorChange> corridors,
            List<RoomRegionChange> rooms, List<RoomClusterChange> clusters, List<TransitionChange> transitions,
            List<FeatureMarkerChange> markers) throws SQLException {
        for (StairChange change : stairs) if (change.after() == null) deleteByMap(c, "dungeon_stairs", "stair_id",
                change.before().mapId(), change.before().stairId());
        for (CorridorChange change : corridors) if (change.after() == null) deleteByMap(c, "dungeon_corridors",
                "corridor_id", change.before().mapId(), change.before().corridorId());
        for (RoomRegionChange change : rooms) if (change.after() == null) deleteByMap(c, "dungeon_rooms", "room_id",
                change.before().mapId(), change.before().roomId());
        for (RoomClusterChange change : clusters) if (change.after() == null) deleteByMap(c,
                "dungeon_room_clusters", "cluster_id", change.before().mapId(), change.before().clusterId());
        for (TransitionChange change : transitions) if (change.after() == null) deleteByMap(c, "dungeon_transitions",
                "transition_id", change.before().mapId(), change.before().transitionId());
        for (FeatureMarkerChange change : markers) if (change.after() == null) deleteByMap(c,
                "dungeon_feature_markers", "feature_marker_id", change.before().mapId().value(),
                change.before().markerId());
    }

    private static void deleteByMap(Connection c, String table, String idColumn, long mapId, long id)
            throws SQLException {
        try (PreparedStatement s = c.prepareStatement(
                "DELETE FROM " + table + " WHERE dungeon_map_id=? AND " + idColumn + "=?")) {
            s.setLong(1, mapId); s.setLong(2, id);
            requireMutation(s.executeUpdate(), 1, "entity delete");
        }
    }

    private static Map<AnchorKey, Long> loadAnchorTopology(Connection connection, List<CorridorChange> changes)
            throws SQLException {
        Set<AnchorKey> keys = new LinkedHashSet<>();
        for (CorridorChange change : changes) {
            if (change.before() != null) change.before().bindings().anchorBindings()
                    .forEach(a -> keys.add(new AnchorKey(a.hostCorridorId(), a.anchorId())));
            if (change.after() != null) change.after().bindings().anchorBindings()
                    .forEach(a -> keys.add(new AnchorKey(a.hostCorridorId(), a.anchorId())));
            if (change.before() != null) change.before().bindings().anchorRefs()
                    .forEach(a -> keys.add(new AnchorKey(a.hostCorridorId(), a.anchorId())));
            if (change.after() != null) change.after().bindings().anchorRefs()
                    .forEach(a -> keys.add(new AnchorKey(a.hostCorridorId(), a.anchorId())));
        }
        Map<AnchorKey, Long> result = new LinkedHashMap<>();
        try (PreparedStatement s = connection.prepareStatement(
                "SELECT topology_element_id FROM dungeon_corridor_anchors "
                        + "WHERE host_corridor_id=? AND anchor_id=? AND topology_element_id IS NOT NULL")) {
            for (AnchorKey key : keys) {
                s.setLong(1, key.hostCorridorId()); s.setLong(2, key.anchorId());
                try (ResultSet rows = s.executeQuery()) {
                    result.put(key, rows.next() ? rows.getLong(1) : key.anchorId());
                }
            }
        }
        return result;
    }

    private static DungeonCorridorRecord resolvedCorridor(DungeonCorridorRecord source,
            Map<AnchorKey, Long> topology) {
        List<DungeonCorridorAnchorBindingRecord> anchors = source.anchorBindings().stream().map(a ->
                new DungeonCorridorAnchorBindingRecord(a.corridorId(), a.anchorId(), a.hostCorridorId(),
                        a.cellX(), a.cellY(), a.cellZ(), topology.getOrDefault(
                                new AnchorKey(a.hostCorridorId(), a.anchorId()), a.anchorId()))).toList();
        List<DungeonCorridorAnchorRefRecord> refs = source.anchorRefs().stream().map(r -> {
            long localId = r.topologyElementId() == null ? 0L : r.topologyElementId();
            return new DungeonCorridorAnchorRefRecord(r.corridorId(), r.hostCorridorId(),
                    topology.getOrDefault(new AnchorKey(r.hostCorridorId(), localId), localId));
        }).toList();
        return new DungeonCorridorRecord(source.corridorId(), source.mapId(), source.levelZ(), source.roomIds(),
                source.waypoints(), source.doorBindings(), anchors, refs);
    }

    private static Set<TopologyKey> topologyKeys(List<RoomClusterChange> clusters, List<RoomRegionChange> rooms,
            List<CorridorChange> corridors, List<StairChange> stairs, List<TransitionChange> transitions,
            List<FeatureMarkerChange> markers, Map<AnchorKey, Long> anchorTopology) {
        Set<TopologyKey> result = new LinkedHashSet<>();
        rooms.forEach(c -> result.add(new TopologyKey("ROOM", c.entityRef().id())));
        for (RoomClusterChange change : clusters) {
            if (change.before() != null) addBoundaryTopology(result, change.before());
            if (change.after() != null) addBoundaryTopology(result, change.after());
        }
        for (CorridorChange change : corridors) {
            result.add(new TopologyKey("CORRIDOR", change.entityRef().id()));
            if (change.before() != null) addCorridorTopology(result,
                    resolvedCorridor(DungeonPatchRecordMapper.corridor(change.before()), anchorTopology));
            if (change.after() != null) addCorridorTopology(result,
                    resolvedCorridor(DungeonPatchRecordMapper.corridor(change.after()), anchorTopology));
        }
        stairs.forEach(c -> result.add(new TopologyKey("STAIR", c.entityRef().id())));
        transitions.forEach(c -> result.add(new TopologyKey("TRANSITION", c.entityRef().id())));
        markers.forEach(c -> result.add(new TopologyKey("FEATURE_MARKER", c.entityRef().id())));
        return result;
    }

    private static void addBoundaryTopology(Set<TopologyKey> result, RoomCluster cluster) {
        for (var boundary : cluster.orderedAuthoredBoundaries()) {
            DungeonTopologyRef ref = boundary.resolvedTopologyRef(cluster.center());
            if (ref.present()) {
                result.add(new TopologyKey(ref.kind().name(), ref.id()));
            }
        }
    }

    private static void addCorridorTopology(Set<TopologyKey> result, DungeonCorridorRecord corridor) {
        corridor.doorBindings().forEach(d -> { if (d.topologyElementId() != null)
            result.add(new TopologyKey("DOOR", d.topologyElementId())); });
        corridor.anchorBindings().forEach(a -> { if (a.topologyElementId() != null)
            result.add(new TopologyKey("CORRIDOR_ANCHOR", a.topologyElementId())); });
    }

    private static void reconcileTopology(Connection connection, long mapId, Set<TopologyKey> keys)
            throws SQLException {
        int nextOrder = nextTopologyOrder(connection, mapId);
        for (TopologyKey key : keys) {
            StoredTopology existing = existingTopology(connection, mapId, key);
            TopologyBinding desired = topologyBinding(connection, mapId, key);
            if (existing != null && matchesStoredTopology(connection, mapId, key, existing)) {
                desired = existing.binding();
            } else if (existing != null && desired != null) {
                desired = new TopologyBinding(desired.clusterId(), desired.corridorId(), existing.binding().label());
            }
            if (Objects.equals(existing == null ? null : existing.binding(), desired)) {
                continue;
            }
            if (desired == null) {
                try (PreparedStatement delete = connection.prepareStatement(
                        "DELETE FROM dungeon_topology_elements WHERE dungeon_map_id=? AND element_kind=? "
                                + "AND element_id=?")) {
                    delete.setLong(1, mapId); delete.setString(2, key.kind()); delete.setLong(3, key.id());
                    requireMutation(delete.executeUpdate(), existing == null ? 0 : 1, "topology delete");
                }
            } else if (existing == null) {
                try (PreparedStatement insert = connection.prepareStatement(
                        "INSERT INTO dungeon_topology_elements(dungeon_map_id,element_kind,element_id,cluster_id,"
                                + "corridor_id,label,sort_order) VALUES(?,?,?,?,?,?,?)")) {
                    insert.setLong(1, mapId); insert.setString(2, key.kind()); insert.setLong(3, key.id());
                    nullableLong(insert, 4, desired.clusterId()); nullableLong(insert, 5, desired.corridorId());
                    insert.setString(6, desired.label()); insert.setInt(7, nextOrder++);
                    requireMutation(insert.executeUpdate(), 1, "topology insert");
                }
            } else {
                try (PreparedStatement update = connection.prepareStatement(
                        "UPDATE dungeon_topology_elements SET cluster_id=?,corridor_id=?,label=? "
                                + "WHERE dungeon_map_id=? AND element_kind=? AND element_id=?")) {
                    nullableLong(update, 1, desired.clusterId()); nullableLong(update, 2, desired.corridorId());
                    update.setString(3, desired.label()); update.setLong(4, mapId);
                    update.setString(5, key.kind()); update.setLong(6, key.id());
                    requireMutation(update.executeUpdate(), 1, "topology update");
                }
            }
        }
    }

    private static StoredTopology existingTopology(Connection c, long mapId, TopologyKey key) throws SQLException {
        try (PreparedStatement s = c.prepareStatement("SELECT cluster_id,corridor_id,label,sort_order "
                + "FROM dungeon_topology_elements "
                + "WHERE dungeon_map_id=? AND element_kind=? AND element_id=?")) {
            s.setLong(1, mapId); s.setString(2, key.kind()); s.setLong(3, key.id());
            try (ResultSet r = s.executeQuery()) {
                return r.next() ? new StoredTopology(new TopologyBinding(
                        nullableResultLong(r, 1), nullableResultLong(r, 2), r.getString(3)), r.getInt(4)) : null;
            }
        }
    }

    private static int nextTopologyOrder(Connection c, long mapId) throws SQLException {
        try (PreparedStatement s = c.prepareStatement(
                "SELECT COALESCE(MAX(sort_order),-1)+1 FROM dungeon_topology_elements WHERE dungeon_map_id=?")) {
            s.setLong(1, mapId); try (ResultSet r = s.executeQuery()) { return r.next() ? r.getInt(1) : 0; }
        }
    }

    private static TopologyBinding topologyBinding(Connection c, long mapId, TopologyKey key) throws SQLException {
        String kind = key.kind();
        if ("ROOM".equals(kind)) return binding(c, "SELECT cluster_id,NULL,name FROM dungeon_rooms "
                + "WHERE dungeon_map_id=? AND room_id=?", mapId, key.id());
        if ("CORRIDOR".equals(kind)) return binding(c, "SELECT NULL,corridor_id,'Corridor '||corridor_id "
                + "FROM dungeon_corridors WHERE dungeon_map_id=? AND corridor_id=?", mapId, key.id());
        if ("DOOR".equals(kind)) {
            TopologyBinding door = binding(c, "SELECT cluster_id,c.corridor_id,'Door '||topology_element_id "
                    + "FROM dungeon_corridor_door_overrides d JOIN dungeon_corridors c ON c.corridor_id=d.corridor_id "
                    + "WHERE c.dungeon_map_id=? AND topology_element_id=? LIMIT 1", mapId, key.id());
            if (door != null) return door;
        }
        if ("CORRIDOR_ANCHOR".equals(kind)) return binding(c, "SELECT NULL,c.corridor_id,'Corridor Anchor '"
                + "||topology_element_id FROM dungeon_corridor_anchors a JOIN dungeon_corridors c "
                + "ON c.corridor_id=a.corridor_id WHERE c.dungeon_map_id=? AND topology_element_id=? LIMIT 1",
                mapId, key.id());
        if ("STAIR".equals(kind)) return binding(c, "SELECT NULL,corridor_id,name FROM dungeon_stairs "
                + "WHERE dungeon_map_id=? AND stair_id=?", mapId, key.id());
        if ("TRANSITION".equals(kind)) return binding(c, "SELECT NULL,NULL,'Übergang '||transition_id "
                + "FROM dungeon_transitions WHERE dungeon_map_id=? AND transition_id=?", mapId, key.id());
        if ("FEATURE_MARKER".equals(kind)) return binding(c, "SELECT NULL,NULL,label FROM dungeon_feature_markers "
                + "WHERE dungeon_map_id=? AND feature_marker_id=?", mapId, key.id());
        if ("WALL".equals(kind) || "DOOR".equals(kind)) return binding(c, "SELECT cluster_id,NULL,'"
                + ("DOOR".equals(kind) ? "Door " : "Wall ") + "'||topology_element_id "
                + "FROM dungeon_room_cluster_edges WHERE dungeon_map_id=? AND topology_element_id=? LIMIT 1",
                mapId, key.id());
        return null;
    }

    private static boolean matchesStoredTopology(
            Connection connection,
            long mapId,
            TopologyKey key,
            StoredTopology stored
    ) throws SQLException {
        if (stored == null) {
            return false;
        }
        TopologyBinding canonical = topologyBinding(connection, mapId, key);
        if (sameTopologyOwnership(stored.binding(), canonical)) {
            return true;
        }
        if (!"DOOR".equals(key.kind())) {
            return false;
        }
        TopologyBinding boundary = binding(connection,
                "SELECT cluster_id,NULL,'Door '||topology_element_id "
                        + "FROM dungeon_room_cluster_edges WHERE dungeon_map_id=? "
                        + "AND topology_element_id=? AND UPPER(edge_type)='DOOR' LIMIT 1",
                mapId,
                key.id());
        return sameTopologyOwnership(stored.binding(), boundary);
    }

    private static boolean sameTopologyOwnership(TopologyBinding left, TopologyBinding right) {
        return left != null && right != null
                && Objects.equals(left.clusterId(), right.clusterId())
                && Objects.equals(left.corridorId(), right.corridorId());
    }

    private static TopologyBinding binding(Connection c, String sql, long mapId, long id) throws SQLException {
        try (PreparedStatement s = c.prepareStatement(sql)) {
            s.setLong(1, mapId); s.setLong(2, id);
            try (ResultSet r = s.executeQuery()) {
                if (!r.next()) return null;
                return new TopologyBinding(nullableResultLong(r, 1), nullableResultLong(r, 2), r.getString(3));
            }
        }
    }

    private static void requireMutation(int actual, int expected, String operation) {
        if (actual != expected) {
            throw new IllegalStateException(operation + " affected an unexpected number of rows");
        }
    }

    private static Long nullableResultLong(ResultSet r, int index) throws SQLException {
        long value = r.getLong(index); return r.wasNull() ? null : value;
    }

    private static <K, V> Map<K, V> keyed(List<V> rows, java.util.function.Function<V, K> key) {
        Map<K, V> result = new LinkedHashMap<>(); for (V row : rows) result.put(key.apply(row), row); return result;
    }

    private static Map<Long, Integer> orderedLongs(List<Long> values) {
        Map<Long, Integer> result = new LinkedHashMap<>();
        for (int i = 0; i < values.size(); i++) result.put(values.get(i), i); return result;
    }

    private static Map<Long, OrderedDoor> orderedDoors(List<DungeonCorridorDoorBindingRecord> rows) {
        Map<Long, OrderedDoor> result = new LinkedHashMap<>();
        for (int i = 0; i < rows.size(); i++) result.put(rows.get(i).roomId(), new OrderedDoor(rows.get(i), i));
        return result;
    }

    private static Map<Long, OrderedAnchor> orderedAnchors(List<DungeonCorridorAnchorBindingRecord> rows) {
        Map<Long, OrderedAnchor> result = new LinkedHashMap<>();
        for (int i = 0; i < rows.size(); i++) result.put(rows.get(i).anchorId(), new OrderedAnchor(rows.get(i), i));
        return result;
    }

    private static Map<AnchorRefKey, OrderedAnchorRef> orderedAnchorRefs(List<DungeonCorridorAnchorRefRecord> rows) {
        Map<AnchorRefKey, OrderedAnchorRef> result = new LinkedHashMap<>();
        for (int i = 0; i < rows.size(); i++) {
            long id = rows.get(i).topologyElementId() == null ? 0L : rows.get(i).topologyElementId();
            result.put(new AnchorRefKey(id), new OrderedAnchorRef(rows.get(i), i));
        }
        return result;
    }

    private static void nullableLong(PreparedStatement s, int index, Long value) throws SQLException {
        if (value == null) s.setNull(index, Types.BIGINT); else s.setLong(index, value);
    }

    private static void nullableInt(PreparedStatement s, int index, Integer value) throws SQLException {
        if (value == null) s.setNull(index, Types.INTEGER); else s.setInt(index, value);
    }

    record MutationFacts(Set<TopologyKey> topologyKeys) { }
    record TopologyKey(String kind, long id) { }
    private record TopologyBinding(Long clusterId, Long corridorId, String label) { }
    private record StoredTopology(TopologyBinding binding, int order) { }
    private record AnchorKey(long hostCorridorId, long anchorId) { }
    private record CellKey(long roomId, int level, int x, int y) {
        static CellKey from(DungeonRoomCellRecord r) { return new CellKey(r.roomId(), r.levelZ(), r.cellX(), r.cellY()); }
    }
    private record ExitKey(long roomId, int level, int x, int y, String direction) {
        static ExitKey from(DungeonRoomExitDescriptionRecord r) {
            return new ExitKey(r.roomId(), r.levelZ(), r.cellX(), r.cellY(), r.edgeDirection());
        }
    }
    private record OrderedExit(DungeonRoomExitDescriptionRecord row, int order) { }
    private record BoundaryKey(int level, int x, int y, String direction) {
        static BoundaryKey from(DungeonClusterBoundaryRecord r) {
            return new BoundaryKey(r.levelZ(), r.cellX(), r.cellY(), r.edgeDirection());
        }
    }
    private record OrderedDoor(DungeonCorridorDoorBindingRecord row, int order) { }
    private record OrderedAnchor(DungeonCorridorAnchorBindingRecord row, int order) { }
    private record AnchorRefKey(long topologyId) { }
    private record OrderedAnchorRef(DungeonCorridorAnchorRefRecord row, int order) { }
    private record StairExitKey(Long id, Cell position) {
        static StairExitKey from(StairExit exit) { return exit.exitId() > 0L ? id(exit.exitId()) : position(exit.position()); }
        static StairExitKey id(long id) { return new StairExitKey(id, null); }
        static StairExitKey position(Cell cell) { return new StairExitKey(null, cell); }
    }
    private record StoredExit(long id, Cell position, String label) {
        boolean same(StairExit exit) { return Objects.equals(position, exit.position()) && Objects.equals(label, exit.label()); }
    }
    @FunctionalInterface private interface RowBinder<T> {
        void bind(PreparedStatement statement, T row, int start) throws SQLException;
    }
}
