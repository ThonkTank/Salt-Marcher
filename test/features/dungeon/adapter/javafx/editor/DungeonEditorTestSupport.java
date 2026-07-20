package features.dungeon.adapter.javafx.editor;

import features.dungeon.adapter.javafx.map.DungeonMapContentModel;
import features.dungeon.adapter.javafx.map.DungeonMapContentModel.PointerTarget;
import features.dungeon.adapter.javafx.map.DungeonMapView;
import features.dungeon.adapter.sqlite.model.DungeonPersistenceSchema;
import features.dungeon.api.DungeonEdgeRef;
import features.dungeon.api.DungeonEditorControlsSnapshot;
import features.dungeon.api.DungeonEditorMapSurfaceSnapshot;
import features.dungeon.api.DungeonEditorPreview;
import features.dungeon.api.DungeonEditorStateSnapshot;
import features.dungeon.api.DungeonInspectorSnapshot;
import features.dungeon.api.DungeonMapSummary;
import features.dungeon.api.DungeonOverlaySettings;
import features.dungeon.api.DungeonTopologyElementRef;
import features.dungeon.api.editor.DungeonEditorPointerInput;
import features.dungeon.application.editor.DungeonEditorRuntimePointerTarget;
import features.dungeon.application.editor.PointerInteractionTargets;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.Direction;
import javafx.geometry.Bounds;
import javafx.geometry.Point2D;
import javafx.scene.Node;
import javafx.scene.Parent;
import javafx.scene.Scene;
import javafx.scene.control.ButtonBase;
import javafx.scene.control.CheckBox;
import javafx.scene.control.ComboBox;
import javafx.scene.control.Label;
import javafx.scene.control.MenuButton;
import javafx.scene.control.MenuItem;
import javafx.scene.control.Slider;
import javafx.scene.control.Spinner;
import javafx.scene.control.TextArea;
import javafx.scene.control.TextField;
import javafx.scene.control.ToggleButton;
import javafx.scene.image.WritableImage;
import javafx.scene.input.KeyCode;
import javafx.scene.input.KeyEvent;
import javafx.scene.input.MouseButton;
import javafx.scene.input.MouseEvent;
import javafx.scene.input.ScrollEvent;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Pane;
import javafx.scene.paint.Color;
import javafx.stage.Stage;
import javafx.stage.Window;
import platform.persistence.FeatureStoreDefinition;
import platform.persistence.TestFeatureStores;
import platform.ui.catalogcrud.CatalogCrudControlsView;
import platform.ui.mapcanvas.MapCanvasPane;

import shell.api.ShellBinding;
import shell.api.ShellLeftBarTabSpec;
import shell.api.ShellSlot;
import shell.host.AppShell;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.WeakHashMap;

final class DungeonEditorTestSupport extends DungeonEditorTestRuntime {

    static final double DEFAULT_GRID_SIZE = 32.0;
    static final Color MAP_BACKGROUND = Color.rgb(0x12, 0x18, 0x1c);
    private static final double CANVAS_BACKGROUND_DISTANCE_THRESHOLD = 0.025;
    private static final double CANVAS_PRIMITIVE_STROKE_DISTANCE_THRESHOLD = 0.22;
    private static final Map<DungeonMapView, DungeonMapContentModel> BOUND_CONTENT_MODELS =
            Collections.synchronizedMap(new WeakHashMap<>());

    DungeonEditorTestSupport() {
    }



















    static void assertInvalidStairGeometryLeavesViewState(
            TestRuntime runtime,
            TestBinding binding,
            DungeonEditorMapSurfaceSnapshot surfaceBefore,
            Set<String> renderCellsBefore,
            String message
    ) {
        DungeonEditorMapSurfaceSnapshot surfaceAfter = runtime.mapSurfaceModel().current();
        assertEquals(surfaceBefore.surface().map(), surfaceAfter.surface().map(),
                message + " keeps published map stable");
        assertEquals(surfaceBefore.selection(), surfaceAfter.selection(),
                message + " keeps selected stair stable");
        assertEquals(surfaceBefore.projectionLevel(), surfaceAfter.projectionLevel(),
                message + " keeps projection stable");
        assertEquals(DungeonEditorPreview.none(), surfaceAfter.preview(),
                message + " keeps preview empty");
        assertEquals(renderCellsBefore, renderSurfaceCellOriginsWithZ(binding.mapContentModel()),
                message + " keeps rendered active-level stair cells stable");
    }










    static void submitTransitionLink(
            DungeonEditorStateView stateView,
            long targetMapId,
            long targetTransitionId,
            boolean bidirectional
    ) {
        selectComboItem(comboBox(stateView, "Übergang Zieltyp"), "Dungeon-Eingang");
        textField(stateView, "Übergang Zielkarte").setText(Long.toString(targetMapId));
        textField(stateView, "Übergang Zieluebergang").setText(Long.toString(targetTransitionId));
        CheckBox bidirectionalBox = checkBox(stateView, "Übergang bidirektional verknuepfen");
        if (bidirectionalBox.isSelected() != bidirectional) {
            click(bidirectionalBox);
        }
        click(buttonWithAccessibleText(stateView, "Übergang-Verknüpfung speichern"));
    }




    static long createWallFixture(
            DungeonEditorControlsView controls,
            TestRuntime runtime,
            String mapName
    ) {
        long mapId = createMapThroughControls(controls, runtime, mapName);
        runtime.database().seedF1SingleRoom(mapId, "R1", 0, 1, 1);
        createMapThroughControls(controls, runtime, mapName + " Reload Hop");
        selectMap(controls, mapName);
        return mapId;
    }

