package features.catalog;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertThrows;

import features.catalog.application.CatalogWorkspaceState;
import features.catalog.application.CatalogActiveSection;
import features.catalog.application.CatalogSectionBinding;
import features.catalog.application.ItemsCatalogQuery;
import features.catalog.application.MonsterCatalogQuery;
import features.creatures.api.CreatureCatalogPage;
import features.creatures.api.CreatureCatalogPageResult;
import features.creatures.api.CreatureCatalogQuery;
import features.creatures.api.CreatureCatalogQueryApi;
import features.creatures.api.CreatureCatalogRow;
import features.creatures.api.CreatureFilterOptions;
import features.creatures.api.CreatureFilterOptionsResult;
import features.creatures.api.CreatureQueryStatus;
import features.creatures.api.CreatureReadStatus;
import features.creatures.api.CreatureReferenceIndexModel;
import features.creatures.api.CreatureReferenceIndexResult;
import features.creatures.api.CreatureReferenceIndexStatus;
import features.encounter.api.EncounterBuilderInputs;
import features.encounter.api.EncounterPoolFiltersModel;
import features.encounter.api.EncounterPoolFilters;
import features.encounter.api.OpenSavedEncounterPlanResult;
import features.encounter.api.SavedEncounterPlanListModel;
import features.encounter.api.SavedEncounterPlanListResult;
import features.encounter.api.SavedEncounterPlanSummary;
import features.encounter.api.SavedEncounterPlanStatus;
import features.encountertable.api.EncounterTableApi;
import features.encountertable.api.EncounterTableCatalogModel;
import features.encountertable.api.EncounterTableCatalogResult;
import features.encountertable.api.EncounterTableReadStatus;
import features.encountertable.api.RefreshEncounterTableCandidatesCommand;
import features.encountertable.api.RefreshEncounterTableCatalogCommand;
import features.items.api.ItemsCatalogApi;
import features.worldplanner.api.WorldPlannerReadStatus;
import features.worldplanner.api.WorldPlannerSnapshot;
import features.worldplanner.api.WorldPlannerSnapshotModel;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Consumer;
import javafx.application.Platform;
import javafx.scene.Node;
import javafx.scene.Parent;
import javafx.scene.Scene;
import javafx.scene.control.Button;
import javafx.scene.control.ScrollPane;
import javafx.scene.control.TableView;
import javafx.scene.control.TextField;
import javafx.scene.control.ToggleButton;
import javafx.scene.layout.BorderPane;
import javafx.stage.Stage;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import platform.ui.DirectUiDispatcher;
import shell.api.ShellBinding;
import shell.api.ShellSlot;

@Tag("ui")
final class CatalogFeatureLifecycleTest {

    private static final AtomicBoolean FX_STARTED = new AtomicBoolean();

    @AfterAll
    static void shutdownFx() throws Exception {
        if (FX_STARTED.get()) {
            runOnFx(() -> testsupport.JavaFxRuntime.shutdown());
        }
    }

