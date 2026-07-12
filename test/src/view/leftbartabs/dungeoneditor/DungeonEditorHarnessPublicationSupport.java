package src.view.leftbartabs.dungeoneditor;

import java.nio.channels.FileChannel;
import java.nio.channels.FileLock;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import javafx.application.Platform;
import javafx.stage.Window;

class DungeonEditorHarnessPublicationSupport extends DungeonEditorHarnessPersistenceSupport {

    static final int AWAIT_SECONDS = 60;
    static final AtomicBoolean FX_STARTED = new AtomicBoolean();

    @FunctionalInterface
    interface ThrowingRunnable {
        void run() throws Exception;
    }

    @FunctionalInterface
    interface HarnessConcern {
        void run(List<String> results) throws Exception;
    }

    static void writeResults(List<String> results) throws Exception {
        Path output = resultsOutput();
        if (output == null) {
            return;
        }
        Files.createDirectories(output.getParent());
        Files.write(output, results);
    }

    static void clearResults() throws Exception {
        Path output = resultsOutput();
        if (output != null) {
            Files.deleteIfExists(output);
        }
    }

    static ResultPublicationLock lockResults() throws Exception {
        Path output = resultsOutput();
        if (output == null) {
            return ResultPublicationLock.none();
        }
        Files.createDirectories(output.getParent());
        Path lockPath = output.resolveSibling("summary.lock");
        FileChannel channel = FileChannel.open(
                lockPath,
                StandardOpenOption.CREATE,
                StandardOpenOption.WRITE);
        return ResultPublicationLock.lock(channel);
    }

    static Path resultsOutput() {
        String resultsDir = System.getProperty("saltmarcher.dungeonEditorBehavior.resultsDir", "");
        if (resultsDir.isBlank()) {
            return null;
        }
        return Path.of(resultsDir, "summary.txt");
    }

    static void runPublishedHarness(
            String harnessName,
            HarnessConcern concern
    ) throws Exception {
        try (ResultPublicationLock ignored = lockResults()) {
            try {
                clearResults();
                List<String> results = new ArrayList<>();
                concern.run(results);
                writeResults(results);
                System.out.println(harnessName + " passed: " + results.size() + " proof item(s).");
                for (String result : results) {
                    System.out.println(result);
                }
                shutdownFx();
            } catch (Throwable throwable) {
                clearResults();
                throwable.printStackTrace(System.err);
                if (throwable instanceof Exception exception) {
                    throw exception;
                }
                if (throwable instanceof Error error) {
                    throw error;
                }
                throw new RuntimeException(throwable);
            }
        }
    }

    static final class ResultPublicationLock implements AutoCloseable {
        private final FileChannel channel;
        private final FileLock lock;

        private ResultPublicationLock(FileChannel channel, FileLock lock) {
            this.channel = channel;
            this.lock = lock;
        }

        static ResultPublicationLock none() {
            return new ResultPublicationLock(null, null);
        }

        static ResultPublicationLock lock(FileChannel channel) throws Exception {
            try {
                return new ResultPublicationLock(channel, channel.lock());
            } catch (Throwable throwable) {
                channel.close();
                throw throwable;
            }
        }

        @Override
        public void close() throws Exception {
            if (lock != null) {
                lock.release();
            }
            if (channel != null) {
                channel.close();
            }
        }
    }

    static void shutdownFx() throws Exception {
        runOnFxThread(() -> {
            hideWindowsWithoutImplicitExit();
            Platform.exit();
        });
    }

    static void runOnFxThread(ThrowingRunnable action) throws Exception {
        CountDownLatch latch = new CountDownLatch(1);
        Throwable[] failure = new Throwable[1];
        Runnable wrappedAction = () -> {
            try {
                Platform.setImplicitExit(false);
                action.run();
            } catch (Throwable throwable) {
                failure[0] = throwable;
            } finally {
                latch.countDown();
            }
        };
        if (FX_STARTED.compareAndSet(false, true)) {
            Platform.startup(wrappedAction);
        } else {
            Platform.runLater(wrappedAction);
        }
        if (!latch.await(AWAIT_SECONDS, TimeUnit.SECONDS)) {
            throw new IllegalStateException("Timed out waiting for JavaFX Dungeon Editor harness.");
        }
        if (failure[0] != null) {
            throw new IllegalStateException("Dungeon Editor behavior harness failed.", failure[0]);
        }
    }

    static void cleanupRouteProofWindows() throws Exception {
        runOnFxThread(DungeonEditorHarnessPublicationSupport::hideWindowsWithoutImplicitExit);
    }

    private static void hideWindowsWithoutImplicitExit() {
        Platform.setImplicitExit(false);
        for (Window window : List.copyOf(Window.getWindows())) {
            window.hide();
        }
    }

    static void runRouteProof(
            List<String> results,
            String ownerSuite,
            ThrowingRunnable action
    ) throws Exception {
        int firstNewResult = results.size();
        try {
            runOnFxThread(action);
        } finally {
            cleanupRouteProofWindows();
        }
        for (int index = firstNewResult; index < results.size(); index++) {
            String rawResult = results.get(index);
            if (rawResult.contains("OwnerSuite=") || rawResult.contains("ProofType=")) {
                throw new IllegalStateException("Route proof rows must not predeclare proof metadata: " + rawResult);
            }
            if (!rawResult.matches(".*\\bDE-[A-Z]+-[0-9]{3}\\b.*")) {
                throw new IllegalStateException("Route proof rows must reference a DE-* catalog id: " + rawResult);
            }
            results.set(index, "OwnerSuite=" + ownerSuite + "; ProofType=RealRoute; " + rawResult);
        }
    }

    static void recordModelInvariant(
            List<String> results,
            String ownerSuite,
            String invariantId,
            String description
    ) {
        if (ownerSuite == null || ownerSuite.isBlank()) {
            throw new IllegalStateException("Model invariant rows must declare an owner suite.");
        }
        if (invariantId == null || !invariantId.matches("DGI-[A-Z]+-[0-9]{3}")) {
            throw new IllegalStateException("Model invariant rows must declare a DGI-* invariant id: " + invariantId);
        }
        if (description == null || description.isBlank()) {
            throw new IllegalStateException("Model invariant rows must declare a description.");
        }
        results.add("OwnerSuite=" + ownerSuite + "; ProofType=ModelInvariant; "
                + invariantId + " Qualified: " + description);
    }


}
