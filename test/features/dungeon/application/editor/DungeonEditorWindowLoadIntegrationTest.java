package features.dungeon.application.editor;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import features.dungeon.DungeonTestAssembly;
import features.dungeon.api.DungeonCellRef;
import features.dungeon.api.DungeonChunkKey;
import features.dungeon.api.DungeonMapId;
import features.dungeon.api.DungeonViewportRequest;
import features.dungeon.api.authored.DungeonAuthoredApi;
import features.dungeon.api.editor.DungeonEditorApi;
import features.dungeon.api.editor.DungeonEditorCommandOutcome;
import features.dungeon.api.editor.DungeonEditorIntent;
import features.dungeon.api.editor.DungeonEditorPointerGesture;
import features.dungeon.api.editor.DungeonEditorPointerInput;
import features.dungeon.api.editor.DungeonEditorToolSelection;
import features.dungeon.api.editor.DungeonEditorToolFamily;
import features.dungeon.application.authored.command.DungeonPatchEntityRef;
import features.dungeon.application.authored.DungeonAuthoredApplicationService;
import features.dungeon.application.authored.DungeonAuthoredPublishedState;
import features.dungeon.application.authored.port.DungeonCatalogStore;
import features.dungeon.application.authored.port.DungeonIdentityClosureRequest;
import features.dungeon.application.authored.port.DungeonIdentityClosureResult;
import features.dungeon.application.authored.port.DungeonMapHeader;
import features.dungeon.application.authored.port.DungeonMapRepository;
import features.dungeon.application.authored.port.DungeonWindow;
import features.dungeon.application.authored.port.DungeonWindowChunkHeader;
import features.dungeon.application.authored.port.DungeonWindowContinuation;
import features.dungeon.application.authored.port.DungeonWindowEntityFragment;
import features.dungeon.application.authored.port.DungeonWindowRequest;
import features.dungeon.application.authored.port.DungeonWindowStore;
import features.dungeon.application.editor.session.DungeonEditorDungeonState;
import features.dungeon.application.editor.session.DungeonEditorWorkspaceValues;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.Direction;
import features.dungeon.domain.core.graph.DungeonTopologyRef;
import features.dungeon.domain.core.structure.DungeonMap;
import features.dungeon.domain.core.structure.DungeonMapAuthoring;
import features.dungeon.domain.core.structure.DungeonMapIdentity;
import features.dungeon.domain.core.structure.feature.FeatureMarkerKind;
import features.dungeon.domain.core.structure.stair.StairShape;
import features.dungeon.domain.core.structure.transition.TransitionAnchor;
import features.dungeon.domain.core.structure.transition.TransitionDestination;
import features.party.PartyServiceAssembly;
import features.party.domain.roster.PartyRoster;
import features.party.domain.roster.repository.PartyRosterRepository;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import platform.diagnostics.NoopDiagnostics;
import platform.execution.DirectExecutionLane;
import platform.execution.ExecutionLane;
import platform.ui.DirectUiDispatcher;

final class DungeonEditorWindowLoadIntegrationTest {

    @Test
    void composedEditorInitialAndSelectMapPublishExactOriginRingWithoutWholeMapHydration() {
        Catalog catalog = new Catalog();
        FailFastRepository repository = new FailFastRepository();
        RecordingWindowStore windows = new RecordingWindowStore();
        DungeonTestAssembly.Component component = component(catalog, repository, windows);
        DungeonEditorApi editor = editor(component);

        editor.dispatch(new DungeonEditorIntent.SelectMap(new DungeonMapId(1L)));

        assertNotNull(editor.current().selectedWindow());
        assertEquals(1L, editor.current().selectedMapId().value());
        assertSemanticSurface(editor.current().selectedWindow().map());
        long initialGeneration = editor.current().requestGeneration();

        editor.dispatch(new DungeonEditorIntent.SelectMap(new DungeonMapId(2L)));

        assertEquals(2L, editor.current().selectedMapId().value());
        assertTrue(editor.current().requestGeneration() > initialGeneration);
        assertSemanticSurface(editor.current().selectedWindow().map());
        assertEquals(2, windows.requests.size());
        assertEquals(List.of(1L, 2L), windows.requests.stream()
                .map(request -> request.mapId().value()).toList());
        assertEquals(List.of(1L, 2L), windows.requests.stream()
                .map(DungeonWindowRequest::requestGeneration).toList());
        windows.requests.forEach(request -> assertOriginRing(request.chunkKeys(), request.mapId().value()));
        assertEquals(0, repository.findByIdCalls);
        assertEquals(0, repository.firstMapCalls);
    }

