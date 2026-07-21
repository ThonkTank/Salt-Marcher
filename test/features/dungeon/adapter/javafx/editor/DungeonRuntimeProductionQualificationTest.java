package features.dungeon.adapter.javafx.editor;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import features.dungeon.DungeonTestAssembly;
import features.dungeon.adapter.javafx.map.DungeonMapContentModel;
import features.dungeon.adapter.javafx.map.DungeonMapView;
import features.dungeon.adapter.javafx.travel.DungeonTravelContribution;
import features.dungeon.adapter.sqlite.gateway.DungeonSparseQualificationFixture;
import features.dungeon.adapter.sqlite.repository.SqliteDungeonCatalogStore;
import features.dungeon.adapter.sqlite.repository.SqliteDungeonIdentityAllocator;
import features.dungeon.adapter.sqlite.repository.SqliteDungeonUnitOfWork;
import features.dungeon.adapter.sqlite.repository.SqliteDungeonWindowStore;
import features.dungeon.api.DungeonMapId;
import features.dungeon.api.editor.DungeonEditorApi;
import features.dungeon.api.editor.DungeonEditorIntent;
import features.dungeon.api.editor.DungeonEditorToolFamily;
import features.dungeon.api.editor.DungeonEditorToolSelection;
import features.dungeon.api.travel.DungeonTravelApi;
import features.dungeon.application.authored.DungeonCachedWindowStore;
import features.dungeon.application.editor.DungeonEditorFeatureRuntimeRoot;
import features.dungeon.application.editor.DungeonEditorRuntimeDependencies;
import features.dungeon.qualification.DungeonQualificationDataset;
import features.dungeon.qualification.DungeonRuntimeQualificationProtocol;
import features.dungeon.qualification.DungeonRuntimeQualificationProtocol.Histogram;
import features.dungeon.qualification.DungeonRuntimeWorkProbe;
import features.dungeon.qualification.DungeonRuntimeWorkProbe.Snapshot;
import features.party.PartyServiceAssembly;
import features.party.domain.roster.PartyRoster;
import features.party.domain.roster.repository.PartyRosterRepository;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import javafx.application.Platform;
import javafx.scene.Node;
import javafx.scene.Scene;
import javafx.scene.input.MouseButton;
import javafx.scene.input.MouseEvent;
import javafx.scene.layout.HBox;
import javafx.stage.Stage;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import platform.diagnostics.NoopDiagnostics;
import platform.execution.DirectExecutionLane;
import platform.persistence.FeatureStoreHandle;
import platform.persistence.SqliteDatabase;
import platform.ui.DirectUiDispatcher;
import platform.ui.mapcanvas.MapCanvasLayer;
import platform.ui.mapcanvas.MapCanvasPaintSample;
import shell.api.ShellBinding;
import shell.api.ShellSlot;

/** Production-route qualification over equal visible work and growing off-window truth. */
final class DungeonRuntimeProductionQualificationTest {
    private static final int MAX_VISIBLE_PLUS_RING_CHUNKS = 9;
    private static final long MAX_COLD_INDEX_CALLS = 8L;
    private static final long MAX_COLD_CONTENT_CALLS = 9L;
    private static final long MAX_COLD_HYDRATED_ENTITIES = 18L;
    private static final long MAX_COLD_REQUESTED_CHUNKS = 72L;
    private static final long MAX_OPERATION_INDEX_CALLS = 4L;
    private static final long MAX_OPERATION_CONTENT_CALLS = 2L;
    private static final long MAX_OPERATION_CLOSURE_CALLS = 2L;
    private static final long MAX_OPERATION_UOW_CALLS = 1L;
    private static final long MAX_OPERATION_HYDRATED_ENTITIES = 12L;
    private static final long MAX_OPERATION_REQUESTED_CHUNKS = 36L;
    private static final long MAX_OPERATION_RELOADED_CHUNKS = 9L;
    private static final long MAX_OPERATION_TOUCHED_CHUNKS = 9L;

