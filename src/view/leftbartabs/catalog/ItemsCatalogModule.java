package src.view.leftbartabs.catalog;

import java.util.List;
import java.util.function.Consumer;
import javafx.application.Platform;
import javafx.geometry.Pos;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.ComboBox;
import javafx.scene.control.Label;
import javafx.scene.control.ListCell;
import javafx.scene.control.ListView;
import javafx.scene.control.TextField;
import javafx.scene.input.KeyCode;
import javafx.scene.layout.FlowPane;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.VBox;
import org.jspecify.annotations.Nullable;
import shell.api.InspectorEntrySpec;
import shell.api.InspectorSink;
import src.domain.items.ItemsCatalogApi;
import src.domain.items.ItemsCatalogApi.ItemDetail;
import src.domain.items.ItemsCatalogApi.ItemFilterOptions;
import src.domain.items.ItemsCatalogApi.ItemPageResult;
import src.domain.items.ItemsCatalogApi.ItemQuery;
import src.domain.items.ItemsCatalogApi.ItemRow;
import src.domain.items.ItemsCatalogApi.SortField;

final class ItemsCatalogModule {

    private static final int PAGE_SIZE = 50;
    private final ItemsCatalogApi items;
    private final InspectorSink inspector;
    private final TextField search = new TextField();
    private final ComboBox<String> category = choice("Alle Kategorien");
    private final ComboBox<String> subcategory = choice("Alle Unterkategorien");
    private final ComboBox<String> rarity = choice("Alle Seltenheiten");
    private final ComboBox<String> magic = fixedChoice("Alle Items", "Magisch", "Nicht-magisch");
    private final ComboBox<String> attunement = fixedChoice("Attunement egal", "Attunement", "Kein Attunement");
    private final TextField minimumCost = costField("Kosten min (KM)");
    private final TextField maximumCost = costField("Kosten max (KM)");
    private final ComboBox<SortField> sort = new ComboBox<>();
    private final ComboBox<String> direction = fixedChoice("Aufsteigend", "Absteigend");
    private final ListView<ItemRow> rows = new ListView<>();
    private final Label status = new Label();
    private final Button previous = new Button("Zurück");
    private final Button next = new Button("Weiter");
    private final VBox controls = new VBox(8);
    private final VBox main = new VBox(8);
    private int pageOffset;
    private int totalCount;

    ItemsCatalogModule(ItemsCatalogApi items, InspectorSink inspector) {
        this.items = items;
        this.inspector = inspector;
        configure();
        loadFilters();
        refresh();
    }

    Node controls() {
        return controls;
    }

    Node main() {
        return main;
    }

    void activate() {
        refresh();
    }

    private void configure() {
        search.setPromptText("Items durchsuchen");
        search.setOnKeyPressed(event -> {
            if (event.getCode() == KeyCode.ENTER) {
                pageOffset = 0;
                refresh();
            }
        });
        sort.getItems().setAll(SortField.values());
        sort.setValue(SortField.NAME);
        Button apply = new Button("Anwenden");
        apply.setOnAction(event -> {
            pageOffset = 0;
            refresh();
        });
        FlowPane filters = new FlowPane(6, 6, search, category, subcategory, rarity, magic, attunement,
                minimumCost, maximumCost, sort, direction, apply);
        filters.getStyleClass().add("catalog-item-filters");
        controls.getChildren().setAll(sectionTitle("ITEMS · READ ONLY"), filters);

        rows.setCellFactory(ignored -> new ItemCell());
        rows.setOnMouseClicked(event -> openSelected());
        rows.setOnKeyPressed(event -> {
            if (event.getCode() == KeyCode.ENTER) {
                openSelected();
            }
        });
        previous.setOnAction(event -> shift(-PAGE_SIZE));
        next.setOnAction(event -> shift(PAGE_SIZE));
        HBox footer = new HBox(8, previous, next, status);
        footer.setAlignment(Pos.CENTER_LEFT);
        main.getChildren().setAll(rows, footer);
        main.setVgrow(rows, Priority.ALWAYS);
    }

    private void loadFilters() {
        items.loadFilterOptions().thenAccept(options -> onUi(options, this::renderFilters));
    }

    private void renderFilters(ItemFilterOptions options) {
        setOptions(category, "Alle Kategorien", options.categories());
        setOptions(subcategory, "Alle Unterkategorien", options.subcategories());
        setOptions(rarity, "Alle Seltenheiten", options.rarities());
    }

    private void refresh() {
        items.search(query()).thenAccept(result -> onUi(result, this::renderPage));
    }

    private void renderPage(ItemPageResult result) {
        rows.getItems().setAll(result.rows());
        totalCount = result.totalCount();
        pageOffset = result.pageOffset();
        previous.setDisable(pageOffset <= 0);
        next.setDisable(pageOffset + PAGE_SIZE >= totalCount);
        status.setText(statusText(result));
    }

