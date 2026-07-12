package src.view.slotcontent.controls.catalogcrud;

import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import javafx.application.Platform;
import javafx.geometry.Bounds;
import javafx.scene.Node;
import javafx.scene.Parent;
import javafx.scene.Scene;
import javafx.scene.control.Button;
import javafx.scene.control.ComboBox;
import javafx.scene.control.ContextMenu;
import javafx.scene.control.Label;
import javafx.scene.control.MenuButton;
import javafx.scene.control.MenuItem;
import javafx.scene.control.TextField;
import javafx.scene.layout.HBox;
import javafx.stage.Stage;
import javafx.stage.Window;
import javafx.stage.WindowEvent;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import shell.api.InspectorEntrySpec;
import shell.api.InspectorSink;
import shell.api.ServiceRegistry;
import shell.api.ShellBinding;
import shell.api.ShellRuntimeContext;
import shell.api.ShellSlot;
import src.domain.hex.published.HexEditorModel;
import src.view.leftbartabs.hexmap.HexMapContribution;

public final class CatalogCrudControlsHarness {

    private static final int AWAIT_SECONDS = 30;
    private static final AtomicBoolean FX_STARTED = new AtomicBoolean();

    @AfterEach
    void hideWindows() throws Exception {
        runOnFxThread(CatalogCrudControlsHarness::hideOpenWindows);
    }

    @AfterAll
    static void shutdownJavaFx() throws Exception {
        shutdownFx();
    }

    @Test
    void CATALOG_CRUD_CONTROLS_001() throws Exception {
        runOnFxThread(CatalogCrudControlsHarness::runHarness);
    }

