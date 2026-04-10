package features.world.hexmap.editorsurface;

import features.world.hexmap.api.HexTileSummary;
import features.world.hexmap.editorcontrols.EditorcontrolsObject;
import features.world.hexmap.editorsurface.input.ComposeInput;
import features.world.hexmap.model.HexMap;
import features.world.hexmap.model.HexTerrainType;
import features.world.hexmap.model.HexTile;
import features.world.hexmap.ui.editor.MapEditorApplicationService;
import features.world.hexmap.ui.editor.controls.EditorTool;
import features.world.hexmap.ui.editor.dropdowns.HexMapFormDropdown;
import features.world.hexmap.ui.editor.panes.MapEditorCanvas;
import javafx.scene.Node;
import ui.async.UiErrorReporter;
import ui.components.MessageDropdown;
import ui.shell.AppView;
import ui.shell.DetailsNavigator;
import ui.shell.NavigationIcons;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.Consumer;

/**
 * Canonical hexmap editor-surface seam that owns the editor view composition,
 * async map loading, paint flushing, and inspector publication.
 */
@SuppressWarnings("unused")
public final class EditorsurfaceObject implements AppView {

    private final features.world.hexmap.editorcontrols.input.ComposeInput.ComposedEditorControlsInput editorControls;
    private final MapEditorCanvas canvas;
    private final MapEditorApplicationService applicationService;
    private final DetailsNavigator detailsNavigator;
    private final HexMapFormDropdown mapDropdown = new HexMapFormDropdown();
    private final MessageDropdown messageDropdown = new MessageDropdown();

    // Buffer terrain edits locally during one brush stroke and persist them on release.
    private final Map<Long, HexTerrainType> dirtyTiles = new HashMap<>();
    private final AtomicLong loadSequence = new AtomicLong(0);
    private Long currentMapId;
    private boolean initialLoadDone = false;

    public EditorsurfaceObject(ComposeInput input) {
        ComposeInput resolvedInput = Objects.requireNonNull(input, "input");
        detailsNavigator = resolvedInput.detailsNavigator();
        canvas = new MapEditorCanvas();
        applicationService = new MapEditorApplicationService();
        editorControls = new EditorcontrolsObject().compose(
                new features.world.hexmap.editorcontrols.input.ComposeInput(
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

    private void paintTile(HexTile tile) {
        if (tile == null || tile.tileId() == null) {
            return;
        }
        HexTerrainType terrain = editorControls.activeTerrainTypeSupplier().get();
        if (terrain == tile.terrainType()) {
            return;
        }

        canvas.updateTileTerrain(tile.tileId(), terrain);
        dirtyTiles.put(tile.tileId(), terrain);
        showTileDetails(tile, terrain);
    }

    private void flushDirtyTiles() {
        if (dirtyTiles.isEmpty()) {
            return;
        }
        Map<Long, HexTerrainType> batch = new HashMap<>(dirtyTiles);
        dirtyTiles.clear();

        applicationService.flushTerrainChanges(batch, () -> { }, ex -> {
            UiErrorReporter.reportBackgroundFailure("EditorsurfaceObject.flushDirtyTiles()", ex);
            if (currentMapId != null) {
                loadMapAsync(currentMapId);
            }
            messageDropdown.show(
                    editorControls.controlsContent(),
                    "Speichern fehlgeschlagen",
                    "Geländeänderungen konnten nicht gespeichert werden. Die Karte wurde neu geladen.");
        });
    }

    private void showEditMapDropdown(features.world.hexmap.editorcontrols.input.ComposeInput.MapActionRequestInput request) {
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
        applicationService.updateMap(
                mapId,
                name,
                oldRadius,
                newRadius,
                () -> loadMapListAsync(maps -> editorControls.selectMapAction().accept(mapId)),
                ex -> {
                    UiErrorReporter.reportBackgroundFailure("EditorsurfaceObject.editMap()", ex);
                    String msg = ex.getMessage() != null ? ex.getMessage() : "Unbekannter Fehler";
                    messageDropdown.show(editorControls.controlsContent(), "Fehler beim Speichern", msg);
                });
    }

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
            applicationService.createMap(
                    result.name(),
                    result.radius(),
                    newMapId -> loadMapListAsync(maps -> editorControls.selectMapAction().accept(newMapId)),
                    ex -> {
                        UiErrorReporter.reportBackgroundFailure("EditorsurfaceObject.createMap()", ex);
                        messageDropdown.show(
                                editorControls.controlsContent(),
                                "Karte konnte nicht erstellt werden",
                                "Bitte Eingaben und Datenbankstatus prüfen.");
                    });
        });
    }

    private void loadMapListAsync(Consumer<List<HexMap>> onLoaded) {
        applicationService.loadMapList(
                maps -> {
                    editorControls.setMapsAction().accept(maps);
                    onLoaded.accept(maps);
                },
                ex -> UiErrorReporter.reportBackgroundFailure("EditorsurfaceObject.loadMapListAsync()", ex));
    }

    private void loadMapAsync(Long mapId) {
        long requestSequence = loadSequence.incrementAndGet();
        applicationService.loadMap(
                mapId,
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
                    UiErrorReporter.reportBackgroundFailure("EditorsurfaceObject.loadMapAsync()", ex);
                });
    }

    @Override
    public Node getMainContent() {
        return canvas;
    }

    @Override
    public String getTitle() {
        return "Karteneditor";
    }

    @Override
    public String getIconText() {
        return "";
    }

    @Override
    public Node getNavigationGraphic() {
        return NavigationIcons.mapEditor();
    }

    @Override
    public Node getControlsContent() {
        return editorControls.controlsContent();
    }

    @Override
    public Node getStateContent() {
        return editorControls.stateContent();
    }

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
