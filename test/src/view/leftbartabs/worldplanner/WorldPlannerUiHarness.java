package src.view.leftbartabs.worldplanner;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import javafx.application.Platform;
import javafx.scene.Node;
import javafx.scene.Parent;
import javafx.scene.control.Button;
import javafx.scene.control.CheckBox;
import javafx.scene.control.ComboBox;
import javafx.scene.control.Label;
import javafx.scene.control.ListView;
import javafx.scene.control.TextArea;
import javafx.scene.control.TextField;
import javafx.scene.control.ToggleButton;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import shell.api.InspectorEntrySpec;
import shell.api.InspectorSink;
import shell.api.ServiceRegistry;
import shell.api.ShellBinding;
import shell.api.ShellRuntimeContext;
import shell.api.ShellSlot;
import src.domain.creatures.CreaturesApplicationService;
import src.domain.creatures.model.catalog.CreatureCatalogData;
import src.domain.creatures.model.catalog.port.CreatureCatalogPort;
import src.domain.encounter.published.EncounterStateModel;
import src.domain.encounter.published.EncounterStateSnapshot;
import src.domain.encountertable.EncounterTableApplicationService;
import src.domain.encountertable.model.catalog.EncounterTableCandidateData;
import src.domain.encountertable.model.catalog.EncounterTableSummaryData;
import src.domain.encountertable.model.catalog.port.EncounterTableCatalogPort;
import src.domain.encountertable.published.RefreshEncounterTableCatalogCommand;
import src.domain.worldplanner.published.WorldNpcLifecycleStatus;
import src.domain.worldplanner.published.WorldPlannerSnapshot;
import src.domain.worldplanner.published.WorldPlannerSnapshotModel;

public final class WorldPlannerUiHarness {

    private static final int AWAIT_SECONDS = 60;
    private static final AtomicBoolean FX_STARTED = new AtomicBoolean();

    private WorldPlannerUiHarness() {
    }

    @AfterAll
    static void stopHarness() {
        shutdownFx();
    }

    @Test
    void WORLD_PLANNER_UI_001() throws Exception {
        runOnFxThread(WorldPlannerUiHarness::runHarness);
    }

