package features.encounter.combat.ui;

import features.creatures.model.Creature;
import features.encounter.combat.model.Combatant;
import features.encounter.combat.model.MonsterCombatant;
import features.encounter.combat.model.PartyCombatantCandidate;
import features.encounter.combat.service.CombatSession;
import features.encounter.combat.service.CombatTurnGrouper;
import features.encounter.internal.EncounterDifficultyUiText;
import shared.rules.service.XpCalculator;
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
import javafx.scene.shape.Rectangle;
import javafx.stage.Popup;
import features.creatures.api.StatBlockRequest;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.BiConsumer;
import java.util.function.Consumer;
import java.util.function.Supplier;

/** ScenePane content for combat mode. */
public class CombatTrackerPane extends VBox {
    private record TopRowResult(HBox row) {}
    private record CardResult(VBox card) {}

    // HP bar color thresholds: green above HEALTHY, yellow between, red below CRITICAL
    private static final double HP_HEALTHY = 0.5;
    private static final double HP_CRITICAL = 0.25;
    private static final double BAR_WIDTH = 90;
    private static final double BAR_HEIGHT = 24;

    private final CombatTrackerCoordinator coordinator = new CombatTrackerCoordinator();
    private CombatTrackerRenderState state = CombatTrackerRenderState.empty();

    private final VBox cardList;
    private final ScrollPane cardScroll;
    private final Label roundLabel;
    private final Label statusBar;
    private final Button addPartyMemberButton;
    private final Button nextTurnButton;
    private final HBox endButtonContainer;

    private Consumer<StatBlockRequest> onRequestStatBlock;
    private Runnable onEndCombat;
    private Supplier<List<PartyCombatantCandidate>> missingPartyMemberProvider = List::of;
    private BiConsumer<PartyCombatantCandidate, Integer> onAddPartyMember;
    private Button endCombatButton;
    private final CombatPartyMemberDropdown addPartyMemberDropdown = new CombatPartyMemberDropdown();

    public CombatTrackerPane() {
        setSpacing(0);

        roundLabel = new Label("Runde 1");
        roundLabel.getStyleClass().add("title");
        roundLabel.setPadding(new Insets(8, 8, 2, 8));

        statusBar = new Label();
        statusBar.getStyleClass().add("text-secondary");
        statusBar.setPadding(new Insets(0, 8, 4, 8));

        addPartyMemberButton = new Button("SC hinzufügen");
        addPartyMemberButton.getStyleClass().addAll("compact", "neutral-action");
        addPartyMemberButton.setTooltip(new Tooltip("Aktives Party-Mitglied in den laufenden Kampf aufnehmen"));
        addPartyMemberButton.setOnAction(e -> showAddPartyMemberPopup(addPartyMemberButton));

        HBox headerActions = new HBox(addPartyMemberButton);
        headerActions.setAlignment(Pos.CENTER_RIGHT);
        headerActions.setPadding(new Insets(0, 8, 4, 8));

        cardList = new VBox(6);
        cardList.setPadding(new Insets(4, 8, 4, 8));

        cardScroll = new ScrollPane(cardList);
        cardScroll.setFitToWidth(true);
        cardScroll.setHbarPolicy(ScrollPane.ScrollBarPolicy.NEVER);
        VBox.setVgrow(cardScroll, Priority.ALWAYS);

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

        getChildren().addAll(roundLabel, statusBar, headerActions, cardScroll, turnRow);
        coordinator.setOnRenderStateChanged(newState -> {
            state = newState;
            syncHeaderActions();
            buildAllCards();
        });
    }

