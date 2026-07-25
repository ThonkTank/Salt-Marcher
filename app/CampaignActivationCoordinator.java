package app;

import features.campaign.api.CampaignActivation;
import features.campaign.api.CampaignActiveResult;
import features.campaign.api.CampaignId;
import features.campaign.api.CampaignListResult;
import features.campaign.api.CampaignPointerCommitResult;
import features.campaign.api.CampaignReadResult;
import features.campaign.api.CampaignRegistryApi;
import features.campaign.api.CampaignSnapshot;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.nio.file.Path;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Supplier;
import org.jspecify.annotations.Nullable;
import platform.diagnostics.DiagnosticId;
import platform.diagnostics.Diagnostics;
import shell.host.AppShell;

/** Installation-owned authority and ownership boundary for whole-Campaign activation. */
final class CampaignActivationCoordinator implements AutoCloseable {

    private static final DiagnosticId PRE_COMMIT_FAILURE =
            new DiagnosticId("campaign.activation.pre-commit-failure");
    private static final DiagnosticId RECOVERY_REQUIRED =
            new DiagnosticId("campaign.activation.recovery-required");
    private static final DiagnosticId DETACHED_CLOSE_FAILURE =
            new DiagnosticId("campaign.activation.detached-close-failure");
    private static final int MAX_ID_RESERVATION_ATTEMPTS = 32;
    private static final int MAX_INVOCATION_WORKERS = 4;
    private static final Duration DEFAULT_PHASE_TIMEOUT = Duration.ofSeconds(10);

    enum Phase {
        IDLE,
        SWITCHING,
        ACTIVE,
        ACTIVE_DEGRADED,
        RECOVERY_REQUIRED,
        RECOVERY_UNPUBLISHED,
        CLOSE_FAILED,
        CLOSED
    }

    enum Status {
        ACTIVATED,
        ACTIVATED_DEGRADED,
        RESUMED,
        NO_ACTIVE_CAMPAIGN,
        INVALID_NAME,
        CAMPAIGN_NOT_FOUND,
        STALE_GENERATION,
        INVALID_GENERATION,
        REGISTRY_UNAVAILABLE,
        PRE_COMMIT_FAILED,
        RECOVERY_REQUIRED,
        RECOVERY_UNAVAILABLE,
        INVALID_STATE,
        CLOSED
    }

    enum OpenIntent { RESERVED_NEW, EXISTING_ONLY }

    enum RootSwitchResult { CAMPAIGN_ROOT_VISIBLE, RECOVERY_VISIBLE }

    record Snapshot(
            Phase phase,
            Optional<CampaignActivation> durableActivation,
            Optional<Path> campaignPath,
            Optional<Class<? extends Throwable>> failureType,
            Optional<String> failureMessage
    ) {
        Snapshot {
            phase = Objects.requireNonNull(phase, "phase");
            durableActivation = Objects.requireNonNull(durableActivation, "durableActivation");
            campaignPath = Objects.requireNonNull(campaignPath, "campaignPath");
            failureType = Objects.requireNonNull(failureType, "failureType");
            failureMessage = Objects.requireNonNull(failureMessage, "failureMessage");
        }

        static Snapshot idle() {
            return new Snapshot(
                    Phase.IDLE, Optional.empty(), Optional.empty(), Optional.empty(), Optional.empty());
        }
    }

    record Result(
            Status status,
            Optional<CampaignActivation> durableActivation,
            Optional<Path> campaignPath,
            Optional<Class<? extends Throwable>> failureType,
            Optional<String> failureMessage
    ) {
        Result {
            status = Objects.requireNonNull(status, "status");
            durableActivation = Objects.requireNonNull(durableActivation, "durableActivation");
            campaignPath = Objects.requireNonNull(campaignPath, "campaignPath");
            failureType = Objects.requireNonNull(failureType, "failureType");
            failureMessage = Objects.requireNonNull(failureMessage, "failureMessage");
        }
    }

    interface Candidate {
        AppShell shell();

        CampaignRuntime runtimeForTesting();

        CompletionStage<Void> pauseAndDrain();

        void resumeAdmission();

        CampaignRuntime.CandidatePreparation<Boolean> preparePublication(
                Supplier<Boolean> publication);

        CompletionStage<Void> dispatchUiTracked(
                Runnable work,
                java.util.function.Consumer<Throwable> terminalHandler);

        void activateVisibleShell();

        CompletionStage<Void> closeAsync();
    }

    @FunctionalInterface
    interface CandidateFactory {
        CompletionStage<? extends Candidate> prepare(
                CampaignId campaignId,
                Path campaignPath,
                OpenIntent intent);
    }

    @FunctionalInterface
    interface ReservationCleaner {
        void delete(Path directory) throws IOException;
    }

    /**
     * Owns the one visible application root. CAMPAIGN_ROOT_VISIBLE means that the complete root is
     * showing. Any partial swap must be replaced by a complete
     * recovery root before RECOVERY_VISIBLE is returned. switchCampaign runs on the owning
     * Campaign UI dispatcher and must perform only the short, non-blocking root replacement before
     * returning synchronously. showRecovery is thread-safe and completes only after that recovery
     * root is showing.
     */
    interface SwitchingHost {
        RootSwitchResult switchCampaign(
                CampaignSnapshot campaign,
                long generation,
                AppShell shell);

        CompletionStage<Void> showRecovery(
                Optional<CampaignActivation> durableActivation,
                Class<? extends Throwable> failureType);

        default void installSelectorAccess(AppShell shell) {
            // Non-production hosts may intentionally omit installation-level navigation.
        }
    }

    private final Diagnostics diagnostics;
    private final CampaignRegistryApi registry;
    private final Path campaignRoot;
    private final CandidateFactory candidateFactory;
    private final SwitchingHost host;
    private final Supplier<UUID> identities;
    private final long phaseTimeoutNanos;
    private volatile long terminalCloseTimeoutNanos;
    private final long commitTimeoutNanos;
    private final Runnable preCommitGate;
    private final ReservationCleaner reservationCleaner;
    private final Object lifecycle = new Object();
    private final AtomicReference<Thread> worker = new AtomicReference<>();
    private final ExecutorService transitions;
    private final ExecutorService invocations;
    private final List<DetachedCandidate> pendingClose = new ArrayList<>();
    private final List<CreateReservation> pendingCleanup = new ArrayList<>();
    private final CloseObligationTracker closeObligations = new CloseObligationTracker();
    private volatile boolean closeRequested;
    private volatile boolean terminalClosed;
    private CompletableFuture<Void> closeAttempt;
    private volatile Snapshot snapshot = Snapshot.idle();
    private volatile Runnable publicationSettlementGate = () -> { };
    private volatile Runnable publicationTimeoutGate = () -> { };
    private ActiveCampaign active;
    private RecoveryCampaign recovery;

    CampaignActivationCoordinator(
            Diagnostics diagnostics,
            CampaignRegistryApi registry,
            Path campaignRoot,
            CandidateFactory candidateFactory,
            SwitchingHost host
    ) {
        this(diagnostics, registry, campaignRoot, candidateFactory, host,
                UUID::randomUUID, DEFAULT_PHASE_TIMEOUT, DEFAULT_PHASE_TIMEOUT, () -> { });
    }

    CampaignActivationCoordinator(
            Diagnostics diagnostics,
            CampaignRegistryApi registry,
            Path campaignRoot,
            CandidateFactory candidateFactory,
            SwitchingHost host,
            Supplier<UUID> identities
    ) {
        this(diagnostics, registry, campaignRoot, candidateFactory, host,
                identities, DEFAULT_PHASE_TIMEOUT, DEFAULT_PHASE_TIMEOUT, () -> { });
    }

    CampaignActivationCoordinator(
            Diagnostics diagnostics,
            CampaignRegistryApi registry,
            Path campaignRoot,
            CandidateFactory candidateFactory,
            SwitchingHost host,
            Supplier<UUID> identities,
            Duration phaseTimeout
    ) {
        this(diagnostics, registry, campaignRoot, candidateFactory, host,
                identities, phaseTimeout, phaseTimeout, () -> { });
    }

    CampaignActivationCoordinator(
            Diagnostics diagnostics,
            CampaignRegistryApi registry,
            Path campaignRoot,
            CandidateFactory candidateFactory,
            SwitchingHost host,
            Supplier<UUID> identities,
            Duration phaseTimeout,
            Runnable preCommitGate
    ) {
        this(diagnostics, registry, campaignRoot, candidateFactory, host,
                identities, phaseTimeout, phaseTimeout, preCommitGate);
    }

    CampaignActivationCoordinator(
            Diagnostics diagnostics,
            CampaignRegistryApi registry,
            Path campaignRoot,
            CandidateFactory candidateFactory,
            SwitchingHost host,
            Supplier<UUID> identities,
            Duration phaseTimeout,
            Duration commitTimeout,
            Runnable preCommitGate
    ) {
        this(diagnostics, registry, campaignRoot, candidateFactory, host, identities,
                phaseTimeout, commitTimeout, preCommitGate,
                CampaignActivationCoordinator::deleteReservationTree);
    }

