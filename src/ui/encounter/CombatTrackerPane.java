package ui.encounter;

import entities.Combatant;
import entities.Creature;
import entities.MonsterCombatant;
import entities.PcCombatant;
import javafx.application.Platform;
import javafx.geometry.Bounds;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.AccessibleRole;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.ContextMenu;
import javafx.scene.control.Label;
import javafx.scene.control.MenuItem;
import javafx.scene.control.ScrollPane;
import javafx.scene.control.SeparatorMenuItem;
import javafx.scene.control.TextField;
import javafx.scene.control.TextFormatter;
import javafx.scene.control.Tooltip;
import javafx.scene.input.KeyCombination;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.StackPane;
import javafx.scene.layout.VBox;
import javafx.stage.Popup;
import services.CombatSetup;
import services.XpCalculator;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.function.Consumer;

/**
 * ScenePane content for combat mode.
 * Turn-order card list with HP bars, keyboard navigation, and inline HP/initiative editing.
 * Pushed into ScenePane (lower right) by EncounterView.startCombat() and switchMode().
 */
public class CombatTrackerPane extends VBox {

    // HP bar color thresholds: green above HEALTHY, yellow between, red below CRITICAL
    private static final double HP_HEALTHY = 0.5;   // >= 50% HP: healthy (green)
    private static final double HP_CRITICAL = 0.25;  // < 25% HP: critical (red)
    private static final double BAR_WIDTH = 90;
    private static final double BAR_HEIGHT = 24;  // min 24px touch target (WCAG 2.5.8)

    private final List<Combatant> combatants = new ArrayList<>();
    private final List<Label> turnIndicators = new ArrayList<>();
    private final VBox cardList;
    private final ScrollPane cardScroll;
    private final Label roundLabel;
    private final Label statusBar;
    private final Button nextTurnButton;
    private final HBox endButtonContainer;

    private int currentTurn = 0;
    private int round = 1;
    private int focusedIndex = 0;

    private Consumer<Long> onRequestStatBlock;
    private Consumer<Long> onEnsureStatBlock;
    private Runnable onCombatStateChanged;
    private Runnable onEndCombat;
    private Button endCombatButton; // set in showNormalEndButton(), cleared when confirm buttons are shown

