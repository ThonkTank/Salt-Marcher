package features.world.dungeonmap.application.stair;

import database.DatabaseManager;
import features.world.dungeonmap.application.room.DungeonRoomTopologyService;
import features.world.dungeonmap.application.support.DungeonTransactionRunner;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.CardinalDirection;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.structures.stair.DungeonStairExit;
import features.world.dungeonmap.model.structures.stair.StairGeometry;
import features.world.dungeonmap.model.structures.stair.StairShape;
import features.world.dungeonmap.persistence.DungeonSchemaSupport;
import features.world.dungeonmap.persistence.DungeonStairWriteRepository;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
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
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionRunner.inTransaction(conn, () -> {
                create(
                        conn,
                        layout,
                        anchorCell,
                        shape,
                        direction,
                        dimension1,
                        dimension2,
                        exitLevels);
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
        create(conn, layout, anchorCell, shape, direction, dimension1, dimension2, exitLevels, false, null);
    }

    public void createFromCorridorPlanner(
            Connection conn,
            DungeonLayout layout,
            long corridorId,
            Point2i anchorCell,
            StairShape shape,
            CardinalDirection direction,
            int dimension1,
            int dimension2,
            List<Integer> exitLevels
    ) throws SQLException {
        create(conn, layout, anchorCell, shape, direction, dimension1, dimension2, exitLevels,
                true, corridorId);
    }

    public void deleteCorridorStairs(Connection conn, long corridorId) throws SQLException {
        DungeonSchemaSupport.ensureCompatibility(conn);
        stairWriteRepository.deleteByCorridorId(conn, corridorId);
    }

    private void create(
            Connection conn,
            DungeonLayout layout,
            Point2i anchorCell,
            StairShape shape,
            CardinalDirection direction,
            int dimension1,
            int dimension2,
            List<Integer> exitLevels,
            boolean skipTraversabilityCheck,
            Long corridorId
    ) throws SQLException {
        requireLayout(layout);
        Objects.requireNonNull(conn, "conn");
        List<Integer> sortedExitLevels = validateAndSortExitLevels(exitLevels);
        StairShape validatedShape = requireShape(shape);
        CardinalDirection validatedDirection = requireDirection(direction);
        validateDimensions(validatedShape, dimension1, dimension2);
        StairGeometry geometry = StairGeometry.fromExitLevels(
                validatedShape,
                anchorCell,
                validatedDirection,
                dimension1,
                dimension2,
                sortedExitLevels);
        DungeonSchemaSupport.ensureCompatibility(conn);
        if (!skipTraversabilityCheck) {
            ensureTraversableExitCells(conn, layout.mapId(), geometry.exits());
        }
        long stairId = stairWriteRepository.insertStair(
                conn,
                layout.mapId(),
                null,
                validatedShape,
                validatedDirection,
                dimension1,
                dimension2,
                corridorId);
        stairWriteRepository.replacePathNodes(conn, stairId, geometry.pathNodes());
        stairWriteRepository.replaceExits(conn, stairId, geometry.exits());
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

    private void ensureTraversableExitCells(Connection conn, long mapId, List<DungeonStairExit> exits) throws SQLException {
        if (exits == null || exits.isEmpty()) {
            throw new IllegalArgumentException("Mindestens zwei Ausgänge erforderlich");
        }
        for (DungeonStairExit exit : exits) {
            roomTopologyService.ensureTraversableCell(conn, mapId, exit.position().projectedCell(), exit.position().z());
        }
    }
}
