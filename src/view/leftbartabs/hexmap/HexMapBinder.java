package src.view.leftbartabs.hexmap;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import javafx.scene.Node;
import shell.api.ServiceRegistry;
import shell.api.ShellBinding;
import shell.api.ShellControls;
import shell.api.ShellRuntimeContext;
import shell.api.ShellSlot;
import src.domain.hex.HexEditorApplicationService;
import src.domain.hex.HexTravelApplicationService;
import src.domain.hex.model.map.HexEditorMode;
import src.domain.hex.model.map.HexMarkerKind;
import src.domain.hex.model.map.HexTerrain;
import src.domain.hex.published.CreateHexMapCommand;
import src.domain.hex.published.LoadHexEditorCommand;
import src.domain.hex.published.MoveHexPartyTokenCommand;
import src.domain.hex.published.PaintHexTerrainCommand;
import src.domain.hex.published.RenameHexMapCommand;
import src.domain.hex.published.SaveHexMarkerCommand;
import src.domain.hex.published.SelectHexMapCommand;
import src.domain.hex.published.SelectHexTileCommand;
import src.domain.hex.published.SetHexEditorToolCommand;
import src.domain.hex.published.UpdateHexMapCommand;
import src.domain.hex.published.HexEditorModel;
import src.domain.hex.published.HexTravelModel;
import src.view.slotcontent.controls.catalogcrud.CatalogCrudControlsView;
import src.view.slotcontent.controls.catalogcrud.CatalogCrudControlsViewInputEvent;

final class HexMapBinder {

    private static final long UNRESOLVED_ID = 0L;
    private static final int DEFAULT_CREATE_RADIUS = 2;

    private final ShellRuntimeContext runtimeContext;

    HexMapBinder(ShellRuntimeContext runtimeContext) {
        this.runtimeContext = Objects.requireNonNull(runtimeContext, "runtimeContext");
    }

    ShellBinding bind() {
        ServiceRegistry services = runtimeContext.services();
        HexEditorApplicationService editor = services.require(HexEditorApplicationService.class);
        HexTravelApplicationService travel = services.require(HexTravelApplicationService.class);
        HexEditorModel editorModel = services.require(HexEditorModel.class);
        HexTravelModel travelModel = services.require(HexTravelModel.class);
        HexMapViewModel viewModel = new HexMapViewModel();
        HexMapControlsView controls = new HexMapControlsView();
        CatalogCrudControlsView mapCatalog = new CatalogCrudControlsView();
        HexMapMainView main = new HexMapMainView();
        HexMapStateView state = new HexMapStateView();

        controls.bind(viewModel);
        mapCatalog.bind(viewModel.mapCatalogContentModel());
        main.bind(viewModel);
        state.bind(viewModel);
        controls.onToolSelection((tool, terrain) -> consumeToolSelection(editor, viewModel, tool, terrain));
        mapCatalog.onViewInputEvent(event -> consumeCatalogEvent(editor, viewModel, event));
        main.onTileAction(action -> consumeTileAction(editor, travel, viewModel, action));
        state.onMapSave(request -> consumeMapSave(editor, viewModel, request));
        state.onMarkerSave(request -> consumeMarkerSave(editor, viewModel, request));
        state.onMarkerDraft(request -> consumeMarkerDraft(viewModel, request));
        editorModel.subscribe(viewModel::applySnapshot);
        travelModel.subscribe(viewModel::applyTravelSnapshot);
        viewModel.applySnapshot(editorModel.current());
        viewModel.applyTravelSnapshot(travelModel.current());
        editor.loadEditor(new LoadHexEditorCommand());
        return new Binding(ShellControls.stack(mapCatalog, controls), main, state);
    }

    private static void consumeToolSelection(
            HexEditorApplicationService editor,
            HexMapViewModel viewModel,
            HexEditorMode tool,
            HexTerrain terrain
    ) {
        HexMapViewModel.ControlsProjection projection = viewModel.properties().controls().get();
        if (projection.toolChanged(tool, terrain)) {
            editor.setActiveTool(new SetHexEditorToolCommand(tool.name(), terrain.name()));
        }
    }

