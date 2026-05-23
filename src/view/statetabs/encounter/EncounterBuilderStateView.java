package src.view.statetabs.encounter;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.function.Consumer;
import java.util.function.LongConsumer;
import javafx.geometry.Pos;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.ContextMenu;
import javafx.scene.control.CustomMenuItem;
import javafx.scene.control.Label;
import javafx.scene.control.ScrollPane;
import javafx.scene.control.Tooltip;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.StackPane;
import javafx.scene.layout.VBox;

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
    private final VBox body;
    private final VBox dialog;

    private Consumer<EncounterBuilderStateViewInputEvent> viewInputEventHandler = ignored -> { };
    public EncounterBuilderStateView() {
        body = new EncounterBuilderBodyPane();
        dialog = buildPane();
        getChildren().add(dialog);
        setVgrow(dialog, Priority.ALWAYS);
    }

    public void onViewInputEvent(Consumer<EncounterBuilderStateViewInputEvent> handler) {
        viewInputEventHandler = handler == null ? ignored -> { } : handler;
    }

    public void bind(EncounterBuilderStateContentModel contentModel) {
        if (contentModel == null) {
            return;
        }
        showPanel(contentModel, contentModel.panelProperty().get());
        contentModel.panelProperty().addListener((ignored, before, after) -> showPanel(contentModel, after));
    }

    private void showPanel(
            EncounterBuilderStateContentModel contentModel,
            EncounterBuilderStateContentModel.PanelModel panel
    ) {
        EncounterBuilderStateContentModel.PanelModel safePanel = contentModel.safePanel(panel);
        ((EncounterBuilderBodyPane) body).showPanel(safePanel, new BuilderActionSink());
        updateActionButtons(safePanel);
        openEncounterButton.setOnAction(event -> showSavedPlansPopup(
                openEncounterButton,
                safePanel.savedPlans(),
                selectedPlanId -> publish(new EncounterBuilderStateViewInputEvent.OpenSavedPlanInput(selectedPlanId))));
    }

    private VBox buildPane() {
        HBox footer = new HBox(8, buildFooter());
        footer.setAlignment(Pos.CENTER_LEFT);
        VBox nextDialog = new VBox(10, buildTitleRow(), body, footer);
        nextDialog.getStyleClass().add("dialog-surface");
        setVgrow(body, Priority.ALWAYS);
        return nextDialog;
    }

    private Node buildTitleRow() {
        saveEncounterButton.setTooltip(new Tooltip("Aktuelles Encounter-Roster speichern"));
        previousAlternativeButton.setAccessibleText("Vorherige Generator-Alternative");
        nextAlternativeButton.setAccessibleText("Naechste Generator-Alternative");
        clearHistoryButton.setAccessibleText("Generator-Historie leeren");
        saveEncounterButton.setAccessibleText("Aktuelles Encounter-Roster speichern");
        openEncounterButton.setAccessibleText("Gespeichertes Encounter oeffnen");
        saveEncounterButton.setOnAction(event ->
                publish(new EncounterBuilderStateViewInputEvent.SaveCurrentPlanInput()));
        openEncounterButton.setTooltip(new Tooltip("Gespeichertes Encounter oeffnen"));
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

        HBox.setHgrow(generateButton, Priority.ALWAYS);
        HBox.setHgrow(startCombatButton, Priority.ALWAYS);
        return new Node[] { previousAlternativeButton, generateButton, nextAlternativeButton, startCombatButton };
    }

    private void updateActionButtons(EncounterBuilderStateContentModel.PanelModel panel) {
        previousAlternativeButton.setDisable(!panel.canPreviousAlternative());
        nextAlternativeButton.setDisable(!panel.canNextAlternative());
        saveEncounterButton.setDisable(!panel.canSavePlan());
        openEncounterButton.setDisable(panel.savedPlans().isEmpty());
        clearHistoryButton.setDisable(!panel.canClearGenerationHistory());
        startCombatButton.setDisable(!panel.canStartCombat());
    }

    private void publish(EncounterBuilderStateViewInputEvent.Interaction input) {
        viewInputEventHandler.accept(new EncounterBuilderStateViewInputEvent(input));
    }

    private final class BuilderActionSink implements EncounterBuilderBodyActions {

        @Override
        public void changeRosterCount(long creatureId, int delta) {
            publish(new EncounterBuilderStateViewInputEvent.ChangeRosterCountInput(creatureId, delta));
        }

        @Override
        public void openCreatureDetail(long creatureId) {
            publish(new EncounterBuilderStateViewInputEvent.OpenCreatureDetailInput(creatureId));
        }

        @Override
        public void removeCreature(long creatureId) {
            publish(new EncounterBuilderStateViewInputEvent.RemoveCreatureInput(creatureId));
        }

        @Override
        public void undoRemove(long undoToken) {
            publish(new EncounterBuilderStateViewInputEvent.UndoRemoveInput(undoToken));
        }
    }

    private static final class EncounterBuilderBodyPane extends VBox {

        private final Label builderDifficultyLabel = new EncounterDifficultyBadgeLabel();
        private final Label builderTemplateLabel =
                new BuilderStyledLabel("", "small", EncounterBuilderStateView.STYLE_TEXT_SECONDARY);
        private final Label builderPartyLabel =
                new BuilderStyledLabel("", EncounterBuilderStateView.STYLE_TEXT_SECONDARY);
        private final Label builderXpLabel = new BuilderStyledLabel("", "bold");
        private final Label easyThresholdLabel = new BuilderStyledLabel("", "difficulty-easy");
        private final Label mediumThresholdLabel = new BuilderStyledLabel("", "difficulty-medium");
        private final Label hardThresholdLabel = new BuilderStyledLabel("", "difficulty-hard");
        private final Label deadlyThresholdLabel = new BuilderStyledLabel("", "difficulty-deadly");
        private final Label builderStatusLabel =
                new BuilderStyledLabel("", EncounterBuilderStateView.STYLE_TEXT_SECONDARY);
        private final Label rosterPlaceholder = new BuilderStyledLabel(
                EncounterBuilderStateView.ROSTER_PLACEHOLDER_TEXT,
                EncounterBuilderStateView.STYLE_TEXT_MUTED);
        private final StackPane difficultyMeter = new EncounterDifficultyMeterView();
        private final VBox rosterList;
        private final ScrollPane rosterScroll;
        private final VBox advisoryRegion;

        EncounterBuilderBodyPane() {
            rosterList = new EncounterBuilderRosterPane();
            advisoryRegion = new EncounterBuilderAdvisoryPane();
            rosterScroll = new ScrollPane(rosterList);

            builderStatusLabel.setWrapText(true);
            setShown(builderStatusLabel, false);

            rosterScroll.setFitToWidth(true);
            rosterScroll.setHbarPolicy(ScrollPane.ScrollBarPolicy.NEVER);
            setShown(rosterScroll, false);

            StackPane rosterHost = new StackPane(rosterPlaceholder, rosterScroll);
            rosterHost.setAlignment(Pos.TOP_LEFT);
            setVgrow(rosterHost, Priority.ALWAYS);

            setShown(advisoryRegion, false);

            getStyleClass().add("encounter-builder-body");
            getChildren().addAll(
                    buildSummaryRow(),
                    difficultyMeter,
                    buildThresholdRow(),
                    builderXpLabel,
                    builderStatusLabel,
                    rosterHost,
                    advisoryRegion);
        }

        void showPanel(
                EncounterBuilderStateContentModel.PanelModel panel,
                EncounterBuilderBodyActions actions
        ) {
            EncounterBuilderStateContentModel.DifficultySummary difficulty = panel.difficulty();
            ((EncounterDifficultyBadgeLabel) builderDifficultyLabel).showDifficulty(difficulty.difficulty());
            builderTemplateLabel.setText(panel.templateLabel());
            builderPartyLabel.setText(panel.partyLabel());
            builderXpLabel.setText("Adj. XP: " + difficulty.adjustedXp());
            easyThresholdLabel.setText("Easy " + difficulty.easy());
            mediumThresholdLabel.setText("Med. " + difficulty.medium());
            hardThresholdLabel.setText("Hard " + difficulty.hard());
            deadlyThresholdLabel.setText("Deadly " + difficulty.deadly());
            builderStatusLabel.setText(panel.statusMessage());
            setShown(builderStatusLabel, !panel.statusMessage().isBlank());
            ((EncounterDifficultyMeterView) difficultyMeter).update(difficulty);
            ((EncounterBuilderRosterPane) rosterList).showRoster(panel.roster(), actions);
            setShown(rosterPlaceholder, panel.showRosterPlaceholder());
            setShown(rosterScroll, !panel.showRosterPlaceholder());
            ((EncounterBuilderAdvisoryPane) advisoryRegion).showPanel(
                    panel,
                    actions == null ? ignored -> { } : actions::undoRemove);
        }

        private static void setShown(Node node, boolean shown) {
            node.setVisible(shown);
            node.setManaged(shown);
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

    private interface EncounterBuilderBodyActions {

        void changeRosterCount(long creatureId, int delta);

        void openCreatureDetail(long creatureId);

        void removeCreature(long creatureId);

        void undoRemove(long undoToken);
    }

    private static final class EncounterBuilderRosterPane extends VBox {

        EncounterBuilderRosterPane() {
            super(6);
            getStyleClass().add("encounter-roster-list");
        }

        void showRoster(
                List<EncounterBuilderStateContentModel.RosterCardView> roster,
                EncounterBuilderBodyActions actions
        ) {
            List<Node> cards = new ArrayList<>();
            EncounterBuilderBodyActions safeActions = actions == null ? NoBuilderBodyActions.INSTANCE : actions;
            for (EncounterBuilderStateContentModel.RosterCardView card
                    : roster == null ? List.<EncounterBuilderStateContentModel.RosterCardView>of() : roster) {
                cards.add(buildRosterCard(card, safeActions));
            }
            getChildren().setAll(cards);
        }

        private Node buildRosterCard(
                EncounterBuilderStateContentModel.RosterCardView card,
                EncounterBuilderBodyActions actions
        ) {
            Button minus = new BuilderStyledButton("-", EncounterBuilderStateView.STYLE_COMPACT);
            minus.setAccessibleText("Anzahl von " + card.name() + " verringern");
            minus.setDisable(card.count() <= 1);
            minus.setOnAction(event -> actions.changeRosterCount(card.creatureId(), -1));

            BuilderStyledLabel count =
                    new BuilderStyledLabel(String.valueOf(card.count()), "bold", "encounter-roster-count");
            count.setAlignment(Pos.CENTER);

            Button plus = new BuilderStyledButton("+", EncounterBuilderStateView.STYLE_COMPACT);
            plus.setAccessibleText("Anzahl von " + card.name() + " erhoehen");
            plus.setOnAction(event -> actions.changeRosterCount(card.creatureId(), 1));

            HBox quantity = new HBox(2, minus, count, plus);
            quantity.setAlignment(Pos.CENTER);

            Button name = new BuilderStyledButton(card.name(), "creature-link");
            name.setTooltip(new Tooltip("Creature details oeffnen"));
            name.setOnAction(event -> actions.openCreatureDetail(card.creatureId()));

            HBox detail = new HBox(
                    4,
                    new BuilderStyledLabel(
                            "CR " + card.challengeRating() + "  |  " + card.xp() + " XP  |  " + card.type(),
                            EncounterBuilderStateView.STYLE_TEXT_SECONDARY),
                    new EncounterRoleBadgeLabel(card.role()));
            detail.setAlignment(Pos.CENTER_LEFT);

            VBox info = new VBox(2, name, detail);
            HBox.setHgrow(info, Priority.ALWAYS);

            Button remove = new BuilderStyledButton("\u00d7", EncounterBuilderStateView.STYLE_COMPACT, "remove-btn");
            remove.setAccessibleText(card.name() + " aus dem Encounter entfernen");
            remove.setOnAction(event -> actions.removeCreature(card.creatureId()));

            VBox right = new VBox(
                    4,
                    new BuilderStyledLabel("\u25BC", EncounterBuilderStateView.STYLE_TEXT_MUTED, "clickable"),
                    remove);
            right.setAlignment(Pos.CENTER_RIGHT);

            HBox summary = new HBox(8, quantity, info, right);
            summary.setAlignment(Pos.CENTER_LEFT);
            return new BuilderEntityCard(summary);
        }
    }

    private enum NoBuilderBodyActions implements EncounterBuilderBodyActions {
        INSTANCE;

        @Override
        public void changeRosterCount(long creatureId, int delta) {
            // Default sink intentionally ignores optional builder callbacks.
        }

        @Override
        public void openCreatureDetail(long creatureId) {
            // Default sink intentionally ignores optional builder callbacks.
        }

        @Override
        public void removeCreature(long creatureId) {
            // Default sink intentionally ignores optional builder callbacks.
        }

        @Override
        public void undoRemove(long undoToken) {
            // Default sink intentionally ignores optional builder callbacks.
        }
    }

    private static final class EncounterBuilderAdvisoryPane extends VBox {

        EncounterBuilderAdvisoryPane() {
            super(4);
            getStyleClass().add("encounter-advisory-region");
        }

        void showPanel(
                EncounterBuilderStateContentModel.PanelModel panel,
                Consumer<Long> undoRemove
        ) {
            List<Node> nodes = new ArrayList<>();
            if (panel.pendingUndo() != null) {
                EncounterBuilderStateContentModel.UndoRemoveView undo = panel.pendingUndo();
                Button undoButton = new BuilderStyledButton(
                        "Rueckgaengig",
                        EncounterBuilderStateView.STYLE_COMPACT,
                        EncounterBuilderStateView.STYLE_NEUTRAL_ACTION);
                undoButton.setOnAction(event -> undoRemove.accept(undo.token()));

                HBox row = new HBox(
                        8,
                        new BuilderStyledLabel(
                                undo.creatureName() + " entfernt.",
                                EncounterBuilderStateView.STYLE_TEXT_SECONDARY),
                        undoButton);
                row.setAlignment(Pos.CENTER_LEFT);
                nodes.add(row);
            }
            if (!panel.generationAdvisoryMessages().isEmpty()) {
                nodes.add(new BuilderStyledLabel(
                        "Hinweise",
                        "small",
                        EncounterBuilderStateView.STYLE_TEXT_SECONDARY));
                for (String advisory : panel.generationAdvisoryMessages()) {
                    BuilderStyledLabel row =
                            new BuilderStyledLabel(advisory, EncounterBuilderStateView.STYLE_TEXT_SECONDARY);
                    row.setWrapText(true);
                    nodes.add(row);
                }
            }
            getChildren().setAll(nodes);
            setShown(this, !nodes.isEmpty());
        }

        private static void setShown(Node node, boolean shown) {
            node.setVisible(shown);
            node.setManaged(shown);
        }
    }

    private static void showSavedPlansPopup(
            Node anchor,
            List<EncounterBuilderStateContentModel.SavedPlanView> savedPlans,
            LongConsumer openSavedPlan
    ) {
        if (anchor == null) {
            return;
        }
        EncounterSavedPlansPopupContent content = new EncounterSavedPlansPopupContent();
        ContextMenu popup = contextMenu(content);
        Node focusTarget = content.showPlans(savedPlans, plan -> {
            popup.hide();
            openSavedPlan.accept(plan.id());
        });
        popup.show(anchor, javafx.geometry.Side.BOTTOM, 0.0, 8.0);
        if (focusTarget != null) {
            javafx.application.Platform.runLater(focusTarget::requestFocus);
        }
    }

    private static final class EncounterSavedPlansPopupContent extends VBox {

        EncounterSavedPlansPopupContent() {
            super(4);
            getStyleClass().add("anchored-popup");
        }

        private void showEmpty() {
            getChildren().setAll(new BuilderStyledLabel(
                    "Keine gespeicherten Encounter.",
                    EncounterBuilderStateView.STYLE_TEXT_SECONDARY));
        }

        Node showPlans(
                List<EncounterBuilderStateContentModel.SavedPlanView> plans,
                Consumer<EncounterBuilderStateContentModel.SavedPlanView> selectionHandler
        ) {
            if (plans.isEmpty()) {
                showEmpty();
                return null;
            }
            List<Node> buttons = new ArrayList<>();
            for (EncounterBuilderStateContentModel.SavedPlanView plan : plans) {
                buttons.add(new EncounterSavedPlanOptionButton(plan, () -> selectionHandler.accept(plan)));
            }
            getChildren().setAll(buttons);
            return buttons.isEmpty() ? null : buttons.get(0);
        }
    }

    private static final class EncounterSavedPlanOptionButton extends BuilderStyledButton {

        EncounterSavedPlanOptionButton(
                EncounterBuilderStateContentModel.SavedPlanView plan,
                Runnable onSelect
        ) {
            super(labelFor(plan), "creature-link");
            setMaxWidth(Double.MAX_VALUE);
            setOnAction(event -> onSelect.run());
        }

        private static String labelFor(EncounterBuilderStateContentModel.SavedPlanView plan) {
            return plan.summaryText().isBlank()
                    ? plan.name()
                    : plan.name() + " - " + plan.summaryText();
        }
    }

    private static final class EncounterDifficultyBadgeLabel extends BuilderStyledLabel {

        EncounterDifficultyBadgeLabel() {
            super("", EncounterBuilderStateView.STYLE_TEXT_SECONDARY);
        }

        void showDifficulty(String difficulty) {
            setText(difficulty);
            replaceStyles(
                    EncounterBuilderStateView.DIFFICULTY_STYLE_CLASSES,
                    EncounterBuilderStyleMappings.lookup(
                            EncounterBuilderStateView.DIFFICULTY_STYLES,
                            difficulty,
                            "difficulty-easy"));
        }
    }

    private static final class EncounterRoleBadgeLabel extends BuilderStyledLabel {

        EncounterRoleBadgeLabel(String role) {
            super(
                    role,
                    "small",
                    "role-badge",
                    EncounterBuilderStyleMappings.lookup(EncounterBuilderStateView.ROLE_STYLES, role, "role-minion"));
        }
    }

    private static class BuilderStyledLabel extends Label {

        BuilderStyledLabel(String text, String... styleClasses) {
            super(text);
            getStyleClass().addAll(styleClasses);
        }

        protected final void replaceStyles(List<String> obsoleteStyles, String nextStyle) {
            getStyleClass().removeAll(obsoleteStyles);
            getStyleClass().add(nextStyle);
        }
    }

    private static class BuilderStyledButton extends Button {

        BuilderStyledButton(String text, String... styleClasses) {
            super(text);
            getStyleClass().addAll(styleClasses);
        }
    }

    private static final class BuilderEntityCard extends VBox {

        BuilderEntityCard(Node content) {
            super(0, content);
            getStyleClass().add("entity-card");
        }
    }

    private static final class EncounterBuilderStyleMappings {
        private EncounterBuilderStyleMappings() {
        }

        static String lookup(Map<String, String> values, String rawValue, String fallback) {
            if (rawValue == null) {
                return fallback;
            }
            return values.getOrDefault(rawValue.toLowerCase(Locale.ROOT), fallback);
        }
    }

    private static final class EncounterDifficultyMeterView extends StackPane {

        private final HBox meterBar = new EncounterBuilderMeterBar();
        private final Region marker = new EncounterBuilderMarkerRegion();

        EncounterDifficultyMeterView() {
            getStyleClass().add("difficulty-meter");
            getChildren().addAll(meterBar, marker);
            setAlignment(meterBar, Pos.CENTER);
            setAlignment(marker, Pos.CENTER_LEFT);
            widthProperty().addListener((obs, oldValue, newValue) -> positionMarker());
        }

        void update(EncounterBuilderStateContentModel.DifficultySummary value) {
            double maxXp = Math.max(1.0, value.deadly() * 1.5);
            double markerFraction = Math.max(0.0, Math.min(1.0, value.adjustedXp() / maxXp));
            marker.setUserData(markerFraction);
            marker.setVisible(value.adjustedXp() > 0);
            positionMarker();
        }

        private void positionMarker() {
            Object markerUserData = marker.getUserData();
            double markerFraction = markerUserData instanceof Double value ? value : 0.0;
            double markerWidth = marker.prefWidth(-1);
            double width = getWidth();
            if (width <= 0) {
                return;
            }
            marker.setTranslateX((width * markerFraction) - (width / 2) - (markerWidth / 2));
        }
    }

    private static ContextMenu contextMenu(Node content) {
        CustomMenuItem menuItem = new CustomMenuItem(content, false);
        ContextMenu menu = new ContextMenu(menuItem);
        menu.setAutoHide(true);
        return menu;
    }

    private static final class EncounterBuilderMeterBar extends HBox {

        EncounterBuilderMeterBar() {
            super(
                    0,
                    new EncounterBuilderMeterSegment("difficulty-meter-easy"),
                    new EncounterBuilderMeterSegment("difficulty-meter-medium"),
                    new EncounterBuilderMeterSegment("difficulty-meter-hard"),
                    new EncounterBuilderMeterSegment("difficulty-meter-deadly"));
            getStyleClass().add("difficulty-meter-bar");
        }
    }

    private static final class EncounterBuilderMeterSegment extends Region {

        EncounterBuilderMeterSegment(String styleClass) {
            getStyleClass().add(styleClass);
            HBox.setHgrow(this, Priority.ALWAYS);
        }
    }

    private static final class EncounterBuilderMarkerRegion extends Region {

        EncounterBuilderMarkerRegion() {
            getStyleClass().add("difficulty-meter-marker");
            setMouseTransparent(true);
        }
    }
}
