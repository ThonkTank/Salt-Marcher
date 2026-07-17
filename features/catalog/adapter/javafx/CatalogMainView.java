package features.catalog.adapter.javafx;

import java.util.List;
import java.util.function.Consumer;
import javafx.beans.property.ReadOnlyObjectWrapper;
import javafx.beans.property.SimpleStringProperty;
import javafx.scene.control.Button;
import javafx.scene.control.ComboBox;
import javafx.scene.control.Label;
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
    private static final long NO_CREATURE_ID = 0L;
    private static final String ACTION_LABEL = "+Add";
    private static final String ACTION_TOOLTIP = "Zum Encounter hinzufügen";
    private static final String CREATURE_ACCESSIBLE_TEXT_PREFIX = "Stat Block: ";
    private static final String ACTION_ACCESSIBLE_TEXT_PREFIX = ACTION_LABEL + ": ";
    private static final String COLUMN_KEY_CHALLENGE_RATING = "cr";
    private static final String COLUMN_KEY_TYPE = "type";
    private static final String COLUMN_KEY_SIZE = "size";
    private static final String COLUMN_KEY_XP = "xp";

    private final Label countLabel = Chrome.secondaryLabel("0 Monster gefunden");
    private final Label pageLabel = Chrome.secondaryLabel("Seite 1 / 1");
    private final Button previousButton = new Button("◀ Zurück");
    private final Button nextButton = new Button("Weiter ▶");
    private final ComboBox<Object> sortSelector = new ComboBox<>();
    private final TableView<Object> table = new TableView<>();
    private Consumer<CatalogMainViewInputEvent> viewInputEventHandler = ignored -> { };

    public CatalogMainView() {
        getStyleClass().add("surface-root");
        Chrome.configureSortSelector(sortSelector, this::publishSortSelection);
        CatalogTable.configure(
                table,
                CatalogMainContentModel.MainProjection.initial().columns(),
                this::publishCreatureEvent);
        previousButton.setOnAction(event -> publishPageShift(PREVIOUS_PAGE_SHIFT));
        nextButton.setOnAction(event -> publishPageShift(NEXT_PAGE_SHIFT));
        setTop(Chrome.topBar(countLabel, sortSelector));
        setCenter(table);
        setBottom(Chrome.paginationBar(previousButton, pageLabel, nextButton));
    }

    public void bind(CatalogMainContentModel contentModel) {
        if (contentModel == null) {
            return;
        }
        applyProjection(contentModel.projectionProperty().get());
        contentModel.projectionProperty().addListener((obs, before, after) -> applyProjection(after));
    }

    public void onViewInputEvent(Consumer<CatalogMainViewInputEvent> handler) {
        viewInputEventHandler = handler == null ? ignored -> { } : handler;
    }

    private void applyProjection(CatalogMainContentModel.MainProjection projection) {
        if (projection == null) {
            return;
        }
        countLabel.setText(projection.countLabel());
        pageLabel.setText(projection.pageLabel());
        previousButton.setDisable(!projection.previousPageAvailable());
        nextButton.setDisable(!projection.nextPageAvailable());
        if (!sortSelector.getItems().equals(projection.sortOptions())) {
            sortSelector.getItems().setAll(projection.sortOptions());
        }
        selectSortKey(projection.selectedSortKey());
        CatalogTable.applyProjection(
                table,
                projection.placeholderText(),
                projection.rows());
    }

    private void publishSortSelection(String sortKey) {
        viewInputEventHandler.accept(new CatalogMainViewInputEvent(
                sortKey,
                0L,
                0L,
                0));
    }

    private void publishCreatureEvent(long creatureId, boolean addCreature) {
        if (creatureId <= NO_CREATURE_ID) {
            return;
        }
        viewInputEventHandler.accept(addCreature
                ? new CatalogMainViewInputEvent("", 0L, creatureId, 0)
                : new CatalogMainViewInputEvent("", creatureId, 0L, 0));
    }

    private void publishPageShift(int pageShift) {
        viewInputEventHandler.accept(new CatalogMainViewInputEvent(
                "",
                0L,
                0L,
                pageShift));
    }

    private void selectSortKey(String key) {
        if (key == null || key.isBlank()) {
            return;
        }
        sortSelector.setOnAction(event -> { });
        try {
            for (Object selection : sortSelector.getItems()) {
                if (selection instanceof CatalogMainContentModel.KeyLabel option && key.equals(option.key())) {
                    sortSelector.getSelectionModel().select(selection);
                    return;
                }
            }
        } finally {
            Chrome.configureSortSelector(sortSelector, this::publishSortSelection);
        }
    }

    private static final class Chrome {

        static Label secondaryLabel(String text) {
            Label label = new Label(text);
            label.getStyleClass().add("text-secondary");
            return label;
        }

        static HBox topBar(Label countLabel, ComboBox<Object> sortSelector) {
            Region spacer = new Region();
            HBox.setHgrow(spacer, Priority.ALWAYS);
            Label sortLabel = new Label("Sortierung:");
            sortLabel.getStyleClass().add("text-muted");
            HBox topBar = new HBox(8, countLabel, spacer, sortLabel, sortSelector);
            topBar.getStyleClass().add("catalog-main-topbar");
            return topBar;
        }

        static HBox paginationBar(Button previousButton, Label pageLabel, Button nextButton) {
            HBox bar = new HBox(8, previousButton, pageLabel, nextButton);
            bar.getStyleClass().add("catalog-main-pagination");
            return bar;
        }

        static void configureSortSelector(
                ComboBox<Object> sortSelector,
                Consumer<String> selectionConsumer
        ) {
            sortSelector.setOnAction(event -> {
                if (sortSelector.getValue() instanceof CatalogMainContentModel.KeyLabel selected
                        && !selected.key().isBlank()) {
                    selectionConsumer.accept(selected.key());
                }
            });
        }
    }

    private static final class CatalogTable {

        static void configure(
                TableView<Object> table,
                List<CatalogMainContentModel.KeyLabel> columns,
                CreatureAction action
        ) {
            table.setColumnResizePolicy(TableView.CONSTRAINED_RESIZE_POLICY);
            table.setPlaceholder(new Label("Lade Monster..."));
            table.setOnKeyPressed(event -> {
                if (event.getCode() != KeyCode.ENTER) {
                    return;
                }
                long selectedCreatureId = creatureId(table.getSelectionModel().getSelectedItem());
                if (selectedCreatureId <= NO_CREATURE_ID) {
                    return;
                }
                action.accept(selectedCreatureId, event.isShiftDown());
                event.consume();
            });
            table.getColumns().setAll(configuredColumns(columns, action));
        }

        static void applyProjection(
                TableView<Object> table,
                String placeholderText,
                List<CatalogMainContentModel.CatalogRow> rows
        ) {
            if (table.getPlaceholder() instanceof Label label) {
                label.setText(placeholderText);
            }
            long selectedId = creatureId(table.getSelectionModel().getSelectedItem());
            table.getItems().setAll(rows == null ? List.of() : List.copyOf(rows));
            if (selectedId > NO_CREATURE_ID) {
                table.getItems().stream()
                        .filter(row -> creatureId(row) == selectedId)
                        .findFirst()
                        .ifPresent(row -> table.getSelectionModel().select(row));
            }
        }

        private static List<TableColumn<Object, ?>> configuredColumns(
                List<CatalogMainContentModel.KeyLabel> columns,
                CreatureAction action
        ) {
            List<CatalogMainContentModel.KeyLabel> safeColumns = columns == null ? List.of() : List.copyOf(columns);
            TableColumn<Object, ?>[] configuredColumns = new TableColumn[safeColumns.size() + 1];
            for (int index = 0; index < safeColumns.size(); index++) {
                configuredColumns[index] = index == FIRST_COLUMN_INDEX
                        ? createLinkColumn(safeColumns.get(index), action)
                        : createTextColumn(safeColumns.get(index), index);
            }
            configuredColumns[safeColumns.size()] = createActionColumn(action);
            return List.of(configuredColumns);
        }

        private static TableColumn<Object, String> createTextColumn(
                CatalogMainContentModel.KeyLabel column,
                int index
        ) {
            TableColumn<Object, String> textColumn = new TableColumn<>(column.label());
            textColumn.setCellValueFactory(data -> new SimpleStringProperty(cellText(data.getValue(), index)));
            applyColumnSizing(textColumn, column.key());
            return textColumn;
        }

        private static TableColumn<Object, Object> createLinkColumn(
                CatalogMainContentModel.KeyLabel column,
                CreatureAction action
        ) {
            TableColumn<Object, Object> linkColumn = new TableColumn<>(column.label());
            linkColumn.setMinWidth(120);
            linkColumn.setPrefWidth(200);
            linkColumn.setCellValueFactory(data -> new ReadOnlyObjectWrapper<>(data.getValue()));
            linkColumn.setCellFactory(ignored -> new LinkCell(CatalogTable::creatureId, action));
            return linkColumn;
        }

        private static TableColumn<Object, Object> createActionColumn(CreatureAction action) {
            TableColumn<Object, Object> actionColumn = new TableColumn<>("");
            actionColumn.setMinWidth(55);
            actionColumn.setPrefWidth(65);
            actionColumn.setMaxWidth(75);
            actionColumn.setSortable(false);
            actionColumn.setCellValueFactory(data -> new ReadOnlyObjectWrapper<>(data.getValue()));
            actionColumn.setCellFactory(ignored -> new ActionCell(CatalogTable::creatureId, action));
            return actionColumn;
        }

        private static String cellText(Object row, int index) {
            return row instanceof CatalogMainContentModel.CatalogRow catalogRow ? catalogRow.cell(index) : "";
        }

        private static long creatureId(Object row) {
            return row instanceof CatalogMainContentModel.CatalogRow catalogRow ? catalogRow.id() : 0L;
        }

        private static void applyColumnSizing(TableColumn<Object, String> textColumn, String key) {
            switch (key) {
                case COLUMN_KEY_CHALLENGE_RATING -> setColumnSizing(textColumn, 40, 50, 60);
                case COLUMN_KEY_TYPE -> setColumnSizing(textColumn, 80, 110, 150);
                case COLUMN_KEY_SIZE -> setColumnSizing(textColumn, 65, 85, 100);
                case COLUMN_KEY_XP -> setColumnSizing(textColumn, 45, 60, 75);
                default -> {
                    textColumn.setMinWidth(70);
                    textColumn.setPrefWidth(110);
                }
            }
        }

        private static void setColumnSizing(
                TableColumn<Object, String> textColumn,
                double minWidth,
                double prefWidth,
                double maxWidth
        ) {
            textColumn.setMinWidth(minWidth);
            textColumn.setPrefWidth(prefWidth);
            textColumn.setMaxWidth(maxWidth);
        }
    }

    @FunctionalInterface
    private interface CreatureAction {

        void accept(long creatureId, boolean addCreature);
    }

    private static final class LinkCell extends TableCell<Object, Object> {

        private final Button button = new Button();
        private final java.util.function.ToLongFunction<Object> creatureIdReader;
        private final CreatureAction action;

        LinkCell(
                java.util.function.ToLongFunction<Object> creatureIdReader,
                CreatureAction action
        ) {
            this.creatureIdReader = creatureIdReader;
            this.action = action;
            button.getStyleClass().addAll("creature-link", "flat");
            button.setOnAction(event -> {
                Object row = getItem();
                TableView<Object> owningTable = getTableView();
                if (owningTable != null && row != null) {
                    owningTable.getSelectionModel().select(row);
                }
                action.accept(creatureIdReader.applyAsLong(row), false);
            });
        }

        @Override
        protected void updateItem(Object row, boolean empty) {
            super.updateItem(row, empty);
            Object displayRow = empty ? null : row;
            String creatureName = CatalogTable.cellText(displayRow, FIRST_COLUMN_INDEX);
            button.setText(creatureName);
            button.setAccessibleText(displayRow == null ? "" : CREATURE_ACCESSIBLE_TEXT_PREFIX + creatureName);
            setText(null);
            setGraphic(displayRow == null ? null : button);
        }
    }

    private static final class ActionCell extends TableCell<Object, Object> {

        private final Button button = new Button(ACTION_LABEL);
        private final java.util.function.ToLongFunction<Object> creatureIdReader;
        private final CreatureAction action;

        ActionCell(
                java.util.function.ToLongFunction<Object> creatureIdReader,
                CreatureAction action
        ) {
            this.creatureIdReader = creatureIdReader;
            this.action = action;
            button.getStyleClass().addAll("accent", "compact");
            button.setTooltip(new Tooltip(ACTION_TOOLTIP));
            button.setOnAction(event -> {
                Object row = getItem();
                TableView<Object> owningTable = getTableView();
                if (owningTable != null && row != null) {
                    owningTable.getSelectionModel().select(row);
                }
                action.accept(creatureIdReader.applyAsLong(row), true);
            });
        }

        @Override
        protected void updateItem(Object row, boolean empty) {
            super.updateItem(row, empty);
            Object displayRow = empty ? null : row;
            button.setAccessibleText(displayRow == null
                    ? ""
                    : ACTION_ACCESSIBLE_TEXT_PREFIX + CatalogTable.cellText(displayRow, FIRST_COLUMN_INDEX));
            setGraphic(displayRow == null ? null : button);
        }
    }

}
