package features.dungeon.adapter.sqlite.gateway;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;

import features.dungeon.adapter.sqlite.repository.SqliteDungeonWindowStore;
import features.dungeon.application.authored.DungeonCachedWindowStore;
import features.dungeon.api.DungeonChunkKey;
import features.dungeon.application.authored.command.CorridorChange;
import features.dungeon.application.authored.command.DungeonPatch;
import features.dungeon.application.authored.command.DungeonPatchEntityRef;
import features.dungeon.application.authored.command.DungeonPatchResultFacts;
import features.dungeon.application.authored.command.FeatureMarkerChange;
import features.dungeon.application.authored.command.RoomClusterChange;
import features.dungeon.application.authored.command.RoomRegionChange;
import features.dungeon.application.authored.command.StairChange;
import features.dungeon.application.authored.command.TransitionChange;
import features.dungeon.application.authored.port.DungeonWindow;
import features.dungeon.application.authored.port.DungeonWindowEntityFragment;
import features.dungeon.application.authored.port.DungeonWindowRequest;
import features.dungeon.domain.core.component.CorridorDoorBinding;
import features.dungeon.domain.core.component.CorridorWaypoint;
import features.dungeon.domain.core.component.StairExit;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.Direction;
import features.dungeon.domain.core.graph.DungeonTopologyRef;
import features.dungeon.domain.core.structure.DungeonMapIdentity;
import features.dungeon.domain.core.structure.corridor.Corridor;
import features.dungeon.domain.core.structure.corridor.CorridorBindings;
import features.dungeon.domain.core.structure.feature.FeatureMarker;
import features.dungeon.domain.core.structure.feature.FeatureMarkerKind;
import features.dungeon.domain.core.component.boundary.BoundarySegment;
import features.dungeon.domain.core.structure.room.DungeonRoomNarration;
import features.dungeon.domain.core.structure.room.RoomCluster;
import features.dungeon.domain.core.component.boundary.BoundaryKind;
import features.dungeon.domain.core.structure.room.RoomRegion;
import features.dungeon.domain.core.structure.stair.Stair;
import features.dungeon.domain.core.structure.stair.StairShape;
import features.dungeon.domain.core.structure.transition.Transition;
import features.dungeon.domain.core.structure.transition.TransitionAnchor;
import features.dungeon.domain.core.structure.transition.TransitionDestination;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import platform.diagnostics.NoopDiagnostics;
import platform.persistence.SqliteDatabase;
import platform.persistence.TestFeatureStores;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

final class DungeonCanonicalSpatialIndexTest {

