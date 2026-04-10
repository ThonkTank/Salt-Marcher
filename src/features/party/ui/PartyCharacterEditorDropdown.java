package features.party.ui;

import features.party.input.CreateCharacterAndAddToPartyInput;
import features.party.input.LoadPartySnapshotInput;
import features.party.input.UpdateCharacterInput;
import javafx.beans.binding.Bindings;
import javafx.geometry.Insets;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.control.TextField;
import javafx.scene.control.TextFormatter;
import javafx.scene.layout.GridPane;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;
import ui.components.AnchoredDropdown;

import java.util.function.Consumer;

@SuppressWarnings("unused")
final class PartyCharacterEditorDropdown {
    private enum Mode {
        CREATE,
        EDIT
    }

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
    private final Button revealDeleteButton = new Button("Löschen");
    private final Button cancelDeleteButton = new Button("Abbrechen");
    private final Button confirmDeleteButton = new Button("Wirklich löschen");
    private final Button cancelButton = new Button("Abbrechen");
    private final Button submitButton = new Button("Speichern");
    private final AnchoredDropdown dropdown = new AnchoredDropdown(panel);

    private Mode mode = Mode.CREATE;
    private long editingCharacterId = -1L;
    private Consumer<CreateCharacterAndAddToPartyInput> onCreate = input -> { };
    private Consumer<UpdateCharacterInput> onUpdate = input -> { };
    private Runnable onDelete = () -> { };

    PartyCharacterEditorDropdown() {
        panel.getStyleClass().addAll("dropdown-window", "dropdown-form", "party-editor-dropdown");
        panel.setPadding(new Insets(10));

        titleLabel.getStyleClass().add("dropdown-title");
        errorLabel.getStyleClass().add("text-warning");
        errorLabel.setWrapText(true);
        errorLabel.setVisible(false);
        errorLabel.setManaged(false);

        configureField(nameField, "Charaktername");
        configureField(playerNameField, "Spielername");
        configureField(levelField, "Level");
        configureField(passivePerceptionField, "Passive Perception");
        configureField(armorClassField, "AC");

        GridPane formGrid = new GridPane();
        formGrid.getStyleClass().add("party-editor-form");
        formGrid.setHgap(10);
        formGrid.setVgap(8);
        addRow(formGrid, 0, "Charakter", nameField);
        addRow(formGrid, 1, "Spieler", playerNameField);
        addRow(formGrid, 2, "Level", levelField);
        addRow(formGrid, 3, "Passive Perception", passivePerceptionField);
        addRow(formGrid, 4, "AC", armorClassField);

        revealDeleteButton.getStyleClass().addAll("party-btn", "delete");
        revealDeleteButton.setMaxWidth(Double.MAX_VALUE);
        revealDeleteButton.setOnAction(event -> setDeleteConfirmationVisible(true));

        deleteMessageLabel.getStyleClass().add("dropdown-message");
        deleteMessageLabel.setWrapText(true);

        cancelDeleteButton.getStyleClass().addAll("party-btn", "remove");
        cancelDeleteButton.setOnAction(event -> setDeleteConfirmationVisible(false));

        confirmDeleteButton.getStyleClass().addAll("party-btn", "delete");
        confirmDeleteButton.setOnAction(event -> onDelete.run());

        HBox deleteActions = new HBox(8, cancelDeleteButton, confirmDeleteButton);
        deleteActions.getStyleClass().add("party-editor-delete-actions");
        deleteSection.getStyleClass().add("party-editor-delete-section");
        deleteSection.getChildren().addAll(deleteMessageLabel, deleteActions);

        Region spacer = new Region();
        HBox.setHgrow(spacer, Priority.ALWAYS);
        HBox actions = new HBox(8, cancelButton, spacer, submitButton);
        actions.getStyleClass().add("dropdown-actions");

        cancelButton.setOnAction(event -> dropdown.hide());
        submitButton.setOnAction(event -> submit());
        nameField.setOnAction(event -> submit());
        playerNameField.setOnAction(event -> submit());
        levelField.setOnAction(event -> submit());
        passivePerceptionField.setOnAction(event -> submit());
        armorClassField.setOnAction(event -> submit());

        submitButton.disableProperty().bind(Bindings.createBooleanBinding(
                () -> nameField.getText() == null || nameField.getText().isBlank(),
                nameField.textProperty()));

        dropdown.setOnHidden(this::resetState);
        panel.getChildren().addAll(titleLabel, formGrid, errorLabel, revealDeleteButton, deleteSection, actions);
        resetState();
    }

