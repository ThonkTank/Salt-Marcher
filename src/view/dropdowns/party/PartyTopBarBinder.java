package src.view.dropdowns.party;

import java.util.Map;
import java.util.Objects;
import javafx.scene.Node;
import shell.api.ShellBinding;
import shell.api.ShellRuntimeContext;
import shell.api.ShellSlot;
import src.domain.party.PartyApplicationService;
import src.view.slotcontent.state.encounter.EncounterRuntimeViewModel;

final class PartyTopBarBinder {

    private final ShellRuntimeContext runtimeContext;

    PartyTopBarBinder(ShellRuntimeContext runtimeContext) {
        this.runtimeContext = Objects.requireNonNull(runtimeContext, "runtimeContext");
    }

    ShellBinding bind() {
        PartyApplicationService party = runtimeContext.services().require(PartyApplicationService.class);
        EncounterRuntimeViewModel encounterSession = runtimeContext.session(
                EncounterRuntimeViewModel.class,
                EncounterRuntimeViewModel::new);
        PartyTopBarViewModel viewModel = new PartyTopBarViewModel(party);
        PartyTopBarView panel = new PartyTopBarView();
        panel.setTriggerText(viewModel.triggerTextProperty().get());
        panel.showPanel(toPanelContent(viewModel.panelProperty().get()));
        viewModel.triggerTextProperty().addListener((ignored, before, after) -> panel.setTriggerText(after));
        viewModel.panelProperty().addListener((ignored, before, after) -> panel.showPanel(toPanelContent(after)));
        viewModel.mutationTokenProperty().addListener((ignored, before, after) -> encounterSession.partyChanged());
        panel.onOpen(viewModel::refresh);
        panel.onAddExisting(member -> viewModel.addExisting(member.id(), member.name()));
        panel.onRemoveFromParty(member -> viewModel.removeFromParty(member.id(), member.name()));
        panel.onAdjustXp(request -> viewModel.adjustXp(
                request.member().id(),
                request.member().name(),
                request.xpDelta()));
        panel.onShortRest(viewModel::shortRest);
        panel.onLongRest(viewModel::longRest);
        panel.onCreateCharacter(draft -> toEditorResult(viewModel.createCharacter(toDraftModel(draft))));
        panel.onUpdateCharacter(draft -> toEditorResult(viewModel.updateCharacter(toDraftModel(draft))));
        panel.onDeleteCharacter(member -> toEditorResult(viewModel.deleteCharacter(member.id(), member.name())));
        viewModel.refresh();
        return new Binding(panel);
    }

    private static PartyCharacterEditorTopBarView.EditorResult toEditorResult(PartyTopBarViewModel.ActionResult result) {
        PartyTopBarViewModel.ActionResult safeResult = result == null
                ? PartyTopBarViewModel.ActionResult.failure("Party-Aktion konnte nicht gespeichert werden.")
                : result;
        if (safeResult.pending()) {
            return PartyCharacterEditorTopBarView.EditorResult.pending(safeResult.message());
        }
        return safeResult.accepted()
                ? PartyCharacterEditorTopBarView.EditorResult.success()
                : PartyCharacterEditorTopBarView.EditorResult.failure(safeResult.message());
    }

    private static PartyTopBarViewModel.CharacterDraftModel toDraftModel(
            PartyCharacterEditorTopBarView.EditorDraft draft
    ) {
        PartyCharacterEditorTopBarView.EditorDraft safeDraft = draft == null
                ? new PartyCharacterEditorTopBarView.EditorDraft(null, "", "", "1", "10", "10")
                : draft;
        return new PartyTopBarViewModel.CharacterDraftModel(
                safeDraft.id(),
                safeDraft.name(),
                safeDraft.playerName(),
                safeDraft.rawLevel(),
                safeDraft.rawPassivePerception(),
                safeDraft.rawArmorClass());
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
                safeModel.restActionsDisabled(),
                safeModel.actionsDisabled());
    }

    private static PartyTopBarView.MemberView toMemberView(PartyTopBarViewModel.MemberModel member) {
        PartyTopBarViewModel.MemberModel safeMember = member == null
                ? new PartyTopBarViewModel.MemberModel(
                0L, "", "", 1, 0, 0, 300, 10, 10, "Lv 1", "Lv 2", "", "", "0/300 XP (0%)", 0.0, "", "")
                : member;
        return new PartyTopBarView.MemberView(
                safeMember.id(),
                safeMember.name(),
                safeMember.playerName(),
                safeMember.level(),
                safeMember.currentXp(),
                safeMember.currentLevelXp(),
                safeMember.nextLevelXp(),
                safeMember.passivePerception(),
                safeMember.armorClass(),
                safeMember.levelLabel(),
                safeMember.nextLevelLabel(),
                safeMember.detailsText(),
                safeMember.progressionText(),
                safeMember.levelProgressText(),
                safeMember.levelProgressFraction(),
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
