package app;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import platform.diagnostics.NoopDiagnostics;
import platform.execution.ExecutionLane;
import platform.persistence.SqliteDatabase;
import platform.ui.DirectUiDispatcher;

final class AppBootstrapLifecycleTest {

    @TempDir
    java.nio.file.Path temporaryDirectory;

    @Test
    void bootstrapClosesAllOwnedGenerationLanesExactlyOnce() {
        RecordingLane shared = new RecordingLane();
        RecordingLane generationCpu = new RecordingLane();
        RecordingLane generationIo = new RecordingLane();
        RecordingLane encounterCpu = new RecordingLane();
        RecordingLane encounterIo = new RecordingLane();
        AppBootstrap bootstrap = new AppBootstrap(
                NoopDiagnostics.INSTANCE,
                shared,
                generationCpu,
                generationIo,
                encounterCpu,
                encounterIo,
                DirectUiDispatcher.INSTANCE,
                new SqliteDatabase(temporaryDirectory.resolve("lifecycle.sqlite"), NoopDiagnostics.INSTANCE));

        bootstrap.close();
        bootstrap.close();

        assertEquals(1, generationCpu.closes);
        assertEquals(1, generationIo.closes);
        assertEquals(1, encounterCpu.closes);
        assertEquals(1, encounterIo.closes);
        assertEquals(1, shared.closes);
    }

    private static final class RecordingLane implements ExecutionLane {
        private int closes;

        @Override
        public void execute(Runnable work) {
            work.run();
        }

        @Override
        public void close() {
            closes++;
        }
    }
}
