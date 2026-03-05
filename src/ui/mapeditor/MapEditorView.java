package ui.mapeditor;

import database.DatabaseManager;
import entities.HexMap;
import entities.HexTile;
import javafx.concurrent.Task;
import javafx.scene.Node;
import services.HexMapService;
import ui.AppView;

import java.sql.Connection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;

/**
 * Top-level editor view for hex map editing (terrain, locations, factions).
 * Provides its own right column (TilePropertiesPane) instead of the standard
 * InspectorPane + ScenePane used by session views.
 */
public class MapEditorView implements AppView {

    private final MapEditorControls controls;
    private final MapEditorCanvas canvas;
    private final TilePropertiesPane propertiesPane;

    /** Accumulates tile-ID → terrain changes during a paint stroke; flushed on mouse release. */
    private final Map<Long, String> dirtyTiles = new HashMap<>();

    public MapEditorView() {
        controls = new MapEditorControls();
        canvas = new MapEditorCanvas();
        propertiesPane = new TilePropertiesPane();

        controls.setOnToolChanged(tool -> {
            canvas.setPaintMode(tool == EditorTool.TERRAIN_BRUSH);
            propertiesPane.setTerrainVisible(tool == EditorTool.TERRAIN_BRUSH);
        });

        controls.setOnMapSelected(mapId -> canvas.loadMap(mapId));
        controls.setOnNewMapRequested(this::showNewMapDialog);

        canvas.setOnTileClicked(tile -> {
            if (controls.getActiveTool() == EditorTool.SELECT) {
                propertiesPane.showTile(tile);
            } else if (controls.getActiveTool() == EditorTool.TERRAIN_BRUSH) {
                paintTile(tile);
            }
        });

        canvas.setOnTileDragPainted(this::paintTile);
        canvas.setOnPaintStrokeFinished(this::flushDirtyTiles);
    }

    /** Optimistic visual update; DB write deferred to stroke end. */
    private void paintTile(HexTile tile) {
        if (tile == null || tile.TileId == null) return;
        String terrain = propertiesPane.getActiveTerrainType();
        if (terrain.equals(tile.TerrainType)) return;

        canvas.updateTileTerrain(tile.TileId, terrain);
        dirtyTiles.put(tile.TileId, terrain);
        propertiesPane.showTile(tile);
    }

    /** Flushes accumulated terrain changes to DB on a background thread. */
    private void flushDirtyTiles() {
        if (dirtyTiles.isEmpty()) return;
        Map<Long, String> batch = new HashMap<>(dirtyTiles);
        dirtyTiles.clear();

        Task<Void> task = new Task<>() {
            @Override protected Void call() throws Exception {
                try (Connection c = DatabaseManager.getConnection()) {
                    c.setAutoCommit(false);
                    try {
                        for (var entry : batch.entrySet()) {
                            HexMapService.updateTerrainType(c, entry.getKey(), entry.getValue());
                        }
                        c.commit();
                    } catch (Exception e) {
                        c.rollback();
                        throw e;
                    } finally {
                        c.setAutoCommit(true);
                    }
                }
                return null;
            }
        };
        task.setOnFailed(e ->
            System.err.println("MapEditorView.flushDirtyTiles(): " + task.getException().getMessage()));
        Thread t = new Thread(task, "sm-save-terrain");
        t.setDaemon(true);
        t.start();
    }

    /** Loads all maps into the controls combo box, then loads the first map (or opens dialog if none). */
    private void loadMapList() {
        loadMapListAsync(maps -> {
            if (maps.isEmpty()) {
                showNewMapDialog();
            } else {
                controls.selectMap(maps.get(0).MapId);
            }
        });
    }

    private void showNewMapDialog() {
        NewMapDialog dialog = new NewMapDialog();
        dialog.showAndWait().ifPresent(result -> {
            Task<Long> task = new Task<>() {
                @Override protected Long call() throws Exception {
                    try (Connection c = DatabaseManager.getConnection()) {
                        return HexMapService.createHexMap(c, result.name(), result.radius());
                    }
                }
            };
            task.setOnSucceeded(e -> {
                long newMapId = task.getValue();
                loadMapListAsync(maps -> controls.selectMap(newMapId));
            });
            task.setOnFailed(e ->
                System.err.println("MapEditorView.createMap(): " + task.getException().getMessage()));
            Thread t = new Thread(task, "sm-create-map");
            t.setDaemon(true);
            t.start();
        });
    }

    /** Loads map list on a background thread, populates controls, then calls onLoaded on FX thread. */
    private void loadMapListAsync(Consumer<List<HexMap>> onLoaded) {
        Task<List<HexMap>> task = new Task<>() {
            @Override protected List<HexMap> call() throws Exception {
                try (Connection c = DatabaseManager.getConnection()) {
                    return HexMapService.getAllMaps(c);
                }
            }
        };
        task.setOnSucceeded(e -> {
            List<HexMap> maps = task.getValue();
            controls.setMaps(maps);
            onLoaded.accept(maps);
        });
        task.setOnFailed(e ->
            System.err.println("MapEditorView.loadMapListAsync(): " + task.getException().getMessage()));
        Thread t = new Thread(task, "sm-load-map-list");
        t.setDaemon(true);
        t.start();
    }

    @Override public Node getRoot()         { return canvas; }
    @Override public String getTitle()      { return "Karteneditor"; }
    @Override public String getIconText()   { return "\u270F"; } // ✏
    @Override public Node getControlPanel() { return controls; }
    @Override public Node getRightColumn()  { return propertiesPane; }

    @Override
    public void onShow() {
        loadMapList();
    }
}
