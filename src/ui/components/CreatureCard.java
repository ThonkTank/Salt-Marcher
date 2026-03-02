package ui.components;

import entities.Creature;
import ui.ThemeColors;
import ui.components.StatBlockView;
import javafx.geometry.Pos;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.VBox;
import javafx.scene.paint.Color;
import services.EncounterGenerator;
import services.EncounterGenerator.EncounterSlot;
import services.RoleClassifier;
import services.RoleClassifier.MonsterRole;

public class CreatureCard extends HBox {

    private final Label countLabel;
    private final EncounterSlot slot;

    public CreatureCard(EncounterSlot slot, Runnable onCountChanged, Runnable onRemove) {
        this.slot = slot;
        getStyleClass().add("creature-card");
        setSpacing(8);
        setAlignment(Pos.CENTER_LEFT);
        setMaxHeight(56);

        Creature c = slot.creature;

        // LEFT: [-] count [+]
        Button minusBtn = new Button("\u2212");
        minusBtn.getStyleClass().add("compact");
        countLabel = new Label(String.valueOf(slot.count));
        countLabel.getStyleClass().add("bold");
        countLabel.setMinWidth(24);
        countLabel.setAlignment(Pos.CENTER);
        Button plusBtn = new Button("+");
        plusBtn.getStyleClass().add("compact");

        HBox qtyBox = new HBox(2, minusBtn, countLabel, plusBtn);
        qtyBox.setAlignment(Pos.CENTER);

        // CENTER: Name + detail
        Label nameLabel = new Label(c.Name);
        nameLabel.getStyleClass().add("creature-link");
        nameLabel.setOnMouseClicked(e -> showStatBlock(c));

        MonsterRole role = slot.role != null ? slot.role : RoleClassifier.classify(c);
        String detail = "CR " + c.CR + "  |  " + c.XP + " XP";
        if (c.CreatureType != null && !c.CreatureType.isBlank()) {
            detail += "  |  " + c.CreatureType;
        }
        Label detailLabel = new Label(detail);
        detailLabel.getStyleClass().add("text-secondary");

        Label roleBadge = new Label(role.name());
        roleBadge.getStyleClass().add("small");
        Color roleColor = ThemeColors.colorForRole(role.name());
        roleBadge.setTextFill(roleColor);
        roleBadge.setStyle("-fx-border-color: " + toHex(roleColor)
                + "; -fx-border-radius: 2; -fx-padding: 0 3 0 3;");

        HBox detailRow = new HBox(4, detailLabel, roleBadge);
        detailRow.setAlignment(Pos.CENTER_LEFT);

        VBox infoBox = new VBox(2, nameLabel, detailRow);
        HBox.setHgrow(infoBox, Priority.ALWAYS);

        // RIGHT: Remove
        Button removeBtn = new Button("\u00d7");
        removeBtn.getStyleClass().addAll("compact", "remove-btn");

        getChildren().addAll(qtyBox, infoBox, removeBtn);

        // Wiring
        minusBtn.setOnAction(e -> {
            if (slot.count > 1) {
                slot.count--;
                countLabel.setText(String.valueOf(slot.count));
                if (onCountChanged != null) onCountChanged.run();
            }
        });
        plusBtn.setOnAction(e -> {
            if (slot.count < EncounterGenerator.MAX_CREATURES_PER_SLOT) {
                slot.count++;
                countLabel.setText(String.valueOf(slot.count));
                if (onCountChanged != null) onCountChanged.run();
            }
        });
        removeBtn.setOnAction(e -> { if (onRemove != null) onRemove.run(); });
    }

    public void refreshCount() {
        countLabel.setText(String.valueOf(slot.count));
    }

    private void showStatBlock(Creature c) {
        StatBlockView.showAsync(c.Id, getScene().getWindow());
    }

    private static String toHex(Color c) {
        return String.format("#%02x%02x%02x",
                (int)(c.getRed()*255), (int)(c.getGreen()*255), (int)(c.getBlue()*255));
    }
}
