package ui;

import entities.CombatantState;
import entities.Creature;
import javafx.application.Platform;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.AccessibleRole;
import javafx.scene.control.*;
import javafx.scene.layout.*;
import services.CombatSetup;
import services.XpCalculator;

import java.util.ArrayList;
import java.util.List;
import java.util.function.Consumer;

/**
 * Inspector top section for combat mode.
 * Turn-order card list with HP bars, keyboard navigation, and inline HP editing.
 */
public class CombatTrackerPane extends VBox {

    private static final double HP_HEALTHY = 0.5;
    private static final double HP_CRITICAL = 0.25;
    private static final double BAR_WIDTH = 90;
    private static final double BAR_HEIGHT = 16;

    private final List<CombatantState> combatants = new ArrayList<>();
    private final VBox cardList;
    private final ScrollPane cardScroll;
    private final Label roundLabel;
    private final Button nextTurnButton;
    private final HBox endButtonContainer;

    private int currentTurn = 0;
    private int round = 1;
    private int focusedIndex = 0;

    private Consumer<Long> onRequestStatBlock;
    private Consumer<Long> onEnsureStatBlock;
    private Runnable onCombatStateChanged;
    private Runnable onEndCombat;

    public CombatTrackerPane() {
        setSpacing(0);

        // ---- Round header ----
        roundLabel = new Label("Runde 1");
        roundLabel.getStyleClass().add("title");
        roundLabel.setPadding(new Insets(8, 8, 4, 8));

        // ---- Card list ----
        cardList = new VBox(6);
        cardList.setPadding(new Insets(4, 8, 4, 8));

        cardScroll = new ScrollPane(cardList);
        cardScroll.setFitToWidth(true);
        cardScroll.setHbarPolicy(ScrollPane.ScrollBarPolicy.NEVER);
        VBox.setVgrow(cardScroll, Priority.ALWAYS);

        // ---- Turn controls ----
        nextTurnButton = new Button("\u25B6 Weiter");
        nextTurnButton.getStyleClass().add("accent");
        nextTurnButton.setTooltip(new Tooltip("Naechster Zug (Space)"));
        nextTurnButton.setMaxWidth(Double.MAX_VALUE);
        nextTurnButton.setOnAction(e -> nextTurn());

        endButtonContainer = new HBox(6);
        endButtonContainer.setAlignment(Pos.CENTER);
        showNormalEndButton();

        HBox turnRow = new HBox(8, nextTurnButton, endButtonContainer);
        turnRow.setPadding(new Insets(4, 8, 8, 8));
        HBox.setHgrow(nextTurnButton, Priority.ALWAYS);
        HBox.setHgrow(endButtonContainer, Priority.ALWAYS);

        getChildren().addAll(roundLabel, cardScroll, turnRow);
    }

    // ---- Public API ----

    public void setOnRequestStatBlock(Consumer<Long> callback) { this.onRequestStatBlock = callback; }
    public void setOnEnsureStatBlock(Consumer<Long> callback) { this.onEnsureStatBlock = callback; }
    public void setOnCombatStateChanged(Runnable callback) { this.onCombatStateChanged = callback; }
    public void setOnEndCombat(Runnable callback) { this.onEndCombat = callback; }

    /** Handle a combat keyboard shortcut. Returns true if the event was consumed. */
    public boolean handleCombatKey(javafx.scene.input.KeyEvent e) {
        if (e.isControlDown()) {
            switch (e.getCode()) {
                case D -> actOnFocusedMonster(this::duplicateCombatant);
                default -> { return false; }
            }
            return true;
        }
        switch (e.getCode()) {
            case SPACE, RIGHT -> nextTurn();
            case UP           -> moveFocus(-1);
            case DOWN         -> moveFocus(1);
            case ENTER        -> actOnFocusedMonster(cs -> {
                if (onRequestStatBlock != null && cs.CreatureRef != null)
                    onRequestStatBlock.accept(cs.CreatureRef.Id);
            });
            case F2           -> actOnFocusedMonster(this::editHp);
            case DELETE       -> actOnFocusedMonster(this::removeCombatant);
            default           -> { return false; }
        }
        return true;
    }

