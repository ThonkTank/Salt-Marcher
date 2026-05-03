package src.view.dropdowns.party;

import java.util.function.Consumer;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.control.TextField;
import javafx.scene.control.TextFormatter;
import javafx.scene.layout.GridPane;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.VBox;

public final class PartyEditorTopBarView extends VBox {

    private final Label titleLabel = new Label();
    private final TextField nameField = new TextField();
    private final TextField playerNameField = new TextField();
    private final TextField levelField = createIntegerField();
    private final TextField passivePerceptionField = createIntegerField();
    private final TextField armorClassField = createIntegerField();
    private final Button revealDeleteButton = new Button("Loeschen");
    private final VBox deleteSection = new VBox(8);
    private final Label deleteMessageLabel = new Label();
    private final Button cancelDeleteButton = new Button("Abbrechen");
    private final Button confirmDeleteButton = new Button("Wirklich loeschen");
    private final Button cancelButton = new Button("Abbrechen");
    private final Button submitButton = new Button("Speichern");
    private EditorContent content = EditorContent.hidden();
    private Consumer<PartyEditorTopBarViewInputEvent> viewInputEventHandler = ignored -> { };

    public PartyEditorTopBarView() {
        getStyleClass().addAll("dropdown-window", "dropdown-form", "party-editor-inline");
        setPadding(new Insets(10));
        setSpacing(10);

        titleLabel.getStyleClass().add("panel-title");
        configureFields();
        configureDeleteSection();
        configureActions();

        VBox body = new VBox(10, formGrid(), revealDeleteButton, deleteSection, actionRow());
        getChildren().addAll(titleLabel, body);
        setFillWidth(true);
        showEditor(EditorContent.hidden());
    }

    public void showEditor(EditorContent content) {
        EditorContent safeContent = content == null ? EditorContent.hidden() : content;
        this.content = safeContent;
        setVisible(safeContent.visible());
        setManaged(safeContent.visible());
        if (!safeContent.visible()) {
            return;
        }
        titleLabel.setText(safeContent.editingExisting() ? "Charakter bearbeiten" : "Neuer Charakter");
        submitButton.setText(safeContent.editingExisting() ? "Speichern" : "Erstellen");
        revealDeleteButton.setVisible(safeContent.editingExisting());
        revealDeleteButton.setManaged(safeContent.editingExisting());
        deleteMessageLabel.setText("\"" + safeContent.memberName() + "\" wirklich dauerhaft loeschen?");
        deleteSection.setVisible(safeContent.deleteConfirmationVisible());
        deleteSection.setManaged(safeContent.deleteConfirmationVisible());
        populateFields(safeContent);
        updateSubmitDisabled();
    }

    public void onViewInputEvent(Consumer<PartyEditorTopBarViewInputEvent> handler) {
        viewInputEventHandler = handler == null ? ignored -> { } : handler;
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
    }

    private void configureDeleteSection() {
        revealDeleteButton.getStyleClass().addAll("compact", "danger-action");
        revealDeleteButton.setMaxWidth(Double.MAX_VALUE);
        revealDeleteButton.setOnAction(event -> publish(false, false, true, false, false));
        deleteMessageLabel.getStyleClass().add("dropdown-message");
        deleteMessageLabel.setWrapText(true);
        cancelDeleteButton.getStyleClass().addAll("compact", "neutral-action");
        cancelDeleteButton.setOnAction(event -> publish(false, false, false, true, false));
        confirmDeleteButton.getStyleClass().addAll("compact", "danger-action");
        confirmDeleteButton.setOnAction(event -> publish(false, false, false, false, true));
        HBox deleteActions = new HBox(8, cancelDeleteButton, confirmDeleteButton);
        deleteActions.setAlignment(Pos.CENTER_RIGHT);
        deleteSection.getStyleClass().add("party-editor-delete-section");
        deleteSection.getChildren().addAll(deleteMessageLabel, deleteActions);
    }

    private void configureActions() {
        cancelButton.setOnAction(event -> publish(true, false, false, false, false));
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

    private HBox actionRow() {
        HBox row = new HBox(8, cancelButton, submitButton);
        row.setAlignment(Pos.CENTER_RIGHT);
        return row;
    }

    private void submit() {
        publish(false, true, false, false, false);
    }

    private void publish(
            boolean cancelRequested,
            boolean submitRequested,
            boolean deleteConfirmationRequested,
            boolean deleteConfirmationCancelled,
            boolean deleteConfirmed
    ) {
        viewInputEventHandler.accept(new PartyEditorTopBarViewInputEvent(
                cancelRequested,
                submitRequested,
                deleteConfirmationRequested,
                deleteConfirmationCancelled,
                deleteConfirmed,
                content.editingExisting(),
                content.memberId(),
                content.memberName(),
                new PartyEditorTopBarViewInputEvent.EditorDraft(
                        content.memberId(),
                        safe(nameField.getText()).trim(),
                        safe(playerNameField.getText()).trim(),
                        safe(levelField.getText()).trim(),
                        safe(passivePerceptionField.getText()).trim(),
                        safe(armorClassField.getText()).trim())));
    }

    private void updateSubmitDisabled() {
        submitButton.setDisable(safe(nameField.getText()).isBlank());
    }

    private void populateFields(EditorContent content) {
        nameField.setText(content.memberName());
        playerNameField.setText(content.playerName());
        levelField.setText(content.rawLevel());
        passivePerceptionField.setText(content.rawPassivePerception());
        armorClassField.setText(content.rawArmorClass());
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

    public record EditorContent(
            boolean visible,
            boolean editingExisting,
            long memberId,
            String memberName,
            String playerName,
            String rawLevel,
            String rawPassivePerception,
            String rawArmorClass,
            boolean deleteConfirmationVisible
    ) {

        public EditorContent {
            memberName = safe(memberName);
            playerName = safe(playerName);
            rawLevel = safe(rawLevel);
            rawPassivePerception = safe(rawPassivePerception);
            rawArmorClass = safe(rawArmorClass);
        }

        static EditorContent hidden() {
            return new EditorContent(false, false, 0L, "", "", "1", "10", "10", false);
        }
    }
}
