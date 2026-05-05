package src.view.statetabs.encounter;

import java.util.List;
import java.util.function.Consumer;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.control.ScrollPane;
import javafx.scene.control.Tooltip;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.StackPane;
import javafx.scene.layout.VBox;
import src.view.slotcontent.primitives.dialog.DialogSurfaceView;
import src.view.slotcontent.primitives.dialog.DialogSurfaceView.BodyPolicy;
import src.view.slotcontent.primitives.popup.AnchoredPopupView;

public final class EncounterBuilderStateView extends VBox {

    private static final String STYLE_COMPACT = "compact";
    private static final String STYLE_NEUTRAL_ACTION = "neutral-action";
    private static final String STYLE_TEXT_SECONDARY = "text-secondary";
    private static final String STYLE_TEXT_MUTED = "text-muted";
    private static final String STYLE_ACCENT = "accent";

    private final DifficultyMeterView difficultyMeter = new DifficultyMeterView();
    private final Label builderDifficultyLabel = new Label();
    private final Label builderTemplateLabel = new Label();
    private final Label builderPartyLabel = new Label();
    private final Label builderXpLabel = new Label();
    private final Label easyThresholdLabel = new Label();
    private final Label mediumThresholdLabel = new Label();
    private final Label hardThresholdLabel = new Label();
    private final Label deadlyThresholdLabel = new Label();
    private final Label builderStatusLabel = new Label();
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
    private final Button startCombatButton = new Button("_Kampf starten");
    private final DialogSurfaceView dialog = buildPane();

    private Consumer<EncounterBuilderStateViewInputEvent> viewInputEventHandler = ignored -> { };
    private EncounterStateContributionModel.BuilderState lastState =
            EncounterStateContributionModel.BuilderState.empty(EncounterStateContributionModel.BuilderSettings.defaultSettings());

    public EncounterBuilderStateView() {
        getChildren().add(dialog);
        VBox.setVgrow(dialog, Priority.ALWAYS);
    }

    public void onViewInputEvent(Consumer<EncounterBuilderStateViewInputEvent> handler) {
        viewInputEventHandler = handler == null ? ignored -> { } : handler;
    }

    public void showBuilder(EncounterStateContributionModel.BuilderState state) {
        EncounterStateContributionModel.BuilderState safeState = state == null
                ? EncounterStateContributionModel.BuilderState.empty(EncounterStateContributionModel.BuilderSettings.defaultSettings())
                : state;
        builderDifficultyLabel.setText(safeState.difficulty().difficulty());
        updateDifficultyStyle(builderDifficultyLabel, safeState.difficulty().difficulty());
        builderTemplateLabel.setText(safeState.templateLabel());
        builderPartyLabel.setText(safeState.partyLabel());
        builderXpLabel.setText("Adj. XP: " + safeState.difficulty().adjustedXp());
        easyThresholdLabel.setText("Easy " + safeState.difficulty().easy());
        mediumThresholdLabel.setText("Med. " + safeState.difficulty().medium());
        hardThresholdLabel.setText("Hard " + safeState.difficulty().hard());
        deadlyThresholdLabel.setText("Deadly " + safeState.difficulty().deadly());
        builderStatusLabel.setText(safeState.statusMessage());
        builderStatusLabel.setVisible(!safeState.statusMessage().isBlank());
        builderStatusLabel.setManaged(!safeState.statusMessage().isBlank());
        difficultyMeter.update(safeState.difficulty());
        previousAlternativeButton.setDisable(!safeState.canPreviousAlternative());
        nextAlternativeButton.setDisable(!safeState.canNextAlternative());
        saveEncounterButton.setDisable(!safeState.canSavePlan());
        openEncounterButton.setDisable(safeState.savedPlans().isEmpty());
        clearHistoryButton.setDisable(!safeState.canClearGenerationHistory());
        startCombatButton.setDisable(!safeState.canStartCombat());
        lastState = safeState;
        rebuildRoster(safeState);
    }

