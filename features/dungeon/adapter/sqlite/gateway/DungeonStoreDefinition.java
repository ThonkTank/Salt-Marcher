package features.dungeon.adapter.sqlite.gateway;

import features.dungeon.adapter.sqlite.model.DungeonPersistenceSchema;
import platform.persistence.FeatureStoreDefinition;
import platform.persistence.SqliteMigration;
import platform.persistence.SqliteSchemaValidator;

/** Canonical schema plan for the Dungeon-owned store. */
public final class DungeonStoreDefinition {

    public static final String OWNER = "dungeon";

    private DungeonStoreDefinition() {}

    public static FeatureStoreDefinition create() {
        DungeonSqliteSchemaManager schema = new DungeonSqliteSchemaManager();
        SqliteSchemaValidator targetSchema = SqliteSchemaValidator.builder()
                .table(DungeonPersistenceSchema.MAPS_TABLE, "dungeon_map_id", "name", "revision")
                .primaryKey(DungeonPersistenceSchema.MAPS_TABLE, "dungeon_map_id")
                .table(DungeonPersistenceSchema.IDENTITY_SEQUENCES_TABLE, "identity_kind", "next_id")
                .primaryKey(DungeonPersistenceSchema.IDENTITY_SEQUENCES_TABLE, "identity_kind")
                .table(DungeonPersistenceSchema.CHUNKS_TABLE,
                        "dungeon_map_id", "level_z", "chunk_q", "chunk_r", "content_revision")
                .primaryKey(DungeonPersistenceSchema.CHUNKS_TABLE,
                        "dungeon_map_id", "level_z", "chunk_q", "chunk_r")
                .table(DungeonPersistenceSchema.ENTITY_CHUNKS_TABLE,
                        "dungeon_map_id", "entity_kind", "entity_id", "level_z", "chunk_q", "chunk_r",
                        "minimum_q", "minimum_r", "maximum_q", "maximum_r", "entity_chunk_count")
                .primaryKey(DungeonPersistenceSchema.ENTITY_CHUNKS_TABLE,
                        "dungeon_map_id", "entity_kind", "entity_id", "level_z", "chunk_q", "chunk_r")
                .table(DungeonPersistenceSchema.AUTHORED_LEVEL_BOUNDS_TABLE,
                        "dungeon_map_id", "level_z", "minimum_q", "minimum_r", "maximum_q", "maximum_r")
                .primaryKey(DungeonPersistenceSchema.AUTHORED_LEVEL_BOUNDS_TABLE, "dungeon_map_id", "level_z")
                .table(DungeonPersistenceSchema.CORRIDOR_ROUTE_CELLS_TABLE,
                        "dungeon_map_id", "corridor_id", "segment_order", "cell_order", "level_z", "cell_x",
                        "cell_y", "chunk_q", "chunk_r")
                .primaryKey(DungeonPersistenceSchema.CORRIDOR_ROUTE_CELLS_TABLE,
                        "dungeon_map_id", "corridor_id", "segment_order", "cell_order")
                .table(DungeonPersistenceSchema.CORRIDOR_ROUTE_DEPENDENCIES_TABLE,
                        "dungeon_map_id", "corridor_id", "level_z", "cell_x", "cell_y")
                .primaryKey(DungeonPersistenceSchema.CORRIDOR_ROUTE_DEPENDENCIES_TABLE,
                        "dungeon_map_id", "corridor_id", "level_z", "cell_x", "cell_y")
                .table(DungeonPersistenceSchema.ROOM_CLUSTERS_TABLE,
                        "cluster_id", "dungeon_map_id", "name")
                .primaryKey(DungeonPersistenceSchema.ROOM_CLUSTERS_TABLE, "cluster_id")
                .foreignKey(DungeonPersistenceSchema.ROOM_CLUSTERS_TABLE, DungeonPersistenceSchema.MAPS_TABLE,
                        "CASCADE", SqliteSchemaValidator.reference("dungeon_map_id", "dungeon_map_id"))
                .table(DungeonPersistenceSchema.ROOMS_TABLE,
                        "room_id", "dungeon_map_id", "cluster_id", "name", "visual_description")
                .primaryKey(DungeonPersistenceSchema.ROOMS_TABLE, "room_id")
                .foreignKey(DungeonPersistenceSchema.ROOMS_TABLE, DungeonPersistenceSchema.MAPS_TABLE,
                        "CASCADE", SqliteSchemaValidator.reference("dungeon_map_id", "dungeon_map_id"))
                .foreignKey(DungeonPersistenceSchema.ROOMS_TABLE, DungeonPersistenceSchema.ROOM_CLUSTERS_TABLE,
                        "CASCADE", SqliteSchemaValidator.reference("cluster_id", "cluster_id"))
                .table(DungeonPersistenceSchema.ROOM_CELLS_TABLE,
                        "room_id", "level_z", "cell_x", "cell_y")
                .primaryKey(DungeonPersistenceSchema.ROOM_CELLS_TABLE,
                        "room_id", "level_z", "cell_y", "cell_x")
                .foreignKey(DungeonPersistenceSchema.ROOM_CELLS_TABLE, DungeonPersistenceSchema.ROOMS_TABLE,
                        "CASCADE", SqliteSchemaValidator.reference("room_id", "room_id"))
                .table(DungeonPersistenceSchema.CORRIDORS_TABLE, "corridor_id", "dungeon_map_id", "level_z")
                .primaryKey(DungeonPersistenceSchema.CORRIDORS_TABLE, "corridor_id")
                .foreignKey(DungeonPersistenceSchema.CORRIDORS_TABLE, DungeonPersistenceSchema.MAPS_TABLE,
                        "CASCADE", SqliteSchemaValidator.reference("dungeon_map_id", "dungeon_map_id"))
                .table(DungeonPersistenceSchema.CORRIDOR_MEMBERS_TABLE,
                        "corridor_id", "room_id", "member_order")
                .primaryKey(DungeonPersistenceSchema.CORRIDOR_MEMBERS_TABLE, "corridor_id", "room_id")
                .foreignKey(DungeonPersistenceSchema.CORRIDOR_MEMBERS_TABLE, DungeonPersistenceSchema.CORRIDORS_TABLE,
                        "CASCADE", SqliteSchemaValidator.reference("corridor_id", "corridor_id"))
                .foreignKey(DungeonPersistenceSchema.CORRIDOR_MEMBERS_TABLE, DungeonPersistenceSchema.ROOMS_TABLE,
                        "CASCADE", SqliteSchemaValidator.reference("room_id", "room_id"))
                .table(DungeonPersistenceSchema.ROOM_CLUSTER_EDGES_TABLE,
                        "dungeon_map_id", "cluster_id", "level_z", "cell_x", "cell_y", "edge_direction",
                        "edge_type", "topology_element_id")
                .primaryKey(DungeonPersistenceSchema.ROOM_CLUSTER_EDGES_TABLE,
                        "dungeon_map_id", "cluster_id", "level_z", "cell_x", "cell_y", "edge_direction")
                .foreignKey(DungeonPersistenceSchema.ROOM_CLUSTER_EDGES_TABLE, DungeonPersistenceSchema.MAPS_TABLE,
                        "CASCADE", SqliteSchemaValidator.reference("dungeon_map_id", "dungeon_map_id"))
                .foreignKey(DungeonPersistenceSchema.ROOM_CLUSTER_EDGES_TABLE,
                        DungeonPersistenceSchema.ROOM_CLUSTERS_TABLE,
                        "CASCADE", SqliteSchemaValidator.reference("cluster_id", "cluster_id"))
                .table(DungeonPersistenceSchema.TOPOLOGY_ELEMENTS_TABLE,
                        "dungeon_map_id", "element_kind", "element_id", "cluster_id", "corridor_id", "label",
                        "sort_order")
                .primaryKey(DungeonPersistenceSchema.TOPOLOGY_ELEMENTS_TABLE,
                        "dungeon_map_id", "element_kind", "element_id")
                .foreignKey(DungeonPersistenceSchema.TOPOLOGY_ELEMENTS_TABLE, DungeonPersistenceSchema.MAPS_TABLE,
                        "CASCADE", SqliteSchemaValidator.reference("dungeon_map_id", "dungeon_map_id"))
                .foreignKey(DungeonPersistenceSchema.TOPOLOGY_ELEMENTS_TABLE,
                        DungeonPersistenceSchema.ROOM_CLUSTERS_TABLE,
                        "SET NULL", SqliteSchemaValidator.reference("cluster_id", "cluster_id"))
                .foreignKey(DungeonPersistenceSchema.TOPOLOGY_ELEMENTS_TABLE,
                        DungeonPersistenceSchema.CORRIDORS_TABLE,
                        "SET NULL", SqliteSchemaValidator.reference("corridor_id", "corridor_id"))
                .table(DungeonPersistenceSchema.CORRIDOR_DOOR_OVERRIDES_TABLE,
                        "corridor_id", "room_id", "cluster_id", "relative_cell_x", "relative_cell_y",
                        "relative_cell_z", "edge_direction", "topology_element_id", "sort_order")
                .primaryKey(DungeonPersistenceSchema.CORRIDOR_DOOR_OVERRIDES_TABLE, "corridor_id", "room_id")
                .foreignKey(DungeonPersistenceSchema.CORRIDOR_DOOR_OVERRIDES_TABLE,
                        DungeonPersistenceSchema.CORRIDORS_TABLE,
                        "CASCADE", SqliteSchemaValidator.reference("corridor_id", "corridor_id"))
                .foreignKey(DungeonPersistenceSchema.CORRIDOR_DOOR_OVERRIDES_TABLE,
                        DungeonPersistenceSchema.ROOMS_TABLE,
                        "CASCADE", SqliteSchemaValidator.reference("room_id", "room_id"))
                .foreignKey(DungeonPersistenceSchema.CORRIDOR_DOOR_OVERRIDES_TABLE,
                        DungeonPersistenceSchema.ROOM_CLUSTERS_TABLE,
                        "CASCADE", SqliteSchemaValidator.reference("cluster_id", "cluster_id"))
                .table(DungeonPersistenceSchema.CORRIDOR_ANCHORS_TABLE,
                        "corridor_id", "anchor_id", "host_corridor_id", "cell_x", "cell_y", "cell_z",
                        "topology_element_id", "sort_order")
                .primaryKey(DungeonPersistenceSchema.CORRIDOR_ANCHORS_TABLE, "corridor_id", "anchor_id")
                .foreignKey(DungeonPersistenceSchema.CORRIDOR_ANCHORS_TABLE,
                        DungeonPersistenceSchema.CORRIDORS_TABLE,
                        "CASCADE", SqliteSchemaValidator.reference("corridor_id", "corridor_id"))
                .foreignKey(DungeonPersistenceSchema.CORRIDOR_ANCHORS_TABLE,
                        DungeonPersistenceSchema.CORRIDORS_TABLE,
                        "CASCADE", SqliteSchemaValidator.reference("host_corridor_id", "corridor_id"))
                .table(DungeonPersistenceSchema.CORRIDOR_ANCHOR_REFS_TABLE,
                        "corridor_id", "host_corridor_id", "topology_element_id", "sort_order")
                .primaryKey(DungeonPersistenceSchema.CORRIDOR_ANCHOR_REFS_TABLE,
                        "corridor_id", "topology_element_id")
                .foreignKey(DungeonPersistenceSchema.CORRIDOR_ANCHOR_REFS_TABLE,
                        DungeonPersistenceSchema.CORRIDORS_TABLE,
                        "CASCADE", SqliteSchemaValidator.reference("corridor_id", "corridor_id"))
                .foreignKey(DungeonPersistenceSchema.CORRIDOR_ANCHOR_REFS_TABLE,
                        DungeonPersistenceSchema.CORRIDORS_TABLE,
                        "CASCADE", SqliteSchemaValidator.reference("host_corridor_id", "corridor_id"))
                .table(DungeonPersistenceSchema.CORRIDOR_WAYPOINTS_TABLE,
                        "corridor_id", "sort_order", "cluster_id", "relative_x", "relative_y", "relative_z")
                .primaryKey(DungeonPersistenceSchema.CORRIDOR_WAYPOINTS_TABLE, "corridor_id", "sort_order")
                .foreignKey(DungeonPersistenceSchema.CORRIDOR_WAYPOINTS_TABLE,
                        DungeonPersistenceSchema.CORRIDORS_TABLE,
                        "CASCADE", SqliteSchemaValidator.reference("corridor_id", "corridor_id"))
                .foreignKey(DungeonPersistenceSchema.CORRIDOR_WAYPOINTS_TABLE,
                        DungeonPersistenceSchema.ROOM_CLUSTERS_TABLE,
                        "CASCADE", SqliteSchemaValidator.reference("cluster_id", "cluster_id"))
                .table(DungeonPersistenceSchema.ROOM_EXIT_DESCRIPTIONS_TABLE,
                        "room_id", "level_z", "cell_x", "cell_y", "edge_direction", "description", "sort_order")
                .primaryKey(DungeonPersistenceSchema.ROOM_EXIT_DESCRIPTIONS_TABLE,
                        "room_id", "level_z", "cell_x", "cell_y", "edge_direction")
                .foreignKey(DungeonPersistenceSchema.ROOM_EXIT_DESCRIPTIONS_TABLE,
                        DungeonPersistenceSchema.ROOMS_TABLE,
                        "CASCADE", SqliteSchemaValidator.reference("room_id", "room_id"))
                .table(DungeonPersistenceSchema.STAIRS_TABLE,
                        "stair_id", "dungeon_map_id", "name", "shape", "direction", "dimension1", "dimension2",
                        "corridor_id")
                .primaryKey(DungeonPersistenceSchema.STAIRS_TABLE, "stair_id")
                .foreignKey(DungeonPersistenceSchema.STAIRS_TABLE, DungeonPersistenceSchema.MAPS_TABLE,
                        "CASCADE", SqliteSchemaValidator.reference("dungeon_map_id", "dungeon_map_id"))
                .foreignKey(DungeonPersistenceSchema.STAIRS_TABLE, DungeonPersistenceSchema.CORRIDORS_TABLE,
                        "CASCADE", SqliteSchemaValidator.reference("corridor_id", "corridor_id"))
                .table(DungeonPersistenceSchema.STAIR_PATH_NODES_TABLE,
                        "stair_id", "sort_order", "cell_x", "cell_y", "cell_z")
                .primaryKey(DungeonPersistenceSchema.STAIR_PATH_NODES_TABLE, "stair_id", "sort_order")
                .foreignKey(DungeonPersistenceSchema.STAIR_PATH_NODES_TABLE, DungeonPersistenceSchema.STAIRS_TABLE,
                        "CASCADE", SqliteSchemaValidator.reference("stair_id", "stair_id"))
                .table(DungeonPersistenceSchema.STAIR_EXITS_TABLE,
                        "stair_exit_id", "stair_id", "cell_x", "cell_y", "cell_z", "label")
                .primaryKey(DungeonPersistenceSchema.STAIR_EXITS_TABLE, "stair_exit_id")
                .foreignKey(DungeonPersistenceSchema.STAIR_EXITS_TABLE, DungeonPersistenceSchema.STAIRS_TABLE,
                        "CASCADE", SqliteSchemaValidator.reference("stair_id", "stair_id"))
                .table(DungeonPersistenceSchema.TRANSITIONS_TABLE,
                        "transition_id", "dungeon_map_id", "description", "cell_x", "cell_y", "level_z",
                        "anchor_type", "anchor_edge_direction", "destination_type", "target_overworld_map_id",
                        "target_overworld_tile_id", "target_dungeon_map_id", "target_transition_id",
                        "linked_transition_id")
                .primaryKey(DungeonPersistenceSchema.TRANSITIONS_TABLE, "transition_id")
                .foreignKey(DungeonPersistenceSchema.TRANSITIONS_TABLE, DungeonPersistenceSchema.MAPS_TABLE,
                        "CASCADE", SqliteSchemaValidator.reference("dungeon_map_id", "dungeon_map_id"))
                .foreignKey(DungeonPersistenceSchema.TRANSITIONS_TABLE, DungeonPersistenceSchema.MAPS_TABLE,
                        "SET NULL", SqliteSchemaValidator.reference("target_dungeon_map_id", "dungeon_map_id"))
                .foreignKey(DungeonPersistenceSchema.TRANSITIONS_TABLE, DungeonPersistenceSchema.TRANSITIONS_TABLE,
                        "SET NULL", SqliteSchemaValidator.reference("target_transition_id", "transition_id"))
                .foreignKey(DungeonPersistenceSchema.TRANSITIONS_TABLE, DungeonPersistenceSchema.TRANSITIONS_TABLE,
                        "SET NULL", SqliteSchemaValidator.reference("linked_transition_id", "transition_id"))
                .table(DungeonPersistenceSchema.FEATURE_MARKERS_TABLE,
                        "feature_marker_id", "dungeon_map_id", "marker_kind", "cell_x", "cell_y", "level_z",
                        "label", "description")
                .primaryKey(DungeonPersistenceSchema.FEATURE_MARKERS_TABLE, "dungeon_map_id", "feature_marker_id")
                .foreignKey(DungeonPersistenceSchema.FEATURE_MARKERS_TABLE, DungeonPersistenceSchema.MAPS_TABLE,
                        "CASCADE", SqliteSchemaValidator.reference("dungeon_map_id", "dungeon_map_id"))
                .index("idx_dungeon_chunks_by_horizontal_window", DungeonPersistenceSchema.CHUNKS_TABLE,
                        false, "dungeon_map_id", "chunk_q", "chunk_r", "level_z")
                .index("idx_dungeon_entity_chunks_by_chunk", DungeonPersistenceSchema.ENTITY_CHUNKS_TABLE,
                        false, "dungeon_map_id", "level_z", "chunk_q", "chunk_r", "entity_kind", "entity_id")
                .index("idx_dungeon_entity_chunks_level_extrema", DungeonPersistenceSchema.ENTITY_CHUNKS_TABLE,
                        false, "dungeon_map_id", "level_z", "minimum_q", "maximum_q", "minimum_r", "maximum_r")
                .index("idx_dungeon_entity_chunks_continuation", DungeonPersistenceSchema.ENTITY_CHUNKS_TABLE,
                        false, "dungeon_map_id", "entity_kind", "entity_id", "level_z", "chunk_r", "chunk_q")
                .index("idx_dungeon_corridor_route_cells_by_chunk",
                        DungeonPersistenceSchema.CORRIDOR_ROUTE_CELLS_TABLE,
                        false, "dungeon_map_id", "level_z", "chunk_q", "chunk_r", "corridor_id",
                        "segment_order", "cell_order")
                .index("idx_dungeon_corridor_route_dependencies_by_cell",
                        DungeonPersistenceSchema.CORRIDOR_ROUTE_DEPENDENCIES_TABLE,
                        false, "dungeon_map_id", "level_z", "cell_x", "cell_y", "corridor_id")
                .index("idx_dungeon_rooms_by_cluster", DungeonPersistenceSchema.ROOMS_TABLE,
                        false, "cluster_id", "room_id")
                .build();
        return FeatureStoreDefinition.validated(
                OWNER, targetSchema,
                new SqliteMigration(1, schema::ensureSchema),
                new SqliteMigration(2, schema::ensureSchema),
                new SqliteMigration(3, schema::replaceWithCanonicalSchema),
                new SqliteMigration(4, schema::addCorridorDoorLevel),
                new SqliteMigration(5, schema::addCorridorRouteCellIndex),
                new SqliteMigration(6, schema::addCorridorRouteDependencyIndex),
                new SqliteMigration(7, schema::repairVersionSixSchema));
    }
}