    CampaignActivationCoordinator(
            Diagnostics diagnostics,
            CampaignRegistryApi registry,
            Path campaignRoot,
            CandidateFactory candidateFactory,
            SwitchingHost host,
            Supplier<UUID> identities,
            Duration phaseTimeout,
            Duration commitTimeout,
            Runnable preCommitGate,
            ReservationCleaner reservationCleaner
    ) {
        this.diagnostics = Objects.requireNonNull(diagnostics, "diagnostics");
        this.registry = Objects.requireNonNull(registry, "registry");
        this.campaignRoot = Objects.requireNonNull(campaignRoot, "campaignRoot")
                .toAbsolutePath().normalize();
        this.candidateFactory = Objects.requireNonNull(candidateFactory, "candidateFactory");
        this.host = Objects.requireNonNull(host, "host");
        this.identities = Objects.requireNonNull(identities, "identities");
        Duration safeTimeout = Objects.requireNonNull(phaseTimeout, "phaseTimeout");
        if (safeTimeout.isZero() || safeTimeout.isNegative()) {
            throw new IllegalArgumentException("phaseTimeout must be positive");
        }
        phaseTimeoutNanos = safeTimeout.toNanos();
        terminalCloseTimeoutNanos = phaseTimeoutNanos;
        Duration safeCommitTimeout = Objects.requireNonNull(commitTimeout, "commitTimeout");
        if (safeCommitTimeout.isZero() || safeCommitTimeout.isNegative()) {
            throw new IllegalArgumentException("commitTimeout must be positive");
        }
        commitTimeoutNanos = safeCommitTimeout.toNanos();
        this.preCommitGate = Objects.requireNonNull(preCommitGate, "preCommitGate");
        this.reservationCleaner = Objects.requireNonNull(reservationCleaner, "reservationCleaner");
        transitions = Executors.newSingleThreadExecutor(task -> {
            Thread thread = new Thread(task, "salt-marcher-campaign-activation");
            thread.setDaemon(true);
            worker.set(thread);
            return thread;
        });
        invocations = new java.util.concurrent.ThreadPoolExecutor(
                0,
                MAX_INVOCATION_WORKERS,
                30L,
                TimeUnit.SECONDS,
                new java.util.concurrent.SynchronousQueue<>(),
                task -> {
                    Thread thread = new Thread(task, "salt-marcher-campaign-invocation");
                    thread.setDaemon(true);
                    return thread;
                },
                new java.util.concurrent.ThreadPoolExecutor.AbortPolicy());
    }

    CompletionStage<Result> create(String name, long expectedGeneration) {
        return submitNormal(() -> createSerialized(name, expectedGeneration));
    }

    CompletionStage<Result> switchTo(CampaignId campaignId, long expectedGeneration) {
        CampaignId safeId = Objects.requireNonNull(campaignId, "campaignId");
        return submitNormal(() -> {
            ActiveCampaign current = active;
            if (current != null
                    && current.activation().campaign().orElseThrow().id().equals(safeId)) {
                return result(current.activation().generation() == expectedGeneration
                        ? (degraded() ? Status.ACTIVATED_DEGRADED : Status.ACTIVATED)
                        : Status.STALE_GENERATION);
            }
            CampaignReadResult read = await(registry.read(safeId));
            if (read.status() == CampaignReadResult.Status.STORAGE_ERROR) {
                return result(Status.REGISTRY_UNAVAILABLE);
            }
            if (read.status() == CampaignReadResult.Status.NOT_FOUND) {
                return result(Status.CAMPAIGN_NOT_FOUND);
            }
            CampaignSnapshot target = read.campaign().orElseThrow();
            Path path = pathFor(target.id());
            try {
                assertExistingCampaignPath(path);
            } catch (RuntimeException failure) {
                report(PRE_COMMIT_FAILURE, failure);
                restoreActiveSnapshot(failure);
                return result(Status.PRE_COMMIT_FAILED);
            }
            return activate(target, expectedGeneration, path, null, OpenIntent.EXISTING_ONLY);
        });
    }

    CompletionStage<Result> switchFromRecovery(
            CampaignId campaignId,
            long expectedGeneration
    ) {
        CampaignId safeId = Objects.requireNonNull(campaignId, "campaignId");
        return submitRecovery(() -> switchFromRecoverySerialized(safeId, expectedGeneration));
    }

    CompletionStage<CampaignListResult> listCampaigns() {
        return registry.list();
    }

    CompletionStage<CampaignActiveResult> readDurableActiveCampaign() {
        return registry.active();
    }

    CompletionStage<Result> resumeDurableActive() {
        return submitNormal(() -> {
            if (active != null) {
                return result(Status.INVALID_STATE);
            }
            CampaignActiveResult read = readActive();
            if (read.status() != CampaignActiveResult.Status.SUCCESS) {
                return result(Status.REGISTRY_UNAVAILABLE);
            }
            CampaignActivation durable = read.activation().orElseThrow();
            if (durable.campaign().isEmpty()) {
                snapshot = Snapshot.idle();
                return result(Status.NO_ACTIVE_CAMPAIGN);
            }
            return openDurable(durable);
        });
    }

    CompletionStage<Result> recoverDurableActive() {
        return submitRecovery(() -> {
            RecoveryCampaign pending = recovery;
            if (pending == null || (snapshot.phase() != Phase.RECOVERY_REQUIRED
                    && snapshot.phase() != Phase.RECOVERY_UNPUBLISHED)) {
                return result(Status.INVALID_STATE);
            }
            if (pending.pendingPreparation() != null) {
                if (!pending.pendingPreparation().toCompletableFuture().isDone()) {
                    keepContainedRecovery(pending,
                            new StageTimeoutException("Campaign preparation is still in flight"));
                    return result(recoveryStatus());
                }
                Candidate lateCandidate = null;
                Throwable preparationFailure = null;
                try {
                    lateCandidate = pending.pendingPreparation().toCompletableFuture().join();
                } catch (RuntimeException | Error failure) {
                    preparationFailure = unwrap(failure);
                }
                if (lateCandidate != null
                        && !closeDetached(lateCandidate, pending.reservation(),
                                CleanupAuthority.DELETE_RESERVATION)) {
                    keepContainedRecovery(pending, new IllegalStateException(
                            "Late Campaign candidate is not contained yet"));
                    return result(recoveryStatus());
                }
                cleanupReservation(pending.reservation());
                if (pending.prior() != null) {
                    if (pending.priorPaused()) {
                        pending.prior().candidate().resumeAdmission();
                    }
                    active = pending.prior();
                    recovery = null;
                    snapshot = activeSnapshot(active, degraded());
                    return result(Status.RESUMED);
                }
                if (pending.durable().isEmpty()) {
                    recovery = null;
                    Throwable failure = preparationFailure == null
                            ? new StageTimeoutException("Late Campaign preparation was discarded")
                            : preparationFailure;
                    restoreActiveSnapshot(failure);
                    return result(Status.PRE_COMMIT_FAILED);
                }
                pending = withoutPendingStages(pending, null);
                recovery = pending;
            }
            if (pending.pendingDrain() != null) {
                if (!pending.pendingDrain().toCompletableFuture().isDone()) {
                    keepContainedRecovery(pending,
                            new StageTimeoutException("Prior Campaign drain is still in flight"));
                    return result(recoveryStatus());
                }
                Throwable drainFailure = terminalFailure(pending.pendingDrain());
                if (!closeDetached(pending.candidate(), pending.reservation(),
                        CleanupAuthority.DELETE_RESERVATION)) {
                    keepContainedRecovery(pending, new IllegalStateException(
                            "Target Campaign candidate is not contained yet"));
                    return result(recoveryStatus());
                }
                cleanupReservation(pending.reservation());
                if (drainFailure == null) {
                    if (pending.priorPaused()) {
                        pending.prior().candidate().resumeAdmission();
                    }
                    active = pending.prior();
                    recovery = null;
                    snapshot = activeSnapshot(active, degraded());
                    return result(Status.RESUMED);
                }
                closeDetached(pending.prior().candidate(), null,
                        CleanupAuthority.RETAIN_RESERVATION);
                active = null;
                ActiveCampaign prior = pending.prior();
                return result(enterRecovery(
                        Optional.of(prior.activation()),
                        prior.activation().campaign().orElseThrow(),
                        prior.path(), null, null, null, drainFailure, false));
            }
            if (pending.pendingCommit() != null
                    && !pending.pendingCommit().toCompletableFuture().isDone()) {
                keepContainedRecovery(pending, new StageTimeoutException(
                        "Campaign pointer commit is still in flight"));
                return result(recoveryStatus());
            }
            if (pending.pendingPublication() != null) {
                if (!pending.pendingPublication().toCompletableFuture().isDone()) {
                    keepContainedRecovery(pending,
                            new StageTimeoutException("Campaign publication is still in flight"));
                    return result(recoveryStatus());
                }
                Throwable publicationFailure = terminalFailure(pending.pendingPublication());
                if (publicationFailure == null) {
                    ActiveCampaign selected = new ActiveCampaign(
                            pending.durable().orElseThrow(), pending.path(), pending.candidate());
                    active = selected;
                    recovery = null;
                    snapshot = activeSnapshot(selected, degraded());
                    return result(Status.RESUMED);
                }
                pending = withoutPendingPublication(pending);
                recovery = pending;
            }
            if (pending.pendingRecoveryPublication() != null) {
                if (!pending.pendingRecoveryPublication().toCompletableFuture().isDone()) {
                    keepContainedRecovery(pending,
                            new StageTimeoutException("Recovery publication is still in flight"));
                    return result(recoveryStatus());
                }
                Throwable recoveryFailure = terminalFailure(
                        pending.pendingRecoveryPublication());
                if (recoveryFailure != null) {
                    pending = withoutPendingRecoveryPublication(pending);
                    keepContainedRecovery(pending, recoveryFailure);
                    return result(recoveryStatus());
                }
                pending = withoutPendingStages(pending, pending.candidate());
                recovery = pending;
                snapshot = new Snapshot(
                        Phase.RECOVERY_REQUIRED,
                        pending.durable(),
                        Optional.of(pending.path()),
                        Optional.empty(),
                        Optional.empty());
            }
            CampaignActiveResult read = readActive();
            if (read.status() != CampaignActiveResult.Status.SUCCESS) {
                keepRecovery(pending, new IllegalStateException("durable Campaign pointer is unreadable"));
                return result(recoveryStatus());
            }
            CampaignActivation durable = read.activation().orElseThrow();
            if (pending.prior() != null && durable.equals(pending.prior().activation())) {
                if (closeDetached(pending.candidate(), pending.reservation(),
                        CleanupAuthority.DELETE_RESERVATION)) {
                    cleanupReservation(pending.reservation());
                }
                if (pending.priorPaused()) {
                    pending.prior().candidate().resumeAdmission();
                }
                active = pending.prior();
                recovery = null;
                snapshot = activeSnapshot(active, degraded());
                return result(Status.RESUMED);
            }
            if (pending.target() == null || !pointsTo(durable, pending.target())) {
                keepRecovery(pending, new IllegalStateException("durable pointer selects another Campaign"));
                return result(recoveryStatus());
            }
            Candidate candidate = pending.candidate();
            try {
                Path path = pending.path();
                if (candidate == null) {
                    assertExistingCampaignPath(path);
                    candidate = prepare(pending.target().id(), path, OpenIntent.EXISTING_ONLY);
                }
                ActiveCampaign selected = new ActiveCampaign(durable, path, candidate);
                recovery = new RecoveryCampaign(
                        Optional.of(durable), pending.target(), path, candidate,
                        pending.prior(), pending.priorPaused(), pending.reservation(), false,
                        null, null, null, null, null);
                publishAndActivate(selected);
                active = selected;
                recovery = null;
                snapshot = activeSnapshot(selected, degraded());
                return result(degraded() ? Status.ACTIVATED_DEGRADED : Status.RESUMED);
            } catch (RuntimeException | Error failure) {
                enterRecovery(
                        Optional.of(durable), pending.target(), pending.path(), candidate, pending.prior(),
                        pending.reservation(), failure, false);
                return result(recoveryStatus());
            }
        });
    }