    @Test
    void realPatchUnitOfWorkIndexesCanonicalGeometryInEveryIntersectingChunk(@TempDir Path tempDir)
            throws Exception {
        Path databasePath = tempDir.resolve("spatial-index.db");

        try (SqliteDatabase database = new SqliteDatabase(databasePath, NoopDiagnostics.INSTANCE)) {
            var fixture = DungeonSqliteFixtureSeeder.prepare(database);
            seedAuthoredMap(fixture);

            DungeonCachedWindowStore windows = new DungeonCachedWindowStore(
                    new SqliteDungeonWindowStore(fixture.store()));
            DungeonWindow window = windows.loadWindow(new DungeonWindowRequest(
                    new DungeonMapIdentity(41L),
                    1L,
                    List.of(
                            new DungeonChunkKey(41L, 0, -1, -1),
                            new DungeonChunkKey(41L, 5, -1, -2))))
                    .orElseThrow();
            DungeonWindowEntityFragment.Corridor corridor = assertInstanceOf(
                    DungeonWindowEntityFragment.Corridor.class,
                    window.fragments().stream()
                            .filter(fragment -> fragment.entityRef().equals(DungeonPatchEntityRef.corridor(301L)))
                            .findFirst()
                            .orElseThrow());
            DungeonWindowEntityFragment.CorridorDoorFact door = corridor.doorBindings().getFirst();
            assertEquals(new Cell(-64, -65, 5), door.absoluteCell());
            assertEquals(List.of(
                    new Cell(-64, -64, 0),
                    new Cell(-63, -63, 0)), corridor.waypoints().stream()
                    .map(DungeonWindowEntityFragment.CorridorWaypointFact::absoluteCell)
                    .toList());

            DungeonWindow interiorWindow = windows.loadWindow(
                    new DungeonWindowRequest(
                            new DungeonMapIdentity(41L),
                            2L,
                            List.of(
                                    new DungeonChunkKey(41L, 0, 0, -1),
                                    new DungeonChunkKey(41L, 0, -3, 4))))
                    .orElseThrow();
            DungeonWindowEntityFragment.Corridor interior = assertInstanceOf(
                    DungeonWindowEntityFragment.Corridor.class,
                    interiorWindow.fragments().getFirst());
            assertEquals(DungeonPatchEntityRef.corridor(301L), interior.entityRef());
            assertEquals(List.of(), interior.waypoints());
            assertEquals(List.of(), interior.doorBindings());
            assertEquals(64, interior.routeCells().size());
            assertEquals(new Cell(0, -63, 0), interior.routeCells().getFirst().cell());
            assertEquals(new Cell(63, -63, 0), interior.routeCells().getLast().cell());
        }

        try (Connection connection = open(databasePath)) {
            assertEquals(List.of(
                    "-1|-1|-1|7",
                    "0|-2|-2|7",
                    "0|-1|-1|7",
                    "0|0|-1|7",
                    "0|1|-1|7",
                    "0|2|-1|7",
                    "0|-1|0|7",
                    "0|1|0|7",
                    "0|2|0|7",
                    "1|-1|1|7",
                    "2|2|-3|7",
                    "5|-1|-2|7",
                    "5|-1|-1|7"), rows(connection,
                    "SELECT level_z, chunk_q, chunk_r, content_revision"
                            + " FROM dungeon_chunks ORDER BY level_z, chunk_r, chunk_q"));
            assertEquals(List.of(
                    "CORRIDOR|301|0|-1|-1",
                    "CORRIDOR|301|0|0|-1",
                    "CORRIDOR|301|0|1|-1",
                    "CORRIDOR|301|0|2|-1",
                    "CORRIDOR|301|0|2|0",
                    "CORRIDOR|301|5|-1|-2",
                    "CORRIDOR|301|5|-1|-1",
                    "FEATURE_MARKER|601|0|-1|0",
                    "ROOM|101|0|-2|-2",
                    "ROOM|101|0|1|0",
                    "ROOM|101|5|-1|-2",
                    "ROOM_CLUSTER|201|0|-2|-2",
                    "ROOM_CLUSTER|201|0|1|0",
                    "ROOM_CLUSTER|201|5|-1|-2",
                    "STAIR|401|1|-1|1",
                    "STAIR|401|2|2|-3",
                    "TRANSITION|501|-1|-1|-1"), rows(connection,
                            "SELECT entity_kind, entity_id, level_z, chunk_q, chunk_r FROM"
                                + " dungeon_entity_chunks ORDER BY entity_kind, entity_id, level_z,"
                                + " chunk_r, chunk_q"));
            assertEquals(List.of("13"), rows(connection,
                    "SELECT COUNT(*) FROM dungeon_chunks"));
            assertEquals(List.of("17"), rows(connection,
                    "SELECT COUNT(*) FROM dungeon_entity_chunks"));
            assertEquals(List.of("7"), rows(connection,
                    "SELECT DISTINCT entity_chunk_count FROM dungeon_entity_chunks"
                            + " WHERE entity_kind='CORRIDOR' AND entity_id=301"));
            assertEquals(List.of(
                    "-1|-1|-1|-1|-1",
                    "0|-65|-66|129|63",
                    "1|-1|64|-1|64",
                    "2|128|-129|128|-129",
                    "5|-64|-65|-63|-64"), rows(connection,
                    "SELECT level_z,minimum_q,minimum_r,maximum_q,maximum_r"
                            + " FROM dungeon_authored_level_bounds ORDER BY level_z"));
            assertEquals(List.of("261|261"), rows(connection,
                            "SELECT COUNT(*), COUNT(DISTINCT level_z || '|' || cell_x || '|' ||"
                                + " cell_y) FROM dungeon_corridor_route_cells WHERE"
                                + " dungeon_map_id=41 AND corridor_id=301"));
            assertEquals(List.of("0"), rows(connection,
                    "SELECT COUNT(*) FROM dungeon_corridor_route_cells route"
                            + " LEFT JOIN dungeon_entity_chunks membership"
                            + " ON membership.dungeon_map_id=route.dungeon_map_id"
                            + " AND membership.entity_kind='CORRIDOR'"
                            + " AND membership.entity_id=route.corridor_id"
                            + " AND membership.level_z=route.level_z"
                            + " AND membership.chunk_q=route.chunk_q"
                            + " AND membership.chunk_r=route.chunk_r"
                            + " WHERE membership.entity_id IS NULL"));
        }
    }

