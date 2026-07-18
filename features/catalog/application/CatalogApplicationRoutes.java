package features.catalog.application;

import features.encounter.api.EncounterPoolFilters;
import features.encounter.api.OpenSavedEncounterPlanResult;
import features.items.api.ItemsCatalogApi;
import java.util.concurrent.CompletionStage;

/** Internal semantic routes consumed by Catalog application and its renderer. */
public interface CatalogApplicationRoutes {

    CreatureInspectorRoute creatureInspector();
    ItemInspectorRoute itemInspector();
    WorldInspectorRoutes worldInspectors();
    EncounterHandoff encounter();
    SceneHandoff scene();

    @FunctionalInterface
    public interface CreatureInspectorRoute {
        void openCreature(long creatureId);
    }

    @FunctionalInterface
    public interface ItemInspectorRoute {
        void openItem(ItemsCatalogApi.ItemDetail detail);
    }

    public interface WorldInspectorRoutes {
        void openNpc(long npcId);
        void openFaction(long factionId);
        void openLocation(long locationId);
        void createNpc();
        void createFaction();
        void createLocation();
    }

    public interface EncounterHandoff {
        void updatePoolFilters(EncounterPoolFilters filters);
        void addCreature(long creatureId);
        void addWorldNpc(long creatureId, long npcId);
        void useFactionSource(long factionId);
        void useLocationSource(long locationId);
        void useEncounterTableSource(long tableId);
        CompletionStage<OpenSavedEncounterPlanResult> openSavedEncounter(long planId, boolean discardUnsavedChanges);
    }

    public interface SceneHandoff {
        void addCreature(long creatureId);
        void addNpc(long npcId);
        void setLocation(long locationId);
    }
}
