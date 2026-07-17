package features.catalog.adapter.javafx;

import features.catalog.CatalogServiceAssembly.CatalogActionRoutes;
import features.catalog.CatalogServiceAssembly.CatalogDataSources;
import shell.api.InspectorSink;
import features.encounter.adapter.sqlite.repository.SqliteEncounterPlanRepository;
import features.party.adapter.sqlite.repository.SqlitePartyRosterRepository;
import features.creatures.CreaturesServiceAssembly;
import features.creatures.domain.catalog.port.CreatureCatalogPort;
import features.encounter.EncounterServiceAssembly;
import features.encountertable.EncounterTableServiceAssembly;
import features.encountertable.domain.catalog.port.EncounterTableCatalogPort;
import features.party.PartyServiceAssembly;
import features.worldplanner.api.WorldPlannerSnapshotModel;

final class CatalogTestRuntime {

    private final CreaturesServiceAssembly.Component creatures;
    private final EncounterTableServiceAssembly.Component tables;
    private final EncounterServiceAssembly.Component encounter;
    private final WorldPlannerSnapshotModel worldPlanner;

    private CatalogTestRuntime(
            CreaturesServiceAssembly.Component creatures,
            EncounterTableServiceAssembly.Component tables,
            EncounterServiceAssembly.Component encounter,
            WorldPlannerSnapshotModel worldPlanner
    ) {
        this.creatures = creatures;
        this.tables = tables;
        this.encounter = encounter;
        this.worldPlanner = worldPlanner;
    }

    static CatalogTestRuntime create(
            CreatureCatalogPort creatureCatalog,
            EncounterTableCatalogPort encounterTables,
            WorldPlannerSnapshotModel worldPlanner
    ) {
        CreaturesServiceAssembly.Component creatures = CreaturesServiceAssembly.create(creatureCatalog);
        EncounterTableServiceAssembly.Component tables = EncounterTableServiceAssembly.create(encounterTables);
        PartyServiceAssembly.Component party = PartyServiceAssembly.create(new SqlitePartyRosterRepository());
        EncounterServiceAssembly.Component encounter = EncounterServiceAssembly.create(
                creatures.application(), creatures.detail(), creatures.encounterCandidates(),
                tables.application(), tables.candidates(), worldPlanner,
                party.application(), party.activeParty(), party.activeComposition(),
                party.adventuringDaySummary(), party.mutation(), new SqliteEncounterPlanRepository());
        return new CatalogTestRuntime(creatures, tables, encounter, worldPlanner);
    }

    CatalogContribution contribution(InspectorSink inspector) {
        return contribution(inspector, ignored -> { }, () -> { });
    }

    CatalogContribution contribution(
            InspectorSink inspector,
            java.util.function.LongConsumer openNpc,
            Runnable createNpc
    ) {
        return (CatalogContribution) features.catalog.CatalogServiceAssembly.contribution(
                new CatalogDataSources(
                        creatures.application(), creatures.catalogQueries(), tables.application(),
                        encounter.application(), encounter.builderInputs(), tables.catalog(),
                        encounter.tuningPreview(), encounter.savedPlans(), unavailableItems(), worldPlanner),
                new CatalogActionRoutes(
                        inspector, ignored -> { }, openNpc, ignored -> { }, ignored -> { },
                        createNpc, () -> { }, () -> { }));
    }

    private static features.items.api.ItemsCatalogApi unavailableItems() {
        return new features.items.api.ItemsCatalogApi() {
            public java.util.concurrent.CompletionStage<FilterOptionsResult> loadFilterOptions() {
                return java.util.concurrent.CompletableFuture.completedFuture(new FilterOptionsResult(
                        CatalogStatus.UNAVAILABLE, java.util.List.of(), java.util.List.of(), java.util.List.of()));
            }
            public java.util.concurrent.CompletionStage<PageResult> search(ItemQuery query) {
                return java.util.concurrent.CompletableFuture.completedFuture(new PageResult(
                        CatalogStatus.UNAVAILABLE, java.util.List.of(), 0, 50, 0));
            }
            public java.util.concurrent.CompletionStage<DetailResult> loadDetail(String sourceKey) {
                return java.util.concurrent.CompletableFuture.completedFuture(
                        new DetailResult(CatalogStatus.UNAVAILABLE, null));
            }
        };
    }

    features.encounter.api.EncounterBuilderInputsModel builderInputs() {
        return encounter.builderInputs();
    }
}
