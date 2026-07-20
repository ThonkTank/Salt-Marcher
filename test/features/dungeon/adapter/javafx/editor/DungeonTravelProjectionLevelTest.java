package features.dungeon.adapter.javafx.editor;

import features.dungeon.DungeonTestAssembly;
import features.dungeon.adapter.javafx.map.DungeonMapView;
import features.dungeon.adapter.javafx.travel.DungeonTravelContribution;
import features.dungeon.adapter.sqlite.repository.SqliteDungeonCatalogStore;
import features.dungeon.adapter.sqlite.repository.SqliteDungeonUnitOfWork;
import features.dungeon.adapter.sqlite.repository.SqliteDungeonWindowStore;
import features.dungeon.application.authored.DungeonCachedWindowStore;
import features.party.adapter.sqlite.repository.SqlitePartyRosterRepository;
import features.dungeon.api.DungeonCellRef;
import features.dungeon.api.DungeonOverlaySettings;
import features.dungeon.api.DungeonTravelActionId;
import features.dungeon.api.travel.DungeonTravelApi;
import features.dungeon.api.DungeonTravelLocationKind;
import features.dungeon.api.DungeonMapCatalogModel;
import features.dungeon.api.TravelDungeonModel;
import features.dungeon.api.TravelDungeonSnapshot;
import features.dungeon.application.travel.DungeonTravelRuntimeApplicationService;
import features.party.PartyServiceAssembly;
import features.party.api.CharacterDraft;
import features.party.api.CreateCharacterCommand;
import features.party.api.MembershipState;
import features.party.api.MovePartyCharactersCommand;
import features.party.api.PartyApi;
import features.party.api.PartyDungeonTravelLocationKind;
import features.party.api.PartyDungeonTravelLocationSnapshot;
import features.party.api.PartyTravelHeading;
import features.party.api.PartyTravelLocationSnapshot;
import features.party.api.PartyTravelPositionsModel;
import features.party.api.PartyTravelPositionsResult;
import features.party.api.PartyTravelTile;
import javafx.scene.Parent;
import javafx.scene.Scene;
import javafx.scene.input.MouseButton;
import javafx.scene.input.MouseEvent;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.stage.Stage;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import platform.diagnostics.NoopDiagnostics;
import platform.execution.DirectExecutionLane;
import platform.persistence.SqliteDatabase;
import platform.persistence.TestFeatureStores;
import platform.ui.DirectUiDispatcher;

import shell.api.ShellBinding;
import shell.api.ShellSlot;

import java.util.List;
import java.util.Set;

@org.junit.jupiter.api.Tag("ui")
public final class DungeonTravelProjectionLevelTest {

    @AfterEach
    void hideWindows() throws Exception {
        DungeonEditorTestRuntime.cleanupRouteProofWindows();
    }

    @AfterAll
    static void shutdownJavaFx() throws Exception {
        DungeonEditorTestRuntime.shutdownFx();
    }

    @Test
    void DT_LVL_001() throws Exception {
        DungeonEditorTestRuntime.runOnFxThread(() -> {
            ProjectionLevelFixture fixture = projectionLevelFixture();

            TravelDungeonSnapshot initialSnapshot = fixture.travelModel().current();
            assertProjectionLevel(initialSnapshot, 0, "DT-LVL-001 starts on party tile level");
            DungeonEditorTestSupport.assertTrue(
                    DungeonEditorTestSupport.labelVisible(fixture.binding().controlsRoot(), "Ebene z=0"),
                    "DT-LVL-001 visible travel level label starts at z=0");
            DungeonEditorTestSupport.click(
                    DungeonEditorTestSupport.button(fixture.binding().controlsRoot(), "+"));

            TravelDungeonSnapshot afterPlusSnapshot = fixture.travelModel().current();
            assertProjectionLevel(afterPlusSnapshot, 1, "DT-LVL-001 travel snapshot projection level increments");
            DungeonEditorTestSupport.assertTrue(
                    DungeonEditorTestSupport.labelVisible(fixture.binding().controlsRoot(), "Ebene z=1"),
                    "DT-LVL-001 visible travel level label updates");
            assertNoTravelTruthMutation(
                    fixture.runtime(),
                    fixture.mapId(),
                    fixture.geometryRowsBefore(),
                    fixture.partyPositionsBefore(),
                    "DT-LVL-001");
        });
    }

