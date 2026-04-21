package src.view.statetabs.encounter;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.BiConsumer;
import java.util.function.Consumer;
import javafx.application.Platform;
import javafx.beans.property.StringProperty;
import javafx.geometry.Bounds;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.CheckBox;
import javafx.scene.control.Label;
import javafx.scene.control.ScrollPane;
import javafx.scene.control.Separator;
import javafx.scene.control.Slider;
import javafx.scene.control.Spinner;
import javafx.scene.control.TextField;
import javafx.scene.control.TextFormatter;
import javafx.scene.control.Tooltip;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.StackPane;
import javafx.scene.layout.VBox;
import javafx.stage.Popup;
import javafx.util.StringConverter;

public final class EncounterStateView extends VBox {

    private final Label modeLabel = new Label();
    private final Label status = new Label();
    private final StackPane contentArea = new StackPane();

    private final DifficultyMeterView difficultyMeter = new DifficultyMeterView();
    private final Label builderDifficultyLabel = new Label();
    private final Label builderTemplateLabel = new Label();
    private final Label builderPartyLabel = new Label();
    private final Label builderXpLabel = new Label();
    private final Label easyThresholdLabel = new Label();
    private final Label mediumThresholdLabel = new Label();
    private final Label hardThresholdLabel = new Label();
    private final Label deadlyThresholdLabel = new Label();
    private final VBox rosterList = new VBox(6);
    private final Label rosterPlaceholder = new Label("Monster per +Add hinzufuegen...");
    private final ScrollPane rosterScroll = new ScrollPane(rosterList);
    private final StackPane rosterHost = new StackPane(rosterPlaceholder, rosterScroll);
    private final VBox advisoryRegion = new VBox(4);
    private final Button builderStartCombatButton = new Button("_Kampf starten");
    private final VBox builderPane = buildBuilderPane();

    private final Map<String, Spinner<Integer>> initiativeSpinnerById = new LinkedHashMap<>();
    private final VBox initiativeList = new VBox(6);
    private final VBox initiativePane = buildInitiativePane();

    private final Label combatRoundLabel = new Label();
    private final Label combatStatusLabel = new Label();
    private final VBox combatCardList = new VBox(6);
    private final HBox endCombatContainer = new HBox(6);
    private final VBox combatPane = buildCombatPane();

    private final Label resultSubtitleLabel = new Label();
    private final Label resultXpLabel = new Label();
    private final Label resultPartyLabel = new Label();
    private final Label resultGoldLabel = new Label();
    private final Label resultLootLabel = new Label();
    private final Label resultAwardStatusLabel = new Label();
    private final Slider resultThresholdSlider = percentSlider();
    private final Slider resultFractionSlider = percentSlider();
    private final Label resultThresholdValueLabel = new Label();
    private final Label resultFractionValueLabel = new Label();
    private final VBox resultEnemyList = new VBox(4);
    private final Button resultAwardButton = new Button("XP verteilen");
    private final VBox resultsPane = buildResultsPane();

    private Consumer<BuilderSettingsInput> onGenerate = settings -> { };
    private Runnable onStartInitiative = () -> { };
    private Runnable onInitiativeBack = () -> { };
    private Consumer<List<InitiativeInputView>> onInitiativeConfirm = entries -> { };
    private Runnable onNextTurn = () -> { };
    private BiConsumer<String, Integer> onDamage = (id, amount) -> { };
    private BiConsumer<String, Integer> onHeal = (id, amount) -> { };
    private BiConsumer<String, Integer> onSetInitiative = (id, initiative) -> { };
    private Runnable onEndCombat = () -> { };
    private Runnable onAwardXp = () -> { };
    private Runnable onReturnToBuilder = () -> { };
    private ResultStateView lastResultState = ResultStateView.empty();

    public EncounterStateView() {
        setSpacing(0);
        setPadding(new Insets(0));
        getStyleClass().addAll("surface-root", "encounter-runtime-root");
        setFillWidth(true);

        modeLabel.setVisible(false);
        modeLabel.setManaged(false);
        status.setVisible(false);
        status.setManaged(false);
        VBox.setVgrow(contentArea, Priority.ALWAYS);
        contentArea.getChildren().setAll(builderPane);
        getChildren().add(contentArea);
    }

    public StringProperty statusTextProperty() {
        return status.textProperty();
    }

    public void showBuilder(BuilderStateView state) {
        modeLabel.setText("Creation");
        setContent(builderPane);
        builderDifficultyLabel.setText(state.difficulty().difficulty());
        updateDifficultyStyle(builderDifficultyLabel, state.difficulty().difficulty());
        builderTemplateLabel.setText(state.templateLabel());
        builderPartyLabel.setText(state.partyLabel());
        builderXpLabel.setText("Adj. XP: " + state.difficulty().adjustedXp());
        easyThresholdLabel.setText("Easy " + state.difficulty().easy());
        mediumThresholdLabel.setText("Med. " + state.difficulty().medium());
        hardThresholdLabel.setText("Hard " + state.difficulty().hard());
        deadlyThresholdLabel.setText("Deadly " + state.difficulty().deadly());
        difficultyMeter.update(state.difficulty());
        builderStartCombatButton.setDisable(!state.canStartCombat());
        rebuildRoster(state);
    }

