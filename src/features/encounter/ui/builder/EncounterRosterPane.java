package features.encounter.ui.builder;

import features.creaturecatalog.model.Creature;
import features.creaturecatalog.model.ChallengeRating;
import javafx.animation.PauseTransition;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.AccessibleAttribute;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.control.ScrollPane;
import javafx.scene.control.Tooltip;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.StackPane;
import javafx.scene.layout.VBox;
import javafx.util.Duration;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Objects;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Consumer;
import java.util.stream.Collectors;
import features.encounter.model.Encounter;
import features.encounter.model.EncounterSlot;
import features.gamerules.model.MonsterRole;
import features.encounter.model.EncounterCreatureSnapshot;
import features.encounter.application.EncounterApplicationService;
import features.encounter.generation.service.EncounterGenerator;
import features.encounter.model.EncounterCreatureSnapshotMapper;
import features.gamerules.service.XpCalculator;
import ui.components.DifficultyMeter;
import ui.components.ThemeColors;


/**
 * ScenePane content for encounter building mode.
 * Shows difficulty meter, XP summary, and the creature card roster.
 * Pushed into ScenePane (lower right) by EncounterView.onShow() and switchMode().
 */
public class EncounterRosterPane extends VBox {

    private final EncounterApplicationService encounterService;
    private final List<EncounterSlot> slots = new ArrayList<>();
    private int partySize = 0;
    private int avgLevel = 1;
    private String currentDifficulty = "";
    private String currentShapeLabel = "";

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

