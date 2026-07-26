package app;

import features.campaign.CampaignFeature;
import features.campaign.api.CampaignRegistryApi;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.time.Duration;
import java.util.concurrent.CompletionStage;
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

    private enum State { OPEN, STOPPING, CLOSED }

    private static final Duration DEFAULT_SHUTDOWN_TIMEOUT = Duration.ofSeconds(10);

    private final SerialExecutionLane registryLane;
    private final SqliteDatabase database;
    private final CampaignRegistryApi campaigns;
    private final CampaignFeature.Component campaignFeature;
    private final SharedReferences references;
    private final Duration shutdownTimeout;
    private volatile State state = State.OPEN;

    private InstallationRuntime(
            SerialExecutionLane registryLane,
            SqliteDatabase database,
            CampaignFeature.Component campaignFeature,
            SharedReferences references,
            Duration shutdownTimeout) {
        this.registryLane = registryLane;
        this.database = database;
        this.campaignFeature = campaignFeature;
        this.campaigns = campaignFeature.registry();
        this.references = references;
        this.shutdownTimeout = shutdownTimeout;
    }

    static InstallationRuntime open(
            Diagnostics diagnostics,
            SqliteDatabase database) {
        return open(diagnostics, database, DEFAULT_SHUTDOWN_TIMEOUT);
    }

    static InstallationRuntime open(
            Diagnostics diagnostics,
            SqliteDatabase database,
            Duration shutdownTimeout) {
        Diagnostics safeDiagnostics = Objects.requireNonNull(diagnostics, "diagnostics");
        SqliteDatabase safeDatabase = Objects.requireNonNull(database, "database");
        Duration safeShutdownTimeout = Objects.requireNonNull(shutdownTimeout, "shutdownTimeout");
        if (safeShutdownTimeout.isNegative()) {
            throw new IllegalArgumentException("shutdownTimeout must not be negative");
        }
        SerialExecutionLane registryLane = new SerialExecutionLane(safeDiagnostics);
        try {
            InstallationStoreManifest.Stores stores = InstallationStoreManifest.register(safeDatabase);
            Map<String, FeatureStoreReadiness> readiness = safeDatabase.prepareRegisteredStores();
            requireReady(stores.owners(), readiness);
            CampaignFeature.Component campaignFeature = CampaignFeature.compose(
                    safeDiagnostics, registryLane, stores.campaignRegistry());
            InstallationRuntime runtime = new InstallationRuntime(
                    registryLane,
                    safeDatabase,
                    campaignFeature,
                    new SharedReferences(stores.creatures(), stores.items()),
                    safeShutdownTimeout);
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

    void runRegistryTaskForTesting(Runnable task) {
        requireOpen();
        registryLane.execute(Objects.requireNonNull(task, "task"));
    }

    boolean stoppingForTesting() {
        return state == State.STOPPING;
    }

    boolean registryOperationActiveForTesting() {
        return campaignFeature.operationActive();
    }

    CompletionStage<Void> shutdownSettlement() {
        return registryLane.termination();
    }

    private void requireOpen() {
        if (state != State.OPEN) {
            throw new IllegalStateException("Installation runtime is closed");
        }
    }

    @Override
    public synchronized void close() {
        if (state == State.CLOSED) {
            return;
        }
        state = State.STOPPING;
        campaignFeature.requestTerminalShutdown();
        SerialExecutionLane.TerminationResult termination =
                registryLane.terminateNow(shutdownTimeout);
        if (termination != SerialExecutionLane.TerminationResult.TERMINATED) {
            throw new IllegalStateException(
                    "Installation registry termination was " + termination);
        }
        Throwable failure = null;
        try {
            database.close();
        } catch (RuntimeException | Error databaseFailure) {
            failure = accumulate(failure, databaseFailure);
        }
        if (failure != null) {
            rethrow(failure);
        }
        state = State.CLOSED;
    }

    private static Throwable accumulate(Throwable current, Throwable next) {
        if (current == null) {
            return next;
        }
        current.addSuppressed(next);
        return current;
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
