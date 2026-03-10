package features.encounter.ui.combat;

import features.gamerules.model.LootCoins;
import features.encounter.model.MonsterCombatant;
import features.encounter.service.EncounterService;
import features.encounter.service.combat.CombatSession;
import features.party.model.PlayerCharacter;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.control.*;
import javafx.scene.layout.*;
import javafx.util.StringConverter;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

/**
 * Post-combat summary shown in the ScenePane (state panel).
 * Shows defeated enemy count, total XP, a threshold slider (min HP-loss to count as defeated),
 * and an XP-fraction slider (what % of earned XP to award).
 *
 * <p>XP design intent: enemies that were removed from combat (for example, fled/chased off) are
 * intentionally part of the XP calculation. Eligibility is determined by HP-loss threshold, not by
 * requiring a {@code DEAD} status.
 */
public class CombatResultsPane extends VBox {

    private final EncounterService encounterService;
    private Runnable onDone;

    public CombatResultsPane(
            EncounterService encounterService,
            List<CombatSession.EnemyOutcome> outcomes,
            List<PlayerCharacter> party) {
        this.encounterService = Objects.requireNonNull(encounterService);
        setSpacing(0);
        int partySize = Math.max(1, party.size());

        // ---- Header ----
        Label titleLabel = new Label("Kampfergebnis");
        titleLabel.getStyleClass().add("title");
        titleLabel.setPadding(new Insets(8, 8, 2, 8));

        Label subtitleLabel = new Label();
        subtitleLabel.getStyleClass().add("text-secondary");
        subtitleLabel.setPadding(new Insets(0, 8, 8, 8));

        // ---- Per-player XP (large) ----
        Label perPlayerLabel = new Label();
        perPlayerLabel.getStyleClass().add("title");
        perPlayerLabel.setStyle("-fx-font-size: 1.8em;");

        Label partyInfoLabel = new Label();
        partyInfoLabel.getStyleClass().add("text-secondary");

        Label goldInfoLabel = new Label();
        goldInfoLabel.getStyleClass().add("title");
        goldInfoLabel.setStyle("-fx-font-size: 1.5em;");

        Label goldDetailLabel = new Label();
        goldDetailLabel.getStyleClass().add("text-secondary");

        VBox xpBox = new VBox(2, perPlayerLabel, partyInfoLabel, goldInfoLabel, goldDetailLabel);
        xpBox.setPadding(new Insets(8));
        xpBox.setAlignment(Pos.CENTER_LEFT);

        // ---- Threshold slider ----
        Label thresholdTitle = new Label("Besiegungsschwelle (min. HP-Verlust)");
        thresholdTitle.getStyleClass().add("text-secondary");
        thresholdTitle.setPadding(new Insets(8, 8, 2, 8));

        Slider thresholdSlider = makePercentSlider(1.0);
        Label thresholdValueLabel = new Label();
        thresholdValueLabel.setMinWidth(40);
        thresholdValueLabel.setAlignment(Pos.CENTER_RIGHT);

        HBox thresholdRow = new HBox(8, thresholdSlider, thresholdValueLabel);
        thresholdRow.setAlignment(Pos.CENTER_LEFT);
        thresholdRow.setPadding(new Insets(2, 8, 8, 8));
        HBox.setHgrow(thresholdSlider, Priority.ALWAYS);

        // ---- Fraction slider ----
        Label fractionTitle = new Label("XP-Anteil");
        fractionTitle.getStyleClass().add("text-secondary");
        fractionTitle.setPadding(new Insets(4, 8, 2, 8));

        Slider fractionSlider = makePercentSlider(1.0);
        Label fractionValueLabel = new Label();
        fractionValueLabel.setMinWidth(40);
        fractionValueLabel.setAlignment(Pos.CENTER_RIGHT);

        HBox fractionRow = new HBox(8, fractionSlider, fractionValueLabel);
        fractionRow.setAlignment(Pos.CENTER_LEFT);
        fractionRow.setPadding(new Insets(2, 8, 8, 8));
        HBox.setHgrow(fractionSlider, Priority.ALWAYS);

        // ---- Loot toggles for non-dead enemies ----
        List<CombatSession.EnemyOutcome> safeOutcomes = outcomes == null ? List.of() : outcomes;
        OptionalLootSection optionalLootSection = buildOptionalLootSection(safeOutcomes);

        // ---- Done button ----
        Button doneButton = new Button("Abschließen");
        doneButton.setMaxWidth(Double.MAX_VALUE);
        doneButton.setPadding(new Insets(8));
        doneButton.setOnAction(e -> { if (onDone != null) onDone.run(); });
        HBox doneRow = new HBox(doneButton);
        doneRow.setPadding(new Insets(4, 8, 8, 8));
        HBox.setHgrow(doneButton, Priority.ALWAYS);

        // ---- Reactive update ----
        Runnable update = () -> {
            updateSettlementUi(
                    outcomes,
                    partySize,
                    thresholdSlider.getValue(),
                    fractionSlider.getValue(),
                    optionalLootSection.rows(),
                    subtitleLabel,
                    thresholdValueLabel,
                    fractionValueLabel,
                    perPlayerLabel,
                    partyInfoLabel,
                    goldInfoLabel,
                    goldDetailLabel);
        };

        thresholdSlider.valueProperty().addListener((o, ov, nv) -> update.run());
        fractionSlider.valueProperty().addListener((o, ov, nv) -> update.run());
        for (OptionalLootRow row : optionalLootSection.rows()) {
            row.toggle().selectedProperty().addListener((o, ov, nv) -> update.run());
        }
        update.run();

        getChildren().addAll(
                titleLabel,
                subtitleLabel,
                new Separator(),
                xpBox,
                new Separator(),
                thresholdTitle,
                thresholdRow,
                fractionTitle,
                fractionRow,
                new Separator(),
                optionalLootSection.title(),
                optionalLootSection.scrollPane(),
                new Separator(),
                doneRow
        );
    }

