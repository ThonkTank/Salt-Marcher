package src.view.dropdowns.party;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import javafx.application.Platform;
import javafx.scene.Node;
import javafx.scene.Parent;
import javafx.scene.Scene;
import javafx.scene.control.Button;
import javafx.scene.control.TextField;
import javafx.scene.layout.HBox;
import javafx.stage.Stage;
import javafx.stage.Window;
import shell.api.InspectorEntrySpec;
import shell.api.InspectorSink;
import shell.api.ServiceRegistry;
import shell.api.ShellBinding;
import shell.api.ShellRuntimeContext;
import shell.api.ShellSlot;
import src.domain.party.published.ActivePartyCompositionModel;
import src.domain.party.published.ActivePartyModel;
import src.domain.party.published.PartyMemberDetails;
import src.domain.party.published.PartySnapshotModel;
import src.domain.party.published.ReadStatus;

public final class PartyDropdownHarness {

    private static final int AWAIT_SECONDS = 30;
    private static final AtomicBoolean FX_STARTED = new AtomicBoolean();

    private PartyDropdownHarness() {
    }

    public static void main(String[] args) throws Exception {
        try {
            runOnFxThread(PartyDropdownHarness::runHarness);
            shutdownFx();
            System.out.println("Party dropdown harness passed.");
        } catch (Throwable throwable) {
            throwable.printStackTrace(System.err);
            shutdownFx();
            System.exit(1);
        }
    }

    private static void runHarness() {
        ServiceRegistry services = services();
        PartySnapshotModel snapshots = services.require(PartySnapshotModel.class);
        ActivePartyModel activeParty = services.require(ActivePartyModel.class);
        ActivePartyCompositionModel activeComposition = services.require(ActivePartyCompositionModel.class);
        ShellBinding binding = new PartyTopBarContribution().bind(
                new ShellRuntimeContext(NoopInspectorSink.INSTANCE, services));
        Parent topBar = slot(binding, ShellSlot.TOP_BAR, Parent.class);
        HBox root = new HBox(topBar);
        Stage stage = new Stage();
        stage.setScene(new Scene(root, 520.0, 420.0));
        stage.show();
        layout(root);

        Button trigger = descendant(topBar, Button.class);
        assertEquals("Keine _Party ▼", trigger.getText(), "PARTY-DROPDOWN-001 initial trigger readback");
        trigger.fire();
        layoutOpenWindows();
        assertEquals(PartyTopBarView.OPEN_ACCESSIBLE_TEXT, trigger.getAccessibleText(),
                "PARTY-DROPDOWN-001 trigger exposes open popup state");
        Parent popup = partyPopupRoot();
        assertRosterCounts(popup, 0, 0, "PARTY-DROPDOWN-001 initial empty roster");

        button(popup, "+ Neuer Charakter").fire();
        layoutOpenWindows();
        setText(popup, "Charaktername", "Aria");
        setText(popup, "Spielername", "Mira");
        setText(popup, "Level", "3");
        setText(popup, "Passive Perception", "14");
        setText(popup, "AC", "16");
        button(popup, "Erstellen").fire();
        layoutOpenWindows();

        PartyMemberDetails aria = onlyActiveMember(snapshots);
        assertEquals("Aria", aria.name(), "created character name");
        assertRosterCounts(popup, 1, 0, "PARTY-DROPDOWN-002 created character is active");
        assertActivePublication(activeParty, activeComposition, List.of(aria.id()), List.of(3));
        assertEquals("1 Charaktere, Ø Lv 3 ▼", trigger.getText(),
                "PARTY-DROPDOWN-002 top-bar trigger reflects active published party");

        buttonByAccessibleText(popup, "Entfernen, aus aktiver Party entfernen: Aria").fire();
        layoutOpenWindows();
        assertRosterCounts(popup, 0, 1, "PARTY-DROPDOWN-003 remove moves character to reserve");
        assertActivePublication(activeParty, activeComposition, List.of(), List.of());

        buttonByAccessibleText(popup, "Aria (Lv 3), zur aktiven Party hinzufuegen").fire();
        layoutOpenWindows();
        assertRosterCounts(popup, 1, 0, "PARTY-DROPDOWN-004 add existing restores active party selection");
        assertActivePublication(activeParty, activeComposition, List.of(aria.id()), List.of(3));
        assertEquals("1 Charaktere, Ø Lv 3 ▼", trigger.getText(),
                "PARTY-DROPDOWN-004 top-bar trigger reflects restored active party");
    }