    private static void consumeCatalogEvent(
            HexEditorApplicationService editor,
            HexMapViewModel viewModel,
            CatalogCrudControlsViewInputEvent event
    ) {
        if (event == null) {
            return;
        }
        viewModel.mapCatalogContentModel().updateSelectorFilter(event.selectorFilterText());
        if (consumeCatalogSelection(editor, viewModel, event) || consumeCatalogSubmit(editor, viewModel, event)) {
            return;
        }
        consumeCatalogEditor(viewModel, event);
    }

    private static void consumeTileAction(
            HexEditorApplicationService editor,
            HexTravelApplicationService travel,
            HexMapViewModel viewModel,
            HexMapMainView.TileAction action
    ) {
        if (action.mapId() <= UNRESOLVED_ID) {
            viewModel.showLocalFailure("Hex map is required.");
            return;
        }
        if (action.activeTool() == HexEditorMode.PAINT_TERRAIN) {
            editor.paintTerrain(new PaintHexTerrainCommand(
                    action.mapId(),
                    action.q(),
                    action.r(),
                    action.activeTerrain().name()));
            return;
        }
        if (action.activeTool() == HexEditorMode.MOVE_PARTY) {
            movePartyToken(travel, viewModel, action);
            return;
        }
        editor.selectTile(new SelectHexTileCommand(action.mapId(), action.q(), action.r()));
        if (action.activeTool() == HexEditorMode.PLACE_MARKER) {
            editor.setActiveTool(new SetHexEditorToolCommand(action.activeTool().name(), action.activeTerrain().name()));
        }
    }

    private static void consumeMapSave(
            HexEditorApplicationService editor,
            HexMapViewModel viewModel,
            HexMapStateView.MapSaveRequest request
    ) {
        HexMapViewModel.StateProjection projection = viewModel.properties().state().get();
        long mapId = projection.selectedMapId();
        if (mapId <= UNRESOLVED_ID) {
            viewModel.showLocalFailure("Hex map is required.");
            return;
        }
        editor.updateMap(new UpdateHexMapCommand(
                mapId,
                request.mapName(),
                parseInt(request.mapRadius(), DEFAULT_CREATE_RADIUS),
                request.confirmDestructiveShrink()));
    }

    private static void consumeMarkerSave(
            HexEditorApplicationService editor,
            HexMapViewModel viewModel,
            HexMapStateView.MarkerSaveRequest request
    ) {
        HexMapViewModel.StateProjection projection = viewModel.properties().state().get();
        long mapId = projection.selectedMapId();
        if (mapId <= UNRESOLVED_ID) {
            viewModel.showLocalFailure("Hex map is required.");
            return;
        }
        if (!projection.tileSelected()) {
            viewModel.showLocalFailure("Select a Hex tile before saving a marker.");
            return;
        }
        HexMarkerKind markerType = projection.markerType(request.markerTypeOptionIndex());
        HexMapViewModel.MarkerSelectorItem selectedMarker = projection.markerOption(request.markerOptionIndex());
        editor.saveMarker(new SaveHexMarkerCommand(
                mapId,
                selectedMarker.markerId(),
                projection.selectedQ(),
                projection.selectedR(),
                request.markerName(),
                markerType.name(),
                request.markerNote()));
    }

    private static void consumeMarkerDraft(
            HexMapViewModel viewModel,
            HexMapStateView.MarkerDraftRequest request
    ) {
        HexMapViewModel.StateProjection projection = viewModel.properties().state().get();
        HexMapViewModel.MarkerSelectorItem marker = projection.markerOption(request.markerOptionIndex());
        if (request.markerSelectionRequested()) {
            viewModel.updateMarkerDraft(marker.markerId(), marker.name(), marker.type(), marker.note());
            return;
        }
        viewModel.updateMarkerDraft(
                marker.markerId(),
                request.markerName(),
                projection.markerType(request.markerTypeOptionIndex()),
                request.markerNote());
    }

