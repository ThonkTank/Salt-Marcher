package src.view.dropdowns.adventuringday;

import java.text.NumberFormat;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.TreeMap;
import java.util.function.Consumer;
import javafx.beans.property.StringProperty;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.ComboBox;
import javafx.scene.control.Label;
import javafx.scene.control.ScrollPane;
import javafx.scene.control.TextField;
import javafx.scene.control.TextFormatter;
import javafx.scene.control.ToggleButton;
import javafx.scene.control.ToggleGroup;
import javafx.scene.control.Tooltip;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Pane;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;
import src.view.slotcontent.primitives.dialog.DialogSurfaceView;
import src.view.slotcontent.primitives.dialog.DialogSurfaceView.BodyPolicy;
import src.view.slotcontent.primitives.popup.AnchoredPopupView;
import src.view.slotcontent.topbar.dropdown.DropdownPopupView;

@SuppressWarnings({
        "PMD.CouplingBetweenObjects",
        "PMD.TooManyMethods"
})
public final class AdventuringDayTopBarView extends HBox {

    private static final String PMD_LOD = "PMD.LawOfDemeter";
    private static final double POPUP_WIDTH = 420.0;
    private static final String CLEAR_LABEL = "Lee\u0072en";
    private static final String TOTAL_GROUP_XP_LABEL = "Gesamt-\u0058\u0050";
    private static final String TOTAL_GROUP_XP_HINT = TOTAL_GROUP_XP_LABEL + " für die Gruppe";
    private static final String STYLE_COMPACT = "compact";
    private static final String STYLE_TEXT_MUTED = "text-muted";
    private static final String STYLE_TEXT_SECONDARY = "text-secondary";

    private final Button triggerButton = new Button("Rastbudget ▼");
    private final AnchoredPopupView popup = new AnchoredPopupView();
    private final CalculatorPane calculatorPane = new CalculatorPane(this::publishCalculationSubmit);
    private Consumer<AdventuringDayTopBarViewInputEvent> viewInputEventHandler = ignored -> { };

    AdventuringDayTopBarView() {
        setSpacing(8);
        setPadding(new Insets(4, 0, 4, 8));
        configureTrigger();
        configurePopup();
        getChildren().add(triggerButton);
    }

    StringProperty triggerTextProperty() {
        return triggerButton.textProperty();
    }

    void showPanel(AdventuringDayTopBarContributionModel.PanelModel panelModel) {
        AdventuringDayTopBarContributionModel.PanelModel safePanelModel = panelModel == null
                ? AdventuringDayTopBarContributionModel.PanelModel.loadingModel()
                : panelModel;
        if (safePanelModel.error()) {
            calculatorPane.markActivePartyRefreshFailed();
            return;
        }
        calculatorPane.setActivePartySnapshot(safePanelModel.activePartyLevels());
    }

    void showCalculation(CalculationContent calculation) {
        calculatorPane.showCalculation(calculation);
    }

    void onViewInputEvent(Consumer<AdventuringDayTopBarViewInputEvent> handler) {
        viewInputEventHandler = handler == null ? ignored -> { } : handler;
    }

    private void configureTrigger() {
        addStyleClass(triggerButton, STYLE_TEXT_SECONDARY);
        triggerButton.setTooltip(new Tooltip("Adventuring-Day-Rechner öffnen"));
        triggerButton.setOnAction(event -> togglePopup());
    }

    private void configurePopup() {
        DialogSurfaceView panel = buildPanel();
        panel.getStyleClass().addAll("party-panel", "adventuring-day-toolbar-popup");
        popup.setContent(panel);
    }