    public void showInitiative(InitiativeStateView state) {
        modeLabel.setText("Initiative");
        setContent(initiativePane);
        initiativeSpinnerById.clear();
        initiativeList.getChildren().clear();
        String currentKind = "";
        for (InitiativeEntryView entry : state.entries()) {
            if (!entry.kind().equals(currentKind)) {
                currentKind = entry.kind();
                Label header = sectionHeader("SC".equals(currentKind) ? "Spieler" : currentKind);
                header.setPadding(new Insets(8, 0, 0, 0));
                initiativeList.getChildren().add(header);
            }
            initiativeList.getChildren().add(buildInitiativeRow(entry));
        }
    }

    public void showCombat(CombatStateView state) {
        modeLabel.setText("Combat");
        setContent(combatPane);
        combatRoundLabel.setText("Runde " + state.round());
        combatStatusLabel.setText(state.status());
        combatCardList.getChildren().clear();
        for (CombatCardView card : state.cards()) {
            combatCardList.getChildren().add(buildCombatCard(card));
        }
        showNormalEndButton(state.allEnemiesDefeated());
    }

    public void showResults(ResultStateView state) {
        modeLabel.setText("Resolution");
        setContent(resultsPane);
        lastResultState = state;
        resultEnemyList.getChildren().clear();
        for (ResultEnemyView enemy : state.enemies()) {
            resultEnemyList.getChildren().add(buildResultEnemyRow(enemy));
        }
        resultAwardStatusLabel.setText(state.awardStatus());
        resultAwardButton.setDisable(!state.canAwardXp() || state.xpAwarded());
        updateResultCalculations();
    }

    public void setOnGenerate(Consumer<BuilderSettingsInput> callback) {
        onGenerate = callback == null ? settings -> { } : callback;
    }

    public void setOnStartInitiative(Runnable callback) {
        onStartInitiative = callback == null ? () -> { } : callback;
    }

    public void setOnInitiativeBack(Runnable callback) {
        onInitiativeBack = callback == null ? () -> { } : callback;
    }

    public void setOnInitiativeConfirm(Consumer<List<InitiativeInputView>> callback) {
        onInitiativeConfirm = callback == null ? entries -> { } : callback;
    }

    public void setOnNextTurn(Runnable callback) {
        onNextTurn = callback == null ? () -> { } : callback;
    }

    public void setOnDamage(BiConsumer<String, Integer> callback) {
        onDamage = callback == null ? (id, amount) -> { } : callback;
    }

    public void setOnHeal(BiConsumer<String, Integer> callback) {
        onHeal = callback == null ? (id, amount) -> { } : callback;
    }

    public void setOnSetInitiative(BiConsumer<String, Integer> callback) {
        onSetInitiative = callback == null ? (id, initiative) -> { } : callback;
    }

    public void setOnEndCombat(Runnable callback) {
        onEndCombat = callback == null ? () -> { } : callback;
    }

    public void setOnAwardXp(Runnable callback) {
        onAwardXp = callback == null ? () -> { } : callback;
    }

    public void setOnReturnToBuilder(Runnable callback) {
        onReturnToBuilder = callback == null ? () -> { } : callback;
    }

