package src.domain.hex;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import platform.diagnostics.DiagnosticId;
import platform.diagnostics.Diagnostics;
import platform.execution.ExecutionLane;
import platform.ui.UiDispatcher;
import src.domain.hex.model.map.HexCoordinate;
import src.domain.hex.model.map.HexEditorWorkspace;
import src.domain.hex.model.map.HexMap;
import src.domain.hex.model.map.HexMapIdentity;
import src.domain.hex.model.map.HexMapSummary;
import src.domain.hex.model.map.HexMarker;
import src.domain.hex.model.map.HexTerrain;
import src.domain.hex.model.map.repository.HexMapRepository;
import src.domain.hex.published.HexEditorModel;
import src.domain.hex.published.LoadHexEditorCommand;
import src.domain.hex.published.PaintHexTerrainCommand;
import src.domain.hex.published.SaveHexMarkerCommand;
import src.domain.hex.published.SelectHexMapCommand;
import src.domain.hex.published.SelectHexTileCommand;
import src.domain.hex.published.SetHexEditorToolCommand;

final class HexRuntimePlatformAdoptionTest {

    @Test
    void persistenceWorkRunsOnTheSuppliedLaneAndPublishesThroughTheUiDispatcher() {
        QueuedLane lane = new QueuedLane();
        QueuedDispatcher dispatcher = new QueuedDispatcher();
        RecordingRepository repository = new RecordingRepository();
        HexEditorModel model = new HexEditorModel(dispatcher);
        HexEditorApplicationService service = service(repository, model, lane, new RecordingDiagnostics());
        List<String> deliveredStatuses = new ArrayList<>();
        model.subscribe(snapshot -> deliveredStatuses.add(snapshot.statusText()));

        service.loadEditor(new LoadHexEditorCommand());

        assertTrue(repository.events.isEmpty(), "repository access must not run on the caller");
        lane.runNext();
        assertFalse(repository.events.isEmpty(), "queued work must enter the repository on the lane");
        assertTrue(deliveredStatuses.isEmpty(), "published state must wait for the supplied UI dispatcher");
        dispatcher.runAll();
        assertEquals(1, deliveredStatuses.size());
    }

    @Test
    void reloadAndSelectionAreSubmittedAsOneOrderedLaneOperation() {
        QueuedLane lane = new QueuedLane();
        RecordingRepository repository = new RecordingRepository();
        HexEditorApplicationService service = service(
                repository,
                new HexEditorModel(),
                lane,
                new RecordingDiagnostics());

        service.reloadAndSelectMap(new LoadHexEditorCommand(), new SelectHexMapCommand(1L));

        assertEquals(1, lane.size());
        lane.runNext();
        assertTrue(repository.events.indexOf("loadSelected") < repository.events.indexOf("loadById"));
        assertTrue(repository.events.indexOf("loadById") < repository.events.indexOf("setSelectedMap"));
    }

    @Test
    void storageFailureUsesGenericTextAndPayloadFreeDiagnostics() {
        QueuedLane lane = new QueuedLane();
        RecordingRepository repository = new RecordingRepository();
        repository.failure = new IllegalStateException("authored secret payload");
        RecordingDiagnostics diagnostics = new RecordingDiagnostics();
        HexEditorModel model = new HexEditorModel();
        HexEditorApplicationService service = service(repository, model, lane, diagnostics);

        service.loadEditor(new LoadHexEditorCommand());
        lane.runNext();

        assertEquals("Hex-Daten konnten nicht geladen oder gespeichert werden.", model.current().failureText());
        assertFalse(model.current().failureText().contains("secret"));
        assertEquals(new DiagnosticId("hex.storage-failure"), diagnostics.id);
        assertEquals(IllegalStateException.class, diagnostics.failureType);
    }

    @Test
    void immediateToolIntentDoesNotEnterThePersistenceLaneOrMutateLaneOwnedWorkspace() {
        QueuedLane lane = new QueuedLane();
        HexEditorModel model = new HexEditorModel();
        HexEditorWorkspace workspace = new HexEditorWorkspace();
        HexEditorApplicationService service = new HexEditorApplicationService(
                new RecordingRepository(), workspace, model, lane, new RecordingDiagnostics());

        service.setActiveTool(new SetHexEditorToolCommand("PAINT_TERRAIN", "WATER"));

        assertEquals(0, lane.size());
        assertEquals("PAINT_TERRAIN", model.current().activeTool());
        assertEquals("WATER", model.current().activeTerrain());
        assertEquals("SELECT", workspace.state().activeMode().name());
        assertEquals("GRASSLAND", workspace.state().activeTerrain().name());
    }

    @Test
    void queuedTileSelectionCannotOverwriteNewerImmediateMarkerToolDraft() {
        QueuedLane lane = new QueuedLane();
        HexEditorModel model = new HexEditorModel();
        HexEditorApplicationService service = service(
                new RecordingRepository(), model, lane, new RecordingDiagnostics());

        service.selectTile(new SelectHexTileCommand(1L, 0, 0));
        service.setActiveTool(new SetHexEditorToolCommand("PLACE_MARKER", "WATER"));
        lane.runNext();

        assertEquals("PLACE_MARKER", model.current().activeTool());
        assertEquals("WATER", model.current().activeTerrain());
        assertEquals(0, model.current().selectedTile().orElseThrow().q());
        assertEquals(0, model.current().selectedTile().orElseThrow().r());
    }

