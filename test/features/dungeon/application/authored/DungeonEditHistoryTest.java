package features.dungeon.application.authored;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import features.dungeon.domain.core.structure.DungeonMap;
import features.dungeon.domain.core.structure.DungeonMapAuthoring;
import features.dungeon.domain.core.structure.DungeonMapIdentity;
import org.junit.jupiter.api.Test;

final class DungeonEditHistoryTest {
    @Test
    void undoAndRedoRemainLocalToOneRunningSessionAndMap() {
        DungeonMapIdentity mapId = new DungeonMapIdentity(1L);
        DungeonMap before = DungeonMapAuthoring.empty(mapId, "Before");
        DungeonMap after = DungeonMapAuthoring.rename(before, "After");
        DungeonEditHistory history = new DungeonEditHistory();

        history.record(before, after);

        assertTrue(history.canUndo(mapId));
        assertEquals(before, history.undo(after));
        assertFalse(history.canUndo(mapId));
        assertTrue(history.canRedo(mapId));
        assertEquals(after, history.redo(before));
    }

    @Test
    void newCommitClearsTheRedoBranch() {
        DungeonMapIdentity mapId = new DungeonMapIdentity(1L);
        DungeonMap first = DungeonMapAuthoring.empty(mapId, "First");
        DungeonMap second = DungeonMapAuthoring.rename(first, "Second");
        DungeonMap replacement = DungeonMapAuthoring.rename(first, "Replacement");
        DungeonEditHistory history = new DungeonEditHistory();
        history.record(first, second);
        history.undo(second);

        history.record(first, replacement);

        assertFalse(history.canRedo(mapId));
        assertEquals(first, history.undo(replacement));
    }
}
