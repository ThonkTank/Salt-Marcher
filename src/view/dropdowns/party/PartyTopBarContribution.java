package src.view.dropdowns.party;

import java.util.Objects;
import shell.api.ContributionKey;
import shell.api.ShellBinding;
import shell.api.ShellContribution;
import shell.api.ShellContributionSpec;
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

    private final PartyApplicationService partyService;
    private final PartySnapshotModel snapshotModel;
    private final AdventuringDaySummaryModel summaryModel;
    private final PartyMutationModel mutationModel;

    public PartyTopBarContribution(
            PartyApplicationService partyService,
            PartySnapshotModel snapshotModel,
            AdventuringDaySummaryModel summaryModel,
            PartyMutationModel mutationModel
    ) {
        this.partyService = Objects.requireNonNull(partyService, "partyService");
        this.snapshotModel = Objects.requireNonNull(snapshotModel, "snapshotModel");
        this.summaryModel = Objects.requireNonNull(summaryModel, "summaryModel");
        this.mutationModel = Objects.requireNonNull(mutationModel, "mutationModel");
    }

    @Override
    public ShellContributionSpec registrationSpec() {
        return new ShellTopBarSpec(new ContributionKey("party"), 20);
    }

    @Override
    public ShellBinding bind() {
        PartyTopBarViewModel viewModel = new PartyTopBarViewModel();
        DropdownPopupContentModel popupContentModel = new DropdownPopupContentModel();
        PartyRosterTopBarView rosterView = new PartyRosterTopBarView();
        PartyEditorTopBarView editorView = new PartyEditorTopBarView();
        PartyTopBarView panelView = new PartyTopBarView(rosterView, editorView);
        DropdownPopupView topBarView = new DropdownPopupView(panelView);
        topBarView.bind(popupContentModel);
        panelView.bind(viewModel);
        rosterView.bind(viewModel);
        editorView.bind(viewModel);
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
