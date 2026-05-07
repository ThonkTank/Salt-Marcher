package src.view.statetabs.encounter;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
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
    private static final String ROSTER_PLACEHOLDER_TEXT = "Monster per +Add hinzufuegen...";
    private static final List<String> DIFFICULTY_STYLE_CLASSES = List.of(
            "difficulty-easy",
            "difficulty-medium",
            "difficulty-hard",
            "difficulty-deadly");
    private static final Map<String, String> DIFFICULTY_STYLES = Map.of(
            "deadly", "difficulty-deadly",
            "hard", "difficulty-hard",
            "medium", "difficulty-medium");
    private static final Map<String, String> ROLE_STYLES = Map.of(
            "boss", "role-boss",
            "archer", "role-archer",
            "controller", "role-controller",
            "skirmisher", "role-skirmisher",
            "support", "role-support",
            "soldier", "role-soldier");

    private final Button previousAlternativeButton = new StyledButton("<", STYLE_COMPACT, STYLE_NEUTRAL_ACTION);
    private final Button nextAlternativeButton = new StyledButton(">", STYLE_COMPACT, STYLE_NEUTRAL_ACTION);
    private final Button saveEncounterButton = new StyledButton("Speichern", STYLE_COMPACT, STYLE_NEUTRAL_ACTION);
    private final Button openEncounterButton = new StyledButton("Oeffnen", STYLE_COMPACT, STYLE_NEUTRAL_ACTION);
    private final Button clearHistoryButton = new StyledButton("Clear", STYLE_COMPACT, STYLE_NEUTRAL_ACTION);
    private final Button startCombatButton = new StyledButton("_Kampf starten", STYLE_ACCENT);
    private final BuilderBody body;
    private final DialogSurfaceView dialog;

    private Consumer<EncounterStateViewInputEvent> viewInputEventHandler = ignored -> { };
    private List<EncounterStateContributionModel.SavedEncounterPlanView> savedPlans = List.of();

    public EncounterBuilderStateView() {
        body = new BuilderBody(this::publish);
        dialog = buildPane();
        getChildren().add(dialog);
        setVgrow(dialog, Priority.ALWAYS);
    }

    public void onViewInputEvent(Consumer<EncounterStateViewInputEvent> handler) {
        viewInputEventHandler = handler == null ? ignored -> { } : handler;
    }

    public void showBuilder(EncounterStateContributionModel.BuilderState state) {
        EncounterStateContributionModel.BuilderState safeState = state == null
                ? EncounterStateContributionModel.BuilderState.empty(EncounterStateContributionModel.BuilderSettings.defaultSettings())
                : state;
        body.showState(safeState);
        updateActionButtons(safeState);
        savedPlans = safeState.savedPlans();
    }

    private DialogSurfaceView buildPane() {
        DialogSurfaceView nextDialog = new DialogSurfaceView();
        nextDialog.setHeader(buildTitleRow());
        nextDialog.setBody(body, BodyPolicy.FIXED);
        nextDialog.setFooter(buildFooter());
        return nextDialog;
    }

    private Node buildTitleRow() {
        saveEncounterButton.setTooltip(new Tooltip("Aktuelles Encounter-Roster speichern"));
        saveEncounterButton.setOnAction(event ->
                publish(new EncounterStateViewInputEvent.BuilderInput(
                        new EncounterStateViewInputEvent.PlanAction(true, 0L))));
        openEncounterButton.setTooltip(new Tooltip("Gespeichertes Encounter oeffnen"));
        openEncounterButton.setOnAction(event -> showSavedPlansPopup(openEncounterButton));
        clearHistoryButton.setTooltip(new Tooltip("Generator-Historie leeren"));
        clearHistoryButton.setOnAction(event ->
                publish(new EncounterStateViewInputEvent.BuilderInput(
                        new EncounterStateViewInputEvent.BuilderModeAction(true, false))));

        Region titleSpacer = new Region();
        HBox.setHgrow(titleSpacer, Priority.ALWAYS);
        HBox titleRow = new HBox(
                8,
                new StyledLabel("Encounter", "title"),
                titleSpacer,
                clearHistoryButton,
                openEncounterButton,
                saveEncounterButton);
        titleRow.setAlignment(Pos.CENTER_LEFT);
        return titleRow;
    }

    private Node[] buildFooter() {
        Button generateButton = new StyledButton("_Generieren", STYLE_NEUTRAL_ACTION);
        generateButton.setMaxWidth(Double.MAX_VALUE);
        generateButton.setTooltip(new Tooltip("Encounter aus Catalog-Filtern generieren (Alt+G)"));
        generateButton.setOnAction(event ->
                publish(new EncounterStateViewInputEvent.BuilderInput(
                        new EncounterStateViewInputEvent.GeneratorAction(true, 0))));

        previousAlternativeButton.setTooltip(new Tooltip("Vorherige Generator-Alternative"));
        previousAlternativeButton.setOnAction(event ->
                publish(new EncounterStateViewInputEvent.BuilderInput(
                        new EncounterStateViewInputEvent.GeneratorAction(false, -1))));
        nextAlternativeButton.setTooltip(new Tooltip("Naechste Generator-Alternative"));
        nextAlternativeButton.setOnAction(event ->
                publish(new EncounterStateViewInputEvent.BuilderInput(
                        new EncounterStateViewInputEvent.GeneratorAction(false, 1))));
        startCombatButton.setMaxWidth(Double.MAX_VALUE);
        startCombatButton.setDisable(true);
        startCombatButton.setOnAction(event ->
                publish(new EncounterStateViewInputEvent.BuilderInput(
                        new EncounterStateViewInputEvent.BuilderModeAction(false, true))));

        DialogSurfaceView.grow(generateButton);
        DialogSurfaceView.grow(startCombatButton);
        return new Node[] { previousAlternativeButton, generateButton, nextAlternativeButton, startCombatButton };
    }

    private void updateActionButtons(EncounterStateContributionModel.BuilderState state) {
        previousAlternativeButton.setDisable(!state.canPreviousAlternative());
        nextAlternativeButton.setDisable(!state.canNextAlternative());
        saveEncounterButton.setDisable(!state.canSavePlan());
        openEncounterButton.setDisable(state.savedPlans().isEmpty());
        clearHistoryButton.setDisable(!state.canClearGenerationHistory());
        startCombatButton.setDisable(!state.canStartCombat());
    }

    private void showSavedPlansPopup(Node anchor) {
        AnchoredPopupView popup = new AnchoredPopupView();
        SavedPlansPopupContent content = new SavedPlansPopupContent();
        if (savedPlans.isEmpty()) {
            content.showEmpty();
        } else {
            for (EncounterStateContributionModel.SavedEncounterPlanView plan : savedPlans) {
                content.addOption(new SavedPlanOptionButton(plan, () -> {
                    popup.hide();
                    publish(new EncounterStateViewInputEvent.BuilderInput(
                            new EncounterStateViewInputEvent.PlanAction(false, plan.id())));
                }));
            }
        }
        popup.setContent(content);
        popup.showBelow(anchor, 8);
    }

    private void publish(EncounterStateViewInputEvent.Input input) {
        viewInputEventHandler.accept(new EncounterStateViewInputEvent(input));
    }

    private static final class BuilderBody extends VBox {

        private final DifficultyBadgeLabel builderDifficultyLabel = new DifficultyBadgeLabel();
        private final StyledLabel builderTemplateLabel = new StyledLabel("", "small", STYLE_TEXT_SECONDARY);
        private final StyledLabel builderPartyLabel = new StyledLabel("", STYLE_TEXT_SECONDARY);
        private final StyledLabel builderXpLabel = new StyledLabel("", "bold");
        private final StyledLabel easyThresholdLabel = new StyledLabel("", "difficulty-easy");
        private final StyledLabel mediumThresholdLabel = new StyledLabel("", "difficulty-medium");
        private final StyledLabel hardThresholdLabel = new StyledLabel("", "difficulty-hard");
        private final StyledLabel deadlyThresholdLabel = new StyledLabel("", "difficulty-deadly");
        private final StyledLabel builderStatusLabel = new StyledLabel("", STYLE_TEXT_SECONDARY);
        private final StyledLabel rosterPlaceholder = new StyledLabel(ROSTER_PLACEHOLDER_TEXT, STYLE_TEXT_MUTED);
        private final DifficultyMeterView difficultyMeter = new DifficultyMeterView();
        private final RosterListView rosterList;
        private final ScrollPane rosterScroll;
        private final AdvisoryRegionView advisoryRegion;

        private BuilderBody(Consumer<EncounterStateViewInputEvent.Input> publish) {
            rosterList = new RosterListView(publish);
            advisoryRegion = new AdvisoryRegionView(publish);
            rosterScroll = new ScrollPane(rosterList);

            builderStatusLabel.setWrapText(true);
            setShown(builderStatusLabel, false);

            rosterList.setPadding(new Insets(2, 0, 2, 0));
            rosterScroll.setFitToWidth(true);
            rosterScroll.setHbarPolicy(ScrollPane.ScrollBarPolicy.NEVER);
            setShown(rosterScroll, false);

            StackPane rosterHost = new StackPane(rosterPlaceholder, rosterScroll);
            rosterHost.setAlignment(Pos.TOP_LEFT);
            setVgrow(rosterHost, Priority.ALWAYS);

            advisoryRegion.setPadding(new Insets(8, 0, 0, 0));
            setShown(advisoryRegion, false);

            setPadding(DialogSurfaceView.contentInsets());
            getChildren().addAll(
                    buildSummaryRow(),
                    difficultyMeter,
                    buildThresholdRow(),
                    builderXpLabel,
                    builderStatusLabel,
                    rosterHost,
                    advisoryRegion);
        }

        private void showState(EncounterStateContributionModel.BuilderState state) {
            EncounterStateContributionModel.DifficultySummary difficulty = state.difficulty();
            builderDifficultyLabel.showDifficulty(difficulty.difficulty());
            builderTemplateLabel.setText(state.templateLabel());
            builderPartyLabel.setText(state.partyLabel());
            builderXpLabel.setText("Adj. XP: " + difficulty.adjustedXp());
            easyThresholdLabel.setText("Easy " + difficulty.easy());
            mediumThresholdLabel.setText("Med. " + difficulty.medium());
            hardThresholdLabel.setText("Hard " + difficulty.hard());
            deadlyThresholdLabel.setText("Deadly " + difficulty.deadly());
            builderStatusLabel.setText(state.statusMessage());
            setShown(builderStatusLabel, !state.statusMessage().isBlank());
            difficultyMeter.update(difficulty);
            rosterList.showRoster(state.roster());
            setShown(rosterPlaceholder, state.showRosterPlaceholder());
            setShown(rosterScroll, !state.showRosterPlaceholder());
            advisoryRegion.showState(state);
        }

        private Node buildSummaryRow() {
            HBox summaryRow = new HBox(8, builderDifficultyLabel, builderTemplateLabel, builderPartyLabel);
            summaryRow.setAlignment(Pos.CENTER_LEFT);
            return summaryRow;
        }

        private Node buildThresholdRow() {
            return new HBox(6, easyThresholdLabel, mediumThresholdLabel, hardThresholdLabel, deadlyThresholdLabel);
        }
    }

    private static final class RosterListView extends VBox {

        private final Consumer<EncounterStateViewInputEvent.Input> publish;

        private RosterListView(Consumer<EncounterStateViewInputEvent.Input> publish) {
            super(6);
            this.publish = publish;
        }

        private void showRoster(List<EncounterStateContributionModel.RosterCardView> roster) {
            getChildren().setAll(roster.stream()
                    .map(this::buildRosterCard)
                    .toList());
        }

        private Node buildRosterCard(EncounterStateContributionModel.RosterCardView card) {
            Button minus = new StyledButton("-", STYLE_COMPACT);
            minus.setDisable(card.count() <= 1);
            minus.setOnAction(event ->
                    publish.accept(new EncounterStateViewInputEvent.BuilderInput(
                            new EncounterStateViewInputEvent.RosterAction(card.creatureId(), -1, false))));

            StyledLabel count = new StyledLabel(String.valueOf(card.count()), "bold");
            count.setMinWidth(24);
            count.setAlignment(Pos.CENTER);

            Button plus = new StyledButton("+", STYLE_COMPACT);
            plus.setOnAction(event ->
                    publish.accept(new EncounterStateViewInputEvent.BuilderInput(
                            new EncounterStateViewInputEvent.RosterAction(card.creatureId(), 1, false))));

            HBox quantity = new HBox(2, minus, count, plus);
            quantity.setAlignment(Pos.CENTER);

            Button name = new StyledButton(card.name(), "creature-link");
            name.setTooltip(new Tooltip("Creature details oeffnen"));
            name.setOnAction(event ->
                    publish.accept(new EncounterStateViewInputEvent.DetailSelectionInput(card.creatureId())));

            HBox detail = new HBox(
                    4,
                    new StyledLabel(
                            "CR " + card.challengeRating() + "  |  " + card.xp() + " XP  |  " + card.type(),
                            STYLE_TEXT_SECONDARY),
                    new RoleBadgeLabel(card.role()));
            detail.setAlignment(Pos.CENTER_LEFT);

            VBox info = new VBox(2, name, detail);
            HBox.setHgrow(info, Priority.ALWAYS);

            Button remove = new StyledButton("\u00d7", STYLE_COMPACT, "remove-btn");
            remove.setOnAction(event ->
                    publish.accept(new EncounterStateViewInputEvent.BuilderInput(
                            new EncounterStateViewInputEvent.RosterAction(card.creatureId(), 0, true))));

            VBox right = new VBox(4, new StyledLabel("\u25BC", STYLE_TEXT_MUTED, "clickable"), remove);
            right.setAlignment(Pos.CENTER_RIGHT);

            HBox summary = new HBox(8, quantity, info, right);
            summary.setAlignment(Pos.CENTER_LEFT);
            return new EntityCard(summary);
        }
    }

    private static final class AdvisoryRegionView extends VBox {

        private final Consumer<EncounterStateViewInputEvent.Input> publish;

        private AdvisoryRegionView(Consumer<EncounterStateViewInputEvent.Input> publish) {
            super(4);
            this.publish = publish;
        }

        private void showState(EncounterStateContributionModel.BuilderState state) {
            List<Node> nodes = new ArrayList<>();
            if (state.pendingUndo() != null) {
                EncounterStateContributionModel.UndoRemoveView undo = state.pendingUndo();
                Button undoButton = new StyledButton("Rueckgaengig", STYLE_COMPACT, STYLE_NEUTRAL_ACTION);
                undoButton.setOnAction(event ->
                        publish.accept(new EncounterStateViewInputEvent.BuilderInput(
                                new EncounterStateViewInputEvent.UndoAction(new EncounterStateUndoRef(undo.token())))));

                HBox row = new HBox(
                        8,
                        new StyledLabel(undo.creatureName() + " entfernt.", STYLE_TEXT_SECONDARY),
                        undoButton);
                row.setAlignment(Pos.CENTER_LEFT);
                nodes.add(row);
            }
            if (!state.generationAdvisoryMessages().isEmpty()) {
                nodes.add(new StyledLabel("Hinweise", "small", STYLE_TEXT_SECONDARY));
                for (String advisory : state.generationAdvisoryMessages()) {
                    StyledLabel row = new StyledLabel(advisory, STYLE_TEXT_SECONDARY);
                    row.setWrapText(true);
                    nodes.add(row);
                }
            }
            getChildren().setAll(nodes);
            setShown(this, !nodes.isEmpty());
        }
    }

    private static final class SavedPlansPopupContent extends VBox {

        private SavedPlansPopupContent() {
            super(4);
            getStyleClass().add("anchored-popup");
        }

        private void showEmpty() {
            getChildren().setAll(new StyledLabel("Keine gespeicherten Encounter.", STYLE_TEXT_SECONDARY));
        }

        private void addOption(Node option) {
            getChildren().add(option);
        }
    }

    private static final class SavedPlanOptionButton extends StyledButton {

        private SavedPlanOptionButton(
                EncounterStateContributionModel.SavedEncounterPlanView plan,
                Runnable onSelect
        ) {
            super(labelFor(plan), "creature-link");
            setMaxWidth(Double.MAX_VALUE);
            setOnAction(event -> onSelect.run());
        }

        private static String labelFor(EncounterStateContributionModel.SavedEncounterPlanView plan) {
            String suffix = plan.generatedLabel().isBlank() ? "" : " - " + plan.generatedLabel();
            return plan.name() + suffix + " (" + plan.creatureCount() + ")";
        }
    }

    private static final class DifficultyBadgeLabel extends StyledLabel {

        private DifficultyBadgeLabel() {
            super("", STYLE_TEXT_SECONDARY);
        }

        private void showDifficulty(String difficulty) {
            setText(difficulty);
            replaceStyles(DIFFICULTY_STYLE_CLASSES, StyleMappings.lookup(DIFFICULTY_STYLES, difficulty, "difficulty-easy"));
        }
    }

    private static final class RoleBadgeLabel extends StyledLabel {

        private RoleBadgeLabel(String role) {
            super(role, "small", "role-badge", StyleMappings.lookup(ROLE_STYLES, role, "role-minion"));
        }
    }

    private static class StyledLabel extends Label {

        private StyledLabel(String text, String... styleClasses) {
            super(text);
            getStyleClass().addAll(styleClasses);
        }

        protected final void replaceStyles(List<String> obsoleteStyles, String nextStyle) {
            getStyleClass().removeAll(obsoleteStyles);
            getStyleClass().add(nextStyle);
        }
    }

    private static class StyledButton extends Button {

        private StyledButton(String text, String... styleClasses) {
            super(text);
            getStyleClass().addAll(styleClasses);
        }
    }

    private static final class EntityCard extends VBox {

        private EntityCard(Node content) {
            super(0, content);
            getStyleClass().add("entity-card");
        }
    }

    private static final class StyleMappings {
        private static String lookup(Map<String, String> values, String rawValue, String fallback) {
            if (rawValue == null) {
                return fallback;
            }
            return values.getOrDefault(rawValue.toLowerCase(Locale.ROOT), fallback);
        }
    }

    private static final class DifficultyMeterView extends StackPane {

        private final MeterBar meterBar = new MeterBar();
        private final MarkerRegion marker = new MarkerRegion();
        private double markerFraction;

        private DifficultyMeterView() {
            setMinHeight(28);
            setPrefHeight(28);
            setMaxHeight(28);
            getChildren().addAll(meterBar, marker);
            setAlignment(meterBar, Pos.CENTER);
            setAlignment(marker, Pos.CENTER_LEFT);
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

        private void positionMarker() {
            double markerWidth = marker.prefWidth(-1);
            double width = getWidth();
            if (width <= 0) {
                return;
            }
            marker.setTranslateX((width * markerFraction) - (width / 2) - (markerWidth / 2));
        }
    }

    private static final class MeterBar extends HBox {

        private MeterBar() {
            super(
                    0,
                    new MeterSegment("difficulty-meter-easy"),
                    new MeterSegment("difficulty-meter-medium"),
                    new MeterSegment("difficulty-meter-hard"),
                    new MeterSegment("difficulty-meter-deadly"));
            getStyleClass().add("difficulty-meter-bar");
            setMaxHeight(12);
        }
    }

    private static final class MeterSegment extends Region {

        private MeterSegment(String styleClass) {
            getStyleClass().add(styleClass);
            HBox.setHgrow(this, Priority.ALWAYS);
        }
    }

    private static final class MarkerRegion extends Region {

        private MarkerRegion() {
            getStyleClass().add("difficulty-meter-marker");
            setMinSize(2, 22);
            setPrefSize(2, 22);
            setMaxSize(2, 22);
            setMouseTransparent(true);
        }
    }

    private static void setShown(Node node, boolean shown) {
        node.setVisible(shown);
        node.setManaged(shown);
    }
}
