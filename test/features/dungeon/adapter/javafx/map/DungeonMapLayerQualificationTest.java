package features.dungeon.adapter.javafx.map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import features.dungeon.api.DungeonCellRef;
import features.dungeon.api.DungeonEditorMapSnapshot;
import features.dungeon.api.DungeonEditorPreview;
import features.dungeon.api.DungeonEditorStateSnapshot;
import features.dungeon.api.DungeonEditorSurface;
import features.dungeon.api.DungeonMapId;
import features.dungeon.api.DungeonMapSnapshot;
import features.dungeon.api.DungeonMapSummary;
import features.dungeon.api.DungeonOverlaySettings;
import features.dungeon.api.DungeonTopologyElementKind;
import features.dungeon.api.DungeonTopologyElementRef;
import features.dungeon.api.DungeonTravelContextKind;
import features.dungeon.api.DungeonTravelHeading;
import features.dungeon.api.DungeonTravelLocationKind;
import features.dungeon.api.DungeonTravelPosition;
import features.dungeon.api.DungeonTravelSurfaceSnapshot;
import features.dungeon.api.DungeonEditorViewMode;
import features.dungeon.api.TravelDungeonSnapshot;
import features.dungeon.api.editor.DungeonEditorDraftState;
import features.dungeon.api.editor.DungeonEditorState;
import features.dungeon.api.editor.DungeonEditorToolSelection;
import features.dungeon.qualification.DungeonRuntimeQualificationProtocol;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import javafx.application.Platform;
import javafx.scene.Scene;
import org.junit.jupiter.api.Test;
import platform.ui.mapcanvas.MapCanvasLayer;
import platform.ui.mapcanvas.MapCanvasPaintSample;

final class DungeonMapLayerQualificationTest {

    @Test
    void cameraHoverPreviewAndActorUseIndependentPhysicalPaintRoutes() throws Exception {
        runOnFxThread(() -> {
            List<MapCanvasPaintSample> samples = new ArrayList<>();
            DungeonMapContentModel editorModel = new DungeonMapContentModel("Qualification", true);
            DungeonMapView editorView = mountedView(editorModel, samples);
            DungeonEditorState stable = editorState(DungeonEditorPreview.none(), 1L);
            editorModel.applyEditorState(stable);
            samples.clear();

            var camera = DungeonRuntimeQualificationProtocol.measureAlternating(index ->
                    editorModel.panByPixels((index & 1) == 0 ? 1.0 : -1.0, 0.0));
            record("camera", camera);
            assertTrue(camera.p95() <= DungeonRuntimeQualificationProtocol.CAMERA_P95_NANOS,
                    "camera p95=" + camera.p95());
            assertLayerCount(samples, MapCanvasLayer.BASE, 120);
            assertLayerCount(samples, MapCanvasLayer.INTERACTION, 120);
            assertLayerCount(samples, MapCanvasLayer.ACTOR, 120);

            var roomTarget = editorModel.pointerTargetsAt(0.5, 0.5).getFirst();
            samples.clear();
            var hover = DungeonRuntimeQualificationProtocol.measureAlternating(index -> {
                if ((index & 1) == 0) {
                    editorModel.updateHoverTarget(roomTarget);
                } else {
                    editorModel.clearHoverTarget();
                }
            });
            record("hover", hover);
            assertTrue(hover.p95() <= DungeonRuntimeQualificationProtocol.HOVER_P95_NANOS,
                    "hover p95=" + hover.p95());
            assertOnlyLayer(samples, MapCanvasLayer.INTERACTION, 120);

            samples.clear();
            var preview = DungeonRuntimeQualificationProtocol.measureAlternating(index ->
                    editorModel.applyEditorState(editorState(
                            new DungeonEditorPreview.StairCreatePreview(
                                    new DungeonCellRef(2, 2, 0),
                                    new DungeonCellRef((index & 1) == 0 ? 2 : 3, 2, 0),
                                    "STRAIGHT",
                                    false,
                                    "preview"),
                            index + 2L)));
            record("preview", preview);
            assertTrue(preview.p95() <= DungeonRuntimeQualificationProtocol.PREVIEW_P95_NANOS,
                    "preview p95=" + preview.p95());
            assertOnlyLayer(samples, MapCanvasLayer.INTERACTION, 120);

            List<MapCanvasPaintSample> actorSamples = new ArrayList<>();
            DungeonMapContentModel travelModel = new DungeonMapContentModel("Travel", false);
            DungeonMapView travelView = mountedView(travelModel, actorSamples);
            travelModel.applyTravelSnapshot(travelSnapshot(0));
            actorSamples.clear();
            DungeonRuntimeQualificationProtocol.measureAlternating(index ->
                    travelModel.applyTravelSnapshot(travelSnapshot((index & 1) == 0 ? 1 : 0)));
            assertOnlyLayer(actorSamples, MapCanvasLayer.ACTOR, 120);

            assertStablePhysicalLayers(editorView);
            assertStablePhysicalLayers(travelView);
        });
    }