    private DialogSurfaceView buildPane() {
        DialogSurfaceView nextDialog = new DialogSurfaceView();
        Label title = new Label("Encounter");
        title.getStyleClass().add("title");
        saveEncounterButton.getStyleClass().addAll(STYLE_COMPACT, STYLE_NEUTRAL_ACTION);
        saveEncounterButton.setTooltip(new Tooltip("Aktuelles Encounter-Roster speichern"));
        saveEncounterButton.setOnAction(event -> publishPlan(true, 0L));
        openEncounterButton.getStyleClass().addAll(STYLE_COMPACT, STYLE_NEUTRAL_ACTION);
        openEncounterButton.setTooltip(new Tooltip("Gespeichertes Encounter oeffnen"));
        openEncounterButton.setOnAction(event -> showSavedPlansPopup(openEncounterButton));
        clearHistoryButton.getStyleClass().addAll(STYLE_COMPACT, STYLE_NEUTRAL_ACTION);
        clearHistoryButton.setTooltip(new Tooltip("Generator-Historie leeren"));
        clearHistoryButton.setOnAction(event -> publishBuilderAction(true, false));
        Region titleSpacer = new Region();
        HBox.setHgrow(titleSpacer, Priority.ALWAYS);
        HBox titleRow = new HBox(8, title, titleSpacer, clearHistoryButton, openEncounterButton, saveEncounterButton);
        titleRow.setAlignment(Pos.CENTER_LEFT);

        HBox summaryRow = new HBox(8, builderDifficultyLabel, builderTemplateLabel, builderPartyLabel);
        summaryRow.setAlignment(Pos.CENTER_LEFT);
        builderDifficultyLabel.getStyleClass().add(STYLE_TEXT_SECONDARY);
        builderTemplateLabel.getStyleClass().addAll("small", STYLE_TEXT_SECONDARY);
        builderPartyLabel.getStyleClass().add(STYLE_TEXT_SECONDARY);
        builderXpLabel.getStyleClass().add("bold");
        builderStatusLabel.getStyleClass().add(STYLE_TEXT_SECONDARY);
        builderStatusLabel.setWrapText(true);
        builderStatusLabel.setVisible(false);
        builderStatusLabel.setManaged(false);
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
        rosterPlaceholder.getStyleClass().add(STYLE_TEXT_MUTED);
        rosterHost.setAlignment(Pos.TOP_LEFT);
        VBox.setVgrow(rosterHost, Priority.ALWAYS);

        advisoryRegion.setPadding(new Insets(8, 0, 0, 0));
        advisoryRegion.setVisible(false);
        advisoryRegion.setManaged(false);

        Button generateButton = new Button("_Generieren");
        generateButton.getStyleClass().add(STYLE_NEUTRAL_ACTION);
        generateButton.setMaxWidth(Double.MAX_VALUE);
        generateButton.setTooltip(new Tooltip("Encounter aus Catalog-Filtern generieren (Alt+G)"));
        generateButton.setOnAction(event -> publishGenerator(true, 0));
        previousAlternativeButton.getStyleClass().addAll(STYLE_COMPACT, STYLE_NEUTRAL_ACTION);
        previousAlternativeButton.setTooltip(new Tooltip("Vorherige Generator-Alternative"));
        previousAlternativeButton.setOnAction(event -> publishGenerator(false, -1));
        nextAlternativeButton.getStyleClass().addAll(STYLE_COMPACT, STYLE_NEUTRAL_ACTION);
        nextAlternativeButton.setTooltip(new Tooltip("Naechste Generator-Alternative"));
        nextAlternativeButton.setOnAction(event -> publishGenerator(false, 1));
        startCombatButton.getStyleClass().add(STYLE_ACCENT);
        startCombatButton.setMaxWidth(Double.MAX_VALUE);
        startCombatButton.setDisable(true);
        startCombatButton.setOnAction(event -> publishBuilderAction(false, true));
        DialogSurfaceView.grow(generateButton);
        DialogSurfaceView.grow(startCombatButton);

        VBox body = new VBox(0,
                summaryRow,
                difficultyMeter,
                thresholdRow,
                builderXpLabel,
                builderStatusLabel,
                rosterHost,
                advisoryRegion);
        body.setPadding(DialogSurfaceView.contentInsets());
        nextDialog.setHeader(titleRow);
        nextDialog.setBody(body, BodyPolicy.FIXED);
        nextDialog.setFooter(previousAlternativeButton, generateButton, nextAlternativeButton, startCombatButton);
        return nextDialog;
    }

