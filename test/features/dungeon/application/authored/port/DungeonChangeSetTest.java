package features.dungeon.application.authored.port;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import features.dungeon.domain.core.structure.DungeonMapAuthoring;
import features.dungeon.domain.core.structure.DungeonMapIdentity;
import org.junit.jupiter.api.Test;

class DungeonChangeSetTest {

    @Test
    void acceptsExactlyOneRevisionForTheSameMap() {
        var before = DungeonMapAuthoring.empty(new DungeonMapIdentity(3L), "Map");
        var after = DungeonMapAuthoring.rename(before, "Renamed");

        DungeonChangeSet changeSet = new DungeonChangeSet(before, after);

        assertEquals(1L, changeSet.expectedRevision());
        assertEquals(2L, changeSet.committedRevision());
    }

    @Test
    void rejectsSkippedRevisions() {
        var before = DungeonMapAuthoring.empty(new DungeonMapIdentity(3L), "Map");
        var after = DungeonMapAuthoring.committedContent(before, 3L);

        assertThrows(IllegalArgumentException.class, () -> new DungeonChangeSet(before, after));
    }
}