    private DialogSurfaceView buildPanel() {
        DialogSurfaceView dialog = new DialogSurfaceView();
        Label headerLabel = new Label("ADVENTURING DAY");
        addStyleClass(headerLabel, "title-large");
        Button closeButton = new Button("×");
        addStyleClass(closeButton, STYLE_COMPACT);
        closeButton.setAccessibleText("Adventuring-Day-Rechner schliessen");
        closeButton.setOnAction(event -> popup.hide());
        Region spacer = new Region();
        setAlwaysHgrow(spacer);
        HBox header = new HBox(6, headerLabel, spacer, closeButton);
        addStyleClass(header, "party-header");
        header.setAlignment(Pos.CENTER_LEFT);

        ScrollPane scrollPane = new ScrollPane(calculatorPane);
        scrollPane.setFitToWidth(true);
        scrollPane.setHbarPolicy(ScrollPane.ScrollBarPolicy.NEVER);
        scrollPane.setVbarPolicy(ScrollPane.ScrollBarPolicy.AS_NEEDED);
        scrollPane.setPrefViewportHeight(560);
        scrollPane.setMaxHeight(560);
        addStyleClass(scrollPane, "adventuring-day-scroll");

        VBox body = new VBox(scrollPane);
        body.setPadding(new Insets(0, 12, 12, 12));
        dialog.setHeader(header);
        dialog.setBody(body, BodyPolicy.FIXED);
        return dialog;
    }

    private void togglePopup() {
        DropdownPopupView.toggleTrailing(
                popup,
                triggerButton,
                POPUP_WIDTH,
                () -> publish(new AdventuringDayTopBarViewInputEvent(true, List.of(), 0)));
    }

    private void publishCalculationSubmit(List<Integer> levels, int totalGroupXp) {
        publish(new AdventuringDayTopBarViewInputEvent(false, levels, totalGroupXp));
    }

    private void publish(AdventuringDayTopBarViewInputEvent event) {
        viewInputEventHandler.accept(event);
    }

    @SuppressWarnings(PMD_LOD)
    private static void addStyleClass(Node node, String styleClass) {
        node.getStyleClass().add(styleClass);
    }

    @SuppressWarnings(PMD_LOD)
    private static void addStyleClasses(Node node, String... styleClasses) {
        node.getStyleClass().addAll(styleClasses);
    }

    private static void setAlwaysHgrow(Region region) {
        setHgrow(region, Priority.ALWAYS);
    }

    @SuppressWarnings(PMD_LOD)
    private static void setChildren(Pane pane, Node... nodes) {
        pane.getChildren().setAll(nodes);
    }

    @SuppressWarnings(PMD_LOD)
    private static void addChild(Pane pane, Node node) {
        pane.getChildren().add(node);
    }

    @SuppressWarnings(PMD_LOD)
    private static void addChildren(Pane pane, List<? extends Node> nodes) {
        pane.getChildren().addAll(nodes);
    }

    @SuppressWarnings(PMD_LOD)
    private static void removeChild(Pane pane, Node node) {
        pane.getChildren().remove(node);
    }

    @SuppressWarnings(PMD_LOD)
    private static void addComboItems(ComboBox<Integer> comboBox, List<Integer> items) {
        comboBox.getItems().addAll(items);
    }

    private static TextField createIntegerField() {
        TextField field = new TextField();
        field.setTextFormatter(new TextFormatter<>(change -> change.getText().matches("[0-9]*") ? change : null));
        return field;
    }

    private static int parseNonNegativeInt(TextField field) {
        String raw = field.getText();
        if (raw == null || raw.isBlank()) {
            return 0;
        }
        try {
            return Math.max(0, Integer.parseInt(raw));
        } catch (NumberFormatException exception) {
            return 0;
        }
    }

    private static List<Integer> levelOptions() {
        List<Integer> values = new ArrayList<>(20);
        for (int level = 1; level <= 20; level++) {
            values.add(level);
        }
        return values;
    }

    private static List<Integer> sanitizeLevels(List<Integer> levels) {
        if (levels == null || levels.isEmpty()) {
            return List.of();
        }
        List<Integer> normalized = new ArrayList<>();
        for (Integer level : levels) {
            if (level != null) {
                normalized.add(Math.max(1, Math.min(20, level)));
            }
        }
        return List.copyOf(normalized);
    }

