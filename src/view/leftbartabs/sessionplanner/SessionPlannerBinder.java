package src.view.leftbartabs.sessionplanner;

import java.math.BigDecimal;
import java.util.Map;
import java.util.Objects;
import java.util.function.Consumer;
import javafx.scene.Node;
import shell.api.ShellBinding;
import shell.api.ShellControls;
import shell.api.ShellSlot;
import src.domain.sessionplanner.SessionPlannerApplicationService;
import src.domain.sessionplanner.published.AddSessionLootPlaceholderCommand;
import src.domain.sessionplanner.published.AddSessionSceneCommand;
import src.domain.sessionplanner.published.ApplyGeneratedSessionEncounterLootCommand;
import src.domain.sessionplanner.published.AttachSessionEncounterCommand;
import src.domain.sessionplanner.published.ClearSessionRestGapCommand;
import src.domain.sessionplanner.published.RemoveSessionLootPlaceholderCommand;
import src.domain.sessionplanner.published.SessionPlannerCatalogCommand;
import src.domain.sessionplanner.published.SessionPlannerCurrentSessionModel;
import src.domain.sessionplanner.published.GenerateSessionEncounterLootCommand;
import src.domain.sessionplanner.published.SessionPlannerGenerationModel;
import src.domain.sessionplanner.published.SessionPlannerCatalogModel;
import src.domain.sessionplanner.published.SessionPlannerEncounterAllocationCommand;
import src.domain.sessionplanner.published.SessionPlannerEncounterCommand;
import src.domain.sessionplanner.published.SessionPlannerParticipantCommand;
import src.domain.sessionplanner.published.SessionPlannerParticipantsModel;
import src.domain.sessionplanner.published.SessionPlannerRestKind;
import src.domain.sessionplanner.published.SessionPlannerSceneTimelineModel;
import src.domain.sessionplanner.published.SessionPlannerStatePanelModel;
import src.domain.sessionplanner.published.SetSessionEncounterDaysCommand;
import src.domain.sessionplanner.published.SetSessionRestGapCommand;
import src.domain.sessionplanner.published.UpdateSessionEncounterSceneCommand;
import src.view.slotcontent.controls.catalogcrud.CatalogCrudControlsContentModel;
import src.view.slotcontent.controls.catalogcrud.CatalogCrudControlsView;
import src.view.slotcontent.controls.catalogcrud.CatalogCrudControlsViewInputEvent;

final class SessionPlannerBinder {

    private static final BigDecimal ALLOCATION_STEP = BigDecimal.TEN;

    private final SessionPlannerApplicationService planner;
    private final SessionPlannerCurrentSessionModel sessionModel;
    private final SessionPlannerCatalogModel catalogModel;
    private final SessionPlannerParticipantsModel participantsModel;
    private final SessionPlannerSceneTimelineModel sceneTimelineModel;
    private final SessionPlannerStatePanelModel statePanelModel;
    private final SessionPlannerGenerationModel generationModel;

    SessionPlannerBinder(
            SessionPlannerApplicationService planner,
            SessionPlannerCurrentSessionModel sessionModel,
            SessionPlannerCatalogModel catalogModel,
            SessionPlannerParticipantsModel participantsModel,
            SessionPlannerSceneTimelineModel sceneTimelineModel,
            SessionPlannerStatePanelModel statePanelModel,
            SessionPlannerGenerationModel generationModel
    ) {
        this.planner = Objects.requireNonNull(planner, "planner");
        this.sessionModel = Objects.requireNonNull(sessionModel, "sessionModel");
        this.catalogModel = Objects.requireNonNull(catalogModel, "catalogModel");
        this.participantsModel = Objects.requireNonNull(participantsModel, "participantsModel");
        this.sceneTimelineModel = Objects.requireNonNull(sceneTimelineModel, "sceneTimelineModel");
        this.statePanelModel = Objects.requireNonNull(statePanelModel, "statePanelModel");
        this.generationModel = Objects.requireNonNull(generationModel, "generationModel");
    }

