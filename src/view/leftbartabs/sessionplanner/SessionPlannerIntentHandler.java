package src.view.leftbartabs.sessionplanner;

import java.math.BigDecimal;
import java.util.Map;
import java.util.Objects;
import java.util.function.Consumer;
import src.domain.sessionplanner.SessionPlannerApplicationService;
import src.domain.sessionplanner.SessionPlannerEncounterApplicationService;
import src.domain.sessionplanner.SessionPlannerLootApplicationService;
import src.domain.sessionplanner.SessionPlannerParticipantApplicationService;
import src.domain.sessionplanner.SessionPlannerRestApplicationService;
import src.domain.sessionplanner.published.AddSessionSceneCommand;
import src.domain.sessionplanner.published.AddSessionLootPlaceholderCommand;
import src.domain.sessionplanner.published.AttachSessionEncounterCommand;
import src.domain.sessionplanner.published.ClearSessionRestGapCommand;
import src.domain.sessionplanner.published.RemoveSessionLootPlaceholderCommand;
import src.domain.sessionplanner.published.SessionPlannerCatalogCommand;
import src.domain.sessionplanner.published.SessionPlannerEncounterAllocationCommand;
import src.domain.sessionplanner.published.SessionPlannerEncounterCommand;
import src.domain.sessionplanner.published.SessionPlannerParticipantCommand;
import src.domain.sessionplanner.published.SessionPlannerRestKind;
import src.domain.sessionplanner.published.SetSessionEncounterDaysCommand;
import src.domain.sessionplanner.published.SetSessionRestGapCommand;
import src.domain.sessionplanner.published.UpdateSessionEncounterSceneCommand;
import src.view.slotcontent.controls.catalogcrud.CatalogCrudControlsViewInputEvent;

final class SessionPlannerIntentHandler {

    private static final BigDecimal ALLOCATION_STEP = BigDecimal.TEN;

    private final SessionPlannerApplicationService planner;
    private final SessionPlannerParticipantApplicationService participants;
    private final SessionPlannerEncounterApplicationService encounters;
    private final SessionPlannerRestApplicationService rests;
    private final SessionPlannerLootApplicationService loot;
    private final SessionPlannerViewModel viewModel;
    private final Map<SessionPlannerViewModel.TimelineWidgetKind,
            Consumer<SessionPlannerViewModel.TimelineInput>> timelineActions;

    SessionPlannerIntentHandler(
            SessionPlannerApplicationService planner,
            SessionPlannerParticipantApplicationService participants,
            SessionPlannerEncounterApplicationService encounters,
            SessionPlannerRestApplicationService rests,
            SessionPlannerLootApplicationService loot,
            SessionPlannerViewModel viewModel
    ) {
        this.planner = Objects.requireNonNull(planner, "planner");
        this.participants = Objects.requireNonNull(participants, "participants");
        this.encounters = Objects.requireNonNull(encounters, "encounters");
        this.rests = Objects.requireNonNull(rests, "rests");
        this.loot = Objects.requireNonNull(loot, "loot");
        this.viewModel = Objects.requireNonNull(viewModel, "viewModel");
        this.timelineActions = timelineActions();
    }

    void consumeAttachPlan(long planId) {
        if (!viewModel.hasCurrentSession() || !hasPositiveId(planId)) {
            return;
        }
        attachEncounter(planId);
    }

    void consume(SessionPlannerViewModel.TimelineInput event) {
        if (event == null || !viewModel.hasCurrentSession()) {
            return;
        }
        SessionPlannerViewModel.TimelineWidgetKind widgetKind = viewModel.widgetKind(event.widgetToken());
        Consumer<SessionPlannerViewModel.TimelineInput> action = timelineActions.get(widgetKind);
        if (action != null) {
            action.accept(event);
        }
    }

