package features.dungeon.application.authored.command;

import features.dungeon.api.DungeonChunkKey;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.structure.DungeonMapIdentity;
import features.dungeon.domain.core.structure.transition.Transition;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashSet;
import java.util.Set;

/** Exact before/after delta for one stable authored transition. */
public record TransitionChange(Transition before, Transition after) implements DungeonPatchChange {
    private static final long FIXED_ENCODING_BYTES = 128L;

    public TransitionChange {
        if (before == null && after == null) {
            throw new IllegalArgumentException("a transition change requires before or after state");
        }
        if (before != null && after != null) {
            if (before.equals(after)) {
                throw new IllegalArgumentException("a transition change requires distinct before and after state");
            }
            if (before.transitionId() != after.transitionId() || before.mapId() != after.mapId()) {
                throw new IllegalArgumentException("transition identity must remain stable");
            }
        }
    }

    @Override
    public DungeonMapIdentity mapId() {
        return new DungeonMapIdentity(state().mapId());
    }

    @Override
    public DungeonPatchEntityRef entityRef() {
        return DungeonPatchEntityRef.transition(state().transitionId());
    }

    @Override
    public Set<DungeonChunkKey> touchedChunks() {
        Set<DungeonChunkKey> result = new LinkedHashSet<>();
        addChunk(result, before);
        addChunk(result, after);
        return Set.copyOf(result);
    }

    @Override
    public long encodedBytes() {
        return FIXED_ENCODING_BYTES + encodedBytes(before) + encodedBytes(after);
    }

    @Override
    public TransitionChange inverse() {
        return new TransitionChange(after, before);
    }

    private Transition state() {
        return after == null ? before : after;
    }

    private static void addChunk(Set<DungeonChunkKey> result, Transition transition) {
        if (transition == null) {
            return;
        }
        Cell anchor = transition.anchorCell();
        if (anchor != null) {
            result.add(new DungeonChunkKey(
                    transition.mapId(),
                    anchor.level(),
                    Math.floorDiv(anchor.q(), DungeonChunkKey.CHUNK_SIZE),
                    Math.floorDiv(anchor.r(), DungeonChunkKey.CHUNK_SIZE)));
        }
    }

    private static long encodedBytes(Transition transition) {
        return transition == null
                ? 1L
                : transition.description().getBytes(StandardCharsets.UTF_8).length + 64L;
    }
}
