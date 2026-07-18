package features.catalog.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

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
import features.items.api.ItemsCatalogApi;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.function.Consumer;
import org.junit.jupiter.api.Test;
import platform.ui.DirectUiDispatcher;

final class MonsterCatalogControllerTest {

    @Test
    void filterEditRunsOneSearchAndOneWriteWhileReadbackReconcilesWithoutEcho() {
        Fixture fixture = new Fixture();
        fixture.controller.activate();
        int searchesBefore = fixture.queries.searches.size();
        MonsterCatalogFilterDraft edited = draft("lich", List.of("Undead"));

        fixture.controller.accept(new MonsterCatalogIntent.ChangeFilters(edited));

        assertEquals(searchesBefore + 1, fixture.queries.searches.size());
        assertEquals(List.of(edited.toPoolFilters()), fixture.routes.poolWrites);
        fixture.pool.emit(edited.toPoolFilters());
        assertEquals(searchesBefore + 1, fixture.queries.searches.size(), "echo readback searched again");
        assertEquals(1, fixture.routes.poolWrites.size(), "echo readback wrote back");

        EncounterPoolFilters external = draft("external", List.of("Beast")).toPoolFilters();
        fixture.pool.emit(external);
        assertEquals(searchesBefore + 2, fixture.queries.searches.size());
        assertEquals(1, fixture.routes.poolWrites.size(), "external readback was echoed as a write");
        assertEquals(external, fixture.controller.state().filterDraft().toPoolFilters());
    }

    @Test
    void newerResultsWinAndPostDeactivateResultsCannotPublish() {
        Fixture fixture = new Fixture();
        fixture.controller.activate();
        CompletableFuture<CreatureCatalogPageResult> initial = fixture.queries.searches.getFirst();
        fixture.controller.accept(new MonsterCatalogIntent.ChangeFilters(draft("older", List.of())));
        CompletableFuture<CreatureCatalogPageResult> older = fixture.queries.searches.getLast();
        fixture.controller.accept(new MonsterCatalogIntent.ChangeFilters(draft("newer", List.of())));
        CompletableFuture<CreatureCatalogPageResult> newer = fixture.queries.searches.getLast();

        newer.complete(page(2L, "Newer", 0, 1));
        older.complete(page(1L, "Older", 0, 1));
        initial.complete(page(3L, "Initial", 0, 1));
        assertEquals(List.of(2L), ids(fixture.controller.state()));

        fixture.controller.accept(new MonsterCatalogIntent.ChangeFilters(draft("late", List.of())));
        CompletableFuture<CreatureCatalogPageResult> postDeactivate = fixture.queries.searches.getLast();
        fixture.controller.deactivate();
        postDeactivate.complete(page(99L, "Late", 0, 1));
        assertFalse(ids(fixture.controller.state()).contains(99L));
    }

    @Test
    void sortPageStableSelectionAndResultStatusesShareOneRevisionedState() {
        Fixture fixture = new Fixture();
        fixture.controller.activate();
        fixture.queries.searches.getFirst().complete(page(7L, "Seven", 0, 100));
        fixture.controller.accept(new MonsterCatalogIntent.SelectCreature(7L));
        long beforeSort = fixture.controller.state().revision();

        fixture.controller.accept(new MonsterCatalogIntent.ChangeSort(MonsterCatalogSort.XP_DESC));
        assertEquals(CatalogResultState.Status.LOADING, fixture.controller.state().results().status());
        assertTrue(fixture.controller.state().revision() > beforeSort);
        assertEquals("XP", fixture.queries.queries.getLast().sortFieldName());
        fixture.queries.searches.getLast().complete(page(7L, "Seven", 0, 100));
        assertEquals(7L, fixture.controller.state().selectedCreatureId());

        fixture.controller.accept(new MonsterCatalogIntent.ShiftPage(1));
        assertEquals(50, fixture.queries.queries.getLast().pageOffset());
        fixture.queries.searches.getLast().complete(page(7L, "Seven", 50, 100));
        assertEquals(7L, fixture.controller.state().selectedCreatureId());

        fixture.controller.accept(new MonsterCatalogIntent.ChangeFilters(draft("empty", List.of())));
        fixture.queries.searches.getLast().complete(new CreatureCatalogPageResult(
                CreatureQueryStatus.SUCCESS, CreatureCatalogPage.empty(50, 0)));
        assertEquals(CatalogResultState.Status.EMPTY, fixture.controller.state().results().status());

        fixture.controller.accept(new MonsterCatalogIntent.ChangeFilters(draft("invalid", List.of())));
        fixture.queries.searches.getLast().complete(new CreatureCatalogPageResult(
                CreatureQueryStatus.INVALID_QUERY, CreatureCatalogPage.empty(50, 0)));
        assertEquals(CatalogResultState.Status.INVALID_INPUT, fixture.controller.state().results().status());

        fixture.controller.accept(new MonsterCatalogIntent.ChangeFilters(draft("failed", List.of())));
        fixture.queries.searches.getLast().completeExceptionally(new IllegalStateException("storage"));
        assertEquals(CatalogResultState.Status.FAILED, fixture.controller.state().results().status());
    }

