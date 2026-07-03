package src.view.leftbartabs.dungeoneditor;

import java.util.List;
import java.util.Optional;
import javafx.geometry.Point2D;
import javafx.scene.Parent;
import javafx.scene.control.ButtonBase;
import javafx.scene.input.MouseButton;
import src.domain.dungeon.published.DungeonEditorMapSurfaceSnapshot;
import src.domain.dungeon.published.DungeonEditorMapSnapshot;
import src.domain.dungeon.published.DungeonEditorStateSnapshot;
import src.domain.dungeon.published.DungeonEditorTopologyElementRef;
import src.features.dungeon.runtime.DungeonEditorRuntimePointerTarget;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel;
import src.view.slotcontent.main.dungeonmap.DungeonMapView;
import static src.view.leftbartabs.dungeoneditor.DungeonEditorBehaviorHarnessSupport.*;

final class DungeonEditorFeatureMarkerHarness {

    private static final String OWNER = "DungeonEditorFeatureMarkerHarness";

    private DungeonEditorFeatureMarkerHarness() {
    }

    static void run(List<String> results) throws Exception {
        route(results, () -> verifyFeatureControlsThroughControlsView(results));
        route(results, () -> verifyPoiCreateSelectionAndReloadThroughMapView(results));
        route(results, () -> verifyObjectAndEncounterProjectionThroughMapView(results));
        route(results, () -> verifyFeatureDeleteThroughMapView(results));
    }

    private static void route(
            List<String> results,
            DungeonEditorBehaviorHarnessSupport.ThrowingRunnable action
    ) throws Exception {
        DungeonEditorBehaviorHarnessSupport.runRouteProof(results, OWNER, action);
    }

    private static void verifyFeatureControlsThroughControlsView(List<String> results) {
        HarnessRuntime runtime = HarnessRuntime.create();
        HarnessBinding binding = bindHarness(runtime, 960.0, 700.0);
        DungeonEditorControlsView controls = binding.controls();

        long mapId = createMapThroughControls(controls, runtime, "Feature Controls Map");
        selectMap(controls, "Feature Controls Map");
        List<String> authoredStateBefore = runtime.database().authoredGeometryState(mapId);
        ButtonBase featureFamily = button(controls, "Feature");

        click(featureFamily);
        Parent dropdown = popupContainerWithSelected("POI");
        assertTrue(popupButtonVisible("POI"), "DE-FEATURE-001 first feature option is visible");
        assertTrue(popupButtonVisible("Objekt"), "DE-FEATURE-001 second feature option is visible");
        assertTrue(popupButtonVisible("Encounter"), "DE-FEATURE-001 third feature option is visible");
        assertTrue(!buttonVisible(controls, "POI"), "DE-FEATURE-001 POI is not a top-level family button");
        assertTrue(!buttonVisible(controls, "Objekt"), "DE-FEATURE-001 Objekt is not a top-level family button");
        assertTrue(!buttonVisible(controls, "Encounter"),
                "DE-FEATURE-001 Encounter is not a top-level family button");
        assertTrue(!buttonVisible(controls, "Feature löschen"),
                "DE-FEATURE-001 delete stays off the top-level family row");
        assertPopupAnchoredBelow(featureFamily, dropdown, "DE-FEATURE-001");
        assertPopupOptionSelected("POI", "DE-FEATURE-001 first option is preselected by default");
        assertEquals("FEATURE_POI_CREATE", runtime.controlsModel().current().selectedTool().name(),
                "DE-FEATURE-001 feature family activates the default POI create tool");
        assertTrue(featureFamily.getAccessibleText().contains("POI"),
                "DE-FEATURE-001 family button announces the selected feature option");
        assertEquals(authoredStateBefore, runtime.database().authoredGeometryState(mapId),
                "DE-FEATURE-001 leaves authored DB state unchanged");
        results.add("DE-FEATURE-001 Ready: DungeonEditorControlsView Feature -> anchored POI/Objekt/Encounter"
                + " dropdown with no top-level subactions");

        click(popupButton(dropdown, "Objekt"));
        assertEquals("FEATURE_OBJECT_CREATE", runtime.controlsModel().current().selectedTool().name(),
                "DE-FEATURE-002 selecting Objekt routes to object creation");
        assertTrue(featureFamily.getAccessibleText().contains("Objekt"),
                "DE-FEATURE-002 family button announces the remembered Objekt option");
        assertTrue(!popupButtonVisible("Objekt"),
                "DE-FEATURE-002 selecting a feature option closes the dropdown");
        click(featureFamily);
        dropdown = popupContainerWithSelected("Objekt");
        assertPopupOptionSelected("Objekt", "DE-FEATURE-002 reopening remembers the Objekt option");
        click(popupButton(dropdown, "Encounter"));
        assertEquals("FEATURE_ENCOUNTER_CREATE", runtime.controlsModel().current().selectedTool().name(),
                "DE-FEATURE-002 selecting Encounter routes to encounter creation");
        assertTrue(featureFamily.getAccessibleText().contains("Encounter"),
                "DE-FEATURE-002 family button announces the remembered Encounter option");
        click(featureFamily);
        assertPopupOptionSelected("Encounter", "DE-FEATURE-002 reopening remembers the Encounter option");
        firePopupMouseExited(popupContainer());
        assertEquals(authoredStateBefore, runtime.database().authoredGeometryState(mapId),
                "DE-FEATURE-002 leaves authored DB state unchanged");
        results.add("DE-FEATURE-002 Ready: DungeonEditorControlsView Feature dropdown routes and remembers"
                + " POI/Objekt/Encounter");
    }