    public void startCombat(List<CombatantState> newCombatants) {
        combatants.clear();
        combatants.addAll(newCombatants);
        currentTurn = 0;
        round = 1;
        focusedIndex = 0;
        roundLabel.setText("Runde 1");
        buildAllCards();
        fireCombatStateChanged();
    }

    public int getRound() { return round; }

    public String getCurrentTurnName() {
        if (currentTurn >= 0 && currentTurn < combatants.size()) {
            return combatants.get(currentTurn).Name;
        }
        return null;
    }

    public List<CombatantState> getCombatants() { return combatants; }

    /** Compute live encounter stats from alive combatants. */
    public CombatStats computeStats(int partySize, int avgLevel) {
        int alive = 0, total = 0;
        for (CombatantState cs : combatants) {
            if (cs.IsPlayerCharacter || cs.CreatureRef == null) continue;
            total++;
            if (cs.CurrentHp > 0) alive++;
        }
        XpCalculator.DifficultyStats ds = CombatSetup.computeLiveStats(
                combatants, partySize, avgLevel);
        return new CombatStats(alive, total, ds.adjXp(), ds.difficulty(),
                ds.easyTh(), ds.mediumTh(), ds.hardTh(), ds.deadlyTh());
    }

    public record CombatStats(int alive, int total, int adjXp, String difficulty,
                               int easyTh, int mediumTh, int hardTh, int deadlyTh) {}

    public void addReinforcement(Creature creature) {
        CombatantState cs = CombatSetup.createReinforcement(creature);
        cs.Name = uniqueNameFor(creature);
        insertCombatant(cs);
    }

    // ---- Card building ----

    private void buildAllCards() {
        cardList.getChildren().clear();
        for (int i = 0; i < combatants.size(); i++) {
            VBox card = buildCard(combatants.get(i), i);
            card.setFocusTraversable(true);
            cardList.getChildren().add(card);
        }
        updateFocus();
    }

    private void rebuildCard(int index) {
        if (index < 0 || index >= combatants.size()) return;
        VBox card = buildCard(combatants.get(index), index);
        card.setFocusTraversable(true);
        cardList.getChildren().set(index, card);
    }

    /**
     * Updates only the ordinal turn-indicator label for a shifted, inactive card.
     * Much cheaper than rebuildCard — avoids recreating all child nodes.
     * Card structure: VBox → [HBox topRow → [Label turnInd, ...], ...]
     */
    private void updateCardOrdinal(int index) {
        if (index < 0 || index >= cardList.getChildren().size()) return;
        VBox card = (VBox) cardList.getChildren().get(index);
        HBox topRow = (HBox) card.getChildren().get(0);
        Label indicator = (Label) topRow.getChildren().get(0);
        indicator.setText(String.valueOf(index + 1));
    }

    private VBox buildCard(CombatantState cs, int index) {
        boolean isActive = (index == currentTurn);
        boolean isDead = !cs.IsPlayerCharacter && cs.CurrentHp <= 0;

        VBox card = new VBox(4);
        card.getStyleClass().add("combat-card");
        if (isActive) card.getStyleClass().add("combat-card-active");
        else if (isDead) card.getStyleClass().add("combat-card-dead");
        else if (cs.IsPlayerCharacter) card.getStyleClass().add("combat-card-pc");

        card.getChildren().add(buildTopRow(cs, index, isActive, isDead));

        if (!cs.IsPlayerCharacter && cs.CreatureRef != null && !isDead) {
            HBox detail = new HBox(8);
            detail.setPadding(new Insets(0, 0, 0, 32));
            String text = "CR " + cs.CreatureRef.CR;
            if (cs.CreatureRef.CreatureType != null && !cs.CreatureRef.CreatureType.isBlank())
                text += "  |  " + cs.CreatureRef.CreatureType;
            Label d = new Label(text);
            d.getStyleClass().add("combat-detail");
            detail.getChildren().add(d);
            card.getChildren().add(detail);
        }

        attachContextMenu(card, cs, isDead);
        return card;
    }

