package src.view.dropdowns.adventuringday;

import java.util.ArrayList;
import java.util.List;
import java.util.function.Consumer;
import javafx.geometry.Pos;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.ComboBox;
import javafx.scene.control.Label;
import javafx.scene.control.ScrollPane;
import javafx.scene.control.TextField;
import javafx.scene.control.ToggleButton;
import javafx.scene.layout.HBox;
import javafx.scene.layout.VBox;

public final class AdventuringDayTopBarView extends HBox {

    static final double POPUP_WIDTH = 420.0;
    static final String TOOLTIP_TEXT = "Adventuring-Day-Rechner öffnen";
    private static final String CLEAR_LABEL = "Leeren";
    private static final String TOTAL_GROUP_XP_LABEL = "Gesamt-XP";
    private static final String TOTAL_GROUP_XP_HINT = TOTAL_GROUP_XP_LABEL + " für die Gruppe";
    private static final String STYLE_COMPACT = "compact";
    private static final String STYLE_TEXT_MUTED = "text-muted";
    private static final String STYLE_TEXT_SECONDARY = "text-secondary";

    private final Label partySummaryLabel = AdventuringDayViewChrome.label("", STYLE_TEXT_SECONDARY);
    private final Button useActivePartyButton = AdventuringDayViewChrome.button("Aktive Party", STYLE_COMPACT);
    private final Button addRowButton = AdventuringDayViewChrome.button("Zeile", STYLE_COMPACT);
    private final Button clearButton = AdventuringDayViewChrome.button(CLEAR_LABEL, STYLE_COMPACT);
    private final ToggleButton budgetModeButton = AdventuringDayViewChrome.toggleButton("Budget", STYLE_COMPACT);
    private final ToggleButton progressModeButton = AdventuringDayViewChrome.toggleButton("XP -> Tage", STYLE_COMPACT);
    private final TextField totalGroupXpField = AdventuringDayViewChrome.integerField(
            TOTAL_GROUP_XP_LABEL,
            TOTAL_GROUP_XP_HINT,
            10);
    private final HBox progressInputRow = AdventuringDayViewChrome.progressInputRow(totalGroupXpField);
    private final VBox rowsBox = AdventuringDayViewChrome.rowsBox();
    private final Label emptyRowsLabel = AdventuringDayViewChrome.label("Keine Charaktere.", STYLE_TEXT_MUTED);
    private final VBox summaryBox = AdventuringDayViewChrome.nodeBox(4, "entity-card");
    private final VBox timelineBox = AdventuringDayViewChrome.nodeBox(4, "entity-card");
    private final Label timelineTitleLabel = AdventuringDayViewChrome.label("Etappen", "small", STYLE_TEXT_SECONDARY);
    private final Label timelineEmptyLabel = AdventuringDayViewChrome.label("Keine Etappen.", STYLE_TEXT_MUTED);
    private final CalculationPresenter calculationPresenter = new CalculationPresenter();
    private final RowsPresenter rowsPresenter = new RowsPresenter();
    private Consumer<AdventuringDayTopBarViewInputEvent> viewInputEventHandler = ignored -> { };

    AdventuringDayTopBarView() {
        getStyleClass().add("adventuring-day-root");
        configureControls();
        getChildren().add(buildPanel());
    }

    public void bind(AdventuringDayTopBarContentModel contentModel) {
        if (contentModel == null) {
            throw new NullPointerException("contentModel");
        }
        showPanel(contentModel.panelProperty().get());
        contentModel.panelProperty().addListener((ignored, before, after) -> showPanel(after));
    }

    void onViewInputEvent(Consumer<AdventuringDayTopBarViewInputEvent> handler) {
        viewInputEventHandler = handler == null ? ignored -> { } : handler;
    }

    private VBox buildPanel() {
        Label headerLabel = AdventuringDayViewChrome.label("ADVENTURING DAY", "title-large");
        Button closeButton = AdventuringDayViewChrome.button("×", STYLE_COMPACT);
        closeButton.setAccessibleText("Adventuring-Day-Rechner schliessen");
        closeButton.setOnAction(event -> publish(true, false, false, false));

        HBox header = new HBox(6, headerLabel, closeButton);
        header.getStyleClass().add("party-header");
        header.setAlignment(Pos.CENTER_LEFT);

        ScrollPane scrollPane = AdventuringDayViewChrome.scrollPane(
                buildCalculator(),
                560,
                "adventuring-day-scroll");
        VBox body = new VBox(scrollPane);
        body.getStyleClass().add("adventuring-day-body");

        VBox panel = new VBox(header, body);
        panel.getStyleClass().addAll("party-panel", "adventuring-day-toolbar-popup");
        return panel;
    }

