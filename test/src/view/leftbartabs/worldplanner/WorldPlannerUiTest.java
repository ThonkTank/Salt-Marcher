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
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import shell.api.InspectorEntrySpec;
import shell.api.InspectorSink;
import src.data.encounter.repository.SqliteEncounterPlanRepository;
import src.data.party.repository.SqlitePartyRosterRepository;
import src.data.worldplanner.repository.SqliteWorldPlannerRepository;
import src.domain.creatures.CreaturesApplicationService;
import src.domain.creatures.CreaturesServiceAssembly;
import src.domain.creatures.model.catalog.CreatureCatalogData;
import src.domain.creatures.model.catalog.port.CreatureCatalogPort;
import src.domain.encounter.published.EncounterStateModel;
import src.domain.encounter.published.EncounterStateSnapshot;
import src.domain.encounter.EncounterServiceAssembly;
import src.domain.encountertable.EncounterTableApplicationService;
import src.domain.encountertable.EncounterTableServiceAssembly;
import src.domain.encountertable.model.catalog.EncounterTableCandidateData;
import src.domain.encountertable.model.catalog.EncounterTableSummaryData;
import src.domain.encountertable.model.catalog.port.EncounterTableCatalogPort;
import src.domain.encountertable.published.RefreshEncounterTableCatalogCommand;
import src.domain.party.PartyServiceAssembly;
import src.domain.worldplanner.WorldPlannerServiceAssembly;
import src.domain.worldplanner.model.world.port.WorldPlannerReferencePort;
import src.domain.worldplanner.published.WorldNpcLifecycleStatus;
import src.domain.worldplanner.published.WorldPlannerSnapshot;
import src.domain.worldplanner.published.WorldPlannerSnapshotModel;

@org.junit.jupiter.api.Tag("ui")
public final class WorldPlannerUiTest {

    private static final int AWAIT_SECONDS = 60;
    private static final AtomicBoolean FX_STARTED = new AtomicBoolean();

    private WorldPlannerUiTest() {
    }

    @AfterAll
    static void stopTest() {
        shutdownFx();
    }

    @Test
    void WORLD_PLANNER_UI_001() throws Exception {
        runOnFxThread(WorldPlannerUiTest::runTest);
    }

    private static void runTest() {
        WorldPlannerUiServices services = services();
        CapturingInspectorSink inspector = new CapturingInspectorSink();
        WorldPlannerBinder.CatalogModule module = new WorldPlannerBinder(
                services.worldApplication(),
                services.encounter().application(),
                services.world().snapshotModel(),
                services.creatures().catalog(),
                services.tables().catalog(),
                inspector).bindCatalog();
        module.activateNpcs();
        Parent controls = (Parent) module.controls();
        Parent main = (Parent) module.main();
        Parent editor = inspectorContent(inspector);
        WorldPlannerSnapshotModel model = services.world().snapshotModel();
        EncounterStateModel encounterState = services.encounter().state();

        assertVisibleLabel(main, "NPCs", "NPC module visible by default");
        assertTrue(textFields(main, "NPC Name").isEmpty(), "Main panel no longer hosts NPC editor fields");
        textField(editor, "NPC Name").setText("Captain Vale");
        comboBox(editor, "Statblock waehlen").getSelectionModel().selectFirst();
        textArea(editor, 0).setText("scarred");
        textArea(editor, 1).setText("watchful");
        textArea(editor, 2).setText("former scout");
        textArea(editor, 3).setText("knows the pass");
        button(editor, "NPC anlegen").fire();
        assertSnapshot(model.current(), 1, 0, 0, "npc created through UI route");
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

        editor = inspectorContent(inspector);
        textArea(editor, 3).setText("owes the party");
        button(editor, "Notizen speichern").fire();
        assertEquals("owes the party", model.current().npcs().get(0).generalNotes(), "NPC notes update through UI");
        editor = inspectorContent(inspector);
        button(editor, "Besiegt").fire();
        assertEquals(WorldNpcLifecycleStatus.DEFEATED, model.current().npcs().get(0).status(), "NPC defeated through UI");
        editor = inspectorContent(inspector);
        button(editor, "Aktiv").fire();
        assertEquals(WorldNpcLifecycleStatus.ACTIVE, model.current().npcs().get(0).status(), "NPC reactivated through UI");
        editor = inspectorContent(inspector);
        button(editor, "Zum Encounter").fire();
        EncounterStateSnapshot.RosterCard rosterCard =
                encounterState.current().builderPane().rosterCards().getFirst();
        assertEquals(101L, rosterCard.creatureId(), "Encounter receives selected NPC statblock through UI");
        assertEquals(
                model.current().npcs().getFirst().npcId(),
                rosterCard.worldNpcId(),
                "Encounter receives selected World NPC id through UI");

        module.activateFactions();
        editor = inspectorContent(inspector);
        assertVisibleLabel(main, "Fraktionen", "Faction module visible through Catalog activation");
        assertFalse(visibleLabel(main, "NPCs"), "NPC module hidden after faction activation");
        textField(editor, "Fraktionsname").setText("Ash Guard");
        comboBox(editor, "Encounter Table waehlen").getSelectionModel().selectFirst();
        button(editor, "Fraktion anlegen").fire();
        textField(controls, "Fraktionen suchen").setText("Ash");
        assertTrue(listView(main, 1).getItems().stream().anyMatch(item -> item.contains("Ash Guard")),
                "Faction search keeps matching row in main list");
        textField(controls, "Fraktionen suchen").setText("");
        editor = inspectorContent(inspector);
        comboBox(editor, "NPC waehlen").getSelectionModel().selectFirst();
        button(editor, "NPC hinzufuegen").fire();
        editor = inspectorContent(inspector);
        comboBox(editor, "Bestand-Statblock waehlen").getSelectionModel().selectFirst();
        checkBox(editor, "Finite").setSelected(true);
        textField(editor, "Anzahl").setText("3");
        button(editor, "Bestand setzen").fire();
        assertSnapshot(model.current(), 1, 1, 0, "faction created through UI route");
        assertEquals(1, model.current().factions().get(0).npcIds().size(), "faction NPC linked through UI");
        assertEquals(3, model.current().factions().get(0).inventoryLimits().get(0).quantity(),
                "faction finite stock set through UI");
        assertInspectorContains(inspector, "#101 x3", "Faction inventory limit renders in inspector");

        module.activateLocations();
        editor = inspectorContent(inspector);
        assertVisibleLabel(main, "Locations", "Location module visible through Catalog activation");
        textField(editor, "Location Name").setText("Old Gate");
        button(editor, "Location anlegen").fire();
        textField(controls, "Locations suchen").setText("Old");
        assertTrue(listView(main, 2).getItems().stream().anyMatch(item -> item.contains("Old Gate")),
                "Location search keeps matching row in main list");
        textField(controls, "Locations suchen").setText("");
        editor = inspectorContent(inspector);
        comboBox(editor, "Fraktion waehlen").getSelectionModel().selectFirst();
        button(editor, "Fraktion linken").fire();
        editor = inspectorContent(inspector);
        comboBox(editor, "Location-Tabelle waehlen").getSelectionModel().selectFirst();
        button(editor, "Tabelle linken").fire();
        assertSnapshot(model.current(), 1, 1, 1, "location created through UI route");
        assertEquals(1, model.current().locations().get(0).factionIds().size(), "location faction linked through UI");
        assertEquals(201L, model.current().locations().get(0).encounterTableIds().get(0),
                "location encounter table linked through UI");
        assertInspectorContains(inspector, "Old Gate", "Location renders in inspector");

        module.activateNpcs();
        assertTrue(listView(main, 0).getItems().stream().anyMatch(item -> item.contains("Captain Vale")),
                "NPC list readback renders created NPC");
        assertTrue(listView(main, 1).getItems().stream().anyMatch(item -> item.contains("Ash Guard")),
                "Faction list readback renders created faction");
        assertTrue(listView(main, 2).getItems().stream().anyMatch(item -> item.contains("Old Gate")),
                "Location list readback renders created location");
        assertFalse(visibleLabel(main, "Encounter Sources"), "Encounter Sources is no longer a module");
    }