    private ItemQuery query() {
        return new ItemQuery(
                text(search), selectedFilter(category), selectedFilter(subcategory), selectedFilter(rarity),
                selectedBoolean(magic, "Magisch", "Nicht-magisch"),
                selectedBoolean(attunement, "Attunement", "Kein Attunement"),
                integer(minimumCost), integer(maximumCost), sort.getValue(),
                !"Absteigend".equals(direction.getValue()), PAGE_SIZE, pageOffset);
    }

    private void shift(int delta) {
        pageOffset = Math.max(0, pageOffset + delta);
        refresh();
    }

    private void openSelected() {
        ItemRow selected = rows.getSelectionModel().getSelectedItem();
        if (selected == null) {
            return;
        }
        items.loadDetail(selected.sourceKey()).thenAccept(result -> onUi(result, detailResult -> {
            openDetailResult(selected, detailResult);
        }));
    }

    private void openDetailResult(ItemRow selected, ItemsCatalogApi.ItemDetailResult result) {
        if (result.detail() == null) {
            status.setText("Item-Details konnten nicht geladen werden.");
            return;
        }
        ItemDetail detail = result.detail();
        inspector.push(new InspectorEntrySpec(
                detail.name(),
                "item:" + detail.sourceKey(),
                () -> detailView(detail),
                null));
    }

    private static <T> void onUi(T value, Consumer<T> action) {
        if (Platform.isFxApplicationThread()) {
            action.accept(value);
        } else {
            Platform.runLater(() -> action.accept(value));
        }
    }

    private static Node detailView(ItemDetail detail) {
        VBox view = new VBox(8);
        view.getStyleClass().add("item-detail");
        view.getChildren().add(sectionTitle(detail.category() + categorySuffix(detail.subcategory())));
        addLine(view, "Seltenheit", detail.rarity());
        addLine(view, "Kosten", detail.costDisplay());
        addLine(view, "Gewicht", detail.weight() == null ? "" : detail.weight().toString());
        addLine(view, "Schaden", detail.damage());
        addLine(view, "Rüstung", detail.armorClass());
        addLine(view, "Eigenschaften", String.join(", ", detail.properties()));
        addLine(view, "Attunement", detail.attunement() ? "Erforderlich" : "Nein");
        addLine(view, "Beschreibung", detail.description());
        addLine(view, "Quelle", detail.sourceVersion() + " · " + detail.sourceUrl());
        return view;
    }

    private static void addLine(VBox view, String title, String value) {
        if (value == null || value.isBlank()) {
            return;
        }
        Label heading = new Label(title);
        heading.getStyleClass().add("text-muted");
        Label content = new Label(value);
        content.setWrapText(true);
        view.getChildren().add(new VBox(2, heading, content));
    }

    private static String statusText(ItemPageResult result) {
        return switch (result.status()) {
            case SUCCESS -> result.totalCount() + " Items";
            case INVALID_QUERY -> "Ungültiger Kostenbereich.";
            case UNAVAILABLE -> "Keine Item-Daten importiert. Gradle-Task importSrdItems ausführen.";
            default -> "Item-Katalog konnte nicht geladen werden.";
        };
    }

    private static Label sectionTitle(String text) {
        Label label = new Label(text);
        label.getStyleClass().add("catalog-section-title");
        return label;
    }

    private static ComboBox<String> choice(String first) {
        return fixedChoice(first);
    }

    private static ComboBox<String> fixedChoice(String... values) {
        ComboBox<String> combo = new ComboBox<>();
        combo.getItems().setAll(values);
        combo.setValue(values[0]);
        return combo;
    }

    private static TextField costField(String prompt) {
        TextField field = new TextField();
        field.setPromptText(prompt);
        field.setPrefColumnCount(10);
        return field;
    }

    private static void setOptions(ComboBox<String> combo, String first, List<String> values) {
        combo.getItems().setAll(first);
        combo.getItems().addAll(values);
        combo.setValue(first);
    }

    private static @Nullable String selectedFilter(ComboBox<String> combo) {
        String value = combo.getValue();
        return value == null || value.startsWith("Alle ") ? null : value;
    }

    private static @Nullable Boolean selectedBoolean(ComboBox<String> combo, String yes, String no) {
        if (yes.equals(combo.getValue())) {
            return Boolean.TRUE;
        }
        return no.equals(combo.getValue()) ? Boolean.FALSE : null;
    }

    private static @Nullable Integer integer(TextField field) {
        try {
            return field.getText().isBlank() ? null : Integer.valueOf(field.getText().trim());
        } catch (NumberFormatException exception) {
            return Integer.valueOf(-1);
        }
    }

    private static @Nullable String text(TextField field) {
        return field.getText().isBlank() ? null : field.getText().trim();
    }

    private static String categorySuffix(String subcategory) {
        return subcategory.isBlank() ? "" : " · " + subcategory;
    }

    private static final class ItemCell extends ListCell<ItemRow> {
        @Override
        protected void updateItem(ItemRow item, boolean empty) {
            super.updateItem(item, empty);
            setText(empty || item == null ? null : item.name() + "  ·  " + item.category()
                    + categorySuffix(item.subcategory()) + (item.rarity().isBlank() ? "" : "  ·  " + item.rarity()));
        }
    }
}