    private static ServiceRegistry services() {
        ServiceRegistry.Builder builder = new ServiceRegistry.Builder();
        new src.data.party.PartyServiceContribution().register(builder);
        new src.domain.party.PartyServiceContribution().register(builder);
        return builder.build();
    }

    private static PartyMemberDetails onlyActiveMember(PartySnapshotModel snapshots) {
        assertEquals(ReadStatus.SUCCESS, snapshots.current().status(), "party snapshot status");
        List<PartyMemberDetails> activeMembers = snapshots.current().snapshot().activeMembers();
        assertEquals(Integer.valueOf(1), Integer.valueOf(activeMembers.size()), "active member count");
        return activeMembers.getFirst();
    }

    private static void assertRosterCounts(
            Parent popup,
            int activeCount,
            int reserveCount,
            String label
    ) {
        assertEquals(Long.valueOf(activeCount), Long.valueOf(buttonsByText(popup, "Entfernen")),
                label + " active count");
        assertEquals(Long.valueOf(reserveCount), Long.valueOf(buttonsContaining(popup, "zur aktiven Party")),
                label + " reserve count");
        assertVisibleText(popup, activeCount == 0 ? "Keine aktiven Party-Mitglieder" : "Aria",
                label + " visible active roster");
        assertNoVisibleText(popup, "Party konnte nicht geladen werden.", label + " has no storage error");
    }

    private static void assertActivePublication(
            ActivePartyModel activeParty,
            ActivePartyCompositionModel activeComposition,
            List<Long> memberIds,
            List<Integer> levels
    ) {
        assertEquals(ReadStatus.SUCCESS, activeParty.current().status(), "active party status");
        assertEquals(memberIds, activeParty.current().memberIds(), "active party ids");
        assertEquals(ReadStatus.SUCCESS, activeComposition.current().status(), "active composition status");
        assertEquals(levels, activeComposition.current().composition().activePartyLevels(),
                "active composition levels");
    }

    private static void assertEquals(Object expected, Object actual, String label) {
        if (!java.util.Objects.equals(expected, actual)) {
            throw new AssertionError(label + ": expected <" + expected + "> but was <" + actual + ">.");
        }
    }

    private static void assertTrue(boolean condition, String label) {
        if (!condition) {
            throw new AssertionError(label);
        }
    }

    private static void assertVisibleText(Parent parent, String text, String label) {
        assertTrue(descendants(parent).stream().anyMatch(node -> textValue(node).contains(text) && node.isVisible()), label);
    }

    private static void assertNoVisibleText(Parent parent, String text, String label) {
        assertTrue(descendants(parent).stream().noneMatch(node -> text.equals(textValue(node)) && node.isVisible()), label);
    }

    private static long buttonsByText(Parent parent, String text) {
        return descendants(parent).stream()
                .filter(Button.class::isInstance)
                .map(Button.class::cast)
                .filter(button -> text.equals(button.getText()))
                .filter(Node::isVisible)
                .count();
    }

    private static long buttonsContaining(Parent parent, String text) {
        return descendants(parent).stream()
                .filter(Button.class::isInstance)
                .map(Button.class::cast)
                .filter(button -> button.getAccessibleText() != null && button.getAccessibleText().contains(text))
                .filter(Node::isVisible)
                .count();
    }

    private static Button button(Parent parent, String text) {
        return descendants(parent).stream()
                .filter(Button.class::isInstance)
                .map(Button.class::cast)
                .filter(button -> text.equals(button.getText()))
                .filter(Node::isVisible)
                .findFirst()
                .orElseThrow(() -> new AssertionError("Button not found: " + text));
    }

