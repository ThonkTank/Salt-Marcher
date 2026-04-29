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
        PartyTopBarContributionModel presentationModel = new PartyTopBarContributionModel();
        PartyTopBarIntentHandler intentHandler = new PartyTopBarIntentHandler(presentationModel);
        PartyTopBarView panel = new PartyTopBarView();
        bindPartyRequests(party, presentationModel, intentHandler);
        panel.setTriggerText(presentationModel.triggerTextProperty().get());
        panel.showPanel(toPanelContent(presentationModel.panelProperty().get()));
        presentationModel.triggerTextProperty().addListener((ignored, before, after) -> panel.setTriggerText(after));
        presentationModel.panelProperty().addListener((ignored, before, after) -> panel.showPanel(toPanelContent(after)));
        presentationModel.refreshTokenProperty().addListener((ignored, before, after) -> loadPanel(party, presentationModel));
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
        panel.onViewInputEvent(intentHandler::consume);
        intentHandler.consume(PartyTopBarViewInputEvent.opened());
        return new Binding(panel);
    }

    private static void bindPartyRequests(
            PartyApplicationService party,
            PartyTopBarContributionModel presentationModel,
            PartyTopBarIntentHandler intentHandler
    ) {
        intentHandler.onPublishedEventRequested(event -> {
            try {
                presentationModel.applyMutationResult(new PartyTopBarContributionModel.MutationAndLoadResult(
                        runMutation(party, event),
                        loadPanelData(party),
                        event.successMessage()));
            } catch (RuntimeException exception) {
                presentationModel.applyMutationFailure();
            }
        });
    }

    private static void loadPanel(
            PartyApplicationService party,
            PartyTopBarContributionModel presentationModel
    ) {
        try {
            presentationModel.applyLoadResult(loadPanelData(party));
        } catch (RuntimeException exception) {
            presentationModel.applyStorageError();
        }
    }

    private static PartyTopBarContributionModel.PanelData loadPanelData(PartyApplicationService party) {
        src.domain.party.published.PartySnapshotResult snapshotResult =
                party.loadSnapshot(new LoadPartySnapshotQuery());
        src.domain.party.published.AdventuringDayResult dayResult =
                snapshotResult == null || snapshotResult.status() != src.domain.party.published.ReadStatus.SUCCESS
                        ? null
                        : party.loadAdventuringDaySummary(new LoadAdventuringDaySummaryQuery());
        return new PartyTopBarContributionModel.PanelData(snapshotResult, dayResult);
    }

    private static MutationResult runMutation(
        PartyApplicationService party,
        PartyTopBarPublishedEvent intent
    ) {
        return switch (intent.kind()) {
            case SET_MEMBERSHIP -> party.setMembership(new SetPartyMembershipCommand(
                    intent.characterId(),
                    toMembershipState(intent.membershipTarget())));
            case CREATE_CHARACTER -> party.createCharacter(new CreateCharacterCommand(
                    new CharacterDraft(
                            intent.name(),
                            intent.playerName(),
                            intent.level(),
                            intent.passivePerception(),
                            intent.armorClass()),
                    toMembershipState(intent.membershipTarget())));
            case UPDATE_CHARACTER -> party.updateCharacter(new UpdateCharacterCommand(
                    intent.characterId(),
                    new CharacterDraft(
                            intent.name(),
                            intent.playerName(),
                            intent.level(),
                            intent.passivePerception(),
                            intent.armorClass())));
            case DELETE_CHARACTER -> party.deleteCharacter(new DeleteCharacterCommand(intent.characterId()));
            case ADJUST_XP -> party.adjustXp(new AdjustPartyXpCommand(List.of(intent.characterId()), intent.xpDelta()));
            case PERFORM_REST -> party.performRest(new PerformPartyRestCommand(toRestType(intent.restAction())));
        };
    }

    private static src.domain.party.published.MembershipState toMembershipState(
            PartyTopBarPublishedEvent.MembershipTarget membershipTarget
    ) {
        return switch (membershipTarget == null ? PartyTopBarPublishedEvent.MembershipTarget.ACTIVE : membershipTarget) {
            case ACTIVE -> src.domain.party.published.MembershipState.ACTIVE;
            case RESERVE -> src.domain.party.published.MembershipState.RESERVE;
        };
    }

    private static RestType toRestType(PartyTopBarPublishedEvent.RestAction restAction) {
        return switch (restAction == null ? PartyTopBarPublishedEvent.RestAction.NONE : restAction) {
            case NONE, SHORT_REST -> RestType.SHORT_REST;
            case LONG_REST -> RestType.LONG_REST;
        };
    }

    private static PartyTopBarView.PanelContent toPanelContent(PartyTopBarContributionModel.PanelModel model) {
        PartyTopBarContributionModel.PanelModel safeModel = model == null
                ? PartyTopBarContributionModel.PanelModel.loadingModel()
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

    private static PartyTopBarView.MemberView toMemberView(PartyTopBarContributionModel.MemberModel member) {
        PartyTopBarContributionModel.MemberModel safeMember = member == null
                ? new PartyTopBarContributionModel.MemberModel(
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
