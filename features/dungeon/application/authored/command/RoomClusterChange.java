package features.dungeon.application.authored.command;

import features.dungeon.api.DungeonChunkKey;
import features.dungeon.domain.core.structure.DungeonMapIdentity;
import features.dungeon.domain.core.structure.room.RoomCluster;
import java.nio.charset.StandardCharsets;
import java.util.Set;

/** Exact before/after delta for one authored room-cluster identity. */
public record RoomClusterChange(
        RoomCluster before,
        RoomCluster after,
        Set<DungeonChunkKey> touchedChunks
) implements DungeonPatchChange {
    private static final long FIXED_ENCODING_BYTES = 128L;
    private static final long BOUNDARY_ENCODING_BYTES = 48L;

    public RoomClusterChange {
        if (before == null && after == null) {
            throw new IllegalArgumentException("a cluster change requires before or after state");
        }
        if (before != null && after != null) {
            if (before.equals(after)) {
                throw new IllegalArgumentException("a cluster change requires distinct before and after state");
            }
            if (before.clusterId() != after.clusterId() || before.mapId() != after.mapId()) {
                throw new IllegalArgumentException("room cluster identity must remain stable");
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
        return DungeonPatchEntityRef.roomCluster(state().clusterId());
    }

    @Override
    public long encodedBytes() {
        return FIXED_ENCODING_BYTES
                + encodedBytes(before)
                + encodedBytes(after);
    }

    @Override
    public RoomClusterChange inverse() {
        return new RoomClusterChange(after, before, touchedChunks);
    }

    @Override
    public Set<DungeonChunkKey> touchedChunks() {
        return Set.copyOf(touchedChunks);
    }

    private RoomCluster state() {
        return after == null ? before : after;
    }

    private static long encodedBytes(RoomCluster cluster) {
        return cluster == null
                ? 1L
                : cluster.name().getBytes(StandardCharsets.UTF_8).length
                        + BOUNDARY_ENCODING_BYTES * cluster.orderedAuthoredBoundaries().size();
    }
}