    private VBox buildCalculator() {
        HBox modeRow = new HBox(6, budgetModeButton, progressModeButton);
        HBox headerActions = new HBox(6, useActivePartyButton, addRowButton, clearButton);
        VBox partyRows = new VBox(AdventuringDayViewChrome.rowsHeader(), rowsBox);
        ScrollPane timelineScrollPane = AdventuringDayViewChrome.scrollPane(
                timelineBox,
                240,
                "adventuring-day-timeline-scroll");
        VBox summary = new VBox(summaryBox, timelineScrollPane);
        VBox calculator = new VBox(partySummaryLabel, modeRow, headerActions, progressInputRow, partyRows, summary);
        calculator.getStyleClass().add("adventuring-day-calculator");
        return calculator;
    }

    private void configureControls() {
        budgetModeButton.setSelected(true);
        budgetModeButton.setOnAction(event -> selectMode(false));
        progressModeButton.setOnAction(event -> selectMode(true));
        useActivePartyButton.setOnAction(event -> publish(false, true, false, false));
        addRowButton.setOnAction(event -> publish(false, false, true, false));
        clearButton.setOnAction(event -> publish(false, false, false, true));
        totalGroupXpField.textProperty().addListener((ignored, before, after) -> {
            if (!digitsOnly(after)) {
                totalGroupXpField.setText(before == null ? "" : before);
                return;
            }
            publish(false, false, false, false);
        });
    }

    private void selectMode(boolean progressSelected) {
        budgetModeButton.setSelected(!progressSelected);
        progressModeButton.setSelected(progressSelected);
        publish(false, false, false, false);
    }

    private void showPanel(AdventuringDayTopBarContentModel.PanelModel panelModel) {
        if (panelModel == null) {
            return;
        }
        partySummaryLabel.setText(panelModel.partySummaryText());
        budgetModeButton.setSelected(!panelModel.progressModeSelected());
        progressModeButton.setSelected(panelModel.progressModeSelected());
        progressInputRow.setVisible(panelModel.progressModeSelected());
        progressInputRow.setManaged(panelModel.progressModeSelected());
        setTextIfChanged(totalGroupXpField, panelModel.totalGroupXpText());
        useActivePartyButton.setDisable(panelModel.useActivePartyButtonDisabled());
        clearButton.setDisable(panelModel.clearButtonDisabled());
        rowsPresenter.showRows(panelModel.rows());
        calculationPresenter.showCalculation(panelModel.calculation());
    }

    private void publish(
            boolean popupCloseRequested,
            boolean useActivePartyRequested,
            boolean addRowRequested,
            boolean clearRequested
    ) {
        viewInputEventHandler.accept(new AdventuringDayTopBarViewInputEvent(
                popupCloseRequested,
                useActivePartyRequested,
                addRowRequested,
                clearRequested,
                progressModeButton.isSelected(),
                totalGroupXpField.getText(),
                rowsPresenter.rawRowInputs()));
    }

    private static boolean digitsOnly(String text) {
        return text == null || text.matches("[0-9]*");
    }

    private static void setTextIfChanged(TextField field, String text) {
        String safeText = text == null ? "" : text;
        if (!field.isFocused() && !safeText.equals(field.getText())) {
            field.setText(safeText);
        }
    }

    private final class CalculationPresenter {

        private void showCalculation(AdventuringDayTopBarContentModel.CalculationPresentation calculationPresentation) {
            if (calculationPresentation == null) {
                summaryBox.getChildren().clear();
                timelineBox.getChildren().setAll(timelineTitleLabel, timelineEmptyLabel);
                return;
            }
            summaryBox.getChildren().setAll(AdventuringDayViewChrome.labelsFor(calculationPresentation.summaryLines()));
            timelineBox.getChildren().setAll(timelineTitleLabel);
            List<Label> timelineLabels = AdventuringDayViewChrome.labelsFor(calculationPresentation.timelineLines());
            if (timelineLabels.isEmpty()) {
                timelineBox.getChildren().add(timelineEmptyLabel);
                return;
            }
            timelineBox.getChildren().addAll(timelineLabels);
        }
    }

    private final class RowsPresenter {

