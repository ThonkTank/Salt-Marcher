package ui.async;

import javafx.concurrent.Task;

import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.RejectedExecutionHandler;
import java.util.concurrent.ThreadFactory;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Shared background executor for JavaFX view tasks.
 */
public final class UiAsyncExecutor {

    private static final int CORE_POOL_SIZE = 2;
    private static final int MAX_POOL_SIZE = 4;
    private static final int QUEUE_CAPACITY = 64;
    private static final long KEEP_ALIVE_SECONDS = 30L;

    private static final AtomicInteger THREAD_COUNTER = new AtomicInteger(1);
    private static final ThreadFactory THREAD_FACTORY = new ThreadFactory() {
        @Override
        public Thread newThread(Runnable runnable) {
            Thread thread = new Thread(runnable, "sm-ui-async-" + THREAD_COUNTER.getAndIncrement());
            thread.setDaemon(true);
            return thread;
        }
    };
    private static final RejectedExecutionHandler REJECTION_HANDLER = new ThreadPoolExecutor.AbortPolicy();
    private static final ThreadPoolExecutor EXECUTOR = new ThreadPoolExecutor(
            CORE_POOL_SIZE,
            MAX_POOL_SIZE,
            KEEP_ALIVE_SECONDS,
            TimeUnit.SECONDS,
            new ArrayBlockingQueue<>(QUEUE_CAPACITY),
            THREAD_FACTORY,
            REJECTION_HANDLER
    );

    private UiAsyncExecutor() {
        throw new AssertionError("No instances");
    }

    public static void submit(Task<?> task) {
        try {
            EXECUTOR.execute(task);
        } catch (RejectedExecutionException rejection) {
            task.cancel();
            UiErrorReporter.reportBackgroundFailure("Hintergrundaufgabe abgelehnt (Async-Executor ausgelastet)", rejection);
        }
    }
}