    @Test
    void DT_LVL_002() throws Exception {
        DungeonEditorTestRuntime.runOnFxThread(() -> {
            ProjectionLevelFixture fixture = projectionLevelFixture();
            DungeonEditorTestSupport.click(
                    DungeonEditorTestSupport.button(fixture.binding().controlsRoot(), "+"));

            DungeonEditorTestSupport.click(
                    DungeonEditorTestSupport.button(fixture.binding().controlsRoot(), "-"));

            TravelDungeonSnapshot afterMinusSnapshot = fixture.travelModel().current();
            assertProjectionLevel(afterMinusSnapshot, 0, "DT-LVL-002 travel snapshot projection level decrements");
            DungeonEditorTestSupport.assertTrue(
                    DungeonEditorTestSupport.labelVisible(fixture.binding().controlsRoot(), "Ebene z=0"),
                    "DT-LVL-002 visible travel level label updates");
            assertNoTravelTruthMutation(
                    fixture.runtime(),
                    fixture.mapId(),
                    fixture.geometryRowsBefore(),
                    fixture.partyPositionsBefore(),
                    "DT-LVL-002");
        });
    }

    @Test
    void DT_ACT_INVALID() throws Exception {
        DungeonEditorTestRuntime.runOnFxThread(() -> {
            ProjectionLevelFixture fixture = projectionLevelFixture();
            DungeonEditorTestSupport.click(
                    DungeonEditorTestSupport.button(fixture.binding().controlsRoot(), "+"));
            DungeonEditorTestSupport.click(
                    DungeonEditorTestSupport.button(fixture.binding().controlsRoot(), "-"));

            fixture.runtime().travel().performAction(
                    features.dungeon.api.DungeonTravelActionId.fromStableFacts(
                            fixture.mapId(),
                            "transition:999999"));
            TravelDungeonSnapshot invalidActionSnapshot = fixture.travelModel().current();
            DungeonEditorTestSupport.assertTrue(
                    invalidActionSnapshot.workspaceState() != null
                            && invalidActionSnapshot.workspaceState().statusLabel().contains("Aktion ist nicht verfügbar."),
                    "DT-ACT-INVALID typed invalid selected action reports invalid action");
            assertNoTravelTruthMutation(
                    fixture.runtime(),
                    fixture.mapId(),
                    fixture.geometryRowsBefore(),
                    fixture.partyPositionsBefore(),
                    "DT-ACT-INVALID");
        });
    }

    @Test
    void DT_ACT_001() throws Exception {
        DungeonEditorTestRuntime.runOnFxThread(DungeonTravelProjectionLevelTest::verifyLinkedTransitionAction);
    }

    @Test
    void DT_ACT_002() throws Exception {
        DungeonEditorTestRuntime.runOnFxThread(DungeonTravelProjectionLevelTest::verifyUnlinkedTransitionAction);
    }

