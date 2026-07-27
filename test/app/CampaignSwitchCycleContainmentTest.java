package app;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import features.campaign.api.CampaignActivation;
import features.campaign.api.CampaignActiveResult;
import features.campaign.api.CampaignId;
import features.campaign.api.CampaignListResult;
import features.campaign.api.CampaignPointerCommitResult;
import features.campaign.api.CampaignReadResult;
import features.campaign.api.CampaignRegistryApi;
import features.campaign.api.CampaignSnapshot;
import features.encounter.api.EncounterPoolFilters;
import features.encounter.api.UpdateEncounterPoolFiltersCommand;
import features.party.api.CharacterDraft;
import features.party.api.CreateCharacterCommand;
import features.party.api.MembershipState;
import features.party.api.MovePartyCharactersCommand;
import features.party.api.MutationStatus;
import features.party.api.PartyOverworldTravelLocationSnapshot;
import features.scene.api.SceneCommand;
import features.scene.api.SceneMutationResult;
import java.io.IOException;
import java.lang.management.ManagementFactory;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.DriverManager;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import javafx.application.Platform;
import javafx.stage.Stage;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.junit.jupiter.api.io.TempDir;
import platform.diagnostics.NoopDiagnostics;
import platform.execution.BoundedExecutionLane;
import platform.execution.SerialExecutionLane;
import platform.persistence.SqliteDatabase;
import platform.ui.JavaFxUiDispatcher;
import shell.host.AppShell;

/**
 * Aletheia B3 probe: switch-cycle containment and resource steady state at product
 * baseline fb229a119. Deciding probe drives the production composition route
 * (AppBootstrap.openCampaignActivationAsync + real CampaignDeskHost) through 24 mixed
 * switch cycles (8 x [failed-after-commit | successful | cancelled-before-commit]) and
 * compares steady-state resource samples S0/S1/S2. The negative and benign controls
 * prove the oracle discriminates a deliberately suppressed lane release from a benign
 * fake without touching production code.
 */