    @Test
    void missingSecondMapWindowNeverRelabelsThePreviouslyAcceptedSurface() {
        assertRejectedSecondWindow(SecondWindowMode.MISSING);
    }

    @Test
    void staleSecondMapWindowNeverRelabelsThePreviouslyAcceptedSurface() {
        assertRejectedSecondWindow(SecondWindowMode.STALE_GENERATION);
    }

    @Test
    void mismatchedSecondMapWindowNeverRelabelsThePreviouslyAcceptedSurface() {
        assertRejectedSecondWindow(SecondWindowMode.MISMATCHED_MAP);
    }

    @Test
    void lateOlderWindowCannotOverwriteTheAcceptedMutationPublication() {
        Catalog catalog = new Catalog();
        RevisionedRepository repository = new RevisionedRepository();
        RecordingWindowStore windows = new RecordingWindowStore();
        DungeonAuthoredApplicationService service = new DungeonAuthoredApplicationService(
                catalog,
                repository,
                windows,
                features.dungeon.DungeonTestAssembly.inMemoryUnitOfWork(),
                DirectExecutionLane.INSTANCE,
                new DungeonAuthoredPublishedState(DirectUiDispatcher.INSTANCE));
        DungeonEditorDungeonState state = new DungeonEditorDungeonState();
        DungeonAuthoredApplicationService.Session session = service.openSession(state);
        DungeonEditorWorkspaceValues.MapId mapId = new DungeonEditorWorkspaceValues.MapId(1L);

        assertTrue(session.loadInitialWindow(mapId, 0));
        var initial = state.committedFacts(mapId).surface();
        assertNotNull(initial);
        assertEquals(1L, initial.requestGeneration());
        assertEquals(7L, initial.acceptedRevision());

        service.applyRoomRectangle(
                mapId,
                new Cell(10, 10, 0),
                new Cell(10, 10, 0),
                false,
                session);

        var committedMutation = state.committedFacts(mapId).surface();
        assertNotNull(committedMutation);
        assertEquals(mapId, committedMutation.mapId());
        assertEquals(1L, committedMutation.requestGeneration(),
                "a committed mutation retains the accepted Window generation");
        assertEquals(8L, committedMutation.acceptedRevision());
        assertEquals(8, committedMutation.revision());
        assertTrue(committedMutation.map().areas().stream()
                .filter(area -> area.kind().isRoom())
                .flatMap(area -> area.cells().stream())
                .anyMatch(new Cell(10, 10, 0)::equals));

        assertFalse(session.loadInitialWindow(mapId, 0),
                "the later generation cannot publish an older map revision");

        var retained = state.committedFacts(mapId).surface();
        assertNotNull(retained);
        assertEquals(mapId, retained.mapId());
        assertEquals(1L, retained.requestGeneration());
        assertEquals(8L, retained.acceptedRevision());
        assertEquals(8, retained.revision());
        assertEquals(committedMutation.map(), retained.map());
        assertEquals(1L, service.currentWindowRequestGeneration(),
                "a rejected Window generation is never reported as accepted");
        assertEquals(List.of(1L, 2L), windows.requests.stream()
                .map(DungeonWindowRequest::requestGeneration)
                .toList());
    }

    private static void assertRejectedSecondWindow(SecondWindowMode mode) {
        Catalog catalog = new Catalog();
        FailFastRepository repository = new FailFastRepository();
        RecordingWindowStore windows = new RecordingWindowStore(mode);
        DungeonEditorApi editor = editor(component(catalog, repository, windows));
        editor.dispatch(new DungeonEditorIntent.SelectMap(new DungeonMapId(1L)));
        assertNotNull(editor.current().selectedWindow());
        assertEquals("Alpha", editor.current().selectedWindow().mapName());

        editor.dispatch(new DungeonEditorIntent.SelectMap(new DungeonMapId(2L)));

        assertEquals(2L, editor.current().selectedMapId().value());
        assertNull(editor.current().selectedWindow());
        assertEquals(0, repository.findByIdCalls);
        assertEquals(0, repository.firstMapCalls);
        assertEquals(2, windows.requests.size());
    }

