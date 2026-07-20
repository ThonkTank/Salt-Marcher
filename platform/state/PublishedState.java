package platform.state;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.Consumer;
import platform.state.LatestState;
import platform.state.UpdateToken;
import platform.ui.DirectUiDispatcher;
import platform.ui.UiDispatcher;

public final class PublishedState<T> {

    private final LatestState<T> state;
    private final UiDispatcher dispatcher;
    private final boolean retainDuplicateSubscribers;
    private final Map<Consumer<T>, Runnable> uniqueSubscriptions = new LinkedHashMap<>();

    public PublishedState(T initialValue) {
        this(initialValue, DirectUiDispatcher.INSTANCE, false);
    }

    public PublishedState(T initialValue, UiDispatcher dispatcher) {
        this(initialValue, dispatcher, false);
    }

    private PublishedState(T initialValue, UiDispatcher dispatcher, boolean retainDuplicateSubscribers) {
        state = new LatestState<>(Objects.requireNonNull(initialValue, "initialValue"));
        this.dispatcher = Objects.requireNonNull(dispatcher, "dispatcher");
        this.retainDuplicateSubscribers = retainDuplicateSubscribers;
    }

    public static <T> PublishedState<T> retainingDuplicateSubscribers(T initialValue) {
        return new PublishedState<>(initialValue, DirectUiDispatcher.INSTANCE, true);
    }

    public T current() {
        return state.current().value();
    }

    public long revision() {
        return state.current().revision();
    }

    public Runnable subscribe(Consumer<T> listener) {
        Consumer<T> subscriber = Objects.requireNonNull(listener, "listener");
        if (retainDuplicateSubscribers) {
            return subscribeDistinct(subscriber);
        }
        synchronized (uniqueSubscriptions) {
            if (!uniqueSubscriptions.containsKey(subscriber)) {
                uniqueSubscriptions.put(subscriber, subscribeDistinct(subscriber));
            }
        }
        return () -> unsubscribeUnique(subscriber);
    }

    /** Atomically observes the current value and all later values, while rejecting superseded queued revisions. */
    public Runnable observeLatest(Consumer<T> observer) {
        Consumer<T> safeObserver = Objects.requireNonNull(observer, "observer");
        AtomicBoolean active = new AtomicBoolean(true);
        Runnable unsubscribe = state.subscribe(snapshot -> dispatcher.dispatch(() -> {
            if (active.get() && snapshot.revision() == state.current().revision()) {
                safeObserver.accept(snapshot.value());
            }
        }));
        return () -> {
            active.set(false);
            unsubscribe.run();
        };
    }

    private Runnable subscribeDistinct(Consumer<T> subscriber) {
        AtomicBoolean initialReplay = new AtomicBoolean(true);
        AtomicBoolean active = new AtomicBoolean(true);
        Runnable unsubscribe = state.subscribe(snapshot -> {
            if (initialReplay.getAndSet(false)) {
                return;
            }
            dispatcher.dispatch(() -> {
                if (active.get() && snapshot.revision() == state.current().revision()) {
                    subscriber.accept(snapshot.value());
                }
            });
        });
        return () -> {
            active.set(false);
            unsubscribe.run();
        };
    }

    private void unsubscribeUnique(Consumer<T> subscriber) {
        Runnable unsubscribe;
        synchronized (uniqueSubscriptions) {
            unsubscribe = uniqueSubscriptions.remove(subscriber);
        }
        if (unsubscribe != null) {
            unsubscribe.run();
        }
    }

    public void publish(T nextValue) {
        UpdateToken token = state.beginUpdate();
        state.publish(token, Objects.requireNonNull(nextValue, "nextValue"));
    }

    public void replace(T nextValue) {
        UpdateToken token = state.beginUpdate();
        state.replace(token, Objects.requireNonNull(nextValue, "nextValue"));
    }
}
