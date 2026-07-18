package features.dungeon.application.authored.command;

import features.dungeon.api.editor.DungeonEditorCommandOutcome;
import features.dungeon.domain.core.structure.DungeonMap;
import features.dungeon.domain.core.structure.DungeonMapAuthoring;
import features.dungeon.domain.core.structure.corridor.Corridor;
import features.dungeon.domain.core.structure.stair.Stair;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.UnaryOperator;

/** Converts one aggregate-owned corridor operation into exact room, corridor, and stair changes. */
final class CorridorPatchPlanner {
    private CorridorPatchPlanner() {
    }

    static DungeonCommandResult plan(
            DungeonMap current,
            UnaryOperator<DungeonMap> operation,
            DungeonEditorCommandOutcome.RejectionReason noEffectReason
    ) {
        DungeonMap after = operation.apply(current);
        if (after == null || after.equals(current)) {
            return new DungeonCommandResult.Rejected(noEffectReason);
        }
        List<DungeonPatchChange> changes = new ArrayList<>(RoomGeometryPatchPlanner.changes(current, after));
        changes.addAll(corridorChanges(current, after));
        changes.addAll(stairChanges(current, after));
        if (changes.isEmpty()) {
            throw new IllegalStateException("corridor operation changed unencoded authored truth");
        }
        DungeonPatch patch = DungeonPatch.of(current.metadata().mapId(), current.revision(), changes);
        DungeonMap patched = patch.applyTo(current);
        DungeonMap expected = DungeonMapAuthoring.committedContent(after, patch.committedRevision());
        if (!patched.equals(expected)) {
            throw new IllegalStateException(
                    "corridor patch must reproduce the exact aggregate result; mismatches="
                            + mismatches(patched, expected));
        }
        return DungeonCommandResult.Accepted.from(patch);
    }

    private static List<String> mismatches(DungeonMap patched, DungeonMap expected) {
        List<String> result = new ArrayList<>();
        addMismatch(result, "metadata", patched.metadata(), expected.metadata());
        addMismatch(result, "topology", patched.topology(), expected.topology());
        addMismatch(result, "topologyIndex", patched.topologyIndex(), expected.topologyIndex());
        addMismatch(result, "rooms", patched.rooms(), expected.rooms());
        addMismatch(result, "corridors", patched.corridors(), expected.corridors());
        addMismatch(result, "stairs", patched.stairs(), expected.stairs());
        addMismatch(result, "transitions", patched.transitionCatalog(), expected.transitionCatalog());
        addMismatch(result, "featureMarkers", patched.featureMarkers(), expected.featureMarkers());
        addMismatch(result, "revision", patched.revision(), expected.revision());
        return List.copyOf(result);
    }

    private static void addMismatch(List<String> result, String field, Object patched, Object expected) {
        if (!Objects.equals(patched, expected)) {
            result.add(field);
        }
    }

    private static List<DungeonPatchChange> corridorChanges(DungeonMap before, DungeonMap after) {
        Map<Long, Corridor> remaining = corridorsById(after.corridors());
        List<DungeonPatchChange> result = new ArrayList<>();
        for (Corridor corridor : before.corridors()) {
            Corridor next = remaining.remove(corridor.corridorId());
            if (!corridor.equals(next)) {
                result.add(new CorridorChange(
                        corridor,
                        next,
                        CorridorPatchChunks.touchedChunks(before, after, corridor.corridorId())));
            }
        }
        for (Corridor corridor : after.corridors()) {
            if (remaining.containsKey(corridor.corridorId())) {
                result.add(new CorridorChange(
                        null,
                        corridor,
                        CorridorPatchChunks.touchedChunks(before, after, corridor.corridorId())));
            }
        }
        return List.copyOf(result);
    }

    private static List<DungeonPatchChange> stairChanges(DungeonMap before, DungeonMap after) {
        Map<Long, Stair> remaining = stairsById(after.stairs().stairs());
        List<DungeonPatchChange> result = new ArrayList<>();
        for (Stair stair : before.stairs().stairs()) {
            Stair next = remaining.remove(stair.stairId());
            if (!stair.equals(next)) {
                result.add(new StairChange(stair, next));
            }
        }
        for (Stair stair : after.stairs().stairs()) {
            if (remaining.containsKey(stair.stairId())) {
                result.add(new StairChange(null, stair));
            }
        }
        return List.copyOf(result);
    }

    private static Map<Long, Corridor> corridorsById(List<Corridor> corridors) {
        Map<Long, Corridor> result = new LinkedHashMap<>();
        for (Corridor corridor : corridors) {
            result.put(corridor.corridorId(), corridor);
        }
        return result;
    }

    private static Map<Long, Stair> stairsById(List<Stair> stairs) {
        Map<Long, Stair> result = new LinkedHashMap<>();
        for (Stair stair : stairs) {
            result.put(stair.stairId(), stair);
        }
        return result;
    }
}
