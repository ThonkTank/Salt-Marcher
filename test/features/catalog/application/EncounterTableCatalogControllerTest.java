package features.catalog.application;

import static org.junit.jupiter.api.Assertions.assertEquals;

import features.catalog.application.CatalogApplicationRoutes.EncounterHandoff;
import features.catalog.application.CatalogApplicationRoutes.SceneHandoff;
import features.catalog.application.CatalogApplicationRoutes.WorldInspectorRoutes;
import features.creatures.api.CreatureReferenceIndexModel;
import features.creatures.api.CreatureReferenceIndexResult;
import features.creatures.api.CreatureReferenceIndexStatus;
import features.encounter.api.EncounterPoolFilters;
import features.encounter.api.OpenSavedEncounterPlanResult;
import features.encountertable.api.EncounterTableApi;
import features.encountertable.api.EncounterTableCatalogModel;
import features.encountertable.api.EncounterTableCatalogResult;
import features.encountertable.api.EncounterTableReadStatus;
import features.encountertable.api.EncounterTableSummary;
import features.encountertable.api.RefreshEncounterTableCandidatesCommand;
import features.encountertable.api.RefreshEncounterTableCatalogCommand;
import features.worldplanner.api.WorldFactionSummary;
import features.worldplanner.api.WorldPlannerReadStatus;
import features.worldplanner.api.WorldPlannerSnapshot;
import features.worldplanner.api.WorldPlannerSnapshotModel;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.function.Consumer;
import org.junit.jupiter.api.Test;
import platform.ui.DirectUiDispatcher;
import platform.ui.UiDispatcher;

final class EncounterTableCatalogControllerTest {

    @Test
    void ownsOneSubscriptionRefreshQuerySelectionStatusAndValidatedHandoff() {
        MutableTables tables = new MutableTables(success("Forest", 5L));
        RecordingEncounter encounter = new RecordingEncounter();
        WorldReferenceCatalogController world = worldController();
        world.activate();
        EncounterTableCatalogController controller = new EncounterTableCatalogController(
                tables, new EncounterTableCatalogModel(tables::current, tables::subscribe), encounter,
                world, DirectUiDispatcher.INSTANCE, () -> { });

        controller.activate();
        assertEquals(1, tables.subscriptions);
        assertEquals(1, tables.active);
        assertEquals(1, tables.refreshes);
        assertEquals(CatalogResultState.Status.READY, controller.state().results().status());
        assertEquals("#5", controller.state().results().rows().getFirst().details());
        assertEquals(List.of(new CatalogReferenceOption(5L, "Forest")), controller.state().options());
        assertEquals("Forest (#5)", world.state().factions().results().rows().getFirst().details()
                .split(" · ")[0]);

        controller.accept(new EncounterTableCatalogIntent.SelectTable(5L));
        controller.accept(new EncounterTableCatalogIntent.ChangeQuery("  #5 "));
        assertEquals(5L, controller.state().selectedTableId());
        assertEquals(1, controller.state().results().rows().size());
        controller.accept(new EncounterTableCatalogIntent.UseAsEncounterSource(5L));
        controller.accept(new EncounterTableCatalogIntent.UseAsEncounterSource(999L));
        assertEquals(List.of(5L), encounter.usedTables);

        tables.emit(success("Renamed", 5L));
        assertEquals(5L, controller.state().selectedTableId());
        assertEquals("Renamed (#5)", world.state().factions().results().rows().getFirst().details()
                .split(" · ")[0]);
        tables.emit(success("Other", 6L));
        assertEquals(0L, controller.state().selectedTableId());

        tables.emit(new EncounterTableCatalogResult(EncounterTableReadStatus.SUCCESS, List.of()));
        assertEquals(CatalogResultState.Status.EMPTY, controller.state().results().status());
        tables.emit(new EncounterTableCatalogResult(EncounterTableReadStatus.STORAGE_ERROR, List.of()));
        assertEquals(CatalogResultState.Status.FAILED, controller.state().results().status());
        tables.emit(null);
        assertEquals(CatalogResultState.Status.FAILED, controller.state().results().status());

        controller.deactivate();
        assertEquals(0, tables.active);
        controller.activate();
        assertEquals(2, tables.subscriptions);
        assertEquals(2, tables.refreshes);
        controller.close();
        controller.close();
        assertEquals(0, tables.active);
    }

