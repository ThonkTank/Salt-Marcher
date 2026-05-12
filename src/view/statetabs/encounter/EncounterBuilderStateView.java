package src.view.statetabs.encounter;

import static src.view.statetabs.encounter.EncounterBuilderStateView.DIFFICULTY_STYLE_CLASSES;
import static src.view.statetabs.encounter.EncounterBuilderStateView.DIFFICULTY_STYLES;
import static src.view.statetabs.encounter.EncounterBuilderStateView.ROLE_STYLES;
import static src.view.statetabs.encounter.EncounterBuilderStateView.ROSTER_PLACEHOLDER_TEXT;
import static src.view.statetabs.encounter.EncounterBuilderStateView.STYLE_ACCENT;
import static src.view.statetabs.encounter.EncounterBuilderStateView.STYLE_COMPACT;
import static src.view.statetabs.encounter.EncounterBuilderStateView.STYLE_NEUTRAL_ACTION;
import static src.view.statetabs.encounter.EncounterBuilderStateView.STYLE_TEXT_MUTED;
import static src.view.statetabs.encounter.EncounterBuilderStateView.STYLE_TEXT_SECONDARY;

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
import src.view.slotcontent.primitives.dialog.DialogSurfaceContentModel;
import src.view.slotcontent.primitives.dialog.DialogSurfaceView;
import src.view.slotcontent.primitives.popup.AnchoredPopupContentModel;
import src.view.slotcontent.primitives.popup.AnchoredPopupView;

public final class EncounterBuilderStateView extends VBox {

    static final String STYLE_COMPACT = "compact";
    static final String STYLE_NEUTRAL_ACTION = "neutral-action";
    static final String STYLE_TEXT_SECONDARY = "text-secondary";
    static final String STYLE_TEXT_MUTED = "text-muted";
    static final String STYLE_ACCENT = "accent";
    static final String ROSTER_PLACEHOLDER_TEXT = "Monster per +Add hinzufuegen...";
    static final List<String> DIFFICULTY_STYLE_CLASSES = List.of(
            "difficulty-easy",
            "difficulty-medium",
            "difficulty-hard",
            "difficulty-deadly");
    static final Map<String, String> DIFFICULTY_STYLES = Map.of(
            "deadly", "difficulty-deadly",
            "hard", "difficulty-hard",
            "medium", "difficulty-medium");
    static final Map<String, String> ROLE_STYLES = Map.of(
            "boss", "role-boss",
            "archer", "role-archer",
            "controller", "role-controller",
            "skirmisher", "role-skirmisher",
            "support", "role-support",
            "soldier", "role-soldier");

    private final Button previousAlternativeButton = new BuilderStyledButton("<", STYLE_COMPACT, STYLE_NEUTRAL_ACTION);
    private final Button nextAlternativeButton = new BuilderStyledButton(">", STYLE_COMPACT, STYLE_NEUTRAL_ACTION);
    private final Button saveEncounterButton = new BuilderStyledButton("Speichern", STYLE_COMPACT, STYLE_NEUTRAL_ACTION);
    private final Button openEncounterButton = new BuilderStyledButton("Oeffnen", STYLE_COMPACT, STYLE_NEUTRAL_ACTION);
    private final Button clearHistoryButton = new BuilderStyledButton("Clear", STYLE_COMPACT, STYLE_NEUTRAL_ACTION);
    private final Button startCombatButton = new BuilderStyledButton("_Kampf starten", STYLE_ACCENT);
    private final EncounterBuilderBody body;
    private final EncounterSavedPlansPopup savedPlansPopup;
    private final DialogSurfaceContentModel dialogContentModel = new DialogSurfaceContentModel();
    private final DialogSurfaceView dialog;

    private Consumer<EncounterBuilderStateViewInputEvent> viewInputEventHandler = ignored -> { };
    public EncounterBuilderStateView() {
        body = new EncounterBuilderBody(this::publish);
        savedPlansPopup = new EncounterSavedPlansPopup(this::publish);
        dialog = buildPane();
        getChildren().add(dialog);
        setVgrow(dialog, Priority.ALWAYS);
    }

    public void onViewInputEvent(Consumer<EncounterBuilderStateViewInputEvent> handler) {
        viewInputEventHandler = handler == null ? ignored -> { } : handler;
    }

    public void showBuilder(EncounterBuilderState state) {
        EncounterBuilderState safeState = state == null
                ? EncounterBuilderState.empty(EncounterBuilderSettings.defaultSettings())
                : state;
        body.showState(safeState);
        updateActionButtons(safeState);
        savedPlansPopup.showPlans(safeState.savedPlans());
    }

