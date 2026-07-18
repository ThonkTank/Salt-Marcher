package features.catalog;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertThrows;

import features.catalog.application.CatalogWorkspaceState;
import features.catalog.application.EncounterTableCatalogState;
import features.catalog.application.ItemsCatalogState;
import features.catalog.application.MonsterCatalogState;
import features.catalog.application.SavedEncounterCatalogState;
import features.catalog.application.WorldReferenceCatalogState;
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
import java.util.function.Consumer;
import javafx.application.Platform;
import javafx.scene.Node;
import javafx.scene.Parent;
import javafx.scene.control.Button;
import javafx.scene.control.ScrollPane;
import javafx.scene.control.TableView;
import javafx.scene.control.TextField;
import javafx.scene.control.ToggleButton;
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
    void productionBindingBalancesAtomicObservationsAcrossReactivationAndClose() throws Exception {
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
            assertEquals(1, items.filterOptions.size(),
                    "Catalog activation must load Items options without selecting the section");
            assertEquals(1, items.searches.size(),
                    "Catalog activation must load the first Items page without selecting the section");
            assertTracker(builder, 1, 1);
            assertTracker(saved, 1, 1);
            assertTracker(creatures, 1, 1);
            assertTracker(world, 1, 1);
            assertTracker(tables, 1, 1);
            CatalogWorkspaceState current = component.controller().publication().current();
            assertEquals("published", current.monsters().filterDraft().nameQuery(),
                    "atomic provider observation must expose its latest snapshot");
            assertEquals(0, builder.currentCalls.get(), "Catalog must not split atomic observation into current plus subscribe");
            long monsterRevision = current.monsters().revision();
            creatures.emit(new CreatureReferenceIndexResult(
                    CreatureReferenceIndexStatus.SUCCESS, 2L, List.of()));
            world.emit(emptyWorld());
            assertEquals(monsterRevision,
                    component.controller().publication().current().monsters().revision(),
                    "reference-index or Scene-facing world publication changed Monster state");

            binding.onDeactivate();
            assertActive(builder, 0);
            assertActive(saved, 0);
            assertActive(creatures, 0);
            assertActive(world, 0);
            assertActive(tables, 0);

            binding.onActivate();
            assertEquals(2, queries.filterOptions.size());
            assertEquals(2, queries.searches.size());
            assertEquals(2, items.filterOptions.size());
            assertEquals(2, items.searches.size());
            assertTracker(builder, 2, 1);
            assertTracker(saved, 2, 1);
            assertTracker(creatures, 2, 1);
            assertTracker(world, 2, 1);
            assertTracker(tables, 2, 1);

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
    void activationFailureReleasesPartialSectionAndWorkspaceAcquisitions() throws Exception {
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
            world.observationFailure = new IllegalStateException("world observation failed");
            CatalogFeature.Component component = create(
                    new ControllableCreatureQueries(), new ControllableItemsApi(), builder, saved,
                    creatures, world, tables, new RecordingItemRoute());
            ShellBinding binding = component.contribution().bind();

            assertThrows(IllegalStateException.class, binding::onActivate);
            assertActive(builder, 0);
            assertActive(saved, 0);
            assertActive(creatures, 0);
            assertActive(world, 0);
            assertActive(tables, 0);
            component.close();
        });
    }

    @Test
    void componentCloseAttemptsEveryProviderCleanupAndRemainsClosedAfterFailures() throws Exception {
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
            builder.unsubscribeFailure = new IllegalStateException("pool cleanup");
            saved.unsubscribeFailure = new IllegalStateException("saved cleanup");
            creatures.unsubscribeFailure = new AssertionError("creature cleanup");
            world.unsubscribeFailure = new IllegalStateException("world cleanup");
            tables.unsubscribeFailure = new IllegalStateException("table cleanup");
            CatalogFeature.Component component = create(
                    new ControllableCreatureQueries(), new ControllableItemsApi(), builder, saved,
                    creatures, world, tables, new RecordingItemRoute());
            ShellBinding shellBinding = component.contribution().bind();
            shellBinding.onActivate();

            RuntimeException failure = assertThrows(RuntimeException.class, component::close);

            for (TrackingSubscription<?> provider : List.of(builder, saved, creatures, world, tables)) {
                assertEquals(1, provider.unsubscribeAttempts.get(), "every provider cleanup must be attempted");
                assertEquals(0, provider.active.get(), "a throwing cleanup must still release its fake resource");
            }
            assertTrue(failure.getSuppressed().length > 0, "later cleanup failures must remain suppressed");
            List<String> messages = failureMessages(failure);
            assertTrue(messages.containsAll(List.of(
                    "pool cleanup", "saved cleanup", "creature cleanup", "world cleanup", "table cleanup")));

            CatalogWorkspaceState closed = component.controller().publication().current();
            assertEquals(MonsterCatalogState.Lifecycle.CLOSED, closed.monsters().lifecycle());
            assertEquals(ItemsCatalogState.Lifecycle.CLOSED, closed.items().lifecycle());
            assertEquals(SavedEncounterCatalogState.Lifecycle.CLOSED, closed.savedEncounters().lifecycle());
            assertEquals(WorldReferenceCatalogState.Lifecycle.CLOSED, closed.worldReferences().lifecycle());
            assertEquals(EncounterTableCatalogState.Lifecycle.CLOSED, closed.encounterTables().lifecycle());
            long closedRevision = closed.revision();

            component.close();
            shellBinding.onActivate();
            assertEquals(closedRevision, component.controller().publication().current().revision(),
                    "closed component must ignore later activation and repeated close");
            for (TrackingSubscription<?> provider : List.of(builder, saved, creatures, world, tables)) {
                assertEquals(1, provider.unsubscribeAttempts.get(), "repeated close must be idempotent");
            }
        });
    }

    @Test
    void productionBindingRejectsStaleAndPostDeactivateMonsterAndItemFutures() throws Exception {
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
            Parent controls = (Parent) binding.slotContent().get(ShellSlot.COCKPIT_CONTROLS);
            Parent main = (Parent) binding.slotContent().get(ShellSlot.COCKPIT_MAIN);

            binding.onActivate();
            assertEquals(1, queries.searches.size());
            assertEquals(1, items.filterOptions.size());
            assertEquals(1, items.searches.size());
            TextField monsterQuery = descendants(controls).stream()
                    .filter(TextField.class::isInstance).map(TextField.class::cast).findFirst().orElseThrow();
            monsterQuery.setText("newer");
            assertEquals(2, queries.searches.size());
            queries.searches.get(1).complete(creaturePage(2L, "Newer"));
            queries.searches.get(0).complete(creaturePage(1L, "Stale"));
            assertEquals(List.of(2L), component.controller().publication().current()
                    .monsters().results().rows().stream().map(CreatureCatalogRow::id).toList());

            binding.onDeactivate();
            binding.onActivate();
            assertEquals(2, queries.filterOptions.size());
            queries.filterOptions.get(1).complete(filterOptions("New"));
            queries.filterOptions.get(0).complete(filterOptions("Stale"));
            assertEquals(List.of("New"), component.controller().publication().current()
                    .monsters().filterOptions().types());

            toggle(controls, "Katalogbereich Items").fire();
            assertEquals(2, items.searches.size());
            assertEquals(2, items.filterOptions.size());
            button(controls, "Items suchen").fire();
            assertEquals(3, items.searches.size());
            items.searches.get(2).complete(itemPage("new"));
            items.searches.get(1).complete(itemPage("stale-reactivation"));
            items.searches.get(0).complete(itemPage("stale"));
            assertEquals(List.of("new"), component.controller().publication().current()
                    .items().results().rows().stream().map(ItemsCatalogApi.ItemRow::sourceKey).toList());

            TableView<?> itemTable = descendants(main).stream()
                    .filter(TableView.class::isInstance).map(TableView.class::cast)
                    .filter(table -> "Item-Ergebnisse".equals(table.getAccessibleText()))
                    .findFirst().orElseThrow();
            itemTable.getSelectionModel().selectFirst();
            button(main, "Ausgewähltes Item im Inspector öffnen").fire();
            button(main, "Ausgewähltes Item im Inspector öffnen").fire();
            assertEquals(2, items.details.size());
            items.details.get(1).complete(itemDetail("newer-detail"));
            items.details.get(0).complete(itemDetail("stale-detail"));
            assertEquals(List.of("newer-detail"), itemRoute.opened);

            button(main, "Ausgewähltes Item im Inspector öffnen").fire();
            CompletableFuture<ItemsCatalogApi.DetailResult> postDeactivate = items.details.get(2);
            binding.onDeactivate();
            postDeactivate.complete(itemDetail("post-deactivate"));
            assertEquals(List.of("newer-detail"), itemRoute.opened);

            binding.onActivate();
            assertEquals(3, items.filterOptions.size());
            assertEquals(4, items.searches.size());
            items.filterOptions.get(2).complete(itemOptions("New"));
            items.filterOptions.get(1).complete(itemOptions("Stale reactivation"));
            items.filterOptions.get(0).complete(itemOptions("Stale"));
            assertEquals(List.of("New"), component.controller().publication().current()
                    .items().filterOptions().categories());
            binding.onDeactivate();

            binding.onActivate();
            assertEquals(4, items.filterOptions.size());
            assertEquals(5, items.searches.size());
            CompletableFuture<ItemsCatalogApi.FilterOptionsResult> rejectedOptions = items.filterOptions.get(3);
            CompletableFuture<ItemsCatalogApi.PageResult> rejectedItemSearch = items.searches.get(4);

            int monsterOptionsBeforeSelection = queries.filterOptions.size();
            int monsterSearchesBeforeSelection = queries.searches.size();
            toggle(controls, "Katalogbereich Monster").fire();
            assertEquals(monsterOptionsBeforeSelection, queries.filterOptions.size());
            assertEquals(monsterSearchesBeforeSelection, queries.searches.size());
            CompletableFuture<CreatureFilterOptionsResult> rejectedMonsterOptions =
                    queries.filterOptions.getLast();
            CompletableFuture<CreatureCatalogPageResult> rejectedMonsterSearch = queries.searches.getLast();
            binding.onDeactivate();
            rejectedOptions.complete(itemOptions("Post deactivate"));
            rejectedItemSearch.complete(itemPage("post-deactivate-search"));
            rejectedMonsterOptions.complete(filterOptions("Post deactivate"));
            rejectedMonsterSearch.complete(creaturePage(99L, "Post deactivate"));
            assertEquals(List.of("New"), component.controller().publication().current()
                    .items().filterOptions().categories());
            assertFalse(component.controller().publication().current().items().results().rows().stream()
                    .anyMatch(row -> "post-deactivate-search".equals(row.sourceKey())));
            assertEquals(List.of("New"), component.controller().publication().current()
                    .monsters().filterOptions().types());
            assertFalse(component.controller().publication().current().monsters().results().rows().stream()
                    .anyMatch(row -> row.id() == 99L));
            component.close();
        });
    }

    @Test
    void savedEncounterConfirmationIsRenderedAndConfirmedOnceThroughProductionIntents() throws Exception {
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
            Parent controls = (Parent) binding.slotContent().get(ShellSlot.COCKPIT_CONTROLS);
            Parent main = (Parent) binding.slotContent().get(ShellSlot.COCKPIT_MAIN);
            binding.onActivate();
            toggle(controls, "Katalogbereich Encounter").fire();
            TableView<?> plans = descendants(main).stream()
                    .filter(TableView.class::isInstance).map(TableView.class::cast)
                    .filter(table -> "Gespeicherte Encounter".equals(table.getAccessibleText()))
                    .findFirst().orElseThrow();
            plans.getSelectionModel().selectFirst();
            button(controls, "Ausgewählten Encounter im globalen Encounter öffnen").fire();
            assertEquals(List.of(false), savedOpen.discardFlags());
            savedOpen.requests.getFirst().complete(new OpenSavedEncounterPlanResult(
                    OpenSavedEncounterPlanResult.Status.CONFIRMATION_REQUIRED, 41L, "Discard?"));
            Button confirm = button(controls, "Verwerfen und öffnen");
            assertTrue(confirm.isVisible());
            confirm.fire();
            confirm.fire();
            assertEquals(List.of(false, true), savedOpen.discardFlags());
            component.close();
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
        private final List<CompletableFuture<OpenSavedEncounterPlanResult>> requests = new ArrayList<>();

        private List<Boolean> discardFlags() {
            return List.copyOf(flags);
        }

        @Override public CompletionStage<OpenSavedEncounterPlanResult> openSavedEncounter(
                long planId,
                boolean discardUnsavedChanges
        ) {
            flags.add(discardUnsavedChanges);
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
