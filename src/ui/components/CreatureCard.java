package ui.components;

import entities.Creature;
import javafx.geometry.Pos;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.VBox;
import services.EncounterGenerator;
import services.EncounterGenerator.EncounterSlot;
import services.RoleClassifier;
import services.RoleClassifier.MonsterRole;

import java.util.function.Consumer;

public class CreatureCard extends VBox {

    private final Label countLabel;
    private final EncounterSlot slot;
    private Consumer<Long> onRequestStatBlock;

    public CreatureCard(EncounterSlot slot, Runnable onCountChanged, Runnable onRemove) {
        this.slot = slot;
        getStyleClass().add("creature-card");
        setSpacing(0);

        Creature c = slot.creature;

        // ---- Summary Row (top part) ----
        HBox summary = new HBox(8);
        summary.setAlignment(Pos.CENTER_LEFT);

        // LEFT: [-] count [+]
        Button minusBtn = new Button("\u2212");
        minusBtn.getStyleClass().add("compact");
        minusBtn.setAccessibleText("Weniger " + c.Name);
        countLabel = new Label(String.valueOf(slot.count));
        countLabel.getStyleClass().add("bold");
        countLabel.setMinWidth(24);
        countLabel.setAlignment(Pos.CENTER);
        Button plusBtn = new Button("+");
        plusBtn.getStyleClass().add("compact");
        plusBtn.setAccessibleText("Mehr " + c.Name);

        HBox qtyBox = new HBox(2, minusBtn, countLabel, plusBtn);
        qtyBox.setAlignment(Pos.CENTER);

        // CENTER: Name + detail
        Label nameLabel = new Label(c.Name);
        nameLabel.getStyleClass().add("creature-link");
        nameLabel.setFocusTraversable(true);
        nameLabel.setOnMouseClicked(e -> fireStatBlockRequest());
        nameLabel.setOnKeyPressed(e -> {
            if (e.getCode() == javafx.scene.input.KeyCode.ENTER
                    || e.getCode() == javafx.scene.input.KeyCode.SPACE) {
                fireStatBlockRequest();
                e.consume();
            }
        });

        MonsterRole role = slot.role != null ? slot.role : RoleClassifier.classify(c);
        String detail = "CR " + c.CR + "  |  " + c.XP + " XP";
        if (c.CreatureType != null && !c.CreatureType.isBlank()) {
            detail += "  |  " + c.CreatureType;
        }
        Label detailLabel = new Label(detail);
        detailLabel.getStyleClass().add("text-secondary");

        Label roleBadge = new Label(role.name());
        roleBadge.getStyleClass().addAll("small", "role-badge", "role-" + role.name().toLowerCase());

        HBox detailRow = new HBox(4, detailLabel, roleBadge);
        detailRow.setAlignment(Pos.CENTER_LEFT);

        // Stat block link
        Label expandArrow = new Label("\u25BC");
        expandArrow.getStyleClass().addAll("text-muted", "clickable");
        expandArrow.setOnMouseClicked(e -> fireStatBlockRequest());
        expandArrow.setAccessibleText("Stat Block anzeigen");

        VBox infoBox = new VBox(2, nameLabel, detailRow);
        HBox.setHgrow(infoBox, Priority.ALWAYS);

        // RIGHT: Expand + Remove
        Button removeBtn = new Button("\u00d7");
        removeBtn.getStyleClass().addAll("compact", "remove-btn");
        removeBtn.setAccessibleText("Entfernen: " + c.Name);

        VBox rightBox = new VBox(4, expandArrow, removeBtn);
        rightBox.setAlignment(Pos.CENTER_RIGHT);

        summary.getChildren().addAll(qtyBox, infoBox, rightBox);

        getChildren().add(summary);

        // Wiring
        minusBtn.setOnAction(e -> {
            if (slot.count > 1) {
                slot.count--;
                countLabel.setText(String.valueOf(slot.count));
                onCountChanged.run();
            }
        });
        plusBtn.setOnAction(e -> {
            if (slot.count < EncounterGenerator.MAX_CREATURES_PER_SLOT) {
                slot.count++;
                countLabel.setText(String.valueOf(slot.count));
                onCountChanged.run();
            }
        });
        removeBtn.setOnAction(e -> onRemove.run());
    }

    private void fireStatBlockRequest() {
        if (onRequestStatBlock != null) onRequestStatBlock.accept(slot.creature.Id);
    }

    public void refreshCount() {
        countLabel.setText(String.valueOf(slot.count));
    }

    public void setOnRequestStatBlock(Consumer<Long> callback) {
        this.onRequestStatBlock = callback;
    }
}
