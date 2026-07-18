package features.dungeon.adapter.javafx.editor;

import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.ResultSetMetaData;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import features.dungeon.adapter.sqlite.model.DungeonPersistenceSchema;
import features.dungeon.adapter.sqlite.gateway.DungeonSqliteFixtureSpatialIndex;
import features.dungeon.adapter.sqlite.repository.SqliteDungeonMapRepository;
import features.dungeon.adapter.sqlite.repository.SqliteDungeonWindowStore;
import features.party.adapter.sqlite.model.PartyPersistenceSchema;
import features.dungeon.DungeonTestAssembly;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.Direction;
import features.dungeon.domain.core.geometry.DungeonBoundaryKey;
import features.dungeon.domain.core.geometry.Edge;
import features.dungeon.application.authored.port.DungeonMapRepository;
import features.dungeon.application.authored.port.DungeonCatalogStore;
import features.dungeon.api.DungeonEditorControlsModel;
import features.dungeon.api.DungeonEditorMapSurfaceModel;
import features.dungeon.api.DungeonEditorStateModel;
import features.party.PartyServiceAssembly;
import features.party.domain.roster.PartyRoster;
import features.party.domain.roster.repository.PartyRosterRepository;
import features.dungeon.application.editor.DungeonEditorRuntimeDependencies;
import features.dungeon.application.editor.DungeonEditorApiFacade;
import features.dungeon.application.editor.DungeonEditorFeatureRuntimeRoot;
import features.dungeon.api.editor.DungeonEditorApi;

class DungeonEditorTestPersistence {

    @FunctionalInterface
    interface DatabaseFixtureSeeder {
        void seed(DatabaseAssertions database);
    }








    record RoomClusterIds(long roomId, long clusterId) {
    }

    record TestRuntime(
            DungeonEditorRuntimeDependencies editorDependencies,
            DungeonEditorControlsModel controlsModel,
            DungeonEditorMapSurfaceModel mapSurfaceModel,
            DungeonEditorStateModel stateModel,
            DatabaseAssertions database,
            DungeonEditorApi editorApi
    ) {
        static TestRuntime create() {
            DatabaseAssertions database = new DatabaseAssertions();
            database.clearDungeonData();
            SqliteDungeonMapRepository stores = new SqliteDungeonMapRepository();
            DungeonTestAssembly.Component dungeon = createDungeonServices(stores, stores);
            DungeonEditorRuntimeDependencies dependencies =
                    DungeonEditorTestPersistence.editorDependencies(dungeon);
            DungeonEditorApi api = new DungeonEditorApiFacade(
                    DungeonEditorFeatureRuntimeRoot.create(dependencies),
                    dependencies.uiDispatcher());
            return new TestRuntime(
                    dependencies,
                    dungeon.editorControls(),
                    dungeon.editorMapSurface(),
                    dungeon.editorState(),
                    database,
                    api);
        }
    }

    static DungeonTestAssembly.Component createDungeonServices(
            DungeonCatalogStore catalogStore,
            DungeonMapRepository repository
    ) {
        PartyServiceAssembly.Component party = PartyServiceAssembly.create(new EmptyPartyRosterRepository());
        return DungeonTestAssembly.create(
                catalogStore,
                repository,
                new SqliteDungeonWindowStore(),
                party.activeParty(),
                party.travelPositions(),
                party.application(),
                party.mutation(),
                platform.execution.DirectExecutionLane.INSTANCE,
                platform.ui.DirectUiDispatcher.INSTANCE,
                platform.diagnostics.NoopDiagnostics.INSTANCE);
    }

    static DungeonEditorRuntimeDependencies editorDependencies(DungeonTestAssembly.Component dungeon) {
        return new DungeonEditorRuntimeDependencies(
                dungeon.editorControls(),
                dungeon.editorMapSurface(),
                dungeon.editorState(),
                dungeon.editor(),
                new features.dungeon.domain.core.structure.corridor.OrthogonalCorridorRoutingPolicy(),
                dungeon.authored()::currentWindowRequestGeneration,
                platform.execution.DirectExecutionLane.INSTANCE,
                platform.ui.DirectUiDispatcher.INSTANCE);
    }

    private static final class EmptyPartyRosterRepository implements PartyRosterRepository {
        private PartyRoster roster = new PartyRoster(1L, List.of());

        @Override
        public PartyRoster load() {
            return roster;
        }

        @Override
        public void save(PartyRoster roster) {
            this.roster = Objects.requireNonNull(roster, "roster");
        }
    }

    static final class DatabaseAssertions {
        final Path databasePath;

        DatabaseAssertions() {
            String xdgDataHome = System.getenv("XDG_DATA_HOME");
            if (xdgDataHome == null || xdgDataHome.isBlank()) {
                throw new IllegalStateException("XDG_DATA_HOME must isolate the Dungeon Editor behavior DB.");
            }
            databasePath = Path.of(xdgDataHome, "salt-marcher", DungeonPersistenceSchema.DATABASE_FILE_NAME);
        }

        long countMapsNamed(String mapName) {
            return count("SELECT COUNT(*) FROM dungeon_maps WHERE name=?", mapName);
        }

        long mapIdByName(String mapName) {
            try (Connection connection = open();
                 PreparedStatement statement = connection.prepareStatement(
                         "SELECT dungeon_map_id FROM dungeon_maps WHERE name=?")) {
                bind(statement, mapName);
                return scalar(statement);
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to find dungeon map by name.", exception);
            }
        }

        void clearDungeonData() {
            try (Connection connection = open();
                 Statement statement = connection.createStatement()) {
                statement.execute("PRAGMA foreign_keys=ON");
                for (String createTableSql : DungeonPersistenceSchema.CREATE_TABLE_SQL) {
                    statement.execute(createTableSql);
                }
                statement.executeUpdate("DELETE FROM dungeon_maps");
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to reset Dungeon Editor behavior DB.", exception);
            }
        }

        void clearPartyData() {
            try (Connection connection = open();
                 Statement statement = connection.createStatement()) {
                statement.execute(PartyPersistenceSchema.CREATE_PLAYER_CHARACTERS_TABLE_SQL);
                statement.execute(PartyPersistenceSchema.CREATE_PARTY_ROSTER_METADATA_TABLE_SQL);
                statement.execute(PartyPersistenceSchema.INITIALIZE_METADATA_SQL);
                statement.executeUpdate("DELETE FROM player_characters");
                statement.executeUpdate("UPDATE party_roster_metadata SET next_character_id=1 WHERE singleton_id=1");
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to reset Party behavior DB.", exception);
            }
        }

        long createPersistedMap(String mapName) {
            try (Connection connection = open()) {
                connection.setAutoCommit(false);
                long mapId = insertAndReturnId(
                        connection,
                        "INSERT INTO dungeon_maps(name) VALUES(?)",
                        mapName);
                connection.commit();
                return mapId;
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to create persisted dungeon map fixture.", exception);
            }
        }

        long countMapIdWithName(long mapId, String mapName) {
            return count("SELECT COUNT(*) FROM dungeon_maps WHERE dungeon_map_id=? AND name=?", mapId, mapName);
        }

        long countAuthoredGeometryRows(long mapId) {
            long rows = 0L;
            rows += count("SELECT COUNT(*) FROM dungeon_rooms WHERE dungeon_map_id=?", mapId);
            rows += count("SELECT COUNT(*) FROM dungeon_room_clusters WHERE dungeon_map_id=?", mapId);
            rows += count("SELECT COUNT(*) FROM dungeon_room_cells WHERE room_id IN ("
                    + "SELECT room_id FROM dungeon_rooms WHERE dungeon_map_id=?)", mapId);
            rows += count("SELECT COUNT(*) FROM dungeon_room_cluster_edges WHERE dungeon_map_id=?", mapId);
            rows += count("SELECT COUNT(*) FROM dungeon_corridors WHERE dungeon_map_id=?", mapId);
            rows += count("SELECT COUNT(*) FROM dungeon_topology_elements WHERE dungeon_map_id=?", mapId);
            rows += count("SELECT COUNT(*) FROM dungeon_stairs WHERE dungeon_map_id=?", mapId);
            rows += count("SELECT COUNT(*) FROM dungeon_transitions WHERE dungeon_map_id=?", mapId);
            return rows;
        }

        long countRoomsForMap(long mapId) {
            return count("SELECT COUNT(*) FROM dungeon_rooms WHERE dungeon_map_id=?", mapId);
        }

        long mapRevision(long mapId) {
            return count("SELECT revision FROM dungeon_maps WHERE dungeon_map_id=?", mapId);
        }

        long countChunksForMap(long mapId) {
            return count("SELECT COUNT(*) FROM dungeon_chunks WHERE dungeon_map_id=?", mapId);
        }

        void refreshWindowIndexesForFixture(long mapId) {
            DungeonSqliteFixtureSpatialIndex.rebuild(databasePath, mapId);
        }

        long countRoomClustersForMap(long mapId) {
            return count("SELECT COUNT(*) FROM dungeon_room_clusters WHERE dungeon_map_id=?", mapId);
        }

        long countRetiredLegacyClusterVertexRowsIfPresent(long mapId) {
            if (!tableExists("dungeon_room_cluster_vertices")) {
                return 0L;
            }
            return count(
                    "SELECT COUNT(*) FROM dungeon_room_cluster_vertices WHERE cluster_id IN ("
                            + "SELECT cluster_id FROM dungeon_room_clusters WHERE dungeon_map_id=?)",
                    mapId);
        }

        private boolean tableExists(String tableName) {
            return count(
                    "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name=?",
                    tableName) > 0L;
        }

        long countClusterFloorCellRows(long mapId) {
            return count(
                    "SELECT COUNT(*) FROM dungeon_room_cells WHERE room_id IN ("
                            + "SELECT room_id FROM dungeon_rooms WHERE dungeon_map_id=?)",
                    mapId);
        }

        Set<Long> corridorIdsForMap(long mapId) {
            try (Connection connection = open();
                 PreparedStatement statement = connection.prepareStatement(
                         "SELECT corridor_id FROM dungeon_corridors WHERE dungeon_map_id=? ORDER BY corridor_id")) {
                bind(statement, mapId);
                try (ResultSet resultSet = statement.executeQuery()) {
                    Set<Long> ids = new LinkedHashSet<>();
                    while (resultSet.next()) {
                        ids.add(resultSet.getLong("corridor_id"));
                    }
                    return ids;
                }
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to read corridor ids.", exception);
            }
        }

        long countClusterWallEdges(long clusterId) {
            return count(
                    "SELECT COUNT(*) FROM dungeon_room_cluster_edges"
                            + " WHERE cluster_id=? AND edge_type='WALL'",
                    clusterId);
        }

        long countWallBoundariesForDirection(long mapId, String direction) {
            return count(
                    "SELECT COUNT(*) FROM dungeon_room_cluster_edges edge_row"
                            + " JOIN dungeon_room_clusters cluster_row ON cluster_row.cluster_id=edge_row.cluster_id"
                            + " WHERE cluster_row.dungeon_map_id=?"
                            + " AND edge_row.edge_direction=?"
                            + " AND edge_row.edge_type='WALL'",
                    mapId,
                    direction);
        }

        long countWallBoundaryRows(long mapId) {
            return count(
                    "SELECT COUNT(*) FROM dungeon_room_cluster_edges edge_row"
                            + " JOIN dungeon_room_clusters cluster_row ON cluster_row.cluster_id=edge_row.cluster_id"
                            + " WHERE cluster_row.dungeon_map_id=?"
                            + " AND edge_row.edge_type='WALL'",
                    mapId);
        }

        long countDistinctWallBoundaryTopologyRefs(long mapId) {
            return count(
                    "SELECT COUNT(DISTINCT edge_row.topology_element_id)"
                            + " FROM dungeon_room_cluster_edges edge_row"
                            + " JOIN dungeon_room_clusters cluster_row ON cluster_row.cluster_id=edge_row.cluster_id"
                            + " WHERE cluster_row.dungeon_map_id=?"
                            + " AND edge_row.edge_type='WALL'"
                            + " AND edge_row.topology_element_id IS NOT NULL",
                    mapId);
        }

        long countUnreferencedWallTopologyElements(long mapId) {
            return count(
                    "SELECT COUNT(*) FROM dungeon_topology_elements topology_row"
                            + " WHERE topology_row.dungeon_map_id=?"
                            + " AND topology_row.element_kind='WALL'"
                            + " AND NOT EXISTS ("
                            + " SELECT 1 FROM dungeon_room_cluster_edges edge_row"
                            + " JOIN dungeon_room_clusters cluster_row"
                            + " ON cluster_row.cluster_id=edge_row.cluster_id"
                            + " WHERE cluster_row.dungeon_map_id=topology_row.dungeon_map_id"
                            + " AND edge_row.topology_element_id=topology_row.element_id"
                            + " AND edge_row.edge_type='WALL')",
                    mapId);
        }

        Set<String> wallBoundaryAbsoluteRowsForDirection(long mapId, String direction) {
            try (Connection connection = open();
                 PreparedStatement statement = connection.prepareStatement(
                         "SELECT edge_row.cell_x AS absolute_x,"
                                 + " edge_row.cell_y AS absolute_y,"
                                 + " edge_row.level_z, edge_row.edge_direction, edge_row.edge_type"
                                 + " FROM dungeon_room_cluster_edges edge_row"
                                 + " WHERE edge_row.dungeon_map_id=?"
                                 + " AND edge_row.edge_direction=?"
                                 + " AND edge_row.edge_type='WALL'"
                                 + " ORDER BY edge_row.level_z, absolute_x, absolute_y")) {
                bind(statement, mapId, direction);
                try (ResultSet resultSet = statement.executeQuery()) {
                    Set<String> rows = new LinkedHashSet<>();
                    while (resultSet.next()) {
                        rows.add("cell=" + resultSet.getInt("absolute_x")
                                + ","
                                + resultSet.getInt("absolute_y")
                                + ","
                                + resultSet.getInt("level_z")
                                + ",direction=" + resultSet.getString("edge_direction")
                                + ",type=" + resultSet.getString("edge_type"));
                    }
                    return rows;
                }
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to read absolute wall boundary rows.", exception);
            }
        }

        long countOpenBoundariesForDirection(long mapId, String direction) {
            return count(
                    "SELECT COUNT(*) FROM dungeon_room_cluster_edges edge_row"
                            + " JOIN dungeon_room_clusters cluster_row ON cluster_row.cluster_id=edge_row.cluster_id"
                            + " WHERE cluster_row.dungeon_map_id=?"
                            + " AND edge_row.edge_direction=?"
                            + " AND edge_row.edge_type='OPEN'"
                            + " AND edge_row.topology_element_id IS NULL",
                    mapId,
                    direction);
        }