    @Test
    void productionBindingActivatesOnlySelectedSessionAndBalancesItsSubscription() throws Exception {
        runOnFx(() -> {
            TrackingSubscription<EncounterBuilderInputs> builder = new TrackingSubscription<>(
                    EncounterBuilderInputs.empty(),
                    new EncounterBuilderInputs(new EncounterPoolFilters(
                            "published", null, null, List.of(), List.of(), List.of(), List.of(), List.of(),
                            List.of(), List.of(), 0L),
                            features.encounter.api.EncounterTuningSettings.defaults()));
            TrackingSubscription<SavedEncounterPlanListResult> saved = new TrackingSubscription<>(
                    new SavedEncounterPlanListResult(SavedEncounterPlanStatus.SUCCESS, List.of(), ""), null);
            TrackingSubscription<CreatureReferenceIndexResult> creatures = new TrackingSubscription<>(
                    new CreatureReferenceIndexResult(CreatureReferenceIndexStatus.SUCCESS, 1L, List.of()), null);
            TrackingSubscription<WorldPlannerSnapshot> world = new TrackingSubscription<>(
                    emptyWorld(), null);
            TrackingSubscription<EncounterTableCatalogResult> tables = new TrackingSubscription<>(
                    new EncounterTableCatalogResult(EncounterTableReadStatus.SUCCESS, List.of()), null);
            ControllableCreatureQueries queries = new ControllableCreatureQueries();
            ControllableItemsApi items = new ControllableItemsApi();
            CatalogFeature.Component component = create(
                    queries, items, builder, saved, creatures, world, tables, new RecordingItemRoute());
            ShellBinding binding = component.contribution().bind();

            binding.onActivate();
            assertEquals(1, queries.filterOptions.size());
            assertEquals(1, queries.searches.size());
            assertEquals(0, items.filterOptions.size());
            assertEquals(0, items.searches.size());
            assertTracker(builder, 1, 1);
            assertTracker(saved, 0, 0);
            assertTracker(creatures, 0, 0);
            assertTracker(world, 0, 0);
            assertTracker(tables, 0, 0);
            CatalogWorkspaceState current = component.controller().publication().current();
            assertEquals("published", ((MonsterCatalogQuery) activeBinding(current).state().draft())
                            .filters().nameQuery(),
                    "Encounter-owned filters must initialize the selected Monster draft");

            binding.onDeactivate();
            assertActive(builder, 0);
            assertActive(saved, 0);
            assertActive(creatures, 0);
            assertActive(world, 0);
            assertActive(tables, 0);

            binding.onActivate();
            assertEquals(1, queries.filterOptions.size(),
                    "reactivation must share the unresolved successful-only option load");
            assertEquals(2, queries.searches.size());
            assertEquals(0, items.filterOptions.size());
            assertEquals(0, items.searches.size());
            assertTracker(builder, 2, 1);
            assertTracker(saved, 0, 0);
            assertTracker(creatures, 0, 0);
            assertTracker(world, 0, 0);
            assertTracker(tables, 0, 0);

            component.close();
            component.close();
            assertActive(builder, 0);
            assertActive(saved, 0);
            assertActive(creatures, 0);
            assertActive(world, 0);
            assertActive(tables, 0);
        });
    }