    static void startAndPreviewInternalWall(
            DungeonMapView mapView,
            DungeonMapContentModel.Viewport viewport
    ) {
        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_PRESSED,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(2.0),
                viewport.sceneToScreenY(1.0),
                false);
        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_RELEASED,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(2.0),
                viewport.sceneToScreenY(1.0),
                false);
        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_MOVED,
                MouseButton.NONE,
                viewport.sceneToScreenX(2.0),
                viewport.sceneToScreenY(4.0),
                false);
    }

    static DungeonEditorPreview.ClusterBoundariesPreview assertWallPreview(
            DungeonEditorMapSurfaceSnapshot snapshot,
            int expectedEdgeCount,
            boolean deleteMode,
            String message
    ) {
        assertTrue(snapshot.preview() instanceof DungeonEditorPreview.ClusterBoundariesPreview,
                message + " publishes a cluster-boundary wall preview");
        DungeonEditorPreview.ClusterBoundariesPreview preview =
                (DungeonEditorPreview.ClusterBoundariesPreview) snapshot.preview();
        assertEquals(expectedEdgeCount, preview.edges().size(), message + " preview edge count");
        assertEquals("WALL", preview.boundaryKind(), message + " preview boundary kind");
        assertTrue(preview.clusterId() > 0L, message + " preview has a cluster id");
        assertEquals(deleteMode, preview.deleteMode(), message + " preview delete mode");
        return preview;
    }

    static boolean previewHasEdge(
            DungeonEditorPreview.ClusterBoundariesPreview preview,
            int fromQ,
            int fromR,
            int fromLevel,
            int toQ,
            int toR,
            int toLevel
    ) {
        Cell from = new Cell(fromQ, fromR, fromLevel);
        Cell to = new Cell(toQ, toR, toLevel);
        return preview.edges().stream().anyMatch(edge -> samePreviewEdge(edge, from, to));
    }

    static boolean samePreviewEdge(DungeonEdgeRef edge, Cell from, Cell to) {
        return sameCell(edge.from(), from) && sameCell(edge.to(), to)
                || sameCell(edge.from(), to) && sameCell(edge.to(), from);
    }

    static void assertInternalWallPublishedAndRendered(
            DungeonEditorMapSurfaceSnapshot snapshot,
            DungeonMapContentModel mapContentModel,
            String message
    ) {
        assertTrue(surfaceHasBoundaryKindAt(
                        snapshot,
                        "wall",
                        new Cell(2, 1, 0),
                        new Cell(2, 2, 0)),
                message + " published map includes north internal wall edge");
        assertTrue(surfaceHasBoundaryKindAt(
                        snapshot,
                        "wall",
                        new Cell(2, 2, 0),
                        new Cell(2, 3, 0)),
                message + " published map includes center internal wall edge");
        assertTrue(surfaceHasBoundaryKindAt(
                        snapshot,
                        "wall",
                        new Cell(2, 3, 0),
                        new Cell(2, 4, 0)),
                message + " published map includes south internal wall edge");
        assertTrue(renderHasBoundaryNear(mapContentModel, "WALL", 2.0, 1.5),
                message + " render-facing state includes north internal wall edge");
        assertTrue(renderHasBoundaryNear(mapContentModel, "WALL", 2.0, 2.5),
                message + " render-facing state includes center internal wall edge");
        assertTrue(renderHasBoundaryNear(mapContentModel, "WALL", 2.0, 3.5),
                message + " render-facing state includes south internal wall edge");
    }









    static long createMapThroughControls(
            DungeonEditorControlsView controls,
            TestRuntime runtime,
            String mapName
    ) {
        click(button(controls, "Neu"));
        catalogPopupTextField(controls, "Dungeon-Name").setText(mapName);
        click(catalogPopupButton(controls, "Erstellen"));
        return selectedMapId(runtime.controlsModel().current(), mapName);
    }

    static long selectedMapId(DungeonEditorControlsSnapshot snapshot, String expectedMapName) {
        DungeonMapSummary selected = snapshot.maps().stream()
                .filter(map -> expectedMapName.equals(map.mapName()))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("Map not selected after create: " + expectedMapName));
        return selected.mapId().value();
    }

    static void selectMap(DungeonEditorControlsView controls, String mapName) {
        selectComboItem(comboBox(controls, "Dungeon auswählen"), mapName);
        click(button(controls, "Öffnen"));
    }

    static void fireMapShortcut(DungeonMapView view, KeyCode keyCode) {
        fireMapShortcut(view, keyCode, false, false);
    }

    static void fireMapShortcut(DungeonMapView view, KeyCode keyCode, boolean controlDown, boolean shiftDown) {
        Pane canvasLayer = mapCanvasLayer(view);
        canvasLayer.fireEvent(new KeyEvent(
                KeyEvent.KEY_PRESSED,
                keyCode.getChar(),
                keyCode.getName(),
                keyCode,
                shiftDown,
                controlDown,
                false,
                false));
    }

    static void fireControlsShortcut(Node focusedControl, KeyCode keyCode) {
        focusedControl.requestFocus();
        focusedControl.fireEvent(new KeyEvent(
                KeyEvent.KEY_PRESSED,
                keyCode.getChar(),
                keyCode.getName(),
                keyCode,
                false,
                false,
                false,
                false));
    }

    static void fireMapMousePressed(
            DungeonMapView view,
            MouseButton button,
            boolean shiftDown
    ) {
        fireMapMousePressed(view, button, 80.0, 80.0, shiftDown);
    }

    static void fireMapMousePressed(
            DungeonMapView view,
            MouseButton button,
            double canvasX,
            double canvasY,
            boolean shiftDown
    ) {
        fireMapMouse(view, MouseEvent.MOUSE_PRESSED, button, canvasX, canvasY, shiftDown);
    }

    static void clickMap(
            DungeonMapView view,
            MouseButton button,
            double canvasX,
            double canvasY,
            boolean shiftDown
    ) {
        fireMapMouse(view, MouseEvent.MOUSE_PRESSED, button, canvasX, canvasY, shiftDown);
        fireMapMouse(view, MouseEvent.MOUSE_RELEASED, button, canvasX, canvasY, shiftDown);
    }

    static void dragMap(
            DungeonMapView view,
            MouseButton button,
            double startX,
            double startY,
            double endX,
            double endY
    ) {
        fireMapMouse(view, MouseEvent.MOUSE_PRESSED, button, startX, startY, false);
        fireMapMouse(view, MouseEvent.MOUSE_DRAGGED, button, endX, endY, false);
        fireMapMouse(view, MouseEvent.MOUSE_RELEASED, button, endX, endY, false);
    }

    static void fireMapMouse(
            DungeonMapView view,
            javafx.event.EventType<MouseEvent> eventType,
            MouseButton button,
            double canvasX,
            double canvasY,
            boolean shiftDown
    ) {
        fireMapMouse(view, eventType, button, canvasX, canvasY, shiftDown, false, 1);
    }

    static void fireMapMouseClickCount(
            DungeonMapView view,
            javafx.event.EventType<MouseEvent> eventType,
            MouseButton button,
            double canvasX,
            double canvasY,
            int clickCount
    ) {
        fireMapMouse(view, eventType, button, canvasX, canvasY, false, false, clickCount);
    }

    static void fireMapMouseClickCountWithShift(
            DungeonMapView view,
            javafx.event.EventType<MouseEvent> eventType,
            MouseButton button,
            double canvasX,
            double canvasY,
            int clickCount
    ) {
        fireMapMouse(view, eventType, button, canvasX, canvasY, true, false, clickCount);
    }

    static void fireMapMouseWithControl(
            DungeonMapView view,
            javafx.event.EventType<MouseEvent> eventType,
            MouseButton button,
            double canvasX,
            double canvasY
    ) {
        fireMapMouse(view, eventType, button, canvasX, canvasY, false, true, 1);
    }

    private static void fireMapMouse(
            DungeonMapView view,
            javafx.event.EventType<MouseEvent> eventType,
            MouseButton button,
            double canvasX,
            double canvasY,
            boolean shiftDown,
            boolean controlDown,
            int clickCount
    ) {
        Pane canvasLayer = mapCanvasLayer(view);
        MouseEvent event = new MouseEvent(
                eventType,
                canvasX,
                canvasY,
                canvasX,
                canvasY,
                button,
                clickCount,
                shiftDown,
                controlDown,
                false,
                false,
                button == MouseButton.PRIMARY,
                button == MouseButton.MIDDLE,
                button == MouseButton.SECONDARY,
                false,
                false,
                false,
                null);
        if (eventType == MouseEvent.MOUSE_PRESSED && canvasLayer.getOnMousePressed() != null) {
            canvasLayer.getOnMousePressed().handle(event);
        } else if (eventType == MouseEvent.MOUSE_DRAGGED && canvasLayer.getOnMouseDragged() != null) {
            canvasLayer.getOnMouseDragged().handle(event);
        } else if (eventType == MouseEvent.MOUSE_MOVED && canvasLayer.getOnMouseMoved() != null) {
            canvasLayer.getOnMouseMoved().handle(event);
        } else if (eventType == MouseEvent.MOUSE_RELEASED && canvasLayer.getOnMouseReleased() != null) {
            canvasLayer.getOnMouseReleased().handle(event);
        } else {
            canvasLayer.fireEvent(event);
        }
    }

    static void fireMapScroll(DungeonMapView view, double canvasX, double canvasY, double deltaY) {
        Pane canvasLayer = mapCanvasLayer(view);
        Point2D screenPoint = canvasLayer.localToScreen(canvasX, canvasY);
        ScrollEvent event = new ScrollEvent(
                ScrollEvent.SCROLL,
                canvasX,
                canvasY,
                screenPoint.getX(),
                screenPoint.getY(),
                false,
                false,
                false,
                false,
                false,
                false,
                0.0,
                deltaY,
                0.0,
                deltaY,
                ScrollEvent.HorizontalTextScrollUnits.NONE,
                0.0,
                ScrollEvent.VerticalTextScrollUnits.NONE,
                0.0,
                0,
                null);
        canvasLayer.getOnScroll().handle(event);
    }

    static Pane mapCanvasLayer(DungeonMapView view) {
        return descendants(view).stream()
                .filter(Pane.class::isInstance)
                .map(Pane.class::cast)
                .filter(Pane::isFocusTraversable)
                .filter(pane -> "Dungeon map".equals(pane.getAccessibleText()))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("Dungeon map canvas layer not found."));
    }

    static boolean popupButtonVisible(String text) {
        return popupDescendants().stream()
                .filter(ButtonBase.class::isInstance)
                .map(ButtonBase.class::cast)
                .anyMatch(button -> text.equals(button.getText()) && button.isVisible());
    }

    static ButtonBase popupButton(String text) {
        return popupDescendants().stream()
                .filter(ButtonBase.class::isInstance)
                .map(ButtonBase.class::cast)
                .filter(button -> text.equals(button.getText()) && button.isVisible())
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("Popup button not found: " + text));
    }

    static Parent popupContainer() {
        return popupDescendants().stream()
                .filter(Parent.class::isInstance)
                .map(Parent.class::cast)
                .filter(parent -> parent.getStyleClass().contains("dungeon-editor-popup"))
                .filter(Node::isVisible)
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("Dungeon Editor popup container not found."));
    }

    static boolean popupContainerVisible() {
        return popupDescendants().stream()
                .filter(Parent.class::isInstance)
                .map(Parent.class::cast)
                .anyMatch(parent -> parent.getStyleClass().contains("dungeon-editor-popup") && parent.isVisible());
    }

    static void assertPopupOptionSelected(String text, String message) {
        ButtonBase button = popupButton(text);
        assertTrue(button.getStyleClass().contains("selected"), message + " style");
        assertTrue(button.getAccessibleText().contains("aktiv"), message + " accessibility state");
    }

    static void assertPopupAnchoredBelow(Node anchor, Node popup, String message) {
        Bounds anchorBounds = screenBounds(anchor);
        Bounds popupBounds = screenBounds(popup);
        assertTrue(popupBounds.getMinY() >= anchorBounds.getMaxY() - 1.0,
                message + " popup opens below the focused family button");
        assertTrue(popupBounds.getMaxX() >= anchorBounds.getMinX()
                        && popupBounds.getMinX() <= anchorBounds.getMaxX(),
                message + " popup horizontally overlaps the focused family button");
    }

    static void firePopupMouseExited(Parent popup) {
        Bounds popupBounds = screenBounds(popup);
        popup.fireEvent(new MouseEvent(
                MouseEvent.MOUSE_EXITED,
                1.0,
                1.0,
                popupBounds.getMaxX() + 1.0,
                popupBounds.getMaxY() + 1.0,
                MouseButton.NONE,
                0,
                false,
                false,
                false,
                false,
                false,
                false,
                false,
                false,
                false,
                false,
                null));
    }

    static void firePopupShortcut(Parent popup, KeyCode keyCode) {
        popup.fireEvent(new KeyEvent(
                KeyEvent.KEY_PRESSED,
                keyCode.getChar(),
                keyCode.getName(),
                keyCode,
                false,
                false,
                false,
                false));
    }

    static Bounds screenBounds(Node node) {
        Bounds bounds = node.localToScreen(node.getLayoutBounds());
        if (bounds == null) {
            throw new IllegalStateException("Node has no screen bounds: " + node);
        }
        return bounds;
    }

    static List<Node> popupDescendants() {
        List<Node> nodes = new ArrayList<>();
        for (Window window : Window.getWindows()) {
            if (window.isShowing() && window.getScene() != null && window.getScene().getRoot() != null) {
                nodes.addAll(descendants(window.getScene().getRoot()));
            }
        }
        return nodes;
    }

    static boolean surfaceContainsLevel(DungeonEditorMapSurfaceSnapshot snapshot, int level) {
        return snapshot.surface() != null
                && snapshot.surface().map().areas().stream()
                        .flatMap(area -> area.cells().stream())
                        .anyMatch(cell -> cell.level() == level);
    }

    static Set<String> surfaceCellSet(DungeonEditorMapSurfaceSnapshot snapshot) {
        Set<String> cells = new LinkedHashSet<>();
        if (snapshot.surface() == null) {
            return cells;
        }
        mapSnapshotCellSet(snapshot.surface().map()).forEach(cells::add);
        return cells;
    }

    static Set<String> mapSnapshotCellSet(
            features.dungeon.api.DungeonEditorMapSnapshot mapSnapshot
    ) {
        Set<String> cells = new LinkedHashSet<>();
        if (mapSnapshot == null) {
            return cells;
        }
        mapSnapshot.areas().stream()
                .flatMap(area -> area.cells().stream())
                .map(cell -> cell.q() + "," + cell.r() + "," + cell.level())
                .forEach(cells::add);
        return cells;
    }

    static Set<String> areaCellSet(features.dungeon.api.DungeonEditorMapSnapshot.Area area) {
        Set<String> cells = new LinkedHashSet<>();
        area.cells().stream()
                .map(cell -> cell.q() + "," + cell.r() + "," + cell.level())
                .forEach(cells::add);
        return cells;
    }

    static features.dungeon.api.DungeonEditorMapSnapshot.Area corridorAreaById(
            DungeonEditorMapSurfaceSnapshot snapshot,
            long corridorId,
            String message
    ) {
        return snapshot.surface().map().areas().stream()
                .filter(area -> "CORRIDOR".equalsIgnoreCase(area.kind()))
                .filter(area -> area.id() == corridorId)
                .findFirst()
                .orElseThrow(() -> new AssertionError(message + " corridor area not published: " + corridorId));
    }

    static long singleNewCorridorId(Set<Long> before, Set<Long> after, String message) {
        Set<Long> newIds = new LinkedHashSet<>(after);
        newIds.removeAll(before);
        assertEquals(1L, newIds.size(), message + " creates exactly one corridor row");
        return newIds.iterator().next();
    }

    static long singleNewStairId(List<String> before, List<String> after, String message) {
        Set<Long> newIds = stairIds(after);
        newIds.removeAll(stairIds(before));
        assertEquals(1L, newIds.size(), message + " creates exactly one stair row");
        return newIds.iterator().next();
    }

    static Set<Long> stairIds(List<String> rows) {
        Set<Long> result = new LinkedHashSet<>();
        for (String row : rows == null ? List.<String>of() : rows) {
            if (!row.startsWith("dungeon_stairs|")) {
                continue;
            }
            result.add(Long.parseLong(row.substring("dungeon_stairs|stair_id=".length()).split("[|]")[0]));
        }
        return result;
    }

    static Set<String> stairPathCells(List<String> rows, long stairId) {
        Set<String> result = new LinkedHashSet<>();
        for (String row : rows == null ? List.<String>of() : rows) {
            if (row.startsWith("dungeon_stair_path_nodes|stair_id=" + stairId + "|")) {
                result.add(rowCell(row));
            }
        }
        return result;
    }

    static void assertUniqueStairPathCells(List<String> rows, long stairId, String message) {
        List<String> cells = new ArrayList<>();
        for (String row : rows == null ? List.<String>of() : rows) {
            if (row.startsWith("dungeon_stair_path_nodes|stair_id=" + stairId + "|")) {
                cells.add(rowCell(row));
            }
        }
        assertEquals(cells.size(), new LinkedHashSet<>(cells).size(), message + ": " + cells);
    }

    static Set<String> stairExitCells(List<String> rows, long stairId) {
        Set<String> result = new LinkedHashSet<>();
        for (String row : rows == null ? List.<String>of() : rows) {
            if (row.startsWith("dungeon_stair_exits|stair_exit_id=")
                    && row.contains("|stair_id=" + stairId + "|")) {
                result.add(rowCell(row));
            }
        }
        return result;
    }

    static String rowCell(String row) {
        return rowInt(row, "cell_x=") + "," + rowInt(row, "cell_y=") + "," + rowInt(row, "cell_z=");
    }

    static int rowInt(String row, String marker) {
        int start = row.indexOf(marker);
        if (start < 0) {
            throw new AssertionError("Missing " + marker + " in row: " + row);
        }
        return Integer.parseInt(row.substring(start + marker.length()).split("[|]")[0]);
    }

    static long singleNewAnchorTopologyId(List<String> before, List<String> after, String message) {
        Set<Long> oldIds = topologyIds(before);
        Set<Long> newIds = topologyIds(after);
        newIds.removeAll(oldIds);
        assertEquals(1L, newIds.size(), message + " materializes exactly one anchor topology ref");
        return newIds.iterator().next();
    }

    static long singleAnchorTopologyIdAt(
            List<String> anchorRows,
            int cellX,
            int cellY,
            int cellZ,
            String message
    ) {
        Set<Long> matches = new LinkedHashSet<>();
        for (String row : anchorRows) {
            if (row.contains("|cell_x=" + cellX)
                    && row.contains("|cell_y=" + cellY)
                    && row.contains("|cell_z=" + cellZ)) {
                matches.addAll(topologyIds(List.of(row)));
            }
        }
        assertEquals(1L, matches.size(), message + " fixture has exactly one anchor at split cell");
        return matches.iterator().next();
    }

    static long singleNewDoorTopologyId(List<String> before, List<String> after, String message) {
        Set<Long> oldIds = topologyIds(before);
        Set<Long> newIds = topologyIds(after);
        newIds.removeAll(oldIds);
        assertEquals(1L, newIds.size(), message + " materializes exactly one door topology ref");
        return newIds.iterator().next();
    }

    static Set<Long> topologyIds(List<String> rows) {
        Set<Long> result = new LinkedHashSet<>();
        for (String row : rows == null ? List.<String>of() : rows) {
            String marker = "topology_element_id=";
            int start = row.indexOf(marker);
            if (start >= 0) {
                result.add(Long.parseLong(row.substring(start + marker.length()).split("[,|]")[0]));
            }
        }
        return result;
    }

    static void assertCorridorCreatedInSnapshot(
            DungeonEditorMapSurfaceSnapshot snapshot,
            DungeonMapContentModel mapContentModel,
            long corridorId,
            Set<String> expectedCells,
            String message
    ) {
        var corridorArea = corridorAreaById(snapshot, corridorId, message);
        assertEquals(expectedCells, areaCellSet(corridorArea), message + " published corridor route cells");
        assertEquals(DungeonEditorPreview.none(), snapshot.preview(), message + " preview clears after commit");
        assertTrue(renderSurfaceCellOriginsWithZ(mapContentModel).containsAll(expectedCells),
                message + " render scene contains committed corridor cells");
    }

    static void assertCorridorDoorBindingCount(
            List<String> stableState,
            long corridorId,
            long expectedCount,
            String message
    ) {
        long actual = stableState.stream()
                .filter(row -> row.startsWith("dungeon_corridor_door_overrides|corridor_id=" + corridorId + "|"))
                .count();
        assertEquals(expectedCount, actual, message + " persisted door endpoint binding count");
    }

    static void assertCorridorAnchorRef(
            List<String> stableState,
            long corridorId,
            long topologyElementId,
            String message
    ) {
        boolean found = stableState.stream().anyMatch(row ->
                row.startsWith("dungeon_corridor_anchor_refs|corridor_id=" + corridorId + "|")
                        && row.contains("|topology_element_id=" + topologyElementId));
        assertTrue(found, message + " persisted anchor endpoint ref " + topologyElementId);
    }

    static void assertNoCorridorAnchorRef(
            List<String> stableState,
            long corridorId,
            long topologyElementId,
            String message
    ) {
        boolean found = stableState.stream().anyMatch(row ->
                row.startsWith("dungeon_corridor_anchor_refs|corridor_id=" + corridorId + "|")
                        && row.contains("|topology_element_id=" + topologyElementId));
        assertTrue(!found, message + " removes anchor endpoint ref " + topologyElementId);
    }

    static void assertNoCorridorDoorBinding(
            List<String> stableState,
            long corridorId,
            long topologyElementId,
            String message
    ) {
        boolean found = stableState.stream().anyMatch(row ->
                row.startsWith("dungeon_corridor_door_overrides|corridor_id=" + corridorId + "|")
                        && row.contains("|topology_element_id=" + topologyElementId));
        assertTrue(!found, message + " removes door endpoint binding " + topologyElementId);
    }

    static void assertNoCorridorWaypoints(
            List<String> waypointState,
            long corridorId,
            String message
    ) {
        boolean found = waypointState.stream()
                .anyMatch(row -> row.startsWith("dungeon_corridor_waypoints|corridor_id=" + corridorId + "|"));
        assertTrue(!found, message + " removes corridor waypoint rows");
    }

    static void assertOnlyCorridorWaypointAt(
            List<String> waypointState,
            long corridorId,
            int cellX,
            int cellY,
            int cellZ,
            String message
    ) {
        long corridorRows = waypointState.stream()
                .filter(row -> row.startsWith("dungeon_corridor_waypoints|corridor_id=" + corridorId + "|"))
                .count();
        long matchingRows = waypointState.stream()
                .filter(row -> row.startsWith("dungeon_corridor_waypoints|corridor_id=" + corridorId + "|"))
                .filter(row -> row.contains("|cell_x=" + cellX))
                .filter(row -> row.contains("|cell_y=" + cellY))
                .filter(row -> row.contains("|cell_z=" + cellZ))
                .count();
        assertEquals(1L, corridorRows, message + " persists exactly one split waypoint row");
        assertEquals(1L, matchingRows, message + " persists exactly one split waypoint at the crossing cell");
    }

    static void assertCorridorAnchorHandleAt(
            DungeonEditorMapSurfaceSnapshot snapshot,
            int cellX,
            int cellY,
            int cellZ,
            String message
    ) {
        assertTrue(snapshot.surface().map().editorHandles().stream()
                        .anyMatch(handle -> "CORRIDOR_ANCHOR".equals(handle.ref().kind().name())
                                && handle.cell().q() == cellX
                                && handle.cell().r() == cellY
                                && handle.cell().level() == cellZ),
                message + " published snapshot exposes the reused crossing anchor handle");
    }

    static void assertOnlyCorridorWaypointHandleAt(
            DungeonEditorMapSurfaceSnapshot snapshot,
            long corridorId,
            int cellX,
            int cellY,
            int cellZ,
            String message
    ) {
        long waypointHandles = snapshot.surface().map().editorHandles().stream()
                .filter(handle -> "CORRIDOR_WAYPOINT".equals(handle.ref().kind().name()))
                .filter(handle -> handle.ref().corridorId() == corridorId)
                .count();
        long matchingHandles = snapshot.surface().map().editorHandles().stream()
                .filter(handle -> "CORRIDOR_WAYPOINT".equals(handle.ref().kind().name()))
                .filter(handle -> handle.ref().corridorId() == corridorId)
                .filter(handle -> handle.cell().q() == cellX)
                .filter(handle -> handle.cell().r() == cellY)
                .filter(handle -> handle.cell().level() == cellZ)
                .count();
        assertEquals(1L, waypointHandles, message + " published snapshot exposes exactly one split waypoint handle");
        assertEquals(1L, matchingHandles,
                message + " published snapshot exposes the split waypoint handle");
    }

    static void assertCrossLevelStairInSnapshot(
            DungeonEditorMapSurfaceSnapshot snapshot,
            long stairId,
            String message
    ) {
        DungeonTopologyElementRef ref = new DungeonTopologyElementRef(features.dungeon.api.DungeonTopologyElementKind.STAIR, stairId);
        String activeCell = "4,2," + snapshot.projectionLevel();
        assertTrue(snapshot.surface().map().features().stream()
                        .filter(feature -> "STAIR".equals(feature.kind()))
                        .filter(feature -> feature.id() == stairId)
                        .filter(feature -> feature.topologyRef().equals(ref))
                        .filter(feature -> feature.cells().stream()
                                .map(cell -> cell.q() + "," + cell.r() + "," + cell.level())
                                .collect(java.util.stream.Collectors.toSet())
                                .equals(Set.of(activeCell)))
                        .anyMatch(feature -> feature.description().contains("Ausgaenge")),
                message + " published feature exposes the active-level bound stair exit");
    }

    static void assertStairMovedInSnapshot(
            DungeonEditorMapSurfaceSnapshot snapshot,
            DungeonMapContentModel mapContentModel,
            DungeonTopologyElementRef ref,
            String message
    ) {
        assertTrue(snapshot.surface().map().features().stream()
                        .filter(feature -> "STAIR".equals(feature.kind()))
                        .filter(feature -> feature.topologyRef().equals(editorTopologyRef(ref)))
                        .anyMatch(feature -> feature.cells().stream()
                                .anyMatch(cell -> cell.q() == 3 && cell.r() == 2 && cell.level() == 0)),
                message + " published stair feature includes moved path node");
        assertTrue(snapshot.surface().map().features().stream()
                        .filter(feature -> "STAIR".equals(feature.kind()))
                        .filter(feature -> feature.topologyRef().equals(editorTopologyRef(ref)))
                        .anyMatch(feature -> feature.cells().stream()
                                .anyMatch(cell -> cell.q() == 2 && cell.r() == 2 && cell.level() == 0)),
                message + " published stair feature keeps lower exit cell");
        assertTrue(snapshot.surface().map().editorHandles().stream()
                        .anyMatch(handle -> handle.ref().topologyRef().equals(ref)
                                && handle.ref().kind().name().equals("STAIR_ANCHOR")
                                && handle.cell().q() == 3
                                && handle.cell().r() == 2
                                && handle.cell().level() == 0),
                message + " published handle readback moves the first stair path handle to"
                        + " (3,2,0)");
        assertTrue(renderSurfaceCellOriginsWithZ(mapContentModel).contains("3,2,0"),
                message + " render scene contains moved stair path cell");
        assertTrue(renderHasGlyphAt(mapContentModel, editorTopologyRef(ref), 3.5, 2.5, false),
                message + " render scene shows committed stair handle at (3,2,0)");
    }

    static void assertStraightStairCreatedInSnapshot(
            DungeonEditorMapSurfaceSnapshot snapshot,
            DungeonMapContentModel mapContentModel,
            long stairId,
            int anchorQ,
            int anchorR,
            String message
    ) {
        DungeonTopologyElementRef ref = new DungeonTopologyElementRef(features.dungeon.api.DungeonTopologyElementKind.STAIR, stairId);
        int upperR = anchorR - 2;
        int activeLevel = snapshot.projectionLevel();
        Set<String> expectedFeatureCells = activeLevel == 0
                ? Set.of(
                        anchorQ + "," + anchorR + ",0",
                        anchorQ + "," + (anchorR - 1) + ",0",
                        anchorQ + "," + upperR + ",0")
                : activeLevel == 1
                        ? Set.of(anchorQ + "," + upperR + ",1")
                        : Set.of();
        assertTrue(snapshot.surface().map().features().stream()
                        .filter(feature -> "STAIR".equals(feature.kind()))
                        .filter(feature -> feature.id() == stairId)
                        .filter(feature -> feature.topologyRef().equals(ref))
                        .anyMatch(feature -> feature.cells().stream()
                                .map(cell -> cell.q() + "," + cell.r() + "," + cell.level())
                                .collect(java.util.stream.Collectors.toSet())
                                .equals(expectedFeatureCells)),
                message + " published stair feature exposes exactly the active-level generated"
                        + " path/exit: "
                        + snapshot.surface().map().features());
        var activeStairHandles = snapshot.surface().map().editorHandles().stream()
                .filter(handle -> handle.ref().topologyRef().equals(ref))
                .toList();
        assertTrue(!activeStairHandles.isEmpty()
                        && activeStairHandles.stream().allMatch(handle -> handle.cell().level() == activeLevel),
                message + " publishes only active-level stair handles");
        assertTrue(renderSurfaceCellOriginsWithZ(mapContentModel).containsAll(expectedFeatureCells),
                message + " render scene contains the active-level straight stair cells");
    }

    static void assertTransitionCreatedInSnapshot(
            DungeonEditorMapSurfaceSnapshot snapshot,
            DungeonMapContentModel mapContentModel,
            long transitionId,
            int q,
            int r,
            int level,
            double renderX,
            double renderY,
            String destinationLabel,
            String message
    ) {
        DungeonTopologyElementRef ref = new DungeonTopologyElementRef(features.dungeon.api.DungeonTopologyElementKind.TRANSITION, transitionId);
        assertTrue(snapshot.surface().map().features().stream()
                        .filter(feature -> "TRANSITION".equals(feature.kind()))
                        .filter(feature -> feature.id() == transitionId)
                        .filter(feature -> feature.topologyRef().equals(ref))
                        .anyMatch(feature -> feature.cells().stream()
                                .anyMatch(cell -> cell.q() == q && cell.r() == r && cell.level() == level)
                                && destinationLabel.equals(feature.destinationLabel())),
                message + " published transition feature exposes cell and destination label: "
                        + snapshot.surface().map().features());
        assertTrue(renderHasGlyphAt(mapContentModel, ref, renderX, renderY, false),
                message + " render scene shows committed transition marker");
    }

    static void assertFeatureMarkerCreatedInSnapshot(
            DungeonEditorMapSurfaceSnapshot snapshot,
            DungeonMapContentModel mapContentModel,
            String kind,
            long markerId,
            int q,
            int r,
            int level,
            String message
    ) {
        DungeonTopologyElementRef ref = new DungeonTopologyElementRef(features.dungeon.api.DungeonTopologyElementKind.FEATURE_MARKER, markerId);
        assertTrue(snapshot.surface().map().features().stream()
                        .filter(feature -> kind.equals(feature.kind()))
                        .filter(feature -> feature.id() == markerId)
                        .filter(feature -> feature.topologyRef().equals(ref))
                        .anyMatch(feature -> feature.cells().stream()
                                .anyMatch(cell -> cell.q() == q && cell.r() == r && cell.level() == level)),
                message + " published feature exposes " + kind + " marker cell: "
                        + snapshot.surface().map().features());
        assertTrue(snapshot.surface().map().editorHandles().stream().noneMatch(handle ->
                        handle.ref().topologyRef().equals(ref)),
                message + " marker remains non-handle-indexed");
        assertTrue(renderSurfaceCellOriginsWithZ(mapContentModel).contains(q + "," + r + "," + level),
                message + " render scene contains active-level feature marker cell");
        assertTrue(renderHasGlyphAt(mapContentModel, ref, q + 0.5, r + 0.5, false),
                message + " render scene shows committed feature marker glyph");
        assertTrue(!renderHasTextForRef(mapContentModel, ref),
                message + " render scene omits committed feature marker label text");
    }

    static void assertFeatureMarkerAbsentFromSnapshotAndRender(
            DungeonEditorMapSurfaceSnapshot snapshot,
            DungeonMapContentModel mapContentModel,
            DungeonTopologyElementRef ref,
            Point2D formerCenter,
            String message
    ) {
        assertTrue(snapshot.surface().map().features().stream().noneMatch(feature ->
                        feature.id() == ref.id()
                                && feature.topologyRef().kind()
                                == features.dungeon.api.DungeonTopologyElementKind.FEATURE_MARKER),
                message + " published feature list omits the deleted feature marker");
        assertTrue(snapshot.surface().map().editorHandles().stream().noneMatch(handle ->
                        handle.ref().topologyRef().equals(ref)),
                message + " published handle list still omits feature-marker handles");
        assertTrue(!renderHasGlyphAt(mapContentModel, ref, formerCenter.getX(), formerCenter.getY(), false),
                message + " render scene omits the deleted feature marker glyph");
    }

    static void assertTransitionRowContains(
            List<String> rows,
            long transitionId,
            List<String> fragments,
            String message
    ) {
        boolean matches = rows.stream().anyMatch(row ->
                row.contains("transition_id=" + transitionId) && fragments.stream().allMatch(row::contains));
        assertTrue(matches, message + " rows=" + rows);
    }

    static features.dungeon.api.DungeonEditorHandleSnapshot firstStairHandle(
            DungeonEditorMapSurfaceSnapshot snapshot,
            String message
    ) {
        return snapshot.surface().map().editorHandles().stream()
                .filter(handle -> "STAIR_ANCHOR".equals(handle.ref().kind().name()))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException(message + " stair handle not loaded."));
    }

    static void assertStairAbsentFromSnapshotAndRender(
            DungeonEditorMapSurfaceSnapshot snapshot,
            DungeonMapContentModel mapContentModel,
            DungeonTopologyElementRef ref,
            Point2D formerCenter,
            String message
    ) {
        assertTrue(snapshot.surface().map().features().stream().noneMatch(feature ->
                        feature.id() == ref.id() && "STAIR".equals(feature.kind())),
                message + " published feature list omits deleted stair");
        assertTrue(snapshot.surface().map().editorHandles().stream().noneMatch(handle ->
                        handle.ref().topologyRef().id() == ref.id()
                                && "STAIR".equals(handle.ref().topologyRef().kind().name())),
                message + " published handle list omits deleted stair handles");
        String selectionRef = ref.kind() + ":" + ref.id();
        assertTrue(mapContentModel.canvasStateProperty().get().renderScene().surfaces().stream()
                        .noneMatch(surface -> selectionRef.equals(surface.selectionRef())),
                message + " render scene omits deleted stair path and exit surfaces");
        assertTrue(!renderHasGlyphAt(mapContentModel, ref, formerCenter.getX(), formerCenter.getY(), false),
                message + " render scene omits deleted stair marker");
    }

    static features.dungeon.api.DungeonEditorHandleSnapshot firstCorridorAnchorHandle(
            DungeonEditorMapSurfaceSnapshot snapshot,
            String message
    ) {
        return snapshot.surface().map().editorHandles().stream()
                .filter(handle -> "CORRIDOR_ANCHOR".equals(handle.ref().kind().name()))
                .findFirst()
                .orElseThrow(() -> new AssertionError(message + " corridor anchor handle not published"));
    }

    static features.dungeon.api.DungeonEditorHandleSnapshot firstDoorHandleAt(
            DungeonEditorMapSurfaceSnapshot snapshot,
            int cellX,
            int cellY,
            int cellZ,
            String message
    ) {
        return snapshot.surface().map().editorHandles().stream()
                .filter(handle -> "DOOR".equals(handle.ref().kind().name()))
                .filter(handle -> handle.cell().q() == cellX)
                .filter(handle -> handle.cell().r() == cellY)
                .filter(handle -> handle.cell().level() == cellZ)
                .findFirst()
                .orElseThrow(() -> new AssertionError(message + " door handle not published"));
    }

    static Point2D doorHandleCenterAt(
            DungeonEditorMapSurfaceSnapshot snapshot,
            DungeonMapContentModel mapContentModel,
            int cellX,
            int cellY,
            int cellZ,
            String message
    ) {
        var handle = firstDoorHandleAt(snapshot, cellX, cellY, cellZ, message);
        return glyphCenterForRef(
                mapContentModel,
                editorTopologyRef(handle.ref().topologyRef()));
    }

    static features.dungeon.api.DungeonEditorHandleSnapshot firstClusterCornerHandleAt(
            DungeonEditorMapSurfaceSnapshot snapshot,
            int cellX,
            int cellY,
            int cellZ,
            String message
    ) {
        return snapshot.surface().map().editorHandles().stream()
                .filter(handle -> "CLUSTER_CORNER".equals(handle.ref().kind().name()))
                .filter(handle -> handle.cell().q() == cellX)
                .filter(handle -> handle.cell().r() == cellY)
                .filter(handle -> handle.cell().level() == cellZ)
                .findFirst()
                .orElseThrow(() -> new AssertionError(message + " cluster corner handle not published"));
    }

    static void assertClusterCornerHandleAt(
            DungeonEditorMapSurfaceSnapshot snapshot,
            int cellX,
            int cellY,
            int cellZ,
            String message
    ) {
        firstClusterCornerHandleAt(snapshot, cellX, cellY, cellZ, message);
    }

    static void assertPointerTarget(
            DungeonMapContentModel mapContentModel,
            Point2D scenePoint,
            DungeonEditorRuntimePointerTarget.TargetKind expectedKind,
            String message
    ) {
        assertEquals(expectedKind,
                runtimePointerTarget(mapContentModel, scenePoint.getX(), scenePoint.getY()).targetKind(),
                message + " input route resolves expected runtime map hit target");
    }

    static TestRuntimePointerTarget runtimePointerTarget(
            DungeonMapContentModel mapContentModel,
            double sceneX,
            double sceneY
    ) {
        return runtimePointerTarget(mapContentModel, sceneX, sceneY, false);
    }

    static TestRuntimePointerTarget runtimePointerTarget(
            DungeonMapContentModel mapContentModel,
            double sceneX,
            double sceneY,
            boolean boundaryPreferred
    ) {
        return runtimePointerTarget(mapContentModel, sceneX, sceneY, boundaryPreferred, 0);
    }

    static TestRuntimePointerTarget runtimePointerTarget(
            DungeonMapContentModel mapContentModel,
            double sceneX,
            double sceneY,
            boolean boundaryPreferred,
            int projectionLevel
    ) {
        List<PointerTarget> localTargets = mapContentModel.pointerTargetsAt(sceneX, sceneY);
        List<DungeonEditorRuntimePointerTarget> runtimeTargets = localTargets.stream()
                .map(DungeonEditorTestSupport::runtimeTarget)
                .toList();
        DungeonEditorRuntimePointerTarget selected = PointerInteractionTargets.fromRuntimeTargets(
                sceneX,
                sceneY,
                false,
                false,
                runtimeTargets,
                projectionLevel).primaryTarget(boundaryPreferred);
        int selectedIndex = runtimeTargets.indexOf(selected);
        PointerTarget localTarget = selectedIndex < 0 ? PointerTarget.empty() : localTargets.get(selectedIndex);
        return new TestRuntimePointerTarget(selected, localTarget);
    }

    static void updateHoverTarget(
            DungeonMapContentModel mapContentModel,
            TestRuntimePointerTarget target
    ) {
        mapContentModel.updateHoverTarget(target.localTarget());
    }

    private static DungeonEditorRuntimePointerTarget runtimeTarget(PointerTarget target) {
        DungeonEditorPointerInput.Target source = target == null
                ? DungeonEditorPointerInput.Target.empty()
                : target.toApiTarget();
        DungeonEditorPointerInput.BoundaryTarget boundary = source.boundary();
        return new DungeonEditorRuntimePointerTarget(
                enumValue(DungeonEditorRuntimePointerTarget.TargetKind.class,
                        source.targetKind(), DungeonEditorRuntimePointerTarget.TargetKind.EMPTY),
                enumValue(DungeonEditorRuntimePointerTarget.LabelKind.class,
                        source.labelKind(), DungeonEditorRuntimePointerTarget.LabelKind.EMPTY),
                enumValue(DungeonEditorRuntimePointerTarget.ElementKind.class,
                        source.elementKind(), DungeonEditorRuntimePointerTarget.ElementKind.EMPTY),
                source.ownerId(),
                source.clusterId(),
                enumValue(DungeonEditorRuntimePointerTarget.TopologyKind.class,
                        source.topologyKind(), DungeonEditorRuntimePointerTarget.TopologyKind.EMPTY),
                source.topologyId(),
                source.handleRef(),
                new DungeonEditorRuntimePointerTarget.BoundaryTarget(
                        enumValue(DungeonEditorRuntimePointerTarget.BoundaryKind.class,
                                boundary.boundaryKind(), DungeonEditorRuntimePointerTarget.BoundaryKind.WALL),
                        boundary.key(),
                        boundary.ownerId(),
                        enumValue(DungeonEditorRuntimePointerTarget.TopologyKind.class,
                                boundary.topologyKind(), DungeonEditorRuntimePointerTarget.TopologyKind.EMPTY),
                        boundary.topologyId(),
                        boundary.startQ(), boundary.startR(), boundary.startLevel(),
                        boundary.endQ(), boundary.endR(), boundary.endLevel()),
                enumValue(DungeonEditorRuntimePointerTarget.SyntheticHoverKind.class,
                        source.syntheticHoverKind(), DungeonEditorRuntimePointerTarget.SyntheticHoverKind.NONE),
                new DungeonEditorRuntimePointerTarget.CellTarget(
                        source.cell().exact(), source.cell().q(), source.cell().r(), source.cell().level()),
                new DungeonEditorRuntimePointerTarget.VertexTarget(
                        source.vertex().exact(), source.vertex().q(), source.vertex().r(), source.vertex().level()));
    }

    private static <E extends Enum<E>> E enumValue(Class<E> type, String name, E fallback) {
        try {
            return Enum.valueOf(type, name == null ? "" : name);
        } catch (IllegalArgumentException ignored) {
            return fallback;
        }
    }

    record TestRuntimePointerTarget(
            DungeonEditorRuntimePointerTarget rawTarget,
            PointerTarget localTarget
    ) {
        TestRuntimePointerTarget {
            rawTarget = rawTarget == null ? DungeonEditorRuntimePointerTarget.empty() : rawTarget;
            localTarget = localTarget == null ? PointerTarget.empty() : localTarget;
        }

        DungeonEditorRuntimePointerTarget.TargetKind targetKind() {
            return rawTarget.targetKind();
        }

        DungeonEditorRuntimePointerTarget.LabelKind labelKind() {
            return rawTarget.labelKind();
        }

        DungeonEditorRuntimePointerTarget.ElementKind elementKind() {
            return rawTarget.elementKind();
        }

        long ownerId() {
            return rawTarget.ownerId();
        }

        long clusterId() {
            return rawTarget.clusterId();
        }

        DungeonEditorRuntimePointerTarget.TopologyKind topologyKind() {
            return rawTarget.topologyKind();
        }

        String topologyRefText() {
            DungeonEditorRuntimePointerTarget.TopologyKind kind = rawTarget.topologyKind();
            return kind == DungeonEditorRuntimePointerTarget.TopologyKind.EMPTY ? "" : kind.name();
        }

        long topologyId() {
            return rawTarget.topologyId();
        }

        features.dungeon.api.DungeonEditorHandleRef handleRef() {
            return rawTarget.handleRef();
        }

        DungeonEditorRuntimePointerTarget.BoundaryTarget boundaryRef() {
            return rawTarget.boundary();
        }

        DungeonEditorRuntimePointerTarget.CellTarget cellRef() {
            return rawTarget.cell();
        }

        boolean isEmptyTarget() {
            return rawTarget.targetKind() == DungeonEditorRuntimePointerTarget.TargetKind.EMPTY;
        }

        boolean isBoundaryTarget() {
            return rawTarget.isBoundaryTarget();
        }

        boolean isCellTarget() {
            return rawTarget.isCellTarget();
        }

        boolean isHandleTarget() {
            return rawTarget.isHandleTarget();
        }

        boolean isLabelTarget() {
            return rawTarget.isLabelTarget();
        }

        boolean isMarkerTarget() {
            return rawTarget.isMarkerTarget();
        }

        boolean isGraphNodeTarget() {
            return rawTarget.isGraphNodeTarget();
        }
    }

    static Set<String> persistedClusterCellsThroughRepository(long mapId, long clusterId, int level) {
        Set<String> cells = new LinkedHashSet<>();
        try (platform.persistence.SqliteDatabase database = platform.persistence.SqliteDatabase.defaultDatabase(
                DungeonPersistenceSchema.DATABASE_FILE_NAME,
                platform.diagnostics.NoopDiagnostics.INSTANCE);
                var connection =
                        TestFeatureStores.store(
                                database,
                                FeatureStoreDefinition.of("dungeon-test-inspection")).openConnection();
                var statement = connection.prepareStatement(
                        "SELECT c.cell_x,c.cell_y,c.level_z FROM " + DungeonPersistenceSchema.ROOM_CELLS_TABLE + " c"
                                + " JOIN " + DungeonPersistenceSchema.ROOMS_TABLE + " r ON r.room_id=c.room_id WHERE r.dungeon_map_id=? AND"
                                        + " r.cluster_id=? AND c.level_z=? ORDER BY"
                                        + " c.level_z,c.cell_y,c.cell_x")) {
            statement.setLong(1, mapId);
            statement.setLong(2, clusterId);
            statement.setInt(3, level);
            try (var rows = statement.executeQuery()) {
                while (rows.next()) {
                    cells.add(cellKey(new Cell(
                            rows.getInt("cell_x"), rows.getInt("cell_y"), rows.getInt("level_z"))));
                }
            }
            return Set.copyOf(cells);
        } catch (Exception exception) {
            throw new AssertionError("Failed to read persisted cluster cells for map " + mapId, exception);
        }
    }

    static features.dungeon.api.DungeonEditorMapSnapshot.Area roomAreaByLabel(
            DungeonEditorMapSurfaceSnapshot snapshot,
            String label,
            String message
    ) {
        return snapshot.surface().map().areas().stream()
                .filter(area -> "ROOM".equalsIgnoreCase(area.kind()))
                .filter(area -> label.equals(area.label()))
                .findFirst()
                .orElseThrow(() -> new AssertionError(message + " room area not published"));
    }

    static features.dungeon.api.DungeonEditorMapSnapshot.Area roomAreaByCells(
            DungeonEditorMapSurfaceSnapshot snapshot,
            Set<String> expectedCells,
            String message
    ) {
        return snapshot.surface().map().areas().stream()
                .filter(area -> "ROOM".equalsIgnoreCase(area.kind()))
                .filter(area -> areaCellSet(area).equals(expectedCells))
                .findFirst()
                .orElseThrow(() -> new AssertionError(message + " room area not published"));
    }

    static void assertNoOverlappingSurfaceCellOwnership(
            DungeonEditorMapSurfaceSnapshot snapshot,
            String message
    ) {
        Set<String> seenCells = new LinkedHashSet<>();
        for (var area : snapshot.surface().map().areas()) {
            for (var cell : area.cells()) {
                String key = cell.q() + "," + cell.r() + "," + cell.level();
                assertTrue(seenCells.add(key), message + " overlapping cell ownership at " + key);
            }
        }
    }

    static void assertDisjoint(Set<String> actual, Set<String> forbidden, String message) {
        Set<String> overlap = new LinkedHashSet<>(actual);
        overlap.retainAll(forbidden);
        assertTrue(overlap.isEmpty(), message + " overlap=" + overlap);
    }

    static Set<String> renderSurfaceCellOrigins(DungeonMapContentModel mapContentModel) {
        Set<String> cells = new LinkedHashSet<>();
        mapContentModel.canvasStateProperty().get().renderScene().surfaces().stream()
                .map(surface -> surface.polygon().stream()
                        .reduce((first, ignored) -> first)
                        .orElseThrow())
                .map(point -> ((int) point.x()) + "," + ((int) point.y()))
                .forEach(cells::add);
        return cells;
    }

    static Set<String> renderSurfaceCellOriginsWithZ(DungeonMapContentModel mapContentModel) {
        Set<String> cells = new LinkedHashSet<>();
        mapContentModel.canvasStateProperty().get().renderScene().surfaces().stream()
                .map(surface -> surface.polygon().stream()
                        .reduce((first, ignored) -> first)
                        .map(point -> ((int) point.x()) + "," + ((int) point.y()) + "," + surface.z())
                        .orElseThrow())
                .forEach(cells::add);
        return cells;
    }

    static Set<String> renderPreviewSurfaceCellOriginsWithZ(DungeonMapContentModel mapContentModel) {
        Set<String> cells = new LinkedHashSet<>();
        mapContentModel.canvasStateProperty().get().renderScene().surfaces().stream()
                .filter(surface -> surface.style().alpha() < 1.0)
                .map(surface -> surface.polygon().stream()
                        .reduce((first, ignored) -> first)
                        .map(point -> ((int) point.x()) + "," + ((int) point.y()) + "," + surface.z())
                        .orElseThrow())
                .forEach(cells::add);
        return cells;
    }

    static String renderSelectionRefAtCell(
            DungeonMapContentModel mapContentModel,
            int q,
            int r,
            int level
    ) {
        return mapContentModel.canvasStateProperty().get().renderScene().surfaces().stream()
                .filter(surface -> surface.z() == level)
                .filter(surface -> surface.polygon().stream()
                        .findFirst()
                        .map(point -> ((int) point.x()) == q && ((int) point.y()) == r)
                        .orElse(false))
                .map(DungeonMapContentModel.MapCanvasPolygonPrimitive::selectionRef)
                .filter(selectionRef -> !selectionRef.isBlank())
                .findFirst()
                .orElseThrow(() -> new AssertionError("Render surface not found at " + q + "," + r + "," + level));
    }

    static boolean renderHasSelectedSurfacePrimitive(
            DungeonMapContentModel mapContentModel,
            DungeonTopologyElementRef ref
    ) {
        String selectionRef = ref.kind() + ":" + ref.id();
        return mapContentModel.canvasStateProperty().get().renderScene().surfaces().stream()
                .anyMatch(surface -> selectionRef.equals(surface.selectionRef())
                        && surface.style().strokeWidth() > (2.0 / DEFAULT_GRID_SIZE));
    }

    static boolean renderHasSurfacePrimitive(
            DungeonMapContentModel mapContentModel,
            DungeonTopologyElementRef ref
    ) {
        String selectionRef = ref.kind() + ":" + ref.id();
        return mapContentModel.canvasStateProperty().get().renderScene().surfaces().stream()
                .anyMatch(surface -> selectionRef.equals(surface.selectionRef()));
    }

    static boolean renderHasSelectedGlyphPrimitive(
            DungeonMapContentModel mapContentModel,
            DungeonTopologyElementRef ref
    ) {
        String selectionRef = ref.kind() + ":" + ref.id();
        return mapContentModel.canvasStateProperty().get().renderScene().glyphs().stream()
                .anyMatch(glyph -> selectionRef.equals(glyph.selectionRef())
                        && glyph.style().strokeWidth() > (1.4 / DEFAULT_GRID_SIZE));
    }

    static Point2D glyphCenterForRef(
            DungeonMapContentModel mapContentModel,
            DungeonTopologyElementRef ref
    ) {
        String selectionRef = ref.kind() + ":" + ref.id();
        return mapContentModel.canvasStateProperty().get().renderScene().glyphs().stream()
                .filter(glyph -> selectionRef.equals(glyph.selectionRef()))
                .map(glyph -> {
                    double x = glyph.polygon().stream().mapToDouble(DungeonMapContentModel.MapCanvasPoint::x).average()
                            .orElseThrow();
                    double y = glyph.polygon().stream().mapToDouble(DungeonMapContentModel.MapCanvasPoint::y).average()
                            .orElseThrow();
                    return new Point2D(x, y);
                })
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("Glyph not found for " + selectionRef));
    }

    static Point2D labelCenterForRef(
            DungeonMapContentModel mapContentModel,
            DungeonTopologyElementRef ref
    ) {
        String selectionRef = ref.kind() + ":" + ref.id();
        return mapContentModel.canvasStateProperty().get().renderScene().texts().stream()
                .filter(text -> selectionRef.equals(text.selectionRef()))
                .map(text -> new Point2D(text.centerX(), text.centerY()))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("Label not found for " + selectionRef));
    }

    static boolean renderHasTextAt(
            DungeonMapContentModel mapContentModel,
            DungeonTopologyElementRef ref,
            double expectedX,
            double expectedY,
            boolean preview
    ) {
        String selectionRef = ref.kind() + ":" + ref.id();
        return mapContentModel.canvasStateProperty().get().renderScene().texts().stream()
                .filter(text -> selectionRef.equals(text.selectionRef()))
                .filter(text -> preview ? text.style().alpha() < 1.0 : text.style().alpha() == 1.0)
                .map(text -> new Point2D(text.centerX(), text.centerY()))
                .anyMatch(point -> point.distance(expectedX, expectedY) < 0.000_001);
    }

    static boolean renderHasGlyphAt(
            DungeonMapContentModel mapContentModel,
            DungeonTopologyElementRef ref,
            double expectedX,
            double expectedY,
            boolean preview
    ) {
        String selectionRef = ref.kind() + ":" + ref.id();
        return mapContentModel.canvasStateProperty().get().renderScene().glyphs().stream()
                .filter(glyph -> selectionRef.equals(glyph.selectionRef()))
                .filter(glyph -> preview ? glyph.style().alpha() < 1.0 : glyph.style().alpha() == 1.0)
                .map(glyph -> {
                    double x = glyph.polygon().stream().mapToDouble(DungeonMapContentModel.MapCanvasPoint::x).average()
                            .orElseThrow();
                    double y = glyph.polygon().stream().mapToDouble(DungeonMapContentModel.MapCanvasPoint::y).average()
                            .orElseThrow();
                    return new Point2D(x, y);
                })
                .anyMatch(point -> point.distance(expectedX, expectedY) < 0.000_001);
    }

    static boolean renderHasTextForRef(
            DungeonMapContentModel mapContentModel,
            DungeonTopologyElementRef ref
    ) {
        String selectionRef = ref.kind() + ":" + ref.id();
        return mapContentModel.canvasStateProperty().get().renderScene().texts().stream()
                .anyMatch(text -> selectionRef.equals(text.selectionRef()));
    }

    static boolean renderHasHoverText(
            DungeonMapContentModel mapContentModel,
            String expectedText
    ) {
        return mapContentModel.canvasStateProperty().get().hoverTexts().stream()
                .anyMatch(text -> expectedText.equals(text.text()));
    }

    static DungeonTopologyElementRef editorTopologyRef(DungeonTopologyElementRef ref) {
        return ref == null ? DungeonTopologyElementRef.empty() : ref;
    }

    static boolean renderHasBoundaryPrimitive(
            DungeonMapContentModel mapContentModel,
            DungeonTopologyElementRef ref
    ) {
        String selectionRef = ref.kind() + ":" + ref.id();
        return mapContentModel.canvasStateProperty().get().renderScene().boundaries().stream()
                .anyMatch(boundary -> selectionRef.equals(boundary.selectionRef()));
    }

    static boolean renderHasSelectedDoorBoundaryPrimitive(
            DungeonMapContentModel mapContentModel,
            DungeonTopologyElementRef ref
    ) {
        String selectionRef = ref.kind() + ":" + ref.id();
        return mapContentModel.canvasStateProperty().get().renderScene().boundaries().stream()
                .anyMatch(boundary -> selectionRef.equals(boundary.selectionRef())
                        && boundary.style().stroke().equals(DungeonMapContentModel.RenderColor.color(0xf1, 0xd3, 0x8a, 1.0))
                        && boundary.style().strokeWidth() > (3.6 / DEFAULT_GRID_SIZE));
    }

    static boolean selectedDoorBoundaryDiffersFromNormalDoorStyle(
            DungeonMapContentModel mapContentModel,
            DungeonTopologyElementRef selectedRef
    ) {
        String selectedSelectionRef = selectedRef.kind() + ":" + selectedRef.id();
        return mapContentModel.canvasStateProperty().get().renderScene().boundaries().stream()
                .filter(boundary -> selectedSelectionRef.equals(boundary.selectionRef()))
                .anyMatch(boundary -> !boundary.style().stroke().equals(
                        DungeonMapContentModel.RenderColor.color(0xc6, 0xe2, 0xff, 1.0))
                        && boundary.style().strokeWidth() != (3.6 / DEFAULT_GRID_SIZE));
    }

    static void assertDoorInspector(
            DungeonInspectorSnapshot inspector,
            DungeonTopologyElementRef doorRef,
            String doorLabel
    ) {
        if (inspector == null) {
            throw new AssertionError("DE-SEL-002 inspector is published for selected door");
        }
        assertEquals(doorLabel, inspector.title(), "DE-SEL-002 inspector title identifies selected door");
        assertEquals("Authorisierte Dungeon-Grenze.", inspector.summary(),
                "DE-SEL-002 inspector summary identifies selected boundary topology");
        assertEquals(features.dungeon.api.DungeonTopologyElementKind.DOOR, doorRef.kind(),
                "DE-SEL-002 selected typed topology ref identifies a door");
        assertEquals(DungeonInspectorSnapshot.StatePanelFacts.empty(), inspector.statePanelFacts(),
                "DE-SEL-002 door inspector publishes no unrelated stair or transition panel state");
    }

    static void assertDoorOwningRoomFacts(
            DungeonEditorMapSurfaceSnapshot surface,
            features.dungeon.api.DungeonEditorMapSnapshot.Boundary doorBoundary
    ) {
        var owningArea = surface.surface().map().areas().stream()
                .filter(area -> "ROOM".equalsIgnoreCase(area.kind()))
                .filter(area -> area.cells().stream().anyMatch(cell ->
                        cell.level() == doorBoundary.edge().from().level()
                                && cell.r() == doorBoundary.edge().from().r()
                                && (cell.q() == doorBoundary.edge().from().q()
                                || cell.q() == doorBoundary.edge().from().q() - 1)))
                .findFirst()
                .orElseThrow(() -> new AssertionError(
                                                "DE-SEL-002 published facts identify the door"
                                                    + " owning room"));
        assertEquals("R1", owningArea.label(), "DE-SEL-002 published facts identify the door owning room label");
        assertTrue(owningArea.clusterId() > 0L,
                "DE-SEL-002 published facts identify the door owning room/cluster id");
    }

    static Set<String> cellRect(int minQ, int minR, int maxQ, int maxR, int level) {
        Set<String> expectedCells = new LinkedHashSet<>();
        for (int q = minQ; q <= maxQ; q++) {
            for (int r = minR; r <= maxR; r++) {
                expectedCells.add(q + "," + r + "," + level);
            }
        }
        return expectedCells;
    }

    static String cellKey(features.dungeon.api.DungeonCellRef cell) {
        return cell.q() + "," + cell.r() + "," + cell.level();
    }

    static String cellKey(Cell cell) {
        return cell.q() + "," + cell.r() + "," + cell.level();
    }

    static String surfaceBoundarySummary(DungeonEditorMapSurfaceSnapshot snapshot) {
        return snapshot.surface().map().boundaries().stream()
                .map(boundary -> boundary.kind()
                        + ":"
                        + boundary.edge().from().q()
                        + ","
                        + boundary.edge().from().r()
                        + "->"
                        + boundary.edge().to().q()
                        + ","
                        + boundary.edge().to().r())
                .toList()
                .toString();
    }

    static void assertNoPublishedBoundaryBetween(
            DungeonEditorMapSurfaceSnapshot snapshot,
            int q,
            int r,
            int level,
            Direction direction,
            String message
    ) {
        Cell from = new Cell(q, r, level);
        Cell to = direction.neighborOf(from);
        boolean present = snapshot.surface().map().boundaries().stream()
                .map(boundary -> boundary.edge())
                .anyMatch(edge -> sameEdge(edge, from, to));
        assertTrue(!present, message + " boundaries=" + surfaceBoundarySummary(snapshot));
    }

    static boolean surfaceHasBoundaryKindAt(
            DungeonEditorMapSurfaceSnapshot snapshot,
            String kind,
            Cell from,
            Cell to
    ) {
        return snapshot.surface().map().boundaries().stream()
                .filter(boundary -> kind.equalsIgnoreCase(boundary.kind()))
                .map(boundary -> boundary.edge())
                .anyMatch(edge -> sameEdge(edge, from, to));
    }

    static boolean sameEdge(
            features.dungeon.api.DungeonEdgeRef edge,
            Cell from,
            Cell to
    ) {
        return sameCell(edge.from(), from) && sameCell(edge.to(), to)
                || sameCell(edge.from(), to) && sameCell(edge.to(), from);
    }

    static boolean sameCell(features.dungeon.api.DungeonCellRef left, Cell right) {
        return left.q() == right.q() && left.r() == right.r() && left.level() == right.level();
    }

    static Point2D boundaryMidpointNear(
            DungeonMapContentModel mapContentModel,
            String selectionKind,
            double expectedX,
            double expectedY
    ) {
        return mapContentModel.canvasStateProperty().get().renderScene().boundaries().stream()
                .filter(boundary -> boundary.selectionRef().startsWith(selectionKind + ":"))
                .map(boundary -> {
                    var start = boundary.polyline().getFirst();
                    var end = boundary.polyline().getLast();
                    return new Point2D((start.x() + end.x()) / 2.0, (start.y() + end.y()) / 2.0);
                })
                .min((left, right) -> Double.compare(
                        left.distance(expectedX, expectedY),
                        right.distance(expectedX, expectedY)))
                .orElseThrow(() -> new IllegalStateException("Boundary not found near expected point."));
    }

    static boolean renderHasBoundaryNear(
            DungeonMapContentModel mapContentModel,
            String selectionKind,
            double expectedX,
            double expectedY
    ) {
        return mapContentModel.canvasStateProperty().get().renderScene().boundaries().stream()
                .filter(boundary -> boundary.selectionRef().startsWith(selectionKind + ":"))
                .map(boundary -> {
                    var start = boundary.polyline().getFirst();
                    var end = boundary.polyline().getLast();
                    return new Point2D((start.x() + end.x()) / 2.0, (start.y() + end.y()) / 2.0);
                })
                .anyMatch(point -> point.distance(expectedX, expectedY) < 0.000_001);
    }

    static boolean renderHasAnyBoundaryNear(
            DungeonMapContentModel mapContentModel,
            double expectedX,
            double expectedY
    ) {
        return mapContentModel.canvasStateProperty().get().renderScene().boundaries().stream()
                .map(DungeonEditorTestSupport::boundaryMidpoint)
                .anyMatch(point -> point.distance(expectedX, expectedY) < 0.000_001);
    }

    static Point2D boundaryMidpoint(DungeonMapContentModel.BoundaryPrimitive boundary) {
        var start = boundary.polyline().getFirst();
        var end = boundary.polyline().getLast();
        return new Point2D((start.x() + end.x()) / 2.0, (start.y() + end.y()) / 2.0);
    }

    static void assertSelectionMatches(
            DungeonTopologyElementRef expectedRef,
            long expectedClusterId,
            DungeonEditorStateSnapshot.Selection selection,
            String message
    ) {
        assertEquals(expectedRef, selection.topologyRef(), message + " selected topology ref");
        assertEquals(expectedClusterId, selection.clusterId(), message + " selected cluster id");
    }

    static void assertHandleSelectionMatches(
            features.dungeon.api.DungeonEditorHandleRef expected,
            features.dungeon.api.DungeonEditorHandleRef actual,
            String message
    ) {
        assertTrue(actual != null, message + " is present");
        assertEquals(expected.kind(), actual.kind(), message + " kind");
        assertEquals(expected.topologyRef(), actual.topologyRef(), message + " topology ref");
        assertEquals(expected.ownerId(), actual.ownerId(), message + " owner id");
        assertEquals(expected.clusterId(), actual.clusterId(), message + " cluster id");
        assertEquals(expected.corridorId(), actual.corridorId(), message + " corridor id");
        assertEquals(expected.roomId(), actual.roomId(), message + " room id");
        assertEquals(expected.index(), actual.index(), message + " index");
        assertEquals(expected.cell(), actual.cell(), message + " cell");
    }

    static void assertEmptySelection(
            DungeonEditorStateSnapshot.Selection selection,
            String message
    ) {
        assertEquals(DungeonTopologyElementRef.empty(), selection.topologyRef(), message + " topology ref");
        assertEquals(0L, selection.clusterId(), message + " cluster id");
        assertTrue(!selection.clusterSelection(), message + " cluster selection flag");
        assertTrue(selection.handleRef() == null, message + " handle ref");
    }

    static void assertOverlaySettings(
            DungeonOverlaySettings settings,
            String modeKey,
            int levelRange,
            double opacity,
            List<Integer> selectedLevels,
            String message
    ) {
        assertEquals(modeKey, settings.modeKey(), message + " mode");
        assertEquals(levelRange, settings.levelRange(), message + " range");
        assertDoubleEquals(opacity, settings.opacity(), message + " opacity");
        assertEquals(selectedLevels, settings.selectedLevels(), message + " selected levels");
    }

    static void assertVisiblePlaceholder(DungeonMapView mapView, String rowId) {
        boolean visiblePlaceholder = descendants(mapView).stream()
                .filter(Label.class::isInstance)
                .map(Label.class::cast)
                .anyMatch(label -> label.isVisible() && !label.getText().isBlank());
        assertTrue(visiblePlaceholder, rowId + " rendered map view exposes the empty-map placeholder");
    }

    static void assertCanvasPaintedAtScene(
            DungeonMapView mapView,
            double sceneX,
            double sceneY,
            String message
    ) {
        CanvasSnapshot snapshot = renderedCanvasSnapshot(mapView);
        WritableImage image = snapshot.image();
        int x = clampPixel((int) Math.round(snapshot.viewport().sceneToScreenX(sceneX)), (int) image.getWidth());
        int y = clampPixel((int) Math.round(snapshot.viewport().sceneToScreenY(sceneY)), (int) image.getHeight());
        Color color = image.getPixelReader().getColor(x, y);
        assertTrue(colorDistance(color, MAP_BACKGROUND) > CANVAS_BACKGROUND_DISTANCE_THRESHOLD,
                message + " pixel=" + color);
    }

    static void assertCanvasPaintedNearScene(
            DungeonMapView mapView,
            double sceneX,
            double sceneY,
            int radiusPixels,
            String message
    ) {
        CanvasSnapshot snapshot = renderedCanvasSnapshot(mapView);
        WritableImage image = snapshot.image();
        int x = clampPixel((int) Math.round(snapshot.viewport().sceneToScreenX(sceneX)), (int) image.getWidth());
        int y = clampPixel((int) Math.round(snapshot.viewport().sceneToScreenY(sceneY)), (int) image.getHeight());
        int radius = Math.max(0, radiusPixels);
        for (int dy = -radius; dy <= radius; dy++) {
            for (int dx = -radius; dx <= radius; dx++) {
                if ((dx * dx) + (dy * dy) > radius * radius) {
                    continue;
                }
                int sampleX = clampPixel(x + dx, (int) image.getWidth());
                int sampleY = clampPixel(y + dy, (int) image.getHeight());
                Color color = image.getPixelReader().getColor(sampleX, sampleY);
                if (colorDistance(color, MAP_BACKGROUND) > CANVAS_BACKGROUND_DISTANCE_THRESHOLD) {
                    return;
                }
            }
        }
        assertTrue(false, message + " centerPixel=" + image.getPixelReader().getColor(x, y));
    }

    static void assertCanvasPaintedWithPrimitiveStrokeNearScene(
            DungeonMapView mapView,
            DungeonMapContentModel.MapCanvasPolygonPrimitive primitive,
            double sceneX,
            double sceneY,
            int radiusPixels,
            String message
    ) {
        DungeonMapContentModel.PaintStyle style = primitive.style();
        DungeonMapContentModel.RenderColor stroke = style.stroke();
        assertTrue(stroke != null && style.strokeWidth() > 0.0,
                message + " primitive exposes a drawable stroke");

        CanvasSnapshot snapshot = renderedCanvasSnapshot(mapView);
        WritableImage image = snapshot.image();
        int x = clampPixel((int) Math.round(snapshot.viewport().sceneToScreenX(sceneX)), (int) image.getWidth());
        int y = clampPixel((int) Math.round(snapshot.viewport().sceneToScreenY(sceneY)), (int) image.getHeight());
        int radius = Math.max(0, radiusPixels);
        Color expectedStroke = compositeOverMapBackground(stroke, style.alpha());
        for (int dy = -radius; dy <= radius; dy++) {
            for (int dx = -radius; dx <= radius; dx++) {
                if ((dx * dx) + (dy * dy) > radius * radius) {
                    continue;
                }
                int sampleX = clampPixel(x + dx, (int) image.getWidth());
                int sampleY = clampPixel(y + dy, (int) image.getHeight());
                Color color = image.getPixelReader().getColor(sampleX, sampleY);
                if (colorDistance(color, MAP_BACKGROUND) > CANVAS_BACKGROUND_DISTANCE_THRESHOLD
                        && colorDistance(color, expectedStroke) <= CANVAS_PRIMITIVE_STROKE_DISTANCE_THRESHOLD) {
                    return;
                }
            }
        }
        assertTrue(false, message + " centerPixel=" + image.getPixelReader().getColor(x, y)
                + " expectedStroke=" + expectedStroke + " radiusPixels=" + radius);
    }

    static void assertCanvasHasPaintedContent(DungeonMapView mapView, String message) {
        WritableImage image = renderedCanvasSnapshot(mapView).image();
        int width = (int) image.getWidth();
        int height = (int) image.getHeight();
        int paintedPixels = 0;
        for (int y = 0; y < height; y += 8) {
            for (int x = 0; x < width; x += 8) {
                Color color = image.getPixelReader().getColor(x, y);
                if (colorDistance(color, MAP_BACKGROUND) > CANVAS_BACKGROUND_DISTANCE_THRESHOLD) {
                    paintedPixels++;
                }
            }
        }
        assertTrue(paintedPixels > 0, message);
    }

    static MapCanvasPane mapCanvas(DungeonMapView mapView) {
        return descendants(mapView).stream()
                .filter(MapCanvasPane.class::isInstance)
                .map(MapCanvasPane.class::cast)
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("Dungeon map canvas not found."));
    }

    static CanvasSnapshot renderedCanvasSnapshot(DungeonMapView mapView) {
        mapView.applyCss();
        mapView.layout();
        DungeonMapContentModel contentModel = boundContentModel(mapView);
        return new CanvasSnapshot(
                mapCanvas(mapView).snapshot(null, null),
                contentModel.canvasStateProperty().get().viewport());
    }

    static int clampPixel(int value, int dimension) {
        return Math.max(0, Math.min(Math.max(0, dimension - 1), value));
    }

    static double colorDistance(Color color, Color other) {
        double red = color.getRed() - other.getRed();
        double green = color.getGreen() - other.getGreen();
        double blue = color.getBlue() - other.getBlue();
        return Math.sqrt(red * red + green * green + blue * blue);
    }

    private static Color compositeOverMapBackground(
            DungeonMapContentModel.RenderColor color,
            double styleAlpha
    ) {
        double alpha = clampUnit(color.alphaUnit() * styleAlpha);
        double inverseAlpha = 1.0 - alpha;
        return new Color(
                color.redUnit() * alpha + MAP_BACKGROUND.getRed() * inverseAlpha,
                color.greenUnit() * alpha + MAP_BACKGROUND.getGreen() * inverseAlpha,
                color.blueUnit() * alpha + MAP_BACKGROUND.getBlue() * inverseAlpha,
                1.0);
    }

    private static double clampUnit(double value) {
        return Math.max(0.0, Math.min(1.0, value));
    }

    record CanvasSnapshot(WritableImage image, DungeonMapContentModel.Viewport viewport) {
    }

    static void assertEmptyMapSurface(DungeonEditorMapSurfaceSnapshot snapshot, String expectedMapName) {
        assertTrue(snapshot.surface() != null, "DE-MAP-001 map surface is published");
        assertEquals(expectedMapName, snapshot.surface().mapName(), "DE-MAP-001 map surface name");
        assertTrue(snapshot.surface().previewMap() == null, "DE-MAP-001 created map has no preview map");
        assertTrue(snapshot.surface().map().areas().isEmpty(), "DE-MAP-001 created map has no areas");
        assertTrue(snapshot.surface().map().boundaries().isEmpty(), "DE-MAP-001 created map has no boundaries");
        assertTrue(snapshot.surface().map().features().isEmpty(), "DE-MAP-001 created map has no features");
        assertTrue(snapshot.surface().map().editorHandles().isEmpty(),
                "DE-MAP-001 created map has no editor handles");
    }

    static boolean labelVisible(Parent parent, String text) {
        return descendants(parent).stream()
                .filter(Label.class::isInstance)
                .map(Label.class::cast)
                .anyMatch(label -> text.equals(label.getText()) && label.isVisible());
    }

    static boolean buttonVisible(Parent parent, String text) {
        return descendants(parent).stream()
                .filter(ButtonBase.class::isInstance)
                .map(ButtonBase.class::cast)
                .anyMatch(button -> text.equals(button.getText()) && button.isVisible());
    }

    static HBox toolFamilyRow(Parent parent) {
        List<HBox> rows = descendants(parent).stream()
                .filter(HBox.class::isInstance)
                .map(HBox.class::cast)
                .filter(row -> row.getStyleClass().contains("dungeon-control-tool-row"))
                .toList();
        assertEquals(1, rows.size(), "DE-TOOL-001 exposes exactly one Dungeon Editor tool family row");
        return rows.getFirst();
    }

    static List<ButtonBase> visibleRowButtons(Parent row) {
        return descendants(row).stream()
                .filter(ButtonBase.class::isInstance)
                .map(ButtonBase.class::cast)
                .filter(button -> button.isVisible() && !button.getText().isBlank())
                .toList();
    }

    static Set<String> visibleRowButtonTexts(Parent row) {
        return visibleRowButtons(row).stream()
                .map(ButtonBase::getText)
                .collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new));
    }

    static boolean toggleSelected(Parent parent, String text) {
        ToggleButton button = descendants(parent).stream()
                .filter(ToggleButton.class::isInstance)
                .map(ToggleButton.class::cast)
                .filter(candidate -> text.equals(candidate.getText()))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("ToggleButton not found: " + text));
        return button.isSelected();
    }

    static void click(ButtonBase button) {
        button.fire();
    }

    static ButtonBase button(Parent parent, String text) {
        return descendantsWithFallback(parent).stream()
                .filter(ButtonBase.class::isInstance)
                .map(ButtonBase.class::cast)
                .filter(button -> text.equals(button.getText()))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("Button not found: " + text));
    }

    static ButtonBase buttonWithAccessibleText(Parent parent, String accessibleText) {
        return descendantsWithFallback(parent).stream()
                .filter(ButtonBase.class::isInstance)
                .map(ButtonBase.class::cast)
                .filter(button -> accessibleText.equals(button.getAccessibleText()))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("Button not found: " + accessibleText));
    }

    static MenuButton menuButton(Parent parent, String text) {
        return descendantsWithFallback(parent).stream()
                .filter(MenuButton.class::isInstance)
                .map(MenuButton.class::cast)
                .filter(button -> text.equals(button.getText()))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("MenuButton not found: " + text));
    }

    static MenuItem menuItem(MenuButton button, String text) {
        return button.getItems().stream()
                .filter(item -> text.equals(item.getText()))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("MenuItem not found: " + text));
    }

    static void click(MenuItem item) {
        item.fire();
    }

    static TextField textField(Parent parent, String accessibleText) {
        return descendantsWithFallback(parent).stream()
                .filter(TextField.class::isInstance)
                .map(TextField.class::cast)
                .filter(field -> accessibleText.equals(field.getAccessibleText()))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("TextField not found: " + accessibleText));
    }

    static TextField catalogPopupTextField(Parent parent, String accessibleText) {
        return descendants(catalogPopupContent(parent)).stream()
                .filter(TextField.class::isInstance)
                .map(TextField.class::cast)
                .filter(field -> accessibleText.equals(field.getAccessibleText()))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("Catalog popup TextField not found: " + accessibleText));
    }

    static ButtonBase catalogPopupButton(Parent parent, String text) {
        return descendants(catalogPopupContent(parent)).stream()
                .filter(ButtonBase.class::isInstance)
                .map(ButtonBase.class::cast)
                .filter(button -> text.equals(button.getText()))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("Catalog popup button not found: " + text));
    }

    static ButtonBase catalogPopupButtonWithAccessibleText(Parent parent, String accessibleText) {
        return descendants(catalogPopupContent(parent)).stream()
                .filter(ButtonBase.class::isInstance)
                .map(ButtonBase.class::cast)
                .filter(button -> accessibleText.equals(button.getAccessibleText()))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("Catalog popup button not found: " + accessibleText));
    }

    static boolean textFieldPresent(Parent parent, String accessibleText) {
        return descendantsWithFallback(parent).stream()
                .filter(TextField.class::isInstance)
                .map(TextField.class::cast)
                .anyMatch(field -> accessibleText.equals(field.getAccessibleText()));
    }

    static Label label(Parent parent, String accessibleText) {
        return descendants(parent).stream()
                .filter(Label.class::isInstance)
                .map(Label.class::cast)
                .filter(label -> accessibleText.equals(label.getAccessibleText()))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("Label not found: " + accessibleText));
    }

    static TextField textFieldByPrompt(Parent parent, String promptText) {
        return descendants(parent).stream()
                .filter(TextField.class::isInstance)
                .map(TextField.class::cast)
                .filter(field -> promptText.equals(field.getPromptText()))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("TextField not found by prompt: " + promptText));
    }

    static TextArea textArea(Parent parent, String accessibleText) {
        return descendants(parent).stream()
                .filter(TextArea.class::isInstance)
                .map(TextArea.class::cast)
                .filter(area -> accessibleText.equals(area.getAccessibleText()))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("TextArea not found: " + accessibleText));
    }

    static CheckBox checkBox(Parent parent, String accessibleText) {
        return descendants(parent).stream()
                .filter(CheckBox.class::isInstance)
                .map(CheckBox.class::cast)
                .filter(box -> accessibleText.equals(box.getAccessibleText()))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("CheckBox not found: " + accessibleText));
    }

    static List<TextArea> textAreas(Parent parent) {
        return descendants(parent).stream()
                .filter(TextArea.class::isInstance)
                .map(TextArea.class::cast)
                .toList();
    }

    static ComboBox<?> comboBox(Parent parent, String accessibleText) {
        return descendantsWithFallback(parent).stream()
                .filter(ComboBox.class::isInstance)
                .map(ComboBox.class::cast)
                .filter(box -> accessibleText.equals(box.getAccessibleText()))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("ComboBox not found: " + accessibleText));
    }

    static <T extends Node> void assertAccessibleNode(
            Parent parent,
            Class<T> type,
            String accessibleText
    ) {
        boolean found = descendants(parent).stream()
                .filter(type::isInstance)
                .map(type::cast)
                .anyMatch(node -> accessibleText.equals(node.getAccessibleText()) && node.isVisible());
        assertTrue(found, "Accessible node present: " + accessibleText);
    }

    static ComboBox<?> comboBoxWithDisplayedItem(Parent parent, String displayText) {
        return descendants(parent).stream()
                .filter(ComboBox.class::isInstance)
                .map(ComboBox.class::cast)
                .filter(box -> comboBoxContainsDisplayText(box, displayText))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("ComboBox item not found: " + displayText));
    }

    static void selectComboItem(ComboBox<?> comboBox, String displayText) {
        selectComboItemTyped(comboBox, displayText);
    }

    static <T> boolean comboBoxContainsDisplayText(ComboBox<T> comboBox, String displayText) {
        for (T item : comboBox.getItems()) {
            if (displayText.equals(comboDisplayText(comboBox, item))) {
                return true;
            }
        }
        return false;
    }

    static <T> void selectComboItemTyped(ComboBox<T> comboBox, String displayText) {
        for (int index = 0; index < comboBox.getItems().size(); index++) {
            T item = comboBox.getItems().get(index);
            if (displayText.equals(comboDisplayText(comboBox, item))) {
                comboBox.getSelectionModel().select(index);
                return;
            }
        }
        throw new IllegalStateException("ComboBox item not found: " + displayText);
    }

    static <T> String comboDisplayText(ComboBox<T> comboBox, T item) {
        if (comboBox.getConverter() != null) {
            return comboBox.getConverter().toString(item);
        }
        return String.valueOf(item);
    }

    static Spinner<Integer> spinner(Parent parent) {
        return descendants(parent).stream()
                .filter(Spinner.class::isInstance)
                .map(Spinner.class::cast)
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("Spinner not found."));
    }

    static void setSpinnerValue(Spinner<Integer> spinner, int value) {
        if (spinner.getValueFactory() == null) {
            throw new IllegalStateException("Spinner has no value factory.");
        }
        spinner.getValueFactory().setValue(value);
    }

    static Slider slider(Parent parent) {
        return descendants(parent).stream()
                .filter(Slider.class::isInstance)
                .map(Slider.class::cast)
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("Slider not found."));
    }

    static void setSliderValue(Slider slider, double value) {
        slider.setValue(value);
    }

    static List<Node> descendants(Parent parent) {
        List<Node> nodes = new ArrayList<>();
        collect(parent, nodes);
        return nodes;
    }

    private static List<Node> descendantsWithFallback(Parent parent) {
        List<Node> localNodes = descendants(parent);
        Parent wrapper = parent.getParent();
        if (wrapper == null || wrapper.getChildrenUnmodifiable().size() <= 1) {
            return localNodes;
        }
        List<Node> wrapperNodes = new ArrayList<>(localNodes);
        for (Node node : descendants(wrapper)) {
            if (!wrapperNodes.contains(node)) {
                wrapperNodes.add(node);
            }
        }
        return wrapperNodes;
    }

    private static Parent catalogPopupContent(Parent parent) {
        CatalogCrudControlsView catalogControls = descendantsWithFallback(parent).stream()
                .filter(CatalogCrudControlsView.class::isInstance)
                .map(CatalogCrudControlsView.class::cast)
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("CatalogCrudControlsView not found."));
        Object content = catalogControls.getProperties().get(CatalogCrudControlsView.OPERATION_CONTENT_PROPERTY);
        if (content instanceof Parent popupContent) {
            return popupContent;
        }
        throw new IllegalStateException("Catalog popup content metadata not found.");
    }

    static <T extends Node> T descendant(Parent parent, Class<T> type) {
        return descendants(parent).stream()
                .filter(type::isInstance)
                .map(type::cast)
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("Descendant not found: " + type.getSimpleName()));
    }

    static Parent ancestorWithStyleClass(Node node, String styleClass) {
        Parent parent = node.getParent();
        while (parent != null) {
            if (parent.getStyleClass().contains(styleClass)) {
                return parent;
            }
            parent = parent.getParent();
        }
        throw new IllegalStateException("Ancestor style class not found: " + styleClass);
    }

    static void collect(Node node, List<Node> nodes) {
        nodes.add(node);
        if (node instanceof Parent parent) {
            for (Node child : parent.getChildrenUnmodifiable()) {
                collect(child, nodes);
            }
        }
    }

    static TestBinding bindTest(TestRuntime runtime) {
        return bindTest(runtime, 1_400.0, 900.0);
    }

    static TestBinding bindTest(TestRuntime runtime, double width, double height) {
        releaseProofWindowsBeforeBinding();
        ShellBinding shellBinding = new DungeonEditorContribution(runtime.editorApi()).bind();
        Parent controlsRoot = slot(shellBinding, ShellSlot.COCKPIT_CONTROLS, Parent.class);
        DungeonEditorControlsView controls = descendant(controlsRoot, DungeonEditorControlsView.class);
        DungeonMapView mapView = slot(shellBinding, ShellSlot.COCKPIT_MAIN, DungeonMapView.class);
        DungeonEditorStateView stateView = slot(shellBinding, ShellSlot.COCKPIT_STATE, DungeonEditorStateView.class);
        Stage stage = new Stage();
        HBox root = new HBox(controlsRoot, mapView, stateView);
        stage.setScene(new Scene(root, width, height));
        stage.show();
        root.applyCss();
        root.layout();
        DungeonMapContentModel contentModel = boundContentModel(shellBinding);
        BOUND_CONTENT_MODELS.put(mapView, contentModel);
        return new TestBinding(controls, mapView, stateView, contentModel);
    }

    static TestBinding bindShellTest(TestRuntime runtime, double width, double height) {
        releaseProofWindowsBeforeBinding();
        AppShell shell = new AppShell();
        DungeonEditorContribution contribution = new DungeonEditorContribution(runtime.editorApi());
        ShellBinding shellBinding = contribution.bind();
        ShellLeftBarTabSpec registrationSpec = (ShellLeftBarTabSpec) contribution.registrationSpec();
        shell.registerLeftBarTab(registrationSpec, shellBinding);
        shell.navigateTo(registrationSpec.key());

        Stage stage = new Stage();
        stage.setScene(new Scene(shell, width, height));
        stage.show();
        shell.applyCss();
        shell.layout();
        DungeonEditorControlsView controls = descendant(shell, DungeonEditorControlsView.class);
        DungeonMapView mapView = descendant(shell, DungeonMapView.class);
        DungeonEditorStateView stateView = descendant(shell, DungeonEditorStateView.class);
        DungeonMapContentModel contentModel = boundContentModel(shellBinding);
        BOUND_CONTENT_MODELS.put(mapView, contentModel);
        return new TestBinding(controls, mapView, stateView, contentModel);
    }

    static <T extends Node> T slot(ShellBinding shellBinding, ShellSlot slot, Class<T> type) {
        Node node = shellBinding.slotContent().get(slot);
        if (!type.isInstance(node)) {
            throw new IllegalStateException("Unexpected " + slot + " slot content: " + node);
        }
        return type.cast(node);
    }

    static DungeonMapContentModel boundContentModel(ShellBinding shellBinding) {
        if (shellBinding instanceof DungeonEditorBinder.Binding binding) {
            return binding.mapContentModel();
        }
        throw new IllegalStateException("Unexpected Dungeon Editor binding: " + shellBinding.getClass().getName());
    }

    static DungeonMapContentModel boundContentModel(DungeonMapView mapView) {
        DungeonMapContentModel contentModel = BOUND_CONTENT_MODELS.get(mapView);
        if (contentModel == null) {
            throw new IllegalStateException("Dungeon map view was not created by the test binding.");
        }
        return contentModel;
    }

    static void assertTrue(boolean condition, String message) {
        if (!condition) {
            throw new AssertionError(message);
        }
    }

    static void exercisePreviewInteractions(String ignoredDescription, Runnable... interactions) {
        assertTrue(interactions != null && interactions.length > 0, "preview interactions are required");
        for (Runnable interaction : interactions) {
            interaction.run();
        }
    }

    static void assertEquals(long expected, long actual, String message) {
        if (expected != actual) {
            throw new AssertionError(message + " expected=" + expected + " actual=" + actual);
        }
    }

    static void assertEquals(Object expected, Object actual, String message) {
        if (!Objects.equals(expected, actual)) {
            throw new AssertionError(message + " expected=" + expected + " actual=" + actual);
        }
    }

    static void assertDoubleEquals(double expected, double actual, String message) {
        double tolerance = 0.000_001;
        if (Math.abs(expected - actual) > tolerance) {
            throw new AssertionError(message + " expected=" + expected + " actual=" + actual);
        }
    }

    record TestBinding(
            DungeonEditorControlsView controls,
            DungeonMapView mapView,
            DungeonEditorStateView stateView,
            DungeonMapContentModel mapContentModel
    ) {
    }

}