    private static void runHarness() {
        ServiceRegistry services = services();
        CapturingInspectorSink inspector = new CapturingInspectorSink();
        ShellBinding binding = new WorldPlannerContribution().bind(
                new ShellRuntimeContext(inspector, services));
        Parent controls = slot(binding, ShellSlot.COCKPIT_CONTROLS, Parent.class);
        Parent main = slot(binding, ShellSlot.COCKPIT_MAIN, Parent.class);
        Parent state = slot(binding, ShellSlot.COCKPIT_STATE, Parent.class);
        WorldPlannerSnapshotModel model = services.require(WorldPlannerSnapshotModel.class);
        EncounterStateModel encounterState = services.require(EncounterStateModel.class);

        assertNoButton(controls, "Refresh", "Refresh button removed from World Planner controls");
        assertNoLabelContains(controls, "0 NPCs", "NPC counter label removed from World Planner controls");
        assertNoLabelContains(controls, "0 Fraktionen", "Faction counter label removed from World Planner controls");
        assertNoLabelContains(controls, "0 Locations", "Location counter label removed from World Planner controls");
        assertVisibleLabel(main, "NPCs", "NPC module visible by default");
        assertTrue(textFields(main, "NPC Name").isEmpty(), "Main panel no longer hosts NPC editor fields");
        textField(state, "NPC Name").setText("Captain Vale");
        comboBox(state, "Statblock waehlen").getSelectionModel().selectFirst();
        textArea(state, 0).setText("scarred");
        textArea(state, 1).setText("watchful");
        textArea(state, 2).setText("former scout");
        textArea(state, 3).setText("knows the pass");
        button(state, "NPC anlegen").fire();
        assertSnapshot(model.current(), 1, 0, 0, "npc created through UI route");
        assertLabelContains(state, "Captain Vale", "NPC state renders selected NPC status");
        assertInspectorContains(inspector, "scarred", "NPC appearance renders in inspector");
        assertInspectorContains(inspector, "watchful", "NPC behavior renders in inspector");
        assertInspectorContains(inspector, "former scout", "NPC history renders in inspector");

        textField(controls, "NPCs suchen").setText("Captain");
        assertTrue(listView(main, 0).getItems().stream().anyMatch(item -> item.contains("Captain Vale")),
                "NPC search keeps matching row in main list");
        textField(controls, "NPCs suchen").setText("missing");
        assertTrue(listView(main, 0).getItems().isEmpty(), "NPC search filters nonmatching rows from main list");
        textField(controls, "NPCs suchen").setText("");
        checkBox(controls, "Aktiv").setSelected(true);
        assertLabelContains(controls, "Status: Aktiv", "Active NPC filter chip is rendered");
        buttonByAccessible(controls, "Filter entfernen: Status: Aktiv").fire();

        textArea(state, 3).setText("owes the party");
        button(state, "Notizen speichern").fire();
        assertEquals("owes the party", model.current().npcs().get(0).generalNotes(), "NPC notes update through UI");
        button(state, "Besiegt").fire();
        assertEquals(WorldNpcLifecycleStatus.DEFEATED, model.current().npcs().get(0).status(), "NPC defeated through UI");
        button(state, "Aktiv").fire();
        assertEquals(WorldNpcLifecycleStatus.ACTIVE, model.current().npcs().get(0).status(), "NPC reactivated through UI");
        button(state, "Zum Encounter").fire();
        EncounterStateSnapshot.RosterCard rosterCard =
                encounterState.current().builderPane().rosterCards().getFirst();
        assertEquals(101L, rosterCard.creatureId(), "Encounter receives selected NPC statblock through UI");
        assertEquals(
                model.current().npcs().getFirst().npcId(),
                rosterCard.worldNpcId(),
                "Encounter receives selected World NPC id through UI");

        toggleButton(controls, "Fraktionen").fire();
        assertVisibleLabel(main, "Fraktionen", "Faction module visible after controls tab switch");
        assertFalse(visibleLabel(main, "NPCs"), "NPC module hidden after faction tab switch");
        assertInspectorCleared(inspector, "empty faction module clears stale NPC inspector detail");
        textField(state, "Fraktionsname").setText("Ash Guard");
        comboBox(state, "Encounter Table waehlen").getSelectionModel().selectFirst();
        button(state, "Fraktion anlegen").fire();
        textField(controls, "Fraktionen suchen").setText("Ash");
        assertTrue(listView(main, 1).getItems().stream().anyMatch(item -> item.contains("Ash Guard")),
                "Faction search keeps matching row in main list");
        textField(controls, "Fraktionen suchen").setText("");
        comboBox(state, "NPC waehlen").getSelectionModel().selectFirst();
        button(state, "NPC hinzufuegen").fire();
        comboBox(state, "Bestand-Statblock waehlen").getSelectionModel().selectFirst();
        checkBox(state, "Finite").setSelected(true);
        textField(state, "Anzahl").setText("3");
        button(state, "Bestand setzen").fire();
        assertSnapshot(model.current(), 1, 1, 0, "faction created through UI route");
        assertEquals(1, model.current().factions().get(0).npcIds().size(), "faction NPC linked through UI");
        assertEquals(3, model.current().factions().get(0).inventoryLimits().get(0).quantity(),
                "faction finite stock set through UI");
        assertInspectorContains(inspector, "#101 x3", "Faction inventory limit renders in inspector");

        toggleButton(controls, "Locations").fire();
        assertVisibleLabel(main, "Locations", "Location module visible after controls tab switch");
        textField(state, "Location Name").setText("Old Gate");
        button(state, "Location anlegen").fire();
        textField(controls, "Locations suchen").setText("Old");
        assertTrue(listView(main, 2).getItems().stream().anyMatch(item -> item.contains("Old Gate")),
                "Location search keeps matching row in main list");
        textField(controls, "Locations suchen").setText("");
        comboBox(state, "Fraktion waehlen").getSelectionModel().selectFirst();
        button(state, "Fraktion linken").fire();
        comboBox(state, "Location-Tabelle waehlen").getSelectionModel().selectFirst();
        button(state, "Tabelle linken").fire();
        assertSnapshot(model.current(), 1, 1, 1, "location created through UI route");
        assertEquals(1, model.current().locations().get(0).factionIds().size(), "location faction linked through UI");
        assertEquals(201L, model.current().locations().get(0).encounterTableIds().get(0),
                "location encounter table linked through UI");
        assertInspectorContains(inspector, "Old Gate", "Location renders in inspector");

        toggleButton(controls, "Encounter Sources").fire();
        assertVisibleLabel(main, "Encounter Sources", "Encounter source module visible after controls tab switch");
        textField(controls, "Quellen suchen").setText("Ash");
        assertTrue(listView(main, 3).getItems().stream().anyMatch(item -> item.contains("Ash Guard")),
                "Source search keeps matching source row in main list");
        textField(controls, "Quellen suchen").setText("");
        assertLabelContains(state, "Factions 1", "Source module state summarizes configured sources");

        toggleButton(controls, "NPCs").fire();
        assertTrue(listView(main, 0).getItems().stream().anyMatch(item -> item.contains("Captain Vale")),
                "NPC list readback renders created NPC");
        assertTrue(listView(main, 1).getItems().stream().anyMatch(item -> item.contains("Ash Guard")),
                "Faction list readback renders created faction");
        assertTrue(listView(main, 2).getItems().stream().anyMatch(item -> item.contains("Old Gate")),
                "Location list readback renders created location");
    }

