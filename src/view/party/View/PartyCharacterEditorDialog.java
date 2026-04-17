package src.view.party.View;

import org.jspecify.annotations.Nullable;
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

    private record FormFields(
            TextField nameField,
            TextField playerField,
            TextField levelField,
            TextField passivePerceptionField,
            TextField armorClassField,
            @Nullable CheckBox activePartyCheck,
            Label errorLabel
    ) {
    }

    record CreateRequest(
            PartyInteractor.CharacterDraftInput draft,
            PartyInteractor.MembershipSelection membership
    ) {
    }

    private PartyCharacterEditorDialog() {
    }

    static Optional<CreateRequest> showCreate(@Nullable Window owner) {
        Dialog<CreateRequest> dialog = new Dialog<>();
        dialog.setTitle("Create Character");
        if (owner != null) {
            dialog.initOwner(owner);
        }

        FormFields fields = new FormFields(
                new TextField(),
                new TextField(),
                createNumberField("1"),
                createNumberField("10"),
                createNumberField("10"),
                new CheckBox("Start in active party"),
                buildErrorLabel());
        CheckBox membershipCheck = java.util.Objects.requireNonNull(fields.activePartyCheck());
        membershipCheck.setSelected(true);

        dialog.getDialogPane().setContent(buildForm(fields, true));

        ButtonType createButton = new ButtonType("Create", ButtonBar.ButtonData.OK_DONE);
        dialog.getDialogPane().getButtonTypes().addAll(createButton, ButtonType.CANCEL);
        attachValidation(dialog, createButton, fields.errorLabel(), () -> {
            PartyInteractor.CharacterDraftInput draft = validateDraft(
                    fields.nameField().getText(),
                    fields.playerField().getText(),
                    fields.levelField().getText(),
                    fields.passivePerceptionField().getText(),
                    fields.armorClassField().getText());
            PartyInteractor.MembershipSelection membership = membershipCheck.isSelected()
                    ? PartyInteractor.MembershipSelection.ACTIVE
                    : PartyInteractor.MembershipSelection.RESERVE;
            return new CreateRequest(draft, membership);
        });

        return dialog.showAndWait();
    }

    static Optional<PartyInteractor.CharacterDraftInput> showEdit(@Nullable Window owner, PartyInteractor.PartyMemberViewData details) {
        Dialog<PartyInteractor.CharacterDraftInput> dialog = new Dialog<>();
        dialog.setTitle("Edit Character");
        if (owner != null) {
            dialog.initOwner(owner);
        }

        FormFields fields = new FormFields(
                new TextField(details.name()),
                new TextField(details.playerName()),
                createNumberField(Integer.toString(details.level())),
                createNumberField(Integer.toString(details.passivePerception())),
                createNumberField(Integer.toString(details.armorClass())),
                null,
                buildErrorLabel());

        dialog.getDialogPane().setContent(buildForm(fields, false));

        ButtonType saveButton = new ButtonType("Save", ButtonBar.ButtonData.OK_DONE);
        dialog.getDialogPane().getButtonTypes().addAll(saveButton, ButtonType.CANCEL);
        attachValidation(dialog, saveButton, fields.errorLabel(), () -> validateDraft(
                fields.nameField().getText(),
                fields.playerField().getText(),
                fields.levelField().getText(),
                fields.passivePerceptionField().getText(),
                fields.armorClassField().getText()));

        return dialog.showAndWait();
    }

    private static GridPane buildForm(FormFields fields, boolean includeMembership) {
        fields.nameField().setPromptText("Name");
        fields.playerField().setPromptText("Player");
        fields.levelField().setPromptText("Level");
        fields.passivePerceptionField().setPromptText("Passive Perception");
        fields.armorClassField().setPromptText("AC");

        GridPane grid = new GridPane();
        grid.setHgap(10);
        grid.setVgap(8);
        grid.setPadding(new Insets(12));

        addRow(grid, 0, "Name", fields.nameField());
        addRow(grid, 1, "Player", fields.playerField());
        addRow(grid, 2, "Level", fields.levelField());
        addRow(grid, 3, "Passive Perception", fields.passivePerceptionField());
        addRow(grid, 4, "AC", fields.armorClassField());
        int row = 5;
        if (includeMembership && fields.activePartyCheck() != null) {
            grid.add(fields.activePartyCheck(), 1, row++);
        }
        grid.add(fields.errorLabel(), 0, row, 2, 1);
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
        errorLabel.getStyleClass().add("party-error-label");
        errorLabel.setWrapText(true);
        return errorLabel;
    }

    private static <T> void attachValidation(
            Dialog<T> dialog,
            ButtonType submitButton,
            Label errorLabel,
            ThrowingSupplier<T> valueSupplier
    ) {
        dialog.setResultConverter(buttonType -> buttonType == submitButton ? dialog.getResult() : null);
        dialog.getDialogPane().lookupButton(submitButton).addEventFilter(ActionEvent.ACTION, event -> {
            try {
                T value = valueSupplier.get();
                errorLabel.setText("");
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
    }
}
