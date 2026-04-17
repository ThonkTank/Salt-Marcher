package src.view.encounter.Controller;

import src.view.encounter.interactor.EncounterInteractor;

import java.util.Objects;

public final class EncounterController {

    private final EncounterInteractor interactor;

    public EncounterController(EncounterInteractor interactor) {
        this.interactor = Objects.requireNonNull(interactor, "interactor");
    }

    public void initialize() {
        interactor.initialize();
    }

    public void generate() {
        interactor.generate();
    }

    public void reroll() {
        interactor.reroll();
    }

    public void lockSelected() {
        interactor.lockSelected();
    }

    public void clearLocks() {
        interactor.clearLocks();
    }

    public void excludeSelected() {
        interactor.excludeSelected();
    }

    public void clearExclusions() {
        interactor.clearExclusions();
    }
}