        private void showRows(List<AdventuringDayTopBarContentModel.RowModel> rowModels) {
            List<AdventuringDayTopBarContentModel.RowModel> safeRows = safeRows(rowModels);
            if (safeRows.isEmpty()) {
                rowsBox.getChildren().setAll(emptyRowsLabel);
                return;
            }
            List<AdventuringDayRow> currentRows = currentRows();
            if (currentRows.size() != safeRows.size()) {
                rowsBox.getChildren().setAll(buildRows(safeRows));
                return;
            }
            for (int index = 0; index < safeRows.size(); index++) {
                currentRows.get(index).showRow(safeRows.get(index));
            }
        }

        private List<AdventuringDayTopBarViewInputEvent.RowInput> rawRowInputs() {
            List<AdventuringDayTopBarViewInputEvent.RowInput> rowInputs = new ArrayList<>();
            for (Node child : rowsBox.getChildren()) {
                if (child instanceof AdventuringDayRow row) {
                    rowInputs.add(new AdventuringDayTopBarViewInputEvent.RowInput(
                            row.levelSelector.getValue(),
                            row.countField.getText()));
                }
            }
            return List.copyOf(rowInputs);
        }

        private void removeRow(AdventuringDayRow row) {
            rowsBox.getChildren().remove(row);
            if (rowsBox.getChildren().isEmpty()) {
                rowsBox.getChildren().setAll(emptyRowsLabel);
            }
            publish(false, false, false, false);
        }

        private void publishRefresh() {
            publish(false, false, false, false);
        }

        private List<AdventuringDayTopBarContentModel.RowModel> safeRows(
                List<AdventuringDayTopBarContentModel.RowModel> rowModels
        ) {
            if (rowModels == null || rowModels.isEmpty()) {
                return List.of();
            }
            List<AdventuringDayTopBarContentModel.RowModel> safeRows = new ArrayList<>();
            for (AdventuringDayTopBarContentModel.RowModel rowModel : rowModels) {
                if (rowModel != null) {
                    safeRows.add(rowModel);
                }
            }
            return List.copyOf(safeRows);
        }

        private List<AdventuringDayRow> currentRows() {
            List<AdventuringDayRow> currentRows = new ArrayList<>();
            for (Node child : rowsBox.getChildren()) {
                if (child instanceof AdventuringDayRow row) {
                    currentRows.add(row);
                }
            }
            return List.copyOf(currentRows);
        }

        private List<AdventuringDayRow> buildRows(List<AdventuringDayTopBarContentModel.RowModel> rowModels) {
            List<AdventuringDayRow> rows = new ArrayList<>();
            for (AdventuringDayTopBarContentModel.RowModel rowModel : rowModels) {
                rows.add(new AdventuringDayRow(rowModel, this::removeRow, this::publishRefresh));
            }
            return List.copyOf(rows);
        }
    }

    private static final class AdventuringDayRow extends HBox {

        private final ComboBox<Integer> levelSelector = new ComboBox<>();
        private final TextField countField = new TextField();

        private AdventuringDayRow(
                AdventuringDayTopBarContentModel.RowModel rowModel,
                Consumer<AdventuringDayRow> removeHandler,
                Runnable publisher
        ) {
            super(8);
            configureLevelSelector(rowModel.level());
            configureCountField(rowModel);
            Button removeButton = AdventuringDayViewChrome.button("Entfernen", "compact");
            removeButton.setAccessibleText("Adventuring-Day-Zeile entfernen");
            getChildren().addAll(levelSelector, countField, removeButton);
            setAlignment(Pos.CENTER_LEFT);
            levelSelector.valueProperty().addListener((ignored, before, after) ->
                    publisher.run());
            countField.textProperty().addListener((ignored, before, after) ->
                    refreshWhenDigits(before, after, publisher));
            countField.focusedProperty().addListener((ignored, before, focused) -> {
                if (!focused) {
                    normalizeCountField();
                }
            });
            countField.setOnAction(event -> normalizeCountField());
            removeButton.setOnAction(event -> removeHandler.accept(this));
        }

        private void showRow(AdventuringDayTopBarContentModel.RowModel rowModel) {
            int nextLevel = clampLevel(rowModel.level());
            if (!Integer.valueOf(nextLevel).equals(levelSelector.getValue())) {
                levelSelector.setValue(nextLevel);
            }
            setTextIfChanged(countField, rowModel.countText());
            countField.setAccessibleText("Anzahl Charaktere fuer Level " + nextLevel);
        }

