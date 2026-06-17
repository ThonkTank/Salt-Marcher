package src.view.leftbartabs.sessionplanner;

import java.math.BigDecimal;
import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.sessionplanner.SessionPlannerApplicationService;
import src.domain.sessionplanner.SessionPlannerEncounterApplicationService;
import src.domain.sessionplanner.SessionPlannerLootApplicationService;
import src.domain.sessionplanner.SessionPlannerParticipantApplicationService;
import src.domain.sessionplanner.SessionPlannerRestApplicationService;
import src.domain.sessionplanner.published.AttachSessionEncounterCommand;
import src.domain.sessionplanner.published.ClearSessionRestGapCommand;
import src.domain.sessionplanner.published.RemoveSessionLootPlaceholderCommand;
import src.domain.sessionplanner.published.SessionPlannerActionCommand;
import src.domain.sessionplanner.published.SessionPlannerCatalogCommand;
import src.domain.sessionplanner.published.SessionPlannerEncounterAllocationCommand;
import src.domain.sessionplanner.published.SessionPlannerEncounterCommand;
import src.domain.sessionplanner.published.SessionPlannerParticipantCommand;
import src.domain.sessionplanner.published.SetSessionEncounterDaysCommand;
import src.domain.sessionplanner.published.SetSessionRestGapCommand;
import src.view.slotcontent.controls.catalogcrud.CatalogCrudControlsContentModel;
import src.view.slotcontent.controls.catalogcrud.CatalogCrudControlsViewInputEvent;

final class SessionPlannerIntentHandler {

    private static final String REST_NONE = "NONE";
    private static final String REST_SHORT = "SHORT_REST";
    private static final String REST_LONG = "LONG_REST";

    private final SessionPlannerApplicationService planner;
    private final SessionPlannerParticipantApplicationService participants;
    private final SessionPlannerEncounterApplicationService encounters;
    private final SessionPlannerRestApplicationService rests;
    private final SessionPlannerLootApplicationService loot;
    private final SessionPlannerControlsContentModel controlsContentModel;
    private final CatalogCrudControlsContentModel catalogContentModel;

    SessionPlannerIntentHandler(
            SessionPlannerApplicationService planner,
            SessionPlannerParticipantApplicationService participants,
            SessionPlannerEncounterApplicationService encounters,
            SessionPlannerRestApplicationService rests,
            SessionPlannerLootApplicationService loot,
            SessionPlannerControlsContentModel controlsContentModel,
            CatalogCrudControlsContentModel catalogContentModel
    ) {
        this.planner = Objects.requireNonNull(planner, "planner");
        this.participants = Objects.requireNonNull(participants, "participants");
        this.encounters = Objects.requireNonNull(encounters, "encounters");
        this.rests = Objects.requireNonNull(rests, "rests");
        this.loot = Objects.requireNonNull(loot, "loot");
        this.controlsContentModel = Objects.requireNonNull(controlsContentModel, "controlsContentModel");
        this.catalogContentModel = Objects.requireNonNull(catalogContentModel, "catalogContentModel");
    }