    @Test
    void switchingSessionsRejectsLateResultsAndNeverLoadsAnInactiveProvider() throws Exception {
        runOnFx(() -> {
            TrackingSubscription<EncounterBuilderInputs> builder =
                    new TrackingSubscription<>(EncounterBuilderInputs.empty(), null);
            TrackingSubscription<SavedEncounterPlanListResult> saved = new TrackingSubscription<>(
                    new SavedEncounterPlanListResult(SavedEncounterPlanStatus.SUCCESS, List.of(), ""), null);
            TrackingSubscription<CreatureReferenceIndexResult> creatures = new TrackingSubscription<>(
                    new CreatureReferenceIndexResult(CreatureReferenceIndexStatus.SUCCESS, 1L, List.of()), null);
            TrackingSubscription<WorldPlannerSnapshot> world = new TrackingSubscription<>(emptyWorld(), null);
            TrackingSubscription<EncounterTableCatalogResult> tables = new TrackingSubscription<>(
                    new EncounterTableCatalogResult(EncounterTableReadStatus.SUCCESS, List.of()), null);
            ControllableCreatureQueries queries = new ControllableCreatureQueries();
            ControllableItemsApi items = new ControllableItemsApi();
            RecordingItemRoute itemRoute = new RecordingItemRoute();
            CatalogFeature.Component component = create(
                    queries, items, builder, saved, creatures, world, tables, itemRoute);
            ShellBinding binding = component.contribution().bind();
            binding.onActivate();
            assertEquals(1, queries.searches.size());
            assertEquals(0, items.searches.size());

            component.controller().selectSection(features.catalog.application.CatalogSectionId.ITEMS);
            assertEquals(1, items.searches.size());
            assertEquals(1, items.filterOptions.size());
            assertActive(builder, 0);
            items.filterOptions.getFirst().complete(itemOptions("Initial"));
            items.searches.getFirst().complete(itemPage("accepted"));

            activeBinding(component.controller().publication().current()).commands().submit().run();
            CompletableFuture<ItemsCatalogApi.FilterOptionsResult> lateOptions = items.filterOptions.getLast();
            CompletableFuture<ItemsCatalogApi.PageResult> lateItems = items.searches.getLast();
            component.controller().selectSection(features.catalog.application.CatalogSectionId.MONSTERS);

            assertEquals(2, queries.searches.size());
            assertEquals(1, queries.filterOptions.size(),
                    "returning to Monster must coalesce its still-pending option load");
            assertEquals(2, items.searches.size());
            queries.filterOptions.getLast().complete(filterOptions("New"));
            queries.searches.getLast().complete(creaturePage(2L, "Newer"));
            lateOptions.complete(itemOptions("Late"));
            lateItems.complete(itemPage("late"));
            queries.filterOptions.getFirst().complete(filterOptions("Stale"));
            queries.searches.getFirst().complete(creaturePage(1L, "Stale"));

            assertEquals(List.of(2L), activeBinding(component.controller().publication().current())
                    .state().result().rows().stream().map(CreatureCatalogRow.class::cast)
                    .map(CreatureCatalogRow::id).toList());
            component.controller().selectSection(features.catalog.application.CatalogSectionId.ITEMS);
            CatalogSectionBinding<?, ?, ?> retainedItems = activeBinding(
                    component.controller().publication().current());
            assertTrue(retainedItems.state().draft() instanceof ItemsCatalogQuery);
            assertEquals(List.of("accepted"), retainedItems.state().result().rows().stream()
                    .map(ItemsCatalogApi.ItemRow.class::cast).map(ItemsCatalogApi.ItemRow::sourceKey).toList());
            component.close();
        });
    }

    @Test
    void savedEncounterRowLinkOpensUnselectedPlanAndConfirmsOnceThroughProductionRoute() throws Exception {
        runOnFx(() -> {
            TrackingSubscription<EncounterBuilderInputs> builder =
                    new TrackingSubscription<>(EncounterBuilderInputs.empty(), null);
            TrackingSubscription<SavedEncounterPlanListResult> saved = new TrackingSubscription<>(
                    new SavedEncounterPlanListResult(
                            SavedEncounterPlanStatus.SUCCESS,
                            List.of(new SavedEncounterPlanSummary(41L, "Proof plan", "One creature")), ""),
                    null);
            TrackingSubscription<CreatureReferenceIndexResult> creatures = new TrackingSubscription<>(
                    new CreatureReferenceIndexResult(CreatureReferenceIndexStatus.SUCCESS, 1L, List.of()), null);
            TrackingSubscription<WorldPlannerSnapshot> world = new TrackingSubscription<>(emptyWorld(), null);
            TrackingSubscription<EncounterTableCatalogResult> tables = new TrackingSubscription<>(
                    new EncounterTableCatalogResult(EncounterTableReadStatus.SUCCESS, List.of()), null);
            RecordingSavedOpen savedOpen = new RecordingSavedOpen();
            CatalogFeature.Component component = create(
                    new ControllableCreatureQueries(), new ControllableItemsApi(), builder, saved,
                    creatures, world, tables, new RecordingItemRoute(), savedOpen);
            ShellBinding binding = component.contribution().bind();
            Parent main = (Parent) binding.slotContent().get(ShellSlot.COCKPIT_MAIN);
            Parent controls = main;
            BorderPane host = new BorderPane(main);
            Stage stage = new Stage();
            stage.setScene(new Scene(host, 1_180.0, 720.0));
            stage.show();
            binding.onActivate();
            toggle(controls, "Katalogbereich Encounter").fire();
            host.applyCss();
            host.layout();
            TableView<?> plans = descendants(main).stream()
                    .filter(TableView.class::isInstance).map(TableView.class::cast)
                    .filter(table -> "Gespeicherte Encounter".equals(table.getAccessibleText()))
                    .findFirst().orElseThrow();
            assertNull(plans.getSelectionModel().getSelectedItem());

            button(main, "Öffnen: Proof plan").fire();

            assertEquals(List.of(false), savedOpen.discardFlags());
            assertEquals(List.of(41L), savedOpen.planIds());
            assertNull(plans.getSelectionModel().getSelectedItem(),
                    "saved-plan row link must not mutate Catalog selection");
            savedOpen.requests.getFirst().complete(new OpenSavedEncounterPlanResult(
                    OpenSavedEncounterPlanResult.Status.CONFIRMATION_REQUIRED, 41L, "Discard?"));
            CatalogSectionBinding<?, ?, ?> pending = activeBinding(component.controller().publication().current());
            assertTrue(pending.confirmation().required());
            assertTrue(pending.state().selectedKey().isEmpty());
            Button confirm = button(controls, "Verwerfen und öffnen");
            assertTrue(confirm.isVisible());
            confirm.fire();
            confirm.fire();
            assertEquals(List.of(false, true), savedOpen.discardFlags());
            assertEquals(List.of(41L, 41L), savedOpen.planIds());
            assertNull(plans.getSelectionModel().getSelectedItem());
            component.close();
            stage.close();
        });
    }