    private Map<SessionPlannerViewModel.TimelineWidgetKind,
            Consumer<SessionPlannerViewModel.TimelineInput>> timelineActions() {
        return Map.ofEntries(
                Map.entry(SessionPlannerViewModel.TimelineWidgetKind.SCENE_SELECT,
                        this::selectTimelineScene),
                Map.entry(SessionPlannerViewModel.TimelineWidgetKind.ALLOCATION_DECREASE,
                        event -> adjustTimelineAllocation(event, ALLOCATION_STEP.negate())),
                Map.entry(SessionPlannerViewModel.TimelineWidgetKind.ALLOCATION_INCREASE,
                        event -> adjustTimelineAllocation(event, ALLOCATION_STEP)),
                Map.entry(SessionPlannerViewModel.TimelineWidgetKind.SCENE_MOVE_UP,
                        this::moveTimelineSceneUp),
                Map.entry(SessionPlannerViewModel.TimelineWidgetKind.SCENE_MOVE_DOWN,
                        this::moveTimelineSceneDown),
                Map.entry(SessionPlannerViewModel.TimelineWidgetKind.SCENE_REMOVE,
                        this::removeTimelineScene),
                Map.entry(SessionPlannerViewModel.TimelineWidgetKind.REST_SHORT,
                        event -> setTimelineRest(event, SessionPlannerRestKind.SHORT_REST)),
                Map.entry(SessionPlannerViewModel.TimelineWidgetKind.REST_LONG,
                        event -> setTimelineRest(event, SessionPlannerRestKind.LONG_REST)),
                Map.entry(SessionPlannerViewModel.TimelineWidgetKind.REST_CLEAR,
                        this::clearTimelineRest),
                Map.entry(SessionPlannerViewModel.TimelineWidgetKind.LOOT_ADD,
                        this::addTimelineLoot),
                Map.entry(SessionPlannerViewModel.TimelineWidgetKind.LOOT_REMOVE,
                        this::removeTimelineLoot),
                Map.entry(SessionPlannerViewModel.TimelineWidgetKind.SCENE_SAVE,
                        this::saveTimelineScene),
                Map.entry(SessionPlannerViewModel.TimelineWidgetKind.SCENE_DRAFT,
                        this::updateTimelineSceneDraft),
                Map.entry(SessionPlannerViewModel.TimelineWidgetKind.PARTICIPANT_ADD,
                        this::addTimelineParticipant),
                Map.entry(SessionPlannerViewModel.TimelineWidgetKind.PARTICIPANT_REMOVE,
                        this::removeTimelineParticipant),
                Map.entry(SessionPlannerViewModel.TimelineWidgetKind.ENCOUNTER_DAYS,
                        this::applyTimelineEncounterDays),
                Map.entry(SessionPlannerViewModel.TimelineWidgetKind.SCENE_ADD,
                        ignored -> addScene()));
    }

    private void selectTimelineScene(SessionPlannerViewModel.TimelineInput event) {
        if (hasPositiveId(event.sceneToken())) {
            selectEncounter(event.sceneToken());
        }
    }

    private void adjustTimelineAllocation(SessionPlannerViewModel.TimelineInput event, BigDecimal delta) {
        if (hasPositiveId(event.sceneToken())) {
            setEncounterAllocation(
                    event.sceneToken(),
                    viewModel.budgetPercentage(event.sceneToken()).add(delta));
        }
    }

    private void moveTimelineSceneUp(SessionPlannerViewModel.TimelineInput event) {
        if (hasPositiveId(event.sceneToken())) {
            moveEncounterUp(event.sceneToken());
        }
    }

    private void moveTimelineSceneDown(SessionPlannerViewModel.TimelineInput event) {
        if (hasPositiveId(event.sceneToken())) {
            moveEncounterDown(event.sceneToken());
        }
    }

    private void removeTimelineScene(SessionPlannerViewModel.TimelineInput event) {
        if (hasPositiveId(event.sceneToken())) {
            removeEncounter(event.sceneToken());
        }
    }

    private void setTimelineRest(SessionPlannerViewModel.TimelineInput event, SessionPlannerRestKind restKind) {
        if (isResolvedGap(event.leftSceneToken(), event.rightSceneToken())) {
            setRestGap(event.leftSceneToken(), event.rightSceneToken(), restKind);
        }
    }

    private void clearTimelineRest(SessionPlannerViewModel.TimelineInput event) {
        if (isResolvedGap(event.leftSceneToken(), event.rightSceneToken())) {
            clearRestGap(event.leftSceneToken(), event.rightSceneToken());
        }
    }

    private void addTimelineLoot(SessionPlannerViewModel.TimelineInput event) {
        if (hasPositiveId(event.sceneToken())) {
            addLootPlaceholder(event.sceneToken());
        }
    }

    private void removeTimelineLoot(SessionPlannerViewModel.TimelineInput event) {
        if (hasPositiveId(event.lootToken())) {
            removeLootPlaceholder(event.lootToken());
        }
    }

    private void saveTimelineScene(SessionPlannerViewModel.TimelineInput event) {
        if (hasPositiveId(event.sceneToken())) {
            updateEncounterScene(
                    event.sceneToken(),
                    event.sceneTitleText().trim(),
                    event.sceneNotesText().trim(),
                    event.locationId());
        }
    }

