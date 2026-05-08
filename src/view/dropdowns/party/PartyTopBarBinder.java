package src.view.dropdowns.party;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import javafx.scene.Node;
import shell.api.ShellBinding;
import shell.api.ShellRuntimeContext;
import shell.api.ShellSlot;
import src.domain.encounter.EncounterApplicationService;
import src.domain.encounter.published.ApplyEncounterStateCommand;
import src.domain.party.PartyApplicationService;
import src.domain.party.published.AdventuringDaySummaryModel;
import src.domain.party.published.AdjustPartyXpCommand;
import src.domain.party.published.CharacterDraft;
import src.domain.party.published.CreateCharacterCommand;
import src.domain.party.published.DeleteCharacterCommand;
import src.domain.party.published.PartyMutationModel;
import src.domain.party.published.PerformPartyRestCommand;
import src.domain.party.published.PartySnapshotModel;
import src.domain.party.published.RestType;
import src.domain.party.published.SetPartyMembershipCommand;
import src.domain.party.published.UpdateCharacterCommand;

@SuppressWarnings("PMD.CouplingBetweenObjects")
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
        PartyRosterTopBarView rosterView = new PartyRosterTopBarView();
        PartyEditorTopBarView editorView = new PartyEditorTopBarView();
        PartyTopBarView topBarView = new PartyTopBarView(rosterView, editorView);
        PartySnapshotModel snapshotModel = runtimeContext.services().require(PartySnapshotModel.class);
        AdventuringDaySummaryModel summaryModel = runtimeContext.services().require(AdventuringDaySummaryModel.class);
        PartyMutationModel mutationModel = runtimeContext.services().require(PartyMutationModel.class);
        bindPartyRequests(party, encounters, intentHandler);
        topBarView.setTriggerText(presentationModel.triggerTextProperty().get());
        PartyTopBarContributionModel.PanelModel initialModel = presentationModel.panelProperty().get();
        PartyTopBarContributionModel.EditorPanelModel initialEditorModel = initialModel == null
                ? PartyTopBarContributionModel.EditorPanelModel.hidden()
                : initialModel.editorPanel();
        rosterView.showPanel(toRosterContent(initialModel));
        editorView.showEditor(initialEditorModel);
        presentationModel.triggerTextProperty().addListener((ignored, before, after) -> topBarView.setTriggerText(after));
        presentationModel.panelProperty().addListener((ignored, before, after) -> {
            PartyTopBarContributionModel.EditorPanelModel editorModel = after == null
                    ? PartyTopBarContributionModel.EditorPanelModel.hidden()
                    : after.editorPanel();
            rosterView.showPanel(toRosterContent(after));
            editorView.showEditor(editorModel);
        });
        topBarView.onViewInputEvent(intentHandler::consume);
        rosterView.onViewInputEvent(intentHandler::consume);
        editorView.onViewInputEvent(intentHandler::consume);
        snapshotModel.subscribe(snapshot ->
                presentationModel.applyLoadResult(new PartyTopBarContributionModel.PanelData(
                        snapshot,
                        summaryModel.current())));
        summaryModel.subscribe(summary ->
                presentationModel.applyLoadResult(new PartyTopBarContributionModel.PanelData(
                        snapshotModel.current(),
                        summary)));
        mutationModel.subscribe(result ->
                presentationModel.applyMutationResult(new PartyTopBarContributionModel.MutationAndLoadResult(
                        result,
                        new PartyTopBarContributionModel.PanelData(
                                snapshotModel.current(),
                                summaryModel.current()),
                        pendingSuccessMessage(intentHandler))));
        presentationModel.applyLoadResult(new PartyTopBarContributionModel.PanelData(
                snapshotModel.current(),
                summaryModel.current()));
        return new Binding(topBarView);
    }

    private static void bindPartyRequests(
            PartyApplicationService party,
            EncounterApplicationService encounters,
            PartyTopBarIntentHandler intentHandler
    ) {
        intentHandler.onPublishedEventRequested(event -> {
            if (event == null) {
                return;
            }
            intentHandler.storePendingSuccessMessage(event.successMessage());
            runMutation(party, event);
            refreshEncounterSession(encounters);
        });
    }

    private static void refreshEncounterSession(EncounterApplicationService encounters) {
        encounters.applyState(new ApplyEncounterStateCommand(
                ApplyEncounterStateCommand.Action.REFRESH,
                0L,
                0L,
                0,
                0L,
                List.of(),
                "",
                0,
                0L,
                0,
                false));
    }

    private static void runMutation(
        PartyApplicationService party,
        PartyTopBarPublishedEvent intent
    ) {
        switch (intent.kind()) {
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
            default -> {
            }
        }
    }

    private static String pendingSuccessMessage(PartyTopBarIntentHandler intentHandler) {
        return intentHandler.drainPendingSuccessMessage();
    }

    private static src.domain.party.published.MembershipState toMembershipState(
            PartyTopBarPublishedEvent.MembershipTarget membershipTarget
    ) {
        PartyTopBarPublishedEvent.MembershipTarget safeTarget = membershipTarget == null
                ? PartyTopBarPublishedEvent.MembershipTarget.ACTIVE
                : membershipTarget;
        if (safeTarget == PartyTopBarPublishedEvent.MembershipTarget.RESERVE) {
            return src.domain.party.published.MembershipState.RESERVE;
        }
        return src.domain.party.published.MembershipState.ACTIVE;
    }

    private static RestType toRestType(PartyTopBarPublishedEvent.RestAction restAction) {
        PartyTopBarPublishedEvent.RestAction safeAction = restAction == null
                ? PartyTopBarPublishedEvent.RestAction.NONE
                : restAction;
        if (safeAction == PartyTopBarPublishedEvent.RestAction.LONG_REST) {
            return RestType.LONG_REST;
        }
        return RestType.SHORT_REST;
    }

    private static PartyRosterTopBarView.PanelContent toRosterContent(PartyTopBarContributionModel.PanelModel model) {
        PartyTopBarContributionModel.PanelModel safeModel = model == null
                ? PartyTopBarContributionModel.PanelModel.loadingModel()
                : model;
        return new PartyRosterTopBarView.PanelContent(
                safeModel.loading(),
                safeModel.storageError(),
                safeModel.storageMessage(),
                safeModel.activeMembers(),
                safeModel.reserveMembers(),
                safeModel.summaryText(),
                safeModel.restSummaryText(),
                safeModel.actionStatus(),
                safeModel.actionStatusError(),
                safeModel.restActionsDisabled(),
                safeModel.actionsDisabled());
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
