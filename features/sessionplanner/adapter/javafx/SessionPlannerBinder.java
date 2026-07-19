package features.sessionplanner.adapter.javafx;

import java.math.BigDecimal;
import java.util.Map;
import java.util.Objects;
import javafx.scene.Node;
import shell.api.ShellBinding;
import shell.api.ShellControls;
import shell.api.ShellSlot;
import features.sessionplanner.api.SessionPlannerApi;
import features.sessionplanner.api.AddSessionManualLootNoteCommand;
import features.sessionplanner.api.AddSessionSceneCommand;
import features.sessionplanner.api.AttachSessionEncounterCommand;
import features.sessionplanner.api.ClearSessionRestGapCommand;
import features.sessionplanner.api.RemoveSessionManualLootNoteCommand;
import features.sessionplanner.api.SessionPlannerCatalogCommand;
import features.sessionplanner.api.SessionPlannerEncounterAllocationCommand;
import features.sessionplanner.api.SessionPlannerEncounterCommand;
import features.sessionplanner.api.SessionPlannerParticipantCommand;
import features.sessionplanner.api.SessionPlannerRestKind;
import features.sessionplanner.api.SessionPlannerWorkspaceModel;
import features.sessionplanner.api.SessionPlannerWorkspaceSnapshot;
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
    private final java.util.function.LongConsumer workspaceApplied;

    SessionPlannerBinder(
            SessionPlannerApi planner,
            SessionPlannerWorkspaceModel workspace,
            java.util.function.LongConsumer workspaceApplied
    ) {
        this.planner = Objects.requireNonNull(planner, "planner");
        this.workspace = Objects.requireNonNull(workspace, "workspace");
        this.workspaceApplied = Objects.requireNonNull(workspaceApplied, "workspaceApplied");
    }

    ShellBinding bind() {
        SessionPlannerViewModel viewModel = new SessionPlannerViewModel();
        CatalogCrudControlsContentModel catalogContentModel = viewModel.catalogContentModel();
        SessionGenerationPanel generationPanel = new SessionGenerationPanel();
        SessionPlannerControlsView controlsView = new SessionPlannerControlsView(generationPanel);
        CatalogCrudControlsView catalogView = new CatalogCrudControlsView();
        SessionPlannerTimelineMainView timelineView = new SessionPlannerTimelineMainView();
        SessionPlannerSummaryView summaryView = new SessionPlannerSummaryView();

        catalogView.bind(catalogContentModel);
        controlsView.bind(viewModel);
        timelineView.bind(viewModel);
        summaryView.bind(viewModel);

        catalogView.onViewInputEvent(event -> consumeCatalog(planner, viewModel, event));

        controlsView.onAttachPlan(planId -> consumeAttachPlan(planner, viewModel, planId));
        controlsView.onAddParticipant(characterId -> ifSession(viewModel, () -> {
            if (characterId > 0L) {
                planner.addParticipant(SessionPlannerParticipantCommand.add(characterId));
            }
        }));
        controlsView.onRemoveParticipant(characterId -> ifSession(viewModel, () -> {
            if (characterId > 0L) {
                planner.removeParticipant(SessionPlannerParticipantCommand.remove(characterId));
            }
        }));
        controlsView.onSetEncounterDays(text -> setEncounterDays(planner, viewModel, text));

        generationPanel.onPrepare(planner::prepareSession);
        generationPanel.onCancel(planner::cancelPreparation);

        timelineView.onAddScene(() -> ifSession(viewModel, () -> planner.addScene(new AddSessionSceneCommand())));
        timelineView.onSelectScene(sceneToken -> ifSession(viewModel, () -> {
            if (sceneToken > 0L) {
                planner.selectEncounter(SessionPlannerEncounterCommand.select(sceneToken));
            }
        }));
        timelineView.onSetAllocation((sceneToken, percentage) -> ifSession(viewModel, () -> {
            if (sceneToken > 0L) {
                planner.setEncounterAllocation(new SessionPlannerEncounterAllocationCommand(sceneToken, percentage));
            }
        }));
        timelineView.onMoveScene((sceneToken, up) -> ifSession(viewModel, () -> {
            if (sceneToken > 0L) {
                if (up) {
                    planner.moveEncounterUp(SessionPlannerEncounterCommand.moveUp(sceneToken));
                } else {
                    planner.moveEncounterDown(SessionPlannerEncounterCommand.moveDown(sceneToken));
                }
            }
        }));
        timelineView.onRemoveScene(sceneToken -> ifSession(viewModel, () -> {
            if (sceneToken > 0L) {
                planner.removeEncounter(SessionPlannerEncounterCommand.remove(sceneToken));
            }
        }));
        timelineView.onSaveScene((sceneToken, title, notes, locationId) -> ifSession(viewModel, () -> {
            if (sceneToken > 0L) {
                planner.updateEncounterScene(new UpdateSessionEncounterSceneCommand(
                        sceneToken, title.trim(), notes.trim(), locationId));
            }
        }));
        timelineView.onShortRest((left, right) ->
                ifSession(viewModel, () -> setRest(planner, left, right, SessionPlannerRestKind.SHORT_REST)));
        timelineView.onLongRest((left, right) ->
                ifSession(viewModel, () -> setRest(planner, left, right, SessionPlannerRestKind.LONG_REST)));
        timelineView.onClearRest((left, right) -> ifSession(viewModel, () -> {
            if (left > 0L && right > 0L) {
                planner.clearRestGap(new ClearSessionRestGapCommand(left, right));
            }
        }));
        timelineView.onAddLoot(sceneToken -> ifSession(viewModel, () -> {
            if (sceneToken > 0L) {
                planner.addManualLootNote(new AddSessionManualLootNoteCommand(sceneToken));
            }
        }));
        timelineView.onRemoveLoot(lootToken -> ifSession(viewModel, () -> {
            if (lootToken > 0L) {
                planner.removeManualLootNote(new RemoveSessionManualLootNoteCommand(lootToken));
            }
        }));

        workspace.subscribe(snapshot -> {
            long startedNanos = System.nanoTime();
            viewModel.applyWorkspace(snapshot);
            generationPanel.show(snapshot.preparation());
            workspaceApplied.accept(Math.max(0L, System.nanoTime() - startedNanos));
        });
        SessionPlannerWorkspaceSnapshot initial = workspace.current();
        long initialApplyStartedNanos = System.nanoTime();
        viewModel.applyWorkspace(initial);
        generationPanel.show(initial.preparation());
        workspaceApplied.accept(Math.max(0L, System.nanoTime() - initialApplyStartedNanos));
        planner.initialize();
        return new Binding(ShellControls.stack(catalogView, controlsView), timelineView, summaryView);
    }

    private static void ifSession(SessionPlannerViewModel viewModel, Runnable action) {
        if (viewModel.hasCurrentSession()) {
            action.run();
        }
    }

    private static void setRest(
            SessionPlannerApi planner,
            long leftSceneToken,
            long rightSceneToken,
            SessionPlannerRestKind restKind
    ) {
        if (leftSceneToken > 0L && rightSceneToken > 0L) {
            planner.setRestGap(new SetSessionRestGapCommand(leftSceneToken, rightSceneToken, restKind));
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
            planner.setEncounterDays(new SetSessionEncounterDaysCommand(encounterDays));
        }
    }

    private static void consumeAttachPlan(
            SessionPlannerApi planner,
            SessionPlannerViewModel viewModel,
            long planId
    ) {
        if (viewModel.hasCurrentSession() && planId > 0L) {
            planner.attachEncounter(new AttachSessionEncounterCommand(planId));
        }
    }

    private static void consumeCatalog(
            SessionPlannerApi planner,
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
            SessionPlannerApi planner,
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
