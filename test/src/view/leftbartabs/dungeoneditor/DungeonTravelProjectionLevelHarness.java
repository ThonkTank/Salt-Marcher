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
        DungeonEditorHarnessPublicationSupport.runOnFxThread(() -> verifyProjectionLevelControls(results));
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
        assertNoTravelTruthMutation(runtime, mapId, geometryRowsBefore, "DT-ACT-INVALID");

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
        return new HarnessBinding(controlsRoot, DungeonEditorBehaviorHarnessSupport.boundContentModel(mapView));
    }

    private static void movePartyTokenToMap(PartyApplicationService party, long mapId) {
        party.createCharacter(new CreateCharacterCommand(
                new CharacterDraft("Dungeon Guide", "Harness", 3, 12, 14),
                MembershipState.ACTIVE));
        party.moveCharacters(new MovePartyCharactersCommand(
                List.of(1L),
                new PartyDungeonTravelLocationSnapshot(
                        mapId,
                        PartyDungeonTravelLocationKind.TILE,
                        0L,
                        new PartyTravelTile(1, 1, 0),
                        PartyTravelHeading.SOUTH),
                true));
    }

    private static void assertProjectionLevel(TravelDungeonSnapshot snapshot, int expectedLevel, String message) {
        DungeonEditorBehaviorHarnessSupport.assertEquals(expectedLevel, snapshot.projectionLevel(), message);
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