    private static void seedAuthoredMap(DungeonSqliteFixtureSeeder.Fixture fixture) {
        long mapId = 41L;
        long roomId = 101L;
        long clusterId = 201L;
        RoomRegion room = new RoomRegion(roomId, mapId, clusterId, "Sparse room", Set.of(
                new Cell(-65, -65, 0), new Cell(64, 0, 0), new Cell(-64, -65, 5)),
                DungeonRoomNarration.empty());
        RoomCluster cluster = RoomCluster.authored(clusterId, mapId, "Sparse cluster", List.of(
                BoundarySegment.fromEdge(
                        Direction.NORTH.edgeOf(new Cell(-65, -65, 0)),
                        BoundaryKind.OPEN,
                        DungeonTopologyRef.empty()),
                BoundarySegment.fromEdge(
                        Direction.SOUTH.edgeOf(new Cell(64, 0, 0)),
                        BoundaryKind.OPEN,
                        DungeonTopologyRef.empty())));
        Corridor corridor = new Corridor(301L, mapId, 0, List.of(roomId), new CorridorBindings(
                List.of(
                        new CorridorWaypoint(clusterId, new Cell(-64, -64, 0)),
                        new CorridorWaypoint(clusterId, new Cell(-63, -63, 0)),
                        new CorridorWaypoint(clusterId, new Cell(129, 0, 0))),
                List.of(new CorridorDoorBinding(
                        roomId, clusterId, new Cell(-64, -65, 5), Direction.EAST, DungeonTopologyRef.door(7002L))),
                List.of(), List.of()));
        Stair stair = new Stair(401L, mapId, "Sparse stair", StairShape.LADDER, Direction.NORTH, 1, 1,
                List.of(new Cell(-1, 64, 1)),
                List.of(new StairExit(402L, new Cell(128, -129, 2), "Exit")), null);
        Transition transition = new Transition(501L, mapId, "Sparse transition",
                TransitionAnchor.cell(new Cell(-1, -1, -1)), TransitionDestination.unlinkedEntrance(), null);
        FeatureMarker marker = new FeatureMarker(601L, new DungeonMapIdentity(mapId), FeatureMarkerKind.OBJECT,
                new Cell(-64, 63, 0), "Sparse marker", "");
        List<features.dungeon.application.authored.command.DungeonPatchChange> changes = List.of(
                new RoomClusterChange(null, cluster, Set.of()),
                new RoomRegionChange(null, room),
                new CorridorChange(null, corridor, Set.of()),
                new StairChange(null, stair),
                new TransitionChange(null, transition),
                new FeatureMarkerChange(null, marker));
        Set<DungeonChunkKey> chunks = Set.of(
                new DungeonChunkKey(mapId, -1, -1, -1),
                new DungeonChunkKey(mapId, 0, -2, -2),
                new DungeonChunkKey(mapId, 0, -1, -1),
                new DungeonChunkKey(mapId, 0, 0, -1),
                new DungeonChunkKey(mapId, 0, 1, -1),
                new DungeonChunkKey(mapId, 0, 2, -1),
                new DungeonChunkKey(mapId, 0, -1, 0),
                new DungeonChunkKey(mapId, 0, 1, 0),
                new DungeonChunkKey(mapId, 0, 2, 0),
                new DungeonChunkKey(mapId, 1, -1, 1),
                new DungeonChunkKey(mapId, 2, 2, -3),
                new DungeonChunkKey(mapId, 5, -1, -2),
                new DungeonChunkKey(mapId, 5, -1, -1));
        fixture.insertHeader(mapId, "Canonical spatial index", 6L);
        DungeonPatch base = DungeonPatch.of(new DungeonMapIdentity(mapId), 6L, changes);
        fixture.commit(new DungeonPatch(
                base.mapId(), base.expectedRevision(), base.changes(), chunks,
                new DungeonPatchResultFacts(base.resultFacts().affectedEntities()), base.encodedBytes()));
    }

    private static Connection open(Path databasePath) throws SQLException {
        return DriverManager.getConnection("jdbc:sqlite:" + databasePath.toAbsolutePath());
    }

    private static List<String> rows(Connection connection, String sql) throws SQLException {
        List<String> result = new ArrayList<>();
        try (Statement statement = connection.createStatement();
             ResultSet resultSet = statement.executeQuery(sql)) {
            int columnCount = resultSet.getMetaData().getColumnCount();
            while (resultSet.next()) {
                StringBuilder row = new StringBuilder();
                for (int column = 1; column <= columnCount; column++) {
                    if (column > 1) {
                        row.append('|');
                    }
                    row.append(resultSet.getObject(column));
                }
                result.add(row.toString());
            }
        }
        return List.copyOf(result);
    }
}
