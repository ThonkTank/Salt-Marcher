package src.data.encounter.repository;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;

final class EncounterPublishedStateChannel<T> {

    private static final String LISTENER_PARAMETER = "listener";

    private final List<Consumer<T>> listeners = new ArrayList<>();
    private T current;

    EncounterPublishedStateChannel(T current) {
        this.current = Objects.requireNonNull(current, "current");
    }

    T current() {
        return current;
    }

    void publish(T next) {
        current = Objects.requireNonNull(next, "next");
        for (Consumer<T> listener : List.copyOf(listeners)) {
            listener.accept(current);
        }
    }

    Runnable subscribe(Consumer<T> listener) {
        Consumer<T> safeListener = Objects.requireNonNull(listener, LISTENER_PARAMETER);
        listeners.add(safeListener);
        return () -> listeners.remove(safeListener);
    }
}