    private VBox buildBuilderPane() {
        VBox content = new VBox(0);
        content.setPadding(new Insets(8));

        Label title = new Label("Encounter");
        title.getStyleClass().add("title");
        title.setPadding(new Insets(0, 0, 4, 0));
        Button saveEncounterButton = new Button("Speichern");
        saveEncounterButton.getStyleClass().addAll("compact", "neutral-action");
        saveEncounterButton.setDisable(true);
        saveEncounterButton.setTooltip(new Tooltip("Persistenz wird spaeter angebunden."));
        Region titleSpacer = new Region();
        HBox.setHgrow(titleSpacer, Priority.ALWAYS);
        HBox titleRow = new HBox(8, title, titleSpacer, saveEncounterButton);
        titleRow.setAlignment(Pos.CENTER_LEFT);

        HBox summaryRow = new HBox(8, builderDifficultyLabel, builderTemplateLabel, builderPartyLabel);
        summaryRow.setAlignment(Pos.CENTER_LEFT);
        builderDifficultyLabel.getStyleClass().add("text-secondary");
        builderTemplateLabel.getStyleClass().addAll("small", "text-secondary");
        builderPartyLabel.getStyleClass().add("text-secondary");
        builderXpLabel.getStyleClass().add("bold");
        HBox thresholdRow = new HBox(6, easyThresholdLabel, mediumThresholdLabel, hardThresholdLabel, deadlyThresholdLabel);
        easyThresholdLabel.getStyleClass().add("difficulty-easy");
        mediumThresholdLabel.getStyleClass().add("difficulty-medium");
        hardThresholdLabel.getStyleClass().add("difficulty-hard");
        deadlyThresholdLabel.getStyleClass().add("difficulty-deadly");

        rosterList.setPadding(new Insets(2, 0, 2, 0));
        rosterScroll.setFitToWidth(true);
        rosterScroll.setHbarPolicy(ScrollPane.ScrollBarPolicy.NEVER);
        rosterScroll.setVisible(false);
        rosterScroll.setManaged(false);
        rosterPlaceholder.getStyleClass().add("text-muted");
        rosterHost.setAlignment(Pos.TOP_LEFT);
        VBox.setVgrow(rosterHost, Priority.ALWAYS);

        advisoryRegion.setPadding(new Insets(8, 0, 0, 0));
        advisoryRegion.setVisible(false);
        advisoryRegion.setManaged(false);

        Button generateButton = new Button("_Generieren");
        generateButton.getStyleClass().add("neutral-action");
        generateButton.setMaxWidth(Double.MAX_VALUE);
        generateButton.setTooltip(new Tooltip("Encounter aus Catalog-Filtern generieren (Alt+G)"));
        generateButton.setOnAction(event -> onGenerate.accept(BuilderSettingsInput.defaultInput()));
        builderStartCombatButton.getStyleClass().add("accent");
        builderStartCombatButton.setMaxWidth(Double.MAX_VALUE);
        builderStartCombatButton.setDisable(true);
        builderStartCombatButton.setOnAction(event -> onStartInitiative.run());
        HBox.setHgrow(generateButton, Priority.ALWAYS);
        HBox.setHgrow(builderStartCombatButton, Priority.ALWAYS);
        HBox actionRow = new HBox(12, generateButton, builderStartCombatButton);
        actionRow.setAlignment(Pos.CENTER_LEFT);
        actionRow.setPadding(new Insets(8, 0, 0, 0));

        content.getChildren().addAll(
                titleRow,
                summaryRow,
                difficultyMeter,
                thresholdRow,
                builderXpLabel,
                rosterHost,
                advisoryRegion,
                separator(),
                actionRow);
        return content;
    }

    private VBox buildInitiativePane() {
        VBox root = new VBox(0);
        Label title = new Label("Initiative");
        title.getStyleClass().add("title");
        title.setPadding(new Insets(0, 12, 6, 12));
        initiativeList.setPadding(new Insets(0, 12, 8, 12));
        ScrollPane scroll = new ScrollPane(initiativeList);
        scroll.setFitToWidth(true);
        scroll.setHbarPolicy(ScrollPane.ScrollBarPolicy.NEVER);
        VBox.setVgrow(scroll, Priority.ALWAYS);

        Button backButton = new Button("\u2190 Zurueck");
        backButton.setOnAction(event -> onInitiativeBack.run());
        Button rollAllButton = new Button("Alle wuerfeln");
        rollAllButton.getStyleClass().add("neutral-action");
        rollAllButton.setOnAction(event -> rollAllInitiatives());
        Button startButton = new Button("Kampf starten");
        startButton.getStyleClass().add("accent");
        startButton.setOnAction(event -> onInitiativeConfirm.accept(readInitiatives()));
        Region spacer = new Region();
        HBox.setHgrow(spacer, Priority.ALWAYS);
        HBox buttons = new HBox(8, backButton, rollAllButton, spacer, startButton);
        buttons.setPadding(new Insets(8, 12, 8, 12));
        buttons.setAlignment(Pos.CENTER_LEFT);

        root.getChildren().addAll(title, scroll, separator(), buttons);
        return root;
    }

    private VBox buildCombatPane() {
        VBox root = new VBox(0);
        combatRoundLabel.getStyleClass().add("title");
        combatRoundLabel.setPadding(new Insets(0, 12, 2, 12));
        combatStatusLabel.getStyleClass().add("text-secondary");
        combatStatusLabel.setPadding(new Insets(0, 12, 6, 12));

        Button addPartyButton = new Button("SC hinzufuegen");
        addPartyButton.getStyleClass().addAll("compact", "neutral-action");
        addPartyButton.setDisable(true);
        addPartyButton.setTooltip(new Tooltip("Party wird im Party-Panel gepflegt."));
        HBox actions = new HBox(addPartyButton);
        actions.setAlignment(Pos.CENTER_RIGHT);
        actions.setPadding(new Insets(0, 12, 4, 12));

        combatCardList.setPadding(new Insets(4, 12, 4, 12));
        ScrollPane scroll = new ScrollPane(combatCardList);
        scroll.setFitToWidth(true);
        scroll.setHbarPolicy(ScrollPane.ScrollBarPolicy.NEVER);
        VBox.setVgrow(scroll, Priority.ALWAYS);

        Button nextTurnButton = new Button("\u25B6 _Weiter");
        nextTurnButton.getStyleClass().add("accent");
        nextTurnButton.setMaxWidth(Double.MAX_VALUE);
        nextTurnButton.setOnAction(event -> onNextTurn.run());
        endCombatContainer.setAlignment(Pos.CENTER);
        HBox.setHgrow(nextTurnButton, Priority.ALWAYS);
        HBox.setHgrow(endCombatContainer, Priority.ALWAYS);
        HBox buttons = new HBox(8, nextTurnButton, endCombatContainer);
        buttons.setPadding(new Insets(6, 12, 10, 12));

        root.getChildren().addAll(combatRoundLabel, combatStatusLabel, actions, scroll, buttons);
        return root;
    }