    Snapshot snapshot() {
        return snapshot;
    }

    @Nullable CompletionStage<Void> terminalCloseSettlement() {
        RecoveryCampaign pending = recovery;
        if (pending != null) {
            observeTerminalSettlement(pending.pendingCommit());
            observeTerminalSettlement(pending.pendingPreparation());
            observeTerminalSettlement(pending.pendingDrain());
            observeTerminalSettlement(pending.pendingPublication());
            observeTerminalSettlement(pending.pendingRecoveryPublication());
        }
        return closeObligations.whenAllTerminal();
    }

    private void observeTerminalSettlement(@Nullable CompletionStage<?> stage) {
        if (stage != null) {
            closeObligations.register(stage);
        }
    }

    CampaignRuntime activeRuntimeForTesting() {
        ActiveCampaign current = active;
        if (current == null) {
            throw new IllegalStateException("No Campaign runtime is active");
        }
        return current.candidate().runtimeForTesting();
    }

    void installPublicationSettlementGateForTesting(Runnable gate) {
        publicationSettlementGate = Objects.requireNonNull(gate, "gate");
    }

    void installPublicationTimeoutGateForTesting(Runnable gate) {
        publicationTimeoutGate = Objects.requireNonNull(gate, "gate");
    }

    void installTerminalCloseTimeoutForTesting(Duration timeout) {
        Duration safeTimeout = Objects.requireNonNull(timeout, "timeout");
        if (safeTimeout.isZero() || safeTimeout.isNegative()) {
            throw new IllegalArgumentException("timeout must be positive");
        }
        terminalCloseTimeoutNanos = safeTimeout.toNanos();
    }

    int invocationWorkersForTesting() {
        return ((java.util.concurrent.ThreadPoolExecutor) invocations).getPoolSize();
    }

    private Result createSerialized(String name, long expectedGeneration) {
        CreateReservation reservation;
        try {
            reservation = reserveNewCampaign();
        } catch (RuntimeException failure) {
            report(PRE_COMMIT_FAILURE, failure);
            restoreActiveSnapshot(failure);
            return result(Status.PRE_COMMIT_FAILED);
        }
        CampaignSnapshot target;
        try {
            target = new CampaignSnapshot(reservation.campaignId(), Objects.requireNonNull(name, "name"));
        } catch (NullPointerException | IllegalArgumentException invalidName) {
            cleanupReservation(reservation);
            return result(Status.INVALID_NAME);
        }
        return activate(
                target,
                expectedGeneration,
                reservation.path(),
                reservation,
                OpenIntent.RESERVED_NEW);
    }

    private Result switchFromRecoverySerialized(
            CampaignId campaignId,
            long expectedGeneration
    ) {
        RecoveryCampaign trapped = recovery;
        if (trapped == null || (snapshot.phase() != Phase.RECOVERY_REQUIRED
                && snapshot.phase() != Phase.RECOVERY_UNPUBLISHED)) {
            return result(Status.INVALID_STATE);
        }
        if (hasContainedStage(trapped)) {
            keepRecovery(trapped, new IllegalStateException(
                    "The damaged Campaign transition must settle before another Campaign opens"));
            return result(recoveryStatus());
        }
        if (trapped.target().id().equals(campaignId)) {
            return result(Status.INVALID_STATE);
        }

        CampaignActiveResult activeRead = readActive();
        if (activeRead.status() != CampaignActiveResult.Status.SUCCESS) {
            keepRecovery(trapped, new IllegalStateException(
                    "durable Campaign pointer is unreadable"));
            return result(recoveryStatus());
        }
        CampaignActivation durable = activeRead.activation().orElseThrow();
        if (durable.generation() != expectedGeneration) {
            return result(Status.STALE_GENERATION);
        }

        CampaignReadResult targetRead = await(registry.read(campaignId));
        if (targetRead.status() == CampaignReadResult.Status.STORAGE_ERROR) {
            return result(Status.REGISTRY_UNAVAILABLE);
        }
        if (targetRead.status() == CampaignReadResult.Status.NOT_FOUND) {
            return result(Status.CAMPAIGN_NOT_FOUND);
        }
        CampaignSnapshot target = targetRead.campaign().orElseThrow();
        Path targetPath = pathFor(target.id());
        try {
            assertExistingCampaignPath(targetPath);
        } catch (RuntimeException failure) {
            report(PRE_COMMIT_FAILURE, failure);
            return result(Status.PRE_COMMIT_FAILED);
        }

        ActiveCampaign trappedActive = active;
        Snapshot trappedSnapshot = snapshot;
        recovery = null;
        active = null;
        Result outcome = activate(
                target,
                expectedGeneration,
                targetPath,
                null,
                OpenIntent.EXISTING_ONLY);
        if (outcome.status() == Status.ACTIVATED
                || outcome.status() == Status.ACTIVATED_DEGRADED
                || recovery != null) {
            retireAbandonedRecovery(trapped, trappedActive);
            return outcome;
        }

        recovery = trapped;
        active = trappedActive;
        snapshot = trappedSnapshot;
        return result(outcome.status());
    }

    private void retireAbandonedRecovery(
            RecoveryCampaign trapped,
            @Nullable ActiveCampaign trappedActive
    ) {
        java.util.Set<Candidate> retired = java.util.Collections.newSetFromMap(
                new java.util.IdentityHashMap<>());
        if (trapped.candidate() != null && retired.add(trapped.candidate())) {
            closeDetached(trapped.candidate(), null, CleanupAuthority.RETAIN_RESERVATION);
        }
        if (trapped.prior() != null && retired.add(trapped.prior().candidate())) {
            closeDetached(
                    trapped.prior().candidate(), null, CleanupAuthority.RETAIN_RESERVATION);
        }
        if (trappedActive != null && retired.add(trappedActive.candidate())) {
            closeDetached(trappedActive.candidate(), null, CleanupAuthority.RETAIN_RESERVATION);
        }
    }

    private Result openDurable(CampaignActivation durable) {
        CampaignSnapshot target = durable.campaign().orElseThrow();
        Path path = pathFor(target.id());
        snapshot = switching(Optional.of(durable), path);
        Candidate candidate = null;
        try {
            assertExistingCampaignPath(path);
            CompletionStage<? extends Candidate> preparation =
                    invokeStage(() -> candidateFactory.prepare(
                            target.id(), path, OpenIntent.EXISTING_ONLY));
            try {
                candidate = await(preparation);
            } catch (StageTimeoutException timeout) {
                return result(enterContainedRecovery(
                        Optional.of(durable), target, path, null, null, null, timeout,
                        null, preparation, null, null));
            }
            ActiveCampaign resumed = new ActiveCampaign(durable, path, candidate);
            publishAndActivate(resumed);
            active = resumed;
            snapshot = activeSnapshot(resumed, degraded());
            return result(Status.RESUMED);
        } catch (RuntimeException | Error failure) {
            return result(enterRecovery(
                    Optional.of(durable), target, path, candidate, null, null, failure, false));
        }
    }