        private void refreshWhenDigits(
                String before,
                String after,
                Runnable publisher
        ) {
            if (!digitsOnly(after)) {
                countField.setText(before == null ? "" : before);
                return;
            }
            publisher.run();
        }

        private void configureLevelSelector(int selectedLevel) {
            levelSelector.getItems().addAll(levelOptions());
            levelSelector.setValue(clampLevel(selectedLevel));
            levelSelector.setAccessibleText("Charakterlevel in dieser Adventuring-Day-Zeile");
            levelSelector.getStyleClass().add("adventuring-day-level-column");
        }

        private void configureCountField(AdventuringDayTopBarContentModel.RowModel rowModel) {
            countField.setText(rowModel.countText());
            countField.setPromptText("1");
            countField.setAccessibleText("Anzahl Charaktere fuer Level " + levelSelector.getValue());
            countField.setPrefColumnCount(4);
        }

        private void normalizeCountField() {
            int value = parseNonNegativeInt(countField.getText());
            countField.setText(Integer.toString(value <= 0 ? 1 : value));
        }

        private static int parseNonNegativeInt(String raw) {
            if (raw == null || raw.isBlank()) {
                return 0;
            }
            try {
                return Math.max(0, Integer.parseInt(raw));
            } catch (NumberFormatException exception) {
                return 0;
            }
        }

        private static int clampLevel(int level) {
            return Math.max(1, Math.min(20, level));
        }

        private static List<Integer> levelOptions() {
            List<Integer> values = new ArrayList<>(20);
            for (int level = 1; level <= 20; level++) {
                values.add(level);
            }
            return values;
        }
    }

    private static final class AdventuringDayViewChrome {

        private static HBox rowsHeader() {
            Label levelHeader = label("Level", STYLE_TEXT_MUTED, "adventuring-day-level-column");
            Label countHeader = label("Anzahl", STYLE_TEXT_MUTED, "adventuring-day-count-column");
            HBox header = new HBox(8, levelHeader, countHeader);
            header.setAlignment(Pos.CENTER_LEFT);
            return header;
        }

        private static HBox progressInputRow(TextField field) {
            Label totalGroupXpHint = label(TOTAL_GROUP_XP_HINT, STYLE_TEXT_MUTED);
            totalGroupXpHint.setLabelFor(field);
            HBox row = new HBox(8, totalGroupXpHint, field);
            row.setAlignment(Pos.CENTER_LEFT);
            return row;
        }

        private static List<Label> labelsFor(List<String> lines) {
            if (lines == null || lines.isEmpty()) {
                return List.of();
            }
            List<Label> labels = new ArrayList<>();
            for (String line : lines) {
                labels.add(label(line));
            }
            return List.copyOf(labels);
        }

        private static VBox rowsBox() {
            return new VBox(6);
        }

        private static VBox nodeBox(double spacing, String styleClass) {
            VBox box = new VBox(spacing);
            box.getStyleClass().add(styleClass);
            return box;
        }

        private static Label label(String text, String... styleClasses) {
            Label label = new Label(text == null ? "" : text);
            label.setWrapText(true);
            label.getStyleClass().addAll(styleClasses);
            return label;
        }

        private static Button button(String text, String... styleClasses) {
            Button button = new Button(text);
            button.getStyleClass().addAll(styleClasses);
            return button;
        }

        private static ToggleButton toggleButton(String text, String... styleClasses) {
            ToggleButton button = new ToggleButton(text);
            button.getStyleClass().addAll(styleClasses);
            return button;
        }

        private static TextField integerField(String promptText, String accessibleText, int prefColumnCount) {
            TextField field = new TextField();
            field.setPromptText(promptText);
            field.setAccessibleText(accessibleText);
            field.setPrefColumnCount(prefColumnCount);
            return field;
        }

        private static ScrollPane scrollPane(VBox content, double prefViewportHeight, String styleClass) {
            ScrollPane scrollPane = new ScrollPane(content);
            scrollPane.setFitToWidth(true);
            scrollPane.setHbarPolicy(ScrollPane.ScrollBarPolicy.NEVER);
            scrollPane.setVbarPolicy(ScrollPane.ScrollBarPolicy.AS_NEEDED);
            scrollPane.setPrefViewportHeight(prefViewportHeight);
            scrollPane.getStyleClass().add(styleClass);
            return scrollPane;
        }
    }
}
