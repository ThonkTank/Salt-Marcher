package features.catalog.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import features.catalog.application.CatalogApplicationRoutes.EncounterHandoff;
import features.catalog.application.CatalogApplicationRoutes.SceneHandoff;
import features.catalog.application.CatalogApplicationRoutes.WorldInspectorRoutes;
import features.creatures.api.CreatureCatalogRow;
import features.creatures.api.CreatureReferenceIndexModel;
import features.creatures.api.CreatureReferenceIndexResult;
import features.creatures.api.CreatureReferenceIndexStatus;
import features.encounter.api.EncounterPoolFilters;
import features.encounter.api.OpenSavedEncounterPlanResult;
import features.encountertable.api.EncounterTableCatalogResult;
import features.encountertable.api.EncounterTableReadStatus;
import features.encountertable.api.EncounterTableSummary;
import features.worldplanner.api.WorldDispositionKind;
import features.worldplanner.api.WorldFactionSummary;
import features.worldplanner.api.WorldLocationSummary;
import features.worldplanner.api.WorldNpcLifecycleStatus;
import features.worldplanner.api.WorldNpcSummary;
import features.worldplanner.api.WorldPlannerReadStatus;
import features.worldplanner.api.WorldPlannerSnapshot;
import features.worldplanner.api.WorldPlannerSnapshotModel;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Consumer;
import org.junit.jupiter.api.Test;
import platform.ui.DirectUiDispatcher;
import platform.ui.UiDispatcher;

final class WorldReferenceCatalogControllerTest {

    @Test
    void projectsExactLabelsIndependentQueriesStableSelectionsStatusesAndNamedRoutes() {
        MutableModel<CreatureReferenceIndexResult> creatures = new MutableModel<>(creatures("Wolf"));
        MutableModel<WorldPlannerSnapshot> world = new MutableModel<>(world("Red", "Ruins", 9L));
        RecordingRoutes routes = new RecordingRoutes();
        AtomicInteger changes = new AtomicInteger();
        WorldReferenceCatalogController controller = controller(
                creatures, world, routes, DirectUiDispatcher.INSTANCE, changes::incrementAndGet);

        controller.activate();
        controller.acceptEncounterTableLabels(new EncounterTableCatalogResult(
                EncounterTableReadStatus.SUCCESS, List.of(new EncounterTableSummary(9L, "Ambushes", null))));
        WorldReferenceCatalogState state = controller.state();
        assertEquals(CatalogResultState.Status.READY, state.npcs().results().status());
        assertEquals("Wolf (#7) · Red (#2) · NEUTRAL · ACTIVE",
                state.npcs().results().rows().getFirst().details());
        assertEquals("Ambushes (#9) · Haltung 3 · 1 NPCs",
                state.factions().results().rows().getFirst().details());
        assertEquals("Red (#2) · Ambushes (#9)",
                state.locations().results().rows().getFirst().details());
        assertEquals(List.of(new CatalogReferenceOption(2L, "Red")), state.factionOptions());
        assertEquals(List.of(new CatalogReferenceOption(3L, "Ruins")), state.locationOptions());

        controller.accept(new WorldReferenceCatalogIntent.SelectNpc(1L));
        controller.accept(new WorldReferenceCatalogIntent.SelectFaction(2L));
        controller.accept(new WorldReferenceCatalogIntent.SelectLocation(3L));
        controller.accept(new WorldReferenceCatalogIntent.ChangeNpcQuery("  wolf  "));
        controller.accept(new WorldReferenceCatalogIntent.ChangeFactionQuery("ambush"));
        controller.accept(new WorldReferenceCatalogIntent.ChangeLocationQuery("red"));
        assertEquals("  wolf  ", controller.state().npcs().query());
        assertEquals("ambush", controller.state().factions().query());
        assertEquals("red", controller.state().locations().query());

        creatures.emit(creatures("Dire Wolf"));
        world.emit(world("Crimson", "Old Ruins", 9L));
        controller.acceptEncounterTableLabels(new EncounterTableCatalogResult(
                EncounterTableReadStatus.SUCCESS, List.of(new EncounterTableSummary(9L, "Night Ambush", null))));
        assertEquals(1L, controller.state().npcs().selectedId());
        assertEquals(2L, controller.state().factions().selectedId());
        assertEquals(3L, controller.state().locations().selectedId());

        controller.accept(new WorldReferenceCatalogIntent.OpenNpc(1L));
        controller.accept(new WorldReferenceCatalogIntent.AddNpcToEncounter(1L));
        controller.accept(new WorldReferenceCatalogIntent.AddNpcToScene(1L));
        controller.accept(new WorldReferenceCatalogIntent.OpenFaction(2L));
        controller.accept(new WorldReferenceCatalogIntent.UseFactionAsEncounterSource(2L));
        controller.accept(new WorldReferenceCatalogIntent.OpenLocation(3L));
        controller.accept(new WorldReferenceCatalogIntent.UseLocationAsEncounterSource(3L));
        controller.accept(new WorldReferenceCatalogIntent.SetFocusedSceneLocation(3L));
        controller.accept(new WorldReferenceCatalogIntent.CreateNpc());
        controller.accept(new WorldReferenceCatalogIntent.CreateFaction());
        controller.accept(new WorldReferenceCatalogIntent.CreateLocation());
        assertEquals(List.of("open-npc:1", "open-faction:2", "open-location:3",
                "create-npc", "create-faction", "create-location"), routes.inspectorCalls);
        assertEquals(List.of("npc:7:1", "faction:2", "location:3"), routes.encounterCalls);
        assertEquals(List.of("npc:1", "location:3"), routes.sceneCalls);

        int calls = routes.totalCalls();
        controller.accept(new WorldReferenceCatalogIntent.OpenNpc(999L));
        controller.accept(new WorldReferenceCatalogIntent.AddNpcToEncounter(999L));
        controller.accept(new WorldReferenceCatalogIntent.UseFactionAsEncounterSource(999L));
        controller.accept(new WorldReferenceCatalogIntent.SetFocusedSceneLocation(999L));
        assertEquals(calls, routes.totalCalls(), "stale ids must not reach any route");

        world.emit(new WorldPlannerSnapshot(
                WorldPlannerReadStatus.SUCCESS, List.of(), List.of(), List.of(), ""));
        assertEquals(0L, controller.state().npcs().selectedId());
        assertEquals(0L, controller.state().factions().selectedId());
        assertEquals(0L, controller.state().locations().selectedId());
        assertEquals(CatalogResultState.Status.EMPTY, controller.state().npcs().results().status());

        world.emit(new WorldPlannerSnapshot(
                WorldPlannerReadStatus.STORAGE_ERROR, List.of(), List.of(), List.of(), "DB offline"));
        assertEquals(CatalogResultState.Status.FAILED, controller.state().npcs().results().status());
        assertEquals("DB offline", controller.state().npcs().results().message());
        world.emit(null);
        assertEquals(CatalogResultState.Status.FAILED, controller.state().npcs().results().status());
        assertTrue(changes.get() > 0);
    }

