package features.dungeon.api;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

final class DungeonViewportRequestTest {
    @Test
    void negativeCellsBelongToTheExpectedFloorDividedChunk() {
        assertEquals(new DungeonChunkKey(7L, 2, -1, -1),
                DungeonChunkKey.containing(7L, new DungeonCellRef(-1, -64, 2)));
        assertEquals(new DungeonChunkKey(7L, 2, -2, -2),
                DungeonChunkKey.containing(7L, new DungeonCellRef(-65, -65, 2)));
    }

    @Test
    void loadingWindowIncludesExactlyOneChunkRing() {
        DungeonViewportRequest request = new DungeonViewportRequest(7L, 4L, 0, 0, 0, 63, 63);

        assertEquals(1, request.visibleChunks().size());
        assertEquals(9, request.loadingChunks().size());
        assertTrue(request.loadingChunks().contains(new DungeonChunkKey(7L, 0, -1, -1)));
        assertTrue(request.loadingChunks().contains(new DungeonChunkKey(7L, 0, 1, 1)));
    }
}
