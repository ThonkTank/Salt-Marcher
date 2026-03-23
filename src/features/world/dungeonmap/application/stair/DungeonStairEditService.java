package features.world.dungeonmap.application.stair;

import database.DatabaseManager;
import features.world.dungeonmap.application.support.DungeonTransactionRunner;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.structures.stair.DungeonStairExit;
import features.world.dungeonmap.persistence.DungeonStairWriteRepository;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

public final class DungeonStairEditService {

    private final DungeonStairWriteRepository stairWriteRepository;

    public DungeonStairEditService(DungeonStairWriteRepository stairWriteRepository) {
        this.stairWriteRepository = Objects.requireNonNull(stairWriteRepository, "stairWriteRepository");
    }

    public void create(DungeonLayout layout, List<CubePoint> draftNodes) throws SQLException {
        if (layout == null || layout.mapId() <= 0) {
            throw new SQLException("Kein aktiver Dungeon geladen");
        }
        List<CubePoint> normalizedDraft = normalizeDraft(draftNodes);
        if (normalizedDraft.size() < 2) {
            throw new SQLException("Eine Treppe braucht mindestens zwei Punkte");
        }
        List<CubePoint> pathNodes = expandPath(normalizedDraft);
        validate(layout, pathNodes);
        List<DungeonStairExit> exits = buildExits(pathNodes);
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

    public List<CubePoint> expandedPath(List<CubePoint> draftNodes) {
        return expandPath(normalizeDraft(draftNodes));
    }

    public String validationMessage(DungeonLayout layout, List<CubePoint> draftNodes) {
        try {
            List<CubePoint> normalizedDraft = normalizeDraft(draftNodes);
            if (normalizedDraft.isEmpty()) {
                return "Knoten auf der Karte setzen";
            }
            if (normalizedDraft.size() < 2) {
                return "Mindestens zwei Punkte setzen";
            }
            List<CubePoint> pathNodes = expandPath(normalizedDraft);
            validate(layout, pathNodes);
            return null;
        } catch (SQLException ex) {
            return ex.getMessage();
        }
    }

    private static List<CubePoint> normalizeDraft(List<CubePoint> draftNodes) {
        ArrayList<CubePoint> result = new ArrayList<>();
        CubePoint previous = null;
        for (CubePoint node : draftNodes == null ? List.<CubePoint>of() : draftNodes) {
            if (node == null || Objects.equals(previous, node)) {
                continue;
            }
            result.add(node);
            previous = node;
        }
        return List.copyOf(result);
    }

    private static List<CubePoint> expandPath(List<CubePoint> draftNodes) {
        if (draftNodes.isEmpty()) {
            return List.of();
        }
        ArrayList<CubePoint> result = new ArrayList<>();
        result.add(draftNodes.getFirst());
        for (int index = 1; index < draftNodes.size(); index++) {
            appendSegment(result, draftNodes.get(index - 1), draftNodes.get(index));
        }
        return List.copyOf(result);
    }

    private static void appendSegment(List<CubePoint> result, CubePoint from, CubePoint to) {
        CubePoint current = from;
        current = appendAxis(result, current, to.x() - current.x(), Axis.X);
        current = appendAxis(result, current, to.y() - current.y(), Axis.Y);
        appendAxis(result, current, to.z() - current.z(), Axis.Z);
    }

    private static CubePoint appendAxis(List<CubePoint> result, CubePoint current, int delta, Axis axis) {
        if (delta == 0) {
            return current;
        }
        int step = delta > 0 ? 1 : -1;
        CubePoint cursor = current;
        for (int value = 0; value != delta; value += step) {
            cursor = switch (axis) {
                case X -> new CubePoint(cursor.x() + step, cursor.y(), cursor.z());
                case Y -> new CubePoint(cursor.x(), cursor.y() + step, cursor.z());
                case Z -> new CubePoint(cursor.x(), cursor.y(), cursor.z() + step);
            };
            result.add(cursor);
        }
        return cursor;
    }

    private static void validate(DungeonLayout layout, List<CubePoint> pathNodes) throws SQLException {
        if (layout == null || layout.mapId() <= 0) {
            throw new SQLException("Kein aktiver Dungeon geladen");
        }
        if (pathNodes.size() < 2) {
            throw new SQLException("Eine Treppe braucht mindestens zwei Punkte");
        }
        Set<Integer> levels = new LinkedHashSet<>();
        for (CubePoint node : pathNodes) {
            levels.add(node.z());
        }
        if (levels.size() < 2) {
            throw new SQLException("Die Treppe muss mindestens zwei Ebenen verbinden");
        }
        if (!layout.isTraversableCell(pathNodes.getFirst())) {
            throw new SQLException("Der Startpunkt muss auf einem begehbaren Feld liegen");
        }
        if (!layout.isTraversableCell(pathNodes.getLast())) {
            throw new SQLException("Der Endpunkt muss auf einem begehbaren Feld liegen");
        }
    }

    private static List<DungeonStairExit> buildExits(List<CubePoint> pathNodes) {
        CubePoint start = pathNodes.getFirst();
        CubePoint end = pathNodes.getLast();
        if (Objects.equals(start, end)) {
            return List.of(new DungeonStairExit(0L, start, "Ebene z=" + start.z()));
        }
        return List.of(
                new DungeonStairExit(0L, start, "Ebene z=" + start.z()),
                new DungeonStairExit(0L, end, "Ebene z=" + end.z()));
    }

    private enum Axis {
        X,
        Y,
        Z
    }
}
