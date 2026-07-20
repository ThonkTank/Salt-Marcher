package features.catalog.adapter.javafx;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import features.items.api.ItemsCatalogApi;
import features.catalog.CatalogFeature;
import features.catalog.CatalogProviders;
import features.catalog.CatalogRoutes;
import features.creatures.api.CreatureCatalogPage;
import features.creatures.api.CreatureCatalogPageResult;
import features.creatures.api.CreatureFilterOptions;
import features.creatures.api.CreatureFilterOptionsResult;
import features.creatures.api.CreatureQueryStatus;
import features.creatures.api.CreatureReadStatus;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import javafx.application.Platform;
import javafx.collections.ListChangeListener;
import javafx.scene.Node;
import javafx.scene.Parent;
import javafx.scene.Scene;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.control.TableColumn;
import javafx.scene.control.TableView;
import javafx.scene.control.TextField;
import javafx.scene.input.KeyCode;
import javafx.scene.input.KeyEvent;
import javafx.scene.layout.BorderPane;
import javafx.scene.control.ToggleButton;
import javafx.stage.Stage;
import javafx.stage.Window;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import shell.api.InspectorEntrySpec;
import shell.api.InspectorSink;
import shell.api.ShellBinding;
import shell.api.ShellSlot;

@Tag("ui")
public final class ItemsCatalogUiTest {

    private static final int AWAIT_SECONDS = 30;
    private static final AtomicBoolean FX_STARTED = new AtomicBoolean();

    @AfterEach
    void hideWindows() throws Exception {
        runOnFxThread(ItemsCatalogUiTest::hideOpenWindows);
    }

    @AfterAll
    static void shutdownJavaFx() throws Exception {
        if (FX_STARTED.get()) {
            runOnFxThread(() -> {
                hideOpenWindows();
                testsupport.JavaFxRuntime.shutdown();
            });
        }
    }

    @Test
    void ITEMS_CATALOG_UI_001_mapsEveryFilterSortAndPageToTheApi() throws Exception {
        runOnFxThread(() -> {
            FakeItemsApi api = new FakeItemsApi();
            ItemsFixture fixture = show(api, new RecordingInspector());
            Parent pane = fixture.host();

            text(pane, "Item-Name").setText("  blade  ");
            select(picker(pane, "Item-Kategorie"), "Weapon");
            select(picker(pane, "Item-Unterkategorie"), "Martial");
            select(picker(pane, "Item-Seltenheit"), "Rare");
            select(picker(pane, "Item-Magie"), "Ja");
            select(picker(pane, "Item-Attunement"), "Nein");
            text(pane, "Item-Kosten Minimum").setText("100");
            text(pane, "Item-Kosten Maximum").setText("900");
            TableView<?> itemTable = table(pane, "Item-Ergebnisse");
            TableColumn<?, ?> cost = itemTable.getColumns().stream()
                    .filter(column -> "Kosten".equals(column.getText())).findFirst().orElseThrow();
            cost.setSortType(TableColumn.SortType.DESCENDING);
            sort(itemTable, cost);
            submit(pane);

            ItemsCatalogApi.ItemQuery query = api.queries.getLast();
            assertEquals("blade", query.name());
            assertEquals("Weapon", query.category());
            assertEquals("Martial", query.subcategory());
            assertEquals("Rare", query.rarity());
            assertEquals(Boolean.TRUE, query.magic());
            assertEquals(Boolean.FALSE, query.attunement());
            assertEquals(100, query.minimumCostCp());
            assertEquals(900, query.maximumCostCp());
            assertEquals(ItemsCatalogApi.SortField.COST, query.sortField());
            assertFalse(query.ascending());
            assertEquals(50, query.pageSize());
            assertEquals(0, query.pageOffset());

            button(pane, "Nächste Item-Seite").fire();
            assertEquals(50, api.queries.getLast().pageOffset());
            assertEquals("Seite 2 von 3", label(pane, "Item-Seite").getText());
            button(pane, "Nächste Item-Seite").fire();
            assertEquals(100, api.queries.getLast().pageOffset());
            assertTrue(button(pane, "Nächste Item-Seite").isDisabled());
            button(pane, "Vorherige Item-Seite").fire();
            assertEquals(50, api.queries.getLast().pageOffset());
        });
    }

