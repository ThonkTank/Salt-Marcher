package features.dungeon.api;

/** Stable sparse-map chunk identity. Negative coordinates use floor division. */
public record DungeonChunkKey(long mapId, int level, int chunkQ, int chunkR) {
    public static final int CHUNK_SIZE = 64;

    public DungeonChunkKey {
        if (mapId <= 0L) {
            throw new IllegalArgumentException("mapId must be positive");
        }
    }

    public static DungeonChunkKey containing(long mapId, DungeonCellRef cell) {
        DungeonCellRef safeCell = cell == null ? new DungeonCellRef(0, 0, 0) : cell;
        return new DungeonChunkKey(
                mapId,
                safeCell.level(),
                Math.floorDiv(safeCell.q(), CHUNK_SIZE),
                Math.floorDiv(safeCell.r(), CHUNK_SIZE));
    }

    public int minimumQ() {
        return chunkQ * CHUNK_SIZE;
    }

    public int minimumR() {
        return chunkR * CHUNK_SIZE;
    }

    public int maximumQ() {
        return minimumQ() + CHUNK_SIZE - 1;
    }

    public int maximumR() {
        return minimumR() + CHUNK_SIZE - 1;
    }
}
