package src.view.dropdowns.adventuringday;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;
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
import javafx.scene.layout.HBox;
import javafx.scene.layout.Pane;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;

@SuppressWarnings({
        "PMD.CouplingBetweenObjects",
        "PMD.TooManyMethods"
})
public final class AdventuringDayTopBarView extends HBox {

    private static final String PMD_LOD = "PMD.LawOfDemeter";
    static final double POPUP_WIDTH = 420.0;
    private static final String CLEAR_LABEL = "Leeren";
    private static final String TOTAL_GROUP_XP_LABEL = "Gesamt-XP";
    private static final String TOTAL_GROUP_XP_HINT = TOTAL_GROUP_XP_LABEL + " für die Gruppe";
    private static final String STYLE_COMPACT = "compact";
    private static final String STYLE_TEXT_MUTED = "text-muted";
    private static final String STYLE_TEXT_SECONDARY = "text-secondary";
    static final String TOOLTIP_TEXT = "Adventuring-Day-Rechner öffnen";

    private final Label partySummaryLabel = new Label();
    private final Button useActivePartyButton = new Button("Aktive Party");
    private final Button addRowButton = new Button("Zeile");
    private final Button clearButton = new Button(CLEAR_LABEL);
    private final ToggleButton budgetModeButton = new ToggleButton("Budget");
    private final ToggleButton progressModeButton = new ToggleButton("XP -> Tage");
    private final TextField totalGroupXpField = createIntegerField();
    private final HBox progressInputRow;
    private final VBox rowsBox = new VBox(6);
    private final Label emptyRowsLabel = new Label("Keine Charaktere.");
    private final VBox summaryBox = new VBox(4);
    private final VBox timelineBox = new VBox(4);
    private final ScrollPane timelineScrollPane = new ScrollPane(timelineBox);
    private final Label timelineTitleLabel = new Label("Etappen");
    private final Label timelineEmptyLabel = new Label("Keine Etappen.");
    private Consumer<AdventuringDayTopBarViewInputEvent> viewInputEventHandler = ignored -> { };

    AdventuringDayTopBarView() {
        getStyleClass().add("adventuring-day-root");

        ToggleGroup modeGroup = new ToggleGroup();
        budgetModeButton.setToggleGroup(modeGroup);
        progressModeButton.setToggleGroup(modeGroup);
        budgetModeButton.setSelected(true);

        addStyleClass(partySummaryLabel, STYLE_TEXT_SECONDARY);
        addStyleClass(budgetModeButton, STYLE_COMPACT);
        addStyleClass(progressModeButton, STYLE_COMPACT);
        addStyleClass(useActivePartyButton, STYLE_COMPACT);
        addStyleClass(addRowButton, STYLE_COMPACT);
        addStyleClass(clearButton, STYLE_COMPACT);
        addStyleClass(emptyRowsLabel, STYLE_TEXT_MUTED);
        addStyleClass(summaryBox, "entity-card");
        addStyleClass(timelineBox, "entity-card");
        addStyleClasses(timelineTitleLabel, "small", STYLE_TEXT_SECONDARY);
        addStyleClass(timelineEmptyLabel, STYLE_TEXT_MUTED);
        addStyleClass(timelineScrollPane, "adventuring-day-timeline-scroll");

        Label totalGroupXpHint = new Label(TOTAL_GROUP_XP_HINT);
        totalGroupXpHint.setLabelFor(totalGroupXpField);
        totalGroupXpField.setPromptText(TOTAL_GROUP_XP_LABEL);
        totalGroupXpField.setAccessibleText(TOTAL_GROUP_XP_HINT);
        totalGroupXpField.setPrefColumnCount(10);
        addStyleClass(totalGroupXpHint, STYLE_TEXT_MUTED);
        progressInputRow = new HBox(8, totalGroupXpHint, totalGroupXpField);
        progressInputRow.setAlignment(Pos.CENTER_LEFT);

        timelineScrollPane.setFitToWidth(true);
        timelineScrollPane.setHbarPolicy(ScrollPane.ScrollBarPolicy.NEVER);
        timelineScrollPane.setVbarPolicy(ScrollPane.ScrollBarPolicy.AS_NEEDED);
        timelineScrollPane.setPrefViewportHeight(240);

        useActivePartyButton.setOnAction(event -> publish(false, true, false, false));
        addRowButton.setOnAction(event -> publish(false, false, true, false));
        clearButton.setOnAction(event -> publish(false, false, false, true));
        modeGroup.selectedToggleProperty().addListener((ignored, before, after) ->
                publish(false, false, false, false));
        totalGroupXpField.textProperty().addListener((ignored, before, after) ->
                publish(false, false, false, false));

        getChildren().add(buildPanel());
    }