    private static CatalogFeature.Component create(
            ControllableCreatureQueries queries,
            ControllableItemsApi items,
            TrackingSubscription<EncounterBuilderInputs> builder,
            TrackingSubscription<SavedEncounterPlanListResult> saved,
            TrackingSubscription<CreatureReferenceIndexResult> creatures,
            TrackingSubscription<WorldPlannerSnapshot> world,
            TrackingSubscription<EncounterTableCatalogResult> tables,
            RecordingItemRoute itemRoute
    ) {
        return create(queries, items, builder, saved, creatures, world, tables, itemRoute, defaultEncounter());
    }

    private static CatalogSectionBinding<?, ?, ?> activeBinding(CatalogWorkspaceState state) {
        AtomicReference<CatalogSectionBinding<?, ?, ?>> binding = new AtomicReference<>();
        state.activeSection().dispatch(new CatalogActiveSection.Receiver() {
            @Override public <Q, R, K> void accept(CatalogSectionBinding<Q, R, K> active) {
                binding.set(active);
            }
        });
        return binding.get();
    }

    private static CatalogFeature.Component create(
            ControllableCreatureQueries queries,
            ControllableItemsApi items,
            TrackingSubscription<EncounterBuilderInputs> builder,
            TrackingSubscription<SavedEncounterPlanListResult> saved,
            TrackingSubscription<CreatureReferenceIndexResult> creatures,
            TrackingSubscription<WorldPlannerSnapshot> world,
            TrackingSubscription<EncounterTableCatalogResult> tables,
            RecordingItemRoute itemRoute,
            CatalogRoutes.EncounterHandoff encounter
    ) {
        EncounterTableApi tableCommands = new EncounterTableApi() {
            @Override public void refreshCatalog(RefreshEncounterTableCatalogCommand command) { }
            @Override public void refreshCandidates(RefreshEncounterTableCandidatesCommand command) { }
        };
        CatalogProviders providers = new CatalogProviders(
                new CatalogProviders.MonsterProviders(
                        queries, new EncounterPoolFiltersModel(
                                () -> builder.current().poolFilters(),
                                listener -> builder.subscribe(inputs -> listener.accept(inputs.poolFilters())),
                                listener -> builder.observeLatest(inputs -> listener.accept(inputs.poolFilters())))),
                new CatalogProviders.ItemsProviders(items),
                new CatalogProviders.SavedEncounterProviders(
                        new SavedEncounterPlanListModel(saved::current, saved::subscribe, saved::observeLatest)),
                new CatalogProviders.WorldReferenceProviders(
                        new CreatureReferenceIndexModel(
                                creatures::current, creatures::subscribe, creatures::observeLatest),
                        new WorldPlannerSnapshotModel(world::current, world::subscribe, world::observeLatest)),
                new CatalogProviders.EncounterTableProviders(
                        tableCommands, new EncounterTableCatalogModel(
                                tables::current, tables::subscribe, tables::observeLatest)),
                DirectUiDispatcher.INSTANCE);
        return CatalogFeature.create(providers, routes(itemRoute, encounter));
    }

