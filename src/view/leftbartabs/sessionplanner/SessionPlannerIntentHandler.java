package src.view.leftbartabs.sessionplanner;

import java.math.BigDecimal;
import java.util.Map;
import java.util.Objects;
import java.util.function.Consumer;
import org.jspecify.annotations.Nullable;
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
import src.view.slotcontent.controls.catalogcrud.CatalogCrudControlsContentModel;
import src.view.slotcontent.controls.catalogcrud.CatalogCrudControlsViewInputEvent;

final class SessionPlannerIntentHandler {

    private static final BigDecimal ALLOCATION_STEP = BigDecimal.TEN;

    private final SessionPlannerApplicationService planner;
    private final SessionPlannerParticipantApplicationService participants;
    private final SessionPlannerEncounterApplicationService encounters;
    private final SessionPlannerRestApplicationService rests;
    private final SessionPlannerLootApplicationService loot;
    private final SessionPlannerControlsContentModel controlsContentModel;
    private final CatalogCrudControlsContentModel catalogContentModel;
    private final SessionPlannerTimelineMainContentModel timelineMainContentModel;
    private final Map<SessionPlannerTimelineMainContentModel.TimelineWidgetKind,
            Consumer<SessionPlannerTimelineMainViewInputEvent>> timelineActions;

    SessionPlannerIntentHandler(
            SessionPlannerApplicationService planner,
            SessionPlannerParticipantApplicationService participants,
            SessionPlannerEncounterApplicationService encounters,
            SessionPlannerRestApplicationService rests,
            SessionPlannerLootApplicationService loot,
            SessionPlannerControlsContentModel controlsContentModel,
            CatalogCrudControlsContentModel catalogContentModel,
            SessionPlannerTimelineMainContentModel timelineMainContentModel
    ) {
        this.planner = Objects.requireNonNull(planner, "planner");
        this.participants = Objects.requireNonNull(participants, "participants");
        this.encounters = Objects.requireNonNull(encounters, "encounters");
        this.rests = Objects.requireNonNull(rests, "rests");
        this.loot = Objects.requireNonNull(loot, "loot");
        this.controlsContentModel = Objects.requireNonNull(controlsContentModel, "controlsContentModel");
        this.catalogContentModel = Objects.requireNonNull(catalogContentModel, "catalogContentModel");
        this.timelineMainContentModel = Objects.requireNonNull(timelineMainContentModel, "timelineMainContentModel");
        this.timelineActions = timelineActions();
    }

    void consume(SessionPlannerControlsViewInputEvent event) {
        if (event == null || !controlsContentModel.hasCurrentSession()) {
            return;
        }
        if (hasPositiveId(event.planIdToAttach())) {
            attachEncounter(event.planIdToAttach());
        }
    }

    void consume(SessionPlannerTimelineMainViewInputEvent event) {
        if (event == null || !controlsContentModel.hasCurrentSession()) {
            return;
        }
        SessionPlannerTimelineMainContentModel.TimelineWidgetKind widgetKind =
                timelineMainContentModel.widgetKind(event.widgetToken());
        Consumer<SessionPlannerTimelineMainViewInputEvent> action = timelineActions.get(widgetKind);
        if (action != null) {
            action.accept(event);
        }
    }