    record CalculationContent(
            List<String> budgetSummaryLines,
            List<String> budgetTimelineLines,
            List<String> progressSummaryLines,
            List<String> progressTimelineLines
    ) {

        CalculationContent {
            budgetSummaryLines = copy(budgetSummaryLines);
            budgetTimelineLines = copy(budgetTimelineLines);
            progressSummaryLines = copy(progressSummaryLines);
            progressTimelineLines = copy(progressTimelineLines);
        }

        static CalculationContent empty(int totalGroupXp) {
            return new CalculationContent(
                    List.of(
                            "Tag gesamt: 0 XP",
                            "Pro Drittel: ca. 0 XP",
                            "Short Rest 1: nach 0 XP",
                            "Short Rest 2: nach 0 XP"),
                    List.of(
                            "Short Rest 1: 0 XP",
                            "Short Rest 2: 0 XP",
                            "Long Rest: 0 XP"),
                    List.of(
                            TOTAL_GROUP_XP_LABEL + ": " + formatInt(totalGroupXp) + " XP",
                            "XP pro Charakter: 0",
                            "Adventuring Days: 0 (0 voll)",
                            "Short Rests: 0",
                            "Long Rests: 0",
                            "Level-ups: keine"),
                    List.of());
        }

        private static List<String> copy(List<String> lines) {
            return lines == null ? List.of() : List.copyOf(lines);
        }

        private static String formatInt(int value) {
            NumberFormat format = NumberFormat.getIntegerInstance(Locale.GERMANY);
            return format.format(Math.max(0, value));
        }
    }

    private static final class CalculatorPane extends VBox {

        private final Label partySummaryLabel = new Label();
        private final Button useActivePartyButton = new Button("Aktive Party");
        private final Button addRowButton = new Button("Zeile");
        private final Button clearButton = new Button(CLEAR_LABEL);
        private final ToggleButton budgetModeButton = new ToggleButton("Budget");
        private final ToggleButton progressModeButton = new ToggleButton("XP -> Tage");
        private final TextField totalGroupXpField = createIntegerField();
        private final HBox progressInputRow;
        private final PartyRowsPane partyRowsPane = new PartyRowsPane(() -> {
            sourceMode = PartySourceMode.CUSTOM;
            refreshSummary();
            syncActionState();
        });
        private final SummaryPane summaryPane = new SummaryPane();
        private final CalculationRequestListener calculationRequestListener;

        private CalculationContent calculationContent = CalculationContent.empty(0);
        private List<Integer> activePartyLevels = List.of();
        private PartySourceMode sourceMode = PartySourceMode.ACTIVE_PARTY;
        private boolean activePartyChangedSinceCustomEdit;
        private boolean activePartyRefreshFailed;
        private boolean suppressPublishedEvents;

        private CalculatorPane(CalculationRequestListener calculationRequestListener) {
            this.calculationRequestListener = calculationRequestListener == null ? (levels, totalGroupXp) -> { }
                    : calculationRequestListener;
            setSpacing(8);
            setPadding(new Insets(8, 0, 0, 0));
            addStyleClass(partySummaryLabel, STYLE_TEXT_SECONDARY);

            ToggleGroup modeGroup = new ToggleGroup();
            budgetModeButton.setToggleGroup(modeGroup);
            progressModeButton.setToggleGroup(modeGroup);
            budgetModeButton.setSelected(true);
            addStyleClass(budgetModeButton, STYLE_COMPACT);
            addStyleClass(progressModeButton, STYLE_COMPACT);

            HBox modeRow = new HBox(6, budgetModeButton, progressModeButton);
            HBox headerActions = new HBox(6, useActivePartyButton, addRowButton, clearButton);
            addStyleClass(useActivePartyButton, STYLE_COMPACT);
            addStyleClass(addRowButton, STYLE_COMPACT);
            addStyleClass(clearButton, STYLE_COMPACT);

            totalGroupXpField.setPromptText(TOTAL_GROUP_XP_LABEL);
            totalGroupXpField.setPrefColumnCount(10);
            totalGroupXpField.textProperty().addListener((ignored, before, after) -> refreshSummary());
            Label totalGroupXpHint = new Label(TOTAL_GROUP_XP_HINT);
            addStyleClass(totalGroupXpHint, STYLE_TEXT_MUTED);
            progressInputRow = new HBox(8, totalGroupXpHint, totalGroupXpField);
            progressInputRow.setAlignment(Pos.CENTER_LEFT);

            useActivePartyButton.setOnAction(event -> {
                sourceMode = PartySourceMode.ACTIVE_PARTY;
                activePartyChangedSinceCustomEdit = false;
                partyRowsPane.setLevels(activePartyLevels);
                refreshSummary();
                syncActionState();
            });
            addRowButton.setOnAction(event -> {
                sourceMode = PartySourceMode.CUSTOM;
                partyRowsPane.addDefaultRow();
            });
            clearButton.setOnAction(event -> {
                sourceMode = PartySourceMode.CUSTOM;
                partyRowsPane.setLevels(List.of());
                refreshSummary();
                syncActionState();
            });
            modeGroup.selectedToggleProperty().addListener((ignored, before, after) -> {
                syncProgressModeVisibility();
                refreshSummary();
            });

            getChildren().addAll(
                    partySummaryLabel,
                    modeRow,
                    headerActions,
                    progressInputRow,
                    partyRowsPane,
                    summaryPane);
            syncProgressModeVisibility();
            refreshSummary();
            syncActionState();
        }

