package features.dungeon.application.authored;

import features.dungeon.domain.core.structure.DungeonMap;
import features.dungeon.domain.core.structure.DungeonMapIdentity;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.HashMap;
import java.util.Map;

/** Per-running-editor-session authored undo/redo history. */
final class DungeonEditHistory {
    static final int MAXIMUM_COMMANDS = 200;
    static final long MAXIMUM_ESTIMATED_BYTES = 128L * 1024L * 1024L;

    private final Map<Long, MapHistory> histories = new HashMap<>();

    void record(DungeonMap before, DungeonMap after) {
        if (before == null || after == null || before.equals(after)) {
            return;
        }
        long mapId = after.metadata().mapId().value();
        MapHistory history = histories.computeIfAbsent(mapId, ignored -> new MapHistory());
        history.redo.clear();
        history.undo.addLast(new Change(before, after, estimatedBytes(before, after)));
        history.recalculateBytes();
        history.trim();
    }

    DungeonMap undo(DungeonMap current) {
        MapHistory history = history(current);
        if (history == null || history.undo.isEmpty()) {
            return current;
        }
        Change change = history.undo.removeLast();
        history.redo.addLast(change);
        history.recalculateBytes();
        return change.before();
    }

    DungeonMap redo(DungeonMap current) {
        MapHistory history = history(current);
        if (history == null || history.redo.isEmpty()) {
            return current;
        }
        Change change = history.redo.removeLast();
        history.undo.addLast(change);
        history.recalculateBytes();
        return change.after();
    }

    boolean canUndo(DungeonMapIdentity mapId) {
        MapHistory history = mapId == null ? null : histories.get(mapId.value());
        return history != null && !history.undo.isEmpty();
    }

    boolean canRedo(DungeonMapIdentity mapId) {
        MapHistory history = mapId == null ? null : histories.get(mapId.value());
        return history != null && !history.redo.isEmpty();
    }

    void remove(DungeonMapIdentity mapId) {
        if (mapId != null) {
            histories.remove(mapId.value());
        }
    }

    private MapHistory history(DungeonMap current) {
        return current == null ? null : histories.get(current.metadata().mapId().value());
    }

    private static long estimatedBytes(DungeonMap before, DungeonMap after) {
        return estimateMap(before) + estimateMap(after);
    }

    private static long estimateMap(DungeonMap map) {
        long structuralObjects = 1L
                + map.rooms().rooms().size()
                + map.corridors().size()
                + map.stairs().stairs().size()
                + map.transitionCatalog().transitions().size()
                + map.featureMarkers().markers().size();
        return Math.max(4_096L, structuralObjects * 512L);
    }

    private record Change(DungeonMap before, DungeonMap after, long estimatedBytes) {
    }

    private static final class MapHistory {
        private final Deque<Change> undo = new ArrayDeque<>();
        private final Deque<Change> redo = new ArrayDeque<>();
        private long estimatedBytes;

        private void recalculateBytes() {
            estimatedBytes = undo.stream().mapToLong(Change::estimatedBytes).sum()
                    + redo.stream().mapToLong(Change::estimatedBytes).sum();
        }

        private void trim() {
            while (undo.size() > MAXIMUM_COMMANDS || estimatedBytes > MAXIMUM_ESTIMATED_BYTES) {
                Change removed = undo.removeFirst();
                estimatedBytes -= removed.estimatedBytes();
            }
        }
    }
}
