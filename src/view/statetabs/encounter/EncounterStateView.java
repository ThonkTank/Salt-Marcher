package src.view.statetabs.encounter;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;
import javafx.beans.property.StringProperty;
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
import javafx.util.StringConverter;
import org.jspecify.annotations.Nullable;
import src.view.slotcontent.primitives.dialog.DialogSurfaceView;
import src.view.slotcontent.primitives.dialog.DialogSurfaceView.BodyPolicy;
import src.view.slotcontent.primitives.popup.AnchoredPopupView;
import src.view.slotcontent.primitives.progressmeter.ProgressMeterView;
import src.view.slotcontent.primitives.progressmeter.ProgressMeterView.PopupAction;
import src.view.slotcontent.primitives.progressmeter.ProgressMeterView.PopupSpec;

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
    private final Button previousAlternativeButton = new Button("<");
    private final Button nextAlternativeButton = new Button(">");
    private final Button saveEncounterButton = new Button("Speichern");
    private final Button openEncounterButton = new Button("Oeffnen");
    private final Button clearHistoryButton = new Button("Clear");
    private final Button builderStartCombatButton = new Button("_Kampf starten");
    private final DialogSurfaceView builderPane = buildBuilderPane();

    private final Map<String, Spinner<Integer>> initiativeSpinnerById = new LinkedHashMap<>();
    private final VBox initiativeList = new VBox(6);
    private final DialogSurfaceView initiativePane = buildInitiativePane();

    private final Label combatRoundLabel = new Label();
    private final Label combatStatusLabel = new Label();
    private final VBox combatCardList = new VBox(6);
    private final HBox endCombatContainer = new HBox(6);
    private final DialogSurfaceView combatPane = buildCombatPane();

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
    private final DialogSurfaceView resultsPane = buildResultsPane();

    private Consumer<EncounterStateViewInputEvent> viewInputEventHandler = ignored -> { };
    private ResultStateView lastResultState = ResultStateView.empty();
    private BuilderStateView lastBuilderState = BuilderStateView.empty();

    public EncounterStateView() {
        setSpacing(0);
        setPadding(new Insets(0));
        getStyleClass().add("surface-root");
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

    public void onViewInputEvent(Consumer<EncounterStateViewInputEvent> handler) {
        viewInputEventHandler = handler == null ? ignored -> { } : handler;
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
        previousAlternativeButton.setDisable(!state.canPreviousAlternative());
        nextAlternativeButton.setDisable(!state.canNextAlternative());
        saveEncounterButton.setDisable(!state.canSavePlan());
        openEncounterButton.setDisable(state.savedPlans().isEmpty());
        clearHistoryButton.setDisable(!state.canClearGenerationHistory());
        builderStartCombatButton.setDisable(!state.canStartCombat());
        lastBuilderState = state;
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
        Node addPartyNode = combatPane.lookup("#encounter-add-party-button");
        if (addPartyNode instanceof PartyMemberButton addPartyButton) {
            addPartyButton.updateCandidates(state.missingPartyMembers());
            addPartyButton.onPartyMemberSelected((memberId, initiative) -> publish(
                    EncounterStateViewInputEvent.Source.ADD_PARTY_MEMBER_SELECTION,
                    0L,
                    0L,
                    0L,
                    List.of(),
                    "",
                    0,
                    initiative,
                    memberId,
                    false));
        }
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

    private void publish(EncounterStateViewInputEvent event) {
        viewInputEventHandler.accept(event);
    }

    private void publish(EncounterStateViewInputEvent.Source source) {
        publish(source, 0L, 0L, 0L, List.of(), "", 0, 0, 0L, false);
    }

    private void publishCreatureAction(EncounterStateViewInputEvent.Source source, long creatureId) {
        publish(source, 0L, creatureId, 0L, List.of(), "", 0, 0, 0L, false);
    }

    private void publishSelectedPlan(long selectedPlanId) {
        publish(EncounterStateViewInputEvent.Source.OPEN_SAVED_PLAN_SELECTION,
                selectedPlanId,
                0L,
                0L,
                List.of(),
                "",
                0,
                0,
                0L,
                false);
    }

    private void publishUndo(long undoToken) {
        publish(EncounterStateViewInputEvent.Source.UNDO_REMOVE_BUTTON,
                0L,
                0L,
                undoToken,
                List.of(),
                "",
                0,
                0,
                0L,
                false);
    }

    private void publishInitiativeConfirmation(List<EncounterStateViewInputEvent.InitiativeEntry> initiatives) {
        publish(EncounterStateViewInputEvent.Source.INITIATIVE_CONFIRM_BUTTON,
                0L,
                0L,
                0L,
                initiatives,
                "",
                0,
                0,
                0L,
                false);
    }

    private void publishHitPointAdjustment(String combatantId, int amount, boolean healing) {
        publish(EncounterStateViewInputEvent.Source.HIT_POINT_ADJUSTMENT,
                0L,
                0L,
                0L,
                List.of(),
                combatantId,
                amount,
                0,
                0L,
                healing);
    }

    private void publishInitiativeValue(String combatantId, int initiativeValue) {
        publish(EncounterStateViewInputEvent.Source.INITIATIVE_VALUE_SUBMIT,
                0L,
                0L,
                0L,
                List.of(),
                combatantId,
                0,
                initiativeValue,
                0L,
                false);
    }

    private void publish(
            EncounterStateViewInputEvent.Source source,
            long selectedPlanId,
            long creatureId,
            long undoToken,
            List<EncounterStateViewInputEvent.InitiativeEntry> initiatives,
            String combatantId,
            int amount,
            int initiativeValue,
            long partyMemberId,
            boolean healing
    ) {
        publish(new EncounterStateViewInputEvent(
                source,
                selectedPlanId,
                creatureId,
                undoToken,
                initiatives,
                combatantId,
                amount,
                initiativeValue,
                partyMemberId,
                healing));
    }

    private DialogSurfaceView buildBuilderPane() {
        DialogSurfaceView dialog = new DialogSurfaceView();
        Label title = new Label("Encounter");
        title.getStyleClass().add("title");
        saveEncounterButton.getStyleClass().addAll("compact", "neutral-action");
        saveEncounterButton.setTooltip(new Tooltip("Aktuelles Encounter-Roster speichern"));
        saveEncounterButton.setOnAction(event -> publish(EncounterStateViewInputEvent.Source.SAVE_PLAN_BUTTON));
        openEncounterButton.getStyleClass().addAll("compact", "neutral-action");
        openEncounterButton.setTooltip(new Tooltip("Gespeichertes Encounter oeffnen"));
        openEncounterButton.setOnAction(event -> showSavedPlansPopup(openEncounterButton));
        clearHistoryButton.getStyleClass().addAll("compact", "neutral-action");
        clearHistoryButton.setTooltip(new Tooltip("Generator-Historie leeren"));
        clearHistoryButton.setOnAction(event -> publish(EncounterStateViewInputEvent.Source.CLEAR_HISTORY_BUTTON));
        Region titleSpacer = new Region();
        HBox.setHgrow(titleSpacer, Priority.ALWAYS);
        HBox titleRow = new HBox(8, title, titleSpacer, clearHistoryButton, openEncounterButton, saveEncounterButton);
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
        generateButton.setOnAction(event -> publish(EncounterStateViewInputEvent.Source.GENERATE_BUTTON));
        previousAlternativeButton.getStyleClass().addAll("compact", "neutral-action");
        previousAlternativeButton.setTooltip(new Tooltip("Vorherige Generator-Alternative"));
        previousAlternativeButton.setOnAction(event -> publish(EncounterStateViewInputEvent.Source.PREVIOUS_ALTERNATIVE_BUTTON));
        nextAlternativeButton.getStyleClass().addAll("compact", "neutral-action");
        nextAlternativeButton.setTooltip(new Tooltip("Naechste Generator-Alternative"));
        nextAlternativeButton.setOnAction(event -> publish(EncounterStateViewInputEvent.Source.NEXT_ALTERNATIVE_BUTTON));
        builderStartCombatButton.getStyleClass().add("accent");
        builderStartCombatButton.setMaxWidth(Double.MAX_VALUE);
        builderStartCombatButton.setDisable(true);
        builderStartCombatButton.setOnAction(event -> publish(EncounterStateViewInputEvent.Source.START_INITIATIVE_BUTTON));
        DialogSurfaceView.grow(generateButton);
        DialogSurfaceView.grow(builderStartCombatButton);

        VBox body = new VBox(0,
                summaryRow,
                difficultyMeter,
                thresholdRow,
                builderXpLabel,
                rosterHost,
                advisoryRegion);
        body.setPadding(DialogSurfaceView.contentInsets());
        dialog.setHeader(titleRow);
        dialog.setBody(body, BodyPolicy.FIXED);
        dialog.setFooter(previousAlternativeButton, generateButton, nextAlternativeButton, builderStartCombatButton);
        return dialog;
    }

    private DialogSurfaceView buildInitiativePane() {
        DialogSurfaceView dialog = new DialogSurfaceView();
        Label title = new Label("Initiative");
        title.getStyleClass().add("title");
        initiativeList.setPadding(DialogSurfaceView.contentInsets());

        Button backButton = new Button("\u2190 Zurueck");
        backButton.setOnAction(event -> publish(EncounterStateViewInputEvent.Source.INITIATIVE_BACK_BUTTON));
        Button rollAllButton = new Button("Alle wuerfeln");
        rollAllButton.getStyleClass().add("neutral-action");
        rollAllButton.setOnAction(event -> rollAllInitiatives());
        Button startButton = new Button("Kampf starten");
        startButton.getStyleClass().add("accent");
        startButton.setOnAction(event -> publishInitiativeConfirmation(readInitiatives()));
        dialog.setHeader(title);
        dialog.setBody(initiativeList, BodyPolicy.SCROLL);
        dialog.setFooter(backButton, rollAllButton, DialogSurfaceView.spacer(), startButton);
        return dialog;
    }

    private DialogSurfaceView buildCombatPane() {
        DialogSurfaceView dialog = new DialogSurfaceView();
        combatRoundLabel.getStyleClass().add("title");
        combatStatusLabel.getStyleClass().add("text-secondary");

        PartyMemberButton addPartyButton = new PartyMemberButton();
        HBox actions = new HBox(addPartyButton);
        actions.setAlignment(Pos.CENTER_RIGHT);

        combatCardList.setPadding(DialogSurfaceView.contentInsets());

        Button nextTurnButton = new Button("\u25B6 _Weiter");
        nextTurnButton.getStyleClass().add("accent");
        nextTurnButton.setMaxWidth(Double.MAX_VALUE);
        nextTurnButton.setOnAction(event -> publish(EncounterStateViewInputEvent.Source.NEXT_TURN_BUTTON));
        endCombatContainer.setAlignment(Pos.CENTER);
        DialogSurfaceView.grow(nextTurnButton);
        DialogSurfaceView.grow(endCombatContainer);
        dialog.setHeader(combatRoundLabel, combatStatusLabel, actions);
        dialog.setBody(combatCardList, BodyPolicy.SCROLL);
        dialog.setFooter(nextTurnButton, endCombatContainer);
        return dialog;
    }

    private DialogSurfaceView buildResultsPane() {
        DialogSurfaceView dialog = new DialogSurfaceView();
        Label title = new Label("Kampfergebnis");
        title.getStyleClass().add("title");
        resultSubtitleLabel.getStyleClass().add("text-secondary");
        resultXpLabel.getStyleClass().add("encounter-result-xp");
        resultPartyLabel.getStyleClass().add("text-secondary");
        resultGoldLabel.getStyleClass().add("encounter-result-gold");
        resultLootLabel.getStyleClass().add("text-secondary");
        resultLootLabel.setWrapText(true);

        VBox summary = new VBox(2, resultXpLabel, resultPartyLabel, resultGoldLabel, resultLootLabel);

        resultThresholdSlider.valueProperty().addListener((obs, oldValue, newValue) -> updateResultCalculations());
        resultFractionSlider.valueProperty().addListener((obs, oldValue, newValue) -> updateResultCalculations());
        VBox controls = new VBox(4,
                sliderRow("Besiegungsschwelle", resultThresholdSlider, resultThresholdValueLabel),
                sliderRow("XP-Anteil", resultFractionSlider, resultFractionValueLabel));

        resultEnemyList.setPadding(new Insets(2, 0, 8, 0));

        resultAwardStatusLabel.getStyleClass().add("text-secondary");
        resultAwardStatusLabel.setWrapText(true);
        resultAwardButton.setMaxWidth(Double.MAX_VALUE);
        resultAwardButton.setOnAction(event -> publish(EncounterStateViewInputEvent.Source.AWARD_XP_BUTTON));
        Button doneButton = new Button("Zum Planer");
        doneButton.setTooltip(new Tooltip("Zur Encounter-Planung zurueckkehren"));
        doneButton.setAccessibleText("Zur Encounter-Planung zurueckkehren");
        doneButton.setMaxWidth(Double.MAX_VALUE);
        doneButton.setOnAction(event -> publish(EncounterStateViewInputEvent.Source.RETURN_TO_BUILDER_BUTTON));
        DialogSurfaceView.grow(resultAwardButton);
        DialogSurfaceView.grow(doneButton);

        VBox body = new VBox(8, summary, separator(), controls, separator(), resultEnemyList,
                separator(), resultAwardStatusLabel);
        body.setPadding(DialogSurfaceView.contentInsets());
        dialog.setHeader(title, resultSubtitleLabel);
        dialog.setBody(body, BodyPolicy.SCROLL);
        dialog.setFooter(resultAwardButton, doneButton);
        return dialog;
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
            rebuildAdvisory(state);
            return;
        }
        rosterPlaceholder.setVisible(false);
        rosterPlaceholder.setManaged(false);
        rosterScroll.setVisible(true);
        rosterScroll.setManaged(true);
        for (RosterCardView card : state.roster()) {
            rosterList.getChildren().add(buildRosterCard(card));
        }
        rebuildAdvisory(state);
    }

    private void rebuildAdvisory(BuilderStateView state) {
        if (state.pendingUndo() != null) {
            UndoRemoveView undo = state.pendingUndo();
            Label removed = new Label(undo.creatureName() + " entfernt.");
            removed.getStyleClass().add("text-secondary");
            Button undoButton = new Button("Rueckgaengig");
            undoButton.getStyleClass().addAll("compact", "neutral-action");
            undoButton.setOnAction(event -> publishUndo(undo.token()));
            HBox row = new HBox(8, removed, undoButton);
            row.setAlignment(Pos.CENTER_LEFT);
            advisoryRegion.getChildren().add(row);
        }
        if (advisoryRegion.getChildren().isEmpty()) {
            advisoryRegion.setVisible(false);
            advisoryRegion.setManaged(false);
        } else {
            advisoryRegion.setVisible(true);
            advisoryRegion.setManaged(true);
        }
    }

    private Node buildRosterCard(RosterCardView card) {
        VBox root = new VBox(0);
        root.getStyleClass().add("entity-card");

        Button minus = new Button("-");
        minus.getStyleClass().add("compact");
        minus.setDisable(card.count() <= 1);
        minus.setOnAction(event -> publishCreatureAction(
                EncounterStateViewInputEvent.Source.ROSTER_DECREMENT_BUTTON,
                card.creatureId()));
        Label count = new Label(String.valueOf(card.count()));
        count.getStyleClass().add("bold");
        count.setMinWidth(24);
        count.setAlignment(Pos.CENTER);
        Button plus = new Button("+");
        plus.getStyleClass().add("compact");
        plus.setOnAction(event -> publishCreatureAction(
                EncounterStateViewInputEvent.Source.ROSTER_INCREMENT_BUTTON,
                card.creatureId()));
        HBox quantity = new HBox(2, minus, count, plus);
        quantity.setAlignment(Pos.CENTER);

        Button name = new Button(card.name());
        name.getStyleClass().add("creature-link");
        name.setTooltip(new Tooltip("Creature details oeffnen"));
        name.setOnAction(event -> publishCreatureAction(
                EncounterStateViewInputEvent.Source.OPEN_CREATURE_LINK,
                card.creatureId()));

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
        remove.setOnAction(event -> publishCreatureAction(
                EncounterStateViewInputEvent.Source.ROSTER_REMOVE_BUTTON,
                card.creatureId()));
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
            if (card.count() > 1) {
                Label count = new Label("x" + card.count());
                count.getStyleClass().add("ac-badge");
                top.getChildren().add(count);
            }
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
        ProgressMeterView bar = new ProgressMeterView(
                fraction,
                (fraction <= 0.25 ? "! " : "") + card.currentHp() + " / " + card.maxHp(),
                card.name() + " HP " + card.currentHp() + "/" + card.maxHp(),
                hpFillStyle(fraction),
                "progress-meter-combat",
                new PopupSpec(
                        "HP bearbeiten",
                        1,
                        List.of(
                                new PopupAction(
                                        "-",
                                        "",
                                        true,
                                        amount -> publishHitPointAdjustment(card.id(), amount, false)),
                                new PopupAction(
                                        "+",
                                        "",
                                        false,
                                        amount -> publishHitPointAdjustment(card.id(), amount, true)))));
        return bar;
    }

    private void showInitiativePopup(Node anchor, CombatCardView card) {
        AnchoredPopupView popup = new AnchoredPopupView();
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
            publishInitiativeValue(card.id(), parse(field.getText(), card.initiative()));
        });
        field.setOnAction(event -> set.fire());
        showPopup(anchor, popup, field, down, field, up, set);
    }

    private void showSavedPlansPopup(Node anchor) {
        AnchoredPopupView popup = new AnchoredPopupView();
        VBox content = new VBox(4);
        content.getStyleClass().add("anchored-popup");
        List<SavedEncounterPlanView> savedPlans = lastBuilderState.savedPlans();
        if (savedPlans.isEmpty()) {
            Label empty = new Label("Keine gespeicherten Encounter.");
            empty.getStyleClass().add("text-secondary");
            content.getChildren().add(empty);
        } else {
            for (SavedEncounterPlanView plan : savedPlans) {
                Button option = new Button(savedPlanLabel(plan));
                option.getStyleClass().addAll("creature-link");
                option.setMaxWidth(Double.MAX_VALUE);
                option.setOnAction(event -> {
                    popup.hide();
                    publishSelectedPlan(plan.id());
                });
                content.getChildren().add(option);
            }
        }
        popup.setContent(content);
        popup.showBelow(anchor, 8);
    }

    private static String savedPlanLabel(SavedEncounterPlanView plan) {
        String suffix = plan.generatedLabel().isBlank() ? "" : " - " + plan.generatedLabel();
        return plan.name() + suffix + " (" + plan.creatureCount() + ")";
    }

    private void showPopup(Node anchor, AnchoredPopupView popup, TextField focus, Node... nodes) {
        HBox content = new HBox(4);
        content.getStyleClass().add("anchored-popup");
        content.setAlignment(Pos.CENTER_LEFT);
        content.getChildren().addAll(nodes);
        popup.setContent(content);
        popup.showBelow(anchor, 8);
        popup.focusAfterShown(focus);
    }

    private TextField popupNumberField(String initial) {
        TextField field = new TextField(initial);
        field.getStyleClass().add("text-field");
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
        confirm.setOnAction(event -> publish(EncounterStateViewInputEvent.Source.END_COMBAT_CONFIRM_BUTTON));
        endCombatContainer.getChildren().addAll(cancel, confirm);
    }

    private void rollAllInitiatives() {
        int seed = 13;
        for (Spinner<Integer> spinner : initiativeSpinnerById.values()) {
            spinner.getValueFactory().setValue(seed);
            seed = seed == 19 ? 11 : seed + 2;
        }
    }

    private List<EncounterStateViewInputEvent.InitiativeEntry> readInitiatives() {
        List<EncounterStateViewInputEvent.InitiativeEntry> inputs = new ArrayList<>();
        for (Map.Entry<String, Spinner<Integer>> entry : initiativeSpinnerById.entrySet()) {
            Spinner<Integer> spinner = entry.getValue();
            spinner.commitValue();
            inputs.add(new EncounterStateViewInputEvent.InitiativeEntry(entry.getKey(), spinner.getValue()));
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
            return new BuilderSettingsInput("Auto", -1, -1.0, -1);
        }
    }

    public record BuilderStateView(
            String partyLabel,
            String templateLabel,
            DifficultySummaryView difficulty,
            List<SavedEncounterPlanView> savedPlans,
            BuilderSettingsInput settings,
            List<RosterCardView> roster,
            boolean canStartCombat,
            boolean canPreviousAlternative,
            boolean canNextAlternative,
            boolean canSavePlan,
            boolean canClearGenerationHistory,
            @Nullable UndoRemoveView pendingUndo
    ) {
        static BuilderStateView empty() {
            return new BuilderStateView(
                    "",
                    "",
                    new DifficultySummaryView(0, 0, 0, 0, 0, ""),
                    List.of(),
                    BuilderSettingsInput.defaultInput(),
                    List.of(),
                    false,
                    false,
                    false,
                    false,
                    false,
                    null);
        }

        public BuilderStateView {
            savedPlans = savedPlans == null ? List.of() : List.copyOf(savedPlans);
            roster = roster == null ? List.of() : List.copyOf(roster);
        }
    }

    public record SavedEncounterPlanView(long id, String name, String generatedLabel, int creatureCount) {
        public SavedEncounterPlanView {
            name = name == null ? "" : name.trim();
            generatedLabel = generatedLabel == null ? "" : generatedLabel.trim();
            creatureCount = Math.max(0, creatureCount);
        }
    }

    public record DifficultySummaryView(int easy, int medium, int hard, int deadly, int adjustedXp, String difficulty) {
    }

    public record RosterCardView(
            long creatureId,
            String name,
            String challengeRating,
            int xp,
            int armorClass,
            String type,
            String role,
            int count
    ) {
    }

    public record UndoRemoveView(long token, String creatureName) {
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

    public record CombatStateView(
            int round,
            String status,
            List<CombatCardView> cards,
            boolean allEnemiesDefeated,
            List<PartyMemberCandidate> missingPartyMembers
    ) {
        public CombatStateView {
            cards = cards == null ? List.of() : List.copyOf(cards);
            missingPartyMembers = missingPartyMembers == null ? List.of() : List.copyOf(missingPartyMembers);
        }
    }

    public record PartyMemberCandidate(long memberId, String name, int level) {
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
            marker.setTranslateX((width * markerFraction) - (width / 2) - (markerWidth / 2));
        }
    }

    @FunctionalInterface
    private interface PartyMemberSelectionListener {
        void onPartyMemberSelected(long memberId, int initiative);
    }

    private static final class PartyMemberButton extends Button {

        private static final String CONTROL_ID = "encounter-add-party-button";

        private final PartyMemberPopup popup = new PartyMemberPopup();
        private List<PartyMemberCandidate> candidates = List.of();
        private PartyMemberSelectionListener selectionListener = (memberId, initiative) -> { };

        private PartyMemberButton() {
            super("SC hinzufuegen");
            getStyleClass().addAll("compact", "neutral-action");
            setId(CONTROL_ID);
            updateCandidates(List.of());
            popup.onPartyMemberSelected((memberId, initiative) ->
                    selectionListener.onPartyMemberSelected(memberId, initiative));
            setOnAction(event -> popup.show(this, candidates));
        }

        private void updateCandidates(List<PartyMemberCandidate> value) {
            candidates = value == null ? List.of() : List.copyOf(value);
            setDisable(candidates.isEmpty());
            setTooltip(new Tooltip(candidates.isEmpty()
                    ? "Alle aktiven SCs sind im Kampf."
                    : "Aktives Party-Mitglied in den laufenden Kampf aufnehmen."));
        }

        private void onPartyMemberSelected(PartyMemberSelectionListener listener) {
            selectionListener = listener == null ? (memberId, initiative) -> { } : listener;
        }
    }

    private static final class PartyMemberPopup {

        private final AnchoredPopupView popup = new AnchoredPopupView();
        private PartyMemberSelectionListener selectionListener = (memberId, initiative) -> { };

        private void onPartyMemberSelected(PartyMemberSelectionListener listener) {
            selectionListener = listener == null ? (memberId, initiative) -> { } : listener;
        }

        private void show(Node anchor, List<PartyMemberCandidate> candidates) {
            if (anchor == null || candidates == null || candidates.isEmpty()) {
                return;
            }
            popup.hide();

            VBox list = new VBox(6);
            list.getStyleClass().add("anchored-popup");
            list.setPadding(new Insets(8));

            TextField firstField = null;
            for (PartyMemberCandidate candidate : candidates) {
                TextField initiativeField = initiativeField(candidate.name());
                Button down = spinnerButton("\u25BC");
                Button up = spinnerButton("\u25B2");
                down.setOnAction(event -> initiativeField.setText(String.valueOf(parseInitiative(initiativeField.getText()) - 1)));
                up.setOnAction(event -> initiativeField.setText(String.valueOf(parseInitiative(initiativeField.getText()) + 1)));

                Button add = new Button("Hinzufuegen");
                add.getStyleClass().add("accent");
                Runnable apply = () -> {
                    popup.hide();
                    selectionListener.onPartyMemberSelected(candidate.memberId(), parseInitiative(initiativeField.getText()));
                };
                add.setOnAction(event -> apply.run());
                initiativeField.setOnAction(event -> apply.run());

                Label name = new Label(candidate.name() + " (Lv. " + candidate.level() + ")");
                name.getStyleClass().add("combat-name");
                HBox.setHgrow(name, Priority.ALWAYS);

                HBox row = new HBox(6, name, down, initiativeField, up, add);
                row.setAlignment(Pos.CENTER_LEFT);
                list.getChildren().add(row);
                if (firstField == null) {
                    firstField = initiativeField;
                }
            }

            popup.setContent(list);
            popup.showBelow(anchor, 8);
            if (firstField != null) {
                popup.focusAfterShown(firstField);
            }
        }

        private static TextField initiativeField(String name) {
            TextField field = new TextField("10");
            field.getStyleClass().add("text-field");
            field.setPrefWidth(56);
            field.setAccessibleText("Initiative fuer " + name);
            field.setTextFormatter(new TextFormatter<>(change -> change.getText().matches("[0-9-]*") ? change : null));
            return field;
        }

        private static Button spinnerButton(String text) {
            Button button = new Button(text);
            button.getStyleClass().add("spinner-btn");
            button.setFocusTraversable(false);
            return button;
        }

        private static int parseInitiative(String text) {
            try {
                return Integer.parseInt(text.trim());
            } catch (NumberFormatException exception) {
                return 10;
            }
        }
    }
}
