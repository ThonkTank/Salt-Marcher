package src.view.leftbartabs.dungeoneditor;

import java.util.List;
import java.util.Set;
import javafx.scene.Parent;
import javafx.scene.Scene;
import javafx.scene.layout.HBox;
import javafx.stage.Stage;
import shell.api.ServiceRegistry;
import shell.api.ShellBinding;
import shell.api.ShellRuntimeContext;
import shell.api.ShellSlot;
import src.data.dungeon.repository.SqliteDungeonMapRepository;
import src.domain.dungeon.DungeonServiceContribution;
import src.domain.dungeon.DungeonTravelRuntimeApplicationService;
import src.domain.dungeon.model.core.repository.DungeonMapRepository;
import src.domain.dungeon.published.DungeonTravelLocationKind;
import src.domain.dungeon.published.TravelDungeonModel;
import src.domain.dungeon.published.TravelDungeonSnapshot;
import src.domain.party.PartyApplicationService;
import src.domain.party.published.CharacterDraft;
import src.domain.party.published.CreateCharacterCommand;
import src.domain.party.published.MembershipState;
import src.domain.party.published.MovePartyCharactersCommand;
import src.domain.party.published.PartyDungeonTravelLocationKind;
import src.domain.party.published.PartyDungeonTravelLocationSnapshot;
import src.domain.party.published.PartyTravelHeading;
import src.domain.party.published.PartyTravelLocationSnapshot;
import src.domain.party.published.PartyTravelPositionsModel;
import src.domain.party.published.PartyTravelPositionsResult;
import src.domain.party.published.PartyTravelTile;
import src.view.leftbartabs.dungeontravel.DungeonTravelContribution;
import src.view.slotcontent.main.dungeonmap.DungeonMapView;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

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

            fixture.runtime().context().services().require(DungeonTravelRuntimeApplicationService.class)
                    .performAction(-1);
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

    private static ProjectionLevelFixture projectionLevelFixture() {
        TestRuntime runtime = TestRuntime.create();
        long mapId = runtime.database().createPersistedMap("Travel Visible Level Controls Map");
        runtime.database().seedTransitionDescriptionFixture(mapId);
        long transitionId = runtime.database().transitionIdByDescription(mapId, "Initial transition.");
        movePartyTokenToMap(runtime.party(), mapId);
        PartyTravelPositionsResult partyPositionsBefore = runtime.partyPositions().current();
        runtime.context().services().require(DungeonTravelRuntimeApplicationService.class)
                .refresh();
        long geometryRowsBefore = runtime.database().countAuthoredGeometryRows(mapId);

        TestBinding binding = bindTest(runtime);
        TravelDungeonModel travelModel = runtime.context().services().require(TravelDungeonModel.class);
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
        runtime.context().services().require(DungeonTravelRuntimeApplicationService.class)
                .refresh();
        long sourceGeometryRowsBefore = runtime.database().countAuthoredGeometryRows(sourceMapId);
        long targetGeometryRowsBefore = runtime.database().countAuthoredGeometryRows(targetMapId);

        TestBinding binding = bindTest(runtime);
        TravelDungeonModel travelModel = runtime.context().services().require(TravelDungeonModel.class);
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
        blockedRuntime.context().services().require(DungeonTravelRuntimeApplicationService.class)
                .refresh();
        PartyTravelPositionsResult blockedPartyBefore = blockedRuntime.partyPositions().current();
        long blockedGeometryRowsBefore = blockedRuntime.database().countAuthoredGeometryRows(blockedMapId);
        TestBinding blockedBinding = bindTest(blockedRuntime);
        TravelDungeonModel blockedTravelModel =
                blockedRuntime.context().services().require(TravelDungeonModel.class);
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
        ShellBinding shellBinding = new DungeonTravelContribution().bind(runtime.context());
        Parent controlsRoot = DungeonEditorTestSupport.slot(shellBinding, ShellSlot.COCKPIT_CONTROLS, Parent.class);
        DungeonMapView mapView = DungeonEditorTestSupport.slot(shellBinding, ShellSlot.COCKPIT_MAIN, DungeonMapView.class);
        Parent stateRoot = DungeonEditorTestSupport.slot(shellBinding, ShellSlot.COCKPIT_STATE, Parent.class);
        Stage stage = new Stage();
        HBox root = new HBox(controlsRoot, mapView, stateRoot);
        stage.setScene(new Scene(root, 1_400.0, 900.0));
        stage.show();
        root.applyCss();
        root.layout();
        return new TestBinding(controlsRoot, stateRoot);
    }

    private static void movePartyTokenToMap(PartyApplicationService party, long mapId) {
        movePartyToken(
                party,
                mapId,
                PartyDungeonTravelLocationKind.TILE,
                0L,
                new PartyTravelTile(1, 1, 0));
    }

    private static void movePartyTokenToTransition(
            PartyApplicationService party,
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
            PartyApplicationService party,
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
        src.domain.dungeon.published.DungeonTravelPosition position = snapshot.travelSurface().position();
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

    private record TestBinding(Parent controlsRoot, Parent stateRoot) {
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
            ShellRuntimeContext context,
            PartyApplicationService party,
            PartyTravelPositionsModel partyPositions,
            DungeonEditorTestPersistence.DatabaseAssertions database
    ) {
        static TestRuntime create() {
            DungeonEditorTestPersistence.DatabaseAssertions database =
                    new DungeonEditorTestPersistence.DatabaseAssertions();
            database.clearDungeonData();
            database.clearPartyData();
            ServiceRegistry.Builder builder = new ServiceRegistry.Builder();
            builder.register(DungeonMapRepository.class, new SqliteDungeonMapRepository());
            new src.data.party.PartyServiceContribution().register(builder);
            new src.domain.party.PartyServiceContribution().register(builder);
            new DungeonServiceContribution().register(builder);
            ServiceRegistry registry = builder.build();
            return new TestRuntime(
                    new ShellRuntimeContext(DungeonEditorTestPersistence.EmptyInspectorSink.INSTANCE, registry),
                    registry.require(PartyApplicationService.class),
                    registry.require(PartyTravelPositionsModel.class),
                    database);
        }
    }
}
