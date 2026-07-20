package features.catalog.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;

final class CatalogSuccessfulAsyncCacheTest {

    @Test
    void synchronousErrorDoesNotLeaveAnUnfinishableInFlightEntry() {
        CatalogSuccessfulAsyncCache<String> cache = new CatalogSuccessfulAsyncCache<>();
        AssertionError failure = new AssertionError("boom");

        CompletionException completion = assertThrows(CompletionException.class,
                () -> cache.resolve(() -> { throw failure; }).toCompletableFuture().join());
        assertEquals(failure, completion.getCause());

        AtomicInteger retries = new AtomicInteger();
        Optional<String> recovered = cache.resolve(() -> {
            retries.incrementAndGet();
            return CompletableFuture.completedFuture(Optional.of("ready"));
        }).toCompletableFuture().join();

        assertEquals(Optional.of("ready"), recovered);
        assertEquals(1, retries.get());
    }
}