    public void setOnRequestStatBlock(Consumer<StatBlockRequest> callback) { this.onRequestStatBlock = callback; }
    public void setOnEnsureStatBlock(Consumer<StatBlockRequest> callback) {
        coordinator.setOnEnsureStatBlock(callback);
    }
    public void setOnCombatStateChanged(Runnable callback) {
        coordinator.setOnCombatStateChanged(callback);
    }
    public void setOnEndCombat(Runnable callback) { this.onEndCombat = callback; }
    void setMissingPartyMemberProvider(Supplier<List<PartyCombatantCandidate>> provider) {
        this.missingPartyMemberProvider = provider == null ? List::of : provider;
        syncHeaderActions();
    }
    void setOnAddPartyMember(BiConsumer<PartyCombatantCandidate, Integer> callback) {
        this.onAddPartyMember = callback;
        syncHeaderActions();
    }

    /** Handle a combat keyboard shortcut. Returns true if the event was consumed. */
    public boolean handleCombatKey(javafx.scene.input.KeyEvent e) {
        if (e.isControlDown()) {
            if (e.getCode() == javafx.scene.input.KeyCode.D) {
                CombatTurnGrouper.GroupedTurnEntry focused = state.focusedEntry();
                if (focused != null
                        && focused.kind() == CombatTurnGrouper.GroupedTurnKind.MONSTER
                        && !focused.monsters().isEmpty()) {
                    duplicateCombatant(focused.monsters().get(0));
                    return true;
                }
            }
            return false;
        }

        switch (e.getCode()) {
            case SPACE, RIGHT -> nextTurn();
            case UP -> moveFocus(-1);
            case DOWN -> moveFocus(1);
            case ENTER -> {
                CombatTurnGrouper.GroupedTurnEntry entry = state.focusedEntry();
                if (entry != null && entry.creatureId() != null && onRequestStatBlock != null) {
                    onRequestStatBlock.accept(CombatStatBlockRequestMapper.fromTurnEntry(entry));
                }
            }
            case F2 -> {
                CombatTurnGrouper.GroupedTurnEntry entry = state.focusedEntry();
                int focusedIndex = state.focusedIndex();
                if (entry != null && focusedIndex < cardList.getChildren().size()) {
                    Node node = cardList.getChildren().get(focusedIndex);
                    if (entry.kind() == CombatTurnGrouper.GroupedTurnKind.MONSTER && !entry.monsters().isEmpty()) {
                        showHpPopup(node, entry.monsters().get(0));
                    }
                    if (entry.kind() == CombatTurnGrouper.GroupedTurnKind.MOB) showHpPopup(node, entry);
                }
            }
            case I -> {
                CombatTurnGrouper.GroupedTurnEntry entry = state.focusedEntry();
                int focusedIndex = state.focusedIndex();
                if (entry != null && focusedIndex < cardList.getChildren().size()) {
                    showInitiativePopup(cardList.getChildren().get(focusedIndex), entry);
                }
            }
            case DELETE -> {
                CombatTurnGrouper.GroupedTurnEntry entry = state.focusedEntry();
                if (entry == null) return false;
                if (entry.kind() == CombatTurnGrouper.GroupedTurnKind.MONSTER && !entry.monsters().isEmpty()) {
                    removeMonster(entry.monsters().get(0));
                } else if (entry.kind() == CombatTurnGrouper.GroupedTurnKind.MOB) {
                    removeMob(entry);
                }
            }
            default -> {
                return false;
            }
        }
        return true;
    }

    public void startCombat(List<Combatant> newCombatants) {
        coordinator.startCombat(newCombatants);
    }

    public int getRound() { return state.round(); }

    /** Update round label and status bar. Called by EncounterView after each combat state change. */
    public void updateStatusBar(XpCalculator.DifficultyStats ds, int alive, int total, int roundValue) {
        roundLabel.setText("Runde " + roundValue);
        statusBar.setText(alive + "/" + total + " - " + EncounterDifficultyUiText.formatDifficulty(ds.difficulty()));
    }

    public String getCurrentTurnName() { return state.currentTurnName(); }

    public List<Combatant> getCombatants() { return state.combatants(); }

    public List<CombatSession.EnemyOutcome> getEnemyOutcomes() { return state.enemyOutcomes(); }

    public CombatSession.EnemyTotals getEnemyTotals() { return state.enemyTotals(); }

