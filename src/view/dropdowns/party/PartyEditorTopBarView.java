package src.view.dropdowns.party;

import java.util.Objects;
import java.util.function.Consumer;
import javafx.geometry.Pos;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.control.TextField;
import javafx.scene.control.TextFormatter;
import javafx.scene.control.Tooltip;
import javafx.scene.layout.GridPane;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.VBox;

public final class PartyEditorTopBarView extends VBox {

    private static final String CHARACTER_NAME_PROMPT = "Charaktername";
    private static final String PLAYER_NAME_PROMPT = "Spielername";
    private static final String LEVEL_PROMPT = "Level";
    private static final String PASSIVE_PERCEPTION_PROMPT = "Passive Perception";
    private static final String ARMOR_CLASS_PROMPT = "AC";

    private final Label titleLabel = new Label();
    private final TextField nameField = textField(CHARACTER_NAME_PROMPT);
    private final TextField playerNameField = textField(PLAYER_NAME_PROMPT);
    private final TextField levelField = integerField(LEVEL_PROMPT);
    private final TextField passivePerceptionField = integerField(PASSIVE_PERCEPTION_PROMPT);
    private final TextField armorClassField = integerField(ARMOR_CLASS_PROMPT);
    private final Button revealDeleteButton = new Button("Loeschen");
    private final VBox deleteSection = new VBox(8);
    private final Label deleteMessageLabel = new Label();
    private final Button cancelButton = new Button("Abbrechen");
    private final Button submitButton = new Button("Speichern");
    private Consumer<PartyEditorTopBarViewInputEvent> viewInputEventHandler = ignored -> { };

    public PartyEditorTopBarView() {
        getStyleClass().addAll("dropdown-window", "dropdown-form", "party-editor-inline");
        titleLabel.getStyleClass().add("panel-title");
        deleteSection.getStyleClass().add("party-editor-delete-section");
        deleteMessageLabel.getStyleClass().add("dropdown-message");
        deleteMessageLabel.setWrapText(true);
        revealDeleteButton.getStyleClass().addAll("compact", "danger-action");
        revealDeleteButton.setMaxWidth(Double.MAX_VALUE);
        revealDeleteButton.setOnAction(event -> publish(false, false, true, false, false));
        cancelButton.setOnAction(event -> publish(true, false, false, false, false));
        submitButton.setOnAction(event -> publish(false, true, false, false, false));
        submitButton.setAccessibleHelp("Charaktername erforderlich.");
        installDraftListeners();

        deleteSection.getChildren().addAll(
                deleteMessageLabel,
                actionRow(
                        styledButton("Abbrechen", "compact", "neutral-action",
                                () -> publish(false, false, false, true, false)),
                        styledButton("Wirklich loeschen", "compact", "danger-action",
                                () -> publish(false, false, false, false, true))));
        VBox body = new VBox(10, formGrid(), revealDeleteButton, deleteSection, actionRow(cancelButton, submitButton));
        getChildren().addAll(titleLabel, body);
        setFillWidth(true);
        setVisible(false);
        setManaged(false);
        updateSubmitDisabled();
    }

    public void bind(PartyEditorTopBarContentModel contentModel) {
        PartyEditorTopBarContentModel safeModel = Objects.requireNonNull(contentModel, "contentModel");
        showEditor(safeModel.editorPanelProperty().get());
        safeModel.editorPanelProperty().addListener((ignored, before, after) -> showEditor(after));
    }

    public void onViewInputEvent(Consumer<PartyEditorTopBarViewInputEvent> handler) {
        viewInputEventHandler = handler == null ? ignored -> { } : handler;
    }