    private VBox buildResultsPane() {
        VBox root = new VBox(0);
        Label title = new Label("Kampfergebnis");
        title.getStyleClass().add("title");
        title.setPadding(new Insets(0, 12, 2, 12));
        resultSubtitleLabel.getStyleClass().add("text-secondary");
        resultSubtitleLabel.setPadding(new Insets(0, 12, 8, 12));
        resultXpLabel.getStyleClass().add("encounter-result-xp");
        resultPartyLabel.getStyleClass().add("text-secondary");
        resultGoldLabel.getStyleClass().add("encounter-result-gold");
        resultLootLabel.getStyleClass().add("text-secondary");
        resultLootLabel.setWrapText(true);

        VBox summary = new VBox(2, resultXpLabel, resultPartyLabel, resultGoldLabel, resultLootLabel);
        summary.setPadding(new Insets(8, 12, 8, 12));

        resultThresholdSlider.valueProperty().addListener((obs, oldValue, newValue) -> updateResultCalculations());
        resultFractionSlider.valueProperty().addListener((obs, oldValue, newValue) -> updateResultCalculations());
        VBox controls = new VBox(4,
                sliderRow("Besiegungsschwelle", resultThresholdSlider, resultThresholdValueLabel),
                sliderRow("XP-Anteil", resultFractionSlider, resultFractionValueLabel));
        controls.setPadding(new Insets(4, 12, 6, 12));

        resultEnemyList.setPadding(new Insets(2, 12, 8, 12));
        ScrollPane enemies = new ScrollPane(resultEnemyList);
        enemies.setFitToWidth(true);
        enemies.setHbarPolicy(ScrollPane.ScrollBarPolicy.NEVER);
        VBox.setVgrow(enemies, Priority.ALWAYS);

        resultAwardStatusLabel.getStyleClass().add("text-secondary");
        resultAwardStatusLabel.setWrapText(true);
        resultAwardStatusLabel.setPadding(new Insets(4, 12, 0, 12));
        resultAwardButton.setMaxWidth(Double.MAX_VALUE);
        resultAwardButton.setOnAction(event -> onAwardXp.run());
        Button doneButton = new Button("Abschliessen");
        doneButton.setMaxWidth(Double.MAX_VALUE);
        doneButton.setOnAction(event -> onReturnToBuilder.run());
        HBox.setHgrow(resultAwardButton, Priority.ALWAYS);
        HBox.setHgrow(doneButton, Priority.ALWAYS);
        HBox buttons = new HBox(8, resultAwardButton, doneButton);
        buttons.setPadding(new Insets(8, 12, 10, 12));

        root.getChildren().addAll(title, resultSubtitleLabel, new Separator(), summary, new Separator(),
                controls, new Separator(), enemies, new Separator(), resultAwardStatusLabel, buttons);
        return root;
    }

    private void rebuildRoster(BuilderStateView state) {
        rosterList.getChildren().clear();
        advisoryRegion.getChildren().clear();
        if (state.roster().isEmpty()) {
            rosterPlaceholder.setText("Monster per +Add hinzufuegen...");
            rosterPlaceholder.setVisible(true);
            rosterPlaceholder.setManaged(true);
            rosterScroll.setVisible(false);
            rosterScroll.setManaged(false);
            advisoryRegion.setVisible(false);
            advisoryRegion.setManaged(false);
            return;
        }
        rosterPlaceholder.setVisible(false);
        rosterPlaceholder.setManaged(false);
        rosterScroll.setVisible(true);
        rosterScroll.setManaged(true);
        for (RosterCardView card : state.roster()) {
            rosterList.getChildren().add(buildRosterCard(card));
        }
        if (!state.message().isBlank()) {
            Label title = new Label("Hinweise");
            title.getStyleClass().addAll("small", "text-secondary");
            Label row = new Label(state.message());
            row.getStyleClass().add("text-secondary");
            row.setWrapText(true);
            advisoryRegion.getChildren().addAll(title, row);
            advisoryRegion.setVisible(true);
            advisoryRegion.setManaged(true);
        } else {
            advisoryRegion.setVisible(false);
            advisoryRegion.setManaged(false);
        }
    }

