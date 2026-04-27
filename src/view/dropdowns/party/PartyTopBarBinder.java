package src.view.dropdowns.party;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import javafx.scene.Node;
import shell.api.ShellBinding;
import shell.api.ShellRuntimeContext;
import shell.api.ShellSlot;
import src.domain.encounter.EncounterApplicationService;
import src.domain.encounter.published.ApplyEncounterSessionCommand;
import src.domain.party.PartyApplicationService;
import src.domain.party.published.AdjustPartyXpCommand;
import src.domain.party.published.CharacterDraft;
import src.domain.party.published.CreateCharacterCommand;
import src.domain.party.published.DeleteCharacterCommand;
import src.domain.party.published.LoadAdventuringDaySummaryQuery;
import src.domain.party.published.LoadPartySnapshotQuery;
import src.domain.party.published.MutationResult;
import src.domain.party.published.MutationStatus;
import src.domain.party.published.PerformPartyRestCommand;
import src.domain.party.published.RestType;
import src.domain.party.published.SetPartyMembershipCommand;
import src.domain.party.published.UpdateCharacterCommand;

final class PartyTopBarBinder {

    private final ShellRuntimeContext runtimeContext;

    PartyTopBarBinder(ShellRuntimeContext runtimeContext) {
        this.runtimeContext = Objects.requireNonNull(runtimeContext, "runtimeContext");
    }

    ShellBinding bind() {
        PartyApplicationService party = runtimeContext.services().require(PartyApplicationService.class);
        EncounterApplicationService encounters = runtimeContext.services().require(EncounterApplicationService.class);
        PartyTopBarPresentationModel presentationModel = new PartyTopBarPresentationModel();
        PartyTopBarIntentHandler intentHandler = new PartyTopBarIntentHandler(presentationModel);
        PartyTopBarView panel = new PartyTopBarView();
        bindPartyRequests(party, presentationModel, intentHandler);
        panel.setTriggerText(presentationModel.triggerTextProperty().get());
        panel.showPanel(toPanelContent(presentationModel.panelProperty().get()));
        presentationModel.triggerTextProperty().addListener((ignored, before, after) -> panel.setTriggerText(after));
        presentationModel.panelProperty().addListener((ignored, before, after) -> panel.showPanel(toPanelContent(after)));
        presentationModel.mutationTokenProperty().addListener((ignored, before, after) -> encounters.applySession(
                new ApplyEncounterSessionCommand(
                        ApplyEncounterSessionCommand.Action.REFRESH,
                        null,
                        src.domain.encounter.published.EncounterSessionSnapshot.BuilderInputs.empty(),
                        0L,
                        0L,
                        0,
                        0L,
                        java.util.List.of(),
                        "",
                        0,
                        0L,
                        0,
                        false)));
        panel.onOpen(intentHandler::refresh);
        panel.onAddExisting(member -> intentHandler.addExisting(member.id(), member.name()));
        panel.onRemoveFromParty(member -> intentHandler.removeFromParty(member.id(), member.name()));
        panel.onAdjustXp(request -> intentHandler.adjustXp(
                request.member().id(),
                request.member().name(),
                request.xpDelta()));
        panel.onShortRest(intentHandler::shortRest);
        panel.onLongRest(intentHandler::longRest);
        panel.onCreateCharacter(draft -> toEditorResult(intentHandler.createCharacter(toDraftModel(draft))));
        panel.onUpdateCharacter(draft -> toEditorResult(intentHandler.updateCharacter(toDraftModel(draft))));
        panel.onDeleteCharacter(member -> toEditorResult(intentHandler.deleteCharacter(member.id(), member.name())));
        intentHandler.refresh();
        return new Binding(panel);
    }

    private static void bindPartyRequests(
            PartyApplicationService party,
            PartyTopBarPresentationModel presentationModel,
            PartyTopBarIntentHandler intentHandler
    ) {
        intentHandler.onRefreshRequested(() -> {
            try {
                presentationModel.applyLoadResult(loadPanelData(party));
            } catch (RuntimeException exception) {
                presentationModel.applyStorageError();
            }
        });
        intentHandler.onActionRequested(intent -> {
            try {
                presentationModel.applyMutationResult(new PartyTopBarPresentationModel.MutationAndLoadResult(
                        runMutation(party, intent),
                        loadPanelData(party),
                        intent.successMessage()));
            } catch (RuntimeException exception) {
                presentationModel.applyMutationFailure();
            }
        });
    }