    @Test
    void ITEMS_CATALOG_UI_002_rendersLoadingEmptyAndEveryTypedFailureState() throws Exception {
        runOnFxThread(() -> {
            FakeItemsApi api = new FakeItemsApi();
            ItemsFixture fixture = show(api, new RecordingInspector());
            Parent pane = fixture.host();

            api.deferNextSearch();
            submit(pane);
            assertEquals("Aktualisiere…", label(pane, "Item-Ergebnisse Status").getText());
            api.completeDeferred(ItemsCatalogApi.CatalogStatus.SUCCESS, List.of(), 0);
            assertEquals("Keine Einträge gefunden.", label(pane, "Item-Ergebnisse Status").getText());

            assertState(pane, api, ItemsCatalogApi.CatalogStatus.INVALID_QUERY, "Ungültige Item-Suche.");
            assertState(pane, api, ItemsCatalogApi.CatalogStatus.UNAVAILABLE,
                    "Noch kein Item-Katalog importiert.");
            assertState(pane, api, ItemsCatalogApi.CatalogStatus.STORAGE_ERROR,
                    "Item-Katalog konnte nicht gelesen werden.");
            assertState(pane, api, ItemsCatalogApi.CatalogStatus.EXECUTION_ERROR,
                    "Item-Suche konnte nicht ausgeführt werden.");

            int callsBeforeInvalidText = api.queries.size();
            text(pane, "Item-Kosten Minimum").setText("keine Zahl");
            submit(pane);
            assertEquals(callsBeforeInvalidText, api.queries.size());
            assertEquals("Ungültige Item-Suche.", label(pane, "Item-Ergebnisse Status").getText());
        });
    }

    @Test
    void ITEMS_CATALOG_UI_003_opensCompleteInspectorByEnterWithoutRedundantDetailsButton() throws Exception {
        runOnFxThread(() -> {
            FakeItemsApi api = new FakeItemsApi();
            RecordingInspector inspector = new RecordingInspector();
            ItemsFixture fixture = show(api, inspector);
            Parent pane = fixture.host();
            assertEquals(1, api.queries.size());
            TableView<?> results = table(pane, "Item-Ergebnisse");
            assertEquals(1, results.getItems().size());
            results.getSelectionModel().selectFirst();

            assertTrue(descendants(pane).stream().filter(Button.class::isInstance).map(Button.class::cast)
                    .noneMatch(button -> "Item im Inspector öffnen".equals(button.getAccessibleText())),
                    "redundant selected-row Details button must stay removed");
            results.fireEvent(new KeyEvent(
                    KeyEvent.KEY_PRESSED, "", "", KeyCode.ENTER,
                    false, false, false, false));
            assertEquals("equipment:rapier", api.lastDetailKey);
            assertCompleteInspector(inspector.entry);

            inspector.clear();
            results.fireEvent(new KeyEvent(
                    KeyEvent.KEY_PRESSED, "", "", KeyCode.ENTER,
                    false, false, false, false));
            assertNotNull(inspector.entry, "Enter must invoke the same accessible primary detail action");
        });
    }

    @Test
    void ITEMS_CATALOG_UI_005_rowPrimaryLinkOpensExactVisibleItemWithoutSelectingIt() throws Exception {
        runOnFxThread(() -> {
            FakeItemsApi api = new FakeItemsApi();
            RecordingInspector inspector = new RecordingInspector();
            ItemsFixture fixture = show(api, inspector);
            Parent pane = fixture.host();
            TableView<?> results = table(pane, "Item-Ergebnisse");
            assertNull(results.getSelectionModel().getSelectedItem());

            button(pane, "Öffnen: Rapier of Proof").fire();

            assertEquals("equipment:rapier", api.lastDetailKey);
            assertEquals(1, api.detailCalls);
            assertNotNull(inspector.entry);
            assertNull(results.getSelectionModel().getSelectedItem(),
                    "row primary action must not mutate Catalog selection");
        });
    }

