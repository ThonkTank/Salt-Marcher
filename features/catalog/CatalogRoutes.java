package features.catalog;

import features.catalog.application.CatalogApplicationRoutes;
import java.util.Objects;

/** Semantic destinations for explicit Catalog actions. */
public record CatalogRoutes(
        CreatureInspectorRoute creatureInspector,
        ItemInspectorRoute itemInspector,
        WorldInspectorRoutes worldInspectors,
        EncounterHandoff encounter,
        SceneHandoff scene
) implements CatalogApplicationRoutes {

    public CatalogRoutes {
        creatureInspector = Objects.requireNonNull(creatureInspector, "creatureInspector");
        itemInspector = Objects.requireNonNull(itemInspector, "itemInspector");
        worldInspectors = Objects.requireNonNull(worldInspectors, "worldInspectors");
        encounter = Objects.requireNonNull(encounter, "encounter");
        scene = Objects.requireNonNull(scene, "scene");
    }

    @FunctionalInterface
    public interface CreatureInspectorRoute extends CatalogApplicationRoutes.CreatureInspectorRoute {
    }

    @FunctionalInterface
    public interface ItemInspectorRoute extends CatalogApplicationRoutes.ItemInspectorRoute {
    }

    public interface WorldInspectorRoutes extends CatalogApplicationRoutes.WorldInspectorRoutes {
    }

    public interface EncounterHandoff extends CatalogApplicationRoutes.EncounterHandoff {
    }

    public interface SceneHandoff extends CatalogApplicationRoutes.SceneHandoff {
    }
}