    private static PartyTopBarPresentationModel.PanelData loadPanelData(PartyApplicationService party) {
        src.domain.party.published.PartySnapshotResult snapshotResult =
                party.loadSnapshot(new LoadPartySnapshotQuery());
        src.domain.party.published.AdventuringDayResult dayResult =
                snapshotResult == null || snapshotResult.status() != src.domain.party.published.ReadStatus.SUCCESS
                        ? null
                        : party.loadAdventuringDaySummary(new LoadAdventuringDaySummaryQuery());
        return new PartyTopBarPresentationModel.PanelData(snapshotResult, dayResult);
    }

    private static MutationResult runMutation(
            PartyApplicationService party,
            PartyTopBarPresentationModel.ActionIntent intent
    ) {
        return switch (intent.kind()) {
            case SET_MEMBERSHIP -> party.setMembership(new SetPartyMembershipCommand(intent.characterId(), intent.membershipState()));
            case CREATE_CHARACTER -> party.createCharacter(new CreateCharacterCommand(
                    Objects.requireNonNull(intent.draft()),
                    intent.membershipState()));
            case UPDATE_CHARACTER -> party.updateCharacter(new UpdateCharacterCommand(
                    intent.characterId(),
                    Objects.requireNonNull(intent.draft())));
            case DELETE_CHARACTER -> party.deleteCharacter(new DeleteCharacterCommand(intent.characterId()));
            case ADJUST_XP -> party.adjustXp(new AdjustPartyXpCommand(List.of(intent.characterId()), intent.xpDelta()));
            case PERFORM_REST -> party.performRest(new PerformPartyRestCommand(toRestType(intent.restAction())));
        };
    }

    private static RestType toRestType(PartyTopBarPresentationModel.RestAction restAction) {
        return switch (restAction == null ? PartyTopBarPresentationModel.RestAction.NONE : restAction) {
            case NONE, SHORT_REST -> RestType.SHORT_REST;
            case LONG_REST -> RestType.LONG_REST;
        };
    }

    private static PartyCharacterEditorTopBarView.EditorResult toEditorResult(PartyTopBarPresentationModel.ActionResult result) {
        PartyTopBarPresentationModel.ActionResult safeResult = result == null
                ? PartyTopBarPresentationModel.ActionResult.failure("Party-Aktion konnte nicht gespeichert werden.")
                : result;
        if (safeResult.pending()) {
            return PartyCharacterEditorTopBarView.EditorResult.pending(safeResult.message());
        }
        return safeResult.accepted()
                ? PartyCharacterEditorTopBarView.EditorResult.success()
                : PartyCharacterEditorTopBarView.EditorResult.failure(safeResult.message());
    }

    private static PartyTopBarPresentationModel.CharacterDraftModel toDraftModel(
            PartyCharacterEditorTopBarView.EditorDraft draft
    ) {
        PartyCharacterEditorTopBarView.EditorDraft safeDraft = draft == null
                ? new PartyCharacterEditorTopBarView.EditorDraft(null, "", "", "1", "10", "10")
                : draft;
        return new PartyTopBarPresentationModel.CharacterDraftModel(
                safeDraft.id(),
                safeDraft.name(),
                safeDraft.playerName(),
                safeDraft.rawLevel(),
                safeDraft.rawPassivePerception(),
                safeDraft.rawArmorClass());
    }

    private static PartyTopBarView.PanelContent toPanelContent(PartyTopBarPresentationModel.PanelModel model) {
        PartyTopBarPresentationModel.PanelModel safeModel = model == null
                ? PartyTopBarPresentationModel.PanelModel.loadingModel()
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

    private static PartyTopBarView.MemberView toMemberView(PartyTopBarPresentationModel.MemberModel member) {
        PartyTopBarPresentationModel.MemberModel safeMember = member == null
                ? new PartyTopBarPresentationModel.MemberModel(
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
