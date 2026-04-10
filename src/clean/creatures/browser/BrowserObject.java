package clean.creatures.browser;

import clean.creatures.browser.input.ComposeBrowserInput;
import clean.creatures.catalog.input.ComposeCatalogInput;
import clean.creatures.statblock.input.ComposeStatblockInput;
import javafx.application.Platform;
import javafx.beans.property.ReadOnlyObjectWrapper;
import javafx.geometry.Insets;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.ComboBox;
import javafx.scene.control.Label;
import javafx.scene.control.ListCell;
import javafx.scene.control.TableCell;
import javafx.scene.control.TableColumn;
import javafx.scene.control.TableRow;
import javafx.scene.control.TableView;
import javafx.scene.input.KeyCode;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;

import java.util.List;
import java.util.Objects;
import java.util.function.Function;

/**
 * Reusable clean creature browser table mirroring the legacy catalog browser role.
 */
@SuppressWarnings("unused")
public final class BrowserObject {

    private final ComposeBrowserInput.BrowserInput browser;

    public BrowserObject(ComposeBrowserInput input) {
        ComposeBrowserInput resolvedInput = Objects.requireNonNull(input, "input");
        this.browser = new BrowserAssembly(resolvedInput).composeBrowser();
    }

    public ComposeBrowserInput.BrowserInput composeBrowser(ComposeBrowserInput input) {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        return browser;
    }

    private static final class BrowserAssembly {
        private static final int PAGE_SIZE = 50;
        private static final String SECONDARY_TEXT_STYLE = "-fx-text-fill: -sm-text-secondary; -fx-font-size: 11px;";
        private static final String COMBO_STYLE = """
                -fx-background-color: -sm-bg-elevated;
                -fx-border-color: -sm-border-subtle;
                -fx-border-radius: 3;
                -fx-background-radius: 3;
                """;
        private static final String COMBO_CELL_STYLE = """
                -fx-background-color: -sm-bg-elevated;
                -fx-text-fill: -sm-text-primary;
                -fx-font-size: 13px;
                """;
        private static final String TABLE_STYLE = """
                -fx-background-color: -sm-bg-card;
                -fx-border-color: transparent;
                """;
        private static final String TABLE_ROW_STYLE = """
                -fx-background-color: -sm-bg-card;
                -fx-border-color: transparent transparent -sm-border-subtle transparent;
                -fx-cell-size: 28px;
                """;
        private static final String TABLE_ROW_SELECTED_STYLE = """
                -fx-background-color: -sm-accent;
                -fx-border-color: transparent transparent -sm-border-subtle transparent;
                -fx-cell-size: 28px;
                """;
        private static final String TABLE_CELL_STYLE = "-fx-text-fill: -sm-text-primary;";
        private static final String LINK_BUTTON_STYLE = """
                -fx-background-color: transparent;
                -fx-border-color: transparent;
                -fx-padding: 0;
                -fx-text-fill: -sm-creature-link;
                -fx-font-weight: bold;
                -fx-cursor: hand;
                """;
        private static final String ACCENT_BUTTON_STYLE = """
                -fx-background-color: -sm-accent;
                -fx-text-fill: -sm-text-primary;
                -fx-font-weight: bold;
                -fx-font-size: 11px;
                -fx-background-radius: 3;
                -fx-border-radius: 3;
                -fx-padding: 2 6 2 6;
                """;

        private final ComposeBrowserInput input;
        private final Label countLabel = new Label("0 Monster gefunden");
        private final Label pageLabel = new Label("Seite 1 / 1");
        private final Label placeholderLabel = new Label("Keine Monster gefunden");
        private final ComboBox<SortOption> sortComboBox = new ComboBox<>();
        private final TableView<ComposeCatalogInput.CreatureSummaryInput> tableView = new TableView<>();
        private final Button previousButton = new Button("◀ Zurück");
        private final Button nextButton = new Button("Weiter ▶");
        private ComposeCatalogInput.CriteriaInput criteria = emptyCriteria();
        private int offset;
        private int totalCount;

        private BrowserAssembly(ComposeBrowserInput input) {
            this.input = input;
        }

        private ComposeBrowserInput.BrowserInput composeBrowser() {
            configureBrowserChrome();
            configureTable();
            runSearch();
            return new ComposeBrowserInput.BrowserInput(createMainContent(), this::applyCriteria);
        }