    @Test
    void runtimeWorkAndPaintRemainBoundedAcrossSparse1k10k100k(@TempDir Path tempDir) throws Exception {
        Map<DungeonQualificationDataset, QualificationEvidence> evidence =
                new EnumMap<>(DungeonQualificationDataset.class);
        for (DungeonQualificationDataset dataset : DungeonQualificationDataset.values()) {
            Path databasePath = tempDir.resolve(dataset.name().toLowerCase() + ".db");
            try (SqliteDatabase database = new SqliteDatabase(databasePath, NoopDiagnostics.INSTANCE)) {
                FeatureStoreHandle dungeonStore =
                        DungeonSparseQualificationFixture.seedRuntime(database, databasePath, dataset);
                evidence.put(dataset, runOnFxThread(() -> qualify(dungeonStore, dataset)));
            }
        }

        List<WorkEnvelope> comparableWork = evidence.values().stream()
                .map(QualificationEvidence::work)
                .toList();
        assertEquals(1L, comparableWork.stream().distinct().count(),
                "1k, 10k and 100k must execute identical visible production-route work");
        List<PaintEnvelope> comparablePaint = evidence.values().stream()
                .map(QualificationEvidence::paint)
                .toList();
        assertEquals(1L, comparablePaint.stream().distinct().count(),
                "1k, 10k and 100k must visit and paint identical visible primitives");
    }