    @Test
    void DT_MOVE_001() throws Exception {
        DungeonEditorTestRuntime.runOnFxThread(() -> {
            TestRuntime runtime = TestRuntime.create();
            long mapId = runtime.database().createPersistedMap("Travel Token Drag Map");
            runtime.database().seedTransitionDescriptionFixture(mapId);
            movePartyTokenToMap(runtime.party(), mapId);
            runtime.travel().refresh();
            long geometryRowsBefore = runtime.database().countAuthoredGeometryRows(mapId);
            RecordingTravelApi recordingTravel = new RecordingTravelApi(runtime.travel());
            TestBinding binding = bindTest(runtime, recordingTravel);

            DungeonEditorTestSupport.fireMapMousePressed(
                    binding.mapView(),
                    MouseButton.PRIMARY,
                    48.0,
                    48.0,
                    false);
            DungeonEditorTestSupport.fireMapMouse(
                    binding.mapView(),
                    MouseEvent.MOUSE_DRAGGED,
                    MouseButton.PRIMARY,
                    80.0,
                    48.0,
                    false);
            DungeonEditorTestSupport.assertEquals(
                    0,
                    recordingTravel.moveCalls(),
                    "DT-MOVE-001 press and drag emit no movement command");
            DungeonEditorTestSupport.fireMapMouse(
                    binding.mapView(),
                    MouseEvent.MOUSE_RELEASED,
                    MouseButton.PRIMARY,
                    80.0,
                    48.0,
                    false);

            DungeonEditorTestSupport.assertEquals(
                    1,
                    recordingTravel.moveCalls(),
                    "DT-MOVE-001 primary Party-token drag emits exactly one move");
            DungeonEditorTestSupport.assertEquals(
                    new DungeonCellRef(2, 1, 0),
                    recordingTravel.lastMoveTarget(),
                    "DT-MOVE-001 release resolves the exact rendered target cell");
            assertPartyTokenLocation(
                    runtime.partyPositions().current(),
                    mapId,
                    PartyDungeonTravelLocationKind.TILE,
                    runtime.travelModel().current().travelSurface().position().ownerId(),
                    new PartyTravelTile(2, 1, 0),
                    "DT-MOVE-001 direct drag uses the real Party movement route");
            assertAuthoredGeometryUnchanged(
                    runtime,
                    mapId,
                    geometryRowsBefore,
                    "DT-MOVE-001 authored Dungeon geometry unchanged");
        });
    }

    @Test
    void DT_MOVE_002() throws Exception {
        DungeonEditorTestRuntime.runOnFxThread(() -> {
            TestRuntime runtime = TestRuntime.create();
            long mapId = runtime.database().createPersistedMap("Travel Invalid Token Drag Map");
            runtime.database().seedTransitionDescriptionFixture(mapId);
            movePartyTokenToMap(runtime.party(), mapId);
            PartyTravelPositionsResult partyBefore = runtime.partyPositions().current();
            runtime.travel().refresh();
            long geometryRowsBefore = runtime.database().countAuthoredGeometryRows(mapId);
            RecordingTravelApi recordingTravel = new RecordingTravelApi(runtime.travel());
            TestBinding binding = bindTest(runtime, recordingTravel);

            DungeonEditorTestSupport.dragMap(
                    binding.mapView(),
                    MouseButton.PRIMARY,
                    80.0,
                    48.0,
                    80.0,
                    48.0);
            DungeonEditorTestSupport.dragMap(
                    binding.mapView(),
                    MouseButton.PRIMARY,
                    48.0,
                    48.0,
                    500.0,
                    500.0);
            DungeonEditorTestSupport.fireMapMouse(
                    binding.mapView(),
                    MouseEvent.MOUSE_RELEASED,
                    MouseButton.PRIMARY,
                    80.0,
                    48.0,
                    false);

            DungeonEditorTestSupport.assertEquals(
                    0,
                    recordingTravel.moveCalls(),
                    "DT-MOVE-002 outside-token press, invalid release and orphan release emit no move");
            assertNoTravelTruthMutation(
                    runtime,
                    mapId,
                    geometryRowsBefore,
                    partyBefore,
                    "DT-MOVE-002");
        });
    }

    @Test
    void DT_MOVE_003() throws Exception {
        DungeonEditorTestRuntime.runOnFxThread(() -> {
            TestRuntime runtime = TestRuntime.create();
            long mapId = runtime.database().createPersistedMap("Travel Middle Pan Map");
            runtime.database().seedTransitionDescriptionFixture(mapId);
            movePartyTokenToMap(runtime.party(), mapId);
            PartyTravelPositionsResult partyBefore = runtime.partyPositions().current();
            runtime.travel().refresh();
            long geometryRowsBefore = runtime.database().countAuthoredGeometryRows(mapId);
            RecordingTravelApi recordingTravel = new RecordingTravelApi(runtime.travel());
            TestBinding binding = bindTest(runtime, recordingTravel);
            List<features.dungeon.adapter.javafx.map.DungeonMapVisibleCellBounds> visibleBounds =
                    new java.util.ArrayList<>();
            binding.mapView().onVisibleCellBoundsChanged(visibleBounds::add);

            DungeonEditorTestSupport.dragMap(
                    binding.mapView(),
                    MouseButton.MIDDLE,
                    160.0,
                    160.0,
                    224.0,
                    160.0);

            DungeonEditorTestSupport.assertEquals(
                    0,
                    recordingTravel.moveCalls(),
                    "DT-MOVE-003 middle-button drag emits no Party move");
            DungeonEditorTestSupport.assertTrue(
                    !visibleBounds.isEmpty(),
                    "DT-MOVE-003 middle-button drag still changes the visible camera bounds");
            assertNoTravelTruthMutation(
                    runtime,
                    mapId,
                    geometryRowsBefore,
                    partyBefore,
                    "DT-MOVE-003");
        });
    }