    private static void verifyPoiCreateSelectionAndReloadThroughMapView(List<String> results) {
        HarnessRuntime runtime = HarnessRuntime.create();
        HarnessBinding binding = bindHarness(runtime);
        DungeonEditorControlsView controls = binding.controls();
        DungeonMapView mapView = binding.mapView();

        long mapId = createMapThroughControls(controls, runtime, "Feature POI Create Map");
        runtime.database().seedF6MultiLevelFloors(mapId);
        createMapThroughControls(controls, runtime, "Feature POI Reload Hop");
        selectMap(controls, "Feature POI Create Map");
        assertTrue(runtime.database().featureMarkerStableState(mapId).isEmpty(),
                "DE-FEATURE-003 fixture starts without authored feature markers");

        click(button(controls, "Feature"));
        assertEquals("FEATURE_POI_CREATE", runtime.controlsModel().current().selectedTool().name(),
                "DE-FEATURE-003 feature family defaults to the POI create route");
        DungeonMapContentModel.Viewport viewport = binding.mapContentModel().currentViewport();
        fireMapMousePressed(
                mapView,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(5.5),
                viewport.sceneToScreenY(2.5),
                false);

        long markerId = runtime.database().featureMarkerIdAt(mapId, "POI", 5, 2, 0);
        assertEquals(1L, runtime.database().countFeatureMarkerById(mapId, markerId),
                "DE-FEATURE-003 persists one dungeon_feature_markers row for the created POI");
        assertEquals(1L, runtime.database().countFeatureMarkerTopologyElementById(mapId, markerId),
                "DE-FEATURE-003 persists one stable FEATURE_MARKER topology ref");
        List<String> stableRowsAfterCreate = runtime.database().featureMarkerStableState(mapId);
        assertTrue(stableRowsAfterCreate.stream().anyMatch(row -> row.startsWith(
                        "dungeon_feature_markers|feature_marker_id=" + markerId)
                        && row.contains("|dungeon_map_id=" + mapId)
                        && row.contains("|marker_kind=POI")
                        && row.contains("|cell_x=5")
                        && row.contains("|cell_y=2")
                        && row.contains("|level_z=0")),
                "DE-FEATURE-003 persists POI kind and cell coordinates: " + stableRowsAfterCreate);

        DungeonEditorTopologyElementRef markerRef = new DungeonEditorTopologyElementRef("FEATURE_MARKER", markerId);
        DungeonEditorMapSurfaceSnapshot committedSurface = runtime.mapSurfaceModel().current();
        assertFeatureMarkerCreatedInSnapshot(
                committedSurface,
                binding.mapContentModel(),
                "POI",
                markerId,
                5,
                2,
                0,
                "DE-FEATURE-003 committed create");
        var pointerTarget = runtimePointerTarget(binding.mapContentModel(), 5.5, 2.5);
        assertEquals(DungeonEditorRuntimePointerTarget.TargetKind.MARKER, pointerTarget.targetKind(),
                "DE-FEATURE-004 authored feature marker resolves as a marker target");
        assertEquals(DungeonEditorRuntimePointerTarget.ElementKind.FEATURE_MARKER, pointerTarget.elementKind(),
                "DE-FEATURE-004 authored feature marker publishes FEATURE_MARKER element kind");
        assertEquals(DungeonEditorRuntimePointerTarget.TopologyKind.FEATURE_MARKER, pointerTarget.topologyKind(),
                "DE-FEATURE-004 authored feature marker carries the FEATURE_MARKER topology ref");
        updateHoverTarget(binding.mapContentModel(), pointerTarget);
        assertTrue(renderHasHoverText(binding.mapContentModel(), "POI " + markerId),
                "DE-FEATURE-004 authored feature marker label appears only in hover overlay");
        assertCanvasPaintedNearScene(mapView, 5.5, 2.5, 18,
                "DE-FEATURE-003 rendered canvas paints the created POI marker");
        DungeonEditorStateSnapshot selectedState = runtime.stateModel().current();
        assertEquals(markerRef, selectedState.selection().topologyRef(),
                "DE-FEATURE-004 create selects the authored feature-marker topology ref");
        assertTrue(!selectedState.selection().clusterSelection(),
                "DE-FEATURE-004 create selection is a simple marker target");
        assertEquals(markerRef,
                runtime.mapSurfaceModel().current().selection().topologyRef(),
                "DE-FEATURE-004 map-surface readback selects the authored feature marker");
        assertTrue(selectedState.inspector() != null,
                "DE-FEATURE-004 create publishes a feature-marker inspector");
        assertEquals("POI " + markerId, selectedState.inspector().title(),
                "DE-FEATURE-004 inspector title uses the marker label");
        assertTrue(selectedState.inspector().facts().contains("ref: FEATURE_MARKER " + markerId),
                "DE-FEATURE-004 inspector facts expose the stable marker topology ref");

        selectMap(controls, "Feature POI Reload Hop");
        selectMap(controls, "Feature POI Create Map");
        assertEquals(stableRowsAfterCreate, runtime.database().featureMarkerStableState(mapId),
                "DE-FEATURE-006 reload keeps the POI feature-marker rows stable");
        assertFeatureMarkerCreatedInSnapshot(
                runtime.mapSurfaceModel().current(),
                binding.mapContentModel(),
                "POI",
                markerId,
                5,
                2,
                0,
                "DE-FEATURE-006 reload");
        results.add("DE-FEATURE-003 Ready: DungeonEditorControlsView Feature/POI -> DungeonMapView primary create"
                + " -> SQLite feature-marker/topology -> snapshot/render");
        results.add("DE-FEATURE-004 Ready: feature-marker create selects FEATURE_MARKER and publishes inspector"
                + " readback through state and map-surface snapshots");
        results.add("DE-FEATURE-006 Ready: Feature-marker create reload keeps persisted POI rows and render readback");
    }

