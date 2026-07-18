package features.catalog.adapter.javafx;

import features.catalog.application.CatalogSectionId;
import features.catalog.application.ItemsCatalogFilterDraft;
import features.catalog.application.ItemsCatalogIntent;
import features.catalog.application.ItemsCatalogState;
import features.items.api.ItemsCatalogApi;
import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.ComboBox;
import javafx.scene.control.Label;
import javafx.scene.control.TextField;
import javafx.scene.layout.VBox;
import javafx.util.StringConverter;

/** Passive Items renderer backed only by immutable application state. */
public final class ItemsCatalogSection implements CatalogSection {

    private static final String ALL = "Alle";

    private final Consumer<ItemsCatalogIntent> intents;
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
    private final Button open = new Button("Details öffnen");
    private final Label status = new Label();
    private final VBox controls;
    private final CatalogTableScaffold<ItemsCatalogApi.ItemRow, String> content;
    private ItemsCatalogState state;
    private long renderedRevision = -1L;
    private boolean rendering;

    public ItemsCatalogSection(Consumer<ItemsCatalogIntent> intents) {
        this.intents = Objects.requireNonNull(intents, "intents");
        controls = configureFilters();
        content = new CatalogTableScaffold<>(
                "Item-Ergebnisse",
                ItemsCatalogApi.ItemRow::sourceKey,
                ItemsCatalogApi.ItemRow::name,
                List.of(
                        new CatalogTableScaffold.ColumnSpec<>("Name", ItemsCatalogApi.ItemRow::name),
                        new CatalogTableScaffold.ColumnSpec<>("Kategorie",
                                item -> joined(item.category(), item.subcategory())),
                        new CatalogTableScaffold.ColumnSpec<>("Seltenheit",
                                item -> shown(item.rarity())),
                        new CatalogTableScaffold.ColumnSpec<>("Magie",
                                item -> yesNo(item.magic())),
                        new CatalogTableScaffold.ColumnSpec<>("Kosten",
                                item -> shown(item.costDisplay()))),
                row -> this.intents.accept(new ItemsCatalogIntent.OpenItem(row.sourceKey())),
                key -> this.intents.accept(new ItemsCatalogIntent.SelectItem(key.orElse(""))),
                List.of(),
                new CatalogTableScaffold.Paging(
                        pageDirection -> this.intents.accept(new ItemsCatalogIntent.ShiftPage(pageDirection))));
        content.configurePaging(
                "Zurück", "Vorherige Item-Seite", "Weiter", "Nächste Item-Seite", "Item-Seite", " von ");
        status.setAccessibleText("Item-Aktionsstatus");
        status.getStyleClass().add("text-secondary");
        open.setAccessibleText("Ausgewähltes Item im Inspector öffnen");
        open.disableProperty().bind(content.table().getSelectionModel().selectedItemProperty().isNull());
        open.setOnAction(ignored -> {
            if (state != null) {
                this.intents.accept(new ItemsCatalogIntent.OpenItem(state.selectedSourceKey()));
            }
        });
        content.setHeaderControl(open);
        content.setHeaderControl(status);
        installDraftListeners();
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

    public void render(ItemsCatalogState next) {
        state = Objects.requireNonNull(next, "next");
        if (state.revision() == renderedRevision) {
            return;
        }
        renderedRevision = state.revision();
        rendering = true;
        try {
            applyOptions(category, state.filterOptions().categories());
            applyOptions(subcategory, state.filterOptions().subcategories());
            applyOptions(rarity, state.filterOptions().rarities());
            applyDraft(state.filterDraft());
            content.render(
                    state.results(),
                    state.selectedSourceKey().isBlank() ? null : state.selectedSourceKey(),
                    state.totalCount(), state.pageSize(), state.pageOffset(), "Items");
            status.setText(state.actionMessage());
        } finally {
            rendering = false;
        }
    }

    private VBox configureFilters() {
        Button find = new Button("Items suchen");
        find.getStyleClass().add("accent");
        find.setAccessibleText("Items suchen");
        find.setOnAction(ignored -> intents.accept(new ItemsCatalogIntent.Search()));
        search.setOnAction(ignored -> intents.accept(new ItemsCatalogIntent.Search()));
        minimumCost.setOnAction(ignored -> intents.accept(new ItemsCatalogIntent.Search()));
        maximumCost.setOnAction(ignored -> intents.accept(new ItemsCatalogIntent.Search()));
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

    private void installDraftListeners() {
        search.textProperty().addListener((ignored, before, after) -> publishDraft());
        minimumCost.textProperty().addListener((ignored, before, after) -> publishDraft());
        maximumCost.textProperty().addListener((ignored, before, after) -> publishDraft());
        category.valueProperty().addListener((ignored, before, after) -> publishDraft());
        subcategory.valueProperty().addListener((ignored, before, after) -> publishDraft());
        rarity.valueProperty().addListener((ignored, before, after) -> publishDraft());
        magic.valueProperty().addListener((ignored, before, after) -> publishDraft());
        attunement.valueProperty().addListener((ignored, before, after) -> publishDraft());
        sort.valueProperty().addListener((ignored, before, after) -> publishDraft());
        direction.valueProperty().addListener((ignored, before, after) -> publishDraft());
    }

    private void publishDraft() {
        if (rendering) {
            return;
        }
        intents.accept(new ItemsCatalogIntent.ChangeDraft(new ItemsCatalogFilterDraft(
                search.getText(), selectedFilter(category), selectedFilter(subcategory), selectedFilter(rarity),
                booleanValue(magic), booleanValue(attunement), minimumCost.getText(), maximumCost.getText(),
                sort.getValue(), direction.getValue() != SortDirection.DESCENDING)));
    }

    private void applyDraft(ItemsCatalogFilterDraft draft) {
        search.setText(draft.name());
        category.setValue(shownFilter(draft.category()));
        subcategory.setValue(shownFilter(draft.subcategory()));
        rarity.setValue(shownFilter(draft.rarity()));
        magic.setValue(BooleanChoice.from(draft.magic()));
        attunement.setValue(BooleanChoice.from(draft.attunement()));
        minimumCost.setText(draft.minimumCostCp());
        maximumCost.setText(draft.maximumCostCp());
        sort.setValue(draft.sortField());
        direction.setValue(draft.ascending() ? SortDirection.ASCENDING : SortDirection.DESCENDING);
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
            @Override public String toString(ItemsCatalogApi.SortField value) {
                return value == null ? "" : switch (value) {
                    case NAME -> "Name";
                    case CATEGORY -> "Kategorie";
                    case RARITY -> "Seltenheit";
                    case COST -> "Kosten";
                };
            }

            @Override public ItemsCatalogApi.SortField fromString(String value) {
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
        box.getItems().addAll(options);
        box.setValue(box.getItems().contains(selected) ? selected : ALL);
    }

    private static String selectedFilter(ComboBox<String> box) {
        String value = box.getValue();
        return value == null || ALL.equals(value) ? "" : value;
    }

    private static String shownFilter(String value) {
        return value == null || value.isBlank() ? ALL : value;
    }

    private static Boolean booleanValue(ComboBox<BooleanChoice> box) {
        return box.getValue() == null ? null : box.getValue().value();
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

    private enum BooleanChoice {
        ALL("Alle", null), YES("Ja", true), NO("Nein", false);

        private final String label;
        private final Boolean value;

        BooleanChoice(String label, Boolean value) {
            this.label = label;
            this.value = value;
        }

        static BooleanChoice from(Boolean value) {
            return value == null ? ALL : value ? YES : NO;
        }

        @Override public String toString() {
            return label;
        }

        private Boolean value() {
            return value;
        }
    }

    private enum SortDirection {
        ASCENDING("Aufsteigend"), DESCENDING("Absteigend");

        private final String label;

        SortDirection(String label) {
            this.label = label;
        }

        @Override public String toString() {
            return label;
        }
    }
}
