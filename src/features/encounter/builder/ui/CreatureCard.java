package features.encounter.builder.ui;

import features.creatures.model.Creature;
import features.creatures.model.EncounterFunctionRole;
import features.partyanalysis.model.EncounterWeightClass;
import javafx.geometry.Pos;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.VBox;

import java.util.ArrayList;
import java.util.List;
import java.util.function.Consumer;

/**
 * Purely presentational roster card: shows creature name, CR, role badge,
 * XP contribution, and +/- count controls. Used inside
 * {@link features.encounter.builder.ui.EncounterRosterPane}.
 *
 * <p>Count mutation is owned by the caller: {@code onIncrement} and {@code onDecrement}
 * are responsible for updating their count and calling {@link #updateCount(int)} to sync the label.
 */
public class CreatureCard extends VBox {

    private final Label countLabel;
    private final Creature creature;
    private Consumer<Long> onRequestStatBlock;

    public CreatureCard(Creature c, int initialCount, EncounterWeightClass weightClass,
                        EncounterFunctionRole primaryFunctionRole,
                        Runnable onIncrement, Runnable onDecrement, Runnable onRemove) {
        this.creature = c;
        getStyleClass().add("creature-card");
        setSpacing(0);

        // ---- Summary Row (top part) ----
        HBox summary = new HBox(8);
        summary.setAlignment(Pos.CENTER_LEFT);

        // LEFT: [-] count [+]
        Button minusBtn = new Button("\u2212");
        minusBtn.getStyleClass().add("compact");
        minusBtn.setAccessibleText("Weniger " + c.Name);
        countLabel = new Label(String.valueOf(initialCount));
        countLabel.getStyleClass().add("bold");
        countLabel.setMinWidth(24);
        countLabel.setAlignment(Pos.CENTER);
        Button plusBtn = new Button("+");
        plusBtn.getStyleClass().add("compact");
        plusBtn.setAccessibleText("Mehr " + c.Name);

        HBox qtyBox = new HBox(2, minusBtn, countLabel, plusBtn);
        qtyBox.setAlignment(Pos.CENTER);

        // CENTER: Name + detail
        // Button gives native :focused pseudo-state for proper focus ring (vs. Label+AccessibleRole hack)
        Button nameLabel = new Button(c.Name);
        nameLabel.getStyleClass().add("creature-link");
        nameLabel.setAccessibleText("Stat Block \u00f6ffnen: " + c.Name);
        nameLabel.setOnAction(e -> fireStatBlockRequest());

        String detail = "CR " + c.CR + "  |  " + c.XP + " XP";
        if (c.CreatureType != null && !c.CreatureType.isBlank()) {
            detail += "  |  " + c.CreatureType;
        }
        Label detailLabel = new Label(detail);
        detailLabel.getStyleClass().add("text-secondary");

        HBox detailRow = new HBox(4);
        detailRow.getChildren().add(detailLabel);
        for (Label badge : buildRoleBadges(weightClass, primaryFunctionRole)) {
            detailRow.getChildren().add(badge);
        }
        detailRow.setAlignment(Pos.CENTER_LEFT);

        // Stat block link — purely decorative; nameLabel handles keyboard access
        Label expandArrow = new Label("\u25BC");
        expandArrow.getStyleClass().addAll("text-muted", "clickable");
        expandArrow.setOnMouseClicked(e -> fireStatBlockRequest());
        expandArrow.setFocusTraversable(false);

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

        // Wiring — count mutation and bounds checking are handled by the owner (EncounterRosterPane)
        minusBtn.setOnAction(e -> onDecrement.run());
        plusBtn.setOnAction(e -> onIncrement.run());
        removeBtn.setOnAction(e -> onRemove.run());
    }

    private void fireStatBlockRequest() {
        if (onRequestStatBlock != null) onRequestStatBlock.accept(creature.Id);
    }

    public void setOnRequestStatBlock(Consumer<Long> callback) {
        this.onRequestStatBlock = callback;
    }

    /** Updates the displayed count label to the given value. */
    public void updateCount(int count) {
        countLabel.setText(String.valueOf(count));
    }

    private static List<Label> buildRoleBadges(EncounterWeightClass weightClass,
                                               EncounterFunctionRole primaryFunctionRole) {
        List<Label> badges = new ArrayList<>();
        if (weightClass == EncounterWeightClass.MINION || weightClass == EncounterWeightClass.BOSS) {
            badges.add(createRoleBadge(weightClass.name()));
        }
        if (primaryFunctionRole != null) {
            badges.add(createRoleBadge(primaryFunctionRole.name()));
        }
        return badges;
    }

    private static Label createRoleBadge(String labelText) {
        String cssToken = labelText.toLowerCase();
        Label badge = new Label(labelText);
        badge.getStyleClass().addAll("small", "role-badge", "role-" + cssToken);
        return badge;
    }
}
