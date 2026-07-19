package features.catalog.application;

import features.catalog.application.CatalogApplicationRoutes.EncounterHandoff;
import features.catalog.application.CatalogApplicationRoutes.WorldInspectorRoutes;
import features.catalog.application.WorldReferenceCatalogState.FactionRow;
import features.encountertable.api.EncounterTableCatalogModel;
import features.worldplanner.api.WorldFactionSummary;
import features.worldplanner.api.WorldPlannerReadStatus;
import features.worldplanner.api.WorldPlannerSnapshotModel;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.Consumer;

/** Faction provider projection and explicit Faction actions. */
public final class FactionCatalogDefinition
        implements CatalogSectionDefinition<TextCatalogQuery, FactionRow, Long> {

    private final WorldPlannerSnapshotModel world;
    private final EncounterTableCatalogModel tables;
    private final WorldInspectorRoutes inspectors;
    private final EncounterHandoff encounter;
    private final AtomicLong providerRevision = new AtomicLong();

    public FactionCatalogDefinition(
            WorldPlannerSnapshotModel world,
            EncounterTableCatalogModel tables,
            WorldInspectorRoutes inspectors,
            EncounterHandoff encounter
    ) {
        this.world = Objects.requireNonNull(world, "world");
        this.tables = Objects.requireNonNull(tables, "tables");
        this.inspectors = Objects.requireNonNull(inspectors, "inspectors");
        this.encounter = Objects.requireNonNull(encounter, "encounter");
    }

    @Override public CatalogSectionId id() { return CatalogSectionId.FACTIONS; }
    @Override public TextCatalogQuery initialQuery() { return TextCatalogQuery.empty(); }

    @Override
    public CompletionStage<CatalogBrowseResult<TextCatalogQuery, FactionRow>> query(
            CatalogBrowseRequest<TextCatalogQuery> request
    ) {
        return CompletableFuture.completedFuture(CatalogBrowseResult.firstPage(
                request.query(), WorldCatalogProjection.factions(
                        world.current(), tables.current(), request.query().text()),
                providerRevision.incrementAndGet()));
    }

    @Override public Long key(FactionRow row) { return row.factionId(); }

    @Override
    public Runnable observeProvider(Consumer<CatalogProviderChange<TextCatalogQuery>> listener) {
        return CatalogSubscriptions.acquire(
                () -> world.subscribe(ignored -> changed(listener)),
                () -> tables.subscribe(ignored -> changed(listener)));
    }

    public void open(long id) { find(id).ifPresent(value -> inspectors.openFaction(value.factionId())); }
    public void create() { inspectors.createFaction(); }
    public void useAsEncounterSource(long id) {
        find(id).ifPresent(value -> encounter.useFactionSource(value.factionId()));
    }
    public List<CatalogReferenceOption> options() {
        return WorldCatalogProjection.factionOptions(world.current());
    }

    private Optional<WorldFactionSummary> find(long id) {
        var snapshot = world.current();
        return snapshot.status() == WorldPlannerReadStatus.SUCCESS
                ? snapshot.factions().stream().filter(value -> value.factionId() == id).findFirst()
                : Optional.empty();
    }

    private void changed(Consumer<CatalogProviderChange<TextCatalogQuery>> listener) {
        providerRevision.incrementAndGet();
        listener.accept(CatalogProviderChange.invalidated());
    }
}