    private HBox buildTopRow(CombatantState cs, int index, boolean isActive, boolean isDead) {
        HBox topRow = new HBox(8);
        topRow.setAlignment(Pos.CENTER_LEFT);

        Label turnInd = new Label(isActive ? "\u25B6" : String.valueOf(index + 1));
        turnInd.getStyleClass().add(isActive ? "combat-turn-indicator" : "combat-turn-indicator-inactive");

        Label nameLabel = new Label(isDead ? "\u2620 " + cs.Name : cs.Name);
        nameLabel.getStyleClass().add("combat-name");
        if (isDead) {
            nameLabel.getStyleClass().add("combat-name-dead");
        } else if (!cs.IsPlayerCharacter) {
            nameLabel.getStyleClass().add("creature-link");
            nameLabel.setOnMouseClicked(e -> {
                if (onRequestStatBlock != null && cs.CreatureRef != null)
                    onRequestStatBlock.accept(cs.CreatureRef.Id);
            });
            nameLabel.setAccessibleRole(AccessibleRole.HYPERLINK);
            nameLabel.setAccessibleText("Stat Block: " + cs.Name);
        }

        Region spacer = new Region();
        HBox.setHgrow(spacer, Priority.ALWAYS);
        topRow.getChildren().addAll(turnInd, nameLabel, spacer);

        if (!cs.IsPlayerCharacter) {
            StackPane hpBar = buildHpBar(cs);
            hpBar.setOnMouseClicked(e -> { editHp(cs); e.consume(); });
            hpBar.getStyleClass().add("clickable");

            Label acBadge = new Label("AC " + cs.Ac);
            acBadge.getStyleClass().add("ac-badge");
            acBadge.setMinWidth(Region.USE_PREF_SIZE);
            topRow.getChildren().addAll(hpBar, acBadge);
        }

        Label initLabel = new Label("Init " + cs.Initiative);
        initLabel.getStyleClass().add("init-badge");
        initLabel.setMinWidth(Region.USE_PREF_SIZE);
        topRow.getChildren().add(initLabel);

        return topRow;
    }

    private void attachContextMenu(VBox card, CombatantState cs, boolean isDead) {
        if (cs.IsPlayerCharacter || isDead) return;
        ContextMenu menu = new ContextMenu();
        MenuItem dup = new MenuItem("Duplizieren");
        dup.setOnAction(e -> duplicateCombatant(cs));
        MenuItem rem = new MenuItem("Entfernen");
        rem.setOnAction(e -> removeCombatant(cs));
        menu.getItems().addAll(dup, new SeparatorMenuItem(), rem);
        card.setOnContextMenuRequested(e -> menu.show(card, e.getScreenX(), e.getScreenY()));
    }

    private StackPane buildHpBar(CombatantState cs) {
        double frac = cs.MaxHp > 0 ? Math.max(0, Math.min(1, (double) cs.CurrentHp / cs.MaxHp)) : 0;

        Region track = new Region();
        track.getStyleClass().add("hp-bar-track");
        track.setPrefSize(BAR_WIDTH, BAR_HEIGHT);
        track.setMaxWidth(BAR_WIDTH);

        Region fill = new Region();
        fill.getStyleClass().add("hp-bar-fill");
        fill.setPrefSize(BAR_WIDTH * frac, BAR_HEIGHT);
        fill.setMaxSize(BAR_WIDTH * frac, BAR_HEIGHT);
        if (frac > HP_HEALTHY) fill.getStyleClass().add("hp-fill-healthy");
        else if (frac > HP_CRITICAL) fill.getStyleClass().add("hp-fill-wounded");
        else fill.getStyleClass().add("hp-fill-critical");

        Label hpText = new Label(cs.CurrentHp + " / " + cs.MaxHp);
        hpText.getStyleClass().add("hp-bar-text");
        // Apply dark text for healthy (green) and wounded (yellow) states — both have sufficient
        // luminance for dark text; only critical/dead (red) uses the default light text.
        if (frac > HP_CRITICAL) hpText.getStyleClass().add("hp-text-dark");

        StackPane bar = new StackPane(track, fill, hpText);
        bar.setAlignment(Pos.CENTER_LEFT);
        StackPane.setAlignment(fill, Pos.CENTER_LEFT);
        StackPane.setAlignment(hpText, Pos.CENTER);
        bar.setMaxWidth(BAR_WIDTH);
        bar.setPrefWidth(BAR_WIDTH);
        bar.setFocusTraversable(true);
        bar.setAccessibleRole(AccessibleRole.BUTTON);
        bar.setAccessibleText(cs.Name + " HP bearbeiten: " + cs.CurrentHp + "/" + cs.MaxHp);
        bar.setOnKeyPressed(e -> {
            if (e.getCode() == javafx.scene.input.KeyCode.ENTER
                    || e.getCode() == javafx.scene.input.KeyCode.SPACE) {
                editHp(cs);
                e.consume();
            }
        });
        return bar;
    }