    void consume(SessionPlannerControlsViewInputEvent event) {
        if (event == null) {
            return;
        }
        if (!controlsContentModel.hasCurrentSession()) {
            return;
        }
        if (hasPositiveId(event.participantToAddId())) {
            addParticipant(event.participantToAddId());
        }
        if (hasPositiveId(event.participantToRemoveId())) {
            removeParticipant(event.participantToRemoveId());
        }
        BigDecimal encounterDays = parsePositiveDecimal(event.encounterDaysText());
        if (encounterDays != null) {
            setEncounterDays(encounterDays);
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
        consumeTimelineMutation(event);
        consumeTimelineRest(event);
        consumeTimelineLoot(event);
    }

    private void consumeTimelineSelection(SessionPlannerTimelineMainViewInputEvent event) {
        if (hasPositiveId(event.selectedEncounterToken())) {
            selectEncounter(event.selectedEncounterToken());
        }
        if (hasPositiveId(event.allocationEncounterToken())) {
            setEncounterAllocation(event.allocationEncounterToken(), event.targetAllocationPercentage());
        }
    }

    private void consumeTimelineMutation(SessionPlannerTimelineMainViewInputEvent event) {
        if (hasPositiveId(event.moveEncounterToken())) {
            applyMove(event.moveEncounterToken(), event.moveDirection());
        }
        if (hasPositiveId(event.encounterTokenToRemove())) {
            removeEncounter(event.encounterTokenToRemove());
        }
    }

    private void consumeTimelineRest(SessionPlannerTimelineMainViewInputEvent event) {
        if (isResolvedGap(event.restLeftEncounterId(), event.restRightEncounterId())) {
            applyRestGap(event.restLeftEncounterId(), event.restRightEncounterId(), event.restSelection());
        }
    }

    private void consumeTimelineLoot(SessionPlannerTimelineMainViewInputEvent event) {
        if (event.addLootPlaceholderRequested()) {
            addLootPlaceholder();
        }
        if (hasPositiveId(event.lootTokenToRemove())) {
            removeLootPlaceholder(event.lootTokenToRemove());
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

    private static boolean isResolvedGap(long leftEncounterId, long rightEncounterId) {
        return hasPositiveId(leftEncounterId) && hasPositiveId(rightEncounterId);
    }

    private void applyMove(long encounterToken, int moveDirection) {
        if (moveDirection > 0) {
            moveEncounterDown(encounterToken);
            return;
        }
        if (moveDirection < 0) {
            moveEncounterUp(encounterToken);
        }
    }

    private void applyRestGap(long leftEncounterId, long rightEncounterId, String restSelection) {
        String normalized = restSelection == null ? "" : restSelection.trim();
        if (REST_NONE.equals(normalized)) {
            clearRestGap(leftEncounterId, rightEncounterId);
        } else if (REST_SHORT.equals(normalized)) {
            setRestGap(leftEncounterId, rightEncounterId, REST_SHORT);
        } else if (REST_LONG.equals(normalized)) {
            setRestGap(leftEncounterId, rightEncounterId, REST_LONG);
        }
    }

    void consume(CatalogCrudControlsViewInputEvent event) {
        if (event == null) {
            return;
        }
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

    private void selectEncounter(long encounterToken) {
        encounters.selectEncounter(SessionPlannerEncounterCommand.select(encounterToken));
    }

    private void setEncounterAllocation(long encounterToken, BigDecimal targetAllocationPercentage) {
        encounters.setEncounterAllocation(new SessionPlannerEncounterAllocationCommand(
                encounterToken,
                targetAllocationPercentage));
    }

    private void moveEncounterUp(long encounterToken) {
        encounters.moveEncounterUp(SessionPlannerEncounterCommand.moveUp(encounterToken));
    }

    private void moveEncounterDown(long encounterToken) {
        encounters.moveEncounterDown(SessionPlannerEncounterCommand.moveDown(encounterToken));
    }

    private void removeEncounter(long encounterToken) {
        encounters.removeEncounter(SessionPlannerEncounterCommand.remove(encounterToken));
    }

    private void clearRestGap(long leftEncounterId, long rightEncounterId) {
        rests.clearRestGap(new ClearSessionRestGapCommand(leftEncounterId, rightEncounterId));
    }

    private void setRestGap(long leftEncounterId, long rightEncounterId, String restKind) {
        rests.setRestGap(SetSessionRestGapCommand.fromKey(leftEncounterId, rightEncounterId, restKind));
    }

    private void addLootPlaceholder() {
        loot.addLootPlaceholder(SessionPlannerActionCommand.addLootPlaceholder());
    }

    private void removeLootPlaceholder(long lootToken) {
        loot.removeLootPlaceholder(new RemoveSessionLootPlaceholderCommand(lootToken));
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
