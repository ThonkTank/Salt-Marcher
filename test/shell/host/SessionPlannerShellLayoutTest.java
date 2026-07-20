package shell.host;

import features.catalog.CatalogFeature;
import features.catalog.CatalogProviders;
import features.catalog.CatalogRoutes;
import features.creatures.CreaturesServiceAssembly;
import features.creatures.adapter.sqlite.query.SqliteCreatureCatalogQueryAdapter;
import features.dungeon.DungeonTestAssembly;
import features.dungeon.adapter.javafx.editor.DungeonEditorContribution;
import features.dungeon.adapter.javafx.travel.DungeonTravelContribution;
import features.dungeon.adapter.sqlite.model.DungeonPersistenceSchema;
import features.dungeon.adapter.sqlite.repository.SqliteDungeonCatalogStore;
import features.dungeon.adapter.sqlite.repository.SqliteDungeonUnitOfWork;
import features.dungeon.adapter.sqlite.repository.SqliteDungeonWindowStore;
import features.dungeon.application.authored.DungeonCachedWindowStore;
import features.dungeon.application.editor.DungeonEditorApiFacade;
import features.dungeon.application.editor.DungeonEditorFeatureRuntimeRoot;
import features.dungeon.application.editor.DungeonEditorRuntimeDependencies;
import features.encounter.EncounterServiceAssembly;
import features.encounter.adapter.sqlite.repository.SqliteEncounterPlanRepository;
import features.encountertable.EncounterTableServiceAssembly;
import features.encountertable.adapter.sqlite.query.SqliteEncounterTableCatalogAdapter;
import features.hex.HexServiceAssembly;
import features.hex.adapter.javafx.hexmap.HexMapContribution;
import features.hex.adapter.javafx.hexmap.HexMapControlsView;
import features.hex.adapter.javafx.hexmap.HexMapMainView;
import features.hex.adapter.sqlite.repository.SqliteHexMapRepository;
import features.party.PartyServiceAssembly;
import features.party.adapter.sqlite.repository.SqlitePartyRosterRepository;
import features.sessiongeneration.api.CommitGenerationRunCommand;
import features.sessiongeneration.api.GenerationDraftResponse;
import features.sessiongeneration.api.GenerationRequest;
import features.sessiongeneration.api.GenerationRewardBatchQuery;
import features.sessiongeneration.api.GenerationRewardBatchResponse;
import features.sessiongeneration.api.GenerationRunId;
import features.sessiongeneration.api.GenerationRunResponse;
import features.sessiongeneration.api.SessionGenerationApi;
import features.sessionplanner.SessionPlannerServiceAssembly;
import features.sessionplanner.adapter.javafx.SessionPlannerContribution;
import features.sessionplanner.adapter.javafx.SessionPlannerControlsView;
import features.sessionplanner.adapter.javafx.SessionPlannerTimelineMainView;
import features.sessionplanner.adapter.sqlite.repository.SqliteSessionPlanRepository;

import javafx.application.Platform;
import javafx.scene.Node;
import javafx.scene.Parent;
import javafx.scene.Scene;
import javafx.scene.control.ContentDisplay;
import javafx.scene.control.Label;
import javafx.scene.control.ScrollPane;
import javafx.scene.control.ToggleButton;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;
import javafx.stage.Stage;
import javafx.stage.Window;

import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import platform.diagnostics.NoopDiagnostics;
import platform.execution.DirectExecutionLane;
import platform.persistence.SqliteDatabase;
import platform.persistence.TestFeatureStores;
import platform.ui.DirectUiDispatcher;
import platform.ui.catalogcrud.CatalogCrudControlsView;

import shell.api.InspectorEntrySpec;
import shell.api.InspectorSink;
import shell.api.ShellBinding;
import shell.api.ShellContributionSpec;
import shell.api.ShellLeftBarTabMode;
import shell.api.ShellLeftBarTabSpec;
import shell.api.ShellSlot;

import java.util.List;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

@org.junit.jupiter.api.Tag("ui")
public final class SessionPlannerShellLayoutTest {