    @Test
    void CATALOG_CRUD_CONTROLS_002() throws Exception {
        runOnFxThread(CatalogCrudControlsHarness::assertHexMapProductionCatalogRoute);
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
        Scene scene = new Scene(view, 720.0, 320.0);
        scene.getStylesheets().add(Path.of("resources", "salt-marcher.css").toUri().toString());
        stage.setScene(scene);
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
        Button createButton = button(view, "Neu");
        MenuButton actionMenuButton = actionMenuButton(view);
        TextField filterField = textField(view, "Auswahl filtern");
        assertEquals("Mehr", actionMenuButton.getText(), "secondary actions live behind a separate menu");
        assertControlRowOrder(view, filterField, selector, button(view, "Öffnen"), createButton, actionMenuButton);
        assertNoVisibleLabel(view, "Maps", "shared embedded catalog omits the title header");
        events.clear();
        @SuppressWarnings("unchecked")
        ComboBox<String> stringSelector = (ComboBox<String>) selector;
        assertEquals("Alpha", closedSelectorText(stringSelector), "closed selector renders selected catalog label");
        assertCatalogRowGeometry(view, actionMenuButton, "initial catalog selector row fits without clipping");
        double viewHeightBeforeStatus = view.getLayoutBounds().getHeight();
        Bounds selectorRowBoundsBeforeStatus = selectorRow(view).getBoundsInParent();
        stringSelector.getSelectionModel().select("b");
        CatalogCrudControlsViewInputEvent select = last(events);
        assertEquals("b", select.selectedItemId(), "select emits selected id");
        stringSelector.show();
        stringSelector.hide();
        view.applyCss();
        view.layout();
        assertEquals("Beta", closedSelectorText(stringSelector), "closed selector keeps selected label after popup close");
        assertTrue(select.openItemId().isBlank(), "select does not emit open id");
        assertTrue(select.createDraftName().isBlank(), "select emits no draft");
        assertEquals(1L, descendants(view).stream().filter(TextField.class::isInstance).count(),
                "selection keeps management editor out of parent layout");
        model.showCatalog(state(
                "a",
                List.of(
                        new CatalogCrudControlsContentModel.Item("a", "Alpha", "", 0L, true),
                        new CatalogCrudControlsContentModel.Item("b", "Beta", "", 0L, true)),
                new CatalogCrudControlsContentModel.Actions(true, true, true, true),
                false));
        view.applyCss();
        view.layout();

        model.showCatalog(state(
                "s1",
                List.of(
                        new CatalogCrudControlsContentModel.Item("m1", "Mond", "", 0L, true),
                        new CatalogCrudControlsContentModel.Item("m2", "Mondlicht", "", 0L, true),
                        new CatalogCrudControlsContentModel.Item("s1", "Sonne", "", 0L, true)),
                new CatalogCrudControlsContentModel.Actions(true, true, true, true),
                false));
        view.applyCss();
        view.layout();
        filterField.setText("mond");
        view.applyCss();
        view.layout();
        assertEquals("mond", last(events).selectorFilterText(), "filter edit emits normalized filter snapshot");
        assertEquals(List.of("m1", "m2"), List.copyOf(selector.getItems()), "selector filter keeps matching catalog item ids");
        assertTrue(button(view, "Öffnen").isDisabled(), "selector filter clears open when the current selection is not visible");
        assertTrue(menuItem(view, "Umbenennen").isDisable(), "selector filter clears rename when the current selection is not visible");
        selector.getSelectionModel().select(1);
        CatalogCrudControlsViewInputEvent filteredSelect = last(events);
        assertEquals("m2", filteredSelect.selectedItemId(), "filtered selector still emits item identity");
        assertTrue(filteredSelect.selectorFilterText().isBlank(), "filtered selection clears the filter through the event route");
        assertEquals(3, selector.getItems().size(), "choosing a filtered item restores the full selector list");
        assertEquals("m2", selector.getValue(), "choosing a filtered item keeps that item selected after the filter clears");
        assertEquals("", filterField.getText(), "choosing a filtered item clears the filter field");
        assertFalse(button(view, "Öffnen").isDisabled(), "restored full selector keeps open enabled for the chosen item");
        events.clear();
        filterField.setText("zzz");
        view.applyCss();
        view.layout();
        assertTrue(selector.getItems().isEmpty(), "selector filter removes non-matching rows locally");
        assertEquals("Keine Treffer.", placeholderText(selector), "selector surface shows no-match messaging");
        assertTrue(button(view, "Öffnen").isDisabled(), "selector filter with no match keeps open disabled");

        filterField.clear();
        model.showCatalog(state(
                "b",
                List.of(
                        new CatalogCrudControlsContentModel.Item("a", "Alpha", "", 0L, true),
                        new CatalogCrudControlsContentModel.Item("b", "Beta", "", 0L, true)),
                new CatalogCrudControlsContentModel.Actions(true, true, true, true),
                false,
                "Dungeon-Map gelöscht und Alpha als nächster verfügbarer Eintrag ausgewählt."));
        view.applyCss();
        view.layout();
        assertVisibleLabelCount(
                view,
                "Dungeon-Map gelöscht und Alpha als nächster verfügbarer Eintrag ausgewählt.",
                1L,
                "non-empty catalog shows status text below selector row");
        assertEquals("Beta", closedSelectorText(stringSelector), "status text does not clear closed selected label");
        assertCatalogRowGeometry(view, actionMenuButton, "status text does not expand or clip selector action row");
        assertStableStatusLayout(
                view,
                selectorRowBoundsBeforeStatus,
                viewHeightBeforeStatus,
                "status text does not move the selector row or resize the shared control surface");

        model.showCatalog(state(
                "b",
                List.of(
                        new CatalogCrudControlsContentModel.Item("a", "Alpha", "", 0L, true),
                        new CatalogCrudControlsContentModel.Item("b", "Beta", "", 0L, true)),
                new CatalogCrudControlsContentModel.Actions(true, true, true, true),
                false));
        view.applyCss();
        view.layout();
        assertStableStatusLayout(
                view,
                selectorRowBoundsBeforeStatus,
                viewHeightBeforeStatus,
                "clearing status text does not move the selector row or resize the shared control surface");

        events.clear();
        button(view, "Öffnen").fire();
        CatalogCrudControlsViewInputEvent open = last(events);
        assertEquals("b", open.openItemId(), "open button emits selected id");
        assertTrue(open.selectedItemId().isBlank(), "open button does not emit staged selection");

        events.clear();
        createButton.fire();
        CatalogCrudControlsViewInputEvent createOpen = last(events);
        assertTrue(createOpen.createEditorOpened(), "visible Neu button opens create editor");
        assertTrue(filterField.isDisabled(), "operation popup disables filter editing");
        assertEquals("", filterField.getText(), "operation popup clears stale filter text");
        assertEquals(1L, descendants(view).stream().filter(TextField.class::isInstance).count(),
                "create editor is not inserted into parent layout");
        events.clear();
        hideOperationPopupExternally(view);
        CatalogCrudControlsViewInputEvent autoHideDismissal = last(events);
        assertTrue(autoHideDismissal.dismissed(), "external popup hide emits dismissal");
        assertFalse(selector.isDisabled(), "external popup hide restores selector");
        assertFalse(filterField.isDisabled(), "external popup hide restores filter editing");
        events.clear();
        createButton.fire();
        assertTrue(last(events).createEditorOpened(), "visible Neu button reopens create editor after external hide");
        popupTextField(view).setText("Gamma");
        popupButton(view, "Erstellen").fire();
        CatalogCrudControlsViewInputEvent create = last(events);
        assertEquals("Gamma", create.createDraftName(), "create submit emits draft name");

        events.clear();
        menuItem(view, "Umbenennen").fire();
        assertEquals(1L, descendants(view).stream().filter(TextField.class::isInstance).count(),
                "rename editor is not inserted into parent layout");
        TextField draft = popupTextField(view);
        assertEquals("Beta", draft.getText(), "rename preloads selected label");
        draft.setText("Beta Prime");
        popupButton(view, "Speichern").fire();
        CatalogCrudControlsViewInputEvent rename = last(events);
        assertEquals("b", rename.renameItemId(), "rename submit emits selected target id");
        assertEquals("Beta Prime", rename.renameDraftName(), "rename submit emits draft name");

        events.clear();
        menuItem(view, "Löschen").fire();
        CatalogCrudControlsViewInputEvent confirmRequest = last(events);
        assertEquals("b", confirmRequest.deleteRequestItemId(), "delete click requests confirmation for selected id");
        assertTrue(confirmRequest.deleteConfirmItemId().isBlank(), "delete click does not delete before confirmation");
        popupButtonByAccessibleText(view, "Löschen bestätigen").fire();
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
        assertEquals("Keine Auswahl", selector.getPromptText(), "catalog without selection shows default prompt");
        assertTrue(button(view, "Öffnen").isDisabled(), "catalog without selection disables open");
        assertFalse(button(view, "Neu").isDisabled(), "catalog without selection still allows create");
        assertTrue(actionMenuButton(view).isDisabled(), "catalog without selection disables secondary selected-item actions");
        assertTrue(menuItem(view, "Umbenennen").isDisable(), "catalog without selection disables rename");
        assertTrue(menuItem(view, "Löschen").isDisable(), "catalog without selection disables delete");
        assertTrue(menuItem(view, "Neu laden").isDisable(), "catalog without selection disables reload");
        menuItem(view, "Umbenennen").fire();
        menuItem(view, "Löschen").fire();
        menuItem(view, "Neu laden").fire();
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
        assertTrue(button(view, "Öffnen").isDisabled(), "catalog with invalid selection disables open");
        assertFalse(button(view, "Neu").isDisabled(), "catalog with invalid selection still allows create");
        assertTrue(actionMenuButton(view).isDisabled(), "catalog with invalid selection disables secondary selected-item actions");
        assertTrue(menuItem(view, "Umbenennen").isDisable(), "catalog with invalid selection disables rename");
        assertTrue(menuItem(view, "Löschen").isDisable(), "catalog with invalid selection disables delete");
        assertTrue(menuItem(view, "Neu laden").isDisable(), "catalog with invalid selection disables reload");
        menuItem(view, "Umbenennen").fire();
        menuItem(view, "Löschen").fire();
        menuItem(view, "Neu laden").fire();
        assertTrue(events.isEmpty(), "catalog with invalid selection blocks selected-item actions");

        events.clear();
        model.showCatalog(state(
                "b",
                List.of(
                        new CatalogCrudControlsContentModel.Item("a", "Alpha", "", 0L, true),
                        new CatalogCrudControlsContentModel.Item("b", "Beta", "", 0L, true)),
                new CatalogCrudControlsContentModel.Actions(true, true, true, true),
                false));
        view.applyCss();
        view.layout();
        filterField.setText("Alpha");
        view.applyCss();
        view.layout();
        model.showCatalog(state(
                "",
                List.of(),
                CatalogCrudControlsContentModel.Actions.readOnly(),
                false,
                "Katalog leer."));
        view.applyCss();
        view.layout();
        events.clear();
        assertTrue(selector.isDisabled(), "empty read-only catalog disables selector");
        assertTrue(filterField.isDisabled(), "empty read-only catalog disables filter");
        assertEquals("", filterField.getText(), "empty read-only catalog clears stale filter text");
        assertTrue(createButton.isDisabled(), "empty read-only catalog disables create action");
        assertTrue(actionMenuButton.isDisabled(), "empty read-only catalog disables secondary actions");
        assertTrue(menuItem(view, "Umbenennen").isDisable(), "empty read-only catalog disables rename");
        assertTrue(menuItem(view, "Löschen").isDisable(), "empty read-only catalog disables delete");
        assertEquals("Keine Karten.", selector.getPromptText(), "empty catalog prompt carries the empty message");
        assertEquals("Keine Karten.", placeholderText(selector), "empty catalog placeholder carries the empty message");
        assertTrue(selector.getPlaceholder() instanceof Label placeholder
                        && "Keine Karten.".equals(placeholder.getText())
                        && placeholder.isVisible(),
                "empty message is bound to the selector placeholder node");
        assertVisibleLabelCount(view, "Katalog leer.", 0L, "empty catalog suppresses lower status text");
        createButton.fire();
        menuItem(view, "Umbenennen").fire();
        menuItem(view, "Löschen").fire();
        assertTrue(events.isEmpty(), "empty read-only catalog blocks invalid actions");

        model.showCatalog(state(
                "a",
                List.of(new CatalogCrudControlsContentModel.Item("a", "Alpha", "", 0L, true)),
                CatalogCrudControlsContentModel.Actions.hiddenReadOnly(),
                false));
        view.applyCss();
        view.layout();
        assertFalse(createButton.isVisible(), "hidden read-only catalog hides create action");
        assertFalse(createButton.isManaged(), "hidden read-only catalog removes create action from layout");
        assertFalse(actionMenuButton.isVisible(), "hidden read-only catalog hides secondary actions");
        assertFalse(actionMenuButton.isManaged(), "hidden read-only catalog removes secondary actions from layout");
        assertFalse(menuItem(view, "Umbenennen").isVisible(), "hidden read-only catalog hides rename");
        assertFalse(menuItem(view, "Löschen").isVisible(), "hidden read-only catalog hides delete");
        assertFalse(menuItem(view, "Neu laden").isVisible(), "hidden read-only catalog hides reload");

        model.showCatalog(state(
                "a",
                List.of(new CatalogCrudControlsContentModel.Item("a", "Alpha", "", 0L, true)),
                new CatalogCrudControlsContentModel.Actions(true, true, true, true),
                false));
        view.applyCss();
        view.layout();
        filterField.setText("Alpha");
        view.applyCss();
        view.layout();
        model.showCatalog(state(
                "a",
                List.of(new CatalogCrudControlsContentModel.Item("a", "Alpha", "", 0L, true)),
                new CatalogCrudControlsContentModel.Actions(true, true, true, true),
                true));
        view.applyCss();
        view.layout();
        assertTrue(selector.isDisabled(), "busy catalog disables selector");
        assertTrue(filterField.isDisabled(), "busy catalog disables filter");
        assertEquals("", filterField.getText(), "busy catalog clears stale filter text");
        assertTrue(button(view, "Öffnen").isDisabled(), "busy catalog disables open");
        assertTrue(createButton.isDisabled(), "busy catalog disables create action");
        assertTrue(actionMenuButton.isDisabled(), "busy catalog disables secondary actions");
        assertTrue(menuItem(view, "Umbenennen").isDisable(), "busy catalog disables rename");
        assertTrue(menuItem(view, "Löschen").isDisable(), "busy catalog disables delete");
        assertTrue(menuItem(view, "Neu laden").isDisable(), "busy catalog disables reload");

        model.showCatalog(state(
                "s1",
                List.of(
                        new CatalogCrudControlsContentModel.Item("m1", "Mond", "", 0L, true),
                        new CatalogCrudControlsContentModel.Item("m2", "Mondlicht", "", 0L, true),
                        new CatalogCrudControlsContentModel.Item("s1", "Sonne", "", 0L, true)),
                new CatalogCrudControlsContentModel.Actions(true, true, true, true),
                false));
        view.applyCss();
        view.layout();
        assertFalse(filterField.isDisabled(), "available catalog restores filter editing");
        filterField.setText("mond");
        view.applyCss();
        view.layout();
        assertEquals(List.of("m1", "m2"), List.copyOf(selector.getItems()), "available catalog restores selector-local filtering");
    }