    private Result activate(
            CampaignSnapshot target,
            long expectedGeneration,
            Path targetPath,
            @Nullable CreateReservation reservation,
            OpenIntent intent
    ) {
        ActiveCampaign prior = active;
        snapshot = switching(
                prior == null ? Optional.empty() : Optional.of(prior.activation()), targetPath);
        CompletionStage<? extends Candidate> preparation;
        try {
            preparation = invokeStage(() -> candidateFactory.prepare(
                    target.id(), targetPath, intent));
        } catch (RuntimeException | Error failure) {
            if (intent == OpenIntent.EXISTING_ONLY) {
                report(PRE_COMMIT_FAILURE, failure);
                restoreActiveSnapshot(failure);
                return result(Status.PRE_COMMIT_FAILED);
            }
            cleanupBeforeCommit(null, reservation);
            report(PRE_COMMIT_FAILURE, failure);
            restoreActiveSnapshot(failure);
            return result(Status.PRE_COMMIT_FAILED);
        }
        Candidate candidate;
        try {
            candidate = await(preparation);
        } catch (StageTimeoutException timeout) {
            return result(enterContainedRecovery(
                    prior == null ? Optional.empty() : Optional.of(prior.activation()),
                    target, targetPath, null, prior, reservation, timeout,
                    null, preparation, null, null));
        } catch (RuntimeException | Error failure) {
            if (intent == OpenIntent.EXISTING_ONLY) {
                report(PRE_COMMIT_FAILURE, failure);
                restoreActiveSnapshot(failure);
                return result(Status.PRE_COMMIT_FAILED);
            }
            cleanupBeforeCommit(null, reservation);
            report(PRE_COMMIT_FAILURE, failure);
            restoreActiveSnapshot(failure);
            return result(Status.PRE_COMMIT_FAILED);
        }

        CompletionStage<Void> priorDrain = null;
        try {
            if (prior != null) {
                priorDrain = invokeStage(prior.candidate()::pauseAndDrain);
                await(priorDrain);
            }
        } catch (StageTimeoutException timeout) {
            return result(enterContainedRecovery(
                    Optional.of(prior.activation()), target, targetPath, candidate, prior,
                    reservation, timeout, null, null, priorDrain, null));
        } catch (RuntimeException | Error failure) {
            cleanupBeforeCommit(candidate, reservation);
            resumeConfirmedPrior(prior, failure);
            report(PRE_COMMIT_FAILURE, failure);
            return result(Status.PRE_COMMIT_FAILED);
        }

        CompletionStage<CampaignPointerCommitResult> commitStage;
        try {
            preCommitGate.run();
            commitStage = intent == OpenIntent.RESERVED_NEW
                    ? registry.registerAndCommitActivePointer(
                            target.id(), target.name(), expectedGeneration)
                    : registry.commitActivePointer(target.id(), expectedGeneration);
        } catch (RuntimeException | Error failure) {
            return resolveAmbiguousCommit(target, targetPath, candidate, prior, reservation, failure);
        }
        CampaignPointerCommitResult committed;
        try {
            committed = await(commitStage, commitTimeoutNanos);
        } catch (StageTimeoutException timeout) {
            return result(enterContainedRecovery(
                    Optional.empty(), target, targetPath, candidate, prior, reservation,
                    timeout, commitStage, null, null, null));
        } catch (RuntimeException | Error failure) {
            return resolveAmbiguousCommit(target, targetPath, candidate, prior, reservation, failure);
        }
        if (committed.status() == CampaignPointerCommitResult.Status.STORAGE_ERROR) {
            return resolveAmbiguousCommit(
                    target,
                    targetPath,
                    candidate,
                    prior,
                    reservation,
                    new IllegalStateException("Campaign pointer commit outcome is ambiguous"));
        }
        if (committed.status() != CampaignPointerCommitResult.Status.COMMITTED) {
            cleanupBeforeCommit(candidate, reservation);
            resumeConfirmedPrior(prior, null);
            return result(pointerFailure(committed.status()));
        }
        return rollForward(
                committed.activation().orElseThrow(), targetPath, candidate, prior, reservation);
    }

    private Result resolveAmbiguousCommit(
            CampaignSnapshot target,
            Path targetPath,
            Candidate candidate,
            @Nullable ActiveCampaign prior,
            @Nullable CreateReservation reservation,
            Throwable failure
    ) {
        CampaignActiveResult read;
        try {
            read = readActive();
        } catch (RuntimeException | Error readFailure) {
            failure.addSuppressed(readFailure);
            return result(enterRecovery(
                    Optional.empty(), target, targetPath, candidate, prior, reservation, failure, true));
        }
        if (read.status() != CampaignActiveResult.Status.SUCCESS) {
            return result(enterRecovery(
                    Optional.empty(), target, targetPath, candidate, prior, reservation, failure, true));
        }
        CampaignActivation durable = read.activation().orElseThrow();
        if (prior != null && durable.equals(prior.activation())) {
            cleanupBeforeCommit(candidate, reservation);
            resumeConfirmedPrior(prior, failure);
            return result(Status.PRE_COMMIT_FAILED);
        }
        if (prior == null && durable.campaign().isEmpty()) {
            cleanupBeforeCommit(candidate, reservation);
            snapshot = Snapshot.idle();
            return result(Status.PRE_COMMIT_FAILED);
        }
        if (pointsTo(durable, target)) {
            return rollForward(durable, targetPath, candidate, prior, reservation);
        }
        return result(enterRecovery(
                Optional.of(durable), target, targetPath, candidate, prior, reservation, failure, true));
    }

    private Result rollForward(
            CampaignActivation durable,
            Path targetPath,
            Candidate candidate,
            @Nullable ActiveCampaign prior,
            @Nullable CreateReservation reservation
    ) {
        ActiveCampaign selected = new ActiveCampaign(durable, targetPath, candidate);
        active = null;
        snapshot = switching(Optional.of(durable), targetPath);
        try {
            publishAndActivate(selected);
            active = selected;
            closeDetached(prior == null ? null : prior.candidate(), null,
                    CleanupAuthority.RETAIN_RESERVATION);
            snapshot = activeSnapshot(selected, degraded());
            return result(degraded() ? Status.ACTIVATED_DEGRADED : Status.ACTIVATED);
        } catch (PublicationTimeoutException timeout) {
            closeDetached(prior == null ? null : prior.candidate(), null,
                    CleanupAuthority.RETAIN_RESERVATION);
            return result(enterPublicationTimeoutRecovery(
                    Optional.of(durable), durable.campaign().orElseThrow(), targetPath,
                    candidate, reservation, timeout));
        } catch (RuntimeException | Error failure) {
            closeDetached(prior == null ? null : prior.candidate(), null,
                    CleanupAuthority.RETAIN_RESERVATION);
            Status recoveryStatus = enterRecovery(
                    Optional.of(durable), durable.campaign().orElseThrow(), targetPath,
                    candidate, prior, reservation, failure, false);
            return result(recoveryStatus);
        }
    }

    private Candidate prepare(CampaignId campaignId, Path path, OpenIntent intent) {
        return await(invokeStage(() -> candidateFactory.prepare(campaignId, path, intent)));
    }

    private void publishAndActivate(ActiveCampaign selected) {
        CampaignSnapshot campaign = selected.activation().campaign().orElseThrow();
        CompletableFuture<Void> activated = new CompletableFuture<>();
        PublicationAttempt attempt = new PublicationAttempt(
                activated,
                publicationSettlementGate,
                () -> invokeStage(() -> host.showRecovery(
                        Optional.of(selected.activation()), PublicationTimeoutException.class)));
        CompletionStage<Void> publicationDispatch = invokeStage(
                () -> selected.candidate().dispatchUiTracked(() -> {
            CampaignRuntime.CandidatePreparation<Boolean> publication;
            try {
                attempt.requireAuthorized();
                publication = selected.candidate().preparePublication(() -> {
                    attempt.requireAuthorized();
                    attempt.markRootSwapMayHaveBegun();
                    RootSwitchResult switched = host.switchCampaign(
                            campaign,
                            selected.activation().generation(),
                            selected.candidate().shell());
                    attempt.requireAuthorized();
                    if (switched != RootSwitchResult.CAMPAIGN_ROOT_VISIBLE) {
                        throw new RecoveryVisibleException();
                    }
                    attempt.requireAuthorized();
                    return Boolean.TRUE;
                });
            } catch (RuntimeException | Error failure) {
                attempt.fail(failure);
                return;
            }
            publication.drained().whenComplete((ignored, drainFailure) -> {
                try {
                    attempt.requireAuthorized();
                } catch (RuntimeException | Error stale) {
                    attempt.fail(stale);
                    return;
                }
                if (drainFailure != null) {
                    attempt.fail(drainFailure);
                    return;
                }
                try {
                    attempt.requireAuthorized();
                } catch (RuntimeException | Error stale) {
                    attempt.fail(stale);
                    return;
                }
                invokeStage(() -> selected.candidate().dispatchUiTracked(() -> { },
                        activationFailure -> {
                            if (activationFailure == null) {
                                attempt.activateAndCommit(
                                        selected.candidate()::activateVisibleShell);
                            } else {
                                attempt.fail(activationFailure);
                            }
                        }));
            });
        }, failure -> {
            if (failure != null) {
                attempt.fail(failure);
            }
        }));
        attempt.trackRootSwapInvocation(publicationDispatch);
        try {
            await(activated);
        } catch (StageTimeoutException timeout) {
            publicationTimeoutGate.run();
            PublicationAttempt.TimeoutDecision decision = attempt.revokeForTimeout();
            if (decision.committed()) {
                attempt.observeCommitted();
                return;
            }
            CompletionStage<Void> recoveryPublication = decision.recoveryPublication();
            boolean recoveryVisible = false;
            if (recoveryPublication != null) {
                try {
                    await(recoveryPublication);
                    recoveryVisible = true;
                } catch (RuntimeException | Error recoveryFailure) {
                    timeout.addSuppressed(recoveryFailure);
                }
            }
            throw new PublicationTimeoutException(
                    activated,
                    recoveryPublication,
                    attempt.rootSwapMayHaveBegun(),
                    recoveryVisible,
                    timeout);
        } catch (RuntimeException | Error failure) {
            PublicationAttempt.TimeoutDecision decision = attempt.revokeForFailure(failure);
            if (decision.committed()) {
                attempt.observeCommitted();
                return;
            }
            CompletionStage<Void> recoveryPublication = decision.recoveryPublication();
            if (recoveryPublication == null) {
                throw failure;
            }
            boolean recoveryVisible = false;
            try {
                await(recoveryPublication);
                recoveryVisible = true;
            } catch (RuntimeException | Error recoveryFailure) {
                failure.addSuppressed(recoveryFailure);
            }
            throw new PublicationTimeoutException(
                    activated,
                    recoveryPublication,
                    true,
                    recoveryVisible,
                    failure);
        }
    }

