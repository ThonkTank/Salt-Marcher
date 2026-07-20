package features.catalog.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import features.catalog.application.CatalogApplicationRoutes.EncounterHandoff;
import features.catalog.application.CatalogApplicationRoutes.SceneHandoff;
import features.creatures.api.CreatureCatalogPage;
import features.creatures.api.CreatureCatalogPageResult;
import features.creatures.api.CreatureCatalogQuery;
import features.creatures.api.CreatureCatalogQueryApi;
import features.creatures.api.CreatureCatalogRow;
import features.creatures.api.CreatureFilterOptions;
import features.creatures.api.CreatureFilterOptionsResult;
import features.creatures.api.CreatureQueryStatus;
import features.creatures.api.CreatureReadStatus;
import features.encounter.api.EncounterPoolFilters;
import features.encounter.api.EncounterPoolFiltersModel;
import features.encounter.api.OpenSavedEncounterPlanResult;
import features.encountertable.api.EncounterTableCatalogModel;
import features.encountertable.api.EncounterTableCatalogResult;
import features.encountertable.api.EncounterTableReadStatus;
import features.worldplanner.api.WorldPlannerReadStatus;
import features.worldplanner.api.WorldPlannerSnapshot;
import features.worldplanner.api.WorldPlannerSnapshotModel;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.List;
import java.util.Queue;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import org.junit.jupiter.api.Test;

final class MonsterCatalogDefinitionTest {

    private static final CatalogSortOrder NAME_ASCENDING = new CatalogSortOrder(
            "name", CatalogSortOrder.Direction.ASCENDING);

    @Test
    void successfulFilterOptionsAreRetainedAndSortIsTranslatedFromBrowseRequest() {
        FakeCreatureQueries queries = new FakeCreatureQueries();
        queries.options.add(options(CreatureReadStatus.SUCCESS));
        MonsterCatalogDefinition definition = definition(queries);

        CatalogBrowseResult<MonsterCatalogQuery, CreatureCatalogRow> first = query(
                definition, MonsterCatalogQuery.initial(),
                new CatalogSortOrder("xp", CatalogSortOrder.Direction.DESCENDING));
        CatalogBrowseResult<MonsterCatalogQuery, CreatureCatalogRow> second =
                query(definition, first.acceptedQuery(), NAME_ASCENDING);

        assertTrue(first.acceptedQuery().filterOptionsResolved());
        assertTrue(second.acceptedQuery().filterOptionsResolved());
        assertEquals(1, queries.optionLoads);
        assertEquals("XP", queries.searches.getFirst().sortFieldName());
        assertEquals("DESCENDING", queries.searches.getFirst().sortDirectionName());
        assertEquals("NAME", queries.searches.getLast().sortFieldName());
        assertEquals("ASCENDING", queries.searches.getLast().sortDirectionName());
    }

    @Test
    void failedFilterOptionsRemainUnresolvedAndRetry() {
        FakeCreatureQueries queries = new FakeCreatureQueries();
        queries.options.add(options(CreatureReadStatus.STORAGE_ERROR));
        queries.options.add(options(CreatureReadStatus.SUCCESS));
        MonsterCatalogDefinition definition = definition(queries);

        CatalogBrowseResult<MonsterCatalogQuery, CreatureCatalogRow> first =
                query(definition, MonsterCatalogQuery.initial(), NAME_ASCENDING);
        CatalogBrowseResult<MonsterCatalogQuery, CreatureCatalogRow> second =
                query(definition, first.acceptedQuery(), NAME_ASCENDING);

        assertFalse(first.acceptedQuery().filterOptionsResolved());
        assertEquals(CatalogResultState.Status.FAILED, first.result().status());
        assertEquals("Monster-Filter konnten nicht geladen werden.", first.result().message());
        assertTrue(second.acceptedQuery().filterOptionsResolved());
        assertEquals(2, queries.optionLoads);
    }

