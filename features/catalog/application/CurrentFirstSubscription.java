package features.catalog.application;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.function.Supplier;

final class CurrentFirstSubscription {

    private CurrentFirstSubscription() {
    }

    static <T> Runnable open(
            Supplier<T> current,
            Function<Consumer<T>, Runnable> subscribe,
            Consumer<T> apply
    ) {
        Object lock = new Object();
        List<T> pending = new ArrayList<>();
        boolean[] initialized = {false};
        Consumer<T> listener = value -> {
            synchronized (lock) {
                if (!initialized[0]) {
                    pending.add(value);
                    return;
                }
            }
            apply.accept(value);
        };
        Runnable unsubscribe = Objects.requireNonNull(subscribe.apply(listener), "unsubscribe");
        apply.accept(current.get());
        while (true) {
            List<T> delayed;
            synchronized (lock) {
                if (pending.isEmpty()) {
                    initialized[0] = true;
                    break;
                }
                delayed = List.copyOf(pending);
                pending.clear();
            }
            delayed.forEach(apply);
        }
        return unsubscribe;
    }
}
