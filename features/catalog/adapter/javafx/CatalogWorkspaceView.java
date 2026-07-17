package features.catalog.adapter.javafx;

import java.util.List;
import java.util.concurrent.CompletionStage;
import javafx.application.Platform;
import javafx.geometry.Insets;
import javafx.scene.Node;
import javafx.scene.control.Alert;
import javafx.scene.control.Button;
import javafx.scene.control.ComboBox;
import javafx.scene.control.Label;
import javafx.scene.control.ListCell;
import javafx.scene.control.ListView;
import javafx.scene.control.Tab;
import javafx.scene.control.TabPane;
import javafx.scene.control.TextField;
import javafx.scene.control.TableView;
import javafx.scene.control.TableColumn;
import javafx.beans.property.SimpleStringProperty;
import javafx.scene.input.KeyCode;
import javafx.scene.input.MouseButton;
import javafx.scene.layout.BorderPane;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.VBox;
import javafx.util.StringConverter;
import shell.api.InspectorEntrySpec;
import shell.api.InspectorSink;
import features.encounter.api.EncounterApi;
import features.encounter.api.OpenSavedEncounterPlanCommand;
import features.encounter.api.OpenSavedEncounterPlanResult;
import features.encounter.api.SavedEncounterPlanListModel;
import features.encounter.api.EncounterBuilderInputsModel;
import features.encounter.api.EncounterPoolFilters;
import features.encounter.api.UpdateEncounterPoolFiltersCommand;
import features.encounter.api.ApplyEncounterStateCommand;
import features.encounter.api.SavedEncounterPlanListResult;
import features.encounter.api.SavedEncounterPlanSummary;
import features.encountertable.api.EncounterTableCatalogModel;
import features.encountertable.api.EncounterTableCatalogResult;
import features.encountertable.api.EncounterTableSummary;
import features.items.api.ItemsCatalogApi;
import features.worldplanner.api.WorldFactionSummary;
import features.worldplanner.api.WorldLocationSummary;
import features.worldplanner.api.WorldNpcSummary;
import features.worldplanner.api.WorldPlannerSnapshot;
import features.worldplanner.api.WorldPlannerSnapshotModel;
import features.creatures.api.CreatureCatalogModel;
import features.creatures.api.CreatureQueryStatus;

/** One reference workspace; provider features keep all domain truth. */
final class CatalogWorkspaceView extends BorderPane {

    private final TabPane tabs = new TabPane();
    private final CatalogMainView monsters;
    private final ItemsPane items;
    private final SavedEncounterPane encounters;
    private final ReferenceListPane<WorldNpcSummary> npcs;
    private final ReferenceListPane<WorldFactionSummary> factions;
    private final ReferenceListPane<WorldLocationSummary> locations;
    private final ReferenceListPane<EncounterTableSummary> encounterTables;
    private final java.util.Map<Long, String> creatureNames = new java.util.HashMap<>();
    private final java.util.Map<Long, String> factionNames = new java.util.HashMap<>();
    private final java.util.Map<Long, String> tableNames = new java.util.HashMap<>();
    private WorldPlannerSnapshot currentWorld;

