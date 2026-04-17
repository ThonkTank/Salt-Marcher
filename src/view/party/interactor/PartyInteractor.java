package src.view.party.interactor;

import org.jspecify.annotations.Nullable;
import src.domain.party.partyAPI;
import src.view.party.Model.PartyToolbarModel;

import java.util.List;
import java.util.Objects;

public final class PartyInteractor {

    private final partyAPI party;
    private final PartyToolbarModel model;
    private final PartyToolbarStateMapper stateMapper = new PartyToolbarStateMapper();
    private final PartyMutationMessages mutationMessages = new PartyMutationMessages();

    public PartyInteractor(partyAPI party, PartyToolbarModel model) {
        this.party = Objects.requireNonNull(party, "party");
        this.model = Objects.requireNonNull(model, "model");
    }

    public void initialize() {
        refreshState();
        model.clearStatus();
    }

    public void refresh() {
        refreshState();
    }

    public void createCharacter(CharacterDraftInput draft, MembershipSelection membership) {
        applyMutation(
                party.createCharacter(
                        new partyAPI.CharacterDraft(
                                draft.name(),
                                draft.playerName(),
                                draft.level(),
                                draft.passivePerception(),
                                draft.armorClass()),
                        membership.toApi()),
                "Character created.");
    }

    public void updateCharacter(long id, CharacterDraftInput draft) {
        applyMutation(
                party.updateCharacter(
                        id,
                        new partyAPI.CharacterDraft(
                                draft.name(),
                                draft.playerName(),
                                draft.level(),
                                draft.passivePerception(),
                                draft.armorClass())),
                "Character updated.");
    }

    public void deleteCharacter(long id) {
        applyMutation(party.deleteCharacter(id), "Character deleted.");
    }

    public void setMembership(long id, MembershipSelection membership) {
        String successMessage = membership == MembershipSelection.ACTIVE
                ? "Character moved to active party."
                : "Character moved to reserve.";
        applyMutation(party.setMembership(id, membership.toApi()), successMessage);
    }

    public void awardXp(List<Long> ids, int xpPerCharacter) {
        applyMutation(party.awardXp(ids, xpPerCharacter), "XP awarded.");
    }

    public void performRest(RestSelection restType) {
        String successMessage = restType == RestSelection.LONG_REST
                ? "Long rest applied."
                : "Short rest applied.";
        applyMutation(party.performRest(restType.toApi()), successMessage);
    }

    private void applyMutation(partyAPI.MutationResult result, String successMessage) {
        if (result == null) {
            model.showStatus("Party update failed.", true);
            return;
        }
        if (result.status() != partyAPI.MutationStatus.SUCCESS) {
            model.showStatus(mutationMessages.errorFor(result.status()), true);
            return;
        }
        if (refreshState()) {
            model.showStatus(successMessage, false);
        }
    }

    private boolean refreshState() {
        partyAPI.PartySnapshotResult snapshotResult = party.loadSnapshot();
        partyAPI.AdventuringDayResult dayResult = party.loadAdventuringDaySummary();
        if (snapshotResult.status() != partyAPI.ReadStatus.SUCCESS
                || dayResult.status() != partyAPI.ReadStatus.SUCCESS) {
            model.showStatus("Party data could not be loaded.", true);
            return false;
        }
        model.applyState(stateMapper.map(snapshotResult, dayResult));
        return true;
    }

    public enum MembershipSelection {
        ACTIVE,
        RESERVE;

        private partyAPI.MembershipState toApi() {
            return this == ACTIVE ? partyAPI.MembershipState.ACTIVE : partyAPI.MembershipState.RESERVE;
        }
    }

    public enum RestSelection {
        SHORT_REST,
        LONG_REST;

        private partyAPI.RestType toApi() {
            return this == LONG_REST ? partyAPI.RestType.LONG_REST : partyAPI.RestType.SHORT_REST;
        }
    }

    public record CharacterDraftInput(
            String name,
            String playerName,
            int level,
            int passivePerception,
            int armorClass
    ) {
    }

    public record PartyMemberViewData(
            Long id,
            String name,
            String playerName,
            int level,
            int currentXp,
            int xpToNextLevel,
            boolean readyToLevel,
            int passivePerception,
            int armorClass,
            int xpSinceShortRest,
            int xpSinceLongRest,
            int shortRestsTakenSinceLongRest,
            MembershipSelection membership,
            @Nullable RestStatusViewData restStatus
    ) {
    }

    public enum RestIndicatorSeverity {
        NORMAL,
        SOON,
        OVERDUE
    }

    public record RestStatusViewData(
            String label,
            String tooltip,
            RestIndicatorSeverity severity
    ) {
    }
}