    private static CatalogRoutes routes(RecordingItemRoute itemRoute) {
        return routes(itemRoute, defaultEncounter());
    }

    private static CatalogRoutes routes(
            RecordingItemRoute itemRoute,
            CatalogRoutes.EncounterHandoff encounter
    ) {
        CatalogRoutes.WorldInspectorRoutes world = new CatalogRoutes.WorldInspectorRoutes() {
            @Override public void openNpc(long npcId) { }
            @Override public void openFaction(long factionId) { }
            @Override public void openLocation(long locationId) { }
            @Override public void createNpc() { }
            @Override public void createFaction() { }
            @Override public void createLocation() { }
        };
        CatalogRoutes.SceneHandoff scene = new CatalogRoutes.SceneHandoff() {
            @Override public void addCreature(long creatureId) { }
            @Override public void addNpc(long npcId) { }
            @Override public void setLocation(long locationId) { }
        };
        return new CatalogRoutes(ignored -> { }, itemRoute, world, encounter, scene);
    }

    private static CatalogRoutes.EncounterHandoff defaultEncounter() {
        return new CatalogRoutes.EncounterHandoff() {
            @Override public void updatePoolFilters(EncounterPoolFilters filters) { }
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
        };
    }

    private static CreatureCatalogPageResult creaturePage(long id, String name) {
        CreatureCatalogRow row = new CreatureCatalogRow(id, name, "Medium", "Humanoid", "", "1", 200, 10, 10);
        return new CreatureCatalogPageResult(
                CreatureQueryStatus.SUCCESS, new CreatureCatalogPage(List.of(row), 1, 50, 0));
    }

    private static CreatureFilterOptionsResult filterOptions(String type) {
        return new CreatureFilterOptionsResult(CreatureReadStatus.SUCCESS,
                new CreatureFilterOptions(List.of(), List.of(type), List.of(), List.of(), List.of(), List.of()));
    }

    private static ItemsCatalogApi.PageResult itemPage(String key) {
        return new ItemsCatalogApi.PageResult(ItemsCatalogApi.CatalogStatus.SUCCESS,
                List.of(new ItemsCatalogApi.ItemRow(
                        key, key, "Weapon", "Martial", false, "Common", false, 1, "1 cp")),
                1, 50, 0);
    }

    private static ItemsCatalogApi.DetailResult itemDetail(String key) {
        return new ItemsCatalogApi.DetailResult(ItemsCatalogApi.CatalogStatus.SUCCESS,
                new ItemsCatalogApi.ItemDetail(
                        key, key, "Weapon", "Martial", false, "Common", false, 1, "1 cp", 1.0,
                        "", "", List.of(), "", "test", ""));
    }

    private static ItemsCatalogApi.FilterOptionsResult itemOptions(String category) {
        return new ItemsCatalogApi.FilterOptionsResult(
                ItemsCatalogApi.CatalogStatus.SUCCESS, List.of(category), List.of(), List.of());
    }

    private static WorldPlannerSnapshot emptyWorld() {
        return new WorldPlannerSnapshot(WorldPlannerReadStatus.SUCCESS, List.of(), List.of(), List.of(), "");
    }

