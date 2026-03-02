package ui;

import entities.Creature;
import ui.components.CreatureCard;
import ui.components.DifficultyMeter;
import ui.components.SliderControl;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.control.ScrollPane;
import javafx.scene.layout.*;
import javafx.util.StringConverter;
import services.EncounterGenerator;
import services.EncounterGenerator.Encounter;
import services.EncounterGenerator.EncounterSlot;
import services.RoleClassifier;
import services.XpCalculator;

import java.util.ArrayList;
import java.util.List;
import java.util.function.Consumer;

public class EncounterSummaryPane extends VBox {

    private final List<EncounterSlot> slots = new ArrayList<>();
    private int partySize = 0;
    private int avgLevel = 1;
    private String currentDifficulty = "";

    // Header
    private final Label difficultyLabel = new Label();
    private final Label templateLabel   = new Label();
    private final Label levelLabel      = new Label();

    // Difficulty meter
    private final DifficultyMeter difficultyMeter;

    // Thresholds
    private final Label easyThreshLabel   = new Label();
    private final Label mediumThreshLabel = new Label();
    private final Label hardThreshLabel   = new Label();
    private final Label deadlyThreshLabel = new Label();
    private final Label adjXpLabel        = new Label();

    // Creature list
    private final VBox creatureListBox;
    private final ScrollPane creatureScroll;
    private final Label placeholder;
    private final StackPane centerStack;

    // Sliders
    private final SliderControl difficultySlider;
    private final SliderControl groupSlider;
    private final SliderControl balanceSlider;
    private final SliderControl strengthSlider;

    // Buttons
    private final Button generateButton;
    private final Button startCombatButton;

    // Callbacks
    private Consumer<Encounter> onStartCombat;
    private Runnable onGenerate;

    public EncounterSummaryPane() {
        getStyleClass().add("encounter-pane");
        setPrefWidth(340);
        setMinWidth(280);
        setPadding(new Insets(8));
        setSpacing(0);

        // ---- TOP: Title + Header + Meter + Thresholds ----
        VBox topSection = new VBox(0);

        Label title = new Label("Encounter");
        title.getStyleClass().add("title");
        title.setPadding(new Insets(0, 0, 6, 0));

        HBox headerRow = new HBox(12);
        headerRow.setPadding(new Insets(4));
        difficultyLabel.getStyleClass().addAll("title", "text-muted");
        templateLabel.getStyleClass().addAll("small", "text-secondary");
        levelLabel.getStyleClass().add("text-secondary");
        headerRow.getChildren().addAll(difficultyLabel, templateLabel, levelLabel);

        difficultyMeter = new DifficultyMeter();

        HBox thresholdRow = new HBox(8);
        thresholdRow.setPadding(new Insets(2, 0, 0, 0));
        styleThreshLabel(easyThreshLabel, "difficulty-easy");
        styleThreshLabel(mediumThreshLabel, "difficulty-medium");
        styleThreshLabel(hardThreshLabel, "difficulty-hard");
        styleThreshLabel(deadlyThreshLabel, "difficulty-deadly");
        thresholdRow.getChildren().addAll(easyThreshLabel, mediumThreshLabel, hardThreshLabel, deadlyThreshLabel);

        adjXpLabel.getStyleClass().add("bold");

        topSection.getChildren().addAll(title, headerRow, difficultyMeter, thresholdRow, adjXpLabel);

        // ---- CENTER: Creature card list with StackPane switch ----
        creatureListBox = new VBox(4);
        creatureListBox.setPadding(new Insets(4));

        creatureScroll = new ScrollPane(creatureListBox);
        creatureScroll.setFitToWidth(true);
        creatureScroll.setHbarPolicy(ScrollPane.ScrollBarPolicy.NEVER);

        placeholder = new Label("Monster per +Add hinzufuegen...");
        placeholder.getStyleClass().add("text-muted");

        centerStack = new StackPane(placeholder, creatureScroll);
        VBox.setVgrow(centerStack, Priority.ALWAYS);
        showPlaceholder();

        // ---- BOTTOM: Sliders + Buttons ----
        VBox bottomSection = new VBox(2);
        bottomSection.setPadding(new Insets(6, 0, 0, 0));
        bottomSection.getStyleClass().add("encounter-bottom");

        difficultySlider = new SliderControl("Schwierigkeit", 0, 100, 33, false,
                "Wie schwer der Encounter sein soll",
                new StringConverter<>() {
                    @Override public String toString(Double v) {
                        if (v <= 16) return "E";
                        if (v <= 50) return "M";
                        if (v <= 83) return "H";
                        return "D";
                    }
                    @Override public Double fromString(String s) { return 0.0; }
                },
                v -> XpCalculator.classifyDifficulty(v / 100.0));

        groupSlider = new SliderControl("Gruppen", 1, 4, 2, true,
                "Anzahl verschiedener Monsterarten", null,
                v -> ((int) Math.round(v)) + "x");

        balanceSlider = new SliderControl("Balance", 0, 100, 50, false,
                "Links: eine dominante Gruppe. Rechts: alle gleich stark",
                new StringConverter<>() {
                    @Override public String toString(Double v) {
                        if (v <= 0) return "Dom.";
                        if (v >= 100) return "Gleich";
                        return "";
                    }
                    @Override public Double fromString(String s) { return 0.0; }
                },
                v -> v < 30 ? "Dominant" : v < 70 ? "Mittel" : "Gleich");

        strengthSlider = new SliderControl("Staerke", 0, 100, 50, false,
                "Links: viele schwache Kreaturen. Rechts: wenige starke",
                new StringConverter<>() {
                    @Override public String toString(Double v) {
                        if (v <= 0) return "Schwarm";
                        if (v >= 100) return "Elite";
                        return "";
                    }
                    @Override public Double fromString(String s) { return 0.0; }
                },
                v -> v < 30 ? "Schwarm" : v < 70 ? "Gemischt" : "Elite");

        HBox buttonRow = new HBox(8);
        buttonRow.setPadding(new Insets(6, 0, 0, 0));
        generateButton = new Button("Generieren");
        generateButton.getStyleClass().add("accent");
        startCombatButton = new Button("Kampf starten");
        startCombatButton.setDisable(true);
        buttonRow.getChildren().addAll(generateButton, startCombatButton);

        bottomSection.getChildren().addAll(difficultySlider, groupSlider, balanceSlider, strengthSlider, buttonRow);

        getChildren().addAll(topSection, centerStack, bottomSection);

        generateButton.setOnAction(e -> { if (onGenerate != null) onGenerate.run(); });
        startCombatButton.setOnAction(e -> {
            if (onStartCombat != null && !slots.isEmpty()) onStartCombat.accept(buildEncounter());
        });
    }