        long countInternalWallBoundaries(long clusterId) {
            return count(
                    "SELECT COUNT(*) FROM dungeon_room_cluster_edges edge_row"
                            + " WHERE edge_row.cluster_id=?"
                            + " AND edge_row.edge_type='WALL'"
                            + " AND edge_row.topology_element_id IS NOT NULL"
                            + " AND EXISTS (SELECT 1 FROM dungeon_room_cells cell_row"
                            + " JOIN dungeon_rooms room_row ON room_row.room_id=cell_row.room_id"
                            + " WHERE room_row.cluster_id=edge_row.cluster_id"
                            + " AND cell_row.level_z=edge_row.level_z"
                            + " AND cell_row.cell_x=edge_row.cell_x"
                            + " AND cell_row.cell_y=edge_row.cell_y)"
                            + " AND EXISTS (SELECT 1 FROM dungeon_room_cells cell_row"
                            + " JOIN dungeon_rooms room_row ON room_row.room_id=cell_row.room_id"
                            + " WHERE room_row.cluster_id=edge_row.cluster_id"
                            + " AND cell_row.level_z=edge_row.level_z"
                            + " AND cell_row.cell_x=edge_row.cell_x"
                            + " + CASE edge_row.edge_direction WHEN 'EAST' THEN 1 WHEN 'WEST' THEN -1 ELSE 0 END"
                            + " AND cell_row.cell_y=edge_row.cell_y"
                            + " + CASE edge_row.edge_direction WHEN 'SOUTH' THEN 1 WHEN 'NORTH' THEN -1 ELSE 0 END)",
                    clusterId);
        }

        List<String> openBoundaryRowsForDirection(long clusterId, String direction) {
            try (Connection connection = open();
                 PreparedStatement statement = connection.prepareStatement(
                         "SELECT level_z, cell_x, cell_y, edge_direction, edge_type, topology_element_id"
                                 + " FROM dungeon_room_cluster_edges"
                                 + " WHERE cluster_id=? AND edge_direction=? AND edge_type='OPEN'"
                                 + " ORDER BY level_z, cell_x, cell_y, edge_direction")) {
                bind(statement, clusterId, direction);
                try (ResultSet resultSet = statement.executeQuery()) {
                    List<String> rows = new ArrayList<>();
                    while (resultSet.next()) {
                        rows.add("level_z=" + resultSet.getInt("level_z")
                                + ",cell_x=" + resultSet.getInt("cell_x")
                                + ",cell_y=" + resultSet.getInt("cell_y")
                                + ",edge_direction=" + resultSet.getString("edge_direction")
                                + ",edge_type=" + resultSet.getString("edge_type")
                                + ",topology_element_id="
                                + Objects.toString(resultSet.getObject("topology_element_id"), "<null>"));
                    }
                    return rows;
                }
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to read open boundary rows.", exception);
            }
        }

        long countWallTopologyElementsForDirection(long mapId, String direction) {
            List<Long> topologyElementIds = wallTopologyElementIdsForDirection(direction);
            return count(
                    "SELECT COUNT(*) FROM dungeon_topology_elements topology_row"
                            + " WHERE topology_row.dungeon_map_id=?"
                            + " AND topology_row.element_kind='WALL'"
                            + " AND topology_row.element_id IN (?, ?, ?)",
                    mapId,
                    topologyElementIds.get(0),
                    topologyElementIds.get(1),
                    topologyElementIds.get(2));
        }

        long countInternalWallTopologyElements(long mapId) {
            return count(
                    "SELECT COUNT(*) FROM dungeon_topology_elements topology_row"
                            + " WHERE topology_row.dungeon_map_id=?"
                            + " AND topology_row.element_kind='WALL'"
                            + " AND topology_row.element_id IN (?, ?, ?)",
                    mapId,
                    wallTopologyElementId(2, 2, 0, -1, -1, "EAST"),
                    wallTopologyElementId(2, 2, 0, -1, 0, "EAST"),
                    wallTopologyElementId(2, 2, 0, -1, 1, "EAST"));
        }

        static List<Long> wallTopologyElementIdsForDirection(String direction) {
            if ("NORTH".equals(direction) || "SOUTH".equals(direction)) {
                int relativeY = "NORTH".equals(direction) ? -1 : 1;
                return List.of(
                        wallTopologyElementId(2, 2, 0, -1, relativeY, direction),
                        wallTopologyElementId(2, 2, 0, 0, relativeY, direction),
                        wallTopologyElementId(2, 2, 0, 1, relativeY, direction));
            }
            if ("WEST".equals(direction) || "EAST".equals(direction)) {
                int relativeX = "WEST".equals(direction) ? -1 : 1;
                return List.of(
                        wallTopologyElementId(2, 2, 0, relativeX, -1, direction),
                        wallTopologyElementId(2, 2, 0, relativeX, 0, direction),
                        wallTopologyElementId(2, 2, 0, relativeX, 1, direction));
            }
            throw new IllegalArgumentException("Unsupported wall direction: " + direction);
        }

        Set<String> roomFloorAnchors(long roomId) {
            return tableExists("dungeon_room_floors") ? Set.of("legacy-room-floor-table") : Set.of();
        }

        Set<String> clusterFloorCells(long clusterId) {
            try (Connection connection = open();
                 PreparedStatement statement = connection.prepareStatement(
                         "SELECT cell_x, cell_y, level_z"
                                 + " FROM dungeon_room_cells WHERE room_id IN ("
                                 + "SELECT room_id FROM dungeon_rooms WHERE cluster_id=?)"
                                 + " ORDER BY level_z, cell_y, cell_x")) {
                statement.setLong(1, clusterId);
                try (ResultSet resultSet = statement.executeQuery()) {
                    Set<String> cells = new LinkedHashSet<>();
                    while (resultSet.next()) {
                        cells.add(resultSet.getInt("cell_x")
                                + ","
                                + resultSet.getInt("cell_y")
                                + ","
                                + resultSet.getInt("level_z"));
                    }
                    return cells;
                }
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to read cluster floor cells.", exception);
            }
        }

        long clusterIdByCenter(long mapId, int centerX, int centerY, int level) {
            try (Connection connection = open();
                 PreparedStatement statement = connection.prepareStatement(
                         "SELECT cluster_row.cluster_id FROM dungeon_room_clusters cluster_row"
                                 + " WHERE cluster_row.dungeon_map_id=?"
                                 + " AND (SELECT cell_x FROM dungeon_room_cells cell_row"
                                 + " JOIN dungeon_rooms room_row ON room_row.room_id=cell_row.room_id"
                                 + " WHERE room_row.cluster_id=cluster_row.cluster_id"
                                 + " ORDER BY cell_row.level_z, cell_row.cell_y, cell_row.cell_x LIMIT 1)=?"
                                 + " AND (SELECT cell_y FROM dungeon_room_cells cell_row"
                                 + " JOIN dungeon_rooms room_row ON room_row.room_id=cell_row.room_id"
                                 + " WHERE room_row.cluster_id=cluster_row.cluster_id"
                                 + " ORDER BY cell_row.level_z, cell_row.cell_y, cell_row.cell_x LIMIT 1)=?"
                                 + " AND (SELECT level_z FROM dungeon_room_cells cell_row"
                                 + " JOIN dungeon_rooms room_row ON room_row.room_id=cell_row.room_id"
                                 + " WHERE room_row.cluster_id=cluster_row.cluster_id"
                                 + " ORDER BY cell_row.level_z, cell_row.cell_y, cell_row.cell_x LIMIT 1)=?")) {
                bind(statement, mapId, centerX, centerY, level);
                return scalar(statement);
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to find room cluster by center.", exception);
            }
        }

        long countClustersAtCenter(long mapId, int centerX, int centerY, int level) {
            return count(
                    "SELECT COUNT(*) FROM dungeon_room_clusters cluster_row"
                            + " WHERE cluster_row.dungeon_map_id=?"
                            + " AND (SELECT cell_x FROM dungeon_room_cells cell_row"
                            + " JOIN dungeon_rooms room_row ON room_row.room_id=cell_row.room_id"
                            + " WHERE room_row.cluster_id=cluster_row.cluster_id"
                            + " ORDER BY cell_row.level_z, cell_row.cell_y, cell_row.cell_x LIMIT 1)=?"
                            + " AND (SELECT cell_y FROM dungeon_room_cells cell_row"
                            + " JOIN dungeon_rooms room_row ON room_row.room_id=cell_row.room_id"
                            + " WHERE room_row.cluster_id=cluster_row.cluster_id"
                            + " ORDER BY cell_row.level_z, cell_row.cell_y, cell_row.cell_x LIMIT 1)=?"
                            + " AND (SELECT level_z FROM dungeon_room_cells cell_row"
                            + " JOIN dungeon_rooms room_row ON room_row.room_id=cell_row.room_id"
                            + " WHERE room_row.cluster_id=cluster_row.cluster_id"
                            + " ORDER BY cell_row.level_z, cell_row.cell_y, cell_row.cell_x LIMIT 1)=?",
                    mapId,
                    centerX,
                    centerY,
                    level);
        }

        RoomClusterIds roomByComponent(long mapId, int componentX, int componentY, int level) {
            try (Connection connection = open();
                 PreparedStatement statement = connection.prepareStatement(
                         "SELECT room_row.room_id, room_row.cluster_id FROM dungeon_rooms room_row"
                                 + " JOIN dungeon_room_cells cell_row ON cell_row.room_id=room_row.room_id"
                                 + " WHERE room_row.dungeon_map_id=? AND cell_row.cell_x=?"
                                 + " AND cell_row.cell_y=? AND cell_row.level_z=?")) {
                bind(statement, mapId, componentX, componentY, level);
                try (ResultSet resultSet = statement.executeQuery()) {
                    if (!resultSet.next()) {
                        throw new SQLException("No room found by component cell.");
                    }
                    RoomClusterIds ids = new RoomClusterIds(resultSet.getLong("room_id"), resultSet.getLong("cluster_id"));
                    if (resultSet.next()) {
                        throw new SQLException("Multiple rooms found by component cell.");
                    }
                    return ids;
                }
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to find room by component cell.", exception);
            }
        }

        List<String> roomClusterState(long mapId, String roomName) {
            RoomClusterIds ids = roomByName(mapId, roomName);
            try (Connection connection = open()) {
                List<String> state = new ArrayList<>();
                appendRows(
                        connection,
                        state,
                        "dungeon_rooms",
                        "SELECT room_id, dungeon_map_id, cluster_id, name, visual_description"
                                + " FROM dungeon_rooms WHERE room_id=? ORDER BY room_id",
                        ids.roomId());
                appendRows(
                        connection,
                        state,
                        "dungeon_room_clusters",
                        "SELECT cluster_id, dungeon_map_id, name"
                                + " FROM dungeon_room_clusters WHERE cluster_id=? ORDER BY cluster_id",
                        ids.clusterId());
                appendRows(
                        connection,
                        state,
                        "dungeon_room_cells",
                        "SELECT room_id, level_z, cell_x, cell_y"
                                + " FROM dungeon_room_cells WHERE room_id=? ORDER BY level_z, cell_y, cell_x",
                        ids.roomId());
                appendRows(
                        connection,
                        state,
                        "dungeon_room_cluster_edges",
                        "SELECT cluster_id, level_z, cell_x, cell_y, edge_direction, edge_type, topology_element_id"
                                + " FROM dungeon_room_cluster_edges WHERE cluster_id=?"
                                + " ORDER BY level_z, cell_x, cell_y, edge_direction",
                        ids.clusterId());
                appendRows(
                        connection,
                        state,
                        "dungeon_topology_elements",
                        "SELECT dungeon_map_id, element_kind, element_id, cluster_id, corridor_id, label, sort_order"
                                + " FROM dungeon_topology_elements"
                                + " WHERE dungeon_map_id=? AND cluster_id=?"
                                + " ORDER BY element_kind, element_id",
                        mapId,
                        ids.clusterId());
                return state;
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to snapshot room/cluster state.", exception);
            }
        }

        RoomClusterIds roomByName(long mapId, String roomName) {
            try (Connection connection = open();
                 PreparedStatement statement = connection.prepareStatement(
                         "SELECT room_id, cluster_id FROM dungeon_rooms WHERE dungeon_map_id=? AND name=?")) {
                bind(statement, mapId, roomName);
                try (ResultSet resultSet = statement.executeQuery()) {
                    if (!resultSet.next()) {
                        throw new SQLException("No room found by name: " + roomName);
                    }
                    RoomClusterIds ids = new RoomClusterIds(resultSet.getLong("room_id"), resultSet.getLong("cluster_id"));
                    if (resultSet.next()) {
                        throw new SQLException("Multiple rooms found by name: " + roomName);
                    }
                    return ids;
                }
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to find room by name.", exception);
            }
        }

        String roomName(long roomId) {
            try (Connection connection = open();
                 PreparedStatement statement = connection.prepareStatement(
                         "SELECT name FROM dungeon_rooms WHERE room_id=?")) {
                statement.setLong(1, roomId);
                try (ResultSet resultSet = statement.executeQuery()) {
                    if (!resultSet.next()) {
                        throw new SQLException("No room found by id: " + roomId);
                    }
                    return resultSet.getString("name");
                }
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to read room name.", exception);
            }
        }

        String clusterName(long clusterId) {
            try (Connection connection = open();
                 PreparedStatement statement = connection.prepareStatement(
                         "SELECT name FROM dungeon_room_clusters WHERE cluster_id=?")) {
                statement.setLong(1, clusterId);
                try (ResultSet resultSet = statement.executeQuery()) {
                    if (!resultSet.next()) {
                        throw new SQLException("No cluster found by id: " + clusterId);
                    }
                    return resultSet.getString("name");
                }
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to read cluster name.", exception);
            }
        }

        Set<String> authoredClusterBoundaryCorners(long clusterId) {
            try (Connection connection = open()) {
                return boundaryDerivedClusterCorners(connection, clusterId);
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to read authored cluster boundary corners.", exception);
            }
        }