    @Test
    void ITEMS_CATALOG_UI_004_preservesDraftPageAndSelectionAcrossSectionSwitches() throws Exception {
        runOnFxThread(() -> {
            FakeItemsApi api = new FakeItemsApi();
            ItemsFixture fixture = show(api, new RecordingInspector());
            Parent pane = fixture.host();
            TextField query = text(pane, "Item-Name");
            query.setText("  rapier draft  ");
            submit(pane);
            button(pane, "Nächste Item-Seite").fire();
            TableView<?> results = table(pane, "Item-Ergebnisse");
            results.getSelectionModel().selectFirst();
            Object selected = results.getSelectionModel().getSelectedItem();
            int callsBeforeSwitch = api.queries.size();

            node(pane, ToggleButton.class, "Katalogbereich Monster").fire();
            node(pane, ToggleButton.class, "Katalogbereich Items").fire();

            assertEquals("  rapier draft  ", text(pane, "Item-Name").getText());
            assertEquals("Seite 2 von 3", label(pane, "Item-Seite").getText());
            assertEquals(selected, table(pane, "Item-Ergebnisse").getSelectionModel().getSelectedItem());
            assertEquals(callsBeforeSwitch + 1, api.queries.size(),
                    "reactivating Items must refresh once while retaining its browse state");
        });
    }

    @Test
    void ITEMS_CATALOG_UI_006_providerSortUsesCommandWithoutLocallyReorderingVisiblePage() throws Exception {
        runOnFxThread(() -> {
            FakeItemsApi api = new FakeItemsApi();
            api.rows = List.of(
                    new ItemsCatalogApi.ItemRow(
                            "equipment:zeta", "Zeta", "Weapon", "Martial",
                            false, "Common", false, 20, "2 sp"),
                    new ItemsCatalogApi.ItemRow(
                            "equipment:alpha", "Alpha", "Weapon", "Simple",
                            false, "Common", false, 10, "1 sp"));
            Parent pane = show(api, new RecordingInspector()).host();
            TableView<?> results = table(pane, "Item-Ergebnisse");
            assertEquals(List.of("Zeta", "Alpha"), resultNames(results));

            TableColumn<?, ?> name = results.getColumns().stream()
                    .filter(column -> "Name".equals(column.getText())).findFirst().orElseThrow();
            name.setSortType(TableColumn.SortType.DESCENDING);
            sort(results, name);

            assertEquals(ItemsCatalogApi.SortField.NAME, api.queries.getLast().sortField());
            assertFalse(api.queries.getLast().ascending());
            assertEquals(List.of("Zeta", "Alpha"), resultNames(results),
                    "PROVIDER sort must not reorder only the currently visible JavaFX page");
        });
    }

    @Test
    void ITEMS_CATALOG_UI_007_exposesOptionFailureWithRowsAndRetriesOnNextQuery() throws Exception {
        runOnFxThread(() -> {
            FakeItemsApi api = new FakeItemsApi();
            api.nextOptionStatus = ItemsCatalogApi.CatalogStatus.EXECUTION_ERROR;
            Parent pane = show(api, new RecordingInspector()).host();

            assertEquals("Item-Filter konnten nicht geladen werden.",
                    label(pane, "Item-Ergebnisse Status").getText());
            assertEquals(1, table(pane, "Item-Ergebnisse").getItems().size(),
                    "option failure must not discard a successful result page");

            submit(pane);
            assertEquals("", label(pane, "Item-Ergebnisse Status").getText());
            assertEquals(2, api.optionLoads);
            assertTrue(picker(pane, "Item-Kategorie").isManaged());
        });
    }

