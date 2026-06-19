package src.view.leftbartabs.hexmap;

import java.util.Map;
import java.util.Objects;
import javafx.scene.Node;
import shell.api.ServiceRegistry;
import shell.api.ShellBinding;
import shell.api.ShellRuntimeContext;
import shell.api.ShellSlot;
import src.domain.hex.HexEditorApplicationService;
import src.domain.hex.published.LoadHexEditorCommand;
import src.domain.hex.published.HexEditorModel;

final class HexMapBinder {

    private final ShellRuntimeContext runtimeContext;

    HexMapBinder(ShellRuntimeContext runtimeContext) {
        this.runtimeContext = Objects.requireNonNull(runtimeContext, "runtimeContext");
    }

    ShellBinding bind() {
        ServiceRegistry services = runtimeContext.services();
        HexEditorApplicationService editor = services.require(HexEditorApplicationService.class);
        HexEditorModel editorModel = services.require(HexEditorModel.class);
        HexMapControlsContentModel controlsContentModel = new HexMapControlsContentModel();
        HexMapMainContentModel mainContentModel = new HexMapMainContentModel();
        HexMapStateContentModel stateContentModel = new HexMapStateContentModel();
        HexMapContributionModel contributionModel = new HexMapContributionModel(
                controlsContentModel,
                mainContentModel,
                stateContentModel);
        HexMapIntentHandler intentHandler = new HexMapIntentHandler(
                editor,
                contributionModel,
                controlsContentModel);
        HexMapControlsView controls = new HexMapControlsView();
        HexMapMainView main = new HexMapMainView();
        HexMapStateView state = new HexMapStateView();

        controls.bind(contributionModel.controlsContentModel());
        main.bind(contributionModel.mainContentModel());
        state.bind(contributionModel.stateContentModel());
        controls.onViewInputEvent(intentHandler::consume);
        main.onViewInputEvent(intentHandler::consume);
        editorModel.subscribe(contributionModel::applySnapshot);
        contributionModel.applySnapshot(editorModel.current());
        editor.loadEditor(new LoadHexEditorCommand());
        return new Binding(controls, main, state);
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