    private static QualificationEvidence qualify(
            FeatureStoreHandle dungeonStore,
            DungeonQualificationDataset dataset
    ) {
        DungeonRuntimeWorkProbe probe = new DungeonRuntimeWorkProbe();
        Snapshot beforeCold = probe.snapshot();
        long coldStarted = System.nanoTime();
        DungeonCachedWindowStore windowStore = new DungeonCachedWindowStore(
                probe.count(new SqliteDungeonWindowStore(dungeonStore)));
        PartyServiceAssembly.Component party = PartyServiceAssembly.create(new EmptyPartyRosterRepository());
        DungeonTestAssembly.Component dungeon = DungeonTestAssembly.create(
                new SqliteDungeonCatalogStore(dungeonStore),
                windowStore,
                probe.count(new SqliteDungeonUnitOfWork(dungeonStore)),
                new SqliteDungeonIdentityAllocator(dungeonStore),
                party.activeParty(),
                party.travelPositions(),
                party.application(),
                party.mutation(),
                DirectExecutionLane.INSTANCE,
                DirectUiDispatcher.INSTANCE,
                NoopDiagnostics.INSTANCE);
        DungeonEditorRuntimeDependencies dependencies = new DungeonEditorRuntimeDependencies(
                dungeon.editor(),
                new features.dungeon.domain.core.structure.corridor.OrthogonalCorridorRoutingPolicy(),
                dungeon.authored()::currentWindowRequestGeneration,
                DirectExecutionLane.INSTANCE,
                DirectUiDispatcher.INSTANCE);
        DungeonEditorApi editorApi = DungeonEditorFeatureRuntimeRoot.create(dependencies);
        ShellBinding editorBinding = new DungeonEditorContribution(editorApi).bind();
        DungeonMapView editorView = DungeonEditorTestSupport.slot(
                editorBinding, ShellSlot.COCKPIT_MAIN, DungeonMapView.class);
        DungeonMapContentModel editorModel = DungeonEditorTestSupport.boundContentModel(editorBinding);
        List<MapCanvasPaintSample> editorPaint = new ArrayList<>();
        editorView.onPaintSample(editorPaint::add);
        Stage editorStage = mount(editorBinding, 960.0, 640.0);
        editorModel.panByPixels(-512.0, -512.0);
        editorApi.dispatch(new DungeonEditorIntent.SelectMap(
                new DungeonMapId(DungeonQualificationDataset.MAP_ID)));
        long coldNanos = System.nanoTime() - coldStarted;
        System.out.println("dungeon-runtime " + dataset + " cold samples=[" + coldNanos + "]"
                + " min=" + coldNanos + " p50=" + coldNanos
                + " p95=" + coldNanos + " max=" + coldNanos);
        Snapshot cold = probe.snapshot().subtract(beforeCold);
        assertColdBounds(cold);

        List<Snapshot> cameraWork = new ArrayList<>();
        editorModel.panByPixels(16.0, 16.0);
        editorPaint.clear();
        Histogram camera = DungeonRuntimeQualificationProtocol.measureAlternating(index -> {
            Snapshot before = probe.snapshot();
            double startX = 480.0;
            double endX = startX + ((index & 1) == 0 ? 1.0 : -1.0);
            DungeonEditorTestSupport.fireMapMouse(
                    editorView, MouseEvent.MOUSE_PRESSED, MouseButton.MIDDLE, startX, 320.0, false);
            DungeonEditorTestSupport.fireMapMouse(
                    editorView, MouseEvent.MOUSE_DRAGGED, MouseButton.MIDDLE, endX, 320.0, false);
            DungeonEditorTestSupport.fireMapMouse(
                    editorView, MouseEvent.MOUSE_RELEASED, MouseButton.MIDDLE, endX, 320.0, false);
            cameraWork.add(probe.snapshot().subtract(before));
        });
        record(dataset, "camera", camera);
        PaintWork cameraPaint = PaintWork.from(editorPaint);
        System.out.println("dungeon-runtime " + dataset + " camera paint=" + cameraPaint);
        System.out.println("dungeon-runtime " + dataset + " camera work=" + WorkMaximum.from(cameraWork));
        assertTrue(camera.p95() <= DungeonRuntimeQualificationProtocol.CAMERA_P95_NANOS,
                dataset + " camera p95=" + camera.p95());

        List<Snapshot> hoverWork = new ArrayList<>();
        editorPaint.clear();
        for (int index = 0; index < DungeonRuntimeQualificationProtocol.WARMUP_SAMPLES
                + DungeonRuntimeQualificationProtocol.MEASURED_SAMPLES; index++) {
            Snapshot before = probe.snapshot();
            DungeonMapContentModel.Viewport viewport = editorModel.currentViewport();
            double scene = (index & 1) == 0 ? 2.5 : 1.5;
            DungeonEditorTestSupport.fireMapMouse(
                    editorView, MouseEvent.MOUSE_MOVED, MouseButton.NONE,
                    viewport.sceneToScreenX(scene), viewport.sceneToScreenY(scene), false);
            Snapshot work = probe.snapshot().subtract(before);
            assertEquals(0L, work.repositoryCalls(), dataset + " hover repository I/O");
            hoverWork.add(work);
        }
        assertOnlyLayer(editorPaint, MapCanvasLayer.INTERACTION, "hover");
        PaintWork hoverPaint = PaintWork.from(editorPaint);

        editorApi.dispatch(new DungeonEditorIntent.SetTool(
                DungeonEditorToolSelection.family(DungeonEditorToolFamily.ROOM)));
        DungeonMapContentModel.Viewport previewViewport = editorModel.currentViewport();
        DungeonEditorTestSupport.fireMapMouse(
                editorView, MouseEvent.MOUSE_PRESSED, MouseButton.PRIMARY,
                previewViewport.sceneToScreenX(3.1), previewViewport.sceneToScreenY(3.1), false);
        List<Snapshot> previewWork = new ArrayList<>();
        editorPaint.clear();
        Histogram preview = DungeonRuntimeQualificationProtocol.measureAlternating(index -> {
            Snapshot before = probe.snapshot();
            DungeonMapContentModel.Viewport viewport = editorModel.currentViewport();
            double scene = (index & 1) == 0 ? 4.9 : 5.9;
            DungeonEditorTestSupport.fireMapMouse(
                    editorView, MouseEvent.MOUSE_DRAGGED, MouseButton.PRIMARY,
                    viewport.sceneToScreenX(scene), viewport.sceneToScreenY(scene), false);
            if (index == 0) {
                assertTrue(editorApi.current().preview()
                                instanceof features.dungeon.api.DungeonEditorPreview.RoomRectanglePreview,
                        dataset + " public preview route state=" + editorApi.current());
            }
            Snapshot work = probe.snapshot().subtract(before);
            assertEquals(0L, work.repositoryCalls(), dataset + " preview repository I/O");
            previewWork.add(work);
        });
        record(dataset, "preview", preview);
        assertTrue(preview.p95() <= DungeonRuntimeQualificationProtocol.PREVIEW_P95_NANOS,
                dataset + " preview p95=" + preview.p95());
        assertExactlyOneLayerPerInput(editorPaint, MapCanvasLayer.INTERACTION, "preview");
        PaintWork previewPaint = PaintWork.from(editorPaint);
        editorApi.dispatch(DungeonEditorIntent.CancelPreview.INSTANCE);

        List<Snapshot> commitWork = new ArrayList<>();
        Histogram commit = DungeonRuntimeQualificationProtocol.measureAlternating(index -> {
            Snapshot before = probe.snapshot();
            commitAlternating(editorApi, editorView, editorModel, index);
            commitWork.add(probe.snapshot().subtract(before));
        });
        record(dataset, "commit", commit);

        List<Snapshot> undoWork = new ArrayList<>();
        Histogram undo = DungeonRuntimeQualificationProtocol.measureAlternating(
                index -> createFeatureMarker(editorApi, editorView, editorModel),
                index -> {
                    Snapshot before = probe.snapshot();
                    editorApi.dispatch(DungeonEditorIntent.Undo.INSTANCE);
                    undoWork.add(probe.snapshot().subtract(before));
                });
        record(dataset, "undo", undo);

        DungeonTravelApi travelApi = probe.count(dungeon.travel());
        ShellBinding travelBinding = new DungeonTravelContribution(
                travelApi, dungeon.mapCatalog(), dungeon.travelModel()).bind();
        DungeonMapView travelView = DungeonEditorTestSupport.slot(
                travelBinding, ShellSlot.COCKPIT_MAIN, DungeonMapView.class);
        Stage travelStage = mount(travelBinding, 960.0, 640.0);
        travelApi.selectMap(DungeonQualificationDataset.MAP_ID);
        List<Snapshot> travelWork = new ArrayList<>();
        Histogram travel = DungeonRuntimeQualificationProtocol.measureAlternating(index -> {
            Snapshot before = probe.snapshot();
            travelApi.refresh();
            travelWork.add(probe.snapshot().subtract(before));
        });
        record(dataset, "travel-refresh", travel);

        WorkEnvelope work = new WorkEnvelope(
                cold,
                WorkMaximum.from(cameraWork),
                WorkMaximum.from(hoverWork),
                WorkMaximum.from(previewWork),
                WorkMaximum.from(commitWork),
                WorkMaximum.from(undoWork),
                WorkMaximum.from(travelWork));
        List.of(cameraWork, hoverWork, previewWork, commitWork, undoWork, travelWork).stream()
                .flatMap(List::stream)
                .forEach(DungeonRuntimeProductionQualificationTest::assertChunkWorkBound);
        assertOperationBounds(work);
        PaintEnvelope paint = new PaintEnvelope(cameraPaint, hoverPaint, previewPaint);
        assertTrue(dataset.qualificationViewport(1L).loadingChunks().size() <= MAX_VISIBLE_PLUS_RING_CHUNKS,
                dataset + " visible-plus-ring chunk count");
        assertEquals(120, camera.samples().size() + DungeonRuntimeQualificationProtocol.WARMUP_SAMPLES);
        assertEquals(120, preview.samples().size() + DungeonRuntimeQualificationProtocol.WARMUP_SAMPLES);
        editorStage.close();
        travelStage.close();
        return new QualificationEvidence(work, paint);
    }