    private static final int AWAIT_SECONDS = 60;
    private static final AtomicBoolean FX_STARTED = new AtomicBoolean();

    @AfterEach
    void hideWindows() throws Exception {
        runOnFxThread(SessionPlannerShellLayoutTest::hideOpenWindows);
    }

    @AfterAll
    static void shutdownJavaFx() throws Exception {
        shutdownFx();
    }

    @Test
    void SESSION_PLANNER_SHELL_LAYOUT_001() throws Exception {
        runOnFxThread(SessionPlannerShellLayoutTest::runTest);
    }

    private static void runTest() {
        ShellWorkspacePane workspace = new ShellWorkspacePane();
        LayoutServices services = services();
        ShellBinding binding = sessionPlanner(services).bind();
        workspace.showTab(ShellSlotContent.from(binding), ShellLeftBarTabMode.RUNTIME);

        Stage stage = new Stage();
        stage.setScene(new Scene(workspace, 1_120.0, 620.0));
        stage.show();
        layout(workspace);

        VBox controlsPanel = descendants(workspace).stream()
                .filter(VBox.class::isInstance)
                .map(VBox.class::cast)
                .filter(node -> node.getStyleClass().contains("control-panel"))
                .findFirst()
                .orElseThrow(() -> new AssertionError("Shell controls panel not found."));
        Parent contributionControls = descendants(controlsPanel).stream()
                .filter(Parent.class::isInstance)
                .map(Parent.class::cast)
                .filter(node -> node != controlsPanel)
                .filter(node -> VBox.getVgrow(node) == javafx.scene.layout.Priority.ALWAYS)
                .findFirst()
                .orElseThrow(() -> new AssertionError("Growing contribution controls not found."));
        SessionPlannerControlsView plannerControls =
                descendant(controlsPanel, SessionPlannerControlsView.class);
        SessionPlannerTimelineMainView plannerMain =
                descendant(workspace, SessionPlannerTimelineMainView.class);

        assertTrue(VBox.getVgrow(controlsPanel) == javafx.scene.layout.Priority.ALWAYS,
                "shell controls panel grows vertically");
        assertTrue(VBox.getVgrow(contributionControls) == javafx.scene.layout.Priority.ALWAYS,
                "inserted contribution controls grow vertically");
        assertTrue(controlsPanel.getMinHeight() != Region.USE_PREF_SIZE, "controls panel min height is not pref-capped");
        assertTrue(controlsPanel.getMaxHeight() != Region.USE_PREF_SIZE, "controls panel max height is not pref-capped");
        assertTrue(controlsPanel.getHeight() > 0.0, "controls panel receives visible height");
        assertTrue(plannerControls.getHeight() > 0.0, "planner scroll controls receive visible height");
        assertTrue(plannerControls.getHeight() <= controlsPanel.getHeight(),
                "planner scroll controls stay inside the shell controls panel");
        assertTrue(plannerControls.getVbarPolicy() != ScrollPane.ScrollBarPolicy.NEVER,
                "planner controls keep vertical scrolling available");
        assertTrue(plannerMain.getVbarPolicy() != ScrollPane.ScrollBarPolicy.NEVER,
                "planner main keeps vertical scrolling available");
        assertTrue(plannerMain.isFitToWidth(), "planner main scroll content fits available width");
        assertTrue(descendants(plannerMain).stream()
                        .filter(javafx.scene.control.Button.class::isInstance)
                        .map(javafx.scene.control.Button.class::cast)
                        .anyMatch(button -> "Szene hinzufuegen".equals(button.getText())),
                "planner main renders the scene board in the main slot");
        assertTrue(descendants(plannerControls).stream()
                        .filter(Label.class::isInstance)
                        .map(Label.class::cast)
                        .anyMatch(label -> "Session-Setup".equals(label.getText())),
                "planner controls host the session setup section");

        ScrollPane stateScroll = descendants(workspace).stream()
                .filter(ScrollPane.class::isInstance)
                .map(ScrollPane.class::cast)
                .filter(node -> node.getStyleClass().contains("shell-state-scroll"))
                .findFirst()
                .orElseThrow(() -> new AssertionError("Shell state scroll pane not found."));
        assertTrue(stateScroll.getVbarPolicy() == ScrollPane.ScrollBarPolicy.AS_NEEDED,
                "shell state panel keeps vertical scrolling globally available");
        assertTrue(stateScroll.isFitToWidth(), "shell state panel scroll content fits available width");

        ShellNavigationSidebar sidebar = new ShellNavigationSidebar();
        registerSidebarTab(
                sidebar,
                dungeonTravel(services).registrationSpec(),
                "Dungeon-Reise",
                "/view/leftbartabs/dungeontravel/navigation-icon.svg");
        registerSidebarTab(
                sidebar,
                sessionPlanner(services).registrationSpec(),
                "Session Planner",
                "/view/leftbartabs/sessionplanner/navigation-icon.svg");
        registerSidebarTab(
                sidebar,
                catalog(services).registrationSpec(),
                "Katalog",
                "/view/leftbartabs/catalog/navigation-icon.svg");
        registerSidebarTab(
                sidebar,
                dungeonEditor(services).registrationSpec(),
                "Dungeon-Editor",
                "/view/leftbartabs/dungeoneditor/navigation-icon.svg");
        registerSidebarTab(
                sidebar,
                hexMap(services).registrationSpec(),
                "Hex-Karte",
                "/view/leftbartabs/hexmap/navigation-icon.svg");
        layout(sidebar);

        List<Node> sidebarChildren = List.copyOf(sidebar.getChildren());
        long separatorCount = sidebarChildren.stream()
                .filter(node -> node instanceof Region region && region.getStyleClass().contains("nav-separator"))
                .count();
        assertTrue(separatorCount == 2, "sidebar inserts separators at mode boundaries");
        assertTrue(sidebarChildren.size() == 7, "sidebar renders five tabs and two separators");

        List<ToggleButton> navButtons = sidebarChildren.stream()
                .filter(ToggleButton.class::isInstance)
                .map(ToggleButton.class::cast)
                .toList();
        assertTrue(navButtons.size() == 5, "sidebar renders five navigation buttons");
        assertButton(navButtons.get(0), "Session Planner", false);
        assertButton(navButtons.get(1), "Dungeon-Editor", false);
        assertButton(navButtons.get(2), "Dungeon-Reise", false);
        assertButton(navButtons.get(3), "Hex-Karte", false);
        assertButton(navButtons.get(4), "Katalog", false);
        assertTrue(sidebarChildren.get(1).getStyleClass().contains("nav-separator"),
                "sidebar separates runtime and editor tabs");
        assertTrue(sidebarChildren.get(3).getStyleClass().contains("nav-separator"),
                "sidebar separates editor and runtime tabs");
        Node malformedGraphic = ShellNavigationGraphicLoader.load(
                shell.api.NavigationGraphicResource.of("/shell/host/malformed-navigation-icon.svg"));
        assertTrue(malformedGraphic.getStyleClass().contains("nav-icon-missing"),
                "malformed navigation resource uses missing graphic fallback");
        assertLoadedNavigationGraphic(
                "/view/leftbartabs/scene/navigation-icon.svg",
                "Scene navigation icon loads from its stable resource path");
        assertHexMapShellLayout();
    }