@org.junit.jupiter.api.Tag("ui")
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public final class CampaignSwitchCycleContainmentTest {

    private static final Duration TIMEOUT = Duration.ofSeconds(60);
    private static final int WARM_SWITCH_WARMUPS = 5;
    private static final int CYCLE_BLOCKS = 8;

    @TempDir
    Path temporaryDirectory;

    // ------------------------------------------------------------------
    // Deciding probe (metrics 1-4)
    // ------------------------------------------------------------------

    @Test
    @Order(1)
    void repeatedMixedSwitchCyclesContainAllProductionRuntimeResources() throws Exception {
        runOnFx(() -> { });
        Path caseRoot = temporaryDirectory.resolve("switch-cycle-containment");
        Path installationPath = caseRoot.resolve("installation.sqlite");
        Path campaignRoot = caseRoot.resolve("campaigns");

        Set<CampaignRuntime> weakRuntimes =
                java.util.Collections.newSetFromMap(new java.util.WeakHashMap<>());
        Set<AppShell> weakShells =
                java.util.Collections.newSetFromMap(new java.util.WeakHashMap<>());

        CampaignId alphaId;
        CampaignId betaId;
        Path alphaPath;
        Path betaPath;
        String lastAlphaTag;
        String lastBetaTag;
        int admittedRevokedWrites = 0;
        List<Long> successSwitchNanos = new ArrayList<>();
        List<String> revokedOutcomes = new ArrayList<>();
        ResourceSample s0;
        ResourceSample s1 = null;
        ResourceSample s2;

        ProbeHostHarness harness = new ProbeHostHarness(weakShells);
        AtomicBoolean gateArmed = new AtomicBoolean();
        try (AppBootstrap bootstrap = bootstrapAt(installationPath)) {
            bootstrap.installCampaignPreCommitGateForTesting(() -> {
                if (gateArmed.compareAndSet(true, false)) {
                    throw new IllegalStateException("armed switch-cycle probe pre-commit gate");
                }
            });
            CampaignActivationCoordinator coordinator = await(
                    bootstrap.openCampaignActivationAsync(campaignRoot, harness));

            var alpha = await(coordinator.create("Alpha", 0L));
            assertEquals(CampaignActivationCoordinator.Status.ACTIVATED, alpha.status(),
                    alpha::toString);
            harness.pulseActiveLayout();
            alphaId = alpha.durableActivation().orElseThrow().campaign().orElseThrow().id();
            alphaPath = alpha.campaignPath().orElseThrow();
            weakRuntimes.add(coordinator.activeRuntimeForTesting());
            seedCampaign(coordinator.activeRuntimeForTesting(), "Alpha", 11L, 101L);
            durableSceneMutation(coordinator.activeRuntimeForTesting(), "CC-Alpha-seed");

            var beta = await(coordinator.create("Beta", 1L));
            assertEquals(CampaignActivationCoordinator.Status.ACTIVATED, beta.status());
            betaId = beta.durableActivation().orElseThrow().campaign().orElseThrow().id();
            betaPath = beta.campaignPath().orElseThrow();
            weakRuntimes.add(coordinator.activeRuntimeForTesting());
            seedCampaign(coordinator.activeRuntimeForTesting(), "Beta", 22L, 202L);
            durableSceneMutation(coordinator.activeRuntimeForTesting(), "CC-Beta-seed");
            lastAlphaTag = "CC-Alpha-seed";
            lastBetaTag = "CC-Beta-seed";

            // Warmup: 5 successful Alpha<->Beta switch pairs -> {Beta active, Alpha parked}.
            for (int pair = 0; pair < WARM_SWITCH_WARMUPS; pair++) {
                switchActivated(coordinator, alphaId);
                weakRuntimes.add(coordinator.activeRuntimeForTesting());
                lastAlphaTag = "CC-Alpha-warm-" + pair;
                durableSceneMutation(coordinator.activeRuntimeForTesting(), lastAlphaTag);
                switchActivated(coordinator, betaId);
                weakRuntimes.add(coordinator.activeRuntimeForTesting());
                lastBetaTag = "CC-Beta-warm-" + pair;
                durableSceneMutation(coordinator.activeRuntimeForTesting(), lastBetaTag);
            }

            List<Path> campaignDatabases = List.of(alphaPath, betaPath);
            s0 = settleAndSample("S0", coordinator, true, weakRuntimes, weakShells,
                    campaignRoot, campaignDatabases);

            for (int block = 1; block <= CYCLE_BLOCKS; block++) {
                // Cycle A: failed-after-commit switch to Alpha, then durable recovery.
                harness.failAfterRootSwap();
                var failed = await(coordinator.switchTo(alphaId, currentGeneration(coordinator)));
                assertEquals(CampaignActivationCoordinator.Status.RECOVERY_REQUIRED,
                        failed.status(), failed::toString);
                assertEquals(CampaignActivationCoordinator.Phase.RECOVERY_REQUIRED,
                        coordinator.snapshot().phase());
                var recovered = await(coordinator.recoverDurableActive());
                assertEquals(CampaignActivationCoordinator.Status.RESUMED, recovered.status(),
                        recovered::toString);
                assertEquals(CampaignActivationCoordinator.Phase.ACTIVE,
                        coordinator.snapshot().phase());
                assertEquals(alphaId, coordinator.snapshot().durableActivation().orElseThrow()
                        .campaign().orElseThrow().id());
                weakRuntimes.add(coordinator.activeRuntimeForTesting());
                lastAlphaTag = "CC-Alpha-b" + block + "-postfail";
                durableSceneMutation(coordinator.activeRuntimeForTesting(), lastAlphaTag);

                // Cycle B: successful switch back to Beta with revoked-generation oracle.
                CampaignRuntime staleRuntime = coordinator.activeRuntimeForTesting();
                long startedNanos = System.nanoTime();
                switchActivated(coordinator, betaId);
                successSwitchNanos.add(System.nanoTime() - startedNanos);
                weakRuntimes.add(coordinator.activeRuntimeForTesting());
                String revokedTitle = "REVOKED-b" + block;
                String revokedOutcome = attemptRevokedMutation(staleRuntime, revokedTitle);
                revokedOutcomes.add(revokedOutcome);
                if ("ADMITTED".equals(revokedOutcome)) {
                    admittedRevokedWrites++;
                }
                lastBetaTag = "CC-Beta-b" + block + "-postswitch";
                durableSceneMutation(coordinator.activeRuntimeForTesting(), lastBetaTag);

                // Cycle C: cancelled-before-commit switch to Alpha (alternating variants).
                if (block % 2 == 1) {
                    gateArmed.set(true);
                    var cancelled = await(
                            coordinator.switchTo(alphaId, currentGeneration(coordinator)));
                    assertEquals(CampaignActivationCoordinator.Status.PRE_COMMIT_FAILED,
                            cancelled.status(), cancelled::toString);
                    assertFalse(gateArmed.get(), "the armed pre-commit gate must be consumed");
                } else {
                    var cancelled = await(
                            coordinator.switchTo(alphaId, currentGeneration(coordinator) - 1L));
                    assertEquals(CampaignActivationCoordinator.Status.STALE_GENERATION,
                            cancelled.status(), cancelled::toString);
                }
                assertEquals(CampaignActivationCoordinator.Phase.ACTIVE,
                        coordinator.snapshot().phase());
                assertEquals(betaId, coordinator.snapshot().durableActivation().orElseThrow()
                        .campaign().orElseThrow().id(),
                        "cancelled-before-commit must keep the prior campaign durable");
                lastBetaTag = "CC-Beta-b" + block + "-postcancel";
                durableSceneMutation(coordinator.activeRuntimeForTesting(), lastBetaTag);

                assertEquals(0L, crossCampaignRows(alphaPath, betaPath),
                        "cross-campaign mutation rows after block " + block);
                if (block == CYCLE_BLOCKS / 2) {
                    s1 = settleAndSample("S1", coordinator, true, weakRuntimes, weakShells,
                            campaignRoot, campaignDatabases);
                }
            }
            s2 = settleAndSample("S2", coordinator, true, weakRuntimes, weakShells,
                    campaignRoot, campaignDatabases);

            // Deciding metric 2: no revoked-generation write may ever reach either store.
            System.out.println("PROBE revoked outcomes=" + revokedOutcomes);
            assertEquals(0, admittedRevokedWrites, "admitted revoked-generation writes");
            assertEquals(0L, revokedRows(alphaPath, betaPath),
                    "revoked-generation rows persisted in either campaign store");
            // Deciding metric 1.
            assertEquals(0L, crossCampaignRows(alphaPath, betaPath),
                    "cross-campaign mutation rows after all cycles");
            harness.closeWindow();
        }

        // Deciding metric 3 + guard trend.
        List<String> violations = new ArrayList<>();
        violations.addAll(steadyStateViolations(s0, s1));
        violations.addAll(steadyStateViolations(s0, s2));
        violations.addAll(growthTrendViolations(s0, s1, s2));
        System.out.println("PROBE corroborating heap observations="
                + corroboratingHeapObservations(s0, s1, s2));
        assertTrue(violations.isEmpty(), () -> "steady-state violations: " + violations);

        // Scaling guard: no monotonic warm-switch slowdown.
        System.out.println("PROBE success-switch nanos=" + successSwitchNanos);
        assertEquals(CYCLE_BLOCKS, successSwitchNanos.size());
        double firstMean = successSwitchNanos.subList(0, 4).stream()
                .mapToLong(Long::longValue).average().orElseThrow();
        double lastMean = successSwitchNanos.subList(CYCLE_BLOCKS - 4, CYCLE_BLOCKS).stream()
                .mapToLong(Long::longValue).average().orElseThrow();
        System.out.println(String.format(java.util.Locale.ROOT,
                "PROBE switch-latency firstMean=%.3fms lastMean=%.3fms",
                firstMean / 1_000_000.0, lastMean / 1_000_000.0));
        assertTrue(lastMean <= firstMean * 1.5,
                () -> "monotonic warm-switch slowdown: first-4 mean " + firstMean
                        + "ns vs last-4 mean " + lastMean + "ns");

        // Deciding metric 4 tail: durable truth of both campaigns survives restart.
        ProbeHostHarness restartedHarness = new ProbeHostHarness(weakShells);
        try (AppBootstrap restarted = bootstrapAt(installationPath)) {
            CampaignActivationCoordinator coordinator = await(
                    restarted.openCampaignActivationAsync(campaignRoot, restartedHarness));
            var resumed = await(coordinator.resumeDurableActive());
            assertEquals(CampaignActivationCoordinator.Status.RESUMED, resumed.status(),
                    resumed::toString);
            assertEquals(betaId, resumed.durableActivation().orElseThrow()
                    .campaign().orElseThrow().id());
            String expectedBetaTag = lastBetaTag;
            assertTrue(coordinator.activeRuntimeForTesting().components().scene().model()
                            .current().scenes().stream()
                            .anyMatch(scene -> expectedBetaTag.equals(scene.title())),
                    "last pre-restart Beta mutation must survive restart");
            assertEquals(1L, countScenesTitled(betaPath, lastBetaTag));
            assertEquals(1L, countScenesTitled(alphaPath, lastAlphaTag));
            durableSceneMutation(coordinator.activeRuntimeForTesting(), "CC-Beta-postrestart");
            assertEquals(0L, crossCampaignRows(alphaPath, betaPath));
            assertEquals(0L, revokedRows(alphaPath, betaPath));
            restartedHarness.closeWindow();
        }
    }

    // ------------------------------------------------------------------
    // Guard: negative control (suppressed lane release must trip the oracle)
    // ------------------------------------------------------------------

    @Test
    @Order(2)
    void suppressedLaneReleaseIsDetectedByTheSteadyStateOracle() throws Exception {
        List<LaneBackedFakeCandidate> candidates = new ArrayList<>();
        try {
            ControlSamples samples = runFakeCandidateCycles(
                    "negative-control", () -> {
                        LaneBackedFakeCandidate candidate = new LaneBackedFakeCandidate(false);
                        candidates.add(candidate);
                        return candidate;
                    });
            List<String> violations = new ArrayList<>();
            violations.addAll(steadyStateViolations(samples.baseline(), samples.mid()));
            violations.addAll(steadyStateViolations(samples.baseline(), samples.end()));
            violations.addAll(growthTrendViolations(
                    samples.baseline(), samples.mid(), samples.end()));
            System.out.println("NEGATIVE-CONTROL violations=" + violations);
            assertFalse(violations.isEmpty(),
                    "the oracle must detect a deliberately suppressed lane release");
            assertTrue(violations.stream().anyMatch(v -> v.contains("campaignThreads")),
                    () -> "suppressed lane release must surface as campaign-thread growth: "
                            + violations);
        } finally {
            for (LaneBackedFakeCandidate candidate : candidates) {
                candidate.forceReleaseLane();
            }
        }
    }

    // ------------------------------------------------------------------
    // Guard: benign control (correct release plus benign change must pass)
    // ------------------------------------------------------------------

    @Test
    @Order(3)
    void benignFakeWithCorrectLaneReleasePassesTheSteadyStateOracle() throws Exception {
        List<LaneBackedFakeCandidate> candidates = new ArrayList<>();
        try {
            ControlSamples samples = runFakeCandidateCycles(
                    "benign-control", () -> {
                        LaneBackedFakeCandidate candidate = new LaneBackedFakeCandidate(true);
                        candidates.add(candidate);
                        return candidate;
                    });
            List<String> violations = new ArrayList<>();
            violations.addAll(steadyStateViolations(samples.baseline(), samples.mid()));
            violations.addAll(steadyStateViolations(samples.baseline(), samples.end()));
            violations.addAll(growthTrendViolations(
                    samples.baseline(), samples.mid(), samples.end()));
            System.out.println("BENIGN-CONTROL violations=" + violations);
            assertTrue(violations.isEmpty(),
                    () -> "a benign fake must not trip the oracle: " + violations);
        } finally {
            for (LaneBackedFakeCandidate candidate : candidates) {
                candidate.forceReleaseLane();
            }
        }
    }

    private ControlSamples runFakeCandidateCycles(
            String caseName,
            java.util.function.Supplier<LaneBackedFakeCandidate> factory
    ) throws Exception {
        Path controlRoot = temporaryDirectory.resolve(caseName);
        ProbeRegistry registry = new ProbeRegistry();
        AtomicInteger identity = new AtomicInteger(1);
        Set<CampaignRuntime> noRuntimes =
                java.util.Collections.newSetFromMap(new java.util.WeakHashMap<>());
        Set<AppShell> noShells =
                java.util.Collections.newSetFromMap(new java.util.WeakHashMap<>());
        try (CampaignActivationCoordinator coordinator = new CampaignActivationCoordinator(
                NoopDiagnostics.INSTANCE,
                registry,
                controlRoot,
                (id, path, intent) -> {
                    writeCandidateFile(path);
                    return CompletableFuture.completedFuture(factory.get());
                },
                new FakeSwitchingHost(),
                () -> new UUID(97L, identity.getAndIncrement()))) {
            var alpha = await(coordinator.create("Alpha", 0L));
            assertEquals(CampaignActivationCoordinator.Status.ACTIVATED, alpha.status(),
                    alpha::toString);
            CampaignId alphaId = alpha.durableActivation().orElseThrow()
                    .campaign().orElseThrow().id();
            ResourceSample baseline = settleAndSample(caseName + "-C0", coordinator, false,
                    noRuntimes, noShells, controlRoot, List.of());

            var beta = await(coordinator.create("Beta", 1L));
            assertEquals(CampaignActivationCoordinator.Status.ACTIVATED, beta.status());
            CampaignId betaId = beta.durableActivation().orElseThrow()
                    .campaign().orElseThrow().id();
            assertEquals(CampaignActivationCoordinator.Status.ACTIVATED,
                    await(coordinator.switchTo(alphaId, 2L)).status());
            ResourceSample mid = settleAndSample(caseName + "-C1", coordinator, false,
                    noRuntimes, noShells, controlRoot, List.of());

            assertEquals(CampaignActivationCoordinator.Status.ACTIVATED,
                    await(coordinator.switchTo(betaId, 3L)).status());
            ResourceSample end = settleAndSample(caseName + "-C2", coordinator, false,
                    noRuntimes, noShells, controlRoot, List.of());
            return new ControlSamples(baseline, mid, end);
        }
    }

    // ------------------------------------------------------------------
    // Shared settling protocol and steady-state oracle
    // ------------------------------------------------------------------

    private record ResourceSample(
            String label,
            long campaignThreads,
            int invocationWorkers,
            long nonDaemonThreads,
            long campaignFileDescriptors,
            long totalFileDescriptors,
            boolean sidecarsPresent,
            int retainedRuntimes,
            int retainedShells,
            long heapUsedBytes
    ) { }

    private record ControlSamples(
            ResourceSample baseline,
            ResourceSample mid,
            ResourceSample end
    ) { }

    private ResourceSample settleAndSample(
            String label,
            CampaignActivationCoordinator coordinator,
            boolean drainFx,
            Set<CampaignRuntime> weakRuntimes,
            Set<AppShell> weakShells,
            Path campaignRoot,
            List<Path> campaignDatabases
    ) throws Exception {
        awaitCondition(() -> coordinator.snapshot().phase()
                        == CampaignActivationCoordinator.Phase.ACTIVE
                && coordinator.pendingCloseAttemptsForTesting() == 0
                && coordinator.trackedCloseObligationsForTesting() == 0,
                Duration.ofSeconds(30));
        if (drainFx) {
            runOnFx(() -> { });
            runOnFx(() -> { });
            awaitFxPulses(3);
        }
        int previousRetained = Integer.MAX_VALUE;
        long previousHeap = Long.MAX_VALUE;
        long settledHeapFloor = Long.MAX_VALUE;
        int stableRounds = 0;
        for (int round = 0; round < 15 && stableRounds < 2; round++) {
            System.gc();
            Thread.sleep(150L);
            int currentRetained = weakRuntimes.size();
            long currentHeap =
                    ManagementFactory.getMemoryMXBean().getHeapMemoryUsage().getUsed();
            settledHeapFloor = Math.min(settledHeapFloor, currentHeap);
            boolean heapStable = previousHeap != Long.MAX_VALUE
                    && Math.abs(currentHeap - previousHeap) <= previousHeap / 100L;
            if (currentRetained == previousRetained && heapStable) {
                stableRounds++;
            } else {
                stableRounds = 0;
            }
            previousRetained = currentRetained;
            previousHeap = currentHeap;
        }
        awaitStableCampaignThreadCount(Duration.ofSeconds(10));
        boolean sidecars = false;
        for (Path database : campaignDatabases) {
            sidecars = sidecars
                    || Files.exists(database.resolveSibling(database.getFileName() + "-wal"))
                    || Files.exists(database.resolveSibling(database.getFileName() + "-shm"))
                    || Files.exists(database.resolveSibling(database.getFileName() + "-journal"));
        }
        ResourceSample sample = new ResourceSample(
                label,
                campaignRuntimeThreadCount(),
                coordinator.invocationWorkersForTesting(),
                nonDaemonThreadCount(),
                campaignFileDescriptors(campaignRoot),
                totalFileDescriptors(),
                sidecars,
                weakRuntimes.size(),
                weakShells.size(),
                settledHeapFloor);
        System.out.println("PROBE-SAMPLE " + sample);
        return sample;
    }

    /**
     * Steady-state oracle for deciding metric 3. Bands are applied as upper bounds because
     * the frozen hypothesis is leakage (growth); downward drift of freshly rebuilt
     * aggregates is recorded raw but is not a containment breach. Heap participates only
     * through the monotonic growth-trend rule (concept section 5, risk 2: GC settling makes
     * heap corroborating, the WeakReference aggregate count is the exact deciding signal).
     */
    private static List<String> steadyStateViolations(
            ResourceSample baseline,
            ResourceSample sample
    ) {
        List<String> violations = new ArrayList<>();
        if (sample.campaignThreads() > upperBand(baseline.campaignThreads())) {
            violations.add(sample.label() + " campaignThreads " + sample.campaignThreads()
                    + " exceeds baseline band " + upperBand(baseline.campaignThreads()));
        }
        if (sample.nonDaemonThreads() > upperBand(baseline.nonDaemonThreads())) {
            violations.add(sample.label() + " nonDaemonThreads " + sample.nonDaemonThreads()
                    + " exceeds baseline band " + upperBand(baseline.nonDaemonThreads()));
        }
        if (sample.campaignFileDescriptors() > upperBand(baseline.campaignFileDescriptors())) {
            violations.add(sample.label() + " campaignFileDescriptors "
                    + sample.campaignFileDescriptors() + " exceeds baseline band "
                    + upperBand(baseline.campaignFileDescriptors()));
        }
        if (sample.sidecarsPresent()) {
            violations.add(sample.label() + " campaign store sidecars present at rest");
        }
        if (sample.retainedRuntimes() > 2) {
            violations.add(sample.label() + " retainedRuntimes " + sample.retainedRuntimes()
                    + " exceeds active+parked bound 2");
        }
        return violations;
    }

    private static List<String> growthTrendViolations(
            ResourceSample s0,
            ResourceSample s1,
            ResourceSample s2
    ) {
        List<String> violations = new ArrayList<>();
        addTrendViolation(violations, "campaignThreads",
                s0.campaignThreads(), s1.campaignThreads(), s2.campaignThreads());
        addTrendViolation(violations, "campaignFileDescriptors",
                s0.campaignFileDescriptors(), s1.campaignFileDescriptors(),
                s2.campaignFileDescriptors());
        return violations;
    }

    /**
     * Heap is a corroborating signal, not a deciding one (concept section 5, risk 2:
     * System.gc() is advisory; the exact WeakReference aggregate count decides retention).
     * A monotonic settled-heap growth trend is therefore recorded for the report instead of
     * failing the probe on its own.
     */
    private static List<String> corroboratingHeapObservations(
            ResourceSample s0,
            ResourceSample s1,
            ResourceSample s2
    ) {
        List<String> observations = new ArrayList<>();
        addTrendViolation(observations, "heapUsedBytes",
                s0.heapUsedBytes(), s1.heapUsedBytes(), s2.heapUsedBytes());
        return observations;
    }

    private static void addTrendViolation(
            List<String> violations,
            String metric,
            long v0,
            long v1,
            long v2
    ) {
        if (v0 < v1 && v1 < v2 && v2 > upperBand(v0)) {
            violations.add("monotonic growth trend on " + metric + ": "
                    + v0 + " < " + v1 + " < " + v2);
        }
    }

    private static long upperBand(long baseline) {
        return (long) Math.ceil(baseline * 1.1d);
    }

    private static long campaignRuntimeThreadCount() {
        return Thread.getAllStackTraces().keySet().stream()
                .map(Thread::getName)
                .filter(name -> name.equals("salt-marcher-runtime")
                        || name.equals("salt-marcher-campaign-closure")
                        || name.startsWith("campaign-creatures-read-")
                        || name.startsWith("campaign-items-read-")
                        || name.startsWith("campaign-session-generation-")
                        || name.startsWith("campaign-encounter-generated-")
                        || name.startsWith("campaign-session-preparation-"))
                .count();
    }

    private static long nonDaemonThreadCount() {
        return Thread.getAllStackTraces().keySet().stream()
                .filter(Thread::isAlive)
                .filter(thread -> !thread.isDaemon())
                .count();
    }

    private static void awaitStableCampaignThreadCount(Duration budget) throws Exception {
        long deadline = System.nanoTime() + budget.toNanos();
        long previous = -1L;
        int stable = 0;
        while (System.nanoTime() < deadline && stable < 3) {
            long current = campaignRuntimeThreadCount();
            if (current == previous) {
                stable++;
            } else {
                stable = 0;
            }
            previous = current;
            Thread.sleep(100L);
        }
    }

    private static long campaignFileDescriptors(Path campaignRoot) {
        Path fdDirectory = Path.of("/proc/self/fd");
        if (!Files.isDirectory(fdDirectory)) {
            return -1L;
        }
        String prefix = campaignRoot.toAbsolutePath().toString();
        long count = 0L;
        try (var entries = Files.list(fdDirectory)) {
            for (Path entry : entries.toList()) {
                try {
                    if (Files.readSymbolicLink(entry).toString().startsWith(prefix)) {
                        count++;
                    }
                } catch (IOException raced) {
                    // Descriptor vanished between listing and readlink; not a campaign FD.
                }
            }
        } catch (IOException unreadable) {
            return -1L;
        }
        return count;
    }

    private static long totalFileDescriptors() {
        var os = ManagementFactory.getOperatingSystemMXBean();
        if (os instanceof com.sun.management.UnixOperatingSystemMXBean unix) {
            return unix.getOpenFileDescriptorCount();
        }
        return -1L;
    }

    // ------------------------------------------------------------------
    // Deciding-probe helpers
    // ------------------------------------------------------------------

    private AppBootstrap bootstrapAt(Path installationPath) {
        return new AppBootstrap(
                NoopDiagnostics.INSTANCE,
                new SerialExecutionLane(NoopDiagnostics.INSTANCE),
                new JavaFxUiDispatcher(),
                new SqliteDatabase(installationPath, NoopDiagnostics.INSTANCE));
    }

    private static long currentGeneration(CampaignActivationCoordinator coordinator) {
        return coordinator.snapshot().durableActivation().orElseThrow().generation();
    }

    private static void switchActivated(
            CampaignActivationCoordinator coordinator,
            CampaignId targetId
    ) throws Exception {
        var switched = await(coordinator.switchTo(targetId, currentGeneration(coordinator)));
        assertEquals(CampaignActivationCoordinator.Status.ACTIVATED, switched.status(),
                switched::toString);
    }

    private static void durableSceneMutation(CampaignRuntime runtime, String title)
            throws Exception {
        assertEquals(
                SceneMutationResult.Status.SUCCESS,
                await(runtime.components().scene().application().execute(
                        new SceneCommand.Create(title))).status(),
                () -> "durable mutation on the active runtime must succeed: " + title);
        assertTrue(runtime.components().scene().model().current().scenes().stream()
                        .anyMatch(scene -> title.equals(scene.title())),
                () -> "durable mutation must be visible in the model: " + title);
    }

    /**
     * Deciding metric 2 sensor. Attempts one write through the captured outgoing runtime
     * after the switch has committed. Any completion other than SUCCESS counts as rejected;
     * queued-but-never-admitted attempts surface later through the REVOKED-row store scan.
     */
    private static String attemptRevokedMutation(CampaignRuntime staleRuntime, String title) {
        CompletionStage<SceneMutationResult> stage;
        try {
            stage = staleRuntime.components().scene().application().execute(
                    new SceneCommand.Create(title));
        } catch (RuntimeException rejectedSynchronously) {
            return "REJECTED_SYNC:" + rejectedSynchronously.getClass().getSimpleName();
        }
        try {
            SceneMutationResult result = stage.toCompletableFuture().get(2, TimeUnit.SECONDS);
            return result.status() == SceneMutationResult.Status.SUCCESS
                    ? "ADMITTED"
                    : "REJECTED_RESULT:" + result.status();
        } catch (java.util.concurrent.TimeoutException neverCompleted) {
            return "NOT_COMPLETED";
        } catch (java.util.concurrent.ExecutionException rejectedAsync) {
            return "REJECTED_ASYNC:" + rejectedAsync.getCause().getClass().getSimpleName();
        } catch (InterruptedException interrupted) {
            Thread.currentThread().interrupt();
            throw new AssertionError(interrupted);
        }
    }

    private static long crossCampaignRows(Path alphaPath, Path betaPath) throws Exception {
        return countScenesLike(alphaPath, "CC-Beta-%") + countScenesLike(betaPath, "CC-Alpha-%");
    }

    private static long revokedRows(Path alphaPath, Path betaPath) throws Exception {
        return countScenesLike(alphaPath, "REVOKED-%") + countScenesLike(betaPath, "REVOKED-%");
    }

    private static long countScenesLike(Path campaignPath, String titlePattern)
            throws Exception {
        Class.forName("org.sqlite.JDBC");
        try (var connection = DriverManager.getConnection("jdbc:sqlite:" + campaignPath);
                var statement = connection.prepareStatement(
                        "SELECT COUNT(*) FROM scene_running_scene WHERE title LIKE ?")) {
            statement.setString(1, titlePattern);
            try (var results = statement.executeQuery()) {
                results.next();
                return results.getLong(1);
            }
        }
    }

    private static long countScenesTitled(Path campaignPath, String title) throws Exception {
        Class.forName("org.sqlite.JDBC");
        try (var connection = DriverManager.getConnection("jdbc:sqlite:" + campaignPath);
                var statement = connection.prepareStatement(
                        "SELECT COUNT(*) FROM scene_running_scene WHERE title = ?")) {
            statement.setString(1, title);
            try (var results = statement.executeQuery()) {
                results.next();
                return results.getLong(1);
            }
        }
    }

    /** Journey-shaped seed touching scene, encounter, and party lanes of one campaign. */
    private static void seedCampaign(
            CampaignRuntime runtime,
            String marker,
            long mapId,
            long tileId
    ) throws Exception {
        assertEquals(
                SceneMutationResult.Status.SUCCESS,
                await(runtime.components().scene().application().execute(
                        new SceneCommand.Create(marker + " Scene"))).status());
        CompletableFuture<Void> filterPublished = new CompletableFuture<>();
        Runnable unsubscribe = runtime.components().encounter().poolFilters()
                .subscribe(filters -> {
                    if (marker.equals(filters.nameQuery())) {
                        filterPublished.complete(null);
                    }
                });
        runtime.components().encounter().application().updatePoolFilters(
                new UpdateEncounterPoolFiltersCommand(new EncounterPoolFilters(
                        marker, "", "", List.of(), List.of(), List.of(), List.of(), List.of(),
                        List.of(), List.of(), 0L)));
        await(filterPublished);
        unsubscribe.run();
        // M2a rebase repair (cycle 2, forced deviation): the pre-M2a two-argument
        // CreateCharacterCommand(draft, membership) constructor no longer exists at
        // baseline 69d026440. Semantics preserved: character 1 is created and made
        // ACTIVE through the current production API before the awaited move below.
        runtime.components().party().application().createCharacter(new CreateCharacterCommand(
                new CharacterDraft(marker + " Guide", marker, 3, 14, 16)));
        runtime.components().party().application().setMembership(
                new features.party.api.SetPartyMembershipCommand(1L, MembershipState.ACTIVE));
        var moved = await(runtime.components().party().application().moveCharacters(
                new MovePartyCharactersCommand(
                        List.of(1L),
                        new PartyOverworldTravelLocationSnapshot(mapId, tileId),
                        true)));
        assertEquals(MutationStatus.SUCCESS, moved.status());
    }

    // ------------------------------------------------------------------
    // Probe-local production host harness (copy of the frozen journey harness)
    // ------------------------------------------------------------------

    private static final class ProbeHostHarness
            implements CampaignActivationCoordinator.SwitchingHost {

        private final Stage window;
        private final CampaignDeskHost production;
        private final Set<AppShell> weakShells;

        private ProbeHostHarness(Set<AppShell> weakShells) throws Exception {
            this.weakShells = weakShells;
            AtomicReference<Stage> stage = new AtomicReference<>();
            AtomicReference<CampaignDeskHost> host = new AtomicReference<>();
            runOnFx(() -> {
                Stage created = new Stage();
                CampaignDeskHost owner = new CampaignDeskHost(created);
                owner.showInitialLoading();
                created.show();
                stage.set(created);
                host.set(owner);
            });
            window = stage.get();
            production = host.get();
        }

        @Override
        public CampaignActivationCoordinator.RootSwitchResult switchCampaign(
                CampaignSnapshot campaign,
                long generation,
                AppShell shell
        ) {
            if (shell != null) {
                weakShells.add(shell);
            }
            return production.switchCampaign(campaign, generation, shell);
        }

        @Override
        public CampaignActivationCoordinator.RootSwitchResult switchCampaign(
                CampaignSnapshot campaign,
                long generation,
                CampaignActivationCoordinator.PublicationSurface surface
        ) {
            if (surface.shell() != null) {
                weakShells.add(surface.shell());
            }
            return production.switchCampaign(campaign, generation, surface);
        }

        @Override
        public CompletionStage<Void> showRecovery(
                Optional<CampaignActivation> durableActivation,
                Class<? extends Throwable> failureType
        ) {
            return production.showRecovery(durableActivation, failureType);
        }

        @Override
        public CampaignActivationCoordinator.PublishedRootReadinessAttempt
                awaitPublishedRootReady(AppShell shell) {
            return production.awaitPublishedRootReady(shell);
        }

        @Override
        public void installSelectorAccess(AppShell shell) {
            production.installSelectorAccess(shell);
        }

        void failAfterRootSwap() {
            production.failAfterRootSwapForTesting();
        }

        void pulseActiveLayout() throws Exception {
            runOnFx(() -> {
                window.getScene().getRoot().applyCss();
                window.getScene().getRoot().layout();
            });
        }

        void closeWindow() throws Exception {
            runOnFx(window::close);
        }
    }

    // ------------------------------------------------------------------
    // Probe-local fakes for the negative and benign controls
    // ------------------------------------------------------------------

    /**
     * Fake candidate holding one real bounded lane with a production thread-name prefix.
     * The leaky variant completes closeAsync without releasing the lane; the benign variant
     * releases it and additionally runs an unrelated benign no-op stage.
     */
    private static final class LaneBackedFakeCandidate
            implements CampaignActivationCoordinator.Candidate {

        private final BoundedExecutionLane lane = new BoundedExecutionLane(
                NoopDiagnostics.INSTANCE, "campaign-creatures-read", 2);
        private final boolean releaseLaneOnClose;
        private final AtomicBoolean laneReleased = new AtomicBoolean();

        private LaneBackedFakeCandidate(boolean releaseLaneOnClose) {
            this.releaseLaneOnClose = releaseLaneOnClose;
            CountDownLatch started = new CountDownLatch(2);
            CountDownLatch release = new CountDownLatch(1);
            for (int worker = 0; worker < 2; worker++) {
                lane.execute(() -> {
                    started.countDown();
                    try {
                        release.await();
                    } catch (InterruptedException interrupted) {
                        Thread.currentThread().interrupt();
                    }
                });
            }
            try {
                if (!started.await(5, TimeUnit.SECONDS)) {
                    throw new AssertionError("fake lane workers did not start");
                }
            } catch (InterruptedException interrupted) {
                Thread.currentThread().interrupt();
                throw new AssertionError(interrupted);
            } finally {
                release.countDown();
            }
        }

        void forceReleaseLane() {
            if (laneReleased.compareAndSet(false, true)) {
                lane.terminateNow(Duration.ofSeconds(1));
            }
        }

        @Override
        public AppShell shell() {
            return null;
        }

        @Override
        public CampaignRuntime runtimeForTesting() {
            return null;
        }

        @Override
        public CompletionStage<Void> pauseAndDrain() {
            return CompletableFuture.completedFuture(null);
        }

        @Override
        public void resumeAdmission() { }

        @Override
        public CampaignRuntime.CandidatePreparation<Boolean> preparePublication(
                java.util.function.Supplier<Boolean> publication
        ) {
            return new CampaignRuntime.CandidatePreparation<>(
                    publication.get(), CompletableFuture.completedFuture(null));
        }

        @Override
        public CompletionStage<Void> dispatchUiTracked(
                Runnable work,
                java.util.function.Consumer<Throwable> terminalHandler
        ) {
            try {
                work.run();
                terminalHandler.accept(null);
                return CompletableFuture.completedFuture(null);
            } catch (RuntimeException | Error failure) {
                terminalHandler.accept(failure);
                return CompletableFuture.failedFuture(failure);
            }
        }

        @Override
        public void activateVisibleShell() { }

        @Override
        public CompletionStage<Void> closeAsync() {
            if (releaseLaneOnClose) {
                if (laneReleased.compareAndSet(false, true)) {
                    assertTrue(lane.terminateNow(Duration.ofSeconds(1)),
                            "benign fake lane must terminate inside the close budget");
                }
                // Unrelated benign change: one extra already-completed no-op close stage.
                return CompletableFuture.completedFuture(null)
                        .thenCompose(ignored -> CompletableFuture.completedFuture(null));
            }
            // Deliberately suppressed lane release: report success without releasing.
            return CompletableFuture.completedFuture(null);
        }
    }

    private static final class FakeSwitchingHost
            implements CampaignActivationCoordinator.SwitchingHost {

        @Override
        public CampaignActivationCoordinator.RootSwitchResult switchCampaign(
                CampaignSnapshot campaign,
                long generation,
                AppShell shell
        ) {
            return CampaignActivationCoordinator.RootSwitchResult.CAMPAIGN_ROOT_VISIBLE;
        }

        @Override
        public CompletionStage<Void> showRecovery(
                Optional<CampaignActivation> durableActivation,
                Class<? extends Throwable> failureType
        ) {
            return CompletableFuture.completedFuture(null);
        }
    }

    private static final class ProbeRegistry implements CampaignRegistryApi {

        private final java.util.Map<CampaignId, CampaignSnapshot> campaigns =
                new java.util.LinkedHashMap<>();
        private CampaignActivation active = CampaignActivation.none();

        @Override
        public synchronized CompletionStage<CampaignPointerCommitResult>
                registerAndCommitActivePointer(
                        CampaignId campaignId,
                        String name,
                        long expectedGeneration
        ) {
            if (active.generation() != expectedGeneration) {
                return CompletableFuture.completedFuture(new CampaignPointerCommitResult(
                        CampaignPointerCommitResult.Status.STALE_GENERATION,
                        Optional.of(active)));
            }
            CampaignSnapshot target = new CampaignSnapshot(campaignId, name.strip());
            campaigns.put(campaignId, target);
            active = new CampaignActivation(Optional.of(target), expectedGeneration + 1L);
            return CompletableFuture.completedFuture(new CampaignPointerCommitResult(
                    CampaignPointerCommitResult.Status.COMMITTED, Optional.of(active)));
        }

        @Override
        public synchronized CompletionStage<CampaignListResult> list() {
            return CompletableFuture.completedFuture(new CampaignListResult(
                    CampaignListResult.Status.SUCCESS, List.copyOf(campaigns.values())));
        }

        @Override
        public synchronized CompletionStage<CampaignReadResult> read(CampaignId campaignId) {
            CampaignSnapshot campaign = campaigns.get(campaignId);
            return CompletableFuture.completedFuture(campaign == null
                    ? new CampaignReadResult(CampaignReadResult.Status.NOT_FOUND, Optional.empty())
                    : new CampaignReadResult(CampaignReadResult.Status.FOUND,
                            Optional.of(campaign)));
        }

        @Override
        public synchronized CompletionStage<CampaignActiveResult> active() {
            return CompletableFuture.completedFuture(new CampaignActiveResult(
                    CampaignActiveResult.Status.SUCCESS, Optional.of(active)));
        }

        @Override
        public synchronized CompletionStage<CampaignPointerCommitResult> commitActivePointer(
                CampaignId campaignId,
                long expectedGeneration
        ) {
            CampaignSnapshot target = campaigns.get(campaignId);
            if (target == null) {
                return CompletableFuture.completedFuture(new CampaignPointerCommitResult(
                        CampaignPointerCommitResult.Status.CAMPAIGN_NOT_FOUND,
                        Optional.of(active)));
            }
            return registerAndCommitActivePointer(campaignId, target.name(), expectedGeneration);
        }
    }

    private static void writeCandidateFile(Path path) {
        try {
            Files.writeString(path, "prepared-campaign");
        } catch (IOException failure) {
            throw new java.io.UncheckedIOException(failure);
        }
    }

    // ------------------------------------------------------------------
    // Await / FX helpers (journey-test idioms)
    // ------------------------------------------------------------------

    private static <T> T await(CompletionStage<T> stage) throws Exception {
        return stage.toCompletableFuture().get(TIMEOUT.toMillis(), TimeUnit.MILLISECONDS);
    }

    private static void awaitCondition(
            java.util.function.BooleanSupplier condition,
            Duration budget
    ) {
        long deadline = System.nanoTime() + budget.toNanos();
        while (!condition.getAsBoolean()) {
            if (System.nanoTime() >= deadline) {
                throw new AssertionError("Timed out waiting for settling condition");
            }
            java.util.concurrent.locks.LockSupport.parkNanos(TimeUnit.MILLISECONDS.toNanos(5));
        }
    }

    private static void awaitFxPulses(int requestedPulses) throws Exception {
        CountDownLatch observed = new CountDownLatch(1);
        runOnFx(() -> new javafx.animation.AnimationTimer() {
            private int pulses;

            @Override
            public void handle(long now) {
                pulses++;
                if (pulses >= requestedPulses) {
                    stop();
                    observed.countDown();
                } else {
                    Platform.requestNextPulse();
                }
            }
        }.start());
        assertTrue(observed.await(5, TimeUnit.SECONDS),
                "JavaFX did not deliver the requested settling pulses");
    }

    private static void runOnFx(ThrowingRunnable action) throws Exception {
        if (Platform.isFxApplicationThread()) {
            action.run();
            return;
        }
        CountDownLatch completed = new CountDownLatch(1);
        AtomicReference<Throwable> failure = new AtomicReference<>();
        testsupport.JavaFxRuntime.startup(() -> {
            try {
                Platform.setImplicitExit(false);
                action.run();
            } catch (Throwable throwable) {
                failure.set(throwable);
            } finally {
                completed.countDown();
            }
        });
        if (!completed.await(TIMEOUT.toMillis(), TimeUnit.MILLISECONDS)) {
            throw new IllegalStateException("Timed out waiting for JavaFX work");
        }
        Throwable thrown = failure.get();
        if (thrown instanceof Exception exception) {
            throw exception;
        }
        if (thrown instanceof Error error) {
            throw error;
        }
        if (thrown != null) {
            throw new IllegalStateException("JavaFX work failed", thrown);
        }
    }

    @FunctionalInterface
    private interface ThrowingRunnable {
        void run() throws Exception;
    }
}
