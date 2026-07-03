package src.view.leftbartabs.sessionplanner;

import java.math.BigDecimal;
import java.util.Objects;
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

    private final SessionPlannerApplicationService planner;
    private final SessionPlannerParticipantApplicationService participants;
    private final SessionPlannerEncounterApplicationService encounters;
    private final SessionPlannerRestApplicationService rests;
    private final SessionPlannerLootApplicationService loot;
    private final SessionPlannerControlsContentModel controlsContentModel;
    private final CatalogCrudControlsContentModel catalogContentModel;
    private final SessionPlannerTimelineMainContentModel timelineMainContentModel;

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
        consumeTimelineSelection(event);
        consumeTimelineSetup(event);
        consumeTimelineMutation(event);
        consumeTimelineRest(event);
        consumeTimelineLoot(event);
        consumeTimelineSceneDraft(event);
        consumeTimelineScene(event);
    }

    private void consumeTimelineSelection(SessionPlannerTimelineMainViewInputEvent event) {
        SessionPlannerTimelineMainViewInputEvent.SelectionSnapshot selection = event.selection();
        if (hasPositiveId(selection.selectedSceneToken())) {
            selectEncounter(selection.selectedSceneToken());
        }
        if (hasPositiveId(selection.allocationSceneToken())) {
            setEncounterAllocation(selection.allocationSceneToken(), selection.targetAllocationPercentage());
        }
    }

    private void consumeTimelineSetup(SessionPlannerTimelineMainViewInputEvent event) {
        SessionPlannerTimelineMainViewInputEvent.SetupSnapshot setup = event.setup();
        long participantToAddId = timelineMainContentModel.participantChoiceId(setup.participantChoiceIndex());
        if (hasPositiveId(participantToAddId)) {
            addParticipant(participantToAddId);
        }
        if (hasPositiveId(setup.participantToRemoveId())) {
            removeParticipant(setup.participantToRemoveId());
        }
        BigDecimal encounterDays = parsePositiveDecimal(setup.encounterDaysText());
        if (encounterDays != null) {
            setEncounterDays(encounterDays);
        }
        if (setup.addSceneRequested()) {
            addScene();
        }
    }

    private void consumeTimelineMutation(SessionPlannerTimelineMainViewInputEvent event) {
        SessionPlannerTimelineMainViewInputEvent.MutationSnapshot mutation = event.mutation();
        if (hasPositiveId(mutation.moveSceneToken())) {
            applyMove(mutation.moveSceneToken(), mutation.moveDirection());
        }
        if (hasPositiveId(mutation.sceneTokenToRemove())) {
            removeEncounter(mutation.sceneTokenToRemove());
        }
    }

    private void consumeTimelineRest(SessionPlannerTimelineMainViewInputEvent event) {
        SessionPlannerTimelineMainViewInputEvent.RestSnapshot rest = event.rest();
        if (isResolvedGap(rest.leftSceneToken(), rest.rightSceneToken())) {
            applyRestGap(rest.leftSceneToken(), rest.rightSceneToken(), rest.selection());
        }
    }

    private void consumeTimelineLoot(SessionPlannerTimelineMainViewInputEvent event) {
        SessionPlannerTimelineMainViewInputEvent.LootSnapshot lootSnapshot = event.loot();
        if (hasPositiveId(lootSnapshot.sceneTokenToAdd())) {
            addLootPlaceholder(lootSnapshot.sceneTokenToAdd());
        }
        if (hasPositiveId(lootSnapshot.tokenToRemove())) {
            removeLootPlaceholder(lootSnapshot.tokenToRemove());
        }
    }

    private void consumeTimelineScene(SessionPlannerTimelineMainViewInputEvent event) {
        SessionPlannerTimelineMainViewInputEvent.SceneSnapshot scene = event.scene();
        if (hasPositiveId(scene.sceneToken())) {
            updateEncounterScene(
                    scene.sceneToken(),
                    scene.title(),
                    scene.notes(),
                    scene.locationId());
        }
    }

    private void consumeTimelineSceneDraft(SessionPlannerTimelineMainViewInputEvent event) {
        SessionPlannerTimelineMainViewInputEvent.SceneDraftSnapshot sceneDraft = event.sceneDraft();
        if (hasPositiveId(sceneDraft.sceneToken())) {
            timelineMainContentModel.updateSceneDraft(
                    sceneDraft.sceneToken(),
                    sceneDraft.title(),
                    sceneDraft.notes(),
                    sceneDraft.locationId());
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

    private void applyMove(long sceneToken, int moveDirection) {
        if (moveDirection > 0) {
            moveEncounterDown(sceneToken);
            return;
        }
        if (moveDirection < 0) {
            moveEncounterUp(sceneToken);
        }
    }

    private void applyRestGap(
            long leftSceneToken,
            long rightSceneToken,
            SessionPlannerTimelineMainViewInputEvent.RestSelection restSelection
    ) {
        switch (restSelection) {
            case NONE -> clearRestGap(leftSceneToken, rightSceneToken);
            case SHORT_REST -> setRestGap(leftSceneToken, rightSceneToken, SessionPlannerRestKind.SHORT_REST);
            case LONG_REST -> setRestGap(leftSceneToken, rightSceneToken, SessionPlannerRestKind.LONG_REST);
            default -> throw new IllegalStateException("Unhandled rest selection: " + restSelection);
        }
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