    private static void verifyObjectAndEncounterProjectionThroughMapView(List<String> results) {
        HarnessRuntime runtime = HarnessRuntime.create();
        HarnessBinding binding = bindHarness(runtime);
        DungeonEditorControlsView controls = binding.controls();
        DungeonMapView mapView = binding.mapView();

        long mapId = createMapThroughControls(controls, runtime, "Feature Kind Map");
        runtime.database().seedF6MultiLevelFloors(mapId);
        selectMap(controls, "Feature Kind Map");
        ButtonBase featureFamily = button(controls, "Feature");
        DungeonMapContentModel.Viewport viewport = binding.mapContentModel().currentViewport();

        click(featureFamily);
        Parent objectDropdown = popupContainerWithSelected("POI");
        click(popupButton(objectDropdown, "Objekt"));
        assertEquals("FEATURE_OBJECT_CREATE", runtime.controlsModel().current().selectedTool().name(),
                "DE-FEATURE-005 selecting Objekt activates the object create tool before map press");
        fireMapMousePressed(
                mapView,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(5.5),
                viewport.sceneToScreenY(2.5),
                false);

        click(featureFamily);
        Parent encounterDropdown = popupContainerWithSelected("Objekt");
        click(popupButton(encounterDropdown, "Encounter"));
        assertEquals("FEATURE_ENCOUNTER_CREATE", runtime.controlsModel().current().selectedTool().name(),
                "DE-FEATURE-005 selecting Encounter activates the encounter create tool before map press");
        fireMapMousePressed(
                mapView,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(7.5),
                viewport.sceneToScreenY(2.5),
                false);

        DungeonEditorMapSurfaceSnapshot snapshot = runtime.mapSurfaceModel().current();
        Optional<DungeonEditorMapSnapshot.Feature> objectFeature = featureAt(snapshot, 5, 2, 0);
        Optional<DungeonEditorMapSnapshot.Feature> encounterFeature = featureAt(snapshot, 7, 2, 0);
        assertTrue(objectFeature.isPresent(), "DE-FEATURE-005 object marker exists at 5,2,0");
        assertEquals("OBJECT", objectFeature.orElseThrow().kind(),
                "DE-FEATURE-005 object route publishes OBJECT marker kind");
        assertTrue(encounterFeature.isPresent(), "DE-FEATURE-005 encounter marker exists at 7,2,0");
        assertEquals("ENCOUNTER", encounterFeature.orElseThrow().kind(),
                "DE-FEATURE-005 encounter route publishes ENCOUNTER marker kind");
        assertFeatureMarkerCreatedInSnapshot(
                snapshot,
                binding.mapContentModel(),
                "OBJECT",
                objectFeature.orElseThrow().id(),
                5,
                2,
                0,
                "DE-FEATURE-005 committed object create");
        assertFeatureMarkerCreatedInSnapshot(
                snapshot,
                binding.mapContentModel(),
                "ENCOUNTER",
                encounterFeature.orElseThrow().id(),
                7,
                2,
                0,
                "DE-FEATURE-005 committed encounter create");
        results.add("DE-FEATURE-005 Ready: Objekt and Encounter create as distinct FEATURE_MARKER kinds with"
                + " separate published/rendered markers");
    }