    private Node buildRosterCard(RosterCardView card) {
        VBox root = new VBox(0);
        root.getStyleClass().add("creature-card");

        Button minus = new Button("-");
        minus.getStyleClass().add("compact");
        Label count = new Label(String.valueOf(card.count()));
        count.getStyleClass().add("bold");
        count.setMinWidth(24);
        count.setAlignment(Pos.CENTER);
        Button plus = new Button("+");
        plus.getStyleClass().add("compact");
        HBox quantity = new HBox(2, minus, count, plus);
        quantity.setAlignment(Pos.CENTER);

        Button name = new Button(card.name());
        name.getStyleClass().add("creature-link");
        name.setTooltip(new Tooltip("Statblock-Hook wird spaeter angebunden."));

        HBox detail = new HBox(4);
        detail.setAlignment(Pos.CENTER_LEFT);
        Label text = new Label("CR " + card.challengeRating() + "  |  " + card.xp() + " XP  |  " + card.type());
        text.getStyleClass().add("text-secondary");
        Label role = new Label(card.role());
        role.getStyleClass().addAll("small", "role-badge", roleStyle(card.role()));
        detail.getChildren().addAll(text, role);

        VBox info = new VBox(2, name, detail);
        HBox.setHgrow(info, Priority.ALWAYS);

        Label expand = new Label("\u25BC");
        expand.getStyleClass().addAll("text-muted", "clickable");
        Button remove = new Button("\u00d7");
        remove.getStyleClass().addAll("compact", "remove-btn");
        VBox right = new VBox(4, expand, remove);
        right.setAlignment(Pos.CENTER_RIGHT);

        HBox summary = new HBox(8, quantity, info, right);
        summary.setAlignment(Pos.CENTER_LEFT);
        root.getChildren().add(summary);
        return root;
    }

    private Node buildInitiativeRow(InitiativeEntryView entry) {
        HBox row = new HBox(8);
        row.setAlignment(Pos.CENTER_LEFT);
        row.setPadding(new Insets(0, 0, 0, 12));
        Label name = new Label(entry.label());
        name.setWrapText(true);
        HBox.setHgrow(name, Priority.ALWAYS);
        Spinner<Integer> spinner = new Spinner<>(-10, 40, entry.initiative());
        spinner.setEditable(true);
        spinner.setPrefWidth(84);
        initiativeSpinnerById.put(entry.id(), spinner);
        Button reroll = new Button("\u2684");
        reroll.getStyleClass().add("spinner-btn");
        reroll.setOnAction(event -> spinner.getValueFactory().setValue(entry.initiative() + 2));
        row.getChildren().addAll(name, spinner, reroll);
        return row;
    }

    private Node buildCombatCard(CombatCardView card) {
        VBox root = new VBox(4);
        root.getStyleClass().add("combat-card");
        if (card.active()) {
            root.getStyleClass().add("combat-card-active");
        } else if (!card.alive()) {
            root.getStyleClass().add("combat-card-dead");
        } else if (card.playerCharacter()) {
            root.getStyleClass().add("combat-card-pc");
        }

        HBox top = new HBox(8);
        top.setAlignment(Pos.CENTER_LEFT);
        Label turn = new Label(card.active() ? "\u25B6" : "");
        if (card.active()) {
            turn.getStyleClass().add("combat-turn-indicator");
        } else {
            turn.getStyleClass().add("combat-turn-indicator-inactive");
        }
        Label name = new Label(card.alive() ? card.name() : "\u2020 " + card.name());
        name.getStyleClass().add("combat-name");
        if (!card.alive()) {
            name.getStyleClass().add("combat-name-dead");
        }
        Region spacer = new Region();
        HBox.setHgrow(spacer, Priority.ALWAYS);
        top.getChildren().addAll(turn, name, spacer);
        if (!card.playerCharacter()) {
            Node hp = hpBar(card);
            Label ac = new Label("AC " + card.armorClass());
            ac.getStyleClass().add("ac-badge");
            top.getChildren().addAll(hp, ac);
        }
        Button init = new Button("Init " + card.initiative());
        init.getStyleClass().addAll("compact", "init-badge");
        init.setOnAction(event -> showInitiativePopup(init, card));
        top.getChildren().add(init);

        Label detail = new Label(card.detail());
        detail.getStyleClass().add("combat-detail");
        detail.setWrapText(true);
        root.getChildren().addAll(top, detail);
        return root;
    }

    private Node buildResultEnemyRow(ResultEnemyView enemy) {
        CheckBox toggle = new CheckBox(enemy.name() + " (" + enemy.status() + ") - " + enemy.loot());
        toggle.setSelected(enemy.defeatedByDefault());
        toggle.getStyleClass().add("text-secondary");
        toggle.selectedProperty().addListener((obs, oldValue, newValue) -> updateResultCalculations());
        return toggle;
    }