    @Test
    void ITEMS_CATALOG_UI_008_statusOnlyRefreshDoesNotReplaceUnchangedRows() throws Exception {
        runOnFxThread(() -> {
            FakeItemsApi api = new FakeItemsApi();
            Parent pane = show(api, new RecordingInspector()).host();
            @SuppressWarnings("unchecked")
            TableView<ItemsCatalogApi.ItemRow> results =
                    (TableView<ItemsCatalogApi.ItemRow>) table(pane, "Item-Ergebnisse");
            List<ItemsCatalogApi.ItemRow> unchanged = List.copyOf(results.getItems());
            java.util.concurrent.atomic.AtomicInteger rowMutations = new java.util.concurrent.atomic.AtomicInteger();
            results.getItems().addListener((ListChangeListener<ItemsCatalogApi.ItemRow>) ignored ->
                    rowMutations.incrementAndGet());

            api.deferNextSearch();
            submit(pane);
            assertEquals("Aktualisiere…", label(pane, "Item-Ergebnisse Status").getText());
            assertEquals(0, rowMutations.get());

            api.completeDeferred(ItemsCatalogApi.CatalogStatus.SUCCESS, unchanged, 120);
            assertEquals("", label(pane, "Item-Ergebnisse Status").getText());
            assertEquals(0, rowMutations.get(),
                    "status-only refresh must not replace the unchanged TableView rows");
        });
    }

    private static void assertState(
            Parent pane,
            FakeItemsApi api,
            ItemsCatalogApi.CatalogStatus status,
            String expectedText
    ) {
        api.nextStatus = status;
        submit(pane);
        assertEquals(expectedText, label(pane, "Item-Ergebnisse Status").getText());
    }

    private static void submit(Parent pane) {
        text(pane, "Item-Name").fireEvent(new javafx.event.ActionEvent());
    }

    private static void assertCompleteInspector(InspectorEntrySpec entry) {
        assertNotNull(entry);
        assertEquals("Rapier of Proof", entry.title());
        assertEquals("item:equipment:rapier", entry.entryKey());
        Node content = entry.contentSupplier().get();
        List<String> facts = descendants(content).stream()
                .filter(Label.class::isInstance)
                .map(Label.class::cast)
                .map(Label::getText)
                .toList();
        assertTrue(facts.contains("Kategorie: Weapon / Martial"));
        assertTrue(facts.contains("Magisch: Ja"));
        assertTrue(facts.contains("Seltenheit: Rare"));
        assertTrue(facts.contains("Attunement: Ja"));
        assertTrue(facts.contains("Kosten: 1 sp (10 CP)"));
        assertTrue(facts.contains("Gewicht: 2.0"));
        assertTrue(facts.contains("Eigenschaften: Finesse, Light"));
        assertTrue(facts.contains("Schaden: 1d8 Piercing"));
        assertTrue(facts.contains("Rüstungsklasse: AC 1"));
        assertTrue(facts.contains("Beschreibung: A precise enchanted blade."));
        assertTrue(facts.contains("Quelle: 2014 SRD / https://www.dnd5eapi.co/api/2014/equipment/rapier"));
    }

    private static ItemsFixture show(ItemsCatalogApi api, InspectorSink inspector) {
        CatalogFeature.Component component = CatalogFeature.create(
                providers(api), routes(inspector));
        ShellBinding binding = component.contribution().bind();
        BorderPane pane = new BorderPane(binding.slotContent().get(ShellSlot.COCKPIT_MAIN));
        Stage stage = new Stage();
        stage.setScene(new Scene(pane, 1_180.0, 720.0));
        stage.show();
        pane.applyCss();
        pane.layout();
        binding.onActivate();
        node(pane, ToggleButton.class, "Katalogbereich Items").fire();
        pane.applyCss();
        pane.layout();
        return new ItemsFixture(component, binding, pane);
    }

