package src.view.dropdowns.party;

import java.util.function.Function;
import javafx.geometry.Bounds;
import javafx.geometry.Insets;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.control.TextField;
import javafx.scene.control.TextFormatter;
import javafx.scene.input.KeyCode;
import javafx.scene.input.KeyEvent;
import javafx.scene.layout.GridPane;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;
import javafx.stage.Popup;
import org.jspecify.annotations.Nullable;

public final class PartyCharacterEditorTopBarView {

    private final VBox panel = new VBox(10);
    private final Label titleLabel = new Label();
    private final Label errorLabel = new Label();
    private final TextField nameField = new TextField();
    private final TextField playerNameField = new TextField();
    private final TextField levelField = createIntegerField();
    private final TextField passivePerceptionField = createIntegerField();
    private final TextField armorClassField = createIntegerField();
    private final VBox deleteSection = new VBox(8);
    private final Label deleteMessageLabel = new Label();
    private final Button revealDeleteButton = new Button("Loeschen");
    private final Button cancelDeleteButton = new Button("Abbrechen");
    private final Button confirmDeleteButton = new Button("Wirklich loeschen");
    private final Button cancelButton = new Button("Abbrechen");
    private final Button submitButton = new Button("Speichern");
    private final Popup popup = new Popup();

    private @Nullable EditorMember editingMember;
    private boolean pending;
    private Function<EditorDraft, EditorResult> onCreate = ignored -> EditorResult.success();
    private Function<EditorDraft, EditorResult> onUpdate = ignored -> EditorResult.success();
    private Function<EditorMember, EditorResult> onDelete = ignored -> EditorResult.success();

    PartyCharacterEditorTopBarView() {
        panel.getStyleClass().addAll("dropdown-window", "dropdown-form", "party-editor-dropdown");
        panel.setPadding(new Insets(10));
        titleLabel.getStyleClass().add("dropdown-title");
        errorLabel.getStyleClass().add("text-warning");
        errorLabel.setWrapText(true);
        errorLabel.setVisible(false);
        errorLabel.setManaged(false);
        configureFields();
        configureDeleteSection();
        configurePopup();
        panel.getChildren().addAll(titleLabel, formGrid(), errorLabel, revealDeleteButton, deleteSection, actions());
        resetTransientState();
    }

    void onCreate(Function<EditorDraft, EditorResult> action) {
        onCreate = action == null ? ignored -> EditorResult.success() : action;
    }

    void onUpdate(Function<EditorDraft, EditorResult> action) {
        onUpdate = action == null ? ignored -> EditorResult.success() : action;
    }

    void onDelete(Function<EditorMember, EditorResult> action) {
        onDelete = action == null ? ignored -> EditorResult.success() : action;
    }

    void showCreate(Node anchor) {
        editingMember = null;
        titleLabel.setText("Neuer Charakter");
        submitButton.setText("Erstellen");
        revealDeleteButton.setVisible(false);
        revealDeleteButton.setManaged(false);
        populateFields("", "", 1, 10, 10);
        setDeleteConfirmationVisible(false);
        resetError();
        show(anchor);
    }

    void showEdit(Node anchor, @Nullable EditorMember member) {
        editingMember = member;
        EditorMember safeMember = member == null ? EditorMember.empty() : member;
        titleLabel.setText("Charakter bearbeiten");
        submitButton.setText("Speichern");
        revealDeleteButton.setVisible(true);
        revealDeleteButton.setManaged(true);
        populateFields(
                safeMember.name(),
                safeMember.playerName(),
                safeMember.level(),
                safeMember.passivePerception(),
                safeMember.armorClass());
        deleteMessageLabel.setText("\"" + safeMember.name() + "\" wirklich dauerhaft loeschen?");
        setDeleteConfirmationVisible(false);
        resetError();
        show(anchor);
    }

    void hide() {
        popup.hide();
    }

    void completeAsync(EditorResult result) {
        handleEditorResult(result);
    }

