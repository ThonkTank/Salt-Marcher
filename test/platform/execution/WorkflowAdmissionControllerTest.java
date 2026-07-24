package platform.execution;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Duration;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import platform.diagnostics.NoopDiagnostics;

final class WorkflowAdmissionControllerTest {

    @Test
    void acceptedMultiLaneWorkflowDrainsAllPhasesWhileFenceRejectsNewRootsThenCanResume() throws Exception {
        WorkflowAdmissionController admission = new WorkflowAdmissionController();
        SerialExecutionLane authoredDelegate = new SerialExecutionLane(NoopDiagnostics.INSTANCE);
        SerialExecutionLane preparationDelegate = new SerialExecutionLane(NoopDiagnostics.INSTANCE);
        ExecutionLane authored = admission.admit(authoredDelegate);
        ExecutionLane preparation = admission.admit(preparationDelegate);
        CountDownLatch phaseOne = new CountDownLatch(1);
        CountDownLatch release = new CountDownLatch(1);
        java.util.List<String> commits = new java.util.concurrent.CopyOnWriteArrayList<>();

        authored.execute(() -> {
            commits.add("reserved");
            preparation.execute(() -> {
                phaseOne.countDown();
                await(release);
                commits.add("prepared");
                authored.execute(() -> commits.add("committed"));
            });
        });
        assertTrue(phaseOne.await(5, TimeUnit.SECONDS));

        var paused = admission.pauseAndDrain().toCompletableFuture();
        assertFalse(paused.isDone());
        assertThrows(RejectedExecutionException.class,
                () -> authored.execute(() -> commits.add("must-not-run")));
        release.countDown();
        paused.get(5, TimeUnit.SECONDS);
        assertEquals(java.util.List.of("reserved", "prepared", "committed"), commits);

        admission.resume();
        CountDownLatch resumed = new CountDownLatch(1);
        preparation.execute(resumed::countDown);
        assertTrue(resumed.await(5, TimeUnit.SECONDS));

        admission.revokeAndDrain().toCompletableFuture().get(5, TimeUnit.SECONDS);
        assertThrows(RejectedExecutionException.class, () -> preparation.execute(() -> { }));
        admission.closeDelegatesAfterDrain();
    }

    private static void await(CountDownLatch latch) {
        try {
            if (!latch.await(Duration.ofSeconds(5).toMillis(), TimeUnit.MILLISECONDS)) {
                throw new AssertionError("workflow phase timed out");
            }
        } catch (InterruptedException failure) {
            Thread.currentThread().interrupt();
            throw new AssertionError(failure);
        }
    }
}
