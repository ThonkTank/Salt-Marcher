package src.view.slotcontent.controls.catalogcrud;

import java.util.function.Consumer;
import javafx.collections.ListChangeListener;
import javafx.collections.ObservableList;
import javafx.geometry.Bounds;
import javafx.geometry.Pos;
import javafx.scene.control.Button;
import javafx.scene.control.ComboBox;
import javafx.scene.control.ContextMenu;
import javafx.scene.control.CustomMenuItem;
import javafx.scene.control.Label;
import javafx.scene.control.ListCell;
import javafx.scene.control.MenuItem;
import javafx.scene.control.SplitMenuButton;
import javafx.scene.control.TextField;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.VBox;
import javafx.util.StringConverter;

public final class CatalogCrudControlsView extends VBox {

    public static final String OPERATION_CONTENT_PROPERTY = "catalogCrudOperationContent";
    static final String OPERATION_POPUP_PROPERTY = "catalogCrudOperationPopup";

    private static final String STYLE_COMPACT = "compact";
    private static final String STYLE_FLAT = "flat";
    private static final String STYLE_ACCENT = "accent";
    private static final String STYLE_TEXT_SECONDARY = "text-secondary";
    private static final String PROGRAMMATIC_SELECTION_KEY = "catalogCrudProgrammaticSelection";
    private static final String SELECTION_PUBLISH_KEY = "catalogCrudSelectionPublish";
    private static final String PROGRAMMATIC_FILTER_KEY = "catalogCrudProgrammaticFilter";
    private static final String FILTER_REFRESH_KEY = "catalogCrudFilterRefresh";

    private final Label titleLabel = label("");
    private final TextField filterField = new TextField();
    private final ComboBox<String> selector = new ComboBox<>();
    private final Button openButton = button("Öffnen", STYLE_COMPACT, STYLE_ACCENT);
    private final SplitMenuButton actionButton = new SplitMenuButton();
    private final MenuItem renameMenuItem = new MenuItem("Umbenennen");
    private final MenuItem deleteMenuItem = new MenuItem("Löschen");
    private final MenuItem reloadMenuItem = new MenuItem("Neu laden");
    private final Label selectorPlaceholderLabel = label("", STYLE_TEXT_SECONDARY);
    private final Label statusLabel = label("", STYLE_TEXT_SECONDARY);
    private final VBox operationBox = new VBox(6);
    private final ContextMenu operationPopup = new ContextMenu();
    private final TextField draftField = new TextField();
    private final Button submitButton = button("Speichern", STYLE_COMPACT, STYLE_ACCENT);
    private final Button confirmDeleteButton = button("Löschen", STYLE_COMPACT, STYLE_ACCENT);
    private final Button cancelButton = button("Abbrechen", STYLE_COMPACT, STYLE_FLAT);
    private final Label validationLabel = label("", STYLE_TEXT_SECONDARY);
    private final Label deleteQuestionLabel = label("", STYLE_TEXT_SECONDARY);
    private final HBox draftActions = new HBox(6, submitButton, cancelButton);
    private final HBox deleteActions = new HBox(6, confirmDeleteButton, cancelButton);

    private Consumer<CatalogCrudControlsViewInputEvent> viewInputEventHandler = ignored -> { };
    public CatalogCrudControlsView() {
        super(8);
        filterField.setPromptText("Auswahl filtern");
        filterField.setAccessibleText("Auswahl filtern");
        selector.setMaxWidth(Double.MAX_VALUE);
        selector.setPlaceholder(selectorPlaceholderLabel);
        openButton.setMinWidth(USE_PREF_SIZE);
        actionButton.setText("Neu");
        actionButton.getStyleClass().addAll(STYLE_COMPACT, STYLE_ACCENT);
        actionButton.getItems().setAll(renameMenuItem, deleteMenuItem, reloadMenuItem);
        draftField.setAccessibleText("Dungeon-Name");
        confirmDeleteButton.setAccessibleText("Löschen bestätigen");
        operationBox.getStyleClass().addAll("dropdown-window", "catalog-crud-popup");
        operationBox.getChildren().setAll(draftField, draftActions, deleteQuestionLabel, deleteActions, validationLabel);
        operationPopup.getItems().setAll(new CustomMenuItem(operationBox, false));
        operationPopup.setAutoHide(true);
        operationPopup.setOnHidden(event -> {
            if (operationBox.isVisible()) {
                publish(dismissedEvent());
            }
        });
        getProperties().put(OPERATION_CONTENT_PROPERTY, operationBox);
        getProperties().put(OPERATION_POPUP_PROPERTY, operationPopup);
        getChildren().setAll(
                headerRow(),
                selectorRow(),
                statusLabel);
    }

