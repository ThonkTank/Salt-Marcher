package platform.execution;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

final class LatestWinsTaskQueueTest {

    @Test
    void retainsOnlyLatestSampleWhileDrainIsWaiting() {
        ManualExecutionLane lane = new ManualExecutionLane();
        LatestWinsTaskQueue queue = new LatestWinsTaskQueue(lane);
        List<Integer> observed = new ArrayList<>();

        queue.submit(() -> observed.add(1));
        queue.submit(() -> observed.add(2));
        queue.submit(() -> observed.add(3));

        assertTrue(queue.pending());
        assertEquals(1, lane.queuedWork());
        lane.runNext();

        assertEquals(List.of(3), observed);
        assertFalse(queue.pending());
    }

    @Test
    void acceptsTheNextLatestSampleAfterACompletedDrain() {
        ManualExecutionLane lane = new ManualExecutionLane();
        LatestWinsTaskQueue queue = new LatestWinsTaskQueue(lane);
        List<Integer> observed = new ArrayList<>();

        queue.submit(() -> observed.add(1));
        lane.runNext();
        queue.submit(() -> observed.add(2));
        lane.runNext();

        assertEquals(List.of(1, 2), observed);
    }

    private static final class ManualExecutionLane implements ExecutionLane {
        private final ArrayDeque<Runnable> work = new ArrayDeque<>();

        @Override
        public void execute(Runnable task) {
            work.add(task);
        }

        int queuedWork() {
            return work.size();
        }

        void runNext() {
            work.remove().run();
        }

        @Override
        public void close() {
            work.clear();
        }
    }
}
