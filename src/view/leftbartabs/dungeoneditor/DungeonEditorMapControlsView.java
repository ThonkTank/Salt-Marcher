package src.view.leftbartabs.dungeoneditor;

import java.util.List;
import java.util.Objects;
import javafx.beans.value.ChangeListener;
import javafx.geometry.Insets;
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

    private final ComboBox<DungeonEditorControlsView.MapItem> mapSelector = new ComboBox<>();
    private final SplitMenuButton mapActionButton = new SplitMenuButton();
    private final MenuItem editMapItem = new MenuItem("Dungeon bearbeiten");
    private final MenuItem deleteMapItem = new MenuItem("Dungeon löschen");
    private final Label statusLabel = new Label();
    private final ChangeListener<DungeonEditorControlsView.MapItem> selectionListener =
            (ignored, before, after) -> handleSelectionChanged(after);
    private final DungeonEditorMapEditorPopupView mapEditorPopup;
    private final HBox row;
    private final DungeonEditorControlsEvents events;

    DungeonEditorMapControlsView(DungeonEditorControlsView panelView, DungeonEditorControlsEvents events) {
        this.events = events;
        mapSelector.setConverter(new StringConverter<>() {
            @Override
            public String toString(DungeonEditorControlsView.MapItem item) {
                return item == null ? "" : item.mapName();
            }

            @Override
            public DungeonEditorControlsView.MapItem fromString(String string) {
                return null;
            }
        });
        mapSelector.setMaxWidth(Double.MAX_VALUE);
        mapSelector.setMinWidth(0.0);
        DungeonEditorControlsListeners.onSelectedItemChanged(mapSelector, selectionListener);

        mapActionButton.setText("Neu");
        DungeonEditorControlsFxAccess.setItems(mapActionButton, editMapItem, deleteMapItem);
        DungeonEditorControlsFxAccess.addStyles(mapActionButton, "toolbar-action-button", "dungeon-toolbar-menu");
        mapActionButton.setMinWidth(Region.USE_PREF_SIZE);

        mapEditorPopup = new DungeonEditorMapEditorPopupView(panelView, events, mapActionButton);
        mapActionButton.setOnAction(event -> mapEditorPopup.publishInput(true, false, false, false, false, false));
        editMapItem.setOnAction(event -> mapEditorPopup.publishInput(false, true, false, false, false, false));
        deleteMapItem.setOnAction(event -> mapEditorPopup.publishInput(false, false, true, false, false, false));
        panelView.describeNode(mapActionButton, "Neuen Dungeon erstellen; weitere Dungeon-Aktionen im Menü");

        DungeonEditorControlsFxAccess.addStyle(statusLabel, "text-muted");
        statusLabel.setWrapText(false);
        statusLabel.setVisible(false);
        statusLabel.setManaged(false);
        statusLabel.setMinWidth(0.0);
        statusLabel.setMaxWidth(160.0);

        HBox.setHgrow(mapSelector, Priority.ALWAYS);
        row = panelView.controlsRow(mapSelector, mapActionButton, statusLabel);
        DungeonEditorControlsFxAccess.addStyle(row, "dungeon-control-map-row");
    }

    HBox row() {
        return row;
    }

    void showMaps(List<DungeonEditorControlsView.MapItem> maps, String selectedKey, boolean busy, String statusText) {
        List<DungeonEditorControlsView.MapItem> safeMaps = maps == null ? List.of() : List.copyOf(maps);
        DungeonEditorControlsListeners.withDetachedSelectionUpdate(mapSelector, selectionListener, () -> {
            DungeonEditorControlsFxAccess.setItems(mapSelector, safeMaps);
            DungeonEditorControlsFxAccess.select(mapSelector, resolveSelected(safeMaps, selectedKey));
        });
        mapSelector.setDisable(busy || safeMaps.isEmpty());
        mapActionButton.setDisable(busy);
        boolean selectionMissing = DungeonEditorControlsFxAccess.selectedItem(mapSelector) == null;
        editMapItem.setDisable(busy || selectionMissing);
        deleteMapItem.setDisable(busy || selectionMissing);
        String resolvedStatus = statusText == null ? "" : statusText;
        statusLabel.setText(resolvedStatus);
        statusLabel.setVisible(!resolvedStatus.isBlank());
        statusLabel.setManaged(!resolvedStatus.isBlank());
    }

    void showMapEditor(DungeonEditorContributionModel.MapEditorUiState mapEditorUiState) {
        mapEditorPopup.show(mapEditorUiState);
    }

    private void handleSelectionChanged(DungeonEditorControlsView.MapItem selectedMap) {
        boolean hasSelection = selectedMap != null;
        editMapItem.setDisable(!hasSelection);
        deleteMapItem.setDisable(!hasSelection);
        if (hasSelection) {
            events.mapSelection(selectedMap.mapId());
        }
    }

    private DungeonEditorControlsView.MapItem resolveSelected(
            List<DungeonEditorControlsView.MapItem> maps,
            String selectedKey
    ) {
        DungeonEditorControlsView.MapItem selectedMap = maps.stream()
                .filter(item -> Objects.equals(item.key(), selectedKey))
                .findFirst()
                .orElse(null);
        if (selectedMap != null || maps.isEmpty()) {
            return selectedMap;
        }
        return maps.getFirst();
    }
}