    private static LayoutServices services() {
        PartyServiceAssembly.Component party = PartyServiceAssembly.create(new SqlitePartyRosterRepository(
                                TestFeatureStores.current().store(
                                        SqlitePartyRosterRepository.storeDefinition())));
        CreaturesServiceAssembly.Component creatures =
                CreaturesServiceAssembly.create(new SqliteCreatureCatalogQueryAdapter(
                                TestFeatureStores.current().store(
                                        SqliteCreatureCatalogQueryAdapter.storeDefinition())));
        EncounterTableServiceAssembly.Component tables =
                EncounterTableServiceAssembly.create(new SqliteEncounterTableCatalogAdapter(
                                TestFeatureStores.current().store(
                                        SqliteEncounterTableCatalogAdapter.storeDefinition())));
        EncounterServiceAssembly.Component encounter = EncounterServiceAssembly.create(
                creatures.application(), creatures.detail(), creatures.encounterCandidates(),
                tables.application(), tables.candidates(), null,
                party.application(), party.activeParty(), party.activeComposition(),
                party.adventuringDaySummary(), party.mutation(), new SqliteEncounterPlanRepository(
                                TestFeatureStores.current().store(
                                        SqliteEncounterPlanRepository.storeDefinition())));
        SqliteSessionPlanRepository sessionRepository = new SqliteSessionPlanRepository(
                        TestFeatureStores.current().store(
                                SqliteSessionPlanRepository.storeDefinition()));
        SessionPlannerServiceAssembly session = new SessionPlannerServiceAssembly(
                sessionRepository, sessionRepository, sessionRepository, party.application(),
                encounter.application(), encounter.savedPlans(), null, unsupportedGeneration(),
                DirectExecutionLane.INSTANCE, DirectExecutionLane.INSTANCE, DirectExecutionLane.INSTANCE,
                DirectUiDispatcher.INSTANCE, NoopDiagnostics.INSTANCE);
        HexServiceAssembly hex = new HexServiceAssembly(
                new SqliteHexMapRepository(
                                TestFeatureStores.current().store(
                                        SqliteHexMapRepository.storeDefinition())), party.travelPositions(), party.application());
        platform.persistence.FeatureStoreHandle dungeonStore =
                TestFeatureStores.current().store(
                        features.dungeon.adapter.sqlite.gateway.DungeonStoreDefinition.create());
        SqliteDungeonCatalogStore dungeonCatalog = new SqliteDungeonCatalogStore(
                        dungeonStore);
        DungeonTestAssembly.Component dungeon = DungeonTestAssembly.create(
                dungeonCatalog,
                new DungeonCachedWindowStore(new SqliteDungeonWindowStore(dungeonStore)),
                new SqliteDungeonUnitOfWork(dungeonStore),
                party.activeParty(),
                party.travelPositions(),
                party.application(),
                party.mutation(),
                DirectExecutionLane.INSTANCE,
                DirectUiDispatcher.INSTANCE,
                NoopDiagnostics.INSTANCE);
        return new LayoutServices(party, creatures, tables, encounter, session, hex, dungeon);
    }