    private static Button buttonByAccessibleText(Parent parent, String accessibleText) {
        return descendants(parent).stream()
                .filter(Button.class::isInstance)
                .map(Button.class::cast)
                .filter(button -> accessibleText.equals(button.getAccessibleText()))
                .filter(Node::isVisible)
                .findFirst()
                .orElseThrow(() -> new AssertionError("Button not found: " + accessibleText));
    }

    private static void setText(Parent parent, String promptText, String value) {
        descendants(parent).stream()
                .filter(TextField.class::isInstance)
                .map(TextField.class::cast)
                .filter(field -> promptText.equals(field.getPromptText()))
                .findFirst()
                .orElseThrow(() -> new AssertionError("TextField not found: " + promptText))
                .setText(value);
    }

    private static String textValue(Node node) {
        if (node instanceof Button button) {
            return button.getText();
        }
        if (node instanceof javafx.scene.control.Label label) {
            return label.getText();
        }
        return "";
    }

    private static Parent partyPopupRoot() {
        for (Window window : Window.getWindows()) {
            Scene scene = window.getScene();
            if (scene == null || scene.getRoot() == null) {
                continue;
            }
            Parent root = scene.getRoot();
            boolean containsPartyPanel = descendants(root).stream().anyMatch(PartyTopBarView.class::isInstance);
            if (containsPartyPanel) {
                return root;
            }
        }
        throw new AssertionError("Party popup root not found.");
    }

    private static <T extends Node> T descendant(Parent parent, Class<T> type) {
        return descendants(parent).stream()
                .filter(type::isInstance)
                .map(type::cast)
                .findFirst()
                .orElseThrow(() -> new AssertionError("Descendant not found: " + type.getSimpleName()));
    }

    private static <T extends Node> T slot(ShellBinding binding, ShellSlot slot, Class<T> type) {
        Map<ShellSlot, Node> content = binding.slotContent();
        Node node = content.get(slot);
        if (type.isInstance(node)) {
            return type.cast(node);
        }
        throw new AssertionError("Shell slot not found: " + slot);
    }

    private static List<Node> descendants(Node node) {
        ArrayList<Node> result = new ArrayList<>();
        collect(node, result);
        return List.copyOf(result);
    }

    private static void collect(Node node, List<Node> result) {
        result.add(node);
        if (node instanceof Parent parent) {
            for (Node child : parent.getChildrenUnmodifiable()) {
                collect(child, result);
            }
        }
    }

    private static void layout(Parent parent) {
        parent.applyCss();
        parent.layout();
    }

    private static void layoutOpenWindows() {
        for (Window window : Window.getWindows()) {
            Scene scene = window.getScene();
            if (scene != null && scene.getRoot() != null) {
                layout(scene.getRoot());
            }
        }
    }

    private static void runOnFxThread(ThrowingRunnable action) throws Exception {
        CountDownLatch latch = new CountDownLatch(1);
        Throwable[] failure = new Throwable[1];
        Runnable wrappedAction = () -> {
            try {
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
            throw new IllegalStateException("Timed out waiting for JavaFX Party dropdown harness.");
        }
        if (failure[0] != null) {
            throw new IllegalStateException("Party dropdown harness failed.", failure[0]);
        }
    }

    private static void shutdownFx() throws Exception {
        if (!FX_STARTED.get()) {
            return;
        }
        runOnFxThread(() -> {
            for (Window window : List.copyOf(Window.getWindows())) {
                window.hide();
            }
            Platform.exit();
        });
    }

    @FunctionalInterface
    private interface ThrowingRunnable {

        void run() throws Exception;
    }

    private enum NoopInspectorSink implements InspectorSink {
        INSTANCE;

        @Override
        public void push(InspectorEntrySpec entry) {
        }

        @Override
        public void clear() {
        }

        @Override
        public boolean isShowing(Object entryKey) {
            return false;
        }
    }
}
