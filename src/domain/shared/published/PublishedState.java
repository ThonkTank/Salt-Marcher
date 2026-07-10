package src.domain.shared.published;

import java.util.LinkedHashSet;
import java.util.Objects;
import java.util.Set;
import java.util.function.Consumer;

public final class PublishedState<T> {

    private final Set<Consumer<T>> listeners = new LinkedHashSet<>();
    private T current;

    public PublishedState(T initialValue) {
        current = Objects.requireNonNull(initialValue, "initialValue");
    }

    public T current() {
        return current;
    }

    public Runnable subscribe(Consumer<T> listener) {
        Consumer<T> subscriber = Objects.requireNonNull(listener, "listener");
        listeners.add(subscriber);
        return () -> listeners.remove(subscriber);
    }

    public void publish(T nextValue) {
        current = Objects.requireNonNull(nextValue, "nextValue");
        for (Consumer<T> listener : Set.copyOf(listeners)) {
            listener.accept(current);
        }
    }

    public void replace(T nextValue) {
        current = Objects.requireNonNull(nextValue, "nextValue");
    }
}
