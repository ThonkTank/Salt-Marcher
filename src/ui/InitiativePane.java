package ui;

import entities.PlayerCharacter;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.control.TextField;
import javafx.scene.control.TextFormatter;
import javafx.application.Platform;
import javafx.scene.layout.*;

import java.util.ArrayList;
import java.util.List;
import java.util.function.Consumer;

/**
 * Inline initiative input pane that replaces the modal InitiativeDialog.
 * Displayed in the inspector's context section before combat starts.
 */
public class InitiativePane extends VBox {

    private static final int DEFAULT_INITIATIVE = 10;

    private final List<TextField> fields = new ArrayList<>();
    private Consumer<List<Integer>> onConfirm;
    private Runnable onCancel;

    public InitiativePane(List<PlayerCharacter> party) {
        setSpacing(8);
        setPadding(new Insets(8));
        setAlignment(Pos.TOP_LEFT);

        Label title = new Label("Initiative eintragen");
        title.getStyleClass().add("title");

        Label hint = new Label("Wuerfelt Initiative fuer eure PCs!");
        hint.getStyleClass().add("text-secondary");
        hint.setWrapText(true);

        getChildren().addAll(title, hint);

        // One row per PC: name + level label + initiative TextField
        for (PlayerCharacter pc : party) {
            HBox row = new HBox(8);
            row.setAlignment(Pos.CENTER_LEFT);

            Label nameLabel = new Label(pc.Name + " (Lv." + pc.Level + "):");
            nameLabel.setMinWidth(150);
            nameLabel.getStyleClass().add("bold");

            TextField initField = new TextField(String.valueOf(DEFAULT_INITIATIVE));
            initField.setPrefWidth(60);
            initField.setAlignment(Pos.CENTER);
            // Only allow digits and minus sign; prevents silent default-value substitution.
            initField.setTextFormatter(new TextFormatter<>(change ->
                change.getText().matches("[0-9-]*") ? change : null));
            nameLabel.setLabelFor(initField);

            fields.add(initField);
            row.getChildren().addAll(nameLabel, initField);
            getChildren().add(row);
        }

        Label monsterHint = new Label("Monster-Initiative wird automatisch gewuerfelt.");
        monsterHint.getStyleClass().add("text-muted");
        monsterHint.setPadding(new Insets(8, 0, 0, 0));

        Region spacer = new Region();
        VBox.setVgrow(spacer, Priority.ALWAYS);

        Button cancelBtn = new Button("Abbrechen");
        Button startBtn = new Button("Kampf starten");
        startBtn.getStyleClass().add("accent");

        HBox buttons = new HBox(8, cancelBtn, startBtn);
        buttons.setAlignment(Pos.CENTER_RIGHT);

        getChildren().addAll(monsterHint, spacer, buttons);

        // Wiring
        cancelBtn.setOnAction(e -> { if (onCancel != null) onCancel.run(); });
        startBtn.setOnAction(e -> confirm());

        // Tab through fields, Enter on last field = confirm
        for (int i = 0; i < fields.size(); i++) {
            final int idx = i;
            fields.get(i).setOnAction(e -> {
                if (idx < fields.size() - 1) {
                    fields.get(idx + 1).requestFocus();
                } else {
                    confirm();
                }
            });
        }

        // Auto-focus first field
        if (!fields.isEmpty()) {
            Platform.runLater(() -> fields.get(0).requestFocus());
        }
    }

    public void setOnConfirm(Consumer<List<Integer>> callback) { this.onConfirm = callback; }
    public void setOnCancel(Runnable callback) { this.onCancel = callback; }

    private void confirm() {
        List<Integer> initiatives = new ArrayList<>();
        for (TextField field : fields) {
            try {
                initiatives.add(Integer.parseInt(field.getText().trim()));
            } catch (NumberFormatException e) {
                initiatives.add(DEFAULT_INITIATIVE);
            }
        }
        if (onConfirm != null) onConfirm.accept(initiatives);
    }
}