    public void addReinforcement(Creature creature) {
        coordinator.addReinforcement(creature);
    }

    void addPartyMember(PartyCombatantCandidate partyMember, int initiative) {
        coordinator.addPartyMember(partyMember, initiative);
    }

    private boolean isAlive(CombatTurnGrouper.GroupedTurnEntry entry) {
        if (entry.kind() == CombatTurnGrouper.GroupedTurnKind.PC) return entry.pc() != null && entry.pc().isAlive();
        for (MonsterCombatant mc : entry.monsters()) if (mc.isAlive()) return true;
        return false;
    }

    private boolean isMob(CombatTurnGrouper.GroupedTurnEntry entry) {
        return entry.kind() == CombatTurnGrouper.GroupedTurnKind.MOB;
    }

    private int memberCount(CombatTurnGrouper.GroupedTurnEntry entry) {
        return entry.kind() == CombatTurnGrouper.GroupedTurnKind.PC ? 0 : entry.monsters().size();
    }

    private MonsterCombatant frontMonster(CombatTurnGrouper.GroupedTurnEntry entry) {
        return entry.monsters().isEmpty() ? null : entry.monsters().get(0);
    }

    // ---- Card building ----

    private void buildAllCards() {
        List<CombatTurnGrouper.GroupedTurnEntry> turnEntries = state.turnEntries();
        cardList.getChildren().clear();
        for (int i = 0; i < turnEntries.size(); i++) {
            CombatTurnGrouper.GroupedTurnEntry entry = turnEntries.get(i);
            CardResult cr = buildCard(entry, i);
            cr.card().setFocusTraversable(true);
            cardList.getChildren().add(cr.card());
        }
        appendInactiveSection();
        updateFocus();
    }

    private void appendInactiveSection() {
        List<CombatSession.InactiveEnemy> inactiveEnemies = state.inactiveEnemies();
        if (inactiveEnemies.isEmpty()) return;

        Label header = new Label("Inaktiv");
        header.getStyleClass().add("section-header");
        header.setPadding(new Insets(8, 0, 0, 0));
        cardList.getChildren().add(header);

        Map<String, List<CombatSession.InactiveEnemy>> removedGroups = new LinkedHashMap<>();
        Map<String, List<CombatSession.InactiveEnemy>> deadGroups = new LinkedHashMap<>();
        for (CombatSession.InactiveEnemy ie : inactiveEnemies) {
            String key = groupKey(ie);
            if (ie.status() == CombatSession.EnemyStatus.REMOVED) removedGroups.computeIfAbsent(key, k -> new ArrayList<>()).add(ie);
            else deadGroups.computeIfAbsent(key, k -> new ArrayList<>()).add(ie);
        }

        if (!removedGroups.isEmpty()) {
            Label remHeader = new Label("Vertrieben / Entfernt");
            remHeader.getStyleClass().add("text-secondary");
            cardList.getChildren().add(remHeader);
            for (List<CombatSession.InactiveEnemy> group : removedGroups.values()) {
                cardList.getChildren().add(buildInactiveRow(group, true));
            }
        }

        if (!deadGroups.isEmpty()) {
            Label deadHeader = new Label("Tot");
            deadHeader.getStyleClass().add("text-secondary");
            deadHeader.setPadding(new Insets(4, 0, 0, 0));
            cardList.getChildren().add(deadHeader);
            for (List<CombatSession.InactiveEnemy> group : deadGroups.values()) {
                cardList.getChildren().add(buildDeadRow(group));
            }
        }
    }