    private DialogSurfaceView buildPane() {
        HBox footer = new HBox(8, buildFooter());
        footer.setAlignment(Pos.CENTER_LEFT);
        DialogSurfaceView nextDialog = new DialogSurfaceView(buildTitleRow(), body, footer);
        nextDialog.bind(dialogContentModel);
        dialogContentModel.showLayout(DialogSurfaceContentModel.BodyPolicy.FIXED, true, true);
        return nextDialog;
    }

    private Node buildTitleRow() {
        saveEncounterButton.setTooltip(new Tooltip("Aktuelles Encounter-Roster speichern"));
        saveEncounterButton.setOnAction(event ->
                publish(new EncounterBuilderStateViewInputEvent.SaveCurrentPlanInput()));
        openEncounterButton.setTooltip(new Tooltip("Gespeichertes Encounter oeffnen"));
        openEncounterButton.setOnAction(event -> savedPlansPopup.show(openEncounterButton));
        clearHistoryButton.setTooltip(new Tooltip("Generator-Historie leeren"));
        clearHistoryButton.setOnAction(event ->
                publish(new EncounterBuilderStateViewInputEvent.ClearGenerationHistoryInput()));

        Region titleSpacer = new Region();
        HBox.setHgrow(titleSpacer, Priority.ALWAYS);
        HBox titleRow = new HBox(
                8,
                new BuilderStyledLabel("Encounter", "title"),
                titleSpacer,
                clearHistoryButton,
                openEncounterButton,
                saveEncounterButton);
        titleRow.setAlignment(Pos.CENTER_LEFT);
        return titleRow;
    }

    private Node[] buildFooter() {
        Button generateButton = new BuilderStyledButton("_Generieren", STYLE_NEUTRAL_ACTION);
        generateButton.setMaxWidth(Double.MAX_VALUE);
        generateButton.setTooltip(new Tooltip("Encounter aus Catalog-Filtern generieren (Alt+G)"));
        generateButton.setOnAction(event ->
                publish(new EncounterBuilderStateViewInputEvent.GenerateInput()));

        previousAlternativeButton.setTooltip(new Tooltip("Vorherige Generator-Alternative"));
        previousAlternativeButton.setOnAction(event ->
                publish(new EncounterBuilderStateViewInputEvent.ShiftAlternativeInput(-1)));
        nextAlternativeButton.setTooltip(new Tooltip("Naechste Generator-Alternative"));
        nextAlternativeButton.setOnAction(event ->
                publish(new EncounterBuilderStateViewInputEvent.ShiftAlternativeInput(1)));
        startCombatButton.setMaxWidth(Double.MAX_VALUE);
        startCombatButton.setDisable(true);
        startCombatButton.setOnAction(event ->
                publish(new EncounterBuilderStateViewInputEvent.OpenInitiativeInput()));

        DialogSurfaceView.grow(generateButton);
        DialogSurfaceView.grow(startCombatButton);
        return new Node[] { previousAlternativeButton, generateButton, nextAlternativeButton, startCombatButton };
    }

    private void updateActionButtons(EncounterBuilderState state) {
        previousAlternativeButton.setDisable(!state.canPreviousAlternative());
        nextAlternativeButton.setDisable(!state.canNextAlternative());
        saveEncounterButton.setDisable(!state.canSavePlan());
        openEncounterButton.setDisable(state.savedPlans().isEmpty());
        clearHistoryButton.setDisable(!state.canClearGenerationHistory());
        startCombatButton.setDisable(!state.canStartCombat());
    }

    private void publish(EncounterBuilderStateViewInputEvent.Interaction input) {
        viewInputEventHandler.accept(new EncounterBuilderStateViewInputEvent(input));
    }

    static void setShown(Node node, boolean shown) {
        node.setVisible(shown);
        node.setManaged(shown);
    }
}

final class EncounterBuilderBody extends VBox {