    CatalogWorkspaceView(
            CatalogMainView monsters,
            CatalogControlsHost controls,
            ItemsCatalogApi itemsApi,
            EncounterApi encounterApi,
            SavedEncounterPlanListModel savedPlans,
            EncounterBuilderInputsModel builderInputs,
            CreatureCatalogModel creatureCatalog,
            EncounterTableCatalogModel encounterTableCatalog,
            WorldPlannerSnapshotModel worldPlanner,
            InspectorSink inspector,
            java.util.function.LongConsumer openNpcInspector,
            java.util.function.LongConsumer openFactionInspector,
            java.util.function.LongConsumer openLocationInspector,
            Runnable createNpc,
            Runnable createFaction,
            Runnable createLocation,
            java.util.function.LongConsumer addNpcToScene,
            java.util.function.LongConsumer setSceneLocation
    ) {
        this.monsters = monsters;
        items = new ItemsPane(itemsApi, inspector);
        encounters = new SavedEncounterPane(encounterApi);
        npcs = new ReferenceListPane<>("NPCs", "Keine NPCs verfügbar.", WorldNpcSummary::displayName,
                value -> reference(creatureNames, value.creatureStatblockId(), "Statblock") + " · "
                        + reference(factionNames, value.factionId(), "Keine Fraktion")
                        + " · " + value.disposition() + " · " + value.status(),
                value -> openNpcInspector.accept(value.npcId()), "NPC anlegen", createNpc);
        factions = new ReferenceListPane<>("Fraktionen", "Keine Fraktionen verfügbar.", WorldFactionSummary::displayName,
                value -> reference(tableNames, value.primaryEncounterTableId(), "Tabelle")
                        + " · Haltung " + value.disposition()
                        + " · " + value.npcIds().size() + " NPCs",
                value -> openFactionInspector.accept(value.factionId()), "Fraktion anlegen", createFaction);
        locations = new ReferenceListPane<>("Orte", "Keine Orte verfügbar.", WorldLocationSummary::displayName,
                value -> joinedReferences(factionNames, value.factionIds(), "Fraktionen") + " · "
                        + joinedReferences(tableNames, value.encounterTableIds(), "Tabellen"),
                value -> openLocationInspector.accept(value.locationId()), "Ort anlegen", createLocation);
        encounterTables = new ReferenceListPane<>("Tabellen", "Keine Encounter-Tabellen verfügbar.",
                EncounterTableSummary::name,
                value -> "#" + value.tableId(), ignored -> { }, "", () -> { });
        npcs.addAction("Encounter", "Zum Encounter", value -> encounterApi.applyState(
                ApplyEncounterStateCommand.addWorldNpcCreature(value.creatureStatblockId(), value.npcId())));
        npcs.addAction("Scene", "Zur Scene", value -> addNpcToScene.accept(value.npcId()));
        factions.addAction("Encounter", "Als Quelle", value -> encounterApi.updatePoolFilters(
                new UpdateEncounterPoolFiltersCommand(withFaction(builderInputs.current().poolFilters(),
                        value.factionId()))));
        locations.addAction("Encounter", "Als Quelle", value -> encounterApi.updatePoolFilters(
                new UpdateEncounterPoolFiltersCommand(withLocation(builderInputs.current().poolFilters(),
                        value.locationId()))));
        locations.addAction("Scene", "Als Ort", value -> setSceneLocation.accept(value.locationId()));
        encounterTables.addAction("Encounter", "Als Quelle", value -> encounterApi.updatePoolFilters(
                new UpdateEncounterPoolFiltersCommand(withTable(builderInputs.current().poolFilters(),
                        value.tableId()))));

        Tab monsterTab = tab("Monster", monsters);
        tabs.getTabs().setAll(
                monsterTab,
                tab("Items", items),
                tab("Encounter", encounters),
                tab("NPCs", npcs),
                tab("Fraktionen", factions),
                tab("Orte", locations),
                tab("Encounter-Tabellen", encounterTables));
        tabs.getStyleClass().add("catalog-category-tabs");
        tabs.getSelectionModel().selectedItemProperty().addListener((ignored, before, after) -> {
            if (after == monsterTab) {
                controls.showMonster();
            } else if (after != null && "Items".equals(after.getText())) {
                controls.showSection("Items", "Items filtern …", items::setQuickQuery, "", () -> { });
            } else if (after != null && "Encounter".equals(after.getText())) {
                controls.showSection("Encounter", "Gespeicherte Encounter suchen …", encounters::setQuery, "", () -> { });
            } else if (after != null && "NPCs".equals(after.getText())) {
                controls.showSection("NPCs", "NPCs suchen …", npcs::setQuery, "NPC anlegen", createNpc);
            } else if (after != null && "Fraktionen".equals(after.getText())) {
                controls.showSection("Fraktionen", "Fraktionen suchen …", factions::setQuery,
                        "Fraktion anlegen", createFaction);
            } else if (after != null && "Orte".equals(after.getText())) {
                controls.showSection("Orte", "Orte suchen …", locations::setQuery, "Ort anlegen", createLocation);
            } else {
                controls.showSection("Encounter-Tabellen", "Tabellen suchen …", encounterTables::setQuery,
                        "", () -> { });
            }
        });
        setCenter(tabs);

        savedPlans.subscribe(this::applySavedPlans);
        encounters.apply(savedPlans.current());
        encounterTableCatalog.subscribe(this::applyEncounterTables);
        applyEncounterTables(encounterTableCatalog.current());
        creatureCatalog.subscribe(this::applyCreatures);
        applyCreatures(creatureCatalog.current());
        if (worldPlanner != null) {
            worldPlanner.subscribe(this::applyWorld);
            applyWorld(worldPlanner.current());
        }
        items.refresh();
    }

