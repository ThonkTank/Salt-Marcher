package src.view.slotcontent.controls.catalogcrud;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import javafx.application.Platform;
import javafx.scene.Node;
import javafx.scene.Parent;
import javafx.scene.Scene;
import javafx.scene.control.Button;
import javafx.scene.control.ComboBox;
import javafx.scene.control.TextField;
import javafx.stage.Stage;
import javafx.stage.Window;

public final class CatalogCrudControlsHarness {

    private static final int AWAIT_SECONDS = 30;
    private static final AtomicBoolean FX_STARTED = new AtomicBoolean();

    private CatalogCrudControlsHarness() {
    }

    public static void main(String[] args) throws Exception {
        try {
            runOnFxThread(CatalogCrudControlsHarness::runHarness);
            shutdownFx();
            System.out.println("Catalog CRUD controls harness passed.");
        } catch (Throwable throwable) {
            throwable.printStackTrace(System.err);
            shutdownFx();
            System.exit(1);
        }
    }

    private static void runHarness() {
        CatalogCrudControlsContentModel model = new CatalogCrudControlsContentModel();
        CatalogCrudControlsView view = new CatalogCrudControlsView();
        List<CatalogCrudControlsViewInputEvent> events = new ArrayList<>();
        view.onViewInputEvent(event -> {
            events.add(event);
            applyCatalogEvent(model, event);
        });
        view.bind(model);
        Stage stage = new Stage();
        stage.setScene(new Scene(view, 720.0, 320.0));
        stage.show();
        view.applyCss();
        view.layout();

        model.showCatalog(state(
                "a",
                List.of(
                        new CatalogCrudControlsContentModel.Item("a", "Alpha", "", 0L, true),
                        new CatalogCrudControlsContentModel.Item("b", "Beta", "", 0L, true)),
                new CatalogCrudControlsContentModel.Actions(true, true, true, true),
                false));
        view.applyCss();
        view.layout();

        ComboBox<?> selector = descendant(view, ComboBox.class);
        selector.getSelectionModel().select(1);
        CatalogCrudControlsViewInputEvent select = last(events);
        assertEquals("b", select.selectedItemId(), "select emits selected id");
        assertTrue(select.createDraftName().isBlank(), "select emits no draft");

        events.clear();
        button(view, "Neu").fire();
        textField(view).setText("Gamma");
        button(view, "Erstellen").fire();
        CatalogCrudControlsViewInputEvent create = last(events);
        assertEquals("Gamma", create.createDraftName(), "create submit emits draft name");

        events.clear();
        button(view, "Umbenennen").fire();
        TextField draft = textField(view);
        assertEquals("Beta", draft.getText(), "rename preloads selected label");
        draft.setText("Beta Prime");
        button(view, "Speichern").fire();
        CatalogCrudControlsViewInputEvent rename = last(events);
        assertEquals("b", rename.renameItemId(), "rename submit emits selected target id");
        assertEquals("Beta Prime", rename.renameDraftName(), "rename submit emits draft name");

        events.clear();
        button(view, "Löschen").fire();
        CatalogCrudControlsViewInputEvent confirmRequest = last(events);
        assertEquals("b", confirmRequest.deleteRequestItemId(), "delete click requests confirmation for selected id");
        assertTrue(confirmRequest.deleteConfirmItemId().isBlank(), "delete click does not delete before confirmation");
        buttonByAccessibleText(view, "Löschen bestätigen").fire();
        CatalogCrudControlsViewInputEvent delete = last(events);
        assertEquals("b", delete.deleteConfirmItemId(), "delete confirmation emits selected target id");

        events.clear();
        model.showCatalog(state(
                "",
                List.of(new CatalogCrudControlsContentModel.Item("a", "Alpha", "", 0L, true)),
                new CatalogCrudControlsContentModel.Actions(true, true, true, true),
                false));
        view.applyCss();
        view.layout();
        events.clear();
        assertTrue(selector.getSelectionModel().isEmpty(), "catalog without readback selection keeps selector empty");
        assertFalse(button(view, "Neu").isDisabled(), "catalog without selection still allows create");
        assertTrue(button(view, "Umbenennen").isDisabled(), "catalog without selection disables rename");
        assertTrue(button(view, "Löschen").isDisabled(), "catalog without selection disables delete");
        assertTrue(button(view, "Neu laden").isDisabled(), "catalog without selection disables reload");
        button(view, "Umbenennen").fire();
        button(view, "Löschen").fire();
        button(view, "Neu laden").fire();
        assertTrue(events.isEmpty(), "catalog without selection blocks selected-item actions");

        events.clear();
        model.showCatalog(state(
                "missing",
                List.of(new CatalogCrudControlsContentModel.Item("a", "Alpha", "", 0L, true)),
                new CatalogCrudControlsContentModel.Actions(true, true, true, true),
                false));
        view.applyCss();
        view.layout();
        events.clear();
        assertTrue(selector.getSelectionModel().isEmpty(), "catalog with invalid readback selection keeps selector empty");
        assertFalse(button(view, "Neu").isDisabled(), "catalog with invalid selection still allows create");
        assertTrue(button(view, "Umbenennen").isDisabled(), "catalog with invalid selection disables rename");
        assertTrue(button(view, "Löschen").isDisabled(), "catalog with invalid selection disables delete");
        assertTrue(button(view, "Neu laden").isDisabled(), "catalog with invalid selection disables reload");
        button(view, "Umbenennen").fire();
        button(view, "Löschen").fire();
        button(view, "Neu laden").fire();
        assertTrue(events.isEmpty(), "catalog with invalid selection blocks selected-item actions");

        events.clear();
        model.showCatalog(state(
                "",
                List.of(),
                CatalogCrudControlsContentModel.Actions.readOnly(),
                false));
        view.applyCss();
        view.layout();
        events.clear();
        assertTrue(selector.isDisabled(), "empty read-only catalog disables selector");
        assertTrue(button(view, "Neu").isDisabled(), "empty read-only catalog disables create");
        assertTrue(button(view, "Umbenennen").isDisabled(), "empty read-only catalog disables rename");
        assertTrue(button(view, "Löschen").isDisabled(), "empty read-only catalog disables delete");
        button(view, "Neu").fire();
        button(view, "Umbenennen").fire();
        button(view, "Löschen").fire();
        assertTrue(events.isEmpty(), "empty read-only catalog blocks invalid actions");

        model.showCatalog(state(
                "a",
                List.of(new CatalogCrudControlsContentModel.Item("a", "Alpha", "", 0L, true)),
                new CatalogCrudControlsContentModel.Actions(true, true, true, true),
                true));
        view.applyCss();
        view.layout();
        assertTrue(selector.isDisabled(), "busy catalog disables selector");
        assertTrue(button(view, "Neu").isDisabled(), "busy catalog disables create");
        assertTrue(button(view, "Umbenennen").isDisabled(), "busy catalog disables rename");
        assertTrue(button(view, "Löschen").isDisabled(), "busy catalog disables delete");
        assertTrue(button(view, "Neu laden").isDisabled(), "busy catalog disables reload");
    }

