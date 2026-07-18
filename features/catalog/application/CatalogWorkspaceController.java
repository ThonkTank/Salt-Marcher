package features.catalog.application;

import features.creatures.api.CreatureCatalogQueryApi;
import features.creatures.api.CreatureReferenceIndexModel;
import features.encounter.api.EncounterPoolFiltersModel;
import features.encountertable.api.EncounterTableApi;
import features.encountertable.api.EncounterTableCatalogModel;
import features.worldplanner.api.WorldPlannerSnapshotModel;
import java.util.List;
import java.util.Objects;
import platform.ui.UiDispatcher;

/** Application-owned lifecycle, request epoch, and immutable workspace publication. */
public final class CatalogWorkspaceController implements CatalogLifecycle {

    private final UiDispatcher dispatcher;
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
            features.items.api.ItemsCatalogApi itemCatalog,
            features.encounter.api.SavedEncounterPlanListModel savedPlans,
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
        items = new ItemsCatalogController(
                itemCatalog, requiredRoutes.itemInspector(), dispatcher, this::sectionChanged);
        savedEncounters = new SavedEncounterCatalogController(
                savedPlans, requiredRoutes.encounter(), dispatcher, this::sectionChanged);
        worldReferences = new WorldReferenceCatalogController(
                creatureReferences, world, requiredRoutes.worldInspectors(), requiredRoutes.encounter(),
                requiredRoutes.scene(), dispatcher, this::sectionChanged);
        encounterTables = new EncounterTableCatalogController(
                encounterTableCommands, encounterTableCatalog, requiredRoutes.encounter(),
                worldReferences, dispatcher, this::sectionChanged);
        sections = List.of(monsters, items, savedEncounters, worldReferences, encounterTables);
        publication = new CatalogWorkspacePublication(snapshot(), dispatcher);
    }

    public CatalogWorkspacePublication publication() {
        return publication;
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

    public void acceptItemsIntent(ItemsCatalogIntent intent) {
        items.accept(intent);
    }

    public void acceptSavedEncounterIntent(SavedEncounterCatalogIntent intent) {
        savedEncounters.accept(intent);
    }

    public void acceptWorldReferenceIntent(WorldReferenceCatalogIntent intent) {
        worldReferences.accept(intent);
    }

    public void acceptEncounterTableIntent(EncounterTableCatalogIntent intent) {
        encounterTables.accept(intent);
    }

    @Override
    public void activate() {
        if (active || closed) {
            return;
        }
        activating = true;
        int activated = 0;
        try {
            for (CatalogLifecycle section : sections) {
                section.activate();
                activated++;
            }
            active = true;
            activating = false;
            publish();
        } catch (RuntimeException | Error failure) {
            for (int index = activated - 1; index >= 0; index--) {
                try {
                    sections.get(index).deactivate();
                } catch (RuntimeException | Error rollbackFailure) {
                    failure.addSuppressed(rollbackFailure);
                }
            }
            active = false;
            throw failure;
        } finally {
            activating = false;
        }
    }

    @Override
    public void deactivate() {
        if (!active) {
            return;
        }
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