    private static void assertHexMapProductionCatalogRoute() {
        ServiceRegistry services = hexMapServices();
        ShellBinding binding = new HexMapContribution().bind(
                new ShellRuntimeContext(EmptyInspectorSink.INSTANCE, services));
        Parent controls = slot(binding, ShellSlot.COCKPIT_CONTROLS, Parent.class);
        CatalogCrudControlsView catalog = descendant(controls, CatalogCrudControlsView.class);
        Stage stage = new Stage();
        stage.setScene(new Scene(controls, 760.0, 420.0));
        stage.show();
        layoutOpenWindows();

        button(catalog, "Neu").fire();
        layoutOpenWindows();
        popupTextField(catalog).setText("Route Map");
        popupButton(catalog, "Erstellen").fire();
        layoutOpenWindows();

        String selectedName = services.require(HexEditorModel.class).current().selectedMap()
                .orElseThrow(() -> new AssertionError("Hex production route did not select the created map."))
                .displayName();
        assertEquals("Route Map", selectedName,
                "shared Catalog CRUD controls create through HexMapContribution production route");
        stage.close();
    }

    private static ServiceRegistry hexMapServices() {
        ServiceRegistry.Builder builder = new ServiceRegistry.Builder();
        new src.data.hex.HexServiceContribution().register(builder);
        new src.data.party.PartyServiceContribution().register(builder);
        new src.domain.party.PartyServiceContribution().register(builder);
        new src.domain.hex.HexServiceContribution().register(builder);
        return builder.build();
    }