        private Set<String> boundaryDerivedClusterCorners(Connection connection, long clusterId) throws SQLException {
            try (PreparedStatement statement = connection.prepareStatement(
                         "SELECT edge_row.level_z, edge_row.cell_x, edge_row.cell_y, edge_row.edge_direction"
                                 + " FROM dungeon_room_cluster_edges edge_row"
                                 + " WHERE edge_row.cluster_id=?"
                                 + " AND edge_row.edge_type IN ('WALL', 'DOOR')"
                                 + " ORDER BY edge_row.level_z, edge_row.cell_y, edge_row.cell_x,"
                                 + " edge_row.edge_direction")) {
                statement.setLong(1, clusterId);
                Map<Cell, BoundaryEndpointFacts> endpointFacts = new LinkedHashMap<>();
                try (ResultSet resultSet = statement.executeQuery()) {
                    while (resultSet.next()) {
                        Cell absoluteCell = new Cell(
                                resultSet.getInt("cell_x"),
                                resultSet.getInt("cell_y"),
                                resultSet.getInt("level_z"));
                        Edge edge = Direction.parse(resultSet.getString("edge_direction")).edgeOf(absoluteCell);
                        recordBoundaryEndpoint(endpointFacts, edge.from(), edge);
                        recordBoundaryEndpoint(endpointFacts, edge.to(), edge);
                    }
                }
                Set<String> vertices = new LinkedHashSet<>();
                for (Map.Entry<Cell, BoundaryEndpointFacts> entry : endpointFacts.entrySet()) {
                    if (entry.getValue().corner()) {
                        Cell endpoint = entry.getKey();
                        vertices.add(endpoint.q() + "," + endpoint.r() + "," + endpoint.level());
                    }
                }
                return vertices;
            }
        }

        private static void recordBoundaryEndpoint(
                Map<Cell, BoundaryEndpointFacts> endpointFacts,
                Cell endpoint,
                Edge edge
        ) {
            BoundaryEndpointFacts facts = endpointFacts.get(endpoint);
            if (facts == null) {
                facts = new BoundaryEndpointFacts();
                endpointFacts.put(endpoint, facts);
            }
            facts.record(edge);
        }

        private static final class BoundaryEndpointFacts {
            private int edgeCount;
            private boolean horizontal;
            private boolean vertical;

            void record(Edge edge) {
                edgeCount++;
                horizontal = horizontal || edge.from().r() == edge.to().r();
                vertical = vertical || edge.from().q() == edge.to().q();
            }

            boolean corner() {
                return edgeCount != 2 || (horizontal && vertical);
            }
        }

        long countRoomVisualDescription(long roomId, String visualDescription) {
            return count(
                    "SELECT COUNT(*) FROM dungeon_rooms WHERE room_id=? AND visual_description=?",
                    roomId,
                    visualDescription);
        }

        void saveRoomVisualDescription(long roomId, String visualDescription) {
            try (Connection connection = open();
                 PreparedStatement statement = connection.prepareStatement(
                         "UPDATE dungeon_rooms SET visual_description=? WHERE room_id=?")) {
                bind(statement, visualDescription, roomId);
                if (statement.executeUpdate() != 1) {
                    throw new SQLException("Expected exactly one room row for visual description update.");
                }
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to save room visual description.", exception);
            }
        }

        long countRoomExitDescription(
                long roomId,
                int cellX,
                int cellY,
                String direction,
                String description
        ) {
            return count(
                    "SELECT COUNT(*) FROM dungeon_room_exit_descriptions"
                            + " WHERE room_id=? AND cell_x=? AND cell_y=? AND edge_direction=? AND description=?",
                    roomId,
                    cellX,
                    cellY,
                    direction,
                    description);
        }

        long countDoorBoundariesAt(long mapId, int relativeCellX, int relativeCellY, String direction) {
            return count(
                    "SELECT COUNT(*) FROM dungeon_room_cluster_edges edge_row"
                            + " JOIN dungeon_room_clusters cluster_row ON cluster_row.cluster_id=edge_row.cluster_id"
                            + " JOIN dungeon_topology_elements topology_row"
                            + " ON topology_row.dungeon_map_id=cluster_row.dungeon_map_id"
                            + " AND topology_row.element_kind='DOOR'"
                            + " AND topology_row.element_id=edge_row.topology_element_id"
                            + " WHERE cluster_row.dungeon_map_id=?"
                            + " AND edge_row.cell_x - (SELECT (MIN(cell_row.cell_x) + MAX(cell_row.cell_x)) / 2"
                            + " FROM dungeon_room_cells cell_row JOIN dungeon_rooms room_row"
                            + " ON room_row.room_id=cell_row.room_id"
                            + " WHERE room_row.cluster_id=cluster_row.cluster_id)=?"
                            + " AND edge_row.cell_y - (SELECT (MIN(cell_row.cell_y) + MAX(cell_row.cell_y)) / 2"
                            + " FROM dungeon_room_cells cell_row JOIN dungeon_rooms room_row"
                            + " ON room_row.room_id=cell_row.room_id"
                            + " WHERE room_row.cluster_id=cluster_row.cluster_id)=?"
                            + " AND edge_row.edge_direction=?"
                            + " AND edge_row.edge_type='DOOR'",
                    mapId,
                    relativeCellX,
                    relativeCellY,
                    direction);
        }

        List<String> authoredGeometryState(long mapId) {
            try (Connection connection = open()) {
                List<String> state = new ArrayList<>();
                appendRows(
                        connection,
                        state,
                        "dungeon_rooms",
                        "SELECT room_id, dungeon_map_id, cluster_id, name, visual_description"
                                + " FROM dungeon_rooms WHERE dungeon_map_id=? ORDER BY room_id",
                        mapId);
                appendRows(
                        connection,
                        state,
                        "dungeon_room_clusters",
                        "SELECT cluster_id, dungeon_map_id, name"
                                + " FROM dungeon_room_clusters WHERE dungeon_map_id=? ORDER BY cluster_id",
                        mapId);
                appendRows(
                        connection,
                        state,
                        "dungeon_room_cells",
                        "SELECT room_cell.room_id, room_cell.level_z, room_cell.cell_x, room_cell.cell_y"
                                + " FROM dungeon_room_cells room_cell"
                                + " JOIN dungeon_rooms room ON room.room_id=room_cell.room_id"
                                + " WHERE room.dungeon_map_id=?"
                                + " ORDER BY room_cell.room_id, room_cell.level_z,"
                                + " room_cell.cell_y, room_cell.cell_x",
                        mapId);
                appendRows(
                        connection,
                        state,
                        "dungeon_room_cluster_edges",
                        "SELECT edge_row.cluster_id, edge_row.level_z, edge_row.cell_x, edge_row.cell_y,"
                                + " edge_row.edge_direction, edge_row.edge_type, edge_row.topology_element_id"
                                + " FROM dungeon_room_cluster_edges edge_row"
                                + " WHERE edge_row.dungeon_map_id=?"
                                + " ORDER BY edge_row.cluster_id, edge_row.level_z, edge_row.cell_x,"
                                + " edge_row.cell_y, edge_row.edge_direction",
                        mapId);
                appendRows(
                        connection,
                        state,
                        "dungeon_corridors",
                        "SELECT corridor_id, dungeon_map_id, level_z"
                                + " FROM dungeon_corridors WHERE dungeon_map_id=? ORDER BY corridor_id",
                        mapId);
                appendRows(
                        connection,
                        state,
                        "dungeon_corridor_members",
                        "SELECT member_row.corridor_id, member_row.room_id, member_row.member_order"
                                + " FROM dungeon_corridor_members member_row"
                                + " JOIN dungeon_corridors corridor_row"
                                + " ON corridor_row.corridor_id=member_row.corridor_id"
                                + " WHERE corridor_row.dungeon_map_id=?"
                                + " ORDER BY member_row.corridor_id, member_row.member_order, member_row.room_id",
                        mapId);
                appendRows(
                        connection,
                        state,
                        "dungeon_topology_elements",
                        "SELECT dungeon_map_id, element_kind, element_id, cluster_id,"
                                + " corridor_id, label, sort_order"
                                + " FROM dungeon_topology_elements WHERE dungeon_map_id=?"
                                + " ORDER BY element_kind, element_id",
                        mapId);
                appendRows(
                        connection,
                        state,
                        "dungeon_corridor_door_overrides",
                        "SELECT override_row.corridor_id, override_row.room_id, override_row.cluster_id,"
                                + " override_row.relative_cell_x, override_row.relative_cell_y,"
                                + " override_row.edge_direction, override_row.topology_element_id,"
                                + " override_row.sort_order"
                                + " FROM dungeon_corridor_door_overrides override_row"
                                + " JOIN dungeon_corridors corridor_row"
                                + " ON corridor_row.corridor_id=override_row.corridor_id"
                                + " WHERE corridor_row.dungeon_map_id=?"
                                + " ORDER BY override_row.corridor_id, override_row.sort_order,"
                                + " override_row.room_id",
                        mapId);
                appendRows(
                        connection,
                        state,
                        "dungeon_corridor_anchors",
                        "SELECT anchor_row.corridor_id, anchor_row.anchor_id,"
                                + " anchor_row.host_corridor_id, anchor_row.cell_x, anchor_row.cell_y,"
                                + " anchor_row.cell_z, anchor_row.topology_element_id, anchor_row.sort_order"
                                + " FROM dungeon_corridor_anchors anchor_row"
                                + " JOIN dungeon_corridors corridor_row"
                                + " ON corridor_row.corridor_id=anchor_row.corridor_id"
                                + " WHERE corridor_row.dungeon_map_id=?"
                                + " ORDER BY anchor_row.corridor_id, anchor_row.sort_order, anchor_row.anchor_id",
                        mapId);
                appendRows(
                        connection,
                        state,
                        "dungeon_corridor_anchor_refs",
                        "SELECT ref_row.corridor_id, ref_row.host_corridor_id,"
                                + " ref_row.topology_element_id"
                                + " FROM dungeon_corridor_anchor_refs ref_row"
                                + " JOIN dungeon_corridors corridor_row"
                                + " ON corridor_row.corridor_id=ref_row.corridor_id"
                                + " WHERE corridor_row.dungeon_map_id=?"
                                + " ORDER BY ref_row.corridor_id,"
                                + " ref_row.topology_element_id",
                        mapId);
                appendRows(
                        connection,
                        state,
                        "dungeon_corridor_waypoints",
                        "SELECT waypoint_row.corridor_id, waypoint_row.sort_order,"
                                + " waypoint_row.cluster_id, waypoint_row.relative_x,"
                                + " waypoint_row.relative_y, waypoint_row.relative_z"
                                + " FROM dungeon_corridor_waypoints waypoint_row"
                                + " JOIN dungeon_corridors corridor_row"
                                + " ON corridor_row.corridor_id=waypoint_row.corridor_id"
                                + " WHERE corridor_row.dungeon_map_id=?"
                                + " ORDER BY waypoint_row.corridor_id, waypoint_row.sort_order",
                        mapId);
                appendRows(
                        connection,
                        state,
                        "dungeon_room_exit_descriptions",
                        "SELECT exit_row.room_id, exit_row.cell_x, exit_row.cell_y,"
                                + " exit_row.edge_direction, exit_row.description, exit_row.sort_order"
                                + " FROM dungeon_room_exit_descriptions exit_row"
                                + " JOIN dungeon_rooms room_row ON room_row.room_id=exit_row.room_id"
                                + " WHERE room_row.dungeon_map_id=?"
                                + " ORDER BY exit_row.room_id, exit_row.sort_order, exit_row.cell_x,"
                                + " exit_row.cell_y, exit_row.edge_direction",
                        mapId);
                appendRows(
                        connection,
                        state,
                        "dungeon_stairs",
                        "SELECT stair_id, dungeon_map_id, name, shape, direction,"
                                + " dimension1, dimension2, corridor_id"
                                + " FROM dungeon_stairs WHERE dungeon_map_id=? ORDER BY stair_id",
                        mapId);
                appendRows(
                        connection,
                        state,
                        "dungeon_stair_path_nodes",
                        "SELECT path_node.stair_id, path_node.sort_order, path_node.cell_x,"
                                + " path_node.cell_y, path_node.cell_z"
                                + " FROM dungeon_stair_path_nodes path_node"
                                + " JOIN dungeon_stairs stair_row ON stair_row.stair_id=path_node.stair_id"
                                + " WHERE stair_row.dungeon_map_id=?"
                                + " ORDER BY path_node.stair_id, path_node.sort_order",
                        mapId);
                appendRows(
                        connection,
                        state,
                        "dungeon_stair_exits",
                        "SELECT stair_exit.stair_exit_id, stair_exit.stair_id,"
                                + " stair_exit.cell_x, stair_exit.cell_y, stair_exit.cell_z, stair_exit.label"
                                + " FROM dungeon_stair_exits stair_exit"
                                + " JOIN dungeon_stairs stair_row ON stair_row.stair_id=stair_exit.stair_id"
                                + " WHERE stair_row.dungeon_map_id=?"
                                + " ORDER BY stair_exit.stair_id, stair_exit.stair_exit_id",
                        mapId);
                appendRows(
                        connection,
                        state,
                        "dungeon_transitions",
                        "SELECT transition_id, dungeon_map_id, description, cell_x, cell_y,"
                                + " level_z, anchor_type, anchor_edge_direction,"
                                + " destination_type, target_overworld_map_id,"
                                + " target_overworld_tile_id, target_dungeon_map_id,"
                                + " target_transition_id, linked_transition_id"
                                + " FROM dungeon_transitions WHERE dungeon_map_id=? ORDER BY transition_id",
                        mapId);
                return state;
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to snapshot authored geometry DB state.", exception);
            }
        }

        List<String> doorBoundaryState(long mapId) {
            try (Connection connection = open()) {
                List<String> state = new ArrayList<>();
                appendRows(
                        connection,
                        state,
                        "door_edges",
                        "SELECT edge_row.cluster_id, edge_row.level_z, edge_row.cell_x, edge_row.cell_y,"
                                + " edge_row.edge_direction, edge_row.edge_type, edge_row.topology_element_id"
                                + " FROM dungeon_room_cluster_edges edge_row"
                                + " JOIN dungeon_room_clusters cluster_row ON cluster_row.cluster_id=edge_row.cluster_id"
                                + " WHERE cluster_row.dungeon_map_id=? AND edge_row.edge_type='DOOR'"
                                + " ORDER BY edge_row.cluster_id, edge_row.cell_x, edge_row.cell_y,"
                                + " edge_row.edge_direction",
                        mapId);
                return state;
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to snapshot door boundary DB state.", exception);
            }
        }

        List<String> roomBoundaryEdgeState(long mapId) {
            try (Connection connection = open()) {
                List<String> state = new ArrayList<>();
                appendRows(
                        connection,
                        state,
                        "dungeon_room_cluster_edges",
                        "SELECT edge_row.cluster_id, edge_row.level_z, edge_row.cell_x, edge_row.cell_y,"
                                + " edge_row.edge_direction, edge_row.edge_type, edge_row.topology_element_id"
                                + " FROM dungeon_room_cluster_edges edge_row"
                                + " JOIN dungeon_room_clusters cluster_row ON cluster_row.cluster_id=edge_row.cluster_id"
                                + " WHERE cluster_row.dungeon_map_id=?"
                                + " ORDER BY edge_row.cluster_id, edge_row.level_z, edge_row.cell_x,"
                                + " edge_row.cell_y, edge_row.edge_direction",
                        mapId);
                return state;
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to snapshot room boundary DB state.", exception);
            }
        }

