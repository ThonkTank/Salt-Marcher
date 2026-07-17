package features.dungeon.qualification;

import features.dungeon.api.DungeonCellRef;
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
                .mapToObj(index -> new DungeonCellRef(
                        sparseCoordinate(index, 67),
                        sparseCoordinate(index, 131),
                        LEVEL));
    }

    private static int sparseCoordinate(int index, int stride) {
        int magnitude = Math.multiplyExact(index, stride);
        return (index & 1) == 0 ? magnitude : -magnitude;
    }
}
