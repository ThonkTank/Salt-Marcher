package src.view.party.View;

import javafx.event.ActionEvent;
import javafx.geometry.Insets;
import javafx.scene.control.ButtonBar;
import javafx.scene.control.ButtonType;
import javafx.scene.control.CheckBox;
import javafx.scene.control.Dialog;
import javafx.scene.control.Label;
import javafx.scene.control.TextField;
import javafx.scene.control.TextFormatter;
import javafx.scene.layout.GridPane;
import javafx.stage.Window;
import src.view.party.interactor.PartyInteractor;

import java.util.Optional;

final class PartyCharacterEditorDialog {

    record CreateRequest(
            PartyInteractor.CharacterDraftInput draft,
            PartyInteractor.MembershipSelection membership
    ) {
    }

    private PartyCharacterEditorDialog() {
    }

    static Optional<CreateRequest> showCreate(Window owner) {
        Dialog<CreateRequest> dialog = new Dialog<>();
        dialog.setTitle("Create Character");
        if (owner != null) {
            dialog.initOwner(owner);
        }

        TextField nameField = new TextField();
        TextField playerField = new TextField();
        TextField levelField = createNumberField("1");
        TextField passivePerceptionField = createNumberField("10");
        TextField armorClassField = createNumberField("10");
        CheckBox activePartyCheck = new CheckBox("Start in active party");
        activePartyCheck.setSelected(true);
        Label errorLabel = buildErrorLabel();

        dialog.getDialogPane().setContent(buildForm(
                nameField,
                playerField,
                levelField,
                passivePerceptionField,
                armorClassField,
                activePartyCheck,
                errorLabel,
                true));

        ButtonType createButton = new ButtonType("Create", ButtonBar.ButtonData.OK_DONE);
        dialog.getDialogPane().getButtonTypes().addAll(createButton, ButtonType.CANCEL);
        attachValidation(dialog, createButton, errorLabel, () -> {
            PartyInteractor.CharacterDraftInput draft = validateDraft(
                    nameField.getText(),
                    playerField.getText(),
                    levelField.getText(),
                    passivePerceptionField.getText(),
                    armorClassField.getText());
            PartyInteractor.MembershipSelection membership = activePartyCheck.isSelected()
                    ? PartyInteractor.MembershipSelection.ACTIVE
                    : PartyInteractor.MembershipSelection.RESERVE;
            return new CreateRequest(draft, membership);
        });

        return dialog.showAndWait();
    }

    static Optional<PartyInteractor.CharacterDraftInput> showEdit(Window owner, PartyInteractor.PartyMemberViewData details) {
        Dialog<PartyInteractor.CharacterDraftInput> dialog = new Dialog<>();
        dialog.setTitle("Edit Character");
        if (owner != null) {
            dialog.initOwner(owner);
        }

        TextField nameField = new TextField(details.name());
        TextField playerField = new TextField(details.playerName());
        TextField levelField = createNumberField(Integer.toString(details.level()));
        TextField passivePerceptionField = createNumberField(Integer.toString(details.passivePerception()));
        TextField armorClassField = createNumberField(Integer.toString(details.armorClass()));
        Label errorLabel = buildErrorLabel();

        dialog.getDialogPane().setContent(buildForm(
                nameField,
                playerField,
                levelField,
                passivePerceptionField,
                armorClassField,
                null,
                errorLabel,
                false));

        ButtonType saveButton = new ButtonType("Save", ButtonBar.ButtonData.OK_DONE);
        dialog.getDialogPane().getButtonTypes().addAll(saveButton, ButtonType.CANCEL);
        attachValidation(dialog, saveButton, errorLabel, () -> validateDraft(
                nameField.getText(),
                playerField.getText(),
                levelField.getText(),
                passivePerceptionField.getText(),
                armorClassField.getText()));

        return dialog.showAndWait();
    }