        private final EncounterDifficultyBadgeLabel builderDifficultyLabel = new EncounterDifficultyBadgeLabel();
        private final BuilderStyledLabel builderTemplateLabel = new BuilderStyledLabel("", "small", STYLE_TEXT_SECONDARY);
        private final BuilderStyledLabel builderPartyLabel = new BuilderStyledLabel("", STYLE_TEXT_SECONDARY);
        private final BuilderStyledLabel builderXpLabel = new BuilderStyledLabel("", "bold");
        private final BuilderStyledLabel easyThresholdLabel = new BuilderStyledLabel("", "difficulty-easy");
        private final BuilderStyledLabel mediumThresholdLabel = new BuilderStyledLabel("", "difficulty-medium");
        private final BuilderStyledLabel hardThresholdLabel = new BuilderStyledLabel("", "difficulty-hard");
        private final BuilderStyledLabel deadlyThresholdLabel = new BuilderStyledLabel("", "difficulty-deadly");
        private final BuilderStyledLabel builderStatusLabel = new BuilderStyledLabel("", STYLE_TEXT_SECONDARY);
        private final BuilderStyledLabel rosterPlaceholder = new BuilderStyledLabel(ROSTER_PLACEHOLDER_TEXT, STYLE_TEXT_MUTED);
        private final EncounterDifficultyMeterView difficultyMeter = new EncounterDifficultyMeterView();
        private final EncounterRosterListView rosterList;
        private final ScrollPane rosterScroll;
        private final EncounterAdvisoryRegionView advisoryRegion;

