package features.sessionplanner.qualification;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import features.sessionplanner.adapter.javafx.SessionPlannerWorkspaceApplyObservation;
import features.sessionplanner.api.SessionPlannerWorkspaceSnapshot;
import features.sessionplanner.api.SessionPreparationStatus;
import java.nio.file.Path;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicReference;
import javafx.application.Platform;
import javafx.scene.Node;
import javafx.scene.Parent;
import javafx.scene.Scene;
import javafx.scene.control.Button;
import javafx.scene.control.TextField;
import javafx.scene.layout.HBox;
import javafx.stage.Stage;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import platform.diagnostics.Measurement;
import shell.api.ShellBinding;

/** End-to-end JavaFX apply qualification on the canonical production SQLite route. */
@org.junit.jupiter.api.Tag("ui")
final class SessionPlannerJavaFxProductionQualificationTest {

    private static final Duration TIMEOUT = Duration.ofSeconds(30);
    private static final int RUNS = 20;
    private static final List<String> PREPARATION_MEASUREMENTS = List.of(
            "sessionplanner.preparation.party-read",
            "sessionplanner.preparation.generation-draft",
            "sessionplanner.preparation.encounter-prepare",
            "sessionplanner.preparation.prepared-assembly",
            "sessionplanner.preparation.foreign-commits",
            "sessionplanner.preparation.planner-commit");
    private static final AtomicBoolean FX_STARTED = new AtomicBoolean();

    @TempDir
    Path temporaryDirectory;

    @BeforeAll
    static void startJavaFx() throws Exception {
        runOnFxThread(() -> { });
    }

    @AfterAll
    static void stopJavaFx() throws Exception {
        if (FX_STARTED.get()) {
            runOnFxThread(testsupport.JavaFxRuntime::shutdown);
        }
    }

    @Test
    void canonicalGeneratePublishesMatchingFullJavaFxApplyWithinTwoSecondP95() throws Exception {
        var diagnostics = new SessionPreparationProductionRouteTest.RecordingDiagnostics();
        Path database = temporaryDirectory.resolve("session-planner-javafx-production.sqlite");
        try (var fixture = SessionPreparationProductionRouteTest.ProductionFixture.openJavaFx(
                database, diagnostics)) {
            ApplyAwaiter applies = new ApplyAwaiter();
            AtomicReference<Stage> stage = new AtomicReference<>();
            AtomicReference<Parent> controls = new AtomicReference<>();
            runOnFxThread(() -> {
                ShellBinding binding = fixture.planner.contribution(applies::observe).bind();
                controls.set((Parent) binding.slotContent().get(shell.api.ShellSlot.COCKPIT_CONTROLS));
                descendants(controls.get()).stream().filter(TextField.class::isInstance).map(TextField.class::cast)
                        .filter(field -> "Auto".equals(field.getPromptText())).findFirst().orElseThrow()
                        .setText("3");
                HBox root = new HBox(binding.slotContent().values().toArray(Node[]::new));
                Stage window = new Stage();
                window.setScene(new Scene(root, 820.0, 500.0));
                window.show();
                root.applyCss();
                root.layout();
                stage.set(window);
            });

            qualifyAttempt(fixture, diagnostics, applies, controls.get(), false);
            List<Long> warmDurations = new ArrayList<>();
            List<Integer> applyUnits = new ArrayList<>();
            for (int run = 0; run < RUNS; run++) {
                QualifiedApply qualified = qualifyAttempt(fixture, diagnostics, applies, controls.get(), true);
                warmDurations.add(qualified.elapsedNanos());
                applyUnits.add(qualified.observation().materializedUnitCount());
            }

            List<Long> sorted = warmDurations.stream().sorted().toList();
            long p95Nanos = sorted.get(18);
            System.out.println("SESSION_PLANNER_JAVAFX_QUALIFICATION warmSortedNanos=" + sorted
                    + " p95Nanos=" + p95Nanos + " applyUnits=" + applyUnits);
            assertTrue(p95Nanos < Duration.ofSeconds(2).toNanos(),
                    () -> "Generate-to-full-JavaFX-apply p95 exceeded 2s: " + sorted);
            assertTrue(diagnostics.failures().isEmpty(), () -> "diagnostic failures=" + diagnostics.failures());
            runOnFxThread(() -> stage.get().close());
        }
    }