    @Test
    void publicViewportMapsWindowRevisionsIdentitiesAndContinuationsWithoutHydration() throws Exception {
        Catalog catalog = new Catalog();
        FailFastRepository repository = new FailFastRepository();
        RecordingWindowStore windows = new RecordingWindowStore();
        RecordingExecutionLane lane = new RecordingExecutionLane();
        DungeonAuthoredApi authored = new DungeonAuthoredApplicationService(
                catalog,
                repository,
                windows,
                features.dungeon.DungeonTestAssembly.inMemoryUnitOfWork(),
                lane,
                new DungeonAuthoredPublishedState(DirectUiDispatcher.INSTANCE));

        var pending = authored.viewport(new DungeonViewportRequest(1L, 41L, 0, 0, 0, 63, 63));
        assertFalse(pending.toCompletableFuture().isDone());
        assertEquals(0, windows.requests.size());

        lane.runPending();
        var snapshot = pending.toCompletableFuture().get(5, java.util.concurrent.TimeUnit.SECONDS);

        assertEquals(41L, snapshot.requestGeneration());
        assertEquals(7L, snapshot.mapRevision());
        assertEquals(9, snapshot.loadedChunks().size());
        assertEquals(9, snapshot.chunkRevisions().size());
        assertEquals(1, snapshot.continuations().size());
        assertEquals("CORRIDOR", snapshot.continuations().getFirst().ownerKind());
        assertEquals(21L, snapshot.continuations().getFirst().ownerId());
        assertEquals(0, repository.findByIdCalls);
        assertEquals(0, repository.firstMapCalls);
    }

    @Test
    void handlePressHydratesInspectorOnceWhilePreviewLifecycleStaysOnCommittedWindow() {
        Catalog catalog = new Catalog();
        CountingRepository repository = new CountingRepository();
        RecordingWindowStore windows = new RecordingWindowStore();
        DungeonEditorApi editor = editor(component(catalog, repository, windows));
        editor.dispatch(new DungeonEditorIntent.SelectMap(new DungeonMapId(1L)));
        var committedWindow = editor.current().selectedWindow();
        var door = committedWindow.map().editorHandles().stream()
                .filter(handle -> handle.ref().kind() == features.dungeon.api.DungeonEditorHandleKind.DOOR)
                .filter(handle -> handle.ref().topologyRef().id() == 31L)
                .findFirst()
                .orElseThrow();

        dispatchHandle(editor, door, DungeonEditorPointerInput.Action.PRESSED, door.markerQ(), door.markerR());

        assertEquals(1, repository.findByIdCalls,
                "handle selection performs exactly one aggregate compatibility read for the inspector");
        assertEquals(1, windows.requests.size(), "handle selection does not reload the committed Window");
        assertEquals(committedWindow.map(), editor.current().selectedWindow().map());
        assertEquals(committedWindow.revision(), editor.current().selectedWindow().revision());

        dispatchHandle(editor, door, DungeonEditorPointerInput.Action.DRAGGED, door.markerQ() + 1.0, door.markerR());
        dispatchHandle(editor, door, DungeonEditorPointerInput.Action.DRAGGED, door.markerQ() + 2.0, door.markerR());
        dispatchHandle(editor, door, DungeonEditorPointerInput.Action.RELEASED, door.markerQ() + 2.0, door.markerR());

        assertInstanceOf(DungeonEditorCommandOutcome.Rejected.class, editor.current().commandStatus().outcome());
        assertEquals(1, repository.findByIdCalls,
                "move previews and rejected release reuse the selected aggregate workset");
        assertEquals(0, repository.firstMapCalls);
        assertEquals(1, windows.requests.size(),
                "move previews and rejected release do not reload the Window");
        assertEquals(committedWindow.map(), editor.current().selectedWindow().map(),
                "rejected release clears preview while preserving the committed Window map snapshot");
        assertEquals(committedWindow.revision(), editor.current().selectedWindow().revision());
    }

