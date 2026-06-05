package src.view.leftbartabs.dungeoneditor;

import java.lang.reflect.Field;
import java.nio.channels.FileChannel;
import java.nio.channels.FileLock;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.ResultSetMetaData;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import javafx.application.Platform;
import javafx.event.ActionEvent;
import javafx.geometry.Bounds;
import javafx.geometry.Point2D;
import javafx.scene.Scene;
import javafx.scene.Node;
import javafx.scene.Parent;
import javafx.scene.canvas.Canvas;
import javafx.scene.control.Button;
import javafx.scene.control.ButtonBase;
import javafx.scene.control.CheckBox;
import javafx.scene.control.ComboBox;
import javafx.scene.control.Label;
import javafx.scene.control.MenuItem;
import javafx.scene.control.Slider;
import javafx.scene.control.Spinner;
import javafx.scene.control.SplitMenuButton;
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
import bootstrap.AppBootstrap;
import shell.api.ShellLeftBarTabSpec;
import shell.api.InspectorEntrySpec;
import shell.api.InspectorSink;
import shell.api.ServiceRegistry;
import shell.api.ShellBinding;
import shell.api.ShellRuntimeContext;
import shell.api.ShellSlot;
import shell.host.AppShell;
import src.data.dungeon.model.DungeonPersistenceSchema;
import src.data.dungeon.repository.SqliteDungeonMapRepository;
import src.domain.dungeon.DungeonServiceContribution;
import src.domain.dungeon.model.core.geometry.DungeonBoundaryKey;
import src.domain.dungeon.model.worldspace.DungeonCell;
import src.domain.dungeon.model.worldspace.DungeonEdge;
import src.domain.dungeon.model.worldspace.DungeonEdgeDirection;
import src.domain.dungeon.model.worldspace.DungeonMap;
import src.domain.dungeon.model.core.structure.DungeonMapIdentity;
import src.domain.dungeon.model.worldspace.DungeonRoomCellProjection;
import src.domain.dungeon.model.worldspace.DungeonRoomCluster;
import src.domain.dungeon.model.runtime.travel.session.TravelDungeonActiveState;
import src.domain.dungeon.model.runtime.travel.session.TravelDungeonSessionSurface;
import src.domain.dungeon.model.runtime.travel.session.TravelDungeonSessionValues;
import src.domain.dungeon.model.runtime.repository.TravelPartyStateRepository;
import src.domain.dungeon.model.runtime.repository.TravelPartyPositionRepository;
import src.domain.dungeon.model.worldspace.repository.DungeonMapRepository;
import src.domain.dungeon.published.DungeonEditorControlsModel;
import src.domain.dungeon.published.DungeonEditorControlsSnapshot;
import src.domain.dungeon.published.DungeonEditorMapSurfaceModel;
import src.domain.dungeon.published.DungeonEditorMapSurfaceSnapshot;
import src.domain.dungeon.published.DungeonEditorPreview;
import src.domain.dungeon.published.DungeonEditorStateModel;
import src.domain.dungeon.published.DungeonEditorStateSnapshot;
import src.domain.dungeon.published.DungeonEditorTopologyElementRef;
import src.domain.dungeon.published.DungeonEditorViewMode;
import src.domain.dungeon.published.DungeonEdgeRef;
import src.domain.dungeon.published.DungeonInspectorSnapshot;
import src.domain.dungeon.published.DungeonMapSummary;
import src.domain.dungeon.published.DungeonOverlaySettings;
import src.domain.dungeon.published.DungeonTopologyElementRef;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel;
import src.view.slotcontent.main.dungeonmap.DungeonMapView;

final class DungeonEditorBehaviorHarnessSupport {

    static final int AWAIT_SECONDS = 60;
    static final double DEFAULT_GRID_SIZE = 32.0;
    static final int LARGE_VERTEX_FIXTURE_WIDTH = 104;
    static final int LARGE_VERTEX_FIXTURE_HEIGHT = 108;
    static final long LARGE_VERTEX_FIXTURE_MIN_ROWS = 56_000L;
    static final long LARGE_VERTEX_STARTUP_MAX_MILLIS = 5_000L;
    static final long LARGE_VERTEX_INPUT_MAX_MILLIS = 500L;
    static final Color MAP_BACKGROUND = Color.rgb(0x12, 0x18, 0x1c);
    static final AtomicBoolean FX_STARTED = new AtomicBoolean();

    DungeonEditorBehaviorHarnessSupport() {
    }



















    static void assertInvalidStairGeometryLeavesViewState(
            HarnessRuntime runtime,
            HarnessBinding binding,
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
        selectComboItem(comboBox(stateView, "Übergang Zieltyp"), "DUNGEON_MAP");
        textField(stateView, "Übergang Zielkarte").setText(Long.toString(targetMapId));
        textField(stateView, "Übergang Zieluebergang").setText(Long.toString(targetTransitionId));
        CheckBox bidirectionalBox = checkBox(stateView, "Übergang bidirektional verknuepfen");
        if (bidirectionalBox.isSelected() != bidirectional) {
            click(bidirectionalBox);
        }
        click(buttonWithAccessibleText(stateView, "Übergang-Verknüpfung speichern"));
    }




    @FunctionalInterface
    interface DatabaseFixtureSeeder {
        void seed(DatabaseAssertions database);
    }








    static long createWallFixture(
            DungeonEditorControlsView controls,
            HarnessRuntime runtime,
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
        DungeonCell from = new DungeonCell(fromQ, fromR, fromLevel);
        DungeonCell to = new DungeonCell(toQ, toR, toLevel);
        return preview.edges().stream().anyMatch(edge -> samePreviewEdge(edge, from, to));
    }