    private static void assertHexMapShellLayout() {
        ShellWorkspacePane workspace = new ShellWorkspacePane();
        ShellBinding binding = hexMap(services()).bind();
        workspace.showTab(ShellSlotContent.from(binding), ShellLeftBarTabMode.RUNTIME);
        Stage stage = new Stage();
        stage.setScene(new Scene(workspace, 1_120.0, 620.0));
        stage.show();
        layout(workspace);

        VBox controlsPanel = descendants(workspace).stream()
                .filter(VBox.class::isInstance)
                .map(VBox.class::cast)
                .filter(node -> node.getStyleClass().contains("control-panel"))
                .findFirst()
                .orElseThrow(() -> new AssertionError("Hex shell controls panel not found."));
        CatalogCrudControlsView catalog = descendant(controlsPanel, CatalogCrudControlsView.class);
        HexMapControlsView controls = descendant(controlsPanel, HexMapControlsView.class);
        HexMapMainView main = descendant(workspace, HexMapMainView.class);
        Parent shellStack = descendants(controlsPanel).stream()
                .filter(Parent.class::isInstance)
                .map(Parent.class::cast)
                .filter(parent -> parent instanceof VBox)
                .filter(parent -> parent.getChildrenUnmodifiable().contains(catalog))
                .filter(parent -> parent.getChildrenUnmodifiable().contains(controls))
                .findFirst()
                .orElseThrow(() -> new AssertionError("Hex ShellControls.stack VBox not found."));

        assertTrue(VBox.getVgrow(shellStack) == javafx.scene.layout.Priority.ALWAYS,
                "Hex shared controls stack grows inside shell controls panel");
        assertTrue(VBox.getVgrow(catalog) == null,
                "Hex shared catalog is fixed in the ShellControls stack");
        assertTrue(VBox.getVgrow(controls) == javafx.scene.layout.Priority.ALWAYS,
                "Hex compact controls are the flexible ShellControls stack child");
        assertTrue(controls.getStyleClass().contains("control-toolbar"),
                "Hex controls use the shared compact toolbar styling");
        assertTrue(main.getHeight() > 0.0, "Hex main map receives visible shell main area");
        assertTrue(main.getWidth() > 0.0, "Hex main map receives visible shell main width");
        stage.close();
    }