    private Status enterPublicationTimeoutRecovery(
            Optional<CampaignActivation> durable,
            CampaignSnapshot target,
            Path path,
            Candidate candidate,
            @Nullable CreateReservation reservation,
            PublicationTimeoutException timeout
    ) {
        CompletionStage<Void> recoveryPublication = timeout.recoveryPublication();
        boolean recoveryVisible = timeout.recoveryVisible();
        if (recoveryVisible) {
            recoveryPublication = null;
        }
        recovery = new RecoveryCampaign(
                durable, target, path, candidate, null, false, reservation, true,
                null, null, null, timeout.publication(), recoveryPublication);
        Throwable root = unwrap(timeout);
        snapshot = new Snapshot(
                recoveryVisible ? Phase.RECOVERY_REQUIRED : Phase.RECOVERY_UNPUBLISHED,
                durable,
                Optional.of(path),
                Optional.of(root.getClass()),
                Optional.ofNullable(root.getMessage()));
        report(RECOVERY_REQUIRED, root);
        return recoveryVisible ? Status.RECOVERY_REQUIRED : Status.RECOVERY_UNAVAILABLE;
    }

    private Status enterRecovery(
            Optional<CampaignActivation> durable,
            CampaignSnapshot target,
            Path path,
            @Nullable Candidate candidate,
            @Nullable ActiveCampaign prior,
            @Nullable CreateReservation reservation,
            Throwable failure,
            boolean ambiguousCommit
    ) {
        return enterRecovery(
                durable, target, path, candidate, prior, reservation,
                failure, ambiguousCommit, null);
    }

    private Status enterRecovery(
            Optional<CampaignActivation> durable,
            CampaignSnapshot target,
            Path path,
            @Nullable Candidate candidate,
            @Nullable ActiveCampaign prior,
            @Nullable CreateReservation reservation,
            Throwable failure,
            boolean ambiguousCommit,
            @Nullable CompletionStage<CampaignPointerCommitResult> pendingCommit
    ) {
        recovery = new RecoveryCampaign(
                durable, target, path, candidate, prior, prior != null, reservation, ambiguousCommit,
                pendingCommit, null, null, null, null);
        Throwable root = unwrap(failure);
        boolean published = true;
        CompletionStage<Void> recoveryPublication = null;
        try {
            recoveryPublication = invokeStage(() -> host.showRecovery(durable, root.getClass()));
            await(recoveryPublication);
        } catch (RuntimeException | Error hostFailure) {
            root.addSuppressed(hostFailure);
            published = false;
            if (hostFailure instanceof StageTimeoutException && recoveryPublication != null) {
                recovery = new RecoveryCampaign(
                        durable, target, path, candidate, prior, prior != null,
                        reservation, ambiguousCommit,
                        pendingCommit, null, null, null, recoveryPublication);
            }
        }
        snapshot = new Snapshot(
                published ? Phase.RECOVERY_REQUIRED : Phase.RECOVERY_UNPUBLISHED,
                durable,
                Optional.of(path),
                Optional.of(root.getClass()),
                Optional.ofNullable(root.getMessage()));
        report(RECOVERY_REQUIRED, root);
        return published ? Status.RECOVERY_REQUIRED : Status.RECOVERY_UNAVAILABLE;
    }

    private Status enterContainedRecovery(
            Optional<CampaignActivation> durable,
            CampaignSnapshot target,
            Path path,
            @Nullable Candidate candidate,
            @Nullable ActiveCampaign prior,
            @Nullable CreateReservation reservation,
            Throwable failure,
            @Nullable CompletionStage<CampaignPointerCommitResult> pendingCommit,
            @Nullable CompletionStage<? extends Candidate> pendingPreparation,
            @Nullable CompletionStage<Void> pendingDrain,
            @Nullable CompletionStage<Void> pendingPublication
    ) {
        recovery = new RecoveryCampaign(
                durable, target, path, candidate, prior,
                prior != null && pendingPreparation == null, reservation, true,
                pendingCommit, pendingPreparation, pendingDrain, pendingPublication, null);
        Throwable root = unwrap(failure);
        snapshot = new Snapshot(
                Phase.RECOVERY_UNPUBLISHED,
                durable,
                Optional.of(path),
                Optional.of(root.getClass()),
                Optional.ofNullable(root.getMessage()));
        report(RECOVERY_REQUIRED, root);
        return Status.RECOVERY_UNAVAILABLE;
    }

    private void keepRecovery(RecoveryCampaign pending, Throwable failure) {
        recovery = pending;
        Throwable root = unwrap(failure);
        boolean published = true;
        try {
            await(invokeStage(() -> host.showRecovery(
                    pending.durable(), root.getClass())));
        } catch (RuntimeException | Error hostFailure) {
            root.addSuppressed(hostFailure);
            published = false;
        }
        snapshot = new Snapshot(
                published ? Phase.RECOVERY_REQUIRED : Phase.RECOVERY_UNPUBLISHED,
                pending.durable(),
                Optional.of(pending.path()),
                Optional.of(root.getClass()),
                Optional.ofNullable(root.getMessage()));
        report(RECOVERY_REQUIRED, root);
    }

    private void keepContainedRecovery(RecoveryCampaign pending, Throwable failure) {
        recovery = pending;
        Throwable root = unwrap(failure);
        snapshot = new Snapshot(
                Phase.RECOVERY_UNPUBLISHED,
                pending.durable(),
                Optional.of(pending.path()),
                Optional.of(root.getClass()),
                Optional.ofNullable(root.getMessage()));
        report(RECOVERY_REQUIRED, root);
    }

    private static RecoveryCampaign withoutPendingStages(
            RecoveryCampaign pending,
            @Nullable Candidate candidate
    ) {
        return new RecoveryCampaign(
                pending.durable(), pending.target(), pending.path(), candidate,
                pending.prior(), pending.priorPaused(), pending.reservation(),
                pending.ambiguousCommit(),
                null, null, null, null, null);
    }

    private static RecoveryCampaign withoutPendingPublication(RecoveryCampaign pending) {
        return new RecoveryCampaign(
                pending.durable(), pending.target(), pending.path(), pending.candidate(),
                pending.prior(), pending.priorPaused(), pending.reservation(),
                pending.ambiguousCommit(), pending.pendingCommit(), pending.pendingPreparation(),
                pending.pendingDrain(), null, pending.pendingRecoveryPublication());
    }

    private static RecoveryCampaign withoutPendingRecoveryPublication(RecoveryCampaign pending) {
        return new RecoveryCampaign(
                pending.durable(), pending.target(), pending.path(), pending.candidate(),
                pending.prior(), pending.priorPaused(), pending.reservation(),
                pending.ambiguousCommit(), pending.pendingCommit(), pending.pendingPreparation(),
                pending.pendingDrain(), pending.pendingPublication(), null);
    }

    private static Throwable terminalFailure(CompletionStage<?> stage) {
        try {
            stage.toCompletableFuture().join();
            return null;
        } catch (RuntimeException | Error failure) {
            return unwrap(failure);
        }
    }

    private void resumeConfirmedPrior(@Nullable ActiveCampaign prior, @Nullable Throwable failure) {
        if (prior == null) {
            snapshot = Snapshot.idle();
            return;
        }
        try {
            prior.candidate().resumeAdmission();
            active = prior;
            snapshot = activeSnapshot(prior, degraded());
        } catch (RuntimeException | Error resumeFailure) {
            if (failure != null && failure != resumeFailure) {
                failure.addSuppressed(resumeFailure);
            }
            enterRecovery(
                    Optional.of(prior.activation()), prior.activation().campaign().orElseThrow(),
                    prior.path(), prior.candidate(), prior,
                    null, resumeFailure, false);
        }
    }

    private void restoreActiveSnapshot(Throwable failure) {
        if (active == null) {
            Throwable root = unwrap(failure);
            snapshot = new Snapshot(
                    Phase.IDLE,
                    Optional.empty(),
                    Optional.empty(),
                    Optional.of(root.getClass()),
                    Optional.ofNullable(root.getMessage()));
        } else {
            snapshot = activeSnapshot(active, degraded());
        }
    }

    private void cleanupBeforeCommit(
            @Nullable Candidate candidate,
            @Nullable CreateReservation reservation
    ) {
        if (candidate == null) {
            cleanupReservation(reservation);
            return;
        }
        if (closeDetached(candidate, reservation, CleanupAuthority.DELETE_RESERVATION)) {
            cleanupReservation(reservation);
        }
    }

