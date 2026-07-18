package features.catalog.adapter.javafx;

import features.catalog.application.CatalogSectionId;
import features.catalog.application.ItemsCatalogFilterDraft;
import features.catalog.application.ItemsCatalogIntent;
import features.catalog.application.ItemsCatalogState;
import features.items.api.ItemsCatalogApi;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.function.Consumer;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.ComboBox;
import javafx.scene.control.Label;
import javafx.scene.control.TextField;

/** Passive Items renderer backed only by immutable application state. */
public final class ItemsCatalogSection implements CatalogSection {

    private static final String ALL = "Alle";

    private final Consumer<ItemsCatalogIntent> intents;
    private final TextField search = CatalogControlKit.search("Item-Name", "Items suchen …");
    private final ComboBox<String> category = filterBox("Kategorie", "Item-Kategorie");
    private final ComboBox<String> subcategory = filterBox("Unterkategorie", "Item-Unterkategorie");
    private final ComboBox<String> rarity = filterBox("Seltenheit", "Item-Seltenheit");
    private final ComboBox<BooleanChoice> magic = booleanBox("Magisch", "Item-Magie");
    private final ComboBox<BooleanChoice> attunement = booleanBox("Einstimmung", "Item-Einstimmung");
    private final TextField minimumCost = CatalogControlKit.filterText(
            "Item-Minimalkosten", "Kosten ab (CP)");
    private final TextField maximumCost = CatalogControlKit.filterText(
            "Item-Maximalkosten", "Kosten bis (CP)");
    private final ComboBox<SortChoice> sorting = sortBox();
    private final Button open = CatalogControlKit.action(
            "Details öffnen", "Ausgewähltes Item im Inspector öffnen", false);
    private final Label status = new Label();
    private final CatalogControlsScaffold controls;
    private final CatalogTableScaffold<ItemsCatalogApi.ItemRow, String> content;
    private ItemsCatalogState state;
    private long renderedRevision = -1L;
    private boolean rendering;

    public ItemsCatalogSection(Consumer<ItemsCatalogIntent> intents) {
        this.intents = Objects.requireNonNull(intents, "intents");
        minimumCost.getStyleClass().add("catalog-cost-control");
        maximumCost.getStyleClass().add("catalog-cost-control");
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
        open.disableProperty().bind(content.table().getSelectionModel().selectedItemProperty().isNull());
        open.setOnAction(ignored -> {
            if (state != null) {
                this.intents.accept(new ItemsCatalogIntent.OpenItem(state.selectedSourceKey()));
            }
        });
        content.setHeaderControl(open);
        content.setHeaderControl(status);
        content.setHeaderControl(sorting);
        installDraftListeners();
    }

    @Override
    public CatalogSectionId id() {
        return CatalogSectionId.ITEMS;
    }

