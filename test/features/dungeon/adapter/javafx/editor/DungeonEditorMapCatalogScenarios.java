package features.dungeon.adapter.javafx.editor;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.Direction;
import features.dungeon.api.DungeonEdgeRef;
import features.dungeon.api.editor.DungeonEditorState;
import features.dungeon.api.DungeonEditorPreview;
import features.dungeon.api.DungeonEditorViewMode;
import features.dungeon.api.DungeonInspectorSnapshot;
import features.dungeon.api.DungeonMapSummary;
import features.dungeon.api.DungeonOverlaySettings;
import features.dungeon.api.DungeonTopologyElementRef;
import features.dungeon.adapter.javafx.map.DungeonMapContentModel;
import features.dungeon.adapter.javafx.map.DungeonMapView;
import javafx.event.ActionEvent;
import javafx.geometry.Bounds;
import javafx.geometry.Point2D;
import javafx.scene.Parent;
import javafx.scene.control.ButtonBase;
import javafx.scene.control.CheckBox;
import javafx.scene.control.ComboBox;
import javafx.scene.control.Label;
import javafx.scene.control.MenuButton;
import javafx.scene.control.Slider;
import javafx.scene.control.Spinner;
import javafx.scene.control.TextArea;
import javafx.scene.control.TextField;
import javafx.scene.control.ToggleButton;
import javafx.scene.input.KeyCode;
import javafx.scene.input.MouseButton;
import javafx.scene.input.MouseEvent;
import javafx.scene.layout.HBox;
import javafx.stage.Window;
import static features.dungeon.adapter.javafx.editor.DungeonEditorTestSupport.*;

final class DungeonEditorMapCatalogScenarios {


    private DungeonEditorMapCatalogScenarios() {
    }

    static void run() throws Exception {
        route(() -> verifyCreateMapThroughControlsView());
        route(() -> verifyRenameMapThroughControlsView());
        route(() -> verifyDeleteMapThroughControlsView());
        route(() -> verifyLoadMapThroughControlsView());
        route(() -> verifyReloadMapThroughControlsView());
    }

    private static void route(
            DungeonEditorTestSupport.ThrowingRunnable action
    ) throws Exception {
        DungeonEditorTestSupport.runRoute(action);
    }

    private static void verifyCreateMapThroughControlsView() {
        TestRuntime runtime = TestRuntime.create();
        TestBinding binding = bindTest(runtime);
        DungeonEditorControlsView controls = binding.controls();

        click(button(controls, "Neu"));
        catalogPopupTextField(controls, "Dungeon-Name").setText("Gamma");
        click(catalogPopupButton(controls, "Erstellen"));

        long gammaRows = runtime.database().countMapsNamed("Gamma");
        assertEquals(1L, gammaRows, "DE-MAP-001 persisted one Gamma dungeon_maps row");
        DungeonEditorState controlsSnapshot = runtime.editorApi().current();
        assertTrue(
                controlsSnapshot.catalog().stream().anyMatch(map -> "Gamma".equals(map.mapName())),
                "DE-MAP-001 published catalog contains Gamma");
        DungeonMapSummary selected = controlsSnapshot.catalog().stream()
                .filter(map -> "Gamma".equals(map.mapName()))
                .findFirst()
                .orElseThrow();
        assertTrue(selected.mapId().value() > 0L, "DE-MAP-001 selected Gamma map has a stable id");
        assertEquals(1L, selected.revision(), "DE-MAP-001 created catalog header starts at revision one");
        assertEquals(1L, runtime.database().mapRevision(selected.mapId().value()),
                "DE-MAP-001 metadata-only create persists revision one");
        assertEquals(selected.mapId(), controlsSnapshot.selectedMapId(), "DE-MAP-001 controls snapshot selects Gamma");
        assertPreparedSelectedMapAligned(
                runtime,
                binding,
                selected.mapId().value(),
                "Gamma",
                "DE-MAP-001 explicit create selection");
        assertPreparedCatalogEntries(
                controls,
                List.of("Gamma"),
                List.of(),
                "DE-MAP-001 prepared-frame catalog list");
        assertEquals(0L, runtime.database().countAuthoredGeometryRows(selected.mapId().value()),
                "DE-MAP-001 created map starts without authored geometry rows");
        assertEmptyMapSurface(runtime.editorApi().current(), "Gamma");
        assertVisiblePlaceholder(binding.mapView(), "DE-MAP-001");

    }


