package src.view.leftbartabs.catalog;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;
import javafx.beans.property.ReadOnlyObjectWrapper;
import javafx.beans.property.SimpleStringProperty;
import javafx.beans.value.ChangeListener;
import javafx.collections.FXCollections;
import javafx.collections.ObservableList;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.control.Button;
import javafx.scene.control.ComboBox;
import javafx.scene.control.Label;
import javafx.scene.control.SelectionMode;
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
    private static final String SORT_KEY_NAME_ASC = "name-asc";
    private static final String SORT_KEY_NAME_DESC = "name-desc";
    private static final String SORT_KEY_CR_ASC = "cr-asc";
    private static final String SORT_KEY_CR_DESC = "cr-desc";
    private static final String SORT_KEY_XP_ASC = "xp-asc";
    private static final String SORT_KEY_XP_DESC = "xp-desc";
    private static final String SORT_LABEL_NAME_ASC = "Name (A-Z)";
    private static final String SORT_LABEL_NAME_DESC = "Name (Z-A)";
    private static final String SORT_LABEL_CR_ASC = "CR (aufst.)";
    private static final String SORT_LABEL_CR_DESC = "CR (abst.)";
    private static final String SORT_LABEL_XP_ASC = "XP (aufst.)";
    private static final String SORT_LABEL_XP_DESC = "XP (abst.)";
    private static final String COLUMN_KEY_CHALLENGE_RATING = "cr";
    private static final String COLUMN_KEY_TYPE = "type";
    private static final String COLUMN_KEY_SIZE = "size";
    private static final String COLUMN_KEY_XP = "xp";

    private final SecondaryLabel countLabel = new SecondaryLabel("0 Monster gefunden");
    private final SecondaryLabel pageLabel = new SecondaryLabel("Seite 1 / 1");
    private final Button previousButton = new Button("◀ Zurück");
    private final Button nextButton = new Button("Weiter ▶");
    private final SortSelector sortSelector = new SortSelector(this::publishSortSelection);
    private final CatalogTable table = new CatalogTable(this::publishOpenCreature, this::publishAddCreature);
    private Consumer<CatalogMainViewInputEvent> viewInputEventHandler = ignored -> { };

    public CatalogMainView() {
        getStyleClass().add("surface-root");
        setPadding(new Insets(8));
        setTop(new TopBar(countLabel, sortSelector));
        setCenter(table);

        previousButton.setOnAction(event -> publishPageShift(PREVIOUS_PAGE_SHIFT));
        nextButton.setOnAction(event -> publishPageShift(NEXT_PAGE_SHIFT));
        setBottom(new PaginationBar(previousButton, pageLabel, nextButton));
    }

    public void bind(CatalogContributionModel contributionModel) {
        if (contributionModel == null) {
            return;
        }
        applyProjection(contributionModel.mainProjectionProperty().get());
        contributionModel.mainProjectionProperty().addListener((obs, before, after) -> applyProjection(after));
    }

    public void onViewInputEvent(Consumer<CatalogMainViewInputEvent> handler) {
        viewInputEventHandler = handler == null ? ignored -> { } : handler;
    }

    private void applyProjection(CatalogContributionModel.MainProjection projection) {
        CatalogContributionModel.MainProjection safeProjection = projection == null
                ? CatalogContributionModel.MainProjection.initial()
                : projection;
        countLabel.setText(safeProjection.countLabel());
        pageLabel.setText(safeProjection.pageLabel());
        previousButton.setDisable(!safeProjection.previousPageAvailable());
        nextButton.setDisable(!safeProjection.nextPageAvailable());
        sortSelector.applyOptions(safeProjection.sortOptions());
        sortSelector.selectSortKey(safeProjection.selectedSortKey());
        table.applyProjection(safeProjection.placeholderText(), safeProjection.rows(), safeProjection.columns());
    }

    private void publishSortSelection(String sortKey) {
        viewInputEventHandler.accept(new CatalogMainViewInputEvent(
                sortKey,
                NO_CREATURE_ID,
                NO_CREATURE_ID,
                NO_PAGE_SHIFT));
    }

    private void publishOpenCreature(CatalogContributionModel.CatalogRow row) {
        publishCreatureEvent(row, false);
    }

    private void publishAddCreature(CatalogContributionModel.CatalogRow row) {
        publishCreatureEvent(row, true);
    }

    private void publishCreatureEvent(CatalogContributionModel.CatalogRow row, boolean addCreature) {
        if (row == null) {
            return;
        }
        viewInputEventHandler.accept(addCreature
                ? new CatalogMainViewInputEvent(EMPTY_SORT_KEY, NO_CREATURE_ID, row.id(), NO_PAGE_SHIFT)
                : new CatalogMainViewInputEvent(EMPTY_SORT_KEY, row.id(), NO_CREATURE_ID, NO_PAGE_SHIFT));
    }

    private void publishPageShift(int pageShift) {
        viewInputEventHandler.accept(new CatalogMainViewInputEvent(
                EMPTY_SORT_KEY,
                NO_CREATURE_ID,
                NO_CREATURE_ID,
                pageShift));
    }

    private static final class TopBar extends HBox {

        TopBar(Label countLabel, SortSelector sortSelector) {
            super(8);
            setAlignment(Pos.CENTER_LEFT);
            setPadding(new Insets(0, 0, 6, 0));
            Region spacer = new Region();
            setHgrow(spacer, Priority.ALWAYS);
            getChildren().addAll(countLabel, spacer, new MutedLabel("Sortierung:"), sortSelector);
        }
    }

    private static final class PaginationBar extends HBox {

        PaginationBar(Button previousButton, Label pageLabel, Button nextButton) {
            super(8, previousButton, pageLabel, nextButton);
            setAlignment(Pos.CENTER);
            setPadding(new Insets(6, 0, 0, 0));
        }
    }

    private static final class SecondaryLabel extends Label {

        SecondaryLabel(String text) {
            super(text);
            getStyleClass().add("text-secondary");
        }
    }

    private static final class MutedLabel extends Label {

        MutedLabel(String text) {
            super(text);
            getStyleClass().add("text-muted");
        }
    }

    private static final class SortSelector extends ComboBox<CatalogContributionModel.KeyLabel> {

        private final ObservableList<CatalogContributionModel.KeyLabel> sortItems = FXCollections.observableArrayList();
        private final ChangeListener<CatalogContributionModel.KeyLabel> selectionListener;

        SortSelector(Consumer<String> selectionConsumer) {
            setItems(sortItems);
            selectionListener = (obs, before, after) -> {
                String selectedKey = keyForLabel(after == null ? "" : after.toString());
                if (!selectedKey.isBlank()) {
                    selectionConsumer.accept(selectedKey);
                }
            };
            valueProperty().addListener(selectionListener);
        }

        void applyOptions(List<CatalogContributionModel.KeyLabel> options) {
            sortItems.setAll(options == null ? List.of() : List.copyOf(options));
        }

        void selectSortKey(String key) {
            String label = labelForKey(key);
            if (label.isBlank()) {
                return;
            }
            withDetachedSelectionListener(() -> {
                for (CatalogContributionModel.KeyLabel selection : sortItems) {
                    if (Objects.equals(selection.toString(), label)) {
                        getSelectionModel().select(selection);
                        return;
                    }
                }
            });
        }

        private static String keyForLabel(String label) {
            return switch (label) {
                case SORT_LABEL_NAME_ASC -> SORT_KEY_NAME_ASC;
                case SORT_LABEL_NAME_DESC -> SORT_KEY_NAME_DESC;
                case SORT_LABEL_CR_ASC -> SORT_KEY_CR_ASC;
                case SORT_LABEL_CR_DESC -> SORT_KEY_CR_DESC;
                case SORT_LABEL_XP_ASC -> SORT_KEY_XP_ASC;
                case SORT_LABEL_XP_DESC -> SORT_KEY_XP_DESC;
                default -> "";
            };
        }

        private static String labelForKey(String key) {
            return switch (key) {
                case SORT_KEY_NAME_ASC -> SORT_LABEL_NAME_ASC;
                case SORT_KEY_NAME_DESC -> SORT_LABEL_NAME_DESC;
                case SORT_KEY_CR_ASC -> SORT_LABEL_CR_ASC;
                case SORT_KEY_CR_DESC -> SORT_LABEL_CR_DESC;
                case SORT_KEY_XP_ASC -> SORT_LABEL_XP_ASC;
                case SORT_KEY_XP_DESC -> SORT_LABEL_XP_DESC;
                default -> "";
            };
        }

        private void withDetachedSelectionListener(Runnable action) {
            valueProperty().removeListener(selectionListener);
            try {
                action.run();
            } finally {
                valueProperty().addListener(selectionListener);
            }
        }
    }

    private static final class CatalogTable extends TableView<CatalogContributionModel.CatalogRow> {

        private final ObservableList<CatalogContributionModel.CatalogRow> rowItems = FXCollections.observableArrayList();
        private final PlaceholderLabel placeholder = new PlaceholderLabel();
        private final Consumer<CatalogContributionModel.CatalogRow> openCreatureAction;
        private final Consumer<CatalogContributionModel.CatalogRow> addCreatureAction;

        CatalogTable(
                Consumer<CatalogContributionModel.CatalogRow> openCreatureAction,
                Consumer<CatalogContributionModel.CatalogRow> addCreatureAction
        ) {
            this.openCreatureAction = openCreatureAction;
            this.addCreatureAction = addCreatureAction;
            setItems(rowItems);
            setColumnResizePolicy(CONSTRAINED_RESIZE_POLICY);
            getSelectionModel().setSelectionMode(SelectionMode.SINGLE);
            setPlaceholder(placeholder);
            setOnKeyPressed(event -> {
                if (event.getCode() != KeyCode.ENTER) {
                    return;
                }
                CatalogContributionModel.CatalogRow selectedRow = getSelectionModel().getSelectedItem();
                if (selectedRow == null) {
                    return;
                }
                if (event.isShiftDown()) {
                    addCreatureAction.accept(selectedRow);
                } else {
                    openCreatureAction.accept(selectedRow);
                }
                event.consume();
            });
        }

        void applyProjection(
                String placeholderText,
                List<CatalogContributionModel.CatalogRow> rows,
                List<CatalogContributionModel.KeyLabel> columns
        ) {
            placeholder.setText(placeholderText);
            rowItems.setAll(rows == null ? List.of() : List.copyOf(rows));
            getColumns().setAll(configuredColumns(columns));
        }

        private List<TableColumn<CatalogContributionModel.CatalogRow, ?>> configuredColumns(
                List<CatalogContributionModel.KeyLabel> columns
        ) {
            List<CatalogContributionModel.KeyLabel> safeColumns = columns == null ? List.of() : List.copyOf(columns);
            List<TableColumn<CatalogContributionModel.CatalogRow, ?>> configuredColumns =
                    new ArrayList<>(safeColumns.size() + 1);
            for (int index = 0; index < safeColumns.size(); index++) {
                configuredColumns.add(index == FIRST_COLUMN_INDEX
                        ? createLinkColumn(safeColumns.get(index))
                        : createTextColumn(safeColumns.get(index), index));
            }
            configuredColumns.add(createActionColumn());
            return configuredColumns;
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
            ColumnSizing sizing = ColumnSizing.forKey(column.key());
            textColumn.setMinWidth(sizing.minWidth());
            textColumn.setPrefWidth(sizing.prefWidth());
            if (!Double.isNaN(sizing.maxWidth())) {
                textColumn.setMaxWidth(sizing.maxWidth());
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
            linkColumn.setCellFactory(ignored -> new LinkCell(openCreatureAction));
            return linkColumn;
        }

        private TableColumn<CatalogContributionModel.CatalogRow, CatalogContributionModel.CatalogRow> createActionColumn() {
            TableColumn<CatalogContributionModel.CatalogRow, CatalogContributionModel.CatalogRow> actionColumn =
                    new TableColumn<>("");
            actionColumn.setMinWidth(55);
            actionColumn.setPrefWidth(65);
            actionColumn.setMaxWidth(75);
            actionColumn.setSortable(false);
            actionColumn.setCellValueFactory(data -> new ReadOnlyObjectWrapper<>(data.getValue()));
            actionColumn.setCellFactory(ignored -> new ActionCell(addCreatureAction));
            return actionColumn;
        }
    }

    private record ColumnSizing(double minWidth, double prefWidth, double maxWidth) {

        static ColumnSizing forKey(String key) {
            return switch (key) {
                case COLUMN_KEY_CHALLENGE_RATING -> new ColumnSizing(40, 50, 60);
                case COLUMN_KEY_TYPE -> new ColumnSizing(80, 110, 150);
                case COLUMN_KEY_SIZE -> new ColumnSizing(65, 85, 100);
                case COLUMN_KEY_XP -> new ColumnSizing(45, 60, 75);
                default -> new ColumnSizing(70, 110, Double.NaN);
            };
        }
    }

    private static final class PlaceholderLabel extends Label {

        PlaceholderLabel() {
            super("Lade Monster...");
        }
    }

    private static final class CreatureLinkButton extends Button {

        CreatureLinkButton() {
            getStyleClass().addAll("creature-link", "flat");
        }
    }

    private static final class AddCreatureButton extends Button {

        AddCreatureButton() {
            super(ACTION_LABEL);
            getStyleClass().addAll("accent", "compact");
            setTooltip(new Tooltip(ACTION_TOOLTIP));
        }
    }

    private static final class LinkCell extends TableCell<CatalogContributionModel.CatalogRow, CatalogContributionModel.CatalogRow> {

        private final CreatureLinkButton button = new CreatureLinkButton();

        LinkCell(Consumer<CatalogContributionModel.CatalogRow> openAction) {
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

        private final AddCreatureButton button = new AddCreatureButton();

        ActionCell(Consumer<CatalogContributionModel.CatalogRow> addAction) {
            button.setOnAction(event -> {
                CatalogContributionModel.CatalogRow row = getItem();
                if (row != null) {
                    addAction.accept(row);
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