        private void showCalculation(CalculationContent content) {
            calculationContent = content == null ? CalculationContent.empty(parseNonNegativeInt(totalGroupXpField)) : content;
            suppressPublishedEvents = true;
            try {
                refreshSummary();
            } finally {
                suppressPublishedEvents = false;
            }
        }

        private void setActivePartySnapshot(List<Integer> levels) {
            List<Integer> sanitizedLevels = sanitizeLevels(levels);
            boolean changed = !sanitizedLevels.equals(activePartyLevels);
            activePartyRefreshFailed = false;
            activePartyLevels = sanitizedLevels;
            if (sourceMode == PartySourceMode.ACTIVE_PARTY) {
                activePartyChangedSinceCustomEdit = false;
                partyRowsPane.setLevels(activePartyLevels);
                refreshSummary();
                syncActionState();
                return;
            }
            activePartyChangedSinceCustomEdit = activePartyChangedSinceCustomEdit || changed;
            refreshSummary();
            syncActionState();
        }

        private void markActivePartyRefreshFailed() {
            activePartyRefreshFailed = true;
            refreshSummary();
            syncActionState();
        }

        private void refreshSummary() {
            List<Integer> levels = partyRowsPane.levels();
            String sourceLabel = sourceMode == PartySourceMode.CUSTOM ? "Eigene Gruppe" : "Aktive Party";
            if (sourceMode == PartySourceMode.ACTIVE_PARTY && activePartyRefreshFailed) {
                sourceLabel += activePartyLevels.isEmpty() ? " · Laden fehlgeschlagen" : " · Letzter Stand";
            } else if (sourceMode == PartySourceMode.CUSTOM && activePartyChangedSinceCustomEdit) {
                sourceLabel += " · Aktive Party geändert";
            }
            if (levels.isEmpty()) {
                partySummaryLabel.setText(sourceLabel);
                summaryPane.showEmptyState(progressModeButton.isSelected());
                syncActionState();
                return;
            }
            partySummaryLabel.setText(sourceLabel + ": " + levels.size() + " Charaktere");
            requestCalculation(levels, parseNonNegativeInt(totalGroupXpField));
            if (progressModeButton.isSelected()) {
                summaryPane.showProgress(calculationContent);
            } else {
                summaryPane.showBudget(calculationContent);
            }
            syncActionState();
        }

        private void requestCalculation(List<Integer> levels, int totalGroupXp) {
            if (suppressPublishedEvents) {
                return;
            }
            calculationContent = CalculationContent.empty(totalGroupXp);
            calculationRequestListener.onCalculationRequested(List.copyOf(levels), totalGroupXp);
        }