    private static CatalogProviders providers(ItemsCatalogApi items) {
        features.creatures.api.CreatureCatalogQueryApi creatures =
                new features.creatures.api.CreatureCatalogQueryApi() {
                    @Override
                    public CompletionStage<CreatureCatalogPageResult> search(
                            features.creatures.api.CreatureCatalogQuery query
                    ) {
                        return CompletableFuture.completedFuture(new CreatureCatalogPageResult(
                                CreatureQueryStatus.SUCCESS, CreatureCatalogPage.empty(50, 0)));
                    }

                    @Override
                    public CompletionStage<CreatureFilterOptionsResult> loadFilterOptions() {
                        return CompletableFuture.completedFuture(new CreatureFilterOptionsResult(
                                CreatureReadStatus.SUCCESS, CreatureFilterOptions.empty()));
                    }
                };
        var encounterInputs = new features.encounter.api.EncounterBuilderInputsModel(
                features.encounter.api.EncounterBuilderInputs::empty, listener -> () -> { });
        var savedPlans = new features.encounter.api.SavedEncounterPlanListModel(
                () -> new features.encounter.api.SavedEncounterPlanListResult(
                        features.encounter.api.SavedEncounterPlanStatus.SUCCESS, List.of(), ""),
                listener -> () -> { },
                listener -> {
                    listener.accept(new features.encounter.api.SavedEncounterPlanListResult(
                            features.encounter.api.SavedEncounterPlanStatus.SUCCESS, List.of(), ""));
                    return () -> { };
                });
        var creatureReferences = new features.creatures.api.CreatureReferenceIndexModel(
                () -> new features.creatures.api.CreatureReferenceIndexResult(
                        features.creatures.api.CreatureReferenceIndexStatus.SUCCESS, 1L, List.of()),
                listener -> () -> { },
                listener -> {
                    listener.accept(new features.creatures.api.CreatureReferenceIndexResult(
                            features.creatures.api.CreatureReferenceIndexStatus.SUCCESS, 1L, List.of()));
                    return () -> { };
                });
        var world = new features.worldplanner.api.WorldPlannerSnapshotModel(
                () -> new features.worldplanner.api.WorldPlannerSnapshot(
                        features.worldplanner.api.WorldPlannerReadStatus.SUCCESS,
                        List.of(), List.of(), List.of(), ""),
                listener -> () -> { },
                listener -> {
                    listener.accept(new features.worldplanner.api.WorldPlannerSnapshot(
                            features.worldplanner.api.WorldPlannerReadStatus.SUCCESS,
                            List.of(), List.of(), List.of(), ""));
                    return () -> { };
                });
        var tableModel = new features.encountertable.api.EncounterTableCatalogModel(
                () -> new features.encountertable.api.EncounterTableCatalogResult(
                        features.encountertable.api.EncounterTableReadStatus.SUCCESS, List.of()),
                listener -> () -> { },
                listener -> {
                    listener.accept(new features.encountertable.api.EncounterTableCatalogResult(
                            features.encountertable.api.EncounterTableReadStatus.SUCCESS, List.of()));
                    return () -> { };
                });
        features.encountertable.api.EncounterTableApi tableCommands =
                new features.encountertable.api.EncounterTableApi() {
                    @Override public void refreshCatalog(
                            features.encountertable.api.RefreshEncounterTableCatalogCommand command) { }
                    @Override public void refreshCandidates(
                            features.encountertable.api.RefreshEncounterTableCandidatesCommand command) { }
                };
        return new CatalogProviders(
                new CatalogProviders.MonsterProviders(
                        creatures,
                        new features.encounter.api.EncounterPoolFiltersModel(
                                () -> encounterInputs.current().poolFilters(),
                                listener -> encounterInputs.subscribe(
                                        inputs -> listener.accept(inputs.poolFilters())),
                                listener -> {
                                    listener.accept(encounterInputs.current().poolFilters());
                                    return encounterInputs.subscribe(
                                            inputs -> listener.accept(inputs.poolFilters()));
                                })),
                new CatalogProviders.ItemsProviders(items),
                new CatalogProviders.SavedEncounterProviders(savedPlans),
                new CatalogProviders.WorldReferenceProviders(creatureReferences, world),
                new CatalogProviders.EncounterTableProviders(tableCommands, tableModel),
                new platform.ui.JavaFxUiDispatcher());
    }

