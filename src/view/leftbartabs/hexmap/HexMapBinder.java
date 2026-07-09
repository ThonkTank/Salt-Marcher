package src.view.leftbartabs.hexmap;

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
import src.domain.hex.published.HexEditorModel;
import src.domain.hex.published.HexTravelModel;
import src.view.slotcontent.controls.catalogcrud.CatalogCrudControlsView;

final class HexMapBinder {

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
        HexMapIntentHandler intentHandler = new HexMapIntentHandler(
                editor,
                travel,
                viewModel);
        HexMapControlsView controls = new HexMapControlsView();
        CatalogCrudControlsView mapCatalog = new CatalogCrudControlsView();
        HexMapMainView main = new HexMapMainView();
        HexMapStateView state = new HexMapStateView();

        controls.bind(viewModel);
        mapCatalog.bind(viewModel.mapCatalogContentModel());
        main.bind(viewModel);
        state.bind(viewModel);
        controls.onViewInputEvent(intentHandler::consume);
        mapCatalog.onViewInputEvent(intentHandler::consume);
        main.onViewInputEvent(intentHandler::consume);
        state.onViewInputEvent(intentHandler::consume);
        editorModel.subscribe(viewModel::applySnapshot);
        travelModel.subscribe(viewModel::applyTravelSnapshot);
        viewModel.applySnapshot(editorModel.current());
        viewModel.applyTravelSnapshot(travelModel.current());
        intentHandler.activateEditor();
        return new Binding(ShellControls.stack(mapCatalog, controls), main, state);
    }

    private record Binding(
            Node controls,
            Node main,
            Node state
    ) implements ShellBinding {

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