    private boolean closeDetached(
            @Nullable Candidate candidate,
            @Nullable CreateReservation reservation,
            CleanupAuthority cleanupAuthority
    ) {
        if (candidate == null) {
            return true;
        }
        CompletionStage<Void> closeStage = null;
        try {
            closeStage = invokeStage(candidate::closeAsync);
            await(closeStage, terminalCloseTimeoutNanos);
            pendingClose.removeIf(detached -> detached.candidate() == candidate);
            return true;
        } catch (RuntimeException | Error failure) {
            observeTerminalSettlement(closeStage);
            if (pendingClose.stream().noneMatch(detached -> detached.candidate() == candidate)) {
                pendingClose.add(new DetachedCandidate(candidate, reservation, cleanupAuthority));
            }
            report(DETACHED_CLOSE_FAILURE, failure);
            return false;
        }
    }

    private void retryDetachedClosures() {
        for (DetachedCandidate detached : List.copyOf(pendingClose)) {
            if (closeDetached(detached.candidate(), detached.reservation(),
                    detached.cleanupAuthority())) {
                cleanupIfAuthorized(detached.reservation(), detached.cleanupAuthority());
            }
        }
    }

    private void retryCleanupObligations() {
        for (CreateReservation reservation : List.copyOf(pendingCleanup)) {
            cleanupReservation(reservation);
        }
    }

    private boolean degraded() {
        return !pendingClose.isEmpty() || !pendingCleanup.isEmpty();
    }

    private void refreshActiveDegradationSnapshot() {
        if (active != null
                && (snapshot.phase() == Phase.ACTIVE
                        || snapshot.phase() == Phase.ACTIVE_DEGRADED)) {
            snapshot = activeSnapshot(active, degraded());
        }
    }

    private CreateReservation reserveNewCampaign() {
        try {
            assertCreatablePhysicalDirectory(campaignRoot);
            Files.createDirectories(campaignRoot);
            assertPhysicalCampaignPath(campaignRoot);
            for (int attempt = 0; attempt < MAX_ID_RESERVATION_ATTEMPTS; attempt++) {
                CampaignId id = new CampaignId(Objects.requireNonNull(identities.get(), "Campaign identity"));
                Path directory = campaignRoot.resolve(id.value().toString());
                try {
                    Files.createDirectory(directory);
                } catch (java.nio.file.FileAlreadyExistsException collision) {
                    continue;
                }
                Path path = directory.resolve("campaign.sqlite");
                try {
                    Files.createFile(path);
                    return new CreateReservation(id, directory, path);
                } catch (IOException failure) {
                    Files.deleteIfExists(directory);
                    throw failure;
                }
            }
            throw new IOException("Could not reserve a unique Campaign identity");
        } catch (IOException failure) {
            throw new CompletionException(failure);
        }
    }

    private static void assertCreatablePhysicalDirectory(Path directory) throws IOException {
        Path normalized = directory.toAbsolutePath().normalize();
        Path existing = normalized;
        while (existing != null && !Files.exists(existing, LinkOption.NOFOLLOW_LINKS)) {
            existing = existing.getParent();
        }
        if (existing == null
                || Files.isSymbolicLink(existing)
                || !Files.isDirectory(existing, LinkOption.NOFOLLOW_LINKS)
                || !existing.toRealPath().equals(existing)) {
            throw new IOException("Campaign root has a symbolic or non-physical ancestor");
        }
    }

    private void assertExistingCampaignPath(Path path) {
        Path directory = path.getParent();
        try {
            assertPhysicalCampaignPath(path);
            if (directory == null
                    || Files.isSymbolicLink(directory)
                    || !Files.isDirectory(directory, LinkOption.NOFOLLOW_LINKS)
                    || Files.isSymbolicLink(path)
                    || !Files.isRegularFile(path, LinkOption.NOFOLLOW_LINKS)
                    || Files.size(path) == 0L) {
                throw new IOException("Campaign database is missing, empty, or symbolic");
            }
        } catch (IOException failure) {
            throw new CompletionException(failure);
        }
    }

    private void assertPhysicalCampaignPath(Path target) throws IOException {
        Path normalizedTarget = target.toAbsolutePath().normalize();
        if (!normalizedTarget.startsWith(campaignRoot)
                || Files.isSymbolicLink(campaignRoot)
                || !Files.isDirectory(campaignRoot, LinkOption.NOFOLLOW_LINKS)
                || !campaignRoot.toRealPath().equals(campaignRoot)) {
            throw new IOException("Campaign root is symbolic, non-physical, or does not own target");
        }
        Path current = campaignRoot;
        for (Path segment : campaignRoot.relativize(normalizedTarget)) {
            current = current.resolve(segment);
            if (Files.exists(current, LinkOption.NOFOLLOW_LINKS)
                    && Files.isSymbolicLink(current)) {
                throw new IOException("Campaign path contains a symbolic-link ancestor");
            }
        }
    }

    private boolean cleanupReservation(@Nullable CreateReservation reservation) {
        if (reservation == null) {
            return true;
        }
        Path directory = reservation.directory().toAbsolutePath().normalize();
        if (!directory.startsWith(campaignRoot) || directory.equals(campaignRoot)) {
            throw new IllegalStateException("Campaign cleanup escaped its installation root");
        }
        if (!pendingCleanup.contains(reservation)) {
            pendingCleanup.add(reservation);
        }
        try {
            if (!Files.exists(directory, LinkOption.NOFOLLOW_LINKS)) {
                pendingCleanup.remove(reservation);
                return true;
            }
            if (!Files.isDirectory(directory, LinkOption.NOFOLLOW_LINKS)
                    || Files.isSymbolicLink(directory)) {
                throw new IOException("Campaign reservation is no longer a physical directory");
            }
            reservationCleaner.delete(directory);
            if (Files.exists(directory, LinkOption.NOFOLLOW_LINKS)) {
                throw new IOException("Campaign reservation cleanup did not remove its directory");
            }
            pendingCleanup.remove(reservation);
            return true;
        } catch (IOException | RuntimeException | Error failure) {
            refreshActiveDegradationSnapshot();
            report(PRE_COMMIT_FAILURE, failure);
            return false;
        }
    }

    private static void deleteReservationTree(Path directory) throws IOException {
        try (var files = Files.walk(directory)) {
            files.sorted(Comparator.reverseOrder()).forEach(path -> {
                try {
                    Files.deleteIfExists(path);
                } catch (IOException failure) {
                    throw new CompletionException(failure);
                }
            });
        } catch (CompletionException failure) {
            if (failure.getCause() instanceof IOException ioFailure) {
                throw ioFailure;
            }
            throw failure;
        }
    }

    private Path pathFor(CampaignId campaignId) {
        Path path = campaignRoot
                .resolve(campaignId.value().toString())
                .resolve("campaign.sqlite")
                .toAbsolutePath().normalize();
        if (!path.startsWith(campaignRoot)) {
            throw new IllegalStateException("Campaign path escaped its installation root");
        }
        return path;
    }

    private CompletionStage<Result> submitNormal(Supplier<Result> operation) {
        return submit(() -> {
            if (snapshot.phase() == Phase.RECOVERY_REQUIRED
                    || snapshot.phase() == Phase.RECOVERY_UNPUBLISHED) {
                return result(recoveryStatus());
            }
            retryDetachedClosures();
            retryCleanupObligations();
            refreshActiveDegradationSnapshot();
            return operation.get();
        });
    }

    private CompletionStage<Result> submitRecovery(Supplier<Result> operation) {
        return submit(operation);
    }

    private CompletionStage<Result> submit(Supplier<Result> operation) {
        CompletableFuture<Result> completion = new CompletableFuture<>();
        synchronized (lifecycle) {
            if (closeRequested) {
                completion.complete(result(Status.CLOSED));
                return completion;
            }
            try {
                transitions.execute(() -> {
                    try {
                        completion.complete(operation.get());
                    } catch (RuntimeException | Error failure) {
                        completion.completeExceptionally(failure);
                    }
                });
            } catch (RejectedExecutionException rejected) {
                completion.complete(result(Status.CLOSED));
            }
        }
        return completion;
    }

    private Result result(Status status) {
        Snapshot current = snapshot;
        return new Result(
                status,
                current.durableActivation(),
                current.campaignPath(),
                current.failureType(),
                current.failureMessage());
    }

    private Status recoveryStatus() {
        return snapshot.phase() == Phase.RECOVERY_UNPUBLISHED
                ? Status.RECOVERY_UNAVAILABLE
                : Status.RECOVERY_REQUIRED;
    }

    private static Snapshot switching(Optional<CampaignActivation> activation, Path path) {
        return new Snapshot(
                Phase.SWITCHING,
                activation,
                Optional.of(path),
                Optional.empty(),
                Optional.empty());
    }

    private static Snapshot activeSnapshot(ActiveCampaign current, boolean degraded) {
        return new Snapshot(
                degraded ? Phase.ACTIVE_DEGRADED : Phase.ACTIVE,
                Optional.of(current.activation()),
                Optional.of(current.path()),
                Optional.empty(),
                Optional.empty());
    }

    private static Status pointerFailure(CampaignPointerCommitResult.Status status) {
        return switch (status) {
            case STALE_GENERATION -> Status.STALE_GENERATION;
            case CAMPAIGN_NOT_FOUND -> Status.CAMPAIGN_NOT_FOUND;
            case INVALID_NAME -> Status.INVALID_NAME;
            case INVALID_GENERATION -> Status.INVALID_GENERATION;
            case STORAGE_ERROR -> Status.REGISTRY_UNAVAILABLE;
            case COMMITTED -> throw new IllegalArgumentException("Committed pointer is not a failure");
        };
    }

