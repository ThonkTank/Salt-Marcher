package features.sessionplanner.adapter.javafx;

import java.math.BigDecimal;
import java.util.Map;
import java.util.Objects;
import javafx.scene.Node;
import shell.api.ShellBinding;
import shell.api.ShellControls;
import shell.api.ShellSlot;
import features.sessionplanner.api.SessionPlannerApi;
import features.sessionplanner.api.PrepareSessionCommand;
import features.sessionplanner.api.AddSessionManualLootNoteCommand;
import features.sessionplanner.api.AddSessionSceneCommand;
import features.sessionplanner.api.AttachSessionEncounterCommand;
import features.sessionplanner.api.ClearSessionRestGapCommand;
import features.sessionplanner.api.DetachSessionEncounterCommand;
import features.sessionplanner.api.RemoveSessionManualLootNoteCommand;
import features.sessionplanner.api.UpdateSessionManualLootNoteCommand;
import features.sessionplanner.api.UpdateSessionTreasureCommand;
import features.sessionplanner.api.RemoveSessionTreasureCommand;
import features.sessionplanner.api.AddSessionTreasureCommand;
import features.sessionplanner.api.SessionPlannerAuthoredTarget;
import features.sessionplanner.api.SearchSessionEncounterPlansCommand;
import features.sessionplanner.api.SessionPlannerCatalogCommand;
import features.sessionplanner.api.SessionPlannerEncounterAllocationCommand;
import features.sessionplanner.api.SessionPlannerEncounterCommand;
import features.sessionplanner.api.SessionPlannerParticipantCommand;
import features.sessionplanner.api.SessionPlannerRestKind;
import features.sessionplanner.api.SessionPlannerWorkspaceModel;
import features.sessionplanner.api.SessionPlannerWorkspaceSnapshot;
import features.sessionplanner.api.SessionPlannerRoutes;
import features.sessionplanner.api.SetSessionEncounterDaysCommand;
import features.sessionplanner.api.SetSessionRestGapCommand;
import features.sessionplanner.api.UpdateSessionEncounterSceneCommand;
import platform.ui.catalogcrud.CatalogCrudControlsContentModel;
import platform.ui.catalogcrud.CatalogCrudControlsView;
import platform.ui.catalogcrud.CatalogCrudControlsViewInputEvent;

/**
 * Verdrahtet die Session-Planner-Views direkt auf die planner-API. Keine Widget-Token-Indirektion
 * mehr: jede View gibt typisierte Callbacks frei, die hier auf den passenden {@code planner.*}-Command
 * abgebildet werden.
 */
final class SessionPlannerBinder {

    private final SessionPlannerApi planner;
    private final SessionPlannerWorkspaceModel workspace;
    private final java.util.function.Consumer<SessionPlannerWorkspaceApplyObservation> workspaceApplied;
    private SessionPlannerAuthoredTarget replacementConfirmationTarget;
    private final SessionPlannerRoutes routes;

    SessionPlannerBinder(
            SessionPlannerApi planner,
            SessionPlannerWorkspaceModel workspace,
            java.util.function.Consumer<SessionPlannerWorkspaceApplyObservation> workspaceApplied
    ) {
        this(planner, workspace, workspaceApplied, SessionPlannerRoutes.none());
    }

    SessionPlannerBinder(
            SessionPlannerApi planner,
            SessionPlannerWorkspaceModel workspace,
            java.util.function.Consumer<SessionPlannerWorkspaceApplyObservation> workspaceApplied,
            SessionPlannerRoutes routes
    ) {
        this.planner = Objects.requireNonNull(planner, "planner");
        this.workspace = Objects.requireNonNull(workspace, "workspace");
        this.workspaceApplied = Objects.requireNonNull(workspaceApplied, "workspaceApplied");
        this.routes = Objects.requireNonNull(routes, "routes");
    }