    private static CatalogRoutes routes(InspectorSink inspector) {
        CatalogRoutes.WorldInspectorRoutes world = new CatalogRoutes.WorldInspectorRoutes() {
            @Override public void openNpc(long npcId) { }
            @Override public void openFaction(long factionId) { }
            @Override public void openLocation(long locationId) { }
            @Override public void createNpc() { }
            @Override public void createFaction() { }
            @Override public void createLocation() { }
        };
        CatalogRoutes.EncounterHandoff encounter = new CatalogRoutes.EncounterHandoff() {
            @Override public void updatePoolFilters(features.encounter.api.EncounterPoolFilters filters) { }
            @Override public void addCreature(long creatureId) { }
            @Override public void addWorldNpc(long creatureId, long npcId) { }
            @Override public void useFactionSource(long factionId) { }
            @Override public void useLocationSource(long locationId) { }
            @Override public void useEncounterTableSource(long tableId) { }
            @Override public CompletionStage<features.encounter.api.OpenSavedEncounterPlanResult>
                    openSavedEncounter(long planId, boolean discard) {
                return CompletableFuture.completedFuture(new features.encounter.api.OpenSavedEncounterPlanResult(
                        features.encounter.api.OpenSavedEncounterPlanResult.Status.OPENED, planId, ""));
            }
        };
        CatalogRoutes.SceneHandoff scene = new CatalogRoutes.SceneHandoff() {
            @Override public void addCreature(long creatureId) { }
            @Override public void addNpc(long npcId) { }
            @Override public void setLocation(long locationId) { }
        };
        return new CatalogRoutes(
                ignored -> { },
                detail -> features.items.adapter.javafx.ItemDetailsView.openInspector(inspector, detail),
                world, encounter, scene);
    }

    private static TextField text(Parent root, String accessibleText) {
        return node(root, TextField.class, accessibleText);
    }

    private static CatalogPicker<?> picker(Parent root, String accessibleText) {
        return node(root, CatalogPicker.class, accessibleText);
    }

    private static Button button(Parent root, String accessibleText) {
        return node(root, Button.class, accessibleText);
    }

    private static Label label(Parent root, String accessibleText) {
        return node(root, Label.class, accessibleText);
    }

    private static TableView<?> table(Parent root, String accessibleText) {
        return node(root, TableView.class, accessibleText);
    }

    private static List<String> resultNames(TableView<?> table) {
        return table.getItems().stream().map(ItemsCatalogApi.ItemRow.class::cast)
                .map(ItemsCatalogApi.ItemRow::name).toList();
    }

    @SuppressWarnings({"rawtypes", "unchecked"})
    private static void sort(TableView table, TableColumn column) {
        table.getSortOrder().setAll(column);
        table.sort();
    }

    private static <T extends Node> T node(Parent root, Class<T> type, String accessibleText) {
        return descendants(root).stream()
                .filter(type::isInstance)
                .map(type::cast)
                .filter(candidate -> accessibleText.equals(candidate.getAccessibleText()))
                .findFirst()
                .orElseThrow(() -> new AssertionError(
                        type.getSimpleName() + " not found: " + accessibleText));
    }

    private static void select(CatalogPicker<?> picker, String displayText) {
        picker.show();
        for (int index = 0; index < picker.optionList().getItems().size(); index++) {
            if (displayText.equals(picker.optionList().getItems().get(index).label())) {
                picker.optionList().getSelectionModel().select(index);
                picker.optionList().fireEvent(new KeyEvent(
                        KeyEvent.KEY_PRESSED, "", "", KeyCode.ENTER,
                        false, false, false, false));
                return;
            }
        }
        throw new AssertionError("CatalogPicker option not found: " + displayText);
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

    private record ItemsFixture(CatalogFeature.Component component, ShellBinding binding, Parent host) {
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
            throw new IllegalStateException("Timed out waiting for Items Catalog UI test.");
        }
        if (failure[0] != null) {
            throw new IllegalStateException("Items Catalog UI test failed.", failure[0]);
        }
    }