    private CampaignActiveResult readActive() {
        try {
            return await(registry.active());
        } catch (RuntimeException | Error failure) {
            report(RECOVERY_REQUIRED, failure);
            return new CampaignActiveResult(CampaignActiveResult.Status.STORAGE_ERROR, Optional.empty());
        }
    }

    private static boolean pointsTo(CampaignActivation activation, CampaignSnapshot target) {
        return activation.campaign().map(campaign -> campaign.id().equals(target.id())).orElse(false);
    }

    private void report(DiagnosticId id, Throwable failure) {
        Throwable root = unwrap(failure);
        diagnostics.failure(id, root.getClass());
    }

    private static Throwable unwrap(Throwable failure) {
        Throwable current = failure;
        while ((current instanceof CompletionException
                || current instanceof java.util.concurrent.ExecutionException)
                && current.getCause() != null) {
            current = current.getCause();
        }
        return current;
    }

    private <T> T await(CompletionStage<T> stage) {
        return await(stage, phaseTimeoutNanos);
    }

    private <T> CompletionStage<T> invokeValue(Supplier<T> invocation) {
        CompletableFuture<T> result = new CompletableFuture<>();
        try {
            invocations.execute(() -> {
                try {
                    result.complete(invocation.get());
                } catch (RuntimeException | Error failure) {
                    result.completeExceptionally(failure);
                }
            });
        } catch (RuntimeException | Error rejection) {
            result.completeExceptionally(rejection);
        }
        return result;
    }

    private <T> CompletionStage<T> invokeStage(
            Supplier<? extends CompletionStage<? extends T>> invocation
    ) {
        CompletableFuture<T> result = new CompletableFuture<>();
        try {
            invocations.execute(() -> {
                CompletionStage<? extends T> stage;
                try {
                    stage = Objects.requireNonNull(invocation.get(), "invocation stage");
                } catch (RuntimeException | Error failure) {
                    result.completeExceptionally(failure);
                    return;
                }
                stage.whenComplete((value, failure) -> {
                    if (failure == null) {
                        result.complete(value);
                    } else {
                        result.completeExceptionally(failure);
                    }
                });
            });
        } catch (RuntimeException | Error rejection) {
            result.completeExceptionally(rejection);
        }
        return result;
    }

    private static <T> T await(CompletionStage<T> stage, long timeoutNanos) {
        try {
            return Objects.requireNonNull(stage, "stage")
                    .toCompletableFuture()
                    .get(timeoutNanos, TimeUnit.NANOSECONDS);
        } catch (TimeoutException timeout) {
            throw new StageTimeoutException("Campaign activation phase timed out", timeout);
        } catch (InterruptedException interrupted) {
            Thread.currentThread().interrupt();
            throw new CompletionException(interrupted);
        } catch (java.util.concurrent.ExecutionException failure) {
            throw new CompletionException(failure.getCause());
        }
    }

    @Override
    public void close() {
        CompletableFuture<Void> completion;
        synchronized (lifecycle) {
            if (terminalClosed) {
                return;
            }
            if (closeAttempt != null) {
                completion = closeAttempt;
            } else {
                closeRequested = true;
                completion = new CompletableFuture<>();
                closeAttempt = completion;
                CompletableFuture<Void> ownedCompletion = completion;
                transitions.execute(() -> attemptTerminalClose(ownedCompletion));
            }
        }
        if (Thread.currentThread() != worker.get()) {
            completion.join();
            if (terminalClosed) {
                boolean interrupted = false;
                while (!transitions.isTerminated()) {
                    try {
                        transitions.awaitTermination(Long.MAX_VALUE, TimeUnit.NANOSECONDS);
                    } catch (InterruptedException interruption) {
                        interrupted = true;
                    }
                }
                if (interrupted) {
                    Thread.currentThread().interrupt();
                }
            }
        }
    }

    private void attemptTerminalClose(CompletableFuture<Void> completion) {
        if (recovery != null
                && hasNonterminalContainedStage(recovery)) {
            failTerminalClose(completion,
                    "Campaign coordinator retains in-flight activation work");
            return;
        }
        retryCleanupObligations();
        resolveTerminalPendingForClose();
        java.util.Set<Candidate> attempted = java.util.Collections.newSetFromMap(
                new java.util.IdentityHashMap<>());
        for (DetachedCandidate detached : List.copyOf(pendingClose)) {
            if (attempted.add(detached.candidate())
                    && closeDetached(detached.candidate(), detached.reservation(),
                            detached.cleanupAuthority())) {
                cleanupIfAuthorized(detached.reservation(), detached.cleanupAuthority());
            }
        }
        if (active != null && attempted.add(active.candidate())) {
            closeDetached(active.candidate(), null, CleanupAuthority.RETAIN_RESERVATION);
        }
        if (recovery != null) {
            if (recovery.candidate() != null && attempted.add(recovery.candidate())) {
                CleanupAuthority authority = terminalRecoveryCleanupAuthority(recovery);
                if (closeDetached(recovery.candidate(), recovery.reservation(), authority)) {
                    cleanupIfAuthorized(recovery.reservation(), authority);
                }
            }
            if (recovery.prior() != null && attempted.add(recovery.prior().candidate())) {
                closeDetached(recovery.prior().candidate(), null,
                        CleanupAuthority.RETAIN_RESERVATION);
            }
        }
        if (!pendingClose.isEmpty() || !pendingCleanup.isEmpty()) {
            failTerminalClose(completion,
                    "Campaign coordinator retains incomplete close or cleanup obligations");
            return;
        }
        active = null;
        recovery = null;
        snapshot = new Snapshot(
                Phase.CLOSED,
                Optional.empty(),
                Optional.empty(),
                Optional.empty(),
                Optional.empty());
        synchronized (lifecycle) {
            terminalClosed = true;
            closeAttempt = null;
        }
        completion.complete(null);
        invocations.shutdownNow();
        transitions.shutdown();
    }

    private void resolveTerminalPendingForClose() {
        RecoveryCampaign pending = recovery;
        if (pending == null) {
            return;
        }
        if (pending.pendingPreparation() != null) {
            Candidate lateCandidate = null;
            try {
                lateCandidate = pending.pendingPreparation().toCompletableFuture().join();
            } catch (RuntimeException | Error ignored) {
                // Terminal failure produced no candidate ownership.
            }
            if (lateCandidate != null) {
                if (closeDetached(lateCandidate, pending.reservation(),
                        CleanupAuthority.DELETE_RESERVATION)) {
                    cleanupReservation(pending.reservation());
                }
            }
            recovery = new RecoveryCampaign(
                    pending.durable(), pending.target(), pending.path(), null,
                    pending.prior(), pending.priorPaused(), pending.reservation(),
                    pending.ambiguousCommit(),
                    null, pending.pendingPreparation(), null, null, null);
            pending = recovery;
        }
        if (pending.pendingDrain() != null) {
            if (pending.candidate() != null) {
                if (closeDetached(pending.candidate(), pending.reservation(),
                        CleanupAuthority.DELETE_RESERVATION)) {
                    cleanupReservation(pending.reservation());
                }
            }
            recovery = new RecoveryCampaign(
                    pending.durable(), pending.target(), pending.path(), null,
                    pending.prior(), pending.priorPaused(), pending.reservation(),
                    pending.ambiguousCommit(),
                    null, null, null, null, null);
        }
    }

    private CleanupAuthority terminalRecoveryCleanupAuthority(RecoveryCampaign pending) {
        if (pending.pendingPreparation() != null || pending.pendingDrain() != null) {
            return CleanupAuthority.DELETE_RESERVATION;
        }
        if (pending.pendingCommit() == null) {
            return CleanupAuthority.RETAIN_RESERVATION;
        }
        CampaignPointerCommitResult commitResult;
        try {
            commitResult = pending.pendingCommit().toCompletableFuture().join();
        } catch (RuntimeException | Error failure) {
            return CleanupAuthority.RETAIN_RESERVATION;
        }
        return switch (commitResult.status()) {
            case STORAGE_ERROR, COMMITTED -> CleanupAuthority.RETAIN_RESERVATION;
            case STALE_GENERATION -> commitResult.activation()
                    .filter(activation -> pointsTo(activation, pending.target()))
                    .map(ignored -> CleanupAuthority.RETAIN_RESERVATION)
                    .orElse(CleanupAuthority.DELETE_RESERVATION);
            case CAMPAIGN_NOT_FOUND, INVALID_NAME, INVALID_GENERATION ->
                    CleanupAuthority.DELETE_RESERVATION;
        };
    }

    private void cleanupIfAuthorized(
            @Nullable CreateReservation reservation,
            CleanupAuthority cleanupAuthority
    ) {
        if (cleanupAuthority == CleanupAuthority.DELETE_RESERVATION) {
            cleanupReservation(reservation);
        }
    }

    private void failTerminalClose(CompletableFuture<Void> completion, String message) {
        IllegalStateException failure = new IllegalStateException(message);
        snapshot = new Snapshot(
                Phase.CLOSE_FAILED,
                snapshot.durableActivation(),
                snapshot.campaignPath(),
                Optional.of(failure.getClass()),
                Optional.of(failure.getMessage()));
        synchronized (lifecycle) {
            closeAttempt = null;
        }
        completion.completeExceptionally(failure);
    }

    private record ActiveCampaign(CampaignActivation activation, Path path, Candidate candidate) {
    }

