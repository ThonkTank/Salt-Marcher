package src.domain.shared.published;

import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;

public final class PublishedState<T> {

    private final Collection<Consumer<T>> listeners;
    private T current;

    public PublishedState(T initialValue) {
        this(initialValue, new LinkedHashSet<>());
    }

    public static <T> PublishedState<T> retainingDuplicateSubscribers(T initialValue) {
        return new PublishedState<>(initialValue, new ArrayList<>());
    }

    private PublishedState(T initialValue, Collection<Consumer<T>> listeners) {
        this.listeners = Objects.requireNonNull(listeners, "listeners");
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
        for (Consumer<T> listener : List.copyOf(listeners)) {
            listener.accept(current);
        }
    }

    public void replace(T nextValue) {
        current = Objects.requireNonNull(nextValue, "nextValue");
    }
}