    private static void commitAlternating(
            DungeonEditorApi api,
            DungeonMapView view,
            DungeonMapContentModel model,
            int index
    ) {
        if ((index & 1) == 0) {
            createFeatureMarker(api, view, model);
            return;
        }
        api.dispatch(new DungeonEditorIntent.SetTool(
                DungeonEditorToolSelection.family(DungeonEditorToolFamily.FEATURE)));
        DungeonMapContentModel.Viewport viewport = model.currentViewport();
        DungeonEditorTestSupport.fireMapMouse(
                view, MouseEvent.MOUSE_PRESSED, MouseButton.SECONDARY,
                viewport.sceneToScreenX(6.5), viewport.sceneToScreenY(6.5), false);
    }

    private static void createFeatureMarker(
            DungeonEditorApi api,
            DungeonMapView view,
            DungeonMapContentModel model
    ) {
        api.dispatch(new DungeonEditorIntent.SetTool(
                DungeonEditorToolSelection.family(DungeonEditorToolFamily.FEATURE)));
        DungeonMapContentModel.Viewport viewport = model.currentViewport();
        DungeonEditorTestSupport.fireMapMouse(
                view, MouseEvent.MOUSE_PRESSED, MouseButton.PRIMARY,
                viewport.sceneToScreenX(6.5), viewport.sceneToScreenY(6.5), false);
    }