    // ---- Public API ----

    public void setOnStartCombat(Consumer<Encounter> callback) { this.onStartCombat = callback; }
    public void setOnGenerate(Runnable callback) { this.onGenerate = callback; }

    public void setGenerating() {
        generateButton.setDisable(true);
        placeholder.setText("Generiere Encounter...");
        showPlaceholder();
    }

    public void setEncounter(Encounter enc) {
        generateButton.setDisable(false);
        if (enc == null || enc.slots == null) return;
        slots.clear();
        for (EncounterSlot slot : enc.slots) {
            if (slot.creature != null) slots.add(slot);
        }
        if (slots.isEmpty()) {
            showPlaceholder();
            return;
        }
        showCreatureList();
        rebuildCreatureList();
        recalcSummary();

        if (enc.difficulty != null) {
            currentDifficulty = enc.difficulty;
            difficultyLabel.setText(enc.difficulty);
            applyDifficultyStyle(difficultyLabel, enc.difficulty);
        }
        if (enc.shapeLabel != null) templateLabel.setText(enc.shapeLabel);
    }

    public void setPartyInfo(int partySize, int avgLevel) {
        this.partySize = partySize;
        this.avgLevel = avgLevel;
        recalcSummary();
    }

    public void addCreature(Creature creature) {
        for (EncounterSlot slot : slots) {
            if (slot.creature != null && slot.creature.Id.equals(creature.Id)) {
                if (slot.count < EncounterGenerator.MAX_CREATURES_PER_SLOT) {
                    slot.count++;
                    rebuildCreatureList();
                    recalcSummary();
                }
                return;
            }
        }
        EncounterSlot newSlot = new EncounterSlot();
        newSlot.creature = creature;
        newSlot.count = 1;
        newSlot.role = RoleClassifier.classify(creature);
        slots.add(newSlot);
        showCreatureList();
        rebuildCreatureList();
        recalcSummary();
    }

    public Encounter buildEncounter() {
        Encounter enc = new Encounter();
        enc.slots = new ArrayList<>(slots);
        enc.difficulty = currentDifficulty;
        enc.averageLevel = avgLevel;
        enc.partySize = partySize;
        enc.xpBudget = EncounterGenerator.adjustedXp(slots);
        return enc;
    }

    public double getSelectedDifficulty() { return difficultySlider.getValue() < 0 ? -1 : difficultySlider.getValue() / 100.0; }
    public int getSelectedGroupCount()    { return groupSlider.isAuto() ? -1 : (int) Math.round(groupSlider.getValue()); }
    public double getSelectedBalance()    { return balanceSlider.getValue() < 0 ? -1 : balanceSlider.getValue() / 100.0; }
    public double getSelectedStrength()   { return strengthSlider.getValue() < 0 ? -1 : strengthSlider.getValue() / 100.0; }

