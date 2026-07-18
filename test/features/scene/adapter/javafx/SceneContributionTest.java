package features.scene.adapter.javafx;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import features.creatures.api.CreatureCatalogRow;
import features.creatures.api.CreatureReferenceIndexModel;
import features.creatures.api.CreatureReferenceIndexResult;
import features.creatures.api.CreatureReferenceIndexStatus;
import features.encounter.api.EncounterRuntimeContextApi;
import features.encounter.api.EncounterRuntimeContextSyncResult;
import features.party.api.ActivePartyModel;
import features.party.api.ActivePartyResult;
import features.party.api.PartyMemberSummary;
import features.party.api.ReadStatus;
import features.scene.application.SceneApplicationService;
import features.scene.application.SceneWorkspaceRepository;
import features.scene.domain.SceneWorkspace;
import features.sessionplanner.api.PreparedSceneCatalogModel;
import features.sessionplanner.api.PreparedSceneCatalogSnapshot;
import features.worldplanner.api.WorldPlannerReadStatus;
import features.worldplanner.api.WorldPlannerSnapshot;
import features.worldplanner.api.WorldPlannerSnapshotModel;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;
import javafx.application.Platform;
import javafx.scene.Node;
import javafx.scene.Parent;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.control.ScrollPane;
import javafx.scene.control.TextArea;
import javafx.scene.control.TextField;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import platform.diagnostics.NoopDiagnostics;
import platform.execution.DirectExecutionLane;
import platform.ui.DirectUiDispatcher;
import shell.api.ShellBinding;
import shell.api.ShellSlot;

@org.junit.jupiter.api.Tag("ui")
final class SceneContributionTest {

    private static final int AWAIT_SECONDS = 60;
    private static final AtomicBoolean FX_STARTED = new AtomicBoolean();

    @AfterAll
    static void stopFx() {
        if (FX_STARTED.get()) {
            testsupport.JavaFxRuntime.shutdown();
        }
    }

    @Test
    void contributionInitializesCreatesAndMovesPcThroughProductionCommands() throws Exception {
        runOnFxThread(() -> {
            SceneApplicationService application = application();
            ShellBinding binding = new SceneContribution(application, application.model(), statblockId -> { }).bind();
            assertFalse(binding.slotContent().containsKey(ShellSlot.COCKPIT_STATE));

            binding.onActivate();
            Parent controls = (Parent) binding.slotContent().get(ShellSlot.COCKPIT_CONTROLS);
            Parent main = (Parent) binding.slotContent().get(ShellSlot.COCKPIT_MAIN);
            textField(controls, "Neue Szene").setText("Spähtrupp");
            button(controls, "Szene anlegen").fire();
            button(main, "Hierher").fire();

            assertEquals(2L, application.model().current().activePartyMembers().getFirst().sceneId());
            assertEquals("", textField(controls, "Neue Szene").getText());
            assertTrue(labels(main).containsAll(List.of("Party", "NPCs", "Mobs")));
            assertTrue(labels(main).contains("PC 1"));
            assertTrue(labels(main).stream().anyMatch(text -> text.contains("Stufe 3")));
        });
    }

    @Test
    void deleteRequiresExplicitConfirmationAndCancelKeepsScene() throws Exception {
        runOnFxThread(() -> {
            SceneApplicationService application = application();
            ShellBinding binding = new SceneContribution(application, application.model(), statblockId -> { }).bind();
            binding.onActivate();
            Parent controls = (Parent) binding.slotContent().get(ShellSlot.COCKPIT_CONTROLS);

            textField(controls, "Neue Szene").setText("Nebenraum");
            button(controls, "Szene anlegen").fire();
            button(controls, "Löschen").fire();

            assertEquals(2, application.model().current().scenes().size());
            assertTrue(labels(controls).contains("Szene und zugehörigen Encounter-Kontext wirklich löschen?"));
            button(controls, "Abbrechen").fire();
            assertEquals(2, application.model().current().scenes().size());

            button(controls, "Löschen").fire();
            button(controls, "Endgültig löschen").fire();
            assertEquals(1, application.model().current().scenes().size());
            assertTrue(application.model().current().scenes().getFirst().defaultScene());
        });
    }

    @Test
    void foreignFactPublicationKeepsUnsavedSceneAndCreationDrafts() throws Exception {
        runOnFxThread(() -> {
            SceneApplicationService application = application();
            ShellBinding binding = new SceneContribution(application, application.model(), statblockId -> { }).bind();
            binding.onActivate();
            Parent controls = (Parent) binding.slotContent().get(ShellSlot.COCKPIT_CONTROLS);
            Parent main = (Parent) binding.slotContent().get(ShellSlot.COCKPIT_MAIN);

            textField(controls, "Neue Szene").setText("Noch nicht angelegt");
            sceneTitleField(main).setText("Ungespeicherter Titel");
            textArea(main, "Szenennotizen").setText("Ungespeicherte Notiz");

            application.execute(new features.scene.api.SceneCommand.Refresh()).toCompletableFuture().join();

            assertEquals("Noch nicht angelegt", textField(controls, "Neue Szene").getText());
            assertEquals("Ungespeicherter Titel", sceneTitleField(main).getText());
            assertEquals("Ungespeicherte Notiz", textArea(main, "Szenennotizen").getText());

            button(main, "Szene speichern").fire();
            application.execute(new features.scene.api.SceneCommand.Refresh()).toCompletableFuture().join();

            assertEquals("Ungespeicherter Titel", sceneTitleField(main).getText());
            assertEquals("Ungespeicherte Notiz", textArea(main, "Szenennotizen").getText());
            assertEquals("Ungespeicherter Titel", application.model().current().scenes().getFirst().title());
            assertEquals("Noch nicht angelegt", textField(controls, "Neue Szene").getText());
        });
    }

