package features.worldplanner.adapter.javafx;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import features.worldplanner.api.AddWorldFactionNpcCommand;
import features.worldplanner.api.AddWorldLocationEncounterTableCommand;
import features.worldplanner.api.AddWorldLocationFactionCommand;
import features.worldplanner.api.CreateWorldFactionCommand;
import features.worldplanner.api.CreateWorldLocationCommand;
import features.worldplanner.api.CreateWorldNpcCommand;
import features.worldplanner.api.RefreshWorldPlannerCommand;
import features.worldplanner.api.SetWorldFactionDispositionCommand;
import features.worldplanner.api.SetWorldFactionInventoryLimitCommand;
import features.worldplanner.api.SetWorldNpcDispositionModifierCommand;
import features.worldplanner.api.SetWorldNpcLifecycleStatusCommand;
import features.worldplanner.api.UpdateWorldNpcNotesCommand;
import features.worldplanner.api.WorldDispositionKind;
import features.worldplanner.api.WorldFactionSummary;
import features.worldplanner.api.WorldLocationSummary;
import features.worldplanner.api.WorldNpcLifecycleStatus;
import features.worldplanner.api.WorldNpcSummary;
import features.worldplanner.api.WorldPlannerApi;
import features.worldplanner.api.WorldPlannerReadStatus;
import features.worldplanner.api.WorldPlannerSnapshot;
import features.worldplanner.api.WorldPlannerSnapshotModel;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.Consumer;
import javafx.application.Platform;
import javafx.scene.Node;
import javafx.scene.Parent;
import javafx.scene.control.Button;
import javafx.scene.control.ComboBox;
import javafx.scene.control.Label;
import javafx.scene.control.TextArea;
import javafx.scene.control.TextField;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import shell.api.InspectorEntrySpec;
import shell.api.InspectorSink;

@Tag("ui")
public final class WorldPlannerInspectorRefreshTest {

    private static final int AWAIT_SECONDS = 30;
    private static final AtomicBoolean FX_STARTED = new AtomicBoolean();

    @AfterAll
    static void shutdownJavaFx() throws Exception {
        if (FX_STARTED.get()) {
            runOnFxThread(testsupport.JavaFxRuntime::shutdown);
        }
    }

    @Test
    void WORLD_INSPECTOR_REFRESH_001_updatesNpcFactsAndPreservesUnsubmittedDrafts() throws Exception {
        runOnFxThread(() -> {
            Fixture fixture = fixture();
            fixture.controller().openNpcInspector(1L);
            Parent content = fixture.inspector().content();

            List<TextArea> notes = nodes(content, TextArea.class);
            notes.get(3).setText("saved note");
            button(content, "Notizen speichern").fire();
            assertTrue(texts(content).contains("saved note"), "saved note must rerender in read-only details");

            notes = nodes(fixture.inspector().content(), TextArea.class);
            notes.getFirst().setText("unsaved appearance draft");
            fixture.snapshots().publish(withFactionDisposition(fixture.snapshots().current(), 11));
            assertEquals("unsaved appearance draft", notes.getFirst().getText(),
                    "unrelated snapshots must not erase the active editor draft");

            textField(fixture.inspector().content(), "Haltungsmodifikator -50 bis 50").setText("12");
            button(fixture.inspector().content(), "Haltung setzen").fire();
            assertTrue(texts(fixture.inspector().content()).stream().anyMatch(text -> text.contains("Modifikator 12")));

            button(fixture.inspector().content(), "Besiegt").fire();
            assertTrue(texts(fixture.inspector().content()).contains("DEFEATED"));
            assertEquals(1, fixture.snapshots().listenerCount(), "one controller owns one snapshot subscription");
        });
    }

    @Test
    void WORLD_INSPECTOR_REFRESH_002_rerendersFactionAndLocationMembership() throws Exception {
        runOnFxThread(() -> {
            Fixture fixture = fixture();
            fixture.controller().openFactionInspector(10L);
            Parent faction = fixture.inspector().content();
            selectFirst(combo(faction, "NPC waehlen"));
            button(faction, "NPC hinzufuegen").fire();
            assertTrue(texts(fixture.inspector().content()).contains("[1]"));

            textField(fixture.inspector().content(), "Fraktionshaltung -50 bis 50").setText("25");
            button(fixture.inspector().content(), "Haltung setzen", 1).fire();
            assertTrue(texts(fixture.inspector().content()).contains("25"));

            fixture.controller().openLocationInspector(20L);
            Parent location = fixture.inspector().content();
            selectFirst(combo(location, "Fraktion waehlen"));
            button(location, "Fraktion linken").fire();
            assertTrue(texts(fixture.inspector().content()).contains("[10]"));
            assertEquals(1, fixture.snapshots().listenerCount(),
                    "opening another World inspector must reuse the sole subscribed controller");
        });
    }

