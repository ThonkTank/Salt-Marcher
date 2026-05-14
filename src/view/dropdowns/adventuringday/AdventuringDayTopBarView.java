package src.view.dropdowns.adventuringday;

import java.util.ArrayList;
import java.util.List;
import java.util.function.Consumer;
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
import javafx.scene.layout.HBox;
import javafx.scene.layout.Pane;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;
import src.view.slotcontent.primitives.dialog.DialogSurfaceContentModel;
import src.view.slotcontent.primitives.dialog.DialogSurfaceView;
import src.view.slotcontent.topbar.dropdown.DropdownPopupContentModel;
import src.view.slotcontent.topbar.dropdown.DropdownPopupView;

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

    private final DropdownPopupView popupView;
    private final CalculatorPane calculatorPane = new CalculatorPane(
            (useActivePartyRequested, addRowRequested, clearRequested) ->
                    publish(false, useActivePartyRequested, addRowRequested, clearRequested));
    private Consumer<AdventuringDayTopBarViewInputEvent> viewInputEventHandler = ignored -> { };

    AdventuringDayTopBarView(DropdownPopupContentModel popupContentModel) {
        setSpacing(8);
        setPadding(new Insets(4, 0, 4, 8));
        popupView = new DropdownPopupView(buildPanel());
        popupView.bind(popupContentModel);
        getChildren().add(popupView);
    }

    void showPanel(AdventuringDayTopBarContributionModel.PanelModel panelModel) {
        calculatorPane.show(panelModel == null
                ? new AdventuringDayTopBarContributionModel.PanelModel(
                        List.of(),
                        false,
                        "",
                        "Aktive Party",
                        true,
                        true,
                        AdventuringDayTopBarContributionModel.CalculationPresentation.empty(false, 0))
                : panelModel);
    }

    void onViewInputEvent(Consumer<AdventuringDayTopBarViewInputEvent> handler) {
        viewInputEventHandler = handler == null ? ignored -> { } : handler;
    }

    DropdownPopupView dropdownPopupView() {
        return popupView;
    }

    private DialogSurfaceView buildPanel() {
        Label headerLabel = new Label("ADVENTURING DAY");
        addStyleClass(headerLabel, "title-large");
        Button closeButton = new Button("×");
        addStyleClass(closeButton, STYLE_COMPACT);
        closeButton.setAccessibleText("Adventuring-Day-Rechner schliessen");
        closeButton.setOnAction(event -> publish(true, false, false, false));
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
        DialogSurfaceView dialog = new DialogSurfaceView(header, body, null);
        DialogSurfaceContentModel dialogContentModel = new DialogSurfaceContentModel();
        dialogContentModel.showLayout(DialogSurfaceContentModel.BodyPolicy.FIXED, true, false);
        dialog.bind(dialogContentModel);
        dialog.getStyleClass().addAll("party-panel", "adventuring-day-toolbar-popup");
        return dialog;
    }

    private void publish(
            boolean popupCloseRequested,
            boolean useActivePartyRequested,
            boolean addRowRequested,
            boolean clearRequested
    ) {
        List<AdventuringDayTopBarViewInputEvent.RowInput> rows = calculatorPane.snapshotRows();
        boolean progressModeSelected = calculatorPane.progressModeSelected();
        String totalGroupXpText = calculatorPane.totalGroupXpText();
        viewInputEventHandler.accept(new AdventuringDayTopBarViewInputEvent(
                popupCloseRequested,
                useActivePartyRequested,
                addRowRequested,
                clearRequested,
                progressModeSelected,
                totalGroupXpText,
                rows));
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

    private static final class CalculatorPane extends VBox {

        private final Label partySummaryLabel = new Label();
        private final Button useActivePartyButton = new Button("Aktive Party");
        private final Button addRowButton = new Button("Zeile");
        private final Button clearButton = new Button(CLEAR_LABEL);
        private final ToggleButton budgetModeButton = new ToggleButton("Budget");
        private final ToggleButton progressModeButton = new ToggleButton("XP -> Tage");
        private final TextField totalGroupXpField = createIntegerField();
        private final HBox progressInputRow;
        private final PartyRowsPane partyRowsPane = new PartyRowsPane(this::publishSnapshot);
        private final SummaryPane summaryPane = new SummaryPane();
        private final PanelEventPublisher eventPublisher;
        private int modelSyncDepth;

        private CalculatorPane(PanelEventPublisher eventPublisher) {
            this.eventPublisher = eventPublisher == null ? (useActivePartyRequested, addRowRequested, clearRequested) -> { }
                    : eventPublisher;
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
            totalGroupXpField.textProperty().addListener((ignored, before, after) -> publishSnapshot());
            Label totalGroupXpHint = new Label(TOTAL_GROUP_XP_HINT);
            addStyleClass(totalGroupXpHint, STYLE_TEXT_MUTED);
            progressInputRow = new HBox(8, totalGroupXpHint, totalGroupXpField);
            progressInputRow.setAlignment(Pos.CENTER_LEFT);

            useActivePartyButton.setOnAction(event -> eventPublisher.publish(true, false, false));
            addRowButton.setOnAction(event -> eventPublisher.publish(false, true, false));
            clearButton.setOnAction(event -> eventPublisher.publish(false, false, true));
            modeGroup.selectedToggleProperty().addListener((ignored, before, after) -> {
                publishSnapshot();
            });

            getChildren().addAll(
                    partySummaryLabel,
                    modeRow,
                    headerActions,
                    progressInputRow,
                    partyRowsPane,
                    summaryPane);
        }

        private void show(AdventuringDayTopBarContributionModel.PanelModel panelModel) {
            AdventuringDayTopBarContributionModel.PanelModel safePanelModel = panelModel == null
                    ? new AdventuringDayTopBarContributionModel.PanelModel(
                    List.of(),
                    false,
                    "",
                    "Aktive Party",
                    true,
                    true,
                    AdventuringDayTopBarContributionModel.CalculationPresentation.empty(false, 0))
                    : panelModel;
            try {
                modelSyncDepth++;
                partySummaryLabel.setText(safePanelModel.partySummaryText());
                budgetModeButton.setSelected(!safePanelModel.progressModeSelected());
                progressModeButton.setSelected(safePanelModel.progressModeSelected());
                progressInputRow.setVisible(safePanelModel.progressModeSelected());
                progressInputRow.setManaged(safePanelModel.progressModeSelected());
                totalGroupXpField.setText(safePanelModel.totalGroupXpText());
                useActivePartyButton.setDisable(safePanelModel.useActivePartyButtonDisabled());
                clearButton.setDisable(safePanelModel.clearButtonDisabled());
                partyRowsPane.showRows(safePanelModel.rows());
                summaryPane.show(safePanelModel.calculation());
            } finally {
                modelSyncDepth--;
            }
        }

        private boolean progressModeSelected() {
            return progressModeButton.isSelected();
        }

        private String totalGroupXpText() {
            return totalGroupXpField.getText();
        }

        private List<AdventuringDayTopBarViewInputEvent.RowInput> snapshotRows() {
            return partyRowsPane.snapshotRows();
        }

        private void publishSnapshot() {
            if (modelSyncDepth == 0) {
                eventPublisher.publish(false, false, false);
            }
        }
    }

    @FunctionalInterface
    private interface PanelEventPublisher {
        void publish(boolean useActivePartyRequested, boolean addRowRequested, boolean clearRequested);
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

        private void show(AdventuringDayTopBarContributionModel.CalculationPresentation calculationPresentation) {
            AdventuringDayTopBarContributionModel.CalculationPresentation safePresentation = calculationPresentation == null
                    ? AdventuringDayTopBarContributionModel.CalculationPresentation.empty(false, 0)
                    : calculationPresentation;
            render(safePresentation.summaryLines(), safePresentation.timelineLines());
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
        private boolean syncingRows;

        private PartyRowsPane(Runnable onRowsChanged) {
            this.onRowsChanged = onRowsChanged == null ? () -> { } : onRowsChanged;
            addStyleClass(emptyLabel, STYLE_TEXT_MUTED);
            addChild(rowsBox, emptyLabel);
            getChildren().addAll(buildHeader(), rowsBox);
        }

        private void showRows(List<AdventuringDayTopBarContributionModel.RowModel> rowModels) {
            syncingRows = true;
            rows.clear();
            setChildren(rowsBox);
            if (rowModels != null) {
                for (AdventuringDayTopBarContributionModel.RowModel rowModel : rowModels) {
                    if (rowModel != null) {
                        addRowInternal(rowModel.level(), rowModel.countText());
                    }
                }
            }
            syncingRows = false;
            updateEmptyState();
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

        private List<AdventuringDayTopBarViewInputEvent.RowInput> snapshotRows() {
            if (rows.isEmpty()) {
                return List.of();
            }
            List<AdventuringDayTopBarViewInputEvent.RowInput> snapshots = new ArrayList<>();
            for (RowControls row : rows) {
                snapshots.add(row.snapshot());
            }
            return List.copyOf(snapshots);
        }

        private void addRowInternal(int level, String countText) {
            RowControls row = new RowControls(level, countText);
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
            if (!syncingRows) {
                onRowsChanged.run();
            }
        }

        private final class RowControls {

            private final HBox root;
            private final ComboBox<Integer> levelCombo = new ComboBox<>();
            private final TextField countField = createIntegerField();
            private final Button removeButton = new Button("Entfernen");

            private RowControls(int level, String countText) {
                addComboItems(levelCombo, levelOptions());
                levelCombo.setValue(Math.max(1, Math.min(20, level)));
                levelCombo.setMinWidth(78);
                levelCombo.valueProperty().addListener((ignored, before, after) -> fireRowsChanged());

                countField.setText(countText == null ? "" : countText);
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

            private AdventuringDayTopBarViewInputEvent.RowInput snapshot() {
                return new AdventuringDayTopBarViewInputEvent.RowInput(
                        levelCombo.getValue(),
                        countField.getText());
            }

            private void normalizeCountField() {
                int value = parseNonNegativeInt(countField);
                countField.setText(Integer.toString(value <= 0 ? 1 : value));
                fireRowsChanged();
            }
        }

    }
}