    private HBox buildInactiveRow(List<CombatSession.InactiveEnemy> group, boolean removable) {
        CombatSession.InactiveEnemy sample = group.get(0);
        MonsterCombatant mc = sample.combatant();

        HBox row = new HBox(8);
        row.setAlignment(Pos.CENTER_LEFT);
        row.setPadding(new Insets(0, 0, 0, 12));

        Label name = new Label(mc.getName() + "  x" + group.size());
        name.getStyleClass().add("combat-name");

        Label hp = new Label("HP " + mc.getCurrentHp() + "/" + mc.getMaxHp());
        hp.getStyleClass().add("combat-detail");

        Label init = new Label("Init " + mc.getInitiative());
        init.getStyleClass().add("combat-detail");

        Region spacer = new Region();
        HBox.setHgrow(spacer, Priority.ALWAYS);
        row.getChildren().addAll(name, hp, init, spacer);

        if (removable) {
            Button restore = new Button("Zur\u00fcckholen");
            restore.getStyleClass().add("accent");
            restore.setOnAction(e -> restoreRemoved(sample));
            row.getChildren().add(restore);
        }
        return row;
    }

    private HBox buildDeadRow(List<CombatSession.InactiveEnemy> group) {
        CombatSession.InactiveEnemy sample = group.get(0);
        MonsterCombatant mc = sample.combatant();

        HBox row = new HBox(8);
        row.setAlignment(Pos.CENTER_LEFT);
        row.setPadding(new Insets(0, 0, 0, 12));

        Label name = new Label(mc.getName() + "  x" + group.size());
        name.getStyleClass().add("combat-name");

        StackPane hpBar = buildHpBar(mc.getName(), mc.getCurrentHp(), mc.getMaxHp());
        hpBar.getStyleClass().add("clickable");
        hpBar.setOnMouseClicked(e -> {
            showInactiveDeadHpPopup(hpBar, sample);
            e.consume();
        });

        Label init = new Label("Init " + mc.getInitiative());
        init.getStyleClass().add("combat-detail");

        Region spacer = new Region();
        HBox.setHgrow(spacer, Priority.ALWAYS);
        row.getChildren().addAll(name, hpBar, init, spacer);
        return row;
    }

    private String groupKey(CombatSession.InactiveEnemy ie) {
        MonsterCombatant mc = ie.combatant();
        String id = mc.getCreatureRef() != null && mc.getCreatureRef().getId() != null ? String.valueOf(mc.getCreatureRef().getId()) : "unknown";
        return ie.status() + "|" + id + "|" + mc.getInitiative() + "|" + mc.getCurrentHp() + "|" + mc.getMaxHp();
    }

    private CardResult buildCard(CombatTurnGrouper.GroupedTurnEntry entry, int index) {
        boolean isActive = (index == state.currentTurnIndex());
        boolean isDead = !isAlive(entry);

        VBox card = new VBox(4);
        card.getStyleClass().add("combat-card");
        if (isActive) card.getStyleClass().add("combat-card-active");
        else if (isDead) card.getStyleClass().add("combat-card-dead");
        else if (entry.kind() == CombatTurnGrouper.GroupedTurnKind.PC) card.getStyleClass().add("combat-card-pc");

        TopRowResult topRow = buildTopRow(entry, index, isActive, isDead);
        card.getChildren().add(topRow.row);

        attachContextMenu(card, entry, isDead);
        return new CardResult(card);
    }