    private Node hpBar(CombatCardView card) {
        double fraction = card.maxHp() > 0 ? Math.max(0.0, Math.min(1.0, (double) card.currentHp() / card.maxHp())) : 0.0;
        StackPane bar = new StackPane();
        bar.getStyleClass().addAll("hp-bar-track", "clickable");
        bar.setMinWidth(92);
        bar.setPrefWidth(92);
        HBox fillHost = new HBox();
        fillHost.setMouseTransparent(true);
        Region fill = new Region();
        fill.getStyleClass().addAll("hp-bar-fill", hpFillStyle(fraction));
        fill.prefWidthProperty().bind(bar.widthProperty().multiply(fraction));
        fillHost.getChildren().add(fill);
        Label text = new Label((fraction <= 0.25 ? "! " : "") + card.currentHp() + " / " + card.maxHp());
        text.getStyleClass().addAll("hp-bar-text", "hp-bar-text-on-track");
        text.setMouseTransparent(true);
        bar.getChildren().addAll(fillHost, text);
        StackPane.setAlignment(fillHost, Pos.CENTER_LEFT);
        StackPane.setAlignment(text, Pos.CENTER);
        bar.setAccessibleText(card.name() + " HP " + card.currentHp() + "/" + card.maxHp());
        bar.setOnMouseClicked(event -> showHpPopup(bar, card));
        Tooltip.install(bar, new Tooltip("HP bearbeiten"));
        return bar;
    }

    private void showHpPopup(Node anchor, CombatCardView card) {
        Popup popup = new Popup();
        popup.setAutoHide(true);
        TextField field = popupNumberField("1");
        Button down = popupButton("\u25BC");
        Button up = popupButton("\u25B2");
        down.setOnAction(event -> field.setText(String.valueOf(parse(field.getText(), 1) - 1)));
        up.setOnAction(event -> field.setText(String.valueOf(parse(field.getText(), 1) + 1)));
        Button damage = new Button("-");
        Button heal = new Button("+");
        damage.setDefaultButton(true);
        damage.setOnAction(event -> {
            popup.hide();
            onDamage.accept(card.id(), parse(field.getText(), 1));
        });
        heal.setOnAction(event -> {
            popup.hide();
            onHeal.accept(card.id(), parse(field.getText(), 1));
        });
        showPopup(anchor, popup, field, down, field, up, damage, heal);
    }

    private void showInitiativePopup(Node anchor, CombatCardView card) {
        Popup popup = new Popup();
        popup.setAutoHide(true);
        TextField field = popupNumberField(String.valueOf(card.initiative()));
        Button down = popupButton("\u25BC");
        Button up = popupButton("\u25B2");
        down.setOnAction(event -> field.setText(String.valueOf(parse(field.getText(), card.initiative()) - 1)));
        up.setOnAction(event -> field.setText(String.valueOf(parse(field.getText(), card.initiative()) + 1)));
        Button set = new Button("\u2713 Setzen");
        set.getStyleClass().add("accent");
        set.setDefaultButton(true);
        set.setOnAction(event -> {
            popup.hide();
            onSetInitiative.accept(card.id(), parse(field.getText(), card.initiative()));
        });
        field.setOnAction(event -> set.fire());
        showPopup(anchor, popup, field, down, field, up, set);
    }

    private void showPopup(Node anchor, Popup popup, TextField focus, Node... nodes) {
        HBox content = new HBox(4);
        content.getStyleClass().add("edit-popup-panel");
        content.setAlignment(Pos.CENTER_LEFT);
        content.getChildren().addAll(nodes);
        popup.getContent().add(content);
        popup.setOnHidden(event -> anchor.requestFocus());
        Bounds bounds = anchor.localToScreen(anchor.getBoundsInLocal());
        if (bounds != null) {
            popup.show(anchor, bounds.getMinX(), bounds.getMaxY() + 8);
        }
        Platform.runLater(focus::requestFocus);
    }

    private TextField popupNumberField(String initial) {
        TextField field = new TextField(initial);
        field.getStyleClass().add("quick-search-field");
        field.setPrefWidth(56);
        field.setTextFormatter(new TextFormatter<>(change -> change.getText().matches("[0-9-]*") ? change : null));
        return field;
    }

    private Button popupButton(String text) {
        Button button = new Button(text);
        button.getStyleClass().add("spinner-btn");
        button.setFocusTraversable(false);
        return button;
    }

    private void showNormalEndButton(boolean allEnemiesDefeated) {
        endCombatContainer.getChildren().clear();
        Button end = new Button("_Kampf beenden");
        if (allEnemiesDefeated) {
            end.getStyleClass().add("accent");
        }
        end.setMaxWidth(Double.MAX_VALUE);
        end.setOnAction(event -> showConfirmEndButtons());
        HBox.setHgrow(end, Priority.ALWAYS);
        endCombatContainer.getChildren().add(end);
    }

    private void showConfirmEndButtons() {
        endCombatContainer.getChildren().clear();
        Button cancel = new Button("Abbruch");
        Button confirm = new Button("_Bestaetigen!");
        confirm.getStyleClass().add("accent");
        cancel.setMaxWidth(Double.MAX_VALUE);
        confirm.setMaxWidth(Double.MAX_VALUE);
        HBox.setHgrow(cancel, Priority.ALWAYS);
        HBox.setHgrow(confirm, Priority.ALWAYS);
        cancel.setOnAction(event -> showNormalEndButton(false));
        confirm.setOnAction(event -> onEndCombat.run());
        endCombatContainer.getChildren().addAll(cancel, confirm);
    }