    private static boolean consumeCatalogSelection(
            HexEditorApplicationService editor,
            HexMapViewModel viewModel,
            CatalogCrudControlsViewInputEvent event
    ) {
        if (!event.selectedItemId().isBlank()) {
            viewModel.mapCatalogContentModel().selectItem(event.selectedItemId());
            return true;
        }
        if (!event.reloadItemId().isBlank()) {
            editor.loadEditor(new LoadHexEditorCommand());
            selectMap(editor, parseId(event.reloadItemId()));
            return true;
        }
        if (!event.openItemId().isBlank()) {
            selectMap(editor, parseId(event.openItemId()));
            return true;
        }
        return false;
    }

    private static boolean consumeCatalogSubmit(
            HexEditorApplicationService editor,
            HexMapViewModel viewModel,
            CatalogCrudControlsViewInputEvent event
    ) {
        if (!event.createDraftName().isBlank()) {
            createMap(editor, viewModel, event.createDraftName());
            return true;
        }
        if (!event.renameItemId().isBlank()) {
            renameMap(editor, viewModel, event.renameItemId(), event.renameDraftName());
            return true;
        }
        return false;
    }

    private static void consumeCatalogEditor(
            HexMapViewModel viewModel,
            CatalogCrudControlsViewInputEvent event
    ) {
        if (event.createEditorOpened()) {
            viewModel.mapCatalogContentModel().openCreate();
            return;
        }
        if (event.dismissed()) {
            viewModel.mapCatalogContentModel().closeOperation();
            return;
        }
        if (!event.renameEditorItemId().isBlank()) {
            viewModel.mapCatalogContentModel().openRename(event.renameEditorItemId());
        }
    }

    private static void movePartyToken(
            HexTravelApplicationService travel,
            HexMapViewModel viewModel,
            HexMapMainView.TileAction action
    ) {
        List<Long> characterIds = viewModel.partyTokenCharacterIds();
        if (characterIds.isEmpty()) {
            viewModel.showLocalFailure("No party token characters are available for Hex travel.");
            return;
        }
        travel.movePartyToken(new MoveHexPartyTokenCommand(action.mapId(), action.q(), action.r(), characterIds));
    }

    private static void selectMap(HexEditorApplicationService editor, long mapId) {
        if (mapId <= UNRESOLVED_ID) {
            return;
        }
        editor.selectMap(new SelectHexMapCommand(mapId));
    }

    private static void createMap(
            HexEditorApplicationService editor,
            HexMapViewModel viewModel,
            String name
    ) {
        String trimmedName = safeText(name);
        if (trimmedName.isBlank()) {
            viewModel.mapCatalogContentModel().showValidationError("Name fehlt.");
            return;
        }
        editor.createMap(new CreateHexMapCommand(trimmedName, DEFAULT_CREATE_RADIUS));
        viewModel.mapCatalogContentModel().closeOperation();
    }

    private static void renameMap(
            HexEditorApplicationService editor,
            HexMapViewModel viewModel,
            String itemId,
            String name
    ) {
        long mapId = parseId(itemId);
        String trimmedName = safeText(name);
        if (mapId <= UNRESOLVED_ID) {
            viewModel.mapCatalogContentModel().showValidationError("Hex-Karte fehlt.");
            return;
        }
        if (trimmedName.isBlank()) {
            viewModel.mapCatalogContentModel().showValidationError("Name fehlt.");
            return;
        }
        editor.renameMap(new RenameHexMapCommand(mapId, trimmedName));
        viewModel.mapCatalogContentModel().closeOperation();
    }

    private static long parseId(String value) {
        try {
            return Long.parseLong(safeText(value));
        } catch (NumberFormatException ignored) {
            return 0L;
        }
    }

    private static int parseInt(String value, int fallback) {
        try {
            return Integer.parseInt(safeText(value));
        } catch (NumberFormatException ignored) {
            return fallback;
        }
    }

    private static String safeText(String value) {
        return value == null ? "" : value.trim();
    }

    private record Binding(Node controls, Node main, Node state) implements ShellBinding {

        @Override
        public String title() {
            return "Hex-Karte";
        }

        @Override
        public Map<ShellSlot, Node> slotContent() {
            return Map.of(
                    ShellSlot.COCKPIT_CONTROLS, controls,
                    ShellSlot.COCKPIT_MAIN, main,
                    ShellSlot.COCKPIT_STATE, state);
        }
    }
}
