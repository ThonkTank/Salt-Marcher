package src.view.leftbartabs.catalog;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;
import javafx.beans.property.ReadOnlyObjectWrapper;
import javafx.beans.property.SimpleStringProperty;
import javafx.collections.ListChangeListener;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.control.Button;
import javafx.scene.control.ComboBox;
import javafx.scene.control.Label;
import javafx.scene.control.SelectionMode;
import javafx.scene.control.SingleSelectionModel;
import javafx.scene.control.TableCell;
import javafx.scene.control.TableColumn;
import javafx.scene.control.TableView;
import javafx.scene.control.Tooltip;
import javafx.scene.input.KeyCode;
import javafx.scene.layout.BorderPane;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;

public final class CatalogMainView extends BorderPane {

    private static final int FIRST_COLUMN_INDEX = 0;
    private static final int PREVIOUS_PAGE_SHIFT = -1;
    private static final int NEXT_PAGE_SHIFT = 1;
    private static final int NO_PAGE_SHIFT = 0;
    private static final long NO_CREATURE_ID = 0L;
    private static final String EMPTY_SORT_KEY = "";
    private static final String ACTION_LABEL = "+Add";
    private static final String ACTION_TOOLTIP = "Zum Encounter hinzufügen";
    private static final String CREATURE_ACCESSIBLE_TEXT_PREFIX = "Stat Block: ";
    private static final String ACTION_ACCESSIBLE_TEXT_PREFIX = ACTION_LABEL + ": ";
    private static final String COLUMN_KEY_CHALLENGE_RATING = "cr";
    private static final String COLUMN_KEY_TYPE = "type";
    private static final String COLUMN_KEY_SIZE = "size";
    private static final String COLUMN_KEY_XP = "xp";

    private final TableView<CatalogContributionModel.CatalogRow> table = new TableView<>();
    private final Label placeholder = new Label("Lade Monster...");
    private final Label countLabel = new Label("0 Monster gefunden");
    private final Label pageLabel = new Label("Seite 1 / 1");
    private final Button previousButton = new Button("◀ Zurück");
    private final Button nextButton = new Button("Weiter ▶");
    private final ComboBox<CatalogContributionModel.KeyLabel> sortCombo = new ComboBox<>();
    private final TableView.TableViewSelectionModel<CatalogContributionModel.CatalogRow> tableSelectionModel =
            table.getSelectionModel();
    private final SingleSelectionModel<CatalogContributionModel.KeyLabel> sortSelectionModel =
            sortCombo.getSelectionModel();
    private Consumer<CatalogMainViewInputEvent> viewInputEventHandler = ignored -> { };
    private boolean suppressSortEvents;

    public CatalogMainView() {
        getStyleClass().add("surface-root");
        setPadding(new Insets(8));

        HBox topBar = new HBox(8);
        topBar.setAlignment(Pos.CENTER_LEFT);
        topBar.setPadding(new Insets(0, 0, 6, 0));
        countLabel.getStyleClass().add("text-secondary");
        pageLabel.getStyleClass().add("text-secondary");
        Region spacer = new Region();
        HBox.setHgrow(spacer, Priority.ALWAYS);
        Label sortLabel = new Label("Sortierung:");
        sortLabel.getStyleClass().add("text-muted");
        sortCombo.setOnAction(event -> {
            CatalogContributionModel.KeyLabel selection = sortSelectionModel.getSelectedItem();
            if (!suppressSortEvents && selection != null) {
                viewInputEventHandler.accept(new CatalogMainViewInputEvent(
                        selection.key(),
                        NO_CREATURE_ID,
                        NO_CREATURE_ID,
                        NO_PAGE_SHIFT));
            }
        });
        topBar.getChildren().addAll(countLabel, spacer, sortLabel, sortCombo);
        setTop(topBar);

        table.setColumnResizePolicy(TableView.CONSTRAINED_RESIZE_POLICY);
        tableSelectionModel.setSelectionMode(SelectionMode.SINGLE);
        table.setPlaceholder(placeholder);
        table.setOnKeyPressed(event -> {
            if (event.getCode() != KeyCode.ENTER) {
                return;
            }
            CatalogContributionModel.CatalogRow selectedRow = tableSelectionModel.getSelectedItem();
            if (selectedRow == null) {
                return;
            }
            viewInputEventHandler.accept(event.isShiftDown()
                    ? new CatalogMainViewInputEvent(EMPTY_SORT_KEY, NO_CREATURE_ID, selectedRow.id(), NO_PAGE_SHIFT)
                    : new CatalogMainViewInputEvent(EMPTY_SORT_KEY, selectedRow.id(), NO_CREATURE_ID, NO_PAGE_SHIFT));
            event.consume();
        });
        setCenter(table);

        previousButton.setOnAction(event -> viewInputEventHandler.accept(new CatalogMainViewInputEvent(
                EMPTY_SORT_KEY,
                NO_CREATURE_ID,
                NO_CREATURE_ID,
                PREVIOUS_PAGE_SHIFT)));
        nextButton.setOnAction(event -> viewInputEventHandler.accept(new CatalogMainViewInputEvent(
                EMPTY_SORT_KEY,
                NO_CREATURE_ID,
                NO_CREATURE_ID,
                NEXT_PAGE_SHIFT)));
        HBox pagination = new HBox(8, previousButton, pageLabel, nextButton);
        pagination.setAlignment(Pos.CENTER);
        pagination.setPadding(new Insets(6, 0, 0, 0));
        setBottom(pagination);
    }