    public void onViewInputEvent(Consumer<CatalogCrudControlsViewInputEvent> handler) {
        viewInputEventHandler = handler == null ? ignored -> { } : handler;
    }

    public void bind(CatalogCrudControlsContentModel contentModel) {
        if (contentModel == null) {
            return;
        }
        ObservableList<String> itemIds = contentModel.itemIds();
        selector.setItems(itemIds);
        selector.setConverter(new StringConverter<>() {
            @Override
            public String toString(String itemId) {
                return contentModel.labelOf(itemId);
            }

            @Override
            public String fromString(String text) {
                return text == null ? "" : text;
            }
        });
        selector.setButtonCell(new ListCell<>() {
            @Override
            protected void updateItem(String itemId, boolean empty) {
                super.updateItem(itemId, empty);
                setText(empty ? "" : contentModel.labelOf(itemId));
            }
        });
        selector.setCellFactory(ignored -> new ListCell<>() {
            @Override
            protected void updateItem(String itemId, boolean empty) {
                super.updateItem(itemId, empty);
                setText(empty ? "" : contentModel.labelOf(itemId));
            }
        });
        titleLabel.textProperty().bind(contentModel.titleProperty());
        selector.promptTextProperty().bind(contentModel.selectorPromptTextProperty());
        selector.accessibleTextProperty().bind(contentModel.selectorAccessibleTextProperty());
        selector.disableProperty().bind(contentModel.selectorDisabledProperty());
        selectorPlaceholderLabel.textProperty().bind(contentModel.selectorPlaceholderTextProperty());
        filterField.disableProperty().bind(contentModel.selectorFilterEnabledProperty().not());
        openButton.visibleProperty().bind(contentModel.openVisibleProperty());
        openButton.managedProperty().bind(openButton.visibleProperty());
        openButton.disableProperty().bind(contentModel.openDisabledProperty());
        statusLabel.textProperty().bind(contentModel.statusTextProperty());
        statusLabel.visibleProperty().bind(contentModel.statusVisibleProperty());
        statusLabel.managedProperty().bind(statusLabel.visibleProperty());
        actionButton.disableProperty().bind(contentModel.createDisabledProperty()
                .and(contentModel.renameDisabledProperty())
                .and(contentModel.deleteDisabledProperty())
                .and(contentModel.reloadDisabledProperty()));
        actionButton.visibleProperty().bind(contentModel.createVisibleProperty()
                .or(contentModel.renameVisibleProperty())
                .or(contentModel.deleteVisibleProperty())
                .or(contentModel.reloadVisibleProperty()));
        actionButton.managedProperty().bind(actionButton.visibleProperty());
        renameMenuItem.disableProperty().bind(contentModel.renameDisabledProperty());
        deleteMenuItem.disableProperty().bind(contentModel.deleteDisabledProperty());
        reloadMenuItem.disableProperty().bind(contentModel.reloadDisabledProperty());
        renameMenuItem.visibleProperty().bind(contentModel.renameVisibleProperty());
        deleteMenuItem.visibleProperty().bind(contentModel.deleteVisibleProperty());
        reloadMenuItem.visibleProperty().bind(contentModel.reloadVisibleProperty());
        operationBox.visibleProperty().bind(contentModel.operationVisibleProperty());
        installDraftBinding(contentModel);
        installFilterBinding(contentModel);
        draftField.promptTextProperty().bind(contentModel.draftPromptProperty());
        draftField.visibleProperty().bind(contentModel.draftVisibleProperty());
        draftField.managedProperty().bind(draftField.visibleProperty());
        draftActions.visibleProperty().bind(contentModel.draftVisibleProperty());
        draftActions.managedProperty().bind(draftActions.visibleProperty());
        submitButton.textProperty().bind(contentModel.submitTextProperty());
        submitButton.disableProperty().bind(draftField.textProperty().isEmpty());
        deleteQuestionLabel.textProperty().bind(contentModel.deleteQuestionProperty());
        deleteQuestionLabel.visibleProperty().bind(contentModel.deleteConfirmationVisibleProperty());
        deleteQuestionLabel.managedProperty().bind(deleteQuestionLabel.visibleProperty());
        deleteActions.visibleProperty().bind(contentModel.deleteConfirmationVisibleProperty());
        deleteActions.managedProperty().bind(deleteActions.visibleProperty());
        validationLabel.textProperty().bind(contentModel.validationTextProperty());
        validationLabel.visibleProperty().bind(contentModel.validationVisibleProperty());
        validationLabel.managedProperty().bind(validationLabel.visibleProperty());
        contentModel.selectedIndexProperty().addListener((ignored, before, after) ->
                selectPreparedIndex(contentModel, after.intValue()));
        itemIds.addListener((ListChangeListener<String>) ignored ->
                selectPreparedIndex(contentModel, contentModel.selectedIndexProperty().get()));
        contentModel.operationVisibleProperty().addListener((ignored, before, after) ->
                updateOperationPopup(after));
        selectPreparedIndex(contentModel, contentModel.selectedIndexProperty().get());
        updateOperationPopup(contentModel.operationVisibleProperty().get());
        installHandlers(contentModel);
    }

