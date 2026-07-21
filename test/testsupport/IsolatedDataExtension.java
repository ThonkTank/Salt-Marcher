package testsupport;

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

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Comparator;
import java.util.List;
import org.junit.jupiter.api.extension.AfterEachCallback;
import org.junit.jupiter.api.extension.BeforeEachCallback;
import org.junit.jupiter.api.extension.ExtensionContext;
import platform.persistence.FeatureStoreDefinition;
import platform.persistence.TestFeatureStores;

public final class IsolatedDataExtension implements BeforeEachCallback, AfterEachCallback {

    private static final ExtensionContext.Namespace NAMESPACE =
            ExtensionContext.Namespace.create(IsolatedDataExtension.class);
    private static final String RESOURCE_KEY = "test-feature-stores";
    private static final List<FeatureStoreDefinition> FULL_STORE_MANIFEST = List.of(
            CreaturesServiceAssembly.storeDefinition(),
            EncounterTableServiceAssembly.storeDefinition(),
            PartyServiceAssembly.storeDefinition(),
            ItemsServiceAssembly.storeDefinition(),
            WorldPlannerServiceAssembly.storeDefinition(),
            EncounterServiceAssembly.storeDefinition(),
            DungeonFeature.storeDefinition(),
            HexServiceAssembly.storeDefinition(),
            SessionGenerationServiceAssembly.storeDefinition(),
            SessionPlannerServiceAssembly.storeDefinition(),
            SceneFeature.storeDefinition());

    @Override
    public void beforeEach(ExtensionContext context) throws IOException {
        Path applicationData = applicationData();
        clean(applicationData);
        Files.createDirectories(applicationData);
        TestFeatureStores.TestResource resource =
                TestFeatureStores.openTestResource(FULL_STORE_MANIFEST);
        context.getStore(NAMESPACE).put(RESOURCE_KEY, resource);
    }

    @Override
    public void afterEach(ExtensionContext context) throws IOException {
        TestFeatureStores.TestResource resource = context.getStore(NAMESPACE)
                .remove(RESOURCE_KEY, TestFeatureStores.TestResource.class);
        try {
            if (resource != null) {
                resource.close();
            }
        } finally {
            clean(applicationData());
        }
    }

    private static Path applicationData() {
        String configured = System.getenv("XDG_DATA_HOME");
        if (configured == null || configured.isBlank()) {
            throw new IllegalStateException("Tests require an isolated XDG_DATA_HOME.");
        }
        Path xdgDataHome = Path.of(configured).toAbsolutePath().normalize();
        Path buildDirectory = Path.of("build").toAbsolutePath().normalize();
        if (!xdgDataHome.startsWith(buildDirectory)) {
            throw new IllegalStateException("Refusing to clean non-build test data: " + xdgDataHome);
        }
        return xdgDataHome.resolve("salt-marcher");
    }

    private static void clean(Path applicationData) throws IOException {
        if (!Files.exists(applicationData)) {
            return;
        }
        try (var paths = Files.walk(applicationData)) {
            paths.sorted(Comparator.reverseOrder()).forEach(IsolatedDataExtension::delete);
        }
    }

    private static void delete(Path path) {
        try {
            Files.deleteIfExists(path);
        } catch (IOException exception) {
            throw new IllegalStateException("Could not clean isolated test data: " + path, exception);
        }
    }
}