    void showCreate(Node anchor, Consumer<CreateCharacterAndAddToPartyInput> onSubmit) {
        mode = Mode.CREATE;
        editingCharacterId = -1L;
        titleLabel.setText("Neuer Charakter");
        submitButton.setText("Erstellen");
        revealDeleteButton.setVisible(false);
        revealDeleteButton.setManaged(false);
        populateFields("", "", 1, 10, 10);
        this.onCreate = onSubmit == null ? input -> { } : onSubmit;
        this.onUpdate = input -> { };
        this.onDelete = () -> { };
        setDeleteConfirmationVisible(false);
        resetError();
        dropdown.show(anchor, AnchoredDropdown.HorizontalAlignment.RIGHT, 2);
        dropdown.requestFocus(nameField);
    }

    void showEdit(
            Node anchor,
            LoadPartySnapshotInput.CharacterInput character,
            Consumer<UpdateCharacterInput> onSubmit,
            Runnable onDelete
    ) {
        mode = Mode.EDIT;
        editingCharacterId = character == null ? -1L : character.id();
        titleLabel.setText("Charakter bearbeiten");
        submitButton.setText("Speichern");
        revealDeleteButton.setVisible(true);
        revealDeleteButton.setManaged(true);
        populateFields(
                character == null ? "" : safe(character.name()),
                character == null ? "" : safe(character.playerName()),
                character == null ? 1 : character.level(),
                character == null ? 10 : character.passivePerception(),
                character == null ? 10 : character.armorClass());
        deleteMessageLabel.setText(character == null
                ? "Charakter wirklich dauerhaft löschen?"
                : "\"" + safe(character.name()) + "\" wirklich dauerhaft löschen?");
        this.onCreate = input -> { };
        this.onUpdate = onSubmit == null ? input -> { } : onSubmit;
        this.onDelete = onDelete == null ? () -> { } : onDelete;
        setDeleteConfirmationVisible(false);
        resetError();
        dropdown.show(anchor, AnchoredDropdown.HorizontalAlignment.RIGHT, 2);
        dropdown.requestFocus(nameField);
    }

    void showError(String message) {
        errorLabel.setText(message == null ? "" : message);
        errorLabel.setVisible(true);
        errorLabel.setManaged(true);
        dropdown.requestFocus(nameField);
    }

    void hide() {
        dropdown.hide();
    }

    private void submit() {
        String name = safe(nameField.getText()).trim();
        if (name.isEmpty()) {
            showError("Charaktername fehlt.");
            return;
        }
        Integer level = parseInteger(levelField.getText(), "Level", 1, 20);
        if (level == null) {
            return;
        }
        Integer passivePerception = parseInteger(passivePerceptionField.getText(), "Passive Perception", 1, 99);
        if (passivePerception == null) {
            return;
        }
        Integer armorClass = parseInteger(armorClassField.getText(), "AC", 1, 99);
        if (armorClass == null) {
            return;
        }
        if (mode == Mode.CREATE) {
            onCreate.accept(new CreateCharacterAndAddToPartyInput(
                    name,
                    safe(playerNameField.getText()).trim(),
                    level,
                    passivePerception,
                    armorClass));
            return;
        }
        onUpdate.accept(new UpdateCharacterInput(
                editingCharacterId,
                name,
                safe(playerNameField.getText()).trim(),
                level,
                passivePerception,
                armorClass));
    }

    private Integer parseInteger(String rawValue, String label, int min, int max) {
        String trimmed = safe(rawValue).trim();
        if (trimmed.isEmpty()) {
            showError(label + " fehlt.");
            return null;
        }
        try {
            int value = Integer.parseInt(trimmed);
            if (value < min || value > max) {
                showError(label + " muss zwischen " + min + " und " + max + " liegen.");
                return null;
            }
            return value;
        } catch (NumberFormatException ex) {
            showError(label + " muss eine Zahl sein.");
            return null;
        }
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

    private void populateFields(String name, String playerName, int level, int passivePerception, int armorClass) {
        nameField.setText(name);
        playerNameField.setText(playerName);
        levelField.setText(Integer.toString(level));
        passivePerceptionField.setText(Integer.toString(passivePerception));
        armorClassField.setText(Integer.toString(armorClass));
        nameField.selectAll();
    }

    private void setDeleteConfirmationVisible(boolean visible) {
        deleteSection.setVisible(visible);
        deleteSection.setManaged(visible);
        if (visible) {
            dropdown.requestFocus(cancelDeleteButton);
        }
    }

    private void resetState() {
        mode = Mode.CREATE;
        editingCharacterId = -1L;
        onCreate = input -> { };
        onUpdate = input -> { };
        onDelete = () -> { };
        resetError();
        setDeleteConfirmationVisible(false);
    }

    private void resetError() {
        errorLabel.setText("");
        errorLabel.setVisible(false);
        errorLabel.setManaged(false);
    }

    private static String safe(String value) {
        return value == null ? "" : value;
    }
}