    private void configureFields() {
        configureField(nameField, "Charaktername");
        configureField(playerNameField, "Spielername");
        configureField(levelField, "Level");
        configureField(passivePerceptionField, "Passive Perception");
        configureField(armorClassField, "AC");
        nameField.setOnAction(event -> submit());
        playerNameField.setOnAction(event -> submit());
        levelField.setOnAction(event -> submit());
        passivePerceptionField.setOnAction(event -> submit());
        armorClassField.setOnAction(event -> submit());
        nameField.textProperty().addListener((ignored, before, after) -> updateSubmitDisabled());
        updateSubmitDisabled();
    }

    private void configureDeleteSection() {
        revealDeleteButton.getStyleClass().addAll("party-btn", "delete");
        revealDeleteButton.setMaxWidth(Double.MAX_VALUE);
        revealDeleteButton.setOnAction(event -> setDeleteConfirmationVisible(true));
        deleteMessageLabel.getStyleClass().add("dropdown-message");
        deleteMessageLabel.setWrapText(true);
        cancelDeleteButton.getStyleClass().addAll("party-btn", "remove");
        cancelDeleteButton.setOnAction(event -> setDeleteConfirmationVisible(false));
        confirmDeleteButton.getStyleClass().addAll("party-btn", "delete");
        confirmDeleteButton.setOnAction(event -> {
            if (pending) {
                return;
            }
            EditorResult result = onDelete.apply(editingMember == null ? EditorMember.empty() : editingMember);
            handleEditorResult(result);
        });
        HBox deleteActions = new HBox(8, cancelDeleteButton, confirmDeleteButton);
        deleteActions.getStyleClass().add("party-editor-delete-actions");
        deleteSection.getStyleClass().add("party-editor-delete-section");
        deleteSection.getChildren().addAll(deleteMessageLabel, deleteActions);
    }

    private void configurePopup() {
        popup.setAutoHide(true);
        popup.setHideOnEscape(true);
        popup.getContent().setAll(panel);
        popup.setOnHidden(event -> resetTransientState());
        popup.addEventFilter(KeyEvent.KEY_PRESSED, event -> {
            if (event.getCode() == KeyCode.ESCAPE) {
                popup.hide();
                event.consume();
            }
        });
        cancelButton.setOnAction(event -> popup.hide());
        submitButton.setOnAction(event -> submit());
    }

    private GridPane formGrid() {
        GridPane formGrid = new GridPane();
        formGrid.getStyleClass().add("party-editor-form");
        formGrid.setHgap(10);
        formGrid.setVgap(8);
        addRow(formGrid, 0, "Charakter", nameField);
        addRow(formGrid, 1, "Spieler", playerNameField);
        addRow(formGrid, 2, "Level", levelField);
        addRow(formGrid, 3, "Passive Perception", passivePerceptionField);
        addRow(formGrid, 4, "AC", armorClassField);
        return formGrid;
    }

    private HBox actions() {
        Region spacer = new Region();
        HBox.setHgrow(spacer, Priority.ALWAYS);
        HBox actions = new HBox(8, cancelButton, spacer, submitButton);
        actions.getStyleClass().add("dropdown-actions");
        return actions;
    }

    private void submit() {
        if (pending) {
            return;
        }
        EditorDraft draft = new EditorDraft(
                editingMember == null ? null : editingMember.id(),
                safe(nameField.getText()).trim(),
                safe(playerNameField.getText()).trim(),
                safe(levelField.getText()).trim(),
                safe(passivePerceptionField.getText()).trim(),
                safe(armorClassField.getText()).trim());
        EditorResult result = editingMember == null ? onCreate.apply(draft) : onUpdate.apply(draft);
        handleEditorResult(result);
    }

    private void handleEditorResult(EditorResult result) {
        EditorResult safeResult = result == null ? EditorResult.failure("Party-Aktion konnte nicht gespeichert werden.") : result;
        if (safeResult.pending()) {
            setPending(true);
            showInfo(safeResult.message().isBlank() ? "Speichere..." : safeResult.message());
            return;
        }
        setPending(false);
        if (safeResult.accepted()) {
            hide();
            return;
        }
        showError(safeResult.message());
    }

