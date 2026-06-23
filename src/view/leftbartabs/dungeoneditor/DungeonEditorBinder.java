package src.view.leftbartabs.dungeoneditor;

import java.util.Map;
import java.util.Objects;
import javafx.scene.Node;
import shell.api.ShellBinding;
import shell.api.ShellControls;
import shell.api.ShellRuntimeContext;
import shell.api.ShellSlot;
import src.features.dungeon.runtime.DungeonEditorInlineLabelEditSession;
import src.features.dungeon.runtime.DungeonEditorRenderFrame;
import src.features.dungeon.shell.DungeonEditorFeatureShellBinding;
import src.view.slotcontent.controls.catalogcrud.CatalogCrudControlsContentModel;
import src.view.slotcontent.controls.catalogcrud.CatalogCrudControlsView;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel.InlineLabelEditProjection;
import src.view.slotcontent.main.dungeonmap.DungeonMapView;

final class DungeonEditorBinder {

    private final ShellRuntimeContext runtimeContext;

    DungeonEditorBinder(ShellRuntimeContext runtimeContext) {
        this.runtimeContext = Objects.requireNonNull(runtimeContext, "runtimeContext");
    }

    ShellBinding bind() {
        DungeonEditorFeatureShellBinding featureShell = new DungeonEditorFeatureShellBinding(runtimeContext);
        DungeonEditorControlsContentModel controlsContentModel = new DungeonEditorControlsContentModel();
        CatalogCrudControlsContentModel mapCatalogContentModel = new CatalogCrudControlsContentModel();
        DungeonEditorStateContentModel stateContentModel = new DungeonEditorStateContentModel();
        DungeonEditorContributionModel contributionModel = new DungeonEditorContributionModel(stateContentModel);
        DungeonMapContentModel mapContentModel = new DungeonMapContentModel("Dungeon workspace", true);
        DungeonEditorIntentHandler intentHandler =
                new DungeonEditorIntentHandler(
                        contributionModel,
                        controlsContentModel,
                        mapCatalogContentModel,
                        stateContentModel,
                        mapContentModel,
                        featureShell.operations());
        DungeonEditorControlsView controls = new DungeonEditorControlsView();
        CatalogCrudControlsView mapCatalog = new CatalogCrudControlsView();
        DungeonMapView main = new DungeonMapView();
        DungeonEditorStateView state = new DungeonEditorStateView();

        main.bind(mapContentModel);
        controls.bind(controlsContentModel);
        mapCatalog.bind(mapCatalogContentModel);
        state.bind(stateContentModel);
        main.onViewInputEvent(intentHandler::consume);
        controls.onViewInputEvent(intentHandler::consume);
        mapCatalog.onViewInputEvent(intentHandler::consume);
        state.onViewInputEvent(intentHandler::consume);
        contributionModel.bindControlsContentModel(controlsContentModel);
        contributionModel.bindMapCatalogContentModel(controlsContentModel, mapCatalogContentModel);
        featureShell.subscribe(frame -> applyFrame(
                frame,
                contributionModel,
                mapContentModel));
        featureShell.publishCurrent(frame -> applyFrame(
                frame,
                contributionModel,
                mapContentModel));
        return new Binding(ShellControls.stack(mapCatalog, controls), main, state);
    }

    private static void applyFrame(
            DungeonEditorRenderFrame frame,
            DungeonEditorContributionModel contributionModel,
            DungeonMapContentModel mapContentModel
    ) {
        contributionModel.applyFrame(frame);
        mapContentModel.applyInlineLabelEditProjection(inlineLabelProjection(frame.inlineLabelEditSession()));
        mapContentModel.applyEditorSurfaceFrame(frame.mapSurface(), contributionModel.currentMapInteractionFrame());
    }

    private static InlineLabelEditProjection inlineLabelProjection(
            DungeonEditorInlineLabelEditSession session
    ) {
        DungeonEditorInlineLabelEditSession safeSession = session == null
                ? DungeonEditorInlineLabelEditSession.inactive()
                : session;
        if (!safeSession.active()) {
            return InlineLabelEditProjection.inactive();
        }
        return new InlineLabelEditProjection(
                true,
                safeSession.labelKind(),
                safeSession.ownerId(),
                safeSession.clusterId(),
                safeSession.topologyKind(),
                safeSession.topologyId(),
                safeSession.draftText(),
                safeSession.centerX(),
                safeSession.centerY(),
                safeSession.width(),
                safeSession.height(),
                safeSession.rotationDegrees());
    }

    private record Binding(
            Node controls,
            Node main,
            Node state
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
