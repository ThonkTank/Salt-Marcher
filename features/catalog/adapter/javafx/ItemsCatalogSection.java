package features.catalog.adapter.javafx;

import features.catalog.application.CatalogApplicationRoutes.ItemInspectorRoute;
import features.catalog.application.CatalogRequestToken;
import features.catalog.application.CatalogSectionId;
import features.catalog.application.CatalogWorkspaceController;
import features.items.api.ItemsCatalogApi;
import java.util.List;
import java.util.Objects;
import javafx.beans.property.SimpleStringProperty;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.ComboBox;
import javafx.scene.control.Label;
import javafx.scene.control.TableColumn;
import javafx.scene.control.TableView;
import javafx.scene.control.TextField;
import javafx.scene.input.KeyCode;
import javafx.scene.input.MouseButton;
import javafx.scene.layout.BorderPane;
import javafx.scene.layout.HBox;
import javafx.scene.layout.VBox;
import javafx.util.StringConverter;
import org.jspecify.annotations.Nullable;

/** Persistent Items query controls and result surface. */
public final class ItemsCatalogSection implements CatalogSection {

    private static final int PAGE_SIZE = 50;
    private static final String ALL = "Alle";

    private final ItemsCatalogApi items;
    private final ItemInspectorRoute itemInspector;
    private final CatalogWorkspaceController controller;
    private final TextField search = textField("Item-Name", "Name enthält …");
    private final ComboBox<String> category = filterBox("Item-Kategorie");
    private final ComboBox<String> subcategory = filterBox("Item-Unterkategorie");
    private final ComboBox<String> rarity = filterBox("Item-Seltenheit");
    private final ComboBox<BooleanChoice> magic = booleanBox("Item-Magie");
    private final ComboBox<BooleanChoice> attunement = booleanBox("Item-Attunement");
    private final TextField minimumCost = textField("Item-Minimalkosten", "Min. CP");
    private final TextField maximumCost = textField("Item-Maximalkosten", "Max. CP");
    private final ComboBox<ItemsCatalogApi.SortField> sort = sortBox();
    private final ComboBox<SortDirection> direction = directionBox();
    private final TableView<ItemsCatalogApi.ItemRow> rows = new TableView<>();
    private final Label status = new Label();
    private final Label page = new Label("Seite –");
    private final Button previous = new Button("Zurück");
    private final Button next = new Button("Weiter");
    private final Button open = new Button("Details öffnen");
    private final VBox controls;
    private final BorderPane content = new BorderPane();
    private int pageOffset;
    private int totalCount;
    private boolean activated;

    public ItemsCatalogSection(
            ItemsCatalogApi items,
            ItemInspectorRoute itemInspector,
            CatalogWorkspaceController controller
    ) {
        this.items = Objects.requireNonNull(items, "items");
        this.itemInspector = Objects.requireNonNull(itemInspector, "itemInspector");
        this.controller = Objects.requireNonNull(controller, "controller");
        controls = configureFilters();
        configureRows();
        configurePaging();
    }

    @Override
    public CatalogSectionId id() {
        return CatalogSectionId.ITEMS;
    }

    @Override
    public Node controls() {
        return controls;
    }

    @Override
    public Node content() {
        return content;
    }

    @Override
    public void activate() {
        if (activated) {
            return;
        }
        activated = true;
        refresh();
    }

    @Override
    public void deactivate() {
        activated = false;
    }

    void refresh() {
        loadFilterOptions();
        searchFirstPage();
    }

    private VBox configureFilters() {
        Button find = new Button("Items suchen");
        find.getStyleClass().add("accent");
        find.setAccessibleText("Items suchen");
        find.setOnAction(ignored -> searchFirstPage());
        search.setOnAction(ignored -> searchFirstPage());
        minimumCost.setOnAction(ignored -> searchFirstPage());
        maximumCost.setOnAction(ignored -> searchFirstPage());
        VBox filters = new VBox(
                field("Name", search),
                field("Kategorie", category),
                field("Unterkategorie", subcategory),
                field("Seltenheit", rarity),
                field("Magisch", magic),
                field("Attunement", attunement),
                field("Kosten ab (CP)", minimumCost),
                field("Kosten bis (CP)", maximumCost),
                field("Sortieren nach", sort),
                field("Richtung", direction),
                find);
        filters.getStyleClass().add("catalog-item-filters");
        return filters;
    }

    private void configureRows() {
        rows.setAccessibleText("Item-Ergebnisse");
        rows.setPlaceholder(new Label("Keine Items gefunden."));
        rows.setColumnResizePolicy(TableView.CONSTRAINED_RESIZE_POLICY);
        rows.getColumns().setAll(
                textColumn("Name", ItemsCatalogApi.ItemRow::name),
                textColumn("Kategorie", item -> joined(item.category(), item.subcategory())),
                textColumn("Seltenheit", item -> shown(item.rarity())),
                textColumn("Magie", item -> yesNo(item.magic())),
                textColumn("Kosten", item -> shown(item.costDisplay())));
        rows.setOnMouseClicked(event -> {
            if (event.getButton() == MouseButton.PRIMARY && event.getClickCount() == 2) {
                openDetail();
            }
        });
        rows.setOnKeyPressed(event -> {
            if (event.getCode() == KeyCode.ENTER) {
                openDetail();
                event.consume();
            }
        });
        rows.getSelectionModel().selectedItemProperty().addListener(
                (ignored, before, after) -> open.setDisable(after == null));
        content.setCenter(rows);
    }