    private static void verifyRenameMapThroughControlsView() {
        TestRuntime runtime = TestRuntime.create();
        TestBinding binding = bindTest(runtime);
        DungeonEditorControlsView controls = binding.controls();

        long alphaMapId = createMapThroughControls(controls, runtime, "Alpha");
        runtime.database().seedF1SingleRoom(alphaMapId, "A1", 0, 1, 1);
        long betaMapId = createMapThroughControls(controls, runtime, "Beta");
        runtime.database().seedTwoByTwoRoom(betaMapId, "B1", 0, 10, 10);
        selectMap(controls, "Alpha");
        long geometryRowsBefore = runtime.database().countAuthoredGeometryRows(alphaMapId);

        click(menuItem(menuButton(controls, "Mehr"), "Umbenennen"));
        TextField mapNameField = catalogPopupTextField(controls, "Dungeon-Name");
        mapNameField.setText("Alpha Prime");
        click(catalogPopupButton(controls, "Speichern"));

        assertEquals(1L, runtime.database().countMapIdWithName(alphaMapId, "Alpha Prime"),
                "DE-MAP-002 selected dungeon_maps row is renamed");
        assertEquals(0L, runtime.database().countMapIdWithName(alphaMapId, "Alpha"),
                "DE-MAP-002 old selected dungeon_maps name is gone");
        assertEquals(geometryRowsBefore, runtime.database().countAuthoredGeometryRows(alphaMapId),
                "DE-MAP-002 leaves authored geometry rows unchanged");
        assertEquals(2L, runtime.database().mapRevision(alphaMapId),
                "DE-MAP-002 metadata-only rename advances the map revision once");
        DungeonEditorState controlsSnapshot = runtime.editorApi().current();
        assertEquals(alphaMapId, controlsSnapshot.selectedMapId().value(),
                "DE-MAP-002 selection remains on the renamed map id");
        assertTrue(
                controlsSnapshot.catalog().stream().anyMatch(map ->
                        map.mapId().value() == alphaMapId
                                && "Alpha Prime".equals(map.mapName())
                                && map.revision() == 2L),
                "DE-MAP-002 published catalog contains renamed map");
        assertPreparedCatalogEntries(
                controls,
                List.of("Alpha Prime", "Beta"),
                List.of("Alpha"),
                "DE-MAP-002 prepared-frame catalog list");
        DungeonEditorState surfaceSnapshot = runtime.editorApi().current();
        assertEquals("Alpha Prime", surfaceSnapshot.selectedWindow().mapName(),
                "DE-MAP-002 map surface name reflects rename");
        assertTrue(surfaceContainsLevel(surfaceSnapshot, 0),
                "DE-MAP-002 render-facing map surface keeps authored level 0 cells");
        assertCanvasPaintedAtScene(binding.mapView(), 2.5, 2.5,
                "DE-MAP-002 rendered canvas keeps authored geometry at the room coordinates");


    }