    @Test
    void DT_MOVE_004() throws Exception {
        DungeonEditorTestRuntime.runOnFxThread(() -> {
            TestRuntime runtime = TestRuntime.create();
            long mapId = runtime.database().createPersistedMap("Travel Missing Token Map");
            runtime.database().seedTransitionDescriptionFixture(mapId);
            runtime.travel().selectMap(mapId);
            runtime.travel().refresh();
            RecordingTravelApi recordingTravel = new RecordingTravelApi(runtime.travel());
            TestBinding binding = bindTest(runtime, recordingTravel);

            DungeonEditorTestSupport.dragMap(
                    binding.mapView(),
                    MouseButton.PRIMARY,
                    48.0,
                    48.0,
                    80.0,
                    48.0);

            DungeonEditorTestSupport.assertEquals(
                    0,
                    recordingTravel.moveCalls(),
                    "DT-MOVE-004 a map without a rendered Party token emits no move");
        });
    }

    private static ProjectionLevelFixture projectionLevelFixture() {
        TestRuntime runtime = TestRuntime.create();
        long mapId = runtime.database().createPersistedMap("Travel Visible Level Controls Map");
        runtime.database().seedTransitionDescriptionFixture(mapId);
        long transitionId = runtime.database().transitionIdByDescription(mapId, "Initial transition.");
        movePartyTokenToMap(runtime.party(), mapId);
        PartyTravelPositionsResult partyPositionsBefore = runtime.partyPositions().current();
        runtime.travel().refresh();
        long geometryRowsBefore = runtime.database().countAuthoredGeometryRows(mapId);

        TestBinding binding = bindTest(runtime);
        TravelDungeonModel travelModel = runtime.travelModel();
        return new ProjectionLevelFixture(
                runtime,
                mapId,
                transitionId,
                partyPositionsBefore,
                geometryRowsBefore,
                binding,
                travelModel);
    }

    private static void verifyLinkedTransitionAction() {
        TestRuntime runtime = TestRuntime.create();
        long sourceMapId = runtime.database().createPersistedMap("Travel Action Source Map");
        long targetMapId = runtime.database().createPersistedMap("Travel Action Target Map");
        runtime.database().seedResolvedTransitionLinkFixture(sourceMapId, targetMapId);
        long sourceTransitionId = runtime.database().transitionIdByDescription(sourceMapId, "Source transition.");
        long targetTransitionId = runtime.database().transitionIdByDescription(targetMapId, "Target transition.");
        movePartyTokenToTransition(runtime.party(), sourceMapId, sourceTransitionId, 5, 2, 0);
        runtime.travel().refresh();
        long sourceGeometryRowsBefore = runtime.database().countAuthoredGeometryRows(sourceMapId);
        long targetGeometryRowsBefore = runtime.database().countAuthoredGeometryRows(targetMapId);

        TestBinding binding = bindTest(runtime);
        TravelDungeonModel travelModel = runtime.travelModel();
        String linkedActionLabel = transitionActionLabel(
                sourceTransitionId,
                "Dungeon " + targetMapId + " / Übergang " + targetTransitionId);

        DungeonEditorTestSupport.assertTrue(
                DungeonEditorTestSupport.button(binding.stateRoot(), linkedActionLabel) != null,
                "DT-ACT-001 visible linked transition action is rendered");
        DungeonEditorTestSupport.click(
                DungeonEditorTestSupport.button(binding.stateRoot(), linkedActionLabel));

        TravelDungeonSnapshot afterLinkedAction = travelModel.current();
        assertTravelSnapshotPosition(
                afterLinkedAction,
                targetMapId,
                DungeonTravelLocationKind.TRANSITION,
                targetTransitionId,
                6,
                2,
                0,
                "DT-ACT-001 travel snapshot moves to target transition");
        assertPartyTokenLocation(
                runtime.partyPositions().current(),
                targetMapId,
                PartyDungeonTravelLocationKind.TRANSITION,
                targetTransitionId,
                new PartyTravelTile(6, 2, 0),
                "DT-ACT-001 party token persists target transition");
        assertAuthoredGeometryUnchanged(
                runtime,
                sourceMapId,
                sourceGeometryRowsBefore,
                "DT-ACT-001 source authored geometry unchanged");
        assertAuthoredGeometryUnchanged(
                runtime,
                targetMapId,
                targetGeometryRowsBefore,
                "DT-ACT-001 target authored geometry unchanged");
    }

