package app;

import features.dungeon.DungeonFeature;
import features.encounter.EncounterServiceAssembly;
import features.encountertable.EncounterTableServiceAssembly;
import features.hex.HexServiceAssembly;
import features.party.PartyServiceAssembly;
import features.scene.SceneFeature;
import features.sessiongeneration.SessionGenerationServiceAssembly;
import features.sessionplanner.SessionPlannerServiceAssembly;
import features.worldplanner.WorldPlannerServiceAssembly;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import platform.persistence.FeatureStoreHandle;
import platform.persistence.SqliteDatabase;

/** Complete Campaign-owned store manifest. */
final class CampaignStoreManifest {

    private CampaignStoreManifest() { }

    static Stores register(SqliteDatabase database) {
        return new Stores(
                database.featureStore(EncounterTableServiceAssembly.storeDefinition()),
                database.featureStore(PartyServiceAssembly.storeDefinition()),
                database.featureStore(WorldPlannerServiceAssembly.storeDefinition()),
                database.featureStore(EncounterServiceAssembly.storeDefinition()),
                database.featureStore(DungeonFeature.storeDefinition()),
                database.featureStore(HexServiceAssembly.storeDefinition()),
                database.featureStore(SessionGenerationServiceAssembly.storeDefinition()),
                database.featureStore(SessionPlannerServiceAssembly.storeDefinition()),
                database.featureStore(SceneFeature.storeDefinition()));
    }

    record Stores(
            FeatureStoreHandle encounterTables,
            FeatureStoreHandle party,
            FeatureStoreHandle worldPlanner,
            FeatureStoreHandle encounter,
            FeatureStoreHandle dungeon,
            FeatureStoreHandle hex,
            FeatureStoreHandle sessionGeneration,
            FeatureStoreHandle sessionPlanner,
            FeatureStoreHandle scene) {

        List<FeatureStoreHandle> all() {
            return List.of(
                    encounterTables,
                    party,
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