    @Override
    public CatalogControlsScaffold controls() {
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
            renderChips(state.filterDraft());
            content.render(
                    state.results(),
                    state.selectedSourceKey().isBlank()
                            ? Optional.empty() : Optional.of(state.selectedSourceKey()),
                    state.totalCount(), state.pageSize(), state.pageOffset(), "Items");
            status.setText(state.actionMessage());
            status.setVisible(!state.actionMessage().isBlank());
            status.setManaged(!state.actionMessage().isBlank());
        } finally {
            rendering = false;
        }
    }

    private CatalogControlsScaffold configureFilters() {
        Button find = CatalogControlKit.action("Suchen", "Items suchen", true);
        find.setOnAction(ignored -> intents.accept(new ItemsCatalogIntent.Search()));
        search.setOnAction(ignored -> intents.accept(new ItemsCatalogIntent.Search()));
        minimumCost.setOnAction(ignored -> intents.accept(new ItemsCatalogIntent.Search()));
        maximumCost.setOnAction(ignored -> intents.accept(new ItemsCatalogIntent.Search()));
        Button clear = CatalogControlKit.clear("Item-Suche und Filter leeren");
        clear.setOnAction(ignored -> intents.accept(new ItemsCatalogIntent.ClearFilters()));
        CatalogControlsScaffold scaffold = new CatalogControlsScaffold();
        scaffold.setSearch(search, find);
        scaffold.setFilters(
                category, subcategory, rarity, magic, attunement, minimumCost, maximumCost,
                clear);
        return scaffold;
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
        sorting.valueProperty().addListener((ignored, before, after) -> publishDraft());
    }

    private void publishDraft() {
        if (rendering) {
            return;
        }
        SortChoice selectedSort = sorting.getValue() == null ? SortChoice.defaultChoice() : sorting.getValue();
        intents.accept(new ItemsCatalogIntent.ChangeDraft(new ItemsCatalogFilterDraft(
                search.getText(), selectedFilter(category), selectedFilter(subcategory), selectedFilter(rarity),
                booleanValue(magic), booleanValue(attunement), minimumCost.getText(), maximumCost.getText(),
                selectedSort.field(), selectedSort.ascending())));
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
        sorting.setValue(SortChoice.forDraft(draft.sortField(), draft.ascending()));
    }

    private void renderChips(ItemsCatalogFilterDraft draft) {
        List<Node> rendered = new ArrayList<>();
        addChip(rendered, "Suche: " + draft.name(), !draft.name().isBlank(),
                () -> editDraft(() -> search.setText("")));
        addChip(rendered, "Kategorie: " + draft.category(), !draft.category().isBlank(),
                () -> editDraft(() -> category.setValue(ALL)));
        addChip(rendered, "Unterkategorie: " + draft.subcategory(), !draft.subcategory().isBlank(),
                () -> editDraft(() -> subcategory.setValue(ALL)));
        addChip(rendered, "Seltenheit: " + draft.rarity(), !draft.rarity().isBlank(),
                () -> editDraft(() -> rarity.setValue(ALL)));
        addChip(rendered, "Magisch: " + yesNo(Boolean.TRUE.equals(draft.magic())), draft.magic() != null,
                () -> editDraft(() -> magic.setValue(BooleanChoice.ALL)));
        addChip(rendered, "Einstimmung: " + yesNo(Boolean.TRUE.equals(draft.attunement())),
                draft.attunement() != null, () -> editDraft(() -> attunement.setValue(BooleanChoice.ALL)));
        addChip(rendered, costLabel(draft),
                !draft.minimumCostCp().isBlank() || !draft.maximumCostCp().isBlank(),
                () -> editDraft(() -> {
                    minimumCost.setText("");
                    maximumCost.setText("");
                }));
        controls.setChips(rendered);
    }

    private void editDraft(Runnable edit) {
        rendering = true;
        try {
            edit.run();
        } finally {
            rendering = false;
        }
        publishDraft();
    }

    private static void addChip(List<Node> target, String label, boolean visible, Runnable removeAction) {
        if (visible) {
            target.add(CatalogControlsScaffold.chip(label, removeAction));
        }
    }

    private static String costLabel(ItemsCatalogFilterDraft draft) {
        String minimum = draft.minimumCostCp().isBlank() ? "…" : draft.minimumCostCp();
        String maximum = draft.maximumCostCp().isBlank() ? "…" : draft.maximumCostCp();
        return "Kosten: " + minimum + "–" + maximum + " CP";
    }

    private static ComboBox<String> filterBox(String insideLabel, String accessibleText) {
        ComboBox<String> box = CatalogControlKit.select(insideLabel, accessibleText, value -> value);
        box.getItems().setAll(ALL);
        box.setValue(ALL);
        return box;
    }

    private static ComboBox<BooleanChoice> booleanBox(String insideLabel, String accessibleText) {
        ComboBox<BooleanChoice> box = CatalogControlKit.select(
                insideLabel, accessibleText, choice -> choice.label);
        box.getItems().setAll(BooleanChoice.values());
        box.setValue(BooleanChoice.ALL);
        return box;
    }

    private static ComboBox<SortChoice> sortBox() {
        ComboBox<SortChoice> box = CatalogControlKit.select(
                "Sortierung", "Items sortieren", SortChoice::label);
        box.getItems().setAll(SortChoice.values());
        box.setValue(SortChoice.defaultChoice());
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

    private record SortChoice(ItemsCatalogApi.SortField field, boolean ascending, String label) {
        private static final List<SortChoice> VALUES = List.of(
                choice(ItemsCatalogApi.SortField.NAME, true, "Name (A–Z)"),
                choice(ItemsCatalogApi.SortField.NAME, false, "Name (Z–A)"),
                choice(ItemsCatalogApi.SortField.CATEGORY, true, "Kategorie (A–Z)"),
                choice(ItemsCatalogApi.SortField.CATEGORY, false, "Kategorie (Z–A)"),
                choice(ItemsCatalogApi.SortField.RARITY, true, "Seltenheit (aufsteigend)"),
                choice(ItemsCatalogApi.SortField.RARITY, false, "Seltenheit (absteigend)"),
                choice(ItemsCatalogApi.SortField.COST, true, "Kosten (aufsteigend)"),
                choice(ItemsCatalogApi.SortField.COST, false, "Kosten (absteigend)"));

        private static List<SortChoice> values() {
            return VALUES;
        }

        private static SortChoice defaultChoice() {
            return values().get(0);
        }

        private static SortChoice forDraft(ItemsCatalogApi.SortField field, boolean ascending) {
            return values().stream()
                    .filter(choice -> choice.field == field && choice.ascending == ascending)
                    .findFirst().orElseGet(SortChoice::defaultChoice);
        }

        private static SortChoice choice(ItemsCatalogApi.SortField field, boolean ascending, String label) {
            return new SortChoice(field, ascending, label);
        }
    }
}
