package src.domain.dungeon;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;

final class DungeonPublishedChannelServiceAssembly<T> {

    private final List<Consumer<T>> listeners = new ArrayList<>();
    private T current;

    DungeonPublishedChannelServiceAssembly(T initial) {
        current = Objects.requireNonNull(initial, "initial");
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
        Consumer<T> safeListener = Objects.requireNonNull(listener, "listener");
        listeners.add(safeListener);
        return () -> listeners.remove(safeListener);
    }
}