    private static void assertTracker(TrackingSubscription<?> tracker, int subscriptions, int active) {
        assertEquals(subscriptions, tracker.subscriptions.get());
        assertEquals(active, tracker.active.get());
    }

    private static void assertActive(TrackingSubscription<?> tracker, int active) {
        assertEquals(active, tracker.active.get());
    }

    private static List<String> failureMessages(Throwable failure) {
        List<String> messages = new ArrayList<>();
        messages.add(failure.getMessage());
        for (Throwable suppressed : failure.getSuppressed()) {
            messages.addAll(failureMessages(suppressed));
        }
        return List.copyOf(messages);
    }

    private static ToggleButton toggle(Parent root, String accessibleText) {
        return descendants(root).stream().filter(ToggleButton.class::isInstance).map(ToggleButton.class::cast)
                .filter(button -> accessibleText.equals(button.getAccessibleText())).findFirst().orElseThrow();
    }

    private static Button button(Parent root, String accessibleText) {
        return descendants(root).stream().filter(Button.class::isInstance).map(Button.class::cast)
                .filter(button -> accessibleText.equals(button.getAccessibleText())).findFirst().orElseThrow();
    }

    private static List<Node> descendants(Node root) {
        List<Node> result = new ArrayList<>();
        collect(root, result);
        return List.copyOf(result);
    }

    private static void collect(Node node, List<Node> result) {
        result.add(node);
        if (node instanceof ScrollPane scrollPane && scrollPane.getContent() != null) {
            collect(scrollPane.getContent(), result);
            return;
        }
        if (node instanceof Parent parent) {
            parent.getChildrenUnmodifiable().forEach(child -> collect(child, result));
        }
    }

    private static void runOnFx(ThrowingRunnable action) throws Exception {
        CountDownLatch latch = new CountDownLatch(1);
        Throwable[] failure = new Throwable[1];
        Runnable wrapped = () -> {
            try {
                Platform.setImplicitExit(false);
                action.run();
            } catch (Throwable throwable) {
                failure[0] = throwable;
            } finally {
                latch.countDown();
            }
        };
        if (FX_STARTED.compareAndSet(false, true)) {
            testsupport.JavaFxRuntime.startup(wrapped);
        } else {
            Platform.runLater(wrapped);
        }
        assertTrue(latch.await(30, TimeUnit.SECONDS));
        if (failure[0] != null) {
            throw new AssertionError(failure[0]);
        }
    }

    private static final class TrackingSubscription<T> {
        private final T current;
        private final T synchronousPublication;
        private final AtomicInteger subscriptions = new AtomicInteger();
        private final AtomicInteger active = new AtomicInteger();
        private final AtomicInteger currentCalls = new AtomicInteger();
        private final AtomicInteger unsubscribeAttempts = new AtomicInteger();
        private Consumer<T> listener = ignored -> { };
        private RuntimeException observationFailure;
        private Throwable unsubscribeFailure;

        private TrackingSubscription(T current, T synchronousPublication) {
            this.current = current;
            this.synchronousPublication = synchronousPublication;
        }

        T current() {
            currentCalls.incrementAndGet();
            return current;
        }

        Runnable subscribe(Consumer<T> listener) {
            subscriptions.incrementAndGet();
            active.incrementAndGet();
            this.listener = listener;
            if (synchronousPublication != null) {
                listener.accept(synchronousPublication);
            }
            AtomicBoolean open = new AtomicBoolean(true);
            return () -> {
                if (open.compareAndSet(true, false)) {
                    active.decrementAndGet();
                    this.listener = ignored -> { };
                }
            };
        }

