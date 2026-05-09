package src.view.dropdowns.party;

import java.util.function.Consumer;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.control.TextField;
import javafx.scene.control.TextFormatter;
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

    private final Label titleLabel = new PanelTitleLabel();
    private final EditorFields fields = new EditorFields(this::submit, this::onDraftChanged);
    private final DeleteButton revealDeleteButton = new DeleteButton(() -> publish(false, false, true, false, false));
    private final DeleteSection deleteSection = new DeleteSection(
            () -> publish(false, false, false, true, false),
            () -> publish(false, false, false, false, true));
    private final Button cancelButton = new Button("Abbrechen");
    private final Button submitButton = new Button("Speichern");
    private Consumer<PartyEditorTopBarViewInputEvent> viewInputEventHandler = ignored -> { };
    private boolean syncingFromModel;

    public PartyEditorTopBarView() {
        getStyleClass().addAll("dropdown-window", "dropdown-form", "party-editor-inline");
        setPadding(new Insets(10));
        setSpacing(10);
        cancelButton.setOnAction(event -> publish(true, false, false, false, false));
        submitButton.setOnAction(event -> submit());

        VBox body = new VBox(10, new FormGrid(fields), revealDeleteButton, deleteSection, new ActionRow(cancelButton, submitButton));
        getChildren().addAll(titleLabel, body);
        setFillWidth(true);
        setVisible(false);
        setManaged(false);
        revealDeleteButton.showWhen(false);
        deleteSection.showConfirmation("", false);
        updateSubmitDisabled();
    }

    public void showEditor(PartyTopBarContributionModel.EditorPanelModel content) {
        if (content == null || !content.visible()) {
            setVisible(false);
            setManaged(false);
            revealDeleteButton.showWhen(false);
            deleteSection.showConfirmation("", false);
            return;
        }
        setVisible(true);
        setManaged(true);
        titleLabel.setText(content.editingExisting() ? "Charakter bearbeiten" : "Neuer Charakter");
        submitButton.setText(content.editingExisting() ? "Speichern" : "Erstellen");
        revealDeleteButton.showWhen(content.editingExisting());
        syncingFromModel = true;
        try {
            fields.populate(content);
        } finally {
            syncingFromModel = false;
        }
        deleteSection.showConfirmation(safe(fields.nameField.getText()).trim(), content.deleteConfirmationVisible());
        updateSubmitDisabled();
    }

    public void onViewInputEvent(Consumer<PartyEditorTopBarViewInputEvent> handler) {
        viewInputEventHandler = handler == null ? ignored -> { } : handler;
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
                new PartyEditorTopBarViewInputEvent.EditorDraft(
                        fields.nameField.getText(),
                        fields.playerNameField.getText(),
                        fields.levelField.getText(),
                        fields.passivePerceptionField.getText(),
                        fields.armorClassField.getText())));
    }

    private void updateSubmitDisabled() {
        submitButton.setDisable(fields.nameBlank());
    }

    private void onDraftChanged() {
        updateSubmitDisabled();
        deleteSection.showConfirmation(safe(fields.nameField.getText()).trim(), deleteSection.isVisible());
        if (!syncingFromModel) {
            publish(false, false, false, false, false);
        }
    }

    private static String safe(String value) {
        return value == null ? "" : value;
    }

    private static final class PanelTitleLabel extends Label {

        private PanelTitleLabel() {
            getStyleClass().add("panel-title");
        }
    }

    private static final class DeleteButton extends Button {

        private DeleteButton(Runnable action) {
            super("Löschen");
            getStyleClass().addAll("compact", "danger-action");
            setMaxWidth(Double.MAX_VALUE);
            setOnAction(event -> action.run());
        }

        private void showWhen(boolean visible) {
            setVisible(visible);
            setManaged(visible);
        }
    }

    private static final class DeleteSection extends VBox {

        private final Label messageLabel = new DeleteMessageLabel();

        private DeleteSection(Runnable onCancel, Runnable onConfirm) {
            super(8);
            getStyleClass().add("party-editor-delete-section");
            getChildren().addAll(
                    messageLabel,
                    new ActionRow(
                            new StyledButton("Abbrechen", "compact", "neutral-action", onCancel),
                            new StyledButton("Wirklich löschen", "compact", "danger-action", onConfirm)));
        }

        private void showConfirmation(String memberName, boolean visible) {
            messageLabel.setText("\"" + safe(memberName) + "\" wirklich dauerhaft löschen?");
            setVisible(visible);
            setManaged(visible);
        }
    }

    private static final class DeleteMessageLabel extends Label {

        private DeleteMessageLabel() {
            getStyleClass().add("dropdown-message");
            setWrapText(true);
        }
    }

    private static final class ActionRow extends HBox {

        private ActionRow(Node... children) {
            super(8, children);
            setAlignment(Pos.CENTER_RIGHT);
        }
    }

    private static final class FormGrid extends GridPane {

        private FormGrid(EditorFields fields) {
            getStyleClass().add("party-editor-form");
            setHgap(10);
            setVgap(8);
            addRow(0, "Charakter", fields.nameField);
            addRow(1, "Spieler", fields.playerNameField);
            addRow(2, "Level", fields.levelField);
            addRow(3, "Passive Perception", fields.passivePerceptionField);
            addRow(4, "AC", fields.armorClassField);
        }

        private void addRow(int row, String labelText, TextField field) {
            add(new FormLabel(labelText, field), 0, row);
            add(field, 1, row);
            setHgrow(field, Priority.ALWAYS);
        }
    }

    private static final class FormLabel extends Label {

        private FormLabel(String text, TextField field) {
            super(text);
            getStyleClass().add("text-muted");
            setLabelFor(field);
        }
    }

    private static final class EditorFields {

        private final TextField nameField = new PromptField(CHARACTER_NAME_PROMPT);
        private final TextField playerNameField = new PromptField(PLAYER_NAME_PROMPT);
        private final TextField levelField = new IntegerField(LEVEL_PROMPT);
        private final TextField passivePerceptionField = new IntegerField(PASSIVE_PERCEPTION_PROMPT);
        private final TextField armorClassField = new IntegerField(ARMOR_CLASS_PROMPT);

        private EditorFields(Runnable onSubmit, Runnable onDraftChanged) {
            bindSubmit(nameField, onSubmit);
            bindSubmit(playerNameField, onSubmit);
            bindSubmit(levelField, onSubmit);
            bindSubmit(passivePerceptionField, onSubmit);
            bindSubmit(armorClassField, onSubmit);
            nameField.textProperty().addListener((ignored, before, after) -> onDraftChanged.run());
            playerNameField.textProperty().addListener((ignored, before, after) -> onDraftChanged.run());
            levelField.textProperty().addListener((ignored, before, after) -> onDraftChanged.run());
            passivePerceptionField.textProperty().addListener((ignored, before, after) -> onDraftChanged.run());
            armorClassField.textProperty().addListener((ignored, before, after) -> onDraftChanged.run());
        }

        private boolean nameBlank() {
            return safe(nameField.getText()).isBlank();
        }

        private void populate(PartyTopBarContributionModel.EditorPanelModel content) {
            nameField.setText(content.memberName());
            playerNameField.setText(content.playerName());
            levelField.setText(content.rawLevel());
            passivePerceptionField.setText(content.rawPassivePerception());
            armorClassField.setText(content.rawArmorClass());
        }

        private static void bindSubmit(TextField field, Runnable onSubmit) {
            field.setOnAction(event -> onSubmit.run());
        }
    }

    private static class PromptField extends TextField {

        private PromptField(String promptText) {
            setPromptText(promptText);
        }
    }

    private static final class IntegerField extends PromptField {

        private IntegerField(String promptText) {
            super(promptText);
            setTextFormatter(new TextFormatter<>(change -> change.getText().matches("[0-9]*") ? change : null));
        }
    }

    private static final class StyledButton extends Button {

        private StyledButton(String text, String primaryStyle, String secondaryStyle, Runnable action) {
            super(text);
            getStyleClass().addAll(primaryStyle, secondaryStyle);
            setOnAction(event -> action.run());
        }
    }
}