    private static SessionPlannerContribution sessionPlanner(LayoutServices services) {
        return new SessionPlannerContribution(
                services.session().application(), services.session().workspaceModel(), ignored -> { });
    }

    private static SessionGenerationApi unsupportedGeneration() {
        return new SessionGenerationApi() {
            @Override
            public java.util.concurrent.CompletionStage<GenerationDraftResponse> draft(GenerationRequest request) {
                throw new UnsupportedOperationException("generation is not exercised by this layout test");
            }

            @Override
            public java.util.concurrent.CompletionStage<GenerationRunResponse> commit(
                    CommitGenerationRunCommand command
            ) {
                throw new UnsupportedOperationException("generation is not exercised by this layout test");
            }

            @Override
            public java.util.concurrent.CompletionStage<GenerationRunResponse> load(GenerationRunId runId) {
                throw new UnsupportedOperationException("generation is not exercised by this layout test");
            }

            @Override
            public java.util.concurrent.CompletionStage<GenerationRewardBatchResponse> loadRewards(
                    GenerationRewardBatchQuery query
            ) {
                throw new UnsupportedOperationException("generation is not exercised by this layout test");
            }
        };
    }

    private static HexMapContribution hexMap(LayoutServices services) {
        return new HexMapContribution(
                services.hex().editorApplication(), services.hex().travelApplication(),
                services.hex().editorModel(), services.hex().travelModel());
    }

    private static DungeonTravelContribution dungeonTravel(LayoutServices services) {
        return new DungeonTravelContribution(
                services.dungeon().travel(), services.dungeon().mapCatalog(), services.dungeon().travelModel());
    }

    private static DungeonEditorContribution dungeonEditor(LayoutServices services) {
        DungeonEditorRuntimeDependencies dependencies = new DungeonEditorRuntimeDependencies(
                services.dungeon().editorControls(), services.dungeon().editorMapSurface(),
                services.dungeon().editorState(),
                services.dungeon().editor());
        DungeonEditorFeatureRuntimeRoot root = DungeonEditorFeatureRuntimeRoot.create(dependencies);
        return new DungeonEditorContribution(new DungeonEditorApiFacade(root, dependencies.uiDispatcher()));
    }