    private static void verifyDeleteMapThroughControlsView() {
        TestRuntime runtime = TestRuntime.create();
        TestBinding binding = bindTest(runtime);
        DungeonEditorControlsView controls = binding.controls();

        long zetaMapId = createMapThroughControls(controls, runtime, "Zeta");
        runtime.database().seedTwoByTwoRoom(zetaMapId, "Z1", 0, 20, 20);
        long alphaMapId = createMapThroughControls(controls, runtime, "Alpha");
        runtime.database().seedF1SingleRoom(alphaMapId, "A1", 0, 1, 1);
        long betaMapId = createMapThroughControls(controls, runtime, "Beta");
        runtime.database().seedTwoByTwoRoom(betaMapId, "B1", 0, 10, 10);
        selectMap(controls, "Alpha");
        selectMap(controls, "Beta");
        long zetaGeometryRowsBefore = runtime.database().countAuthoredGeometryRows(zetaMapId);
        long alphaGeometryRowsBefore = runtime.database().countAuthoredGeometryRows(alphaMapId);
        long betaGeometryRowsBefore = runtime.database().countAuthoredGeometryRows(betaMapId);
        assertTrue(zetaMapId < alphaMapId, "DE-MAP-003 Zeta has a lower inserted map id than Alpha");
        assertTrue(betaGeometryRowsBefore > 0L, "DE-MAP-003 Beta fixture has authored rows before delete");
        assertTrue(renderSurfaceCellOrigins(binding.mapContentModel()).contains("10,10"),
                "DE-MAP-003 Beta renders before delete");

        click(menuItem(menuButton(controls, "Mehr"), "Löschen"));
        click(catalogPopupButtonWithAccessibleText(controls, "Löschen bestätigen"));

        assertEquals(0L, runtime.database().countMapIdWithName(betaMapId, "Beta"),
                "DE-MAP-003 selected Beta dungeon_maps row is deleted");
        assertEquals(0L, runtime.database().countAuthoredGeometryRows(betaMapId),
                "DE-MAP-003 cascading authored rows for Beta are deleted");
        assertEquals(1L, runtime.database().countMapIdWithName(zetaMapId, "Zeta"),
                "DE-MAP-003 lower-id Zeta dungeon_maps row remains");
        assertEquals(zetaGeometryRowsBefore, runtime.database().countAuthoredGeometryRows(zetaMapId),
                "DE-MAP-003 lower-id Zeta authored rows remain unchanged");
        assertEquals(1L, runtime.database().countMapIdWithName(alphaMapId, "Alpha"),
                "DE-MAP-003 fallback Alpha dungeon_maps row remains");
        assertEquals(alphaGeometryRowsBefore, runtime.database().countAuthoredGeometryRows(alphaMapId),
                "DE-MAP-003 fallback Alpha authored rows remain unchanged");
        DungeonEditorState controlsSnapshot = runtime.editorApi().current();
        assertEquals(alphaMapId, controlsSnapshot.selectedMapId().value(),
                "DE-MAP-003 selected map falls back to name-ordered Alpha instead of lower-id Zeta");
        assertPreparedSelectedMapAligned(
                runtime,
                binding,
                alphaMapId,
                "Alpha",
                "DE-MAP-003 delete fallback prepared frame");
        assertCatalogSelectorSurface(
                controls,
                "Alpha",
                "Dungeon-Map gelöscht.",
                "DE-MAP-003 fallback catalog row keeps status, selected label, and Mehr geometry stable");
        assertPreparedCatalogEntries(
                controls,
                List.of("Alpha", "Zeta"),
                List.of("Beta"),
                "DE-MAP-003 prepared-frame catalog delete omission");
        assertTrue(controlsSnapshot.catalog().stream().noneMatch(map -> map.mapId().value() == betaMapId),
                "DE-MAP-003 published catalog omits deleted Beta");
        assertEquals("Dungeon-Map gelöscht.", controlsSnapshot.commandStatus().message(),
                "DE-MAP-003 published controls status reports deletion");
        assertPreparedStatusProjected(
                binding,
                "Dungeon-Map gelöscht.",
                "DE-MAP-003 delete fallback prepared status projection");
        DungeonEditorState surfaceSnapshot = runtime.editorApi().current();
        assertEquals("Alpha", surfaceSnapshot.selectedWindow().mapName(),
                "DE-MAP-003 map surface falls back to Alpha");
        assertEmptySelection(surfaceSnapshot.selection(), "DE-MAP-003 fallback surface");
        assertEquals(DungeonEditorPreview.none(), surfaceSnapshot.preview(),
                "DE-MAP-003 fallback surface clears preview");
        assertEquals(
                Set.of("1,1,0", "1,2,0", "1,3,0", "2,1,0", "2,2,0", "2,3,0", "3,1,0", "3,2,0", "3,3,0"),
                surfaceCellSet(surfaceSnapshot),
                "DE-MAP-003 fallback Alpha surface contains exactly A1 cells");
        assertTrue(renderSurfaceCellOrigins(binding.mapContentModel()).contains("1,1"),
                "DE-MAP-003 render scene shows fallback Alpha cells");
        assertTrue(!renderSurfaceCellOrigins(binding.mapContentModel()).contains("10,10"),
                "DE-MAP-003 render scene omits deleted Beta cells");
        assertTrue(!renderSurfaceCellOrigins(binding.mapContentModel()).contains("20,20"),
                "DE-MAP-003 render scene omits lower-id Zeta cells");
        assertCanvasPaintedAtScene(binding.mapView(), 2.5, 2.5,
                "DE-MAP-003 rendered canvas paints fallback Alpha room surface");

        long gammaMapId = createMapThroughControls(controls, runtime, "Gamma");
        assertEquals(1L, runtime.database().countMapIdWithName(gammaMapId, "Gamma"),
                "DE-MAP-006 primary Neu works after delete and persists Gamma");
        assertEquals(0L, runtime.database().countAuthoredGeometryRows(gammaMapId),
                "DE-MAP-006 post-delete Gamma starts without authored geometry rows");
        DungeonEditorState afterPostDeleteCreate = runtime.editorApi().current();
        assertEquals(gammaMapId, afterPostDeleteCreate.selectedMapId().value(),
                "DE-MAP-006 post-delete create selects Gamma");
        assertPreparedSelectedMapAligned(
                runtime,
                binding,
                gammaMapId,
                "Gamma",
                "DE-MAP-006 create-after-delete prepared frame");
        assertPreparedCatalogEntries(
                controls,
                List.of("Alpha", "Gamma", "Zeta"),
                List.of("Beta"),
                "DE-MAP-006 prepared-frame catalog after delete/create");
        assertTrue(afterPostDeleteCreate.catalog().stream().anyMatch(map ->
                        map.mapId().value() == gammaMapId && "Gamma".equals(map.mapName())),
                "DE-MAP-006 published catalog contains Gamma after delete");
        DungeonEditorState postDeleteCreateSurface = runtime.editorApi().current();
        assertEquals("Gamma", postDeleteCreateSurface.selectedWindow().mapName(),
                "DE-MAP-006 map surface switches to Gamma after delete-then-create");
        assertVisiblePlaceholder(binding.mapView(), "DE-MAP-006");



    }


