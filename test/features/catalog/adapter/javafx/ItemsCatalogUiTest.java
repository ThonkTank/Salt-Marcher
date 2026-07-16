package features.catalog.adapter.javafx;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import features.items.api.ItemsCatalogApi;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import javafx.application.Platform;
import javafx.scene.Node;
import javafx.scene.Parent;
import javafx.scene.Scene;
import javafx.scene.control.Button;
import javafx.scene.control.ComboBox;
import javafx.scene.control.Label;
import javafx.scene.control.ListView;
import javafx.scene.control.TextField;
import javafx.scene.input.KeyCode;
import javafx.scene.input.KeyEvent;
import javafx.stage.Stage;
import javafx.stage.Window;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import shell.api.InspectorEntrySpec;
import shell.api.InspectorSink;

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
            CatalogWorkspaceView.ItemsPane pane = show(api, new RecordingInspector());
            pane.refresh();

            text(pane, "Item-Name").setText("  blade  ");
            select(combo(pane, "Item-Kategorie"), "Weapon");
            select(combo(pane, "Item-Unterkategorie"), "Martial");
            select(combo(pane, "Item-Seltenheit"), "Rare");
            select(combo(pane, "Item-Magie"), "Ja");
            select(combo(pane, "Item-Attunement"), "Nein");
            text(pane, "Item-Minimalkosten").setText("100");
            text(pane, "Item-Maximalkosten").setText("900");
            select(combo(pane, "Item-Sortierfeld"), "Kosten");
            select(combo(pane, "Item-Sortierrichtung"), "Absteigend");
            button(pane, "Items suchen").fire();

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
            CatalogWorkspaceView.ItemsPane pane = show(api, new RecordingInspector());
            pane.refresh();

            api.deferNextSearch();
            button(pane, "Items suchen").fire();
            assertEquals("Items werden geladen …", label(pane, "Item-Status").getText());
            api.completeDeferred(ItemsCatalogApi.CatalogStatus.SUCCESS, List.of(), 0);
            assertEquals("Keine Items gefunden.", label(pane, "Item-Status").getText());

            assertState(pane, api, ItemsCatalogApi.CatalogStatus.INVALID_QUERY, "Ungültige Item-Suche.");
            assertState(pane, api, ItemsCatalogApi.CatalogStatus.UNAVAILABLE,
                    "Noch kein Item-Katalog importiert.");
            assertState(pane, api, ItemsCatalogApi.CatalogStatus.STORAGE_ERROR,
                    "Item-Katalog konnte nicht gelesen werden.");
            assertState(pane, api, ItemsCatalogApi.CatalogStatus.EXECUTION_ERROR,
                    "Item-Suche konnte nicht ausgeführt werden.");

            int callsBeforeInvalidText = api.queries.size();
            text(pane, "Item-Minimalkosten").setText("keine Zahl");
            button(pane, "Items suchen").fire();
            assertEquals(callsBeforeInvalidText, api.queries.size());
            assertEquals("Ungültige Item-Suche.", label(pane, "Item-Status").getText());
        });
    }

    @Test
    void ITEMS_CATALOG_UI_003_opensCompleteInspectorByButtonAndEnter() throws Exception {
        runOnFxThread(() -> {
            FakeItemsApi api = new FakeItemsApi();
            RecordingInspector inspector = new RecordingInspector();
            CatalogWorkspaceView.ItemsPane pane = show(api, inspector);
            pane.refresh();
            ListView<?> results = list(pane, "Item-Ergebnisse");
            results.getSelectionModel().selectFirst();

            Button open = button(pane, "Ausgewähltes Item im Inspector öffnen");
            assertFalse(open.isDisabled());
            open.fire();
            assertEquals("equipment:rapier", api.lastDetailKey);
            assertCompleteInspector(inspector.entry);

            inspector.clear();
            results.fireEvent(new KeyEvent(
                    KeyEvent.KEY_PRESSED, "", "", KeyCode.ENTER,
                    false, false, false, false));
            assertNotNull(inspector.entry, "Enter must invoke the same accessible primary detail action");
        });
    }

    private static void assertState(
            CatalogWorkspaceView.ItemsPane pane,
            FakeItemsApi api,
            ItemsCatalogApi.CatalogStatus status,
            String expectedText
    ) {
        api.nextStatus = status;
        button(pane, "Items suchen").fire();
        assertEquals(expectedText, label(pane, "Item-Status").getText());
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

    private static CatalogWorkspaceView.ItemsPane show(ItemsCatalogApi api, InspectorSink inspector) {
        CatalogWorkspaceView.ItemsPane pane = new CatalogWorkspaceView.ItemsPane(api, inspector);
        Stage stage = new Stage();
        stage.setScene(new Scene(pane, 1_180.0, 720.0));
        stage.show();
        pane.applyCss();
        pane.layout();
        return pane;
    }

    private static TextField text(Parent root, String accessibleText) {
        return node(root, TextField.class, accessibleText);
    }

    private static ComboBox<?> combo(Parent root, String accessibleText) {
        return node(root, ComboBox.class, accessibleText);
    }

    private static Button button(Parent root, String accessibleText) {
        return node(root, Button.class, accessibleText);
    }

    private static Label label(Parent root, String accessibleText) {
        return node(root, Label.class, accessibleText);
    }

    private static ListView<?> list(Parent root, String accessibleText) {
        return node(root, ListView.class, accessibleText);
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

    private static void select(ComboBox<?> box, String displayText) {
        for (Object item : box.getItems()) {
            if (displayText.equals(itemText(box, item))) {
                selectRaw(box, item);
                return;
            }
        }
        throw new AssertionError("ComboBox item not found: " + displayText);
    }

    @SuppressWarnings({"rawtypes", "unchecked"})
    private static void selectRaw(ComboBox box, Object item) {
        box.getSelectionModel().select(item);
    }

    @SuppressWarnings({"rawtypes", "unchecked"})
    private static String itemText(ComboBox box, Object item) {
        return box.getConverter() == null ? String.valueOf(item) : box.getConverter().toString(item);
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
        private CompletableFuture<PageResult> deferred;
        private String lastDetailKey;

        @Override
        public CompletionStage<FilterOptionsResult> loadFilterOptions() {
            return CompletableFuture.completedFuture(new FilterOptionsResult(
                    CatalogStatus.SUCCESS,
                    List.of("Armor", "Weapon"),
                    List.of("Martial", "Simple"),
                    List.of("Common", "Rare")));
        }

        @Override
        public CompletionStage<PageResult> search(ItemQuery query) {
            queries.add(query);
            if (deferred != null) {
                return deferred;
            }
            CatalogStatus status = nextStatus;
            nextStatus = CatalogStatus.SUCCESS;
            return CompletableFuture.completedFuture(page(status, List.of(row()), 120, query.pageOffset()));
        }

        @Override
        public CompletionStage<DetailResult> loadDetail(String sourceKey) {
            lastDetailKey = sourceKey;
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