        private void syncActionState() {
            useActivePartyButton.setDisable(activePartyLevels.isEmpty());
            clearButton.setDisable(partyRowsPane.isEmpty());
        }

        private void syncProgressModeVisibility() {
            boolean progressMode = progressModeButton.isSelected();
            progressInputRow.setVisible(progressMode);
            progressInputRow.setManaged(progressMode);
        }

        private enum PartySourceMode {
            ACTIVE_PARTY,
            CUSTOM
        }
    }

    private static final class SummaryPane extends VBox {

        private final VBox summaryBox = new VBox(4);
        private final VBox timelineBox = new VBox(4);
        private final ScrollPane timelineScrollPane = new ScrollPane(timelineBox);
        private final Label timelineTitleLabel = new Label("Etappen");
        private final Label timelineEmptyLabel = new Label("Keine Etappen.");

        private SummaryPane() {
            addStyleClass(summaryBox, "entity-card");
            addStyleClass(timelineBox, "entity-card");
            addStyleClasses(timelineTitleLabel, "small", STYLE_TEXT_SECONDARY);
            addStyleClass(timelineEmptyLabel, STYLE_TEXT_MUTED);
            timelineScrollPane.setFitToWidth(true);
            timelineScrollPane.setHbarPolicy(ScrollPane.ScrollBarPolicy.NEVER);
            timelineScrollPane.setVbarPolicy(ScrollPane.ScrollBarPolicy.AS_NEEDED);
            timelineScrollPane.setPrefViewportHeight(240);
            addStyleClass(timelineScrollPane, "adventuring-day-timeline-scroll");
            getChildren().addAll(summaryBox, timelineScrollPane);
        }

        private void showEmptyState(boolean progressMode) {
            render(List.of(progressMode ? TOTAL_GROUP_XP_LABEL + ": 0 XP" : "Tag gesamt: 0 XP"), List.of());
        }

        private void showBudget(CalculationContent content) {
            CalculationContent safeContent = content == null ? CalculationContent.empty(0) : content;
            render(safeContent.budgetSummaryLines(), safeContent.budgetTimelineLines());
        }

        private void showProgress(CalculationContent content) {
            CalculationContent safeContent = content == null ? CalculationContent.empty(0) : content;
            render(safeContent.progressSummaryLines(), safeContent.progressTimelineLines());
        }

        private void render(List<String> summaryLines, List<String> timelineLines) {
            setChildren(summaryBox, labelsFor(summaryLines).toArray(Node[]::new));
            renderTimeline(timelineLines);
        }

        private void renderTimeline(List<String> timelineLines) {
            setChildren(timelineBox, timelineTitleLabel);
            if (timelineLines == null || timelineLines.isEmpty()) {
                addChild(timelineBox, timelineEmptyLabel);
                return;
            }
            addChildren(timelineBox, labelsFor(timelineLines));
        }

        private List<Label> labelsFor(List<String> lines) {
            if (lines == null || lines.isEmpty()) {
                return List.of();
            }
            return lines.stream()
                    .map(SummaryPane::wrapLabel)
                    .toList();
        }

        private static Label wrapLabel(String text) {
            Label label = new Label(text == null ? "" : text);
            label.setWrapText(true);
            return label;
        }
    }

    private static final class PartyRowsPane extends VBox {

        private final VBox rowsBox = new VBox(6);
        private final Label emptyLabel = new Label("Keine Charaktere.");
        private final Runnable onRowsChanged;
        private final List<RowControls> rows = new ArrayList<>();
        private boolean rebuilding;

        private PartyRowsPane(Runnable onRowsChanged) {
            this.onRowsChanged = onRowsChanged == null ? () -> { } : onRowsChanged;
            addStyleClass(emptyLabel, STYLE_TEXT_MUTED);
            addChild(rowsBox, emptyLabel);
            getChildren().addAll(buildHeader(), rowsBox);
        }