    private static void verifyFeatureDeleteThroughMapView(List<String> results) {
        HarnessRuntime runtime = HarnessRuntime.create();
        HarnessBinding binding = bindHarness(runtime);
        DungeonEditorControlsView controls = binding.controls();
        DungeonMapView mapView = binding.mapView();

        long mapId = createMapThroughControls(controls, runtime, "Feature Delete Map");
        runtime.database().seedF6MultiLevelFloors(mapId);
        createMapThroughControls(controls, runtime, "Feature Delete Reload Hop");
        selectMap(controls, "Feature Delete Map");
        DungeonMapContentModel.Viewport viewport = binding.mapContentModel().currentViewport();

        click(button(controls, "Feature"));
        fireMapMousePressed(
                mapView,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(7.5),
                viewport.sceneToScreenY(2.5),
                false);
        long leftPoiId = runtime.database().featureMarkerIdAt(mapId, "POI", 7, 2, 0);

        fireMapMousePressed(
                mapView,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(9.5),
                viewport.sceneToScreenY(2.5),
                false);
        long deletedPoiId = runtime.database().featureMarkerIdAt(mapId, "POI", 9, 2, 0);
        fireMapMousePressed(
                mapView,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(11.5),
                viewport.sceneToScreenY(2.5),
                false);
        long rightPoiId = runtime.database().featureMarkerIdAt(mapId, "POI", 11, 2, 0);
        assertEquals(1L, runtime.database().countFeatureMarkerById(mapId, leftPoiId),
                "DE-FEATURE-007 setup keeps the left POI marker row");
        assertEquals(1L, runtime.database().countFeatureMarkerById(mapId, deletedPoiId),
                "DE-FEATURE-007 setup keeps the middle POI marker row");
        assertEquals(1L, runtime.database().countFeatureMarkerById(mapId, rightPoiId),
                "DE-FEATURE-007 setup keeps the right POI marker row");
        var deletePointerTarget = runtimePointerTarget(binding.mapContentModel(), 9.5, 2.5);
        assertEquals(DungeonEditorRuntimePointerTarget.TargetKind.MARKER, deletePointerTarget.targetKind(),
                "DE-FEATURE-007 authored delete target resolves as a feature-marker marker");
        assertEquals(DungeonEditorRuntimePointerTarget.ElementKind.FEATURE_MARKER, deletePointerTarget.elementKind(),
                "DE-FEATURE-007 authored delete target keeps FEATURE_MARKER element identity");
        fireMapMousePressed(
                mapView,
                MouseButton.SECONDARY,
                viewport.sceneToScreenX(9.5),
                viewport.sceneToScreenY(2.5),
                false);
        assertEquals(1L, runtime.database().countFeatureMarkerById(mapId, leftPoiId),
                "DE-FEATURE-007 secondary delete keeps left POI marker row");
        assertEquals(0L, runtime.database().countFeatureMarkerById(mapId, deletedPoiId),
                "DE-FEATURE-007 secondary delete removes the targeted POI marker row");
        assertEquals(0L, runtime.database().countFeatureMarkerTopologyElementById(mapId, deletedPoiId),
                "DE-FEATURE-007 secondary delete removes the targeted topology ref");
        assertEquals(1L, runtime.database().countFeatureMarkerById(mapId, rightPoiId),
                "DE-FEATURE-007 secondary delete keeps right POI marker row");
        DungeonEditorTopologyElementRef deletedRef =
                new DungeonEditorTopologyElementRef("FEATURE_MARKER", deletedPoiId);
        Point2D deletedCenter = new Point2D(9.5, 2.5);
        assertFeatureMarkerAbsentFromSnapshotAndRender(
                runtime.mapSurfaceModel().current(),
                binding.mapContentModel(),
                deletedRef,
                deletedCenter,
                "DE-FEATURE-007 committed delete");
        assertEmptySelection(runtime.stateModel().current().selection(),
                "DE-FEATURE-007 clears selected marker after delete");

        selectMap(controls, "Feature Delete Reload Hop");
        selectMap(controls, "Feature Delete Map");
        assertEquals(0L, runtime.database().countFeatureMarkerById(mapId, deletedPoiId),
                "DE-FEATURE-007 reload keeps the deleted marker row absent");
        assertFeatureMarkerAbsentFromSnapshotAndRender(
                runtime.mapSurfaceModel().current(),
                binding.mapContentModel(),
                deletedRef,
                deletedCenter,
                "DE-FEATURE-007 reload");
        results.add("DE-FEATURE-007 Ready: active Feature tool secondary click deletes the hit FEATURE_MARKER"
                + " row/topology/render and survives reload");
    }

