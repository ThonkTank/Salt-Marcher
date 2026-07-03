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
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.repository.DungeonMapRepository;
import src.domain.dungeon.model.runtime.repository.TravelPartyPositionRepository;
import src.domain.dungeon.model.runtime.repository.TravelPartyStateRepository;
import src.domain.dungeon.model.runtime.travel.session.TravelDungeonActiveState;
import src.domain.dungeon.model.runtime.travel.session.TravelDungeonSessionSurface;
import src.domain.dungeon.model.runtime.travel.session.TravelDungeonSessionValues;
import src.domain.dungeon.published.ApplyTravelDungeonSessionCommand;
import src.domain.dungeon.published.DungeonOverlaySettings;
import src.domain.dungeon.published.TravelDungeonModel;
import src.domain.dungeon.published.TravelDungeonSnapshot;
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
        runtime.partyState().moveToMap(mapId);
        runtime.context().services().require(DungeonTravelRuntimeApplicationService.class)
                .applyDungeonTravelSession(new ApplyTravelDungeonSessionCommand(
                        ApplyTravelDungeonSessionCommand.Action.REFRESH,
                        "",
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
        assertNoTravelTruthMutation(runtime, mapId, geometryRowsBefore, "DT-LVL-001");

        DungeonEditorBehaviorHarnessSupport.click(DungeonEditorBehaviorHarnessSupport.button(binding.controlsRoot(), "-"));

        TravelDungeonSnapshot afterMinusSnapshot = travelModel.current();
        assertProjectionLevel(afterMinusSnapshot, 0, "DT-LVL-002 travel snapshot projection level decrements");
        DungeonEditorBehaviorHarnessSupport.assertTrue(
                DungeonEditorBehaviorHarnessSupport.labelVisible(binding.controlsRoot(), "Ebene z=0"),
                "DT-LVL-002 visible travel level label updates");
        assertRenderedLevel(binding.mapContentModel(), 0, "DT-LVL-002 renders level 0");
        assertNoTravelTruthMutation(runtime, mapId, geometryRowsBefore, "DT-LVL-002");

        results.add("OwnerSuite=" + OWNER + "; ProofType=RealRoute; "
                + "DT-LVL-001 Ready: DungeonTravelControlsView + button -> SQLite/party unchanged"
                + " -> published projection z=1 -> rendered level 1");
        results.add("OwnerSuite=" + OWNER + "; ProofType=RealRoute; "
                + "DT-LVL-002 Ready: DungeonTravelControlsView - button -> SQLite/party unchanged"
                + " -> published projection z=0 -> rendered level 0");
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
            String scenario
    ) {
        DungeonEditorBehaviorHarnessSupport.assertEquals(
                geometryRowsBefore,
                runtime.database().countAuthoredGeometryRows(mapId),
                scenario + " leaves authored dungeon geometry unchanged");
        DungeonEditorBehaviorHarnessSupport.assertEquals(
                0,
                runtime.partyPosition().dungeonSaveCount(),
                scenario + " leaves party runtime position unchanged");
    }

    private record HarnessBinding(
            Parent controlsRoot,
            DungeonMapContentModel mapContentModel
    ) {
    }

    private record HarnessRuntime(
            ShellRuntimeContext context,
            MutableTravelPartyStateRepository partyState,
            CountingTravelPartyPositionRepository partyPosition,
            DungeonEditorHarnessPersistenceSupport.DatabaseAssertions database
    ) {
        static HarnessRuntime create() {
            DungeonEditorHarnessPersistenceSupport.DatabaseAssertions database =
                    new DungeonEditorHarnessPersistenceSupport.DatabaseAssertions();
            database.clearDungeonData();
            MutableTravelPartyStateRepository partyState = new MutableTravelPartyStateRepository();
            ServiceRegistry.Builder builder = new ServiceRegistry.Builder();
            CountingTravelPartyPositionRepository partyPosition = new CountingTravelPartyPositionRepository();
            builder.register(DungeonMapRepository.class, new SqliteDungeonMapRepository());
            builder.register(TravelPartyStateRepository.class, partyState);
            builder.register(TravelPartyPositionRepository.class, partyPosition);
            new DungeonServiceContribution().register(builder);
            ServiceRegistry registry = builder.build();
            return new HarnessRuntime(
                    new ShellRuntimeContext(DungeonEditorHarnessPersistenceSupport.EmptyInspectorSink.INSTANCE, registry),
                    partyState,
                    partyPosition,
                    database);
        }
    }

    private static final class MutableTravelPartyStateRepository implements TravelPartyStateRepository {
        private TravelDungeonActiveState.ActiveTravelStateData activeTravelState =
                new TravelDungeonActiveState.ActiveTravelStateData(List.of(), null);

        @Override
        public TravelDungeonActiveState.ActiveTravelStateData loadActiveTravelState() {
            return activeTravelState;
        }

        private void moveToMap(long mapId) {
            activeTravelState = new TravelDungeonActiveState.ActiveTravelStateData(
                    List.of(),
                    new TravelDungeonActiveState.PartyLocationData(
                            new TravelDungeonSessionSurface.PositionData(
                                    mapId,
                                    TravelDungeonSessionValues.LocationKind.TILE,
                                    0L,
                                    new Cell(1, 1, 0),
                                    "SOUTH"),
                            0L,
                            false));
        }
    }

    private static final class CountingTravelPartyPositionRepository implements TravelPartyPositionRepository {
        private int dungeonSaveCount;

        @Override
        public boolean saveDungeonPosition(
                TravelDungeonSessionSurface.PositionData position,
                List<Long> characterIds
        ) {
            dungeonSaveCount++;
            return false;
        }

        @Override
        public boolean saveOverworldPosition(
                TravelDungeonSessionValues.OverworldTarget target,
                List<Long> characterIds
        ) {
            return false;
        }

        private int dungeonSaveCount() {
            return dungeonSaveCount;
        }
    }
}
