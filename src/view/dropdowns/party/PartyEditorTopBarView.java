package src.view.dropdowns.party;

import java.util.Objects;
import java.util.function.Consumer;
import javafx.beans.value.ChangeListener;
import javafx.geometry.Pos;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.control.TextField;
import javafx.scene.control.TextFormatter;
import javafx.scene.control.Tooltip;
import javafx.scene.Node;
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

    private final Label titleLabel = new StyledLabel("panel-title");
    private final TextField nameField = EditorChrome.textField(CHARACTER_NAME_PROMPT);
    private final TextField playerNameField = EditorChrome.textField(PLAYER_NAME_PROMPT);
    private final TextField levelField = EditorChrome.integerField(LEVEL_PROMPT);
    private final TextField passivePerceptionField = EditorChrome.integerField(PASSIVE_PERCEPTION_PROMPT);
    private final TextField armorClassField = EditorChrome.integerField(ARMOR_CLASS_PROMPT);
    private final Button revealDeleteButton = new StyledButton("Loeschen", "compact", "danger-action");
    private final VBox deleteSection = new StyledVBox(8, "party-editor-delete-section");
    private final Label deleteMessageLabel = new StyledLabel("dropdown-message");
    private final Button cancelButton = new Button("Abbrechen");
    private final Button submitButton = new Button("Speichern");
    private final EditorDraftBinder draftBinder = new EditorDraftBinder();
    private Consumer<PartyEditorTopBarViewInputEvent> viewInputEventHandler = ignored -> { };

    public PartyEditorTopBarView() {
        getStyleClass().addAll("dropdown-window", "dropdown-form", "party-editor-inline");
        deleteMessageLabel.setWrapText(true);
        revealDeleteButton.setMaxWidth(Double.MAX_VALUE);
        revealDeleteButton.setOnAction(event -> publish(false, false, true, false, false));
        cancelButton.setOnAction(event -> publish(true, false, false, false, false));
        submitButton.setOnAction(event -> publish(false, true, false, false, false));
        submitButton.setAccessibleHelp("Charaktername erforderlich.");
        draftBinder.installDraftListeners();

        ((StyledVBox) deleteSection).addNodes(
                deleteMessageLabel,
                EditorChrome.actionRow(
                        EditorChrome.styledButton("Abbrechen", "compact", "neutral-action",
                                () -> publish(false, false, false, true, false)),
                        EditorChrome.styledButton("Wirklich loeschen", "compact", "danger-action",
                                () -> publish(false, false, false, false, true))));
        VBox body = new VBox(
                10,
                EditorChrome.formGrid(nameField, playerNameField, levelField, passivePerceptionField, armorClassField),
                revealDeleteButton,
                deleteSection,
                EditorChrome.actionRow(cancelButton, submitButton));
        getChildren().addAll(titleLabel, body);
        setFillWidth(true);
        setVisible(false);
        setManaged(false);
        draftBinder.updateSubmitDisabled();
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
        boolean actionsDisabled = content != null && content.actionsDisabled();
        updateEditorFrame(visible, editingExisting);
        draftBinder.updateDraftFields(content);
        updateDeleteConfirmation(content, visible);
        draftBinder.updateEditorDisabled(actionsDisabled);
    }

    private void updateEditorFrame(boolean visible, boolean editingExisting) {
        setVisible(visible);
        setManaged(visible);
        titleLabel.setText(editingExisting ? "Charakter bearbeiten" : "Neuer Charakter");
        submitButton.setText(editingExisting ? "Speichern" : "Erstellen");
        revealDeleteButton.setVisible(visible && editingExisting);
        revealDeleteButton.setManaged(visible && editingExisting);
    }

    private void updateDeleteConfirmation(PartyEditorTopBarContentModel.EditorPanelModel content, boolean visible) {
        deleteMessageLabel.setText("\"" + EditorChrome.safe(content == null ? "" : content.deleteTargetName()).trim()
                + "\" wirklich dauerhaft loeschen?");
        boolean confirmationVisible = content != null && content.deleteConfirmationVisible();
        deleteSection.setVisible(visible && confirmationVisible);
        deleteSection.setManaged(visible && confirmationVisible);
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
                draftBinder.rawDraft()));
    }

    private final class EditorDraftBinder {

        private final ChangeListener<String> draftListener = (ignored, before, after) -> onDraftChanged();

        private void installDraftListeners() {
            addDraftListeners();
            nameField.setOnAction(event -> publish(false, true, false, false, false));
            playerNameField.setOnAction(event -> publish(false, true, false, false, false));
            levelField.setOnAction(event -> publish(false, true, false, false, false));
            passivePerceptionField.setOnAction(event -> publish(false, true, false, false, false));
            armorClassField.setOnAction(event -> publish(false, true, false, false, false));
        }

        private void updateDraftFields(PartyEditorTopBarContentModel.EditorPanelModel content) {
            removeDraftListeners();
            try {
                nameField.setText(content == null ? "" : content.memberName());
                playerNameField.setText(content == null ? "" : content.playerName());
                levelField.setText(content == null ? "1" : content.rawLevel());
                passivePerceptionField.setText(content == null ? "10" : content.rawPassivePerception());
                armorClassField.setText(content == null ? "10" : content.rawArmorClass());
            } finally {
                addDraftListeners();
            }
        }

        private void updateEditorDisabled(boolean actionsDisabled) {
            nameField.setDisable(actionsDisabled);
            playerNameField.setDisable(actionsDisabled);
            levelField.setDisable(actionsDisabled);
            passivePerceptionField.setDisable(actionsDisabled);
            armorClassField.setDisable(actionsDisabled);
            revealDeleteButton.setDisable(actionsDisabled);
            cancelButton.setDisable(actionsDisabled);
            deleteSection.setDisable(actionsDisabled);
            updateSubmitDisabled(actionsDisabled);
        }

        private PartyEditorTopBarViewInputEvent.EditorDraft rawDraft() {
            return new PartyEditorTopBarViewInputEvent.EditorDraft(
                    nameField.getText(),
                    playerNameField.getText(),
                    levelField.getText(),
                    passivePerceptionField.getText(),
                    armorClassField.getText());
        }

        private void onDraftChanged() {
            updateSubmitDisabled();
            publish(false, false, false, false, false);
        }

        private void updateSubmitDisabled() {
            updateSubmitDisabled(false);
        }

        private void updateSubmitDisabled(boolean actionsDisabled) {
            boolean nameMissing = EditorChrome.safe(nameField.getText()).isBlank();
            submitButton.setDisable(nameMissing || actionsDisabled);
            submitButton.setTooltip(nameMissing ? new Tooltip("Charaktername erforderlich.") : null);
        }

        private void addDraftListeners() {
            nameField.textProperty().addListener(draftListener);
            playerNameField.textProperty().addListener(draftListener);
            levelField.textProperty().addListener(draftListener);
            passivePerceptionField.textProperty().addListener(draftListener);
            armorClassField.textProperty().addListener(draftListener);
        }

        private void removeDraftListeners() {
            nameField.textProperty().removeListener(draftListener);
            playerNameField.textProperty().removeListener(draftListener);
            levelField.textProperty().removeListener(draftListener);
            passivePerceptionField.textProperty().removeListener(draftListener);
            armorClassField.textProperty().removeListener(draftListener);
        }
    }

    private static final class EditorChrome {

        private static GridPane formGrid(
                TextField nameField,
                TextField playerNameField,
                TextField levelField,
                TextField passivePerceptionField,
                TextField armorClassField
        ) {
            GridPane form = new StyledGridPane("party-editor-form");
            addRow(form, 0, "Charakter *", nameField);
            addRow(form, 1, "Spieler", playerNameField);
            addRow(form, 2, "Level", levelField);
            addRow(form, 3, "Passive Perception", passivePerceptionField);
            addRow(form, 4, "AC", armorClassField);
            return form;
        }

        private static void addRow(GridPane form, int row, String labelText, TextField field) {
            Label label = new StyledLabel(labelText, "text-muted");
            label.setLabelFor(field);
            form.add(label, 0, row);
            form.add(field, 1, row);
            GridPane.setHgrow(field, Priority.ALWAYS);
        }

        private static HBox actionRow(Node... children) {
            HBox row = new HBox(8, children);
            row.setAlignment(Pos.CENTER_RIGHT);
            return row;
        }

        private static Button styledButton(String text, String primaryStyle, String secondaryStyle, Runnable action) {
            Button button = new StyledButton(text, primaryStyle, secondaryStyle);
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

    private static final class StyledLabel extends Label {

        private StyledLabel(String styleClass) {
            getStyleClass().add(styleClass);
        }

        private StyledLabel(String text, String styleClass) {
            super(text);
            getStyleClass().add(styleClass);
        }
    }

    private static final class StyledButton extends Button {

        private StyledButton(String text, String... styleClasses) {
            super(text);
            getStyleClass().addAll(styleClasses);
        }
    }

    private static final class StyledGridPane extends GridPane {

        private StyledGridPane(String styleClass) {
            getStyleClass().add(styleClass);
        }
    }

    private static final class StyledVBox extends VBox {

        private StyledVBox(double spacing, String styleClass) {
            super(spacing);
            getStyleClass().add(styleClass);
        }

        private void addNodes(Node... nodes) {
            getChildren().addAll(nodes);
        }
    }
}
