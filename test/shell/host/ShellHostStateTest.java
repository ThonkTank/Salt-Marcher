package shell.host;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import javafx.scene.Node;
import javafx.scene.Parent;
import javafx.scene.control.Label;
import javafx.scene.control.ToggleButton;
import javafx.scene.layout.VBox;
import org.junit.jupiter.api.Test;
import shell.api.ContributionKey;
import shell.api.NavigationGroupSpec;
import shell.api.ShellBinding;
import shell.api.ShellLeftBarTabMode;
import shell.api.ShellLeftBarTabSpec;

final class ShellHostStateTest {

    private static final long AWAIT_SECONDS = 30L;

    @Test
    void leftBarReadinessUsesContributionIdentityInsteadOfVisibleTitle() throws Exception {
        runOnFx(() -> {
            AppShell shell = new AppShell();
            ContributionKey sceneJourney = new ContributionKey("runtime-scenes");
            shell.registerLeftBarTab(
                    new ShellLeftBarTabSpec(
                            sceneJourney,
                            new NavigationGroupSpec("play", "Spielbetrieb", 1),
                            1,
                            true,
                            null,
                            ShellLeftBarTabMode.RUNTIME),
                    ShellBinding.cockpit("Escenas", new VBox(), new VBox()));

            assertEquals(1, shell.leftBarTabCount());
            assertTrue(shell.hasLeftBarTab(sceneJourney));
            assertFalse(shell.hasLeftBarTab(new ContributionKey("translated-visible-title")));
        });
    }

    @Test
    void soleStateTabRemainsReachableWithoutEagerlyAttachingItsContent() throws Exception {
        runOnFx(() -> {
            StateTabPane pane = new StateTabPane();
            Label encounter = new Label("Encounter content");
            pane.registerTab(new ContributionKey("encounter"), "Encounter", 30, encounter);

            ToggleButton button = stateButtons(pane).getFirst();
            assertEquals("Encounter", button.getText());
            assertTrue(button.isVisible());
            assertTrue(button.isManaged());
            assertFalse(descendants(pane).contains(encounter),
                    "registering one tab must not attach heavy state content");

            button.fire();

            assertTrue(button.isSelected());
            assertSame(encounter, attachedStateContent(pane));
        });
    }

    @Test
    void registeringMultipleStateTabsDoesNotEagerlyAttachDefaultContent() throws Exception {
        runOnFx(() -> {
            StateTabPane pane = new StateTabPane();
            Label encounter = new Label("Encounter content");
            Label travel = new Label("Travel content");

            pane.registerTab(new ContributionKey("encounter"), "Encounter", 30, encounter);
            pane.registerTab(new ContributionKey("travel"), "Reise", 40, travel);

            assertEquals(List.of("Encounter", "Reise"), stateButtons(pane).stream()
                    .map(ToggleButton::getText)
                    .toList());
            assertFalse(descendants(pane).contains(encounter));
            assertFalse(descendants(pane).contains(travel));
            assertTrue(descendants(pane).stream()
                    .filter(Label.class::isInstance)
                    .map(Label.class::cast)
                    .anyMatch(label -> "Kein Zustand verfügbar".equals(label.getText())
                            && label.getParent() != null));

            stateButtons(pane).getLast().fire();

            assertSame(travel, attachedStateContent(pane));
            assertFalse(descendants(pane).contains(encounter));
        });
    }

    private static Node attachedStateContent(StateTabPane pane) {
        return descendants(pane).stream()
                .filter(node -> node instanceof Label label
                        && ("Encounter content".equals(label.getText())
                                || "Travel content".equals(label.getText())))
                .filter(node -> node.getParent() != null)
                .findFirst()
                .orElseThrow();
    }

    private static List<ToggleButton> stateButtons(StateTabPane pane) {
        return descendants(pane).stream()
                .filter(ToggleButton.class::isInstance)
                .map(ToggleButton.class::cast)
                .toList();
    }

    private static List<Node> descendants(Parent root) {
        List<Node> descendants = new ArrayList<>();
        for (Node child : root.getChildrenUnmodifiable()) {
            descendants.add(child);
            if (child instanceof Parent parent) {
                descendants.addAll(descendants(parent));
            }
        }
        return descendants;
    }

    private static void runOnFx(ThrowingRunnable work) throws Exception {
        CountDownLatch completed = new CountDownLatch(1);
        AtomicReference<Throwable> failure = new AtomicReference<>();
        testsupport.JavaFxRuntime.startup(() -> {
            try {
                work.run();
            } catch (Throwable thrown) {
                failure.set(thrown);
            } finally {
                completed.countDown();
            }
        });
        if (!completed.await(AWAIT_SECONDS, TimeUnit.SECONDS)) {
            throw new AssertionError("Timed out waiting for JavaFX work");
        }
        Throwable thrown = failure.get();
        if (thrown instanceof Exception exception) {
            throw exception;
        }
        if (thrown instanceof Error error) {
            throw error;
        }
        if (thrown != null) {
            throw new AssertionError("JavaFX work failed", thrown);
        }
    }

    @FunctionalInterface
    private interface ThrowingRunnable {
        void run() throws Exception;
    }
}