    private Map<SessionPlannerTimelineMainContentModel.TimelineWidgetKind,
            Consumer<SessionPlannerTimelineMainViewInputEvent>> timelineActions() {
        return Map.ofEntries(
                Map.entry(SessionPlannerTimelineMainContentModel.TimelineWidgetKind.SCENE_SELECT,
                        this::selectTimelineScene),
                Map.entry(SessionPlannerTimelineMainContentModel.TimelineWidgetKind.ALLOCATION_DECREASE,
                        event -> adjustTimelineAllocation(event, ALLOCATION_STEP.negate())),
                Map.entry(SessionPlannerTimelineMainContentModel.TimelineWidgetKind.ALLOCATION_INCREASE,
                        event -> adjustTimelineAllocation(event, ALLOCATION_STEP)),
                Map.entry(SessionPlannerTimelineMainContentModel.TimelineWidgetKind.SCENE_MOVE_UP,
                        this::moveTimelineSceneUp),
                Map.entry(SessionPlannerTimelineMainContentModel.TimelineWidgetKind.SCENE_MOVE_DOWN,
                        this::moveTimelineSceneDown),
                Map.entry(SessionPlannerTimelineMainContentModel.TimelineWidgetKind.SCENE_REMOVE,
                        this::removeTimelineScene),
                Map.entry(SessionPlannerTimelineMainContentModel.TimelineWidgetKind.REST_SHORT,
                        event -> setTimelineRest(event, SessionPlannerRestKind.SHORT_REST)),
                Map.entry(SessionPlannerTimelineMainContentModel.TimelineWidgetKind.REST_LONG,
                        event -> setTimelineRest(event, SessionPlannerRestKind.LONG_REST)),
                Map.entry(SessionPlannerTimelineMainContentModel.TimelineWidgetKind.REST_CLEAR,
                        this::clearTimelineRest),
                Map.entry(SessionPlannerTimelineMainContentModel.TimelineWidgetKind.LOOT_ADD,
                        this::addTimelineLoot),
                Map.entry(SessionPlannerTimelineMainContentModel.TimelineWidgetKind.LOOT_REMOVE,
                        this::removeTimelineLoot),
                Map.entry(SessionPlannerTimelineMainContentModel.TimelineWidgetKind.SCENE_SAVE,
                        this::saveTimelineScene),
                Map.entry(SessionPlannerTimelineMainContentModel.TimelineWidgetKind.SCENE_DRAFT,
                        this::updateTimelineSceneDraft),
                Map.entry(SessionPlannerTimelineMainContentModel.TimelineWidgetKind.PARTICIPANT_ADD,
                        this::addTimelineParticipant),
                Map.entry(SessionPlannerTimelineMainContentModel.TimelineWidgetKind.PARTICIPANT_REMOVE,
                        this::removeTimelineParticipant),
                Map.entry(SessionPlannerTimelineMainContentModel.TimelineWidgetKind.ENCOUNTER_DAYS,
                        this::applyTimelineEncounterDays),
                Map.entry(SessionPlannerTimelineMainContentModel.TimelineWidgetKind.SCENE_ADD,
                        ignored -> addScene()));
    }

    private void selectTimelineScene(SessionPlannerTimelineMainViewInputEvent event) {
        if (hasPositiveId(event.sceneToken())) {
            selectEncounter(event.sceneToken());
        }
    }

    private void adjustTimelineAllocation(SessionPlannerTimelineMainViewInputEvent event, BigDecimal delta) {
        if (hasPositiveId(event.sceneToken())) {
            setEncounterAllocation(
                    event.sceneToken(),
                    timelineMainContentModel.budgetPercentage(event.sceneToken()).add(delta));
        }
    }

    private void moveTimelineSceneUp(SessionPlannerTimelineMainViewInputEvent event) {
        if (hasPositiveId(event.sceneToken())) {
            moveEncounterUp(event.sceneToken());
        }
    }

    private void moveTimelineSceneDown(SessionPlannerTimelineMainViewInputEvent event) {
        if (hasPositiveId(event.sceneToken())) {
            moveEncounterDown(event.sceneToken());
        }
    }

    private void removeTimelineScene(SessionPlannerTimelineMainViewInputEvent event) {
        if (hasPositiveId(event.sceneToken())) {
            removeEncounter(event.sceneToken());
        }
    }

    private void setTimelineRest(SessionPlannerTimelineMainViewInputEvent event, SessionPlannerRestKind restKind) {
        if (isResolvedGap(event.leftSceneToken(), event.rightSceneToken())) {
            setRestGap(event.leftSceneToken(), event.rightSceneToken(), restKind);
        }
    }

    private void clearTimelineRest(SessionPlannerTimelineMainViewInputEvent event) {
        if (isResolvedGap(event.leftSceneToken(), event.rightSceneToken())) {
            clearRestGap(event.leftSceneToken(), event.rightSceneToken());
        }
    }

    private void addTimelineLoot(SessionPlannerTimelineMainViewInputEvent event) {
        if (hasPositiveId(event.sceneToken())) {
            addLootPlaceholder(event.sceneToken());
        }
    }

    private void removeTimelineLoot(SessionPlannerTimelineMainViewInputEvent event) {
        if (hasPositiveId(event.lootToken())) {
            removeLootPlaceholder(event.lootToken());
        }
    }