    private static QualifiedApply qualifyAttempt(
            SessionPreparationProductionRouteTest.ProductionFixture fixture,
            SessionPreparationProductionRouteTest.RecordingDiagnostics diagnostics,
            ApplyAwaiter applies,
            Parent controls,
            boolean replacementConfirmed
    ) throws Exception {
        long priorAttempt = fixture.planner.workspaceModel().current().preparation().attemptId();
        ApplyAwaiter.Awaiting ready;
        if (replacementConfirmed) {
            ApplyAwaiter.Awaiting confirming = applies.awaitAfter(
                    priorAttempt, SessionPreparationStatus.CONFIRMING_REPLACEMENT);
            runOnFxThread(() -> button(controls, "Generieren").fire());
            confirming.completion().get(TIMEOUT.toSeconds(), TimeUnit.SECONDS);
            ready = applies.awaitAfter(priorAttempt, SessionPreparationStatus.READY);
            runOnFxThread(() -> {
                ready.markDispatched();
                button(controls, "Ersetzen und generieren").fire();
            });
        } else {
            ready = applies.awaitAfter(priorAttempt, SessionPreparationStatus.READY);
            runOnFxThread(() -> {
                ready.markDispatched();
                button(controls, "Generieren").fire();
            });
        }
        QualifiedApply observed = ready.completion().get(TIMEOUT.toSeconds(), TimeUnit.SECONDS);
        SessionPlannerWorkspaceApplyObservation apply = observed.observation();
        SessionPlannerWorkspaceSnapshot snapshot = apply.snapshot();
        assertEquals(SessionPreparationStatus.READY, snapshot.preparation().status());
        assertTrue(snapshot.preparation().attemptId() > priorAttempt);
        assertEquals(snapshot, fixture.planner.workspaceModel().current(),
                "observation carries the exact READY snapshot synchronously applied by the contribution");
        assertEquals(expectedUnits(snapshot), apply.materializedUnitCount(),
                "production adapter materializes the exact master/detail unit formula");

        long attempt = snapshot.preparation().attemptId();
        List<Measurement> measurements = diagnostics.measurements().stream()
                .filter(item -> item.operationId() == attempt).toList();
        for (String id : PREPARATION_MEASUREMENTS) {
            assertEquals(1L, measurements.stream().filter(item -> item.id().value().equals(id)).count(), id);
        }
        assertEquals(1L, measurements.stream()
                .filter(item -> item.id().value().equals("sessionplanner.workspace.assembly")).count(),
                "one READY workspace assembly matches the attempt");
        List<Measurement> exactApply = measurements.stream()
                .filter(item -> item.id().value().equals("sessionplanner.javafx.workspace-apply"))
                .filter(item -> item.durationNanos() == apply.durationNanos())
                .filter(item -> item.cardinality() == apply.materializedUnitCount())
                .filter(item -> item.queryCount() == 0)
                .toList();
        assertEquals(1, exactApply.size(), "one diagnostic exactly matches the observed full JavaFX apply");
        return observed;
    }

    private static int expectedUnits(SessionPlannerWorkspaceSnapshot snapshot) {
        int count = snapshot.sceneTimeline().sceneHeaders().size()
                + snapshot.sceneTimeline().restGaps().size() + 1;
        if (!snapshot.selectedScene().available()) {
            return count;
        }
        var selected = snapshot.selectedScene();
        return count + 1 + selected.linkedEncounterRoster().size() + selected.manualLootNotes().size()
                + selected.generatedRewards().size()
                + selected.generatedRewards().stream().mapToInt(reward -> reward.itemLines().size()).sum()
                + selected.generatedRewards().stream().mapToInt(reward -> reward.packing().size()).sum()
                + selected.encounterPlanSearch().results().size();
    }

    private static void runOnFxThread(ThrowingRunnable action) throws Exception {
        CountDownLatch completed = new CountDownLatch(1);
        AtomicReference<Throwable> failure = new AtomicReference<>();
        Runnable wrapped = () -> {
            try {
                Platform.setImplicitExit(false);
                action.run();
            } catch (Throwable throwable) {
                failure.set(throwable);
            } finally {
                completed.countDown();
            }
        };
        if (FX_STARTED.compareAndSet(false, true)) {
            testsupport.JavaFxRuntime.startup(wrapped);
        } else {
            Platform.runLater(wrapped);
        }
        if (!completed.await(TIMEOUT.toSeconds(), TimeUnit.SECONDS)) {
            throw new IllegalStateException("Timed out waiting for JavaFX work");
        }
        if (failure.get() != null) {
            throw new IllegalStateException("JavaFX work failed", failure.get());
        }
    }

    private static Button button(Parent parent, String text) {
        return descendants(parent).stream().filter(Button.class::isInstance).map(Button.class::cast)
                .filter(item -> text.equals(item.getText())).findFirst()
                .orElseThrow(() -> new AssertionError("Button not found: " + text));
    }

    private static List<Node> descendants(Node node) {
        List<Node> result = new ArrayList<>();
        collect(node, result);
        return List.copyOf(result);
    }

    private static void collect(Node node, List<Node> result) {
        result.add(node);
        if (node instanceof javafx.scene.control.ScrollPane scroll && scroll.getContent() != null) {
            collect(scroll.getContent(), result);
        }
        if (node instanceof Parent parent) {
            parent.getChildrenUnmodifiable().forEach(child -> collect(child, result));
        }
    }

    private static final class ApplyAwaiter {
        private final AtomicReference<PendingApply> pending = new AtomicReference<>();

        private Awaiting awaitAfter(long priorAttempt, SessionPreparationStatus status) {
            CompletableFuture<QualifiedApply> completion = new CompletableFuture<>();
            AtomicLong dispatchNanos = new AtomicLong();
            pending.set(new PendingApply(priorAttempt, status, dispatchNanos, completion));
            return new Awaiting(dispatchNanos, completion);
        }

        private void observe(SessionPlannerWorkspaceApplyObservation observation) {
            PendingApply current = pending.get();
            if (current != null
                    && observation.snapshot().preparation().attemptId() > current.priorAttempt()
                    && observation.snapshot().preparation().status() == current.status()
                    && pending.compareAndSet(current, null)) {
                long started = current.dispatchNanos().get();
                current.completion().complete(new QualifiedApply(
                        observation, started <= 0L ? 0L : System.nanoTime() - started));
            }
        }

        private record Awaiting(AtomicLong dispatchNanos, CompletableFuture<QualifiedApply> completion) {
            private void markDispatched() {
                dispatchNanos.set(System.nanoTime());
            }
        }
    }

    private record PendingApply(
            long priorAttempt,
            SessionPreparationStatus status,
            AtomicLong dispatchNanos,
            CompletableFuture<QualifiedApply> completion
    ) {
    }

    private record QualifiedApply(SessionPlannerWorkspaceApplyObservation observation, long elapsedNanos) { }

    @FunctionalInterface
    private interface ThrowingRunnable {
        void run() throws Exception;
    }
}
