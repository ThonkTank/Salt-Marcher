package src.view.leftbartabs.dungeoneditor;

import java.util.List;
import java.util.Objects;
import javafx.beans.value.ChangeListener;
import javafx.geometry.Pos;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.ComboBox;
import javafx.scene.control.Label;
import javafx.scene.control.MenuItem;
import javafx.scene.control.SplitMenuButton;
import javafx.scene.control.TextField;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;
import javafx.util.StringConverter;
import src.view.slotcontent.primitives.dialog.DialogSurfaceContentModel;
import src.view.slotcontent.primitives.dialog.DialogSurfaceView;
import src.view.slotcontent.primitives.popup.AnchoredPopupContentModel;
import src.view.slotcontent.primitives.popup.AnchoredPopupView;

final class DungeonEditorMapControlsView {

    private final ComboBox<DungeonEditorMapControlsContentModel.MapItem> mapSelector = new ComboBox<>();
    private final SplitMenuButton mapActionButton = new SplitMenuButton();
    private final MenuItem editMapItem = new MenuItem("Dungeon bearbeiten");
    private final MenuItem deleteMapItem = new MenuItem("Dungeon löschen");
    private final Label statusLabel = new Label();
    private final ChangeListener<DungeonEditorMapControlsContentModel.MapItem> selectionListener =
            (ignored, before, after) -> handleSelectionChanged(after);
    private final DungeonEditorMapEditorPopup mapEditorPopup;
    private final HBox row;
    private final DungeonEditorControlsEvents events;

    DungeonEditorMapControlsView(DungeonEditorControlsView panelView, DungeonEditorControlsEvents events) {
        this.events = events;
        mapSelector.setConverter(new StringConverter<>() {
            @Override
            public String toString(DungeonEditorMapControlsContentModel.MapItem item) {
                return item == null ? "" : item.mapName();
            }

            @Override
            public DungeonEditorMapControlsContentModel.MapItem fromString(String string) {
                return null;
            }
        });
        mapSelector.setMaxWidth(Double.MAX_VALUE);
        mapSelector.setMinWidth(0.0);
        mapSelector.setPromptText("Dungeon auswählen");
        mapSelector.setAccessibleText("Dungeon auswählen");
        DungeonEditorControlsListeners.onSelectedItemChanged(mapSelector, selectionListener);

        mapActionButton.setText("Neu");
        DungeonEditorControlsFxAccess.setItems(mapActionButton, editMapItem, deleteMapItem);
        DungeonEditorControlsFxAccess.addStyles(mapActionButton, "toolbar-action-button", "dungeon-toolbar-menu");
        mapActionButton.setMinWidth(Region.USE_PREF_SIZE);

        mapEditorPopup = new DungeonEditorMapEditorPopup(panelView, events, mapActionButton);
        mapActionButton.setOnAction(event -> mapEditorPopup.openCreate());
        editMapItem.setOnAction(event -> mapEditorPopup.openRename());
        deleteMapItem.setOnAction(event -> mapEditorPopup.openDelete());
        panelView.describeNode(mapActionButton, "Neuen Dungeon erstellen; weitere Dungeon-Aktionen im Menü");

        DungeonEditorControlsFxAccess.addStyles(statusLabel, "text-muted", "dungeon-map-status-label");
        statusLabel.setWrapText(false);
        statusLabel.setVisible(false);
        statusLabel.setManaged(false);
        statusLabel.setMinWidth(0.0);

        HBox.setHgrow(mapSelector, Priority.ALWAYS);
        row = panelView.controlsRow(mapSelector, mapActionButton, statusLabel);
        DungeonEditorControlsFxAccess.addStyle(row, "dungeon-control-map-row");
    }

    HBox row() {
        return row;
    }

    void bind(DungeonEditorMapControlsContentModel contentModel) {
        contentModel.mapProjectionProperty().addListener((ignored, before, after) -> showMaps(after));
        contentModel.mapEditorProperty().addListener((ignored, before, after) -> showMapEditor(after));
        showMaps(contentModel.mapProjectionProperty().get());
        showMapEditor(contentModel.mapEditorProperty().get());
    }

