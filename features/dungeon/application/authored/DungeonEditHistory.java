package features.dungeon.application.authored;

import features.dungeon.application.authored.command.DungeonCompoundPatch;
import features.dungeon.application.authored.command.DungeonPatch;
import features.dungeon.domain.core.structure.DungeonMap;
import features.dungeon.domain.core.structure.DungeonMapIdentity;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;
import org.jspecify.annotations.Nullable;

/** Per-running-editor-session authored undo/redo history. */
final class DungeonEditHistory {
    static final int MAXIMUM_COMMANDS = 200;
    static final long MAXIMUM_ENCODED_BYTES = 128L * 1024L * 1024L;

    private final Map<Long, MapHistory> histories = new HashMap<>();
    private final int maximumCommands;
    private final long maximumEncodedBytes;

    DungeonEditHistory() {
        this(MAXIMUM_COMMANDS, MAXIMUM_ENCODED_BYTES);
    }

    DungeonEditHistory(int maximumCommands, long maximumEncodedBytes) {
        if (maximumCommands < 1) {
            throw new IllegalArgumentException("history command limit must be positive");
        }
        if (maximumEncodedBytes < 1L) {
            throw new IllegalArgumentException("history encoded-byte limit must be positive");
        }
        this.maximumCommands = maximumCommands;
        this.maximumEncodedBytes = maximumEncodedBytes;
    }

    void recordPatch(DungeonPatch patch) {
        if (patch != null) {
            recordEntry(new PatchEntry(patch, patch.inverse()));
        }
    }

    void recordCompoundPatch(DungeonCompoundPatch patch) {
        if (patch != null) {
            recordEntry(new CompoundPatchEntry(patch, patch.inverse()));
        }
    }

    Step peekUndo(DungeonMapIdentity mapId) {
        return peek(mapId, true);
    }

    Step peekRedo(DungeonMapIdentity mapId) {
        return peek(mapId, false);
    }

    boolean canUndo(DungeonMapIdentity mapId) {
        return peekUndo(mapId).present();
    }

    boolean canRedo(DungeonMapIdentity mapId) {
        return peekRedo(mapId).present();
    }

    void complete(Step step) {
        if (step == null || !step.present()) {
            return;
        }
        HistoryEntry entry = step.entry();
        for (long mapId : entry.mapIds()) {
            MapHistory history = histories.get(mapId);
            Deque<HistoryEntry> source = step.undo() ? history.undo : history.redo;
            Deque<HistoryEntry> target = step.undo() ? history.redo : history.undo;
            if (source.peekLast() != entry) {
                throw new IllegalStateException("history entry is no longer current for every affected map");
            }
            source.removeLast();
            target.addLast(entry);
        }
        recalculateAll();
    }

    void remove(DungeonMapIdentity mapId) {
        if (mapId == null) {
            return;
        }
        MapHistory history = histories.get(mapId.value());
        if (history == null) {
            return;
        }
        for (HistoryEntry entry : Set.copyOf(history.undo)) {
            removeFromAll(entry, true);
        }
        for (HistoryEntry entry : Set.copyOf(history.redo)) {
            removeFromAll(entry, false);
        }
        histories.remove(mapId.value());
        recalculateAll();
    }

    private Step peek(DungeonMapIdentity mapId, boolean undo) {
        if (mapId == null) {
            return Step.empty();
        }
        MapHistory history = histories.get(mapId.value());
        Deque<HistoryEntry> stack = history == null ? null : undo ? history.undo : history.redo;
        HistoryEntry entry = stack == null ? null : stack.peekLast();
        return entry != null && currentForEveryAffectedMap(entry, undo)
                ? new Step(entry, undo)
                : Step.empty();
    }

    private boolean currentForEveryAffectedMap(HistoryEntry entry, boolean undo) {
        for (long mapId : entry.mapIds()) {
            MapHistory history = histories.get(mapId);
            Deque<HistoryEntry> stack = history == null ? null : undo ? history.undo : history.redo;
            if (stack == null || stack.peekLast() != entry) {
                return false;
            }
        }
        return true;
    }

    private void recordEntry(HistoryEntry entry) {
        for (long mapId : entry.mapIds()) {
            clearRedoForMap(mapId);
        }
        for (long mapId : entry.mapIds()) {
            MapHistory history = histories.computeIfAbsent(mapId, ignored -> new MapHistory());
            history.undo.addLast(entry);
        }
        recalculateAll();
        trimAll();
    }