    private void selectPreparedIndex(CatalogCrudControlsContentModel contentModel, int selectedIndex) {
        selector.getProperties().put(PROGRAMMATIC_SELECTION_KEY, Boolean.TRUE);
        try {
            String selectedItemId = contentModel.currentSelectableItemId();
            if (selectedItemId.isBlank() || selectedIndex < 0 || selectedIndex >= selector.getItems().size()) {
                selector.setValue(null);
                selector.getSelectionModel().clearSelection();
                return;
            }
            selector.setValue(selectedItemId);
            selector.getSelectionModel().select(selectedItemId);
        } finally {
            selector.getProperties().remove(PROGRAMMATIC_SELECTION_KEY);
        }
    }

    private void installDraftBinding(CatalogCrudControlsContentModel contentModel) {
        setDraftText(contentModel.draftNameProperty().get());
        contentModel.draftNameProperty().addListener((ignored, before, after) -> setDraftText(after));
    }

    private void installFilterBinding(CatalogCrudControlsContentModel contentModel) {
        setFilterText(contentModel.selectorFilterTextProperty().get());
        contentModel.selectorFilterTextProperty().addListener((ignored, before, after) -> setFilterText(after));
    }

    private void setDraftText(String text) {
        String safeText = text == null ? "" : text;
        if (safeText.equals(draftField.getText())) {
            return;
        }
        draftField.setText(safeText);
    }

    private void setFilterText(String text) {
        String safeText = text == null ? "" : text;
        if (safeText.equals(filterField.getText())) {
            return;
        }
        filterField.getProperties().put(PROGRAMMATIC_FILTER_KEY, Boolean.TRUE);
        try {
            filterField.setText(safeText);
        } finally {
            filterField.getProperties().remove(PROGRAMMATIC_FILTER_KEY);
        }
    }

    private void installHandlers(CatalogCrudControlsContentModel contentModel) {
        installEditorHandlers(contentModel);
        installActionHandlers(contentModel);
        installSelectorHandler(contentModel);
    }