    private void updateTimelineSceneDraft(SessionPlannerViewModel.TimelineInput event) {
        if (hasPositiveId(event.sceneToken())) {
            viewModel.updateSceneDraft(
                    event.sceneToken(),
                    event.sceneTitleText(),
                    event.sceneNotesText(),
                    event.locationId());
        }
    }

    private void addTimelineParticipant(SessionPlannerViewModel.TimelineInput event) {
        long participantToAddId = viewModel.participantChoiceId(event.participantChoiceIndex());
        if (hasPositiveId(participantToAddId)) {
            addParticipant(participantToAddId);
        }
    }

    private void removeTimelineParticipant(SessionPlannerViewModel.TimelineInput event) {
        if (hasPositiveId(event.participantId())) {
            removeParticipant(event.participantId());
        }
    }

    private void applyTimelineEncounterDays(SessionPlannerViewModel.TimelineInput event) {
        BigDecimal encounterDays = SessionPlannerVocabulary.parsePositiveDecimal(event.encounterDaysText());
        if (encounterDays != null) {
            setEncounterDays(encounterDays);
        }
    }

    private static boolean hasPositiveId(long id) {
        return id > 0L;
    }

    private static boolean isResolvedGap(long leftSceneToken, long rightSceneToken) {
        return hasPositiveId(leftSceneToken) && hasPositiveId(rightSceneToken);
    }

    void consume(CatalogCrudControlsViewInputEvent event) {
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
                selectSession(SessionPlannerVocabulary.parsePositiveLong(openItemId));
            }
            return;
        }
        consumeCatalogMutation(event);
    }

    private void consumeCatalogMutation(CatalogCrudControlsViewInputEvent event) {
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
            consumeCatalogEditor(event);
        }
    }

    private void consumeCatalogEditor(CatalogCrudControlsViewInputEvent event) {
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

    private void selectSession(long sessionId) {
        planner.selectSession(new SessionPlannerCatalogCommand.SelectSessionCommand(sessionId));
    }

    private void addParticipant(long characterId) {
        participants.addParticipant(SessionPlannerParticipantCommand.add(characterId));
    }

    private void removeParticipant(long characterId) {
        participants.removeParticipant(SessionPlannerParticipantCommand.remove(characterId));
    }

    private void setEncounterDays(BigDecimal encounterDays) {
        encounters.setEncounterDays(new SetSessionEncounterDaysCommand(encounterDays));
    }

    private void attachEncounter(long planId) {
        encounters.attachEncounter(new AttachSessionEncounterCommand(planId));
    }

    private void addScene() {
        encounters.addScene(new AddSessionSceneCommand());
    }

    private void selectEncounter(long sceneToken) {
        encounters.selectEncounter(SessionPlannerEncounterCommand.select(sceneToken));
    }

    private void setEncounterAllocation(long sceneToken, BigDecimal targetAllocationPercentage) {
        encounters.setEncounterAllocation(new SessionPlannerEncounterAllocationCommand(
                sceneToken,
                targetAllocationPercentage));
    }

    private void moveEncounterUp(long sceneToken) {
        encounters.moveEncounterUp(SessionPlannerEncounterCommand.moveUp(sceneToken));
    }

    private void moveEncounterDown(long sceneToken) {
        encounters.moveEncounterDown(SessionPlannerEncounterCommand.moveDown(sceneToken));
    }

    private void removeEncounter(long sceneToken) {
        encounters.removeEncounter(SessionPlannerEncounterCommand.remove(sceneToken));
    }

    private void clearRestGap(long leftSceneToken, long rightSceneToken) {
        rests.clearRestGap(new ClearSessionRestGapCommand(leftSceneToken, rightSceneToken));
    }

    private void setRestGap(long leftSceneToken, long rightSceneToken, SessionPlannerRestKind restKind) {
        rests.setRestGap(new SetSessionRestGapCommand(leftSceneToken, rightSceneToken, restKind));
    }

    private void addLootPlaceholder(long sceneToken) {
        loot.addLootPlaceholder(new AddSessionLootPlaceholderCommand(sceneToken));
    }

    private void removeLootPlaceholder(long lootToken) {
        loot.removeLootPlaceholder(new RemoveSessionLootPlaceholderCommand(lootToken));
    }

    private void updateEncounterScene(long sceneToken, String sceneTitle, String sceneNotes, long locationId) {
        encounters.updateEncounterScene(new UpdateSessionEncounterSceneCommand(
                sceneToken,
                sceneTitle,
                sceneNotes,
                locationId));
    }

}