    public void setOnDone(Runnable callback) { this.onDone = callback; }

    private static Slider makePercentSlider(double defaultValue) {
        Slider s = new Slider(0, 1, defaultValue);
        s.setMajorTickUnit(0.25);
        s.setMinorTickCount(4);
        s.setShowTickMarks(true);
        s.setShowTickLabels(true);
        s.setLabelFormatter(new StringConverter<>() {
            @Override public String toString(Double v) { return (int) Math.round(v * 100) + "%"; }
            @Override public Double fromString(String s) { return null; }
        });
        return s;
    }

    private static LootCoins lootOf(CombatSession.EnemyOutcome outcome) {
        return outcome != null && outcome.combatant() != null
                ? outcome.combatant().getLootCoins()
                : LootCoins.zero();
    }

    private static String statusLabel(CombatSession.EnemyStatus status) {
        if (status == null) {
            return "Unbekannt";
        }
        return switch (status) {
            case ALIVE -> "Lebt";
            case DEAD -> "Tot";
            case REMOVED -> "Entfernt";
        };
    }

    private OptionalLootSection buildOptionalLootSection(List<CombatSession.EnemyOutcome> outcomes) {
        List<OptionalLootRow> rows = new ArrayList<>();

        Label title = new Label("Weitere Kreaturen (Loot optional)");
        title.getStyleClass().add("text-secondary");
        title.setPadding(new Insets(4, 8, 2, 8));

        VBox list = new VBox(4);
        list.setPadding(new Insets(2, 8, 8, 8));

        for (CombatSession.EnemyOutcome outcome : outcomes) {
            if (outcome == null
                    || outcome.status() == CombatSession.EnemyStatus.DEAD
                    || outcome.combatant() == null) {
                continue;
            }
            CheckBox toggle = new CheckBox(
                    outcome.combatant().getName()
                            + " (" + statusLabel(outcome.status()) + ")"
                            + " - " + lootOf(outcome).formatCompact());
            rows.add(new OptionalLootRow(outcome.combatant(), toggle));
            list.getChildren().add(toggle);
        }

        ScrollPane scroll = new ScrollPane(list);
        scroll.setFitToWidth(true);
        scroll.setHbarPolicy(ScrollPane.ScrollBarPolicy.NEVER);
        scroll.setVbarPolicy(ScrollPane.ScrollBarPolicy.AS_NEEDED);
        scroll.setPrefViewportHeight(120);
        scroll.setMinViewportHeight(80);

        boolean hasRows = !rows.isEmpty();
        scroll.setVisible(hasRows);
        scroll.setManaged(hasRows);
        title.setVisible(hasRows);
        title.setManaged(hasRows);

        return new OptionalLootSection(title, scroll, List.copyOf(rows));
    }

    private Set<MonsterCombatant> collectSelectedOptionalLootCombatants(List<OptionalLootRow> rows) {
        Set<MonsterCombatant> selected = new HashSet<>();
        for (OptionalLootRow row : rows) {
            if (row.toggle().isSelected()) {
                selected.add(row.combatant());
            }
        }
        return selected;
    }

    private void updateSettlementUi(
            List<CombatSession.EnemyOutcome> outcomes,
            int partySize,
            double threshold,
            double fraction,
            List<OptionalLootRow> optionalLootRows,
            Label subtitleLabel,
            Label thresholdValueLabel,
            Label fractionValueLabel,
            Label perPlayerLabel,
            Label partyInfoLabel,
            Label goldInfoLabel,
            Label goldDetailLabel) {
        Set<MonsterCombatant> selectedOptionalLootCombatants =
                collectSelectedOptionalLootCombatants(optionalLootRows);
        var settlement = this.encounterService.settleCombatRewards(
                outcomes, partySize, threshold, fraction, selectedOptionalLootCombatants);
        var xpSettlement = settlement.xpSettlement();

        subtitleLabel.setText(xpSettlement.defeatedCount() + " Gegner besiegt · "
                + xpSettlement.eligibleXp() + " XP");
        thresholdValueLabel.setText((int) Math.round(threshold * 100) + "%");
        fractionValueLabel.setText((int) Math.round(fraction * 100) + "%");
        perPlayerLabel.setText(xpSettlement.perPlayerXp() + " XP");
        partyInfoLabel.setText("pro Spieler  (" + partySize + " Spieler · "
                + xpSettlement.awardedXp() + " XP gesamt)");

        goldInfoLabel.setText(settlement.pooledLoot().formatCompact());
        goldDetailLabel.setText("Loot-Pool gesamt ("
                + settlement.deadLoot().formatCompact() + " durch tote Gegner)");
    }

    private record OptionalLootRow(MonsterCombatant combatant, CheckBox toggle) {}
    private record OptionalLootSection(Label title, ScrollPane scrollPane, List<OptionalLootRow> rows) {}
}
