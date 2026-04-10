package features.world.hexmap.ui.editor.surface;

import features.world.hexmap.api.HexTileSummary;
import features.world.hexmap.editorcontrols.EditorcontrolsObject;
import features.world.hexmap.editorcontrols.input.ComposeInput;
import features.world.hexmap.model.HexMap;
import features.world.hexmap.model.HexTerrainType;
import features.world.hexmap.model.HexTile;
import features.world.hexmap.ui.editor.MapEditorApplicationService;
import features.world.hexmap.ui.editor.controls.EditorTool;
import features.world.hexmap.ui.editor.dropdowns.HexMapFormDropdown;
import features.world.hexmap.ui.editor.panes.MapEditorCanvas;
import javafx.scene.Node;
import ui.shell.AppView;
import ui.shell.DetailsNavigator;
import ui.async.UiErrorReporter;
import ui.shell.NavigationIcons;
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
@SuppressWarnings("unused")
public final class SurfaceObject implements AppView {

    private final ComposeInput.ComposedEditorControlsInput editorControls;
    private final MapEditorCanvas canvas;
    private final MapEditorApplicationService applicationService;
    private final DetailsNavigator detailsNavigator;
    private final HexMapFormDropdown mapDropdown = new HexMapFormDropdown();
    private final MessageDropdown messageDropdown = new MessageDropdown();

    /** Sammelt Tile-ID -> Gelaendeaenderung waehrend eines Malstrichs; Flush bei Mouse-Release. */
    private final Map<Long, HexTerrainType> dirtyTiles = new HashMap<>();
    private final AtomicLong loadSequence = new AtomicLong(0);
    private Long currentMapId;
    private boolean initialLoadDone = false;

    public SurfaceObject(DetailsNavigator detailsNavigator) {
        this.detailsNavigator = detailsNavigator;
        canvas = new MapEditorCanvas();
        applicationService = new MapEditorApplicationService();
        editorControls = new EditorcontrolsObject().compose(new ComposeInput(
                tool -> canvas.setPaintMode(tool == EditorTool.TERRAIN_BRUSH),
                mapId -> {
                    currentMapId = mapId;
                    loadMapAsync(mapId);
                },
                this::showNewMapDropdown,
                this::showEditMapDropdown));
        canvas.setPaintMode(editorControls.activeToolSupplier().get() == EditorTool.TERRAIN_BRUSH);

        canvas.setOnTileClicked(tile -> {
            if (editorControls.activeToolSupplier().get() == EditorTool.SELECT) {
                showTileDetails(tile, null);
            } else if (editorControls.activeToolSupplier().get() == EditorTool.TERRAIN_BRUSH) {
                paintTile(tile);
            }
        });

        canvas.setOnTileDragPainted(this::paintTile);
        canvas.setOnPaintStrokeFinished(this::flushDirtyTiles);
    }

    /** Optimistisches UI-Update; DB-Schreiben wird bis zum Ende des Malstrichs aufgeschoben. */
    private void paintTile(HexTile tile) {
        if (tile == null || tile.tileId() == null) return;
        HexTerrainType terrain = editorControls.activeTerrainTypeSupplier().get();
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
            UiErrorReporter.reportBackgroundFailure("SurfaceObject.flushDirtyTiles()", ex);
            if (currentMapId != null) {
                loadMapAsync(currentMapId);
            }
            messageDropdown.show(editorControls.controlsContent(),
                    "Speichern fehlgeschlagen",
                    "Geländeänderungen konnten nicht gespeichert werden. Die Karte wurde neu geladen.");
        });
    }

    private void showEditMapDropdown(ComposeInput.MapActionRequestInput request) {
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
            () -> loadMapListAsync(maps -> editorControls.selectMapAction().accept(mapId)),
            ex -> {
                    UiErrorReporter.reportBackgroundFailure("SurfaceObject.editMap()", ex);
                String msg = ex.getMessage() != null ? ex.getMessage() : "Unbekannter Fehler";
                messageDropdown.show(editorControls.controlsContent(), "Fehler beim Speichern", msg);
            });
    }

    /** Laedt alle Karten in die ComboBox und waehlt die erste Karte aus (oder öffnet den Neu-Dialog). */
    private void loadMapList() {
        loadMapListAsync(maps -> {
            if (maps.isEmpty()) {
                showNewMapDropdown(editorControls.controlsContent());
            } else {
                editorControls.selectMapAction().accept(maps.get(0).mapId());
            }
        });
    }

    private void showNewMapDropdown(Node anchor) {
        mapDropdown.showCreate(anchor, result -> {
            mapDropdown.hide();
            applicationService.createMap(result.name(), result.radius(),
                newMapId -> loadMapListAsync(maps -> editorControls.selectMapAction().accept(newMapId)),
                ex -> {
                    UiErrorReporter.reportBackgroundFailure("SurfaceObject.createMap()", ex);
                    messageDropdown.show(editorControls.controlsContent(), "Karte konnte nicht erstellt werden", "Bitte Eingaben und Datenbankstatus prüfen.");
                });
        });
    }

    /** Laedt die Kartenliste asynchron, fuellt die Controls und ruft danach onLoaded auf dem FX-Thread auf. */
    private void loadMapListAsync(Consumer<List<HexMap>> onLoaded) {
        applicationService.loadMapList(maps -> {
            editorControls.setMapsAction().accept(maps);
            onLoaded.accept(maps);
        }, ex -> UiErrorReporter.reportBackgroundFailure("SurfaceObject.loadMapListAsync()", ex));
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
                    UiErrorReporter.reportBackgroundFailure("SurfaceObject.loadMapAsync()", ex);
                });
    }

    @Override public Node getMainContent()     { return canvas; }
    @Override public String getTitle()        { return "Karteneditor"; }
    @Override public String getIconText()     { return ""; }
    @Override public Node getNavigationGraphic() { return NavigationIcons.mapEditor(); }
    @Override public Node getControlsContent() { return editorControls.controlsContent(); }
    @Override public Node getStateContent()    { return editorControls.stateContent(); }

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
        detailsNavigator.showHexTile(new HexTileSummary(
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