    public EncounterRosterPane(EncounterApplicationService encounterService) {
        this.encounterService = Objects.requireNonNull(encounterService);
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
        thresholdRow.setPadding(new Insets(4, 0, 0, 0));
        styleThreshLabel(easyThreshLabel, "difficulty-easy");
        styleThreshLabel(mediumThreshLabel, "difficulty-medium");
        styleThreshLabel(hardThreshLabel, "difficulty-hard");
        styleThreshLabel(deadlyThreshLabel, "difficulty-deadly");
        easyThreshLabel.setTooltip(new Tooltip("Easy-Schwelle"));
        mediumThreshLabel.setTooltip(new Tooltip("Medium-Schwelle"));
        hardThreshLabel.setTooltip(new Tooltip("Hard-Schwelle"));
        deadlyThreshLabel.setTooltip(new Tooltip("Deadly-Schwelle"));
        thresholdRow.getChildren().addAll(easyThreshLabel, mediumThreshLabel, hardThreshLabel, deadlyThreshLabel);

        adjXpLabel.getStyleClass().add("bold");

        // ---- Card list ----
        cardList = new VBox(4);
        cardList.setPadding(new Insets(4, 0, 4, 0));

        placeholder = new Label("Monster per +Add hinzuf\u00fcgen...");
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
        generateButton = new Button("_Generieren");
        generateButton.getStyleClass().add("accent");
        generateButton.setMaxWidth(Double.MAX_VALUE);
        generateButton.setTooltip(new Tooltip("Encounter generieren (Alt+G)"));
        generateButton.setOnAction(e -> { if (onGenerate != null) onGenerate.run(); });

        startCombatButton = new Button("_Kampf starten");
        startCombatButton.getStyleClass().add("accent");
        startCombatButton.setDisable(true);
        startCombatButton.setMaxWidth(Double.MAX_VALUE);
        startCombatButton.setTooltip(new Tooltip("Kampf starten (Alt+K)"));
        startCombatButton.setOnAction(e -> { if (onStartCombat != null) onStartCombat.run(); });

        VBox actionRegion = new VBox(8, generateButton, startCombatButton);
        actionRegion.setPadding(new Insets(8, 0, 0, 0));
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

    public void addCreature(Creature creature, MonsterRole role) {
        EncounterCreatureSnapshot snapshot = EncounterCreatureSnapshotMapper.toSnapshot(creature);
        for (EncounterSlot slot : slots) {
            if (slot.getCreature().getId().equals(snapshot.getId())) {
                if (slot.getCount() < encounterService.maxCreaturesPerSlot()) {
                    slot.incrementCount();
                    // Keep UI and data in sync even if temporary non-card nodes (undo toast) are present.
                    rebuildCards();
                    notifyRosterChanged();
                }
                return;
            }
        }
        EncounterSlot newSlot = new EncounterSlot(snapshot, 1, role);
        slots.add(newSlot);
        showCards();
        rebuildCards();
        notifyRosterChanged();
    }

    public void setEncounter(Encounter enc) {
        if (enc == null || enc.slots() == null) return;
        slots.clear();
        for (EncounterSlot slot : enc.slots()) {
            slots.add(slot.copy());
        }
        if (slots.isEmpty()) { showPlaceholder(); return; }
        showCards();
        rebuildCards();
        notifyRosterChanged();
        if (enc.difficulty() != null) {
            currentDifficulty = enc.difficulty();
            difficultyLabel.setText(enc.difficulty());
            ThemeColors.applyDifficultyStyle(difficultyLabel, enc.difficulty());
        }
        if (enc.shapeLabel() != null) {
            currentShapeLabel = enc.shapeLabel();
            templateLabel.setText(enc.shapeLabel());
        }
    }

    public Encounter buildEncounter() {
        // Deep-copy slots so the returned Encounter is isolated from subsequent roster edits.
        List<EncounterSlot> copy = slots.stream()
                .map(EncounterSlot::copy)
                .collect(Collectors.toList());
        String freshDifficulty = encounterService.computeRosterDifficultyStats(copy, partySize, avgLevel).difficulty();
        return new Encounter(copy, freshDifficulty, avgLevel, partySize, 0, currentShapeLabel);
    }

    public List<EncounterSlot> getSlots() { return Collections.unmodifiableList(slots); }

    public void setPartyInfo(int partySize, int avgLevel) {
        this.partySize = partySize;
        this.avgLevel = avgLevel;
        notifyRosterChanged();
    }

    public boolean hasSlots() { return !slots.isEmpty(); }

    public void showGenerating() {
        placeholder.setText("Generiere Encounter...");
        showPlaceholder();
        placeholder.notifyAccessibleAttributeChanged(AccessibleAttribute.TEXT);
    }

    public void showGenerationFailed() {
        placeholder.setText("Generierung fehlgeschlagen. Nochmal versuchen.");
        showPlaceholder();
        placeholder.notifyAccessibleAttributeChanged(AccessibleAttribute.TEXT);
    }

    public void showGenerationFailed(String message) {
        placeholder.setText(message == null || message.isBlank()
                ? "Generierung fehlgeschlagen. Nochmal versuchen."
                : message);
        showPlaceholder();
        placeholder.notifyAccessibleAttributeChanged(AccessibleAttribute.TEXT);
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
        for (EncounterSlot slot : slots) {
            AtomicReference<CreatureCard> ref = new AtomicReference<>();
            CreatureCard card = new CreatureCard(toCardCreature(slot.getCreature()), slot.getCount(), slot.getRole(),
                    () -> {
                        if (slot.getCount() < encounterService.maxCreaturesPerSlot()) {
                            slot.incrementCount();
                            ref.get().updateCount(slot.getCount());
                            notifyRosterChanged();
                        }
                    },
                    () -> {
                        if (slot.getCount() > 1) {
                            slot.decrementCount();
                            ref.get().updateCount(slot.getCount());
                            notifyRosterChanged();
                        }
                    },
                    () -> removeSlot(slot, ref.get()));
            ref.set(card);
            card.setOnRequestStatBlock(onRequestStatBlock);
            cardList.getChildren().add(card);
        }
    }

    private void removeSlot(EncounterSlot slot, CreatureCard card) {
        int slotIndex = slots.indexOf(slot);
        if (slotIndex < 0) return;
        int cardIndex = cardList.getChildren().indexOf(card);
        slots.remove(slotIndex);
        notifyRosterChanged();
        if (slots.isEmpty()) showPlaceholder();
        if (cardIndex < 0) return;

        Label msg = new Label(slot.getCreature().getName() + " entfernt.");
        msg.getStyleClass().add("undo-toast-label");
        HBox.setHgrow(msg, Priority.ALWAYS);

        Button undoBtn = new Button("Rückgängig");
        undoBtn.getStyleClass().add("compact");

        HBox toast = new HBox(8, msg, undoBtn);
        toast.getStyleClass().add("undo-toast");
        toast.setAlignment(Pos.CENTER_LEFT);

        cardList.getChildren().set(cardIndex, toast);
        msg.notifyAccessibleAttributeChanged(AccessibleAttribute.TEXT);

        PauseTransition pause = new PauseTransition(Duration.seconds(5));
        pause.setOnFinished(e -> cardList.getChildren().remove(toast));

        undoBtn.setOnAction(e -> {
            pause.stop();
            int restoreIndex = Math.min(slotIndex, slots.size());
            slots.add(restoreIndex, slot);
            showCards();
            rebuildCards();
            notifyRosterChanged();
        });

        pause.play();
    }

    private static Creature toCardCreature(EncounterCreatureSnapshot snapshot) {
        Creature c = new Creature();
        c.Id = snapshot.getId();
        c.Name = snapshot.getName();
        c.XP = snapshot.getXp();
        c.HP = snapshot.getHp();
        c.AC = snapshot.getAc();
        c.InitiativeBonus = snapshot.getInitiativeBonus();
        c.CreatureType = snapshot.getCreatureType();
        c.CR = ChallengeRating.of(snapshot.getCrDisplay());
        return c;
    }

    private void notifyRosterChanged() {
        if (onRosterChanged != null) onRosterChanged.run();
    }

    public void updateSummary(XpCalculator.DifficultyStats ds) {
        if (ds == null) {
            difficultyMeter.update(0, 0, 0, 0, 0, "");
            clearLabels();
            difficultyLabel.setText(slots.isEmpty() ? "" : "Keine Party");
            ThemeColors.applyDifficultyStyle(difficultyLabel, null);
            levelLabel.setText(partySize > 0 ? "Party: " + partySize + ", Lv " + avgLevel : "");
            return;
        }
        difficultyMeter.update(ds.easyTh(), ds.mediumTh(), ds.hardTh(), ds.deadlyTh(), ds.adjXp(), ds.difficulty());
        easyThreshLabel.setText("Easy " + ds.easyTh());
        mediumThreshLabel.setText("Med. " + ds.mediumTh());
        hardThreshLabel.setText("Hard " + ds.hardTh());
        deadlyThreshLabel.setText("Deadly " + ds.deadlyTh());
        adjXpLabel.setText("Adj. XP: " + ds.adjXp());
        levelLabel.setText("Party: " + partySize + ", Lv " + avgLevel);
        currentDifficulty = ds.difficulty();
        difficultyLabel.setText(ds.difficulty());
        ThemeColors.applyDifficultyStyle(difficultyLabel, ds.difficulty());
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