    @Test
    void usesDispatcherAndRejectsQueuedAndLatePublicationsAfterDeactivateOrClose() {
        MutableModel<CreatureReferenceIndexResult> creatures = new MutableModel<>(creatures("Wolf"));
        MutableModel<WorldPlannerSnapshot> world = new MutableModel<>(world("Red", "Ruins", 9L));
        QueuedDispatcher dispatcher = new QueuedDispatcher();
        RecordingRoutes routes = new RecordingRoutes();
        WorldReferenceCatalogController controller = controller(creatures, world, routes, dispatcher, () -> { });

        controller.activate();
        assertEquals(2, dispatcher.size());
        controller.deactivate();
        dispatcher.runAll();
        assertEquals(CatalogResultState.Status.LOADING, controller.state().npcs().results().status());
        assertEquals(0, creatures.activeSubscriptions());
        assertEquals(0, world.activeSubscriptions());

        controller.activate();
        dispatcher.runAll();
        assertEquals(CatalogResultState.Status.READY, controller.state().npcs().results().status());
        controller.deactivate();
        world.emit(new WorldPlannerSnapshot(
                WorldPlannerReadStatus.STORAGE_ERROR, List.of(), List.of(), List.of(), "late"));
        dispatcher.runAll();
        assertEquals(CatalogResultState.Status.READY, controller.state().npcs().results().status());

        controller.close();
        controller.accept(new WorldReferenceCatalogIntent.ChangeNpcQuery("ignored"));
        assertEquals("", controller.state().npcs().query());
        assertEquals(WorldReferenceCatalogState.Lifecycle.CLOSED, controller.state().lifecycle());
    }

    @Test
    void preservesFallbackAndEmptyJoinLabelsExactly() {
        MutableModel<CreatureReferenceIndexResult> creatures = new MutableModel<>(
                new CreatureReferenceIndexResult(CreatureReferenceIndexStatus.SUCCESS, 1L, List.of()));
        WorldNpcSummary unknown = new WorldNpcSummary(
                1L, "Unknown", 7L, "", "", "", "", 99L, 0, 0,
                WorldDispositionKind.NEUTRAL, WorldNpcLifecycleStatus.ACTIVE);
        WorldNpcSummary absent = new WorldNpcSummary(
                4L, "Absent", 0L, "", "", "", "", 0L, 0, 0,
                WorldDispositionKind.NEUTRAL, WorldNpcLifecycleStatus.ACTIVE);
        WorldFactionSummary faction = new WorldFactionSummary(
                2L, "Faction", "", 88L, 0, List.of(), List.of());
        WorldLocationSummary location = new WorldLocationSummary(
                3L, "Empty", "", List.of(), List.of());
        MutableModel<WorldPlannerSnapshot> world = new MutableModel<>(new WorldPlannerSnapshot(
                WorldPlannerReadStatus.SUCCESS, List.of(unknown, absent), List.of(faction), List.of(location), ""));
        RecordingRoutes routes = new RecordingRoutes();
        WorldReferenceCatalogController controller = controller(
                creatures, world, routes, DirectUiDispatcher.INSTANCE, () -> { });

        controller.activate();
        assertEquals("Statblock #7 · Keine Fraktion #99 · NEUTRAL · ACTIVE",
                controller.state().npcs().results().rows().getFirst().details());
        assertEquals("Statblock · Keine Fraktion · NEUTRAL · ACTIVE",
                controller.state().npcs().results().rows().get(1).details());
        assertEquals("Tabelle #88 · Haltung 0 · 0 NPCs",
                controller.state().factions().results().rows().getFirst().details());
        assertEquals("Keine Fraktionen · Keine Tabellen",
                controller.state().locations().results().rows().getFirst().details());
    }