    private static ServiceRegistry services() {
        ServiceRegistry.Builder builder = new ServiceRegistry.Builder();
        builder.register(CreatureCatalogPort.class, new FixtureCreatureCatalogPort());
        builder.register(EncounterTableCatalogPort.class, new FixtureEncounterTableCatalogPort());
        new src.data.worldplanner.WorldPlannerServiceContribution().register(builder);
        new src.data.party.PartyServiceContribution().register(builder);
        new src.data.encounter.EncounterServiceContribution().register(builder);
        new src.domain.creatures.CreaturesServiceContribution().register(builder);
        new src.domain.encountertable.EncounterTableServiceContribution().register(builder);
        new src.domain.party.PartyServiceContribution().register(builder);
        new src.domain.worldplanner.WorldPlannerServiceContribution().register(builder);
        new src.domain.encounter.EncounterServiceContribution().register(builder);
        ServiceRegistry registry = builder.build();
        registry.require(CreaturesApplicationService.class).refreshCatalog(null);
        registry.require(EncounterTableApplicationService.class)
                .refreshCatalog(new RefreshEncounterTableCatalogCommand());
        return registry;
    }

    private static final class FixtureCreatureCatalogPort implements CreatureCatalogPort {

        private static final long ASH_GUARD_ID = 101L;
        private final Map<Long, CreatureCatalogData.CreatureProfile> profiles =
                Map.of(ASH_GUARD_ID, profile(ASH_GUARD_ID, "Ash Guard", 50));

        @Override
        public CreatureCatalogData.DistinctFilterValues loadFilterValues() {
            return CreatureCatalogData.emptyFilterValues();
        }

        @Override
        public CreatureCatalogData.CatalogPageData searchCatalog(CreatureCatalogData.CatalogSearchSpec spec) {
            List<CreatureCatalogData.CatalogRowData> rows = profiles.values().stream()
                    .map(profile -> new CreatureCatalogData.CatalogRowData(
                            profile.id(),
                            profile.name(),
                            profile.size(),
                            profile.creatureType(),
                            profile.alignment(),
                            profile.challengeRating(),
                            profile.xp(),
                            profile.hitPoints(),
                            profile.armorClass()))
                    .toList();
            return new CreatureCatalogData.CatalogPageData(rows, rows.size(), 50, 0);
        }

