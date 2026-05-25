package src.domain.creatures;

import java.util.LinkedHashSet;
import java.util.Objects;
import java.util.Set;
import java.util.function.Consumer;

final class CreaturesPublishedModelChannelServiceAssembly<T> {

    private static final String LISTENER_PARAMETER = "listener";

    private final Set<Consumer<T>> subscribers = new LinkedHashSet<>();
    private T value;

    CreaturesPublishedModelChannelServiceAssembly(T initialValue) {
        value = Objects.requireNonNull(initialValue, "initialValue");
    }

    T snapshot() {
        return value;
    }

    void replace(T nextValue) {
        value = Objects.requireNonNull(nextValue, "nextValue");
        for (Consumer<T> subscriber : Set.copyOf(subscribers)) {
            subscriber.accept(value);
        }
    }

    Runnable listen(Consumer<T> listener) {
        Consumer<T> subscriber = Objects.requireNonNull(listener, LISTENER_PARAMETER);
        subscribers.add(subscriber);
        return () -> subscribers.remove(subscriber);
    }
}