    private void rebuildRoster(EncounterStateContributionModel.BuilderState state) {
        rosterList.getChildren().clear();
        advisoryRegion.getChildren().clear();
        for (EncounterStateContributionModel.RosterCardView card : state.roster()) {
            rosterList.getChildren().add(buildRosterCard(card));
        }
        rosterPlaceholder.setText("Monster per +Add hinzufuegen...");
        rosterPlaceholder.setVisible(state.showRosterPlaceholder());
        rosterPlaceholder.setManaged(state.showRosterPlaceholder());
        rosterScroll.setVisible(!state.showRosterPlaceholder());
        rosterScroll.setManaged(!state.showRosterPlaceholder());
        rebuildAdvisory(state);
    }

    private void rebuildAdvisory(EncounterStateContributionModel.BuilderState state) {
        if (state.pendingUndo() != null) {
            EncounterStateContributionModel.UndoRemoveView undo = state.pendingUndo();
            Label removed = new Label(undo.creatureName() + " entfernt.");
            removed.getStyleClass().add(STYLE_TEXT_SECONDARY);
            Button undoButton = new Button("Rueckgaengig");
            undoButton.getStyleClass().addAll(STYLE_COMPACT, STYLE_NEUTRAL_ACTION);
            undoButton.setOnAction(event -> publishUndo(undo.token()));
            HBox row = new HBox(8, removed, undoButton);
            row.setAlignment(Pos.CENTER_LEFT);
            advisoryRegion.getChildren().add(row);
        }
        if (!state.generationAdvisoryMessages().isEmpty()) {
            Label title = new Label("Hinweise");
            title.getStyleClass().addAll("small", STYLE_TEXT_SECONDARY);
            advisoryRegion.getChildren().add(title);
            for (String advisory : state.generationAdvisoryMessages()) {
                Label row = new Label(advisory);
                row.setWrapText(true);
                row.getStyleClass().add(STYLE_TEXT_SECONDARY);
                advisoryRegion.getChildren().add(row);
            }
        }
        if (advisoryRegion.getChildren().isEmpty()) {
            advisoryRegion.setVisible(false);
            advisoryRegion.setManaged(false);
        } else {
            advisoryRegion.setVisible(true);
            advisoryRegion.setManaged(true);
        }
    }

