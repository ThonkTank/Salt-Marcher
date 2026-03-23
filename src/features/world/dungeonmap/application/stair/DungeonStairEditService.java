package features.world.dungeonmap.application.stair;

import database.DatabaseManager;
import features.world.dungeonmap.application.support.DungeonTransactionRunner;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.structures.stair.DungeonStairExit;
import features.world.dungeonmap.persistence.DungeonStairWriteRepository;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

public final class DungeonStairEditService {

    private final DungeonStairWriteRepository stairWriteRepository;

    public DungeonStairEditService(DungeonStairWriteRepository stairWriteRepository) {
        this.stairWriteRepository = Objects.requireNonNull(stairWriteRepository, "stairWriteRepository");
    }

    public void create(DungeonLayout layout, Point2i anchorCell, List<Integer> exitLevels) throws SQLException {
        if (layout == null || layout.mapId() <= 0) {
            throw new SQLException("Kein aktiver Dungeon geladen");
        }
        List<Integer> normalizedExitLevels = normalizeExitLevels(exitLevels);
        validate(layout, anchorCell, normalizedExitLevels);
        List<Integer> sortedExitLevels = sortedDistinctLevels(normalizedExitLevels);
        List<CubePoint> pathNodes = buildVerticalPath(anchorCell, sortedExitLevels);
        List<DungeonStairExit> exits = buildExits(anchorCell, sortedExitLevels);
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionRunner.inTransaction(conn, () -> {
                long stairId = stairWriteRepository.insertStair(conn, layout.mapId(), null);
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

    private static List<Integer> normalizeExitLevels(List<Integer> exitLevels) {
        ArrayList<Integer> result = new ArrayList<>();
        for (Integer level : exitLevels == null ? List.<Integer>of() : exitLevels) {
            if (level != null) {
                result.add(level);
            }
        }
        return List.copyOf(result);
    }

    private static List<Integer> sortedDistinctLevels(List<Integer> exitLevels) {
        return exitLevels.stream()
                .distinct()
                .sorted()
                .toList();
    }

    private static List<CubePoint> buildVerticalPath(Point2i anchorCell, List<Integer> sortedExitLevels) {
        if (anchorCell == null || sortedExitLevels.isEmpty()) {
            return List.of();
        }
        ArrayList<CubePoint> result = new ArrayList<>();
        for (int level = sortedExitLevels.getFirst(); level <= sortedExitLevels.getLast(); level++) {
            result.add(CubePoint.at(anchorCell, level));
        }
        return List.copyOf(result);
    }

    private static void validate(
            DungeonLayout layout,
            Point2i anchorCell,
            List<Integer> normalizedExitLevels
    ) throws SQLException {
        if (layout == null || layout.mapId() <= 0) {
            throw new SQLException("Kein aktiver Dungeon geladen");
        }
        if (normalizedExitLevels.stream().distinct().count() != normalizedExitLevels.size()) {
            throw new SQLException("Ausgänge dürfen nicht doppelt sein");
        }
        if (normalizedExitLevels.size() < 2) {
            throw new SQLException("Mindestens zwei verschiedene Ebenen");
        }
        if (anchorCell == null) {
            return;
        }
        for (Integer level : sortedDistinctLevels(normalizedExitLevels)) {
            CubePoint exitPoint = CubePoint.at(anchorCell, level);
            if (!layout.isTraversableCell(exitPoint)) {
                throw new SQLException("Ausgang auf Ebene z=" + level + " liegt nicht auf einem begehbaren Feld");
            }
        }
    }

    private static List<DungeonStairExit> buildExits(Point2i anchorCell, List<Integer> sortedExitLevels) {
        if (anchorCell == null || sortedExitLevels.isEmpty()) {
            return List.of();
        }
        ArrayList<DungeonStairExit> result = new ArrayList<>();
        for (Integer level : sortedExitLevels) {
            CubePoint exitPoint = CubePoint.at(anchorCell, level);
            result.add(new DungeonStairExit(0L, exitPoint, "Ebene z=" + level));
        }
        return List.copyOf(result);
    }
}
