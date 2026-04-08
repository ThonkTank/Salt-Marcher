package features.world.hexmap.ui.overworld;

import features.world.api.input.WorldTravelSurface;
import javafx.scene.Node;
import ui.shell.AppView;
import ui.async.UiErrorReporter;
import ui.shell.NavigationIcons;

/**
 * Overworld-Reiseansicht. Zeigt die Hex-Karte im Hauptbereich inklusive Gruppenmarker.
 * Reise-Steuerelemente erscheinen im linken Kontrollpanel.
 */
public class OverworldView implements AppView {

    private final OverworldControls overworldControls;
    private final HexMapPane hexMapPane;
    private final OverworldApplicationService applicationService;
    private final WorldTravelSurface travelSurface;
    private boolean mapLoaded = false;

    public OverworldView(WorldTravelSurface travelSurface) {
        overworldControls = new OverworldControls();
        hexMapPane = new HexMapPane();
        applicationService = new OverworldApplicationService();
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
