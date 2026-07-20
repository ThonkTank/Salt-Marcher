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
import features.dungeon.adapter.sqlite.gateway.DungeonSqliteFixtureSeeder;
import features.dungeon.adapter.sqlite.repository.SqliteDungeonCatalogStore;
import features.dungeon.adapter.sqlite.repository.SqliteDungeonIdentityAllocator;
import features.dungeon.adapter.sqlite.repository.SqliteDungeonUnitOfWork;
import features.dungeon.adapter.sqlite.repository.SqliteDungeonWindowStore;
import features.dungeon.application.authored.DungeonCachedWindowStore;
import features.party.adapter.sqlite.model.PartyPersistenceSchema;
import features.dungeon.DungeonTestAssembly;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.Direction;
import features.dungeon.domain.core.geometry.DungeonBoundaryKey;
import features.dungeon.domain.core.geometry.Edge;
import features.dungeon.domain.core.structure.DungeonMapIdentity;
import features.dungeon.domain.core.component.CorridorAnchor;
import features.dungeon.domain.core.component.CorridorAnchorRef;
import features.dungeon.domain.core.component.CorridorDoorBinding;
import features.dungeon.domain.core.component.CorridorWaypoint;
import features.dungeon.domain.core.component.StairExit;
import features.dungeon.domain.core.component.boundary.BoundarySegment;
import features.dungeon.domain.core.graph.DungeonTopologyRef;
import features.dungeon.domain.core.structure.corridor.Corridor;
import features.dungeon.domain.core.structure.corridor.CorridorBindings;
import features.dungeon.domain.core.structure.room.RoomCluster;
import features.dungeon.domain.core.component.boundary.BoundaryKind;
import features.dungeon.domain.core.structure.room.RoomRegion;
import features.dungeon.domain.core.structure.room.DungeonRoomNarration;
import features.dungeon.domain.core.structure.stair.Stair;
import features.dungeon.domain.core.structure.stair.StairShape;
import features.dungeon.domain.core.structure.transition.Transition;
import features.dungeon.domain.core.structure.transition.TransitionAnchor;
import features.dungeon.domain.core.structure.transition.TransitionDestination;
import features.dungeon.application.authored.command.DungeonPatch;
import features.dungeon.application.authored.command.DungeonPatchChange;
import features.dungeon.application.authored.command.DungeonCompoundPatch;
import features.dungeon.application.authored.command.CorridorChange;
import features.dungeon.application.authored.command.RoomClusterChange;
import features.dungeon.application.authored.command.RoomRegionChange;
import features.dungeon.application.authored.command.StairChange;
import features.dungeon.application.authored.command.TransitionChange;
import features.dungeon.application.authored.port.DungeonCatalogStore;
import features.dungeon.application.authored.port.DungeonIdentityAllocator;
import features.dungeon.application.authored.port.DungeonIdentityKind;
import features.dungeon.application.authored.port.DungeonUnitOfWork;
import features.dungeon.application.authored.port.DungeonWindowStore;
import features.dungeon.api.DungeonChunkKey;
import features.party.PartyServiceAssembly;
import features.party.domain.roster.PartyRoster;
import features.party.domain.roster.repository.PartyRosterRepository;
import features.dungeon.application.editor.DungeonEditorRuntimeDependencies;
import features.dungeon.application.editor.DungeonEditorFeatureRuntimeRoot;
import features.dungeon.api.editor.DungeonEditorApi;
import features.dungeon.api.editor.DungeonEditorState;
import platform.persistence.SqliteDatabase;

class DungeonEditorTestPersistence {

    @FunctionalInterface
    interface DatabaseFixtureSeeder {
        void seed(DatabaseAssertions database);
    }








    record RoomClusterIds(long roomId, long clusterId) {
    }

    record TestRuntime(
            DungeonEditorRuntimeDependencies editorDependencies,
            DatabaseAssertions database,
            DungeonEditorApi editorApi
    ) {
        static TestRuntime create() {
            DatabaseAssertions database = new DatabaseAssertions();
            database.clearDungeonData();
            SqliteDatabase sqliteDatabase = new SqliteDatabase(
                    database.databasePath,
                    platform.diagnostics.NoopDiagnostics.INSTANCE);
            SqliteDungeonCatalogStore catalog = new SqliteDungeonCatalogStore(sqliteDatabase);
            DungeonTestAssembly.Component dungeon = createDungeonServices(
                    catalog,
                    new DungeonCachedWindowStore(new SqliteDungeonWindowStore(sqliteDatabase)),
                    new SqliteDungeonUnitOfWork(sqliteDatabase),
                    new SqliteDungeonIdentityAllocator(sqliteDatabase));
            DungeonEditorRuntimeDependencies dependencies =
                    DungeonEditorTestPersistence.editorDependencies(dungeon);
            DungeonEditorApi api = DungeonEditorFeatureRuntimeRoot.create(dependencies);
            return new TestRuntime(
                    dependencies,
                    database,
                    api);
        }
    }