    private static Optional<DungeonEditorMapSnapshot.Feature> featureAt(
            DungeonEditorMapSurfaceSnapshot snapshot,
            int q,
            int r,
            int level
    ) {
        return snapshot.surface().map().features().stream()
                .filter(feature -> feature.cells().stream()
                        .anyMatch(cell -> cell.q() == q && cell.r() == r && cell.level() == level))
                .findFirst();
    }

    private static Parent popupContainerWithSelected(String selectedText) {
        return popupDescendants().stream()
                .filter(Parent.class::isInstance)
                .map(Parent.class::cast)
                .filter(parent -> parent.getStyleClass().contains("dungeon-editor-popup"))
                .filter(Parent::isVisible)
                .filter(parent -> descendants(parent).stream()
                        .filter(ButtonBase.class::isInstance)
                        .map(ButtonBase.class::cast)
                        .anyMatch(button -> selectedText.equals(button.getText())
                                && button.getStyleClass().contains("selected")))
                .reduce((ignored, latest) -> latest)
                .orElseThrow(() -> new IllegalStateException(
                        "Dungeon Editor popup container not found with selected option: " + selectedText));
    }

    private static ButtonBase popupButton(Parent dropdown, String text) {
        return descendants(dropdown).stream()
                .filter(ButtonBase.class::isInstance)
                .map(ButtonBase.class::cast)
                .filter(button -> text.equals(button.getText()) && button.isVisible())
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("Popup button not found in dropdown: " + text));
    }
}