    @Test
    void queuedPaintCompletionCannotOverwriteNewerImmediateMarkerToolIntent() {
        QueuedLane lane = new QueuedLane();
        HexEditorModel model = new HexEditorModel();
        HexEditorApplicationService service = service(
                new RecordingRepository(), model, lane, new RecordingDiagnostics());

        service.paintTerrain(new PaintHexTerrainCommand(1L, 0, 0, "WATER"));
        service.setActiveTool(new SetHexEditorToolCommand("PLACE_MARKER", "FOREST"));
        lane.runNext();

        assertEquals("PLACE_MARKER", model.current().activeTool());
        assertEquals("FOREST", model.current().activeTerrain());
        assertEquals("WATER", model.current().tiles().stream()
                .filter(tile -> tile.q() == 0 && tile.r() == 0)
                .findFirst()
                .orElseThrow()
                .terrain());
    }

    @Test
    void queuedMarkerCompletionCannotOverwriteNewerImmediateMoveToolIntent() {
        QueuedLane lane = new QueuedLane();
        HexEditorModel model = new HexEditorModel();
        HexEditorApplicationService service = service(
                new RecordingRepository(), model, lane, new RecordingDiagnostics());

        service.saveMarker(new SaveHexMarkerCommand(
                1L, 0L, 0, 0, "Harbor", "LANDMARK", "Safe anchorage"));
        service.setActiveTool(new SetHexEditorToolCommand("MOVE_PARTY", "DESERT"));
        lane.runNext();

        assertEquals("MOVE_PARTY", model.current().activeTool());
        assertEquals("DESERT", model.current().activeTerrain());
        assertEquals("Harbor", model.current().tiles().stream()
                .filter(tile -> tile.q() == 0 && tile.r() == 0)
                .findFirst()
                .orElseThrow()
                .markers()
                .getFirst()
                .name());
    }

    private static HexEditorApplicationService service(
            HexMapRepository repository,
            HexEditorModel model,
            ExecutionLane lane,
            Diagnostics diagnostics
    ) {
        return new HexEditorApplicationService(
                repository, new HexEditorWorkspace(), model, lane, diagnostics);
    }

    private static final class QueuedLane implements ExecutionLane {
        private final Deque<Runnable> work = new ArrayDeque<>();

        @Override
        public void execute(Runnable task) {
            work.addLast(task);
        }

        int size() {
            return work.size();
        }

        void runNext() {
            work.removeFirst().run();
        }

        @Override
        public void close() {
        }
    }

    private static final class QueuedDispatcher implements UiDispatcher {
        private final Deque<Runnable> updates = new ArrayDeque<>();

        @Override
        public void dispatch(Runnable update) {
            updates.addLast(update);
        }

        void runAll() {
            while (!updates.isEmpty()) {
                updates.removeFirst().run();
            }
        }
    }

    private static final class RecordingDiagnostics implements Diagnostics {
        private DiagnosticId id;
        private Class<? extends Throwable> failureType;

        @Override
        public void failure(DiagnosticId diagnosticId, Class<? extends Throwable> type) {
            id = diagnosticId;
            failureType = type;
        }
    }

    private static final class RecordingRepository implements HexMapRepository {
        private final List<String> events = new ArrayList<>();
        private final HexMap map = HexMap.create(new HexMapIdentity(1L), "Map", 2);
        private IllegalStateException failure;

        @Override
        public Optional<HexMap> loadSelected() {
            events.add("loadSelected");
            failIfRequested();
            return Optional.of(map);
        }

        @Override
        public Optional<HexMap> loadById(HexMapIdentity mapId) {
            events.add("loadById");
            return Optional.of(map);
        }

        @Override
        public Optional<HexMapSummary> loadSummaryById(HexMapIdentity mapId) {
            return Optional.of(summary());
        }

        @Override
        public List<HexMapSummary> listMaps() {
            events.add("listMaps");
            return List.of(summary());
        }

        @Override
        public HexMap save(HexMap savedMap) {
            return savedMap;
        }

        @Override
        public HexMap saveTerrain(HexMapIdentity mapId, HexCoordinate coordinate, HexTerrain terrain) {
            return map.paintTerrain(coordinate, terrain);
        }

        @Override
        public HexMap saveMarker(HexMapIdentity mapId, HexMarker marker) {
            return map.saveMarker(marker.markerId(), marker.coordinate(), marker.name(), marker.type(), marker.note());
        }

        @Override
        public long nextMapId() {
            return 2L;
        }

        @Override
        public long nextMarkerId(HexMapIdentity mapId) {
            return 1L;
        }

        @Override
        public void setSelectedMap(HexMapIdentity mapId) {
            events.add("setSelectedMap");
        }

        private void failIfRequested() {
            if (failure != null) {
                throw failure;
            }
        }

        private HexMapSummary summary() {
            return new HexMapSummary(map.mapId(), map.displayName(), map.radius());
        }
    }
}
