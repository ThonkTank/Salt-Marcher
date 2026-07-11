package src.view.dropdowns.party;

import shell.api.ContributionKey;
import shell.api.ShellBinding;
import shell.api.ShellContribution;
import shell.api.ShellContributionSpec;
import shell.api.ShellRuntimeContext;
import shell.api.ShellTopBarSpec;
import src.domain.party.PartyApplicationService;
import src.domain.party.published.AdventuringDaySummaryModel;
import src.domain.party.published.MembershipState;
import src.domain.party.published.PartyMutationModel;
import src.domain.party.published.PartySnapshotModel;
import src.domain.party.published.RestType;
import src.view.slotcontent.topbar.dropdown.DropdownPopupContentModel;
import src.view.slotcontent.topbar.dropdown.DropdownPopupView;

public final class PartyTopBarContribution implements ShellContribution {

    @Override
    public ShellContributionSpec registrationSpec() {
        return new ShellTopBarSpec(new ContributionKey("party"), 20);
    }

    @Override
    public ShellBinding bind(ShellRuntimeContext runtimeContext) {
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
        topBarView.onViewInputEvent(event -> {
            if (event == null) {
                return;
            }
            if (event.popupHidden() || event.triggerInvoked() && popupContentModel.isOpen()) {
                popupContentModel.close();
            } else if (event.triggerInvoked()) {
                popupContentModel.open();
            }
        });
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
        editorView.onDraftChanged(viewModel::syncDraft);
        editorView.onCancelRequested(viewModel::cancelEditor);
        editorView.onSubmitRequested(() ->
                viewModel.prepareSubmit(editorView.currentDraft()).ifPresent(command -> command.dispatch(partyService)));
        editorView.onDeleteConfirmationRequested(viewModel::requestDeleteConfirmation);
        editorView.onDeleteConfirmationCancelled(viewModel::cancelDeleteConfirmation);
        editorView.onDeleteConfirmed(() ->
                viewModel.prepareDeleteConfirmed(editorView.currentDraft()).ifPresent(partyService::deleteCharacter));
        snapshotModel.subscribe(snapshot -> viewModel.applyLoadResult(panelData(snapshotModel, summaryModel)));
        summaryModel.subscribe(summary -> viewModel.applyLoadResult(panelData(snapshotModel, summaryModel)));
        mutationModel.subscribe(result ->
                viewModel.applyMutationResult(new PartyTopBarViewModel.MutationAndLoadResult(
                        result,
                        panelData(snapshotModel, summaryModel))));
        viewModel.applyLoadResult(panelData(snapshotModel, summaryModel));
        return ShellBinding.topBar("Party", topBarView);
    }

    private static PartyTopBarViewModel.PanelData panelData(
            PartySnapshotModel snapshotModel,
            AdventuringDaySummaryModel summaryModel
    ) {
        return new PartyTopBarViewModel.PanelData(snapshotModel.current(), summaryModel.current());
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

}
