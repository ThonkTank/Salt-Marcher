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
        panel.onOpen(viewModel::refresh);
        panel.onAddExisting(member -> publishPartyMutation(encounterSession,
                viewModel.addExisting(member.id(), member.name())));
        panel.onRemoveFromParty(member -> publishPartyMutation(encounterSession,
                viewModel.removeFromParty(member.id(), member.name())));
        panel.onAwardXp(request -> publishPartyMutation(encounterSession,
                viewModel.awardXp(request.member().id(), request.member().name(), request.rawXp())));
        panel.onShortRest(() -> publishPartyMutation(encounterSession, viewModel.shortRest()));
        panel.onLongRest(() -> publishPartyMutation(encounterSession, viewModel.longRest()));
        panel.onCreateCharacter(draft -> publishEditorMutation(encounterSession,
                viewModel.createCharacter(toDraftModel(draft))));
        panel.onUpdateCharacter(draft -> publishEditorMutation(encounterSession,
                viewModel.updateCharacter(toDraftModel(draft))));
        panel.onDeleteCharacter(member -> publishEditorMutation(encounterSession,
                viewModel.deleteCharacter(member.id(), member.name())));
        viewModel.refresh();
        return new Binding(panel);
    }

    private static void publishPartyMutation(EncounterRuntimeViewModel encounterSession, boolean changed) {
        if (changed) {
            encounterSession.partyChanged();
        }
    }

    private static PartyCharacterEditorTopBarView.EditorResult publishEditorMutation(
            EncounterRuntimeViewModel encounterSession,
            PartyTopBarViewModel.ActionResult result
    ) {
        PartyTopBarViewModel.ActionResult safeResult = result == null
                ? PartyTopBarViewModel.ActionResult.failure("Party-Aktion konnte nicht gespeichert werden.")
                : result;
        publishPartyMutation(encounterSession, safeResult.accepted());
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