        EncounterBuilderBody(Consumer<EncounterBuilderStateViewInputEvent.Interaction> publish) {
            rosterList = new EncounterRosterListView(publish);
            advisoryRegion = new EncounterAdvisoryRegionView(publish);
            rosterScroll = new ScrollPane(rosterList);

            builderStatusLabel.setWrapText(true);
            EncounterBuilderStateView.setShown(builderStatusLabel, false);

            rosterList.setPadding(new Insets(2, 0, 2, 0));
            rosterScroll.setFitToWidth(true);
            rosterScroll.setHbarPolicy(ScrollPane.ScrollBarPolicy.NEVER);
            EncounterBuilderStateView.setShown(rosterScroll, false);

            StackPane rosterHost = new StackPane(rosterPlaceholder, rosterScroll);
            rosterHost.setAlignment(Pos.TOP_LEFT);
            setVgrow(rosterHost, Priority.ALWAYS);

            advisoryRegion.setPadding(new Insets(8, 0, 0, 0));
            EncounterBuilderStateView.setShown(advisoryRegion, false);

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

        void showState(EncounterBuilderState state) {
            EncounterDifficultySummary difficulty = state.difficulty();
            builderDifficultyLabel.showDifficulty(difficulty.difficulty());
            builderTemplateLabel.setText(state.templateLabel());
            builderPartyLabel.setText(state.partyLabel());
            builderXpLabel.setText("Adj. XP: " + difficulty.adjustedXp());
            easyThresholdLabel.setText("Easy " + difficulty.easy());
            mediumThresholdLabel.setText("Med. " + difficulty.medium());
            hardThresholdLabel.setText("Hard " + difficulty.hard());
            deadlyThresholdLabel.setText("Deadly " + difficulty.deadly());
            builderStatusLabel.setText(state.statusMessage());
            EncounterBuilderStateView.setShown(builderStatusLabel, !state.statusMessage().isBlank());
            difficultyMeter.update(difficulty);
            rosterList.showRoster(state.roster());
            EncounterBuilderStateView.setShown(rosterPlaceholder, state.showRosterPlaceholder());
            EncounterBuilderStateView.setShown(rosterScroll, !state.showRosterPlaceholder());
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

final class EncounterRosterListView extends VBox {

        private final Consumer<EncounterBuilderStateViewInputEvent.Interaction> publish;

        EncounterRosterListView(Consumer<EncounterBuilderStateViewInputEvent.Interaction> publish) {
            super(6);
            this.publish = publish;
        }

        void showRoster(List<EncounterRosterCardView> roster) {
            getChildren().setAll(roster.stream()
                    .map(this::buildRosterCard)
                    .toList());
        }

        private Node buildRosterCard(EncounterRosterCardView card) {
            Button minus = new BuilderStyledButton("-", STYLE_COMPACT);
            minus.setDisable(card.count() <= 1);
            minus.setOnAction(event ->
                    publish.accept(new EncounterBuilderStateViewInputEvent.ChangeRosterCountInput(card.creatureId(), -1)));

            BuilderStyledLabel count = new BuilderStyledLabel(String.valueOf(card.count()), "bold");
            count.setMinWidth(24);
            count.setAlignment(Pos.CENTER);

            Button plus = new BuilderStyledButton("+", STYLE_COMPACT);
            plus.setOnAction(event ->
                    publish.accept(new EncounterBuilderStateViewInputEvent.ChangeRosterCountInput(card.creatureId(), 1)));

            HBox quantity = new HBox(2, minus, count, plus);
            quantity.setAlignment(Pos.CENTER);

            Button name = new BuilderStyledButton(card.name(), "creature-link");
            name.setTooltip(new Tooltip("Creature details oeffnen"));
            name.setOnAction(event ->
                    publish.accept(new EncounterBuilderStateViewInputEvent.OpenCreatureDetailInput(card.creatureId())));

            HBox detail = new HBox(
                    4,
                    new BuilderStyledLabel(
                            "CR " + card.challengeRating() + "  |  " + card.xp() + " XP  |  " + card.type(),
                            STYLE_TEXT_SECONDARY),
                    new EncounterRoleBadgeLabel(card.role()));
            detail.setAlignment(Pos.CENTER_LEFT);

            VBox info = new VBox(2, name, detail);
            HBox.setHgrow(info, Priority.ALWAYS);

            Button remove = new BuilderStyledButton("\u00d7", STYLE_COMPACT, "remove-btn");
            remove.setOnAction(event ->
                    publish.accept(new EncounterBuilderStateViewInputEvent.RemoveCreatureInput(card.creatureId())));

            VBox right = new VBox(4, new BuilderStyledLabel("\u25BC", STYLE_TEXT_MUTED, "clickable"), remove);
            right.setAlignment(Pos.CENTER_RIGHT);

            HBox summary = new HBox(8, quantity, info, right);
            summary.setAlignment(Pos.CENTER_LEFT);
            return new BuilderEntityCard(summary);
        }
    }

final class EncounterAdvisoryRegionView extends VBox {

        private final Consumer<EncounterBuilderStateViewInputEvent.Interaction> publish;

        EncounterAdvisoryRegionView(Consumer<EncounterBuilderStateViewInputEvent.Interaction> publish) {
            super(4);
            this.publish = publish;
        }

        void showState(EncounterBuilderState state) {
            List<Node> nodes = new ArrayList<>();
            if (state.pendingUndo() != null) {
                EncounterUndoRemoveView undo = state.pendingUndo();
                Button undoButton = new BuilderStyledButton("Rueckgaengig", STYLE_COMPACT, STYLE_NEUTRAL_ACTION);
                undoButton.setOnAction(event ->
                        publish.accept(new EncounterBuilderStateViewInputEvent.UndoRemoveInput(undo.token())));

                HBox row = new HBox(
                        8,
                        new BuilderStyledLabel(undo.creatureName() + " entfernt.", STYLE_TEXT_SECONDARY),
                        undoButton);
                row.setAlignment(Pos.CENTER_LEFT);
                nodes.add(row);
            }
            if (!state.generationAdvisoryMessages().isEmpty()) {
                nodes.add(new BuilderStyledLabel("Hinweise", "small", STYLE_TEXT_SECONDARY));
                for (String advisory : state.generationAdvisoryMessages()) {
                    BuilderStyledLabel row = new BuilderStyledLabel(advisory, STYLE_TEXT_SECONDARY);
                    row.setWrapText(true);
                    nodes.add(row);
                }
            }
            getChildren().setAll(nodes);
            EncounterBuilderStateView.setShown(this, !nodes.isEmpty());
        }
    }

final class EncounterSavedPlansPopup {

    private final Consumer<EncounterBuilderStateViewInputEvent.Interaction> publish;
    private List<EncounterSavedPlanView> savedPlans = List.of();

    EncounterSavedPlansPopup(Consumer<EncounterBuilderStateViewInputEvent.Interaction> publish) {
        this.publish = publish;
    }

    void showPlans(List<EncounterSavedPlanView> plans) {
        savedPlans = plans == null ? List.of() : List.copyOf(plans);
    }

    void show(Node anchor) {
        AnchoredPopupContentModel popupContentModel = new AnchoredPopupContentModel();
        EncounterSavedPlansPopupContent content = new EncounterSavedPlansPopupContent();
        AnchoredPopupView popup = new AnchoredPopupView(content, () -> anchor);
        popup.bind(popupContentModel);
        content.showPlans(savedPlans, plan -> {
            popupContentModel.hide();
            publish.accept(new EncounterBuilderStateViewInputEvent.OpenSavedPlanInput(plan.id()));
        });
        popupContentModel.showBelow(8.0, false);
    }
}

final class EncounterSavedPlansPopupContent extends VBox {

        EncounterSavedPlansPopupContent() {
            super(4);
            getStyleClass().add("anchored-popup");
        }

        private void showEmpty() {
            getChildren().setAll(new BuilderStyledLabel("Keine gespeicherten Encounter.", STYLE_TEXT_SECONDARY));
        }

        void showPlans(List<EncounterSavedPlanView> plans, Consumer<EncounterSavedPlanView> selectionHandler) {
            if (plans.isEmpty()) {
                showEmpty();
                return;
            }
            getChildren().setAll(plans.stream()
                    .map(plan -> new EncounterSavedPlanOptionButton(plan, () -> selectionHandler.accept(plan)))
                    .toList());
        }
    }

final class EncounterSavedPlanOptionButton extends BuilderStyledButton {

        EncounterSavedPlanOptionButton(
                EncounterSavedPlanView plan,
                Runnable onSelect
        ) {
            super(labelFor(plan), "creature-link");
            setMaxWidth(Double.MAX_VALUE);
            setOnAction(event -> onSelect.run());
        }

        private static String labelFor(EncounterSavedPlanView plan) {
            return plan.summaryText().isBlank()
                    ? plan.name()
                    : plan.name() + " - " + plan.summaryText();
        }
    }

final class EncounterDifficultyBadgeLabel extends BuilderStyledLabel {

        EncounterDifficultyBadgeLabel() {
            super("", STYLE_TEXT_SECONDARY);
        }

        void showDifficulty(String difficulty) {
            setText(difficulty);
            replaceStyles(DIFFICULTY_STYLE_CLASSES, EncounterBuilderStyleMappings.lookup(DIFFICULTY_STYLES, difficulty, "difficulty-easy"));
        }
    }

final class EncounterRoleBadgeLabel extends BuilderStyledLabel {

        EncounterRoleBadgeLabel(String role) {
            super(role, "small", "role-badge", EncounterBuilderStyleMappings.lookup(ROLE_STYLES, role, "role-minion"));
        }
    }

class BuilderStyledLabel extends Label {

        BuilderStyledLabel(String text, String... styleClasses) {
            super(text);
            getStyleClass().addAll(styleClasses);
        }

        protected final void replaceStyles(List<String> obsoleteStyles, String nextStyle) {
            getStyleClass().removeAll(obsoleteStyles);
            getStyleClass().add(nextStyle);
        }
    }

class BuilderStyledButton extends Button {

        BuilderStyledButton(String text, String... styleClasses) {
            super(text);
            getStyleClass().addAll(styleClasses);
        }
    }

final class BuilderEntityCard extends VBox {

        BuilderEntityCard(Node content) {
            super(0, content);
            getStyleClass().add("entity-card");
        }
    }

final class EncounterBuilderStyleMappings {
        private EncounterBuilderStyleMappings() {
        }

        private static String lookup(Map<String, String> values, String rawValue, String fallback) {
            if (rawValue == null) {
                return fallback;
            }
            return values.getOrDefault(rawValue.toLowerCase(Locale.ROOT), fallback);
        }
    }

final class EncounterDifficultyMeterView extends StackPane {

        private final EncounterBuilderMeterBar meterBar = new EncounterBuilderMeterBar();
        private final EncounterBuilderMarkerRegion marker = new EncounterBuilderMarkerRegion();
        private double markerFraction;

        EncounterDifficultyMeterView() {
            setMinHeight(28);
            setPrefHeight(28);
            setMaxHeight(28);
            getChildren().addAll(meterBar, marker);
            setAlignment(meterBar, Pos.CENTER);
            setAlignment(marker, Pos.CENTER_LEFT);
            widthProperty().addListener((obs, oldValue, newValue) -> positionMarker());
        }

        void update(EncounterDifficultySummary value) {
            EncounterDifficultySummary summary = value == null
                    ? new EncounterDifficultySummary(0, 0, 0, 0, 0, "")
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

final class EncounterBuilderMeterBar extends HBox {

        EncounterBuilderMeterBar() {
            super(
                    0,
                    new EncounterBuilderMeterSegment("difficulty-meter-easy"),
                    new EncounterBuilderMeterSegment("difficulty-meter-medium"),
                    new EncounterBuilderMeterSegment("difficulty-meter-hard"),
                    new EncounterBuilderMeterSegment("difficulty-meter-deadly"));
            getStyleClass().add("difficulty-meter-bar");
            setMaxHeight(12);
        }
    }

final class EncounterBuilderMeterSegment extends Region {

        EncounterBuilderMeterSegment(String styleClass) {
            getStyleClass().add(styleClass);
            HBox.setHgrow(this, Priority.ALWAYS);
        }
    }

final class EncounterBuilderMarkerRegion extends Region {

        EncounterBuilderMarkerRegion() {
            getStyleClass().add("difficulty-meter-marker");
            setMinSize(2, 22);
            setPrefSize(2, 22);
            setMaxSize(2, 22);
            setMouseTransparent(true);
        }
    }