    private void installEditorHandlers(CatalogCrudControlsContentModel contentModel) {
        actionButton.setOnAction(event -> {
            if (!contentModel.createDisabledProperty().get()) {
                publish(createEditorOpenedEvent());
            }
        });
        renameMenuItem.setOnAction(event -> {
            if (renameMenuItem.isDisable()) {
                return;
            }
            String targetItemId = selectedOrCurrentItemId(contentModel);
            publish(renameEditorOpenedEvent(targetItemId));
        });
        deleteMenuItem.setOnAction(event -> {
            if (deleteMenuItem.isDisable()) {
                return;
            }
            String targetItemId = selectedOrCurrentItemId(contentModel);
            publish(deleteRequestedEvent(targetItemId));
        });
    }

    private void installActionHandlers(CatalogCrudControlsContentModel contentModel) {
        openButton.setOnAction(event -> publish(openRequestedEvent(selectedOrCurrentItemId(contentModel))));
        reloadMenuItem.setOnAction(event -> {
            if (!reloadMenuItem.isDisable()) {
                publish(reloadRequestedEvent(selectedOrCurrentItemId(contentModel)));
            }
        });
        submitButton.setOnAction(event -> publishSubmit(contentModel));
        confirmDeleteButton.setOnAction(event -> {
            String itemId = contentModel.targetItemIdProperty().get();
            publish(deleteConfirmedEvent(itemId));
        });
        cancelButton.setOnAction(event -> publish(dismissedEvent()));
    }

    private void installSelectorHandler(CatalogCrudControlsContentModel contentModel) {
        selector.valueProperty().addListener((ignored, before, after) -> {
            if (Boolean.TRUE.equals(selector.getProperties().get(SELECTION_PUBLISH_KEY))
                    || Boolean.TRUE.equals(filterField.getProperties().get(FILTER_REFRESH_KEY))
                    || Boolean.TRUE.equals(selector.getProperties().get(PROGRAMMATIC_SELECTION_KEY))) {
                return;
            }
            if (after == null || after.isBlank()) {
                return;
            }
            selector.getProperties().put(SELECTION_PUBLISH_KEY, Boolean.TRUE);
            try {
                String filterText = filterField.getText();
                if (filterText != null && !filterText.isBlank()) {
                    filterField.getProperties().put(PROGRAMMATIC_FILTER_KEY, Boolean.TRUE);
                    try {
                        filterField.clear();
                    } finally {
                        filterField.getProperties().remove(PROGRAMMATIC_FILTER_KEY);
                    }
                }
                publish(selectionEvent(after));
            } finally {
                selector.getProperties().remove(SELECTION_PUBLISH_KEY);
            }
        });
        filterField.textProperty().addListener((ignored, before, after) -> {
            if (Boolean.TRUE.equals(filterField.getProperties().get(PROGRAMMATIC_FILTER_KEY))) {
                return;
            }
            filterField.getProperties().put(FILTER_REFRESH_KEY, Boolean.TRUE);
            try {
                publish(filterChangedEvent());
            } finally {
                filterField.getProperties().remove(FILTER_REFRESH_KEY);
            }
            if (!selector.isShowing() && filterField.isFocused() && !contentModel.itemIds().isEmpty()) {
                selector.show();
            }
        });
    }

    private void publishSubmit(CatalogCrudControlsContentModel contentModel) {
        String draft = draftField.getText();
        if (contentModel.createMode()) {
            publish(createSubmittedEvent(draft));
            return;
        }
        if (contentModel.renameMode()) {
            String itemId = contentModel.targetItemIdProperty().get();
            if (itemId.isBlank()) {
                itemId = selectorValue();
            }
            publish(renameSubmittedEvent(itemId, draft));
        }
    }

    private String selectedOrCurrentItemId(CatalogCrudControlsContentModel contentModel) {
        String itemId = selectorValue();
        return itemId.isBlank() ? contentModel.currentSelectableItemId() : itemId;
    }

    private String selectorValue() {
        String value = selector.getValue();
        return value == null ? "" : value;
    }

    private void updateOperationPopup(boolean operationVisible) {
        if (!operationVisible) {
            operationPopup.hide();
            return;
        }
        if (!operationPopup.isShowing() && actionButton.getScene() != null && actionButton.isShowing()) {
            Bounds buttonBounds = actionButton.localToScreen(actionButton.getBoundsInLocal());
            if (buttonBounds != null) {
                operationPopup.show(actionButton, buttonBounds.getMinX(), buttonBounds.getMaxY());
            }
        }
    }

