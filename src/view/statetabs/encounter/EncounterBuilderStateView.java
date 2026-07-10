package src.view.statetabs.encounter;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.function.Consumer;
import java.util.function.IntConsumer;
import java.util.function.LongConsumer;
import javafx.beans.property.ReadOnlyObjectProperty;
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

    private Runnable generateHandler = () -> { };
    private IntConsumer shiftAlternativeHandler = ignored -> { };
    private Runnable saveCurrentPlanHandler = () -> { };
    private LongConsumer openSavedPlanHandler = ignored -> { };
    private RosterCountHandler changeRosterCountHandler = (creatureId, delta) -> { };
    private LongConsumer removeCreatureHandler = ignored -> { };
    private LongConsumer undoRemoveHandler = ignored -> { };
    private Runnable clearGenerationHistoryHandler = () -> { };
    private Runnable openInitiativeHandler = () -> { };
    private LongConsumer openCreatureDetailHandler = ignored -> { };

    public EncounterBuilderStateView() {
        body = new EncounterBuilderBodyPane();
        dialog = buildPane();
        getChildren().add(dialog);
        setVgrow(dialog, Priority.ALWAYS);
    }

    public void onGenerate(Runnable handler) {
        generateHandler = handler == null ? () -> { } : handler;
    }

    public void onShiftAlternative(IntConsumer handler) {
        shiftAlternativeHandler = handler == null ? ignored -> { } : handler;
    }

    public void onSaveCurrentPlan(Runnable handler) {
        saveCurrentPlanHandler = handler == null ? () -> { } : handler;
    }

    public void onOpenSavedPlan(LongConsumer handler) {
        openSavedPlanHandler = handler == null ? ignored -> { } : handler;
    }

    public void onChangeRosterCount(RosterCountHandler handler) {
        changeRosterCountHandler = handler == null ? (creatureId, delta) -> { } : handler;
    }

    public void onRemoveCreature(LongConsumer handler) {
        removeCreatureHandler = handler == null ? ignored -> { } : handler;
    }

    public void onUndoRemove(LongConsumer handler) {
        undoRemoveHandler = handler == null ? ignored -> { } : handler;
    }

    public void onClearGenerationHistory(Runnable handler) {
        clearGenerationHistoryHandler = handler == null ? () -> { } : handler;
    }

    public void onOpenInitiative(Runnable handler) {
        openInitiativeHandler = handler == null ? () -> { } : handler;
    }

    public void onOpenCreatureDetail(LongConsumer handler) {
        openCreatureDetailHandler = handler == null ? ignored -> { } : handler;
    }

    public void bind(ReadOnlyObjectProperty<EncounterStateViewModel.BuilderPanel> panelProperty) {
        if (panelProperty == null) {
            return;
        }
        showPanel(panelProperty.get());
        panelProperty.addListener((ignored, before, after) -> showPanel(after));
    }

    private void showPanel(EncounterStateViewModel.BuilderPanel panel) {
        EncounterStateViewModel.BuilderPanel safePanel =
                panel == null ? EncounterStateViewModel.BuilderPanel.empty() : panel;
        ((EncounterBuilderBodyPane) body).showPanel(safePanel, new BuilderActionSink());
        updateActionButtons(safePanel);
        openEncounterButton.setOnAction(event -> showSavedPlansPopup(
                openEncounterButton,
                safePanel.savedPlans(),
                openSavedPlanHandler));
    }

    private VBox buildPane() {
        HBox footer = new HBox(8, buildFooter());
        footer.setAlignment(Pos.CENTER_LEFT);
        VBox nextDialog = new BuilderStyledVBox(10, "dialog-surface", buildTitleRow(), body, footer);
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
        saveEncounterButton.setOnAction(event -> saveCurrentPlanHandler.run());
        openEncounterButton.setTooltip(new Tooltip("Gespeichertes Encounter oeffnen"));
        clearHistoryButton.setTooltip(new Tooltip("Generator-Historie leeren"));
        clearHistoryButton.setOnAction(event -> clearGenerationHistoryHandler.run());

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
        generateButton.setOnAction(event -> generateHandler.run());

        previousAlternativeButton.setTooltip(new Tooltip("Vorherige Generator-Alternative"));
        previousAlternativeButton.setOnAction(event -> shiftAlternativeHandler.accept(-1));
        nextAlternativeButton.setTooltip(new Tooltip("Naechste Generator-Alternative"));
        nextAlternativeButton.setOnAction(event -> shiftAlternativeHandler.accept(1));
        startCombatButton.setMaxWidth(Double.MAX_VALUE);
        startCombatButton.setDisable(true);
        startCombatButton.setOnAction(event -> openInitiativeHandler.run());

        HBox.setHgrow(generateButton, Priority.ALWAYS);
        HBox.setHgrow(startCombatButton, Priority.ALWAYS);
        return new Node[] { previousAlternativeButton, generateButton, nextAlternativeButton, startCombatButton };
    }

    private void updateActionButtons(EncounterStateViewModel.BuilderPanel panel) {
        previousAlternativeButton.setDisable(!panel.canPreviousAlternative());
        nextAlternativeButton.setDisable(!panel.canNextAlternative());
        saveEncounterButton.setDisable(!panel.canSavePlan());
        openEncounterButton.setDisable(panel.savedPlans().isEmpty());
        clearHistoryButton.setDisable(!panel.canClearGenerationHistory());
        startCombatButton.setDisable(!panel.canStartCombat());
    }

    private final class BuilderActionSink implements EncounterBuilderBodyActions {

        @Override
        public void changeRosterCount(long creatureId, int delta) {
            changeRosterCountHandler.changeRosterCount(creatureId, delta);
        }

        @Override
        public void openCreatureDetail(long creatureId) {
            openCreatureDetailHandler.accept(creatureId);
        }

        @Override
        public void removeCreature(long creatureId) {
            removeCreatureHandler.accept(creatureId);
        }

        @Override
        public void undoRemove(long undoToken) {
            undoRemoveHandler.accept(undoToken);
        }
    }

    private static final class EncounterBuilderBodyPane extends VBox {

        private final Label builderDifficultyLabel = new EncounterDifficultyBadgeLabel();
        private final Label builderTemplateLabel =
                new BuilderStyledLabel("", "small", STYLE_TEXT_SECONDARY);
        private final Label builderPartyLabel =
                new BuilderStyledLabel("", STYLE_TEXT_SECONDARY);
        private final Label builderXpLabel = new BuilderStyledLabel("", "bold");
        private final Label easyThresholdLabel = new BuilderStyledLabel("", "difficulty-easy");
        private final Label mediumThresholdLabel = new BuilderStyledLabel("", "difficulty-medium");
        private final Label hardThresholdLabel = new BuilderStyledLabel("", "difficulty-hard");
        private final Label deadlyThresholdLabel = new BuilderStyledLabel("", "difficulty-deadly");
        private final Label builderStatusLabel =
                new BuilderStyledLabel("", STYLE_TEXT_SECONDARY);
        private final Label rosterPlaceholder = new BuilderStyledLabel(
                ROSTER_PLACEHOLDER_TEXT,
                STYLE_TEXT_MUTED);
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
                EncounterStateViewModel.BuilderPanel panel,
                EncounterBuilderBodyActions actions
        ) {
            EncounterStateViewModel.DifficultySummary difficulty = panel.difficulty();
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
                List<EncounterStateViewModel.RosterCardView> roster,
                EncounterBuilderBodyActions actions
        ) {
            List<Node> cards = new ArrayList<>();
            for (EncounterStateViewModel.RosterCardView card
                    : roster == null ? List.<EncounterStateViewModel.RosterCardView>of() : roster) {
                cards.add(buildRosterCard(card, actions));
            }
            getChildren().setAll(cards);
        }

        private Node buildRosterCard(
                EncounterStateViewModel.RosterCardView card,
                EncounterBuilderBodyActions actions
        ) {
            Button minus = new BuilderStyledButton("-", STYLE_COMPACT);
            minus.setAccessibleText("Anzahl von " + card.name() + " verringern");
            minus.setDisable(card.namedNpc() || card.count() <= 1);
            minus.setOnAction(event -> {
                if (actions != null) {
                    actions.changeRosterCount(card.creatureId(), -1);
                }
            });

            BuilderStyledLabel count =
                    new BuilderStyledLabel(String.valueOf(card.count()), "bold", "encounter-roster-count");
            count.setAlignment(Pos.CENTER);

            Button plus = new BuilderStyledButton("+", STYLE_COMPACT);
            plus.setAccessibleText("Anzahl von " + card.name() + " erhoehen");
            plus.setDisable(card.namedNpc());
            plus.setOnAction(event -> {
                if (actions != null) {
                    actions.changeRosterCount(card.creatureId(), 1);
                }
            });

            HBox quantity = new HBox(2, minus, count, plus);
            quantity.setAlignment(Pos.CENTER);

            Button name = new BuilderStyledButton(card.name(), "creature-link");
            name.setTooltip(new Tooltip("Creature details oeffnen"));
            name.setOnAction(event -> {
                if (actions != null) {
                    actions.openCreatureDetail(card.creatureId());
                }
            });

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
            remove.setAccessibleText(card.name() + " aus dem Encounter entfernen");
            remove.setDisable(card.namedNpc());
            remove.setOnAction(event -> {
                if (actions != null) {
                    actions.removeCreature(card.creatureId());
                }
            });

            VBox right = new VBox(
                    4,
                    new BuilderStyledLabel("\u25BC", STYLE_TEXT_MUTED, "clickable"),
                    remove);
            right.setAlignment(Pos.CENTER_RIGHT);

            HBox summary = new HBox(8, quantity, info, right);
            summary.setAlignment(Pos.CENTER_LEFT);
            return new BuilderEntityCard(summary);
        }
    }

    private static final class EncounterBuilderAdvisoryPane extends VBox {

        EncounterBuilderAdvisoryPane() {
            super(4);
            getStyleClass().add("encounter-advisory-region");
        }

        void showPanel(
                EncounterStateViewModel.BuilderPanel panel,
                Consumer<Long> undoRemove
        ) {
            List<Node> nodes = new ArrayList<>();
            if (panel.pendingUndo() != null) {
                EncounterStateViewModel.UndoRemoveView undo = panel.pendingUndo();
                Button undoButton = new BuilderStyledButton(
                        "Rueckgaengig",
                        STYLE_COMPACT,
                        STYLE_NEUTRAL_ACTION);
                undoButton.setOnAction(event -> undoRemove.accept(undo.token()));

                HBox row = new HBox(
                        8,
                        new BuilderStyledLabel(
                                undo.creatureName() + " entfernt.",
                                STYLE_TEXT_SECONDARY),
                        undoButton);
                row.setAlignment(Pos.CENTER_LEFT);
                nodes.add(row);
            }
            if (!panel.generationAdvisoryMessages().isEmpty()) {
                nodes.add(new BuilderStyledLabel(
                        "Hinweise",
                        "small",
                        STYLE_TEXT_SECONDARY));
                for (String advisory : panel.generationAdvisoryMessages()) {
                    BuilderStyledLabel row =
                            new BuilderStyledLabel(advisory, STYLE_TEXT_SECONDARY);
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
            List<EncounterStateViewModel.SavedPlanView> savedPlans,
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
                    STYLE_TEXT_SECONDARY));
        }

        Node showPlans(
                List<EncounterStateViewModel.SavedPlanView> plans,
                Consumer<EncounterStateViewModel.SavedPlanView> selectionHandler
        ) {
            if (plans.isEmpty()) {
                showEmpty();
                return null;
            }
            List<Node> buttons = new ArrayList<>();
            for (EncounterStateViewModel.SavedPlanView plan : plans) {
                buttons.add(new EncounterSavedPlanOptionButton(plan, () -> selectionHandler.accept(plan)));
            }
            getChildren().setAll(buttons);
            return buttons.isEmpty() ? null : buttons.get(0);
        }
    }

    private static final class EncounterSavedPlanOptionButton extends BuilderStyledButton {

        EncounterSavedPlanOptionButton(
                EncounterStateViewModel.SavedPlanView plan,
                Runnable onSelect
        ) {
            super(labelFor(plan), "creature-link");
            setMaxWidth(Double.MAX_VALUE);
            setOnAction(event -> onSelect.run());
        }

        private static String labelFor(EncounterStateViewModel.SavedPlanView plan) {
            return plan.summaryText().isBlank()
                    ? plan.name()
                    : plan.name() + " - " + plan.summaryText();
        }
    }

    private static final class EncounterDifficultyBadgeLabel extends BuilderStyledLabel {

        EncounterDifficultyBadgeLabel() {
            super("", STYLE_TEXT_SECONDARY);
        }

        void showDifficulty(String difficulty) {
            setText(difficulty);
            replaceStyles(
                    DIFFICULTY_STYLE_CLASSES,
                    EncounterBuilderStyleMappings.lookup(
                            DIFFICULTY_STYLES,
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
                    EncounterBuilderStyleMappings.lookup(ROLE_STYLES, role, "role-minion"));
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

        void update(EncounterStateViewModel.DifficultySummary value) {
            double maxXp = Math.max(1.0, value.deadly() * 1.5);
            marker.setUserData(Double.valueOf(Math.max(0.0, Math.min(1.0, value.adjustedXp() / maxXp))));
            marker.setVisible(value.adjustedXp() > 0);
            positionMarker();
        }

        private void positionMarker() {
            double markerWidth = marker.prefWidth(-1);
            double width = getWidth();
            if (width <= 0) {
                return;
            }
            double markerFraction = marker.getUserData() instanceof Double value ? value : 0.0;
            marker.setTranslateX((width * markerFraction) - (width / 2) - (markerWidth / 2));
        }
    }

    private static final class BuilderStyledVBox extends VBox {

        BuilderStyledVBox(double spacing, String styleClass, Node... nodes) {
            super(spacing, nodes);
            getStyleClass().add(styleClass);
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

    @FunctionalInterface
    public interface RosterCountHandler {
        void changeRosterCount(long creatureId, int delta);
    }
}
