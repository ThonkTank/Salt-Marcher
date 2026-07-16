package src.domain.worldplanner;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.List;
import org.junit.jupiter.api.Test;
import src.domain.worldplanner.model.world.WorldDisposition;
import src.domain.worldplanner.model.world.WorldFaction;
import src.domain.worldplanner.model.world.WorldNpc;
import src.domain.worldplanner.model.world.WorldNpcLifecycleState;
import src.domain.worldplanner.model.world.WorldPlannerState;

class WorldDispositionTest {
    @Test
    void factionAndNpcValuesComposeWithinBoundedScale() {
        WorldNpc npc = new WorldNpc(1L, "Rivalin", 10L, "", "", "", "", 5, WorldNpcLifecycleState.ACTIVE);
        WorldFaction faction = new WorldFaction(1L, "Garde", "", 20L, -30, List.of(1L), List.of());
        WorldPlannerState state = new WorldPlannerState(List.of(npc), List.of(faction), List.of(), 2L, 2L, 1L, "");
        assertEquals(-25, state.effectiveDisposition(npc));
        assertEquals(WorldDisposition.Kind.HOSTILE, WorldDisposition.kind(state.effectiveDisposition(npc)));
        assertEquals(50, WorldDisposition.clamp(80));
    }

    @Test
    void npcCannotBelongToTwoFactions() {
        WorldNpc npc = new WorldNpc(1L, "Rivalin", 10L, "", "", "", "", WorldNpcLifecycleState.ACTIVE);
        WorldFaction first = new WorldFaction(1L, "A", "", 20L, List.of(1L), List.of());
        WorldFaction second = new WorldFaction(2L, "B", "", 21L, List.of(1L), List.of());
        assertThrows(IllegalArgumentException.class,
                () -> new WorldPlannerState(List.of(npc), List.of(first, second), List.of(), 2L, 3L, 1L, ""));
    }
}