        List<String> corridorAnchorState(long mapId) {
            try (Connection connection = open()) {
                List<String> state = new ArrayList<>();
                appendRows(
                        connection,
                        state,
                        "dungeon_corridor_anchors",
                        "SELECT anchor_row.corridor_id, anchor_row.anchor_id,"
                                + " anchor_row.host_corridor_id, anchor_row.cell_x, anchor_row.cell_y,"
                                + " anchor_row.cell_z, anchor_row.topology_element_id, anchor_row.sort_order"
                                + " FROM dungeon_corridor_anchors anchor_row"
                                + " JOIN dungeon_corridors corridor_row"
                                + " ON corridor_row.corridor_id=anchor_row.corridor_id"
                                + " WHERE corridor_row.dungeon_map_id=?"
                                + " ORDER BY anchor_row.corridor_id, anchor_row.anchor_id",
                        mapId);
                return state;
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to snapshot corridor anchor DB state.", exception);
            }
        }

        long countCorridorAnchorsAt(long mapId, int cellX, int cellY, int cellZ) {
            return count(
                    "SELECT COUNT(*) FROM dungeon_corridor_anchors anchor_row"
                            + " JOIN dungeon_corridors corridor_row"
                            + " ON corridor_row.corridor_id=anchor_row.corridor_id"
                            + " WHERE corridor_row.dungeon_map_id=?"
                            + " AND anchor_row.cell_x=? AND anchor_row.cell_y=? AND anchor_row.cell_z=?",
                    mapId,
                    cellX,
                    cellY,
                    cellZ);
        }

        List<String> corridorWaypointAbsoluteState(long mapId) {
            try (Connection connection = open()) {
                List<String> state = new ArrayList<>();
                appendRows(
                        connection,
                        state,
                        "dungeon_corridor_waypoints",
                        "SELECT waypoint_row.corridor_id, waypoint_row.sort_order,"
                                + " (SELECT cell_x FROM dungeon_room_cells cell_row"
                                + " JOIN dungeon_rooms room_row ON room_row.room_id=cell_row.room_id"
                                + " WHERE room_row.cluster_id=waypoint_row.cluster_id"
                                + " ORDER BY cell_row.level_z, cell_row.cell_y, cell_row.cell_x LIMIT 1)"
                                + " + waypoint_row.relative_x AS cell_x,"
                                + " (SELECT cell_y FROM dungeon_room_cells cell_row"
                                + " JOIN dungeon_rooms room_row ON room_row.room_id=cell_row.room_id"
                                + " WHERE room_row.cluster_id=waypoint_row.cluster_id"
                                + " ORDER BY cell_row.level_z, cell_row.cell_y, cell_row.cell_x LIMIT 1)"
                                + " + waypoint_row.relative_y AS cell_y,"
                                + " waypoint_row.relative_z AS cell_z"
                                + " FROM dungeon_corridor_waypoints waypoint_row"
                                + " JOIN dungeon_corridors corridor_row"
                                + " ON corridor_row.corridor_id=waypoint_row.corridor_id"
                                + " WHERE corridor_row.dungeon_map_id=?"
                                + " ORDER BY waypoint_row.corridor_id, waypoint_row.sort_order",
                        mapId);
                return state;
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to snapshot corridor waypoint absolute state.", exception);
            }
        }

        List<String> corridorStableConnectionState(long mapId) {
            try (Connection connection = open()) {
                List<String> state = new ArrayList<>();
                appendRows(
                        connection,
                        state,
                        "dungeon_corridors",
                        "SELECT corridor_id, dungeon_map_id, level_z"
                                + " FROM dungeon_corridors WHERE dungeon_map_id=? ORDER BY corridor_id",
                        mapId);
                appendRows(
                        connection,
                        state,
                        "dungeon_corridor_members",
                        "SELECT member_row.corridor_id, member_row.room_id, member_row.member_order"
                                + " FROM dungeon_corridor_members member_row"
                                + " JOIN dungeon_corridors corridor_row"
                                + " ON corridor_row.corridor_id=member_row.corridor_id"
                                + " WHERE corridor_row.dungeon_map_id=?"
                                + " ORDER BY member_row.corridor_id, member_row.member_order, member_row.room_id",
                        mapId);
                appendRows(
                        connection,
                        state,
                        "dungeon_corridor_door_overrides",
                        "SELECT override_row.corridor_id, override_row.room_id, override_row.cluster_id,"
                                + " override_row.relative_cell_x, override_row.relative_cell_y,"
                                + " override_row.edge_direction, override_row.topology_element_id,"
                                + " override_row.sort_order"
                                + " FROM dungeon_corridor_door_overrides override_row"
                                + " JOIN dungeon_corridors corridor_row"
                                + " ON corridor_row.corridor_id=override_row.corridor_id"
                                + " WHERE corridor_row.dungeon_map_id=?"
                                + " ORDER BY override_row.corridor_id, override_row.sort_order,"
                                + " override_row.room_id",
                        mapId);
                appendRows(
                        connection,
                        state,
                        "dungeon_corridor_anchor_refs",
                        "SELECT ref_row.corridor_id, ref_row.host_corridor_id,"
                                + " ref_row.topology_element_id"
                                + " FROM dungeon_corridor_anchor_refs ref_row"
                                + " JOIN dungeon_corridors corridor_row"
                                + " ON corridor_row.corridor_id=ref_row.corridor_id"
                                + " WHERE corridor_row.dungeon_map_id=?"
                                + " ORDER BY ref_row.corridor_id,"
                                + " ref_row.topology_element_id",
                        mapId);
                appendRows(
                        connection,
                        state,
                        "dungeon_corridor_waypoints",
                        "SELECT waypoint_row.corridor_id, waypoint_row.sort_order,"
                                + " waypoint_row.cluster_id, waypoint_row.relative_x,"
                                + " waypoint_row.relative_y, waypoint_row.relative_z"
                                + " FROM dungeon_corridor_waypoints waypoint_row"
                                + " JOIN dungeon_corridors corridor_row"
                                + " ON corridor_row.corridor_id=waypoint_row.corridor_id"
                                + " WHERE corridor_row.dungeon_map_id=?"
                                + " ORDER BY waypoint_row.corridor_id, waypoint_row.sort_order",
                        mapId);
                appendRows(
                        connection,
                        state,
                        "dungeon_topology_elements",
                        "SELECT dungeon_map_id, element_kind, element_id, cluster_id,"
                                + " corridor_id, label"
                                + " FROM dungeon_topology_elements WHERE dungeon_map_id=?"
                                + " AND element_kind IN ('CORRIDOR', 'CORRIDOR_ANCHOR')"
                                + " ORDER BY element_kind, element_id",
                        mapId);
                return state;
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to snapshot stable corridor connection DB state.", exception);
            }
        }

        List<String> stairStableState(long mapId) {
            try (Connection connection = open()) {
                List<String> state = new ArrayList<>();
                appendRows(
                        connection,
                        state,
                        "dungeon_stairs",
                        "SELECT stair_id, dungeon_map_id, name, shape, direction,"
                                + " dimension1, dimension2, corridor_id"
                                + " FROM dungeon_stairs WHERE dungeon_map_id=? ORDER BY stair_id",
                        mapId);
                appendRows(
                        connection,
                        state,
                        "dungeon_topology_elements",
                        "SELECT dungeon_map_id, element_kind, element_id, label"
                                + " FROM dungeon_topology_elements"
                                + " WHERE dungeon_map_id=? AND element_kind='STAIR'"
                                + " ORDER BY element_kind, element_id",
                        mapId);
                return state;
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to snapshot stair stable DB state.", exception);
            }
        }

        List<String> featureMarkerStableState(long mapId) {
            try (Connection connection = open()) {
                List<String> state = new ArrayList<>();
                appendRows(
                        connection,
                        state,
                        "dungeon_feature_markers",
                        "SELECT feature_marker_id, dungeon_map_id, marker_kind, cell_x, cell_y, level_z,"
                                + " label, description"
                                + " FROM dungeon_feature_markers WHERE dungeon_map_id=?"
                                + " ORDER BY feature_marker_id",
                        mapId);
                appendRows(
                        connection,
                        state,
                        "dungeon_topology_elements",
                        "SELECT dungeon_map_id, element_kind, element_id, label"
                                + " FROM dungeon_topology_elements"
                                + " WHERE dungeon_map_id=? AND element_kind='FEATURE_MARKER'"
                                + " ORDER BY element_kind, element_id",
                        mapId);
                return state;
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to snapshot feature-marker DB state.", exception);
            }
        }

        long featureMarkerIdAt(long mapId, String kind, int cellX, int cellY, int level) {
            try (Connection connection = open();
                 PreparedStatement statement = connection.prepareStatement(
                         "SELECT feature_marker_id FROM dungeon_feature_markers"
                                 + " WHERE dungeon_map_id=? AND marker_kind=?"
                                 + " AND cell_x=? AND cell_y=? AND level_z=?")) {
                bind(statement, mapId, kind, cellX, cellY, level);
                return scalar(statement);
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to find feature marker by cell.", exception);
            }
        }

        long countFeatureMarkerById(long mapId, long markerId) {
            return count(
                    "SELECT COUNT(*) FROM dungeon_feature_markers"
                            + " WHERE dungeon_map_id=? AND feature_marker_id=?",
                    mapId,
                    markerId);
        }

        long countFeatureMarkerTopologyElementById(long mapId, long markerId) {
            return count(
                    "SELECT COUNT(*) FROM dungeon_topology_elements"
                            + " WHERE dungeon_map_id=? AND element_kind='FEATURE_MARKER' AND element_id=?",
                    mapId,
                    markerId);
        }

        List<String> stairPathState(long mapId) {
            try (Connection connection = open()) {
                List<String> state = new ArrayList<>();
                appendRows(
                        connection,
                        state,
                        "dungeon_stair_path_nodes",
                        "SELECT path_node.stair_id, path_node.sort_order, path_node.cell_x,"
                                + " path_node.cell_y, path_node.cell_z"
                                + " FROM dungeon_stair_path_nodes path_node"
                                + " JOIN dungeon_stairs stair_row ON stair_row.stair_id=path_node.stair_id"
                                + " WHERE stair_row.dungeon_map_id=?"
                                + " ORDER BY path_node.stair_id, path_node.sort_order",
                        mapId);
                return state;
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to snapshot stair path DB state.", exception);
            }
        }

        long countStairPathRowsByStairId(long stairId) {
            return count(
                    "SELECT COUNT(*) FROM dungeon_stair_path_nodes WHERE stair_id=?",
                    stairId);
        }

        List<String> stairExitState(long mapId) {
            try (Connection connection = open()) {
                List<String> state = new ArrayList<>();
                appendRows(
                        connection,
                        state,
                        "dungeon_stair_exits",
                        "SELECT stair_exit.stair_exit_id, stair_exit.stair_id,"
                                + " stair_exit.cell_x, stair_exit.cell_y, stair_exit.cell_z, stair_exit.label"
                                + " FROM dungeon_stair_exits stair_exit"
                                + " JOIN dungeon_stairs stair_row ON stair_row.stair_id=stair_exit.stair_id"
                                + " WHERE stair_row.dungeon_map_id=?"
                                + " ORDER BY stair_exit.stair_id, stair_exit.stair_exit_id",
                        mapId);
                return state;
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to snapshot stair exit DB state.", exception);
            }
        }

        long countStairExitRowsByStairId(long stairId) {
            return count(
                    "SELECT COUNT(*) FROM dungeon_stair_exits WHERE stair_id=?",
                    stairId);
        }

        List<String> transitionStableState(long mapId) {
            try (Connection connection = open()) {
                List<String> state = new ArrayList<>();
                appendRows(
                        connection,
                        state,
                        "dungeon_transitions",
                        "SELECT transition_id, dungeon_map_id, cell_x, cell_y,"
                                + " level_z, anchor_type, anchor_edge_direction,"
                                + " destination_type, target_overworld_map_id,"
                                + " target_overworld_tile_id, target_dungeon_map_id,"
                                + " target_transition_id, linked_transition_id"
                                + " FROM dungeon_transitions WHERE dungeon_map_id=? ORDER BY transition_id",
                        mapId);
                return state;
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to snapshot transition stable DB state.", exception);
            }
        }

        long transitionIdByDescription(long mapId, String description) {
            try (Connection connection = open();
                 PreparedStatement statement = connection.prepareStatement(
                         "SELECT transition_id FROM dungeon_transitions"
                                 + " WHERE dungeon_map_id=? AND description=?")) {
                bind(statement, mapId, description);
                return scalar(statement);
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to find transition by description.", exception);
            }
        }

        long transitionIdAt(long mapId, int cellX, int cellY, int level) {
            try (Connection connection = open();
                 PreparedStatement statement = connection.prepareStatement(
                         "SELECT transition_id FROM dungeon_transitions"
                                 + " WHERE dungeon_map_id=? AND cell_x=? AND cell_y=? AND level_z=?")) {
                bind(statement, mapId, cellX, cellY, level);
                return scalar(statement);
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to find transition by cell.", exception);
            }
        }

        long maxStairId() {
            return count("SELECT COALESCE(MAX(stair_id), 0) FROM dungeon_stairs");
        }

        long maxTransitionId() {
            return count("SELECT COALESCE(MAX(transition_id), 0) FROM dungeon_transitions");
        }

        long countTransitionDescription(long mapId, long transitionId, String description) {
            return count(
                    "SELECT COUNT(*) FROM dungeon_transitions"
                            + " WHERE dungeon_map_id=? AND transition_id=? AND description=?",
                    mapId,
                    transitionId,
                    description);
        }

        long countTransitionById(long mapId, long transitionId) {
            return count(
                    "SELECT COUNT(*) FROM dungeon_transitions WHERE dungeon_map_id=? AND transition_id=?",
                    mapId,
                    transitionId);
        }

        long countTransitionTopologyElementById(long mapId, long transitionId) {
            return count(
                    "SELECT COUNT(*) FROM dungeon_topology_elements"
                            + " WHERE dungeon_map_id=? AND element_kind='TRANSITION' AND element_id=?",
                    mapId,
                    transitionId);
        }

        void seedF6MultiLevelFloors(long mapId) {
            try (Connection connection = open()) {
                connection.setAutoCommit(false);
                insertRectangularRoom(connection, mapId, "R1", 0, 1, 1);
                insertRectangularRoom(connection, mapId, "R2", 1, 1, 1);
                insertRectangularRoom(connection, mapId, "R3", 2, 1, 1);
                connection.commit();
                refreshWindowIndexesForFixture(mapId);
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to seed F6_MULTI_LEVEL_FLOORS fixture.", exception);
            }
        }