        @Override
        public CreatureCatalogData.CreatureProfile loadCreatureDetail(long creatureId) {
            return profiles.get(creatureId);
        }

        @Override
        public List<CreatureCatalogData.EncounterCandidateProfile> loadEncounterCandidates(
                CreatureCatalogData.EncounterCandidateSpec spec
        ) {
            List<CreatureCatalogData.EncounterCandidateProfile> candidates = new ArrayList<>();
            for (CreatureCatalogData.CreatureProfile profile : profiles.values()) {
                if (profile.xp() >= spec.minimumXp() && profile.xp() <= spec.maximumXp()) {
                    candidates.add(candidate(profile));
                }
            }
            return candidates.stream().limit(Math.max(0, spec.limit())).toList();
        }

        private static CreatureCatalogData.CreatureProfile profile(long id, String name, int xp) {
            return new CreatureCatalogData.CreatureProfile(
                    new CreatureCatalogData.CreatureIdentity(
                            id,
                            name,
                            "Medium",
                            "humanoid",
                            List.of(),
                            List.of(),
                            "neutral",
                            "1/4",
                            xp),
                    new CreatureCatalogData.CreatureVitals(10, null, 1, 8, 0, 12, null, 30, 0, 0, 0, 0),
                    new CreatureCatalogData.CreatureAbilities(10, 12, 10, 10, 10, 10, 1, 2),
                    new CreatureCatalogData.CreatureTraits(null, null, null, null, null, null, null, 10, null, 0),
                    List.of());
        }

        private static CreatureCatalogData.EncounterCandidateProfile candidate(
                CreatureCatalogData.CreatureProfile profile
        ) {
            return new CreatureCatalogData.EncounterCandidateProfile(
                    profile.id(),
                    profile.name(),
                    profile.creatureType(),
                    profile.challengeRating(),
                    profile.xp(),
                    profile.hitPoints(),
                    profile.hitDiceCount(),
                    profile.hitDiceSides(),
                    profile.hitDiceModifier(),
                    profile.armorClass(),
                    profile.initiativeBonus(),
                    profile.legendaryActionCount());
        }
    }

    private static final class FixtureEncounterTableCatalogPort implements EncounterTableCatalogPort {

        private final Map<Long, List<EncounterTableCandidateData>> tableCandidates = new LinkedHashMap<>();

        private FixtureEncounterTableCatalogPort() {
            tableCandidates.put(201L, List.of(tableCandidate(101L, "Ash Guard", 50)));
        }

        @Override
        public List<EncounterTableSummaryData> loadSummaries() {
            return tableCandidates.keySet().stream()
                    .map(id -> new EncounterTableSummaryData(id, "Gate Patrol", null))
                    .toList();
        }

        @Override
        public List<EncounterTableCandidateData> loadGenerationCandidates(List<Long> tableIds, int maximumXp) {
            Map<Long, EncounterTableCandidateData> unique = new LinkedHashMap<>();
            for (Long tableId : tableIds == null ? List.<Long>of() : tableIds) {
                for (EncounterTableCandidateData candidate : tableCandidates.getOrDefault(tableId, List.of())) {
                    if (candidate.xp() <= maximumXp) {
                        unique.putIfAbsent(candidate.creatureId(), candidate);
                    }
                }
            }
            return List.copyOf(unique.values());
        }

        private static EncounterTableCandidateData tableCandidate(long creatureId, String name, int xp) {
            return new EncounterTableCandidateData(
                    creatureId,
                    name,
                    "humanoid",
                    "1/4",
                    xp,
                    10,
                    1,
                    8,
                    0,
                    12,
                    1,
                    0,
                    1);
        }
    }

    private static <T extends Node> T slot(ShellBinding binding, ShellSlot slot, Class<T> type) {
        Node node = binding.slotContent().get(slot);
        if (!type.isInstance(node)) {
            throw new AssertionError("Expected " + slot + " to contain " + type.getSimpleName());
        }
        return type.cast(node);
    }