    private static CatalogCrudControlsContentModel.CatalogState state(
            String selectedId,
            List<CatalogCrudControlsContentModel.Item> items,
            CatalogCrudControlsContentModel.Actions actions,
            boolean busy
    ) {
        return state(selectedId, items, actions, busy, "");
    }

    private static CatalogCrudControlsContentModel.CatalogState state(
            String selectedId,
            List<CatalogCrudControlsContentModel.Item> items,
            CatalogCrudControlsContentModel.Actions actions,
            boolean busy,
            String statusText
    ) {
        return new CatalogCrudControlsContentModel.CatalogState(
                "Maps",
                "Karte auswaehlen",
                "Keine Karten.",
                selectedId,
                items,
                actions,
                busy,
                statusText);
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
        model.updateSelectorFilter(event.selectorFilterText());
        if (!event.selectedItemId().isBlank()) {
            model.selectItem(event.selectedItemId());
            return;
        }
        if (!event.openItemId().isBlank()) {
            model.selectItem(event.openItemId());
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

    private static Button popupButton(CatalogCrudControlsView view, String text) {
        return descendants(operationPopupContent(view)).stream()
                .filter(Button.class::isInstance)
                .map(Button.class::cast)
                .filter(button -> text.equals(button.getText()))
                .findFirst()
                .orElseThrow(() -> new AssertionError("Popup button not found: " + text));
    }

    private static Button popupButtonByAccessibleText(CatalogCrudControlsView view, String accessibleText) {
        return descendants(operationPopupContent(view)).stream()
                .filter(Button.class::isInstance)
                .map(Button.class::cast)
                .filter(button -> accessibleText.equals(button.getAccessibleText()))
                .findFirst()
                .orElseThrow(() -> new AssertionError("Popup button not found: " + accessibleText));
    }

    private static TextField popupTextField(CatalogCrudControlsView view) {
        return descendants(operationPopupContent(view)).stream()
                .filter(TextField.class::isInstance)
                .map(TextField.class::cast)
                .findFirst()
                .orElseThrow(() -> new AssertionError("TextField not found in popup content."));
    }

    private static MenuButton actionMenuButton(Parent parent) {
        return descendant(parent, MenuButton.class);
    }

    private static String closedSelectorText(ComboBox<?> selector) {
        if (selector.getButtonCell() == null) {
            return "";
        }
        String text = selector.getButtonCell().getText();
        return text == null ? "" : text;
    }

    private static void assertCatalogRowGeometry(
            CatalogCrudControlsView view,
            MenuButton actionMenuButton,
            String message
    ) {
        HBox row = selectorRow(view);
        Bounds rowBounds = row.getLayoutBounds();
        Bounds menuBounds = actionMenuButton.getBoundsInParent();
        assertTrue(rowBounds.getWidth() <= view.getLayoutBounds().getWidth() + 0.5,
                message + ": row width stays inside view");
        assertTrue(menuBounds.getMaxX() <= rowBounds.getMaxX() + 0.5,
                message + ": action menu stays inside selector row");
        assertTrue(actionMenuButton.getWidth() >= 64.0,
                message + ": action menu keeps stable Mehr width");
    }

    private static void assertStableStatusLayout(
            CatalogCrudControlsView view,
            Bounds expectedSelectorRowBounds,
            double expectedViewHeight,
            String message
    ) {
        Bounds actualSelectorRowBounds = selectorRow(view).getBoundsInParent();
        assertNear(expectedViewHeight, view.getLayoutBounds().getHeight(), message + ": view height");
        assertNear(expectedSelectorRowBounds.getMinY(), actualSelectorRowBounds.getMinY(), message + ": row min y");
        assertNear(expectedSelectorRowBounds.getMaxY(), actualSelectorRowBounds.getMaxY(), message + ": row max y");
    }

    private static HBox selectorRow(Parent parent) {
        return descendants(parent).stream()
                .filter(HBox.class::isInstance)
                .map(HBox.class::cast)
                .filter(row -> row.getStyleClass().contains("catalog-crud-selector-row"))
                .findFirst()
                .orElseThrow(() -> new AssertionError("Catalog selector row not found."));
    }

    private static void assertControlRowOrder(
            Parent parent,
            TextField filterField,
            ComboBox<?> selector,
            Button openButton,
            Button createButton,
            MenuButton actionMenuButton
    ) {
        HBox row = descendants(parent).stream()
                .filter(HBox.class::isInstance)
                .map(HBox.class::cast)
                .filter(candidate -> candidate.getChildren().contains(openButton))
                .findFirst()
                .orElseThrow(() -> new AssertionError("Selector row not found."));
        HBox selectorSurface = row.getChildren().getFirst() instanceof HBox surface
                ? surface
                : null;
        if (selectorSurface == null) {
            throw new AssertionError("Selector surface row not found.");
        }
        assertEquals(List.of(openButton, createButton, actionMenuButton),
                List.of(row.getChildren().get(1), row.getChildren().get(2), row.getChildren().get(3)),
                "shared control row keeps open, create, and secondary actions after the selector surface");
        assertEquals(List.of(filterField, selector), List.copyOf(selectorSurface.getChildren()),
                "selector surface keeps filter input and dropdown on one line");
    }

    private static String placeholderText(ComboBox<?> selector) {
        Node placeholder = selector.getPlaceholder();
        if (placeholder instanceof Label label) {
            return label.getText();
        }
        throw new AssertionError("Selector placeholder label not found.");
    }

    private static TextField textField(Parent parent, String accessibleText) {
        return descendants(parent).stream()
                .filter(TextField.class::isInstance)
                .map(TextField.class::cast)
                .filter(field -> accessibleText.equals(field.getAccessibleText()))
                .findFirst()
                .orElseThrow(() -> new AssertionError("TextField not found: " + accessibleText));
    }

    private static MenuItem menuItem(Parent parent, String text) {
        return actionMenuButton(parent).getItems().stream()
                .filter(item -> text.equals(item.getText()))
                .findFirst()
                .orElseThrow(() -> new AssertionError("Menu item not found: " + text));
    }

    private static <T extends Node> T descendant(Parent parent, Class<T> type) {
        return descendants(parent).stream()
                .filter(type::isInstance)
                .map(type::cast)
                .findFirst()
                .orElseThrow(() -> new AssertionError("Descendant not found: " + type.getSimpleName()));
    }

    private static <T extends Node> T slot(ShellBinding binding, ShellSlot slot, Class<T> type) {
        Node node = binding.slotContent().get(slot);
        if (type.isInstance(node)) {
            return type.cast(node);
        }
        throw new AssertionError("Shell slot not found: " + slot);
    }

    private static Parent operationPopupContent(CatalogCrudControlsView view) {
        Object content = view.getProperties().get(CatalogCrudControlsView.OPERATION_CONTENT_PROPERTY);
        if (content instanceof Parent parent) {
            return parent;
        }
        throw new AssertionError("Catalog operation popup content metadata not found.");
    }

    private static void hideOperationPopupExternally(CatalogCrudControlsView view) {
        Object popup = view.getProperties().get(CatalogCrudControlsView.OPERATION_POPUP_PROPERTY);
        if (!(popup instanceof ContextMenu contextMenu) || contextMenu.getOnHidden() == null) {
            throw new AssertionError("Catalog operation popup metadata not found.");
        }
        contextMenu.getOnHidden().handle(new WindowEvent(contextMenu, WindowEvent.WINDOW_HIDDEN));
    }

    private static void assertNoVisibleLabel(Parent parent, String text, String message) {
        assertVisibleLabelCount(parent, text, 0L, message);
    }

    private static void assertVisibleLabelCount(Parent parent, String text, long expectedCount, String message) {
        assertEquals(expectedCount, descendants(parent).stream()
                        .filter(Label.class::isInstance)
                        .map(Label.class::cast)
                        .filter(label -> text.equals(label.getText()))
                        .filter(Node::isVisible)
                        .count(),
                message);
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

    private static void layoutOpenWindows() {
        for (Window window : Window.getWindows()) {
            if (window.getScene() != null && window.getScene().getRoot() != null) {
                window.getScene().getRoot().applyCss();
                window.getScene().getRoot().layout();
            }
        }
    }

    private static void assertEquals(Object expected, Object actual, String message) {
        if (!expected.equals(actual)) {
            throw new AssertionError(message + ": expected=" + expected + ", actual=" + actual);
        }
    }

    private static void assertNear(double expected, double actual, String message) {
        if (Math.abs(expected - actual) > 0.5) {
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
                Platform.setImplicitExit(false);
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
            hideOpenWindows();
            Platform.exit();
        });
    }

    private static void hideOpenWindows() {
        Platform.setImplicitExit(false);
        for (Window window : List.copyOf(Window.getWindows())) {
            window.hide();
        }
    }

    @FunctionalInterface
    private interface ThrowingRunnable {
        void run() throws Exception;
    }

    private enum EmptyInspectorSink implements InspectorSink {
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
