package features.dungeon.adapter.javafx.editor;

import java.util.Map;
import java.util.Objects;
import javafx.scene.Node;
import shell.api.ShellBinding;
import shell.api.ShellControls;
import shell.api.ShellSlot;
import features.dungeon.api.editor.DungeonEditorApi;
import platform.ui.catalogcrud.CatalogCrudControlsContentModel;
import platform.ui.catalogcrud.CatalogCrudControlsView;
import features.dungeon.adapter.javafx.map.DungeonMapContentModel;
import features.dungeon.adapter.javafx.map.DungeonMapView;

final class DungeonEditorBinder {

    private final DungeonEditorApi editorApi;

    DungeonEditorBinder(DungeonEditorApi editorApi) {
        this.editorApi = Objects.requireNonNull(editorApi, "editorApi");
    }

    ShellBinding bind() {
        DungeonEditorControlsPanelModel controlsPanelModel = new DungeonEditorControlsPanelModel();
        CatalogCrudControlsContentModel mapCatalogContentModel = new CatalogCrudControlsContentModel();
        DungeonEditorStatePanelModel statePanelModel = new DungeonEditorStatePanelModel();
        DungeonMapContentModel mapContentModel = new DungeonMapContentModel("Dungeon workspace", true);
        DungeonEditorViewModel viewModel = new DungeonEditorViewModel(
                controlsPanelModel,
                statePanelModel,
                mapCatalogContentModel,
                mapContentModel,
                editorApi);
        DungeonEditorControlsView controls = new DungeonEditorControlsView();
        CatalogCrudControlsView mapCatalog = new CatalogCrudControlsView();
        DungeonMapView main = new DungeonMapView();
        DungeonEditorStateView state = new DungeonEditorStateView();

        main.bind(mapContentModel);
        controls.bind(controlsPanelModel);
        mapCatalog.bind(mapCatalogContentModel);
        state.bind(statePanelModel);
        main.onViewInputEvent(viewModel::consume);
        main.onVisibleCellBoundsChanged(viewModel::consumeViewport);
        controls.onControlsInput(viewModel::consume);
        mapCatalog.onViewInputEvent(viewModel::consume);
        state.onStateInput(viewModel::consume);
        viewModel.bindPanelModels();
        editorApi.subscribe(viewModel::applyState);
        viewModel.applyState(editorApi.current());
        return new Binding(ShellControls.stack(mapCatalog, controls), main, state, mapContentModel);
    }

    record Binding(
            Node controls,
            Node main,
            Node state,
            DungeonMapContentModel mapContentModel
    ) implements ShellBinding {

        @Override
        public String title() {
            return "Dungeon-Editor";
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