    private static SceneApplicationService application() {
        ActivePartyResult party = new ActivePartyResult(
                ReadStatus.SUCCESS, List.of(new PartyMemberSummary(1L, "PC 1", 3)));
        ActivePartyModel partyModel = new ActivePartyModel(() -> party, ignored -> () -> { });
        WorldPlannerSnapshot world = new WorldPlannerSnapshot(
                WorldPlannerReadStatus.SUCCESS, List.of(), List.of(), List.of(), "");
        WorldPlannerSnapshotModel worldModel = new WorldPlannerSnapshotModel(
                () -> world, ignored -> () -> { },
                listener -> { listener.accept(world); return () -> { }; });
        PreparedSceneCatalogModel prepared = new PreparedSceneCatalogModel(
                PreparedSceneCatalogSnapshot::empty, ignored -> { });
        EncounterRuntimeContextApi encounters = command -> CompletableFuture.completedFuture(
                new EncounterRuntimeContextSyncResult(
                        EncounterRuntimeContextSyncResult.Status.APPLIED,
                        command.sourceRevision(),
                        "applied"));
        return new SceneApplicationService(
                new MemoryRepository(),
                partyModel,
                worldModel,
                prepared,
                encounters,
                catalog(),
                DirectExecutionLane.INSTANCE,
                DirectUiDispatcher.INSTANCE,
                NoopDiagnostics.INSTANCE);
    }

    private static CreatureReferenceIndexModel catalog() {
        CreatureReferenceIndexResult result = new CreatureReferenceIndexResult(
                CreatureReferenceIndexStatus.SUCCESS,
                1L,
                List.of(new CreatureCatalogRow(
                        101L, "Goblin", "Klein", "Humanoid", "neutral böse", "1/4", 50, 7, 15)));
        return new CreatureReferenceIndexModel(
                () -> result, ignored -> () -> { },
                listener -> { listener.accept(result); return () -> { }; });
    }

    private static TextField textField(Parent root, String prompt) {
        return descendants(root).stream()
                .filter(TextField.class::isInstance)
                .map(TextField.class::cast)
                .filter(field -> prompt.equals(field.getPromptText()))
                .findFirst().orElseThrow();
    }

    private static Button button(Parent root, String text) {
        return descendants(root).stream()
                .filter(Button.class::isInstance)
                .map(Button.class::cast)
                .filter(candidate -> text.equals(candidate.getText()))
                .findFirst().orElseThrow();
    }

    private static TextField sceneTitleField(Parent root) {
        return descendants(root).stream()
                .filter(TextField.class::isInstance)
                .map(TextField.class::cast)
                .filter(field -> field.getPromptText() == null || field.getPromptText().isBlank())
                .findFirst().orElseThrow();
    }

    private static TextArea textArea(Parent root, String prompt) {
        return descendants(root).stream()
                .filter(TextArea.class::isInstance)
                .map(TextArea.class::cast)
                .filter(area -> prompt.equals(area.getPromptText()))
                .findFirst().orElseThrow();
    }

    private static List<String> labels(Parent root) {
        return descendants(root).stream()
                .filter(Label.class::isInstance)
                .map(Label.class::cast)
                .map(Label::getText)
                .toList();
    }

    private static List<Node> descendants(Parent root) {
        List<Node> nodes = new ArrayList<>();
        for (Node child : root.getChildrenUnmodifiable()) {
            nodes.add(child);
            if (child instanceof ScrollPane scroll && scroll.getContent() instanceof Parent content) {
                nodes.addAll(descendants(content));
            }
            if (child instanceof Parent parent) {
                nodes.addAll(descendants(parent));
            }
        }
        return nodes;
    }

    private static void runOnFxThread(Runnable action) throws Exception {
        startFx();
        CountDownLatch latch = new CountDownLatch(1);
        AtomicReference<Throwable> failure = new AtomicReference<>();
        Platform.runLater(() -> {
            try {
                action.run();
            } catch (Throwable throwable) {
                failure.set(throwable);
            } finally {
                latch.countDown();
            }
        });
        if (!latch.await(AWAIT_SECONDS, TimeUnit.SECONDS)) {
            throw new AssertionError("FX test timed out.");
        }
        if (failure.get() != null) {
            throw new AssertionError("FX test failed.", failure.get());
        }
    }

    private static void startFx() throws InterruptedException {
        if (FX_STARTED.compareAndSet(false, true)) {
            CountDownLatch latch = new CountDownLatch(1);
            testsupport.JavaFxRuntime.startup(latch::countDown);
            if (!latch.await(AWAIT_SECONDS, TimeUnit.SECONDS)) {
                throw new AssertionError("FX startup timed out.");
            }
        }
    }

    private static final class MemoryRepository implements SceneWorkspaceRepository {
        private SceneWorkspace workspace;

        @Override
        public Optional<SceneWorkspace> load() {
            return Optional.ofNullable(workspace);
        }

        @Override
        public void save(SceneWorkspace nextWorkspace) {
            workspace = nextWorkspace;
        }
    }
}
