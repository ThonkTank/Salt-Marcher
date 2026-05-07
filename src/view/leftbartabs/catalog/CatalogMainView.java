package src.view.leftbartabs.catalog;

import java.util.List;
import java.util.function.Consumer;
import javafx.beans.property.ReadOnlyObjectWrapper;
import javafx.beans.property.SimpleStringProperty;
import javafx.collections.FXCollections;
import javafx.collections.ObservableList;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
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

    static final int FIRST_COLUMN_INDEX = 0;
    static final int PREVIOUS_PAGE_SHIFT = -1;
    static final int NEXT_PAGE_SHIFT = 1;
    static final int NO_PAGE_SHIFT = 0;
    static final long NO_CREATURE_ID = 0L;
    static final String EMPTY_SORT_KEY = "";
    static final String ACTION_LABEL = "+Add";
    static final String ACTION_TOOLTIP = "Zum Encounter hinzufügen";
    static final String CREATURE_ACCESSIBLE_TEXT_PREFIX = "Stat Block: ";
    static final String ACTION_ACCESSIBLE_TEXT_PREFIX = ACTION_LABEL + ": ";
    static final String SORT_KEY_NAME_ASC = "name-asc";
    static final String SORT_KEY_NAME_DESC = "name-desc";
    static final String SORT_KEY_CR_ASC = "cr-asc";
    static final String SORT_KEY_CR_DESC = "cr-desc";
    static final String SORT_KEY_XP_ASC = "xp-asc";
    static final String SORT_KEY_XP_DESC = "xp-desc";
    static final String SORT_LABEL_NAME_ASC = "Name (A-Z)";
    static final String SORT_LABEL_NAME_DESC = "Name (Z-A)";
    static final String SORT_LABEL_CR_ASC = "CR (aufst.)";
    static final String SORT_LABEL_CR_DESC = "CR (abst.)";
    static final String SORT_LABEL_XP_ASC = "XP (aufst.)";
    static final String SORT_LABEL_XP_DESC = "XP (abst.)";
    static final String NO_SORT_LABEL = "";
    static final String COLUMN_KEY_CHALLENGE_RATING = "cr";
    static final String COLUMN_KEY_TYPE = "type";
    static final String COLUMN_KEY_SIZE = "size";
    static final String COLUMN_KEY_XP = "xp";

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
}

final class TopBar extends HBox {

    TopBar(Label countLabel, SortSelector sortSelector) {
        super(8);
        setAlignment(Pos.CENTER_LEFT);
        setPadding(new Insets(0, 0, 6, 0));
        Region spacer = new Region();
        setHgrow(spacer, Priority.ALWAYS);
        getChildren().addAll(countLabel, spacer, new MutedLabel("Sortierung:"), sortSelector);
    }
}

final class PaginationBar extends HBox {

    PaginationBar(Button previousButton, Label pageLabel, Button nextButton) {
        super(8, previousButton, pageLabel, nextButton);
        setAlignment(Pos.CENTER);
        setPadding(new Insets(6, 0, 0, 0));
    }
}

final class SecondaryLabel extends Label {

    SecondaryLabel(String text) {
        super(text);
        getStyleClass().add("text-secondary");
    }
}

final class MutedLabel extends Label {

    MutedLabel(String text) {
        super(text);
        getStyleClass().add("text-muted");
    }
}

final class SortSelector extends ComboBox<CatalogContributionModel.KeyLabel> {

    private final ObservableList<CatalogContributionModel.KeyLabel> sortItems = FXCollections.observableArrayList();
    private final Consumer<String> selectionConsumer;

    SortSelector(Consumer<String> selectionConsumer) {
        this.selectionConsumer = selectionConsumer;
        setItems(sortItems);
        installSelectionPublisher();
    }

    void applyOptions(List<CatalogContributionModel.KeyLabel> options) {
        sortItems.setAll(options == null ? List.of() : List.copyOf(options));
    }

    void selectSortKey(String key) {
        String label = labelForKey(key);
        if (label.isBlank()) {
            return;
        }
        suspendSelectionPublisher();
        try {
            for (CatalogContributionModel.KeyLabel selection : sortItems) {
                if (label.equals(selection.toString())) {
                    getSelectionModel().select(selection);
                    return;
                }
            }
        } finally {
            installSelectionPublisher();
        }
    }