    @Test
    void WORLD_INSPECTOR_REFRESH_003_transitionsCreatorToTheCreatedEntity() throws Exception {
        runOnFxThread(() -> {
            Fixture fixture = fixture();
            fixture.controller().openNpcCreator();
            Parent creator = fixture.inspector().content();
            textField(creator, "NPC Name").setText("New Guide");
            button(creator, "NPC anlegen").fire();

            assertEquals("world-planner:npc:2", fixture.inspector().entry().entryKey());
            assertTrue(texts(fixture.inspector().content()).contains("New Guide"));
        });
    }

    private static Fixture fixture() {
        MutableSnapshots snapshots = new MutableSnapshots(initialSnapshot());
        FakeWorldPlanner world = new FakeWorldPlanner(snapshots);
        RecordingInspector inspector = new RecordingInspector();
        WorldPlannerInspectorController controller = new WorldPlannerInspectorController(
                world,
                null,
                snapshots.model(),
                null,
                null,
                inspector);
        return new Fixture(controller, snapshots, inspector);
    }

    private static WorldPlannerSnapshot initialSnapshot() {
        return new WorldPlannerSnapshot(
                WorldPlannerReadStatus.SUCCESS,
                List.of(new WorldNpcSummary(
                        1L, "Guide", 101L, "cloak", "calm", "old road", "initial note",
                        0L, 0, 0, WorldDispositionKind.NEUTRAL, WorldNpcLifecycleStatus.ACTIVE)),
                List.of(new WorldFactionSummary(10L, "Wardens", "", 0L, 0, List.of(), List.of())),
                List.of(new WorldLocationSummary(20L, "Old Gate", "", List.of(), List.of())),
                "");
    }

    private static Button button(Parent root, String text) {
        return button(root, text, 0);
    }

    private static Button button(Parent root, String text, int occurrence) {
        List<Button> matches = nodes(root, Button.class).stream()
                .filter(candidate -> text.equals(candidate.getText()))
                .toList();
        if (occurrence < 0 || occurrence >= matches.size()) {
            throw new AssertionError("Button not found: " + text + " #" + occurrence);
        }
        return matches.get(occurrence);
    }

    private static TextField textField(Parent root, String prompt) {
        return nodes(root, TextField.class).stream()
                .filter(candidate -> prompt.equals(candidate.getPromptText()))
                .findFirst()
                .orElseThrow(() -> new AssertionError("TextField not found: " + prompt));
    }

    private static ComboBox<?> combo(Parent root, String prompt) {
        return nodes(root, ComboBox.class).stream()
                .filter(candidate -> prompt.equals(candidate.getPromptText()))
                .findFirst()
                .orElseThrow(() -> new AssertionError("ComboBox not found: " + prompt));
    }

    private static void selectFirst(ComboBox<?> combo) {
        if (combo.getItems().isEmpty()) {
            throw new AssertionError("ComboBox has no selectable item: " + combo.getPromptText());
        }
        combo.getSelectionModel().selectFirst();
    }

    private static List<String> texts(Node root) {
        return descendants(root).stream()
                .filter(Label.class::isInstance)
                .map(Label.class::cast)
                .map(Label::getText)
                .toList();
    }

    private static <T extends Node> List<T> nodes(Node root, Class<T> type) {
        return descendants(root).stream().filter(type::isInstance).map(type::cast).toList();
    }

    private static List<Node> descendants(Node root) {
        List<Node> nodes = new ArrayList<>();
        collect(root, nodes);
        return List.copyOf(nodes);
    }

    private static void collect(Node node, List<Node> nodes) {
        nodes.add(node);
        if (node instanceof Parent parent) {
            parent.getChildrenUnmodifiable().forEach(child -> collect(child, nodes));
        }
    }

