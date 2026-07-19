package features.dungeon.qualification;

import features.dungeon.api.DungeonCellRef;
import features.dungeon.api.DungeonChunkKey;
import features.dungeon.api.DungeonViewportRequest;
import java.util.stream.IntStream;
import java.util.stream.Stream;

/** Deterministic sparse datasets shared by Dungeon greenfield qualification slices. */
public enum DungeonQualificationDataset {
    SMALL(1_000),
    MEDIUM(10_000),
    LARGE(100_000);

    public static final long MAP_ID = 1L;
    public static final int LEVEL = 0;
    private static final int OFF_WINDOW_CHUNKS = 300;

    private final int authoredCellCount;

    DungeonQualificationDataset(int authoredCellCount) {
        this.authoredCellCount = authoredCellCount;
    }

    public int authoredCellCount() {
        return authoredCellCount;
    }

    public DungeonViewportRequest qualificationViewport(long requestGeneration) {
        return new DungeonViewportRequest(MAP_ID, requestGeneration, LEVEL, 0, 0, 63, 63);
    }

    public Stream<DungeonCellRef> authoredCells() {
        return IntStream.range(0, authoredCellCount)
                .mapToObj(DungeonQualificationDataset::sparseCell);
    }

    private static DungeonCellRef sparseCell(int index) {
        if (index == 0) {
            return new DungeonCellRef(0, 0, LEVEL);
        }
        int position = index - 1;
        int slot = position % OFF_WINDOW_CHUNKS;
        int inChunk = position / OFF_WINDOW_CHUNKS;
        int magnitude = 10 + slot / 2;
        int chunk = (slot & 1) == 0 ? magnitude : -magnitude;
        int localQ = inChunk % DungeonChunkKey.CHUNK_SIZE;
        int localR = inChunk / DungeonChunkKey.CHUNK_SIZE;
        return new DungeonCellRef(
                chunk * DungeonChunkKey.CHUNK_SIZE + localQ,
                chunk * DungeonChunkKey.CHUNK_SIZE + localR,
                LEVEL);
    }
}