        void seedTransitionDescriptionFixture(long mapId) {
            try (Connection connection = open()) {
                connection.setAutoCommit(false);
                insertRectangularRoom(connection, mapId, "R1", 0, 1, 1);
                insertRectangularRoom(connection, mapId, "R2", 1, 1, 1);
                insertRectangularRoom(connection, mapId, "R3", 2, 1, 1);
                insertTransition(connection, mapId, "Initial transition.", 5, 2, 0);
                connection.commit();
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to seed transition description fixture.", exception);
            }
        }

        void seedTransitionLinkFixture(long sourceMapId, long targetMapId) {
            try (Connection connection = open()) {
                connection.setAutoCommit(false);
                insertRectangularRoom(connection, sourceMapId, "R1", 0, 1, 1);
                insertRectangularRoom(connection, sourceMapId, "R2", 1, 1, 1);
                insertRectangularRoom(connection, sourceMapId, "R3", 2, 1, 1);
                insertTransition(connection, sourceMapId, "Source transition.", 5, 2, 0);
                insertRectangularRoom(connection, targetMapId, "R1", 0, 1, 1);
                insertTransition(connection, targetMapId, "Target transition.", 6, 2, 0);
                connection.commit();
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to seed transition link fixture.", exception);
            }
        }

        void seedResolvedTransitionLinkFixture(long sourceMapId, long targetMapId) {
            try (Connection connection = open()) {
                connection.setAutoCommit(false);
                insertRectangularRoom(connection, sourceMapId, "R1", 0, 1, 1);
                insertRectangularRoom(connection, sourceMapId, "R2", 1, 1, 1);
                insertRectangularRoom(connection, sourceMapId, "R3", 2, 1, 1);
                long sourceTransitionId = insertTransition(connection, sourceMapId, "Source transition.", 5, 2, 0);
                insertRectangularRoom(connection, targetMapId, "R1", 0, 1, 1);
                long targetTransitionId = insertTransition(connection, targetMapId, "Target transition.", 6, 2, 0);
                updateDungeonMapDestination(connection, sourceTransitionId, targetMapId, targetTransitionId);
                updateLinkedTransition(connection, targetTransitionId, sourceTransitionId);
                connection.commit();
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to seed resolved transition link fixture.", exception);
            }
        }

        void seedUnlinkedTransitionFixture(long mapId) {
            try (Connection connection = open()) {
                connection.setAutoCommit(false);
                insertRectangularRoom(connection, mapId, "R1", 0, 1, 1);
                insertRectangularRoom(connection, mapId, "R2", 1, 1, 1);
                insertRectangularRoom(connection, mapId, "R3", 2, 1, 1);
                insertTransitionWithAnchor(
                        connection,
                        mapId,
                        "Unlinked transition.",
                        5,
                        2,
                        0,
                        "CELL",
                        null,
                        "UNLINKED_ENTRANCE",
                        null,
                        null,
                        null,
                        null);
                connection.commit();
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to seed unlinked transition fixture.", exception);
            }
        }

        void seedTransitionAnchorRoundtripFixture(long mapId) {
            try (Connection connection = open()) {
                connection.setAutoCommit(false);
                insertRectangularRoom(connection, mapId, "R1", 0, 1, 1);
                long targetMapId = insertAndReturnId(
                        connection,
                        "INSERT INTO dungeon_maps(name) VALUES(?)",
                        "Transition Anchor Destination Target");
                insertTransition(connection, mapId, "Cell anchor transition.", 5, 2, 0);
                insertTransitionWithAnchor(
                        connection,
                        mapId,
                        "Dungeon map destination transition.",
                        7,
                        2,
                        0,
                        "CELL",
                        null,
                        "DUNGEON_MAP",
                        null,
                        null,
                        targetMapId,
                        null);
                insertTransitionWithAnchor(
                        connection,
                        mapId,
                        "None anchor transition.",
                        null,
                        null,
                        null,
                        "NONE",
                        null);
                insertTransitionWithAnchor(
                        connection,
                        mapId,
                        "Edge anchor transition.",
                        6,
                        2,
                        0,
                        "EDGE",
                        "EAST");
                connection.commit();
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to seed transition anchor roundtrip fixture.", exception);
            }
        }

        void seedMalformedUnknownAnchorFixture(long mapId) {
            try (Connection connection = open()) {
                connection.setAutoCommit(false);
                insertRectangularRoom(connection, mapId, "R1", 0, 1, 1);
                insertTransitionWithAnchor(
                        connection,
                        mapId,
                        "Malformed unknown anchor.",
                        1,
                        1,
                        0,
                        "PORTAL",
                        null);
                connection.commit();
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to seed malformed unknown transition anchor fixture.", exception);
            }
        }

        void seedMalformedPartialAnchorCoordinateFixture(long mapId) {
            seedMalformedCoordinateFixture(
                    mapId,
                    "Malformed partial coordinate anchor.",
                    "UPDATE dungeon_transitions SET cell_y=NULL, level_z=NULL WHERE transition_id=?");
        }

        void seedMalformedNoneAnchorWithCoordinateFixture(long mapId) {
            seedMalformedCoordinateFixture(
                    mapId,
                    "Malformed none coordinate anchor.",
                    "UPDATE dungeon_transitions"
                            + " SET cell_x=NULL, level_z=NULL, anchor_type='NONE' WHERE transition_id=?");
        }

        private void seedMalformedCoordinateFixture(long mapId, String description, String corruptionSql) {
            long transitionId;
            try (Connection connection = open()) {
                connection.setAutoCommit(false);
                insertRectangularRoom(connection, mapId, "R1", 0, 1, 1);
                transitionId = insertTransitionWithAnchor(
                        connection,
                        mapId,
                        description,
                        1,
                        1,
                        0,
                        "CELL",
                        null,
                        "UNLINKED_ENTRANCE",
                        null,
                        null,
                        null,
                        null);
                connection.commit();
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to seed indexed transition fixture baseline.", exception);
            }
            refreshWindowIndexesForFixture(mapId);
            try (Connection connection = open();
                 PreparedStatement statement = connection.prepareStatement(corruptionSql)) {
                statement.setLong(1, transitionId);
                if (statement.executeUpdate() != 1) {
                    throw new SQLException("Expected exactly one transition row to corrupt.");
                }
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to corrupt indexed transition fixture.", exception);
            }
        }

        void seedMalformedIncompleteEdgeAnchorFixture(long mapId) {
            try (Connection connection = open()) {
                connection.setAutoCommit(false);
                insertRectangularRoom(connection, mapId, "R1", 0, 1, 1);
                insertTransitionWithAnchor(
                        connection,
                        mapId,
                        "Malformed incomplete edge anchor.",
                        2,
                        1,
                        0,
                        "EDGE",
                        "UP");
                connection.commit();
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to seed malformed incomplete edge fixture.", exception);
            }
        }

        void seedMalformedImplicitAnchorWithEdgeDirectionFixture(long mapId) {
            try (Connection connection = open()) {
                connection.setAutoCommit(false);
                insertRectangularRoom(connection, mapId, "R1", 0, 1, 1);
                insertTransitionWithAnchor(
                        connection,
                        mapId,
                        "Malformed implicit anchor edge direction.",
                        2,
                        1,
                        0,
                        null,
                        "EAST");
                connection.commit();
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to seed malformed implicit edge fixture.", exception);
            }
        }

        void seedMalformedDestinationTypeFixture(long mapId) {
            try (Connection connection = open()) {
                connection.setAutoCommit(false);
                insertRectangularRoom(connection, mapId, "R1", 0, 1, 1);
                insertTransitionWithAnchor(
                        connection,
                        mapId,
                        "Malformed destination.",
                        3,
                        1,
                        0,
                        "CELL",
                        null,
                        "PORTAL_TARGET");
                connection.commit();
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to seed malformed destination type fixture.", exception);
            }
        }

        void seedMalformedDestinationTargetFixture(long mapId) {
            try (Connection connection = open()) {
                connection.setAutoCommit(false);
                insertRectangularRoom(connection, mapId, "R1", 0, 1, 1);
                insertTransitionWithAnchor(
                        connection,
                        mapId,
                        "Malformed destination target.",
                        4,
                        1,
                        0,
                        "CELL",
                        null,
                        "OVERWORLD_TILE",
                        null,
                        88L,
                        null,
                        null);
                connection.commit();
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to seed malformed destination target fixture.", exception);
            }
        }

        void seedMalformedDungeonMapDestinationIdFixture(long mapId) {
            try (Connection connection = open()) {
                connection.setAutoCommit(false);
                insertRectangularRoom(connection, mapId, "R1", 0, 1, 1);
                insertTransitionWithAnchor(
                        connection,
                        mapId,
                        "Malformed dungeon map destination id.",
                        4,
                        2,
                        0,
                        "CELL",
                        null,
                        "DUNGEON_MAP",
                        null,
                        null,
                        0L,
                        null);
                connection.commit();
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to seed malformed dungeon map destination fixture.", exception);
            }
        }

        void seedMalformedDungeonTransitionDestinationIdFixture(long mapId) {
            try (Connection connection = open()) {
                connection.setAutoCommit(false);
                insertRectangularRoom(connection, mapId, "R1", 0, 1, 1);
                long targetMapId = insertAndReturnId(
                        connection,
                        "INSERT INTO dungeon_maps(name) VALUES(?)",
                        "Malformed Destination Target Map");
                insertTransitionWithAnchor(
                        connection,
                        mapId,
                        "Malformed dungeon transition destination id.",
                        4,
                        3,
                        0,
                        "CELL",
                        null,
                        "DUNGEON_MAP",
                        null,
                        null,
                        targetMapId,
                        -1L);
                connection.commit();
            } catch (SQLException exception) {
                throw new IllegalStateException(
                        "Failed to seed malformed dungeon transition destination fixture.",
                        exception);
            }
        }

        void seedMalformedOverworldTileDestinationIdFixture(long mapId) {
            try (Connection connection = open()) {
                connection.setAutoCommit(false);
                insertRectangularRoom(connection, mapId, "R1", 0, 1, 1);
                insertTransitionWithAnchor(
                        connection,
                        mapId,
                        "Malformed overworld tile destination id.",
                        4,
                        4,
                        0,
                        "CELL",
                        null,
                        "OVERWORLD_TILE",
                        77L,
                        0L,
                        null,
                        null);
                connection.commit();
            } catch (SQLException exception) {
                throw new IllegalStateException(
                        "Failed to seed malformed overworld tile destination fixture.",
                        exception);
            }
        }

        void seedSelectedLinkedTransitionFixture(long mapId) {
            try (Connection connection = open()) {
                connection.setAutoCommit(false);
                insertRectangularRoom(connection, mapId, "R1", 0, 1, 1);
                long selectedId = insertTransition(
                        connection,
                        mapId,
                        "Selected linked transition.",
                        5,
                        2,
                        0);
                long linkedId = insertTransition(
                        connection,
                        mapId,
                        "Selected linked target transition.",
                        6,
                        2,
                        0);
                updateLinkedTransition(connection, selectedId, linkedId);
                connection.commit();
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to seed selected linked transition fixture.", exception);
            }
        }

        void seedReverseLinkedTransitionFixture(long mapId) {
            try (Connection connection = open()) {
                connection.setAutoCommit(false);
                insertRectangularRoom(connection, mapId, "R1", 0, 1, 1);
                long selectedId = insertTransition(
                        connection,
                        mapId,
                        "Reverse linked target transition.",
                        5,
                        2,
                        0);
                long sourceId = insertTransition(
                        connection,
                        mapId,
                        "Reverse linked source transition.",
                        6,
                        2,
                        0);
                updateLinkedTransition(connection, sourceId, selectedId);
                connection.commit();
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to seed reverse linked transition fixture.", exception);
            }
        }

        void seedDestinationReferenceTransitionFixture(long mapId) {
            try (Connection connection = open()) {
                connection.setAutoCommit(false);
                insertRectangularRoom(connection, mapId, "R1", 0, 1, 1);
                long selectedId = insertTransition(
                        connection,
                        mapId,
                        "Destination target transition.",
                        5,
                        2,
                        0);
                long sourceId = insertTransition(
                        connection,
                        mapId,
                        "Destination source transition.",
                        6,
                        2,
                        0);
                updateDungeonMapDestination(connection, sourceId, mapId, selectedId);
                connection.commit();
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to seed transition destination reference fixture.", exception);
            }
        }

        void seedF1SingleRoom(long mapId, String roomName, int level, int anchorX, int anchorY) {
            try (Connection connection = open()) {
                connection.setAutoCommit(false);
                insertRectangularRoom(connection, mapId, roomName, level, anchorX, anchorY);
                connection.commit();
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to seed F1_SINGLE_ROOM fixture.", exception);
            }
        }

        void seedF15ComplexCluster(long mapId) {
            try (Connection connection = open()) {
                connection.setAutoCommit(false);
                long clusterId = insertAndReturnId(
                        connection,
                        "INSERT INTO dungeon_room_clusters(dungeon_map_id, name) VALUES(?, ?)",
                        mapId,
                        "Cluster pending");
                nameCluster(connection, clusterId);
                long roomOneId = insertClusterRoom(connection, mapId, clusterId, "R1", 10, 10, 0);
                long roomTwoId = insertClusterRoom(connection, mapId, clusterId, "R2", 11, 10, 0);
                insertTopologyElement(connection, mapId, roomOneId, clusterId, "R1");
                insertTopologyElement(connection, mapId, roomTwoId, clusterId, "R2");
                insertRoomCell(connection, roomOneId, 0, 10, 10);
                insertRoomCell(connection, roomOneId, 0, 10, 11);
                insertRoomCell(connection, roomOneId, 0, 10, 12);
                insertRoomCell(connection, roomTwoId, 0, 11, 10);
                insertRoomCell(connection, roomTwoId, 0, 12, 10);
                insertComplexClusterWalls(connection, mapId, clusterId);
                connection.commit();
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to seed F15_COMPLEX_CLUSTER fixture.", exception);
            }
        }

        void seedNarrationRoomWithEastExitLink(long mapId) {
            try (Connection connection = open()) {
                connection.setAutoCommit(false);
                long roomId = insertRectangularRoom(connection, mapId, "R1", 0, 1, 1);
                insertRectangularRoom(connection, mapId, "R2", 0, 4, 1);
                markDoorEdge(connection, mapId, roomId, 0, 1, 0, "EAST", "Door east", 200);
                connection.commit();
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to seed narration room with east exit link fixture.", exception);
            }
        }