    ShellBinding bind() {
        SessionPlannerViewModel viewModel = new SessionPlannerViewModel();
        CatalogCrudControlsContentModel catalogContentModel = viewModel.catalogContentModel();
        SessionPlannerControlsView controlsView = new SessionPlannerControlsView();
        CatalogCrudControlsView catalogView = new CatalogCrudControlsView();
        SessionPlannerTimelineMainView timelineView = new SessionPlannerTimelineMainView();

        catalogView.bind(catalogContentModel);
        controlsView.bind(viewModel);
        timelineView.bind(viewModel);

        catalogView.onViewInputEvent(event -> consumeCatalog(planner, viewModel, timelineView, event));

        controlsView.onAddParticipant(characterId -> ifTarget(viewModel, target -> {
            if (characterId > 0L) {
                planner.addParticipant(SessionPlannerParticipantCommand.add(target, characterId));
            }
        }));
        controlsView.onRemoveParticipant(characterId -> ifTarget(viewModel, target -> {
            if (characterId > 0L) {
                planner.removeParticipant(SessionPlannerParticipantCommand.remove(target, characterId));
            }
        }));
        controlsView.onSetEncounterDays(text -> setEncounterDays(planner, viewModel, text));

        controlsView.onPrepare(request -> ifTarget(viewModel, currentTarget -> {
            SessionPlannerAuthoredTarget target = request.replacementConfirmed()
                    ? replacementConfirmationTarget : currentTarget;
            if (target == null) {
                return;
            }
            if (request.replacementConfirmed()) {
                replacementConfirmationTarget = null;
            } else {
                replacementConfirmationTarget = target;
            }
            planner.prepareSession(new PrepareSessionCommand(
                    target, request.encounterCount(), request.seed(), request.replacementConfirmed()));
        }));
        controlsView.onCancel(() -> {
            replacementConfirmationTarget = null;
            planner.cancelPreparation();
        });

        timelineView.onAddScene(() -> ifTarget(viewModel, target ->
                planner.addScene(new AddSessionSceneCommand(target))));
        timelineView.onSelectScene(sceneToken -> ifTarget(viewModel, target -> {
            if (sceneToken > 0L) {
                planner.selectEncounter(SessionPlannerEncounterCommand.select(target, sceneToken));
            }
        }));
        timelineView.onSetAllocation((sceneToken, percentage) -> ifTarget(viewModel, target -> {
            if (sceneToken > 0L) {
                planner.setEncounterAllocation(new SessionPlannerEncounterAllocationCommand(
                        target, sceneToken, percentage));
            }
        }));
        timelineView.onMoveScene((sceneToken, up) -> ifTarget(viewModel, target -> {
            if (sceneToken > 0L) {
                if (up) {
                    planner.moveEncounterUp(SessionPlannerEncounterCommand.moveUp(target, sceneToken));
                } else {
                    planner.moveEncounterDown(SessionPlannerEncounterCommand.moveDown(target, sceneToken));
                }
            }
        }));
        timelineView.onRemoveScene(sceneToken -> ifTarget(viewModel, target -> {
            if (sceneToken > 0L) {
                planner.removeEncounter(SessionPlannerEncounterCommand.remove(target, sceneToken));
            }
        }));
        timelineView.onSaveScene(draft -> ifSession(viewModel, () -> {
            if (draft.sceneToken() > 0L) {
                planner.updateEncounterScene(new UpdateSessionEncounterSceneCommand(
                        target(draft.sessionId(), draft.expectedRevision()),
                        draft.sceneToken(), draft.title(), draft.notes(), draft.locationId()));
            }
        }));
        timelineView.onShortRest((left, right) -> ifTarget(viewModel, target ->
                setRest(planner, target, left, right, SessionPlannerRestKind.SHORT_REST)));
        timelineView.onLongRest((left, right) -> ifTarget(viewModel, target ->
                setRest(planner, target, left, right, SessionPlannerRestKind.LONG_REST)));
        timelineView.onClearRest((left, right) -> ifTarget(viewModel, target -> {
            if (left > 0L && right > 0L) {
                planner.clearRestGap(new ClearSessionRestGapCommand(target, left, right));
            }
        }));
        timelineView.onAddLoot(draft -> ifSession(viewModel, () -> {
            if (draft.sceneToken() > 0L) {
                planner.addManualLootNote(new AddSessionManualLootNoteCommand(
                        target(draft.sessionId(), draft.expectedRevision()),
                        draft.sceneToken(), draft.authoredText()));
            }
        }));
        timelineView.onUpdateLoot(draft -> ifSession(viewModel, () -> {
            if (draft.noteId() > 0L) {
                planner.updateManualLootNote(new UpdateSessionManualLootNoteCommand(
                        target(draft.sessionId(), draft.expectedRevision()),
                        draft.sceneToken(), draft.noteId(), draft.authoredText()));
            }
        }));
        timelineView.onRemoveLoot(draft -> ifSession(viewModel, () -> {
            if (draft.noteId() > 0L) {
                planner.removeManualLootNote(new RemoveSessionManualLootNoteCommand(
                        target(draft.sessionId(), draft.expectedRevision()),
                        draft.sceneToken(), draft.noteId()));
            }
        }));
        timelineView.onAttachPlan((sceneToken, planId) -> ifTarget(viewModel, target -> {
            if (sceneToken > 0L && planId > 0L) {
                planner.attachEncounter(new AttachSessionEncounterCommand(target, sceneToken, planId));
            }
        }));
        timelineView.onDetachPlan(sceneToken -> ifTarget(viewModel, target -> {
            if (sceneToken > 0L) {
                planner.detachEncounter(new DetachSessionEncounterCommand(target, sceneToken));
            }
        }));
        timelineView.onSearchPlans((sceneToken, query) -> ifSession(viewModel, () -> {
            if (sceneToken > 0L) {
                planner.searchEncounterPlans(new SearchSessionEncounterPlansCommand(sceneToken, query));
            }
        }));
        timelineView.onEditEncounter(routes::editEncounter);
        timelineView.onInspectCreature(routes::inspectCreature);
        timelineView.onInspectItem(routes::inspectItem);
        timelineView.onInspectLocation(routes::inspectLocation);
        timelineView.onSearchItems(routes::searchItems);
        timelineView.onAddTreasure(sceneToken -> ifTarget(viewModel, target ->
                planner.addTreasure(new AddSessionTreasureCommand(target, sceneToken))));
        timelineView.onUpdateTreasure((sceneToken, treasure) -> ifTarget(viewModel, target ->
                planner.updateTreasure(new UpdateSessionTreasureCommand(
                        target, sceneToken, new UpdateSessionTreasureCommand.Treasure(
                                treasure.treasureId(), sceneToken, treasure.title(), treasure.note(),
                                treasure.stockClass(), treasure.channel(), treasure.theme(), treasure.magicType(),
                                treasure.targetCp(), treasure.nonMagicSlots(), treasure.magicSlots(),
                                treasure.itemLines().stream().map(item -> new UpdateSessionTreasureCommand.Item(
                                        item.lineId(), item.role(), item.itemId(), item.text(), item.quantity(),
                                        item.unitCp(), item.actualCp(), item.totalCapacity(), item.allowedContainers(),
                                        item.magicRarity(), item.cursed())).toList(),
                                treasure.packing().stream().map(row -> new UpdateSessionTreasureCommand.Packing(
                                        row.lineId(), row.containerType(), row.containerCount(), row.containerId(),
                                        row.valid())).toList())))));
        timelineView.onRemoveTreasure((sceneToken, treasureId) -> ifTarget(viewModel, target ->
                planner.removeTreasure(new RemoveSessionTreasureCommand(target, sceneToken, treasureId))));

        workspace.subscribe(snapshot -> {
            long startedNanos = System.nanoTime();
            viewModel.applyWorkspace(snapshot);
            workspaceApplied.accept(new SessionPlannerWorkspaceApplyObservation(
                    snapshot, Math.max(0L, System.nanoTime() - startedNanos),
                    timelineView.materializedUnitCount()));
        });
        SessionPlannerWorkspaceSnapshot initial = workspace.current();
        long initialApplyStartedNanos = System.nanoTime();
        viewModel.applyWorkspace(initial);
        workspaceApplied.accept(new SessionPlannerWorkspaceApplyObservation(
                initial, Math.max(0L, System.nanoTime() - initialApplyStartedNanos),
                timelineView.materializedUnitCount()));
        planner.initialize();
        return new Binding(ShellControls.stack(catalogView, controlsView), timelineView);
    }

