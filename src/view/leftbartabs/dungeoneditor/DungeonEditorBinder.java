package src.view.leftbartabs.dungeoneditor;

import java.util.Map;
import java.util.Objects;
import javafx.scene.Node;
import shell.api.ShellBinding;
import shell.api.ShellControls;
import shell.api.ShellSlot;
import src.features.dungeon.runtime.DungeonEditorRuntimeDependencies;
import src.features.dungeon.shell.DungeonEditorFeatureShellBinding;
import src.view.slotcontent.controls.catalogcrud.CatalogCrudControlsContentModel;
import src.view.slotcontent.controls.catalogcrud.CatalogCrudControlsView;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel;
import src.view.slotcontent.main.dungeonmap.DungeonMapView;

final class DungeonEditorBinder {

    private final DungeonEditorRuntimeDependencies dependencies;

    DungeonEditorBinder(DungeonEditorRuntimeDependencies dependencies) {
        this.dependencies = Objects.requireNonNull(dependencies, "dependencies");
    }

    ShellBinding bind() {
        DungeonEditorFeatureShellBinding featureShell = new DungeonEditorFeatureShellBinding(dependencies);
        DungeonEditorControlsPanelModel controlsPanelModel = new DungeonEditorControlsPanelModel();
        CatalogCrudControlsContentModel mapCatalogContentModel = new CatalogCrudControlsContentModel();
        DungeonEditorStatePanelModel statePanelModel = new DungeonEditorStatePanelModel();
        DungeonMapContentModel mapContentModel = new DungeonMapContentModel("Dungeon workspace", true);
        DungeonEditorViewModel viewModel = new DungeonEditorViewModel(
                controlsPanelModel,
                statePanelModel,
                mapCatalogContentModel,
                mapContentModel,
                featureShell.operations());
        DungeonEditorControlsView controls = new DungeonEditorControlsView();
        CatalogCrudControlsView mapCatalog = new CatalogCrudControlsView();
        DungeonMapView main = new DungeonMapView();
        DungeonEditorStateView state = new DungeonEditorStateView();

        main.bind(mapContentModel);
        controls.bind(controlsPanelModel);
        mapCatalog.bind(mapCatalogContentModel);
        state.bind(statePanelModel);
        main.onViewInputEvent(viewModel::consume);
        controls.onControlsInput(viewModel::consume);
        mapCatalog.onViewInputEvent(viewModel::consume);
        state.onStateInput(viewModel::consume);
        viewModel.bindPanelModels();
        DungeonEditorFeatureShellBinding.PublicationSink frameSink = viewModel::applyFrame;
        featureShell.subscribe(frameSink);
        featureShell.publishCurrent(frameSink);
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