    private static WorldPlannerUiServices services() {
        CreaturesServiceAssembly.Component creatures =
                CreaturesServiceAssembly.create(new FixtureCreatureCatalogPort());
        EncounterTableServiceAssembly.Component tables =
                EncounterTableServiceAssembly.create(new FixtureEncounterTableCatalogPort());
        PartyServiceAssembly.Component party =
                PartyServiceAssembly.create(new SqlitePartyRosterRepository());
        WorldPlannerServiceAssembly world = new WorldPlannerServiceAssembly(
                new SqliteWorldPlannerRepository(), new PositiveReferencePort());
        var worldApplication = world.createApplicationService();
        EncounterServiceAssembly.Component encounter = EncounterServiceAssembly.create(
                creatures.application(), creatures.detail(), creatures.encounterCandidates(),
                tables.application(), tables.candidates(), world.snapshotModel(),
                party.application(), party.activeParty(), party.activeComposition(),
                party.adventuringDaySummary(), party.mutation(), new SqliteEncounterPlanRepository());
        creatures.application().refreshCatalog(null);
        tables.application()
                .refreshCatalog(new RefreshEncounterTableCatalogCommand());
        return new WorldPlannerUiServices(creatures, tables, world, worldApplication, encounter);
    }

    private record WorldPlannerUiServices(
            CreaturesServiceAssembly.Component creatures,
            EncounterTableServiceAssembly.Component tables,
            WorldPlannerServiceAssembly world,
            src.domain.worldplanner.WorldPlannerApplicationService worldApplication,
            EncounterServiceAssembly.Component encounter
    ) {
    }

    private static final class PositiveReferencePort implements WorldPlannerReferencePort {
        @Override
        public boolean creatureStatblockExists(long id) {
            return id > 0L;
        }

        @Override
        public boolean encounterTableExists(long id) {
            return id > 0L;
        }
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

    private static Parent inspectorContent(CapturingInspectorSink inspector) {
        InspectorEntrySpec entry = inspector.lastEntry();
        if (entry == null || !(entry.contentSupplier().get() instanceof Parent parent)) {
            throw new AssertionError("Inspector editor content not available.");
        }
        return parent;
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

    private static void shutdownFx() {
        if (FX_STARTED.get()) {
            testsupport.JavaFxRuntime.shutdown();
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
