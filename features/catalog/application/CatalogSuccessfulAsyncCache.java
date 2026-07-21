package features.catalog.application;

import java.util.Objects;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.function.Supplier;

/** Coalesces one asynchronous load and retains only its last successful value. */
final class CatalogSuccessfulAsyncCache<T> {

    private T cached;
    private CompletionStage<Optional<T>> inFlight;

    synchronized CompletionStage<Optional<T>> resolve(
            Supplier<CompletionStage<Optional<T>>> loader
    ) {
        if (cached != null) {
            return CompletableFuture.completedFuture(Optional.of(cached));
        }
        if (inFlight != null) {
            return inFlight;
        }
        CompletableFuture<Optional<T>> shared = new CompletableFuture<>();
        inFlight = shared;
        CompletionStage<Optional<T>> requested;
        try {
            requested = Objects.requireNonNull(loader.get(), "option load");
        } catch (RuntimeException failure) {
            complete(shared, Optional.empty());
            return shared;
        } catch (Error failure) {
            fail(shared, failure);
            return shared;
        }
        requested.whenComplete((result, failure) -> complete(
                shared,
                failure == null && result != null ? result : Optional.empty()));
        return shared;
    }

    private void complete(CompletableFuture<Optional<T>> shared, Optional<T> result) {
        Optional<T> accepted = Objects.requireNonNullElse(result, Optional.empty());
        synchronized (this) {
            accepted.ifPresent(value -> cached = value);
            if (inFlight == shared) {
                inFlight = null;
            }
        }
        shared.complete(accepted);
    }

    private void fail(CompletableFuture<Optional<T>> shared, Error failure) {
        synchronized (this) {
            if (inFlight == shared) {
                inFlight = null;
            }
        }
        shared.completeExceptionally(failure);
    }
}
