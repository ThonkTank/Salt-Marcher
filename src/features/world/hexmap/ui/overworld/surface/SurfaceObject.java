package features.world.hexmap.ui.overworld.surface;

import features.world.api.input.TravelSurfaceInput;
import javafx.scene.Node;
import ui.shell.AppView;
import ui.async.UiErrorReporter;
import ui.shell.NavigationIcons;

/**
 * Overworld-Reiseansicht. Zeigt die Hex-Karte im Hauptbereich inklusive Gruppenmarker.
 * Reise-Steuerelemente erscheinen im linken Kontrollpanel.
 */
public final class SurfaceObject implements AppView {

    private final features.world.hexmap.ui.overworld.OverworldControls overworldControls;
    private final features.world.hexmap.ui.overworld.HexMapPane hexMapPane;
    private final features.world.hexmap.ui.overworld.OverworldApplicationService applicationService;
    private final TravelSurfaceInput travelSurface;
    private boolean mapLoaded = false;

    public SurfaceObject(TravelSurfaceInput travelSurface) {
        overworldControls = new features.world.hexmap.ui.overworld.OverworldControls();
        hexMapPane = new features.world.hexmap.ui.overworld.HexMapPane();
        applicationService = new features.world.hexmap.ui.overworld.OverworldApplicationService();
        this.travelSurface = travelSurface;
        hexMapPane.setOnPartyTokenMoved(tileId ->
                applicationService.schedulePartyTileUpdate(
                        tileId,
                        ex -> UiErrorReporter.reportBackgroundFailure("OverworldView.updatePartyTile()", ex)));
    }

    @Override public Node getMainContent()     { return hexMapPane; }
    @Override public String getTitle()        { return "Karte"; }
    @Override public String getIconText()     { return ""; }
    @Override public Node getNavigationGraphic() { return NavigationIcons.overworld(); }
    @Override public Node getControlsContent() { return overworldControls; }

    @Override
    public void onShow() {
        if (travelSurface != null) {
            travelSurface.showOverworldTravel();
        }
        if (!mapLoaded) {
            applicationService.loadInitialMap(
                    mapState -> {
                        Long persistedPartyTileId = mapState.partyTileId();
                        Long defaultPartyTileId = mapState.defaultPartyTileId();
                        Long displayedPartyTileId = persistedPartyTileId != null
                                ? persistedPartyTileId
                                : defaultPartyTileId;

                        hexMapPane.loadTilesWithPartyToken(mapState.tiles(), displayedPartyTileId);
                        if (persistedPartyTileId == null && defaultPartyTileId != null) {
                            applicationService.updatePartyTile(
                                    defaultPartyTileId,
                                    () -> { },
                                    ex -> UiErrorReporter.reportBackgroundFailure(
                                            "OverworldView.initializeDefaultPartyTile()",
                                            ex));
                        }
                        mapLoaded = true;
                    },
                    ex -> UiErrorReporter.reportBackgroundFailure("OverworldView.loadInitialMap()", ex));
        }
    }

    @Override
    public void onHide() {
        applicationService.shutdownPartyPositionSession();
    }
}
