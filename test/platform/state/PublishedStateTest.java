package platform.state;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;
import java.util.function.Consumer;
import org.junit.jupiter.api.Test;
import platform.ui.UiDispatcher;

final class PublishedStateTest {

    @Test
    void defaultSubscriptionDeduplicatesAndUnsubscribesOnce() {
        PublishedState<String> state = new PublishedState<>("initial");
        List<String> delivered = new ArrayList<>();
        Consumer<String> subscriber = delivered::add;

        Runnable firstUnsubscribe = state.subscribe(subscriber);
        state.subscribe(subscriber);
        state.publish("one");
        firstUnsubscribe.run();
        state.publish("two");

        assertEquals(List.of("one"), delivered);
    }

    @Test
    void retainingSubscriptionDeliversDuplicateRegistrations() {
        PublishedState<String> state = PublishedState.retainingDuplicateSubscribers("initial");
        List<String> delivered = new ArrayList<>();
        Consumer<String> subscriber = delivered::add;

        state.subscribe(subscriber);
        state.subscribe(subscriber);
        state.publish("one");

        assertEquals(List.of("one", "one"), delivered);
    }

    @Test
    void unsubscribeCancelsAlreadyQueuedDelivery() {
        QueuedDispatcher dispatcher = new QueuedDispatcher();
        PublishedState<String> state = new PublishedState<>("initial", dispatcher);
        List<String> delivered = new ArrayList<>();
        Runnable unsubscribe = state.subscribe(delivered::add);

        state.publish("queued");
        unsubscribe.run();
        dispatcher.runAll();

        assertEquals(List.of(), delivered);
    }

    @Test
    void olderQueuedRevisionDoesNotFollowNewerInlineRevision() {
        ControlledDispatcher dispatcher = new ControlledDispatcher();
        PublishedState<String> state = new PublishedState<>("initial", dispatcher);
        List<String> delivered = new ArrayList<>();
        state.subscribe(delivered::add);

        state.publish("older-worker-result");
        dispatcher.dispatchInline();
        state.publish("newer-inline-result");

        assertEquals(List.of("newer-inline-result"), delivered);
        dispatcher.runAll();
        assertEquals(List.of("newer-inline-result"), delivered);
    }

    @Test
    void atomicObservationNeverDeliversQueuedCurrentAfterNewerInlineValue() {
        ControlledDispatcher dispatcher = new ControlledDispatcher();
        PublishedState<String> state = new PublishedState<>("queued-current", dispatcher);
        List<String> delivered = new ArrayList<>();

        state.observeLatest(delivered::add);
        dispatcher.dispatchInline();
        state.publish("newer-inline");

        assertEquals(List.of("newer-inline"), delivered);
        dispatcher.runAll();
        assertEquals(List.of("newer-inline"), delivered);
    }

    private static final class QueuedDispatcher implements UiDispatcher {
        private final Deque<Runnable> updates = new ArrayDeque<>();

        @Override
        public void dispatch(Runnable update) {
            updates.addLast(update);
        }

        void runAll() {
            while (!updates.isEmpty()) {
                updates.removeFirst().run();
            }
        }
    }

    private static final class ControlledDispatcher implements UiDispatcher {
        private final Deque<Runnable> updates = new ArrayDeque<>();
        private boolean inline;

        @Override
        public void dispatch(Runnable update) {
            if (inline) {
                update.run();
            } else {
                updates.addLast(update);
            }
        }

        void dispatchInline() {
            inline = true;
        }

        void runAll() {
            while (!updates.isEmpty()) {
                updates.removeFirst().run();
            }
        }
    }
}