    private static TextField textField(Parent parent, String promptText) {
        return textField(parent, promptText, 0);
    }

    private static TextField textField(Parent parent, String promptText, int index) {
        List<TextField> fields = textFields(parent, promptText);
        if (index < 0 || index >= fields.size()) {
            throw new AssertionError("TextField not found: " + promptText + " index " + index);
        }
        return fields.get(index);
    }

    private static List<TextField> textFields(Parent parent, String promptText) {
        return descendants(parent).stream()
                .filter(TextField.class::isInstance)
                .map(TextField.class::cast)
                .filter(field -> promptText.equals(field.getPromptText()))
                .toList();
    }

    private static TextArea textArea(Parent parent, int index) {
        List<TextArea> areas = descendants(parent).stream()
                .filter(TextArea.class::isInstance)
                .map(TextArea.class::cast)
                .toList();
        if (index < 0 || index >= areas.size()) {
            throw new AssertionError("TextArea not found: " + index);
        }
        return areas.get(index);
    }

    private static ComboBox<String> comboBox(Parent parent, String promptText) {
        return descendants(parent).stream()
                .filter(ComboBox.class::isInstance)
                .map(node -> {
                    @SuppressWarnings("unchecked")
                    ComboBox<String> comboBox = (ComboBox<String>) node;
                    return comboBox;
                })
                .filter(comboBox -> promptText.equals(comboBox.getPromptText()))
                .findFirst()
                .orElseThrow(() -> new AssertionError("ComboBox not found: " + promptText));
    }

    private static Button button(Parent parent, String text) {
        return descendants(parent).stream()
                .filter(Button.class::isInstance)
                .map(Button.class::cast)
                .filter(button -> text.equals(button.getText()))
                .findFirst()
                .orElseThrow(() -> new AssertionError("Button not found: " + text));
    }

    private static Button buttonByAccessible(Parent parent, String accessibleText) {
        return descendants(parent).stream()
                .filter(Button.class::isInstance)
                .map(Button.class::cast)
                .filter(button -> accessibleText.equals(button.getAccessibleText()))
                .findFirst()
                .orElseThrow(() -> new AssertionError("Button not found: " + accessibleText));
    }

    private static ToggleButton toggleButton(Parent parent, String text) {
        return descendants(parent).stream()
                .filter(ToggleButton.class::isInstance)
                .map(ToggleButton.class::cast)
                .filter(button -> text.equals(button.getText()))
                .findFirst()
                .orElseThrow(() -> new AssertionError("ToggleButton not found: " + text));
    }

    private static CheckBox checkBox(Parent parent, String text) {
        return descendants(parent).stream()
                .filter(CheckBox.class::isInstance)
                .map(CheckBox.class::cast)
                .filter(checkBox -> text.equals(checkBox.getText()))
                .findFirst()
                .orElseThrow(() -> new AssertionError("CheckBox not found: " + text));
    }

    @SuppressWarnings("unchecked")
    private static ListView<String> listView(Parent parent, int index) {
        List<Node> views = descendants(parent).stream()
                .filter(ListView.class::isInstance)
                .toList();
        if (index < 0 || index >= views.size()) {
            throw new AssertionError("ListView not found: " + index);
        }
        return (ListView<String>) views.get(index);
    }

    private static void assertVisibleLabel(Parent parent, String text, String message) {
        assertTrue(visibleLabel(parent, text), message);
    }

    private static boolean visibleLabel(Parent parent, String text) {
        return descendants(parent).stream()
                .filter(Label.class::isInstance)
                .map(Label.class::cast)
                .anyMatch(label -> text.equals(label.getText()) && visibleInTree(label));
    }

    private static void assertLabelContains(Parent parent, String text, String message) {
        boolean present = descendants(parent).stream()
                .filter(Label.class::isInstance)
                .map(Label.class::cast)
                .anyMatch(label -> label.getText().contains(text));
        assertTrue(present, message);
    }