final class DungeonMapStateProbe {
    private DungeonMapStateProbe() {
    }

    static Snapshot snapshot(DungeonMapContentModel model) {
        DungeonMapContentModel.CanvasState canvasState = model.canvasStateProperty().get();
        DungeonMapContentModel.RenderScene baseScene = canvasState.baseRenderScene();
        DungeonMapContentModel.RenderScene renderedScene = canvasState.renderScene();
        DungeonMapContentModel.InlineLabelEditState inlineLabel = model.currentInlineLabelEditState();
        return new Snapshot(
                projectionLevel(baseScene),
                renderGeometrySignature(baseScene),
                hitTargetSignature(baseScene),
                System.identityHashCode(canvasState),
                hoverPrimitiveCount(renderedScene),
                inlineLabel.active() ? inlineLabel.text().length() : 0);
    }

    static String renderStatusLabel(DungeonMapContentModel model) {
        return model.canvasStateProperty().get().baseRenderScene().statusLabel();
    }

    private static long projectionLevel(DungeonMapContentModel.RenderScene scene) {
        return Math.max(maxSurfaceLevel(scene), maxBoundaryLevel(scene));
    }

    private static long maxSurfaceLevel(DungeonMapContentModel.RenderScene scene) {
        return scene.surfaces().stream()
                .mapToInt(DungeonMapContentModel.MapCanvasPolygonPrimitive::z)
                .max()
                .orElse(0);
    }