    private void rollAllInitiatives() {
        int seed = 13;
        for (Spinner<Integer> spinner : initiativeSpinnerById.values()) {
            spinner.getValueFactory().setValue(seed);
            seed = seed == 19 ? 11 : seed + 2;
        }
    }

    private List<InitiativeInputView> readInitiatives() {
        List<InitiativeInputView> inputs = new ArrayList<>();
        for (Map.Entry<String, Spinner<Integer>> entry : initiativeSpinnerById.entrySet()) {
            Spinner<Integer> spinner = entry.getValue();
            spinner.commitValue();
            inputs.add(new InitiativeInputView(entry.getKey(), spinner.getValue()));
        }
        return inputs;
    }

    private void updateResultCalculations() {
        int selectedXp = 0;
        long selectedCount = 0;
        int childIndex = 0;
        for (ResultEnemyView enemy : lastResultState.enemies()) {
            Node node = childIndex < resultEnemyList.getChildren().size() ? resultEnemyList.getChildren().get(childIndex) : null;
            boolean selected = node instanceof CheckBox checkBox && checkBox.isSelected();
            if (selected) {
                selectedXp += enemy.xp();
                selectedCount++;
            }
            childIndex++;
        }
        int thresholdPercent = (int) Math.round(resultThresholdSlider.getValue() * 100);
        int fractionPercent = (int) Math.round(resultFractionSlider.getValue() * 100);
        int awardedXp = (int) Math.round(selectedXp * resultFractionSlider.getValue());
        int partySize = Math.max(1, lastResultState.partySize());
        int perPlayer = awardedXp / partySize;
        resultSubtitleLabel.setText(selectedCount + " Gegner besiegt | " + selectedXp + " XP");
        resultThresholdValueLabel.setText(thresholdPercent + "%");
        resultFractionValueLabel.setText(fractionPercent + "%");
        resultXpLabel.setText(perPlayer + " XP");
        resultPartyLabel.setText("pro Spieler  (" + partySize + " Spieler | " + awardedXp + " XP gesamt)");
        resultGoldLabel.setText(lastResultState.goldSummary());
        resultLootLabel.setText(lastResultState.lootDetail());
    }

    private HBox sliderRow(String title, Slider slider, Label valueLabel) {
        Label label = new Label(title);
        label.getStyleClass().add("text-secondary");
        valueLabel.setMinWidth(40);
        valueLabel.setAlignment(Pos.CENTER_RIGHT);
        HBox.setHgrow(slider, Priority.ALWAYS);
        HBox row = new HBox(8, label, slider, valueLabel);
        row.setAlignment(Pos.CENTER_LEFT);
        return row;
    }

    private Slider percentSlider() {
        Slider slider = new Slider(0, 1, 1);
        slider.setMajorTickUnit(0.25);
        slider.setMinorTickCount(4);
        slider.setShowTickMarks(true);
        slider.setShowTickLabels(true);
        slider.setLabelFormatter(new StringConverter<>() {
            @Override
            public String toString(Double value) {
                return (int) Math.round(value * 100) + "%";
            }

            @Override
            public Double fromString(String string) {
                return 0.0;
            }
        });
        return slider;
    }

    private void setContent(Node node) {
        if (contentArea.getChildren().size() == 1 && contentArea.getChildren().get(0) == node) {
            return;
        }
        contentArea.getChildren().setAll(node);
    }

    private Label sectionHeader(String text) {
        Label label = new Label(text);
        label.getStyleClass().addAll("section-header", "text-muted");
        return label;
    }

    private Separator separator() {
        return new Separator();
    }

    private int parse(String text, int fallback) {
        try {
            return Integer.parseInt(text.trim());
        } catch (NumberFormatException exception) {
            return fallback;
        }
    }

    private static void updateDifficultyStyle(Label label, String difficulty) {
        label.getStyleClass().removeAll("difficulty-easy", "difficulty-medium", "difficulty-hard", "difficulty-deadly");
        label.getStyleClass().add(difficultyStyle(difficulty));
    }

    private static String difficultyStyle(String difficulty) {
        if ("Deadly".equalsIgnoreCase(difficulty)) {
            return "difficulty-deadly";
        }
        if ("Hard".equalsIgnoreCase(difficulty)) {
            return "difficulty-hard";
        }
        if ("Medium".equalsIgnoreCase(difficulty)) {
            return "difficulty-medium";
        }
        return "difficulty-easy";
    }

    private static String roleStyle(String role) {
        if ("Boss".equalsIgnoreCase(role)) {
            return "role-boss";
        }
        if ("Archer".equalsIgnoreCase(role)) {
            return "role-archer";
        }
        if ("Controller".equalsIgnoreCase(role)) {
            return "role-controller";
        }
        if ("Skirmisher".equalsIgnoreCase(role)) {
            return "role-skirmisher";
        }
        if ("Support".equalsIgnoreCase(role)) {
            return "role-support";
        }
        if ("Soldier".equalsIgnoreCase(role)) {
            return "role-soldier";
        }
        return "role-minion";
    }