    private static CatalogCrudControlsContentModel.CatalogState state(
            String selectedId,
            List<CatalogCrudControlsContentModel.Item> items,
            CatalogCrudControlsContentModel.Actions actions,
            boolean busy
    ) {
        return new CatalogCrudControlsContentModel.CatalogState(
                "Maps",
                "Karte auswaehlen",
                "Keine Karten.",
                selectedId,
                items,
                actions,
                busy,
                "");
    }

    private static CatalogCrudControlsViewInputEvent last(List<CatalogCrudControlsViewInputEvent> events) {
        if (events.isEmpty()) {
            throw new AssertionError("No catalog CRUD event was emitted.");
        }
        return events.getLast();
    }

    private static void applyCatalogEvent(
            CatalogCrudControlsContentModel model,
            CatalogCrudControlsViewInputEvent event
    ) {
        if (!event.selectedItemId().isBlank()) {
            model.selectItem(event.selectedItemId());
            return;
        }
        if (event.createEditorOpened()) {
            model.openCreate();
            return;
        }
        if (!event.renameEditorItemId().isBlank()) {
            model.openRename(event.renameEditorItemId());
            return;
        }
        if (!event.deleteRequestItemId().isBlank()) {
            model.openDelete(event.deleteRequestItemId());
            return;
        }
        if (!event.createDraftName().isBlank()
                || !event.renameDraftName().isBlank()
                || !event.deleteConfirmItemId().isBlank()
                || event.dismissed()) {
            model.closeOperation();
        }
    }

    private static Button button(Parent parent, String text) {
        return descendants(parent).stream()
                .filter(Button.class::isInstance)
                .map(Button.class::cast)
                .filter(button -> text.equals(button.getText()))
                .findFirst()
                .orElseThrow(() -> new AssertionError("Button not found: " + text));
    }

    private static Button buttonByAccessibleText(Parent parent, String accessibleText) {
        return descendants(parent).stream()
                .filter(Button.class::isInstance)
                .map(Button.class::cast)
                .filter(button -> accessibleText.equals(button.getAccessibleText()))
                .findFirst()
                .orElseThrow(() -> new AssertionError("Button not found: " + accessibleText));
    }

    private static TextField textField(Parent parent) {
        return descendant(parent, TextField.class);
    }

    private static <T extends Node> T descendant(Parent parent, Class<T> type) {
        return descendants(parent).stream()
                .filter(type::isInstance)
                .map(type::cast)
                .findFirst()
                .orElseThrow(() -> new AssertionError("Descendant not found: " + type.getSimpleName()));
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

    private static void assertEquals(Object expected, Object actual, String message) {
        if (!expected.equals(actual)) {
            throw new AssertionError(message + ": expected=" + expected + ", actual=" + actual);
        }
    }

    private static void assertTrue(boolean condition, String message) {
        if (!condition) {
            throw new AssertionError(message);
        }
    }

    private static void assertFalse(boolean condition, String message) {
        assertTrue(!condition, message);
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
            throw new IllegalStateException("Timed out waiting for JavaFX Catalog CRUD harness.");
        }
        if (failure[0] != null) {
            throw new IllegalStateException("Catalog CRUD controls harness failed.", failure[0]);
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
}
