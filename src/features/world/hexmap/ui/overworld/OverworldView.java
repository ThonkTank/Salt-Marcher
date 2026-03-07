package features.world.hexmap.ui.overworld;

import javafx.scene.Node;
import ui.shell.AppView;
import ui.async.UiErrorReporter;

/**
 * Overworld-Reiseansicht. Zeigt die Hex-Karte im Hauptbereich inklusive Gruppenmarker.
 * Reise-Steuerelemente erscheinen im linken Kontrollpanel.
 */
public class OverworldView implements AppView {

    private final OverworldControls overworldControls;
    private final HexMapPane hexMapPane;
    private final OverworldApplicationService applicationService;
    private boolean mapLoaded = false;

    public OverworldView() {
        overworldControls = new OverworldControls();
        hexMapPane = new HexMapPane();
        applicationService = new OverworldApplicationService();
        hexMapPane.setOnPartyTokenMoved(tileId ->
                applicationService.schedulePartyTileUpdate(
                        tileId,
                        ex -> UiErrorReporter.reportBackgroundFailure("OverworldView.updatePartyTile()", ex)));
    }

    @Override public Node getMainContent()     { return hexMapPane; }
    @Override public String getTitle()        { return "Karte"; }
    @Override public String getIconText()     { return "\uD83D\uDDFA"; }
    @Override public Node getControlsContent() { return overworldControls; }

    @Override
    public void onShow() {
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