    ShellBinding bind() {
        SessionPlannerViewModel viewModel = new SessionPlannerViewModel();
        CatalogCrudControlsContentModel catalogContentModel = viewModel.catalogContentModel();
        SessionPlannerControlsView controlsView = new SessionPlannerControlsView();
        CatalogCrudControlsView catalogView = new CatalogCrudControlsView();
        SessionPlannerTimelineMainView timelineView = new SessionPlannerTimelineMainView();
        SessionPlannerStateView stateView = new SessionPlannerStateView();

        catalogView.bind(catalogContentModel);
        controlsView.bind(viewModel);
        timelineView.bind(viewModel);
        timelineView.bindGeneration(generationModel);
        stateView.bind(viewModel);
        catalogView.onViewInputEvent(event -> consumeCatalog(planner, viewModel, event));
        controlsView.onAttachPlan(planId -> consumeAttachPlan(planner, viewModel, planId));
        Map<SessionPlannerViewModel.TimelineWidgetKind, Consumer<SessionPlannerViewModel.TimelineInput>>
                timelineActions = timelineActions(planner, viewModel);
        timelineView.onTimelineInput(event -> consumeTimeline(viewModel, timelineActions, event));
        timelineView.onGenerationInput(event -> consumeGeneration(planner, viewModel, event));

        viewModel.bindReadback(
                sessionModel,
                catalogModel,
                participantsModel,
                sceneTimelineModel,
                statePanelModel);
        return new Binding(ShellControls.stack(catalogView, controlsView), timelineView, stateView);
    }

    private static void consumeGeneration(
            SessionPlannerApplicationService planner,
            SessionPlannerViewModel viewModel,
            SessionPlannerTimelineMainView.GenerationInput event
    ) {
        if (event == null || !viewModel.hasCurrentSession()) return;
        if (event.action() == SessionPlannerTimelineMainView.GenerationAction.APPLY) {
            if (event.generationId() > 0L) {
                planner.applyGeneratedEncounterLoot(new ApplyGeneratedSessionEncounterLootCommand(event.generationId()));
            }
            return;
        }
        Integer encounterCount = SessionPlannerVocabulary.parseOptionalEncounterCount(event.encounterCountText());
        Long seed = SessionPlannerVocabulary.parseNonNegativeLong(event.seedText());
        if (seed != null) {
            planner.generateEncounterLoot(new GenerateSessionEncounterLootCommand(encounterCount, seed));
        }
    }

    private static void consumeAttachPlan(
            SessionPlannerApplicationService planner,
            SessionPlannerViewModel viewModel,
            long planId
    ) {
        if (viewModel.hasCurrentSession() && hasPositiveId(planId)) {
            planner.attachEncounter(new AttachSessionEncounterCommand(planId));
        }
    }

    private static void consumeTimeline(
            SessionPlannerViewModel viewModel,
            Map<SessionPlannerViewModel.TimelineWidgetKind, Consumer<SessionPlannerViewModel.TimelineInput>> actions,
            SessionPlannerViewModel.TimelineInput event
    ) {
        if (event == null || !viewModel.hasCurrentSession()) {
            return;
        }
        Consumer<SessionPlannerViewModel.TimelineInput> action = actions.get(viewModel.widgetKind(event.widgetToken()));
        if (action != null) {
            action.accept(event);
        }
    }

    private static Map<SessionPlannerViewModel.TimelineWidgetKind, Consumer<SessionPlannerViewModel.TimelineInput>>
            timelineActions(SessionPlannerApplicationService planner, SessionPlannerViewModel viewModel) {
        return Map.ofEntries(
                Map.entry(SessionPlannerViewModel.TimelineWidgetKind.SCENE_SELECT,
                        event -> selectTimelineScene(planner, event)),
                Map.entry(SessionPlannerViewModel.TimelineWidgetKind.ALLOCATION_DECREASE,
                        event -> adjustTimelineAllocation(planner, viewModel, event, ALLOCATION_STEP.negate())),
                Map.entry(SessionPlannerViewModel.TimelineWidgetKind.ALLOCATION_INCREASE,
                        event -> adjustTimelineAllocation(planner, viewModel, event, ALLOCATION_STEP)),
                Map.entry(SessionPlannerViewModel.TimelineWidgetKind.SCENE_MOVE_UP,
                        event -> moveTimelineSceneUp(planner, event)),
                Map.entry(SessionPlannerViewModel.TimelineWidgetKind.SCENE_MOVE_DOWN,
                        event -> moveTimelineSceneDown(planner, event)),
                Map.entry(SessionPlannerViewModel.TimelineWidgetKind.SCENE_REMOVE,
                        event -> removeTimelineScene(planner, event)),
                Map.entry(SessionPlannerViewModel.TimelineWidgetKind.REST_SHORT,
                        event -> setTimelineRest(planner, event, SessionPlannerRestKind.SHORT_REST)),
                Map.entry(SessionPlannerViewModel.TimelineWidgetKind.REST_LONG,
                        event -> setTimelineRest(planner, event, SessionPlannerRestKind.LONG_REST)),
                Map.entry(SessionPlannerViewModel.TimelineWidgetKind.REST_CLEAR,
                        event -> clearTimelineRest(planner, event)),
                Map.entry(SessionPlannerViewModel.TimelineWidgetKind.LOOT_ADD,
                        event -> addTimelineLoot(planner, event)),
                Map.entry(SessionPlannerViewModel.TimelineWidgetKind.LOOT_REMOVE,
                        event -> removeTimelineLoot(planner, event)),
                Map.entry(SessionPlannerViewModel.TimelineWidgetKind.SCENE_SAVE,
                        event -> saveTimelineScene(planner, event)),
                Map.entry(SessionPlannerViewModel.TimelineWidgetKind.SCENE_DRAFT,
                        event -> updateTimelineSceneDraft(viewModel, event)),
                Map.entry(SessionPlannerViewModel.TimelineWidgetKind.PARTICIPANT_ADD,
                        event -> addTimelineParticipant(planner, viewModel, event)),
                Map.entry(SessionPlannerViewModel.TimelineWidgetKind.PARTICIPANT_REMOVE,
                        event -> removeTimelineParticipant(planner, event)),
                Map.entry(SessionPlannerViewModel.TimelineWidgetKind.ENCOUNTER_DAYS,
                        event -> applyTimelineEncounterDays(planner, event)),
                Map.entry(SessionPlannerViewModel.TimelineWidgetKind.SCENE_ADD,
                        ignored -> planner.addScene(new AddSessionSceneCommand())));
    }

