package features.world.dungeonmap.application.stair;

import database.DatabaseManager;
import features.world.dungeonmap.application.room.DungeonRoomTopologyService;
import features.world.dungeonmap.application.support.DungeonTransactionRunner;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.CardinalDirection;
import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.structures.stair.DungeonStairExit;
import features.world.dungeonmap.model.structures.stair.StairPathGenerator;
import features.world.dungeonmap.model.structures.stair.StairShape;
import features.world.dungeonmap.persistence.DungeonSchemaSupport;
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
            CardinalDirection direction,
            int dimension1,
            int dimension2,
            List<Integer> exitLevels
    ) throws SQLException {
        requireLayout(layout);
        List<Integer> sortedExitLevels = validateAndSortExitLevels(exitLevels);
        StairShape validatedShape = requireShape(shape);
        CardinalDirection validatedDirection = requireDirection(direction);
        validateDimensions(validatedShape, dimension1, dimension2);
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionRunner.inTransaction(conn, () -> {
                create(
                        conn,
                        layout,
                        anchorCell,
                        validatedShape,
                        validatedDirection,
                        dimension1,
                        dimension2,
                        sortedExitLevels);
                return null;
            });
        }
    }

    public void create(
            Connection conn,
            DungeonLayout layout,
            Point2i anchorCell,
            StairShape shape,
            CardinalDirection direction,
            int dimension1,
            int dimension2,
            List<Integer> exitLevels
    ) throws SQLException {
        requireLayout(layout);
        Objects.requireNonNull(conn, "conn");
        List<Integer> sortedExitLevels = validateAndSortExitLevels(exitLevels);
        StairShape validatedShape = requireShape(shape);
        CardinalDirection validatedDirection = requireDirection(direction);
        validateDimensions(validatedShape, dimension1, dimension2);
        List<CubePoint> pathNodes = StairPathGenerator.generatePath(
                validatedShape,
                anchorCell,
                validatedDirection,
                sortedExitLevels.getFirst(),
                sortedExitLevels.getLast(),
                dimension1,
                dimension2);
        List<DungeonStairExit> exits = buildExits(pathNodes, sortedExitLevels);
        DungeonSchemaSupport.ensureCompatibility(conn);
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
    }

    public void delete(long stairId) throws SQLException {
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionRunner.inTransaction(conn, () -> {
                DungeonSchemaSupport.ensureCompatibility(conn);
                stairWriteRepository.deleteStair(conn, stairId);
                return null;
            });
        }
    }

    private static void requireLayout(DungeonLayout layout) {
        if (layout == null || layout.mapId() <= 0) {
            throw new IllegalArgumentException("Kein aktiver Dungeon geladen");
        }
    }

    private static List<Integer> validateAndSortExitLevels(List<Integer> exitLevels) {
        ArrayList<Integer> result = new ArrayList<>();
        for (Integer level : exitLevels == null ? List.<Integer>of() : exitLevels) {
            if (level != null) {
                result.add(level);
            }
        }
        if (result.size() < 2) {
            throw new IllegalArgumentException("Mindestens zwei verschiedene Ebenen");
        }
        if (result.stream().distinct().count() != result.size()) {
            throw new IllegalArgumentException("Ausgänge dürfen nicht doppelt sein");
        }
        result.sort(Integer::compareTo);
        return List.copyOf(result);
    }

    private static StairShape requireShape(StairShape shape) {
        if (shape == null) {
            throw new IllegalArgumentException("Treppenform fehlt");
        }
        return shape;
    }

    private static CardinalDirection requireDirection(CardinalDirection direction) {
        if (direction == null) {
            throw new IllegalArgumentException("Treppenrichtung fehlt");
        }
        return direction;
    }

    private static void validateDimensions(StairShape shape, int dimension1, int dimension2) {
        String validationMessage = shape.validateDimensions(dimension1, dimension2).orElse(null);
        if (validationMessage != null) {
            throw new IllegalArgumentException(validationMessage);
        }
    }

    private static List<DungeonStairExit> buildExits(List<CubePoint> pathNodes, List<Integer> sortedExitLevels) {
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
                throw new IllegalArgumentException("Treppenpfad deckt Ebene z=" + level + " nicht ab");
            }
            result.add(new DungeonStairExit(0L, exitPoint, "Ebene z=" + level));
        }
        return List.copyOf(result);
    }

    private void ensureTraversableExitCells(Connection conn, long mapId, List<DungeonStairExit> exits) throws SQLException {
        if (exits == null || exits.isEmpty()) {
            throw new IllegalArgumentException("Mindestens zwei Ausgänge erforderlich");
        }
        for (DungeonStairExit exit : exits) {
            roomTopologyService.ensureTraversableCell(conn, mapId, exit.position().projectedCell(), exit.position().z());
        }
    }
}
