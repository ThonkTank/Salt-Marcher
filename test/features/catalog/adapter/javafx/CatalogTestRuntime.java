package features.catalog.adapter.javafx;

import features.catalog.CatalogFeature;
import features.catalog.CatalogProviders;
import features.catalog.CatalogRoutes;
import features.creatures.CreaturesServiceAssembly;
import features.creatures.domain.catalog.port.CreatureCatalogPort;
import features.encounter.EncounterServiceAssembly;
import features.encounter.adapter.sqlite.repository.SqliteEncounterPlanRepository;
import features.encounter.api.ApplyEncounterStateCommand;
import features.encounter.api.EncounterPoolFilters;
import features.encounter.api.OpenSavedEncounterPlanCommand;
import features.encounter.api.UpdateEncounterPoolFiltersCommand;
import features.encountertable.EncounterTableServiceAssembly;
import features.encountertable.domain.catalog.port.EncounterTableCatalogPort;
import features.party.PartyServiceAssembly;
import features.party.adapter.sqlite.repository.SqlitePartyRosterRepository;
import features.worldplanner.api.WorldPlannerSnapshotModel;

import platform.persistence.TestFeatureStores;
import shell.api.InspectorSink;
import shell.api.ShellContribution;

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
        PartyServiceAssembly.Component party = PartyServiceAssembly.create(new SqlitePartyRosterRepository(
                                TestFeatureStores.current().store(
                                        SqlitePartyRosterRepository.storeDefinition())));
        EncounterServiceAssembly.Component encounter = EncounterServiceAssembly.create(
                creatures.application(), creatures.detail(), creatures.encounterCandidates(),
                tables.application(), tables.candidates(), worldPlanner,
                party.application(), party.activeParty(), party.activeComposition(),
                party.adventuringDaySummary(), party.mutation(), new SqliteEncounterPlanRepository(
                                TestFeatureStores.current().store(
                                        SqliteEncounterPlanRepository.storeDefinition())));
        return new CatalogTestRuntime(creatures, tables, encounter, worldPlanner);
    }

    ShellContribution contribution(InspectorSink inspector) {
        return contribution(inspector, ignored -> { }, () -> { });
    }

    ShellContribution contribution(
            InspectorSink inspector,
            java.util.function.LongConsumer openNpc,
            Runnable createNpc
    ) {
        return contribution(inspector, openNpc, createNpc, ignored -> { });
    }

    ShellContribution contribution(
            InspectorSink inspector,
            java.util.function.LongConsumer openNpc,
            Runnable createNpc,
            java.util.function.LongConsumer addCreatureToScene
    ) {
        CatalogRoutes.EncounterHandoff encounterRoute = new CatalogRoutes.EncounterHandoff() {
            @Override public void updatePoolFilters(EncounterPoolFilters filters) {
                encounter.application().updatePoolFilters(new UpdateEncounterPoolFiltersCommand(filters));
            }
            @Override public void addCreature(long creatureId) {
                encounter.application().applyState(ApplyEncounterStateCommand.addCreature(creatureId));
            }
            @Override public void addWorldNpc(long creatureId, long npcId) {
                encounter.application().applyState(ApplyEncounterStateCommand.addWorldNpcCreature(creatureId, npcId));
            }
            @Override public void useFactionSource(long factionId) { }
            @Override public void useLocationSource(long locationId) { }
            @Override public void useEncounterTableSource(long tableId) { }
            @Override public java.util.concurrent.CompletionStage<features.encounter.api.OpenSavedEncounterPlanResult>
                    openSavedEncounter(long planId, boolean discard) {
                return encounter.application().openSavedPlan(new OpenSavedEncounterPlanCommand(planId, discard));
            }
        };
        CatalogRoutes.WorldInspectorRoutes worldRoutes = new CatalogRoutes.WorldInspectorRoutes() {
            @Override public void openNpc(long npcId) { openNpc.accept(npcId); }
            @Override public void openFaction(long factionId) { }
            @Override public void openLocation(long locationId) { }
            @Override public void createNpc() { createNpc.run(); }
            @Override public void createFaction() { }
            @Override public void createLocation() { }
        };
        CatalogRoutes.SceneHandoff sceneRoute = new CatalogRoutes.SceneHandoff() {
            @Override public void addCreature(long creatureId) { addCreatureToScene.accept(creatureId); }
            @Override public void addNpc(long npcId) { }
            @Override public void setLocation(long locationId) { }
        };
        return contribution(new CatalogRoutes(
                ignored -> { },
                detail -> features.items.adapter.javafx.ItemDetailsView.openInspector(inspector, detail),
                worldRoutes,
                encounterRoute,
                sceneRoute));
    }

    ShellContribution contribution(CatalogRoutes routes) {
        CatalogFeature.Component catalog = CatalogFeature.create(
                new CatalogProviders(
                        new CatalogProviders.MonsterProviders(
                                creatures.catalogQueries(), encounter.poolFilters()),
                        new CatalogProviders.ItemsProviders(unavailableItems()),
                        new CatalogProviders.SavedEncounterProviders(encounter.savedPlans()),
                        new CatalogProviders.WorldReferenceProviders(creatures.referenceIndex(), worldPlanner),
                        new CatalogProviders.EncounterTableProviders(tables.application(), tables.catalog()),
                        new platform.ui.JavaFxUiDispatcher()),
                routes);
        return catalog.contribution();
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

    void updatePoolFilters(features.encounter.api.EncounterPoolFilters filters) {
        encounter.application().updatePoolFilters(
                new features.encounter.api.UpdateEncounterPoolFiltersCommand(filters));
    }
}