    CatalogMainView monsterView() {
        return monsters;
    }

    List<String> sectionTitles() {
        return tabs.getTabs().stream().map(Tab::getText).toList();
    }

    private void applySavedPlans(SavedEncounterPlanListResult result) {
        encounters.apply(result);
    }

    private void applyEncounterTables(EncounterTableCatalogResult result) {
        List<EncounterTableSummary> values = result == null ? List.of() : result.tables();
        tableNames.clear();
        values.forEach(value -> tableNames.put(value.tableId(), value.name()));
        encounterTables.apply(values);
        if (currentWorld != null) {
            applyWorld(currentWorld);
        }
    }

    private void applyCreatures(features.creatures.api.CreatureCatalogPageResult result) {
        if (result != null && result.status() == CreatureQueryStatus.SUCCESS && result.page() != null) {
            result.page().rows().forEach(value -> creatureNames.put(value.id(), value.name()));
            if (currentWorld != null) {
                applyWorld(currentWorld);
            }
        }
    }

    private void applyWorld(WorldPlannerSnapshot snapshot) {
        if (snapshot == null) {
            return;
        }
        currentWorld = snapshot;
        factionNames.clear();
        snapshot.factions().forEach(value -> factionNames.put(value.factionId(), value.displayName()));
        npcs.apply(snapshot.npcs());
        factions.apply(snapshot.factions());
        locations.apply(snapshot.locations());
    }

    private static Tab tab(String title, Node content) {
        Tab tab = new Tab(title, content);
        tab.setClosable(false);
        return tab;
    }

    private static String reference(java.util.Map<Long, String> labels, long id, String fallback) {
        if (id <= 0L) {
            return fallback;
        }
        String label = labels.get(id);
        return label == null || label.isBlank() ? fallback + " #" + id : label + " (#" + id + ")";
    }

    private static String joinedReferences(
            java.util.Map<Long, String> labels,
            List<Long> ids,
            String empty
    ) {
        if (ids == null || ids.isEmpty()) {
            return "Keine " + empty;
        }
        return ids.stream().map(id -> reference(labels, id, empty)).collect(java.util.stream.Collectors.joining(", "));
    }

    private static final class SavedEncounterPane extends BorderPane {

        private final EncounterApi encounters;
        private final TableView<SavedEncounterPlanSummary> plans = new TableView<>();
        private final Label status = new Label();
        private List<SavedEncounterPlanSummary> source = List.of();
        private String query = "";

        private SavedEncounterPane(EncounterApi encounters) {
            this.encounters = encounters;
            plans.setColumnResizePolicy(TableView.CONSTRAINED_RESIZE_POLICY);
            TableColumn<SavedEncounterPlanSummary, String> name =
                    textColumn("Name", SavedEncounterPlanSummary::name);
            TableColumn<SavedEncounterPlanSummary, String> summary =
                    textColumn("Zusammenfassung", SavedEncounterPlanSummary::summaryText);
            plans.getColumns().setAll(name, summary);
            plans.setPlaceholder(new Label("Keine gespeicherten Encounter."));
            plans.setOnMouseClicked(event -> {
                if (event.getButton() == MouseButton.PRIMARY && event.getClickCount() == 2) {
                    open(false);
                }
            });
            Button open = new Button("Im Encounter öffnen");
            open.setOnAction(ignored -> open(false));
            HBox footer = new HBox(8, open, status);
            footer.setPadding(new Insets(8));
            setCenter(plans);
            setBottom(footer);
        }

        private void apply(SavedEncounterPlanListResult result) {
            source = result == null ? List.of() : result.plans();
            refilter();
            status.setText(result == null ? "" : result.message());
        }

        private void setQuery(String value) {
            query = value == null ? "" : value.trim().toLowerCase(java.util.Locale.ROOT);
            refilter();
        }

        private void refilter() {
            plans.getItems().setAll(query.isBlank() ? source : source.stream()
                    .filter(plan -> (plan.name() + " " + plan.summaryText())
                            .toLowerCase(java.util.Locale.ROOT).contains(query))
                    .toList());
        }

