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
import src.domain.dungeon.published.ApplyTravelDungeonSessionCommand;
import src.domain.dungeon.published.DungeonTravelLocationKind;
import src.domain.dungeon.published.DungeonOverlaySettings;
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
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel;
import src.view.slotcontent.main.dungeonmap.DungeonMapView;

public final class DungeonTravelProjectionLevelHarness {

    private static final String OWNER = "DungeonTravelProjectionLevelHarness";

    private DungeonTravelProjectionLevelHarness() {
    }

    public static void main(String[] args) throws Exception {
        DungeonEditorBehaviorHarnessSupport.runPublishedHarness(
                "Dungeon Travel projection-level behavior harness",
                DungeonTravelProjectionLevelHarness::run);
    }

    static void run(List<String> results) throws Exception {
        DungeonEditorHarnessPublicationSupport.runOnFxThread(() -> {
            verifyProjectionLevelControls(results);
            verifyRenderedTransitionActions(results);
        });
    }

    private static void verifyProjectionLevelControls(List<String> results) {
        HarnessRuntime runtime = HarnessRuntime.create();
        long mapId = runtime.database().createPersistedMap("Travel Visible Level Controls Map");
        runtime.database().seedTransitionDescriptionFixture(mapId);
        long transitionId = runtime.database().transitionIdByDescription(mapId, "Initial transition.");
        movePartyTokenToMap(runtime.party(), mapId);
        PartyTravelPositionsResult partyPositionsBefore = runtime.partyPositions().current();
        runtime.context().services().require(DungeonTravelRuntimeApplicationService.class)
                .applyDungeonTravelSession(new ApplyTravelDungeonSessionCommand(
                        ApplyTravelDungeonSessionCommand.Action.REFRESH,
                        -1,
                        0L,
                        0,
                        DungeonOverlaySettings.defaults()));
        long geometryRowsBefore = runtime.database().countAuthoredGeometryRows(mapId);

        HarnessBinding binding = bindHarness(runtime);
        TravelDungeonModel travelModel = runtime.context().services().require(TravelDungeonModel.class);

        TravelDungeonSnapshot initialSnapshot = travelModel.current();
        assertProjectionLevel(initialSnapshot, 0, "DT-LVL-001 starts on party tile level");
        DungeonEditorBehaviorHarnessSupport.assertTrue(
                DungeonEditorBehaviorHarnessSupport.labelVisible(binding.controlsRoot(), "Ebene z=0"),
                "DT-LVL-001 visible travel level label starts at z=0");
        assertRenderedLevel(binding.mapContentModel(), 0, "DT-LVL-001 renders level 0");
        assertTravelTransitionMarkerTopologyRef(
                binding.mapContentModel(),
                transitionId,
                "DT-LVL-001 travel transition marker carries topology ref");
        DungeonEditorBehaviorHarnessSupport.assertTrue(
                !binding.mapContentModel().canvasStateProperty().get().baseRenderScene().actors().isEmpty(),
                "DT-LVL-001 travel map keeps the party token in the actor layer");

        DungeonEditorBehaviorHarnessSupport.click(DungeonEditorBehaviorHarnessSupport.button(binding.controlsRoot(), "+"));

        TravelDungeonSnapshot afterPlusSnapshot = travelModel.current();
        assertProjectionLevel(afterPlusSnapshot, 1, "DT-LVL-001 travel snapshot projection level increments");
        DungeonEditorBehaviorHarnessSupport.assertTrue(
                DungeonEditorBehaviorHarnessSupport.labelVisible(binding.controlsRoot(), "Ebene z=1"),
                "DT-LVL-001 visible travel level label updates");
        assertRenderedLevel(binding.mapContentModel(), 1, "DT-LVL-001 renders level 1");
        assertNoTravelTruthMutation(runtime, mapId, geometryRowsBefore, partyPositionsBefore, "DT-LVL-001");

        DungeonEditorBehaviorHarnessSupport.click(DungeonEditorBehaviorHarnessSupport.button(binding.controlsRoot(), "-"));

        TravelDungeonSnapshot afterMinusSnapshot = travelModel.current();
        assertProjectionLevel(afterMinusSnapshot, 0, "DT-LVL-002 travel snapshot projection level decrements");
        DungeonEditorBehaviorHarnessSupport.assertTrue(
                DungeonEditorBehaviorHarnessSupport.labelVisible(binding.controlsRoot(), "Ebene z=0"),
                "DT-LVL-002 visible travel level label updates");
        assertRenderedLevel(binding.mapContentModel(), 0, "DT-LVL-002 renders level 0");
        assertNoTravelTruthMutation(runtime, mapId, geometryRowsBefore, partyPositionsBefore, "DT-LVL-002");

        runtime.context().services().require(DungeonTravelRuntimeApplicationService.class)
                .applyDungeonTravelSession(ApplyTravelDungeonSessionCommand.action(-1));
        TravelDungeonSnapshot invalidActionSnapshot = travelModel.current();
        DungeonEditorBehaviorHarnessSupport.assertTrue(
                invalidActionSnapshot.workspaceState() != null
                        && invalidActionSnapshot.workspaceState().statusLabel().contains("Aktion ist nicht verfügbar."),
                "DT-ACT-INVALID typed invalid selected action reports invalid action");
        assertNoTravelTruthMutation(runtime, mapId, geometryRowsBefore, partyPositionsBefore, "DT-ACT-INVALID");

        results.add("OwnerSuite=" + OWNER + "; ProofType=RealRoute; "
                + "DT-LVL-001 Ready: DungeonTravelControlsView + button -> SQLite/party unchanged"
                + " -> published projection z=1 -> rendered level 1");
        results.add("OwnerSuite=" + OWNER + "; ProofType=RealRoute; "
                + "DT-LVL-002 Ready: DungeonTravelControlsView - button -> SQLite/party unchanged"
                + " -> published projection z=0 -> rendered level 0");
        results.add("OwnerSuite=" + OWNER + "; ProofType=RealRoute; "
                + "DT-ACT-INVALID Ready: typed invalid selected action -> ApplicationService"
                + " -> INVALID_ACTION status -> SQLite/party unchanged");
    }