    private static long maxBoundaryLevel(DungeonMapContentModel.RenderScene scene) {
        return scene.boundaries().stream()
                .mapToInt(DungeonMapContentModel.BoundaryPrimitive::z)
                .max()
                .orElse(0);
    }

    private static String renderGeometrySignature(DungeonMapContentModel.RenderScene scene) {
        return scene.surfaces()
                + "|"
                + scene.boundaries()
                + "|"
                + scene.glyphs()
                + "|"
                + scene.texts()
                + "|"
                + scene.relations()
                + "|"
                + scene.actors();
    }

    private static String hitTargetSignature(DungeonMapContentModel.RenderScene scene) {
        return scene.surfaces().stream()
                .map(DungeonMapContentModel.MapCanvasPolygonPrimitive::hitRef)
                .filter(hitRef -> !hitRef.isBlank())
                .sorted()
                .toList()
                + "|"
                + scene.boundaries().stream()
                .map(DungeonMapContentModel.BoundaryPrimitive::hitRef)
                .filter(hitRef -> !hitRef.isBlank())
                .sorted()
                .toList()
                + "|"
                + scene.glyphs().stream()
                .map(DungeonMapContentModel.GlyphPrimitive::hitRef)
                .filter(hitRef -> !hitRef.isBlank())
                .sorted()
                .toList();
    }

    private static long hoverPrimitiveCount(DungeonMapContentModel.RenderScene scene) {
        return scene.hoverSurfaces().size()
                + scene.hoverBoundaries().size()
                + scene.hoverGlyphs().size()
                + scene.hoverTexts().size();
    }

    record Snapshot(
            long projectionLevel,
            String renderGeometrySignature,
            String hitTargetSignature,
            int canvasStateIdentity,
            long hoverOverlayPrimitiveCount,
            int inlineLabelDraftLength
    ) {
    }
}