    @Test
    void roomRectanglePointerPreviewUsesLoadedWindowWithoutAggregateFallback() {
        Catalog catalog = new Catalog();
        FailFastRepository repository = new FailFastRepository();
        RecordingWindowStore windows = new RecordingWindowStore();
        DungeonEditorApi editor = editor(component(catalog, repository, windows));
        editor.dispatch(new DungeonEditorIntent.SelectMap(new DungeonMapId(1L)));

        dispatchRoomCell(editor, DungeonEditorPointerInput.Action.PRESSED, 1, 1);
        dispatchRoomCell(editor, DungeonEditorPointerInput.Action.DRAGGED, 3, 3);

        assertNotNull(editor.current().selectedWindow().previewMap());
        assertTrue(editor.current().selectedWindow().previewMap().areas().stream()
                .filter(area -> area.kind().equals("ROOM"))
                .anyMatch(area -> area.cells().stream().anyMatch(cell -> cell.q() == 3 && cell.r() == 3)));
        assertEquals(0, repository.findByIdCalls);
        assertEquals(0, repository.firstMapCalls);
        assertEquals(1, windows.requests.size());
    }

    private static void dispatchHandle(
            DungeonEditorApi editor,
            features.dungeon.api.DungeonEditorHandleSnapshot handle,
            DungeonEditorPointerInput.Action action,
            double q,
            double r
    ) {
        var ref = handle.ref();
        DungeonEditorPointerInput.Target target = new DungeonEditorPointerInput.Target(
                "HANDLE", "EMPTY", "DOOR", ref.ownerId(), ref.clusterId(),
                "DOOR", ref.topologyRef().id(), ref,
                DungeonEditorPointerInput.BoundaryTarget.empty(), "NONE",
                DungeonEditorPointerInput.CellTarget.empty(),
                DungeonEditorPointerInput.VertexTarget.empty());
        editor.dispatch(new DungeonEditorIntent.Pointer(new DungeonEditorPointerInput(
                editor.current().publicationRevision(),
                action,
                DungeonEditorToolSelection.select(),
                new DungeonEditorPointerGesture(
                        DungeonEditorPointerGesture.Button.PRIMARY,
                        false,
                        false),
                q,
                r,
                List.of(target),
                editor.current().projectionLevel(),
                DungeonEditorIntent.TransitionDestinationInput.empty())));
    }

    private static void dispatchRoomCell(
            DungeonEditorApi editor,
            DungeonEditorPointerInput.Action action,
            int q,
            int r
    ) {
        DungeonEditorPointerInput.Target target = new DungeonEditorPointerInput.Target(
                "CELL", "EMPTY", "EMPTY", 0L, 0L, "EMPTY", 0L,
                features.dungeon.api.DungeonEditorHandleRef.empty(),
                DungeonEditorPointerInput.BoundaryTarget.empty(),
                "CELL",
                new DungeonEditorPointerInput.CellTarget(true, q, r, 0),
                DungeonEditorPointerInput.VertexTarget.empty());
        editor.dispatch(new DungeonEditorIntent.Pointer(new DungeonEditorPointerInput(
                editor.current().publicationRevision(),
                action,
                DungeonEditorToolSelection.family(DungeonEditorToolFamily.ROOM),
                new DungeonEditorPointerGesture(DungeonEditorPointerGesture.Button.PRIMARY, false, false),
                q,
                r,
                List.of(target),
                editor.current().projectionLevel(),
                DungeonEditorIntent.TransitionDestinationInput.empty())));
    }

    private static DungeonTestAssembly.Component component(
            DungeonCatalogStore catalog,
            DungeonMapRepository repository,
            DungeonWindowStore windows
    ) {
        PartyServiceAssembly.Component party = PartyServiceAssembly.create(new EmptyPartyRepository());
        return DungeonTestAssembly.create(
                catalog,
                repository,
                windows,
                party.activeParty(),
                party.travelPositions(),
                party.application(),
                party.mutation(),
                DirectExecutionLane.INSTANCE,
                DirectUiDispatcher.INSTANCE,
                NoopDiagnostics.INSTANCE);
    }

