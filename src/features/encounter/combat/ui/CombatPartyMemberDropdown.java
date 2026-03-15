package features.encounter.combat.ui;

import features.encounter.combat.model.PartyCombatantCandidate;
import javafx.application.Platform;
import javafx.geometry.Bounds;
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
import javafx.stage.Popup;

import java.util.List;
import java.util.Objects;
import java.util.function.BiConsumer;

final class CombatPartyMemberDropdown {
    private final Popup popup = new Popup();

    CombatPartyMemberDropdown() {
        popup.setAutoHide(true);
        popup.setHideOnEscape(true);
    }

    void show(
            Node anchor,
            List<PartyCombatantCandidate> candidates,
            BiConsumer<PartyCombatantCandidate, Integer> onAdd
    ) {
        Objects.requireNonNull(anchor, "anchor");
        Objects.requireNonNull(onAdd, "onAdd");
        popup.hide();
        popup.getContent().clear();

        VBox list = new VBox(6);
        list.getStyleClass().add("edit-popup-panel");
        list.setPadding(new Insets(8));

        TextField firstField = null;
        for (PartyCombatantCandidate candidate : candidates) {
            HBox row = new HBox(6);
            row.setAlignment(Pos.CENTER_LEFT);

            Label name = new Label(candidate.displayName() + " (Lv." + candidate.level() + ")");
            name.getStyleClass().add("combat-name");

            int[] initiativeValue = {10};
            SpinnerParts spinner = buildSpinner(10, initiativeValue);
            spinner.field().setPrefWidth(48);
            spinner.field().setAccessibleText("Initiative für " + candidate.displayName());

            Button addButton = new Button("Hinzufügen");
            addButton.getStyleClass().add("accent");

            row.getChildren().addAll(name, spinner.dec(), spinner.field(), spinner.inc(), addButton);
            HBox.setHgrow(name, Priority.ALWAYS);
            list.getChildren().add(row);

            Runnable apply = () -> {
                popup.hide();
                onAdd.accept(candidate, parseOrDefault(spinner.field().getText(), initiativeValue[0]));
            };
            addButton.setOnAction(e -> apply.run());
            spinner.field().setOnAction(e -> apply.run());
            if (firstField == null) {
                firstField = spinner.field();
            }
        }

        popup.getContent().add(list);
        popup.setOnHidden(e -> anchor.requestFocus());
        Bounds bounds = anchor.localToScreen(anchor.getBoundsInLocal());
        if (bounds != null) {
            popup.show(anchor, bounds.getMinX(), bounds.getMaxY() + 8);
            if (firstField != null) {
                TextField focusField = firstField;
                Platform.runLater(focusField::requestFocus);
            }
        }
    }

    private SpinnerParts buildSpinner(int initial, int[] value) {
        TextField field = new TextField(String.valueOf(initial));
        field.getStyleClass().add("quick-search-field");
        field.setTextFormatter(new TextFormatter<>(change -> change.getText().matches("[0-9-]*") ? change : null));

        Button dec = new Button("\u25BC");
        Button inc = new Button("\u25B2");
        dec.getStyleClass().add("spinner-btn");
        inc.getStyleClass().add("spinner-btn");
        dec.setFocusTraversable(false);
        inc.setFocusTraversable(false);

        dec.setOnAction(e -> {
            value[0] = parseOrDefault(field.getText(), value[0]) - 1;
            field.setText(String.valueOf(value[0]));
        });
        inc.setOnAction(e -> {
            value[0] = parseOrDefault(field.getText(), value[0]) + 1;
            field.setText(String.valueOf(value[0]));
        });

        return new SpinnerParts(dec, field, inc);
    }

    private int parseOrDefault(String text, int def) {
        try {
            return Integer.parseInt(text.trim());
        } catch (NumberFormatException e) {
            return def;
        }
    }

    private record SpinnerParts(Button dec, TextField field, Button inc) {}
}