    private static void verifyLoadMapThroughControlsView() {
        TestRuntime runtime = TestRuntime.create();
        TestBinding binding = bindTest(runtime);
        DungeonEditorControlsView controls = binding.controls();

        long alphaMapId = createMapThroughControls(controls, runtime, "Alpha");
        runtime.database().seedF1SingleRoom(alphaMapId, "A1", 0, 1, 1);
        long betaMapId = createMapThroughControls(controls, runtime, "Beta");
        runtime.database().seedTwoByTwoRoom(betaMapId, "B1", 0, 10, 10);
        long alphaGeometryRowsBefore = runtime.database().countAuthoredGeometryRows(alphaMapId);
        long betaGeometryRowsBefore = runtime.database().countAuthoredGeometryRows(betaMapId);

        selectMap(controls, "Alpha");
        selectMap(controls, "Beta");

        DungeonEditorState controlsSnapshot = runtime.editorApi().current();
        assertEquals(betaMapId, controlsSnapshot.selectedMapId().value(), "DE-MAP-004 controls selects Beta");
        assertPreparedSelectedMapAligned(
                runtime,
                binding,
                betaMapId,
                "Beta",
                "DE-MAP-004 explicit select prepared frame");
        assertCatalogSelectorSurface(
                controls,
                "Beta",
                "",
                "DE-MAP-004 loaded catalog row keeps selected label and Mehr geometry stable");
        DungeonEditorState surfaceSnapshot = runtime.editorApi().current();
        assertEquals("Beta", surfaceSnapshot.selectedWindow().mapName(), "DE-MAP-004 map surface name");
        assertEquals(
                Set.of("10,10,0", "10,11,0", "11,10,0", "11,11,0"),
                surfaceCellSet(surfaceSnapshot),
                "DE-MAP-004 Beta surface contains exactly B1 cells");
        assertEquals(1L, surfaceSnapshot.selectedWindow().map().areas().size(), "DE-MAP-004 Beta has one room area");
        assertEquals(0L, surfaceSnapshot.selectedWindow().map().features().size(), "DE-MAP-004 Beta has no doors or corridors");
        assertTrue(surfaceSnapshot.selectedWindow().map().boundaries().stream().noneMatch(boundary ->
                        "door".equalsIgnoreCase(boundary.kind())),
                "DE-MAP-004 Beta has no door boundaries");
        assertTrue(surfaceSnapshot.selectedWindow().map().boundaries().size() > 0,
                "DE-MAP-004 Beta surface includes authored wall boundaries");
        assertEquals(
                Set.of("10,10", "10,11", "11,10", "11,11"),
                renderSurfaceCellOrigins(binding.mapContentModel()),
                "DE-MAP-004 render scene shows only Beta B1 cells");
        assertTrue(!renderSurfaceCellOrigins(binding.mapContentModel()).contains("1,1"),
                "DE-MAP-004 render scene does not show Alpha cells");
        assertCanvasHasPaintedContent(binding.mapView(),
                "DE-MAP-004 rendered canvas paints the loaded Beta room surface");
        assertEquals(alphaGeometryRowsBefore, runtime.database().countAuthoredGeometryRows(alphaMapId),
                "DE-MAP-004 leaves Alpha authored DB rows unchanged");
        assertEquals(betaGeometryRowsBefore, runtime.database().countAuthoredGeometryRows(betaMapId),
                "DE-MAP-004 leaves Beta authored DB rows unchanged");


    }


