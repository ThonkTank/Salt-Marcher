package platform.state;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Consumer;

public final class LatestState<T> {

    private final Map<Long, Consumer<StateSnapshot<T>>> subscribers = new LinkedHashMap<>();
    private long issuedRevision;
    private long subscriberId;
    private StateSnapshot<T> current;

    public LatestState(T initialValue) {
        current = new StateSnapshot<>(0L, initialValue);
    }

    public synchronized UpdateToken beginUpdate() {
        issuedRevision++;
        return new UpdateToken(issuedRevision);
    }

    public synchronized boolean publish(UpdateToken token, T value) {
        UpdateToken safeToken = Objects.requireNonNull(token, "token");
        if (safeToken.revision() != issuedRevision || safeToken.revision() <= current.revision()) {
            return false;
        }
        current = new StateSnapshot<>(safeToken.revision(), value);
        for (Consumer<StateSnapshot<T>> subscriber : List.copyOf(subscribers.values())) {
            subscriber.accept(current);
        }
        return true;
    }

    public synchronized boolean replace(UpdateToken token, T value) {
        UpdateToken safeToken = Objects.requireNonNull(token, "token");
        if (safeToken.revision() != issuedRevision || safeToken.revision() <= current.revision()) {
            return false;
        }
        current = new StateSnapshot<>(safeToken.revision(), value);
        return true;
    }

    public synchronized StateSnapshot<T> current() {
        return current;
    }

    public synchronized Runnable subscribe(Consumer<StateSnapshot<T>> subscriber) {
        Consumer<StateSnapshot<T>> safeSubscriber = Objects.requireNonNull(subscriber, "subscriber");
        long id = ++subscriberId;
        subscribers.put(id, safeSubscriber);
        try {
            safeSubscriber.accept(current);
        } catch (RuntimeException | Error failure) {
            subscribers.remove(id);
            throw failure;
        }
        return () -> unsubscribe(id);
    }

    private synchronized void unsubscribe(long id) {
        subscribers.remove(id);
    }
}
