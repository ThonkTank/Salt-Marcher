package features.world.dungeonmap.application.stair;

import database.DatabaseManager;
import features.world.dungeonmap.application.room.DungeonRoomTopologyService;
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

    private final DungeonRoomTopologyService roomTopologyService;
    private final DungeonStairWriteRepository stairWriteRepository;

    public DungeonStairEditService(
            DungeonRoomTopologyService roomTopologyService,
            DungeonStairWriteRepository stairWriteRepository
    ) {
        this.roomTopologyService = Objects.requireNonNull(roomTopologyService, "roomTopologyService");
        this.stairWriteRepository = Objects.requireNonNull(stairWriteRepository, "stairWriteRepository");
    }

    public void create(DungeonLayout layout, Point2i anchorCell, List<Integer> exitLevels) throws SQLException {
        if (layout == null || layout.mapId() <= 0) {
            throw new SQLException("Kein aktiver Dungeon geladen");
        }
        List<Integer> sortedExitLevels = validateAndSortExitLevels(exitLevels);
        List<CubePoint> pathNodes = buildVerticalPath(anchorCell, sortedExitLevels);
        List<DungeonStairExit> exits = buildExits(anchorCell, sortedExitLevels);
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionRunner.inTransaction(conn, () -> {
                ensureTraversableExitCells(conn, layout.mapId(), anchorCell, sortedExitLevels);
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

    private void ensureTraversableExitCells(Connection conn, long mapId, Point2i anchorCell, List<Integer> exitLevels) throws SQLException {
        if (anchorCell == null) {
            throw new SQLException("Kein Zielfeld gewählt");
        }
        for (Integer level : exitLevels) {
            roomTopologyService.ensureTraversableCell(conn, mapId, anchorCell, level);
        }
    }
}
