package features.encounter.ui.combat;

import features.encounter.model.EncounterSlot;
import features.encounter.combat.service.InitiativeRoller;
import features.party.model.PlayerCharacter;
import ui.components.ThemeColors;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.control.*;
import javafx.scene.layout.*;

import java.util.ArrayList;
import java.util.List;
import java.util.function.Consumer;

/**
 * Initiative-entry panel shown in the encounter scene between the roster and the combat tracker.
 * Lists PCs first, then one initiative row per encounter slot.
 * A slot can contain multiple creatures (including mob-sized groups).
 * Runtime mob grouping is still resolved later in {@link CombatTrackerPane}
 * from Creature-ID + initiative.
 */
public class InitiativePane extends VBox {

    public record Result(List<Integer> pcInitiatives, List<Integer> monsterInitiatives) {}

    private Runnable onCancel;
    private Consumer<Result> onConfirm;

    public void setOnCancel(Runnable callback) { this.onCancel = callback; }
    public void setOnConfirm(Consumer<Result> callback) { this.onConfirm = callback; }

    /** A single monster row: display name, initiative bonus, spinner. */
    private record MonsterEntry(String name, int initBonus, Spinner<Integer> spinner) {}

    public InitiativePane(List<PlayerCharacter> party, List<EncounterSlot> slots) {
        setSpacing(0);

        VBox content = new VBox(10);
        content.setPadding(new Insets(12));

        List<Spinner<Integer>> pcSpinners = new ArrayList<>();
        List<MonsterEntry> monsterEntries = new ArrayList<>();

        // ---- Spieler ----
        if (!party.isEmpty()) {
            Label pcHeader = new Label("Spieler");
            pcHeader.getStyleClass().add("section-header");

            GridPane pcGrid = buildGrid();
            for (int i = 0; i < party.size(); i++) {
                PlayerCharacter pc = party.get(i);
                Label nameLabel = new Label(pc.Name + " (Lv." + pc.Level + ")");
                nameLabel.setMaxWidth(Double.MAX_VALUE);
                GridPane.setHgrow(nameLabel, Priority.ALWAYS);

                Spinner<Integer> spinner = new Spinner<>(-5, 35, 10);
                spinner.setEditable(true);
                spinner.setPrefWidth(85);
                pcSpinners.add(spinner);

                pcGrid.add(nameLabel, 0, i);
                pcGrid.add(spinner, 1, i);
            }
            content.getChildren().addAll(pcHeader, pcGrid);
        }

        // ---- Monster ----
        if (!slots.isEmpty()) {
            // One entry per encounter slot (not per individual monster).
            for (EncounterSlot slot : slots) {
                String displayName = slot.getCount() > 1
                        ? slot.getCreature().getName() + " x" + slot.getCount()
                        : slot.getCreature().getName();
                int bonus = slot.getCreature().getInitiativeBonus();
                Spinner<Integer> spinner = new Spinner<>(-10, 40, InitiativeRoller.rollWithBonus(bonus));
                spinner.setEditable(true);
                spinner.setPrefWidth(85);
                monsterEntries.add(new MonsterEntry(displayName, bonus, spinner));
            }

            Label monsterHeader = new Label("Monster");
            monsterHeader.getStyleClass().add("section-header");
            monsterHeader.setMaxWidth(Double.MAX_VALUE);
            HBox.setHgrow(monsterHeader, Priority.ALWAYS);

            Button rollAllBtn = new Button("Alle w\u00FCrfeln");
            rollAllBtn.getStyleClass().add("spinner-btn");
            rollAllBtn.setOnAction(e -> monsterEntries.forEach(
                    entry -> entry.spinner().getValueFactory().setValue(InitiativeRoller.rollWithBonus(entry.initBonus()))));

            HBox monsterTitleRow = new HBox(8, monsterHeader, rollAllBtn);
            monsterTitleRow.setAlignment(Pos.CENTER_LEFT);

            GridPane monsterGrid = buildGrid();
            for (int i = 0; i < monsterEntries.size(); i++) {
                MonsterEntry entry = monsterEntries.get(i);
                String bonusStr = entry.initBonus() >= 0
                        ? "(+" + entry.initBonus() + ")"
                        : "(" + entry.initBonus() + ")";
                Label nameLabel = new Label(entry.name() + " " + bonusStr);
                nameLabel.setMaxWidth(Double.MAX_VALUE);
                GridPane.setHgrow(nameLabel, Priority.ALWAYS);

                Button rerollBtn = new Button("\uD83C\uDFB2");
                rerollBtn.getStyleClass().add("spinner-btn");
                final MonsterEntry e = entry;
                rerollBtn.setOnAction(ev -> e.spinner().getValueFactory().setValue(InitiativeRoller.rollWithBonus(e.initBonus())));

                monsterGrid.add(nameLabel, 0, i);
                monsterGrid.add(entry.spinner(), 1, i);
                monsterGrid.add(rerollBtn, 2, i);
            }

            content.getChildren().addAll(monsterTitleRow, monsterGrid);
        }

        ScrollPane scroll = new ScrollPane(content);
        scroll.setFitToWidth(true);
        scroll.setHbarPolicy(ScrollPane.ScrollBarPolicy.NEVER);
        VBox.setVgrow(scroll, Priority.ALWAYS);

        // ---- Button bar ----
        Button cancelBtn = new Button("\u2190 Zur\u00FCck");
        Button startBtn = new Button("Kampf starten");
        startBtn.getStyleClass().add("accent");

        Region spacer = new Region();
        HBox.setHgrow(spacer, Priority.ALWAYS);
        HBox buttonBar = new HBox(8, cancelBtn, spacer, startBtn);
        buttonBar.setPadding(new Insets(8, 12, 8, 12));
        buttonBar.setAlignment(Pos.CENTER_LEFT);

        cancelBtn.setOnAction(e -> { if (onCancel != null) onCancel.run(); });
        startBtn.setOnAction(e -> {
            List<Integer> pcInits = new ArrayList<>();
            for (Spinner<Integer> s : pcSpinners) {
                s.commitValue();
                pcInits.add(s.getValue());
            }
            List<Integer> monsterInits = new ArrayList<>();
            for (MonsterEntry entry : monsterEntries) {
                entry.spinner().commitValue();
                monsterInits.add(entry.spinner().getValue());
            }
            if (onConfirm != null) onConfirm.accept(new Result(pcInits, monsterInits));
        });

        getChildren().addAll(scroll, ThemeColors.controlSeparator(), buttonBar);
    }

    private static GridPane buildGrid() {
        GridPane grid = new GridPane();
        grid.setHgap(10);
        grid.setVgap(6);
        grid.setPadding(new Insets(2, 0, 6, 12));
        ColumnConstraints nameCol = new ColumnConstraints();
        nameCol.setHgrow(Priority.ALWAYS);
        ColumnConstraints spinnerCol = new ColumnConstraints();
        spinnerCol.setPrefWidth(85);
        grid.getColumnConstraints().addAll(nameCol, spinnerCol);
        return grid;
    }
}
