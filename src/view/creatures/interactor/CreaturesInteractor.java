package src.view.creatures.interactor;

import org.jspecify.annotations.Nullable;
import shell.host.InspectorEntrySpec;
import shell.host.InspectorSink;
import src.domain.creatures.api.CreatureDetail;
import src.domain.creatures.creaturesAPI;
import src.view.creatures.Model.CreaturesModel;

import java.util.List;
import java.util.Objects;

public final class CreaturesInteractor {

    private final creaturesAPI creatures;
    private final CreaturesModel model;
    private final CreatureCatalogCoordinator catalogCoordinator;
    private final InspectorSink inspector;

    public CreaturesInteractor(creaturesAPI creatures, CreaturesModel model, InspectorSink inspector) {
        this.creatures = Objects.requireNonNull(creatures, "creatures");
        this.model = Objects.requireNonNull(model, "model");
        this.catalogCoordinator = new CreatureCatalogCoordinator(this.creatures, this.model);
        this.inspector = Objects.requireNonNull(inspector, "inspector");
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
        if (inspector.isShowing(inspectorKey)) {
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
        inspector.push(new InspectorEntrySpec(
                detail.name(),
                inspectorKey,
                () -> CreatureInspectorContentFactory.build(detail),
                null
        ));
        model.status().clear();
    }

    public record CreatureCatalogRowViewData(
            long id,
            String name,
            String challengeRating,
            String creatureType,
            String size,
            String alignment,
            int xp,
            int hitPoints,
            int armorClass
    ) {
    }

    public record CreatureCatalogPageViewData(
            List<CreatureCatalogRowViewData> rows,
            String pageSummaryText,
            boolean previousPageAvailable,
            boolean nextPageAvailable
    ) {
        public CreatureCatalogPageViewData {
            rows = rows == null ? List.of() : List.copyOf(rows);
        }
    }
}
