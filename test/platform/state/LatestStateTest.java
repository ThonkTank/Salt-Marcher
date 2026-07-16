package platform.state;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

final class LatestStateTest {

    @Test
    void rejectsLateResultsAndReplaysCurrentAtomically() {
        LatestState<String> state = new LatestState<>("initial");
        UpdateToken older = state.beginUpdate();
        UpdateToken newer = state.beginUpdate();
        List<StateSnapshot<String>> first = new ArrayList<>();

        Runnable unsubscribe = state.subscribe(first::add);
        assertTrue(state.publish(newer, "newer"));
        assertFalse(state.publish(older, "older"));

        List<StateSnapshot<String>> second = new ArrayList<>();
        state.subscribe(second::add);
        unsubscribe.run();
        UpdateToken latest = state.beginUpdate();
        assertTrue(state.publish(latest, "latest"));

        assertEquals(List.of("initial", "newer"), first.stream().map(StateSnapshot::value).toList());
        assertEquals(List.of("newer", "latest"), second.stream().map(StateSnapshot::value).toList());
        assertEquals(3L, state.current().revision());
        assertEquals("latest", state.current().value());
    }
}
