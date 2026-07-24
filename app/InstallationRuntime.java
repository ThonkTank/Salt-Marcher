package app;

import features.campaign.CampaignFeature;
import features.campaign.api.CampaignRegistryApi;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import platform.diagnostics.Diagnostics;
import platform.execution.SerialExecutionLane;
import platform.persistence.FeatureStoreHandle;
import platform.persistence.FeatureStoreReadiness;
import platform.persistence.SqliteDatabase;

/**
 * Installation lifetime for registry and reusable definition capabilities.
 *
 * <p>Campaign runtimes borrow only the narrow shared-definition store handles. Each Campaign
 * composes and owns its own feature components, published state, UI dispatch, and execution lanes.
 */
final class InstallationRuntime implements AutoCloseable {

    private final SerialExecutionLane registryLane;
    private final SqliteDatabase database;
    private final CampaignRegistryApi campaigns;
    private final SharedReferences references;
    private volatile boolean closed;

    private InstallationRuntime(
            SerialExecutionLane registryLane,
            SqliteDatabase database,
            CampaignRegistryApi campaigns,
            SharedReferences references) {
        this.registryLane = registryLane;
        this.database = database;
        this.campaigns = campaigns;
        this.references = references;
    }

    static InstallationRuntime open(
            Diagnostics diagnostics,
            SqliteDatabase database) {
        Diagnostics safeDiagnostics = Objects.requireNonNull(diagnostics, "diagnostics");
        SqliteDatabase safeDatabase = Objects.requireNonNull(database, "database");
        SerialExecutionLane registryLane = new SerialExecutionLane(safeDiagnostics);
        try {
            InstallationStoreManifest.Stores stores = InstallationStoreManifest.register(safeDatabase);
            Map<String, FeatureStoreReadiness> readiness = safeDatabase.prepareRegisteredStores();
            requireReady(stores.owners(), readiness);
            CampaignRegistryApi campaigns = CampaignFeature.compose(
                    safeDiagnostics, registryLane, stores.campaignRegistry()).registry();
            InstallationRuntime runtime = new InstallationRuntime(
                    registryLane,
                    safeDatabase,
                    campaigns,
                    new SharedReferences(stores.creatures(), stores.items()));
            return runtime;
        } catch (RuntimeException | Error failure) {
            Throwable cleanup = CampaignRuntime.closeOwnedResources(
                    registryLane,
                    java.util.List.of(),
                    safeDatabase,
                    null);
            if (cleanup != null) {
                failure.addSuppressed(cleanup);
            }
            throw failure;
        }
    }

    private static void requireReady(
            Set<String> expectedOwners,
            Map<String, FeatureStoreReadiness> readiness) {
        if (!readiness.keySet().equals(expectedOwners)
                || readiness.values().stream().anyMatch(value -> value != FeatureStoreReadiness.READY)) {
            throw new IllegalStateException("Installation storage is not ready: " + readiness);
        }
    }

    CampaignRegistryApi campaigns() {
        requireOpen();
        return campaigns;
    }

    SharedReferences references() {
        requireOpen();
        return references;
    }

    private void requireOpen() {
        if (closed) {
            throw new IllegalStateException("Installation runtime is closed");
        }
    }

    @Override
    public synchronized void close() {
        if (closed) {
            return;
        }
        closed = true;
        Throwable failure = CampaignRuntime.closeOwnedResources(
                registryLane,
                java.util.List.of(),
                database,
                null);
        if (failure != null) {
            rethrow(failure);
        }
    }

    private static void rethrow(Throwable failure) {
        if (failure instanceof RuntimeException runtimeFailure) {
            throw runtimeFailure;
        }
        if (failure instanceof Error error) {
            throw error;
        }
        throw new IllegalStateException("Installation runtime close failed", failure);
    }

    record SharedReferences(
            FeatureStoreHandle creatures,
            FeatureStoreHandle items) {

        SharedReferences {
            creatures = Objects.requireNonNull(creatures, "creatures");
            items = Objects.requireNonNull(items, "items");
        }
    }
}
