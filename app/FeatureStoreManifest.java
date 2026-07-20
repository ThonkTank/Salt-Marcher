package app;

import features.creatures.CreaturesServiceAssembly;
import features.dungeon.DungeonFeature;
import features.encounter.EncounterServiceAssembly;
import features.encountertable.EncounterTableServiceAssembly;
import features.hex.HexServiceAssembly;
import features.items.ItemsServiceAssembly;
import features.party.PartyServiceAssembly;
import features.scene.SceneFeature;
import features.sessiongeneration.SessionGenerationServiceAssembly;
import features.sessionplanner.SessionPlannerServiceAssembly;
import features.worldplanner.WorldPlannerServiceAssembly;

import platform.persistence.FeatureStoreHandle;
import platform.persistence.SqliteDatabase;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/** The complete, ordered production store manifest shared by startup and migration rehearsal. */
final class FeatureStoreManifest {

    private FeatureStoreManifest() {}

    static Stores register(SqliteDatabase database) {
        return new Stores(
                database.featureStore(CreaturesServiceAssembly.storeDefinition()),
                database.featureStore(EncounterTableServiceAssembly.storeDefinition()),
                database.featureStore(PartyServiceAssembly.storeDefinition()),
                database.featureStore(ItemsServiceAssembly.storeDefinition()),
                database.featureStore(WorldPlannerServiceAssembly.storeDefinition()),
                database.featureStore(EncounterServiceAssembly.storeDefinition()),
                database.featureStore(DungeonFeature.storeDefinition()),
                database.featureStore(HexServiceAssembly.storeDefinition()),
                database.featureStore(SessionGenerationServiceAssembly.storeDefinition()),
                database.featureStore(SessionPlannerServiceAssembly.storeDefinition()),
                database.featureStore(SceneFeature.storeDefinition()));
    }

    record Stores(
            FeatureStoreHandle creatures,
            FeatureStoreHandle encounterTables,
            FeatureStoreHandle party,
            FeatureStoreHandle items,
            FeatureStoreHandle worldPlanner,
            FeatureStoreHandle encounter,
            FeatureStoreHandle dungeon,
            FeatureStoreHandle hex,
            FeatureStoreHandle sessionGeneration,
            FeatureStoreHandle sessionPlanner,
            FeatureStoreHandle scene) {

        List<FeatureStoreHandle> all() {
            return List.of(
                    creatures,
                    encounterTables,
                    party,
                    items,
                    worldPlanner,
                    encounter,
                    dungeon,
                    hex,
                    sessionGeneration,
                    sessionPlanner,
                    scene);
        }

        Set<String> owners() {
            return all().stream()
                    .map(FeatureStoreHandle::owner)
                    .collect(Collectors.toUnmodifiableSet());
        }
    }
}