    private void showMaps(DungeonEditorMapControlsContentModel.MapProjection projection) {
        DungeonEditorMapControlsContentModel.MapProjection safeProjection = projection == null
                ? DungeonEditorMapControlsContentModel.MapProjection.empty()
                : projection;
        List<DungeonEditorMapControlsContentModel.MapItem> safeMaps = safeProjection.maps();
        DungeonEditorControlsListeners.withDetachedSelectionUpdate(mapSelector, selectionListener, () -> {
            DungeonEditorControlsFxAccess.setItems(mapSelector, safeMaps);
            DungeonEditorControlsFxAccess.select(mapSelector, resolveSelected(safeMaps, safeProjection.selectedKey()));
        });
        mapSelector.setDisable(safeProjection.busy() || safeMaps.isEmpty());
        mapActionButton.setDisable(safeProjection.busy());
        boolean selectionMissing = DungeonEditorControlsFxAccess.selectedItem(mapSelector) == null;
        editMapItem.setDisable(safeProjection.busy() || selectionMissing);
        deleteMapItem.setDisable(safeProjection.busy() || selectionMissing);
        String resolvedStatus = safeProjection.statusText();
        statusLabel.setText(resolvedStatus);
        statusLabel.setVisible(!resolvedStatus.isBlank());
        statusLabel.setManaged(!resolvedStatus.isBlank());
    }

    private void showMapEditor(DungeonEditorMapControlsContentModel.MapEditorUiState mapEditorUiState) {
        mapEditorPopup.show(mapEditorUiState);
    }

    private void handleSelectionChanged(DungeonEditorMapControlsContentModel.MapItem selectedMap) {
        boolean hasSelection = selectedMap != null;
        editMapItem.setDisable(!hasSelection);
        deleteMapItem.setDisable(!hasSelection);
        if (hasSelection) {
            events.mapSelection(selectedMap.mapId());
        }
    }

    private DungeonEditorMapControlsContentModel.MapItem resolveSelected(
            List<DungeonEditorMapControlsContentModel.MapItem> maps,
            String selectedKey
    ) {
        DungeonEditorMapControlsContentModel.MapItem selectedMap = maps.stream()
                .filter(item -> Objects.equals(item.key(), selectedKey))
                .findFirst()
                .orElse(null);
        return selectedMap;
    }
}

final class DungeonEditorMapEditorPopup {

    private final AnchoredPopupContentModel popupContentModel = new AnchoredPopupContentModel();
    private final Label titleLabel = new Label();
    private final Label draftFieldLabel = new Label("Name");
    private final TextField draftField = new TextField();
    private final Label errorLabel = new Label();
    private final Button cancelButton = new Button("Abbrechen");
    private final Button saveButton = new Button("Speichern");
    private final Button cancelDeleteButton = new Button("Abbrechen");
    private final Button confirmDeleteButton = new Button("Löschen");
    private final Label deleteLabel = new Label("Dungeon löschen?");
    private final ChangeListener<String> draftListener = (ignored, before, after) -> handleDraftChanged();
    private final DungeonEditorControlsGate hiddenGate = new DungeonEditorControlsGate();
    private final HBox deleteConfirmRow;
    private final HBox actionRow;
    private final Node anchor;
    private final DungeonEditorControlsEvents events;
    private final AnchoredPopupView popup;

    DungeonEditorMapEditorPopup(DungeonEditorControlsView panelView, DungeonEditorControlsEvents events, Node anchor) {
        this.events = events;
        this.anchor = anchor;
        DungeonEditorControlsFxAccess.addStyle(titleLabel, "panel-title");
        draftFieldLabel.setLabelFor(draftField);
        draftField.setAccessibleText("Dungeon-Name");
        DungeonEditorControlsFxAccess.addStyle(errorLabel, "text-warning");
        errorLabel.setLabelFor(draftField);
        errorLabel.setWrapText(true);
        errorLabel.setManaged(false);
        errorLabel.setVisible(false);

        DungeonEditorControlsFxAccess.addStyle(deleteLabel, "text-warning");
        deleteConfirmRow = new HBox(deleteLabel, panelView.rowSpacer(), cancelDeleteButton, confirmDeleteButton);
        DungeonEditorControlsFxAccess.addStyle(deleteConfirmRow, "dungeon-editor-popup-actions");
        deleteConfirmRow.setVisible(false);
        deleteConfirmRow.setManaged(false);

        actionRow = new HBox(cancelButton, panelView.rowSpacer(), saveButton);
        DungeonEditorControlsFxAccess.addStyle(actionRow, "dungeon-editor-popup-actions");
        actionRow.setAlignment(Pos.CENTER_LEFT);

        VBox body = new VBox(draftFieldLabel, draftField, errorLabel, deleteConfirmRow);
        DungeonEditorControlsFxAccess.addStyle(body, "dungeon-editor-popup-body");
        DialogSurfaceContentModel dialogContentModel = new DialogSurfaceContentModel();
        DialogSurfaceView panel = new DialogSurfaceView(titleLabel, body, actionRow);
        panel.bind(dialogContentModel);
        dialogContentModel.showLayout(DialogSurfaceContentModel.BodyPolicy.FIXED, true, true);
        DungeonEditorControlsFxAccess.addStyles(panel, "dropdown-window", "dropdown-form", "dungeon-editor-popup");
        popup = new AnchoredPopupView(panel, () -> this.anchor, () -> draftField);
        popup.bind(popupContentModel);
        popup.onViewInputEvent(event -> {
            if (event.interaction().isHidden()) {
                handleHidden();
            }
        });

        cancelButton.setOnAction(event -> dismiss());
        cancelDeleteButton.setOnAction(event -> dismiss());
        confirmDeleteButton.setOnAction(event -> confirmDelete());
        saveButton.setOnAction(event -> submit());
        draftField.setOnAction(event -> submit());
        draftField.textProperty().addListener(draftListener);
    }

