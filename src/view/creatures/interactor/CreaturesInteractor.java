package src.view.creatures.interactor;

import org.jspecify.annotations.Nullable;
import src.domain.creatures.api.CreatureDetail;
import src.domain.creatures.creaturesAPI;
import src.view.creatures.Model.CreaturesModel;

import java.util.Objects;

public final class CreaturesInteractor {

    private final creaturesAPI creatures;
    private final CreaturesModel model;
    private final CreatureCatalogCoordinator catalogCoordinator;
    private final CreatureInspectorPublisher inspectorPublisher;

    public CreaturesInteractor(creaturesAPI creatures, CreaturesModel model, CreatureInspectorPublisher inspectorPublisher) {
        this.creatures = Objects.requireNonNull(creatures, "creatures");
        this.model = Objects.requireNonNull(model, "model");
        this.catalogCoordinator = new CreatureCatalogCoordinator(this.creatures, this.model);
        this.inspectorPublisher = Objects.requireNonNull(inspectorPublisher, "inspectorPublisher");
    }

    public void initialize() {
        catalogCoordinator.initialize();
    }

    public void applyFilters() {
        catalogCoordinator.applyFilters();
    }

    public void clearFilters() {
        catalogCoordinator.clearFilters();
    }

    public void previousPage() {
        catalogCoordinator.previousPage();
    }

    public void nextPage() {
        catalogCoordinator.nextPage();
    }

    public void selectCreature(@Nullable Long creatureId) {
        if (creatureId == null || creatureId <= 0) {
            return;
        }
        Object inspectorKey = "creatures:" + creatureId;
        if (inspectorPublisher.isShowing(inspectorKey)) {
            return;
        }
        creaturesAPI.CreatureDetailResult result = creatures.loadCreatureDetail(creatureId);
        if (result.status() == creaturesAPI.LookupStatus.NOT_FOUND || result.detail() == null) {
            model.status().show("Creature detail is not available.", true);
            return;
        }
        if (result.status() != creaturesAPI.LookupStatus.SUCCESS) {
            model.status().show("Creature detail could not be loaded.", true);
            return;
        }
        CreatureDetail detail = result.detail();
        inspectorPublisher.show(detail, inspectorKey);
        model.status().clear();
    }
}
