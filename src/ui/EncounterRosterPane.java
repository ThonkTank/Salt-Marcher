package ui;

import entities.Creature;
import javafx.geometry.Insets;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.control.ScrollPane;
import javafx.geometry.Pos;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.StackPane;
import javafx.scene.layout.VBox;

import java.util.function.Consumer;
import services.EncounterGenerator;
import services.EncounterGenerator.Encounter;
import services.EncounterGenerator.EncounterSlot;
import services.RoleClassifier;
import services.XpCalculator;
import ui.components.CreatureCard;
import ui.components.DifficultyMeter;

import java.util.ArrayList;
import java.util.List;


/**
 * Inspector top section for encounter building mode.
 * Shows difficulty meter, XP summary, and creature card roster.
 */
public class EncounterRosterPane extends VBox {

    private final List<EncounterSlot> slots = new ArrayList<>();
    private int partySize = 0;
    private int avgLevel = 1;
    private String currentDifficulty = "";

    private final DifficultyMeter difficultyMeter;
    private final Label difficultyLabel = new Label();
    private final Label templateLabel = new Label();
    private final Label levelLabel = new Label();
    private final Label easyThreshLabel = new Label();
    private final Label mediumThreshLabel = new Label();
    private final Label hardThreshLabel = new Label();
    private final Label deadlyThreshLabel = new Label();
    private final Label adjXpLabel = new Label();
    private final VBox cardList;
    private final Label placeholder;
    private final ScrollPane cardScroll;
    private final Button generateButton;
    private final Button startCombatButton;

    private Runnable onRosterChanged;
    private Runnable onGenerate;
    private Runnable onStartCombat;
    private Consumer<Long> onRequestStatBlock;

    public EncounterRosterPane() {
        setSpacing(0);
        setPadding(new Insets(8));

        // ---- Header ----
        Label title = new Label("Encounter");
        title.getStyleClass().add("title");
        title.setPadding(new Insets(0, 0, 4, 0));

        HBox headerRow = new HBox(8);
        difficultyLabel.getStyleClass().add("text-secondary");
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

        // ---- Card list ----
        cardList = new VBox(4);
        cardList.setPadding(new Insets(4, 0, 4, 0));

        placeholder = new Label("Monster per +Add hinzufuegen...");
        placeholder.getStyleClass().add("text-muted");

        cardScroll = new ScrollPane(cardList);
        cardScroll.setFitToWidth(true);
        cardScroll.setHbarPolicy(ScrollPane.ScrollBarPolicy.NEVER);
        cardScroll.setVisible(false);
        cardScroll.setManaged(false);

        // StackPane wrapper: placeholder and cardScroll overlay each other (one visible at a time).
        // VGrow on the wrapper pushes actionRegion to the bottom regardless of content state.
        StackPane contentArea = new StackPane(placeholder, cardScroll);
        contentArea.setAlignment(Pos.TOP_LEFT);
        VBox.setVgrow(contentArea, Priority.ALWAYS);

        // ---- Action buttons (bottom-pinned) ----
        generateButton = new Button("Generieren");
        generateButton.getStyleClass().add("accent");
        generateButton.setMaxWidth(Double.MAX_VALUE);
        generateButton.setOnAction(e -> { if (onGenerate != null) onGenerate.run(); });

        startCombatButton = new Button("Kampf starten");
        startCombatButton.getStyleClass().add("accent");
        startCombatButton.setDisable(true);
        startCombatButton.setMaxWidth(Double.MAX_VALUE);
        startCombatButton.setOnAction(e -> { if (onStartCombat != null) onStartCombat.run(); });

        VBox actionRegion = new VBox(6, generateButton, startCombatButton);
        actionRegion.setPadding(new Insets(6, 0, 0, 0));
        VBox.setVgrow(actionRegion, Priority.NEVER);

        getChildren().addAll(title, headerRow, difficultyMeter, thresholdRow, adjXpLabel,
                contentArea, ThemeColors.controlSeparator(), actionRegion);
    }

    // ---- Public API ----

    public void setOnRosterChanged(Runnable callback) { this.onRosterChanged = callback; }
    public void setOnGenerate(Runnable callback) { this.onGenerate = callback; }
    public void setOnStartCombat(Runnable callback) { this.onStartCombat = callback; }
    public void setStartCombatEnabled(boolean enabled) { startCombatButton.setDisable(!enabled); }
    public void setGenerateEnabled(boolean enabled) { generateButton.setDisable(!enabled); }
    public void setOnRequestStatBlock(Consumer<Long> callback) { this.onRequestStatBlock = callback; }