    private static void assertNoButton(Parent parent, String text, String message) {
        boolean present = descendants(parent).stream()
                .filter(Button.class::isInstance)
                .map(Button.class::cast)
                .anyMatch(button -> text.equals(button.getText()));
        assertFalse(present, message);
    }

    private static void assertNoLabelContains(Parent parent, String text, String message) {
        boolean present = descendants(parent).stream()
                .filter(Label.class::isInstance)
                .map(Label.class::cast)
                .anyMatch(label -> label.getText().contains(text));
        assertFalse(present, message);
    }

    private static void assertInspectorContains(
            CapturingInspectorSink inspector,
            String text,
            String message
    ) {
        InspectorEntrySpec entry = inspector.lastEntry();
        if (entry == null) {
            throw new AssertionError(message + ": no inspector entry");
        }
        Node content = entry.contentSupplier().get();
        if (!(content instanceof Parent parent)) {
            throw new AssertionError(message + ": inspector content is not a Parent");
        }
        assertLabelContains(parent, text, message);
    }

    private static void assertInspectorCleared(CapturingInspectorSink inspector, String message) {
        if (inspector.lastEntry() != null) {
            throw new AssertionError(message);
        }
    }

    private static boolean visibleInTree(Node node) {
        Node current = node;
        while (current != null) {
            if (!current.isVisible()) {
                return false;
            }
            current = current.getParent();
        }
        return true;
    }

    private static List<Node> descendants(Node node) {
        java.util.ArrayList<Node> result = new java.util.ArrayList<>();
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

    private static void assertSnapshot(
            WorldPlannerSnapshot snapshot,
            int npcCount,
            int factionCount,
            int locationCount,
            String message
    ) {
        String status = " status=" + snapshot.status() + " text=" + snapshot.statusText();
        assertEquals(npcCount, snapshot.npcs().size(), message + " npc count" + status);
        assertEquals(factionCount, snapshot.factions().size(), message + " faction count" + status);
        assertEquals(locationCount, snapshot.locations().size(), message + " location count" + status);
    }

    private static void assertEquals(Object expected, Object actual, String message) {
        if (!java.util.Objects.equals(expected, actual)) {
            throw new AssertionError(message + ": expected <" + expected + "> but was <" + actual + ">");
        }
    }

    private static void assertTrue(boolean condition, String message) {
        if (!condition) {
            throw new AssertionError(message);
        }
    }

    private static void assertFalse(boolean condition, String message) {
        if (condition) {
            throw new AssertionError(message);
        }
    }

    private static void runOnFxThread(ThrowingRunnable action) throws Exception {
        startFx();
        CountDownLatch latch = new CountDownLatch(1);
        java.util.concurrent.atomic.AtomicReference<Throwable> failure = new java.util.concurrent.atomic.AtomicReference<>();
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
            throw new AssertionError("FX harness timed out.");
        }
        if (failure.get() != null) {
            throw new AssertionError("FX harness failed.", failure.get());
        }
    }

    private static void startFx() throws InterruptedException {
        if (FX_STARTED.compareAndSet(false, true)) {
            CountDownLatch latch = new CountDownLatch(1);
            Platform.startup(latch::countDown);
            if (!latch.await(AWAIT_SECONDS, TimeUnit.SECONDS)) {
                throw new AssertionError("FX startup timed out.");
            }
        }
    }

    private static void shutdownFx() {
        if (FX_STARTED.get()) {
            Platform.exit();
        }
    }

    private interface ThrowingRunnable {
        void run() throws Exception;
    }

    private static final class CapturingInspectorSink implements InspectorSink {

        private InspectorEntrySpec lastEntry;

        @Override
        public void push(InspectorEntrySpec entry) {
            lastEntry = entry;
        }

        @Override
        public void clear() {
            lastEntry = null;
        }

        @Override
        public boolean isShowing(Object entryKey) {
            return lastEntry != null && java.util.Objects.equals(lastEntry.entryKey(), entryKey);
        }

        InspectorEntrySpec lastEntry() {
            return lastEntry;
        }
    }
}