    private record RecoveryCampaign(
            Optional<CampaignActivation> durable,
            CampaignSnapshot target,
            Path path,
            @Nullable Candidate candidate,
            @Nullable ActiveCampaign prior,
            boolean priorPaused,
            @Nullable CreateReservation reservation,
            boolean ambiguousCommit,
            @Nullable CompletionStage<CampaignPointerCommitResult> pendingCommit,
            @Nullable CompletionStage<? extends Candidate> pendingPreparation,
            @Nullable CompletionStage<Void> pendingDrain,
            @Nullable CompletionStage<Void> pendingPublication,
            @Nullable CompletionStage<Void> pendingRecoveryPublication
    ) {
    }

    private static boolean hasNonterminalContainedStage(RecoveryCampaign pending) {
        return (pending.pendingCommit() != null
                        && !pending.pendingCommit().toCompletableFuture().isDone())
                || (pending.pendingPreparation() != null
                        && !pending.pendingPreparation().toCompletableFuture().isDone())
                || (pending.pendingDrain() != null
                        && !pending.pendingDrain().toCompletableFuture().isDone())
                || (pending.pendingPublication() != null
                        && !pending.pendingPublication().toCompletableFuture().isDone())
                || (pending.pendingRecoveryPublication() != null
                        && !pending.pendingRecoveryPublication().toCompletableFuture().isDone());
    }

    private static boolean hasContainedStage(RecoveryCampaign pending) {
        return pending.pendingCommit() != null
                || pending.pendingPreparation() != null
                || pending.pendingDrain() != null
                || pending.pendingPublication() != null
                || pending.pendingRecoveryPublication() != null;
    }

    private record CreateReservation(CampaignId campaignId, Path directory, Path path) {
    }

    private enum CleanupAuthority { DELETE_RESERVATION, RETAIN_RESERVATION }

    private record DetachedCandidate(
            Candidate candidate,
            @Nullable CreateReservation reservation,
            CleanupAuthority cleanupAuthority) {
    }

    private static final class RecoveryVisibleException extends IllegalStateException {
        private RecoveryVisibleException() {
            super("whole-root host displayed recovery instead of the Campaign");
        }
    }

    private static final class StageTimeoutException extends IllegalStateException {
        private StageTimeoutException(String message) {
            super(message);
        }

        private StageTimeoutException(String message, Throwable cause) {
            super(message, cause);
        }
    }

    private static final class PublicationAttempt {
        private enum State { IN_FLIGHT, COMMITTED, REVOKED }

        private final CompletableFuture<Void> publication;
        private final Runnable settlementGate;
        private final java.util.concurrent.atomic.AtomicReference<State> state =
                new java.util.concurrent.atomic.AtomicReference<>(State.IN_FLIGHT);
        private final java.util.concurrent.atomic.AtomicBoolean rootSwapMayHaveBegun =
                new java.util.concurrent.atomic.AtomicBoolean();
        private final CompletableFuture<Void> rootSwapInvocationSettled = new CompletableFuture<>();
        private final Supplier<CompletionStage<Void>> recoveryPublisher;
        private @Nullable CompletionStage<Void> recoveryPublication;

        private PublicationAttempt(
                CompletableFuture<Void> publication,
                Runnable settlementGate,
                Supplier<CompletionStage<Void>> recoveryPublisher
        ) {
            this.publication = Objects.requireNonNull(publication, "publication");
            this.settlementGate = Objects.requireNonNull(settlementGate, "settlementGate");
            this.recoveryPublisher = Objects.requireNonNull(
                    recoveryPublisher, "recoveryPublisher");
        }

        private boolean authorized() {
            return state.get() == State.IN_FLIGHT;
        }

        private void requireAuthorized() {
            if (authorized()) {
                return;
            }
            forceRecoveryIfRootSwapMayHaveBegun();
            throw new StalePublicationException();
        }

        private void markRootSwapMayHaveBegun() {
            requireAuthorized();
            rootSwapMayHaveBegun.set(true);
            requireAuthorized();
        }

        private boolean rootSwapMayHaveBegun() {
            return rootSwapMayHaveBegun.get();
        }

        private void trackRootSwapInvocation(CompletionStage<?> invocation) {
            Objects.requireNonNull(invocation, "root-swap invocation");
            invocation.whenComplete((ignored, failure) -> rootSwapInvocationSettled.complete(null));
        }

        private void activateAndCommit(Runnable activation) {
            Objects.requireNonNull(activation, "activation");
            boolean stale = false;
            synchronized (this) {
                if (state.get() != State.IN_FLIGHT) {
                    stale = true;
                } else {
                    try {
                        settlementGate.run();
                        activation.run();
                        state.set(State.COMMITTED);
                        publication.complete(null);
                    } catch (RuntimeException | Error failure) {
                        state.set(State.REVOKED);
                        publication.completeExceptionally(failure);
                    }
                }
            }
            if (stale) {
                forceRecoveryIfRootSwapMayHaveBegun();
                publication.completeExceptionally(new StalePublicationException());
            }
        }

        private synchronized void fail(Throwable failure) {
            Objects.requireNonNull(failure, "failure");
            if (state.get() == State.COMMITTED) {
                return;
            }
            state.set(State.REVOKED);
            publication.completeExceptionally(failure);
        }

        private TimeoutDecision revokeForTimeout() {
            boolean committed;
            synchronized (this) {
                committed = state.get() == State.COMMITTED;
                if (!committed) {
                    state.set(State.REVOKED);
                }
            }
            return committed
                    ? new TimeoutDecision(true, null)
                    : new TimeoutDecision(false, forceRecoveryIfRootSwapMayHaveBegun());
        }

        private TimeoutDecision revokeForFailure(Throwable failure) {
            fail(failure);
            boolean committed = state.get() == State.COMMITTED;
            return committed
                    ? new TimeoutDecision(true, null)
                    : new TimeoutDecision(false, forceRecoveryIfRootSwapMayHaveBegun());
        }

        private void observeCommitted() {
            publication.join();
        }

        private @Nullable CompletionStage<Void> forceRecoveryIfRootSwapMayHaveBegun() {
            if (!rootSwapMayHaveBegun()) {
                return null;
            }
            synchronized (this) {
                if (recoveryPublication != null) {
                    return recoveryPublication;
                }
                CompletableFuture<Void> ownedRecovery = new CompletableFuture<>();
                recoveryPublication = ownedRecovery;
                rootSwapInvocationSettled.whenComplete((ignoredInvocation, invocationFailure) -> {
                    CompletionStage<Void> published;
                    try {
                        published = Objects.requireNonNull(
                                recoveryPublisher.get(), "recovery publication stage");
                    } catch (RuntimeException | Error failure) {
                        ownedRecovery.completeExceptionally(failure);
                        return;
                    }
                    published.whenComplete((ignoredRecovery, recoveryFailure) -> {
                        if (recoveryFailure == null) {
                            ownedRecovery.complete(null);
                        } else {
                            ownedRecovery.completeExceptionally(recoveryFailure);
                        }
                    });
                });
                return recoveryPublication;
            }
        }

        private record TimeoutDecision(
                boolean committed,
                @Nullable CompletionStage<Void> recoveryPublication
        ) {
        }
    }

    private static final class CloseObligationTracker {
        private final java.util.Set<CompletionStage<?>> pending =
                java.util.Collections.newSetFromMap(new java.util.IdentityHashMap<>());
        private CompletableFuture<Void> allTerminal = new CompletableFuture<>();

        private void register(CompletionStage<?> stage) {
            CompletableFuture<?> future = stage.toCompletableFuture();
            synchronized (this) {
                if (future.isDone() || !pending.add(stage)) {
                    return;
                }
                if (allTerminal.isDone()) {
                    allTerminal = new CompletableFuture<>();
                }
            }
            stage.whenComplete((ignored, failure) -> {
                CompletableFuture<Void> settled = null;
                synchronized (this) {
                    pending.remove(stage);
                    if (pending.isEmpty() && !allTerminal.isDone()) {
                        settled = allTerminal;
                    }
                }
                if (settled != null) {
                    settled.complete(null);
                }
            });
        }

        private synchronized @Nullable CompletionStage<Void> whenAllTerminal() {
            return pending.isEmpty() ? null : allTerminal;
        }
    }

    private static final class PublicationTimeoutException extends IllegalStateException {
        private final CompletionStage<Void> publication;
        private final @Nullable CompletionStage<Void> recoveryPublication;
        private final boolean rootSwapMayHaveBegun;
        private final boolean recoveryVisible;

        private PublicationTimeoutException(
                CompletionStage<Void> publication,
                @Nullable CompletionStage<Void> recoveryPublication,
                boolean rootSwapMayHaveBegun,
                boolean recoveryVisible,
                Throwable cause
        ) {
            super("Campaign publication did not settle within its phase budget", cause);
            this.publication = publication;
            this.recoveryPublication = recoveryPublication;
            this.rootSwapMayHaveBegun = rootSwapMayHaveBegun;
            this.recoveryVisible = recoveryVisible;
        }

        private CompletionStage<Void> publication() {
            return publication;
        }

        private @Nullable CompletionStage<Void> recoveryPublication() {
            return recoveryPublication;
        }

        private boolean rootSwapMayHaveBegun() {
            return rootSwapMayHaveBegun;
        }

        private boolean recoveryVisible() {
            return recoveryVisible;
        }
    }

    private static final class StalePublicationException extends IllegalStateException {
        private StalePublicationException() {
            super("Campaign publication attempt is no longer authorized");
        }
    }
}
