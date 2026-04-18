package src.view.party.interactor;

import src.domain.party.partyAPI;
import src.view.party.Model.PartyToolbarModel;

import java.util.List;
import java.util.Objects;

// PMD suppression is local: the party toolbar exposes one flat MVCI action surface to its controller; see src/view/party/UI.md.
@SuppressWarnings("PMD.TooManyMethods")
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

    public void createCharacter(
            String name,
            String playerName,
            int level,
            int passivePerception,
            int armorClass,
            boolean activeMembership
    ) {
        applyMutation(
                party.createCharacter(
                        new partyAPI.CharacterDraft(
                                name,
                                playerName,
                                level,
                                passivePerception,
                                armorClass),
                        activeMembership ? partyAPI.MembershipState.ACTIVE : partyAPI.MembershipState.RESERVE),
                "Character created.");
    }

    public void updateCharacter(
            long id,
            String name,
            String playerName,
            int level,
            int passivePerception,
            int armorClass
    ) {
        applyMutation(
                party.updateCharacter(
                        id,
                        new partyAPI.CharacterDraft(
                                name,
                                playerName,
                                level,
                                passivePerception,
                                armorClass)),
                "Character updated.");
    }

    public void deleteCharacter(long id) {
        applyMutation(party.deleteCharacter(id), "Character deleted.");
    }

    public void moveToActive(long id) {
        applyMutation(party.setMembership(id, partyAPI.MembershipState.ACTIVE), "Character moved to active party.");
    }

    public void moveToReserve(long id) {
        applyMutation(party.setMembership(id, partyAPI.MembershipState.RESERVE), "Character moved to reserve.");
    }

    public void awardXp(List<Long> ids, int xpPerCharacter) {
        applyMutation(party.awardXp(ids, xpPerCharacter), "XP awarded.");
    }

    public void performShortRest() {
        applyMutation(party.performRest(partyAPI.RestType.SHORT_REST), "Short rest applied.");
    }

    public void performLongRest() {
        applyMutation(party.performRest(partyAPI.RestType.LONG_REST), "Long rest applied.");
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
}