    private static List<Long> ids(MonsterCatalogState state) {
        return state.results().rows().stream().map(CreatureCatalogRow::id).toList();
    }

    private static MonsterCatalogFilterDraft draft(String name, List<String> types) {
        return new MonsterCatalogFilterDraft(
                name, "", "", List.of(), types, List.of(), List.of(), List.of(),
                List.of(), List.of(), 0L);
    }

    private static CreatureCatalogPageResult page(long id, String name, int offset, int total) {
        CreatureCatalogRow row = new CreatureCatalogRow(id, name, "Medium", "Humanoid", "", "1", 200, 10, 10);
        return new CreatureCatalogPageResult(
                CreatureQueryStatus.SUCCESS, new CreatureCatalogPage(List.of(row), total, 50, offset));
    }

    private static final class Fixture {
        private final Queries queries = new Queries();
        private final PoolModel pool = new PoolModel();
        private final Routes routes = new Routes();
        private final MonsterCatalogController controller = new MonsterCatalogController(
                queries, pool.model, routes, routes, routes, DirectUiDispatcher.INSTANCE, () -> { });
    }

    private static final class Queries implements CreatureCatalogQueryApi {
        private final List<CreatureCatalogQuery> queries = new ArrayList<>();
        private final List<CompletableFuture<CreatureCatalogPageResult>> searches = new ArrayList<>();
        @Override public CompletionStage<CreatureCatalogPageResult> search(CreatureCatalogQuery query) {
            queries.add(query);
            CompletableFuture<CreatureCatalogPageResult> future = new CompletableFuture<>();
            searches.add(future);
            return future;
        }
        @Override public CompletionStage<CreatureFilterOptionsResult> loadFilterOptions() {
            return CompletableFuture.completedFuture(new CreatureFilterOptionsResult(
                    CreatureReadStatus.SUCCESS, CreatureFilterOptions.empty()));
        }
    }

    private static final class PoolModel {
        private EncounterPoolFilters current = EncounterPoolFilters.empty();
        private Consumer<EncounterPoolFilters> listener = ignored -> { };
        private final EncounterPoolFiltersModel model = new EncounterPoolFiltersModel(
                () -> current,
                next -> {
                    listener = next;
                    return () -> listener = ignored -> { };
                });
        void emit(EncounterPoolFilters filters) {
            current = filters;
            listener.accept(filters);
        }
    }

    private static final class Routes implements
            CatalogApplicationRoutes.CreatureInspectorRoute,
            CatalogApplicationRoutes.EncounterHandoff,
            CatalogApplicationRoutes.SceneHandoff {
        private final List<EncounterPoolFilters> poolWrites = new ArrayList<>();
        @Override public void openCreature(long creatureId) { }
        @Override public void updatePoolFilters(EncounterPoolFilters filters) { poolWrites.add(filters); }
        @Override public void addCreature(long creatureId) { }
        @Override public void addWorldNpc(long creatureId, long npcId) { }
        @Override public void useFactionSource(long factionId) { }
        @Override public void useLocationSource(long locationId) { }
        @Override public void useEncounterTableSource(long tableId) { }
        @Override public CompletionStage<OpenSavedEncounterPlanResult> openSavedEncounter(
                long planId, boolean discardUnsavedChanges
        ) {
            return CompletableFuture.completedFuture(new OpenSavedEncounterPlanResult(
                    OpenSavedEncounterPlanResult.Status.OPENED, planId, ""));
        }
        @Override public void addNpc(long npcId) { }
        @Override public void setLocation(long locationId) { }
    }
}