        private void open(boolean confirmed) {
            SavedEncounterPlanSummary selected = plans.getSelectionModel().getSelectedItem();
            if (selected == null) {
                return;
            }
            encounters.openSavedPlan(new OpenSavedEncounterPlanCommand(selected.planId(), confirmed))
                    .whenComplete((result, failure) -> runOnFx(() -> handleOpen(selected, result, failure)));
        }

        private void handleOpen(
                SavedEncounterPlanSummary selected,
                OpenSavedEncounterPlanResult result,
                Throwable failure
        ) {
            if (failure != null || result == null) {
                status.setText("Encounter konnte nicht geöffnet werden.");
                return;
            }
            status.setText(result.message());
            if (result.status() != OpenSavedEncounterPlanResult.Status.CONFIRMATION_REQUIRED) {
                return;
            }
            Alert confirmation = new Alert(Alert.AlertType.CONFIRMATION);
            confirmation.setTitle("Ungespeicherte Änderungen");
            confirmation.setHeaderText("Aktuellen Encounter verwerfen?");
            confirmation.setContentText(selected.name() + " öffnen und ungespeicherte Änderungen verwerfen?");
            confirmation.showAndWait().ifPresent(button -> {
                if (button == javafx.scene.control.ButtonType.OK) {
                    open(true);
                }
            });
        }
    }

    static final class ItemsPane extends BorderPane {

        private static final int PAGE_SIZE = 50;
        private static final String ALL = "Alle";

        private final ItemsCatalogApi items;
        private final InspectorSink inspector;
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
        private int pageOffset;
        private int totalCount;
        private long requestRevision;
        private long detailRequestRevision;

        ItemsPane(ItemsCatalogApi items, InspectorSink inspector) {
            this.items = items;
            this.inspector = inspector;
            configureFilters();
            configureRows();
            configurePaging();
        }

        private void configureFilters() {
            Button find = new Button("Items suchen");
            find.setAccessibleText("Items suchen");
            find.setOnAction(ignored -> searchFirstPage());
            search.setOnAction(ignored -> searchFirstPage());
            minimumCost.setOnAction(ignored -> searchFirstPage());
            maximumCost.setOnAction(ignored -> searchFirstPage());

            HBox primary = new HBox(8,
                    field("Name", search),
                    field("Kategorie", category),
                    field("Unterkategorie", subcategory),
                    field("Seltenheit", rarity),
                    find);
            HBox.setHgrow(primary.getChildren().getFirst(), Priority.ALWAYS);
            HBox secondary = new HBox(8,
                    field("Magisch", magic),
                    field("Attunement", attunement),
                    field("Kosten ab (CP)", minimumCost),
                    field("Kosten bis (CP)", maximumCost),
                    field("Sortieren nach", sort),
                    field("Richtung", direction));
            VBox filters = new VBox(8, primary, secondary);
            filters.setPadding(new Insets(8));
            setTop(filters);
        }

        private void configureRows() {
            rows.setAccessibleText("Item-Ergebnisse");
            rows.setPlaceholder(new Label("Keine Items gefunden."));
            rows.setColumnResizePolicy(TableView.CONSTRAINED_RESIZE_POLICY);
            TableColumn<ItemsCatalogApi.ItemRow, String> name = textColumn("Name", ItemsCatalogApi.ItemRow::name);
            TableColumn<ItemsCatalogApi.ItemRow, String> category =
                    textColumn("Kategorie", item -> joined(item.category(), item.subcategory()));
            TableColumn<ItemsCatalogApi.ItemRow, String> rarity =
                    textColumn("Seltenheit", item -> shown(item.rarity()));
            TableColumn<ItemsCatalogApi.ItemRow, String> magic =
                    textColumn("Magie", item -> yesNo(item.magic()));
            TableColumn<ItemsCatalogApi.ItemRow, String> cost =
                    textColumn("Kosten", item -> shown(item.costDisplay()));
            rows.getColumns().setAll(name, category, rarity, magic, cost);
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
            setCenter(rows);
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
            HBox footer = new HBox(8, previous, page, next, open, status);
            footer.setPadding(new Insets(8));
            setBottom(footer);
        }

        void refresh() {
            loadFilterOptions();
            searchFirstPage();
        }

        void setQuickQuery(String value) {
            search.setText(value == null ? "" : value);
            searchFirstPage();
        }

