package src.domain.dungeon.model.core.structure.room;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.Direction;
import src.domain.dungeon.model.core.geometry.EdgeKey;
import src.domain.dungeon.model.core.structure.room.RoomClusterBoundaryMaterialization.BoundaryKind;
import src.domain.dungeon.model.core.structure.room.RoomClusterBoundaryMaterialization.BoundaryRow;
import src.domain.dungeon.model.core.structure.room.RoomClusterWallMap.WallRun;

final class RoomClusterWallRuns {
    private static final int MINIMUM_WALL_RUN_LENGTH = 2;

    private RoomClusterWallRuns() {
    }

    static List<WallRun> authoredWallRuns(
            Map<EdgeKey, BoundaryRow> rowsByKey,
            int level
    ) {
        Map<RunKey, List<WallSegment>> segmentsByRunLine = new LinkedHashMap<>();
        for (WallSegment segment : wallSegments(rowsByKey, level)) {
            segmentsByRunLine.computeIfAbsent(segment.runKey(), ignored -> new ArrayList<>()).add(segment);
        }
        List<WallRun> result = new ArrayList<>();
        for (List<WallSegment> runLine : segmentsByRunLine.values()) {
            appendRunLine(result, runLine);
        }
        return List.copyOf(result);
    }

    private static void appendRunLine(List<WallRun> result, List<WallSegment> runLine) {
        runLine.sort(Comparator.comparingInt(WallSegment::start));
        int start = runLine.getFirst().start();
        int end = runLine.getFirst().end();
        RunKey key = runLine.getFirst().runKey();
        for (int segmentIndex = 1; segmentIndex < runLine.size(); segmentIndex++) {
            WallSegment segment = runLine.get(segmentIndex);
            if (segment.start() == end) {
                end = segment.end();
                continue;
            }
            addWallRun(result, key, start, end);
            start = segment.start();
            end = segment.end();
        }
        addWallRun(result, key, start, end);
    }

    private static List<WallSegment> wallSegments(
            Map<EdgeKey, BoundaryRow> rowsByKey,
            int level
    ) {
        List<WallSegment> result = new ArrayList<>();
        for (Map.Entry<EdgeKey, BoundaryRow> entry : rowsByKey.entrySet()) {
            WallSegment segment = wallSegment(level, entry.getKey(), entry.getValue());
            if (segment != null) {
                result.add(segment);
            }
        }
        result.sort(WallSegment.ORDERING);
        return List.copyOf(result);
    }

    private static @Nullable WallSegment wallSegment(
            int level,
            EdgeKey key,
            BoundaryRow row
    ) {
        if (excluded(level, key, row)) {
            return null;
        }
        Cell lower = key.lower();
        Cell upper = key.upper();
        if (differentLevel(lower, upper)) {
            return null;
        }
        if (lower.r() == upper.r()) {
            return new WallSegment(
                    new RunKey(level, true, lower.r(), row.direction()),
                    Math.min(lower.q(), upper.q()),
                    Math.max(lower.q(), upper.q()));
        }
        if (lower.q() == upper.q()) {
            return new WallSegment(
                    new RunKey(level, false, lower.q(), row.direction()),
                    Math.min(lower.r(), upper.r()),
                    Math.max(lower.r(), upper.r()));
        }
        return null;
    }

    private static boolean excluded(int level, EdgeKey key, BoundaryRow row) {
        return key == null || row == null || row.level() != level || row.kind() != BoundaryKind.WALL;
    }

    private static boolean differentLevel(Cell lower, Cell upper) {
        return lower == null || upper == null || lower.level() != upper.level();
    }

    private static Cell wallRunAnchorCell(RunKey key, int start, int end) {
        int midpoint = (int) Math.floor(wallRunMidpointCoordinate(start, end));
        return key.horizontal()
                ? new Cell(midpoint, key.fixed(), key.level())
                : new Cell(key.fixed(), midpoint, key.level());
    }

    private static double wallRunMidpointCoordinate(int start, int end) {
        return (start + end) / 2.0;
    }

    private static void addWallRun(List<WallRun> result, RunKey key, int start, int end) {
        if (end - start >= MINIMUM_WALL_RUN_LENGTH) {
            double variableMidpoint = wallRunMidpointCoordinate(start, end);
            double midpointQ = key.horizontal() ? variableMidpoint : key.fixed();
            double midpointR = key.horizontal() ? key.fixed() : variableMidpoint;
            result.add(new WallRun(
                    wallRunAnchorCell(key, start, end),
                    midpointQ,
                    midpointR,
                    key.direction()));
        }
    }

    private record RunKey(int level, boolean horizontal, int fixed, Direction direction) {
        private static final Comparator<RunKey> ORDERING = Comparator
                .comparingInt(RunKey::level)
                .thenComparing(key -> !key.horizontal())
                .thenComparingInt(RunKey::fixed)
                .thenComparing(RunKey::direction);
    }

    private record WallSegment(RunKey runKey, int start, int end) {
        private static final Comparator<WallSegment> ORDERING = Comparator
                .comparing(WallSegment::runKey, RunKey.ORDERING)
                .thenComparingInt(WallSegment::start);
    }
}