        private void configureBrowserChrome() {
            countLabel.setStyle(SECONDARY_TEXT_STYLE);
            pageLabel.setStyle(SECONDARY_TEXT_STYLE);
            placeholderLabel.setStyle("-fx-text-fill: -sm-text-muted;");

            sortComboBox.getItems().setAll(
                    new SortOption("Name (A-Z)", "name", "ASC"),
                    new SortOption("Name (Z-A)", "name", "DESC"),
                    new SortOption("CR (aufst.)", "cr", "ASC"),
                    new SortOption("CR (abst.)", "cr", "DESC"),
                    new SortOption("XP (aufst.)", "xp", "ASC"),
                    new SortOption("XP (abst.)", "xp", "DESC")
            );
            sortComboBox.getSelectionModel().selectFirst();
            sortComboBox.valueProperty().addListener((observable, oldValue, newValue) -> resetAndSearch());
            styleComboBox(sortComboBox);

            previousButton.getStyleClass().addAll("button", "compact", "flat");
            nextButton.getStyleClass().addAll("button", "compact", "flat");
            previousButton.setOnAction(event -> movePage(-PAGE_SIZE));
            nextButton.setOnAction(event -> movePage(PAGE_SIZE));
        }

        private Node createMainContent() {
            Region spacer = new Region();
            HBox.setHgrow(spacer, Priority.ALWAYS);
            HBox topRow = new HBox(8, countLabel, spacer, sortComboBox);

            HBox pagination = new HBox(8, previousButton, pageLabel, nextButton);

            VBox content = new VBox(8, topRow, tableView, pagination);
            content.setPadding(new Insets(8, 8, 8, 8));
            VBox.setVgrow(tableView, Priority.ALWAYS);
            return content;
        }

