package src.view.state.encounter;

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
import javafx.scene.control.ToggleButton;
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

    private final BuilderControlPanel builderControls = new BuilderControlPanel();
    private final DifficultyMeterView difficultyMeter = new DifficultyMeterView();
    private final Label builderDifficultyLabel = new Label();
    private final Label builderPartyLabel = new Label();
    private final Label builderXpLabel = new Label();
    private final Label builderMessageLabel = new Label();
    private final Label easyThresholdLabel = new Label();
    private final Label mediumThresholdLabel = new Label();
    private final Label hardThresholdLabel = new Label();
    private final Label deadlyThresholdLabel = new Label();
    private final VBox rosterList = new VBox(6);
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
    private Runnable onAddDemoCreature = () -> { };
    private Runnable onClearRoster = () -> { };
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
        getStyleClass().add("surface-root");
        setFillWidth(true);

        Label title = new Label("Encounter");
        title.getStyleClass().add("title-large");
        modeLabel.getStyleClass().addAll("chip", "chip-type");
        Region titleSpacer = new Region();
        HBox.setHgrow(titleSpacer, Priority.ALWAYS);
        HBox titleRow = new HBox(8, title, titleSpacer, modeLabel);
        titleRow.setAlignment(Pos.CENTER_LEFT);
        titleRow.setPadding(new Insets(10, 12, 4, 12));

        status.getStyleClass().add("text-secondary");
        status.setWrapText(true);
        status.setPadding(new Insets(0, 12, 8, 12));

        VBox.setVgrow(contentArea, Priority.ALWAYS);
        contentArea.getChildren().setAll(builderPane);
        getChildren().addAll(titleRow, status, contentArea);
    }

    public StringProperty statusTextProperty() {
        return status.textProperty();
    }

    public void showBuilder(BuilderStateView state) {
        modeLabel.setText("Creation");
        setContent(builderPane);
        builderDifficultyLabel.setText(state.difficulty().difficulty());
        builderPartyLabel.setText(state.partyLabel());
        builderXpLabel.setText("Adj. XP: " + state.difficulty().adjustedXp());
        builderMessageLabel.setText(state.message());
        easyThresholdLabel.setText("Easy " + state.difficulty().easy());
        mediumThresholdLabel.setText("Med. " + state.difficulty().medium());
        hardThresholdLabel.setText("Hard " + state.difficulty().hard());
        deadlyThresholdLabel.setText("Deadly " + state.difficulty().deadly());
        builderControls.apply(state.settings());
        difficultyMeter.update(state.difficulty());
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
                Label header = sectionHeader(currentKind);
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

    public void setOnAddDemoCreature(Runnable callback) {
        onAddDemoCreature = callback == null ? () -> { } : callback;
    }

    public void setOnClearRoster(Runnable callback) {
        onClearRoster = callback == null ? () -> { } : callback;
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
        VBox content = new VBox(8);
        content.setPadding(new Insets(0, 12, 10, 12));

        Label filterHeader = sectionHeader("FILTER");
        HBox filterHooks = new HBox(6);
        filterHooks.setAlignment(Pos.CENTER_LEFT);
        Button catalogHook = new Button("Catalog-Hook");
        catalogHook.getStyleClass().addAll("compact", "filter-trigger");
        catalogHook.setTooltip(new Tooltip("Platzhalter fuer den separat migrierten Creature Catalog."));
        Button allCreatures = new Button("Alle Monster");
        allCreatures.getStyleClass().addAll("compact", "filter-trigger-active");
        Label hookNote = new Label("Katalog verdrahtet spaeter Add/Statblock.");
        hookNote.getStyleClass().add("text-muted");
        hookNote.setWrapText(true);
        filterHooks.getChildren().addAll(catalogHook, allCreatures);

        Label encounterHeader = sectionHeader("ENCOUNTER");
        HBox summaryRow = new HBox(8, builderDifficultyLabel, builderPartyLabel);
        summaryRow.setAlignment(Pos.CENTER_LEFT);
        builderDifficultyLabel.getStyleClass().add("bold");
        builderPartyLabel.getStyleClass().add("text-secondary");
        builderXpLabel.getStyleClass().add("bold");
        builderMessageLabel.getStyleClass().add("text-muted");
        builderMessageLabel.setWrapText(true);

        HBox thresholdRow = new HBox(6, easyThresholdLabel, mediumThresholdLabel, hardThresholdLabel, deadlyThresholdLabel);
        easyThresholdLabel.getStyleClass().addAll("chip", "chip-type");
        mediumThresholdLabel.getStyleClass().addAll("chip", "chip-biome");
        hardThresholdLabel.getStyleClass().addAll("chip", "chip-align");
        deadlyThresholdLabel.getStyleClass().addAll("chip", "chip-cr");

        rosterList.setPadding(new Insets(2, 0, 2, 0));
        ScrollPane rosterScroll = new ScrollPane(rosterList);
        rosterScroll.setFitToWidth(true);
        rosterScroll.setHbarPolicy(ScrollPane.ScrollBarPolicy.NEVER);
        VBox.setVgrow(rosterScroll, Priority.ALWAYS);

        Button addDemoButton = new Button("+ Demo");
        addDemoButton.getStyleClass().addAll("neutral-action", "compact");
        addDemoButton.setOnAction(event -> onAddDemoCreature.run());
        Button clearButton = new Button("Leeren");
        clearButton.getStyleClass().addAll("neutral-action", "compact");
        clearButton.setOnAction(event -> onClearRoster.run());
        Button generateButton = new Button("_Generieren");
        generateButton.getStyleClass().add("neutral-action");
        generateButton.setMaxWidth(Double.MAX_VALUE);
        generateButton.setOnAction(event -> onGenerate.accept(builderControls.input()));
        Button startCombatButton = new Button("_Kampf starten");
        startCombatButton.getStyleClass().add("accent");
        startCombatButton.setMaxWidth(Double.MAX_VALUE);
        startCombatButton.setOnAction(event -> onStartInitiative.run());
        HBox.setHgrow(generateButton, Priority.ALWAYS);
        HBox.setHgrow(startCombatButton, Priority.ALWAYS);
        HBox actionRow = new HBox(8, addDemoButton, clearButton, generateButton, startCombatButton);
        actionRow.setAlignment(Pos.CENTER_LEFT);

        content.getChildren().addAll(
                filterHeader,
                filterHooks,
                hookNote,
                separator(),
                encounterHeader,
                builderControls,
                summaryRow,
                difficultyMeter,
                thresholdRow,
                builderXpLabel,
                builderMessageLabel,
                rosterScroll,
                separator(),
                actionRow);
        return content;
    }

    private VBox buildInitiativePane() {
        VBox root = new VBox(0);
        Label title = new Label("Initiative");
        title.getStyleClass().add("title-large");
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
        combatRoundLabel.getStyleClass().add("title-large");
        combatRoundLabel.setPadding(new Insets(0, 12, 2, 12));
        combatStatusLabel.getStyleClass().add("text-secondary");
        combatStatusLabel.setPadding(new Insets(0, 12, 6, 12));

        Button addPartyButton = new Button("SC hinzufuegen");
        addPartyButton.getStyleClass().addAll("compact", "neutral-action");
        addPartyButton.setDisable(true);
        addPartyButton.setTooltip(new Tooltip("Demo-Platzhalter fuer spaetere Party-Erweiterung."));
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
        title.getStyleClass().add("title-large");
        title.setPadding(new Insets(0, 12, 2, 12));
        resultSubtitleLabel.getStyleClass().add("text-secondary");
        resultSubtitleLabel.setPadding(new Insets(0, 12, 8, 12));
        resultXpLabel.getStyleClass().addAll("title-large", "bold");
        resultPartyLabel.getStyleClass().add("text-secondary");
        resultGoldLabel.getStyleClass().add("bold");
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
        if (state.roster().isEmpty()) {
            Label placeholder = new Label(state.message());
            placeholder.getStyleClass().add("text-muted");
            placeholder.setWrapText(true);
            rosterList.getChildren().add(placeholder);
            return;
        }
        for (RosterCardView card : state.roster()) {
            rosterList.getChildren().add(buildRosterCard(card));
        }
    }

    private Node buildRosterCard(RosterCardView card) {
        VBox root = new VBox(2);
        root.getStyleClass().add("entity-card");
        HBox top = new HBox(8);
        top.setAlignment(Pos.CENTER_LEFT);
        Label count = new Label(String.valueOf(card.count()));
        count.getStyleClass().addAll("chip", "chip-size");
        Label name = new Label(card.name());
        name.getStyleClass().add("bold");
        Region spacer = new Region();
        HBox.setHgrow(spacer, Priority.ALWAYS);
        Label cr = new Label("CR " + card.challengeRating());
        cr.getStyleClass().addAll("chip", "chip-cr");
        top.getChildren().addAll(count, name, spacer, cr);

        HBox detail = new HBox(4);
        Label text = new Label(card.xp() + " XP | AC " + card.armorClass() + " | " + card.type());
        text.getStyleClass().add("text-secondary");
        Label role = new Label(card.role());
        role.getStyleClass().addAll("chip", "chip-type");
        detail.getChildren().addAll(text, role);
        root.getChildren().addAll(top, detail);
        return root;
    }

    private Node buildInitiativeRow(InitiativeEntryView entry) {
        HBox row = new HBox(8);
        row.setAlignment(Pos.CENTER_LEFT);
        row.getStyleClass().add("entity-card");
        Label name = new Label(entry.label());
        name.setWrapText(true);
        HBox.setHgrow(name, Priority.ALWAYS);
        Spinner<Integer> spinner = new Spinner<>(-10, 40, entry.initiative());
        spinner.setEditable(true);
        spinner.setPrefWidth(84);
        initiativeSpinnerById.put(entry.id(), spinner);
        Button reroll = new Button("\u2684");
        reroll.getStyleClass().add("compact");
        reroll.setOnAction(event -> spinner.getValueFactory().setValue(entry.initiative() + 2));
        row.getChildren().addAll(name, spinner, reroll);
        return row;
    }

    private Node buildCombatCard(CombatCardView card) {
        VBox root = new VBox(4);
        root.getStyleClass().add("entity-card");
        if (card.active()) {
            root.getStyleClass().add("content-card");
        } else if (!card.alive()) {
            root.getStyleClass().add("card-surface");
        } else if (card.playerCharacter()) {
            root.getStyleClass().add("card-surface");
        }

        HBox top = new HBox(8);
        top.setAlignment(Pos.CENTER_LEFT);
        Label turn = new Label(card.active() ? "\u25B6" : "");
        if (card.active()) {
            turn.getStyleClass().add("bold");
        } else {
            turn.getStyleClass().add("text-muted");
        }
        Label name = new Label(card.alive() ? card.name() : "\u2020 " + card.name());
        name.getStyleClass().add("bold");
        if (!card.alive()) {
            name.getStyleClass().add("text-muted");
        }
        Region spacer = new Region();
        HBox.setHgrow(spacer, Priority.ALWAYS);
        top.getChildren().addAll(turn, name, spacer);
        if (!card.playerCharacter()) {
            Node hp = hpBar(card);
            Label ac = new Label("AC " + card.armorClass());
            ac.getStyleClass().addAll("chip", "chip-cr");
            top.getChildren().addAll(hp, ac);
        }
        Button init = new Button("Init " + card.initiative());
        init.getStyleClass().addAll("compact", "filter-trigger");
        init.setOnAction(event -> showInitiativePopup(init, card));
        top.getChildren().add(init);

        Label detail = new Label(card.detail());
        detail.getStyleClass().add("text-secondary");
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

    private Button hpBar(CombatCardView card) {
        double fraction = card.maxHp() > 0 ? Math.max(0.0, Math.min(1.0, (double) card.currentHp() / card.maxHp())) : 0.0;
        Button bar = new Button((fraction <= 0.25 ? "! " : "") + card.currentHp() + " / " + card.maxHp());
        bar.getStyleClass().addAll("compact", "filter-trigger");
        if (fraction > 0.5) {
            bar.getStyleClass().add("filter-trigger-active");
        } else if (fraction > 0.25) {
            bar.getStyleClass().add("neutral-action");
        } else {
            bar.getStyleClass().add("accent");
        }
        bar.setMinWidth(92);
        bar.setAccessibleText(card.name() + " HP " + card.currentHp() + "/" + card.maxHp());
        bar.setOnAction(event -> showHpPopup(bar, card));
        bar.setTooltip(new Tooltip("HP bearbeiten"));
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
        content.getStyleClass().add("filter-dropdown");
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
        field.setPrefWidth(56);
        field.setTextFormatter(new TextFormatter<>(change -> change.getText().matches("[0-9-]*") ? change : null));
        return field;
    }

    private Button popupButton(String text) {
        Button button = new Button(text);
        button.getStyleClass().add("compact");
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
        int perPlayer = awardedXp / 4;
        resultSubtitleLabel.setText(selectedCount + " Gegner besiegt | " + selectedXp + " XP");
        resultThresholdValueLabel.setText(thresholdPercent + "%");
        resultFractionValueLabel.setText(fractionPercent + "%");
        resultXpLabel.setText(perPlayer + " XP");
        resultPartyLabel.setText("pro Spieler  (4 Spieler | " + awardedXp + " XP gesamt)");
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

    private Region separator() {
        Region region = new Region();
        region.getStyleClass().add("control-separator");
        return region;
    }

    private int parse(String text, int fallback) {
        try {
            return Integer.parseInt(text.trim());
        } catch (NumberFormatException exception) {
            return fallback;
        }
    }

    public record BuilderSettingsInput(String difficultyLabel, int balanceLevel, double amountValue, int diversityLevel) {
    }

    public record BuilderStateView(
            String partyLabel,
            DifficultySummaryView difficulty,
            BuilderSettingsInput settings,
            List<RosterCardView> roster,
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
            boolean canAwardXp
    ) {
        public ResultStateView {
            enemies = enemies == null ? List.of() : List.copyOf(enemies);
        }

        static ResultStateView empty() {
            return new ResultStateView(List.of(), 0, 0, 0, "Kein Loot", "", "", false, false);
        }
    }

    private static final class BuilderControlPanel extends VBox {

        private final EncounterSlider difficulty =
                new EncounterSlider("Schwierigkeit", 1, 4, 2, true, this::difficultyName);
        private final EncounterSlider balance =
                new EncounterSlider("Balance", 1, 5, 3, true, value -> value <= 1 ? "Extreme" : value >= 5 ? "Durchschnitt" : "");
        private final EncounterSlider amount =
                new EncounterSlider("Menge", 1, 5, 3, false, value -> value <= 1 ? "Boss" : value >= 5 ? "Minions" : "");
        private final EncounterSlider diversity =
                new EncounterSlider("Diversitaet", 1, 4, 3, true, value -> String.valueOf((int) Math.round(value)));

        private BuilderControlPanel() {
            setSpacing(5);
            getChildren().addAll(difficulty, balance, amount, diversity);
        }

        private BuilderSettingsInput input() {
            return new BuilderSettingsInput(
                    difficulty.isAuto() ? "Auto" : difficultyName(difficulty.value()),
                    (int) Math.round(balance.value()),
                    amount.value(),
                    (int) Math.round(diversity.value()));
        }

        private void apply(BuilderSettingsInput settings) {
            if (settings == null) {
                return;
            }
            difficulty.setAuto("Auto".equalsIgnoreCase(settings.difficultyLabel()));
            balance.setValue(settings.balanceLevel());
            amount.setValue(settings.amountValue());
            diversity.setValue(settings.diversityLevel());
        }

        private String difficultyName(double value) {
            int index = Math.max(1, Math.min(4, (int) Math.round(value)));
            return switch (index) {
                case 1 -> "Easy";
                case 2 -> "Medium";
                case 3 -> "Hard";
                default -> "Deadly";
            };
        }
    }

    private static final class EncounterSlider extends HBox {

        private final Slider slider;
        private final ToggleButton autoButton = new ToggleButton("\u2685");
        private final Label valueLabel = new Label();
        private final SliderLabelFormatter formatter;

        private EncounterSlider(
                String title,
                double min,
                double max,
                double defaultValue,
                boolean snapToTicks,
                SliderLabelFormatter formatter
        ) {
            this.formatter = formatter;
            setSpacing(4);
            setAlignment(Pos.CENTER_LEFT);
            Label titleLabel = new Label(title);
            titleLabel.getStyleClass().add("text-muted");
            titleLabel.setMinWidth(86);
            autoButton.getStyleClass().addAll("compact", "filter-trigger", "filter-trigger-active");
            valueLabel.getStyleClass().add("text-secondary");
            valueLabel.setMinWidth(72);
            slider = new Slider(min, max, defaultValue);
            slider.setShowTickLabels(true);
            slider.setShowTickMarks(true);
            slider.setSnapToTicks(snapToTicks);
            slider.setMajorTickUnit(1);
            slider.setMinorTickCount(snapToTicks ? 0 : 4);
            slider.setDisable(true);
            HBox.setHgrow(slider, Priority.ALWAYS);
            autoButton.setOnAction(event -> {
                setAuto(autoButton.isSelected());
                refresh();
            });
            autoButton.setSelected(true);
            slider.valueProperty().addListener((obs, oldValue, newValue) -> refresh());
            getChildren().addAll(titleLabel, autoButton, valueLabel, slider);
            refresh();
        }

        private boolean isAuto() {
            return autoButton.isSelected();
        }

        private void setAuto(boolean auto) {
            autoButton.setSelected(auto);
            autoButton.getStyleClass().remove("filter-trigger-active");
            if (auto) {
                autoButton.getStyleClass().add("filter-trigger-active");
            }
            slider.setDisable(auto);
        }

        private double value() {
            return slider.getValue();
        }

        private void setValue(double value) {
            slider.setValue(value);
            refresh();
        }

        private void refresh() {
            valueLabel.setText(isAuto() ? "Auto" : formatter.label(slider.getValue()));
        }
    }

    @FunctionalInterface
    private interface SliderLabelFormatter {
        String label(double value);
    }

    private static final class DifficultyMeterView extends VBox {

        private final Label marker = new Label();
        private final HBox thresholdChips = new HBox(6);
        private final Label easy = new Label("Easy");
        private final Label medium = new Label("Medium");
        private final Label hard = new Label("Hard");
        private final Label deadly = new Label("Deadly");

        private DifficultyMeterView() {
            setSpacing(4);
            marker.getStyleClass().addAll("text-secondary", "bold");
            easy.getStyleClass().addAll("chip", "chip-type");
            medium.getStyleClass().addAll("chip", "chip-biome");
            hard.getStyleClass().addAll("chip", "chip-align");
            deadly.getStyleClass().addAll("chip", "chip-cr");
            thresholdChips.getChildren().addAll(easy, medium, hard, deadly);
            getChildren().addAll(marker, thresholdChips);
        }

        private void update(DifficultySummaryView value) {
            DifficultySummaryView summary = value == null ? new DifficultySummaryView(0, 0, 0, 0, 0, "") : value;
            marker.setText("Marker: " + summary.adjustedXp() + " XP | " + summary.difficulty());
            easy.setText("Easy " + summary.easy());
            medium.setText("Medium " + summary.medium());
            hard.setText("Hard " + summary.hard());
            deadly.setText("Deadly " + summary.deadly());
        }
    }
}
