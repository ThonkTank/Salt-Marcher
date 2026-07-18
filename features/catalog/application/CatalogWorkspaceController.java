package features.catalog.application;

import features.creatures.api.CreatureCatalogQueryApi;
import features.creatures.api.CreatureReferenceIndexModel;
import features.encounter.api.EncounterPoolFiltersModel;
import features.encounter.api.SavedEncounterPlanListModel;
import features.encountertable.api.EncounterTableApi;
import features.encountertable.api.EncounterTableCatalogModel;
import features.items.api.ItemsCatalogApi;
import features.worldplanner.api.WorldPlannerSnapshotModel;
import java.util.List;
import java.util.Objects;
import platform.ui.UiDispatcher;

/** Application-owned lifecycle, request epoch, and immutable workspace publication. */
public final class CatalogWorkspaceController implements CatalogLifecycle {

    private final UiDispatcher dispatcher;
    private final CatalogRequestEpoch requestEpoch = new CatalogRequestEpoch();
    private final MonsterCatalogController monsters;
    private final ItemsCatalogController items;
    private final SavedEncounterCatalogController savedEncounters;
    private final WorldReferenceCatalogController worldReferences;
    private final EncounterTableCatalogController encounterTables;
    private final List<CatalogLifecycle> sections;
    private final CatalogWorkspacePublication publication;
    private CatalogSectionId activeSection = CatalogSectionId.MONSTERS;
    private long revision;
    private boolean active;
    private boolean activating;
    private boolean closed;

    public CatalogWorkspaceController(
            CreatureCatalogQueryApi creatureQueries,
            EncounterPoolFiltersModel encounterPoolFilters,
            ItemsCatalogApi itemCatalog,
            SavedEncounterPlanListModel savedPlans,
            CreatureReferenceIndexModel creatureReferences,
            WorldPlannerSnapshotModel world,
            EncounterTableApi encounterTableCommands,
            EncounterTableCatalogModel encounterTableCatalog,
            UiDispatcher publicationDispatcher,
            CatalogApplicationRoutes routes
    ) {
        dispatcher = Objects.requireNonNull(publicationDispatcher, "publicationDispatcher");
        CatalogApplicationRoutes requiredRoutes = Objects.requireNonNull(routes, "routes");
        monsters = new MonsterCatalogController(
                creatureQueries,
                encounterPoolFilters,
                requiredRoutes.creatureInspector(),
                requiredRoutes.encounter(),
                requiredRoutes.scene(),
                dispatcher,
                this::sectionChanged);
        items = new ItemsCatalogController(itemCatalog, this::sectionChanged);
        savedEncounters = new SavedEncounterCatalogController(savedPlans, this::sectionChanged);
        worldReferences = new WorldReferenceCatalogController(creatureReferences, world, this::sectionChanged);
        encounterTables = new EncounterTableCatalogController(
                encounterTableCommands, encounterTableCatalog, this::sectionChanged);
        sections = List.of(monsters, items, savedEncounters, worldReferences, encounterTables);
        publication = new CatalogWorkspacePublication(snapshot(), dispatcher);
    }

    public CatalogWorkspacePublication publication() {
        return publication;
    }

    public ItemsCatalogApi itemCatalog() {
        return items.provider();
    }

    public void selectSection(CatalogSectionId section) {
        CatalogSectionId next = Objects.requireNonNull(section, "section");
        if (next == activeSection) {
            return;
        }
        activeSection = next;
        publish();
    }

    public void acceptMonsterIntent(MonsterCatalogIntent intent) {
        monsters.accept(intent);
    }

    public CatalogRequestToken beginItemsFilterOptions() {
        return requestEpoch.begin(CatalogRequestToken.RequestKind.ITEMS_FILTER_OPTIONS);
    }

    public CatalogRequestToken beginItemsSearch() {
        return requestEpoch.begin(CatalogRequestToken.RequestKind.ITEMS_SEARCH);
    }

    public void itemsSearchStarted(ItemsCatalogApi.ItemQuery query) {
        items.beginSearch(query);
    }

    public void itemsInvalidQuery() {
        items.applyInvalidQuery();
    }

    public CatalogRequestToken beginItemsDetail() {
        return requestEpoch.begin(CatalogRequestToken.RequestKind.ITEMS_DETAIL);
    }

    public CatalogRequestToken beginSavedEncounterOpen() {
        return requestEpoch.begin(CatalogRequestToken.RequestKind.SAVED_ENCOUNTER_OPEN);
    }

    public void complete(CatalogRequestToken token, Runnable acceptedResult) {
        Objects.requireNonNull(acceptedResult, "acceptedResult");
        dispatcher.dispatch(() -> requestEpoch.runIfAccepted(token, acceptedResult));
    }

    public void itemsFilterOptionsCompleted(ItemsCatalogApi.FilterOptionsResult result, Throwable failure) {
        items.applyFilterOptions(result, failure);
    }

    public void itemsPageCompleted(ItemsCatalogApi.PageResult result, Throwable failure) {
        items.applyPage(result, failure);
    }

    @Override
    public void activate() {
        if (active || closed) {
            return;
        }
        active = true;
        requestEpoch.activate();
        activating = true;
        sections.forEach(CatalogLifecycle::activate);
        activating = false;
        publish();
    }

    @Override
    public void deactivate() {
        if (!active) {
            return;
        }
        requestEpoch.deactivate();
        for (int index = sections.size() - 1; index >= 0; index--) {
            sections.get(index).deactivate();
        }
        active = false;
    }

    @Override
    public void close() {
        if (closed) {
            return;
        }
        deactivate();
        sections.forEach(CatalogLifecycle::close);
        closed = true;
    }

    private void sectionChanged() {
        if (!activating) {
            publish();
        }
    }

    private void publish() {
        publication.publish(snapshot());
    }

    private CatalogWorkspaceState snapshot() {
        return new CatalogWorkspaceState(
                ++revision, activeSection, monsters.state(), items.state(), savedEncounters.state(),
                worldReferences.state(), encounterTables.state());
    }
}