    private TopRowResult buildTopRow(CombatTurnGrouper.GroupedTurnEntry entry, int index, boolean isActive, boolean isDead) {
        HBox topRow = new HBox(8);
        topRow.setAlignment(Pos.CENTER_LEFT);

        Label turnInd = new Label(isActive ? "\u25B6 " + (index + 1) : String.valueOf(index + 1));
        turnInd.getStyleClass().add(isActive ? "combat-turn-indicator" : "combat-turn-indicator-inactive");

        Node nameNode;
        if (!isDead && entry.creatureId() != null) {
            long cid = entry.creatureId();
            Button nameBtn = new Button(entry.name());
            nameBtn.getStyleClass().addAll("combat-name", "creature-link");
            nameBtn.setAccessibleText("Stat Block \u00f6ffnen: " + entry.name());
            nameBtn.setOnAction(e -> {
                if (onRequestStatBlock != null) onRequestStatBlock.accept(CombatStatBlockRequestMapper.fromTurnEntry(entry));
            });
            nameNode = nameBtn;
        } else {
            Label nameLabel = new Label(isDead ? "\u2620 " + entry.name() : entry.name());
            nameLabel.getStyleClass().add("combat-name");
            if (isDead) nameLabel.getStyleClass().add("combat-name-dead");
            nameNode = nameLabel;
        }

        Region spacer = new Region();
        HBox.setHgrow(spacer, Priority.ALWAYS);
        topRow.getChildren().addAll(turnInd, nameNode, spacer);

        if (entry.kind() == CombatTurnGrouper.GroupedTurnKind.MONSTER && !entry.monsters().isEmpty()) {
            MonsterCombatant mc = entry.monsters().get(0);
            StackPane hpBar = buildHpBar(mc.getName(), mc.getCurrentHp(), mc.getMaxHp());
            if (!isDead) {
                hpBar.setOnMouseClicked(e -> {
                    showHpPopup(hpBar, mc);
                    e.consume();
                });
                hpBar.getStyleClass().add("clickable");
            }

            Label acBadge = new Label("AC " + mc.getAc());
            acBadge.getStyleClass().add("ac-badge");
            acBadge.setMinWidth(Region.USE_PREF_SIZE);
            topRow.getChildren().addAll(hpBar, acBadge);
        } else if (entry.kind() == CombatTurnGrouper.GroupedTurnKind.MOB && !entry.monsters().isEmpty()) {
            MonsterCombatant front = frontMonster(entry);
            StackPane hpBar = buildHpBar(entry.name(), front.getCurrentHp(), front.getMaxHp());
            if (!isDead) {
                hpBar.setOnMouseClicked(e -> {
                    showHpPopup(hpBar, entry);
                    e.consume();
                });
                hpBar.getStyleClass().add("clickable");
            }

            Label countBadge = new Label("x" + memberCount(entry));
            countBadge.getStyleClass().add("ac-badge");
            countBadge.setMinWidth(Region.USE_PREF_SIZE);

            Label acBadge = new Label("AC " + entry.ac());
            acBadge.getStyleClass().add("ac-badge");
            acBadge.setMinWidth(Region.USE_PREF_SIZE);
            topRow.getChildren().addAll(hpBar, countBadge, acBadge);
        }

        Button initBtn = new Button("Init " + entry.initiative());
        initBtn.getStyleClass().add("init-badge");
        initBtn.setMinWidth(Region.USE_PREF_SIZE);
        initBtn.setTooltip(new Tooltip("Initiative bearbeiten (Klick oder I)"));
        initBtn.setAccessibleText("Initiative bearbeiten: " + entry.initiative());
        initBtn.setOnAction(e -> showInitiativePopup(initBtn, entry));
        topRow.getChildren().add(initBtn);

        return new TopRowResult(topRow);
    }

    private void attachContextMenu(VBox card, CombatTurnGrouper.GroupedTurnEntry entry, boolean isDead) {
        if (isDead || entry.kind() == CombatTurnGrouper.GroupedTurnKind.PC) return;
        ContextMenu menu = new ContextMenu();

        if (entry.kind() == CombatTurnGrouper.GroupedTurnKind.MONSTER && !entry.monsters().isEmpty()) {
            MonsterCombatant mc = entry.monsters().get(0);
            MenuItem dup = new MenuItem("Duplizieren");
            dup.setAccelerator(KeyCombination.keyCombination("Ctrl+D"));
            dup.setOnAction(e -> duplicateCombatant(mc));
            menu.getItems().add(dup);
            menu.getItems().add(new SeparatorMenuItem());
        }

        MenuItem rem = new MenuItem("Entfernen");
        rem.setAccelerator(KeyCombination.keyCombination("Delete"));
        rem.setOnAction(e -> {
            if (entry.kind() == CombatTurnGrouper.GroupedTurnKind.MONSTER && !entry.monsters().isEmpty()) {
                removeMonster(entry.monsters().get(0));
            }
            if (entry.kind() == CombatTurnGrouper.GroupedTurnKind.MOB) removeMob(entry);
        });
        menu.getItems().add(rem);
        card.setOnContextMenuRequested(e -> menu.show(card, e.getScreenX(), e.getScreenY()));
    }