    private static void selectTimelineScene(
            SessionPlannerApplicationService planner,
            SessionPlannerViewModel.TimelineInput event
    ) {
        if (hasPositiveId(event.sceneToken())) {
            planner.selectEncounter(SessionPlannerEncounterCommand.select(event.sceneToken()));
        }
    }

    private static void adjustTimelineAllocation(
            SessionPlannerApplicationService planner,
            SessionPlannerViewModel viewModel,
            SessionPlannerViewModel.TimelineInput event,
            BigDecimal delta
    ) {
        if (hasPositiveId(event.sceneToken())) {
            planner.setEncounterAllocation(new SessionPlannerEncounterAllocationCommand(
                    event.sceneToken(),
                    viewModel.budgetPercentage(event.sceneToken()).add(delta)));
        }
    }

    private static void moveTimelineSceneUp(
            SessionPlannerApplicationService planner,
            SessionPlannerViewModel.TimelineInput event
    ) {
        if (hasPositiveId(event.sceneToken())) {
            planner.moveEncounterUp(SessionPlannerEncounterCommand.moveUp(event.sceneToken()));
        }
    }

    private static void moveTimelineSceneDown(
            SessionPlannerApplicationService planner,
            SessionPlannerViewModel.TimelineInput event
    ) {
        if (hasPositiveId(event.sceneToken())) {
            planner.moveEncounterDown(SessionPlannerEncounterCommand.moveDown(event.sceneToken()));
        }
    }

    private static void removeTimelineScene(
            SessionPlannerApplicationService planner,
            SessionPlannerViewModel.TimelineInput event
    ) {
        if (hasPositiveId(event.sceneToken())) {
            planner.removeEncounter(SessionPlannerEncounterCommand.remove(event.sceneToken()));
        }
    }

    private static void setTimelineRest(
            SessionPlannerApplicationService planner,
            SessionPlannerViewModel.TimelineInput event,
            SessionPlannerRestKind restKind
    ) {
        if (isResolvedGap(event.leftSceneToken(), event.rightSceneToken())) {
            planner.setRestGap(new SetSessionRestGapCommand(
                    event.leftSceneToken(),
                    event.rightSceneToken(),
                    restKind));
        }
    }

    private static void clearTimelineRest(
            SessionPlannerApplicationService planner,
            SessionPlannerViewModel.TimelineInput event
    ) {
        if (isResolvedGap(event.leftSceneToken(), event.rightSceneToken())) {
            planner.clearRestGap(new ClearSessionRestGapCommand(event.leftSceneToken(), event.rightSceneToken()));
        }
    }

    private static void addTimelineLoot(
            SessionPlannerApplicationService planner,
            SessionPlannerViewModel.TimelineInput event
    ) {
        if (hasPositiveId(event.sceneToken())) {
            planner.addLootPlaceholder(new AddSessionLootPlaceholderCommand(event.sceneToken()));
        }
    }

    private static void removeTimelineLoot(
            SessionPlannerApplicationService planner,
            SessionPlannerViewModel.TimelineInput event
    ) {
        if (hasPositiveId(event.lootToken())) {
            planner.removeLootPlaceholder(new RemoveSessionLootPlaceholderCommand(event.lootToken()));
        }
    }