    private static void verifyReloadMapThroughControlsView() {
        TestRuntime runtime = TestRuntime.create();
        TestBinding binding = bindTest(runtime);
        DungeonEditorControlsView controls = binding.controls();
        DungeonMapView mapView = binding.mapView();
        DungeonMapContentModel mapContentModel = binding.mapContentModel();

        long mapId = createMapThroughControls(controls, runtime, "Reload Map");
        runtime.database().seedF1SingleRoom(mapId, "R1", 0, 1, 1);
        createMapThroughControls(controls, runtime, "Reload Hop");
        selectMap(controls, "Reload Map");
        List<String> authoredStateBefore = runtime.database().authoredGeometryState(mapId);
        assertEquals(
                Set.of("1,1,0", "1,2,0", "1,3,0", "2,1,0", "2,2,0", "2,3,0", "3,1,0", "3,2,0", "3,3,0"),
                surfaceCellSet(runtime.editorApi().current()),
                "DE-MAP-005 initial selected surface shows R1 cells");

        click(button(controls, "Raum"));
        DungeonMapContentModel.Viewport viewport = mapContentModel.currentViewport();
        Set<String> previewCells = cellRect(5, 5, 6, 6, 0);
        double previewEndX = viewport.sceneToScreenX(6.5);
        double previewEndY = viewport.sceneToScreenY(6.5);
        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_PRESSED,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(5.5),
                viewport.sceneToScreenY(5.5),
                false);
        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_DRAGGED,
                MouseButton.PRIMARY,
                previewEndX,
                previewEndY,
                false);

        assertEquals(authoredStateBefore, runtime.database().authoredGeometryState(mapId),
                "DE-MAP-005 live preview does not mutate authored DB rows before reload");
        assertTrue(runtime.editorApi().current().preview() instanceof DungeonEditorPreview.RoomRectanglePreview,
                "DE-MAP-005 starts reload from a real non-empty room preview");
        assertTrue(renderSurfaceCellOriginsWithZ(mapContentModel).containsAll(previewCells),
                "DE-MAP-005 render scene shows transient preview cells before reload");

        runtime.database().seedTwoByTwoRoom(mapId, "R2", 0, 10, 10);
        List<String> authoredStateAfterExternalChange = runtime.database().authoredGeometryState(mapId);
        assertTrue(!authoredStateBefore.equals(authoredStateAfterExternalChange),
                "DE-MAP-005 fixture external persisted change updates DB oracle");
        assertTrue(!surfaceCellSet(runtime.editorApi().current()).contains("10,10,0"),
                "DE-MAP-005 external persisted change is not visible before reload");
        assertTrue(!renderSurfaceCellOrigins(binding.mapContentModel()).contains("10,10"),
                "DE-MAP-005 render scene is not refreshed before reload");

        click(menuItem(menuButton(controls, "Mehr"), "Neu laden"));

        assertEquals(authoredStateAfterExternalChange, runtime.database().authoredGeometryState(mapId),
                "DE-MAP-005 reload does not add authored DB rows beyond the external persisted change");
        DungeonEditorState controlsSnapshot = runtime.editorApi().current();
        assertEquals(mapId, controlsSnapshot.selectedMapId().value(),
                "DE-MAP-005 controls keep the reloaded map selected");
        assertPreparedSelectedMapAligned(
                runtime,
                binding,
                mapId,
                "Reload Map",
                "DE-MAP-005 reload prepared-frame selected-map projection");
        DungeonEditorState reloadedSurface = runtime.editorApi().current();
        assertEquals("Reload Map", reloadedSurface.selectedWindow().mapName(),
                "DE-MAP-005 reloaded surface keeps the selected map name");
        assertEquals(DungeonEditorPreview.none(), reloadedSurface.preview(),
                "DE-MAP-005 reload clears transient preview state");
        assertTrue(surfaceCellSet(reloadedSurface).contains("10,10,0"),
                "DE-MAP-005 reloaded surface reads externally persisted R2 cells");
        assertTrue(!renderSurfaceCellOriginsWithZ(mapContentModel).contains("5,5,0"),
                "DE-MAP-005 render scene drops stale preview cells after reload");
        assertTrue(renderSurfaceCellOrigins(binding.mapContentModel()).contains("10,10"),
                "DE-MAP-005 render scene reflects externally persisted R2 cells after reload");
        assertCanvasHasPaintedContent(binding.mapView(),
                "DE-MAP-005 rendered canvas paints the reloaded persisted surface");

        fireMapMouse(mapView, MouseEvent.MOUSE_RELEASED, MouseButton.PRIMARY, previewEndX, previewEndY, false);
        assertEquals(authoredStateAfterExternalChange, runtime.database().authoredGeometryState(mapId),
                "DE-MAP-005 post-reload release does not commit the stale preview");
        assertEquals(DungeonEditorPreview.none(), runtime.editorApi().current().preview(),
                "DE-MAP-005 post-reload release keeps preview cleared");
        assertTrue(!renderSurfaceCellOriginsWithZ(mapContentModel).contains("5,5,0"),
                "DE-MAP-005 post-reload release keeps stale preview render cleared");


    }


    private static void assertCatalogSelectorSurface(
            DungeonEditorControlsView controls,
            String expectedClosedSelectorText,
            String expectedStatusText,
            String message
    ) {
        controls.applyCss();
        controls.layout();
        ComboBox<?> selector = comboBox(controls, "Dungeon auswählen");
        Parent catalogSurface = controls.getParent() == null ? controls : controls.getParent();
        selector.show();
        selector.hide();
        controls.applyCss();
        controls.layout();
        assertEquals(expectedClosedSelectorText, closedSelectorText(selector),
                message + ": closed selector text");
        if (!expectedStatusText.isBlank()) {
            assertTrue(descendants(catalogSurface).stream()
                            .filter(Label.class::isInstance)
                            .map(Label.class::cast)
                            .anyMatch(label -> label.isVisible() && expectedStatusText.equals(label.getText())),
                    message + ": status text remains visible");
        }
        MenuButton actionMenu = menuButton(controls, "Mehr");
        HBox selectorRow = descendants(catalogSurface).stream()
                .filter(HBox.class::isInstance)
                .map(HBox.class::cast)
                .filter(row -> row.getStyleClass().contains("catalog-crud-selector-row"))
                .findFirst()
                .orElseThrow(() -> new AssertionError(message + ": selector row not found"));
        Bounds rowBounds = selectorRow.getLayoutBounds();
        Bounds menuBounds = actionMenu.getBoundsInParent();
        assertTrue(actionMenu.getWidth() >= 64.0, message + ": Mehr keeps stable width");
        assertTrue(menuBounds.getMaxX() <= rowBounds.getMaxX() + 0.5, message + ": Mehr remains inside row");
    }

    private static void assertPreparedSelectedMapAligned(
            TestRuntime runtime,
            TestBinding binding,
            long expectedMapId,
            String expectedMapName,
            String message
    ) {
        DungeonEditorState controlsSnapshot = runtime.editorApi().current();
        assertEquals(expectedMapId, controlsSnapshot.selectedMapId().value(),
                message + ": controls selected-map value");
        assertCatalogSelectorSurface(binding.controls(), expectedMapName, "", message + ": prepared key projection");
        DungeonEditorState surfaceSnapshot = runtime.editorApi().current();
        assertEquals(expectedMapName, surfaceSnapshot.selectedWindow().mapName(),
                message + ": rendered surface map name");
    }

    private static void assertPreparedStatusProjected(
            TestBinding binding,
            String expectedStatusText,
            String message
    ) {
        assertVisibleLabel(controlsSurface(binding.controls()), expectedStatusText, message + ": controls projection");
    }

    private static void assertPreparedCatalogEntries(
            DungeonEditorControlsView controls,
            List<String> expectedPresent,
            List<String> expectedAbsent,
            String message
    ) {
        List<String> itemTexts = selectorItemTexts(comboBox(controls, "Dungeon auswählen"));
        for (String expected : expectedPresent) {
            assertTrue(itemTexts.contains(expected), message + ": selector items contain " + expected);
        }
        for (String unexpected : expectedAbsent) {
            assertTrue(!itemTexts.contains(unexpected), message + ": selector items omit " + unexpected);
        }
    }

    private static Parent controlsSurface(DungeonEditorControlsView controls) {
        return controls.getParent() == null ? controls : controls.getParent();
    }

    private static void assertVisibleLabel(
            Parent root,
            String expectedText,
            String message
    ) {
        root.applyCss();
        root.layout();
        assertTrue(descendants(root).stream()
                        .filter(Label.class::isInstance)
                        .map(Label.class::cast)
                        .anyMatch(label -> label.isVisible() && expectedText.equals(label.getText())),
                message + ": visible label text");
    }

    private static String closedSelectorText(ComboBox<?> selector) {
        if (selector.getButtonCell() == null) {
            return "";
        }
        String text = selector.getButtonCell().getText();
        return text == null ? "" : text;
    }

    private static List<String> selectorItemTexts(ComboBox<?> selector) {
        selector.applyCss();
        selector.layout();
        return selector.getItems().stream()
                .map(item -> comboDisplayTextRaw(selector, item))
                .collect(Collectors.toList());
    }

    @SuppressWarnings({"rawtypes", "unchecked"})
    private static String comboDisplayTextRaw(ComboBox<?> selector, Object item) {
        return comboDisplayText((ComboBox) selector, item);
    }

}