    private static String hpFillStyle(double fraction) {
        if (fraction > 0.5) {
            return "hp-fill-healthy";
        }
        if (fraction > 0.25) {
            return "hp-fill-wounded";
        }
        return "hp-fill-critical";
    }

    public record BuilderSettingsInput(String difficultyLabel, int balanceLevel, double amountValue, int diversityLevel) {
        static BuilderSettingsInput defaultInput() {
            return new BuilderSettingsInput("Auto", 3, 3.0, 3);
        }
    }

    public record BuilderStateView(
            String partyLabel,
            String templateLabel,
            DifficultySummaryView difficulty,
            BuilderSettingsInput settings,
            List<RosterCardView> roster,
            boolean canStartCombat,
            String message
    ) {
        public BuilderStateView {
            roster = roster == null ? List.of() : List.copyOf(roster);
        }
    }

    public record DifficultySummaryView(int easy, int medium, int hard, int deadly, int adjustedXp, String difficulty) {
    }

    public record RosterCardView(
            String name,
            String challengeRating,
            int xp,
            int armorClass,
            String type,
            String role,
            int count
    ) {
    }

    public record InitiativeEntryView(String id, String label, String kind, int initiative) {
    }

    public record InitiativeInputView(String id, int initiative) {
    }

    public record InitiativeStateView(List<InitiativeEntryView> entries) {
        public InitiativeStateView {
            entries = entries == null ? List.of() : List.copyOf(entries);
        }
    }

    public record CombatCardView(
            String id,
            String name,
            boolean playerCharacter,
            boolean active,
            boolean alive,
            int currentHp,
            int maxHp,
            int armorClass,
            int initiative,
            int count,
            String detail
    ) {
    }

    public record CombatStateView(int round, String status, List<CombatCardView> cards, boolean allEnemiesDefeated) {
        public CombatStateView {
            cards = cards == null ? List.of() : List.copyOf(cards);
        }
    }

    public record ResultEnemyView(String name, String status, int hpLoss, int xp, boolean defeatedByDefault, String loot) {
    }

    public record ResultStateView(
            List<ResultEnemyView> enemies,
            long defeatedCount,
            int eligibleXp,
            int perPlayerXp,
            String goldSummary,
            String lootDetail,
            String awardStatus,
            boolean xpAwarded,
            boolean canAwardXp,
            int partySize
    ) {
        public ResultStateView {
            enemies = enemies == null ? List.of() : List.copyOf(enemies);
            partySize = Math.max(1, partySize);
        }

        static ResultStateView empty() {
            return new ResultStateView(List.of(), 0, 0, 0, "Kein Loot", "", "", false, false, 1);
        }
    }

    private static final class DifficultyMeterView extends StackPane {

        private final HBox meterBar = new HBox(0);
        private final Region marker = new Region();
        private double markerFraction;

        private DifficultyMeterView() {
            setMinHeight(28);
            setPrefHeight(28);
            setMaxHeight(28);
            meterBar.getStyleClass().add("difficulty-meter-bar");
            meterBar.getChildren().addAll(
                    meterSegment("difficulty-meter-easy"),
                    meterSegment("difficulty-meter-medium"),
                    meterSegment("difficulty-meter-hard"),
                    meterSegment("difficulty-meter-deadly"));
            meterBar.setMaxHeight(12);
            marker.getStyleClass().add("difficulty-meter-marker");
            marker.setMinSize(2, 22);
            marker.setPrefSize(2, 22);
            marker.setMaxSize(2, 22);
            marker.setMouseTransparent(true);
            getChildren().addAll(meterBar, marker);
            StackPane.setAlignment(meterBar, Pos.CENTER);
            StackPane.setAlignment(marker, Pos.CENTER_LEFT);
            widthProperty().addListener((obs, oldValue, newValue) -> positionMarker());
        }

        private void update(DifficultySummaryView value) {
            DifficultySummaryView summary = value == null ? new DifficultySummaryView(0, 0, 0, 0, 0, "") : value;
            double maxXp = Math.max(1.0, summary.deadly() * 1.5);
            markerFraction = Math.max(0.0, Math.min(1.0, summary.adjustedXp() / maxXp));
            marker.setVisible(summary.adjustedXp() > 0);
            positionMarker();
        }

        private Region meterSegment(String styleClass) {
            Region segment = new Region();
            segment.getStyleClass().add(styleClass);
            HBox.setHgrow(segment, Priority.ALWAYS);
            return segment;
        }

        private void positionMarker() {
            double markerWidth = marker.prefWidth(-1);
            double width = getWidth();
            if (width <= 0) {
                return;
            }
            marker.setTranslateX((width * markerFraction) - (width / 2.0) - (markerWidth / 2.0));
        }
    }
}