    private static WorldReferenceCatalogController controller(
            MutableModel<CreatureReferenceIndexResult> creatures,
            MutableModel<WorldPlannerSnapshot> world,
            RecordingRoutes routes,
            UiDispatcher dispatcher,
            Runnable changed
    ) {
        return new WorldReferenceCatalogController(
                new CreatureReferenceIndexModel(creatures::current, creatures::subscribe, creatures::observeLatest),
                new WorldPlannerSnapshotModel(world::current, world::subscribe, world::observeLatest),
                routes, routes, routes, dispatcher, changed);
    }

    private static CreatureReferenceIndexResult creatures(String name) {
        return new CreatureReferenceIndexResult(
                CreatureReferenceIndexStatus.SUCCESS, 1L,
                List.of(new CreatureCatalogRow(7L, name, "Medium", "Beast", "", "1", 0, 0, 0)));
    }

    private static WorldPlannerSnapshot world(String factionName, String locationName, long tableId) {
        WorldNpcSummary npc = new WorldNpcSummary(
                1L, "Guide", 7L, "", "", "", "", 2L, 0, 0,
                WorldDispositionKind.NEUTRAL, WorldNpcLifecycleStatus.ACTIVE);
        WorldFactionSummary faction = new WorldFactionSummary(
                2L, factionName, "", tableId, 3, List.of(1L), List.of());
        WorldLocationSummary location = new WorldLocationSummary(
                3L, locationName, "", List.of(2L), List.of(tableId));
        return new WorldPlannerSnapshot(
                WorldPlannerReadStatus.SUCCESS, List.of(npc), List.of(faction), List.of(location), "");
    }

    private static final class MutableModel<T> {
        private T current;
        private Consumer<T> listener = ignored -> { };
        private int active;

        private MutableModel(T current) { this.current = current; }
        private T current() { return current; }
        private Runnable subscribe(Consumer<T> next) {
            listener = next;
            active++;
            return () -> {
                active--;
                listener = ignored -> { };
            };
        }
        private Runnable observeLatest(Consumer<T> next) {
            Runnable close = subscribe(next);
            next.accept(current);
            return close;
        }
        private void emit(T value) { current = value; listener.accept(value); }
        private int activeSubscriptions() { return active; }
    }

    private static final class QueuedDispatcher implements UiDispatcher {
        private final ArrayDeque<Runnable> pending = new ArrayDeque<>();
        @Override public void dispatch(Runnable update) { pending.add(update); }
        private int size() { return pending.size(); }
        private void runAll() { while (!pending.isEmpty()) { pending.removeFirst().run(); } }
    }

    private static final class RecordingRoutes
            implements WorldInspectorRoutes, EncounterHandoff, SceneHandoff {
        private final List<String> inspectorCalls = new ArrayList<>();
        private final List<String> encounterCalls = new ArrayList<>();
        private final List<String> sceneCalls = new ArrayList<>();

        @Override public void openNpc(long id) { inspectorCalls.add("open-npc:" + id); }
        @Override public void openFaction(long id) { inspectorCalls.add("open-faction:" + id); }
        @Override public void openLocation(long id) { inspectorCalls.add("open-location:" + id); }
        @Override public void createNpc() { inspectorCalls.add("create-npc"); }
        @Override public void createFaction() { inspectorCalls.add("create-faction"); }
        @Override public void createLocation() { inspectorCalls.add("create-location"); }
        @Override public void updatePoolFilters(EncounterPoolFilters filters) { }
        @Override public void addCreature(long creatureId) { }
        @Override public void addWorldNpc(long creatureId, long npcId) {
            encounterCalls.add("npc:" + creatureId + ":" + npcId);
        }
        @Override public void useFactionSource(long id) { encounterCalls.add("faction:" + id); }
        @Override public void useLocationSource(long id) { encounterCalls.add("location:" + id); }
        @Override public void useEncounterTableSource(long id) { encounterCalls.add("table:" + id); }
        @Override public CompletionStage<OpenSavedEncounterPlanResult> openSavedEncounter(long id, boolean discard) {
            return CompletableFuture.completedFuture(null);
        }
        @Override public void addNpc(long id) { sceneCalls.add("npc:" + id); }
        @Override public void setLocation(long id) { sceneCalls.add("location:" + id); }
        private int totalCalls() { return inspectorCalls.size() + encounterCalls.size() + sceneCalls.size(); }
    }
}
