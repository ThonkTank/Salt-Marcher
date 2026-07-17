package features.dungeon.qualification;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import features.dungeon.api.DungeonCellRef;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;

final class DungeonQualificationDatasetTest {

    @Test
    void scalesAreStableAndIncreaseByOneOrderOfMagnitude() {
        assertEquals(1_000, DungeonQualificationDataset.SMALL.authoredCellCount());
        assertEquals(10_000, DungeonQualificationDataset.MEDIUM.authoredCellCount());
        assertEquals(100_000, DungeonQualificationDataset.LARGE.authoredCellCount());
    }

    @Test
    void largeDatasetIsDeterministicUniqueAndSparseAcrossBothCoordinateSigns() {
        List<DungeonCellRef> first = DungeonQualificationDataset.LARGE.authoredCells().toList();
        List<DungeonCellRef> second = DungeonQualificationDataset.LARGE.authoredCells().toList();
        Set<DungeonCellRef> unique = first.stream().collect(Collectors.toSet());

        assertEquals(first, second);
        assertEquals(DungeonQualificationDataset.LARGE.authoredCellCount(), unique.size());
        assertTrue(first.stream().anyMatch(cell -> cell.q() < 0 && cell.r() < 0));
        assertTrue(first.stream().anyMatch(cell -> cell.q() > 0 && cell.r() > 0));
    }

    @Test
    void qualificationWindowAlwaysLoadsOneVisibleChunkAndItsRing() {
        for (DungeonQualificationDataset dataset : DungeonQualificationDataset.values()) {
            var viewport = dataset.qualificationViewport(17L);
            assertEquals(1, viewport.visibleChunks().size());
            assertEquals(9, viewport.loadingChunks().size());
        }
    }
}
