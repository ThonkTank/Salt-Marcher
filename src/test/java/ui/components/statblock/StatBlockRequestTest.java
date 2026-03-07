package ui.components.statblock;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

class StatBlockRequestTest {

    @Test
    void forCreatureBuildsRequestWithoutMobContext() {
        StatBlockRequest request = StatBlockRequest.forCreature(7L);
        assertEquals(7L, request.creatureId());
        assertNull(request.mobCount());
    }

    @Test
    void rejectsInvalidMobCount() {
        assertThrows(IllegalArgumentException.class, () -> new StatBlockRequest(7L, 0));
    }
}
