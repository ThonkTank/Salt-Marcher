package src.view.creatures.Controller;

import org.jspecify.annotations.Nullable;
import src.view.creatures.interactor.CreaturesInteractor;

import java.util.Objects;

public final class CreaturesController {

    private final CreaturesInteractor interactor;

    public CreaturesController(CreaturesInteractor interactor) {
        this.interactor = Objects.requireNonNull(interactor, "interactor");
    }

    public void initialize() {
        interactor.initialize();
    }

    public void applyFilters() {
        interactor.applyFilters();
    }

    public void clearFilters() {
        interactor.clearFilters();
    }

    public void previousPage() {
        interactor.previousPage();
    }

    public void nextPage() {
        interactor.nextPage();
    }

    public void selectCreature(@Nullable Long creatureId) {
        interactor.selectCreature(creatureId);
    }
}