    private static void runOnFxThread(ThrowingRunnable action) throws Exception {
        CountDownLatch latch = new CountDownLatch(1);
        Throwable[] failure = new Throwable[1];
        Runnable wrapped = () -> {
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
            testsupport.JavaFxRuntime.startup(wrapped);
        } else {
            Platform.runLater(wrapped);
        }
        if (!latch.await(AWAIT_SECONDS, TimeUnit.SECONDS)) {
            throw new IllegalStateException("Timed out waiting for World inspector test.");
        }
        if (failure[0] != null) {
            throw new IllegalStateException("World inspector test failed.", failure[0]);
        }
    }

    private record Fixture(
            WorldPlannerInspectorController controller,
            MutableSnapshots snapshots,
            RecordingInspector inspector
    ) {
    }

    private static final class MutableSnapshots {
        private final List<Consumer<WorldPlannerSnapshot>> listeners = new ArrayList<>();
        private WorldPlannerSnapshot current;

        private MutableSnapshots(WorldPlannerSnapshot current) {
            this.current = current;
        }

        WorldPlannerSnapshotModel model() {
            return new WorldPlannerSnapshotModel(() -> current, listener -> {
                listeners.add(listener);
                return () -> listeners.remove(listener);
            });
        }

        WorldPlannerSnapshot current() {
            return current;
        }

        int listenerCount() {
            return listeners.size();
        }

        void publish(WorldPlannerSnapshot next) {
            current = next;
            List.copyOf(listeners).forEach(listener -> listener.accept(next));
        }
    }

    private static final class RecordingInspector implements InspectorSink {
        private InspectorEntrySpec entry;
        private Parent content;

        @Override
        public void push(InspectorEntrySpec next) {
            entry = next;
            content = (Parent) next.contentSupplier().get();
        }

        @Override
        public void clear() {
            entry = null;
            content = null;
        }

        @Override
        public boolean isShowing(Object entryKey) {
            return entry != null && entry.entryKey().equals(entryKey);
        }

        InspectorEntrySpec entry() {
            return entry;
        }

        Parent content() {
            return content;
        }
    }

    private static final class FakeWorldPlanner implements WorldPlannerApi {
        private final MutableSnapshots snapshots;

        private FakeWorldPlanner(MutableSnapshots snapshots) {
            this.snapshots = snapshots;
        }

        @Override
        public void refresh(RefreshWorldPlannerCommand command) {
            snapshots.publish(snapshots.current());
        }

        @Override
        public void createNpc(CreateWorldNpcCommand command) {
            WorldPlannerSnapshot current = snapshots.current();
            List<WorldNpcSummary> npcs = new ArrayList<>(current.npcs());
            npcs.add(new WorldNpcSummary(
                    2L, command.displayName(), command.creatureStatblockId(),
                    command.appearanceNotes(), command.behaviorNotes(), command.historyNotes(), command.generalNotes(),
                    WorldNpcLifecycleStatus.ACTIVE));
            snapshots.publish(copy(current, npcs, current.factions(), current.locations()));
        }

        @Override
        public void updateNpcNotes(UpdateWorldNpcNotesCommand command) {
            WorldPlannerSnapshot current = snapshots.current();
            List<WorldNpcSummary> npcs = current.npcs().stream()
                    .map(npc -> npc.npcId() == command.npcId()
                            ? npc(npc, command.appearanceNotes(), command.behaviorNotes(),
                                    command.historyNotes(), command.generalNotes(),
                                    npc.dispositionModifier(), npc.status(), npc.factionId())
                            : npc)
                    .toList();
            snapshots.publish(copy(current, npcs, current.factions(), current.locations()));
        }

        @Override
        public void setNpcLifecycleStatus(SetWorldNpcLifecycleStatusCommand command) {
            WorldPlannerSnapshot current = snapshots.current();
            List<WorldNpcSummary> npcs = current.npcs().stream()
                    .map(npc -> npc.npcId() == command.npcId()
                            ? npc(npc, npc.appearanceNotes(), npc.behaviorNotes(), npc.historyNotes(),
                                    npc.generalNotes(), npc.dispositionModifier(), command.status(), npc.factionId())
                            : npc)
                    .toList();
            snapshots.publish(copy(current, npcs, current.factions(), current.locations()));
        }

        @Override
        public void createFaction(CreateWorldFactionCommand command) {
        }

