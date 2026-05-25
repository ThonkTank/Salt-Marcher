package src.domain.sessionplanner;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;

final class SessionPlannerPublishedModelChannelServiceAssembly<T> {

    private final List<Consumer<T>> listeners = new ArrayList<>();
    private T current;

    SessionPlannerPublishedModelChannelServiceAssembly(T initial) {
        this.current = Objects.requireNonNull(initial, "initial");
    }

    T current() {
        return current;
    }

    void publish(T value) {
        current = Objects.requireNonNull(value, "value");
        for (Consumer<T> listener : List.copyOf(listeners)) {
            listener.accept(current);
        }
    }

    Runnable subscribe(Consumer<T> listener) {
        Consumer<T> safeListener = Objects.requireNonNull(listener, "listener");
        listeners.add(safeListener);
        return () -> listeners.remove(safeListener);
    }
}