    private static void ifSession(SessionPlannerViewModel viewModel, Runnable action) {
        if (viewModel.hasCurrentSession()) {
            action.run();
        }
    }

    private static void ifTarget(
            SessionPlannerViewModel viewModel,
            java.util.function.Consumer<SessionPlannerAuthoredTarget> action
    ) {
        if (viewModel.hasCurrentSession()) {
            action.accept(viewModel.currentTarget());
        }
    }

    private static void setRest(
            SessionPlannerApi planner,
            SessionPlannerAuthoredTarget target,
            long leftSceneToken,
            long rightSceneToken,
            SessionPlannerRestKind restKind
    ) {
        if (leftSceneToken > 0L && rightSceneToken > 0L) {
            planner.setRestGap(new SetSessionRestGapCommand(target, leftSceneToken, rightSceneToken, restKind));
        }
    }

    private static void setEncounterDays(
            SessionPlannerApi planner,
            SessionPlannerViewModel viewModel,
            String text
    ) {
        if (!viewModel.hasCurrentSession()) {
            return;
        }
        BigDecimal encounterDays = SessionPlannerVocabulary.parsePositiveDecimal(text);
        if (encounterDays != null) {
            planner.setEncounterDays(new SetSessionEncounterDaysCommand(viewModel.currentTarget(), encounterDays));
        }
    }