    public void bind(AdventuringDayTopBarContentModel contentModel) {
        AdventuringDayTopBarContentModel safeModel = Objects.requireNonNull(contentModel, "contentModel");
        showPanel(safeModel.panelProperty().get());
        safeModel.panelProperty().addListener((ignored, before, after) -> showPanel(after));
    }

    void onViewInputEvent(Consumer<AdventuringDayTopBarViewInputEvent> handler) {
        viewInputEventHandler = handler == null ? ignored -> { } : handler;
    }

    private VBox buildPanel() {
        Label headerLabel = new Label("ADVENTURING DAY");
        addStyleClass(headerLabel, "title-large");
        Button closeButton = new Button("×");
        addStyleClass(closeButton, STYLE_COMPACT);
        closeButton.setAccessibleText("Adventuring-Day-Rechner schliessen");
        closeButton.setOnAction(event -> publish(true, false, false, false));

        Region headerSpacer = new Region();
        setAlwaysHgrow(headerSpacer);
        HBox header = new HBox(6, headerLabel, headerSpacer, closeButton);
        addStyleClass(header, "party-header");
        header.setAlignment(Pos.CENTER_LEFT);

        ScrollPane scrollPane = new ScrollPane(buildCalculator());
        scrollPane.setFitToWidth(true);
        scrollPane.setHbarPolicy(ScrollPane.ScrollBarPolicy.NEVER);
        scrollPane.setVbarPolicy(ScrollPane.ScrollBarPolicy.AS_NEEDED);
        scrollPane.setPrefViewportHeight(560);
        addStyleClass(scrollPane, "adventuring-day-scroll");

        VBox body = new VBox(scrollPane);
        addStyleClass(body, "adventuring-day-body");
        VBox panel = new VBox(header, body);
        addStyleClasses(panel, "party-panel", "adventuring-day-toolbar-popup");
        return panel;
    }

    private VBox buildCalculator() {
        HBox modeRow = new HBox(6, budgetModeButton, progressModeButton);
        HBox headerActions = new HBox(6, useActivePartyButton, addRowButton, clearButton);
        VBox partyRows = new VBox(buildRowsHeader(), rowsBox);
        VBox summary = new VBox(summaryBox, timelineScrollPane);
        VBox calculator = new VBox(
                partySummaryLabel,
                modeRow,
                headerActions,
                progressInputRow,
                partyRows,
                summary);
        addStyleClass(calculator, "adventuring-day-calculator");
        return calculator;
    }

    private HBox buildRowsHeader() {
        Label levelHeader = new Label("Level");
        Label countHeader = new Label("Anzahl");
        addStyleClass(levelHeader, STYLE_TEXT_MUTED);
        addStyleClass(countHeader, STYLE_TEXT_MUTED);
        addStyleClass(levelHeader, "adventuring-day-level-column");
        addStyleClass(countHeader, "adventuring-day-count-column");
        Region spacer = new Region();
        setAlwaysHgrow(spacer);
        HBox header = new HBox(8, levelHeader, countHeader, spacer);
        header.setAlignment(Pos.CENTER_LEFT);
        return header;
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
        totalGroupXpField.setText(panelModel.totalGroupXpText());
        useActivePartyButton.setDisable(panelModel.useActivePartyButtonDisabled());
        clearButton.setDisable(panelModel.clearButtonDisabled());
        showRows(panelModel.rows());
        showCalculation(panelModel.calculation());
    }

    private void showRows(List<AdventuringDayTopBarContentModel.RowModel> rowModels) {
        setChildren(rowsBox);
        if (rowModels != null) {
            for (AdventuringDayTopBarContentModel.RowModel rowModel : rowModels) {
                if (rowModel != null) {
                    addChild(rowsBox, buildRow(rowModel.level(), rowModel.countText()));
                }
            }
        }
        updateEmptyRowsState();
    }

