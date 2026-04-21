package src.view.dropdowns.party;

import java.util.Map;
import java.util.Objects;
import javafx.scene.Node;
import shell.api.ShellBinding;
import shell.api.ShellRuntimeContext;
import shell.api.ShellSlot;
import src.domain.party.PartyApplicationService;

final class PartyTopBarBinder {

    private final ShellRuntimeContext runtimeContext;

    PartyTopBarBinder(ShellRuntimeContext runtimeContext) {
        this.runtimeContext = Objects.requireNonNull(runtimeContext, "runtimeContext");
    }

    ShellBinding bind() {
        PartyApplicationService party = runtimeContext.services().require(PartyApplicationService.class);
        PartyTopBarViewModel viewModel = new PartyTopBarViewModel(party);
        PartyTopBarView panel = new PartyTopBarView();
        panel.setTriggerText(viewModel.triggerTextProperty().get());
        panel.showPanel(toPanelContent(viewModel.panelProperty().get()));
        viewModel.triggerTextProperty().addListener((ignored, before, after) -> panel.setTriggerText(after));
        viewModel.panelProperty().addListener((ignored, before, after) -> panel.showPanel(toPanelContent(after)));
        panel.onOpen(viewModel::refresh);
        panel.onAddExisting(member -> viewModel.mockAddExisting(member.name()));
        panel.onRemoveFromParty(member -> viewModel.mockRemoveFromParty(member.name()));
        panel.onAwardXp(request -> viewModel.mockAwardXp(request.member().name(), request.rawXp()));
        panel.onShortRest(viewModel::mockShortRest);
        panel.onLongRest(viewModel::mockLongRest);
        panel.onCreateCharacter(draft -> viewModel.mockCreateCharacter(draft.name()));
        panel.onUpdateCharacter(draft -> viewModel.mockUpdateCharacter(draft.name()));
        panel.onDeleteCharacter(member -> viewModel.mockDeleteCharacter(member.name()));
        viewModel.refresh();
        return new Binding(panel);
    }

    private static PartyTopBarView.PanelContent toPanelContent(PartyTopBarViewModel.PanelModel model) {
        PartyTopBarViewModel.PanelModel safeModel = model == null
                ? PartyTopBarViewModel.PanelModel.loadingModel()
                : model;
        return new PartyTopBarView.PanelContent(
                safeModel.loading(),
                safeModel.storageError(),
                safeModel.storageMessage(),
                safeModel.activeMembers().stream().map(PartyTopBarBinder::toMemberView).toList(),
                safeModel.reserveMembers().stream().map(PartyTopBarBinder::toMemberView).toList(),
                safeModel.summaryText(),
                safeModel.restSummaryText(),
                safeModel.actionStatus(),
                safeModel.actionStatusError(),
                safeModel.restActionsDisabled());
    }

    private static PartyTopBarView.MemberView toMemberView(PartyTopBarViewModel.MemberModel member) {
        PartyTopBarViewModel.MemberModel safeMember = member == null
                ? new PartyTopBarViewModel.MemberModel(0L, "", "", 1, 0, 10, 10, "Lv 1", "", "", "", "")
                : member;
        return new PartyTopBarView.MemberView(
                safeMember.id(),
                safeMember.name(),
                safeMember.playerName(),
                safeMember.level(),
                safeMember.currentXp(),
                safeMember.passivePerception(),
                safeMember.armorClass(),
                safeMember.levelLabel(),
                safeMember.detailsText(),
                safeMember.progressionText(),
                safeMember.restText(),
                safeMember.restStyleClass());
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
