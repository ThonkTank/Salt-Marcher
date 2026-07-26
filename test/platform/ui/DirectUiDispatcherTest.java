package platform.ui;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.concurrent.CompletionException;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;

final class DirectUiDispatcherTest {

    @Test
    void throwingTerminalHandlerCompletesSynchronouslyOnceAndPreservesCallbackFailure() {
        IllegalStateException callbackFailure = new IllegalStateException("callback failed");
        IllegalArgumentException handlerFailure = new IllegalArgumentException("handler failed");
        AtomicInteger handlerCalls = new AtomicInteger();
        AtomicInteger completions = new AtomicInteger();

        var terminal = DirectUiDispatcher.INSTANCE.dispatchTracked(
                () -> { throw callbackFailure; },
                observed -> {
                    assertSame(callbackFailure, observed);
                    handlerCalls.incrementAndGet();
                    throw handlerFailure;
                }).toCompletableFuture();
        terminal.whenComplete((ignored, failure) -> completions.incrementAndGet());

        CompletionException reported = assertThrows(CompletionException.class, terminal::join);
        assertSame(handlerFailure, reported.getCause());
        assertEquals(1, handlerCalls.get());
        assertEquals(1, completions.get());
        assertEquals(1, handlerFailure.getSuppressed().length);
        assertSame(callbackFailure, handlerFailure.getSuppressed()[0]);
    }
}
