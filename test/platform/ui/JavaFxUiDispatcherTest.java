package platform.ui;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import javafx.application.Platform;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import testsupport.JavaFxRuntime;

final class JavaFxUiDispatcherTest {

    @BeforeAll
    static void startJavaFx() throws Exception {
        CountDownLatch started = new CountDownLatch(1);
        JavaFxRuntime.startup(started::countDown);
        assertTrue(started.await(5L, TimeUnit.SECONDS));
    }

    @Test
    void dispatchesWorkerUpdatesExactlyOnceOnJavaFxThread() throws Exception {
        JavaFxUiDispatcher dispatcher = new JavaFxUiDispatcher();
        CountDownLatch finished = new CountDownLatch(1);
        List<Boolean> fxThreads = new ArrayList<>();

        Thread worker = new Thread(() -> dispatcher.dispatch(() -> {
            fxThreads.add(Platform.isFxApplicationThread());
            finished.countDown();
        }));
        worker.start();
        worker.join();

        assertTrue(finished.await(5L, TimeUnit.SECONDS));
        assertEquals(List.of(true), fxThreads);
    }
}