    private static void saveTimelineScene(
            SessionPlannerApplicationService planner,
            SessionPlannerViewModel.TimelineInput event
    ) {
        if (hasPositiveId(event.sceneToken())) {
            planner.updateEncounterScene(new UpdateSessionEncounterSceneCommand(
                    event.sceneToken(),
                    event.sceneTitleText().trim(),
                    event.sceneNotesText().trim(),
                    event.locationId()));
        }
    }

    private static void updateTimelineSceneDraft(
            SessionPlannerViewModel viewModel,
            SessionPlannerViewModel.TimelineInput event
    ) {
        if (hasPositiveId(event.sceneToken())) {
            viewModel.updateSceneDraft(
                    event.sceneToken(),
                    event.sceneTitleText(),
                    event.sceneNotesText(),
                    event.locationId());
        }
    }

    private static void addTimelineParticipant(
            SessionPlannerApplicationService planner,
            SessionPlannerViewModel viewModel,
            SessionPlannerViewModel.TimelineInput event
    ) {
        long participantToAddId = viewModel.participantChoiceId(event.participantChoiceIndex());
        if (hasPositiveId(participantToAddId)) {
            planner.addParticipant(SessionPlannerParticipantCommand.add(participantToAddId));
        }
    }

    private static void removeTimelineParticipant(
            SessionPlannerApplicationService planner,
            SessionPlannerViewModel.TimelineInput event
    ) {
        if (hasPositiveId(event.participantId())) {
            planner.removeParticipant(SessionPlannerParticipantCommand.remove(event.participantId()));
        }
    }

    private static void applyTimelineEncounterDays(
            SessionPlannerApplicationService planner,
            SessionPlannerViewModel.TimelineInput event
    ) {
        BigDecimal encounterDays = SessionPlannerVocabulary.parsePositiveDecimal(event.encounterDaysText());
        if (encounterDays != null) {
            planner.setEncounterDays(new SetSessionEncounterDaysCommand(encounterDays));
        }
    }

    private static void consumeCatalog(
            SessionPlannerApplicationService planner,
            SessionPlannerViewModel viewModel,
            CatalogCrudControlsViewInputEvent event
    ) {
        if (event == null) {
            return;
        }
        viewModel.updateSelectorFilter(event.selectorFilterText());
        String stagedItemId = event.selectedItemId();
        String openItemId = event.openItemId();
        if (!stagedItemId.isBlank() || !openItemId.isBlank()) {
            String itemId = stagedItemId.isBlank() ? openItemId : stagedItemId;
            viewModel.selectCatalogItem(itemId);
            if (!openItemId.isBlank()) {
                planner.selectSession(new SessionPlannerCatalogCommand.SelectSessionCommand(
                        SessionPlannerVocabulary.parsePositiveLong(openItemId)));
            }
            return;
        }
        consumeCatalogMutation(planner, viewModel, event);
    }

    private static void consumeCatalogMutation(
            SessionPlannerApplicationService planner,
            SessionPlannerViewModel viewModel,
            CatalogCrudControlsViewInputEvent event
    ) {
        if (!event.createDraftName().isBlank()) {
            viewModel.closeCatalogOperation();
            planner.createSession(new SessionPlannerCatalogCommand.CreateSessionCommand(event.createDraftName()));
        } else if (!event.renameItemId().isBlank() && !event.renameDraftName().isBlank()) {
            viewModel.closeCatalogOperation();
            planner.renameSession(new SessionPlannerCatalogCommand.RenameSessionCommand(
                    SessionPlannerVocabulary.parsePositiveLong(event.renameItemId()),
                    event.renameDraftName()));
        } else if (!event.deleteConfirmItemId().isBlank()) {
            viewModel.closeCatalogOperation();
            planner.deleteSession(new SessionPlannerCatalogCommand.DeleteSessionCommand(
                    SessionPlannerVocabulary.parsePositiveLong(event.deleteConfirmItemId())));
        } else {
            consumeCatalogEditor(viewModel, event);
        }
    }

    private static void consumeCatalogEditor(
            SessionPlannerViewModel viewModel,
            CatalogCrudControlsViewInputEvent event
    ) {
        if (event.createEditorOpened()) {
            viewModel.openCreate();
        } else if (!event.renameEditorItemId().isBlank()) {
            viewModel.openRename(event.renameEditorItemId());
        } else if (!event.deleteRequestItemId().isBlank()) {
            viewModel.openDelete(event.deleteRequestItemId());
        } else if (event.dismissed()) {
            viewModel.closeCatalogOperation();
        }
    }

    private static boolean hasPositiveId(long id) {
        return id > 0L;
    }

    private static boolean isResolvedGap(long leftSceneToken, long rightSceneToken) {
        return hasPositiveId(leftSceneToken) && hasPositiveId(rightSceneToken);
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