    public void bind(CatalogContributionModel contributionModel) {
        if (contributionModel == null) {
            return;
        }
        countLabel.textProperty().bind(contributionModel.countLabelProperty());
        pageLabel.textProperty().bind(contributionModel.pageLabelProperty());
        placeholder.textProperty().bind(contributionModel.placeholderTextProperty());
        previousButton.disableProperty().bind(contributionModel.previousPageAvailableProperty().not());
        nextButton.disableProperty().bind(contributionModel.nextPageAvailableProperty().not());
        sortCombo.setItems(contributionModel.sortOptionsProperty());
        table.setItems(contributionModel.rowsProperty());
        contributionModel.columnsProperty().addListener(
                (ListChangeListener<CatalogContributionModel.KeyLabel>) change ->
                        refreshColumns(contributionModel.columnsProperty()));
        contributionModel.selectedSortKeyProperty().addListener((obs, before, after) -> selectSortKey(after));
        refreshColumns(contributionModel.columnsProperty());
        selectSortKey(contributionModel.selectedSortKeyProperty().get());
    }

    public void onViewInputEvent(Consumer<CatalogMainViewInputEvent> handler) {
        viewInputEventHandler = handler == null ? ignored -> { } : handler;
    }

    private void refreshColumns(List<CatalogContributionModel.KeyLabel> columns) {
        List<CatalogContributionModel.KeyLabel> safeColumns = columns == null ? List.of() : List.copyOf(columns);
        List<TableColumn<CatalogContributionModel.CatalogRow, ?>> configuredColumns =
                new ArrayList<>(safeColumns.size() + 1);
        for (int index = 0; index < safeColumns.size(); index++) {
            configuredColumns.add(createColumn(safeColumns.get(index), index));
        }
        configuredColumns.add(createActionColumn());
        table.getColumns().setAll(configuredColumns);
    }

    private TableColumn<CatalogContributionModel.CatalogRow, ?> createColumn(
            CatalogContributionModel.KeyLabel column,
            int index
    ) {
        return index == FIRST_COLUMN_INDEX ? createLinkColumn(column) : createTextColumn(column, index);
    }

    private TableColumn<CatalogContributionModel.CatalogRow, String> createTextColumn(
            CatalogContributionModel.KeyLabel column,
            int index
    ) {
        TableColumn<CatalogContributionModel.CatalogRow, String> textColumn = new TableColumn<>(column.label());
        textColumn.setCellValueFactory(data -> {
            CatalogContributionModel.CatalogRow row = data.getValue();
            return new SimpleStringProperty(row == null ? "" : row.cell(index));
        });
        double minWidth = 70;
        double prefWidth = 110;
        double maxWidth = Double.NaN;
        switch (column.key()) {
            case COLUMN_KEY_CHALLENGE_RATING -> {
                minWidth = 40;
                prefWidth = 50;
                maxWidth = 60;
            }
            case COLUMN_KEY_TYPE -> {
                minWidth = 80;
                prefWidth = 110;
                maxWidth = 150;
            }
            case COLUMN_KEY_SIZE -> {
                minWidth = 65;
                prefWidth = 85;
                maxWidth = 100;
            }
            case COLUMN_KEY_XP -> {
                minWidth = 45;
                prefWidth = 60;
                maxWidth = 75;
            }
            default -> {
            }
        }
        textColumn.setMinWidth(minWidth);
        textColumn.setPrefWidth(prefWidth);
        if (!Double.isNaN(maxWidth)) {
            textColumn.setMaxWidth(maxWidth);
        }
        return textColumn;
    }

