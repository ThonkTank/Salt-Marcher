package features.dungeon.application.authored;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import features.dungeon.api.DungeonAreaKind;
import features.dungeon.api.DungeonAreaSnapshot;
import features.dungeon.api.DungeonCellRef;
import features.dungeon.api.DungeonMapSnapshot;
import features.dungeon.api.DungeonTopologyElementRef;
import features.dungeon.api.DungeonTopologyKind;
import features.dungeon.api.DungeonViewportRequest;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;

class DungeonViewportProjectionTest {

    @Test
    void returnsOnlyTheVisibleWorksetAndItsPrefetchRingAcrossNegativeChunks() {
        DungeonMapSnapshot map = new DungeonMapSnapshot(
                DungeonTopologyKind.SQUARE,
                1,
                1,
                List.of(new DungeonAreaSnapshot(
                        DungeonAreaKind.ROOM,
                        7L,
                        3L,
                        "Room",
                        List.of(
                                new DungeonCellRef(-65, 0, 2),
                                new DungeonCellRef(0, 0, 2),
                                new DungeonCellRef(130, 0, 2)),
                        DungeonTopologyElementRef.empty())),
                List.of(),
                List.of());
        DungeonViewportRequest request = new DungeonViewportRequest(9L, 4L, 2, -2, -2, 2, 2);

        var result = new DungeonViewportProjection().project(request, 12L, map);

        assertEquals(12L, result.mapRevision());
        assertEquals(4L, result.requestGeneration());
        assertEquals(Set.of(new DungeonCellRef(-65, 0, 2), new DungeonCellRef(0, 0, 2)),
                Set.copyOf(result.areas().getFirst().cells()));
        assertEquals(2, result.loadedChunks().size());
        assertEquals(1, result.continuations().size());
        assertEquals(2, result.continuations().getFirst().offWindowChunk().chunkQ());
        assertTrue(result.authoredBounds().present());
        assertEquals(-65, result.authoredBounds().minimumQ());
        assertEquals(130, result.authoredBounds().maximumQ());
    }
}