    private void clearRedoForMap(long mapId) {
        MapHistory history = histories.get(mapId);
        if (history == null) {
            return;
        }
        for (HistoryEntry entry : Set.copyOf(history.redo)) {
            removeFromAll(entry, false);
        }
    }

    private void trimAll() {
        boolean trimmed;
        do {
            trimmed = false;
            for (MapHistory history : histories.values()) {
                if (history.undo.size() > maximumCommands
                        || history.encodedBytes > maximumEncodedBytes) {
                    HistoryEntry oldest = history.undo.peekFirst();
                    if (oldest != null) {
                        removeFromAll(oldest, true);
                        recalculateAll();
                        trimmed = true;
                        break;
                    }
                }
            }
        } while (trimmed);
    }

    private void removeFromAll(HistoryEntry entry, boolean undo) {
        for (long mapId : entry.mapIds()) {
            MapHistory history = histories.get(mapId);
            if (history != null) {
                (undo ? history.undo : history.redo).remove(entry);
            }
        }
    }

    private void recalculateAll() {
        for (MapHistory history : histories.values()) {
            history.encodedBytes = history.undo.stream().mapToLong(HistoryEntry::encodedBytes).sum()
                    + history.redo.stream().mapToLong(HistoryEntry::encodedBytes).sum();
        }
    }

    record Step(@Nullable HistoryEntry entry, boolean undo) {
        static Step empty() {
            return new Step(null, false);
        }

        boolean present() {
            return entry != null;
        }

        Set<Long> mapIds() {
            return entry == null ? Set.of() : entry.mapIds();
        }

        Map<Long, DungeonMap> applyTo(Map<Long, DungeonMap> currentMaps) {
            if (entry == null) {
                return Map.of();
            }
            return entry.applyTo(currentMaps, undo);
        }
    }

    private sealed interface HistoryEntry permits PatchEntry, CompoundPatchEntry {
        Set<Long> mapIds();

        long encodedBytes();

        Map<Long, DungeonMap> applyTo(Map<Long, DungeonMap> currentMaps, boolean undo);
    }

    private record PatchEntry(DungeonPatch forward, DungeonPatch inverse) implements HistoryEntry {
        @Override
        public Set<Long> mapIds() {
            return Set.of(forward.mapId().value());
        }

        @Override
        public long encodedBytes() {
            return forward.encodedBytes() + inverse.encodedBytes();
        }

        @Override
        public Map<Long, DungeonMap> applyTo(Map<Long, DungeonMap> currentMaps, boolean undo) {
            long mapId = forward.mapId().value();
            DungeonMap current = requiredMap(currentMaps, mapId);
            DungeonPatch selected = (undo ? inverse : forward).rebased(current.revision());
            return Map.of(mapId, selected.applyTo(current));
        }
    }

    private record CompoundPatchEntry(DungeonCompoundPatch forward, DungeonCompoundPatch inverse)
            implements HistoryEntry {
        @Override
        public Set<Long> mapIds() {
            Set<Long> result = new LinkedHashSet<>();
            for (DungeonPatch patch : forward.patches()) {
                result.add(patch.mapId().value());
            }
            return Set.copyOf(result);
        }

        @Override
        public long encodedBytes() {
            return forward.encodedBytes() + inverse.encodedBytes();
        }

        @Override
        public Map<Long, DungeonMap> applyTo(Map<Long, DungeonMap> currentMaps, boolean undo) {
            Map<DungeonMapIdentity, Long> revisions = new LinkedHashMap<>();
            for (long mapId : mapIds()) {
                DungeonMap current = requiredMap(currentMaps, mapId);
                revisions.put(current.metadata().mapId(), current.revision());
            }
            DungeonCompoundPatch selected = (undo ? inverse : forward).rebased(revisions);
            return selected.applyTo(currentMaps);
        }
    }

    private static DungeonMap requiredMap(Map<Long, DungeonMap> maps, long mapId) {
        DungeonMap map = maps == null ? null : maps.get(mapId);
        if (map == null) {
            throw new IllegalArgumentException("history step requires every affected map");
        }
        return map;
    }

    private static final class MapHistory {
        private final Deque<HistoryEntry> undo = new ArrayDeque<>();
        private final Deque<HistoryEntry> redo = new ArrayDeque<>();
        private long encodedBytes;
    }
}
