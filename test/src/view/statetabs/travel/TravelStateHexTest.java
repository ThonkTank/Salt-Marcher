package src.view.statetabs.travel;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import javafx.application.Platform;
import javafx.scene.Node;
import javafx.scene.Parent;
import javafx.scene.control.Label;
import shell.api.InspectorEntrySpec;
import shell.api.InspectorSink;
import shell.api.ServiceRegistry;
import shell.api.ShellBinding;
import shell.api.ShellRuntimeContext;
import shell.api.ShellSlot;
import src.domain.hex.HexEditorApplicationService;
import src.domain.hex.model.map.HexCoordinate;
import src.domain.hex.published.CreateHexMapCommand;
import src.domain.hex.published.HexEditorModel;
import src.domain.hex.published.HexTravelModel;
import src.domain.party.PartyApplicationService;
import src.domain.party.published.CharacterDraft;
import src.domain.party.published.CreateCharacterCommand;
import src.domain.party.published.MembershipState;
import src.domain.party.published.MovePartyCharactersCommand;
import src.domain.party.published.PartyOverworldTravelLocationSnapshot;
import src.domain.party.published.PartySnapshotModel;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

@org.junit.jupiter.api.Tag("ui")
public final class TravelStateHexTest {

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
    void HEX_TRAVEL_STATE_001() throws Exception {
        runOnFxThread(TravelStateHexTest::assertEmptyHexTravelState);
    }

    @Test
    void HEX_TRAVEL_STATE_002() throws Exception {
        runOnFxThread(TravelStateHexTest::assertCompactHexTravelReadback);
    }

    private static void assertEmptyHexTravelState() {
        ServiceRegistry services = productionServices();
        ShellBinding binding = new TravelStateContribution().bind(runtimeContext(services));
        TravelStateView view = travelStateView(binding);
        assertTextPresent(view, "W", "HEX-TRAVEL-STATE-001 empty icon");
        assertTextPresent(view, "Kein Hex-Ort gewaehlt", "HEX-TRAVEL-STATE-001 empty location");
        assertTextPresent(view, "\u2014", "HEX-TRAVEL-STATE-001 empty context");
    }

    private static void assertCompactHexTravelReadback() {
        ServiceRegistry services = productionServices();
        ShellBinding binding = new TravelStateContribution().bind(runtimeContext(services));
        TravelStateView view = travelStateView(binding);
        HexEditorApplicationService editor = services.require(HexEditorApplicationService.class);
        editor.createMap(new CreateHexMapCommand("Westmark", 2));
        long mapId = services.require(HexEditorModel.class).current().selectedMap()
                .orElseThrow(() -> new IllegalStateException("HEX-TRAVEL-STATE-002 expected selected Hex map."))
                .mapId()
                .value();
        PartyApplicationService party = services.require(PartyApplicationService.class);
        party.createCharacter(new CreateCharacterCommand(
                new CharacterDraft("Travel Guide", "Player", 3, 12, 14),
                MembershipState.ACTIVE));
        long characterId = services.require(PartySnapshotModel.class).current().snapshot().activeMembers().stream()
                .map(src.domain.party.published.PartyMemberDetails::id)
                .filter(id -> id != null && id > 0L)
                .reduce((first, second) -> second)
                .orElseThrow(() -> new IllegalStateException("HEX-TRAVEL-STATE-002 expected party member id."));
        party.moveCharacters(new MovePartyCharactersCommand(
                List.of(characterId),
                new PartyOverworldTravelLocationSnapshot(mapId, new HexCoordinate(2, -1).stableTileId()),
                true));

        assertTextPresent(view, "H", "HEX-TRAVEL-STATE-002 active icon");
        assertTextPresent(view, "Westmark 2,-1", "HEX-TRAVEL-STATE-002 active location");
        assertTextPresent(view, "Reisend", "HEX-TRAVEL-STATE-002 active status");
        assertTextPresent(view, "Hex-Reise", "HEX-TRAVEL-STATE-002 active context");
        assertTextPresent(view, "Wetter", "HEX-TRAVEL-STATE-002 weather key");
        assertTextPresent(view, "Tageszeit", "HEX-TRAVEL-STATE-002 time of day key");
        assertTextPresent(view, "Tempo", "HEX-TRAVEL-STATE-002 pace key");
        assertTextCount(view, "nicht verfuegbar", 2, "HEX-TRAVEL-STATE-002 weather/time fallback");
        assertTextPresent(view, "Normal", "HEX-TRAVEL-STATE-002 pace");
        assertTextPresent(view, "Reisegruppe auf der Hex-Karte bewegen", "HEX-TRAVEL-STATE-002 hint");
    }

    private static ServiceRegistry productionServices() {
        ServiceRegistry.Builder builder = new ServiceRegistry.Builder();
        new src.data.hex.HexServiceContribution().register(builder);
        new src.data.party.PartyServiceContribution().register(builder);
        new src.domain.party.PartyServiceContribution().register(builder);
        new src.domain.hex.HexServiceContribution().register(builder);
        return builder.build();
    }

    private static ShellRuntimeContext runtimeContext(ServiceRegistry services) {
        if (services.require(HexTravelModel.class) == null) {
            throw new IllegalStateException("Expected HexTravelModel in production services.");
        }
        return new ShellRuntimeContext(new NoopInspectorSink(), services);
    }

    private static TravelStateView travelStateView(ShellBinding binding) {
        Node node = binding.slotContent().get(ShellSlot.COCKPIT_STATE);
        if (node instanceof TravelStateView view) {
            return view;
        }
        throw new IllegalStateException("Expected TravelStateView bound in COCKPIT_STATE.");
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
            for (Node child : parent.getChildrenUnmodifiable()) {
                collectLabels(child, labels);
            }
        }
    }

    private static void assertTextPresent(Node root, String expected, String message) {
        boolean found = labels(root).stream()
                .map(Label::getText)
                .anyMatch(expected::equals);
        if (!found) {
            throw new IllegalStateException(message + " expected visible text <" + expected + ">.");
        }
    }

    private static void assertTextCount(Node root, String expected, long count, String message) {
        long actual = labels(root).stream()
                .map(Label::getText)
                .filter(expected::equals)
                .count();
        if (actual != count) {
            throw new IllegalStateException(message + " expected " + count
                    + " visible text nodes <" + expected + "> but found " + actual + ".");
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

    private static void runOnFxThread(ThrowingRunnable action) throws Exception {
        CountDownLatch finished = new CountDownLatch(1);
        RuntimeException[] failure = new RuntimeException[1];
        Platform.runLater(() -> {
            try {
                action.run();
            } catch (RuntimeException exception) {
                failure[0] = exception;
            } catch (Exception exception) {
                failure[0] = new RuntimeException(exception);
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

    private interface ThrowingRunnable {

        void run() throws Exception;
    }

    private static final class NoopInspectorSink implements InspectorSink {

        @Override
        public void push(InspectorEntrySpec entry) {
            // No inspector interaction is expected from the compact travel state binding.
        }

        @Override
        public void clear() {
            // No inspector interaction is expected from the compact travel state binding.
        }

        @Override
        public boolean isShowing(Object entryKey) {
            return false;
        }
    }
}
