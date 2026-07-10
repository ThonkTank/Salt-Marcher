package src.view.dropdowns.party;

import java.util.Map;
import java.util.Objects;
import javafx.scene.Node;
import shell.api.ShellBinding;
import shell.api.ShellRuntimeContext;
import shell.api.ShellSlot;
import src.domain.party.PartyApplicationService;
import src.domain.party.published.AdventuringDaySummaryModel;
import src.domain.party.published.CreateCharacterCommand;
import src.domain.party.published.MembershipState;
import src.domain.party.published.PartyMutationModel;
import src.domain.party.published.PartySnapshotModel;
import src.domain.party.published.RestType;
import src.domain.party.published.UpdateCharacterCommand;
import src.view.slotcontent.topbar.dropdown.DropdownPopupContentModel;
import src.view.slotcontent.topbar.dropdown.DropdownPopupView;
import src.view.slotcontent.topbar.dropdown.DropdownPopupViewInputEvent;

final class PartyTopBarBinder {

    private final ShellRuntimeContext runtimeContext;

    PartyTopBarBinder(ShellRuntimeContext runtimeContext) {
        this.runtimeContext = Objects.requireNonNull(runtimeContext, "runtimeContext");
    }

    ShellBinding bind() {
        PartyTopBarViewModel viewModel = new PartyTopBarViewModel();
        DropdownPopupContentModel popupContentModel = new DropdownPopupContentModel();
        PartyApplicationService partyService = runtimeContext.services().require(PartyApplicationService.class);
        PartyRosterTopBarView rosterView = new PartyRosterTopBarView();
        PartyEditorTopBarView editorView = new PartyEditorTopBarView();
        PartyTopBarView panelView = new PartyTopBarView(rosterView, editorView);
        DropdownPopupView topBarView = new DropdownPopupView(panelView);
        topBarView.bind(popupContentModel);
        panelView.bind(viewModel);
        rosterView.bind(viewModel);
        editorView.bind(viewModel);
        PartySnapshotModel snapshotModel = runtimeContext.services().require(PartySnapshotModel.class);
        AdventuringDaySummaryModel summaryModel = runtimeContext.services().require(AdventuringDaySummaryModel.class);
        PartyMutationModel mutationModel = runtimeContext.services().require(PartyMutationModel.class);
        applyPopupPresentation(popupContentModel, viewModel.triggerTextProperty().get());
        viewModel.triggerTextProperty().addListener((ignored, before, after) ->
                applyPopupPresentation(popupContentModel, after));
        panelView.onCloseRequested(popupContentModel::close);
        topBarView.onViewInputEvent(event -> handleDropdownEvent(popupContentModel, event));
        installRosterCallbacks(rosterView, viewModel, partyService);
        installEditorCallbacks(editorView, viewModel, partyService);
        snapshotModel.subscribe(snapshot ->
                viewModel.applyLoadResult(new PartyTopBarViewModel.PanelData(
                        snapshot,
                        summaryModel.current())));
        summaryModel.subscribe(summary ->
                viewModel.applyLoadResult(new PartyTopBarViewModel.PanelData(
                        snapshotModel.current(),
                        summary)));
        mutationModel.subscribe(result ->
                viewModel.applyMutationResult(new PartyTopBarViewModel.MutationAndLoadResult(
                        result,
                        new PartyTopBarViewModel.PanelData(
                                snapshotModel.current(),
                                summaryModel.current()))));
        viewModel.applyLoadResult(new PartyTopBarViewModel.PanelData(
                snapshotModel.current(),
                summaryModel.current()));
        return new Binding(topBarView);
    }

    private static void installRosterCallbacks(
            PartyRosterTopBarView rosterView,
            PartyTopBarViewModel viewModel,
            PartyApplicationService partyService
    ) {
        rosterView.onReserveSearchChanged(viewModel::showReserveSearch);
        rosterView.onCreateEditorRequested(viewModel::openCreateEditor);
        rosterView.onEditEditorRequested(memberId -> {
            if (!viewModel.openEditEditor(memberId)) {
                viewModel.rejectMissingCharacter();
            }
        });
        rosterView.onAddExistingRequested(memberId ->
                viewModel.prepareMembership(memberId, MembershipState.ACTIVE).ifPresent(partyService::setMembership));
        rosterView.onRemoveRequested(memberId ->
                viewModel.prepareMembership(memberId, MembershipState.RESERVE).ifPresent(partyService::setMembership));
        rosterView.onXpRequested((memberId, xpDelta) ->
                viewModel.prepareXp(memberId, xpDelta).ifPresent(partyService::adjustXp));
        rosterView.onShortRestRequested(() ->
                viewModel.prepareRest(RestType.SHORT_REST).ifPresent(partyService::performRest));
        rosterView.onLongRestRequested(() ->
                viewModel.prepareRest(RestType.LONG_REST).ifPresent(partyService::performRest));
    }

    private static void installEditorCallbacks(
            PartyEditorTopBarView editorView,
            PartyTopBarViewModel viewModel,
            PartyApplicationService partyService
    ) {
        editorView.onDraftChanged(viewModel::syncDraft);
        editorView.onCancelRequested(viewModel::cancelEditor);
        editorView.onSubmitRequested(() ->
                viewModel.prepareSubmit(editorView.currentDraft()).ifPresent(command ->
                        dispatchSubmit(partyService, command)));
        editorView.onDeleteConfirmationRequested(viewModel::requestDeleteConfirmation);
        editorView.onDeleteConfirmationCancelled(viewModel::cancelDeleteConfirmation);
        editorView.onDeleteConfirmed(() ->
                viewModel.prepareDeleteConfirmed(editorView.currentDraft()).ifPresent(partyService::deleteCharacter));
    }

    private static void dispatchSubmit(PartyApplicationService partyService, Object command) {
        if (command instanceof CreateCharacterCommand createCommand) {
            partyService.createCharacter(createCommand);
        } else if (command instanceof UpdateCharacterCommand updateCommand) {
            partyService.updateCharacter(updateCommand);
        }
    }

    private static void handleDropdownEvent(
            DropdownPopupContentModel popupContentModel,
            DropdownPopupViewInputEvent event
    ) {
        if (event == null) {
            return;
        }
        if (event.popupHidden()) {
            popupContentModel.close();
        } else if (event.triggerInvoked() && popupContentModel.isOpen()) {
            popupContentModel.close();
        } else if (event.triggerInvoked()) {
            popupContentModel.open();
        }
    }

    private static void applyPopupPresentation(
            DropdownPopupContentModel popupContentModel,
            String triggerText
    ) {
        String safeTriggerText = triggerText == null ? "" : triggerText;
        popupContentModel.showPresentation(new DropdownPopupContentModel.PopupPresentation(
                safeTriggerText,
                safeTriggerText.replace("_", ""),
                PartyTopBarView.OPEN_ACCESSIBLE_TEXT,
                PartyTopBarView.TOOLTIP_TEXT,
                true,
                PartyTopBarView.POPUP_WIDTH));
    }

    private record Binding(Node topBar) implements ShellBinding {

        @Override
        public String title() {
            return "Party";
        }

        @Override
        public Map<ShellSlot, Node> slotContent() {
            return Map.of(ShellSlot.TOP_BAR, topBar);
        }
    }
}
