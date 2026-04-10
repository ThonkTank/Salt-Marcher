package features.world.hexmap.overworldsurface;

import features.world.hexmap.overworldsurface.input.ComposeInput;
import javafx.scene.Node;
import ui.async.UiErrorReporter;
import ui.shell.AppView;
import ui.shell.NavigationIcons;

import java.util.Objects;

/**
 * Canonical hexmap overworld-surface seam that owns the travel handoff, initial
 * map load, party-token persistence flow, and lifecycle of the overworld view.
 */
@SuppressWarnings("unused")
public final class OverworldsurfaceObject implements AppView {

    private final features.world.hexmap.ui.overworld.OverworldControls overworldControls;
    private final features.world.hexmap.ui.overworld.HexMapPane hexMapPane;
    private final features.world.hexmap.ui.overworld.OverworldApplicationService applicationService;
    private final features.world.api.input.TravelSurfaceInput travelSurface;
    private boolean mapLoaded = false;

    public OverworldsurfaceObject(ComposeInput input) {
        ComposeInput resolvedInput = Objects.requireNonNull(input, "input");
        overworldControls = new features.world.hexmap.ui.overworld.OverworldControls();
        hexMapPane = new features.world.hexmap.ui.overworld.HexMapPane();
        applicationService = new features.world.hexmap.ui.overworld.OverworldApplicationService();
        travelSurface = resolvedInput.travelSurface();
        hexMapPane.setOnPartyTokenMoved(tileId ->
                applicationService.schedulePartyTileUpdate(
                        tileId,
                        ex -> UiErrorReporter.reportBackgroundFailure(
                                "OverworldsurfaceObject.updatePartyTile()",
                                ex)));
    }

    @Override
    public Node getMainContent() {
        return hexMapPane;
    }

    @Override
    public String getTitle() {
        return "Karte";
    }

    @Override
    public String getIconText() {
        return "";
    }

    @Override
    public Node getNavigationGraphic() {
        return NavigationIcons.overworld();
    }

    @Override
    public Node getControlsContent() {
        return overworldControls;
    }

    @Override
    public void onShow() {
        travelSurface.showOverworldTravel();
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
                                            "OverworldsurfaceObject.initializeDefaultPartyTile()",
                                            ex));
                        }
                        mapLoaded = true;
                    },
                    ex -> UiErrorReporter.reportBackgroundFailure(
                            "OverworldsurfaceObject.loadInitialMap()",
                            ex));
        }
    }

    @Override
    public void onHide() {
        applicationService.shutdownPartyPositionSession();
    }
}