final class DungeonEditorMapEditorPopupView {

    private final AnchoredPopupContentModel popupContentModel = new AnchoredPopupContentModel();
    private final Label titleLabel = new Label();
    private final TextField draftField = new TextField();
    private final Label errorLabel = new Label();
    private final Button cancelButton = new Button("Abbrechen");
    private final Button saveButton = new Button("Speichern");
    private final ChangeListener<String> draftListener = (ignored, before, after) -> handleDraftChanged();
    private final DungeonEditorControlsGate hiddenGate = new DungeonEditorControlsGate();
    private final HBox deleteConfirmRow;
    private final HBox actionRow;
    private final Node anchor;
    private final DungeonEditorControlsEvents events;
    private final AnchoredPopupView popup;

    DungeonEditorMapEditorPopupView(DungeonEditorControlsView panelView, DungeonEditorControlsEvents events, Node anchor) {
        this.events = events;
        this.anchor = anchor;
        DungeonEditorControlsFxAccess.addStyle(titleLabel, "panel-title");
        DungeonEditorControlsFxAccess.addStyle(errorLabel, "text-warning");
        errorLabel.setWrapText(true);
        errorLabel.setManaged(false);
        errorLabel.setVisible(false);

        Button cancelDeleteButton = new Button("Abbrechen");
        Button confirmDeleteButton = new Button("Löschen");
        Label deleteLabel = new Label("Dungeon löschen?");
        DungeonEditorControlsFxAccess.addStyle(deleteLabel, "text-warning");
        deleteConfirmRow = new HBox(8, deleteLabel, panelView.rowSpacer(), cancelDeleteButton, confirmDeleteButton);
        deleteConfirmRow.setVisible(false);
        deleteConfirmRow.setManaged(false);

        actionRow = new HBox(8, cancelButton, panelView.rowSpacer(), saveButton);
        actionRow.setAlignment(Pos.CENTER_LEFT);

        VBox body = new VBox(10, draftField, errorLabel, deleteConfirmRow);
        DialogSurfaceContentModel dialogContentModel = new DialogSurfaceContentModel();
        DialogSurfaceView panel = new DialogSurfaceView(titleLabel, body, actionRow);
        panel.bind(dialogContentModel);
        dialogContentModel.showLayout(DialogSurfaceContentModel.BodyPolicy.FIXED, true, true);
        panel.setPadding(new Insets(10));
        DungeonEditorControlsFxAccess.addStyles(panel, "dropdown-window", "dropdown-form");
        popup = new AnchoredPopupView(panel, () -> this.anchor, () -> draftField);
        popup.bind(popupContentModel);
        popup.onViewInputEvent(event -> {
            if (event.interaction().isHidden()) {
                handleHidden();
            }
        });

        cancelButton.setOnAction(event -> publishInput(false, false, false, true, false, false));
        cancelDeleteButton.setOnAction(event -> publishInput(false, false, false, true, false, false));
        confirmDeleteButton.setOnAction(event -> publishInput(false, false, false, false, false, true));
        saveButton.setOnAction(event -> publishInput(false, false, false, false, true, false));
        draftField.setOnAction(event -> publishInput(false, false, false, false, true, false));
        draftField.textProperty().addListener(draftListener);
    }

    void publishInput(
            boolean openCreateRequested,
            boolean openRenameRequested,
            boolean openDeleteRequested,
            boolean dismissRequested,
            boolean submitRequested,
            boolean confirmDeleteRequested
    ) {
        events.mapEditorInput(
                openCreateRequested,
                openRenameRequested,
                openDeleteRequested,
                dismissRequested,
                submitRequested,
                confirmDeleteRequested,
                currentDraftText());
    }

    void show(DungeonEditorContributionModel.MapEditorUiState mapEditorUiState) {
        DungeonEditorContributionModel.MapEditorUiState resolvedState = mapEditorUiState == null
                ? DungeonEditorContributionModel.MapEditorUiState.hidden()
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
        deleteConfirmRow.setVisible(resolvedState.deleteConfirmationVisible());
        deleteConfirmRow.setManaged(resolvedState.deleteConfirmationVisible());
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
        }
    }

    private void handleDraftChanged() {
        publishInput(false, false, false, false, false, false);
    }

    private void handleHidden() {
        if (!hiddenGate.enabled()) {
            publishInput(false, false, false, true, false, false);
        }
    }

    private void hidePopup() {
        if (popupContentModel.isOpen()) {
            hiddenGate.runSuppressed(popupContentModel::hide);
        }
    }

    private String currentDraftText() {
        String draftText = draftField.getText();
        return draftText == null ? "" : draftText.strip();
    }
}