    private Node buildRosterCard(EncounterStateContributionModel.RosterCardView card) {
        VBox root = new VBox(0);
        root.getStyleClass().add("entity-card");

        Button minus = new Button("-");
        minus.getStyleClass().add(STYLE_COMPACT);
        minus.setDisable(card.count() <= 1);
        minus.setOnAction(event -> publishRoster(card.creatureId(), -1, false));
        Label count = new Label(String.valueOf(card.count()));
        count.getStyleClass().add("bold");
        count.setMinWidth(24);
        count.setAlignment(Pos.CENTER);
        Button plus = new Button("+");
        plus.getStyleClass().add(STYLE_COMPACT);
        plus.setOnAction(event -> publishRoster(card.creatureId(), 1, false));
        HBox quantity = new HBox(2, minus, count, plus);
        quantity.setAlignment(Pos.CENTER);

        Button name = new Button(card.name());
        name.getStyleClass().add("creature-link");
        name.setTooltip(new Tooltip("Creature details oeffnen"));
        name.setOnAction(event -> publishDetail(card.creatureId()));

        HBox detail = new HBox(4);
        detail.setAlignment(Pos.CENTER_LEFT);
        Label text = new Label("CR " + card.challengeRating() + "  |  " + card.xp() + " XP  |  " + card.type());
        text.getStyleClass().add(STYLE_TEXT_SECONDARY);
        Label role = new Label(card.role());
        role.getStyleClass().addAll("small", "role-badge", roleStyle(card.role()));
        detail.getChildren().addAll(text, role);

        VBox info = new VBox(2, name, detail);
        HBox.setHgrow(info, Priority.ALWAYS);

        Label expand = new Label("\u25BC");
        expand.getStyleClass().addAll(STYLE_TEXT_MUTED, "clickable");
        Button remove = new Button("\u00d7");
        remove.getStyleClass().addAll(STYLE_COMPACT, "remove-btn");
        remove.setOnAction(event -> publishRoster(card.creatureId(), 0, true));
        VBox right = new VBox(4, expand, remove);
        right.setAlignment(Pos.CENTER_RIGHT);

        HBox summary = new HBox(8, quantity, info, right);
        summary.setAlignment(Pos.CENTER_LEFT);
        root.getChildren().add(summary);
        return root;
    }

    private void showSavedPlansPopup(Node anchor) {
        AnchoredPopupView popup = new AnchoredPopupView();
        VBox content = new VBox(4);
        content.getStyleClass().add("anchored-popup");
        List<EncounterStateContributionModel.SavedEncounterPlanView> savedPlans = lastState.savedPlans();
        if (savedPlans.isEmpty()) {
            Label empty = new Label("Keine gespeicherten Encounter.");
            empty.getStyleClass().add(STYLE_TEXT_SECONDARY);
            content.getChildren().add(empty);
        } else {
            for (EncounterStateContributionModel.SavedEncounterPlanView plan : savedPlans) {
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

    private static String savedPlanLabel(EncounterStateContributionModel.SavedEncounterPlanView plan) {
        String suffix = plan.generatedLabel().isBlank() ? "" : " - " + plan.generatedLabel();
        return plan.name() + suffix + " (" + plan.creatureCount() + ")";
    }

    private void publish(
            EncounterBuilderStateViewInputEvent.Interaction interaction
    ) {
        viewInputEventHandler.accept(new EncounterBuilderStateViewInputEvent(interaction));
    }

    private void publishSelectedPlan(long selectedPlanId) {
        publishPlan(false, selectedPlanId);
    }

    private void publishUndo(long undoToken) {
        publish(new EncounterBuilderStateViewInputEvent.UndoInteraction(undoToken));
    }

    private void publishGenerator(boolean generateRequested, int alternativeShift) {
        publish(new EncounterBuilderStateViewInputEvent.GeneratorInteraction(generateRequested, alternativeShift));
    }

    private void publishPlan(boolean saveCurrentPlanRequested, long selectedPlanId) {
        publish(new EncounterBuilderStateViewInputEvent.PlanInteraction(saveCurrentPlanRequested, selectedPlanId));
    }

    private void publishRoster(long creatureId, int delta, boolean removalRequested) {
        publish(new EncounterBuilderStateViewInputEvent.RosterInteraction(creatureId, delta, removalRequested));
    }

    private void publishDetail(long creatureId) {
        publish(new EncounterBuilderStateViewInputEvent.DetailInteraction(creatureId));
    }

    private void publishBuilderAction(boolean clearHistoryRequested, boolean startInitiativeRequested) {
        publish(new EncounterBuilderStateViewInputEvent.BuilderActionInteraction(
                clearHistoryRequested,
                startInitiativeRequested));
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

        private void update(EncounterStateContributionModel.DifficultySummary value) {
            EncounterStateContributionModel.DifficultySummary summary = value == null
                    ? new EncounterStateContributionModel.DifficultySummary(0, 0, 0, 0, 0, "")
                    : value;
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
}