    private static DungeonEditorApi editor(DungeonTestAssembly.Component component) {
        DungeonEditorRuntimeDependencies dependencies = new DungeonEditorRuntimeDependencies(
                component.editorControls(),
                component.editorMapSurface(),
                component.editorState(),
                component.editor(),
                new features.dungeon.domain.core.structure.corridor.OrthogonalCorridorRoutingPolicy(),
                component.authored()::currentWindowRequestGeneration,
                DirectExecutionLane.INSTANCE,
                DirectUiDispatcher.INSTANCE);
        return new DungeonEditorApiFacade(
                DungeonEditorFeatureRuntimeRoot.create(dependencies),
                DirectUiDispatcher.INSTANCE);
    }

    private static void assertSemanticSurface(features.dungeon.api.DungeonEditorMapSnapshot map) {
        assertTrue(map.areas().stream().anyMatch(area -> area.kind().equals("ROOM") && area.label().equals("Raum Alpha")));
        assertTrue(map.areas().stream().anyMatch(area -> area.kind().equals("CORRIDOR") && area.id() == 21L));
        assertTrue(map.boundaries().stream().anyMatch(boundary -> boundary.kind().equals("door")));
        assertEquals(1L, map.boundaries().stream()
                .filter(boundary -> boundary.topologyRef().id() == 31L)
                .count());
        assertTrue(map.features().stream().anyMatch(feature -> feature.kind().equals("STAIR")
                && feature.label().equals("Treppe Alpha") && feature.destinationLabel().contains("Ausgang")));
        assertTrue(map.features().stream().anyMatch(feature -> feature.kind().equals("TRANSITION")
                && feature.description().equals("Zum Keller")
                && feature.destinationLabel().contains("unverbunden")));
        assertTrue(map.features().stream().anyMatch(feature -> feature.kind().equals("OBJECT")
                && feature.label().equals("Statue") && feature.description().equals("Sehr alt")));
        assertFalse(map.editorHandles().isEmpty());
        assertEquals(1L, map.editorHandles().stream()
                .filter(handle -> handle.ref().kind() == features.dungeon.api.DungeonEditorHandleKind.DOOR)
                .filter(handle -> handle.ref().topologyRef().id() == 31L)
                .filter(handle -> handle.ref().corridorId() == 21L)
                .count());
    }

    private static void assertOriginRing(List<DungeonChunkKey> chunks, long mapId) {
        assertEquals(9, chunks.size());
        for (int r = -1; r <= 1; r++) {
            for (int q = -1; q <= 1; q++) {
                assertTrue(chunks.contains(new DungeonChunkKey(mapId, 0, q, r)));
            }
        }
    }

    private static final class Catalog implements DungeonCatalogStore {
        @Override
        public List<DungeonMapHeader> search(String query) {
            return List.of(
                    new DungeonMapHeader(new DungeonMapIdentity(1L), "Alpha", 7L),
                    new DungeonMapHeader(new DungeonMapIdentity(2L), "Beta", 8L));
        }

        @Override
        public DungeonMapHeader create(String mapName) {
            throw new UnsupportedOperationException();
        }

        @Override
        public DungeonMapHeader rename(DungeonMapIdentity mapId, String mapName) {
            throw new UnsupportedOperationException();
        }

        @Override
        public void delete(DungeonMapIdentity mapId) {
            throw new UnsupportedOperationException();
        }
    }

    private static final class FailFastRepository implements DungeonMapRepository {
        private int findByIdCalls;
        private int firstMapCalls;

        @Override public long nextStairId() { return 1L; }
        @Override public long nextTransitionId() { return 1L; }
        @Override public Optional<DungeonMap> findById(DungeonMapIdentity mapId) {
            findByIdCalls++;
            throw new AssertionError("cold Editor route hydrated the whole map");
        }
        @Override public Optional<DungeonMap> firstMap() {
            firstMapCalls++;
            throw new AssertionError("cold Editor route hydrated the first whole map");
        }
    }