        void seedF4WalledRoomWithDoor(long mapId) {
            try (Connection connection = open()) {
                connection.setAutoCommit(false);
                long roomId = insertRectangularRoom(connection, mapId, "R1", 0, 1, 1);
                insertRectangularRoom(connection, mapId, "R2", 0, 4, 1);
                markDoorEdge(connection, mapId, roomId, 0, 1, 0, "EAST", "Door east", 200);
                connection.commit();
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to seed F4_WALLED_ROOM_WITH_DOOR fixture.", exception);
            }
        }

        void seedF7StairAnchor(long mapId) {
            try (Connection connection = open()) {
                connection.setAutoCommit(false);
                insertRectangularRoom(connection, mapId, "R1", 0, 8, 8);
                long stairId = insertAndReturnId(
                        connection,
                        "INSERT INTO dungeon_stairs(dungeon_map_id, name, shape, direction, dimension1, dimension2)"
                                + " VALUES(?, ?, ?, ?, ?, ?)",
                        mapId,
                        "S1",
                        "STRAIGHT",
                        0,
                        3,
                        1);
                insertFeatureTopologyElement(connection, mapId, stairId, "STAIR", "S1", 400);
                insertStairPathNode(connection, stairId, 0, 2, 2, 0);
                insertStairPathNode(connection, stairId, 1, 2, 1, 0);
                insertStairPathNode(connection, stairId, 2, 2, 0, 0);
                insertStairExit(connection, stairId, 2, 2, 0, "Unterer Ausgang");
                insertStairExit(connection, stairId, 2, 0, 1, "Oberer Ausgang");
                connection.commit();
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to seed F7_STAIR_ANCHOR fixture.", exception);
            }
        }

        void seedF7StairAnchorWithBlockingRoom(long mapId) {
            try (Connection connection = open()) {
                connection.setAutoCommit(false);
                insertRectangularRoom(connection, mapId, "R1", 0, 3, 1);
                long stairId = insertAndReturnId(
                        connection,
                        "INSERT INTO dungeon_stairs(dungeon_map_id, name, shape, direction, dimension1, dimension2)"
                                + " VALUES(?, ?, ?, ?, ?, ?)",
                        mapId,
                        "S1",
                        "STRAIGHT",
                        0,
                        3,
                        1);
                insertFeatureTopologyElement(connection, mapId, stairId, "STAIR", "S1", 400);
                insertStairPathNode(connection, stairId, 0, 2, 2, 0);
                insertStairPathNode(connection, stairId, 1, 2, 1, 0);
                insertStairPathNode(connection, stairId, 2, 2, 0, 0);
                insertStairExit(connection, stairId, 2, 2, 0, "Unterer Ausgang");
                insertStairExit(connection, stairId, 2, 0, 1, "Oberer Ausgang");
                connection.commit();
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to seed invalid stair recompute fixture.", exception);
            }
        }

        void seedCorridorBoundStairAnchor(long mapId) {
            try (Connection connection = open()) {
                connection.setAutoCommit(false);
                long roomId = insertRectangularRoom(connection, mapId, "R1", 0, 1, 1);
                long clusterId = scalarLong(
                        connection,
                        "SELECT cluster_id FROM dungeon_rooms WHERE room_id=?",
                        roomId);
                long corridorId = insertAndReturnId(
                        connection,
                        "INSERT INTO dungeon_corridors(dungeon_map_id, level_z) VALUES(?, ?)",
                        mapId,
                        0);
                insertCorridorTopologyElement(connection, mapId, corridorId, corridorId, "CORRIDOR", "K1", 300);
                insertCorridorWaypoint(connection, corridorId, clusterId, 0, 2, 0, 0);
                long stairId = insertAndReturnId(
                        connection,
                        "INSERT INTO dungeon_stairs(dungeon_map_id, name, shape, direction, dimension1, dimension2, corridor_id)"
                                + " VALUES(?, ?, ?, ?, ?, ?, ?)",
                        mapId,
                        "S1",
                        "STRAIGHT",
                        0,
                        1,
                        1,
                        corridorId);
                insertCorridorTopologyElement(connection, mapId, stairId, corridorId, "STAIR", "S1", 400);
                insertStairPathNode(connection, stairId, 0, 2, 2, 0);
                insertStairPathNode(connection, stairId, 1, 2, 2, 1);
                insertStairExit(connection, stairId, 2, 2, 0, "Unterer Ausgang");
                insertStairExit(connection, stairId, 2, 2, 1, "Oberer Ausgang");
                connection.commit();
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to seed corridor-bound stair fixture.", exception);
            }
        }

        void seedGlobalStairIdentitySentinel(long mapId) {
            try (Connection connection = open()) {
                connection.setAutoCommit(false);
                long stairId = insertAndReturnId(
                        connection,
                        "INSERT INTO dungeon_stairs(dungeon_map_id, name, shape, direction, dimension1, dimension2)"
                                + " VALUES(?, ?, ?, ?, ?, ?)",
                        mapId,
                        "Global Stair Sentinel",
                        "STRAIGHT",
                        0,
                        1,
                        1);
                insertFeatureTopologyElement(
                        connection,
                        mapId,
                        stairId,
                        "STAIR",
                        "Global Stair Sentinel",
                        900);
                connection.commit();
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to seed global stair identity sentinel.", exception);
            }
        }

        void seedGlobalTransitionIdentitySentinel(long mapId) {
            try (Connection connection = open()) {
                connection.setAutoCommit(false);
                insertTransition(connection, mapId, "Global transition sentinel.", 1, 1, 0);
                connection.commit();
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to seed global transition identity sentinel.", exception);
            }
        }

        void seedCorridorWithAnchor(long mapId) {
            try (Connection connection = open()) {
                connection.setAutoCommit(false);
                long roomOneId = insertRectangularRoom(connection, mapId, "R1", 0, 1, 1);
                long roomTwoId = insertRectangularRoom(connection, mapId, "R2", 0, 8, 1);
                long roomOneClusterId = scalarLong(
                        connection,
                        "SELECT cluster_id FROM dungeon_rooms WHERE room_id=?",
                        roomOneId);
                long roomTwoClusterId = scalarLong(
                        connection,
                        "SELECT cluster_id FROM dungeon_rooms WHERE room_id=?",
                        roomTwoId);
                long doorOneId = markDoorEdge(connection, mapId, roomOneId, 0, 1, 0, "EAST", "D1", 200);
                long doorTwoId = markDoorEdge(connection, mapId, roomTwoId, 0, -1, 0, "WEST", "D2", 201);
                long corridorId = insertAndReturnId(
                        connection,
                        "INSERT INTO dungeon_corridors(dungeon_map_id, level_z) VALUES(?, ?)",
                        mapId,
                        0);
                insertCorridorTopologyElement(connection, mapId, corridorId, corridorId, "CORRIDOR", "K1", 300);
                insertCorridorMember(connection, corridorId, roomOneId, 0);
                insertCorridorMember(connection, corridorId, roomTwoId, 1);
                insertCorridorDoorOverride(connection, corridorId, roomOneId, roomOneClusterId, 1, 0, "EAST", doorOneId, 0);
                insertCorridorDoorOverride(connection, corridorId, roomTwoId, roomTwoClusterId, -1, 0, "WEST", doorTwoId, 1);
                insertCorridorWaypoint(connection, corridorId, roomOneClusterId, 0, 2, 0, 0);
                insertCorridorWaypoint(connection, corridorId, roomOneClusterId, 2, 0, 0, 1);
                insertCorridorWaypoint(connection, corridorId, roomOneClusterId, 4, 0, 0, 2);
                insertCorridorWaypoint(connection, corridorId, roomOneClusterId, 4, 3, 0, 3);
                insertCorridorWaypoint(connection, corridorId, roomOneClusterId, 5, 3, 0, 4);
                insertCorridorWaypoint(connection, corridorId, roomOneClusterId, 5, 0, 0, 5);
                long anchorTopologyId = 70_000L + corridorId;
                insertCorridorTopologyElement(
                        connection,
                        mapId,
                        anchorTopologyId,
                        corridorId,
                        "CORRIDOR_ANCHOR",
                        "A1",
                        301);
                insertCorridorAnchor(connection, corridorId, 1, corridorId, 6, 5, 0, anchorTopologyId, 0);
                insertCorridorAnchorRef(connection, corridorId, corridorId, anchorTopologyId, 2);
                connection.commit();
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to seed F5_CORRIDOR_WITH_ANCHOR fixture.", exception);
            }
        }

        void seedCorridorSplitRouteTarget(long mapId) {
            try (Connection connection = open()) {
                connection.setAutoCommit(false);
                long roomOneId = insertRectangularRoom(connection, mapId, "R1", 0, 1, 1);
                long roomTwoId = insertRectangularRoom(connection, mapId, "R2", 0, 8, 1);
                long roomThreeId = insertRectangularRoom(connection, mapId, "R3", 0, 5, 9);
                long roomOneClusterId = scalarLong(
                        connection,
                        "SELECT cluster_id FROM dungeon_rooms WHERE room_id=?",
                        roomOneId);
                long roomTwoClusterId = scalarLong(
                        connection,
                        "SELECT cluster_id FROM dungeon_rooms WHERE room_id=?",
                        roomTwoId);
                long doorOneId = markDoorEdge(connection, mapId, roomOneId, 0, 1, 0, "EAST", "D1", 200);
                long doorTwoId = markDoorEdge(connection, mapId, roomTwoId, 0, -1, 0, "WEST", "D2", 201);
                markDoorEdge(connection, mapId, roomThreeId, 0, 0, -1, "NORTH", "D3", 202);
                long corridorId = insertAndReturnId(
                        connection,
                        "INSERT INTO dungeon_corridors(dungeon_map_id, level_z) VALUES(?, ?)",
                        mapId,
                        0);
                insertCorridorTopologyElement(connection, mapId, corridorId, corridorId, "CORRIDOR", "K1", 300);
                insertCorridorMember(connection, corridorId, roomOneId, 0);
                insertCorridorMember(connection, corridorId, roomTwoId, 1);
                insertCorridorDoorOverride(connection, corridorId, roomOneId, roomOneClusterId, 1, 0, "EAST", doorOneId, 0);
                insertCorridorDoorOverride(connection, corridorId, roomTwoId, roomTwoClusterId, -1, 0, "WEST", doorTwoId, 1);
                insertCorridorWaypoint(connection, corridorId, roomOneClusterId, 0, 2, 0, 0);
                insertCorridorWaypoint(connection, corridorId, roomOneClusterId, 2, 0, 0, 1);
                insertCorridorWaypoint(connection, corridorId, roomOneClusterId, 4, 0, 0, 2);
                insertCorridorWaypoint(connection, corridorId, roomOneClusterId, 4, 3, 0, 3);
                insertCorridorWaypoint(connection, corridorId, roomOneClusterId, 5, 3, 0, 4);
                insertCorridorWaypoint(connection, corridorId, roomOneClusterId, 5, 0, 0, 5);
                long anchorTopologyId = 70_000L + corridorId;
                insertCorridorTopologyElement(
                        connection,
                        mapId,
                        anchorTopologyId,
                        corridorId,
                        "CORRIDOR_ANCHOR",
                        "A1",
                        301);
                insertCorridorAnchor(connection, corridorId, 1, corridorId, 6, 5, 0, anchorTopologyId, 0);
                insertCorridorAnchorRef(connection, corridorId, corridorId, anchorTopologyId, 2);
                connection.commit();
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to seed DE-COR-004 crossing split fixture.", exception);
            }
        }

        void seedVerticalFallbackCorridorRouteTarget(long mapId) {
            try (Connection connection = open()) {
                connection.setAutoCommit(false);
                long roomOneId = insertRectangularRoom(connection, mapId, "R1", 0, 1, 1);
                long roomTwoId = insertRectangularRoom(connection, mapId, "R2", 0, 10, 6);
                insertRectangularRoom(connection, mapId, "R_BLOCK", 0, 5, 1);
                markDoorEdge(connection, mapId, roomOneId, 0, 1, 0, "EAST", "D1", 200);
                markDoorEdge(connection, mapId, roomTwoId, 0, -1, 0, "WEST", "D2", 201);
                connection.commit();
            } catch (SQLException exception) {
                throw new IllegalStateException(
                        "Failed to seed horizontal-blocked vertical-fallback corridor fixture.",
                        exception);
            }
        }

        void seedRoomToDoorRouteTarget(long mapId) {
            try (Connection connection = open()) {
                connection.setAutoCommit(false);
                insertRectangularRoom(connection, mapId, "R1", 0, 1, 1);
                long roomTwoId = insertRectangularRoom(connection, mapId, "R2", 0, 8, 1);
                markDoorEdge(connection, mapId, roomTwoId, 0, -1, 0, "WEST", "D2", 201);
                connection.commit();
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to seed F12_ROOM_TO_DOOR_ROUTE_TARGET fixture.", exception);
            }
        }

        void seedBlockedCorridorRouteTarget(long mapId) {
            try (Connection connection = open()) {
                connection.setAutoCommit(false);
                insertRectangularRoom(connection, mapId, "R1", 0, 1, 1);
                insertRectangularRoom(connection, mapId, "R2", 0, -3, 1);
                insertRectangularRoom(connection, mapId, "R3", 0, 5, 1);
                connection.commit();
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to seed blocked corridor route fixture.", exception);
            }
        }

        void seedTwoByTwoRoom(long mapId, String roomName, int level, int anchorX, int anchorY) {
            try (Connection connection = open()) {
                connection.setAutoCommit(false);
                insertTwoByTwoRoom(connection, mapId, roomName, level, anchorX, anchorY);
                connection.commit();
                refreshWindowIndexesForFixture(mapId);
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to seed two-by-two dungeon room fixture.", exception);
            }
        }

        void seedLargeCurrentGeometryRoom(long mapId, int width, int height) {
            try (Connection connection = open()) {
                connection.setAutoCommit(false);
                long clusterId = insertAndReturnId(
                        connection,
                        "INSERT INTO dungeon_room_clusters(dungeon_map_id, name) VALUES(?, ?)",
                        mapId,
                        "Cluster pending");
                nameCluster(connection, clusterId);
                long roomId = insertAndReturnId(
                        connection,
                        "INSERT INTO dungeon_rooms(dungeon_map_id, cluster_id, name, visual_description)"
                                + " VALUES(?, ?, ?, ?)",
                        mapId,
                        clusterId,
                        "Large Per-Cell Room",
                        "");
                insertTopologyElement(connection, mapId, roomId, clusterId, "Large Per-Cell Room");
                insertRoomCells(connection, roomId, 0, 0, 0, width, height);
                insertRectangularPerimeterWalls(connection, mapId, clusterId, 0, 0, 0, width, height);
                connection.commit();
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to seed large current-geometry room fixture.", exception);
            }
        }