    private TableColumn<CatalogContributionModel.CatalogRow, CatalogContributionModel.CatalogRow> createLinkColumn(
            CatalogContributionModel.KeyLabel column
    ) {
        TableColumn<CatalogContributionModel.CatalogRow, CatalogContributionModel.CatalogRow> linkColumn =
                new TableColumn<>(column.label());
        linkColumn.setMinWidth(120);
        linkColumn.setPrefWidth(200);
        linkColumn.setCellValueFactory(data -> new ReadOnlyObjectWrapper<>(data.getValue()));
        linkColumn.setCellFactory(ignored -> new LinkCell(row ->
                viewInputEventHandler.accept(new CatalogMainViewInputEvent(
                        EMPTY_SORT_KEY,
                        row.id(),
                        NO_CREATURE_ID,
                        NO_PAGE_SHIFT))));
        return linkColumn;
    }

    private TableColumn<CatalogContributionModel.CatalogRow, CatalogContributionModel.CatalogRow> createActionColumn() {
        TableColumn<CatalogContributionModel.CatalogRow, CatalogContributionModel.CatalogRow> column =
                new TableColumn<>("");
        column.setMinWidth(55);
        column.setPrefWidth(65);
        column.setMaxWidth(75);
        column.setSortable(false);
        column.setCellValueFactory(data -> new ReadOnlyObjectWrapper<>(data.getValue()));
        column.setCellFactory(ignored -> new ActionCell(row ->
                viewInputEventHandler.accept(new CatalogMainViewInputEvent(
                        EMPTY_SORT_KEY,
                        NO_CREATURE_ID,
                        row.id(),
                        NO_PAGE_SHIFT))));
        return column;
    }

    private void selectSortKey(String key) {
        suppressSortEvents = true;
        try {
            for (CatalogContributionModel.KeyLabel selection : sortCombo.getItems()) {
                if (Objects.equals(selection.key(), key)) {
                    sortSelectionModel.select(selection);
                    return;
                }
            }
        } finally {
            suppressSortEvents = false;
        }
    }

    private static final class LinkCell extends TableCell<CatalogContributionModel.CatalogRow, CatalogContributionModel.CatalogRow> {

        private final Button button = new Button();

        LinkCell(Consumer<CatalogContributionModel.CatalogRow> openAction) {
            button.getStyleClass().addAll("creature-link", "flat");
            button.setOnAction(event -> {
                CatalogContributionModel.CatalogRow row = getItem();
                if (row != null) {
                    openAction.accept(row);
                }
            });
        }

        @Override
        protected void updateItem(CatalogContributionModel.CatalogRow row, boolean empty) {
            super.updateItem(row, empty);
            CatalogContributionModel.CatalogRow displayRow = empty ? null : row;
            String creatureName = displayRow == null ? "" : displayRow.cell(FIRST_COLUMN_INDEX);
            button.setText(creatureName);
            button.setAccessibleText(displayRow == null ? "" : CREATURE_ACCESSIBLE_TEXT_PREFIX + creatureName);
            setText(null);
            setGraphic(displayRow == null ? null : button);
        }
    }

    private static final class ActionCell extends TableCell<CatalogContributionModel.CatalogRow, CatalogContributionModel.CatalogRow> {

        private final Button button = new Button(ACTION_LABEL);
        private final Tooltip tooltip = new Tooltip(ACTION_TOOLTIP);

        ActionCell(Consumer<CatalogContributionModel.CatalogRow> action) {
            button.getStyleClass().addAll("accent", "compact");
            button.setTooltip(tooltip);
            button.setOnAction(event -> {
                CatalogContributionModel.CatalogRow row = getItem();
                if (row != null) {
                    action.accept(row);
                }
            });
        }

        @Override
        protected void updateItem(CatalogContributionModel.CatalogRow row, boolean empty) {
            super.updateItem(row, empty);
            CatalogContributionModel.CatalogRow displayRow = empty ? null : row;
            button.setAccessibleText(displayRow == null
                    ? ""
                    : ACTION_ACCESSIBLE_TEXT_PREFIX + displayRow.cell(FIRST_COLUMN_INDEX));
            setGraphic(displayRow == null ? null : button);
        }
    }
}