        Runnable observeLatest(Consumer<T> next) {
            if (observationFailure != null) {
                throw observationFailure;
            }
            subscriptions.incrementAndGet();
            active.incrementAndGet();
            listener = next;
            next.accept(synchronousPublication == null ? current : synchronousPublication);
            AtomicBoolean open = new AtomicBoolean(true);
            return () -> {
                if (open.compareAndSet(true, false)) {
                    unsubscribeAttempts.incrementAndGet();
                    active.decrementAndGet();
                    listener = ignored -> { };
                    if (unsubscribeFailure instanceof RuntimeException runtimeFailure) {
                        throw runtimeFailure;
                    }
                    if (unsubscribeFailure instanceof Error error) {
                        throw error;
                    }
                }
            };
        }

        void emit(T value) {
            listener.accept(value);
        }
    }

    private static final class ControllableCreatureQueries implements CreatureCatalogQueryApi {
        private final List<CompletableFuture<CreatureCatalogPageResult>> searches = new ArrayList<>();
        private final List<CompletableFuture<CreatureFilterOptionsResult>> filterOptions = new ArrayList<>();

        @Override
        public CompletionStage<CreatureCatalogPageResult> search(CreatureCatalogQuery query) {
            CompletableFuture<CreatureCatalogPageResult> future = new CompletableFuture<>();
            searches.add(future);
            return future;
        }

        @Override
        public CompletionStage<CreatureFilterOptionsResult> loadFilterOptions() {
            CompletableFuture<CreatureFilterOptionsResult> future = new CompletableFuture<>();
            filterOptions.add(future);
            return future;
        }
    }

    private static final class ControllableItemsApi implements ItemsCatalogApi {
        private final List<CompletableFuture<PageResult>> searches = new ArrayList<>();
        private final List<CompletableFuture<DetailResult>> details = new ArrayList<>();
        private final List<CompletableFuture<FilterOptionsResult>> filterOptions = new ArrayList<>();

        @Override
        public CompletionStage<FilterOptionsResult> loadFilterOptions() {
            CompletableFuture<FilterOptionsResult> future = new CompletableFuture<>();
            filterOptions.add(future);
            return future;
        }

        @Override
        public CompletionStage<PageResult> search(ItemQuery query) {
            CompletableFuture<PageResult> future = new CompletableFuture<>();
            searches.add(future);
            return future;
        }

        @Override
        public CompletionStage<DetailResult> loadDetail(String sourceKey) {
            CompletableFuture<DetailResult> future = new CompletableFuture<>();
            details.add(future);
            return future;
        }
    }

    private static final class RecordingSavedOpen implements CatalogRoutes.EncounterHandoff {
        private final List<Boolean> flags = new ArrayList<>();
        private final List<Long> planIds = new ArrayList<>();
        private final List<CompletableFuture<OpenSavedEncounterPlanResult>> requests = new ArrayList<>();

        private List<Boolean> discardFlags() {
            return List.copyOf(flags);
        }

        private List<Long> planIds() {
            return List.copyOf(planIds);
        }

        @Override public CompletionStage<OpenSavedEncounterPlanResult> openSavedEncounter(
                long planId,
                boolean discardUnsavedChanges
        ) {
            flags.add(discardUnsavedChanges);
            planIds.add(planId);
            CompletableFuture<OpenSavedEncounterPlanResult> future = new CompletableFuture<>();
            requests.add(future);
            return future;
        }

        @Override public void updatePoolFilters(EncounterPoolFilters filters) { }
        @Override public void addCreature(long creatureId) { }
        @Override public void addWorldNpc(long creatureId, long npcId) { }
        @Override public void useFactionSource(long factionId) { }
        @Override public void useLocationSource(long locationId) { }
        @Override public void useEncounterTableSource(long tableId) { }
    }

    private static final class RecordingItemRoute implements CatalogRoutes.ItemInspectorRoute {
        private final List<String> opened = new ArrayList<>();

        @Override
        public void openItem(ItemsCatalogApi.ItemDetail detail) {
            opened.add(detail.sourceKey());
        }
    }

    @FunctionalInterface
    private interface ThrowingRunnable {
        void run() throws Exception;
    }
}
