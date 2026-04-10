package clean.creatures.browser;

import clean.creatures.browser.input.ComposeBrowserInput;
import clean.creatures.catalog.input.ComposeCatalogInput;
import clean.creatures.statblock.input.ComposeStatblockInput;
import javafx.beans.property.ReadOnlyObjectWrapper;
import javafx.geometry.Insets;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.CheckBox;
import javafx.scene.control.ComboBox;
import javafx.scene.control.Label;
import javafx.scene.control.ScrollPane;
import javafx.scene.control.Separator;
import javafx.scene.control.TableCell;
import javafx.scene.control.TableColumn;
import javafx.scene.control.TableView;
import javafx.scene.control.TextField;
import javafx.scene.control.TitledPane;
import javafx.scene.layout.BorderPane;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;

import java.util.ArrayList;
import java.util.List;

/**
 * Reusable clean creature browser hosted by Encounter today and reusable by later clean features.
 */
@SuppressWarnings("unused")
public final class BrowserObject {

    private final ComposeBrowserInput.BrowserInput browser;

    public BrowserObject(ComposeBrowserInput input) {
        ComposeBrowserInput resolvedInput = java.util.Objects.requireNonNull(input, "input");
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

        private final ComposeBrowserInput input;
        private final TextField searchField = new TextField();
        private final ComboBox<String> minCrComboBox = new ComboBox<>();
        private final ComboBox<String> maxCrComboBox = new ComboBox<>();
        private final ComboBox<SortOption> sortComboBox = new ComboBox<>();
        private final ComboBox<DirectionOption> directionComboBox = new ComboBox<>();
        private final Label countLabel = new Label("0 Treffer");
        private final Label statusLabel = new Label();
        private final Label pageLabel = new Label("Seite 1");
        private final TableView<ComposeCatalogInput.CreatureSummaryInput> tableView = new TableView<>();
        private final Button previousButton = new Button("Zurueck");
        private final Button nextButton = new Button("Weiter");
        private final FilterGroup sizesGroup = new FilterGroup("Groessen");
        private final FilterGroup typesGroup = new FilterGroup("Typen");
        private final FilterGroup subtypesGroup = new FilterGroup("Subtypen");
        private final FilterGroup biomesGroup = new FilterGroup("Biomes");
        private final FilterGroup alignmentsGroup = new FilterGroup("Ausrichtung");
        private int offset;
        private int totalCount;

        private BrowserAssembly(ComposeBrowserInput input) {
            this.input = input;
        }

        private ComposeBrowserInput.BrowserInput composeBrowser() {
            configureControls();
            configureTable();
            loadFilterOptions();
            runSearch();
            return new ComposeBrowserInput.BrowserInput(
                    createControlsContent(),
                    createMainContent()
            );
        }

        private void configureControls() {
            searchField.setPromptText("Kreatur suchen");
            searchField.setOnAction(event -> resetAndSearch());

            sortComboBox.getItems().setAll(
                    new SortOption("Name", "name"),
                    new SortOption("CR", "cr"),
                    new SortOption("Typ", "type"),
                    new SortOption("Groesse", "size")
            );
            sortComboBox.getSelectionModel().selectFirst();

            directionComboBox.getItems().setAll(
                    new DirectionOption("Aufsteigend", "ASC"),
                    new DirectionOption("Absteigend", "DESC")
            );
            directionComboBox.getSelectionModel().selectFirst();

            previousButton.getStyleClass().addAll("button", "compact", "flat");
            nextButton.getStyleClass().addAll("button", "compact", "flat");
            previousButton.setOnAction(event -> movePage(-PAGE_SIZE));
            nextButton.setOnAction(event -> movePage(PAGE_SIZE));

            countLabel.getStyleClass().add("text-muted");
            statusLabel.getStyleClass().add("text-muted");
            statusLabel.setWrapText(true);
            pageLabel.getStyleClass().add("text-muted");
        }

        private Node createControlsContent() {
            Button searchButton = new Button("Suchen");
            searchButton.getStyleClass().addAll("button", "compact");
            searchButton.setOnAction(event -> resetAndSearch());

            Button resetButton = new Button("Reset");
            resetButton.getStyleClass().addAll("button", "compact", "flat");
            resetButton.setOnAction(event -> resetFilters());

            HBox crRow = new HBox(8, wrapControl("CR min", minCrComboBox), wrapControl("CR max", maxCrComboBox));
            HBox sortRow = new HBox(8, wrapControl("Sortierung", sortComboBox), wrapControl("Richtung", directionComboBox));

            VBox controls = new VBox(
                    10,
                    createSectionLabel("Kreaturen"),
                    createMutedLabel("Der erste Clean-Creature-Slice haengt hier bereits den wiederverwendbaren Browser ein."),
                    wrapControl("Suche", searchField),
                    crRow,
                    sortRow,
                    new HBox(8, searchButton, resetButton),
                    new Separator(),
                    sizesGroup.pane(),
                    typesGroup.pane(),
                    subtypesGroup.pane(),
                    biomesGroup.pane(),
                    alignmentsGroup.pane()
            );
            controls.setFillWidth(true);
            controls.setPadding(new Insets(12));
            return new ScrollPane(controls) {{
                setFitToWidth(true);
                setHbarPolicy(ScrollBarPolicy.NEVER);
            }};
        }

        private Node createMainContent() {
            VBox content = new VBox(8);
            content.setPadding(new Insets(12));
            content.setFillWidth(true);

            Label titleLabel = createSectionLabel("Creature Browser");
            Region spacer = new Region();
            HBox.setHgrow(spacer, Priority.ALWAYS);
            HBox header = new HBox(8, titleLabel, spacer, countLabel, pageLabel);

            HBox pagination = new HBox(8, previousButton, nextButton);

            VBox.setVgrow(tableView, Priority.ALWAYS);
            content.getChildren().addAll(header, statusLabel, tableView, pagination);

            BorderPane pane = new BorderPane(content);
            return pane;
        }

        private void configureTable() {
            tableView.setColumnResizePolicy(TableView.CONSTRAINED_RESIZE_POLICY_SUBSEQUENT_COLUMNS);
            tableView.setPlaceholder(createMutedLabel("Keine Kreaturen gefunden"));

            TableColumn<ComposeCatalogInput.CreatureSummaryInput, ComposeCatalogInput.CreatureSummaryInput> nameColumn =
                    new TableColumn<>("Name");
            nameColumn.setCellValueFactory(data -> new ReadOnlyObjectWrapper<>(data.getValue()));
            nameColumn.setCellFactory(column -> new TableCell<>() {
                private final Button button = new Button();

                {
                    button.getStyleClass().addAll("button", "compact", "flat");
                    button.setMaxWidth(Double.MAX_VALUE);
                    button.setOnAction(event -> {
                        ComposeCatalogInput.CreatureSummaryInput item = getItem();
                        if (item == null || input.showCreatureStatblock() == null) {
                            return;
                        }
                        input.showCreatureStatblock().accept(
                                new ComposeStatblockInput.ShowCreatureStatblockInput(item.creatureId(), null)
                        );
                    });
                }

                @Override
                protected void updateItem(ComposeCatalogInput.CreatureSummaryInput item, boolean empty) {
                    super.updateItem(item, empty);
                    if (empty || item == null) {
                        setGraphic(null);
                        return;
                    }
                    button.setText(item.name());
                    setGraphic(button);
                }
            });

            TableColumn<ComposeCatalogInput.CreatureSummaryInput, String> crColumn = new TableColumn<>("CR");
            crColumn.setCellValueFactory(data -> new ReadOnlyObjectWrapper<>(data.getValue().cr()));

            TableColumn<ComposeCatalogInput.CreatureSummaryInput, Integer> xpColumn = new TableColumn<>("XP");
            xpColumn.setCellValueFactory(data -> new ReadOnlyObjectWrapper<>(data.getValue().xp()));

            TableColumn<ComposeCatalogInput.CreatureSummaryInput, String> typeColumn = new TableColumn<>("Typ");
            typeColumn.setCellValueFactory(data -> new ReadOnlyObjectWrapper<>(data.getValue().creatureType()));

            TableColumn<ComposeCatalogInput.CreatureSummaryInput, String> sizeColumn = new TableColumn<>("Groesse");
            sizeColumn.setCellValueFactory(data -> new ReadOnlyObjectWrapper<>(data.getValue().size()));

            tableView.getColumns().setAll(nameColumn, crColumn, xpColumn, typeColumn, sizeColumn);

            if (input.rowAction() != null) {
                TableColumn<ComposeCatalogInput.CreatureSummaryInput, ComposeCatalogInput.CreatureSummaryInput> actionColumn =
                        new TableColumn<>(normalizeActionLabel(input.rowActionLabel()));
                actionColumn.setCellValueFactory(data -> new ReadOnlyObjectWrapper<>(data.getValue()));
                actionColumn.setCellFactory(column -> new TableCell<>() {
                    private final Button button = new Button(normalizeActionLabel(input.rowActionLabel()));

                    {
                        button.getStyleClass().addAll("button", "compact");
                        button.setOnAction(event -> {
                            ComposeCatalogInput.CreatureSummaryInput item = getItem();
                            if (item == null) {
                                return;
                            }
                            input.rowAction().accept(new ComposeBrowserInput.RowActionInput(
                                    item.creatureId(),
                                    item.name()
                            ));
                        });
                    }

                    @Override
                    protected void updateItem(ComposeCatalogInput.CreatureSummaryInput item, boolean empty) {
                        super.updateItem(item, empty);
                        setGraphic(empty || item == null ? null : button);
                    }
                });
                tableView.getColumns().add(actionColumn);
            }
        }

        private void loadFilterOptions() {
            ComposeCatalogInput.LoadedFilterOptionsInput loaded = input.catalog().loadFilterOptions().apply(
                    new ComposeCatalogInput.LoadFilterOptionsInput()
            );
            minCrComboBox.getItems().setAll(loaded.crValues());
            maxCrComboBox.getItems().setAll(loaded.crValues());
            sizesGroup.setValues(loaded.sizes());
            typesGroup.setValues(loaded.types());
            subtypesGroup.setValues(loaded.subtypes());
            biomesGroup.setValues(loaded.biomes());
            alignmentsGroup.setValues(loaded.alignments());
            if (!loaded.success()) {
                statusLabel.setText("Filteroptionen konnten nicht vollstaendig geladen werden.");
            }
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

        private void resetFilters() {
            searchField.clear();
            minCrComboBox.getSelectionModel().clearSelection();
            maxCrComboBox.getSelectionModel().clearSelection();
            sortComboBox.getSelectionModel().selectFirst();
            directionComboBox.getSelectionModel().selectFirst();
            sizesGroup.clear();
            typesGroup.clear();
            subtypesGroup.clear();
            biomesGroup.clear();
            alignmentsGroup.clear();
            resetAndSearch();
        }

        private void runSearch() {
            SortOption sortOption = sortComboBox.getValue();
            DirectionOption directionOption = directionComboBox.getValue();
            ComposeCatalogInput.SearchCreaturesInput searchInput = new ComposeCatalogInput.SearchCreaturesInput(
                    new ComposeCatalogInput.CriteriaInput(
                            searchField.getText(),
                            minCrComboBox.getValue(),
                            maxCrComboBox.getValue(),
                            sizesGroup.selectedValues(),
                            typesGroup.selectedValues(),
                            subtypesGroup.selectedValues(),
                            biomesGroup.selectedValues(),
                            alignmentsGroup.selectedValues()
                    ),
                    List.of(),
                    List.of(),
                    new ComposeCatalogInput.PageInput(
                            sortOption == null ? "name" : sortOption.sortColumn(),
                            directionOption == null ? "ASC" : directionOption.sortDirection(),
                            PAGE_SIZE,
                            offset
                    )
            );

            ComposeCatalogInput.SearchedCreaturesInput searched = input.catalog().searchCreatures().apply(searchInput);
            if (searched.invalidCriteria()) {
                totalCount = 0;
                tableView.getItems().clear();
                statusLabel.setText("Der gewaehlt CR-Bereich ist ungueltig.");
                updatePaging();
                return;
            }
            if (!searched.success()) {
                totalCount = 0;
                tableView.getItems().clear();
                statusLabel.setText("Der Clean-Kreaturenkatalog konnte nicht geladen werden.");
                updatePaging();
                return;
            }

            totalCount = searched.totalCount();
            tableView.getItems().setAll(searched.creatures());
            statusLabel.setText(searched.creatures().isEmpty()
                    ? "Keine Treffer fuer die aktuelle Filterkombination."
                    : "");
            updatePaging();
        }

        private void updatePaging() {
            int currentPage = totalCount == 0 ? 1 : (offset / PAGE_SIZE) + 1;
            int totalPages = Math.max(1, (int) Math.ceil(totalCount / (double) PAGE_SIZE));
            countLabel.setText(totalCount + " Treffer");
            pageLabel.setText("Seite " + currentPage + " / " + totalPages);
            previousButton.setDisable(offset <= 0);
            nextButton.setDisable(offset + PAGE_SIZE >= totalCount);
        }

        private static VBox wrapControl(String labelText, Node control) {
            Label label = createMutedLabel(labelText);
            VBox wrapper = new VBox(4, label, control);
            wrapper.setFillWidth(true);
            if (control instanceof Region region) {
                region.setMaxWidth(Double.MAX_VALUE);
            }
            return wrapper;
        }

        private static Label createSectionLabel(String text) {
            Label label = new Label(text);
            label.getStyleClass().add("subheading");
            return label;
        }

        private static Label createMutedLabel(String text) {
            Label label = new Label(text);
            label.getStyleClass().add("text-muted");
            label.setWrapText(true);
            return label;
        }

        private static String normalizeActionLabel(String value) {
            return value == null || value.isBlank() ? "Aktion" : value.trim();
        }

        private record SortOption(
                String label,
                String sortColumn
        ) {
            @Override
            public String toString() {
                return label;
            }
        }

        private record DirectionOption(
                String label,
                String sortDirection
        ) {
            @Override
            public String toString() {
                return label;
            }
        }

        private static final class FilterGroup {
            private final VBox content = new VBox(4);
            private final TitledPane pane;
            private final List<CheckBox> checkBoxes = new ArrayList<>();

            private FilterGroup(String title) {
                pane = new TitledPane(title, content);
                pane.setExpanded(false);
                pane.setAnimated(false);
            }

            private void setValues(List<String> values) {
                content.getChildren().clear();
                checkBoxes.clear();
                for (String value : values) {
                    if (value == null || value.isBlank()) {
                        continue;
                    }
                    CheckBox checkBox = new CheckBox(value);
                    checkBoxes.add(checkBox);
                    content.getChildren().add(checkBox);
                }
                if (checkBoxes.isEmpty()) {
                    content.getChildren().add(createMutedLabel("Keine Optionen"));
                }
            }

            private List<String> selectedValues() {
                return checkBoxes.stream()
                        .filter(CheckBox::isSelected)
                        .map(CheckBox::getText)
                        .toList();
            }

            private void clear() {
                checkBoxes.forEach(checkBox -> checkBox.setSelected(false));
            }

            private TitledPane pane() {
                return pane;
            }
        }
    }
}