        private void configureTable() {
            tableView.setColumnResizePolicy(TableView.CONSTRAINED_RESIZE_POLICY_SUBSEQUENT_COLUMNS);
            tableView.setPlaceholder(placeholderLabel);
            tableView.setStyle(TABLE_STYLE);
            tableView.setRowFactory(table -> new TableRow<>() {
                {
                    selectedProperty().addListener((observable, oldValue, newValue) -> applyRowStyle(this));
                    emptyProperty().addListener((observable, oldValue, newValue) -> applyRowStyle(this));
                }

                @Override
                protected void updateItem(ComposeCatalogInput.CreatureSummaryInput item, boolean empty) {
                    super.updateItem(item, empty);
                    applyRowStyle(this);
                }
            });
            tableView.skinProperty().addListener((observable, oldValue, newValue) -> applyTableHeaderStyles());
            Platform.runLater(this::applyTableHeaderStyles);

            TableColumn<ComposeCatalogInput.CreatureSummaryInput, ComposeCatalogInput.CreatureSummaryInput> nameColumn =
                    new TableColumn<>("Name");
            nameColumn.setMinWidth(120);
            nameColumn.setPrefWidth(200);
            nameColumn.setCellValueFactory(data -> new ReadOnlyObjectWrapper<>(data.getValue()));
            nameColumn.setCellFactory(column -> new TableCell<>() {
                private final Button button = new Button();

                {
                    button.getStyleClass().add("flat");
                    button.setStyle(LINK_BUTTON_STYLE);
                    button.setOnAction(event -> showStatblock(getItem()));
                    button.setOnMouseEntered(event -> button.setUnderline(true));
                    button.setOnMouseExited(event -> button.setUnderline(false));
                    button.setMaxWidth(Double.MAX_VALUE);
                }

                @Override
                protected void updateItem(ComposeCatalogInput.CreatureSummaryInput item, boolean empty) {
                    super.updateItem(item, empty);
                    setStyle(TABLE_CELL_STYLE);
                    if (empty || item == null) {
                        setGraphic(null);
                        return;
                    }
                    button.setText(item.name());
                    button.setAccessibleText("Stat Block: " + item.name());
                    setGraphic(button);
                }
            });

            TableColumn<ComposeCatalogInput.CreatureSummaryInput, String> crColumn = new TableColumn<>("CR");
            crColumn.setMinWidth(40);
            crColumn.setPrefWidth(50);
            crColumn.setMaxWidth(60);
            crColumn.setCellValueFactory(data -> new ReadOnlyObjectWrapper<>(data.getValue().cr()));
            crColumn.setCellFactory(column -> createTextCell());

            TableColumn<ComposeCatalogInput.CreatureSummaryInput, String> typeColumn = new TableColumn<>("Typ");
            typeColumn.setMinWidth(80);
            typeColumn.setPrefWidth(110);
            typeColumn.setMaxWidth(150);
            typeColumn.setCellValueFactory(data -> new ReadOnlyObjectWrapper<>(data.getValue().creatureType()));
            typeColumn.setCellFactory(column -> createTextCell());

            TableColumn<ComposeCatalogInput.CreatureSummaryInput, String> sizeColumn = new TableColumn<>("Größe");
            sizeColumn.setMinWidth(65);
            sizeColumn.setPrefWidth(85);
            sizeColumn.setMaxWidth(100);
            sizeColumn.setCellValueFactory(data -> new ReadOnlyObjectWrapper<>(data.getValue().size()));
            sizeColumn.setCellFactory(column -> createTextCell());

            TableColumn<ComposeCatalogInput.CreatureSummaryInput, Integer> xpColumn = new TableColumn<>("XP");
            xpColumn.setMinWidth(45);
            xpColumn.setPrefWidth(60);
            xpColumn.setMaxWidth(75);
            xpColumn.setCellValueFactory(data -> new ReadOnlyObjectWrapper<>(data.getValue().xp()));
            xpColumn.setCellFactory(column -> createValueCell(value -> value == null ? "" : Integer.toString(value)));

            tableView.getColumns().setAll(nameColumn, crColumn, typeColumn, sizeColumn, xpColumn);

            if (input.rowAction() != null) {
                TableColumn<ComposeCatalogInput.CreatureSummaryInput, ComposeCatalogInput.CreatureSummaryInput> actionColumn =
                        new TableColumn<>("");
                actionColumn.setMinWidth(55);
                actionColumn.setPrefWidth(65);
                actionColumn.setMaxWidth(75);
                actionColumn.setSortable(false);
                actionColumn.setCellValueFactory(data -> new ReadOnlyObjectWrapper<>(data.getValue()));
                actionColumn.setCellFactory(column -> new TableCell<>() {
                    private final Button button = new Button(normalizeActionLabel(input.rowActionLabel()));

                    {
                        button.getStyleClass().add("compact");
                        button.setStyle(ACCENT_BUTTON_STYLE);
                        button.setOnAction(event -> runRowAction(getItem()));
                    }

                    @Override
                    protected void updateItem(ComposeCatalogInput.CreatureSummaryInput item, boolean empty) {
                        super.updateItem(item, empty);
                        setStyle(TABLE_CELL_STYLE);
                        setGraphic(empty || item == null ? null : button);
                    }
                });
                tableView.getColumns().add(actionColumn);
            }

            tableView.setOnKeyPressed(event -> {
                ComposeCatalogInput.CreatureSummaryInput selected = tableView.getSelectionModel().getSelectedItem();
                if (selected == null || event.getCode() != KeyCode.ENTER) {
                    return;
                }
                if (event.isShiftDown()) {
                    runRowAction(selected);
                } else {
                    showStatblock(selected);
                }
                event.consume();
            });
        }

        private void applyCriteria(ComposeCatalogInput.CriteriaInput input) {
            criteria = input == null ? emptyCriteria() : input;
            resetAndSearch();
        }

        private void movePage(int delta) {
            int candidateOffset = Math.max(0, offset + delta);
            if (candidateOffset == offset) {
                return;
            }
            offset = candidateOffset;
            runSearch();
        }

        private void resetAndSearch() {
            offset = 0;
            runSearch();
        }

        private void runSearch() {
            SortOption sortOption = sortComboBox.getValue();
            ComposeCatalogInput.SearchedCreaturesInput searched = input.catalog().searchCreatures().apply(
                    new ComposeCatalogInput.SearchCreaturesInput(
                            criteria,
                            List.of(),
                            List.of(),
                            new ComposeCatalogInput.PageInput(
                                    sortOption == null ? "name" : sortOption.sortColumn(),
                                    sortOption == null ? "ASC" : sortOption.sortDirection(),
                                    PAGE_SIZE,
                                    offset
                            )
                    )
            );

            if (searched.invalidCriteria()) {
                totalCount = 0;
                tableView.getItems().clear();
                placeholderLabel.setText("Keine Monster gefunden");
                updatePaging();
                return;
            }
            if (!searched.success()) {
                totalCount = 0;
                tableView.getItems().clear();
                placeholderLabel.setText("Der Kreaturenkatalog konnte nicht geladen werden");
                updatePaging();
                return;
            }

            placeholderLabel.setText("Keine Monster gefunden");
            totalCount = searched.totalCount();
            tableView.getItems().setAll(searched.creatures());
            updatePaging();
        }