    // ---- Turn logic ----

    private void nextTurn() {
        if (combatants.isEmpty()) return;
        int oldTurn = currentTurn;
        int checked = 0;
        do {
            currentTurn = (currentTurn + 1) % combatants.size();
            if (currentTurn == 0) { round++; roundLabel.setText("Runde " + round); }
            checked++;
            if (checked > combatants.size()) break; // Safety: break after full cycle when all combatants are dead
        } while (!combatants.get(currentTurn).IsPlayerCharacter
                && combatants.get(currentTurn).CurrentHp <= 0);

        focusedIndex = currentTurn;
        rebuildCard(oldTurn);
        rebuildCard(currentTurn);
        updateFocus();
        fireCombatStateChanged();

        // Auto-show stat block for active monster (non-toggling)
        CombatantState active = combatants.get(currentTurn);
        if (!active.IsPlayerCharacter && active.CreatureRef != null && onEnsureStatBlock != null) {
            onEnsureStatBlock.accept(active.CreatureRef.Id);
        }
    }

    private void moveFocus(int delta) {
        if (combatants.isEmpty()) return;
        focusedIndex = Math.max(0, Math.min(combatants.size() - 1, focusedIndex + delta));
        updateFocus();
    }

    private void updateFocus() {
        if (focusedIndex < 0 || focusedIndex >= cardList.getChildren().size()) return;
        final int idx = focusedIndex;
        VBox card = (VBox) cardList.getChildren().get(idx);
        Platform.runLater(() -> {
            card.requestFocus();
            if (!combatants.isEmpty())
                cardScroll.setVvalue((double) idx / combatants.size());
        });
    }

    private CombatantState getFocused() {
        return (focusedIndex >= 0 && focusedIndex < combatants.size()) ? combatants.get(focusedIndex) : null;
    }

    private void actOnFocusedMonster(Consumer<CombatantState> action) {
        CombatantState cs = getFocused();
        if (cs != null && !cs.IsPlayerCharacter) action.accept(cs);
    }

    // ---- HP edit ----

    private void editHp(CombatantState c) {
        int index = combatants.indexOf(c);
        if (index < 0 || index >= cardList.getChildren().size()) return;
        VBox card = (VBox) cardList.getChildren().get(index);

        TextField field = new TextField();
        field.setPromptText("\u00b1 HP");
        field.setPrefWidth(70);
        field.getStyleClass().add("quick-search-field");

        Label hint = new Label(c.Name + " " + c.CurrentHp + "/" + c.MaxHp);
        hint.getStyleClass().add("text-muted");

        HBox editRow = new HBox(6, hint, field);
        editRow.setAlignment(Pos.CENTER_LEFT);
        editRow.setPadding(new Insets(2, 0, 2, 32));

        card.getChildren().add(1, editRow);
        field.requestFocus();

        final boolean[] committed = {false};
        Runnable commit = () -> {
            if (committed[0]) return;
            committed[0] = true;
            String input = field.getText().trim();
            card.getChildren().remove(editRow);
            if (!input.isEmpty()) {
                try {
                    int delta = Integer.parseInt(input);
                    c.CurrentHp = Math.max(0, Math.min(c.MaxHp, c.CurrentHp + delta));
                    rebuildCard(index);
                    updateFocus();
                    fireCombatStateChanged();
                } catch (NumberFormatException ignored) {}
            }
        };
        field.setOnAction(e -> commit.run());
        field.focusedProperty().addListener((obs, old, focused) -> {
            if (!focused) commit.run();
        });
    }