    private static shell.api.ShellContribution catalog(LayoutServices services) {
        features.worldplanner.api.WorldPlannerSnapshotModel world =
                new features.worldplanner.api.WorldPlannerSnapshotModel(
                        () -> new features.worldplanner.api.WorldPlannerSnapshot(
                                features.worldplanner.api.WorldPlannerReadStatus.SUCCESS,
                                List.of(), List.of(), List.of(), ""),
                        listener -> () -> { },
                        listener -> {
                            listener.accept(new features.worldplanner.api.WorldPlannerSnapshot(
                                    features.worldplanner.api.WorldPlannerReadStatus.SUCCESS,
                                    List.of(), List.of(), List.of(), ""));
                            return () -> { };
                        });
        CatalogRoutes.WorldInspectorRoutes worldRoutes = new CatalogRoutes.WorldInspectorRoutes() {
            @Override public void openNpc(long npcId) { }
            @Override public void openFaction(long factionId) { }
            @Override public void openLocation(long locationId) { }
            @Override public void createNpc() { }
            @Override public void createFaction() { }
            @Override public void createLocation() { }
        };
        CatalogRoutes.EncounterHandoff encounterRoutes = new CatalogRoutes.EncounterHandoff() {
            @Override public void updatePoolFilters(features.encounter.api.EncounterPoolFilters filters) { }
            @Override public void addCreature(long creatureId) { }
            @Override public void addWorldNpc(long creatureId, long npcId) { }
            @Override public void useFactionSource(long factionId) { }
            @Override public void useLocationSource(long locationId) { }
            @Override public void useEncounterTableSource(long tableId) { }
            @Override public java.util.concurrent.CompletionStage<features.encounter.api.OpenSavedEncounterPlanResult>
                    openSavedEncounter(long planId, boolean discard) {
                return java.util.concurrent.CompletableFuture.completedFuture(
                        new features.encounter.api.OpenSavedEncounterPlanResult(
                                features.encounter.api.OpenSavedEncounterPlanResult.Status.OPENED, planId, ""));
            }
        };
        CatalogRoutes.SceneHandoff sceneRoutes = new CatalogRoutes.SceneHandoff() {
            @Override public void addCreature(long creatureId) { }
            @Override public void addNpc(long npcId) { }
            @Override public void setLocation(long locationId) { }
        };
        return CatalogFeature.create(
                new CatalogProviders(
                        new CatalogProviders.MonsterProviders(
                                services.creatures().catalogQueries(), services.encounter().poolFilters()),
                        new CatalogProviders.ItemsProviders(unavailableItems()),
                        new CatalogProviders.SavedEncounterProviders(services.encounter().savedPlans()),
                        new CatalogProviders.WorldReferenceProviders(
                                services.creatures().referenceIndex(), world),
                        new CatalogProviders.EncounterTableProviders(
                                services.tables().application(), services.tables().catalog()),
                        platform.ui.DirectUiDispatcher.INSTANCE),
                new CatalogRoutes(ignored -> { }, ignored -> { }, worldRoutes, encounterRoutes, sceneRoutes))
                .contribution();
    }

    private static features.items.api.ItemsCatalogApi unavailableItems() {
        return new features.items.api.ItemsCatalogApi() {
            public java.util.concurrent.CompletionStage<FilterOptionsResult> loadFilterOptions() {
                return java.util.concurrent.CompletableFuture.completedFuture(new FilterOptionsResult(
                        CatalogStatus.UNAVAILABLE, List.of(), List.of(), List.of()));
            }
            public java.util.concurrent.CompletionStage<PageResult> search(ItemQuery query) {
                return java.util.concurrent.CompletableFuture.completedFuture(new PageResult(
                        CatalogStatus.UNAVAILABLE, List.of(), 0, 50, 0));
            }
            public java.util.concurrent.CompletionStage<DetailResult> loadDetail(String sourceKey) {
                return java.util.concurrent.CompletableFuture.completedFuture(
                        new DetailResult(CatalogStatus.UNAVAILABLE, null));
            }
        };
    }

    private record LayoutServices(
            PartyServiceAssembly.Component party,
            CreaturesServiceAssembly.Component creatures,
            EncounterTableServiceAssembly.Component tables,
            EncounterServiceAssembly.Component encounter,
            SessionPlannerServiceAssembly session,
            HexServiceAssembly hex,
            DungeonTestAssembly.Component dungeon
    ) {
    }

    private static <T extends Node> T descendant(Parent parent, Class<T> type) {
        return descendants(parent).stream()
                .filter(type::isInstance)
                .map(type::cast)
                .findFirst()
                .orElseThrow(() -> new AssertionError("Descendant not found: " + type.getSimpleName()));
    }

    private static List<Node> descendants(Node node) {
        java.util.ArrayList<Node> result = new java.util.ArrayList<>();
        collect(node, result);
        return List.copyOf(result);
    }

    private static void collect(Node node, List<Node> result) {
        result.add(node);
        if (node instanceof Parent parent) {
            for (Node child : parent.getChildrenUnmodifiable()) {
                collect(child, result);
            }
        }
    }