    private static DungeonMapView mountedView(
            DungeonMapContentModel model,
            List<MapCanvasPaintSample> samples
    ) {
        DungeonMapView view = new DungeonMapView();
        view.onPaintSample(samples::add);
        view.bind(model);
        new Scene(view, 960.0, 640.0);
        view.applyCss();
        view.layout();
        return view;
    }

    private static DungeonEditorState editorState(DungeonEditorPreview preview, long revision) {
        DungeonMapId mapId = new DungeonMapId(1L);
        DungeonTopologyElementRef roomRef = new DungeonTopologyElementRef(
                DungeonTopologyElementKind.ROOM, 1L);
        DungeonEditorMapSnapshot map = new DungeonEditorMapSnapshot(
                "SQUARE", 1, 1,
                List.of(new DungeonEditorMapSnapshot.Area(
                        "ROOM", 1L, 1L, "Room", List.of(new DungeonCellRef(0, 0, 0)), roomRef)),
                List.of(), List.of(), List.of());
        return new DungeonEditorState(
                revision, revision, List.of(new DungeonMapSummary(mapId, "Qualification", revision)),
                mapId, new DungeonEditorSurface("Qualification", (int) revision, map, null, null),
                DungeonEditorViewMode.GRID, DungeonEditorToolSelection.select(),
                DungeonOverlaySettings.defaults(), 0, List.of(0),
                DungeonEditorStateSnapshot.Selection.empty(), DungeonEditorDraftState.empty(),
                preview, null, DungeonEditorState.CommandStatus.idle());
    }

    private static TravelDungeonSnapshot travelSnapshot(int q) {
        DungeonTravelSurfaceSnapshot surface = new DungeonTravelSurfaceSnapshot(
                DungeonTravelContextKind.DUNGEON, "Travel", 1, DungeonMapSnapshot.empty(),
                new DungeonTravelPosition(new DungeonMapId(1L), DungeonTravelLocationKind.TILE, 0L,
                        new DungeonCellRef(q, 0, 0), DungeonTravelHeading.defaultHeading()),
                "Travel", "Area", "Tile", "", "", "", List.of());
        return new TravelDungeonSnapshot(null, surface, DungeonOverlaySettings.defaults(), 0);
    }

    private static void assertOnlyLayer(
            List<MapCanvasPaintSample> samples,
            MapCanvasLayer layer,
            int count
    ) {
        assertEquals(count, samples.size());
        assertTrue(samples.stream().allMatch(sample -> sample.layer() == layer));
    }

    private static void assertLayerCount(
            List<MapCanvasPaintSample> samples,
            MapCanvasLayer layer,
            int count
    ) {
        assertEquals(count, samples.stream().filter(sample -> sample.layer() == layer).count());
    }

    private static void assertStablePhysicalLayers(DungeonMapView view) {
        assertEquals(3, view.physicalCanvasCount());
        assertFalse(view.physicalCanvas(MapCanvasLayer.BASE).isMouseTransparent());
        assertTrue(view.physicalCanvas(MapCanvasLayer.BASE).isFocusTraversable());
        assertTrue(view.physicalCanvas(MapCanvasLayer.INTERACTION).isMouseTransparent());
        assertTrue(view.physicalCanvas(MapCanvasLayer.ACTOR).isMouseTransparent());
    }

    private static void record(
            String scenario,
            DungeonRuntimeQualificationProtocol.Histogram histogram
    ) {
        System.out.println("M5.4 layer " + scenario
                + " samples=" + histogram.samples()
                + " min=" + histogram.minimum()
                + " p50=" + histogram.p50()
                + " p95=" + histogram.p95()
                + " max=" + histogram.maximum());
    }

    private static void runOnFxThread(Runnable action) throws Exception {
        CountDownLatch latch = new CountDownLatch(1);
        Throwable[] failure = new Throwable[1];
        testsupport.JavaFxRuntime.startup(() -> {
            try {
                Platform.setImplicitExit(false);
                action.run();
            } catch (Throwable throwable) {
                failure[0] = throwable;
            } finally {
                latch.countDown();
            }
        });
        assertTrue(latch.await(60, TimeUnit.SECONDS));
        if (failure[0] != null) {
            throw new AssertionError(failure[0]);
        }
    }
}
