package features.catalog.application;

import features.catalog.application.CatalogApplicationRoutes.EncounterHandoff;
import features.catalog.application.CatalogApplicationRoutes.SceneHandoff;
import features.catalog.application.CatalogApplicationRoutes.WorldInspectorRoutes;
import features.catalog.application.WorldReferenceCatalogState.LocationRow;
import features.encountertable.api.EncounterTableCatalogModel;
import features.worldplanner.api.WorldLocationSummary;
import features.worldplanner.api.WorldPlannerReadStatus;
import features.worldplanner.api.WorldPlannerSnapshotModel;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.Consumer;

/** Location provider projection and explicit Location actions. */
public final class LocationCatalogDefinition
        implements CatalogSectionDefinition<TextCatalogQuery, LocationRow, Long> {

    private final WorldPlannerSnapshotModel world;
    private final EncounterTableCatalogModel tables;
    private final WorldInspectorRoutes inspectors;
    private final EncounterHandoff encounter;
    private final SceneHandoff scene;
    private final AtomicLong providerRevision = new AtomicLong();

    public LocationCatalogDefinition(
            WorldPlannerSnapshotModel world,
            EncounterTableCatalogModel tables,
            WorldInspectorRoutes inspectors,
            EncounterHandoff encounter,
            SceneHandoff scene
    ) {
        this.world = Objects.requireNonNull(world, "world");
        this.tables = Objects.requireNonNull(tables, "tables");
        this.inspectors = Objects.requireNonNull(inspectors, "inspectors");
        this.encounter = Objects.requireNonNull(encounter, "encounter");
        this.scene = Objects.requireNonNull(scene, "scene");
    }

    @Override public CatalogSectionId id() { return CatalogSectionId.LOCATIONS; }
    @Override public TextCatalogQuery initialQuery() { return TextCatalogQuery.empty(); }

    @Override
    public CompletionStage<CatalogBrowseResult<TextCatalogQuery, LocationRow>> query(
            CatalogBrowseRequest<TextCatalogQuery> request
    ) {
        return CompletableFuture.completedFuture(CatalogBrowseResult.firstPage(
                request.query(), WorldCatalogProjection.locations(
                        world.current(), tables.current(), request.query().text()),
                providerRevision.incrementAndGet()));
    }

    @Override public Long key(LocationRow row) { return row.locationId(); }

    @Override
    public Runnable observeProvider(Consumer<CatalogProviderChange<TextCatalogQuery>> listener) {
        return CatalogSubscriptions.acquire(
                () -> world.subscribe(ignored -> changed(listener)),
                () -> tables.subscribe(ignored -> changed(listener)));
    }

    public void open(long id) { find(id).ifPresent(value -> inspectors.openLocation(value.locationId())); }
    public void create() { inspectors.createLocation(); }
    public void useAsEncounterSource(long id) {
        find(id).ifPresent(value -> encounter.useLocationSource(value.locationId()));
    }
    public void setFocusedSceneLocation(long id) {
        find(id).ifPresent(value -> scene.setLocation(value.locationId()));
    }
    public List<CatalogReferenceOption> options() {
        return WorldCatalogProjection.locationOptions(world.current());
    }

    private Optional<WorldLocationSummary> find(long id) {
        var snapshot = world.current();
        return snapshot.status() == WorldPlannerReadStatus.SUCCESS
                ? snapshot.locations().stream().filter(value -> value.locationId() == id).findFirst()
                : Optional.empty();
    }

    private void changed(Consumer<CatalogProviderChange<TextCatalogQuery>> listener) {
        providerRevision.incrementAndGet();
        listener.accept(CatalogProviderChange.invalidated());
    }
}