    private void showEditor(PartyEditorTopBarContentModel.EditorPanelModel content) {
        boolean visible = content != null && content.visible();
        boolean editingExisting = content != null && content.editingExisting();
        setVisible(visible);
        setManaged(visible);
        titleLabel.setText(editingExisting ? "Charakter bearbeiten" : "Neuer Charakter");
        submitButton.setText(editingExisting ? "Speichern" : "Erstellen");
        revealDeleteButton.setVisible(visible && editingExisting);
        revealDeleteButton.setManaged(visible && editingExisting);
        nameField.setText(content == null ? "" : content.memberName());
        playerNameField.setText(content == null ? "" : content.playerName());
        levelField.setText(content == null ? "1" : content.rawLevel());
        passivePerceptionField.setText(content == null ? "10" : content.rawPassivePerception());
        armorClassField.setText(content == null ? "10" : content.rawArmorClass());
        deleteMessageLabel.setText("\"" + safe(nameField.getText()).trim() + "\" wirklich dauerhaft loeschen?");
        deleteSection.setVisible(visible && content.deleteConfirmationVisible());
        deleteSection.setManaged(visible && content.deleteConfirmationVisible());
        updateSubmitDisabled();
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
                new PartyEditorTopBarViewInputEvent.EditorDraft(
                        nameField.getText(),
                        playerNameField.getText(),
                        levelField.getText(),
                        passivePerceptionField.getText(),
                        armorClassField.getText())));
    }

    private void installDraftListeners() {
        nameField.textProperty().addListener((ignored, before, after) -> onDraftChanged());
        playerNameField.textProperty().addListener((ignored, before, after) -> onDraftChanged());
        levelField.textProperty().addListener((ignored, before, after) -> onDraftChanged());
        passivePerceptionField.textProperty().addListener((ignored, before, after) -> onDraftChanged());
        armorClassField.textProperty().addListener((ignored, before, after) -> onDraftChanged());
        nameField.setOnAction(event -> publish(false, true, false, false, false));
        playerNameField.setOnAction(event -> publish(false, true, false, false, false));
        levelField.setOnAction(event -> publish(false, true, false, false, false));
        passivePerceptionField.setOnAction(event -> publish(false, true, false, false, false));
        armorClassField.setOnAction(event -> publish(false, true, false, false, false));
    }

    private void onDraftChanged() {
        updateSubmitDisabled();
        deleteMessageLabel.setText("\"" + safe(nameField.getText()).trim() + "\" wirklich dauerhaft loeschen?");
        publish(false, false, false, false, false);
    }

    private void updateSubmitDisabled() {
        boolean nameMissing = safe(nameField.getText()).isBlank();
        submitButton.setDisable(nameMissing);
        submitButton.setTooltip(nameMissing ? new Tooltip("Charaktername erforderlich.") : null);
    }

    private GridPane formGrid() {
        GridPane form = new GridPane();
        form.getStyleClass().add("party-editor-form");
        addRow(form, 0, "Charakter *", nameField);
        addRow(form, 1, "Spieler", playerNameField);
        addRow(form, 2, "Level", levelField);
        addRow(form, 3, "Passive Perception", passivePerceptionField);
        addRow(form, 4, "AC", armorClassField);
        return form;
    }

    private static void addRow(GridPane form, int row, String labelText, TextField field) {
        Label label = new Label(labelText);
        label.getStyleClass().add("text-muted");
        label.setLabelFor(field);
        form.add(label, 0, row);
        form.add(field, 1, row);
        GridPane.setHgrow(field, Priority.ALWAYS);
    }

    private static HBox actionRow(javafx.scene.Node... children) {
        HBox row = new HBox(8, children);
        row.setAlignment(Pos.CENTER_RIGHT);
        return row;
    }

    private static Button styledButton(String text, String primaryStyle, String secondaryStyle, Runnable action) {
        Button button = new Button(text);
        button.getStyleClass().addAll(primaryStyle, secondaryStyle);
        button.setOnAction(event -> action.run());
        return button;
    }

    private static TextField textField(String promptText) {
        TextField field = new TextField();
        field.setPromptText(promptText);
        if (CHARACTER_NAME_PROMPT.equals(promptText)) {
            field.setAccessibleText("Charaktername erforderlich");
        }
        return field;
    }

    private static TextField integerField(String promptText) {
        TextField field = textField(promptText);
        field.setTextFormatter(new TextFormatter<>(change -> change.getText().matches("[0-9]*") ? change : null));
        return field;
    }

    private static String safe(String value) {
        return value == null ? "" : value;
    }
}