    private StackPane buildHpBar(String name, int currentHp, int maxHp) {
        double frac = maxHp > 0 ? Math.max(0, Math.min(1, (double) currentHp / maxHp)) : 0;
        double fillWidth = BAR_WIDTH * frac;

        Region track = new Region();
        track.getStyleClass().add("hp-bar-track");
        track.setPrefSize(BAR_WIDTH, BAR_HEIGHT);
        track.setMaxWidth(BAR_WIDTH);

        Region fill = new Region();
        fill.getStyleClass().add("hp-bar-fill");
        fill.setPrefSize(fillWidth, BAR_HEIGHT);
        fill.setMaxSize(fillWidth, BAR_HEIGHT);
        if (frac > HP_HEALTHY) fill.getStyleClass().add("hp-fill-healthy");
        else if (frac > HP_CRITICAL) fill.getStyleClass().add("hp-fill-wounded");
        else fill.getStyleClass().add("hp-fill-critical");

        String hpLabel = (frac <= HP_CRITICAL ? "! " : "") + currentHp + " / " + maxHp;
        // The label spans both the colored fill and the dark track, so a single text color becomes
        // unreadable at the boundary. Mirror the same centered text into two clipped layers instead.
        Label hpTextOnTrack = new Label(hpLabel);
        hpTextOnTrack.getStyleClass().addAll("hp-bar-text", "hp-bar-text-on-track");
        hpTextOnTrack.setMouseTransparent(true);

        Label hpTextOnFill = new Label(hpLabel);
        hpTextOnFill.getStyleClass().addAll("hp-bar-text", "hp-bar-text-on-fill");
        hpTextOnFill.setMouseTransparent(true);

        installHpTextClip(hpTextOnFill, fillWidth, true);
        installHpTextClip(hpTextOnTrack, fillWidth, false);

        StackPane bar = new StackPane(track, fill, hpTextOnTrack, hpTextOnFill);
        bar.setAlignment(Pos.CENTER_LEFT);
        StackPane.setAlignment(fill, Pos.CENTER_LEFT);
        StackPane.setAlignment(hpTextOnTrack, Pos.CENTER);
        StackPane.setAlignment(hpTextOnFill, Pos.CENTER);
        bar.setMaxWidth(BAR_WIDTH);
        bar.setPrefWidth(BAR_WIDTH);
        bar.setFocusTraversable(false);
        bar.setAccessibleRole(AccessibleRole.TEXT);
        bar.setAccessibleText(name + " HP bearbeiten: " + currentHp + "/" + maxHp);
        Tooltip.install(bar, new Tooltip("HP bearbeiten (Klick oder F2)"));
        return bar;
    }

    private void installHpTextClip(Label label, double fillWidth, boolean showFillPortion) {
        Rectangle clip = new Rectangle();
        clip.heightProperty().bind(label.heightProperty());
        label.setClip(clip);

        Runnable updateClip = () -> {
            double textWidth = label.getLayoutBounds().getWidth();
            double textStartX = (BAR_WIDTH - textWidth) / 2.0;
            double visibleStart = showFillPortion ? 0.0 : fillWidth;
            double visibleEnd = showFillPortion ? fillWidth : BAR_WIDTH;

            double clipStart = Math.max(0.0, visibleStart - textStartX);
            double clipEnd = Math.min(textWidth, visibleEnd - textStartX);
            double clipWidth = Math.max(0.0, clipEnd - clipStart);

            clip.setX(clipStart);
            clip.setWidth(clipWidth);
        };

        label.layoutBoundsProperty().addListener((obs, oldBounds, newBounds) -> updateClip.run());
        Platform.runLater(updateClip);
    }