    private void configurePaging() {
        previous.setAccessibleText("Vorherige Item-Seite");
        next.setAccessibleText("Nächste Item-Seite");
        open.setAccessibleText("Ausgewähltes Item im Inspector öffnen");
        status.setAccessibleText("Item-Status");
        page.setAccessibleText("Item-Seite");
        previous.setOnAction(ignored -> previousPage());
        next.setOnAction(ignored -> nextPage());
        open.setOnAction(ignored -> openDetail());
        previous.setDisable(true);
        next.setDisable(true);
        open.setDisable(true);
        HBox footer = new HBox(previous, page, next, open, status);
        footer.getStyleClass().add("catalog-results-footer");
        content.setBottom(footer);
    }

    private void loadFilterOptions() {
        CatalogRequestToken request = controller.beginItemsFilterOptions();
        items.loadFilterOptions().whenComplete((options, failure) -> controller.complete(request, () -> {
            controller.itemsFilterOptionsCompleted(options, failure);
            if (failure != null || options == null
                    || options.status() != ItemsCatalogApi.CatalogStatus.SUCCESS) {
                return;
            }
            applyOptions(category, options.categories());
            applyOptions(subcategory, options.subcategories());
            applyOptions(rarity, options.rarities());
        }));
    }

    private void searchFirstPage() {
        pageOffset = 0;
        searchPage();
    }

    private void previousPage() {
        if (pageOffset > 0) {
            pageOffset = Math.max(0, pageOffset - PAGE_SIZE);
            searchPage();
        }
    }

    private void nextPage() {
        if (pageOffset + PAGE_SIZE < totalCount) {
            pageOffset += PAGE_SIZE;
            searchPage();
        }
    }

    private void searchPage() {
        CatalogRequestToken request = controller.beginItemsSearch();
        ItemsCatalogApi.ItemQuery query;
        try {
            query = query();
        } catch (NumberFormatException exception) {
            controller.itemsInvalidQuery();
            applyFailureState("Ungültige Item-Suche.");
            return;
        }
        controller.itemsSearchStarted(query);
        status.setText("Items werden geladen …");
        page.setText("Seite …");
        rows.getItems().clear();
        previous.setDisable(true);
        next.setDisable(true);
        items.search(query).whenComplete((result, failure) -> controller.complete(request, () -> {
            controller.itemsPageCompleted(result, failure);
            applyPage(result, failure);
        }));
    }

    private ItemsCatalogApi.ItemQuery query() {
        return new ItemsCatalogApi.ItemQuery(
                trimmed(search.getText()), selectedFilter(category), selectedFilter(subcategory),
                selectedFilter(rarity), magic.getValue().value(), attunement.getValue().value(),
                cost(minimumCost), cost(maximumCost), sort.getValue(),
                direction.getValue() == SortDirection.ASCENDING, PAGE_SIZE, pageOffset);
    }

    private void applyPage(ItemsCatalogApi.PageResult result, Throwable failure) {
        if (failure != null || result == null) {
            applyFailureState("Item-Suche konnte nicht ausgeführt werden.");
            return;
        }
        if (result.status() != ItemsCatalogApi.CatalogStatus.SUCCESS) {
            applyFailureState(statusText(result.status()));
            return;
        }
        pageOffset = result.pageOffset();
        totalCount = Math.max(0, result.totalCount());
        rows.getItems().setAll(result.rows());
        status.setText(totalCount == 0 ? "Keine Items gefunden." : totalCount + " Items gefunden.");
        updatePaging(result.pageSize());
    }

    private void applyFailureState(String message) {
        rows.getItems().clear();
        totalCount = 0;
        pageOffset = 0;
        page.setText("Seite –");
        previous.setDisable(true);
        next.setDisable(true);
        status.setText(message);
    }

    private void updatePaging(int resultPageSize) {
        int safePageSize = resultPageSize <= 0 ? PAGE_SIZE : resultPageSize;
        int current = totalCount == 0 ? 0 : pageOffset / safePageSize + 1;
        int pages = totalCount == 0 ? 0 : (totalCount + safePageSize - 1) / safePageSize;
        page.setText("Seite " + current + " von " + pages);
        previous.setDisable(pageOffset <= 0);
        next.setDisable(pageOffset + safePageSize >= totalCount);
    }