    public void addCreature(Creature creature) {
        for (EncounterSlot slot : slots) {
            if (slot.creature != null && slot.creature.Id.equals(creature.Id)) {
                if (slot.count < EncounterGenerator.MAX_CREATURES_PER_SLOT) {
                    slot.count++;
                    rebuildCards();
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
        showCards();
        rebuildCards();
        recalcSummary();
    }

    public void setEncounter(Encounter enc) {
        if (enc == null || enc.slots == null) return;
        slots.clear();
        for (EncounterSlot slot : enc.slots) {
            if (slot.creature != null) slots.add(slot);
        }
        if (slots.isEmpty()) { showPlaceholder(); return; }
        showCards();
        rebuildCards();
        recalcSummary();
        if (enc.difficulty != null) {
            currentDifficulty = enc.difficulty;
            difficultyLabel.setText(enc.difficulty);
            ThemeColors.applyDifficultyStyle(difficultyLabel, enc.difficulty);
        }
        if (enc.shapeLabel != null) templateLabel.setText(enc.shapeLabel);
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

    public void setPartyInfo(int partySize, int avgLevel) {
        this.partySize = partySize;
        this.avgLevel = avgLevel;
        recalcSummary();
    }

    public boolean hasSlots() { return !slots.isEmpty(); }

    public void showGenerating() {
        placeholder.setText("Generiere Encounter...");
        showPlaceholder();
    }

    public void showGenerationFailed() {
        placeholder.setText("Generierung fehlgeschlagen. Nochmal versuchen.");
        showPlaceholder();
    }

    // ---- Internal ----

    private void showPlaceholder() {
        // setManaged(false) removes the node from layout flow so it takes up no space;
        // setVisible(false) alone would leave a blank gap in its place.
        placeholder.setVisible(true);  placeholder.setManaged(true);
        cardScroll.setVisible(false);  cardScroll.setManaged(false);
        currentDifficulty = "";
        clearLabels();
        difficultyMeter.update(0, 0, 0, 0, 0, "");
    }

    private void showCards() {
        placeholder.setVisible(false); placeholder.setManaged(false);
        cardScroll.setVisible(true);   cardScroll.setManaged(true);
    }

    private void rebuildCards() {
        cardList.getChildren().clear();
        for (int i = 0; i < slots.size(); i++) {
            EncounterSlot slot = slots.get(i);
            if (slot.creature == null) continue;
            final int idx = i;
            CreatureCard card = new CreatureCard(slot, this::recalcSummary, () -> removeSlot(idx));
            card.setOnRequestStatBlock(onRequestStatBlock);
            cardList.getChildren().add(card);
        }
        if (onRosterChanged != null) onRosterChanged.run();
    }

    private void removeSlot(int slotIndex) {
        if (slotIndex < 0 || slotIndex >= slots.size()) return;
        slots.remove(slotIndex);
        rebuildCards();
        recalcSummary();
        if (slots.isEmpty()) showPlaceholder();
    }

    private void recalcSummary() {
        if (slots.isEmpty() || partySize == 0) {
            difficultyMeter.update(0, 0, 0, 0, 0, "");
            clearLabels();
            difficultyLabel.setText(slots.isEmpty() ? "" : "Keine Party");
            ThemeColors.applyDifficultyStyle(difficultyLabel, null);
            levelLabel.setText(partySize > 0 ? "Party: " + partySize + ", Lv " + avgLevel : "");
            if (onRosterChanged != null) onRosterChanged.run();
            return;
        }

        XpCalculator.DifficultyStats ds = XpCalculator.computeStats(
                EncounterGenerator.adjustedXp(slots), partySize, avgLevel);

        difficultyMeter.update(ds.easyTh(), ds.mediumTh(), ds.hardTh(), ds.deadlyTh(), ds.adjXp(), ds.difficulty());

        easyThreshLabel.setText("E:" + ds.easyTh());
        mediumThreshLabel.setText("M:" + ds.mediumTh());
        hardThreshLabel.setText("H:" + ds.hardTh());
        deadlyThreshLabel.setText("D:" + ds.deadlyTh());
        adjXpLabel.setText("Adj. XP: " + ds.adjXp());
        levelLabel.setText("Party: " + partySize + ", Lv " + avgLevel);

        currentDifficulty = ds.difficulty();
        difficultyLabel.setText(ds.difficulty());
        ThemeColors.applyDifficultyStyle(difficultyLabel, ds.difficulty());

        if (onRosterChanged != null) onRosterChanged.run();
    }

    private void clearLabels() {
        difficultyLabel.setText("");
        templateLabel.setText("");
        levelLabel.setText("");
        easyThreshLabel.setText("");
        mediumThreshLabel.setText("");
        hardThreshLabel.setText("");
        deadlyThreshLabel.setText("");
        adjXpLabel.setText("");
    }

    private void styleThreshLabel(Label label, String styleClass) {
        label.getStyleClass().addAll("small", styleClass);
    }
}