        private void setLevels(List<Integer> levels) {
            rebuilding = true;
            rows.clear();
            setChildren(rowsBox);
            Map<Integer, Integer> countsByLevel = new TreeMap<>();
            for (Integer level : sanitizeLevels(levels)) {
                countsByLevel.merge(level, 1, Integer::sum);
            }
            for (Map.Entry<Integer, Integer> entry : countsByLevel.entrySet()) {
                addRowInternal(entry.getKey(), entry.getValue());
            }
            rebuilding = false;
            updateEmptyState();
        }

        private void addDefaultRow() {
            addRowInternal(1, 1);
            updateEmptyState();
            onRowsChanged.run();
        }

        private boolean isEmpty() {
            return rows.isEmpty();
        }

        private List<Integer> levels() {
            List<Integer> levels = new ArrayList<>();
            for (RowControls row : rows) {
                for (int index = 0; index < row.count(); index++) {
                    levels.add(row.level());
                }
            }
            return levels;
        }

        private HBox buildHeader() {
            Label levelHeader = new Label("Level");
            Label countHeader = new Label("Anzahl");
            addStyleClass(levelHeader, STYLE_TEXT_MUTED);
            addStyleClass(countHeader, STYLE_TEXT_MUTED);
            levelHeader.setMinWidth(78);
            countHeader.setMinWidth(70);
            Region spacer = new Region();
            setAlwaysHgrow(spacer);
            HBox header = new HBox(8, levelHeader, countHeader, spacer);
            header.setAlignment(Pos.CENTER_LEFT);
            return header;
        }

        private void addRowInternal(int level, int count) {
            RowControls row = new RowControls(level, count);
            rows.add(row);
            addChild(rowsBox, row.root());
        }

        private void removeRow(RowControls row) {
            rows.remove(row);
            removeChild(rowsBox, row.root());
            updateEmptyState();
            onRowsChanged.run();
        }

        private void updateEmptyState() {
            if (rows.isEmpty()) {
                setChildren(rowsBox, emptyLabel);
                return;
            }
            removeChild(rowsBox, emptyLabel);
        }

        private void fireRowsChanged() {
            if (!rebuilding) {
                onRowsChanged.run();
            }
        }

        private final class RowControls {

            private final HBox root;
            private final ComboBox<Integer> levelCombo = new ComboBox<>();
            private final TextField countField = createIntegerField();
            private final Button removeButton = new Button("Entfernen");

            private RowControls(int level, int count) {
                addComboItems(levelCombo, levelOptions());
                levelCombo.setValue(Math.max(1, Math.min(20, level)));
                levelCombo.setMinWidth(78);
                levelCombo.valueProperty().addListener((ignored, before, after) -> fireRowsChanged());

                countField.setText(Integer.toString(Math.max(1, count)));
                countField.setPromptText("1");
                countField.setPrefColumnCount(4);
                countField.textProperty().addListener((ignored, before, after) -> fireRowsChanged());
                countField.focusedProperty().addListener((ignored, before, focused) -> {
                    if (!focused) {
                        normalizeCountField();
                    }
                });
                countField.setOnAction(event -> normalizeCountField());

                addStyleClass(removeButton, STYLE_COMPACT);
                removeButton.setOnAction(event -> removeRow(this));

                Region spacer = new Region();
                setAlwaysHgrow(spacer);
                root = new HBox(8, levelCombo, countField, spacer, removeButton);
                root.setAlignment(Pos.CENTER_LEFT);
            }

            private HBox root() {
                return root;
            }

            private int level() {
                Integer value = levelCombo.getValue();
                return value == null ? 1 : value;
            }

            private int count() {
                String raw = countField.getText();
                if (raw == null || raw.isBlank()) {
                    return 0;
                }
                try {
                    return Math.max(0, Integer.parseInt(raw));
                } catch (NumberFormatException exception) {
                    return 0;
                }
            }

            private void normalizeCountField() {
                int value = count();
                countField.setText(Integer.toString(value <= 0 ? 1 : value));
                fireRowsChanged();
            }
        }

    }

    @FunctionalInterface
    private interface CalculationRequestListener {
        void onCalculationRequested(List<Integer> levels, int totalGroupXp);
    }
}