        private void loadFilterOptions() {
            items.loadFilterOptions().whenComplete((options, failure) -> runOnFx(() -> {
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
            if (pageOffset <= 0) {
                return;
            }
            pageOffset = Math.max(0, pageOffset - PAGE_SIZE);
            searchPage();
        }

        private void nextPage() {
            if (pageOffset + PAGE_SIZE >= totalCount) {
                return;
            }
            pageOffset += PAGE_SIZE;
            searchPage();
        }

        private void searchPage() {
            long revision = ++requestRevision;
            ItemsCatalogApi.ItemQuery query;
            try {
                query = query();
            } catch (NumberFormatException exception) {
                applyFailureState("Ungültige Item-Suche.");
                return;
            }
            status.setText("Items werden geladen …");
            page.setText("Seite …");
            rows.getItems().clear();
            previous.setDisable(true);
            next.setDisable(true);
            items.search(query).whenComplete((result, failure) ->
                    runOnFx(() -> applyPage(revision, result, failure)));
        }

        private ItemsCatalogApi.ItemQuery query() {
            return new ItemsCatalogApi.ItemQuery(
                    trimmed(search.getText()),
                    selectedFilter(category),
                    selectedFilter(subcategory),
                    selectedFilter(rarity),
                    magic.getValue().value(),
                    attunement.getValue().value(),
                    cost(minimumCost),
                    cost(maximumCost),
                    sort.getValue(),
                    direction.getValue() == SortDirection.ASCENDING,
                    PAGE_SIZE,
                    pageOffset);
        }

        private void applyPage(long revision, ItemsCatalogApi.PageResult result, Throwable failure) {
            if (revision != requestRevision) {
                return;
            }
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
            long revision = ++detailRequestRevision;
            status.setText("Item-Details werden geladen …");
            items.loadDetail(selected.sourceKey()).whenComplete((result, failure) -> runOnFx(() -> {
                if (revision != detailRequestRevision) {
                    return;
                }
                if (failure != null || result == null) {
                    status.setText("Item-Details konnten nicht geladen werden.");
                    return;
                }
                if (result.status() != ItemsCatalogApi.CatalogStatus.SUCCESS) {
                    status.setText(statusText(result.status()));
                    return;
                }
                if (result.detail() == null) {
                    status.setText("Item-Details nicht verfügbar.");
                    return;
                }
                ItemsCatalogApi.ItemDetail detail = result.detail();
                inspector.push(new InspectorEntrySpec(
                        detail.name(),
                        "item:" + detail.sourceKey(),
                        () -> itemDetails(detail),
                        null));
                status.setText("Item-Details geöffnet.");
            }));
        }

        private static Node itemDetails(ItemsCatalogApi.ItemDetail detail) {
            VBox content = new VBox(6,
                    fact("Kategorie", joined(detail.category(), detail.subcategory())),
                    fact("Magisch", yesNo(detail.magic())),
                    fact("Seltenheit", shown(detail.rarity())),
                    fact("Attunement", yesNo(detail.attunement())),
                    fact("Kosten", costText(detail)),
                    fact("Gewicht", detail.weight() == null ? "–" : detail.weight().toString()),
                    fact("Eigenschaften", detail.properties().isEmpty()
                            ? "–"
                            : String.join(", ", detail.properties())),
                    fact("Schaden", shown(detail.damage())),
                    fact("Rüstungsklasse", shown(detail.armorClass())),
                    fact("Beschreibung", shown(detail.description())),
                    fact("Quelle", joined(detail.sourceVersion(), detail.sourceUrl())));
            content.setPadding(new Insets(8));
            return content;
        }

        private static Label fact(String label, String value) {
            Label fact = new Label(label + ": " + value);
            fact.setWrapText(true);
            return fact;
        }

        private static VBox field(String label, Node control) {
            return new VBox(2, new Label(label), control);
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
                @Override
                public String toString(ItemsCatalogApi.SortField value) {
                    return value == null ? "" : switch (value) {
                        case NAME -> "Name";
                        case CATEGORY -> "Kategorie";
                        case RARITY -> "Seltenheit";
                        case COST -> "Kosten";
                    };
                }

                @Override
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

        private static @org.jspecify.annotations.Nullable String selectedFilter(ComboBox<String> box) {
            String value = box.getValue();
            return value == null || ALL.equals(value) ? null : value;
        }

        private static @org.jspecify.annotations.Nullable String trimmed(String value) {
            return value == null || value.isBlank() ? null : value.trim();
        }

        private static @org.jspecify.annotations.Nullable Integer cost(TextField field) {
            String value = field.getText();
            return value == null || value.isBlank() ? null : Integer.valueOf(value.trim());
        }

        private static String rowText(ItemsCatalogApi.ItemRow item) {
            return item.name() + " · " + joined(item.category(), item.subcategory())
                    + " · " + shown(item.rarity())
                    + (item.magic() ? " · Magisch" : "")
                    + " · " + shown(item.costDisplay());
        }

        private static String costText(ItemsCatalogApi.ItemDetail detail) {
            String display = shown(detail.costDisplay());
            return detail.costCp() == null ? display : display + " (" + detail.costCp() + " CP)";
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
            ALL("Alle", null),
            YES("Ja", true),
            NO("Nein", false);

            private final String label;
            private final Boolean value;

            BooleanChoice(String label, Boolean value) {
                this.label = label;
                this.value = value;
            }

            @Override
            public String toString() {
                return label;
            }

            private Boolean value() {
                return value;
            }
        }

        private enum SortDirection {
            ASCENDING("Aufsteigend"),
            DESCENDING("Absteigend");

            private final String label;

            SortDirection(String label) {
                this.label = label;
            }

            @Override
            public String toString() {
                return label;
            }
        }
    }

    private static final class ReferenceListPane<T> extends BorderPane {

        private final CatalogSectionFrame<T> frame;

        private ReferenceListPane(
                String resultLabel,
                String emptyText,
                java.util.function.Function<T, String> label,
                java.util.function.Function<T, String> detail,
                java.util.function.Consumer<T> open,
                String createLabel,
                Runnable create
        ) {
            frame = new CatalogSectionFrame<>(resultLabel, emptyText,
                    value -> label.apply(value) + " " + detail.apply(value), open,
                    createLabel, create);
            frame.addTextColumn("Name", 260, label);
            frame.addTextColumn("Details", 520, detail);
            frame.addActionColumn("Aktion", "Details", open);
            setCenter(frame);
        }

        private void apply(List<T> next) {
            frame.apply(next);
        }

        private void setQuery(String query) {
            frame.setQuery(query);
        }

        private void addAction(String title, String label, java.util.function.Consumer<T> action) {
            frame.addActionColumn(title, label, action);
        }
    }

    private static EncounterPoolFilters withFaction(EncounterPoolFilters source, long factionId) {
        EncounterPoolFilters safe = source == null ? EncounterPoolFilters.empty() : source;
        return new EncounterPoolFilters(safe.nameQuery(), safe.challengeRatingMin(), safe.challengeRatingMax(),
                safe.sizes(), safe.creatureTypes(), safe.creatureSubtypes(), safe.biomes(), safe.alignments(),
                safe.encounterTableIds(), List.of(factionId), safe.worldLocationId());
    }

    private static EncounterPoolFilters withLocation(EncounterPoolFilters source, long locationId) {
        EncounterPoolFilters safe = source == null ? EncounterPoolFilters.empty() : source;
        return new EncounterPoolFilters(safe.nameQuery(), safe.challengeRatingMin(), safe.challengeRatingMax(),
                safe.sizes(), safe.creatureTypes(), safe.creatureSubtypes(), safe.biomes(), safe.alignments(),
                safe.encounterTableIds(), safe.worldFactionIds(), locationId);
    }

    private static EncounterPoolFilters withTable(EncounterPoolFilters source, long tableId) {
        EncounterPoolFilters safe = source == null ? EncounterPoolFilters.empty() : source;
        java.util.LinkedHashSet<Long> ids = new java.util.LinkedHashSet<>(safe.encounterTableIds());
        ids.add(tableId);
        return new EncounterPoolFilters(safe.nameQuery(), safe.challengeRatingMin(), safe.challengeRatingMax(),
                safe.sizes(), safe.creatureTypes(), safe.creatureSubtypes(), safe.biomes(), safe.alignments(),
                List.copyOf(ids), safe.worldFactionIds(), safe.worldLocationId());
    }

    private static void runOnFx(Runnable action) {
        if (Platform.isFxApplicationThread()) {
            action.run();
        } else {
            Platform.runLater(action);
        }
    }

    private static <T> TableColumn<T, String> textColumn(
            String title,
            java.util.function.Function<T, String> value
    ) {
        TableColumn<T, String> column = new TableColumn<>(title);
        column.setCellValueFactory(cell -> new SimpleStringProperty(value.apply(cell.getValue())));
        return column;
    }
}
