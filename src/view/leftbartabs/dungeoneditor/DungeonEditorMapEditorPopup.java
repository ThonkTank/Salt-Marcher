package src.view.leftbartabs.dungeoneditor;

import javafx.beans.value.ChangeListener;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.control.TextField;
import javafx.scene.layout.HBox;
import javafx.scene.layout.VBox;
import src.view.slotcontent.primitives.dialog.DialogSurfaceView;
import src.view.slotcontent.primitives.dialog.DialogSurfaceView.BodyPolicy;
import src.view.slotcontent.primitives.popup.AnchoredPopupView;

final class DungeonEditorMapEditorPopup {

    private final AnchoredPopupView popup = new AnchoredPopupView();
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

    DungeonEditorMapEditorPopup(DungeonEditorControlsView panelView, DungeonEditorControlsEvents events, Node anchor) {
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
        DialogSurfaceView panel = new DialogSurfaceView();
        panel.setPadding(new Insets(10));
        DungeonEditorControlsFxAccess.addStyles(panel, "dropdown-window", "dropdown-form");
        panel.setHeader(titleLabel);
        panel.setBody(body, BodyPolicy.FIXED);
        panel.setFooter(actionRow);
        popup.setContent(panel);
        popup.addOnHidden(event -> handleHidden());

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
        boolean popupWasShowing = popup.isShowing();
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
            popup.showBelow(anchor);
        }
        if (resolvedState.draftFieldVisible()) {
            popup.focusAfterShown(draftField);
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
        if (popup.isShowing()) {
            hiddenGate.runSuppressed(popup::hide);
        }
    }

    private String currentDraftText() {
        String draftText = draftField.getText();
        return draftText == null ? "" : draftText.strip();
    }
}