    // ---- Reinforcements ----

    private void duplicateCombatant(CombatantState original) {
        if (original.CreatureRef == null) return;
        CombatantState clone = CombatSetup.createReinforcement(original.CreatureRef);
        clone.Name = uniqueNameFor(original.CreatureRef);
        insertCombatant(clone);
    }

    private String uniqueNameFor(Creature creature) {
        long count = combatants.stream()
                .filter(c -> c.CreatureRef != null && c.CreatureRef.Id.equals(creature.Id))
                .count();
        return count > 0 ? creature.Name + " #" + (count + 1) : creature.Name;
    }

    private void insertCombatant(CombatantState cs) {
        int insertIndex = combatants.size();
        for (int i = 0; i < combatants.size(); i++) {
            if (cs.Initiative > combatants.get(i).Initiative) { insertIndex = i; break; }
        }
        combatants.add(insertIndex, cs);
        if (insertIndex <= currentTurn) currentTurn++;

        VBox card = buildCard(cs, insertIndex);
        card.setFocusTraversable(true);
        cardList.getChildren().add(insertIndex, card);
        // Update ordinals for shifted inactive cards; skip the active card (shows "▶", no number).
        for (int i = insertIndex + 1; i < combatants.size(); i++) {
            if (i != currentTurn) updateCardOrdinal(i);
        }
        updateFocus();
        fireCombatStateChanged();
    }

    private void removeCombatant(CombatantState cs) {
        int index = combatants.indexOf(cs);
        if (index < 0) return;
        combatants.remove(index);
        cardList.getChildren().remove(index);
        if (index < currentTurn) currentTurn--;
        else if (index == currentTurn && currentTurn >= combatants.size()) currentTurn = 0;
        if (focusedIndex >= combatants.size()) focusedIndex = Math.max(0, combatants.size() - 1);
        // Update ordinals for shifted inactive cards; skip the active card (shows "▶", no number).
        for (int i = index; i < combatants.size(); i++) {
            if (i != currentTurn) updateCardOrdinal(i);
        }
        updateFocus();
        fireCombatStateChanged();
    }

    // ---- Two-phase end combat ----

    private void showNormalEndButton() {
        endButtonContainer.getChildren().clear();
        Button endBtn = new Button("Kampf beenden");
        endBtn.setMaxWidth(Double.MAX_VALUE);
        HBox.setHgrow(endBtn, Priority.ALWAYS);
        endBtn.setOnAction(e -> showConfirmEndButtons());
        endButtonContainer.getChildren().add(endBtn);
    }

    private void showConfirmEndButtons() {
        endButtonContainer.getChildren().clear();
        Button cancelBtn = new Button("Abbruch");
        Button confirmBtn = new Button("Bestaetigen!");
        confirmBtn.getStyleClass().add("accent");
        HBox.setHgrow(cancelBtn, Priority.ALWAYS);
        HBox.setHgrow(confirmBtn, Priority.ALWAYS);
        cancelBtn.setMaxWidth(Double.MAX_VALUE);
        confirmBtn.setMaxWidth(Double.MAX_VALUE);
        cancelBtn.setOnAction(e -> showNormalEndButton());
        confirmBtn.setOnAction(e -> {
            showNormalEndButton();
            if (onEndCombat != null) onEndCombat.run();
        });
        endButtonContainer.getChildren().addAll(cancelBtn, confirmBtn);
    }

    private void fireCombatStateChanged() {
        if (onCombatStateChanged != null) onCombatStateChanged.run();
    }
}