    private static void verifyUnlinkedTransitionAction() {
        TestRuntime blockedRuntime = TestRuntime.create();
        long blockedMapId = blockedRuntime.database().createPersistedMap("Travel Action Unlinked Map");
        blockedRuntime.database().seedUnlinkedTransitionFixture(blockedMapId);
        long blockedTransitionId =
                blockedRuntime.database().transitionIdByDescription(blockedMapId, "Unlinked transition.");
        movePartyTokenToTransition(blockedRuntime.party(), blockedMapId, blockedTransitionId, 5, 2, 0);
        blockedRuntime.travel().refresh();
        PartyTravelPositionsResult blockedPartyBefore = blockedRuntime.partyPositions().current();
        long blockedGeometryRowsBefore = blockedRuntime.database().countAuthoredGeometryRows(blockedMapId);
        TestBinding blockedBinding = bindTest(blockedRuntime);
        TravelDungeonModel blockedTravelModel = blockedRuntime.travelModel();
        String blockedActionLabel = transitionActionLabel(blockedTransitionId, "Kein Ziel verknuepft");

        DungeonEditorTestSupport.assertTrue(
                DungeonEditorTestSupport.button(blockedBinding.stateRoot(), blockedActionLabel) != null,
                "DT-ACT-002 visible unlinked transition action is rendered");
        DungeonEditorTestSupport.click(
                DungeonEditorTestSupport.button(blockedBinding.stateRoot(), blockedActionLabel));

        TravelDungeonSnapshot afterBlockedAction = blockedTravelModel.current();
        DungeonEditorTestSupport.assertTrue(
                afterBlockedAction.workspaceState() != null
                        && afterBlockedAction.workspaceState().statusLabel()
                                .contains("Übergangsziel ist nicht verfügbar."),
                "DT-ACT-002 rendered unlinked action reports missing target");
        assertNoTravelTruthMutation(
                blockedRuntime,
                blockedMapId,
                blockedGeometryRowsBefore,
                blockedPartyBefore,
                "DT-ACT-002");
    }

    private static TestBinding bindTest(TestRuntime runtime) {
        return bindTest(runtime, runtime.travel());
    }

    private static TestBinding bindTest(TestRuntime runtime, DungeonTravelApi travel) {
        ShellBinding shellBinding = new DungeonTravelContribution(
                travel, runtime.mapCatalog(), runtime.travelModel()).bind();
        Parent controlsRoot = DungeonEditorTestSupport.slot(shellBinding, ShellSlot.COCKPIT_CONTROLS, Parent.class);
        DungeonMapView mapView = DungeonEditorTestSupport.slot(shellBinding, ShellSlot.COCKPIT_MAIN, DungeonMapView.class);
        Parent stateRoot = DungeonEditorTestSupport.slot(shellBinding, ShellSlot.COCKPIT_STATE, Parent.class);
        Stage stage = new Stage();
        HBox root = new HBox(controlsRoot, mapView, stateRoot);
        HBox.setHgrow(mapView, Priority.ALWAYS);
        mapView.setPrefSize(960.0, 720.0);
        stage.setScene(new Scene(root, 1_400.0, 900.0));
        stage.show();
        root.applyCss();
        root.layout();
        return new TestBinding(controlsRoot, stateRoot, mapView);
    }