    @Test
    void overlappingQueriesShareOneOptionLoadAndKeepItsSuccessOutsideRequestEpochs() {
        FakeCreatureQueries queries = new FakeCreatureQueries();
        CompletableFuture<CreatureFilterOptionsResult> pending = queries.deferOptions();
        MonsterCatalogDefinition definition = definition(queries);

        CompletionStage<CatalogBrowseResult<MonsterCatalogQuery, CreatureCatalogRow>> first =
                queryAsync(definition, MonsterCatalogQuery.initial(), NAME_ASCENDING);
        CompletionStage<CatalogBrowseResult<MonsterCatalogQuery, CreatureCatalogRow>> second =
                queryAsync(definition, MonsterCatalogQuery.initial(), NAME_ASCENDING);

        assertEquals(1, queries.optionLoads);
        pending.complete(options(CreatureReadStatus.SUCCESS));
        assertTrue(first.toCompletableFuture().join().acceptedQuery().filterOptionsResolved());
        assertTrue(second.toCompletableFuture().join().acceptedQuery().filterOptionsResolved());
        assertTrue(query(definition, MonsterCatalogQuery.initial(), NAME_ASCENDING)
                .acceptedQuery().filterOptionsResolved());
        assertEquals(1, queries.optionLoads);
    }

    private static CatalogBrowseResult<MonsterCatalogQuery, CreatureCatalogRow> query(
            MonsterCatalogDefinition definition,
            MonsterCatalogQuery query,
            CatalogSortOrder sortOrder
    ) {
        return queryAsync(definition, query, sortOrder)
                .toCompletableFuture().join();
    }

    private static CompletionStage<CatalogBrowseResult<MonsterCatalogQuery, CreatureCatalogRow>> queryAsync(
            MonsterCatalogDefinition definition,
            MonsterCatalogQuery query,
            CatalogSortOrder sortOrder
    ) {
        return definition.query(new CatalogBrowseRequest<>(query, sortOrder, 50, 0, true));
    }

    private static MonsterCatalogDefinition definition(FakeCreatureQueries queries) {
        EncounterPoolFiltersModel pool = new EncounterPoolFiltersModel(
                EncounterPoolFilters::empty, ignored -> () -> { }, ignored -> () -> { });
        WorldPlannerSnapshotModel world = new WorldPlannerSnapshotModel(
                () -> new WorldPlannerSnapshot(
                        WorldPlannerReadStatus.SUCCESS, List.of(), List.of(), List.of(), ""),
                ignored -> () -> { }, ignored -> () -> { });
        EncounterTableCatalogModel tables = new EncounterTableCatalogModel(
                () -> new EncounterTableCatalogResult(EncounterTableReadStatus.SUCCESS, List.of()),
                ignored -> () -> { }, ignored -> () -> { });
        return new MonsterCatalogDefinition(
                queries, pool, world, tables, ignored -> { }, new NoopEncounter(), new NoopScene());
    }

    private static CreatureFilterOptionsResult options(CreatureReadStatus status) {
        return new CreatureFilterOptionsResult(status,
                new CreatureFilterOptions(
                        List.of("Huge", "Tiny"), List.of(), List.of(), List.of(), List.of(), List.of()));
    }

    private static final class FakeCreatureQueries implements CreatureCatalogQueryApi {
        private final Queue<CreatureFilterOptionsResult> options = new ArrayDeque<>();
        private final List<CreatureCatalogQuery> searches = new ArrayList<>();
        private CompletableFuture<CreatureFilterOptionsResult> deferredOptions;
        private int optionLoads;

        private CompletableFuture<CreatureFilterOptionsResult> deferOptions() {
            deferredOptions = new CompletableFuture<>();
            return deferredOptions;
        }

        @Override public CompletionStage<CreatureCatalogPageResult> search(CreatureCatalogQuery query) {
            searches.add(query);
            return CompletableFuture.completedFuture(new CreatureCatalogPageResult(
                    CreatureQueryStatus.SUCCESS, CreatureCatalogPage.empty(query.pageSize(), query.pageOffset())));
        }

        @Override public CompletionStage<CreatureFilterOptionsResult> loadFilterOptions() {
            optionLoads++;
            if (deferredOptions != null) {
                return deferredOptions;
            }
            return CompletableFuture.completedFuture(options.remove());
        }
    }

    private static final class NoopEncounter implements EncounterHandoff {
        @Override public void updatePoolFilters(EncounterPoolFilters filters) { }
        @Override public void addCreature(long creatureId) { }
        @Override public void addWorldNpc(long creatureId, long npcId) { }
        @Override public void useFactionSource(long factionId) { }
        @Override public void useLocationSource(long locationId) { }
        @Override public void useEncounterTableSource(long tableId) { }
        @Override public CompletionStage<OpenSavedEncounterPlanResult> openSavedEncounter(
                long planId, boolean discardUnsavedChanges) {
            return CompletableFuture.completedFuture(null);
        }
    }

    private static final class NoopScene implements SceneHandoff {
        @Override public void addCreature(long creatureId) { }
        @Override public void addNpc(long npcId) { }
        @Override public void setLocation(long locationId) { }
    }
}
