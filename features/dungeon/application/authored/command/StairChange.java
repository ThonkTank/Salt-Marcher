package features.dungeon.application.authored.command;

import features.dungeon.api.DungeonChunkKey;
import features.dungeon.domain.core.component.StairExit;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.structure.DungeonMapIdentity;
import features.dungeon.domain.core.structure.stair.Stair;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashSet;
import java.util.Objects;
import java.util.Set;

/** Exact before/after delta for one stable authored stair. */
public record StairChange(Stair before, Stair after) implements DungeonPatchChange {
    private static final long FIXED_ENCODING_BYTES = 128L;
    private static final long CELL_ENCODING_BYTES = 16L;
    private static final long EXIT_ENCODING_BYTES = 32L;

    public StairChange {
        if (before == null && after == null) {
            throw new IllegalArgumentException("a stair change requires before or after state");
        }
        if (before != null && after != null) {
            if (before.equals(after)) {
                throw new IllegalArgumentException("a stair change requires distinct before and after state");
            }
            if (before.stairId() != after.stairId() || before.mapId() != after.mapId()) {
                throw new IllegalArgumentException("stair identity must remain stable");
            }
        }
    }

    @Override
    public DungeonMapIdentity mapId() {
        return new DungeonMapIdentity(state().mapId());
    }

    @Override
    public DungeonPatchEntityRef entityRef() {
        return DungeonPatchEntityRef.stair(state().stairId());
    }

    @Override
    public Set<DungeonChunkKey> touchedChunks() {
        Set<DungeonChunkKey> result = new LinkedHashSet<>();
        addChunks(result, before);
        addChunks(result, after);
        return Set.copyOf(result);
    }

    @Override
    public long encodedBytes() {
        return FIXED_ENCODING_BYTES + encodedBytes(before) + encodedBytes(after);
    }

    @Override
    public StairChange inverse() {
        return new StairChange(after, before);
    }

    private Stair state() {
        return after == null ? before : after;
    }

    private static void addChunks(Set<DungeonChunkKey> result, Stair stair) {
        if (stair == null) {
            return;
        }
        for (Cell cell : stair.occupiedCells()) {
            result.add(new DungeonChunkKey(
                    stair.mapId(),
                    cell.level(),
                    Math.floorDiv(cell.q(), DungeonChunkKey.CHUNK_SIZE),
                    Math.floorDiv(cell.r(), DungeonChunkKey.CHUNK_SIZE)));
        }
    }

    private static long encodedBytes(Stair stair) {
        if (stair == null) {
            return 1L;
        }
        long result = stair.name().getBytes(StandardCharsets.UTF_8).length
                + CELL_ENCODING_BYTES * stair.path().size();
        for (StairExit exit : stair.exits()) {
            result += EXIT_ENCODING_BYTES
                    + Objects.requireNonNullElse(exit.label(), "").getBytes(StandardCharsets.UTF_8).length;
        }
        return result;
    }
}