    private CatalogCrudControlsViewInputEvent selectionEvent(String selectedItemId) {
        return new CatalogCrudControlsViewInputEvent(
                selectedItemId, filterField.getText(), "", false, "", "", "", "", "", "", false, "");
    }

    private CatalogCrudControlsViewInputEvent openRequestedEvent(String itemId) {
        return new CatalogCrudControlsViewInputEvent(
                "", filterField.getText(), itemId, false, "", "", "", "", "", "", false, "");
    }

    private CatalogCrudControlsViewInputEvent createEditorOpenedEvent() {
        return new CatalogCrudControlsViewInputEvent(
                "", filterField.getText(), "", true, "", "", "", "", "", "", false, "");
    }

    private CatalogCrudControlsViewInputEvent renameEditorOpenedEvent(String itemId) {
        return new CatalogCrudControlsViewInputEvent(
                "", filterField.getText(), "", false, "", itemId, "", "", "", "", false, "");
    }

    private CatalogCrudControlsViewInputEvent deleteRequestedEvent(String itemId) {
        return new CatalogCrudControlsViewInputEvent(
                "", filterField.getText(), "", false, "", "", "", "", itemId, "", false, "");
    }

    private CatalogCrudControlsViewInputEvent reloadRequestedEvent(String itemId) {
        return new CatalogCrudControlsViewInputEvent(
                "", filterField.getText(), "", false, "", "", "", "", "", "", false, itemId);
    }

    private CatalogCrudControlsViewInputEvent deleteConfirmedEvent(String itemId) {
        return new CatalogCrudControlsViewInputEvent(
                "", filterField.getText(), "", false, "", "", "", "", "", itemId, false, "");
    }

    private CatalogCrudControlsViewInputEvent dismissedEvent() {
        return new CatalogCrudControlsViewInputEvent(
                "", filterField.getText(), "", false, "", "", "", "", "", "", true, "");
    }

    private CatalogCrudControlsViewInputEvent createSubmittedEvent(String draftName) {
        return new CatalogCrudControlsViewInputEvent(
                "", filterField.getText(), "", false, draftName, "", "", "", "", "", false, "");
    }

    private CatalogCrudControlsViewInputEvent renameSubmittedEvent(String itemId, String draftName) {
        return new CatalogCrudControlsViewInputEvent(
                "", filterField.getText(), "", false, "", "", itemId, draftName, "", "", false, "");
    }

    private CatalogCrudControlsViewInputEvent filterChangedEvent() {
        return new CatalogCrudControlsViewInputEvent(
                "", filterField.getText(), "", false, "", "", "", "", "", "", false, "");
    }

    private HBox headerRow() {
        HBox row = new HBox(6, titleLabel);
        row.setAlignment(Pos.CENTER_LEFT);
        return row;
    }

    private HBox selectorRow() {
        HBox selectorSurface = new HBox(4, filterField, selector);
        selectorSurface.getStyleClass().add("catalog-crud-selector-surface");
        filterField.getStyleClass().add("catalog-crud-selector-filter");
        selector.getStyleClass().add("catalog-crud-selector-combo");
        selectorSurface.setMaxWidth(Double.MAX_VALUE);
        HBox.setHgrow(selector, Priority.ALWAYS);
        HBox.setHgrow(selectorSurface, Priority.ALWAYS);
        HBox row = new HBox(6, selectorSurface, openButton, actionButton);
        row.setAlignment(Pos.CENTER_LEFT);
        return row;
    }

    private void publish(CatalogCrudControlsViewInputEvent event) {
        viewInputEventHandler.accept(event);
    }

    private static Button button(String text, String... styleClasses) {
        Button button = new Button(text);
        button.getStyleClass().addAll(styleClasses);
        return button;
    }

    private static Label label(String text, String... styleClasses) {
        Label label = new Label(text);
        label.setWrapText(true);
        label.getStyleClass().addAll(styleClasses);
        return label;
    }

}