    private static void layout(Parent parent) {
        parent.applyCss();
        parent.layout();
    }

    private static void assertTrue(boolean condition, String message) {
        if (!condition) {
            throw new AssertionError(message);
        }
    }

    private static void registerSidebarTab(
            ShellNavigationSidebar sidebar,
            ShellContributionSpec contributionSpec,
            String title,
            String expectedGraphicPath
    ) {
        ShellLeftBarTabSpec tabSpec = (ShellLeftBarTabSpec) contributionSpec;
        assertTrue(tabSpec.navigationGraphic() != null
                        && expectedGraphicPath.equals(tabSpec.navigationGraphic().path()),
                "sidebar tab uses expected navigation resource for " + title);
        sidebar.registerLeftBarTab(
                tabSpec,
                new TestShellBinding(title),
                key -> {
                });
    }

    private static void assertButton(ToggleButton button, String title, boolean expectMissingGraphic) {
        assertTrue(button.getContentDisplay() == ContentDisplay.GRAPHIC_ONLY,
                "sidebar button uses icon-only content display for " + title);
        assertTrue(title.equals(button.getAccessibleText()),
                "sidebar button accessible text keeps the bound title for " + title);
        assertTrue(button.getTooltip() != null && title.equals(button.getTooltip().getText()),
                "sidebar button tooltip keeps the bound title for " + title);
        assertTrue(button.getGraphic() != null, "sidebar button graphic is present for " + title);
        boolean missingGraphic = button.getGraphic().getStyleClass().contains("nav-icon-missing");
        assertTrue(missingGraphic == expectMissingGraphic,
                "sidebar button missing-graphic state matches expectation for " + title);
    }

    private static void assertLoadedNavigationGraphic(String path, String message) {
        Node graphic = ShellNavigationGraphicLoader.load(shell.api.NavigationGraphicResource.of(path));
        assertTrue(!graphic.getStyleClass().contains("nav-icon-missing"), message);
        assertTrue(graphic instanceof Region region
                        && region.getPrefWidth() == 18.0
                        && region.getPrefHeight() == 18.0,
                "navigation graphic keeps fixed 18px layout for " + path);
        assertTrue(descendants(graphic).stream()
                        .anyMatch(node -> node.getStyleClass().contains("nav-icon-stroke")),
                "navigation graphic exposes themeable stroke nodes for " + path);
    }

    private static void runOnFxThread(ThrowingRunnable action) throws Exception {
        CountDownLatch latch = new CountDownLatch(1);
        Throwable[] failure = new Throwable[1];
        Runnable wrappedAction = () -> {
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
            testsupport.JavaFxRuntime.startup(wrappedAction);
        } else {
            Platform.runLater(wrappedAction);
        }
        if (!latch.await(AWAIT_SECONDS, TimeUnit.SECONDS)) {
            throw new IllegalStateException("Timed out waiting for JavaFX Session Planner shell layout test.");
        }
        if (failure[0] != null) {
            throw new IllegalStateException("Session Planner shell layout test failed.", failure[0]);
        }
    }

    private static void shutdownFx() throws Exception {
        if (!FX_STARTED.get()) {
            return;
        }
        runOnFxThread(() -> {
            hideOpenWindows();
            testsupport.JavaFxRuntime.shutdown();
        });
    }

    private static void hideOpenWindows() {
        Platform.setImplicitExit(false);
        for (Window window : List.copyOf(Window.getWindows())) {
            window.hide();
        }
    }

    @FunctionalInterface
    private interface ThrowingRunnable {
        void run() throws Exception;
    }

    private enum EmptyInspectorSink implements InspectorSink {
        INSTANCE;

        @Override
        public void push(InspectorEntrySpec entry) {
        }

        @Override
        public void clear() {
        }

        @Override
        public boolean isShowing(Object entryKey) {
            return false;
        }
    }

    private record TestShellBinding(String title) implements ShellBinding {

        @Override
        public Map<ShellSlot, Node> slotContent() {
            return Map.of();
        }
    }
}