        @Override
        public void addFactionNpc(AddWorldFactionNpcCommand command) {
            WorldPlannerSnapshot current = snapshots.current();
            List<WorldFactionSummary> factions = current.factions().stream()
                    .map(faction -> faction.factionId() == command.factionId()
                            ? new WorldFactionSummary(
                                    faction.factionId(), faction.displayName(), faction.notes(),
                                    faction.primaryEncounterTableId(), faction.disposition(),
                                    List.of(command.npcId()), faction.inventoryLimits())
                            : faction)
                    .toList();
            List<WorldNpcSummary> npcs = current.npcs().stream()
                    .map(npc -> npc.npcId() == command.npcId()
                            ? npc(npc, npc.appearanceNotes(), npc.behaviorNotes(), npc.historyNotes(),
                                    npc.generalNotes(), npc.dispositionModifier(), npc.status(), command.factionId())
                            : npc)
                    .toList();
            snapshots.publish(copy(current, npcs, factions, current.locations()));
        }

        @Override
        public void setFactionDisposition(SetWorldFactionDispositionCommand command) {
            WorldPlannerSnapshot current = snapshots.current();
            List<WorldFactionSummary> factions = current.factions().stream()
                    .map(faction -> faction.factionId() == command.factionId()
                            ? new WorldFactionSummary(
                                    faction.factionId(), faction.displayName(), faction.notes(),
                                    faction.primaryEncounterTableId(), command.disposition(),
                                    faction.npcIds(), faction.inventoryLimits())
                            : faction)
                    .toList();
            snapshots.publish(copy(current, current.npcs(), factions, current.locations()));
        }

        @Override
        public void setFactionInventoryLimit(SetWorldFactionInventoryLimitCommand command) {
        }

        @Override
        public void setNpcDispositionModifier(SetWorldNpcDispositionModifierCommand command) {
            WorldPlannerSnapshot current = snapshots.current();
            List<WorldNpcSummary> npcs = current.npcs().stream()
                    .map(npc -> npc.npcId() == command.npcId()
                            ? npc(npc, npc.appearanceNotes(), npc.behaviorNotes(), npc.historyNotes(),
                                    npc.generalNotes(), command.modifier(), npc.status(), npc.factionId())
                            : npc)
                    .toList();
            snapshots.publish(copy(current, npcs, current.factions(), current.locations()));
        }

        @Override
        public void createLocation(CreateWorldLocationCommand command) {
        }

        @Override
        public void addLocationFaction(AddWorldLocationFactionCommand command) {
            WorldPlannerSnapshot current = snapshots.current();
            List<WorldLocationSummary> locations = current.locations().stream()
                    .map(location -> location.locationId() == command.locationId()
                            ? new WorldLocationSummary(
                                    location.locationId(), location.displayName(), location.notes(),
                                    List.of(command.factionId()), location.encounterTableIds())
                            : location)
                    .toList();
            snapshots.publish(copy(current, current.npcs(), current.factions(), locations));
        }

        @Override
        public void addLocationEncounterTable(AddWorldLocationEncounterTableCommand command) {
        }

        private static WorldNpcSummary npc(
                WorldNpcSummary source,
                String appearance,
                String behavior,
                String history,
                String notes,
                int modifier,
                WorldNpcLifecycleStatus status,
                long factionId
        ) {
            return new WorldNpcSummary(
                    source.npcId(), source.displayName(), source.creatureStatblockId(),
                    appearance, behavior, history, notes, factionId, modifier, modifier,
                    modifier > 0 ? WorldDispositionKind.FRIENDLY : WorldDispositionKind.NEUTRAL,
                    status);
        }

        private static WorldPlannerSnapshot copy(
                WorldPlannerSnapshot source,
                List<WorldNpcSummary> npcs,
                List<WorldFactionSummary> factions,
                List<WorldLocationSummary> locations
        ) {
            return new WorldPlannerSnapshot(source.status(), npcs, factions, locations, source.statusText());
        }
    }

    private static WorldPlannerSnapshot withFactionDisposition(WorldPlannerSnapshot source, int disposition) {
        List<WorldFactionSummary> factions = source.factions().stream()
                .map(faction -> new WorldFactionSummary(
                        faction.factionId(), faction.displayName(), faction.notes(), faction.primaryEncounterTableId(),
                        disposition, faction.npcIds(), faction.inventoryLimits()))
                .toList();
        return new WorldPlannerSnapshot(
                source.status(), source.npcs(), factions, source.locations(), source.statusText());
    }

    @FunctionalInterface
    private interface ThrowingRunnable {
        void run() throws Exception;
    }
}
