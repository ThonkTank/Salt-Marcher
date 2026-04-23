package src.view.slotcontent.state.encounter;

import java.util.List;
import java.util.Objects;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.control.TextField;
import javafx.scene.control.TextFormatter;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.VBox;
import src.view.slotcontent.controls.popup.AnchoredPopupView;

public final class EncounterCombatPartyMemberPopupView {

    private final AnchoredPopupView popup = new AnchoredPopupView();

    public EncounterCombatPartyMemberPopupView() {
    }

    public void show(
            Node anchor,
            List<EncounterCombatPartyMemberButtonView.Candidate> candidates,
            EncounterCombatPartyMemberButtonView.AddHandler onAdd
    ) {
        Objects.requireNonNull(anchor, "anchor");
        Objects.requireNonNull(onAdd, "onAdd");
        if (candidates == null || candidates.isEmpty()) {
            return;
        }
        popup.hide();

        VBox list = new VBox(6);
        list.getStyleClass().add("anchored-popup");
        list.setPadding(new Insets(8));

        TextField firstField = null;
        for (EncounterCombatPartyMemberButtonView.Candidate candidate : candidates) {
            TextField initiativeField = initiativeField(candidate.name());
            Button down = spinnerButton("\u25BC");
            Button up = spinnerButton("\u25B2");
            down.setOnAction(event -> initiativeField.setText(String.valueOf(parse(initiativeField.getText()) - 1)));
            up.setOnAction(event -> initiativeField.setText(String.valueOf(parse(initiativeField.getText()) + 1)));

            Button add = new Button("Hinzufuegen");
            add.getStyleClass().add("accent");
            Runnable apply = () -> {
                popup.hide();
                onAdd.add(candidate.memberId(), parse(initiativeField.getText()));
            };
            add.setOnAction(event -> apply.run());
            initiativeField.setOnAction(event -> apply.run());

            Label name = new Label(candidate.name() + " (Lv. " + candidate.level() + ")");
            name.getStyleClass().add("combat-name");
            HBox.setHgrow(name, Priority.ALWAYS);

            HBox row = new HBox(6, name, down, initiativeField, up, add);
            row.setAlignment(Pos.CENTER_LEFT);
            list.getChildren().add(row);
            if (firstField == null) {
                firstField = initiativeField;
            }
        }

        popup.setContent(list);
        popup.showBelow(anchor, 8);
        if (firstField != null) {
            popup.focusAfterShown(firstField);
        }
    }

    private static TextField initiativeField(String name) {
        TextField field = new TextField("10");
        field.getStyleClass().add("text-field");
        field.setPrefWidth(56);
        field.setAccessibleText("Initiative fuer " + name);
        field.setTextFormatter(new TextFormatter<>(change -> change.getText().matches("[0-9-]*") ? change : null));
        return field;
    }

    private static Button spinnerButton(String text) {
        Button button = new Button(text);
        button.getStyleClass().add("spinner-btn");
        button.setFocusTraversable(false);
        return button;
    }

    private static int parse(String text) {
        try {
            return Integer.parseInt(text.trim());
        } catch (NumberFormatException e) {
            return 10;
        }
    }

}
