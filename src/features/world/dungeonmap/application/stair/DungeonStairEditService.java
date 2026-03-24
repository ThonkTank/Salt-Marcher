package features.world.dungeonmap.application.stair;

import database.DatabaseManager;
import features.world.dungeonmap.application.room.DungeonRoomTopologyService;
import features.world.dungeonmap.application.support.DungeonTransactionRunner;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.structures.stair.DungeonStairExit;
import features.world.dungeonmap.model.structures.stair.StairDirection;
import features.world.dungeonmap.model.structures.stair.StairPathGenerator;
import features.world.dungeonmap.model.structures.stair.StairShape;
import features.world.dungeonmap.persistence.DungeonStairWriteRepository;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

public final class DungeonStairEditService {

    private final DungeonRoomTopologyService roomTopologyService;
    private final DungeonStairWriteRepository stairWriteRepository;

    public DungeonStairEditService(
            DungeonRoomTopologyService roomTopologyService,
            DungeonStairWriteRepository stairWriteRepository
    ) {
        this.roomTopologyService = Objects.requireNonNull(roomTopologyService, "roomTopologyService");
        this.stairWriteRepository = Objects.requireNonNull(stairWriteRepository, "stairWriteRepository");
    }

    public void create(
            DungeonLayout layout,
            Point2i anchorCell,
            StairShape shape,
            StairDirection direction,
            int dimension1,
            int dimension2,
            List<Integer> exitLevels
    ) throws SQLException {
        if (layout == null || layout.mapId() <= 0) {
            throw new SQLException("Kein aktiver Dungeon geladen");
        }
        List<Integer> sortedExitLevels = validateAndSortExitLevels(exitLevels);
        StairShape validatedShape = validateShape(shape, dimension1, dimension2);
        StairDirection validatedDirection = direction == null ? StairDirection.defaultDirection() : direction;
        List<CubePoint> pathNodes = StairPathGenerator.generatePath(
                validatedShape,
                anchorCell,
                validatedDirection,
                sortedExitLevels.getFirst(),
                sortedExitLevels.getLast(),
                dimension1,
                dimension2);
        List<DungeonStairExit> exits = buildExits(pathNodes, sortedExitLevels);
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionRunner.inTransaction(conn, () -> {
                ensureTraversableExitCells(conn, layout.mapId(), exits);
                long stairId = stairWriteRepository.insertStair(
                        conn,
                        layout.mapId(),
                        null,
                        validatedShape,
                        validatedDirection,
                        dimension1,
                        dimension2);
                stairWriteRepository.replacePathNodes(conn, stairId, pathNodes);
                stairWriteRepository.replaceExits(conn, stairId, exits);
                return null;
            });
        }
    }

    public void delete(long stairId) throws SQLException {
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionRunner.inTransaction(conn, () -> {
                stairWriteRepository.deleteStair(conn, stairId);
                return null;
            });
        }
    }

    private static List<Integer> validateAndSortExitLevels(List<Integer> exitLevels) throws SQLException {
        ArrayList<Integer> result = new ArrayList<>();
        for (Integer level : exitLevels == null ? List.<Integer>of() : exitLevels) {
            if (level != null) {
                result.add(level);
            }
        }
        if (result.size() < 2) {
            throw new SQLException("Mindestens zwei verschiedene Ebenen");
        }
        if (result.stream().distinct().count() != result.size()) {
            throw new SQLException("Ausgänge dürfen nicht doppelt sein");
        }
        result.sort(Integer::compareTo);
        return List.copyOf(result);
    }

    private static StairShape validateShape(StairShape shape, int dimension1, int dimension2) throws SQLException {
        StairShape resolvedShape = shape == null ? StairShape.LADDER : shape;
        if (resolvedShape.needsSideLength() && dimension1 <= 0) {
            throw new SQLException("Seitenlänge muss größer als 0 sein");
        }
        if (resolvedShape.needsDimensions() && (dimension1 <= 0 || dimension2 <= 0)) {
            throw new SQLException("Breite und Tiefe müssen größer als 0 sein");
        }
        if (resolvedShape.needsRadius() && dimension1 <= 0) {
            throw new SQLException("Radius muss größer als 0 sein");
        }
        return resolvedShape;
    }

    private static List<DungeonStairExit> buildExits(List<CubePoint> pathNodes, List<Integer> sortedExitLevels) throws SQLException {
        if (pathNodes == null || pathNodes.isEmpty() || sortedExitLevels.isEmpty()) {
            return List.of();
        }
        Map<Integer, CubePoint> pathPointByLevel = new LinkedHashMap<>();
        for (CubePoint node : pathNodes) {
            pathPointByLevel.put(node.z(), node);
        }
        ArrayList<DungeonStairExit> result = new ArrayList<>();
        for (Integer level : sortedExitLevels) {
            CubePoint exitPoint = pathPointByLevel.get(level);
            if (exitPoint == null) {
                throw new SQLException("Treppenpfad deckt Ebene z=" + level + " nicht ab");
            }
            result.add(new DungeonStairExit(0L, exitPoint, "Ebene z=" + level));
        }
        return List.copyOf(result);
    }

    private void ensureTraversableExitCells(Connection conn, long mapId, List<DungeonStairExit> exits) throws SQLException {
        if (exits == null || exits.isEmpty()) {
            throw new SQLException("Mindestens zwei Ausgänge erforderlich");
        }
        for (DungeonStairExit exit : exits) {
            roomTopologyService.ensureTraversableCell(conn, mapId, exit.position().projectedCell(), exit.position().z());
        }
    }
}
