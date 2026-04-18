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

    public void createCharacter(
            String name,
            String playerName,
            int level,
            int passivePerception,
            int armorClass,
            boolean activeMembership
    ) {
        interactor.createCharacter(
                name,
                playerName,
                level,
                passivePerception,
                armorClass,
                activeMembership);
    }

    public void updateCharacter(
            long id,
            String name,
            String playerName,
            int level,
            int passivePerception,
            int armorClass
    ) {
        interactor.updateCharacter(
                id,
                name,
                playerName,
                level,
                passivePerception,
                armorClass);
    }

    public void deleteCharacter(long id) {
        interactor.deleteCharacter(id);
    }

    public void moveToActive(long id) {
        interactor.moveToActive(id);
    }

    public void moveToReserve(long id) {
        interactor.moveToReserve(id);
    }

    public void awardXp(long id, int xpAmount) {
        interactor.awardXp(List.of(id), xpAmount);
    }

    public void performShortRest() {
        interactor.performShortRest();
    }

    public void performLongRest() {
        interactor.performLongRest();
    }
}