    private static GridPane buildForm(
            TextField nameField,
            TextField playerField,
            TextField levelField,
            TextField passivePerceptionField,
            TextField armorClassField,
            CheckBox activePartyCheck,
            Label errorLabel,
            boolean includeMembership
    ) {
        nameField.setPromptText("Name");
        playerField.setPromptText("Player");
        levelField.setPromptText("Level");
        passivePerceptionField.setPromptText("Passive Perception");
        armorClassField.setPromptText("AC");

        GridPane grid = new GridPane();
        grid.setHgap(10);
        grid.setVgap(8);
        grid.setPadding(new Insets(12));

        addRow(grid, 0, "Name", nameField);
        addRow(grid, 1, "Player", playerField);
        addRow(grid, 2, "Level", levelField);
        addRow(grid, 3, "Passive Perception", passivePerceptionField);
        addRow(grid, 4, "AC", armorClassField);
        int row = 5;
        if (includeMembership && activePartyCheck != null) {
            grid.add(activePartyCheck, 1, row++);
        }
        grid.add(errorLabel, 0, row, 2, 1);
        return grid;
    }

    private static void addRow(GridPane grid, int row, String labelText, TextField field) {
        Label label = new Label(labelText);
        grid.add(label, 0, row);
        grid.add(field, 1, row);
    }

    private static TextField createNumberField(String initialValue) {
        TextField field = new TextField(initialValue);
        field.setTextFormatter(new TextFormatter<>(change -> change.getText().matches("[0-9]*") ? change : null));
        return field;
    }

    private static Label buildErrorLabel() {
        Label errorLabel = new Label();
        errorLabel.setStyle("-fx-text-fill: #9a1b1b;");
        errorLabel.setWrapText(true);
        return errorLabel;
    }

    private static <T> void attachValidation(
            Dialog<T> dialog,
            ButtonType submitButton,
            Label errorLabel,
            ThrowingSupplier<T> valueSupplier
    ) {
        dialog.setResultConverter(buttonType -> buttonType == submitButton ? valueSupplier.getOrNull() : null);
        dialog.getDialogPane().lookupButton(submitButton).addEventFilter(ActionEvent.ACTION, event -> {
            try {
                T value = valueSupplier.get();
                dialog.setResult(value);
            } catch (IllegalArgumentException exception) {
                errorLabel.setText(exception.getMessage());
                event.consume();
            }
        });
    }

    private static PartyInteractor.CharacterDraftInput validateDraft(
            String name,
            String playerName,
            String levelText,
            String passivePerceptionText,
            String armorClassText
    ) {
        String safeName = name == null ? "" : name.trim();
        if (safeName.isEmpty()) {
            throw new IllegalArgumentException("Character name is required.");
        }
        int level = parseBoundedInteger(levelText, "Level", 1, 20);
        int passivePerception = parseBoundedInteger(passivePerceptionText, "Passive Perception", 1, 99);
        int armorClass = parseBoundedInteger(armorClassText, "AC", 1, 99);
        return new PartyInteractor.CharacterDraftInput(
                safeName,
                playerName == null ? "" : playerName.trim(),
                level,
                passivePerception,
                armorClass);
    }

    private static int parseBoundedInteger(String rawValue, String label, int min, int max) {
        String trimmed = rawValue == null ? "" : rawValue.trim();
        if (trimmed.isEmpty()) {
            throw new IllegalArgumentException(label + " is required.");
        }
        try {
            int value = Integer.parseInt(trimmed);
            if (value < min || value > max) {
                throw new IllegalArgumentException(label + " must be between " + min + " and " + max + ".");
            }
            return value;
        } catch (NumberFormatException exception) {
            throw new IllegalArgumentException(label + " must be a number.");
        }
    }

    @FunctionalInterface
    private interface ThrowingSupplier<T> {
        T get();

        default T getOrNull() {
            try {
                return get();
            } catch (IllegalArgumentException exception) {
                return null;
            }
        }
    }
}