    public CombatTrackerPane() {
        setSpacing(0);

        // ---- Round header + status bar ----
        roundLabel = new Label("Runde 1");
        roundLabel.getStyleClass().add("title");
        roundLabel.setPadding(new Insets(8, 8, 2, 8));

        statusBar = new Label();
        statusBar.getStyleClass().add("text-secondary");
        statusBar.setPadding(new Insets(0, 8, 4, 8));

        // ---- Card list ----
        cardList = new VBox(6);
        cardList.setPadding(new Insets(4, 8, 4, 8));

        cardScroll = new ScrollPane(cardList);
        cardScroll.setFitToWidth(true);
        cardScroll.setHbarPolicy(ScrollPane.ScrollBarPolicy.NEVER);
        VBox.setVgrow(cardScroll, Priority.ALWAYS);

        // ---- Turn controls ----
        nextTurnButton = new Button("\u25B6 _Weiter");
        nextTurnButton.getStyleClass().add("accent");
        nextTurnButton.setTooltip(new Tooltip("N\u00e4chster Zug (Space)"));
        nextTurnButton.setMaxWidth(Double.MAX_VALUE);
        nextTurnButton.setOnAction(e -> nextTurn());

        endButtonContainer = new HBox(6);
        endButtonContainer.setAlignment(Pos.CENTER);
        showNormalEndButton();

        HBox turnRow = new HBox(8, nextTurnButton, endButtonContainer);
        turnRow.setPadding(new Insets(4, 8, 8, 8));
        HBox.setHgrow(nextTurnButton, Priority.ALWAYS);
        HBox.setHgrow(endButtonContainer, Priority.ALWAYS);

        getChildren().addAll(roundLabel, statusBar, cardScroll, turnRow);
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
            case ENTER        -> actOnFocusedMonster(mc -> {
                if (onRequestStatBlock != null && mc.CreatureRef != null)
                    onRequestStatBlock.accept(mc.CreatureRef.Id);
            });
            case F2           -> {
                if (focusedIndex < cardList.getChildren().size())
                    actOnFocusedMonster(mc -> showHpPopup(cardList.getChildren().get(focusedIndex), mc));
            }
            case I            -> {
                Combatant cs = getFocused();
                if (cs != null && focusedIndex < cardList.getChildren().size())
                    showInitiativePopup(cardList.getChildren().get(focusedIndex), cs);
            }
            case DELETE       -> actOnFocusedMonster(mc -> removeCombatant(mc));
            default           -> { return false; }
        }
        return true;
    }

    public void startCombat(List<Combatant> newCombatants) {
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

    /** Update round label and status bar. Sole writer of roundLabel. Called by EncounterView after each combat state change. */
    public void updateStatusBar(XpCalculator.DifficultyStats ds, int alive, int total, int round) {
        roundLabel.setText("Runde " + round);
        statusBar.setText(alive + "/" + total + " \u2022 " + ds.difficulty());
    }

    public String getCurrentTurnName() {
        if (currentTurn >= 0 && currentTurn < combatants.size()) {
            return combatants.get(currentTurn).Name;
        }
        return null;
    }

    public List<Combatant> getCombatants() { return Collections.unmodifiableList(combatants); }

    public void addReinforcement(Creature creature) {
        MonsterCombatant mc = CombatSetup.createReinforcement(creature);
        mc.Name = CombatSetup.uniqueNameFor(creature, combatants);
        insertCombatant(mc);
    }

    // ---- Card building ----

    private void buildAllCards() {
        cardList.getChildren().clear();
        turnIndicators.clear();
        for (int i = 0; i < combatants.size(); i++) {
            CardResult cr = buildCard(combatants.get(i), i);
            cr.card().setFocusTraversable(true);
            cardList.getChildren().add(cr.card());
            turnIndicators.add(cr.turnIndicator());
        }
        updateFocus();
    }

    private void rebuildCard(int index) {
        if (index < 0 || index >= combatants.size()) return;
        CardResult cr = buildCard(combatants.get(index), index);
        cr.card().setFocusTraversable(true);
        cardList.getChildren().set(index, cr.card());
        turnIndicators.set(index, cr.turnIndicator());
    }

    /**
     * Updates only the active-state styling for a card: CSS class swap and turn-indicator label.
     * Much cheaper than rebuildCard — avoids reconstructing all child nodes.
     * Safe to call only for turn advances where no structural change occurred (HP not updated, not killed).
     */
    private void updateCardActiveState(int index, boolean becomeActive) {
        if (index < 0 || index >= combatants.size()) return;
        Combatant cs = combatants.get(index);
        boolean isDead = !cs.isAlive();
        VBox card = (VBox) cardList.getChildren().get(index);
        card.getStyleClass().removeAll("combat-card-active", "combat-card-dead", "combat-card-pc");
        if (becomeActive) card.getStyleClass().add("combat-card-active");
        else if (isDead) card.getStyleClass().add("combat-card-dead");
        else if (cs instanceof PcCombatant) card.getStyleClass().add("combat-card-pc");
        Label ind = turnIndicators.get(index);
        ind.setText(becomeActive ? "\u25B6 " + (index + 1) : String.valueOf(index + 1));
        ind.getStyleClass().removeAll("combat-turn-indicator", "combat-turn-indicator-inactive");
        ind.getStyleClass().add(becomeActive ? "combat-turn-indicator" : "combat-turn-indicator-inactive");
    }

    /**
     * Updates only the ordinal turn-indicator label for a shifted, inactive card.
     * Much cheaper than rebuildCard — avoids recreating all child nodes.
     * Each card stores its turn-indicator Label in {@code userData}; see {@link #buildCard}.
     */
    private void updateCardOrdinal(int index) {
        if (index < 0 || index >= cardList.getChildren().size()) return;
        getTurnIndicator(index).setText(String.valueOf(index + 1));
    }

    /** Returns the turn-indicator Label for the card at the given index. */
    private Label getTurnIndicator(int index) {
        return turnIndicators.get(index);
    }

    private record TopRowResult(HBox row, Label turnIndicator) {}
    private record CardResult(VBox card, Label turnIndicator) {}

    private CardResult buildCard(Combatant cs, int index) {
        boolean isActive = (index == currentTurn);
        boolean isDead = !cs.isAlive();

        VBox card = new VBox(4);
        card.getStyleClass().add("combat-card");
        if (isActive) card.getStyleClass().add("combat-card-active");
        else if (isDead) card.getStyleClass().add("combat-card-dead");
        else if (cs instanceof PcCombatant) card.getStyleClass().add("combat-card-pc");

        TopRowResult topRow = buildTopRow(cs, index, isActive, isDead);
        card.getChildren().add(topRow.row());

        if (cs instanceof MonsterCombatant mc && !isDead) {
            HBox detail = new HBox(8);
            detail.setPadding(new Insets(0, 0, 0, 32));
            String text = "CR " + mc.CreatureRef.CR.display;
            if (mc.CreatureRef.CreatureType != null && !mc.CreatureRef.CreatureType.isBlank())
                text += "  |  " + mc.CreatureRef.CreatureType;
            Label d = new Label(text);
            d.getStyleClass().add("combat-detail");
            detail.getChildren().add(d);
            card.getChildren().add(detail);
        }

        if (cs instanceof MonsterCombatant mc) attachContextMenu(card, mc, isDead);
        return new CardResult(card, topRow.turnIndicator());
    }

    private TopRowResult buildTopRow(Combatant cs, int index, boolean isActive, boolean isDead) {
        HBox topRow = new HBox(8);
        topRow.setAlignment(Pos.CENTER_LEFT);

        Label turnInd = new Label(isActive ? "\u25B6 " + (index + 1) : String.valueOf(index + 1));
        turnInd.getStyleClass().add(isActive ? "combat-turn-indicator" : "combat-turn-indicator-inactive");

        // Use Button for interactive monster names so the native :focused CSS pseudo-state provides
        // a proper focus ring. Dead/PC names are non-interactive and remain Labels.
        javafx.scene.Node nameNode;
        if (!isDead && cs instanceof MonsterCombatant mc) {
            Button nameBtn = new Button(cs.Name);
            nameBtn.getStyleClass().addAll("combat-name", "creature-link");
            nameBtn.setAccessibleText("Stat Block \u00f6ffnen: " + cs.Name);
            nameBtn.setOnAction(e -> {
                if (onRequestStatBlock != null && mc.CreatureRef != null)
                    onRequestStatBlock.accept(mc.CreatureRef.Id);
            });
            nameNode = nameBtn;
        } else {
            Label nameLabel = new Label(isDead ? "\u2620 " + cs.Name : cs.Name);
            nameLabel.getStyleClass().add("combat-name");
            if (isDead) nameLabel.getStyleClass().add("combat-name-dead");
            nameNode = nameLabel;
        }

        Region spacer = new Region();
        HBox.setHgrow(spacer, Priority.ALWAYS);
        topRow.getChildren().addAll(turnInd, nameNode, spacer);

        if (cs instanceof MonsterCombatant mc) {
            StackPane hpBar = buildHpBar(mc);
            hpBar.setOnMouseClicked(e -> { showHpPopup(hpBar, mc); e.consume(); });
            hpBar.getStyleClass().add("clickable");

            Label acBadge = new Label("AC " + mc.AC);
            acBadge.getStyleClass().add("ac-badge");
            acBadge.setMinWidth(Region.USE_PREF_SIZE);
            topRow.getChildren().addAll(hpBar, acBadge);
        }

        // Button for initiative badge: native :focused state gives proper focus ring
        Button initBtn = new Button("Init " + cs.Initiative);
        initBtn.getStyleClass().add("init-badge");
        initBtn.setMinWidth(Region.USE_PREF_SIZE);
        initBtn.setTooltip(new Tooltip("Initiative bearbeiten (Klick oder I)"));
        initBtn.setAccessibleText("Initiative bearbeiten: " + cs.Initiative);
        initBtn.setOnAction(e -> showInitiativePopup(initBtn, cs));
        topRow.getChildren().add(initBtn);

        return new TopRowResult(topRow, turnInd);
    }

    private void attachContextMenu(VBox card, MonsterCombatant mc, boolean isDead) {
        if (isDead) return;
        ContextMenu menu = new ContextMenu();
        MenuItem dup = new MenuItem("Duplizieren");
        dup.setAccelerator(KeyCombination.keyCombination("Ctrl+D"));
        dup.setOnAction(e -> duplicateCombatant(mc));
        MenuItem rem = new MenuItem("Entfernen");
        rem.setAccelerator(KeyCombination.keyCombination("Delete"));
        rem.setOnAction(e -> removeCombatant(mc));
        menu.getItems().addAll(dup, new SeparatorMenuItem(), rem);
        card.setOnContextMenuRequested(e -> menu.show(card, e.getScreenX(), e.getScreenY()));
    }

    private StackPane buildHpBar(MonsterCombatant mc) {
        double frac = mc.MaxHp > 0 ? Math.max(0, Math.min(1, (double) mc.CurrentHp / mc.MaxHp)) : 0;

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

        // "! " prefix is the non-color redundant cue for critical state (WCAG 1.4.1)
        Label hpText = new Label((frac <= HP_CRITICAL ? "! " : "") + mc.CurrentHp + " / " + mc.MaxHp);
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
        bar.setFocusTraversable(false);
        bar.setAccessibleRole(AccessibleRole.TEXT);  // non-focusable — use TEXT, not BUTTON (WCAG 4.1.2)
        bar.setAccessibleText(mc.Name + " HP bearbeiten: " + mc.CurrentHp + "/" + mc.MaxHp);
        Tooltip.install(bar, new Tooltip("HP bearbeiten (Klick oder F2)"));
        return bar;
    }

    // ---- Turn logic ----

    private void nextTurn() {
        if (combatants.isEmpty()) return;
        int oldTurn = currentTurn;
        int checked = 0;
        do {
            currentTurn = (currentTurn + 1) % combatants.size();
            if (currentTurn == 0) round++; // new round each time the initiative order wraps fully
            checked++;
            if (checked > combatants.size()) break; // Safety: all combatants dead — break to avoid infinite loop.
                                                     // currentTurn is left at the last-checked position (which is dead);
                                                     // UI reflects this by showing all cards as dead.
        } while (!combatants.get(currentTurn).isAlive());

        focusedIndex = currentTurn;
        updateCardActiveState(oldTurn, false);
        updateCardActiveState(currentTurn, true);
        updateFocus();
        fireCombatStateChanged();

        // Auto-show stat block for active monster (non-toggling)
        Combatant active = combatants.get(currentTurn);
        if (active instanceof MonsterCombatant mc && mc.CreatureRef != null && onEnsureStatBlock != null) {
            onEnsureStatBlock.accept(mc.CreatureRef.Id);
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
            if (!combatants.isEmpty()) {
                double cardTop    = card.getBoundsInParent().getMinY();
                double cardHeight = card.getBoundsInParent().getHeight();
                double listHeight = cardList.getHeight();
                double viewHeight = cardScroll.getViewportBounds().getHeight();
                double scrollRange = listHeight - viewHeight;
                if (scrollRange > 0) {
                    double target = cardTop + cardHeight / 2.0 - viewHeight / 2.0;
                    cardScroll.setVvalue(Math.max(0.0, Math.min(1.0, target / scrollRange)));
                }
            }
        });
    }

    private Combatant getFocused() {
        return (focusedIndex >= 0 && focusedIndex < combatants.size()) ? combatants.get(focusedIndex) : null;
    }

    private void actOnFocusedMonster(Consumer<MonsterCombatant> action) {
        Combatant cb = getFocused();
        if (cb instanceof MonsterCombatant mc) action.accept(mc);
    }

    // ---- HP / Initiative popup edit ----

    private void applyHpChange(int index) {
        rebuildCard(index);
        updateFocus();
        fireCombatStateChanged();
    }

    private void showHpPopup(Node anchor, MonsterCombatant mc) {
        int index = combatants.indexOf(mc);
        int[] value = {1};
        SpinnerParts sp = buildSpinner(1, value);
        sp.field().setAccessibleText("Schaden oder Heilung eingeben");
        Popup popup = new Popup();
        popup.setAutoHide(true);
        Button damageBtn = new Button("\u2212");
        damageBtn.setDefaultButton(true);
        Button healBtn = new Button("+");
        damageBtn.setOnAction(e -> {
            int v = parseOrDefault(sp.field().getText(), value[0]);
            popup.hide(); mc.CurrentHp = Math.max(0, mc.CurrentHp - v); applyHpChange(index);
        });
        healBtn.setOnAction(e -> {
            int v = parseOrDefault(sp.field().getText(), value[0]);
            popup.hide(); mc.CurrentHp = Math.min(mc.MaxHp, mc.CurrentHp + v); applyHpChange(index);
        });
        // No setOnAction on sp.field() — Enter activates damageBtn (defaultButton=true).
        // Keeping the default button consistent avoids the ambiguity of Enter meaning damage
        // when the user may have intended healing.
        showAtAnchor(popup, anchor,
                buildPopupContent(sp.dec(), sp.field(), sp.inc(), damageBtn, healBtn),
                sp.field());
    }

    private void showInitiativePopup(Node anchor, Combatant c) {
        int[] value = {c.Initiative};
        SpinnerParts sp = buildSpinner(c.Initiative, value);
        sp.field().setAccessibleText("Initiative eingeben");
        Popup popup = new Popup();
        popup.setAutoHide(true);
        Button setBtn = new Button("\u2713 Setzen");
        setBtn.getStyleClass().add("accent");
        setBtn.setOnAction(e -> {
            int v = parseOrDefault(sp.field().getText(), value[0]);
            popup.hide(); c.Initiative = v; resortAndRebuild();
        });
        sp.field().setOnAction(e -> {
            int v = parseOrDefault(sp.field().getText(), value[0]);
            popup.hide(); c.Initiative = v; resortAndRebuild();
        });
        showAtAnchor(popup, anchor,
                buildPopupContent(sp.dec(), sp.field(), sp.inc(), setBtn),
                sp.field());
    }

    /** Shared spinner controls (dec button, text field, inc button) for HP and initiative popups. */
    private record SpinnerParts(Button dec, TextField field, Button inc) {}

    private SpinnerParts buildSpinner(int initial, int[] value) {
        TextField field = new TextField(String.valueOf(initial));
        field.setPrefWidth(56);
        field.getStyleClass().add("quick-search-field");
        field.setTextFormatter(new TextFormatter<>(change ->
                change.getText().matches("[0-9-]*") ? change : null));
        Button dec = new Button("\u25BC");
        Button inc = new Button("\u25B2");
        dec.getStyleClass().add("spinner-btn");
        inc.getStyleClass().add("spinner-btn");
        dec.setFocusTraversable(false);
        inc.setFocusTraversable(false);
        dec.setOnAction(e -> { value[0] = parseOrDefault(field.getText(), value[0]) - 1;
                                field.setText(String.valueOf(value[0])); });
        inc.setOnAction(e -> { value[0] = parseOrDefault(field.getText(), value[0]) + 1;
                                field.setText(String.valueOf(value[0])); });
        return new SpinnerParts(dec, field, inc);
    }

    private HBox buildPopupContent(javafx.scene.Node... children) {
        HBox content = new HBox();
        content.getStyleClass().add("edit-popup-panel");
        content.setAlignment(Pos.CENTER_LEFT);
        content.getChildren().addAll(children);
        return content;
    }

    private void showAtAnchor(Popup popup, Node anchor, HBox content, TextField focus) {
        popup.getContent().add(content);
        Bounds bounds = anchor.localToScreen(anchor.getBoundsInLocal());
        if (bounds != null) popup.show(anchor, bounds.getMinX(), bounds.getMaxY() + 8);
        Platform.runLater(focus::requestFocus);
    }

    private int parseOrDefault(String text, int def) {
        try { return Integer.parseInt(text.trim()); } catch (NumberFormatException e) { return def; }
    }

    private void resortAndRebuild() {
        Combatant activeCombatant = combatants.isEmpty() ? null : combatants.get(currentTurn);
        Combatant focusedCombatant = (focusedIndex >= 0 && focusedIndex < combatants.size())
                ? combatants.get(focusedIndex) : null;

        combatants.sort((a, b) -> {
            if (b.Initiative != a.Initiative) return b.Initiative - a.Initiative;
            return Boolean.compare(b instanceof PcCombatant, a instanceof PcCombatant); // PCs win ties
        });

        // indexOf uses reference equality (Combatant does not override equals()),
        // so two combatants with the same creature name are correctly distinguished.
        currentTurn = activeCombatant != null ? Math.max(0, combatants.indexOf(activeCombatant)) : 0;
        focusedIndex = focusedCombatant != null ? Math.max(0, combatants.indexOf(focusedCombatant)) : 0;
        buildAllCards();
        fireCombatStateChanged();
    }

    // ---- Reinforcements ----

    private void duplicateCombatant(MonsterCombatant original) {
        MonsterCombatant clone = CombatSetup.createReinforcement(original.CreatureRef);
        clone.Name = CombatSetup.uniqueNameFor(original.CreatureRef, combatants);
        insertCombatant(clone);
    }

    private void insertCombatant(Combatant cs) {
        int insertIndex = combatants.size();
        for (int i = 0; i < combatants.size(); i++) {
            if (cs.Initiative > combatants.get(i).Initiative) { insertIndex = i; break; }
        }
        combatants.add(insertIndex, cs);
        if (insertIndex <= currentTurn) currentTurn++;

        CardResult cr = buildCard(cs, insertIndex);
        cr.card().setFocusTraversable(true);
        cardList.getChildren().add(insertIndex, cr.card());
        turnIndicators.add(insertIndex, cr.turnIndicator());
        // Update ordinals for shifted inactive cards; skip the active card (shows "▶", no number).
        for (int i = insertIndex + 1; i < combatants.size(); i++) {
            if (i != currentTurn) updateCardOrdinal(i);
        }
        updateFocus();
        fireCombatStateChanged();
    }

    private void removeCombatant(Combatant cs) {
        int index = combatants.indexOf(cs);
        if (index < 0) return;
        combatants.remove(index);
        cardList.getChildren().remove(index);
        turnIndicators.remove(index);
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

    /** Highlights the end-combat button when all enemies are dead. Called by EncounterView. */
    public void signalAllEnemiesDead(boolean allDead) {
        if (endCombatButton == null) return;
        if (allDead) endCombatButton.getStyleClass().add("accent");
        else endCombatButton.getStyleClass().remove("accent");
    }

    private void showNormalEndButton() {
        endButtonContainer.getChildren().clear();
        endCombatButton = new Button("_Kampf beenden");
        endCombatButton.setMaxWidth(Double.MAX_VALUE);
        HBox.setHgrow(endCombatButton, Priority.ALWAYS);
        endCombatButton.setOnAction(e -> showConfirmEndButtons());
        endButtonContainer.getChildren().add(endCombatButton);
    }

    private void showConfirmEndButtons() {
        endCombatButton = null; // confirm state: normal end button is gone
        endButtonContainer.getChildren().clear();
        Button cancelBtn = new Button("Abbruch");
        Button confirmBtn = new Button("_Best\u00e4tigen!");
        confirmBtn.getStyleClass().add("accent");
        confirmBtn.setTooltip(new Tooltip("Kampf beenden best\u00e4tigen (Alt+B)"));
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