    // ---- Turn logic ----

    private void nextTurn() {
        coordinator.nextTurn();
    }

    private void moveFocus(int delta) {
        coordinator.moveFocus(delta);
    }

    private void updateFocus() {
        List<CombatTurnGrouper.GroupedTurnEntry> turnEntries = state.turnEntries();
        int focusedIndex = state.focusedIndex();
        if (turnEntries.isEmpty()) return;
        if (focusedIndex < 0 || focusedIndex >= cardList.getChildren().size()) return;
        int idx = focusedIndex;
        VBox card = (VBox) cardList.getChildren().get(idx);
        Platform.runLater(() -> {
            card.requestFocus();
            if (!turnEntries.isEmpty()) {
                double cardTop = card.getBoundsInParent().getMinY();
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

    // ---- HP / Initiative popup edit ----

    private void showHpPopup(Node anchor, MonsterCombatant mc) {
        int[] value = {1};
        SpinnerParts sp = buildSpinner(1, value);
        sp.field().setAccessibleText("Schaden oder Heilung eingeben");
        Popup popup = new Popup();
        popup.setAutoHide(true);
        Button damageBtn = new Button("-");
        damageBtn.setDefaultButton(true);
        Button healBtn = new Button("+");

        damageBtn.setOnAction(e -> {
            int v = parseOrDefault(sp.field().getText(), value[0]);
            popup.hide();
            coordinator.applyDamageToMonster(mc, v);
        });
        healBtn.setOnAction(e -> {
            int v = parseOrDefault(sp.field().getText(), value[0]);
            popup.hide();
            coordinator.healMonster(mc, v);
        });

        showAtAnchor(popup, anchor, buildPopupContent(sp.dec(), sp.field(), sp.inc(), damageBtn, healBtn), sp.field());
    }

    private void showHpPopup(Node anchor, CombatTurnGrouper.GroupedTurnEntry mobEntry) {
        int[] value = {1};
        SpinnerParts sp = buildSpinner(1, value);
        sp.field().setAccessibleText("Schaden oder Heilung eingeben");
        Popup popup = new Popup();
        popup.setAutoHide(true);
        Button damageBtn = new Button("-");
        damageBtn.setDefaultButton(true);
        Button healBtn = new Button("+");

        damageBtn.setOnAction(e -> {
            int v = parseOrDefault(sp.field().getText(), value[0]);
            popup.hide();
            coordinator.applyDamageToMob(mobEntry, v);
        });
        healBtn.setOnAction(e -> {
            int v = parseOrDefault(sp.field().getText(), value[0]);
            popup.hide();
            coordinator.healMobFront(mobEntry, v);
        });

        showAtAnchor(popup, anchor, buildPopupContent(sp.dec(), sp.field(), sp.inc(), damageBtn, healBtn), sp.field());
    }

    private void showInitiativePopup(Node anchor, CombatTurnGrouper.GroupedTurnEntry entry) {
        int[] value = {entry.initiative()};
        SpinnerParts sp = buildSpinner(entry.initiative(), value);
        sp.field().setAccessibleText("Initiative eingeben");
        Popup popup = new Popup();
        popup.setAutoHide(true);
        Button setBtn = new Button("\u2713 Setzen");
        setBtn.getStyleClass().add("accent");

        Runnable apply = () -> {
            int v = parseOrDefault(sp.field().getText(), value[0]);
            popup.hide();
            coordinator.setInitiative(entry, v);
        };

        setBtn.setOnAction(e -> apply.run());
        sp.field().setOnAction(e -> apply.run());
        showAtAnchor(popup, anchor, buildPopupContent(sp.dec(), sp.field(), sp.inc(), setBtn), sp.field());
    }

    private void duplicateCombatant(MonsterCombatant original) {
        coordinator.duplicateCombatant(original);
    }

    private void removeMonster(MonsterCombatant mc) {
        coordinator.removeMonster(mc);
    }

    private void removeMob(CombatTurnGrouper.GroupedTurnEntry entry) {
        coordinator.removeMob(entry);
    }

    private void restoreRemoved(CombatSession.InactiveEnemy removed) {
        coordinator.restoreRemoved(removed);
    }

    private void reviveDead(CombatSession.InactiveEnemy deadEnemy, int hitPoints) {
        coordinator.healInactiveDead(deadEnemy, hitPoints);
    }

    private void showInactiveDeadHpPopup(Node anchor, CombatSession.InactiveEnemy deadEnemy) {
        int[] value = {1};
        SpinnerParts sp = buildSpinner(1, value);
        sp.field().setAccessibleText("Heilung für toten Gegner eingeben");
        Popup popup = new Popup();
        popup.setAutoHide(true);
        Button healButton = new Button("+");
        Runnable apply = () -> {
            int hp = Math.max(1, parseOrDefault(sp.field().getText(), value[0]));
            popup.hide();
            reviveDead(deadEnemy, hp);
        };
        healButton.setOnAction(e -> apply.run());
        sp.field().setOnAction(e -> apply.run());
        showAtAnchor(popup, anchor, buildPopupContent(sp.dec(), sp.field(), sp.inc(), healButton), sp.field());
    }

    private void showAddPartyMemberPopup(Node anchor) {
        List<PartyCombatantCandidate> candidates = missingPartyMemberProvider.get();
        if (candidates == null || candidates.isEmpty() || onAddPartyMember == null) {
            syncHeaderActions();
            return;
        }
        addPartyMemberDropdown.show(anchor, candidates, onAddPartyMember);
    }

    private void syncHeaderActions() {
        List<PartyCombatantCandidate> missingMembers = missingPartyMemberProvider.get();
        boolean canAddPartyMember = onAddPartyMember != null && missingMembers != null && !missingMembers.isEmpty();
        addPartyMemberButton.setDisable(!canAddPartyMember);
    }

    // ---- Popup helpers ----

    private record SpinnerParts(Button dec, TextField field, Button inc) {}

    private SpinnerParts buildSpinner(int initial, int[] value) {
        TextField field = new TextField(String.valueOf(initial));
        field.setPrefWidth(56);
        field.getStyleClass().add("quick-search-field");
        field.setTextFormatter(new TextFormatter<>(change -> change.getText().matches("[0-9-]*") ? change : null));

        Button dec = new Button("\u25BC");
        Button inc = new Button("\u25B2");
        dec.getStyleClass().add("spinner-btn");
        inc.getStyleClass().add("spinner-btn");
        dec.setFocusTraversable(false);
        inc.setFocusTraversable(false);

        dec.setOnAction(e -> {
            value[0] = parseOrDefault(field.getText(), value[0]) - 1;
            field.setText(String.valueOf(value[0]));
        });
        inc.setOnAction(e -> {
            value[0] = parseOrDefault(field.getText(), value[0]) + 1;
            field.setText(String.valueOf(value[0]));
        });

        return new SpinnerParts(dec, field, inc);
    }

    private HBox buildPopupContent(Node... children) {
        HBox content = new HBox();
        content.getStyleClass().add("edit-popup-panel");
        content.setAlignment(Pos.CENTER_LEFT);
        content.getChildren().addAll(children);
        return content;
    }

    private void showAtAnchor(Popup popup, Node anchor, HBox content, TextField focus) {
        popup.getContent().add(content);
        popup.setOnHidden(e -> anchor.requestFocus());
        Bounds bounds = anchor.localToScreen(anchor.getBoundsInLocal());
        if (bounds != null) popup.show(anchor, bounds.getMinX(), bounds.getMaxY() + 8);
        Platform.runLater(focus::requestFocus);
    }

    private int parseOrDefault(String text, int def) {
        try {
            return Integer.parseInt(text.trim());
        } catch (NumberFormatException e) {
            return def;
        }
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
        endCombatButton = null;
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

}
