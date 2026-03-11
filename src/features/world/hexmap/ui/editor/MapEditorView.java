package features.world.hexmap.ui.editor;

import features.world.hexmap.model.HexMap;
import features.world.hexmap.model.HexTerrainType;
import features.world.hexmap.model.HexTile;
import features.world.hexmap.ui.editor.MapEditorApplicationService;
import features.world.hexmap.ui.editor.controls.EditorTool;
import features.world.hexmap.ui.editor.controls.MapEditorControls;
import features.world.hexmap.ui.editor.dropdowns.HexMapFormDropdown;
import features.world.hexmap.ui.editor.panes.MapEditorCanvas;
import features.world.hexmap.ui.editor.panes.ToolSettingsPane;
import javafx.scene.Node;
import ui.shell.AppView;
import ui.shell.DetailsNavigator;
import ui.async.UiErrorReporter;
import ui.components.MessageDropdown;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.Consumer;

/**
 * Top-Level-Ansicht des Karteneditors fuer Hex-Map-Bearbeitung (Gelaende, Orte, Fraktionen).
 * Details werden im shell-owned DetailsPane gezeigt.
 * Zustandspanel: ToolSettingsPane (Gelaendepalette, spaetere Brush-Einstellungen).
 */
public class MapEditorView implements AppView {

    private final MapEditorControls controls;
    private final MapEditorCanvas canvas;
    private final ToolSettingsPane toolSettingsPane;
    private final MapEditorApplicationService applicationService;
    private final DetailsNavigator detailsNavigator;
    private final HexMapFormDropdown mapDropdown = new HexMapFormDropdown();
    private final MessageDropdown messageDropdown = new MessageDropdown();

    /** Sammelt Tile-ID -> Gelaendeaenderung waehrend eines Malstrichs; Flush bei Mouse-Release. */
    private final Map<Long, HexTerrainType> dirtyTiles = new HashMap<>();
    private final AtomicLong loadSequence = new AtomicLong(0);
    private Long currentMapId;
    private boolean initialLoadDone = false;

    public MapEditorView(DetailsNavigator detailsNavigator) {
        this.detailsNavigator = detailsNavigator;
        controls = new MapEditorControls();
        canvas = new MapEditorCanvas();
        toolSettingsPane = new ToolSettingsPane();
        applicationService = new MapEditorApplicationService();
        toolSettingsPane.setActiveTool(controls.getActiveTool());

        controls.setOnToolChanged(tool -> {
            canvas.setPaintMode(tool == EditorTool.TERRAIN_BRUSH);
            toolSettingsPane.setActiveTool(tool);
        });

        controls.setOnMapSelected(mapId -> {
            currentMapId = mapId;
            loadMapAsync(mapId);
        });
        controls.setOnNewMapRequested(this::showNewMapDropdown);
        controls.setOnEditMapRequested(this::showEditMapDropdown);

        canvas.setOnTileClicked(tile -> {
            if (controls.getActiveTool() == EditorTool.SELECT) {
                showTileDetails(tile, null);
            } else if (controls.getActiveTool() == EditorTool.TERRAIN_BRUSH) {
                paintTile(tile);
            }
        });

        canvas.setOnTileDragPainted(this::paintTile);
        canvas.setOnPaintStrokeFinished(this::flushDirtyTiles);
    }

    /** Optimistisches UI-Update; DB-Schreiben wird bis zum Ende des Malstrichs aufgeschoben. */
    private void paintTile(HexTile tile) {
        if (tile == null || tile.tileId() == null) return;
        HexTerrainType terrain = toolSettingsPane.getActiveTerrainType();
        if (terrain == tile.terrainType()) return;

        canvas.updateTileTerrain(tile.tileId(), terrain);
        dirtyTiles.put(tile.tileId(), terrain);
        showTileDetails(tile, terrain);
    }

    /** Schreibt gesammelte Gelaendeaenderungen asynchron in die DB. */
    private void flushDirtyTiles() {
        if (dirtyTiles.isEmpty()) return;
        Map<Long, HexTerrainType> batch = new HashMap<>(dirtyTiles);
        dirtyTiles.clear();

        applicationService.flushTerrainChanges(batch, () -> { }, ex -> {
            UiErrorReporter.reportBackgroundFailure("MapEditorView.flushDirtyTiles()", ex);
            if (currentMapId != null) {
                loadMapAsync(currentMapId);
            }
            messageDropdown.show(controls,
                    "Speichern fehlgeschlagen",
                    "Geländeänderungen konnten nicht gespeichert werden. Die Karte wurde neu geladen.");
        });
    }