    @Test
    void rejectsQueuedProviderPublicationAfterDeactivateAndPreservesPriorState() {
        MutableTables tables = new MutableTables(success("Forest", 5L));
        QueuedDispatcher dispatcher = new QueuedDispatcher();
        WorldReferenceCatalogController world = worldController(dispatcher);
        world.activate();
        dispatcher.runAll();
        EncounterTableCatalogController controller = new EncounterTableCatalogController(
                tables, new EncounterTableCatalogModel(tables::current, tables::subscribe),
                new RecordingEncounter(), world, dispatcher, () -> { });

        controller.activate();
        controller.deactivate();
        dispatcher.runAll();
        assertEquals(CatalogResultState.Status.LOADING, controller.state().results().status());
        assertEquals(0, tables.active);

        controller.activate();
        dispatcher.runAll();
        assertEquals(CatalogResultState.Status.READY, controller.state().results().status());
        controller.deactivate();
        tables.emit(new EncounterTableCatalogResult(EncounterTableReadStatus.STORAGE_ERROR, List.of()));
        dispatcher.runAll();
        assertEquals(CatalogResultState.Status.READY, controller.state().results().status());
    }

    private static EncounterTableCatalogResult success(String name, long id) {
        return new EncounterTableCatalogResult(
                EncounterTableReadStatus.SUCCESS, List.of(new EncounterTableSummary(id, name, null)));
    }

    private static WorldReferenceCatalogController worldController() {
        return worldController(DirectUiDispatcher.INSTANCE);
    }

    private static WorldReferenceCatalogController worldController(UiDispatcher dispatcher) {
        CreatureReferenceIndexResult creatures = new CreatureReferenceIndexResult(
                CreatureReferenceIndexStatus.SUCCESS, 1L, List.of());
        WorldPlannerSnapshot snapshot = new WorldPlannerSnapshot(
                WorldPlannerReadStatus.SUCCESS,
                List.of(), List.of(new WorldFactionSummary(2L, "Faction", "", 5L, List.of(), List.of())),
                List.of(), "");
        EmptyRoutes routes = new EmptyRoutes();
        return new WorldReferenceCatalogController(
                new CreatureReferenceIndexModel(() -> creatures, ignored -> () -> { }),
                new WorldPlannerSnapshotModel(() -> snapshot, ignored -> () -> { }),
                routes, routes, routes, dispatcher, () -> { });
    }

    private static final class MutableTables implements EncounterTableApi {
        private EncounterTableCatalogResult current;
        private Consumer<EncounterTableCatalogResult> listener = ignored -> { };
        private int subscriptions;
        private int active;
        private int refreshes;

        private MutableTables(EncounterTableCatalogResult current) { this.current = current; }
        private EncounterTableCatalogResult current() { return current; }
        private Runnable subscribe(Consumer<EncounterTableCatalogResult> next) {
            subscriptions++;
            active++;
            listener = next;
            return () -> {
                active--;
                listener = ignored -> { };
            };
        }
        private void emit(EncounterTableCatalogResult value) { current = value; listener.accept(value); }
        @Override public void refreshCatalog(RefreshEncounterTableCatalogCommand command) { refreshes++; }
        @Override public void refreshCandidates(RefreshEncounterTableCandidatesCommand command) { }
    }

    private static final class RecordingEncounter extends EmptyRoutes {
        private final List<Long> usedTables = new ArrayList<>();
        @Override public void useEncounterTableSource(long tableId) { usedTables.add(tableId); }
    }

    private static class EmptyRoutes implements WorldInspectorRoutes, EncounterHandoff, SceneHandoff {
        @Override public void openNpc(long npcId) { }
        @Override public void openFaction(long factionId) { }
        @Override public void openLocation(long locationId) { }
        @Override public void createNpc() { }
        @Override public void createFaction() { }
        @Override public void createLocation() { }
        @Override public void updatePoolFilters(EncounterPoolFilters filters) { }
        @Override public void addCreature(long creatureId) { }
        @Override public void addWorldNpc(long creatureId, long npcId) { }
        @Override public void useFactionSource(long factionId) { }
        @Override public void useLocationSource(long locationId) { }
        @Override public void useEncounterTableSource(long tableId) { }
        @Override public CompletionStage<OpenSavedEncounterPlanResult> openSavedEncounter(long planId, boolean discard) {
            return CompletableFuture.completedFuture(null);
        }
        @Override public void addNpc(long npcId) { }
        @Override public void setLocation(long locationId) { }
    }

    private static final class QueuedDispatcher implements UiDispatcher {
        private final ArrayDeque<Runnable> pending = new ArrayDeque<>();
        @Override public void dispatch(Runnable update) { pending.add(update); }
        private void runAll() { while (!pending.isEmpty()) { pending.removeFirst().run(); } }
    }
}