        private void updatePaging() {
            int currentPage = totalCount == 0 ? 1 : (offset / PAGE_SIZE) + 1;
            int totalPages = Math.max(1, (int) Math.ceil(totalCount / (double) PAGE_SIZE));
            countLabel.setText(totalCount + " Monster gefunden");
            pageLabel.setText("Seite " + currentPage + " / " + totalPages);
            previousButton.setDisable(offset <= 0);
            nextButton.setDisable(offset + PAGE_SIZE >= totalCount);
        }

        private <T> TableCell<ComposeCatalogInput.CreatureSummaryInput, T> createValueCell(Function<T, String> formatter) {
            return new TableCell<>() {
                @Override
                protected void updateItem(T item, boolean empty) {
                    super.updateItem(item, empty);
                    setStyle(TABLE_CELL_STYLE);
                    setText(empty ? null : formatter.apply(item));
                }
            };
        }

        private TableCell<ComposeCatalogInput.CreatureSummaryInput, String> createTextCell() {
            return createValueCell(value -> value == null ? "" : value);
        }

        private void styleComboBox(ComboBox<SortOption> comboBox) {
            comboBox.setStyle(COMBO_STYLE);
            comboBox.setButtonCell(new ListCell<>() {
                @Override
                protected void updateItem(SortOption item, boolean empty) {
                    super.updateItem(item, empty);
                    setText(empty || item == null ? null : item.label());
                    setStyle(COMBO_CELL_STYLE);
                }
            });
            comboBox.setCellFactory(listView -> new ListCell<>() {
                @Override
                protected void updateItem(SortOption item, boolean empty) {
                    super.updateItem(item, empty);
                    setText(empty || item == null ? null : item.label());
                    setStyle(COMBO_CELL_STYLE);
                }
            });
        }

        private void applyTableHeaderStyles() {
            tableView.lookupAll(".column-header-background").forEach(node ->
                    node.setStyle("-fx-background-color: -sm-bg-elevated;"));
            tableView.lookupAll(".filler").forEach(node ->
                    node.setStyle("-fx-background-color: -sm-bg-elevated;"));
            tableView.lookupAll(".column-header").forEach(node ->
                    node.setStyle("-fx-background-color: -sm-bg-elevated; -fx-border-color: transparent transparent -sm-border-subtle transparent;"));
            tableView.lookupAll(".column-header .label").forEach(node ->
                    node.setStyle("-fx-text-fill: -sm-text-secondary; -fx-font-size: 11px;"));
        }

        private void applyRowStyle(TableRow<?> row) {
            if (row.isEmpty()) {
                row.setStyle(TABLE_STYLE);
                return;
            }
            row.setStyle(row.isSelected() ? TABLE_ROW_SELECTED_STYLE : TABLE_ROW_STYLE);
        }

        private void showStatblock(ComposeCatalogInput.CreatureSummaryInput creature) {
            if (creature == null || input.showCreatureStatblock() == null) {
                return;
            }
            input.showCreatureStatblock().accept(
                    new ComposeStatblockInput.ShowCreatureStatblockInput(creature.creatureId(), null)
            );
        }

        private void runRowAction(ComposeCatalogInput.CreatureSummaryInput creature) {
            if (creature == null || input.rowAction() == null) {
                return;
            }
            input.rowAction().accept(new ComposeBrowserInput.RowActionInput(
                    creature.creatureId(),
                    creature.name()
            ));
        }

        private static ComposeCatalogInput.CriteriaInput emptyCriteria() {
            return new ComposeCatalogInput.CriteriaInput(
                    null,
                    null,
                    null,
                    List.of(),
                    List.of(),
                    List.of(),
                    List.of(),
                    List.of()
            );
        }

        private static String normalizeActionLabel(String value) {
            return value == null || value.isBlank() ? "+Add" : value.trim();
        }

        private record SortOption(
                String label,
                String sortColumn,
                String sortDirection
        ) {
            @Override
            public String toString() {
                return label;
            }
        }
    }
}