    private void saveTimelineScene(SessionPlannerTimelineMainViewInputEvent event) {
        if (hasPositiveId(event.sceneToken())) {
            updateEncounterScene(
                    event.sceneToken(),
                    event.sceneTitleText().trim(),
                    event.sceneNotesText().trim(),
                    event.locationId());
        }
    }

    private void updateTimelineSceneDraft(SessionPlannerTimelineMainViewInputEvent event) {
        if (hasPositiveId(event.sceneToken())) {
            timelineMainContentModel.updateSceneDraft(
                    event.sceneToken(),
                    event.sceneTitleText(),
                    event.sceneNotesText(),
                    event.locationId());
        }
    }

    private void addTimelineParticipant(SessionPlannerTimelineMainViewInputEvent event) {
        long participantToAddId = timelineMainContentModel.participantChoiceId(event.participantChoiceIndex());
        if (hasPositiveId(participantToAddId)) {
            addParticipant(participantToAddId);
        }
    }

    private void removeTimelineParticipant(SessionPlannerTimelineMainViewInputEvent event) {
        if (hasPositiveId(event.participantId())) {
            removeParticipant(event.participantId());
        }
    }

    private void applyTimelineEncounterDays(SessionPlannerTimelineMainViewInputEvent event) {
        BigDecimal encounterDays = parsePositiveDecimal(event.encounterDaysText());
        if (encounterDays != null) {
            setEncounterDays(encounterDays);
        }
    }

    private static boolean hasPositiveId(long id) {
        return id > 0L;
    }

    private static long parsePositiveLong(String raw) {
        try {
            return Math.max(0L, Long.parseLong(raw));
        } catch (NumberFormatException exception) {
            return 0L;
        }
    }

    private static boolean isResolvedGap(long leftSceneToken, long rightSceneToken) {
        return hasPositiveId(leftSceneToken) && hasPositiveId(rightSceneToken);
    }

    void consume(CatalogCrudControlsViewInputEvent event) {
        if (event == null) {
            return;
        }
        catalogContentModel.updateSelectorFilter(event.selectorFilterText());
        String stagedItemId = event.selectedItemId();
        String openItemId = event.openItemId();
        if (!stagedItemId.isBlank() || !openItemId.isBlank()) {
            String itemId = stagedItemId.isBlank() ? openItemId : stagedItemId;
            catalogContentModel.selectItem(itemId);
            if (!openItemId.isBlank()) {
                selectSession(parsePositiveLong(openItemId));
            }
            return;
        }
        consumeCatalogMutation(event);
    }

    private void consumeCatalogMutation(CatalogCrudControlsViewInputEvent event) {
        if (!event.createDraftName().isBlank()) {
            catalogContentModel.closeOperation();
            planner.createSession(new SessionPlannerCatalogCommand.CreateSessionCommand(event.createDraftName()));
        } else if (!event.renameItemId().isBlank() && !event.renameDraftName().isBlank()) {
            catalogContentModel.closeOperation();
            planner.renameSession(new SessionPlannerCatalogCommand.RenameSessionCommand(
                    parsePositiveLong(event.renameItemId()),
                    event.renameDraftName()));
        } else if (!event.deleteConfirmItemId().isBlank()) {
            catalogContentModel.closeOperation();
            planner.deleteSession(new SessionPlannerCatalogCommand.DeleteSessionCommand(parsePositiveLong(event.deleteConfirmItemId())));
        } else {
            consumeCatalogEditor(event);
        }
    }

    private void consumeCatalogEditor(CatalogCrudControlsViewInputEvent event) {
        if (event.createEditorOpened()) {
            catalogContentModel.openCreate();
        } else if (!event.renameEditorItemId().isBlank()) {
            catalogContentModel.openRename(event.renameEditorItemId());
        } else if (!event.deleteRequestItemId().isBlank()) {
            catalogContentModel.openDelete(event.deleteRequestItemId());
        } else if (event.dismissed()) {
            catalogContentModel.closeOperation();
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

    private static @Nullable BigDecimal parsePositiveDecimal(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            BigDecimal parsed = new BigDecimal(raw.trim().replace(',', '.'));
            return parsed.signum() <= 0 ? null : parsed;
        } catch (NumberFormatException exception) {
            return null;
        }
    }

}