    private static Stage mount(ShellBinding binding, double width, double height) {
        Node controls = binding.slotContent().get(ShellSlot.COCKPIT_CONTROLS);
        Node main = binding.slotContent().get(ShellSlot.COCKPIT_MAIN);
        Node state = binding.slotContent().get(ShellSlot.COCKPIT_STATE);
        Stage stage = new Stage();
        HBox root = new HBox(controls, main, state);
        stage.setScene(new Scene(root, width, height));
        stage.show();
        root.applyCss();
        root.layout();
        return stage;
    }

    private static void assertColdBounds(Snapshot cold) {
        assertTrue(cold.indexCalls() <= MAX_COLD_INDEX_CALLS, "cold index calls=" + cold.indexCalls());
        assertTrue(cold.contentCalls() <= MAX_COLD_CONTENT_CALLS, "cold content calls=" + cold.contentCalls());
        assertTrue(cold.hydratedEntities() <= MAX_COLD_HYDRATED_ENTITIES,
                "cold hydrated entities=" + cold.hydratedEntities());
        assertTrue(cold.requestedChunks() <= MAX_COLD_REQUESTED_CHUNKS,
                "cold requested chunks=" + cold.requestedChunks());
        assertTrue(cold.reloadedChunks() <= MAX_VISIBLE_PLUS_RING_CHUNKS,
                "cold reloaded chunks=" + cold.reloadedChunks());
        assertChunkWorkBound(cold);
    }

    private static void assertChunkWorkBound(Snapshot work) {
        assertTrue(work.requestedChunks()
                        <= (work.indexCalls() + work.travelChunkReads()) * MAX_VISIBLE_PLUS_RING_CHUNKS,
                "one index/Travel read may request at most nine chunks: " + work);
    }

    private static void assertOperationBounds(WorkEnvelope work) {
        for (WorkMaximum maximum : List.of(
                work.camera(), work.hover(), work.preview(), work.commit(), work.undo(), work.travelRefresh())) {
            assertTrue(maximum.indexCalls() <= MAX_OPERATION_INDEX_CALLS, "index calls=" + maximum);
            assertTrue(maximum.contentCalls() <= MAX_OPERATION_CONTENT_CALLS, "content calls=" + maximum);
            assertTrue(maximum.closureCalls() <= MAX_OPERATION_CLOSURE_CALLS, "closure calls=" + maximum);
            assertTrue(maximum.unitOfWorkCalls() <= MAX_OPERATION_UOW_CALLS, "UoW calls=" + maximum);
            assertTrue(maximum.hydratedEntities() <= MAX_OPERATION_HYDRATED_ENTITIES,
                    "hydrated entities=" + maximum);
            assertTrue(maximum.requestedChunks() <= MAX_OPERATION_REQUESTED_CHUNKS,
                    "requested chunks=" + maximum);
            assertTrue(maximum.reloadedChunks() <= MAX_OPERATION_RELOADED_CHUNKS,
                    "reloaded chunks=" + maximum);
            assertTrue(maximum.touchedChunks() <= MAX_OPERATION_TOUCHED_CHUNKS,
                    "touched chunks=" + maximum);
        }
        assertEquals(0L, work.hover().repositoryCalls());
        assertEquals(0L, work.preview().repositoryCalls());
        assertEquals(1L, work.travelRefresh().travelRefreshes());
    }

    private static void assertOnlyLayer(
            List<MapCanvasPaintSample> samples,
            MapCanvasLayer expected,
            String scenario
    ) {
        assertTrue(samples.stream().allMatch(sample -> sample.layer() == expected),
                scenario + " paints only " + expected);
    }

    private static void assertExactlyOneLayerPerInput(
            List<MapCanvasPaintSample> samples,
            MapCanvasLayer expected,
            String scenario
    ) {
        assertEquals(DungeonRuntimeQualificationProtocol.WARMUP_SAMPLES
                        + DungeonRuntimeQualificationProtocol.MEASURED_SAMPLES,
                samples.size(), scenario + " emits exactly one paint per input");
        assertOnlyLayer(samples, expected, scenario);
    }