    private static void consumeCatalog(
            SessionPlannerApi planner,
            SessionPlannerViewModel viewModel,
            SessionPlannerTimelineMainView timelineView,
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
                        SessionPlannerVocabulary.parsePositiveLong(openItemId),
                        timelineView.pendingSceneEdit().map(SessionPlannerBinder::sceneCommand)));
            }
            return;
        }
        consumeCatalogMutation(planner, viewModel, event);
    }

    private static UpdateSessionEncounterSceneCommand sceneCommand(
            SessionPlannerTimelineMainView.SceneEditDraft draft
    ) {
        return new UpdateSessionEncounterSceneCommand(
                target(draft.sessionId(), draft.expectedRevision()), draft.sceneToken(),
                draft.title(), draft.notes(), draft.locationId());
    }

    private static SessionPlannerAuthoredTarget target(long sessionId, long revision) {
        return new SessionPlannerAuthoredTarget(sessionId, revision);
    }

    private static void consumeCatalogMutation(
            SessionPlannerApi planner,
            SessionPlannerViewModel viewModel,
            CatalogCrudControlsViewInputEvent event
    ) {
        if (!event.createDraftName().isBlank()) {
            viewModel.closeCatalogOperation();
            planner.createSession(new SessionPlannerCatalogCommand.CreateSessionCommand(event.createDraftName()));
        } else if (!event.renameItemId().isBlank() && !event.renameDraftName().isBlank()) {
            viewModel.closeCatalogOperation();
            viewModel.catalogTarget(event.renameItemId()).ifPresent(target -> planner.renameSession(
                    new SessionPlannerCatalogCommand.RenameSessionCommand(target, event.renameDraftName())));
        } else if (!event.deleteConfirmItemId().isBlank()) {
            viewModel.closeCatalogOperation();
            viewModel.catalogTarget(event.deleteConfirmItemId()).ifPresent(target -> planner.deleteSession(
                    new SessionPlannerCatalogCommand.DeleteSessionCommand(target)));
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

    private record Binding(
            Node controls,
            Node main
    ) implements ShellBinding {

        @Override
        public String title() {
            return "Session Planner";
        }

        @Override
        public Map<ShellSlot, Node> slotContent() {
            return Map.of(
                    ShellSlot.COCKPIT_CONTROLS, controls,
                    ShellSlot.COCKPIT_MAIN, main);
        }
    }
}