    private static void movePartyTokenToMap(PartyApi party, long mapId) {
        movePartyToken(
                party,
                mapId,
                PartyDungeonTravelLocationKind.TILE,
                0L,
                new PartyTravelTile(1, 1, 0));
    }

    private static void movePartyTokenToTransition(
            PartyApi party,
            long mapId,
            long transitionId,
            int q,
            int r,
            int level
    ) {
        movePartyToken(
                party,
                mapId,
                PartyDungeonTravelLocationKind.TRANSITION,
                transitionId,
                new PartyTravelTile(q, r, level));
    }

    private static void movePartyToken(
            PartyApi party,
            long mapId,
            PartyDungeonTravelLocationKind locationKind,
            long ownerId,
            PartyTravelTile tile
    ) {
        party.createCharacter(new CreateCharacterCommand(
                new CharacterDraft("Dungeon Guide", "Test", 3, 12, 14),
                MembershipState.ACTIVE));
        party.moveCharacters(new MovePartyCharactersCommand(
                List.of(1L),
                new PartyDungeonTravelLocationSnapshot(
                        mapId,
                        locationKind,
                        ownerId,
                        tile,
                        PartyTravelHeading.SOUTH),
                true));
    }

    private static String transitionActionLabel(long transitionId, String destinationLabel) {
        return "Übergang " + transitionId + ": " + destinationLabel;
    }

    private static void assertProjectionLevel(TravelDungeonSnapshot snapshot, int expectedLevel, String message) {
        DungeonEditorTestSupport.assertEquals(expectedLevel, snapshot.projectionLevel(), message);
    }

    private static void assertTravelSnapshotPosition(
            TravelDungeonSnapshot snapshot,
            long expectedMapId,
            DungeonTravelLocationKind expectedLocationKind,
            long expectedOwnerId,
            int expectedQ,
            int expectedR,
            int expectedLevel,
            String message
    ) {
        DungeonEditorTestSupport.assertTrue(
                snapshot != null && snapshot.travelSurface() != null,
                message + " has travel surface");
        features.dungeon.api.DungeonTravelPosition position = snapshot.travelSurface().position();
        DungeonEditorTestSupport.assertEquals(
                expectedMapId,
                position.mapId().value(),
                message + " map id");
        DungeonEditorTestSupport.assertEquals(
                expectedLocationKind,
                position.locationKind(),
                message + " location kind");
        DungeonEditorTestSupport.assertEquals(
                expectedOwnerId,
                position.ownerId(),
                message + " owner id");
        DungeonEditorTestSupport.assertEquals(
                expectedQ,
                position.tile().q(),
                message + " tile q");
        DungeonEditorTestSupport.assertEquals(
                expectedR,
                position.tile().r(),
                message + " tile r");
        DungeonEditorTestSupport.assertEquals(
                expectedLevel,
                position.tile().level(),
                message + " tile level");
    }

    private static void assertPartyTokenLocation(
            PartyTravelPositionsResult result,
            long expectedMapId,
            PartyDungeonTravelLocationKind expectedLocationKind,
            long expectedOwnerId,
            PartyTravelTile expectedTile,
            String message
    ) {
        PartyTravelLocationSnapshot location = result.partyTokenLocation();
        DungeonEditorTestSupport.assertTrue(
                location instanceof PartyDungeonTravelLocationSnapshot,
                message + " is dungeon location");
        PartyDungeonTravelLocationSnapshot dungeonLocation = (PartyDungeonTravelLocationSnapshot) location;
        DungeonEditorTestSupport.assertEquals(expectedMapId, dungeonLocation.mapId(), message + " map id");
        DungeonEditorTestSupport.assertEquals(
                expectedLocationKind,
                dungeonLocation.locationKind(),
                message + " location kind");
        DungeonEditorTestSupport.assertEquals(
                expectedOwnerId,
                dungeonLocation.ownerId(),
                message + " owner id");
        DungeonEditorTestSupport.assertEquals(expectedTile, dungeonLocation.tile(), message + " tile");
    }