    private static void hideOpenWindows() {
        Platform.setImplicitExit(false);
        for (Window window : List.copyOf(Window.getWindows())) {
            window.hide();
        }
    }

    private static final class FakeItemsApi implements ItemsCatalogApi {
        private final List<ItemQuery> queries = new ArrayList<>();
        private CatalogStatus nextStatus = CatalogStatus.SUCCESS;
        private CatalogStatus nextOptionStatus = CatalogStatus.SUCCESS;
        private CompletableFuture<PageResult> deferred;
        private List<ItemRow> rows = List.of(row());
        private String lastDetailKey;
        private int detailCalls;
        private int optionLoads;

        @Override
        public CompletionStage<FilterOptionsResult> loadFilterOptions() {
            optionLoads++;
            CatalogStatus status = nextOptionStatus;
            nextOptionStatus = CatalogStatus.SUCCESS;
            return CompletableFuture.completedFuture(new FilterOptionsResult(
                    status,
                    status == CatalogStatus.SUCCESS ? List.of("Armor", "Weapon") : List.of(),
                    status == CatalogStatus.SUCCESS ? List.of("Martial", "Simple") : List.of(),
                    status == CatalogStatus.SUCCESS ? List.of("Common", "Rare") : List.of()));
        }

        @Override
        public CompletionStage<PageResult> search(ItemQuery query) {
            queries.add(query);
            if (deferred != null) {
                return deferred;
            }
            CatalogStatus status = nextStatus;
            nextStatus = CatalogStatus.SUCCESS;
            return CompletableFuture.completedFuture(page(status, rows, 120, query.pageOffset()));
        }

        @Override
        public CompletionStage<DetailResult> loadDetail(String sourceKey) {
            lastDetailKey = sourceKey;
            detailCalls++;
            return CompletableFuture.completedFuture(new DetailResult(CatalogStatus.SUCCESS, detail()));
        }

        void deferNextSearch() {
            deferred = new CompletableFuture<>();
        }

        void completeDeferred(CatalogStatus status, List<ItemRow> rows, int totalCount) {
            CompletableFuture<PageResult> pending = deferred;
            deferred = null;
            pending.complete(page(status, rows, totalCount, 0));
        }

        private static PageResult page(CatalogStatus status, List<ItemRow> rows, int total, int offset) {
            return new PageResult(status, status == CatalogStatus.SUCCESS ? rows : List.of(), total, 50, offset);
        }

        private static ItemRow row() {
            return new ItemRow(
                    "equipment:rapier", "Rapier of Proof", "Weapon", "Martial",
                    true, "Rare", true, 10, "1 sp");
        }

        private static ItemDetail detail() {
            return new ItemDetail(
                    "equipment:rapier", "Rapier of Proof", "Weapon", "Martial",
                    true, "Rare", true, 10, "1 sp", 2.0,
                    "1d8 Piercing", "AC 1", List.of("Finesse", "Light"),
                    "A precise enchanted blade.", "2014 SRD",
                    "https://www.dnd5eapi.co/api/2014/equipment/rapier");
        }
    }

    private static final class RecordingInspector implements InspectorSink {
        private InspectorEntrySpec entry;

        @Override
        public void push(InspectorEntrySpec next) {
            entry = next;
        }

        @Override
        public void clear() {
            entry = null;
        }

        @Override
        public boolean isShowing(Object entryKey) {
            return entry != null && entry.entryKey().equals(entryKey);
        }
    }

    @FunctionalInterface
    private interface ThrowingRunnable {
        void run() throws Exception;
    }
}