    private HBox buildRow(int level, String countText) {
        ComboBox<Integer> levelCombo = new ComboBox<>();
        addComboItems(levelCombo, levelOptions());
        levelCombo.setValue(Math.max(1, Math.min(20, level)));
        levelCombo.setAccessibleText("Charakterlevel in dieser Adventuring-Day-Zeile");
        addStyleClass(levelCombo, "adventuring-day-level-column");

        TextField countField = createIntegerField();
        countField.setText(countText == null ? "" : countText);
        countField.setPromptText("1");
        countField.setAccessibleText("Anzahl Charaktere fuer Level " + levelCombo.getValue());
        countField.setPrefColumnCount(4);

        Button removeButton = new Button("Entfernen");
        addStyleClass(removeButton, STYLE_COMPACT);
        removeButton.setAccessibleText("Adventuring-Day-Zeile entfernen");

        Region spacer = new Region();
        setAlwaysHgrow(spacer);
        HBox row = new HBox(8, levelCombo, countField, spacer, removeButton);
        row.setAlignment(Pos.CENTER_LEFT);

        levelCombo.valueProperty().addListener((ignored, before, after) -> publish(false, false, false, false));
        countField.textProperty().addListener((ignored, before, after) -> publish(false, false, false, false));
        countField.focusedProperty().addListener((ignored, before, focused) -> {
            if (!focused) {
                normalizeCountField(countField);
            }
        });
        countField.setOnAction(event -> normalizeCountField(countField));
        removeButton.setOnAction(event -> {
            removeChild(rowsBox, row);
            updateEmptyRowsState();
            publish(false, false, false, false);
        });
        return row;
    }

    private void updateEmptyRowsState() {
        if (rowsBox.getChildren().isEmpty()) {
            setChildren(rowsBox, emptyRowsLabel);
            return;
        }
        removeChild(rowsBox, emptyRowsLabel);
    }

    private void showCalculation(AdventuringDayTopBarContentModel.CalculationPresentation calculationPresentation) {
        if (calculationPresentation == null) {
            setChildren(summaryBox);
            setChildren(timelineBox, timelineTitleLabel, timelineEmptyLabel);
            return;
        }
        setChildren(summaryBox, labelsFor(calculationPresentation.summaryLines()).toArray(Node[]::new));
        setChildren(timelineBox, timelineTitleLabel);
        List<Label> timelineLabels = labelsFor(calculationPresentation.timelineLines());
        if (timelineLabels.isEmpty()) {
            addChild(timelineBox, timelineEmptyLabel);
            return;
        }
        addChildren(timelineBox, timelineLabels);
    }

    private List<Label> labelsFor(List<String> lines) {
        if (lines == null || lines.isEmpty()) {
            return List.of();
        }
        List<Label> labels = new ArrayList<>();
        for (String line : lines) {
            labels.add(wrapLabel(line));
        }
        return List.copyOf(labels);
    }

    private static Label wrapLabel(String text) {
        Label label = new Label(text == null ? "" : text);
        label.setWrapText(true);
        return label;
    }

    private void publish(
            boolean popupCloseRequested,
            boolean useActivePartyRequested,
            boolean addRowRequested,
            boolean clearRequested
    ) {
        List<AdventuringDayTopBarViewInputEvent.RowInput> snapshots = new ArrayList<>();
        for (Node rowNode : rowsBox.getChildren()) {
            if (rowNode instanceof HBox row) {
                snapshots.add(snapshotRow(row));
            }
        }
        viewInputEventHandler.accept(new AdventuringDayTopBarViewInputEvent(
                popupCloseRequested,
                useActivePartyRequested,
                addRowRequested,
                clearRequested,
                progressModeButton.isSelected(),
                totalGroupXpField.getText(),
                List.copyOf(snapshots)));
    }

    private AdventuringDayTopBarViewInputEvent.RowInput snapshotRow(HBox row) {
        Integer level = null;
        String countText = "";
        if (!row.getChildren().isEmpty() && row.getChildren().get(0) instanceof ComboBox<?> levelCombo) {
            Object value = levelCombo.getValue();
            if (value instanceof Integer integerValue) {
                level = integerValue;
            }
        }
        if (row.getChildren().size() > 1 && row.getChildren().get(1) instanceof TextField countField) {
            countText = countField.getText();
        }
        return new AdventuringDayTopBarViewInputEvent.RowInput(level, countText);
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

    private static void normalizeCountField(TextField field) {
        int value = parseNonNegativeInt(field.getText());
        field.setText(Integer.toString(value <= 0 ? 1 : value));
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

    private static List<Integer> levelOptions() {
        List<Integer> values = new ArrayList<>(20);
        for (int level = 1; level <= 20; level++) {
            values.add(level);
        }
        return values;
    }
}