    private static void assertAuthoredGeometryUnchanged(
            TestRuntime runtime,
            long mapId,
            long geometryRowsBefore,
            String message
    ) {
        DungeonEditorTestSupport.assertEquals(
                geometryRowsBefore,
                runtime.database().countAuthoredGeometryRows(mapId),
                message);
    }

    private static void assertNoTravelTruthMutation(
            TestRuntime runtime,
            long mapId,
            long geometryRowsBefore,
            PartyTravelPositionsResult partyPositionsBefore,
            String scenario
    ) {
        DungeonEditorTestSupport.assertEquals(
                geometryRowsBefore,
                runtime.database().countAuthoredGeometryRows(mapId),
                scenario + " leaves authored dungeon geometry unchanged");
        PartyTravelPositionsResult partyPositionsAfter = runtime.partyPositions().current();
        DungeonEditorTestSupport.assertEquals(
                partyPositionsBefore.partyTokenCharacterIds(),
                partyPositionsAfter.partyTokenCharacterIds(),
                scenario + " leaves party-token character ids unchanged");
        PartyTravelLocationSnapshot locationBefore = partyPositionsBefore.partyTokenLocation();
        DungeonEditorTestSupport.assertEquals(
                locationBefore,
                partyPositionsAfter.partyTokenLocation(),
                scenario + " leaves party runtime position unchanged");
    }

    private record TestBinding(Parent controlsRoot, Parent stateRoot, DungeonMapView mapView) {
    }

    private static final class RecordingTravelApi implements DungeonTravelApi {
        private final DungeonTravelApi delegate;
        private int moveCalls;
        private DungeonCellRef lastMoveTarget;

        private RecordingTravelApi(DungeonTravelApi delegate) {
            this.delegate = delegate;
        }

        @Override
        public void refresh() {
            delegate.refresh();
        }

        @Override
        public void performAction(DungeonTravelActionId actionId) {
            delegate.performAction(actionId);
        }

        @Override
        public void moveTo(DungeonCellRef target) {
            moveCalls++;
            lastMoveTarget = target;
            delegate.moveTo(target);
        }

        @Override
        public void selectMap(long mapId) {
            delegate.selectMap(mapId);
        }

        @Override
        public void shiftProjectionLevel(int projectionLevelShift) {
            delegate.shiftProjectionLevel(projectionLevelShift);
        }

        @Override
        public void setOverlay(DungeonOverlaySettings overlaySettings) {
            delegate.setOverlay(overlaySettings);
        }

        private int moveCalls() {
            return moveCalls;
        }

        private DungeonCellRef lastMoveTarget() {
            return lastMoveTarget;
        }
    }

    private record ProjectionLevelFixture(
            TestRuntime runtime,
            long mapId,
            long transitionId,
            PartyTravelPositionsResult partyPositionsBefore,
            long geometryRowsBefore,
            TestBinding binding,
            TravelDungeonModel travelModel
    ) {
    }

    private record TestRuntime(
            DungeonTravelRuntimeApplicationService travel,
            DungeonMapCatalogModel mapCatalog,
            TravelDungeonModel travelModel,
            PartyApi party,
            PartyTravelPositionsModel partyPositions,
            DungeonEditorTestPersistence.DatabaseAssertions database
    ) {
        static TestRuntime create() {
            DungeonEditorTestPersistence.DatabaseAssertions database =
                    new DungeonEditorTestPersistence.DatabaseAssertions();
            database.clearDungeonData();
            database.clearPartyData();
            PartyServiceAssembly.Component party =
                    PartyServiceAssembly.create(new SqlitePartyRosterRepository(
                                    TestFeatureStores.current().store(
                                            SqlitePartyRosterRepository.storeDefinition())));
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
            return new TestRuntime(
                    dungeon.travel(),
                    dungeon.mapCatalog(),
                    dungeon.travelModel(),
                    party.application(),
                    party.travelPositions(),
                    database);
        }
    }
}