    private void showEditMapDropdown(MapEditorControls.MapActionRequest request) {
        HexMap map = request.map();
        int oldRadius = map.radius() != null ? map.radius() : 0;
        mapDropdown.showEdit(
                request.anchor(),
                map,
                newRadius -> applicationService.removedTilesForRadiusChange(oldRadius, newRadius),
                result -> {
                    mapDropdown.hide();
                    submitMapUpdate(map.mapId(), result.name(), oldRadius, result.radius());
                });
    }

    private void submitMapUpdate(Long mapId, String name, int oldRadius, int newRadius) {
        applicationService.updateMap(mapId, name, oldRadius, newRadius,
            () -> loadMapListAsync(maps -> controls.selectMap(mapId)),
            ex -> {
                UiErrorReporter.reportBackgroundFailure("MapEditorView.editMap()", ex);
                String msg = ex.getMessage() != null ? ex.getMessage() : "Unbekannter Fehler";
                messageDropdown.show(controls, "Fehler beim Speichern", msg);
            });
    }

    /** Laedt alle Karten in die ComboBox und waehlt die erste Karte aus (oder öffnet den Neu-Dialog). */
    private void loadMapList() {
        loadMapListAsync(maps -> {
            if (maps.isEmpty()) {
                showNewMapDropdown(controls);
            } else {
                controls.selectMap(maps.get(0).mapId());
            }
        });
    }

    private void showNewMapDropdown(Node anchor) {
        mapDropdown.showCreate(anchor, result -> {
            mapDropdown.hide();
            applicationService.createMap(result.name(), result.radius(),
                newMapId -> loadMapListAsync(maps -> controls.selectMap(newMapId)),
                ex -> {
                    UiErrorReporter.reportBackgroundFailure("MapEditorView.createMap()", ex);
                    messageDropdown.show(controls, "Karte konnte nicht erstellt werden", "Bitte Eingaben und Datenbankstatus prüfen.");
                });
        });
    }

    /** Laedt die Kartenliste asynchron, fuellt die Controls und ruft danach onLoaded auf dem FX-Thread auf. */
    private void loadMapListAsync(Consumer<List<HexMap>> onLoaded) {
        applicationService.loadMapList(maps -> {
            controls.setMaps(maps);
            onLoaded.accept(maps);
        }, ex -> UiErrorReporter.reportBackgroundFailure("MapEditorView.loadMapListAsync()", ex));
    }

    private void loadMapAsync(Long mapId) {
        long requestSequence = loadSequence.incrementAndGet();
        applicationService.loadMap(mapId,
                tiles -> {
                    if (requestSequence != loadSequence.get()) {
                        return;
                    }
                    canvas.loadTiles(tiles);
                },
                ex -> {
                    if (requestSequence != loadSequence.get()) {
                        return;
                    }
                    UiErrorReporter.reportBackgroundFailure("MapEditorView.loadMapAsync()", ex);
                });
    }

    @Override public Node getMainContent()     { return canvas; }
    @Override public String getTitle()        { return "Karteneditor"; }
    @Override public String getIconText()     { return "\u270F"; } // ✏
    @Override public Node getControlsContent() { return controls; }
    @Override public Node getStateContent()    { return toolSettingsPane; }

    @Override
    public void onShow() {
        if (!initialLoadDone) {
            loadMapList();
            initialLoadDone = true;
        }
    }

    private void showTileDetails(HexTile tile, HexTerrainType terrainOverride) {
        if (tile == null) {
            return;
        }
        HexTerrainType displayTerrain = terrainOverride != null ? terrainOverride : tile.terrainType();
        detailsNavigator.showHexTile(new DetailsNavigator.HexTileSummary(
                tile.tileId(),
                tile.q(),
                tile.r(),
                displayTerrain == null ? null : displayTerrain.dbValue(),
                tile.elevation(),
                tile.biome() == null ? null : tile.biome().name(),
                tile.explored(),
                tile.notes()));
    }
}
