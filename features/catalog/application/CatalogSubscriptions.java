package features.catalog.application;

import java.util.ArrayList;
import java.util.List;

/** Small failure-safe composition for provider subscriptions owned by one active session. */
final class CatalogSubscriptions {

    private CatalogSubscriptions() {
    }

    static Runnable combine(List<Runnable> subscriptions) {
        List<Runnable> acquired = List.copyOf(subscriptions);
        return () -> release(acquired);
    }

    static Runnable acquire(Acquirer... acquirers) {
        List<Runnable> subscriptions = new ArrayList<>();
        try {
            for (Acquirer acquirer : acquirers) {
                subscriptions.add(acquirer.acquire());
            }
            return combine(subscriptions);
        } catch (RuntimeException | Error failure) {
            try {
                release(subscriptions);
            } catch (RuntimeException | Error cleanupFailure) {
                failure.addSuppressed(cleanupFailure);
            }
            throw failure;
        }
    }

    private static void release(List<Runnable> subscriptions) {
        Throwable failure = null;
        for (int index = subscriptions.size() - 1; index >= 0; index--) {
            try {
                subscriptions.get(index).run();
            } catch (RuntimeException | Error cleanupFailure) {
                if (failure == null) {
                    failure = cleanupFailure;
                } else {
                    failure.addSuppressed(cleanupFailure);
                }
            }
        }
        if (failure instanceof RuntimeException runtimeFailure) {
            throw runtimeFailure;
        }
        if (failure instanceof Error error) {
            throw error;
        }
    }

    @FunctionalInterface
    interface Acquirer {
        Runnable acquire();
    }
}