    private static void verifyRenderedTransitionActions(List<String> results) {
        HarnessRuntime runtime = HarnessRuntime.create();
        long sourceMapId = runtime.database().createPersistedMap("Travel Action Source Map");
        long targetMapId = runtime.database().createPersistedMap("Travel Action Target Map");
        runtime.database().seedResolvedTransitionLinkFixture(sourceMapId, targetMapId);
        long sourceTransitionId = runtime.database().transitionIdByDescription(sourceMapId, "Source transition.");
        long targetTransitionId = runtime.database().transitionIdByDescription(targetMapId, "Target transition.");
        movePartyTokenToTransition(runtime.party(), sourceMapId, sourceTransitionId, 5, 2, 0);
        runtime.context().services().require(DungeonTravelRuntimeApplicationService.class)
                .applyDungeonTravelSession(refreshCommand());
        long sourceGeometryRowsBefore = runtime.database().countAuthoredGeometryRows(sourceMapId);
        long targetGeometryRowsBefore = runtime.database().countAuthoredGeometryRows(targetMapId);

        HarnessBinding binding = bindHarness(runtime);
        TravelDungeonModel travelModel = runtime.context().services().require(TravelDungeonModel.class);
        String linkedActionLabel = transitionActionLabel(
                sourceTransitionId,
                "Dungeon " + targetMapId + " / Übergang " + targetTransitionId);

        DungeonEditorBehaviorHarnessSupport.assertTrue(
                DungeonEditorBehaviorHarnessSupport.button(binding.stateRoot(), linkedActionLabel) != null,
                "DT-ACT-001 visible linked transition action is rendered");
        DungeonEditorBehaviorHarnessSupport.click(
                DungeonEditorBehaviorHarnessSupport.button(binding.stateRoot(), linkedActionLabel));

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

        HarnessRuntime blockedRuntime = HarnessRuntime.create();
        long blockedMapId = blockedRuntime.database().createPersistedMap("Travel Action Unlinked Map");
        blockedRuntime.database().seedUnlinkedTransitionFixture(blockedMapId);
        long blockedTransitionId =
                blockedRuntime.database().transitionIdByDescription(blockedMapId, "Unlinked transition.");
        movePartyTokenToTransition(blockedRuntime.party(), blockedMapId, blockedTransitionId, 5, 2, 0);
        blockedRuntime.context().services().require(DungeonTravelRuntimeApplicationService.class)
                .applyDungeonTravelSession(refreshCommand());
        PartyTravelPositionsResult blockedPartyBefore = blockedRuntime.partyPositions().current();
        long blockedGeometryRowsBefore = blockedRuntime.database().countAuthoredGeometryRows(blockedMapId);
        HarnessBinding blockedBinding = bindHarness(blockedRuntime);
        TravelDungeonModel blockedTravelModel =
                blockedRuntime.context().services().require(TravelDungeonModel.class);
        String blockedActionLabel = transitionActionLabel(blockedTransitionId, "Kein Ziel verknuepft");

        DungeonEditorBehaviorHarnessSupport.assertTrue(
                DungeonEditorBehaviorHarnessSupport.button(blockedBinding.stateRoot(), blockedActionLabel) != null,
                "DT-ACT-002 visible unlinked transition action is rendered");
        DungeonEditorBehaviorHarnessSupport.click(
                DungeonEditorBehaviorHarnessSupport.button(blockedBinding.stateRoot(), blockedActionLabel));

        TravelDungeonSnapshot afterBlockedAction = blockedTravelModel.current();
        DungeonEditorBehaviorHarnessSupport.assertTrue(
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

        results.add("OwnerSuite=" + OWNER + "; ProofType=RealRoute; "
                + "DT-ACT-001 Ready: DungeonTravelStateView linked transition button"
                + " -> ApplicationService -> party runtime position target transition"
                + " -> SQLite authored geometry unchanged");
        results.add("OwnerSuite=" + OWNER + "; ProofType=RealRoute; "
                + "DT-ACT-002 Ready: DungeonTravelStateView unlinked transition button"
                + " -> ApplicationService -> missing-target status"
                + " -> SQLite authored geometry unchanged");
    }

    private static HarnessBinding bindHarness(HarnessRuntime runtime) {
        ShellBinding shellBinding = new DungeonTravelContribution().bind(runtime.context());
        Parent controlsRoot = DungeonEditorBehaviorHarnessSupport.slot(shellBinding, ShellSlot.COCKPIT_CONTROLS, Parent.class);
        DungeonMapView mapView = DungeonEditorBehaviorHarnessSupport.slot(shellBinding, ShellSlot.COCKPIT_MAIN, DungeonMapView.class);
        Parent stateRoot = DungeonEditorBehaviorHarnessSupport.slot(shellBinding, ShellSlot.COCKPIT_STATE, Parent.class);
        Stage stage = new Stage();
        HBox root = new HBox(controlsRoot, mapView, stateRoot);
        stage.setScene(new Scene(root, 1_400.0, 900.0));
        stage.show();
        root.applyCss();
        root.layout();
        return new HarnessBinding(controlsRoot, stateRoot, DungeonEditorBehaviorHarnessSupport.boundContentModel(mapView));
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
                new CharacterDraft("Dungeon Guide", "Harness", 3, 12, 14),
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

    private static ApplyTravelDungeonSessionCommand refreshCommand() {
        return new ApplyTravelDungeonSessionCommand(
                ApplyTravelDungeonSessionCommand.Action.REFRESH,
                -1,
                0L,
                0,
                DungeonOverlaySettings.defaults());
    }

    private static String transitionActionLabel(long transitionId, String destinationLabel) {
        return "Übergang " + transitionId + ": " + destinationLabel;
    }

    private static void assertProjectionLevel(TravelDungeonSnapshot snapshot, int expectedLevel, String message) {
        DungeonEditorBehaviorHarnessSupport.assertEquals(expectedLevel, snapshot.projectionLevel(), message);
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
        DungeonEditorBehaviorHarnessSupport.assertTrue(
                snapshot != null && snapshot.travelSurface() != null,
                message + " has travel surface");
        src.domain.dungeon.published.DungeonTravelPosition position = snapshot.travelSurface().position();
        DungeonEditorBehaviorHarnessSupport.assertEquals(
                expectedMapId,
                position.mapId().value(),
                message + " map id");
        DungeonEditorBehaviorHarnessSupport.assertEquals(
                expectedLocationKind,
                position.locationKind(),
                message + " location kind");
        DungeonEditorBehaviorHarnessSupport.assertEquals(
                expectedOwnerId,
                position.ownerId(),
                message + " owner id");
        DungeonEditorBehaviorHarnessSupport.assertEquals(
                expectedQ,
                position.tile().q(),
                message + " tile q");
        DungeonEditorBehaviorHarnessSupport.assertEquals(
                expectedR,
                position.tile().r(),
                message + " tile r");
        DungeonEditorBehaviorHarnessSupport.assertEquals(
                expectedLevel,
                position.tile().level(),
                message + " tile level");
    }

    private static void assertRenderedLevel(DungeonMapContentModel mapContentModel, int expectedLevel, String message) {
        Set<String> renderedCells = DungeonEditorBehaviorHarnessSupport.renderSurfaceCellOriginsWithZ(mapContentModel);
        DungeonEditorBehaviorHarnessSupport.assertTrue(
                !renderedCells.isEmpty(),
                message + " rendered cells are empty");
        DungeonEditorBehaviorHarnessSupport.assertTrue(
                renderedCells.stream().allMatch(cell -> cell.endsWith("," + expectedLevel)),
                message + " rendered cells=" + renderedCells);
    }

    private static void assertTravelTransitionMarkerTopologyRef(
            DungeonMapContentModel mapContentModel,
            long transitionId,
            String message
    ) {
        String selectionRef = "TRANSITION:" + transitionId;
        DungeonEditorBehaviorHarnessSupport.assertTrue(
                mapContentModel.canvasStateProperty().get().renderScene().glyphs().stream()
                        .anyMatch(glyph -> selectionRef.equals(glyph.selectionRef())),
                message);
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
        DungeonEditorBehaviorHarnessSupport.assertTrue(
                location instanceof PartyDungeonTravelLocationSnapshot,
                message + " is dungeon location");
        PartyDungeonTravelLocationSnapshot dungeonLocation = (PartyDungeonTravelLocationSnapshot) location;
        DungeonEditorBehaviorHarnessSupport.assertEquals(expectedMapId, dungeonLocation.mapId(), message + " map id");
        DungeonEditorBehaviorHarnessSupport.assertEquals(
                expectedLocationKind,
                dungeonLocation.locationKind(),
                message + " location kind");
        DungeonEditorBehaviorHarnessSupport.assertEquals(
                expectedOwnerId,
                dungeonLocation.ownerId(),
                message + " owner id");
        DungeonEditorBehaviorHarnessSupport.assertEquals(expectedTile, dungeonLocation.tile(), message + " tile");
    }

    private static void assertAuthoredGeometryUnchanged(
            HarnessRuntime runtime,
            long mapId,
            long geometryRowsBefore,
            String message
    ) {
        DungeonEditorBehaviorHarnessSupport.assertEquals(
                geometryRowsBefore,
                runtime.database().countAuthoredGeometryRows(mapId),
                message);
    }

    private static void assertNoTravelTruthMutation(
            HarnessRuntime runtime,
            long mapId,
            long geometryRowsBefore,
            PartyTravelPositionsResult partyPositionsBefore,
            String scenario
    ) {
        DungeonEditorBehaviorHarnessSupport.assertEquals(
                geometryRowsBefore,
                runtime.database().countAuthoredGeometryRows(mapId),
                scenario + " leaves authored dungeon geometry unchanged");
        PartyTravelPositionsResult partyPositionsAfter = runtime.partyPositions().current();
        DungeonEditorBehaviorHarnessSupport.assertEquals(
                partyPositionsBefore.partyTokenCharacterIds(),
                partyPositionsAfter.partyTokenCharacterIds(),
                scenario + " leaves party-token character ids unchanged");
        PartyTravelLocationSnapshot locationBefore = partyPositionsBefore.partyTokenLocation();
        DungeonEditorBehaviorHarnessSupport.assertEquals(
                locationBefore,
                partyPositionsAfter.partyTokenLocation(),
                scenario + " leaves party runtime position unchanged");
    }

    private record HarnessBinding(
            Parent controlsRoot,
            Parent stateRoot,
            DungeonMapContentModel mapContentModel
    ) {
    }

    private record HarnessRuntime(
            ShellRuntimeContext context,
            PartyApplicationService party,
            PartyTravelPositionsModel partyPositions,
            DungeonEditorHarnessPersistenceSupport.DatabaseAssertions database
    ) {
        static HarnessRuntime create() {
            DungeonEditorHarnessPersistenceSupport.DatabaseAssertions database =
                    new DungeonEditorHarnessPersistenceSupport.DatabaseAssertions();
            database.clearDungeonData();
            database.clearPartyData();
            ServiceRegistry.Builder builder = new ServiceRegistry.Builder();
            builder.register(DungeonMapRepository.class, new SqliteDungeonMapRepository());
            new src.data.party.PartyServiceContribution().register(builder);
            new src.domain.party.PartyServiceContribution().register(builder);
            new DungeonServiceContribution().register(builder);
            ServiceRegistry registry = builder.build();
            return new HarnessRuntime(
                    new ShellRuntimeContext(DungeonEditorHarnessPersistenceSupport.EmptyInspectorSink.INSTANCE, registry),
                    registry.require(PartyApplicationService.class),
                    registry.require(PartyTravelPositionsModel.class),
                    database);
        }
    }
}