    void openCreate() {
        events.openCreateMapEditor(currentDraftText());
    }

    void openRename() {
        events.openRenameMapEditor(currentDraftText());
    }

    void openDelete() {
        events.openDeleteMapEditor(currentDraftText());
    }

    private void dismiss() {
        events.dismissMapEditor(currentDraftText());
    }

    private void submit() {
        events.submitMapEditor(currentDraftText());
    }

    private void confirmDelete() {
        events.confirmMapDelete(currentDraftText());
    }

    void show(DungeonEditorMapControlsContentModel.MapEditorUiState mapEditorUiState) {
        DungeonEditorMapControlsContentModel.MapEditorUiState resolvedState = mapEditorUiState == null
                ? DungeonEditorMapControlsContentModel.MapEditorUiState.hidden()
                : mapEditorUiState;
        boolean popupWasShowing = popupContentModel.isOpen();
        titleLabel.setText(resolvedState.title());
        DungeonEditorControlsListeners.withDetachedTextUpdate(draftField, draftListener, () ->
                draftField.setText(resolvedState.draftName()));
        draftField.setVisible(resolvedState.draftFieldVisible());
        draftField.setManaged(resolvedState.draftFieldVisible());
        actionRow.setVisible(resolvedState.actionRowVisible());
        actionRow.setManaged(resolvedState.actionRowVisible());
        saveButton.setVisible(resolvedState.submitVisible());
        saveButton.setManaged(resolvedState.submitVisible());
        saveButton.setText(resolvedState.submitLabel());
        errorLabel.setText(resolvedState.errorText());
        errorLabel.setVisible(!resolvedState.errorText().isBlank());
        errorLabel.setManaged(!resolvedState.errorText().isBlank());
        draftField.setAccessibleHelp(resolvedState.errorText().isBlank()
                ? "Dungeon-Name"
                : "Dungeon-Name. " + resolvedState.errorText());
        deleteConfirmRow.setVisible(resolvedState.deleteConfirmationVisible());
        deleteConfirmRow.setManaged(resolvedState.deleteConfirmationVisible());
        exposeDeleteConfirmationContext(resolvedState);
        if (!resolvedState.visible()) {
            hidePopup();
            return;
        }
        if (!popupWasShowing) {
            popupContentModel.showBelow(2.0, resolvedState.draftFieldVisible());
        }
        if (resolvedState.draftFieldVisible()) {
            if (popupWasShowing) {
                draftField.requestFocus();
            }
            if (!popupWasShowing) {
                draftField.selectAll();
            }
            return;
        }
        if (resolvedState.deleteConfirmationVisible()) {
            cancelDeleteButton.requestFocus();
        }
    }

    private void handleDraftChanged() {
        events.mapEditorDraftChanged(currentDraftText());
    }

    private void handleHidden() {
        if (!hiddenGate.enabled()) {
            dismiss();
        }
    }

    private void hidePopup() {
        if (popupContentModel.isOpen()) {
            hiddenGate.runSuppressed(popupContentModel::hide);
        }
    }

    private String currentDraftText() {
        String draftText = draftField.getText();
        return draftText == null ? "" : draftText;
    }

    private void exposeDeleteConfirmationContext(DungeonEditorMapControlsContentModel.MapEditorUiState state) {
        if (!state.deleteConfirmationVisible()) {
            deleteConfirmRow.setAccessibleText("");
            deleteConfirmRow.setAccessibleHelp("");
            return;
        }
        String context = state.title().isBlank() ? "Dungeon löschen?" : state.title();
        deleteConfirmRow.setAccessibleText(context + ". " + deleteLabel.getText());
        deleteConfirmRow.setAccessibleHelp("Abbrechen oder Löschen auswählen.");
    }
}