    private static String keyForLabel(String label) {
        return switch (label) {
            case CatalogMainView.SORT_LABEL_NAME_ASC -> CatalogMainView.SORT_KEY_NAME_ASC;
            case CatalogMainView.SORT_LABEL_NAME_DESC -> CatalogMainView.SORT_KEY_NAME_DESC;
            case CatalogMainView.SORT_LABEL_CR_ASC -> CatalogMainView.SORT_KEY_CR_ASC;
            case CatalogMainView.SORT_LABEL_CR_DESC -> CatalogMainView.SORT_KEY_CR_DESC;
            case CatalogMainView.SORT_LABEL_XP_ASC -> CatalogMainView.SORT_KEY_XP_ASC;
            case CatalogMainView.SORT_LABEL_XP_DESC -> CatalogMainView.SORT_KEY_XP_DESC;
            default -> "";
        };
    }

    private static String labelForKey(String key) {
        return switch (key) {
            case CatalogMainView.SORT_KEY_NAME_ASC -> CatalogMainView.SORT_LABEL_NAME_ASC;
            case CatalogMainView.SORT_KEY_NAME_DESC -> CatalogMainView.SORT_LABEL_NAME_DESC;
            case CatalogMainView.SORT_KEY_CR_ASC -> CatalogMainView.SORT_LABEL_CR_ASC;
            case CatalogMainView.SORT_KEY_CR_DESC -> CatalogMainView.SORT_LABEL_CR_DESC;
            case CatalogMainView.SORT_KEY_XP_ASC -> CatalogMainView.SORT_LABEL_XP_ASC;
            case CatalogMainView.SORT_KEY_XP_DESC -> CatalogMainView.SORT_LABEL_XP_DESC;
            default -> CatalogMainView.NO_SORT_LABEL;
        };
    }

    private void installSelectionPublisher() {
        setOnAction(event -> {
            String selectedKey = keyForLabel(getValue() == null ? CatalogMainView.NO_SORT_LABEL : getValue().toString());
            if (!selectedKey.isBlank()) {
                selectionConsumer.accept(selectedKey);
            }
        });
    }

    private void suspendSelectionPublisher() {
        setOnAction(event -> {
        });
    }
}

final class CatalogTable extends TableView<CatalogContributionModel.CatalogRow> {

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
        TableColumn<CatalogContributionModel.CatalogRow, ?>[] configuredColumns =
                new TableColumn[safeColumns.size() + 1];
        for (int index = 0; index < safeColumns.size(); index++) {
            configuredColumns[index] = index == CatalogMainView.FIRST_COLUMN_INDEX
                    ? createLinkColumn(safeColumns.get(index))
                    : createTextColumn(safeColumns.get(index), index);
        }
        configuredColumns[safeColumns.size()] = createActionColumn();
        return List.of(configuredColumns);
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

record ColumnSizing(double minWidth, double prefWidth, double maxWidth) {

    static ColumnSizing forKey(String key) {
        return switch (key) {
            case CatalogMainView.COLUMN_KEY_CHALLENGE_RATING -> new ColumnSizing(40, 50, 60);
            case CatalogMainView.COLUMN_KEY_TYPE -> new ColumnSizing(80, 110, 150);
            case CatalogMainView.COLUMN_KEY_SIZE -> new ColumnSizing(65, 85, 100);
            case CatalogMainView.COLUMN_KEY_XP -> new ColumnSizing(45, 60, 75);
            default -> new ColumnSizing(70, 110, Double.NaN);
        };
    }
}

final class PlaceholderLabel extends Label {

    PlaceholderLabel() {
        super("Lade Monster...");
    }
}

final class CreatureLinkButton extends Button {

    CreatureLinkButton() {
        getStyleClass().addAll("creature-link", "flat");
    }
}

final class AddCreatureButton extends Button {

    AddCreatureButton() {
        super(CatalogMainView.ACTION_LABEL);
        getStyleClass().addAll("accent", "compact");
        setTooltip(new Tooltip(CatalogMainView.ACTION_TOOLTIP));
    }
}

final class LinkCell extends TableCell<CatalogContributionModel.CatalogRow, CatalogContributionModel.CatalogRow> {

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
        String creatureName = displayRow == null ? "" : displayRow.cell(CatalogMainView.FIRST_COLUMN_INDEX);
        button.setText(creatureName);
        button.setAccessibleText(displayRow == null
                ? ""
                : CatalogMainView.CREATURE_ACCESSIBLE_TEXT_PREFIX + creatureName);
        setText(null);
        setGraphic(displayRow == null ? null : button);
    }
}

final class ActionCell extends TableCell<CatalogContributionModel.CatalogRow, CatalogContributionModel.CatalogRow> {

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
                : CatalogMainView.ACTION_ACCESSIBLE_TEXT_PREFIX + displayRow.cell(CatalogMainView.FIRST_COLUMN_INDEX));
        setGraphic(displayRow == null ? null : button);
    }
}
