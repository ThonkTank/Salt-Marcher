package src.view.leftbartabs.scene;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
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
import javafx.scene.control.TextField;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import shell.api.ShellBinding;
import shell.api.ShellSlot;
import src.domain.party.published.ActivePartyModel;
import src.domain.party.published.ActivePartyResult;
import src.domain.party.published.PartyMemberSummary;
import src.domain.party.published.ReadStatus;
import src.domain.scene.SceneServiceAssembly;
import src.domain.scene.model.SceneWorkspace;
import src.domain.scene.model.repository.SceneWorkspaceRepository;
import src.domain.sessionplanner.published.PreparedSceneCatalog;
import src.domain.worldplanner.published.WorldPlannerReadStatus;
import src.domain.worldplanner.published.WorldPlannerSnapshot;
import src.domain.worldplanner.published.WorldPlannerSnapshotModel;

@org.junit.jupiter.api.Tag("ui")
final class SceneUiTest {
    private static final int AWAIT_SECONDS = 60;
    private static final AtomicBoolean FX_STARTED = new AtomicBoolean();

    @AfterAll
    static void stopFx() {
        if (FX_STARTED.get()) {
            testsupport.JavaFxRuntime.shutdown();
        }
    }

    @Test
    void sceneTabCreatesSplitAndMovesPcDirectly() throws Exception {
        runOnFxThread(() -> {
            SceneServiceAssembly scenes = services();
            ShellBinding binding = new SceneContribution(scenes).bind();
            Parent controls = (Parent) binding.slotContent().get(ShellSlot.COCKPIT_CONTROLS);
            Parent main = (Parent) binding.slotContent().get(ShellSlot.COCKPIT_MAIN);

            assertTrue(labels(main).containsAll(List.of("PCs", "NPCs", "Ort")));
            textField(controls, "Neue Szene").setText("Spähtrupp");
            button(controls, "Szene anlegen").fire();
            button(main, "Hierher").fire();

            assertEquals(2L, scenes.model().current().activePartyMembers().getFirst().sceneId());
            assertTrue(labels(main).stream().anyMatch(text -> text.contains("PC 1 · Stufe 3")));
        });
    }

    private static SceneServiceAssembly services() {
        ActivePartyModel party = new ActivePartyModel();
        party.publish(new ActivePartyResult(
                ReadStatus.SUCCESS,
                List.of(new PartyMemberSummary(1L, "PC 1", 3))));
        WorldPlannerSnapshotModel world = new WorldPlannerSnapshotModel();
        world.publish(new WorldPlannerSnapshot(
                WorldPlannerReadStatus.SUCCESS, List.of(), List.of(), List.of(), ""));
        return new SceneServiceAssembly(
                new MemoryRepository(),
                party,
                world,
                () -> new PreparedSceneCatalog(List.of(), ""),
                command -> new src.domain.encounter.published.EncounterRuntimeContextApi.SyncResult(true, ""));
    }

    private static TextField textField(Parent root, String prompt) {
        return descendants(root).stream()
                .filter(TextField.class::isInstance)
                .map(TextField.class::cast)
                .filter(field -> prompt.equals(field.getPromptText()))
                .findFirst()
                .orElseThrow();
    }

    private static Button button(Parent root, String text) {
        return descendants(root).stream()
                .filter(Button.class::isInstance)
                .map(Button.class::cast)
                .filter(button -> text.equals(button.getText()))
                .findFirst()
                .orElseThrow();
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
                nodes.add(content);
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
        private SceneWorkspace state;

        @Override
        public Optional<SceneWorkspace> load() {
            return Optional.ofNullable(state);
        }

        @Override
        public SceneWorkspace save(SceneWorkspace workspace) {
            state = workspace;
            return workspace;
        }
    }
}