    private void openDetail() {
        ItemsCatalogApi.ItemRow selected = rows.getSelectionModel().getSelectedItem();
        if (selected == null) {
            return;
        }
        CatalogRequestToken request = controller.beginItemsDetail();
        status.setText("Item-Details werden geladen …");
        items.loadDetail(selected.sourceKey()).whenComplete((result, failure) -> controller.complete(request, () -> {
            if (failure != null || result == null) {
                status.setText("Item-Details konnten nicht geladen werden.");
            } else if (result.status() != ItemsCatalogApi.CatalogStatus.SUCCESS) {
                status.setText(statusText(result.status()));
            } else if (result.detail() == null) {
                status.setText("Item-Details nicht verfügbar.");
            } else {
                ItemsCatalogApi.ItemDetail detail = result.detail();
                itemInspector.openItem(detail);
                status.setText("Item-Details geöffnet.");
            }
        }));
    }

    private static VBox field(String label, Node control) {
        VBox field = new VBox(new Label(label), control);
        field.getStyleClass().add("catalog-filter-field");
        return field;
    }

    private static TextField textField(String accessibleText, String promptText) {
        TextField field = new TextField();
        field.setAccessibleText(accessibleText);
        field.setPromptText(promptText);
        return field;
    }

    private static ComboBox<String> filterBox(String accessibleText) {
        ComboBox<String> box = new ComboBox<>();
        box.setAccessibleText(accessibleText);
        box.getItems().setAll(ALL);
        box.setValue(ALL);
        return box;
    }

    private static ComboBox<BooleanChoice> booleanBox(String accessibleText) {
        ComboBox<BooleanChoice> box = new ComboBox<>();
        box.setAccessibleText(accessibleText);
        box.getItems().setAll(BooleanChoice.values());
        box.setValue(BooleanChoice.ALL);
        return box;
    }

    private static ComboBox<ItemsCatalogApi.SortField> sortBox() {
        ComboBox<ItemsCatalogApi.SortField> box = new ComboBox<>();
        box.setAccessibleText("Item-Sortierfeld");
        box.getItems().setAll(ItemsCatalogApi.SortField.values());
        box.setConverter(new StringConverter<>() {
            public String toString(ItemsCatalogApi.SortField value) {
                return value == null ? "" : switch (value) {
                    case NAME -> "Name";
                    case CATEGORY -> "Kategorie";
                    case RARITY -> "Seltenheit";
                    case COST -> "Kosten";
                };
            }
            public ItemsCatalogApi.SortField fromString(String value) {
                throw new UnsupportedOperationException("Item sort fields are selected, not parsed.");
            }
        });
        box.setValue(ItemsCatalogApi.SortField.NAME);
        return box;
    }

    private static ComboBox<SortDirection> directionBox() {
        ComboBox<SortDirection> box = new ComboBox<>();
        box.setAccessibleText("Item-Sortierrichtung");
        box.getItems().setAll(SortDirection.values());
        box.setValue(SortDirection.ASCENDING);
        return box;
    }

    private static void applyOptions(ComboBox<String> box, List<String> options) {
        String selected = box.getValue();
        box.getItems().setAll(ALL);
        if (options != null) {
            box.getItems().addAll(options);
        }
        box.setValue(box.getItems().contains(selected) ? selected : ALL);
    }

    private static @Nullable String selectedFilter(ComboBox<String> box) {
        String value = box.getValue();
        return value == null || ALL.equals(value) ? null : value;
    }

    private static @Nullable String trimmed(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private static @Nullable Integer cost(TextField field) {
        String value = field.getText();
        return value == null || value.isBlank() ? null : Integer.valueOf(value.trim());
    }

    private static TableColumn<ItemsCatalogApi.ItemRow, String> textColumn(
            String title,
            java.util.function.Function<ItemsCatalogApi.ItemRow, String> value
    ) {
        TableColumn<ItemsCatalogApi.ItemRow, String> column = new TableColumn<>(title);
        column.setCellValueFactory(cell -> new SimpleStringProperty(value.apply(cell.getValue())));
        return column;
    }

    private static String joined(String first, String second) {
        if (first == null || first.isBlank()) {
            return shown(second);
        }
        return second == null || second.isBlank() ? first : first + " / " + second;
    }

    private static String shown(String value) {
        return value == null || value.isBlank() ? "–" : value;
    }

    private static String yesNo(boolean value) {
        return value ? "Ja" : "Nein";
    }

    private static String statusText(ItemsCatalogApi.CatalogStatus status) {
        return switch (status) {
            case SUCCESS -> "";
            case INVALID_QUERY -> "Ungültige Item-Suche.";
            case UNAVAILABLE -> "Noch kein Item-Katalog importiert.";
            case NOT_FOUND -> "Item nicht gefunden.";
            case STORAGE_ERROR -> "Item-Katalog konnte nicht gelesen werden.";
            case EXECUTION_ERROR -> "Item-Suche konnte nicht ausgeführt werden.";
        };
    }

    private enum BooleanChoice {
        ALL("Alle", null), YES("Ja", true), NO("Nein", false);
        private final String label;
        private final Boolean value;
        BooleanChoice(String label, Boolean value) { this.label = label; this.value = value; }
        public String toString() { return label; }
        private Boolean value() { return value; }
    }

    private enum SortDirection {
        ASCENDING("Aufsteigend"), DESCENDING("Absteigend");
        private final String label;
        SortDirection(String label) { this.label = label; }
        public String toString() { return label; }
    }
}