    private static final class CountingRepository implements DungeonMapRepository {
        private final DungeonMap aggregate = DungeonMapAuthoring.empty(new DungeonMapIdentity(1L), "Alpha");
        private int findByIdCalls;
        private int firstMapCalls;

        @Override public long nextStairId() { return 1L; }
        @Override public long nextTransitionId() { return 1L; }
        @Override public Optional<DungeonMap> findById(DungeonMapIdentity mapId) {
            findByIdCalls++;
            return mapId.value() == 1L ? Optional.of(aggregate) : Optional.empty();
        }
        @Override public Optional<DungeonMap> firstMap() {
            firstMapCalls++;
            return Optional.of(aggregate);
        }
    }

    private static final class RevisionedRepository implements DungeonMapRepository {
        private DungeonMap aggregate = withRevision(
                DungeonMapAuthoring.empty(new DungeonMapIdentity(1L), "Alpha"),
                7L);

        @Override public long nextStairId() { return 1L; }
        @Override public long nextTransitionId() { return 1L; }
        @Override public Optional<DungeonMap> findById(DungeonMapIdentity mapId) {
            return mapId.value() == 1L ? Optional.of(aggregate) : Optional.empty();
        }
        @Override public Optional<DungeonMap> firstMap() { return Optional.of(aggregate); }
        private static DungeonMap withRevision(DungeonMap map, long revision) {
            return new DungeonMap(
                    map.metadata(),
                    map.topology(),
                    map.topologyIndex(),
                    map.rooms(),
                    map.corridors(),
                    map.stairs(),
                    map.transitionCatalog(),
                    map.featureMarkers(),
                    revision);
        }
    }

    private static final class RecordingWindowStore implements DungeonWindowStore {
        private final List<DungeonWindowRequest> requests = new ArrayList<>();
        private final SecondWindowMode secondWindowMode;

        private RecordingWindowStore() {
            this(SecondWindowMode.NORMAL);
        }

        private RecordingWindowStore(SecondWindowMode secondWindowMode) {
            this.secondWindowMode = secondWindowMode;
        }

        @Override
        public Optional<DungeonWindow> loadWindow(DungeonWindowRequest request) {
            requests.add(request);
            if (request.mapId().value() == 2L && secondWindowMode == SecondWindowMode.MISSING) {
                return Optional.empty();
            }
            long revision = request.mapId().value() == 1L ? 7L : 8L;
            DungeonChunkKey origin = new DungeonChunkKey(request.mapId().value(), 0, 0, 0);
            List<DungeonWindowEntityFragment> fragments = fragments(origin);
            DungeonMapIdentity resultMapId = request.mapId().value() == 2L
                    && secondWindowMode == SecondWindowMode.MISMATCHED_MAP
                    ? new DungeonMapIdentity(1L)
                    : request.mapId();
            long resultGeneration = request.mapId().value() == 2L
                    && secondWindowMode == SecondWindowMode.STALE_GENERATION
                    ? request.requestGeneration() - 1L
                    : request.requestGeneration();
            return Optional.of(new DungeonWindow(
                    new DungeonMapHeader(resultMapId, request.mapId().value() == 1L ? "Alpha" : "Beta", revision),
                    resultGeneration,
                    request.chunkKeys().stream().map(key -> new DungeonWindowChunkHeader(key, revision)).toList(),
                    fragments,
                    List.of(new DungeonWindowContinuation(
                            DungeonPatchEntityRef.corridor(21L),
                            List.of(new DungeonChunkKey(request.mapId().value(), 0, 2, 0))))));
        }

        @Override
        public DungeonIdentityClosureResult loadIdentityClosure(DungeonIdentityClosureRequest request) {
            return new DungeonIdentityClosureResult.Rejected(
                    DungeonIdentityClosureResult.Reason.ENTITY_MISSING,
                    request.entityRefs());
        }