        static void insertTwoByTwoRoom(
                Connection connection,
                long mapId,
                String roomName,
                int level,
                int anchorX,
                int anchorY
        ) throws SQLException {
            long clusterId = insertAndReturnId(
                    connection,
                    "INSERT INTO dungeon_room_clusters(dungeon_map_id, name) VALUES(?, ?)",
                    mapId,
                    "Cluster pending");
            nameCluster(connection, clusterId);
            long roomId = insertAndReturnId(
                    connection,
                    "INSERT INTO dungeon_rooms(dungeon_map_id, cluster_id, name, visual_description)"
                            + " VALUES(?, ?, ?, ?)",
                    mapId,
                    clusterId,
                    roomName == null || roomName.isBlank() ? "Fixture room pending" : roomName,
                    "");
            if (roomName == null || roomName.isBlank()) {
                nameRoom(connection, roomId);
            }
            insertTopologyElement(connection, mapId, roomId, clusterId,
                    roomName == null || roomName.isBlank() ? "Raum " + roomId : roomName);
            insertRoomCells(connection, roomId, level, anchorX, anchorY, 2, 2);
            insertTwoByTwoPerimeterWalls(connection, mapId, clusterId, level, anchorX + 1, anchorY + 1);
        }

        static long insertRectangularRoom(
                Connection connection,
                long mapId,
                String roomName,
                int level,
                int anchorX,
                int anchorY
        ) throws SQLException {
            long clusterId = insertAndReturnId(
                    connection,
                    "INSERT INTO dungeon_room_clusters(dungeon_map_id, name) VALUES(?, ?)",
                    mapId,
                    "Cluster pending");
            nameCluster(connection, clusterId);
            long roomId = insertAndReturnId(
                    connection,
                    "INSERT INTO dungeon_rooms(dungeon_map_id, cluster_id, name, visual_description)"
                            + " VALUES(?, ?, ?, ?)",
                    mapId,
                    clusterId,
                    roomName == null || roomName.isBlank() ? "Fixture room pending" : roomName,
                    "");
            if (roomName == null || roomName.isBlank()) {
                nameRoom(connection, roomId);
            }
            insertTopologyElement(connection, mapId, roomId, clusterId,
                    roomName == null || roomName.isBlank() ? "Raum " + roomId : roomName);
            insertRoomCells(connection, roomId, level, anchorX, anchorY, 3, 3);
            insertPerimeterWalls(connection, mapId, clusterId, level, anchorX + 1, anchorY + 1);
            return roomId;
        }

        static long insertClusterRoom(
                Connection connection,
                long mapId,
                long clusterId,
                String roomName,
                int componentX,
                int componentY,
                int level
        ) throws SQLException {
            return insertAndReturnId(
                    connection,
                    "INSERT INTO dungeon_rooms(dungeon_map_id, cluster_id, name, visual_description)"
                            + " VALUES(?, ?, ?, ?)",
                    mapId,
                    clusterId,
                    roomName,
                    "");
        }

        private static void nameCluster(Connection connection, long clusterId) throws SQLException {
            try (PreparedStatement statement = connection.prepareStatement(
                    "UPDATE dungeon_room_clusters SET name=? WHERE cluster_id=?")) {
                bind(statement, "Cluster " + clusterId, clusterId);
                statement.executeUpdate();
            }
        }

        private static void nameRoom(Connection connection, long roomId) throws SQLException {
            try (PreparedStatement statement = connection.prepareStatement(
                    "UPDATE dungeon_rooms SET name=? WHERE room_id=?")) {
                bind(statement, "Raum " + roomId, roomId);
                statement.executeUpdate();
            }
        }

        static void insertComplexClusterWalls(
                Connection connection,
                long mapId,
                long clusterId
        ) throws SQLException {
            int sortOrder = 1;
            for (int relativeX = 0; relativeX <= 2; relativeX++) {
                insertClusterBoundary(connection, mapId, clusterId, 0, 10, 10, relativeX, 0, "NORTH", sortOrder++);
            }
            insertClusterBoundary(connection, mapId, clusterId, 0, 10, 10, 2, 0, "EAST", sortOrder++);
            insertClusterBoundary(connection, mapId, clusterId, 0, 10, 10, 1, 0, "SOUTH", sortOrder++);
            insertClusterBoundary(connection, mapId, clusterId, 0, 10, 10, 2, 0, "SOUTH", sortOrder++);
            insertClusterBoundary(connection, mapId, clusterId, 0, 10, 10, 0, 1, "EAST", sortOrder++);
            insertClusterBoundary(connection, mapId, clusterId, 0, 10, 10, 0, 2, "EAST", sortOrder++);
            insertClusterBoundary(connection, mapId, clusterId, 0, 10, 10, 0, 2, "SOUTH", sortOrder++);
            for (int relativeY = 0; relativeY <= 2; relativeY++) {
                insertClusterBoundary(connection, mapId, clusterId, 0, 10, 10, 0, relativeY, "WEST", sortOrder++);
            }
        }

        static long markDoorEdge(
                Connection connection,
                long mapId,
                long roomId,
                int level,
                int relativeCellX,
                int relativeCellY,
                String direction,
                String label,
                int sortOrder
        ) throws SQLException {
            long clusterId = scalarLong(
                    connection,
                    "SELECT cluster_id FROM dungeon_rooms WHERE room_id=?",
                    roomId);
            long absoluteCellX = scalarLong(
                    connection,
                    "SELECT (MIN(cell_row.cell_x) + MAX(cell_row.cell_x)) / 2 + ?"
                            + " FROM dungeon_room_cells cell_row"
                            + " JOIN dungeon_rooms room_row ON room_row.room_id=cell_row.room_id"
                            + " WHERE room_row.cluster_id=?",
                    relativeCellX,
                    clusterId);
            long absoluteCellY = scalarLong(
                    connection,
                    "SELECT (MIN(cell_row.cell_y) + MAX(cell_row.cell_y)) / 2 + ?"
                            + " FROM dungeon_room_cells cell_row"
                            + " JOIN dungeon_rooms room_row ON room_row.room_id=cell_row.room_id"
                            + " WHERE room_row.cluster_id=?",
                    relativeCellY,
                    clusterId);
            long topologyElementId = scalarLong(
                    connection,
                    "SELECT topology_element_id FROM dungeon_room_cluster_edges"
                            + " WHERE cluster_id=? AND level_z=? AND cell_x=? AND cell_y=? AND edge_direction=?",
                    clusterId,
                    level,
                    absoluteCellX,
                    absoluteCellY,
                    direction);
            try (PreparedStatement statement = connection.prepareStatement(
                    "UPDATE dungeon_room_cluster_edges SET edge_type=?"
                            + " WHERE cluster_id=? AND level_z=? AND cell_x=? AND cell_y=? AND edge_direction=?")) {
                bind(statement, "DOOR", clusterId, level, absoluteCellX, absoluteCellY, direction);
                statement.executeUpdate();
            }
            insertTopologyElement(connection, mapId, topologyElementId, clusterId, "DOOR", label, sortOrder);
            return topologyElementId;
        }

        static void insertCorridorMember(
                Connection connection,
                long corridorId,
                long roomId,
                int sortOrder
        ) throws SQLException {
            try (PreparedStatement statement = connection.prepareStatement(
                    "INSERT INTO dungeon_corridor_members(corridor_id, room_id, member_order) VALUES(?, ?, ?)")) {
                bind(statement, corridorId, roomId, sortOrder);
                statement.executeUpdate();
            }
        }

        static void insertCorridorDoorOverride(
                Connection connection,
                long corridorId,
                long roomId,
                long clusterId,
                int relativeCellX,
                int relativeCellY,
                String direction,
                long topologyElementId,
                int sortOrder
        ) throws SQLException {
            int canonicalRelativeX = relativeCellX + fixtureCenterOffset(connection, clusterId, "cell_x");
            int canonicalRelativeY = relativeCellY + fixtureCenterOffset(connection, clusterId, "cell_y");
            try (PreparedStatement statement = connection.prepareStatement(
                    "INSERT INTO dungeon_corridor_door_overrides("
                            + "corridor_id, room_id, cluster_id, relative_cell_x, relative_cell_y,"
                            + " edge_direction, topology_element_id, sort_order"
                            + ") VALUES(?, ?, ?, ?, ?, ?, ?, ?)")) {
                bind(statement, corridorId, roomId, clusterId, canonicalRelativeX, canonicalRelativeY,
                        direction, topologyElementId, sortOrder);
                statement.executeUpdate();
            }
        }

        static void insertCorridorWaypoint(
                Connection connection,
                long corridorId,
                long clusterId,
                int relativeX,
                int relativeY,
                int relativeZ,
                int sortOrder
        ) throws SQLException {
            int canonicalRelativeX = relativeX + fixtureCenterOffset(connection, clusterId, "cell_x");
            int canonicalRelativeY = relativeY + fixtureCenterOffset(connection, clusterId, "cell_y");
            try (PreparedStatement statement = connection.prepareStatement(
                    "INSERT INTO dungeon_corridor_waypoints("
                            + "corridor_id, sort_order, cluster_id, relative_x, relative_y, relative_z"
                            + ") VALUES(?, ?, ?, ?, ?, ?)")) {
                bind(statement, corridorId, sortOrder, clusterId,
                        canonicalRelativeX, canonicalRelativeY, relativeZ);
                statement.executeUpdate();
            }
        }

        private static int fixtureCenterOffset(
                Connection connection,
                long clusterId,
                String coordinateColumn
        ) throws SQLException {
            if (!"cell_x".equals(coordinateColumn) && !"cell_y".equals(coordinateColumn)) {
                throw new IllegalArgumentException("Unsupported cell coordinate column: " + coordinateColumn);
            }
            return (int) scalarLong(
                    connection,
                    "SELECT (MIN(cell_row." + coordinateColumn + ")"
                            + " + MAX(cell_row." + coordinateColumn + ")) / 2"
                            + " - MIN(cell_row." + coordinateColumn + ")"
                            + " FROM dungeon_room_cells cell_row"
                            + " JOIN dungeon_rooms room_row ON room_row.room_id=cell_row.room_id"
                            + " WHERE room_row.cluster_id=?",
                    clusterId);
        }

        static void insertCorridorAnchor(
                Connection connection,
                long corridorId,
                long anchorId,
                long hostCorridorId,
                int cellX,
                int cellY,
                int cellZ,
                long topologyElementId,
                int sortOrder
        ) throws SQLException {
            try (PreparedStatement statement = connection.prepareStatement(
                    "INSERT INTO dungeon_corridor_anchors("
                            + "corridor_id, anchor_id, host_corridor_id, cell_x, cell_y, cell_z,"
                            + " topology_element_id, sort_order"
                            + ") VALUES(?, ?, ?, ?, ?, ?, ?, ?)")) {
                bind(statement, corridorId, anchorId, hostCorridorId, cellX, cellY, cellZ,
                        topologyElementId, sortOrder);
                statement.executeUpdate();
            }
        }

        static void insertCorridorAnchorRef(
                Connection connection,
                long corridorId,
                long hostCorridorId,
                long topologyElementId,
                int sortOrder
        ) throws SQLException {
            try (PreparedStatement statement = connection.prepareStatement(
                    "INSERT INTO dungeon_corridor_anchor_refs("
                            + "corridor_id, host_corridor_id, topology_element_id, sort_order"
                            + ") VALUES(?, ?, ?, ?)")) {
                bind(statement, corridorId, hostCorridorId, topologyElementId, sortOrder);
                statement.executeUpdate();
            }
        }

        static void insertTwoByTwoPerimeterWalls(
                Connection connection,
                long mapId,
                long clusterId,
                int level,
                int centerX,
                int centerY
        ) throws SQLException {
            int sortOrder = 1;
            for (int relativeX = -1; relativeX <= 0; relativeX++) {
                insertClusterBoundary(connection, mapId, clusterId, level, centerX, centerY, relativeX, -1, "NORTH",
                        sortOrder);
                sortOrder++;
                insertClusterBoundary(connection, mapId, clusterId, level, centerX, centerY, relativeX, 0, "SOUTH",
                        sortOrder);
                sortOrder++;
            }
            for (int relativeY = -1; relativeY <= 0; relativeY++) {
                insertClusterBoundary(connection, mapId, clusterId, level, centerX, centerY, 0, relativeY, "EAST",
                        sortOrder);
                sortOrder++;
                insertClusterBoundary(connection, mapId, clusterId, level, centerX, centerY, -1, relativeY, "WEST",
                        sortOrder);
                sortOrder++;
            }
        }

        static void insertPerimeterWalls(
                Connection connection,
                long mapId,
                long clusterId,
                int level,
                int centerX,
                int centerY
        ) throws SQLException {
            int sortOrder = 1;
            for (int relativeX = -1; relativeX <= 1; relativeX++) {
                insertClusterBoundary(connection, mapId, clusterId, level, centerX, centerY, relativeX, -1, "NORTH",
                        sortOrder);
                sortOrder++;
                insertClusterBoundary(connection, mapId, clusterId, level, centerX, centerY, relativeX, 1, "SOUTH",
                        sortOrder);
                sortOrder++;
            }
            for (int relativeY = -1; relativeY <= 1; relativeY++) {
                insertClusterBoundary(connection, mapId, clusterId, level, centerX, centerY, 1, relativeY, "EAST",
                        sortOrder);
                sortOrder++;
                insertClusterBoundary(connection, mapId, clusterId, level, centerX, centerY, -1, relativeY, "WEST",
                        sortOrder);
                sortOrder++;
            }
        }

        static void insertRectangularPerimeterWalls(
                Connection connection,
                long mapId,
                long clusterId,
                int level,
                int centerX,
                int centerY,
                int width,
                int height
        ) throws SQLException {
            int sortOrder = 1;
            int maxRelativeX = width - 1;
            int maxRelativeY = height - 1;
            for (int relativeX = 0; relativeX < width; relativeX++) {
                insertClusterBoundary(connection, mapId, clusterId, level, centerX, centerY, relativeX, 0, "NORTH",
                        sortOrder);
                sortOrder++;
                insertClusterBoundary(connection, mapId, clusterId, level, centerX, centerY, relativeX, maxRelativeY,
                        "SOUTH", sortOrder);
                sortOrder++;
            }
            for (int relativeY = 0; relativeY < height; relativeY++) {
                insertClusterBoundary(connection, mapId, clusterId, level, centerX, centerY, maxRelativeX, relativeY,
                        "EAST", sortOrder);
                sortOrder++;
                insertClusterBoundary(connection, mapId, clusterId, level, centerX, centerY, 0, relativeY, "WEST",
                        sortOrder);
                sortOrder++;
            }
        }