    // ---- Internal ----

    private void showPlaceholder() {
        placeholder.setVisible(true);  placeholder.setManaged(true);
        creatureScroll.setVisible(false); creatureScroll.setManaged(false);
        currentDifficulty = "";
        difficultyLabel.setText("");
        templateLabel.setText("");
        levelLabel.setText("");
        easyThreshLabel.setText("");
        mediumThreshLabel.setText("");
        hardThreshLabel.setText("");
        deadlyThreshLabel.setText("");
        adjXpLabel.setText("");
        difficultyMeter.update(0, 0, 0, 0, 0);
    }

    private void showCreatureList() {
        placeholder.setVisible(false); placeholder.setManaged(false);
        creatureScroll.setVisible(true); creatureScroll.setManaged(true);
    }

    private void styleThreshLabel(Label label, String styleClass) {
        label.getStyleClass().addAll("small", styleClass);
    }

    private void rebuildCreatureList() {
        creatureListBox.getChildren().clear();
        for (int i = 0; i < slots.size(); i++) {
            EncounterSlot slot = slots.get(i);
            if (slot.creature == null) continue;
            final int idx = i;
            creatureListBox.getChildren().add(
                    new CreatureCard(slot, this::recalcSummary, () -> removeSlot(idx)));
        }
    }

    private void removeSlot(int slotIndex) {
        if (slotIndex < 0 || slotIndex >= slots.size()) return;
        slots.remove(slotIndex);
        rebuildCreatureList();
        recalcSummary();
        if (slots.isEmpty()) showPlaceholder();
    }

    private void recalcSummary() {
        if (slots.isEmpty() || partySize == 0) {
            difficultyMeter.update(0, 0, 0, 0, 0);
            difficultyLabel.setText(slots.isEmpty() ? "" : "Keine Party");
            applyDifficultyStyle(difficultyLabel, null);
            adjXpLabel.setText("");
            easyThreshLabel.setText("");
            mediumThreshLabel.setText("");
            hardThreshLabel.setText("");
            deadlyThreshLabel.setText("");
            startCombatButton.setDisable(true);
            levelLabel.setText(partySize > 0 ? "Party: " + partySize + ", Lv " + avgLevel : "");
            return;
        }

        int adjustedXP = EncounterGenerator.adjustedXp(slots);
        int totalCreatures = 0;
        for (EncounterSlot slot : slots) {
            if (slot.creature != null) totalCreatures += slot.count;
        }

        int partySz = Math.max(1, partySize);
        int easyTh   = XpCalculator.getXpThreshold(avgLevel, "Easy")   * partySz;
        int mediumTh = XpCalculator.getXpThreshold(avgLevel, "Medium") * partySz;
        int hardTh   = XpCalculator.getXpThreshold(avgLevel, "Hard")   * partySz;
        int deadlyTh = XpCalculator.getXpThreshold(avgLevel, "Deadly") * partySz;

        difficultyMeter.update(easyTh, mediumTh, hardTh, deadlyTh, adjustedXP);

        easyThreshLabel.setText("E:" + easyTh);
        mediumThreshLabel.setText("M:" + mediumTh);
        hardThreshLabel.setText("H:" + hardTh);
        deadlyThreshLabel.setText("D:" + deadlyTh);
        adjXpLabel.setText("Adj. XP: " + adjustedXP);
        levelLabel.setText("Party: " + partySize + ", Lv " + avgLevel);

        String currentDiff = XpCalculator.classifyDifficultyByXp(adjustedXP, easyTh, mediumTh, hardTh, deadlyTh);
        currentDifficulty = currentDiff;
        difficultyLabel.setText(currentDiff);
        applyDifficultyStyle(difficultyLabel, currentDiff);

        startCombatButton.setDisable(totalCreatures <= 0);
    }

    private static final List<String> DIFFICULTY_STYLES =
            List.of("difficulty-easy", "difficulty-medium", "difficulty-hard", "difficulty-deadly", "text-muted");

    private void applyDifficultyStyle(Label label, String difficulty) {
        label.getStyleClass().removeAll(DIFFICULTY_STYLES);
        String cls = switch (difficulty != null ? difficulty : "") {
            case "Easy"   -> "difficulty-easy";
            case "Medium" -> "difficulty-medium";
            case "Hard"   -> "difficulty-hard";
            case "Deadly" -> "difficulty-deadly";
            default       -> "text-muted";
        };
        label.getStyleClass().add(cls);
    }
}
