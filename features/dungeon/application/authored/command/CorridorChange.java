package features.dungeon.application.authored.command;

import features.dungeon.api.DungeonChunkKey;
import features.dungeon.domain.core.component.CorridorAnchor;
import features.dungeon.domain.core.component.CorridorAnchorRef;
import features.dungeon.domain.core.component.CorridorDoorBinding;
import features.dungeon.domain.core.component.CorridorWaypoint;
import features.dungeon.domain.core.structure.DungeonMapIdentity;
import features.dungeon.domain.core.structure.corridor.Corridor;
import java.util.Set;

/** Exact before/after delta for one authored corridor identity. */
public record CorridorChange(
        Corridor before,
        Corridor after,
        Set<DungeonChunkKey> touchedChunks
) implements DungeonPatchChange {
    private static final long FIXED_ENCODING_BYTES = 128L;

    public CorridorChange {
        if (before == null && after == null) {
            throw new IllegalArgumentException("a corridor change requires before or after state");
        }
        if (before != null && after != null) {
            if (before.equals(after)) {
                throw new IllegalArgumentException("a corridor change requires distinct before and after state");
            }
            if (before.corridorId() != after.corridorId() || before.mapId() != after.mapId()) {
                throw new IllegalArgumentException("corridor identity must remain stable");
            }
        }
        touchedChunks = touchedChunks == null ? Set.of() : Set.copyOf(touchedChunks);
    }

    @Override
    public DungeonMapIdentity mapId() {
        return new DungeonMapIdentity(state().mapId());
    }

    @Override
    public DungeonPatchEntityRef entityRef() {
        return DungeonPatchEntityRef.corridor(state().corridorId());
    }

    @Override
    public long encodedBytes() {
        return FIXED_ENCODING_BYTES + encodedBytes(before) + encodedBytes(after);
    }

    @Override
    public CorridorChange inverse() {
        return new CorridorChange(after, before, touchedChunks);
    }

    @Override
    public Set<DungeonChunkKey> touchedChunks() {
        return Set.copyOf(touchedChunks);
    }

    private Corridor state() {
        return after == null ? before : after;
    }

    private static long encodedBytes(Corridor corridor) {
        if (corridor == null) {
            return 1L;
        }
        long result = 32L + 8L * corridor.roomIds().size();
        for (CorridorWaypoint ignored : corridor.bindings().waypoints()) {
            result += 32L;
        }
        for (CorridorDoorBinding ignored : corridor.bindings().doorBindings()) {
            result += 64L;
        }
        for (CorridorAnchor ignored : corridor.bindings().anchorBindings()) {
            result += 40L;
        }
        for (CorridorAnchorRef ignored : corridor.bindings().anchorRefs()) {
            result += 24L;
        }
        return result;
    }
}