    static DungeonTestAssembly.Component createDungeonServices(
            DungeonCatalogStore catalogStore,
            DungeonWindowStore windowStore,
            DungeonUnitOfWork unitOfWork
    ) {
        PartyServiceAssembly.Component party = PartyServiceAssembly.create(new EmptyPartyRosterRepository());
        return DungeonTestAssembly.create(
                catalogStore,
                windowStore,
                unitOfWork,
                party.activeParty(),
                party.travelPositions(),
                party.application(),
                party.mutation(),
                platform.execution.DirectExecutionLane.INSTANCE,
                platform.ui.DirectUiDispatcher.INSTANCE,
                platform.diagnostics.NoopDiagnostics.INSTANCE);
    }

    static DungeonTestAssembly.Component createDungeonServices(
            DungeonCatalogStore catalogStore,
            DungeonWindowStore windowStore,
            DungeonUnitOfWork unitOfWork,
            DungeonIdentityAllocator identityAllocator
    ) {
        PartyServiceAssembly.Component party = PartyServiceAssembly.create(new EmptyPartyRosterRepository());
        return DungeonTestAssembly.create(
                catalogStore,
                windowStore,
                unitOfWork,
                identityAllocator,
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
            return new SqliteDungeonCatalogStore(sqliteDatabase()).create(mapName).mapId().value();
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

        long countRoomClustersForMap(long mapId) {
            return count("SELECT COUNT(*) FROM dungeon_room_clusters WHERE dungeon_map_id=?", mapId);
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

        long clusterIdByPrimaryCell(long mapId, int primaryX, int primaryY, int level) {
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
                bind(statement, mapId, primaryX, primaryY, level);
                return scalar(statement);
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to find room cluster by primary cell.", exception);
            }
        }

        long countClustersAtPrimaryCell(long mapId, int primaryX, int primaryY, int level) {
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
                    primaryX,
                    primaryY,
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
                                + " waypoint_row.relative_x AS cell_x,"
                                + " waypoint_row.relative_y AS cell_y,"
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
            commitRectangularRooms(mapId, List.of(
                    new RoomSeed("R1", 0, 1, 1, 3, 3),
                    new RoomSeed("R2", 1, 1, 1, 3, 3),
                    new RoomSeed("R3", 2, 1, 1, 3, 3)));
        }

        void seedTransitionDescriptionFixture(long mapId) {
            seedF6MultiLevelFloors(mapId);
            commitTransition(mapId, "Initial transition.", new Cell(5, 2, 0));
        }

        void seedTransitionLinkFixture(long sourceMapId, long targetMapId) {
            commitRectangularRooms(sourceMapId, List.of(
                    new RoomSeed("R1", 0, 1, 1, 3, 3),
                    new RoomSeed("R2", 1, 1, 1, 3, 3),
                    new RoomSeed("R3", 2, 1, 1, 3, 3)));
            commitTransition(sourceMapId, "Source transition.", new Cell(5, 2, 0));
            commitRectangularRooms(targetMapId, List.of(new RoomSeed("R1", 0, 1, 1, 3, 3)));
            long targetTransitionId = reserveTransitionIds(1).getFirst();
            commitTransitions(targetMapId, List.of(transition(
                    targetTransitionId,
                    targetMapId,
                    "Target transition.",
                    new Cell(6, 2, 0)).withDestination(TransitionDestination.overworldTile(77L, 88L))));
        }

        void seedResolvedTransitionLinkFixture(long sourceMapId, long targetMapId) {
            seedTransitionLinkFixture(sourceMapId, targetMapId);
            long sourceTransitionId = transitionIdByDescription(sourceMapId, "Source transition.");
            long targetTransitionId = transitionIdByDescription(targetMapId, "Target transition.");
            Transition sourceBefore = transition(
                    sourceTransitionId,
                    sourceMapId,
                    "Source transition.",
                    new Cell(5, 2, 0));
            Transition targetBefore = transition(
                    targetTransitionId,
                    targetMapId,
                    "Target transition.",
                    new Cell(6, 2, 0)).withDestination(TransitionDestination.overworldTile(77L, 88L));
            Transition sourceAfter = sourceBefore.withDestination(
                    TransitionDestination.dungeonMap(targetMapId, targetTransitionId));
            Transition targetAfter = targetBefore.withLinkedTransitionId(sourceTransitionId);
            DungeonSqliteFixtureSeeder.commit(sqliteDatabase(), DungeonCompoundPatch.of(List.of(
                    DungeonPatch.of(
                            new DungeonMapIdentity(sourceMapId),
                            mapRevision(sourceMapId),
                            List.of(new TransitionChange(sourceBefore, sourceAfter))),
                    DungeonPatch.of(
                            new DungeonMapIdentity(targetMapId),
                            mapRevision(targetMapId),
                            List.of(new TransitionChange(targetBefore, targetAfter))))));
        }

        void seedUnlinkedTransitionFixture(long mapId) {
            commitRectangularRooms(mapId, List.of(
                    new RoomSeed("R1", 0, 1, 1, 3, 3),
                    new RoomSeed("R2", 1, 1, 1, 3, 3),
                    new RoomSeed("R3", 2, 1, 1, 3, 3)));
            commitTransition(mapId, "Unlinked transition.", new Cell(5, 2, 0));
        }

        void seedTransitionAnchorRoundtripFixture(long mapId) {
            commitRectangularRooms(mapId, List.of(new RoomSeed("R1", 0, 1, 1, 3, 3)));
            long targetMapId = createPersistedMap("Transition Anchor Destination Target");
            List<Long> transitionIds = reserveTransitionIds(4);
            commitTransitions(mapId, List.of(
                    new Transition(
                            transitionIds.get(0),
                            mapId,
                            "Cell anchor transition.",
                            TransitionAnchor.cell(new Cell(5, 2, 0)),
                            TransitionDestination.overworldTile(77L, 88L),
                            null),
                    new Transition(
                            transitionIds.get(1),
                            mapId,
                            "Dungeon map destination transition.",
                            TransitionAnchor.cell(new Cell(7, 2, 0)),
                            TransitionDestination.dungeonMap(targetMapId, (Long) null),
                            null),
                    new Transition(
                            transitionIds.get(2),
                            mapId,
                            "None anchor transition.",
                            TransitionAnchor.none(),
                            TransitionDestination.overworldTile(77L, 88L),
                            null),
                    new Transition(
                            transitionIds.get(3),
                            mapId,
                            "Edge anchor transition.",
                            TransitionAnchor.edge(new Cell(6, 2, 0), Direction.EAST),
                            TransitionDestination.overworldTile(77L, 88L),
                            null)));
        }

        void seedMalformedUnknownAnchorFixture(long mapId) {
            seedMalformedTransitionFixture(
                    mapId,
                    "Malformed unknown anchor.",
                    new Cell(1, 1, 0),
                    "UPDATE dungeon_transitions SET anchor_type='PORTAL' WHERE transition_id=?");
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
            seedMalformedTransitionFixture(mapId, description, new Cell(1, 1, 0), corruptionSql);
        }

        private void seedMalformedTransitionFixture(
                long mapId,
                String description,
                Cell anchor,
                String corruptionSql,
                Object... corruptionValues
        ) {
            commitRectangularRooms(mapId, List.of(new RoomSeed("R1", 0, 1, 1, 3, 3)));
            long transitionId = commitTransition(mapId, description, anchor);
            try (Connection connection = open();
                 PreparedStatement statement = connection.prepareStatement(corruptionSql)) {
                Object[] bindings = new Object[corruptionValues.length + 1];
                System.arraycopy(corruptionValues, 0, bindings, 0, corruptionValues.length);
                bindings[corruptionValues.length] = transitionId;
                bind(statement, bindings);
                if (statement.executeUpdate() != 1) {
                    throw new SQLException("Expected exactly one transition row to corrupt.");
                }
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to corrupt indexed transition fixture.", exception);
            }
        }

        void seedMalformedIncompleteEdgeAnchorFixture(long mapId) {
            seedMalformedTransitionFixture(
                    mapId,
                    "Malformed incomplete edge anchor.",
                    new Cell(2, 1, 0),
                    "UPDATE dungeon_transitions"
                            + " SET anchor_type='EDGE', anchor_edge_direction='UP' WHERE transition_id=?");
        }

        void seedMalformedImplicitAnchorWithEdgeDirectionFixture(long mapId) {
            seedMalformedTransitionFixture(
                    mapId,
                    "Malformed implicit anchor edge direction.",
                    new Cell(2, 1, 0),
                    "UPDATE dungeon_transitions"
                            + " SET anchor_type=NULL, anchor_edge_direction='EAST' WHERE transition_id=?");
        }

        void seedMalformedDestinationTypeFixture(long mapId) {
            seedMalformedTransitionFixture(
                    mapId,
                    "Malformed destination.",
                    new Cell(3, 1, 0),
                    "UPDATE dungeon_transitions SET destination_type='PORTAL_TARGET' WHERE transition_id=?");
        }

        void seedMalformedDestinationTargetFixture(long mapId) {
            seedMalformedTransitionFixture(
                    mapId,
                    "Malformed destination target.",
                    new Cell(4, 1, 0),
                    "UPDATE dungeon_transitions"
                            + " SET destination_type='OVERWORLD_TILE',"
                            + " target_overworld_map_id=NULL, target_overworld_tile_id=88"
                            + " WHERE transition_id=?");
        }

        void seedMalformedDungeonMapDestinationIdFixture(long mapId) {
            seedMalformedTransitionFixture(
                    mapId,
                    "Malformed dungeon map destination id.",
                    new Cell(4, 2, 0),
                    "UPDATE dungeon_transitions"
                            + " SET destination_type='DUNGEON_MAP', target_dungeon_map_id=0"
                            + " WHERE transition_id=?");
        }

        void seedMalformedDungeonTransitionDestinationIdFixture(long mapId) {
            long targetMapId = createPersistedMap("Malformed Destination Target Map");
            seedMalformedTransitionFixture(
                    mapId,
                    "Malformed dungeon transition destination id.",
                    new Cell(4, 3, 0),
                    "UPDATE dungeon_transitions"
                            + " SET destination_type='DUNGEON_MAP',"
                            + " target_dungeon_map_id=?, target_transition_id=-1"
                            + " WHERE transition_id=?",
                    targetMapId);
        }

        void seedMalformedOverworldTileDestinationIdFixture(long mapId) {
            seedMalformedTransitionFixture(
                    mapId,
                    "Malformed overworld tile destination id.",
                    new Cell(4, 4, 0),
                    "UPDATE dungeon_transitions"
                            + " SET destination_type='OVERWORLD_TILE',"
                            + " target_overworld_map_id=77, target_overworld_tile_id=0"
                            + " WHERE transition_id=?");
        }

        void seedSelectedLinkedTransitionFixture(long mapId) {
            commitRectangularRooms(mapId, List.of(new RoomSeed("R1", 0, 1, 1, 3, 3)));
            List<Long> transitionIds = reserveTransitionIds(2);
            long selectedId = transitionIds.get(0);
            long linkedId = transitionIds.get(1);
            Transition selectedBefore = transition(
                    selectedId,
                    mapId,
                    "Selected linked transition.",
                    new Cell(5, 2, 0)).withDestination(TransitionDestination.overworldTile(77L, 88L));
            Transition linked = transition(
                    linkedId,
                    mapId,
                    "Selected linked target transition.",
                    new Cell(6, 2, 0)).withDestination(TransitionDestination.overworldTile(77L, 88L));
            commitTransitions(mapId, List.of(selectedBefore, linked));
            commitChanges(mapId, List.of(new TransitionChange(
                    selectedBefore,
                    selectedBefore.withLinkedTransitionId(linkedId))));
        }

        void seedReverseLinkedTransitionFixture(long mapId) {
            commitRectangularRooms(mapId, List.of(new RoomSeed("R1", 0, 1, 1, 3, 3)));
            List<Long> transitionIds = reserveTransitionIds(2);
            long selectedId = transitionIds.get(0);
            long sourceId = transitionIds.get(1);
            Transition selected = transition(
                    selectedId,
                    mapId,
                    "Reverse linked target transition.",
                    new Cell(5, 2, 0)).withDestination(TransitionDestination.overworldTile(77L, 88L));
            Transition sourceBefore = transition(
                    sourceId,
                    mapId,
                    "Reverse linked source transition.",
                    new Cell(6, 2, 0)).withDestination(TransitionDestination.overworldTile(77L, 88L));
            commitTransitions(mapId, List.of(selected, sourceBefore));
            commitChanges(mapId, List.of(new TransitionChange(
                    sourceBefore,
                    sourceBefore.withLinkedTransitionId(selectedId))));
        }

        void seedDestinationReferenceTransitionFixture(long mapId) {
            commitRectangularRooms(mapId, List.of(new RoomSeed("R1", 0, 1, 1, 3, 3)));
            List<Long> transitionIds = reserveTransitionIds(2);
            long selectedId = transitionIds.get(0);
            long sourceId = transitionIds.get(1);
            Transition selected = transition(
                    selectedId,
                    mapId,
                    "Destination target transition.",
                    new Cell(5, 2, 0)).withDestination(TransitionDestination.overworldTile(77L, 88L));
            Transition sourceBefore = transition(
                    sourceId,
                    mapId,
                    "Destination source transition.",
                    new Cell(6, 2, 0));
            commitTransitions(mapId, List.of(selected, sourceBefore));
            commitChanges(mapId, List.of(new TransitionChange(
                    sourceBefore,
                    sourceBefore.withDestination(TransitionDestination.dungeonMap(mapId, selectedId)))));
        }

        void seedF1SingleRoom(long mapId, String roomName, int level, int anchorX, int anchorY) {
            commitRectangularRooms(
                    mapId,
                    List.of(new RoomSeed(roomName, level, anchorX, anchorY, 3, 3)));
        }

        void seedF15ComplexCluster(long mapId) {
            SqliteDungeonIdentityAllocator identities = identityAllocator();
            long clusterId = identities.reserve(DungeonIdentityKind.ROOM_CLUSTER, 1).firstId();
            var roomIds = identities.reserve(DungeonIdentityKind.ROOM, 2);
            Set<Cell> roomOneCells = Set.of(
                    new Cell(10, 10, 0),
                    new Cell(10, 11, 0),
                    new Cell(10, 12, 0));
            Set<Cell> roomTwoCells = Set.of(
                    new Cell(11, 10, 0),
                    new Cell(12, 10, 0));
            RoomCluster cluster = RoomCluster.authored(
                    clusterId,
                    mapId,
                    "Cluster " + clusterId,
                    complexClusterBoundaries());
            commitChanges(mapId, List.of(
                    new RoomClusterChange(null, cluster, Set.of()),
                    new RoomRegionChange(null, new RoomRegion(
                            roomIds.idAt(0), mapId, clusterId, "R1", roomOneCells, DungeonRoomNarration.empty())),
                    new RoomRegionChange(null, new RoomRegion(
                            roomIds.idAt(1), mapId, clusterId, "R2", roomTwoCells, DungeonRoomNarration.empty()))));
        }

        void seedNarrationRoomWithEastExitLink(long mapId) {
            commitRectangularRoomsWithDoors(mapId, List.of(
                    new RoomSeed("R1", 0, 1, 1, 3, 3),
                    new RoomSeed("R2", 0, 4, 1, 3, 3)), List.of(
                    new DoorSeed(0, new Cell(3, 2, 0), Direction.EAST)));
        }

        void seedF4WalledRoomWithDoor(long mapId) {
            seedNarrationRoomWithEastExitLink(mapId);
        }

        void seedF7StairAnchor(long mapId) {
            commitRectangularRooms(mapId, List.of(new RoomSeed("R1", 0, 8, 8, 3, 3)));
            commitStair(mapId, "S1", null, List.of(
                    new Cell(2, 2, 0),
                    new Cell(2, 1, 0),
                    new Cell(2, 0, 0)), new Cell(2, 0, 1));
        }

        void seedF7StairAnchorWithBlockingRoom(long mapId) {
            commitRectangularRooms(mapId, List.of(new RoomSeed("R1", 0, 3, 1, 3, 3)));
            commitStair(mapId, "S1", null, List.of(
                    new Cell(2, 2, 0),
                    new Cell(2, 1, 0),
                    new Cell(2, 0, 0)), new Cell(2, 0, 1));
        }

        void seedCorridorBoundStairAnchor(long mapId) {
            List<SeededRoom> rooms = commitRectangularRooms(
                    mapId,
                    List.of(new RoomSeed("R1", 0, 1, 1, 3, 3)));
            SeededRoom room = rooms.getFirst();
            long corridorId = identityAllocator().reserve(DungeonIdentityKind.CORRIDOR, 1).firstId();
            Corridor corridor = new Corridor(
                    corridorId,
                    mapId,
                    0,
                    List.of(),
                    new CorridorBindings(
                            List.of(new CorridorWaypoint(
                                    room.clusterId(),
                                    absoluteFixtureCell(room, 1, 3, 0))),
                            List.of(),
                            List.of(),
                            List.of()));
            commitChanges(mapId, List.of(new CorridorChange(
                    null,
                    corridor,
                    Set.of(new DungeonChunkKey(mapId, 0, 0, 0)))));
            commitStair(mapId, "S1", corridorId, List.of(
                    new Cell(2, 2, 0),
                    new Cell(2, 2, 1)), new Cell(2, 2, 1));
        }

        void seedGlobalStairIdentitySentinel(long mapId) {
            commitStair(mapId, "Global Stair Sentinel", null, List.of(
                    new Cell(1, 1, 0),
                    new Cell(1, 0, 0),
                    new Cell(1, -1, 0)), new Cell(1, -1, 1));
        }

        void seedGlobalTransitionIdentitySentinel(long mapId) {
            commitTransition(mapId, "Global transition sentinel.", new Cell(1, 1, 0));
        }

        void seedCorridorWithAnchor(long mapId) {
            commitCorridorWithAnchor(mapId, false);
        }

        void seedCorridorSplitRouteTarget(long mapId) {
            commitCorridorWithAnchor(mapId, true);
        }

        void seedVerticalFallbackCorridorRouteTarget(long mapId) {
            commitRectangularRoomsWithDoors(mapId, List.of(
                    new RoomSeed("R1", 0, 1, 1, 3, 3),
                    new RoomSeed("R2", 0, 10, 6, 3, 3),
                    new RoomSeed("R_BLOCK", 0, 5, 1, 3, 3)), List.of(
                    new DoorSeed(0, new Cell(3, 2, 0), Direction.EAST),
                    new DoorSeed(1, new Cell(10, 7, 0), Direction.WEST)));
        }

        void seedRoomToDoorRouteTarget(long mapId) {
            commitRectangularRoomsWithDoors(mapId, List.of(
                    new RoomSeed("R1", 0, 1, 1, 3, 3),
                    new RoomSeed("R2", 0, 8, 1, 3, 3)), List.of(
                    new DoorSeed(1, new Cell(8, 2, 0), Direction.WEST)));
        }

        void seedBlockedCorridorRouteTarget(long mapId) {
            commitRectangularRooms(mapId, List.of(
                    new RoomSeed("R1", 0, 1, 1, 3, 3),
                    new RoomSeed("R2", 0, -3, 1, 3, 3),
                    new RoomSeed("R3", 0, 5, 1, 3, 3)));
        }

        void seedTwoByTwoRoom(long mapId, String roomName, int level, int anchorX, int anchorY) {
            commitRectangularRooms(
                    mapId,
                    List.of(new RoomSeed(roomName, level, anchorX, anchorY, 2, 2)));
        }

        private List<SeededRoom> commitRectangularRooms(long mapId, List<RoomSeed> seeds) {
            return commitRectangularRoomsWithDoors(mapId, seeds, List.of());
        }

        private List<SeededRoom> commitRectangularRoomsWithDoors(
                long mapId,
                List<RoomSeed> seeds,
                List<DoorSeed> doors
        ) {
            SqliteDungeonIdentityAllocator identities = identityAllocator();
            var roomIds = identities.reserve(DungeonIdentityKind.ROOM, seeds.size());
            var clusterIds = identities.reserve(DungeonIdentityKind.ROOM_CLUSTER, seeds.size());
            List<DungeonPatchChange> changes = new ArrayList<>();
            List<SeededRoom> seededRooms = new ArrayList<>();
            for (int index = 0; index < seeds.size(); index++) {
                RoomSeed seed = seeds.get(index);
                long roomId = roomIds.idAt(index);
                long clusterId = clusterIds.idAt(index);
                Set<Cell> cells = rectangleCells(seed);
                Cell center = new Cell(
                        seed.anchorQ() + seed.width() / 2,
                        seed.anchorR() + seed.height() / 2,
                        seed.level());
                RoomCluster cluster = RoomCluster.authored(
                        clusterId,
                        mapId,
                        "Cluster " + clusterId,
                        rectangleBoundaries(cells, doorsForRoom(doors, index)));
                RoomRegion room = new RoomRegion(
                        roomId,
                        mapId,
                        clusterId,
                        seed.name() == null || seed.name().isBlank() ? "Raum " + roomId : seed.name(),
                        cells,
                        DungeonRoomNarration.empty());
                changes.add(new RoomClusterChange(null, cluster, Set.of()));
                changes.add(new RoomRegionChange(null, room));
                seededRooms.add(new SeededRoom(roomId, clusterId, seed, center));
            }
            commitChanges(mapId, changes);
            return List.copyOf(seededRooms);
        }

        private void commitCorridorWithAnchor(long mapId, boolean includeSplitTarget) {
            List<RoomSeed> roomSeeds = new ArrayList<>(List.of(
                    new RoomSeed("R1", 0, 1, 1, 3, 3),
                    new RoomSeed("R2", 0, 8, 1, 3, 3)));
            List<DoorSeed> doors = new ArrayList<>(List.of(
                    new DoorSeed(0, new Cell(3, 2, 0), Direction.EAST),
                    new DoorSeed(1, new Cell(8, 2, 0), Direction.WEST)));
            if (includeSplitTarget) {
                roomSeeds.add(new RoomSeed("R3", 0, 5, 9, 3, 3));
                doors.add(new DoorSeed(2, new Cell(6, 9, 0), Direction.NORTH));
            }
            List<SeededRoom> rooms = commitRectangularRoomsWithDoors(mapId, roomSeeds, doors);
            SeededRoom first = rooms.get(0);
            SeededRoom second = rooms.get(1);
            SqliteDungeonIdentityAllocator identities = identityAllocator();
            long corridorId = identities.reserve(DungeonIdentityKind.CORRIDOR, 1).firstId();
            long anchorId = identities.reserve(DungeonIdentityKind.CORRIDOR_ANCHOR, 1).firstId();
            DungeonTopologyRef firstDoor = doorTopologyRef(new Cell(3, 2, 0), Direction.EAST);
            DungeonTopologyRef secondDoor = doorTopologyRef(new Cell(8, 2, 0), Direction.WEST);
            Corridor corridor = new Corridor(
                    corridorId,
                    mapId,
                    0,
                    List.of(first.roomId(), second.roomId()),
                    new CorridorBindings(
                            List.of(
                                    new CorridorWaypoint(first.clusterId(), absoluteFixtureCell(first, 1, 3, 0)),
                                    new CorridorWaypoint(first.clusterId(), absoluteFixtureCell(first, 3, 1, 0)),
                                    new CorridorWaypoint(first.clusterId(), absoluteFixtureCell(first, 5, 1, 0)),
                                    new CorridorWaypoint(first.clusterId(), absoluteFixtureCell(first, 5, 4, 0)),
                                    new CorridorWaypoint(first.clusterId(), absoluteFixtureCell(first, 6, 4, 0)),
                                    new CorridorWaypoint(first.clusterId(), absoluteFixtureCell(first, 6, 1, 0))),
                            List.of(
                                    new CorridorDoorBinding(
                                            first.roomId(), first.clusterId(), new Cell(3, 2, 0),
                                            Direction.EAST, firstDoor),
                                    new CorridorDoorBinding(
                                            second.roomId(), second.clusterId(), new Cell(8, 2, 0),
                                            Direction.WEST, secondDoor)),
                            List.of(new CorridorAnchor(anchorId, corridorId, new Cell(6, 5, 0))),
                            List.of(new CorridorAnchorRef(corridorId, anchorId))));
            commitChanges(mapId, List.of(new CorridorChange(
                    null,
                    corridor,
                    Set.of(new DungeonChunkKey(mapId, 0, 0, 0)))));
        }

        private void commitStair(
                long mapId,
                String name,
                Long corridorId,
                List<Cell> path,
                Cell upperExit
        ) {
            SqliteDungeonIdentityAllocator identities = identityAllocator();
            long stairId = identities.reserve(DungeonIdentityKind.STAIR, 1).firstId();
            var exitIds = identities.reserve(DungeonIdentityKind.STAIR_EXIT, 2);
            Stair stair = new Stair(
                    stairId,
                    mapId,
                    name,
                    StairShape.STRAIGHT,
                    Direction.NORTH,
                    corridorId == null ? 3 : 1,
                    1,
                    path,
                    List.of(
                            new StairExit(exitIds.idAt(0), path.getFirst(), "Unterer Ausgang"),
                            new StairExit(exitIds.idAt(1), upperExit, "Oberer Ausgang")),
                    corridorId);
            commitChanges(mapId, List.of(new StairChange(null, stair)));
        }

        private void commitChanges(long mapId, List<? extends DungeonPatchChange> changes) {
            long baselineRevision = mapRevision(mapId);
            DungeonSqliteFixtureSeeder.commit(sqliteDatabase(), DungeonPatch.of(
                    new DungeonMapIdentity(mapId),
                    baselineRevision,
                    List.copyOf(changes)));
            normalizeFixtureRevision(mapId, baselineRevision);
        }

        private void normalizeFixtureRevision(long mapId, long baselineRevision) {
            try (Connection connection = open();
                 PreparedStatement map = connection.prepareStatement(
                         "UPDATE dungeon_maps SET revision=? WHERE dungeon_map_id=?");
                 PreparedStatement chunks = connection.prepareStatement(
                         "UPDATE dungeon_chunks SET content_revision=? WHERE dungeon_map_id=?")) {
                bind(map, baselineRevision, mapId);
                map.executeUpdate();
                bind(chunks, baselineRevision, mapId);
                chunks.executeUpdate();
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to normalize authored fixture revision.", exception);
            }
        }

        private SqliteDungeonIdentityAllocator identityAllocator() {
            return new SqliteDungeonIdentityAllocator(sqliteDatabase());
        }

        private long commitTransition(long mapId, String description, Cell anchor) {
            long transitionId = reserveTransitionIds(1).get(0);
            Transition transition = transition(transitionId, mapId, description, anchor);
            commitTransitions(mapId, List.of(transition));
            return transitionId;
        }

        private List<Long> reserveTransitionIds(int count) {
            var range = identityAllocator().reserve(DungeonIdentityKind.TRANSITION, count);
            List<Long> transitionIds = new ArrayList<>(count);
            for (int index = 0; index < count; index++) {
                transitionIds.add(range.idAt(index));
            }
            return List.copyOf(transitionIds);
        }

        private void commitTransitions(long mapId, List<Transition> transitions) {
            List<DungeonPatchChange> changes = transitions.stream()
                    .map(transition -> (DungeonPatchChange) new TransitionChange(null, transition))
                    .toList();
            commitChanges(mapId, changes);
        }

        private static Transition transition(long transitionId, long mapId, String description, Cell anchor) {
            return new Transition(
                    transitionId,
                    mapId,
                    description,
                    TransitionAnchor.cell(anchor),
                    TransitionDestination.unlinkedEntrance(),
                    null);
        }

        private SqliteDatabase sqliteDatabase() {
            return new SqliteDatabase(databasePath, platform.diagnostics.NoopDiagnostics.INSTANCE);
        }

        private static Set<Cell> rectangleCells(RoomSeed seed) {
            Set<Cell> result = new LinkedHashSet<>();
            for (int r = 0; r < seed.height(); r++) {
                for (int q = 0; q < seed.width(); q++) {
                    result.add(new Cell(seed.anchorQ() + q, seed.anchorR() + r, seed.level()));
                }
            }
            return Set.copyOf(result);
        }

        private static List<BoundarySegment> rectangleBoundaries(
                Set<Cell> cells,
                List<DoorSeed> doors
        ) {
            List<BoundarySegment> result = new ArrayList<>();
            for (Cell cell : cells) {
                for (Direction direction : Direction.values()) {
                    if (!cells.contains(direction.neighborOf(cell))) {
                        boolean door = doors.stream().anyMatch(seed ->
                                seed.cell().equals(cell) && seed.direction() == direction);
                        result.add(BoundarySegment.fromEdge(
                                direction.edgeOf(cell),
                                door ? BoundaryKind.DOOR : BoundaryKind.WALL,
                                door ? doorTopologyRef(cell, direction) : DungeonTopologyRef.empty()));
                    }
                }
            }
            return List.copyOf(result);
        }

        private static List<DoorSeed> doorsForRoom(List<DoorSeed> doors, int roomIndex) {
            return doors.stream().filter(door -> door.roomIndex() == roomIndex).toList();
        }

        private static DungeonTopologyRef doorTopologyRef(Cell cell, Direction direction) {
            return DungeonTopologyRef.door(DungeonBoundaryKey.from(Edge.sideOf(cell, direction)).stableId());
        }

        private static List<BoundarySegment> complexClusterBoundaries() {
            List<BoundarySegment> boundaries = new ArrayList<>();
            for (int relativeQ = 0; relativeQ <= 2; relativeQ++) {
                boundaries.add(boundary(relativeQ, 0, Direction.NORTH));
            }
            boundaries.add(boundary(2, 0, Direction.EAST));
            boundaries.add(boundary(1, 0, Direction.SOUTH));
            boundaries.add(boundary(2, 0, Direction.SOUTH));
            boundaries.add(boundary(0, 1, Direction.EAST));
            boundaries.add(boundary(0, 2, Direction.EAST));
            boundaries.add(boundary(0, 2, Direction.SOUTH));
            for (int relativeR = 0; relativeR <= 2; relativeR++) {
                boundaries.add(boundary(0, relativeR, Direction.WEST));
            }
            return List.copyOf(boundaries);
        }

        private static BoundarySegment boundary(
                int relativeQ,
                int relativeR,
                Direction direction
        ) {
            Cell absoluteCell = new Cell(10 + relativeQ, 10 + relativeR, 0);
            return BoundarySegment.fromEdge(
                    direction.edgeOf(absoluteCell),
                    BoundaryKind.WALL,
                    DungeonTopologyRef.empty());
        }

        private record RoomSeed(String name, int level, int anchorQ, int anchorR, int width, int height) {
        }

        private record DoorSeed(int roomIndex, Cell cell, Direction direction) {
        }

        private record SeededRoom(long roomId, long clusterId, RoomSeed seed, Cell center) {
        }

        private static Cell absoluteFixtureCell(
                SeededRoom room,
                int relativeQ,
                int relativeR,
                int level
        ) {
            return new Cell(
                    room.center().q() + relativeQ,
                    room.center().r() + relativeR,
                    level);
        }

        void seedLargeCurrentGeometryRoom(long mapId, int width, int height) {
            commitRectangularRooms(
                    mapId,
                    List.of(new RoomSeed("Large Per-Cell Room", 0, 0, 0, width, height)));
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

    }
}