    private static void record(
            DungeonQualificationDataset dataset,
            String scenario,
            Histogram histogram
    ) {
        System.out.println("dungeon-runtime " + dataset + " " + scenario
                + " samples=" + histogram.samples()
                + " min=" + histogram.minimum()
                + " p50=" + histogram.p50()
                + " p95=" + histogram.p95()
                + " max=" + histogram.maximum());
    }

    private static <T> T runOnFxThread(ThrowingSupplier<T> action) throws Exception {
        CountDownLatch latch = new CountDownLatch(1);
        Object[] result = new Object[1];
        Throwable[] failure = new Throwable[1];
        testsupport.JavaFxRuntime.startup(() -> {
            try {
                Platform.setImplicitExit(false);
                result[0] = action.get();
            } catch (Throwable throwable) {
                failure[0] = throwable;
            } finally {
                latch.countDown();
            }
        });
        assertTrue(latch.await(10, TimeUnit.MINUTES), "Dungeon runtime qualification timed out");
        if (failure[0] != null) {
            throw new AssertionError(failure[0]);
        }
        @SuppressWarnings("unchecked")
        T typed = (T) result[0];
        return typed;
    }

    @FunctionalInterface
    private interface ThrowingSupplier<T> {
        T get() throws Exception;
    }

    private static final class EmptyPartyRosterRepository implements PartyRosterRepository {
        private PartyRoster roster = new PartyRoster(1L, List.of());

        @Override
        public PartyRoster load() {
            return roster;
        }

        @Override
        public void save(PartyRoster roster) {
            this.roster = Objects.requireNonNull(roster, "roster");
        }
    }

    private record QualificationEvidence(WorkEnvelope work, PaintEnvelope paint) {
    }

    private record WorkEnvelope(
            Snapshot cold,
            WorkMaximum camera,
            WorkMaximum hover,
            WorkMaximum preview,
            WorkMaximum commit,
            WorkMaximum undo,
            WorkMaximum travelRefresh
    ) {
    }

    private record WorkMaximum(
            long indexCalls,
            long contentCalls,
            long closureCalls,
            long continuationCalls,
            long unitOfWorkCalls,
            long travelStartReads,
            long travelChunkReads,
            long travelRefreshes,
            long hydratedEntities,
            long requestedChunks,
            long reloadedChunks,
            long touchedChunks
    ) {
        static WorkMaximum from(List<Snapshot> samples) {
            return new WorkMaximum(
                    maximum(samples, Snapshot::indexCalls),
                    maximum(samples, Snapshot::contentCalls),
                    maximum(samples, Snapshot::closureCalls),
                    maximum(samples, Snapshot::continuationCalls),
                    maximum(samples, Snapshot::unitOfWorkCalls),
                    maximum(samples, Snapshot::travelStartReads),
                    maximum(samples, Snapshot::travelChunkReads),
                    maximum(samples, Snapshot::travelRefreshes),
                    maximum(samples, Snapshot::hydratedEntities),
                    maximum(samples, Snapshot::requestedChunks),
                    maximum(samples, Snapshot::reloadedChunks),
                    maximum(samples, Snapshot::touchedChunks));
        }

        long repositoryCalls() {
            return indexCalls + contentCalls + closureCalls + continuationCalls
                    + unitOfWorkCalls + travelStartReads + travelChunkReads;
        }

        private static long maximum(List<Snapshot> samples, java.util.function.ToLongFunction<Snapshot> value) {
            return samples.stream().mapToLong(value).max().orElse(0L);
        }
    }

    private record PaintEnvelope(PaintWork camera, PaintWork hover, PaintWork preview) {
    }

    private record PaintWork(
            long baseSamples,
            long interactionSamples,
            long actorSamples,
            long maximumVisited,
            long maximumPainted
    ) {
        static PaintWork from(List<MapCanvasPaintSample> samples) {
            return new PaintWork(
                    count(samples, MapCanvasLayer.BASE),
                    count(samples, MapCanvasLayer.INTERACTION),
                    count(samples, MapCanvasLayer.ACTOR),
                    samples.stream().mapToLong(MapCanvasPaintSample::visitedPrimitives).max().orElse(0L),
                    samples.stream().mapToLong(MapCanvasPaintSample::paintedPrimitives).max().orElse(0L));
        }

        private static long count(List<MapCanvasPaintSample> samples, MapCanvasLayer layer) {
            return samples.stream().filter(sample -> sample.layer() == layer).count();
        }
    }
}