        static void insertClusterBoundary(
                Connection connection,
                long mapId,
                long clusterId,
                int level,
                int centerX,
                int centerY,
                int relativeX,
                int relativeY,
                String direction,
                int sortOrder
        ) throws SQLException {
            long topologyElementId = wallTopologyElementId(centerX, centerY, level, relativeX, relativeY, direction);
            try (PreparedStatement statement = connection.prepareStatement(
                    "INSERT INTO dungeon_room_cluster_edges("
                            + "dungeon_map_id, cluster_id, level_z, cell_x, cell_y,"
                            + " edge_direction, edge_type, topology_element_id"
                            + ") VALUES(?, ?, ?, ?, ?, ?, ?, ?)")) {
                bind(statement, mapId, clusterId, level, centerX + relativeX, centerY + relativeY,
                        direction, "WALL", topologyElementId);
                statement.executeUpdate();
            }
            insertTopologyElement(connection, mapId, topologyElementId, clusterId, "WALL", "Wall", sortOrder);
        }

        static void insertStairPathNode(
                Connection connection,
                long stairId,
                int sortOrder,
                int cellX,
                int cellY,
                int cellZ
        ) throws SQLException {
            try (PreparedStatement statement = connection.prepareStatement(
                    "INSERT INTO dungeon_stair_path_nodes(stair_id, sort_order, cell_x, cell_y, cell_z)"
                            + " VALUES(?, ?, ?, ?, ?)")) {
                bind(statement, stairId, sortOrder, cellX, cellY, cellZ);
                statement.executeUpdate();
            }
        }

        static void insertStairExit(
                Connection connection,
                long stairId,
                int cellX,
                int cellY,
                int cellZ,
                String label
        ) throws SQLException {
            try (PreparedStatement statement = connection.prepareStatement(
                    "INSERT INTO dungeon_stair_exits(stair_id, cell_x, cell_y, cell_z, label)"
                            + " VALUES(?, ?, ?, ?, ?)")) {
                bind(statement, stairId, cellX, cellY, cellZ, label);
                statement.executeUpdate();
            }
        }

        static long insertTransition(
                Connection connection,
                long mapId,
                String description,
                int cellX,
                int cellY,
                int level
        ) throws SQLException {
            long transitionId = insertTransitionWithAnchor(
                    connection,
                    mapId,
                    description,
                    cellX,
                    cellY,
                    level,
                    "CELL",
                    null);
            return transitionId;
        }

        static long insertTransitionWithAnchor(
                Connection connection,
                long mapId,
                String description,
                Integer cellX,
                Integer cellY,
                Integer level,
                String anchorType,
                String anchorEdgeDirection
        ) throws SQLException {
            return insertTransitionWithAnchor(
                    connection,
                    mapId,
                    description,
                    cellX,
                    cellY,
                    level,
                    anchorType,
                    anchorEdgeDirection,
                    "OVERWORLD_TILE");
        }

        static long insertTransitionWithAnchor(
                Connection connection,
                long mapId,
                String description,
                Integer cellX,
                Integer cellY,
                Integer level,
                String anchorType,
                String anchorEdgeDirection,
                String destinationType
        ) throws SQLException {
            return insertTransitionWithAnchor(
                    connection,
                    mapId,
                    description,
                    cellX,
                    cellY,
                    level,
                    anchorType,
                    anchorEdgeDirection,
                    destinationType,
                    77L,
                    88L,
                    null,
                    null);
        }

        static long insertTransitionWithAnchor(
                Connection connection,
                long mapId,
                String description,
                Integer cellX,
                Integer cellY,
                Integer level,
                String anchorType,
                String anchorEdgeDirection,
                String destinationType,
                Long targetOverworldMapId,
                Long targetOverworldTileId,
                Long targetDungeonMapId,
                Long targetTransitionId
        ) throws SQLException {
            long transitionId;
            try (PreparedStatement statement = connection.prepareStatement(
                    "INSERT INTO dungeon_transitions("
                            + "dungeon_map_id, description, cell_x, cell_y, level_z,"
                            + " anchor_type, anchor_edge_direction,"
                            + " destination_type, target_overworld_map_id, target_overworld_tile_id,"
                            + " target_dungeon_map_id, target_transition_id, linked_transition_id"
                            + ") VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)",
                    Statement.RETURN_GENERATED_KEYS)) {
                statement.setLong(1, mapId);
                statement.setString(2, description);
                setNullableInteger(statement, 3, cellX);
                setNullableInteger(statement, 4, cellY);
                setNullableInteger(statement, 5, level);
                statement.setString(6, anchorType);
                statement.setString(7, anchorEdgeDirection);
                statement.setString(8, destinationType);
                setNullableLong(statement, 9, targetOverworldMapId);
                setNullableLong(statement, 10, targetOverworldTileId);
                setNullableLong(statement, 11, targetDungeonMapId);
                setNullableLong(statement, 12, targetTransitionId);
                statement.executeUpdate();
                try (ResultSet resultSet = statement.getGeneratedKeys()) {
                    if (!resultSet.next()) {
                        throw new SQLException("No generated key for transition insert.");
                    }
                    transitionId = resultSet.getLong(1);
                }
            }
            insertFeatureTopologyElement(connection, mapId, transitionId, "TRANSITION", "Übergang " + transitionId, 500);
            return transitionId;
        }

        private static void setNullableInteger(
                PreparedStatement statement,
                int parameterIndex,
                Integer value
        ) throws SQLException {
            if (value == null) {
                statement.setNull(parameterIndex, java.sql.Types.INTEGER);
                return;
            }
            statement.setInt(parameterIndex, value);
        }

        private static void setNullableLong(
                PreparedStatement statement,
                int parameterIndex,
                Long value
        ) throws SQLException {
            if (value == null) {
                statement.setNull(parameterIndex, java.sql.Types.INTEGER);
                return;
            }
            statement.setLong(parameterIndex, value);
        }

        static void updateLinkedTransition(
                Connection connection,
                long transitionId,
                long linkedTransitionId
        ) throws SQLException {
            try (PreparedStatement statement = connection.prepareStatement(
                    "UPDATE dungeon_transitions SET linked_transition_id=? WHERE transition_id=?")) {
                bind(statement, linkedTransitionId, transitionId);
                statement.executeUpdate();
            }
        }

        static void updateDungeonMapDestination(
                Connection connection,
                long transitionId,
                long targetMapId,
                long targetTransitionId
        ) throws SQLException {
            try (PreparedStatement statement = connection.prepareStatement(
                    "UPDATE dungeon_transitions SET destination_type='DUNGEON_MAP',"
                            + " target_overworld_map_id=NULL, target_overworld_tile_id=NULL,"
                            + " target_dungeon_map_id=?, target_transition_id=?"
                            + " WHERE transition_id=?")) {
                bind(statement, targetMapId, targetTransitionId, transitionId);
                statement.executeUpdate();
            }
        }

        static void insertFeatureTopologyElement(
                Connection connection,
                long mapId,
                long elementId,
                String elementKind,
                String label,
                int sortOrder
        ) throws SQLException {
            try (PreparedStatement statement = connection.prepareStatement(
                    "INSERT OR IGNORE INTO dungeon_topology_elements("
                            + "dungeon_map_id, element_kind, element_id, cluster_id, corridor_id, label, sort_order"
                            + ") VALUES(?, ?, ?, NULL, NULL, ?, ?)")) {
                bind(statement, mapId, elementKind, elementId, label, sortOrder);
                statement.executeUpdate();
            }
        }

        static long wallTopologyElementId(
                int centerX,
                int centerY,
                int level,
                int relativeX,
                int relativeY,
                String direction
        ) {
            Cell absoluteCell = new Cell(centerX + relativeX, centerY + relativeY, level);
            Edge edge = Edge.sideOf(absoluteCell, Direction.parse(direction));
            return DungeonBoundaryKey.from(edge).stableId();
        }

        static void insertTopologyElement(
                Connection connection,
                long mapId,
                long roomId,
                long clusterId,
                String label
        ) throws SQLException {
            try (PreparedStatement statement = connection.prepareStatement(
                    "INSERT INTO dungeon_topology_elements("
                            + "dungeon_map_id, element_kind, element_id, cluster_id, corridor_id, label, sort_order"
                            + ") VALUES(?, ?, ?, ?, NULL, ?, ?)")) {
                bind(statement, mapId, "ROOM", roomId, clusterId, label, roomId);
                statement.executeUpdate();
            }
        }

        static void insertTopologyElement(
                Connection connection,
                long mapId,
                long elementId,
                long clusterId,
                String elementKind,
                String label,
                int sortOrder
        ) throws SQLException {
            try (PreparedStatement statement = connection.prepareStatement(
                    "INSERT OR IGNORE INTO dungeon_topology_elements("
                            + "dungeon_map_id, element_kind, element_id, cluster_id, corridor_id, label, sort_order"
                            + ") VALUES(?, ?, ?, ?, NULL, ?, ?)")) {
                bind(statement, mapId, elementKind, elementId, clusterId, label, sortOrder);
                statement.executeUpdate();
            }
        }

        static void insertCorridorTopologyElement(
                Connection connection,
                long mapId,
                long elementId,
                long corridorId,
                String elementKind,
                String label,
                int sortOrder
        ) throws SQLException {
            try (PreparedStatement statement = connection.prepareStatement(
                    "INSERT OR IGNORE INTO dungeon_topology_elements("
                            + "dungeon_map_id, element_kind, element_id, cluster_id, corridor_id, label, sort_order"
                            + ") VALUES(?, ?, ?, NULL, ?, ?, ?)")) {
                bind(statement, mapId, elementKind, elementId, corridorId, label, sortOrder);
                statement.executeUpdate();
            }
        }

        long count(String sql, String value) {
            try (Connection connection = open();
                 PreparedStatement statement = connection.prepareStatement(sql)) {
                statement.setString(1, value);
                return scalar(statement);
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed DB assertion: " + sql, exception);
            }
        }

        long count(String sql, long firstValue, String secondValue) {
            try (Connection connection = open();
                 PreparedStatement statement = connection.prepareStatement(sql)) {
                statement.setLong(1, firstValue);
                statement.setString(2, secondValue);
                return scalar(statement);
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed DB assertion: " + sql, exception);
            }
        }

        long count(String sql, long value, int cellX, int cellY, String direction, String description) {
            try (Connection connection = open();
                 PreparedStatement statement = connection.prepareStatement(sql)) {
                bind(statement, value, cellX, cellY, direction, description);
                return scalar(statement);
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed DB assertion: " + sql, exception);
            }
        }

        long count(String sql, Object... values) {
            try (Connection connection = open();
                 PreparedStatement statement = connection.prepareStatement(sql)) {
                bind(statement, values);
                return scalar(statement);
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed DB assertion: " + sql, exception);
            }
        }

        long count(String sql, long value) {
            try (Connection connection = open();
                 PreparedStatement statement = connection.prepareStatement(sql)) {
                statement.setLong(1, value);
                return scalar(statement);
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed DB assertion: " + sql, exception);
            }
        }

        static void appendRows(
                Connection connection,
                List<String> state,
                String tableName,
                String sql,
                long mapId
        ) throws SQLException {
            appendRows(connection, state, tableName, sql, new Object[] {Long.valueOf(mapId)});
        }

        static void appendRows(
                Connection connection,
                List<String> state,
                String tableName,
                String sql,
                Object... values
        ) throws SQLException {
            try (PreparedStatement statement = connection.prepareStatement(sql)) {
                bind(statement, values);
                try (ResultSet resultSet = statement.executeQuery()) {
                    ResultSetMetaData metaData = resultSet.getMetaData();
                    int columnCount = metaData.getColumnCount();
                    while (resultSet.next()) {
                        StringBuilder row = new StringBuilder(tableName);
                        for (int column = 1; column <= columnCount; column++) {
                            row.append('|')
                                    .append(metaData.getColumnName(column))
                                    .append('=')
                                    .append(Objects.toString(resultSet.getObject(column), "<null>"));
                        }
                        state.add(row.toString());
                    }
                }
            }
        }

        static long insertAndReturnId(Connection connection, String sql, Object... values) throws SQLException {
            try (PreparedStatement statement = connection.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {
                bind(statement, values);
                statement.executeUpdate();
                try (ResultSet resultSet = statement.getGeneratedKeys()) {
                    if (!resultSet.next()) {
                        throw new SQLException("No generated key for insert: " + sql);
                    }
                    return resultSet.getLong(1);
                }
            }
        }

        private static void insertRoomCells(
                Connection connection,
                long roomId,
                int level,
                int anchorX,
                int anchorY,
                int width,
                int height
        ) throws SQLException {
            try (PreparedStatement statement = connection.prepareStatement(
                    "INSERT INTO dungeon_room_cells(room_id, level_z, cell_x, cell_y) VALUES (?, ?, ?, ?)")) {
                for (int q = anchorX; q < anchorX + width; q++) {
                    for (int r = anchorY; r < anchorY + height; r++) {
                        bind(statement, roomId, level, q, r);
                        statement.executeUpdate();
                    }
                }
            }
        }

        private static void insertRoomCell(
                Connection connection,
                long roomId,
                int level,
                int cellX,
                int cellY
        ) throws SQLException {
            try (PreparedStatement statement = connection.prepareStatement(
                    "INSERT INTO dungeon_room_cells(room_id, level_z, cell_x, cell_y) VALUES(?, ?, ?, ?)")) {
                bind(statement, roomId, level, cellX, cellY);
                statement.executeUpdate();
            }
        }

        static void bind(PreparedStatement statement, Object... values) throws SQLException {
            for (int index = 0; index < values.length; index++) {
                Object value = values[index];
                if (value instanceof Long longValue) {
                    statement.setLong(index + 1, longValue);
                } else if (value instanceof Integer integerValue) {
                    statement.setInt(index + 1, integerValue);
                } else {
                    statement.setString(index + 1, String.valueOf(value));
                }
            }
        }

        Connection open() throws SQLException {
            return DriverManager.getConnection("jdbc:sqlite:" + databasePath);
        }

        static long scalar(PreparedStatement statement) throws SQLException {
            try (ResultSet resultSet = statement.executeQuery()) {
                if (!resultSet.next()) {
                    throw new SQLException("No result row.");
                }
                return resultSet.getLong(1);
            }
        }

        static long scalarLong(Connection connection, String sql, Object... values) throws SQLException {
            try (PreparedStatement statement = connection.prepareStatement(sql)) {
                bind(statement, values);
                return scalar(statement);
            }
        }
    }
}
