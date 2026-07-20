package features.travel.adapter.javafx;

import features.travel.api.TravelContextKind;
import features.travel.api.TravelContextModel;
import features.travel.api.TravelContextSnapshot;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import javafx.application.Platform;
import javafx.scene.Node;
import javafx.scene.Parent;
import javafx.scene.control.Label;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import platform.state.PublishedState;
import shell.api.ShellBinding;
import shell.api.ShellSlot;

@org.junit.jupiter.api.Tag("ui")
public final class TravelStateTest {

    private static final AtomicBoolean FX_STARTED = new AtomicBoolean();
    private static final int AWAIT_SECONDS = 10;

    @BeforeAll
    static void startJavaFx() throws InterruptedException {
        startFx();
    }

    @AfterAll
    static void stopJavaFx() throws InterruptedException {
        shutdownFx();
    }

    @Test
    void noContextIsExplicitAndReadOnly() throws Exception {
        runOnFxThread(() -> {
            TravelStateView view = view(TravelContextSnapshot.none(3L));
            assertTextPresent(view, "W", "no-context icon");
            assertTextPresent(view, "Kein Reiseort gewaehlt", "no-context location");
            assertTextPresent(view, "Kein Reisekontext", "no-context status");
            assertTextPresent(view, "\u2014", "no-context kind");
        });
    }

    @Test
    void hexContextKeepsTheCompactOverworldStructure() throws Exception {
        runOnFxThread(() -> {
            TravelStateView view = view(new TravelContextSnapshot(
                    1L, 4L, 8L, TravelContextKind.HEX, 9L,
                    "Westmark 2,-1", "", "2,-1", "", "Reisend",
                    "Reisegruppe auf der Hex-Karte bewegen", "nicht verfuegbar",
                    "nicht verfuegbar", "Normal"));
            assertTextPresent(view, "H", "Hex icon");
            assertTextPresent(view, "Westmark 2,-1", "Hex location");
            assertTextPresent(view, "Hex-Reise", "Hex context");
            assertTextPresent(view, "Wetter", "Hex weather key");
            assertTextPresent(view, "Tageszeit", "Hex time key");
            assertTextPresent(view, "Tempo", "Hex pace key");
        });
    }

    @Test
    void dungeonContextShowsMapAreaTileHeadingAndOutcome() throws Exception {
        runOnFxThread(() -> {
            TravelStateView view = view(new TravelContextSnapshot(
                    2L, 7L, 12L, TravelContextKind.DUNGEON, 5L,
                    "Tiefenhallen", "Nordkammer", "2,3 / Ebene 0", "Norden",
                    "Bewegung blockiert", "Zielfeld ist nicht erreichbar.", "", "", ""));
            assertTextPresent(view, "D", "Dungeon icon");
            assertTextPresent(view, "Tiefenhallen", "Dungeon map");
            assertTextPresent(view, "Dungeon-Reise", "Dungeon context");
            assertTextPresent(view, "Bereich", "Dungeon area key");
            assertTextPresent(view, "Nordkammer", "Dungeon area");
            assertTextPresent(view, "Feld", "Dungeon tile key");
            assertTextPresent(view, "Blick", "Dungeon heading key");
            assertTextPresent(view, "Bewegung blockiert", "Dungeon outcome");
        });
    }

    private static TravelStateView view(TravelContextSnapshot snapshot) {
        PublishedState<TravelContextSnapshot> state = new PublishedState<>(snapshot);
        TravelContextModel model = new TravelContextModel(state::current, state::subscribe);
        ShellBinding binding = new TravelStateContribution(model).bind();
        Node node = binding.slotContent().get(ShellSlot.COCKPIT_STATE);
        if (node instanceof TravelStateView view) {
            return view;
        }
        throw new IllegalStateException("Expected TravelStateView in COCKPIT_STATE.");
    }

    private static List<Label> labels(Node root) {
        List<Label> labels = new ArrayList<>();
        collectLabels(root, labels);
        return labels;
    }

    private static void collectLabels(Node node, List<Label> labels) {
        if (node instanceof Label label) {
            labels.add(label);
        }
        if (node instanceof Parent parent) {
            parent.getChildrenUnmodifiable().forEach(child -> collectLabels(child, labels));
        }
    }

    private static void assertTextPresent(Node root, String expected, String message) {
        boolean found = labels(root).stream().map(Label::getText).anyMatch(expected::equals);
        if (!found) {
            throw new IllegalStateException(message + " expected visible text <" + expected + ">.");
        }
    }

    private static void startFx() throws InterruptedException {
        if (FX_STARTED.compareAndSet(false, true)) {
            CountDownLatch started = new CountDownLatch(1);
            testsupport.JavaFxRuntime.startup(started::countDown);
            await(started, "JavaFX startup");
        }
    }

    private static void shutdownFx() throws InterruptedException {
        if (FX_STARTED.compareAndSet(true, false)) {
            CountDownLatch stopped = new CountDownLatch(1);
            Platform.runLater(() -> {
                stopped.countDown();
                testsupport.JavaFxRuntime.shutdown();
            });
            await(stopped, "JavaFX shutdown");
        }
    }

    private static void runOnFxThread(Runnable action) throws InterruptedException {
        CountDownLatch finished = new CountDownLatch(1);
        RuntimeException[] failure = new RuntimeException[1];
        Platform.runLater(() -> {
            try {
                action.run();
            } catch (RuntimeException exception) {
                failure[0] = exception;
            } finally {
                finished.countDown();
            }
        });
        await(finished, "JavaFX test action");
        if (failure[0] != null) {
            throw failure[0];
        }
    }

    private static void await(CountDownLatch latch, String description) throws InterruptedException {
        if (!latch.await(AWAIT_SECONDS, TimeUnit.SECONDS)) {
            throw new IllegalStateException(description + " timed out.");
        }
    }
}
