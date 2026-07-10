package src.view.leftbartabs.sessionplanner;

import java.util.Map;
import java.util.Objects;
import javafx.scene.Node;
import shell.api.ServiceRegistry;
import shell.api.ShellBinding;
import shell.api.ShellControls;
import shell.api.ShellRuntimeContext;
import shell.api.ShellSlot;
import src.domain.sessionplanner.SessionPlannerApplicationService;
import src.domain.sessionplanner.SessionPlannerEncounterApplicationService;
import src.domain.sessionplanner.SessionPlannerLootApplicationService;
import src.domain.sessionplanner.SessionPlannerParticipantApplicationService;
import src.domain.sessionplanner.SessionPlannerRestApplicationService;
import src.domain.sessionplanner.published.SessionPlannerCatalogModel;
import src.domain.sessionplanner.published.SessionPlannerCurrentSessionModel;
import src.domain.sessionplanner.published.SessionPlannerSceneTimelineModel;
import src.domain.sessionplanner.published.SessionPlannerParticipantsModel;
import src.domain.sessionplanner.published.SessionPlannerStatePanelModel;
import src.view.slotcontent.controls.catalogcrud.CatalogCrudControlsContentModel;
import src.view.slotcontent.controls.catalogcrud.CatalogCrudControlsView;

final class SessionPlannerBinder {

    private final ShellRuntimeContext runtimeContext;

    SessionPlannerBinder(ShellRuntimeContext runtimeContext) {
        this.runtimeContext = Objects.requireNonNull(runtimeContext, "runtimeContext");
    }

    ShellBinding bind() {
        ServiceRegistry services = runtimeContext.services();
        SessionPlannerApplicationService planner =
                services.require(SessionPlannerApplicationService.class);
        SessionPlannerParticipantApplicationService participants =
                services.require(SessionPlannerParticipantApplicationService.class);
        SessionPlannerEncounterApplicationService encounters =
                services.require(SessionPlannerEncounterApplicationService.class);
        SessionPlannerRestApplicationService rests =
                services.require(SessionPlannerRestApplicationService.class);
        SessionPlannerLootApplicationService loot =
                services.require(SessionPlannerLootApplicationService.class);
        SessionPlannerCurrentSessionModel sessionModel =
                services.require(SessionPlannerCurrentSessionModel.class);
        SessionPlannerCatalogModel catalogModel =
                services.require(SessionPlannerCatalogModel.class);
        SessionPlannerParticipantsModel participantsModel =
                services.require(SessionPlannerParticipantsModel.class);
        SessionPlannerSceneTimelineModel sceneTimelineModel =
                services.require(SessionPlannerSceneTimelineModel.class);
        SessionPlannerStatePanelModel statePanelModel =
                services.require(SessionPlannerStatePanelModel.class);
        SessionPlannerViewModel viewModel = new SessionPlannerViewModel();
        CatalogCrudControlsContentModel catalogContentModel = viewModel.catalogContentModel();
        SessionPlannerIntentHandler intentHandler = new SessionPlannerIntentHandler(
                planner,
                participants,
                encounters,
                rests,
                loot,
                viewModel);
        SessionPlannerControlsView controlsView = new SessionPlannerControlsView();
        CatalogCrudControlsView catalogView = new CatalogCrudControlsView();
        SessionPlannerTimelineMainView timelineView = new SessionPlannerTimelineMainView();
        SessionPlannerStateView stateView = new SessionPlannerStateView();

        catalogView.bind(catalogContentModel);
        controlsView.bind(viewModel);
        timelineView.bind(viewModel);
        stateView.bind(viewModel);
        catalogView.onViewInputEvent(intentHandler::consume);
        controlsView.onAttachPlan(intentHandler::consumeAttachPlan);
        timelineView.onTimelineInput(intentHandler::consume);

        viewModel.bindReadback(
                sessionModel,
                catalogModel,
                participantsModel,
                sceneTimelineModel,
                statePanelModel);
        return new Binding(ShellControls.stack(catalogView, controlsView), timelineView, stateView);
    }

    private record Binding(
            Node controls,
            Node main,
            Node state
    ) implements ShellBinding {

        @Override
        public String title() {
            return "Session Planner";
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