    private void show(Node anchor) {
        if (anchor == null || anchor.getScene() == null) {
            return;
        }
        panel.applyCss();
        panel.layout();
        Bounds bounds = anchor.localToScreen(anchor.getBoundsInLocal());
        if (bounds != null) {
            popup.show(anchor, bounds.getMaxX() - 360.0, bounds.getMaxY() + 2.0);
            nameField.requestFocus();
            nameField.selectAll();
        }
    }

    private void showError(String message) {
        errorLabel.setText(safe(message));
        errorLabel.setVisible(true);
        errorLabel.setManaged(true);
        nameField.requestFocus();
    }

    private void showInfo(String message) {
        errorLabel.setText(safe(message));
        errorLabel.setVisible(true);
        errorLabel.setManaged(true);
    }

    private void resetError() {
        errorLabel.setText("");
        errorLabel.setVisible(false);
        errorLabel.setManaged(false);
    }

    private void resetTransientState() {
        setPending(false);
        resetError();
        setDeleteConfirmationVisible(false);
    }

    private void setDeleteConfirmationVisible(boolean visible) {
        deleteSection.setVisible(visible);
        deleteSection.setManaged(visible);
        if (visible) {
            cancelDeleteButton.requestFocus();
        }
    }

    private void updateSubmitDisabled() {
        submitButton.setDisable(pending || safe(nameField.getText()).isBlank());
    }

    private void setPending(boolean active) {
        pending = active;
        nameField.setDisable(active);
        playerNameField.setDisable(active);
        levelField.setDisable(active);
        passivePerceptionField.setDisable(active);
        armorClassField.setDisable(active);
        revealDeleteButton.setDisable(active);
        cancelDeleteButton.setDisable(active);
        confirmDeleteButton.setDisable(active);
        cancelButton.setDisable(active);
        updateSubmitDisabled();
    }

    private void populateFields(
            String name,
            String playerName,
            int level,
            int passivePerception,
            int armorClass
    ) {
        nameField.setText(safe(name));
        playerNameField.setText(safe(playerName));
        levelField.setText(Integer.toString(level));
        passivePerceptionField.setText(Integer.toString(passivePerception));
        armorClassField.setText(Integer.toString(armorClass));
    }

    private static void addRow(GridPane grid, int row, String labelText, TextField field) {
        Label label = new Label(labelText);
        label.getStyleClass().add("text-muted");
        label.setLabelFor(field);
        grid.add(label, 0, row);
        grid.add(field, 1, row);
        GridPane.setHgrow(field, Priority.ALWAYS);
    }

    private static void configureField(TextField field, String promptText) {
        field.setPromptText(promptText);
    }

    private static TextField createIntegerField() {
        TextField field = new TextField();
        field.setTextFormatter(new TextFormatter<>(change -> change.getText().matches("[0-9]*") ? change : null));
        return field;
    }

    private static String safe(String value) {
        return value == null ? "" : value;
    }

    record EditorMember(
            @Nullable Long id,
            String name,
            String playerName,
            int level,
            int passivePerception,
            int armorClass
    ) {

        EditorMember {
            name = safe(name);
            playerName = safe(playerName);
        }

        static EditorMember empty() {
            return new EditorMember(null, "", "", 1, 10, 10);
        }
    }

    record EditorDraft(
            @Nullable Long id,
            String name,
            String playerName,
            String rawLevel,
            String rawPassivePerception,
            String rawArmorClass
    ) {

        EditorDraft {
            name = safe(name);
            playerName = safe(playerName);
            rawLevel = safe(rawLevel);
            rawPassivePerception = safe(rawPassivePerception);
            rawArmorClass = safe(rawArmorClass);
        }
    }

    record EditorResult(boolean accepted, boolean pending, String message) {

        EditorResult {
            message = safe(message);
        }

        static EditorResult success() {
            return new EditorResult(true, false, "");
        }

        static EditorResult failure(String message) {
            return new EditorResult(false, false, message);
        }

        static EditorResult pending(String message) {
            return new EditorResult(false, true, message);
        }
    }
}
