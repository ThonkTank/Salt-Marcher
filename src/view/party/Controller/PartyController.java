package src.view.party.Controller;

import src.view.party.interactor.PartyInteractor;

import java.util.List;
import java.util.Objects;

public final class PartyController {

    private final PartyInteractor interactor;

    public PartyController(PartyInteractor interactor) {
        this.interactor = Objects.requireNonNull(interactor, "interactor");
    }

    public void initialize() {
        interactor.initialize();
    }

    public void onPopupOpened() {
        interactor.refresh();
    }

    public void createCharacter(PartyInteractor.CharacterDraftInput draft, PartyInteractor.MembershipSelection membership) {
        interactor.createCharacter(draft, membership);
    }

    public void updateCharacter(long id, PartyInteractor.CharacterDraftInput draft) {
        interactor.updateCharacter(id, draft);
    }

    public void deleteCharacter(long id) {
        interactor.deleteCharacter(id);
    }

    public void moveToActive(long id) {
        interactor.setMembership(id, PartyInteractor.MembershipSelection.ACTIVE);
    }

    public void moveToReserve(long id) {
        interactor.setMembership(id, PartyInteractor.MembershipSelection.RESERVE);
    }

    public void awardXp(long id, int xpAmount) {
        interactor.awardXp(List.of(id), xpAmount);
    }

    public void performShortRest() {
        interactor.performRest(PartyInteractor.RestSelection.SHORT_REST);
    }

    public void performLongRest() {
        interactor.performRest(PartyInteractor.RestSelection.LONG_REST);
    }
}