    static boolean samePreviewEdge(DungeonEdgeRef edge, DungeonCell from, DungeonCell to) {
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
                        new DungeonCell(2, 1, 0),
                        new DungeonCell(2, 2, 0)),
                message + " published map includes north internal wall edge");
        assertTrue(surfaceHasBoundaryKindAt(
                        snapshot,
                        "wall",
                        new DungeonCell(2, 2, 0),
                        new DungeonCell(2, 3, 0)),
                message + " published map includes center internal wall edge");
        assertTrue(surfaceHasBoundaryKindAt(
                        snapshot,
                        "wall",
                        new DungeonCell(2, 3, 0),
                        new DungeonCell(2, 4, 0)),
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
            HarnessRuntime runtime,
            String mapName
    ) {
        click(button(controls, "Neu"));
        textField(controls, "Dungeon-Name").setText(mapName);
        click(button(controls, "Erstellen"));
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
    }

    static void fireMapShortcut(DungeonMapView view, KeyCode keyCode) {
        Pane canvasLayer = mapCanvasLayer(view);
        canvasLayer.fireEvent(new KeyEvent(
                KeyEvent.KEY_PRESSED,
                keyCode.getChar(),
                keyCode.getName(),
                keyCode,
                false,
                false,
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
        Pane canvasLayer = mapCanvasLayer(view);
        MouseEvent event = new MouseEvent(
                eventType,
                canvasX,
                canvasY,
                canvasX,
                canvasY,
                button,
                1,
                shiftDown,
                false,
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
            src.domain.dungeon.published.DungeonEditorMapSnapshot mapSnapshot
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

    static Set<String> areaCellSet(src.domain.dungeon.published.DungeonEditorMapSnapshot.Area area) {
        Set<String> cells = new LinkedHashSet<>();
        area.cells().stream()
                .map(cell -> cell.q() + "," + cell.r() + "," + cell.level())
                .forEach(cells::add);
        return cells;
    }

    static src.domain.dungeon.published.DungeonEditorMapSnapshot.Area corridorAreaById(
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
        DungeonEditorTopologyElementRef ref = new DungeonEditorTopologyElementRef("STAIR", stairId);
        assertTrue(snapshot.surface().map().features().stream()
                        .filter(feature -> "STAIR".equals(feature.kind()))
                        .filter(feature -> feature.id() == stairId)
                        .filter(feature -> feature.topologyRef().equals(ref))
                        .filter(feature -> feature.cells().stream()
                                .map(cell -> cell.q() + "," + cell.r() + "," + cell.level())
                                .collect(java.util.stream.Collectors.toSet())
                                .containsAll(Set.of("4,2,0", "4,2,1")))
                        .anyMatch(feature -> feature.description().contains("2 Ausgaenge")),
                message + " published feature exposes bound stair exits");
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
                message + " published handle readback moves the first stair path handle to (3,2,0)");
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
        DungeonEditorTopologyElementRef ref = new DungeonEditorTopologyElementRef("STAIR", stairId);
        int upperR = anchorR - 2;
        Set<String> expectedFeatureCells = Set.of(
                anchorQ + "," + anchorR + ",0",
                anchorQ + "," + (anchorR - 1) + ",0",
                anchorQ + "," + upperR + ",0",
                anchorQ + "," + upperR + ",1");
        assertTrue(snapshot.surface().map().features().stream()
                        .filter(feature -> "STAIR".equals(feature.kind()))
                        .filter(feature -> feature.id() == stairId)
                        .filter(feature -> feature.topologyRef().equals(ref))
                        .anyMatch(feature -> feature.cells().stream()
                                .map(cell -> cell.q() + "," + cell.r() + "," + cell.level())
                                .collect(java.util.stream.Collectors.toSet())
                                .containsAll(expectedFeatureCells)),
                message + " published stair feature exposes generated path and exits: "
                        + snapshot.surface().map().features());
        assertTrue(snapshot.surface().map().editorHandles().stream()
                        .anyMatch(handle -> "STAIR".equals(handle.ref().topologyRef().kind().name())
                                && handle.ref().topologyRef().id() == stairId
                                && "STAIR_ANCHOR".equals(handle.ref().kind().name())
                                && handle.cell().q() == anchorQ
                                && handle.cell().r() == anchorR
                                && handle.cell().level() == 0),
                message + " published snapshot exposes lower stair handle");
        assertTrue(snapshot.surface().map().editorHandles().stream()
                        .anyMatch(handle -> "STAIR".equals(handle.ref().topologyRef().kind().name())
                                && handle.ref().topologyRef().id() == stairId
                                && "STAIR_ANCHOR".equals(handle.ref().kind().name())
                                && handle.cell().q() == anchorQ
                                && handle.cell().r() == upperR
                                && handle.cell().level() == 1),
                message + " published snapshot exposes generated upper exit handle");
        assertTrue(renderSurfaceCellOriginsWithZ(mapContentModel).containsAll(
                        Set.of(
                                anchorQ + "," + anchorR + ",0",
                                anchorQ + "," + (anchorR - 1) + ",0",
                                anchorQ + "," + upperR + ",0")),
                message + " render scene contains active-level straight stair path");
        assertTrue(renderHasGlyphAt(mapContentModel, ref, anchorQ + 0.5, anchorR + 0.5, false),
                message + " render scene shows committed lower stair handle");
        assertTrue(renderHasGlyphAt(mapContentModel, ref, anchorQ + 0.5, upperR + 0.5, false),
                message + " render scene shows committed upper stair exit handle");
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
        DungeonEditorTopologyElementRef ref = new DungeonEditorTopologyElementRef("TRANSITION", transitionId);
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

    static src.domain.dungeon.published.DungeonEditorHandleSnapshot firstStairHandle(
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
            DungeonEditorTopologyElementRef ref,
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

    static src.domain.dungeon.published.DungeonEditorHandleSnapshot firstCorridorAnchorHandle(
            DungeonEditorMapSurfaceSnapshot snapshot,
            String message
    ) {
        return snapshot.surface().map().editorHandles().stream()
                .filter(handle -> "CORRIDOR_ANCHOR".equals(handle.ref().kind().name()))
                .findFirst()
                .orElseThrow(() -> new AssertionError(message + " corridor anchor handle not published"));
    }

    static src.domain.dungeon.published.DungeonEditorHandleSnapshot firstDoorHandleAt(
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

    static src.domain.dungeon.published.DungeonEditorHandleSnapshot firstClusterCornerHandleAt(
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

    static List<DungeonEditorTopologyElementRef> corridorAnchorRefs(DungeonEditorMapSurfaceSnapshot snapshot) {
        return snapshot.surface().map().editorHandles().stream()
                .filter(handle -> "CORRIDOR_ANCHOR".equals(handle.ref().kind().name()))
                .map(handle -> editorTopologyRef(handle.ref().topologyRef()))
                .sorted((left, right) -> Long.compare(left.id(), right.id()))
                .toList();
    }

    static void assertPointerTarget(
            DungeonMapContentModel mapContentModel,
            Point2D scenePoint,
            String expectedKind,
            String message
    ) {
        assertEquals(expectedKind,
                mapContentModel.resolvePointerTarget(scenePoint.getX(), scenePoint.getY()).targetKind().name(),
                message + " input route resolves expected map hit target");
    }

    static Set<String> persistedClusterCellsThroughRepository(long mapId, long clusterId, int level) {
        DungeonMap dungeonMap = new SqliteDungeonMapRepository()
                .findById(new DungeonMapIdentity(mapId))
                .orElseThrow(() -> new AssertionError("Map not found during persisted room readback: " + mapId));
        DungeonRoomCluster cluster = dungeonMap.topology().roomClusters().stream()
                .filter(candidate -> candidate.clusterId() == clusterId)
                .findFirst()
                .orElseThrow(() -> new AssertionError("Cluster not found during persisted room readback: "
                        + clusterId));
        var rooms = dungeonMap.rooms().rooms().stream()
                .filter(room -> room.clusterId() == clusterId)
                .toList();
        Set<String> cells = new LinkedHashSet<>();
        new DungeonRoomCellProjection().clusterCells(cluster, rooms, level).stream()
                .map(DungeonEditorBehaviorHarnessSupport::cellKey)
                .forEach(cells::add);
        return cells;
    }

    static src.domain.dungeon.published.DungeonEditorMapSnapshot.Area roomAreaByLabel(
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

    static src.domain.dungeon.published.DungeonEditorMapSnapshot.Area roomAreaByCells(
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
            DungeonEditorTopologyElementRef ref
    ) {
        String selectionRef = ref.kind() + ":" + ref.id();
        return mapContentModel.canvasStateProperty().get().renderScene().surfaces().stream()
                .anyMatch(surface -> selectionRef.equals(surface.selectionRef())
                        && surface.style().strokeWidth() > (2.0 / DEFAULT_GRID_SIZE));
    }

    static boolean renderHasSelectedGlyphPrimitive(
            DungeonMapContentModel mapContentModel,
            DungeonEditorTopologyElementRef ref
    ) {
        String selectionRef = ref.kind() + ":" + ref.id();
        return mapContentModel.canvasStateProperty().get().renderScene().glyphs().stream()
                .anyMatch(glyph -> selectionRef.equals(glyph.selectionRef())
                        && glyph.style().strokeWidth() > (1.4 / DEFAULT_GRID_SIZE));
    }

    static Point2D glyphCenterForRef(
            DungeonMapContentModel mapContentModel,
            DungeonEditorTopologyElementRef ref
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
            DungeonEditorTopologyElementRef ref
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
            DungeonEditorTopologyElementRef ref,
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
            DungeonEditorTopologyElementRef ref,
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

    static DungeonEditorTopologyElementRef editorTopologyRef(DungeonTopologyElementRef ref) {
        return new DungeonEditorTopologyElementRef(ref.kind().name(), ref.id());
    }

    static boolean renderHasBoundaryPrimitive(
            DungeonMapContentModel mapContentModel,
            DungeonEditorTopologyElementRef ref
    ) {
        String selectionRef = ref.kind() + ":" + ref.id();
        return mapContentModel.canvasStateProperty().get().renderScene().boundaries().stream()
                .anyMatch(boundary -> selectionRef.equals(boundary.selectionRef()));
    }

    static boolean renderHasSelectedDoorBoundaryPrimitive(
            DungeonMapContentModel mapContentModel,
            DungeonEditorTopologyElementRef ref
    ) {
        String selectionRef = ref.kind() + ":" + ref.id();
        return mapContentModel.canvasStateProperty().get().renderScene().boundaries().stream()
                .anyMatch(boundary -> selectionRef.equals(boundary.selectionRef())
                        && boundary.style().stroke().equals(DungeonMapContentModel.RenderColor.color(0xf1, 0xd3, 0x8a, 1.0))
                        && boundary.style().strokeWidth() > (3.6 / DEFAULT_GRID_SIZE));
    }

    static boolean selectedDoorBoundaryDiffersFromNormalDoorStyle(
            DungeonMapContentModel mapContentModel,
            DungeonEditorTopologyElementRef selectedRef
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
            DungeonEditorTopologyElementRef doorRef,
            String doorLabel
    ) {
        if (inspector == null) {
            throw new AssertionError("DE-SEL-002 inspector is published for selected door");
        }
        assertEquals(doorLabel, inspector.title(), "DE-SEL-002 inspector title identifies selected door");
        assertEquals("Authorisierte Dungeon-Grenze.", inspector.summary(),
                "DE-SEL-002 inspector summary identifies selected boundary topology");
        assertTrue(inspector.facts().contains("ref: " + doorRef.kind() + " " + doorRef.id()),
                "DE-SEL-002 inspector facts identify selected door topology ref");
        assertTrue(inspector.facts().contains("kind: door"),
                "DE-SEL-002 inspector facts identify selected topology as door");
    }

    static void assertDoorOwningRoomFacts(
            DungeonEditorMapSurfaceSnapshot surface,
            src.domain.dungeon.published.DungeonEditorMapSnapshot.Boundary doorBoundary
    ) {
        var owningArea = surface.surface().map().areas().stream()
                .filter(area -> "ROOM".equalsIgnoreCase(area.kind()))
                .filter(area -> area.cells().stream().anyMatch(cell ->
                        cell.level() == doorBoundary.edge().from().level()
                                && cell.r() == doorBoundary.edge().from().r()
                                && (cell.q() == doorBoundary.edge().from().q()
                                || cell.q() == doorBoundary.edge().from().q() - 1)))
                .findFirst()
                .orElseThrow(() -> new AssertionError("DE-SEL-002 published facts identify the door owning room"));
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

    static String cellKey(src.domain.dungeon.published.DungeonCellRef cell) {
        return cell.q() + "," + cell.r() + "," + cell.level();
    }

    static String cellKey(DungeonCell cell) {
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
            DungeonEdgeDirection direction,
            String message
    ) {
        DungeonCell from = new DungeonCell(q, r, level);
        DungeonCell to = direction.neighborOf(from);
        boolean present = snapshot.surface().map().boundaries().stream()
                .map(boundary -> boundary.edge())
                .anyMatch(edge -> sameEdge(edge, from, to));
        assertTrue(!present, message + " boundaries=" + surfaceBoundarySummary(snapshot));
    }

    static boolean surfaceHasBoundaryKindAt(
            DungeonEditorMapSurfaceSnapshot snapshot,
            String kind,
            DungeonCell from,
            DungeonCell to
    ) {
        return snapshot.surface().map().boundaries().stream()
                .filter(boundary -> kind.equalsIgnoreCase(boundary.kind()))
                .map(boundary -> boundary.edge())
                .anyMatch(edge -> sameEdge(edge, from, to));
    }

    static boolean sameEdge(
            src.domain.dungeon.published.DungeonEdgeRef edge,
            DungeonCell from,
            DungeonCell to
    ) {
        return sameCell(edge.from(), from) && sameCell(edge.to(), to)
                || sameCell(edge.from(), to) && sameCell(edge.to(), from);
    }

    static boolean sameCell(src.domain.dungeon.published.DungeonCellRef left, DungeonCell right) {
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
                .map(DungeonEditorBehaviorHarnessSupport::boundaryMidpoint)
                .anyMatch(point -> point.distance(expectedX, expectedY) < 0.000_001);
    }

    static Point2D boundaryMidpoint(DungeonMapContentModel.BoundaryPrimitive boundary) {
        var start = boundary.polyline().getFirst();
        var end = boundary.polyline().getLast();
        return new Point2D((start.x() + end.x()) / 2.0, (start.y() + end.y()) / 2.0);
    }

    static void assertSelectionMatches(
            DungeonEditorTopologyElementRef expectedRef,
            long expectedClusterId,
            DungeonEditorStateSnapshot.Selection selection,
            String message
    ) {
        assertEquals(expectedRef, selection.topologyRef(), message + " selected topology ref");
        assertEquals(expectedClusterId, selection.clusterId(), message + " selected cluster id");
    }

    static void assertHandleSelectionMatches(
            src.domain.dungeon.published.DungeonEditorHandleRef expected,
            src.domain.dungeon.published.DungeonEditorHandleRef actual,
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
        assertEquals(DungeonEditorTopologyElementRef.empty(), selection.topologyRef(), message + " topology ref");
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
        Canvas canvas = mapCanvas(mapView);
        WritableImage image = canvas.snapshot(null, null);
        int x = clampPixel((int) Math.round(sceneX * DEFAULT_GRID_SIZE), (int) image.getWidth());
        int y = clampPixel((int) Math.round(sceneY * DEFAULT_GRID_SIZE), (int) image.getHeight());
        Color color = image.getPixelReader().getColor(x, y);
        assertTrue(colorDistance(color, MAP_BACKGROUND) > 0.025, message + " pixel=" + color);
    }

    static void assertCanvasHasPaintedContent(DungeonMapView mapView, String message) {
        Canvas canvas = mapCanvas(mapView);
        WritableImage image = canvas.snapshot(null, null);
        int width = (int) image.getWidth();
        int height = (int) image.getHeight();
        int paintedPixels = 0;
        for (int y = 0; y < height; y += 8) {
            for (int x = 0; x < width; x += 8) {
                Color color = image.getPixelReader().getColor(x, y);
                if (colorDistance(color, MAP_BACKGROUND) > 0.025) {
                    paintedPixels++;
                }
            }
        }
        assertTrue(paintedPixels > 0, message);
    }

    static Canvas mapCanvas(DungeonMapView mapView) {
        return descendants(mapView).stream()
                .filter(Canvas.class::isInstance)
                .map(Canvas.class::cast)
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("Dungeon map canvas not found."));
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

    static void writeResults(List<String> results) throws Exception {
        Path output = resultsOutput();
        if (output == null) {
            return;
        }
        Files.createDirectories(output.getParent());
        Files.write(output, results);
    }

    static void clearResults() throws Exception {
        Path output = resultsOutput();
        if (output != null) {
            Files.deleteIfExists(output);
        }
    }

    static ResultPublicationLock lockResults() throws Exception {
        Path output = resultsOutput();
        if (output == null) {
            return ResultPublicationLock.none();
        }
        Files.createDirectories(output.getParent());
        Path lockPath = output.resolveSibling("summary.lock");
        FileChannel channel = FileChannel.open(
                lockPath,
                StandardOpenOption.CREATE,
                StandardOpenOption.WRITE);
        return ResultPublicationLock.lock(channel);
    }

    static Path resultsOutput() {
        String resultsDir = System.getProperty("saltmarcher.dungeonEditorBehavior.resultsDir", "");
        if (resultsDir.isBlank()) {
            return null;
        }
        return Path.of(resultsDir, "summary.txt");
    }

    static final class ResultPublicationLock implements AutoCloseable {
        private final FileChannel channel;
        private final FileLock lock;

        private ResultPublicationLock(FileChannel channel, FileLock lock) {
            this.channel = channel;
            this.lock = lock;
        }

        static ResultPublicationLock none() {
            return new ResultPublicationLock(null, null);
        }

        static ResultPublicationLock lock(FileChannel channel) throws Exception {
            try {
                return new ResultPublicationLock(channel, channel.lock());
            } catch (Throwable throwable) {
                channel.close();
                throw throwable;
            }
        }

        @Override
        public void close() throws Exception {
            if (lock != null) {
                lock.release();
            }
            if (channel != null) {
                channel.close();
            }
        }
    }

    static void shutdownFx() throws Exception {
        runOnFxThread(() -> {
            for (Window window : List.copyOf(Window.getWindows())) {
                window.hide();
            }
            Platform.exit();
        });
    }

    static void runOnFxThread(ThrowingRunnable action) throws Exception {
        CountDownLatch latch = new CountDownLatch(1);
        Throwable[] failure = new Throwable[1];
        Runnable wrappedAction = () -> {
            try {
                action.run();
            } catch (Throwable throwable) {
                failure[0] = throwable;
            } finally {
                latch.countDown();
            }
        };
        if (FX_STARTED.compareAndSet(false, true)) {
            Platform.startup(wrappedAction);
        } else {
            Platform.runLater(wrappedAction);
        }
        if (!latch.await(AWAIT_SECONDS, TimeUnit.SECONDS)) {
            throw new IllegalStateException("Timed out waiting for JavaFX Dungeon Editor harness.");
        }
        if (failure[0] != null) {
            throw new IllegalStateException("Dungeon Editor behavior harness failed.", failure[0]);
        }
    }

    static void runRouteProof(
            List<String> results,
            String ownerSuite,
            ThrowingRunnable action
    ) throws Exception {
        int firstNewResult = results.size();
        runOnFxThread(action);
        for (int index = firstNewResult; index < results.size(); index++) {
            String rawResult = results.get(index);
            if (rawResult.contains("OwnerSuite=") || rawResult.contains("ProofType=")) {
                throw new IllegalStateException("Route proof rows must not predeclare proof metadata: " + rawResult);
            }
            if (!rawResult.matches(".*\\bDE-[A-Z]+-[0-9]{3}\\b.*")) {
                throw new IllegalStateException("Route proof rows must reference a DE-* catalog id: " + rawResult);
            }
            results.set(index, "OwnerSuite=" + ownerSuite + "; ProofType=RealRoute; " + rawResult);
        }
    }

    static void recordModelInvariant(
            List<String> results,
            String ownerSuite,
            String invariantId,
            String description
    ) {
        if (ownerSuite == null || ownerSuite.isBlank()) {
            throw new IllegalStateException("Model invariant rows must declare an owner suite.");
        }
        if (invariantId == null || !invariantId.matches("DGI-[A-Z]+-[0-9]{3}")) {
            throw new IllegalStateException("Model invariant rows must declare a DGI-* invariant id: " + invariantId);
        }
        if (description == null || description.isBlank()) {
            throw new IllegalStateException("Model invariant rows must declare a description.");
        }
        results.add("OwnerSuite=" + ownerSuite + "; ProofType=ModelInvariant; "
                + invariantId + " Qualified: " + description);
    }

    static void click(ButtonBase button) {
        button.fire();
    }

    static ButtonBase button(Parent parent, String text) {
        return descendants(parent).stream()
                .filter(ButtonBase.class::isInstance)
                .map(ButtonBase.class::cast)
                .filter(button -> text.equals(button.getText()))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("Button not found: " + text));
    }

    static ButtonBase buttonWithAccessibleText(Parent parent, String accessibleText) {
        return descendants(parent).stream()
                .filter(ButtonBase.class::isInstance)
                .map(ButtonBase.class::cast)
                .filter(button -> accessibleText.equals(button.getAccessibleText()))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("Button not found: " + accessibleText));
    }

    static SplitMenuButton splitMenuButton(Parent parent, String text) {
        return descendants(parent).stream()
                .filter(SplitMenuButton.class::isInstance)
                .map(SplitMenuButton.class::cast)
                .filter(button -> text.equals(button.getText()))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("SplitMenuButton not found: " + text));
    }

    static MenuItem menuItem(SplitMenuButton button, String text) {
        return button.getItems().stream()
                .filter(item -> text.equals(item.getText()))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("MenuItem not found: " + text));
    }

    static void click(MenuItem item) {
        item.fire();
    }

    static TextField textField(Parent parent, String accessibleText) {
        return descendants(parent).stream()
                .filter(TextField.class::isInstance)
                .map(TextField.class::cast)
                .filter(field -> accessibleText.equals(field.getAccessibleText()))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("TextField not found: " + accessibleText));
    }

    static boolean textFieldPresent(Parent parent, String accessibleText) {
        return descendants(parent).stream()
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
        return descendants(parent).stream()
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

    static HarnessBinding bindHarness(HarnessRuntime runtime) {
        return bindHarness(runtime, 1_400.0, 900.0);
    }

    static HarnessBinding bindHarness(HarnessRuntime runtime, double width, double height) {
        ShellBinding shellBinding = new DungeonEditorContribution().bind(runtime.context());
        DungeonEditorControlsView controls =
                slot(shellBinding, ShellSlot.COCKPIT_CONTROLS, DungeonEditorControlsView.class);
        DungeonMapView mapView = slot(shellBinding, ShellSlot.COCKPIT_MAIN, DungeonMapView.class);
        DungeonEditorStateView stateView = slot(shellBinding, ShellSlot.COCKPIT_STATE, DungeonEditorStateView.class);
        Stage stage = new Stage();
        HBox root = new HBox(controls, mapView, stateView);
        stage.setScene(new Scene(root, width, height));
        stage.show();
        root.applyCss();
        root.layout();
        return new HarnessBinding(controls, mapView, stateView, boundContentModel(mapView));
    }

    static HarnessBinding bindShellHarness(HarnessRuntime runtime, double width, double height) {
        AppShell shell = new AppShell(runtime.context().services());
        DungeonEditorContribution contribution = new DungeonEditorContribution();
        ShellBinding shellBinding = contribution.bind(shell.runtimeContext());
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
        return new HarnessBinding(controls, mapView, stateView, boundContentModel(mapView));
    }

    static ApplicationHarnessBinding bindDiscoveredApplicationHarness(double width, double height) {
        AppShell shell = new AppBootstrap().createShell();
        Stage stage = new Stage();
        stage.setScene(new Scene(shell, width, height));
        stage.show();
        shell.applyCss();
        shell.layout();
        DungeonEditorControlsView controls = descendant(shell, DungeonEditorControlsView.class);
        DungeonMapView mapView = descendant(shell, DungeonMapView.class);
        DungeonEditorStateView stateView = descendant(shell, DungeonEditorStateView.class);
        ServiceRegistry services = shell.runtimeContext().services();
        return new ApplicationHarnessBinding(
                new HarnessBinding(controls, mapView, stateView, boundContentModel(mapView)),
                services.require(DungeonEditorControlsModel.class),
                services.require(DungeonEditorMapSurfaceModel.class),
                services.require(DungeonEditorStateModel.class));
    }

    static <T extends Node> T slot(ShellBinding shellBinding, ShellSlot slot, Class<T> type) {
        Node node = shellBinding.slotContent().get(slot);
        if (!type.isInstance(node)) {
            throw new IllegalStateException("Unexpected " + slot + " slot content: " + node);
        }
        return type.cast(node);
    }

    static DungeonMapContentModel boundContentModel(DungeonMapView mapView) {
        try {
            Field bindingField = DungeonMapView.class.getDeclaredField("removeCanvasBinding");
            bindingField.setAccessible(true);
            Object binding = bindingField.get(mapView);
            for (Field capturedField : binding.getClass().getDeclaredFields()) {
                capturedField.setAccessible(true);
                Object value = capturedField.get(binding);
                if (value instanceof DungeonMapContentModel contentModel) {
                    return contentModel;
                }
            }
        } catch (ReflectiveOperationException exception) {
            throw new IllegalStateException("Could not inspect bound DungeonMapContentModel.", exception);
        }
        throw new IllegalStateException("Bound DungeonMapContentModel not found on DungeonMapView.");
    }

    static void assertTrue(boolean condition, String message) {
        if (!condition) {
            throw new AssertionError(message);
        }
    }

    static long elapsedMillis(long startedNanos) {
        return TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - startedNanos);
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

    @FunctionalInterface
    interface ThrowingRunnable {
        void run() throws Exception;
    }

    record HarnessBinding(
            DungeonEditorControlsView controls,
            DungeonMapView mapView,
            DungeonEditorStateView stateView,
            DungeonMapContentModel mapContentModel
    ) {
    }

    record ApplicationHarnessBinding(
            HarnessBinding binding,
            DungeonEditorControlsModel controlsModel,
            DungeonEditorMapSurfaceModel mapSurfaceModel,
            DungeonEditorStateModel stateModel
    ) {
    }

    record RoomClusterIds(long roomId, long clusterId) {
    }

    record HarnessRuntime(
            ShellRuntimeContext context,
            DungeonEditorControlsModel controlsModel,
            DungeonEditorMapSurfaceModel mapSurfaceModel,
            DungeonEditorStateModel stateModel,
            DatabaseAssertions database
    ) {
        static HarnessRuntime create() {
            DatabaseAssertions database = new DatabaseAssertions();
            database.clearDungeonData();
            ServiceRegistry.Builder builder = new ServiceRegistry.Builder();
            builder.register(DungeonMapRepository.class, new SqliteDungeonMapRepository());
            builder.register(TravelPartyStateRepository.class, new EmptyTravelPartyStateRepository());
            builder.register(TravelPartyPositionRepository.class, new EmptyTravelPartyPositionRepository());
            new DungeonServiceContribution().register(builder);
            ServiceRegistry registry = builder.build();
            return new HarnessRuntime(
                    new ShellRuntimeContext(EmptyInspectorSink.INSTANCE, registry),
                    registry.require(DungeonEditorControlsModel.class),
                    registry.require(DungeonEditorMapSurfaceModel.class),
                    registry.require(DungeonEditorStateModel.class),
                    database);
        }
    }

    enum EmptyInspectorSink implements InspectorSink {
        INSTANCE;

        @Override
        public void push(InspectorEntrySpec entry) {
        }

        @Override
        public void clear() {
        }

        @Override
        public boolean isShowing(Object entryKey) {
            return false;
        }
    }

    static final class EmptyTravelPartyStateRepository implements TravelPartyStateRepository {
        @Override
        public TravelDungeonActiveState.ActiveTravelStateData loadActiveTravelState() {
            return new TravelDungeonActiveState.ActiveTravelStateData(List.of(), null);
        }
    }

    static final class EmptyTravelPartyPositionRepository implements TravelPartyPositionRepository {
        @Override
        public boolean saveDungeonPosition(
                TravelDungeonSessionSurface.PositionData position,
                List<Long> characterIds
        ) {
            return false;
        }

        @Override
        public boolean saveOverworldPosition(
                TravelDungeonSessionValues.OverworldTarget target,
                List<Long> characterIds
        ) {
            return false;
        }
    }

    static final class DatabaseAssertions {
        final Path databasePath;

        DatabaseAssertions() {
            String xdgDataHome = System.getenv("XDG_DATA_HOME");
            if (xdgDataHome == null || xdgDataHome.isBlank()) {
                throw new IllegalStateException("XDG_DATA_HOME must isolate the Dungeon Editor behavior DB.");
            }
            databasePath = Path.of(xdgDataHome, "salt-marcher", DungeonPersistenceSchema.DATABASE_FILE_NAME);
        }

        long countMapsNamed(String mapName) {
            return count("SELECT COUNT(*) FROM dungeon_maps WHERE name=?", mapName);
        }

        void clearDungeonData() {
            try (Connection connection = open();
                 Statement statement = connection.createStatement()) {
                statement.execute("PRAGMA foreign_keys=ON");
                for (String createTableSql : DungeonPersistenceSchema.CREATE_TABLE_SQL) {
                    statement.execute(createTableSql);
                }
                statement.executeUpdate("DELETE FROM dungeon_maps");
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to reset Dungeon Editor behavior DB.", exception);
            }
        }

        long createPersistedMap(String mapName) {
            try (Connection connection = open()) {
                connection.setAutoCommit(false);
                long mapId = insertAndReturnId(
                        connection,
                        "INSERT INTO dungeon_maps(name) VALUES(?)",
                        mapName);
                connection.commit();
                return mapId;
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to create persisted dungeon map fixture.", exception);
            }
        }

        long countMapIdWithName(long mapId, String mapName) {
            return count("SELECT COUNT(*) FROM dungeon_maps WHERE dungeon_map_id=? AND name=?", mapId, mapName);
        }

        long countAuthoredGeometryRows(long mapId) {
            long rows = 0L;
            rows += count("SELECT COUNT(*) FROM dungeon_rooms WHERE dungeon_map_id=?", mapId);
            rows += count("SELECT COUNT(*) FROM dungeon_room_clusters WHERE dungeon_map_id=?", mapId);
            rows += count("SELECT COUNT(*) FROM dungeon_room_floors WHERE room_id IN ("
                    + "SELECT room_id FROM dungeon_rooms WHERE dungeon_map_id=?)", mapId);
            rows += count("SELECT COUNT(*) FROM dungeon_room_cluster_vertices WHERE cluster_id IN ("
                    + "SELECT cluster_id FROM dungeon_room_clusters WHERE dungeon_map_id=?)", mapId);
            rows += count("SELECT COUNT(*) FROM dungeon_room_cluster_edges WHERE cluster_id IN ("
                    + "SELECT cluster_id FROM dungeon_room_clusters WHERE dungeon_map_id=?)", mapId);
            rows += count("SELECT COUNT(*) FROM dungeon_corridors WHERE dungeon_map_id=?", mapId);
            rows += count("SELECT COUNT(*) FROM dungeon_topology_elements WHERE dungeon_map_id=?", mapId);
            rows += count("SELECT COUNT(*) FROM dungeon_stairs WHERE dungeon_map_id=?", mapId);
            rows += count("SELECT COUNT(*) FROM dungeon_transitions WHERE dungeon_map_id=?", mapId);
            return rows;
        }

        long countRoomsForMap(long mapId) {
            return count("SELECT COUNT(*) FROM dungeon_rooms WHERE dungeon_map_id=?", mapId);
        }

        long countRoomClustersForMap(long mapId) {
            return count("SELECT COUNT(*) FROM dungeon_room_clusters WHERE dungeon_map_id=?", mapId);
        }

        long countClusterVertexRows(long mapId) {
            return count(
                    "SELECT COUNT(*) FROM dungeon_room_cluster_vertices WHERE cluster_id IN ("
                            + "SELECT cluster_id FROM dungeon_room_clusters WHERE dungeon_map_id=?)",
                    mapId);
        }

        Set<Long> corridorIdsForMap(long mapId) {
            try (Connection connection = open();
                 PreparedStatement statement = connection.prepareStatement(
                         "SELECT corridor_id FROM dungeon_corridors WHERE dungeon_map_id=? ORDER BY corridor_id")) {
                bind(statement, mapId);
                try (ResultSet resultSet = statement.executeQuery()) {
                    Set<Long> ids = new LinkedHashSet<>();
                    while (resultSet.next()) {
                        ids.add(resultSet.getLong("corridor_id"));
                    }
                    return ids;
                }
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to read corridor ids.", exception);
            }
        }

        long countClusterEdges(long clusterId) {
            return count("SELECT COUNT(*) FROM dungeon_room_cluster_edges WHERE cluster_id=?", clusterId);
        }

        long countWallBoundariesForDirection(long mapId, String direction) {
            return count(
                    "SELECT COUNT(*) FROM dungeon_room_cluster_edges edge_row"
                            + " JOIN dungeon_room_clusters cluster_row ON cluster_row.cluster_id=edge_row.cluster_id"
                            + " WHERE cluster_row.dungeon_map_id=?"
                            + " AND edge_row.edge_direction=?"
                            + " AND edge_row.edge_type='WALL'",
                    mapId,
                    direction);
        }

        long countWallBoundaryRows(long mapId) {
            return count(
                    "SELECT COUNT(*) FROM dungeon_room_cluster_edges edge_row"
                            + " JOIN dungeon_room_clusters cluster_row ON cluster_row.cluster_id=edge_row.cluster_id"
                            + " WHERE cluster_row.dungeon_map_id=?"
                            + " AND edge_row.edge_type='WALL'",
                    mapId);
        }

        long countDistinctWallBoundaryTopologyRefs(long mapId) {
            return count(
                    "SELECT COUNT(DISTINCT edge_row.topology_element_id)"
                            + " FROM dungeon_room_cluster_edges edge_row"
                            + " JOIN dungeon_room_clusters cluster_row ON cluster_row.cluster_id=edge_row.cluster_id"
                            + " WHERE cluster_row.dungeon_map_id=?"
                            + " AND edge_row.edge_type='WALL'"
                            + " AND edge_row.topology_element_id IS NOT NULL",
                    mapId);
        }

        long countUnreferencedWallTopologyElements(long mapId) {
            return count(
                    "SELECT COUNT(*) FROM dungeon_topology_elements topology_row"
                            + " WHERE topology_row.dungeon_map_id=?"
                            + " AND topology_row.element_kind='WALL'"
                            + " AND NOT EXISTS ("
                            + " SELECT 1 FROM dungeon_room_cluster_edges edge_row"
                            + " JOIN dungeon_room_clusters cluster_row"
                            + " ON cluster_row.cluster_id=edge_row.cluster_id"
                            + " WHERE cluster_row.dungeon_map_id=topology_row.dungeon_map_id"
                            + " AND edge_row.topology_element_id=topology_row.element_id"
                            + " AND edge_row.edge_type='WALL')",
                    mapId);
        }

        Set<String> wallBoundaryAbsoluteRowsForDirection(long mapId, String direction) {
            try (Connection connection = open();
                 PreparedStatement statement = connection.prepareStatement(
                         "SELECT cluster_row.center_x + edge_row.cell_x AS absolute_x,"
                                 + " cluster_row.center_y + edge_row.cell_y AS absolute_y,"
                                 + " edge_row.level_z, edge_row.edge_direction, edge_row.edge_type"
                                 + " FROM dungeon_room_cluster_edges edge_row"
                                 + " JOIN dungeon_room_clusters cluster_row"
                                 + " ON cluster_row.cluster_id=edge_row.cluster_id"
                                 + " WHERE cluster_row.dungeon_map_id=?"
                                 + " AND edge_row.edge_direction=?"
                                 + " AND edge_row.edge_type='WALL'"
                                 + " ORDER BY edge_row.level_z, absolute_x, absolute_y")) {
                bind(statement, mapId, direction);
                try (ResultSet resultSet = statement.executeQuery()) {
                    Set<String> rows = new LinkedHashSet<>();
                    while (resultSet.next()) {
                        rows.add("cell=" + resultSet.getInt("absolute_x")
                                + ","
                                + resultSet.getInt("absolute_y")
                                + ","
                                + resultSet.getInt("level_z")
                                + ",direction=" + resultSet.getString("edge_direction")
                                + ",type=" + resultSet.getString("edge_type"));
                    }
                    return rows;
                }
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to read absolute wall boundary rows.", exception);
            }
        }

        long countOpenBoundariesForDirection(long mapId, String direction) {
            return count(
                    "SELECT COUNT(*) FROM dungeon_room_cluster_edges edge_row"
                            + " JOIN dungeon_room_clusters cluster_row ON cluster_row.cluster_id=edge_row.cluster_id"
                            + " WHERE cluster_row.dungeon_map_id=?"
                            + " AND edge_row.edge_direction=?"
                            + " AND edge_row.edge_type='OPEN'"
                            + " AND edge_row.topology_element_id IS NULL",
                    mapId,
                    direction);
        }

        long countInternalWallBoundaries(long clusterId) {
            return count(
                    "SELECT COUNT(*) FROM dungeon_room_cluster_edges"
                            + " WHERE cluster_id=?"
                            + " AND cell_x=-1"
                            + " AND cell_y IN (-1, 0, 1)"
                            + " AND edge_direction='EAST'"
                            + " AND edge_type='WALL'"
                            + " AND topology_element_id IS NOT NULL",
                    clusterId);
        }

        List<String> openBoundaryRowsForDirection(long clusterId, String direction) {
            try (Connection connection = open();
                 PreparedStatement statement = connection.prepareStatement(
                         "SELECT level_z, cell_x, cell_y, edge_direction, edge_type, topology_element_id"
                                 + " FROM dungeon_room_cluster_edges"
                                 + " WHERE cluster_id=? AND edge_direction=? AND edge_type='OPEN'"
                                 + " ORDER BY level_z, cell_x, cell_y, edge_direction")) {
                bind(statement, clusterId, direction);
                try (ResultSet resultSet = statement.executeQuery()) {
                    List<String> rows = new ArrayList<>();
                    while (resultSet.next()) {
                        rows.add("level_z=" + resultSet.getInt("level_z")
                                + ",cell_x=" + resultSet.getInt("cell_x")
                                + ",cell_y=" + resultSet.getInt("cell_y")
                                + ",edge_direction=" + resultSet.getString("edge_direction")
                                + ",edge_type=" + resultSet.getString("edge_type")
                                + ",topology_element_id="
                                + Objects.toString(resultSet.getObject("topology_element_id"), "<null>"));
                    }
                    return rows;
                }
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to read open boundary rows.", exception);
            }
        }

        long countWallTopologyElementsForDirection(long mapId, String direction) {
            List<Long> topologyElementIds = wallTopologyElementIdsForDirection(direction);
            return count(
                    "SELECT COUNT(*) FROM dungeon_topology_elements topology_row"
                            + " WHERE topology_row.dungeon_map_id=?"
                            + " AND topology_row.element_kind='WALL'"
                            + " AND topology_row.element_id IN (?, ?, ?)",
                    mapId,
                    topologyElementIds.get(0),
                    topologyElementIds.get(1),
                    topologyElementIds.get(2));
        }

        long countInternalWallTopologyElements(long mapId) {
            return count(
                    "SELECT COUNT(*) FROM dungeon_topology_elements topology_row"
                            + " WHERE topology_row.dungeon_map_id=?"
                            + " AND topology_row.element_kind='WALL'"
                            + " AND topology_row.element_id IN (?, ?, ?)",
                    mapId,
                    wallTopologyElementId(2, 2, 0, -1, -1, "EAST"),
                    wallTopologyElementId(2, 2, 0, -1, 0, "EAST"),
                    wallTopologyElementId(2, 2, 0, -1, 1, "EAST"));
        }

        static List<Long> wallTopologyElementIdsForDirection(String direction) {
            if ("NORTH".equals(direction) || "SOUTH".equals(direction)) {
                int relativeY = "NORTH".equals(direction) ? -1 : 1;
                return List.of(
                        wallTopologyElementId(2, 2, 0, -1, relativeY, direction),
                        wallTopologyElementId(2, 2, 0, 0, relativeY, direction),
                        wallTopologyElementId(2, 2, 0, 1, relativeY, direction));
            }
            if ("WEST".equals(direction) || "EAST".equals(direction)) {
                int relativeX = "WEST".equals(direction) ? -1 : 1;
                return List.of(
                        wallTopologyElementId(2, 2, 0, relativeX, -1, direction),
                        wallTopologyElementId(2, 2, 0, relativeX, 0, direction),
                        wallTopologyElementId(2, 2, 0, relativeX, 1, direction));
            }
            throw new IllegalArgumentException("Unsupported wall direction: " + direction);
        }

        Set<String> roomFloorCells(long roomId) {
            try (Connection connection = open();
                 PreparedStatement statement = connection.prepareStatement(
                         "SELECT anchor_x, anchor_y, level_z"
                                 + " FROM dungeon_room_floors WHERE room_id=?"
                                 + " ORDER BY level_z, anchor_x, anchor_y")) {
                statement.setLong(1, roomId);
                try (ResultSet resultSet = statement.executeQuery()) {
                    Set<String> cells = new LinkedHashSet<>();
                    while (resultSet.next()) {
                        cells.add(resultSet.getInt("anchor_x")
                                + ","
                                + resultSet.getInt("anchor_y")
                                + ","
                                + resultSet.getInt("level_z"));
                    }
                    return cells;
                }
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to read room floor cells.", exception);
            }
        }

        long clusterIdByCenter(long mapId, int centerX, int centerY, int level) {
            try (Connection connection = open();
                 PreparedStatement statement = connection.prepareStatement(
                         "SELECT cluster_id FROM dungeon_room_clusters"
                                 + " WHERE dungeon_map_id=? AND center_x=? AND center_y=? AND level_z=?")) {
                bind(statement, mapId, centerX, centerY, level);
                return scalar(statement);
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to find room cluster by center.", exception);
            }
        }

        long countClustersAtCenter(long mapId, int centerX, int centerY, int level) {
            return count(
                    "SELECT COUNT(*) FROM dungeon_room_clusters"
                            + " WHERE dungeon_map_id=? AND center_x=? AND center_y=? AND level_z=?",
                    mapId,
                    centerX,
                    centerY,
                    level);
        }

        RoomClusterIds roomByComponent(long mapId, int componentX, int componentY, int level) {
            try (Connection connection = open();
                 PreparedStatement statement = connection.prepareStatement(
                         "SELECT room_id, cluster_id FROM dungeon_rooms"
                                 + " WHERE dungeon_map_id=? AND component_x=? AND component_y=? AND level_z=?")) {
                bind(statement, mapId, componentX, componentY, level);
                try (ResultSet resultSet = statement.executeQuery()) {
                    if (!resultSet.next()) {
                        throw new SQLException("No room found by component cell.");
                    }
                    RoomClusterIds ids = new RoomClusterIds(resultSet.getLong("room_id"), resultSet.getLong("cluster_id"));
                    if (resultSet.next()) {
                        throw new SQLException("Multiple rooms found by component cell.");
                    }
                    return ids;
                }
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to find room by component cell.", exception);
            }
        }

        List<String> roomClusterState(long mapId, String roomName) {
            RoomClusterIds ids = roomByName(mapId, roomName);
            try (Connection connection = open()) {
                List<String> state = new ArrayList<>();
                appendRows(
                        connection,
                        state,
                        "dungeon_rooms",
                        "SELECT room_id, dungeon_map_id, cluster_id, name, visual_description,"
                                + " component_x, component_y, level_z"
                                + " FROM dungeon_rooms WHERE room_id=? ORDER BY room_id",
                        ids.roomId());
                appendRows(
                        connection,
                        state,
                        "dungeon_room_clusters",
                        "SELECT cluster_id, dungeon_map_id, center_x, center_y, level_z"
                                + " FROM dungeon_room_clusters WHERE cluster_id=? ORDER BY cluster_id",
                        ids.clusterId());
                appendRows(
                        connection,
                        state,
                        "dungeon_room_floors",
                        "SELECT room_id, level_z, anchor_x, anchor_y"
                                + " FROM dungeon_room_floors WHERE room_id=? ORDER BY level_z",
                        ids.roomId());
                appendRows(
                        connection,
                        state,
                        "dungeon_room_cluster_vertices",
                        "SELECT cluster_id, level_z, vertex_index, relative_x, relative_y"
                                + " FROM dungeon_room_cluster_vertices WHERE cluster_id=?"
                                + " ORDER BY level_z, vertex_index",
                        ids.clusterId());
                appendRows(
                        connection,
                        state,
                        "dungeon_room_cluster_edges",
                        "SELECT cluster_id, level_z, cell_x, cell_y, edge_direction, edge_type, topology_element_id"
                                + " FROM dungeon_room_cluster_edges WHERE cluster_id=?"
                                + " ORDER BY level_z, cell_x, cell_y, edge_direction",
                        ids.clusterId());
                appendRows(
                        connection,
                        state,
                        "dungeon_topology_elements",
                        "SELECT dungeon_map_id, element_kind, element_id, cluster_id, corridor_id, label, sort_order"
                                + " FROM dungeon_topology_elements"
                                + " WHERE dungeon_map_id=? AND cluster_id=?"
                                + " ORDER BY element_kind, element_id",
                        mapId,
                        ids.clusterId());
                return state;
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to snapshot room/cluster state.", exception);
            }
        }

        RoomClusterIds roomByName(long mapId, String roomName) {
            try (Connection connection = open();
                 PreparedStatement statement = connection.prepareStatement(
                         "SELECT room_id, cluster_id FROM dungeon_rooms WHERE dungeon_map_id=? AND name=?")) {
                bind(statement, mapId, roomName);
                try (ResultSet resultSet = statement.executeQuery()) {
                    if (!resultSet.next()) {
                        throw new SQLException("No room found by name: " + roomName);
                    }
                    RoomClusterIds ids = new RoomClusterIds(resultSet.getLong("room_id"), resultSet.getLong("cluster_id"));
                    if (resultSet.next()) {
                        throw new SQLException("Multiple rooms found by name: " + roomName);
                    }
                    return ids;
                }
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to find room by name.", exception);
            }
        }

        Set<String> absoluteClusterVertices(long clusterId) {
            try (Connection connection = open();
                 PreparedStatement statement = connection.prepareStatement(
                         "SELECT cluster_row.center_x + vertex_row.relative_x AS absolute_x,"
                                 + " cluster_row.center_y + vertex_row.relative_y AS absolute_y,"
                                 + " vertex_row.level_z AS level_z"
                                 + " FROM dungeon_room_cluster_vertices vertex_row"
                                 + " JOIN dungeon_room_clusters cluster_row"
                                 + " ON cluster_row.cluster_id=vertex_row.cluster_id"
                                 + " WHERE vertex_row.cluster_id=?"
                                 + " ORDER BY vertex_row.level_z, vertex_row.vertex_index")) {
                statement.setLong(1, clusterId);
                try (ResultSet resultSet = statement.executeQuery()) {
                    Set<String> vertices = new LinkedHashSet<>();
                    while (resultSet.next()) {
                        vertices.add(resultSet.getInt("absolute_x")
                                + ","
                                + resultSet.getInt("absolute_y")
                                + ","
                                + resultSet.getInt("level_z"));
                    }
                    return vertices;
                }
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to read absolute cluster vertices.", exception);
            }
        }

        long countRoomVisualDescription(long roomId, String visualDescription) {
            return count(
                    "SELECT COUNT(*) FROM dungeon_rooms WHERE room_id=? AND visual_description=?",
                    roomId,
                    visualDescription);
        }

        long countRoomExitDescription(
                long roomId,
                int cellX,
                int cellY,
                String direction,
                String description
        ) {
            return count(
                    "SELECT COUNT(*) FROM dungeon_room_exit_descriptions"
                            + " WHERE room_id=? AND cell_x=? AND cell_y=? AND edge_direction=? AND description=?",
                    roomId,
                    cellX,
                    cellY,
                    direction,
                    description);
        }

        long countDoorBoundariesAt(long mapId, int relativeCellX, int relativeCellY, String direction) {
            return count(
                    "SELECT COUNT(*) FROM dungeon_room_cluster_edges edge_row"
                            + " JOIN dungeon_room_clusters cluster_row ON cluster_row.cluster_id=edge_row.cluster_id"
                            + " JOIN dungeon_topology_elements topology_row"
                            + " ON topology_row.dungeon_map_id=cluster_row.dungeon_map_id"
                            + " AND topology_row.element_kind='DOOR'"
                            + " AND topology_row.element_id=edge_row.topology_element_id"
                            + " WHERE cluster_row.dungeon_map_id=?"
                            + " AND edge_row.cell_x=?"
                            + " AND edge_row.cell_y=?"
                            + " AND edge_row.edge_direction=?"
                            + " AND edge_row.edge_type='DOOR'",
                    mapId,
                    relativeCellX,
                    relativeCellY,
                    direction);
        }

        List<String> authoredGeometryState(long mapId) {
            try (Connection connection = open()) {
                List<String> state = new ArrayList<>();
                appendRows(
                        connection,
                        state,
                        "dungeon_rooms",
                        "SELECT room_id, dungeon_map_id, cluster_id, name, visual_description,"
                                + " component_x, component_y, level_z"
                                + " FROM dungeon_rooms WHERE dungeon_map_id=? ORDER BY room_id",
                        mapId);
                appendRows(
                        connection,
                        state,
                        "dungeon_room_clusters",
                        "SELECT cluster_id, dungeon_map_id, center_x, center_y, level_z"
                                + " FROM dungeon_room_clusters WHERE dungeon_map_id=? ORDER BY cluster_id",
                        mapId);
                appendRows(
                        connection,
                        state,
                        "dungeon_room_floors",
                        "SELECT room_floor.room_id, room_floor.level_z, room_floor.anchor_x, room_floor.anchor_y"
                                + " FROM dungeon_room_floors room_floor"
                                + " JOIN dungeon_rooms room ON room.room_id=room_floor.room_id"
                                + " WHERE room.dungeon_map_id=?"
                                + " ORDER BY room_floor.room_id, room_floor.level_z",
                        mapId);
                appendRows(
                        connection,
                        state,
                        "dungeon_room_cluster_vertices",
                        "SELECT vertex_row.cluster_id, vertex_row.level_z, vertex_row.vertex_index,"
                                + " vertex_row.relative_x, vertex_row.relative_y"
                                + " FROM dungeon_room_cluster_vertices vertex_row"
                                + " JOIN dungeon_room_clusters cluster_row ON cluster_row.cluster_id=vertex_row.cluster_id"
                                + " WHERE cluster_row.dungeon_map_id=?"
                                + " ORDER BY vertex_row.cluster_id, vertex_row.level_z, vertex_row.vertex_index",
                        mapId);
                appendRows(
                        connection,
                        state,
                        "dungeon_room_cluster_edges",
                        "SELECT edge_row.cluster_id, edge_row.level_z, edge_row.cell_x, edge_row.cell_y,"
                                + " edge_row.edge_direction, edge_row.edge_type, edge_row.topology_element_id"
                                + " FROM dungeon_room_cluster_edges edge_row"
                                + " JOIN dungeon_room_clusters cluster_row ON cluster_row.cluster_id=edge_row.cluster_id"
                                + " WHERE cluster_row.dungeon_map_id=?"
                                + " ORDER BY edge_row.cluster_id, edge_row.level_z, edge_row.cell_x,"
                                + " edge_row.cell_y, edge_row.edge_direction",
                        mapId);
                appendRows(
                        connection,
                        state,
                        "dungeon_corridors",
                        "SELECT corridor_id, dungeon_map_id, level_z"
                                + " FROM dungeon_corridors WHERE dungeon_map_id=? ORDER BY corridor_id",
                        mapId);
                appendRows(
                        connection,
                        state,
                        "dungeon_corridor_members",
                        "SELECT member_row.corridor_id, member_row.room_id, member_row.member_order"
                                + " FROM dungeon_corridor_members member_row"
                                + " JOIN dungeon_corridors corridor_row"
                                + " ON corridor_row.corridor_id=member_row.corridor_id"
                                + " WHERE corridor_row.dungeon_map_id=?"
                                + " ORDER BY member_row.corridor_id, member_row.member_order, member_row.room_id",
                        mapId);
                appendRows(
                        connection,
                        state,
                        "dungeon_topology_elements",
                        "SELECT dungeon_map_id, element_kind, element_id, cluster_id,"
                                + " corridor_id, label, sort_order"
                                + " FROM dungeon_topology_elements WHERE dungeon_map_id=?"
                                + " ORDER BY element_kind, element_id",
                        mapId);
                appendRows(
                        connection,
                        state,
                        "dungeon_corridor_door_overrides",
                        "SELECT override_row.corridor_id, override_row.room_id, override_row.cluster_id,"
                                + " override_row.relative_cell_x, override_row.relative_cell_y,"
                                + " override_row.edge_direction, override_row.topology_element_id,"
                                + " override_row.sort_order"
                                + " FROM dungeon_corridor_door_overrides override_row"
                                + " JOIN dungeon_corridors corridor_row"
                                + " ON corridor_row.corridor_id=override_row.corridor_id"
                                + " WHERE corridor_row.dungeon_map_id=?"
                                + " ORDER BY override_row.corridor_id, override_row.sort_order,"
                                + " override_row.room_id",
                        mapId);
                appendRows(
                        connection,
                        state,
                        "dungeon_corridor_anchors",
                        "SELECT anchor_row.corridor_id, anchor_row.anchor_id,"
                                + " anchor_row.host_corridor_id, anchor_row.cell_x, anchor_row.cell_y,"
                                + " anchor_row.cell_z, anchor_row.topology_element_id, anchor_row.sort_order"
                                + " FROM dungeon_corridor_anchors anchor_row"
                                + " JOIN dungeon_corridors corridor_row"
                                + " ON corridor_row.corridor_id=anchor_row.corridor_id"
                                + " WHERE corridor_row.dungeon_map_id=?"
                                + " ORDER BY anchor_row.corridor_id, anchor_row.sort_order, anchor_row.anchor_id",
                        mapId);
                appendRows(
                        connection,
                        state,
                        "dungeon_corridor_anchor_refs",
                        "SELECT ref_row.corridor_id, ref_row.host_corridor_id,"
                                + " ref_row.topology_element_id"
                                + " FROM dungeon_corridor_anchor_refs ref_row"
                                + " JOIN dungeon_corridors corridor_row"
                                + " ON corridor_row.corridor_id=ref_row.corridor_id"
                                + " WHERE corridor_row.dungeon_map_id=?"
                                + " ORDER BY ref_row.corridor_id,"
                                + " ref_row.topology_element_id",
                        mapId);
                appendRows(
                        connection,
                        state,
                        "dungeon_corridor_waypoints",
                        "SELECT waypoint_row.corridor_id, waypoint_row.sort_order,"
                                + " waypoint_row.cluster_id, waypoint_row.relative_x,"
                                + " waypoint_row.relative_y, waypoint_row.relative_z"
                                + " FROM dungeon_corridor_waypoints waypoint_row"
                                + " JOIN dungeon_corridors corridor_row"
                                + " ON corridor_row.corridor_id=waypoint_row.corridor_id"
                                + " WHERE corridor_row.dungeon_map_id=?"
                                + " ORDER BY waypoint_row.corridor_id, waypoint_row.sort_order",
                        mapId);
                appendRows(
                        connection,
                        state,
                        "dungeon_room_exit_descriptions",
                        "SELECT exit_row.room_id, exit_row.cell_x, exit_row.cell_y,"
                                + " exit_row.edge_direction, exit_row.description, exit_row.sort_order"
                                + " FROM dungeon_room_exit_descriptions exit_row"
                                + " JOIN dungeon_rooms room_row ON room_row.room_id=exit_row.room_id"
                                + " WHERE room_row.dungeon_map_id=?"
                                + " ORDER BY exit_row.room_id, exit_row.sort_order, exit_row.cell_x,"
                                + " exit_row.cell_y, exit_row.edge_direction",
                        mapId);
                appendRows(
                        connection,
                        state,
                        "dungeon_stairs",
                        "SELECT stair_id, dungeon_map_id, name, shape, direction,"
                                + " dimension1, dimension2, corridor_id"
                                + " FROM dungeon_stairs WHERE dungeon_map_id=? ORDER BY stair_id",
                        mapId);
                appendRows(
                        connection,
                        state,
                        "dungeon_stair_path_nodes",
                        "SELECT path_node.stair_id, path_node.sort_order, path_node.cell_x,"
                                + " path_node.cell_y, path_node.cell_z"
                                + " FROM dungeon_stair_path_nodes path_node"
                                + " JOIN dungeon_stairs stair_row ON stair_row.stair_id=path_node.stair_id"
                                + " WHERE stair_row.dungeon_map_id=?"
                                + " ORDER BY path_node.stair_id, path_node.sort_order",
                        mapId);
                appendRows(
                        connection,
                        state,
                        "dungeon_stair_exits",
                        "SELECT stair_exit.stair_exit_id, stair_exit.stair_id,"
                                + " stair_exit.cell_x, stair_exit.cell_y, stair_exit.cell_z, stair_exit.label"
                                + " FROM dungeon_stair_exits stair_exit"
                                + " JOIN dungeon_stairs stair_row ON stair_row.stair_id=stair_exit.stair_id"
                                + " WHERE stair_row.dungeon_map_id=?"
                                + " ORDER BY stair_exit.stair_id, stair_exit.stair_exit_id",
                        mapId);
                appendRows(
                        connection,
                        state,
                        "dungeon_transitions",
                        "SELECT transition_id, dungeon_map_id, description, cell_x, cell_y,"
                                + " level_z, destination_type, target_overworld_map_id,"
                                + " target_overworld_tile_id, target_dungeon_map_id,"
                                + " target_transition_id, linked_transition_id"
                                + " FROM dungeon_transitions WHERE dungeon_map_id=? ORDER BY transition_id",
                        mapId);
                return state;
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to snapshot authored geometry DB state.", exception);
            }
        }

        List<String> doorBoundaryState(long mapId) {
            try (Connection connection = open()) {
                List<String> state = new ArrayList<>();
                appendRows(
                        connection,
                        state,
                        "door_edges",
                        "SELECT edge_row.cluster_id, edge_row.level_z, edge_row.cell_x, edge_row.cell_y,"
                                + " edge_row.edge_direction, edge_row.edge_type, edge_row.topology_element_id"
                                + " FROM dungeon_room_cluster_edges edge_row"
                                + " JOIN dungeon_room_clusters cluster_row ON cluster_row.cluster_id=edge_row.cluster_id"
                                + " WHERE cluster_row.dungeon_map_id=? AND edge_row.edge_type='DOOR'"
                                + " ORDER BY edge_row.cluster_id, edge_row.cell_x, edge_row.cell_y,"
                                + " edge_row.edge_direction",
                        mapId);
                return state;
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to snapshot door boundary DB state.", exception);
            }
        }

        List<String> roomBoundaryEdgeState(long mapId) {
            try (Connection connection = open()) {
                List<String> state = new ArrayList<>();
                appendRows(
                        connection,
                        state,
                        "dungeon_room_cluster_edges",
                        "SELECT edge_row.cluster_id, edge_row.level_z, edge_row.cell_x, edge_row.cell_y,"
                                + " edge_row.edge_direction, edge_row.edge_type, edge_row.topology_element_id"
                                + " FROM dungeon_room_cluster_edges edge_row"
                                + " JOIN dungeon_room_clusters cluster_row ON cluster_row.cluster_id=edge_row.cluster_id"
                                + " WHERE cluster_row.dungeon_map_id=?"
                                + " ORDER BY edge_row.cluster_id, edge_row.level_z, edge_row.cell_x,"
                                + " edge_row.cell_y, edge_row.edge_direction",
                        mapId);
                return state;
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to snapshot room boundary DB state.", exception);
            }
        }

        List<String> corridorAnchorState(long mapId) {
            try (Connection connection = open()) {
                List<String> state = new ArrayList<>();
                appendRows(
                        connection,
                        state,
                        "dungeon_corridor_anchors",
                        "SELECT anchor_row.corridor_id, anchor_row.anchor_id,"
                                + " anchor_row.host_corridor_id, anchor_row.cell_x, anchor_row.cell_y,"
                                + " anchor_row.cell_z, anchor_row.topology_element_id, anchor_row.sort_order"
                                + " FROM dungeon_corridor_anchors anchor_row"
                                + " JOIN dungeon_corridors corridor_row"
                                + " ON corridor_row.corridor_id=anchor_row.corridor_id"
                                + " WHERE corridor_row.dungeon_map_id=?"
                                + " ORDER BY anchor_row.corridor_id, anchor_row.anchor_id",
                        mapId);
                return state;
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to snapshot corridor anchor DB state.", exception);
            }
        }

        long countCorridorAnchorsAt(long mapId, int cellX, int cellY, int cellZ) {
            return count(
                    "SELECT COUNT(*) FROM dungeon_corridor_anchors anchor_row"
                            + " JOIN dungeon_corridors corridor_row"
                            + " ON corridor_row.corridor_id=anchor_row.corridor_id"
                            + " WHERE corridor_row.dungeon_map_id=?"
                            + " AND anchor_row.cell_x=? AND anchor_row.cell_y=? AND anchor_row.cell_z=?",
                    mapId,
                    cellX,
                    cellY,
                    cellZ);
        }

        List<String> corridorWaypointAbsoluteState(long mapId) {
            try (Connection connection = open()) {
                List<String> state = new ArrayList<>();
                appendRows(
                        connection,
                        state,
                        "dungeon_corridor_waypoints",
                        "SELECT waypoint_row.corridor_id, waypoint_row.sort_order,"
                                + " cluster_row.center_x + waypoint_row.relative_x AS cell_x,"
                                + " cluster_row.center_y + waypoint_row.relative_y AS cell_y,"
                                + " waypoint_row.relative_z AS cell_z"
                                + " FROM dungeon_corridor_waypoints waypoint_row"
                                + " JOIN dungeon_corridors corridor_row"
                                + " ON corridor_row.corridor_id=waypoint_row.corridor_id"
                                + " JOIN dungeon_room_clusters cluster_row"
                                + " ON cluster_row.cluster_id=waypoint_row.cluster_id"
                                + " WHERE corridor_row.dungeon_map_id=?"
                                + " ORDER BY waypoint_row.corridor_id, waypoint_row.sort_order",
                        mapId);
                return state;
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to snapshot corridor waypoint absolute state.", exception);
            }
        }

        List<String> corridorStableConnectionState(long mapId) {
            try (Connection connection = open()) {
                List<String> state = new ArrayList<>();
                appendRows(
                        connection,
                        state,
                        "dungeon_corridors",
                        "SELECT corridor_id, dungeon_map_id, level_z"
                                + " FROM dungeon_corridors WHERE dungeon_map_id=? ORDER BY corridor_id",
                        mapId);
                appendRows(
                        connection,
                        state,
                        "dungeon_corridor_members",
                        "SELECT member_row.corridor_id, member_row.room_id, member_row.member_order"
                                + " FROM dungeon_corridor_members member_row"
                                + " JOIN dungeon_corridors corridor_row"
                                + " ON corridor_row.corridor_id=member_row.corridor_id"
                                + " WHERE corridor_row.dungeon_map_id=?"
                                + " ORDER BY member_row.corridor_id, member_row.member_order, member_row.room_id",
                        mapId);
                appendRows(
                        connection,
                        state,
                        "dungeon_corridor_door_overrides",
                        "SELECT override_row.corridor_id, override_row.room_id, override_row.cluster_id,"
                                + " override_row.relative_cell_x, override_row.relative_cell_y,"
                                + " override_row.edge_direction, override_row.topology_element_id,"
                                + " override_row.sort_order"
                                + " FROM dungeon_corridor_door_overrides override_row"
                                + " JOIN dungeon_corridors corridor_row"
                                + " ON corridor_row.corridor_id=override_row.corridor_id"
                                + " WHERE corridor_row.dungeon_map_id=?"
                                + " ORDER BY override_row.corridor_id, override_row.sort_order,"
                                + " override_row.room_id",
                        mapId);
                appendRows(
                        connection,
                        state,
                        "dungeon_corridor_anchor_refs",
                        "SELECT ref_row.corridor_id, ref_row.host_corridor_id,"
                                + " ref_row.topology_element_id"
                                + " FROM dungeon_corridor_anchor_refs ref_row"
                                + " JOIN dungeon_corridors corridor_row"
                                + " ON corridor_row.corridor_id=ref_row.corridor_id"
                                + " WHERE corridor_row.dungeon_map_id=?"
                                + " ORDER BY ref_row.corridor_id,"
                                + " ref_row.topology_element_id",
                        mapId);
                appendRows(
                        connection,
                        state,
                        "dungeon_corridor_waypoints",
                        "SELECT waypoint_row.corridor_id, waypoint_row.sort_order,"
                                + " waypoint_row.cluster_id, waypoint_row.relative_x,"
                                + " waypoint_row.relative_y, waypoint_row.relative_z"
                                + " FROM dungeon_corridor_waypoints waypoint_row"
                                + " JOIN dungeon_corridors corridor_row"
                                + " ON corridor_row.corridor_id=waypoint_row.corridor_id"
                                + " WHERE corridor_row.dungeon_map_id=?"
                                + " ORDER BY waypoint_row.corridor_id, waypoint_row.sort_order",
                        mapId);
                appendRows(
                        connection,
                        state,
                        "dungeon_topology_elements",
                        "SELECT dungeon_map_id, element_kind, element_id, cluster_id,"
                                + " corridor_id, label"
                                + " FROM dungeon_topology_elements WHERE dungeon_map_id=?"
                                + " AND element_kind IN ('CORRIDOR', 'CORRIDOR_ANCHOR')"
                                + " ORDER BY element_kind, element_id",
                        mapId);
                return state;
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to snapshot stable corridor connection DB state.", exception);
            }
        }

        List<String> stairStableState(long mapId) {
            try (Connection connection = open()) {
                List<String> state = new ArrayList<>();
                appendRows(
                        connection,
                        state,
                        "dungeon_stairs",
                        "SELECT stair_id, dungeon_map_id, name, shape, direction,"
                                + " dimension1, dimension2, corridor_id"
                                + " FROM dungeon_stairs WHERE dungeon_map_id=? ORDER BY stair_id",
                        mapId);
                appendRows(
                        connection,
                        state,
                        "dungeon_topology_elements",
                        "SELECT dungeon_map_id, element_kind, element_id, label"
                                + " FROM dungeon_topology_elements"
                                + " WHERE dungeon_map_id=? AND element_kind='STAIR'"
                                + " ORDER BY element_kind, element_id",
                        mapId);
                return state;
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to snapshot stair stable DB state.", exception);
            }
        }

        List<String> stairPathState(long mapId) {
            try (Connection connection = open()) {
                List<String> state = new ArrayList<>();
                appendRows(
                        connection,
                        state,
                        "dungeon_stair_path_nodes",
                        "SELECT path_node.stair_id, path_node.sort_order, path_node.cell_x,"
                                + " path_node.cell_y, path_node.cell_z"
                                + " FROM dungeon_stair_path_nodes path_node"
                                + " JOIN dungeon_stairs stair_row ON stair_row.stair_id=path_node.stair_id"
                                + " WHERE stair_row.dungeon_map_id=?"
                                + " ORDER BY path_node.stair_id, path_node.sort_order",
                        mapId);
                return state;
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to snapshot stair path DB state.", exception);
            }
        }

        long countStairPathRowsByStairId(long stairId) {
            return count(
                    "SELECT COUNT(*) FROM dungeon_stair_path_nodes WHERE stair_id=?",
                    stairId);
        }

        List<String> stairExitState(long mapId) {
            try (Connection connection = open()) {
                List<String> state = new ArrayList<>();
                appendRows(
                        connection,
                        state,
                        "dungeon_stair_exits",
                        "SELECT stair_exit.stair_exit_id, stair_exit.stair_id,"
                                + " stair_exit.cell_x, stair_exit.cell_y, stair_exit.cell_z, stair_exit.label"
                                + " FROM dungeon_stair_exits stair_exit"
                                + " JOIN dungeon_stairs stair_row ON stair_row.stair_id=stair_exit.stair_id"
                                + " WHERE stair_row.dungeon_map_id=?"
                                + " ORDER BY stair_exit.stair_id, stair_exit.stair_exit_id",
                        mapId);
                return state;
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to snapshot stair exit DB state.", exception);
            }
        }

        long countStairExitRowsByStairId(long stairId) {
            return count(
                    "SELECT COUNT(*) FROM dungeon_stair_exits WHERE stair_id=?",
                    stairId);
        }

        List<String> transitionStableState(long mapId) {
            try (Connection connection = open()) {
                List<String> state = new ArrayList<>();
                appendRows(
                        connection,
                        state,
                        "dungeon_transitions",
                        "SELECT transition_id, dungeon_map_id, cell_x, cell_y,"
                                + " level_z, destination_type, target_overworld_map_id,"
                                + " target_overworld_tile_id, target_dungeon_map_id,"
                                + " target_transition_id, linked_transition_id"
                                + " FROM dungeon_transitions WHERE dungeon_map_id=? ORDER BY transition_id",
                        mapId);
                return state;
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to snapshot transition stable DB state.", exception);
            }
        }

        long transitionIdByDescription(long mapId, String description) {
            try (Connection connection = open();
                 PreparedStatement statement = connection.prepareStatement(
                         "SELECT transition_id FROM dungeon_transitions"
                                 + " WHERE dungeon_map_id=? AND description=?")) {
                bind(statement, mapId, description);
                return scalar(statement);
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to find transition by description.", exception);
            }
        }

        long transitionIdAt(long mapId, int cellX, int cellY, int level) {
            try (Connection connection = open();
                 PreparedStatement statement = connection.prepareStatement(
                         "SELECT transition_id FROM dungeon_transitions"
                                 + " WHERE dungeon_map_id=? AND cell_x=? AND cell_y=? AND level_z=?")) {
                bind(statement, mapId, cellX, cellY, level);
                return scalar(statement);
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to find transition by cell.", exception);
            }
        }

        long maxStairId() {
            return count("SELECT COALESCE(MAX(stair_id), 0) FROM dungeon_stairs");
        }

        long maxTransitionId() {
            return count("SELECT COALESCE(MAX(transition_id), 0) FROM dungeon_transitions");
        }

        long countTransitionDescription(long mapId, long transitionId, String description) {
            return count(
                    "SELECT COUNT(*) FROM dungeon_transitions"
                            + " WHERE dungeon_map_id=? AND transition_id=? AND description=?",
                    mapId,
                    transitionId,
                    description);
        }

        long countTransitionById(long mapId, long transitionId) {
            return count(
                    "SELECT COUNT(*) FROM dungeon_transitions WHERE dungeon_map_id=? AND transition_id=?",
                    mapId,
                    transitionId);
        }

        long countTransitionTopologyElementById(long mapId, long transitionId) {
            return count(
                    "SELECT COUNT(*) FROM dungeon_topology_elements"
                            + " WHERE dungeon_map_id=? AND element_kind='TRANSITION' AND element_id=?",
                    mapId,
                    transitionId);
        }

        void seedF6MultiLevelFloors(long mapId) {
            try (Connection connection = open()) {
                connection.setAutoCommit(false);
                insertRectangularRoom(connection, mapId, "R1", 0, 1, 1);
                insertRectangularRoom(connection, mapId, "R2", 1, 1, 1);
                insertRectangularRoom(connection, mapId, "R3", 2, 1, 1);
                connection.commit();
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to seed F6_MULTI_LEVEL_FLOORS fixture.", exception);
            }
        }

        void seedTransitionDescriptionFixture(long mapId) {
            try (Connection connection = open()) {
                connection.setAutoCommit(false);
                insertRectangularRoom(connection, mapId, "R1", 0, 1, 1);
                insertRectangularRoom(connection, mapId, "R2", 1, 1, 1);
                insertRectangularRoom(connection, mapId, "R3", 2, 1, 1);
                insertTransition(connection, mapId, "Initial transition.", 5, 2, 0);
                connection.commit();
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to seed transition description fixture.", exception);
            }
        }

        void seedTransitionLinkFixture(long sourceMapId, long targetMapId) {
            try (Connection connection = open()) {
                connection.setAutoCommit(false);
                insertRectangularRoom(connection, sourceMapId, "R1", 0, 1, 1);
                insertRectangularRoom(connection, sourceMapId, "R2", 1, 1, 1);
                insertRectangularRoom(connection, sourceMapId, "R3", 2, 1, 1);
                insertTransition(connection, sourceMapId, "Source transition.", 5, 2, 0);
                insertRectangularRoom(connection, targetMapId, "R1", 0, 1, 1);
                insertTransition(connection, targetMapId, "Target transition.", 6, 2, 0);
                connection.commit();
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to seed transition link fixture.", exception);
            }
        }

        void seedSelectedLinkedTransitionFixture(long mapId) {
            try (Connection connection = open()) {
                connection.setAutoCommit(false);
                insertRectangularRoom(connection, mapId, "R1", 0, 1, 1);
                long selectedId = insertTransition(
                        connection,
                        mapId,
                        "Selected linked transition.",
                        5,
                        2,
                        0);
                long linkedId = insertTransition(
                        connection,
                        mapId,
                        "Selected linked target transition.",
                        6,
                        2,
                        0);
                updateLinkedTransition(connection, selectedId, linkedId);
                connection.commit();
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to seed selected linked transition fixture.", exception);
            }
        }

        void seedReverseLinkedTransitionFixture(long mapId) {
            try (Connection connection = open()) {
                connection.setAutoCommit(false);
                insertRectangularRoom(connection, mapId, "R1", 0, 1, 1);
                long selectedId = insertTransition(
                        connection,
                        mapId,
                        "Reverse linked target transition.",
                        5,
                        2,
                        0);
                long sourceId = insertTransition(
                        connection,
                        mapId,
                        "Reverse linked source transition.",
                        6,
                        2,
                        0);
                updateLinkedTransition(connection, sourceId, selectedId);
                connection.commit();
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to seed reverse linked transition fixture.", exception);
            }
        }

        void seedDestinationReferenceTransitionFixture(long mapId) {
            try (Connection connection = open()) {
                connection.setAutoCommit(false);
                insertRectangularRoom(connection, mapId, "R1", 0, 1, 1);
                long selectedId = insertTransition(
                        connection,
                        mapId,
                        "Destination target transition.",
                        5,
                        2,
                        0);
                long sourceId = insertTransition(
                        connection,
                        mapId,
                        "Destination source transition.",
                        6,
                        2,
                        0);
                updateDungeonMapDestination(connection, sourceId, mapId, selectedId);
                connection.commit();
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to seed transition destination reference fixture.", exception);
            }
        }

        void seedF1SingleRoom(long mapId, String roomName, int level, int anchorX, int anchorY) {
            try (Connection connection = open()) {
                connection.setAutoCommit(false);
                insertRectangularRoom(connection, mapId, roomName, level, anchorX, anchorY);
                connection.commit();
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to seed F1_SINGLE_ROOM fixture.", exception);
            }
        }

        void seedNarrationRoomWithEastExitLink(long mapId) {
            try (Connection connection = open()) {
                connection.setAutoCommit(false);
                long roomId = insertRectangularRoom(connection, mapId, "R1", 0, 1, 1);
                insertRectangularRoom(connection, mapId, "R2", 0, 4, 1);
                markDoorEdge(connection, mapId, roomId, 0, 1, 0, "EAST", "Door east", 200);
                connection.commit();
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to seed narration room with east exit link fixture.", exception);
            }
        }

        void seedF4WalledRoomWithDoor(long mapId) {
            try (Connection connection = open()) {
                connection.setAutoCommit(false);
                long roomId = insertRectangularRoom(connection, mapId, "R1", 0, 1, 1);
                insertRectangularRoom(connection, mapId, "R2", 0, 4, 1);
                markDoorEdge(connection, mapId, roomId, 0, 1, 0, "EAST", "Door east", 200);
                connection.commit();
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to seed F4_WALLED_ROOM_WITH_DOOR fixture.", exception);
            }
        }

        void seedF7StairAnchor(long mapId) {
            try (Connection connection = open()) {
                connection.setAutoCommit(false);
                insertRectangularRoom(connection, mapId, "R1", 0, 8, 8);
                long stairId = insertAndReturnId(
                        connection,
                        "INSERT INTO dungeon_stairs(dungeon_map_id, name, shape, direction, dimension1, dimension2)"
                                + " VALUES(?, ?, ?, ?, ?, ?)",
                        mapId,
                        "S1",
                        "STRAIGHT",
                        0,
                        3,
                        1);
                insertTopologyElement(connection, mapId, stairId, 0L, "STAIR", "S1", 400);
                insertStairPathNode(connection, stairId, 0, 2, 2, 0);
                insertStairPathNode(connection, stairId, 1, 2, 1, 0);
                insertStairPathNode(connection, stairId, 2, 2, 0, 0);
                insertStairExit(connection, stairId, 2, 2, 0, "Unterer Ausgang");
                insertStairExit(connection, stairId, 2, 0, 1, "Oberer Ausgang");
                connection.commit();
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to seed F7_STAIR_ANCHOR fixture.", exception);
            }
        }

        void seedF7StairAnchorWithBlockingRoom(long mapId) {
            try (Connection connection = open()) {
                connection.setAutoCommit(false);
                insertRectangularRoom(connection, mapId, "R1", 0, 3, 1);
                long stairId = insertAndReturnId(
                        connection,
                        "INSERT INTO dungeon_stairs(dungeon_map_id, name, shape, direction, dimension1, dimension2)"
                                + " VALUES(?, ?, ?, ?, ?, ?)",
                        mapId,
                        "S1",
                        "STRAIGHT",
                        0,
                        3,
                        1);
                insertTopologyElement(connection, mapId, stairId, 0L, "STAIR", "S1", 400);
                insertStairPathNode(connection, stairId, 0, 2, 2, 0);
                insertStairPathNode(connection, stairId, 1, 2, 1, 0);
                insertStairPathNode(connection, stairId, 2, 2, 0, 0);
                insertStairExit(connection, stairId, 2, 2, 0, "Unterer Ausgang");
                insertStairExit(connection, stairId, 2, 0, 1, "Oberer Ausgang");
                connection.commit();
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to seed invalid stair recompute fixture.", exception);
            }
        }

        void seedCorridorBoundStairAnchor(long mapId) {
            try (Connection connection = open()) {
                connection.setAutoCommit(false);
                long roomId = insertRectangularRoom(connection, mapId, "R1", 0, 1, 1);
                long clusterId = scalarLong(
                        connection,
                        "SELECT cluster_id FROM dungeon_rooms WHERE room_id=?",
                        roomId);
                long corridorId = insertAndReturnId(
                        connection,
                        "INSERT INTO dungeon_corridors(dungeon_map_id, level_z) VALUES(?, ?)",
                        mapId,
                        0);
                insertCorridorTopologyElement(connection, mapId, corridorId, corridorId, "CORRIDOR", "K1", 300);
                insertCorridorWaypoint(connection, corridorId, clusterId, 0, 2, 0, 0);
                long stairId = insertAndReturnId(
                        connection,
                        "INSERT INTO dungeon_stairs(dungeon_map_id, name, shape, direction, dimension1, dimension2, corridor_id)"
                                + " VALUES(?, ?, ?, ?, ?, ?, ?)",
                        mapId,
                        "S1",
                        "LADDER",
                        0,
                        1,
                        1,
                        corridorId);
                insertCorridorTopologyElement(connection, mapId, stairId, corridorId, "STAIR", "S1", 400);
                insertStairPathNode(connection, stairId, 0, 2, 2, 0);
                insertStairPathNode(connection, stairId, 1, 2, 2, 1);
                insertStairExit(connection, stairId, 2, 2, 0, "Unterer Ausgang");
                insertStairExit(connection, stairId, 2, 2, 1, "Oberer Ausgang");
                connection.commit();
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to seed corridor-bound stair fixture.", exception);
            }
        }

        void seedGlobalStairIdentitySentinel(long mapId) {
            try (Connection connection = open()) {
                connection.setAutoCommit(false);
                long stairId = insertAndReturnId(
                        connection,
                        "INSERT INTO dungeon_stairs(dungeon_map_id, name, shape, direction, dimension1, dimension2)"
                                + " VALUES(?, ?, ?, ?, ?, ?)",
                        mapId,
                        "Global Stair Sentinel",
                        "STRAIGHT",
                        0,
                        1,
                        1);
                insertTopologyElement(connection, mapId, stairId, 0L, "STAIR", "Global Stair Sentinel", 900);
                connection.commit();
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to seed global stair identity sentinel.", exception);
            }
        }

        void seedGlobalTransitionIdentitySentinel(long mapId) {
            try (Connection connection = open()) {
                connection.setAutoCommit(false);
                insertTransition(connection, mapId, "Global transition sentinel.", 1, 1, 0);
                connection.commit();
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to seed global transition identity sentinel.", exception);
            }
        }

        void seedCorridorWithAnchor(long mapId) {
            try (Connection connection = open()) {
                connection.setAutoCommit(false);
                long roomOneId = insertRectangularRoom(connection, mapId, "R1", 0, 1, 1);
                long roomTwoId = insertRectangularRoom(connection, mapId, "R2", 0, 8, 1);
                long roomOneClusterId = scalarLong(
                        connection,
                        "SELECT cluster_id FROM dungeon_rooms WHERE room_id=?",
                        roomOneId);
                long roomTwoClusterId = scalarLong(
                        connection,
                        "SELECT cluster_id FROM dungeon_rooms WHERE room_id=?",
                        roomTwoId);
                long doorOneId = markDoorEdge(connection, mapId, roomOneId, 0, 1, 0, "EAST", "D1", 200);
                long doorTwoId = markDoorEdge(connection, mapId, roomTwoId, 0, -1, 0, "WEST", "D2", 201);
                long corridorId = insertAndReturnId(
                        connection,
                        "INSERT INTO dungeon_corridors(dungeon_map_id, level_z) VALUES(?, ?)",
                        mapId,
                        0);
                insertCorridorTopologyElement(connection, mapId, corridorId, corridorId, "CORRIDOR", "K1", 300);
                insertCorridorMember(connection, corridorId, roomOneId, 0);
                insertCorridorMember(connection, corridorId, roomTwoId, 1);
                insertCorridorDoorOverride(connection, corridorId, roomOneId, roomOneClusterId, 1, 0, "EAST", doorOneId, 0);
                insertCorridorDoorOverride(connection, corridorId, roomTwoId, roomTwoClusterId, -1, 0, "WEST", doorTwoId, 1);
                insertCorridorWaypoint(connection, corridorId, roomOneClusterId, 0, 2, 0, 0);
                insertCorridorWaypoint(connection, corridorId, roomOneClusterId, 2, 0, 0, 1);
                insertCorridorWaypoint(connection, corridorId, roomOneClusterId, 4, 0, 0, 2);
                insertCorridorWaypoint(connection, corridorId, roomOneClusterId, 4, 3, 0, 3);
                insertCorridorWaypoint(connection, corridorId, roomOneClusterId, 5, 3, 0, 4);
                insertCorridorWaypoint(connection, corridorId, roomOneClusterId, 5, 0, 0, 5);
                long anchorTopologyId = 70_000L + corridorId;
                insertCorridorTopologyElement(
                        connection,
                        mapId,
                        anchorTopologyId,
                        corridorId,
                        "CORRIDOR_ANCHOR",
                        "A1",
                        301);
                insertCorridorAnchor(connection, corridorId, 1, corridorId, 6, 5, 0, anchorTopologyId, 0);
                insertCorridorAnchorRef(connection, corridorId, corridorId, anchorTopologyId, 2);
                connection.commit();
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to seed F5_CORRIDOR_WITH_ANCHOR fixture.", exception);
            }
        }

        void seedCorridorSplitRouteTarget(long mapId) {
            try (Connection connection = open()) {
                connection.setAutoCommit(false);
                long roomOneId = insertRectangularRoom(connection, mapId, "R1", 0, 1, 1);
                long roomTwoId = insertRectangularRoom(connection, mapId, "R2", 0, 8, 1);
                long roomThreeId = insertRectangularRoom(connection, mapId, "R3", 0, 5, 9);
                long roomOneClusterId = scalarLong(
                        connection,
                        "SELECT cluster_id FROM dungeon_rooms WHERE room_id=?",
                        roomOneId);
                long roomTwoClusterId = scalarLong(
                        connection,
                        "SELECT cluster_id FROM dungeon_rooms WHERE room_id=?",
                        roomTwoId);
                long doorOneId = markDoorEdge(connection, mapId, roomOneId, 0, 1, 0, "EAST", "D1", 200);
                long doorTwoId = markDoorEdge(connection, mapId, roomTwoId, 0, -1, 0, "WEST", "D2", 201);
                markDoorEdge(connection, mapId, roomThreeId, 0, 0, -1, "NORTH", "D3", 202);
                long corridorId = insertAndReturnId(
                        connection,
                        "INSERT INTO dungeon_corridors(dungeon_map_id, level_z) VALUES(?, ?)",
                        mapId,
                        0);
                insertCorridorTopologyElement(connection, mapId, corridorId, corridorId, "CORRIDOR", "K1", 300);
                insertCorridorMember(connection, corridorId, roomOneId, 0);
                insertCorridorMember(connection, corridorId, roomTwoId, 1);
                insertCorridorDoorOverride(connection, corridorId, roomOneId, roomOneClusterId, 1, 0, "EAST", doorOneId, 0);
                insertCorridorDoorOverride(connection, corridorId, roomTwoId, roomTwoClusterId, -1, 0, "WEST", doorTwoId, 1);
                insertCorridorWaypoint(connection, corridorId, roomOneClusterId, 0, 2, 0, 0);
                insertCorridorWaypoint(connection, corridorId, roomOneClusterId, 2, 0, 0, 1);
                insertCorridorWaypoint(connection, corridorId, roomOneClusterId, 4, 0, 0, 2);
                insertCorridorWaypoint(connection, corridorId, roomOneClusterId, 4, 3, 0, 3);
                insertCorridorWaypoint(connection, corridorId, roomOneClusterId, 5, 3, 0, 4);
                insertCorridorWaypoint(connection, corridorId, roomOneClusterId, 5, 0, 0, 5);
                long anchorTopologyId = 70_000L + corridorId;
                insertCorridorTopologyElement(
                        connection,
                        mapId,
                        anchorTopologyId,
                        corridorId,
                        "CORRIDOR_ANCHOR",
                        "A1",
                        301);
                insertCorridorAnchor(connection, corridorId, 1, corridorId, 6, 5, 0, anchorTopologyId, 0);
                insertCorridorAnchorRef(connection, corridorId, corridorId, anchorTopologyId, 2);
                connection.commit();
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to seed DE-COR-004 crossing split fixture.", exception);
            }
        }

        void seedTwoDoorRouteTarget(long mapId) {
            try (Connection connection = open()) {
                connection.setAutoCommit(false);
                long roomOneId = insertRectangularRoom(connection, mapId, "R1", 0, 1, 1);
                long roomTwoId = insertRectangularRoom(connection, mapId, "R2", 0, 8, 1);
                markDoorEdge(connection, mapId, roomOneId, 0, 1, 0, "EAST", "D1", 200);
                markDoorEdge(connection, mapId, roomTwoId, 0, -1, 0, "WEST", "D2", 201);
                connection.commit();
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to seed F8_TWO_DOOR_ROUTE_TARGET fixture.", exception);
            }
        }

        void seedRoomToDoorRouteTarget(long mapId) {
            try (Connection connection = open()) {
                connection.setAutoCommit(false);
                insertRectangularRoom(connection, mapId, "R1", 0, 1, 1);
                long roomTwoId = insertRectangularRoom(connection, mapId, "R2", 0, 8, 1);
                markDoorEdge(connection, mapId, roomTwoId, 0, -1, 0, "WEST", "D2", 201);
                connection.commit();
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to seed F12_ROOM_TO_DOOR_ROUTE_TARGET fixture.", exception);
            }
        }

        void seedBlockedCorridorRouteTarget(long mapId) {
            try (Connection connection = open()) {
                connection.setAutoCommit(false);
                insertRectangularRoom(connection, mapId, "R1", 0, 1, 1);
                insertRectangularRoom(connection, mapId, "R2", 0, -3, 1);
                insertRectangularRoom(connection, mapId, "R3", 0, 5, 1);
                connection.commit();
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to seed blocked corridor route fixture.", exception);
            }
        }

        void seedTwoAnchorRouteTarget(long mapId) {
            try (Connection connection = open()) {
                connection.setAutoCommit(false);
                long roomOneId = insertRectangularRoom(connection, mapId, "R1", 0, -4, 4);
                long roomTwoId = insertRectangularRoom(connection, mapId, "R2", 0, 10, 4);
                long roomOneClusterId = scalarLong(
                        connection,
                        "SELECT cluster_id FROM dungeon_rooms WHERE room_id=?",
                        roomOneId);
                long roomTwoClusterId = scalarLong(
                        connection,
                        "SELECT cluster_id FROM dungeon_rooms WHERE room_id=?",
                        roomTwoId);
                long corridorOneId = insertAndReturnId(
                        connection,
                        "INSERT INTO dungeon_corridors(dungeon_map_id, level_z) VALUES(?, ?)",
                        mapId,
                        0);
                insertCorridorTopologyElement(connection, mapId, corridorOneId, corridorOneId, "CORRIDOR", "K1", 300);
                insertCorridorWaypoint(connection, corridorOneId, roomOneClusterId, 5, 1, 0, 0);
                long anchorOneTopologyId = 70_000L + corridorOneId;
                insertCorridorTopologyElement(
                        connection,
                        mapId,
                        anchorOneTopologyId,
                        corridorOneId,
                        "CORRIDOR_ANCHOR",
                        "A1",
                        301);
                insertCorridorAnchor(connection, corridorOneId, 1, corridorOneId, 2, 6, 0, anchorOneTopologyId, 0);
                insertCorridorAnchorRef(connection, corridorOneId, corridorOneId, anchorOneTopologyId, 0);
                long corridorTwoId = insertAndReturnId(
                        connection,
                        "INSERT INTO dungeon_corridors(dungeon_map_id, level_z) VALUES(?, ?)",
                        mapId,
                        0);
                insertCorridorTopologyElement(connection, mapId, corridorTwoId, corridorTwoId, "CORRIDOR", "K2", 302);
                insertCorridorWaypoint(connection, corridorTwoId, roomTwoClusterId, -3, 1, 0, 0);
                long anchorTwoTopologyId = 70_000L + corridorTwoId;
                insertCorridorTopologyElement(
                        connection,
                        mapId,
                        anchorTwoTopologyId,
                        corridorTwoId,
                        "CORRIDOR_ANCHOR",
                        "A2",
                        303);
                insertCorridorAnchor(connection, corridorTwoId, 2, corridorTwoId, 8, 6, 0, anchorTwoTopologyId, 0);
                insertCorridorAnchorRef(connection, corridorTwoId, corridorTwoId, anchorTwoTopologyId, 0);
                connection.commit();
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to seed F10_TWO_ANCHOR_ROUTE_TARGET fixture.", exception);
            }
        }

        void seedTwoByTwoRoom(long mapId, String roomName, int level, int anchorX, int anchorY) {
            try (Connection connection = open()) {
                connection.setAutoCommit(false);
                insertTwoByTwoRoom(connection, mapId, roomName, level, anchorX, anchorY);
                connection.commit();
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to seed two-by-two dungeon room fixture.", exception);
            }
        }

        void seedLargePerCellLoopRoom(long mapId, int width, int height) {
            try (Connection connection = open()) {
                connection.setAutoCommit(false);
                long clusterId = insertAndReturnId(
                        connection,
                        "INSERT INTO dungeon_room_clusters(dungeon_map_id, center_x, center_y, level_z)"
                                + " VALUES(?, ?, ?, ?)",
                        mapId,
                        0,
                        0,
                        0);
                long roomId = insertAndReturnId(
                        connection,
                        "INSERT INTO dungeon_rooms(dungeon_map_id, cluster_id, name, visual_description,"
                                + " component_x, component_y, level_z) VALUES(?, ?, ?, ?, ?, ?, ?)",
                        mapId,
                        clusterId,
                        "Large Per-Cell Room",
                        "",
                        0,
                        0,
                        0);
                insertTopologyElement(connection, mapId, roomId, clusterId, "Large Per-Cell Room");
                int vertexIndex = 0;
                for (int q = 0; q < width; q++) {
                    for (int r = 0; r < height; r++) {
                        insertF6Vertex(connection, clusterId, 0, vertexIndex++, q, r);
                        insertF6Vertex(connection, clusterId, 0, vertexIndex++, q + 1, r);
                        insertF6Vertex(connection, clusterId, 0, vertexIndex++, q + 1, r + 1);
                        insertF6Vertex(connection, clusterId, 0, vertexIndex++, q, r + 1);
                        insertF6Vertex(
                                connection,
                                clusterId,
                                0,
                                vertexIndex++,
                                DungeonRoomCellProjection.LOOP_SEPARATOR.q(),
                                DungeonRoomCellProjection.LOOP_SEPARATOR.r());
                    }
                }
                connection.commit();
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to seed large per-cell loop room fixture.", exception);
            }
        }

        static void insertTwoByTwoRoom(
                Connection connection,
                long mapId,
                String roomName,
                int level,
                int anchorX,
                int anchorY
        ) throws SQLException {
            long clusterId = insertAndReturnId(
                    connection,
                    "INSERT INTO dungeon_room_clusters(dungeon_map_id, center_x, center_y, level_z) VALUES(?, ?, ?, ?)",
                    mapId,
                    anchorX + 1,
                    anchorY + 1,
                    level);
            long roomId = insertAndReturnId(
                    connection,
                    "INSERT INTO dungeon_rooms(dungeon_map_id, cluster_id, name, visual_description,"
                            + " component_x, component_y, level_z) VALUES(?, ?, ?, ?, ?, ?, ?)",
                    mapId,
                    clusterId,
                    roomName,
                    "",
                    anchorX + 1,
                    anchorY + 1,
                    level);
            insertTopologyElement(connection, mapId, roomId, clusterId, roomName);
            insertF6Vertex(connection, clusterId, level, 0, -1, -1);
            insertF6Vertex(connection, clusterId, level, 1, 1, -1);
            insertF6Vertex(connection, clusterId, level, 2, 1, 1);
            insertF6Vertex(connection, clusterId, level, 3, -1, 1);
            insertTwoByTwoPerimeterWalls(connection, mapId, clusterId, level, anchorX + 1, anchorY + 1);
        }

        static long insertRectangularRoom(
                Connection connection,
                long mapId,
                String roomName,
                int level,
                int anchorX,
                int anchorY
        ) throws SQLException {
            long clusterId = insertAndReturnId(
                    connection,
                    "INSERT INTO dungeon_room_clusters(dungeon_map_id, center_x, center_y, level_z) VALUES(?, ?, ?, ?)",
                    mapId,
                    anchorX + 1,
                    anchorY + 1,
                    level);
            long roomId = insertAndReturnId(
                    connection,
                    "INSERT INTO dungeon_rooms(dungeon_map_id, cluster_id, name, visual_description,"
                            + " component_x, component_y, level_z) VALUES(?, ?, ?, ?, ?, ?, ?)",
                    mapId,
                    clusterId,
                    roomName,
                    "",
                    anchorX + 1,
                    anchorY + 1,
                    level);
            insertTopologyElement(connection, mapId, roomId, clusterId, roomName);
            insertF6Vertex(connection, clusterId, level, 0, -1, -1);
            insertF6Vertex(connection, clusterId, level, 1, 2, -1);
            insertF6Vertex(connection, clusterId, level, 2, 2, 2);
            insertF6Vertex(connection, clusterId, level, 3, -1, 2);
            insertPerimeterWalls(connection, mapId, clusterId, level, anchorX + 1, anchorY + 1);
            return roomId;
        }

        static long markDoorEdge(
                Connection connection,
                long mapId,
                long roomId,
                int level,
                int relativeCellX,
                int relativeCellY,
                String direction,
                String label,
                int sortOrder
        ) throws SQLException {
            long clusterId = scalarLong(
                    connection,
                    "SELECT cluster_id FROM dungeon_rooms WHERE room_id=?",
                    roomId);
            long topologyElementId = scalarLong(
                    connection,
                    "SELECT topology_element_id FROM dungeon_room_cluster_edges"
                            + " WHERE cluster_id=? AND level_z=? AND cell_x=? AND cell_y=? AND edge_direction=?",
                    clusterId,
                    level,
                    relativeCellX,
                    relativeCellY,
                    direction);
            try (PreparedStatement statement = connection.prepareStatement(
                    "UPDATE dungeon_room_cluster_edges SET edge_type=?"
                            + " WHERE cluster_id=? AND level_z=? AND cell_x=? AND cell_y=? AND edge_direction=?")) {
                bind(statement, "DOOR", clusterId, level, relativeCellX, relativeCellY, direction);
                statement.executeUpdate();
            }
            insertTopologyElement(connection, mapId, topologyElementId, clusterId, "DOOR", label, sortOrder);
            return topologyElementId;
        }

        static void insertCorridorMember(
                Connection connection,
                long corridorId,
                long roomId,
                int sortOrder
        ) throws SQLException {
            try (PreparedStatement statement = connection.prepareStatement(
                    "INSERT INTO dungeon_corridor_members(corridor_id, room_id, member_order) VALUES(?, ?, ?)")) {
                bind(statement, corridorId, roomId, sortOrder);
                statement.executeUpdate();
            }
        }

        static void insertCorridorDoorOverride(
                Connection connection,
                long corridorId,
                long roomId,
                long clusterId,
                int relativeCellX,
                int relativeCellY,
                String direction,
                long topologyElementId,
                int sortOrder
        ) throws SQLException {
            try (PreparedStatement statement = connection.prepareStatement(
                    "INSERT INTO dungeon_corridor_door_overrides("
                            + "corridor_id, room_id, cluster_id, relative_cell_x, relative_cell_y,"
                            + " edge_direction, topology_element_id, sort_order"
                            + ") VALUES(?, ?, ?, ?, ?, ?, ?, ?)")) {
                bind(statement, corridorId, roomId, clusterId, relativeCellX, relativeCellY,
                        direction, topologyElementId, sortOrder);
                statement.executeUpdate();
            }
        }

        static void insertCorridorWaypoint(
                Connection connection,
                long corridorId,
                long clusterId,
                int relativeX,
                int relativeY,
                int relativeZ,
                int sortOrder
        ) throws SQLException {
            try (PreparedStatement statement = connection.prepareStatement(
                    "INSERT INTO dungeon_corridor_waypoints("
                            + "corridor_id, sort_order, cluster_id, relative_x, relative_y, relative_z"
                            + ") VALUES(?, ?, ?, ?, ?, ?)")) {
                bind(statement, corridorId, sortOrder, clusterId, relativeX, relativeY, relativeZ);
                statement.executeUpdate();
            }
        }

        static void insertCorridorAnchor(
                Connection connection,
                long corridorId,
                long anchorId,
                long hostCorridorId,
                int cellX,
                int cellY,
                int cellZ,
                long topologyElementId,
                int sortOrder
        ) throws SQLException {
            try (PreparedStatement statement = connection.prepareStatement(
                    "INSERT INTO dungeon_corridor_anchors("
                            + "corridor_id, anchor_id, host_corridor_id, cell_x, cell_y, cell_z,"
                            + " topology_element_id, sort_order"
                            + ") VALUES(?, ?, ?, ?, ?, ?, ?, ?)")) {
                bind(statement, corridorId, anchorId, hostCorridorId, cellX, cellY, cellZ,
                        topologyElementId, sortOrder);
                statement.executeUpdate();
            }
        }

        static void insertCorridorAnchorRef(
                Connection connection,
                long corridorId,
                long hostCorridorId,
                long topologyElementId,
                int sortOrder
        ) throws SQLException {
            try (PreparedStatement statement = connection.prepareStatement(
                    "INSERT INTO dungeon_corridor_anchor_refs("
                            + "corridor_id, host_corridor_id, topology_element_id, sort_order"
                            + ") VALUES(?, ?, ?, ?)")) {
                bind(statement, corridorId, hostCorridorId, topologyElementId, sortOrder);
                statement.executeUpdate();
            }
        }

        static void insertTwoByTwoPerimeterWalls(
                Connection connection,
                long mapId,
                long clusterId,
                int level,
                int centerX,
                int centerY
        ) throws SQLException {
            int sortOrder = 1;
            for (int relativeX = -1; relativeX <= 0; relativeX++) {
                insertClusterBoundary(connection, mapId, clusterId, level, centerX, centerY, relativeX, -1, "NORTH",
                        sortOrder);
                sortOrder++;
                insertClusterBoundary(connection, mapId, clusterId, level, centerX, centerY, relativeX, 0, "SOUTH",
                        sortOrder);
                sortOrder++;
            }
            for (int relativeY = -1; relativeY <= 0; relativeY++) {
                insertClusterBoundary(connection, mapId, clusterId, level, centerX, centerY, 0, relativeY, "EAST",
                        sortOrder);
                sortOrder++;
                insertClusterBoundary(connection, mapId, clusterId, level, centerX, centerY, -1, relativeY, "WEST",
                        sortOrder);
                sortOrder++;
            }
        }

        static void insertPerimeterWalls(
                Connection connection,
                long mapId,
                long clusterId,
                int level,
                int centerX,
                int centerY
        ) throws SQLException {
            int sortOrder = 1;
            for (int relativeX = -1; relativeX <= 1; relativeX++) {
                insertClusterBoundary(connection, mapId, clusterId, level, centerX, centerY, relativeX, -1, "NORTH",
                        sortOrder);
                sortOrder++;
                insertClusterBoundary(connection, mapId, clusterId, level, centerX, centerY, relativeX, 1, "SOUTH",
                        sortOrder);
                sortOrder++;
            }
            for (int relativeY = -1; relativeY <= 1; relativeY++) {
                insertClusterBoundary(connection, mapId, clusterId, level, centerX, centerY, 1, relativeY, "EAST",
                        sortOrder);
                sortOrder++;
                insertClusterBoundary(connection, mapId, clusterId, level, centerX, centerY, -1, relativeY, "WEST",
                        sortOrder);
                sortOrder++;
            }
        }

        static void insertClusterBoundary(
                Connection connection,
                long mapId,
                long clusterId,
                int level,
                int centerX,
                int centerY,
                int relativeX,
                int relativeY,
                String direction,
                int sortOrder
        ) throws SQLException {
            long topologyElementId = wallTopologyElementId(centerX, centerY, level, relativeX, relativeY, direction);
            try (PreparedStatement statement = connection.prepareStatement(
                    "INSERT INTO dungeon_room_cluster_edges("
                            + "cluster_id, level_z, cell_x, cell_y, edge_direction, edge_type, topology_element_id"
                            + ") VALUES(?, ?, ?, ?, ?, ?, ?)")) {
                bind(statement, clusterId, level, relativeX, relativeY, direction, "WALL", topologyElementId);
                statement.executeUpdate();
            }
            insertTopologyElement(connection, mapId, topologyElementId, clusterId, "WALL", "Wall", sortOrder);
        }

        static void insertStairPathNode(
                Connection connection,
                long stairId,
                int sortOrder,
                int cellX,
                int cellY,
                int cellZ
        ) throws SQLException {
            try (PreparedStatement statement = connection.prepareStatement(
                    "INSERT INTO dungeon_stair_path_nodes(stair_id, sort_order, cell_x, cell_y, cell_z)"
                            + " VALUES(?, ?, ?, ?, ?)")) {
                bind(statement, stairId, sortOrder, cellX, cellY, cellZ);
                statement.executeUpdate();
            }
        }

        static void insertStairExit(
                Connection connection,
                long stairId,
                int cellX,
                int cellY,
                int cellZ,
                String label
        ) throws SQLException {
            try (PreparedStatement statement = connection.prepareStatement(
                    "INSERT INTO dungeon_stair_exits(stair_id, cell_x, cell_y, cell_z, label)"
                            + " VALUES(?, ?, ?, ?, ?)")) {
                bind(statement, stairId, cellX, cellY, cellZ, label);
                statement.executeUpdate();
            }
        }

        static long insertTransition(
                Connection connection,
                long mapId,
                String description,
                int cellX,
                int cellY,
                int level
        ) throws SQLException {
            long transitionId;
            try (PreparedStatement statement = connection.prepareStatement(
                    "INSERT INTO dungeon_transitions("
                            + "dungeon_map_id, description, cell_x, cell_y, level_z,"
                            + " destination_type, target_overworld_map_id, target_overworld_tile_id,"
                            + " target_dungeon_map_id, target_transition_id, linked_transition_id"
                            + ") VALUES(?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL)",
                    Statement.RETURN_GENERATED_KEYS)) {
                bind(statement, mapId, description, cellX, cellY, level, "OVERWORLD_TILE", 77L, 88L);
                statement.executeUpdate();
                try (ResultSet resultSet = statement.getGeneratedKeys()) {
                    if (!resultSet.next()) {
                        throw new SQLException("No generated key for transition insert.");
                    }
                    transitionId = resultSet.getLong(1);
                }
            }
            insertFeatureTopologyElement(connection, mapId, transitionId, "TRANSITION", "Übergang " + transitionId, 500);
            return transitionId;
        }

        static void updateLinkedTransition(
                Connection connection,
                long transitionId,
                long linkedTransitionId
        ) throws SQLException {
            try (PreparedStatement statement = connection.prepareStatement(
                    "UPDATE dungeon_transitions SET linked_transition_id=? WHERE transition_id=?")) {
                bind(statement, linkedTransitionId, transitionId);
                statement.executeUpdate();
            }
        }

        static void updateDungeonMapDestination(
                Connection connection,
                long transitionId,
                long targetMapId,
                long targetTransitionId
        ) throws SQLException {
            try (PreparedStatement statement = connection.prepareStatement(
                    "UPDATE dungeon_transitions SET destination_type='DUNGEON_MAP',"
                            + " target_overworld_map_id=NULL, target_overworld_tile_id=NULL,"
                            + " target_dungeon_map_id=?, target_transition_id=?"
                            + " WHERE transition_id=?")) {
                bind(statement, targetMapId, targetTransitionId, transitionId);
                statement.executeUpdate();
            }
        }

        static void insertFeatureTopologyElement(
                Connection connection,
                long mapId,
                long elementId,
                String elementKind,
                String label,
                int sortOrder
        ) throws SQLException {
            try (PreparedStatement statement = connection.prepareStatement(
                    "INSERT OR IGNORE INTO dungeon_topology_elements("
                            + "dungeon_map_id, element_kind, element_id, cluster_id, corridor_id, label, sort_order"
                            + ") VALUES(?, ?, ?, NULL, NULL, ?, ?)")) {
                bind(statement, mapId, elementKind, elementId, label, sortOrder);
                statement.executeUpdate();
            }
        }

        static long wallTopologyElementId(
                int centerX,
                int centerY,
                int level,
                int relativeX,
                int relativeY,
                String direction
        ) {
            DungeonCell absoluteCell = new DungeonCell(centerX + relativeX, centerY + relativeY, level);
            DungeonEdge edge = DungeonEdge.sideOf(absoluteCell, DungeonEdgeDirection.parse(direction));
            return DungeonBoundaryKey.from(edge).stableId();
        }

        static void insertTopologyElement(
                Connection connection,
                long mapId,
                long roomId,
                long clusterId,
                String label
        ) throws SQLException {
            try (PreparedStatement statement = connection.prepareStatement(
                    "INSERT INTO dungeon_topology_elements("
                            + "dungeon_map_id, element_kind, element_id, cluster_id, corridor_id, label, sort_order"
                            + ") VALUES(?, ?, ?, ?, NULL, ?, ?)")) {
                bind(statement, mapId, "ROOM", roomId, clusterId, label, roomId);
                statement.executeUpdate();
            }
        }

        static void insertTopologyElement(
                Connection connection,
                long mapId,
                long elementId,
                long clusterId,
                String elementKind,
                String label,
                int sortOrder
        ) throws SQLException {
            try (PreparedStatement statement = connection.prepareStatement(
                    "INSERT OR IGNORE INTO dungeon_topology_elements("
                            + "dungeon_map_id, element_kind, element_id, cluster_id, corridor_id, label, sort_order"
                            + ") VALUES(?, ?, ?, ?, NULL, ?, ?)")) {
                bind(statement, mapId, elementKind, elementId, clusterId, label, sortOrder);
                statement.executeUpdate();
            }
        }

        static void insertCorridorTopologyElement(
                Connection connection,
                long mapId,
                long elementId,
                long corridorId,
                String elementKind,
                String label,
                int sortOrder
        ) throws SQLException {
            try (PreparedStatement statement = connection.prepareStatement(
                    "INSERT OR IGNORE INTO dungeon_topology_elements("
                            + "dungeon_map_id, element_kind, element_id, cluster_id, corridor_id, label, sort_order"
                            + ") VALUES(?, ?, ?, NULL, ?, ?, ?)")) {
                bind(statement, mapId, elementKind, elementId, corridorId, label, sortOrder);
                statement.executeUpdate();
            }
        }

        long count(String sql, String value) {
            try (Connection connection = open();
                 PreparedStatement statement = connection.prepareStatement(sql)) {
                statement.setString(1, value);
                return scalar(statement);
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed DB assertion: " + sql, exception);
            }
        }

        long count(String sql, long firstValue, String secondValue) {
            try (Connection connection = open();
                 PreparedStatement statement = connection.prepareStatement(sql)) {
                statement.setLong(1, firstValue);
                statement.setString(2, secondValue);
                return scalar(statement);
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed DB assertion: " + sql, exception);
            }
        }

        long count(String sql, long value, int cellX, int cellY, String direction, String description) {
            try (Connection connection = open();
                 PreparedStatement statement = connection.prepareStatement(sql)) {
                bind(statement, value, cellX, cellY, direction, description);
                return scalar(statement);
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed DB assertion: " + sql, exception);
            }
        }

        long count(String sql, Object... values) {
            try (Connection connection = open();
                 PreparedStatement statement = connection.prepareStatement(sql)) {
                bind(statement, values);
                return scalar(statement);
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed DB assertion: " + sql, exception);
            }
        }

        long count(String sql, long value) {
            try (Connection connection = open();
                 PreparedStatement statement = connection.prepareStatement(sql)) {
                statement.setLong(1, value);
                return scalar(statement);
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed DB assertion: " + sql, exception);
            }
        }

        static void appendRows(
                Connection connection,
                List<String> state,
                String tableName,
                String sql,
                long mapId
        ) throws SQLException {
            appendRows(connection, state, tableName, sql, new Object[] {Long.valueOf(mapId)});
        }

        static void appendRows(
                Connection connection,
                List<String> state,
                String tableName,
                String sql,
                Object... values
        ) throws SQLException {
            try (PreparedStatement statement = connection.prepareStatement(sql)) {
                bind(statement, values);
                try (ResultSet resultSet = statement.executeQuery()) {
                    ResultSetMetaData metaData = resultSet.getMetaData();
                    int columnCount = metaData.getColumnCount();
                    while (resultSet.next()) {
                        StringBuilder row = new StringBuilder(tableName);
                        for (int column = 1; column <= columnCount; column++) {
                            row.append('|')
                                    .append(metaData.getColumnName(column))
                                    .append('=')
                                    .append(Objects.toString(resultSet.getObject(column), "<null>"));
                        }
                        state.add(row.toString());
                    }
                }
            }
        }

        static long insertAndReturnId(Connection connection, String sql, Object... values) throws SQLException {
            try (PreparedStatement statement = connection.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {
                bind(statement, values);
                statement.executeUpdate();
                try (ResultSet resultSet = statement.getGeneratedKeys()) {
                    if (!resultSet.next()) {
                        throw new SQLException("No generated key for insert: " + sql);
                    }
                    return resultSet.getLong(1);
                }
            }
        }

        static void insertF6Vertex(
                Connection connection,
                long clusterId,
                int level,
                int vertexIndex,
                int relativeX,
                int relativeY
        ) throws SQLException {
            try (PreparedStatement statement = connection.prepareStatement(
                    "INSERT INTO dungeon_room_cluster_vertices("
                            + "cluster_id, level_z, vertex_index, relative_x, relative_y) VALUES(?, ?, ?, ?, ?)")) {
                bind(statement, clusterId, level, vertexIndex, relativeX, relativeY);
                statement.executeUpdate();
            }
        }

        static void bind(PreparedStatement statement, Object... values) throws SQLException {
            for (int index = 0; index < values.length; index++) {
                Object value = values[index];
                if (value instanceof Long longValue) {
                    statement.setLong(index + 1, longValue);
                } else if (value instanceof Integer integerValue) {
                    statement.setInt(index + 1, integerValue);
                } else {
                    statement.setString(index + 1, String.valueOf(value));
                }
            }
        }

        Connection open() throws SQLException {
            return DriverManager.getConnection("jdbc:sqlite:" + databasePath);
        }

        static long scalar(PreparedStatement statement) throws SQLException {
            try (ResultSet resultSet = statement.executeQuery()) {
                if (!resultSet.next()) {
                    throw new SQLException("No result row.");
                }
                return resultSet.getLong(1);
            }
        }

        static long scalarLong(Connection connection, String sql, Object... values) throws SQLException {
            try (PreparedStatement statement = connection.prepareStatement(sql)) {
                bind(statement, values);
                return scalar(statement);
            }
        }
    }
}