        private static List<DungeonWindowEntityFragment> fragments(DungeonChunkKey origin) {
            List<DungeonChunkKey> chunks = List.of(origin);
            var room = new DungeonWindowEntityFragment.Room(
                    DungeonPatchEntityRef.room(11L), 12L, "Raum Alpha", "Feuchte Wände",
                    List.of(new Cell(1, 1, 0), new Cell(2, 1, 0)),
                    List.of(new DungeonWindowEntityFragment.RoomExitFact(
                            new Cell(2, 1, 0), Direction.EAST, "Zum Gang")),
                    chunks, List.of(DungeonPatchEntityRef.roomCluster(12L)));
            var cluster = new DungeonWindowEntityFragment.RoomCluster(
                    DungeonPatchEntityRef.roomCluster(12L), "Cluster Alpha",
                    List.of(
                            new DungeonWindowEntityFragment.ClusterMemberCellFact(11L, "Raum Alpha", new Cell(1, 1, 0)),
                            new DungeonWindowEntityFragment.ClusterMemberCellFact(11L, "Raum Alpha", new Cell(2, 1, 0))),
                    List.of(new DungeonWindowEntityFragment.ClusterBoundaryFact(
                            new Cell(2, 1, 0), Direction.EAST,
                            DungeonWindowEntityFragment.BoundaryKind.DOOR,
                            DungeonTopologyRef.door(31L))),
                    chunks, List.of(DungeonPatchEntityRef.room(11L)));
            var corridor = new DungeonWindowEntityFragment.Corridor(
                    DungeonPatchEntityRef.corridor(21L), 0, List.of(11L),
                    List.of(new DungeonWindowEntityFragment.CorridorWaypointFact(
                            1, 12L, new Cell(3, 1, 0), new Cell(3, 1, 0))),
                    List.of(new DungeonWindowEntityFragment.CorridorDoorFact(
                            0, 11L, 12L, new Cell(2, 1, 0), new Cell(2, 1, 0),
                            Direction.EAST, DungeonTopologyRef.door(31L))),
                    List.of(), List.of(),
                    List.of(
                            new DungeonWindowEntityFragment.CorridorRouteCellFact(0, 0, new Cell(3, 1, 0))),
                    chunks, List.of(DungeonPatchEntityRef.room(11L)));
            var stair = new DungeonWindowEntityFragment.Stair(
                    DungeonPatchEntityRef.stair(41L), "Treppe Alpha", StairShape.STRAIGHT,
                    Direction.NORTH, 2, 1, null,
                    List.of(new DungeonWindowEntityFragment.StairPathFact(0, new Cell(4, 4, 0))),
                    List.of(new DungeonWindowEntityFragment.StairExitFact(42L, new Cell(4, 4, 0), "Ausgang z=0")),
                    chunks, List.of());
            var transition = new DungeonWindowEntityFragment.Transition(
                    DungeonPatchEntityRef.transition(51L), "Zum Keller",
                    TransitionAnchor.cell(new Cell(5, 5, 0)), TransitionDestination.unlinkedEntrance(),
                    null, chunks, List.of());
            var marker = new DungeonWindowEntityFragment.FeatureMarker(
                    DungeonPatchEntityRef.featureMarker(61L), FeatureMarkerKind.OBJECT,
                    new Cell(6, 6, 0), "Statue", "Sehr alt", chunks, List.of());
            return List.of(room, cluster, corridor, stair, transition, marker);
        }
    }

    private enum SecondWindowMode {
        NORMAL,
        MISSING,
        STALE_GENERATION,
        MISMATCHED_MAP
    }

    private static final class EmptyPartyRepository implements PartyRosterRepository {
        private PartyRoster roster = new PartyRoster(1L, List.of());
        @Override public PartyRoster load() { return roster; }
        @Override public void save(PartyRoster roster) { this.roster = roster; }
    }

    private static final class RecordingExecutionLane implements ExecutionLane {
        private Runnable pending;

        @Override
        public void execute(Runnable work) {
            if (pending != null) {
                throw new IllegalStateException("only one pending viewport read is expected");
            }
            pending = work;
        }

        void runPending() {
            Runnable work = pending;
            pending = null;
            if (work == null) {
                throw new IllegalStateException("no viewport read was scheduled");
            }
            work.run();
        }

        @Override
        public void close() {
        }
    }
}
