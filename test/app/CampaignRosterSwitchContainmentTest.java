package app;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import features.campaign.api.CampaignActivation;
import features.campaign.api.CampaignId;
import features.campaign.api.CampaignSnapshot;
import features.party.api.CharacterDraft;
import features.party.api.CreateCharacterCommand;
import features.party.api.DeleteCharacterCommand;
import features.party.api.MembershipState;
import features.party.api.MovePartyCharactersCommand;
import features.party.api.MutationResult;
import features.party.api.MutationStatus;
import features.party.api.PartyMemberDetails;
import features.party.api.PartyOverworldTravelLocationSnapshot;
import features.party.api.PartySnapshotResult;
import features.party.api.ReadStatus;
import features.party.api.UpdateCharacterCommand;
import java.lang.management.ManagementFactory;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.DriverManager;
import java.time.Duration;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;
import javafx.application.Platform;
import javafx.stage.Stage;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.junit.jupiter.api.io.TempDir;
import platform.diagnostics.NoopDiagnostics;
import platform.execution.SerialExecutionLane;
import platform.persistence.SqliteDatabase;
import platform.ui.JavaFxUiDispatcher;
import shell.host.AppShell;

/**
 * Aletheia B3 cycle-2 probe: Roster containment under Campaign switching at product
 * baseline 69d026440 (M2a Campaign Roster on the M1 activation seam).
 *
 * <p>Deciding probe drives the production composition route
 * (AppBootstrap.openCampaignActivationAsync + real CampaignDeskHost) through 8 blocks x
 * [fail-after-commit | successful | cancel-before-commit] switch cycles (24 cycles),
 * with per-block roster CRUD (namesake "Echo" pairs, nullable-stat toggling, create and
 * delete) through the production PartyApplicationService, an external JDBC roster oracle
 * on player_characters + party_roster_metadata, and projection-vs-oracle equality after
 * every completed switch and after restart. The controls prove the containment oracle
 * discriminates a deliberately mis-scoped foreign-named row implant from a benign
 * same-campaign write without touching production code.
 */
@org.junit.jupiter.api.Tag("ui")
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public final class CampaignRosterSwitchContainmentTest {

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
    void rosterTruthStaysCampaignContainedAcrossMixedSwitchCycles() throws Exception {
        runOnFx(() -> { });
        Path caseRoot = temporaryDirectory.resolve("roster-switch-containment");
        Path installationPath = caseRoot.resolve("installation.sqlite");
        Path campaignRoot = caseRoot.resolve("campaigns");

        CampaignHandle alpha = new CampaignHandle("RC-Alpha-");
        CampaignHandle beta = new CampaignHandle("RC-Beta-");
        List<Long> successSwitchNanos = new ArrayList<>();
        List<String> raceOutcomes = new ArrayList<>();
        List<String> boundaryOutcomes = new ArrayList<>();
        int admittedBoundaryWrites = 0;
        long heapS0;
        long heapS1 = Long.MIN_VALUE;
        long heapS2;
        StoreTruth preRestartAlpha;
        StoreTruth preRestartBeta;

        ProbeHostHarness harness = new ProbeHostHarness();
        AtomicBoolean gateArmed = new AtomicBoolean();
        try (AppBootstrap bootstrap = bootstrapAt(installationPath)) {
            bootstrap.installCampaignPreCommitGateForTesting(() -> {
                if (gateArmed.compareAndSet(true, false)) {
                    throw new IllegalStateException("armed roster-probe pre-commit gate");
                }
            });
            CampaignActivationCoordinator coordinator = await(
                    bootstrap.openCampaignActivationAsync(campaignRoot, harness));

            var alphaCreated = await(coordinator.create("Alpha", 0L));
            assertEquals(CampaignActivationCoordinator.Status.ACTIVATED, alphaCreated.status(),
                    alphaCreated::toString);
            harness.pulseActiveLayout();
            alpha.id = alphaCreated.durableActivation().orElseThrow()
                    .campaign().orElseThrow().id();
            alpha.path = alphaCreated.campaignPath().orElseThrow();
            seedRoster(coordinator.activeRuntimeForTesting(), alpha);
            comparisonPoint(coordinator, alpha, beta, "Alpha seeded");

            var betaCreated = await(coordinator.create("Beta", currentGeneration(coordinator)));
            assertEquals(CampaignActivationCoordinator.Status.ACTIVATED, betaCreated.status(),
                    betaCreated::toString);
            beta.id = betaCreated.durableActivation().orElseThrow()
                    .campaign().orElseThrow().id();
            beta.path = betaCreated.campaignPath().orElseThrow();
            assertNotEquals(alpha.id, beta.id);
            seedRoster(coordinator.activeRuntimeForTesting(), beta);
            comparisonPoint(coordinator, beta, alpha, "Beta seeded");

            // Warmup: 5 successful Alpha<->Beta switch pairs -> {Beta active, Alpha parked}.
            for (int pair = 0; pair < WARM_SWITCH_WARMUPS; pair++) {
                switchActivated(coordinator, alpha.id);
                switchActivated(coordinator, beta.id);
            }
            comparisonPoint(coordinator, beta, alpha, "post-warmup Beta");
            heapS0 = settledHeapFloor("S0", coordinator, List.of(alpha.path, beta.path));

            for (int block = 1; block <= CYCLE_BLOCKS; block++) {
                // ---- Cycle A: fail-after-commit switch to Alpha with racing Beta create.
                // The service reference is captured while Beta is still admitted — the
                // shape a production UI holds across a switch boundary.
                features.party.api.PartyApi betaApplication =
                        coordinator.activeRuntimeForTesting().components().party()
                                .application();
                harness.failAfterRootSwap();
                CompletionStage<CampaignActivationCoordinator.Result> pendingFail =
                        coordinator.switchTo(alpha.id, currentGeneration(coordinator));
                String raceName = beta.prefix + "race-b" + block;
                String raceOutcome = attemptRosterCreate(betaApplication, raceName);
                raceOutcomes.add("b" + block + ":" + raceOutcome);
                var failed = await(pendingFail);
                assertEquals(CampaignActivationCoordinator.Status.RECOVERY_REQUIRED,
                        failed.status(), failed::toString);
                assertEquals(CampaignActivationCoordinator.Phase.RECOVERY_REQUIRED,
                        coordinator.snapshot().phase());

                // Revoked window: writes on the detached prior Beta runtime must be
                // rejected visibly (deciding metric 3 arm).
                String revokedCreate =
                        attemptRosterCreate(betaApplication, "RC-REVOKED-b" + block);
                String revokedMove = attemptRosterMove(betaApplication, beta.e1);
                boundaryOutcomes.add("b" + block + "-revoked-create:" + revokedCreate);
                boundaryOutcomes.add("b" + block + "-revoked-move:" + revokedMove);
                if (isAdmitted(revokedCreate) || isAdmitted(revokedMove)) {
                    admittedBoundaryWrites++;
                }

                var recovered = await(coordinator.recoverDurableActive());
                assertEquals(CampaignActivationCoordinator.Status.RESUMED, recovered.status(),
                        recovered::toString);
                assertEquals(CampaignActivationCoordinator.Phase.ACTIVE,
                        coordinator.snapshot().phase());
                assertEquals(alpha.id, coordinator.snapshot().durableActivation().orElseThrow()
                        .campaign().orElseThrow().id());

                // Race XOR oracle (deciding metric 4): the racing create appears exactly
                // once in the owning Beta store iff its submission was admitted, and
                // never anywhere else.
                long raceRowsInBeta = countRosterNamed(beta.path, raceName);
                if (isAdmitted(raceOutcome)) {
                    assertEquals(1L, raceRowsInBeta,
                            "admitted racing create must be durable exactly once in its "
                                    + "owning Campaign: " + raceName);
                } else {
                    assertEquals(0L, raceRowsInBeta,
                            "rejected racing create must not reach the owning store: "
                                    + raceName);
                }
                assertEquals(0L, countRosterNamed(alpha.path, raceName),
                        "racing create must never reach the target Campaign: " + raceName);

                // Alpha per-block roster CRUD after durable recovery.
                blockMutations(coordinator, alpha, block);
                comparisonPoint(coordinator, alpha, beta,
                        "Alpha after recovery block " + block);
                assertContainmentScansClean(alpha, beta, "after cycle A block " + block);

                // ---- Cycle B: successful switch back to Beta (latency-timed) with a
                // parked-prior write attempt through a reference captured while active.
                features.party.api.PartyApi staleAlphaApplication =
                        coordinator.activeRuntimeForTesting().components().party()
                                .application();
                long startedNanos = System.nanoTime();
                switchActivated(coordinator, beta.id);
                successSwitchNanos.add(System.nanoTime() - startedNanos);
                String parkedCreate = attemptRosterCreate(
                        staleAlphaApplication, "RC-REVOKED-b" + block + "-parked");
                String parkedMove = attemptRosterMove(staleAlphaApplication, alpha.e1);
                boundaryOutcomes.add("b" + block + "-parked-create:" + parkedCreate);
                boundaryOutcomes.add("b" + block + "-parked-move:" + parkedMove);
                if (isAdmitted(parkedCreate) || isAdmitted(parkedMove)) {
                    admittedBoundaryWrites++;
                }
                blockMutations(coordinator, beta, block);
                comparisonPoint(coordinator, beta, alpha,
                        "Beta after successful switch block " + block);
                assertContainmentScansClean(alpha, beta, "after cycle B block " + block);

                // ---- Cycle C: cancel-before-commit switch to Alpha (alternating variants).
                StoreTruth alphaBeforeCancel = storeTruth(alpha.path);
                CampaignRuntime activeBetaRuntime = coordinator.activeRuntimeForTesting();
                features.party.api.PartyApi activeBetaApplication =
                        activeBetaRuntime.components().party().application();
                if (block % 2 == 1) {
                    // Deterministic drain-settled window: the coordinator blocks between
                    // prior drain completion and the pre-commit gate while the probe owns
                    // the settlement future; window entry is state()==PARKED.
                    CompletableFuture<Void> settlement = new CompletableFuture<>();
                    coordinator.installNextPriorDrainSettlementForTesting(settlement);
                    CompletionStage<CampaignActivationCoordinator.Result> pendingCancel =
                            coordinator.switchTo(alpha.id, currentGeneration(coordinator));
                    awaitCondition(() -> activeBetaRuntime.state()
                            == CampaignRuntime.State.PARKED, Duration.ofSeconds(30));
                    String closedCreate = attemptRosterCreate(
                            activeBetaApplication, "RC-CLOSED-b" + block);
                    String closedMove = attemptRosterMove(activeBetaApplication, beta.e1);
                    boundaryOutcomes.add("b" + block + "-closed-create:" + closedCreate);
                    boundaryOutcomes.add("b" + block + "-closed-move:" + closedMove);
                    if (isAdmitted(closedCreate) || isAdmitted(closedMove)) {
                        admittedBoundaryWrites++;
                    }
                    gateArmed.set(true);
                    settlement.complete(null);
                    var cancelled = await(pendingCancel);
                    assertEquals(CampaignActivationCoordinator.Status.PRE_COMMIT_FAILED,
                            cancelled.status(), cancelled::toString);
                    assertFalse(gateArmed.get(), "the armed pre-commit gate must be consumed");
                } else {
                    var cancelled = await(coordinator.switchTo(
                            alpha.id, currentGeneration(coordinator) - 1L));
                    assertEquals(CampaignActivationCoordinator.Status.STALE_GENERATION,
                            cancelled.status(), cancelled::toString);
                }
                assertEquals(CampaignActivationCoordinator.Phase.ACTIVE,
                        coordinator.snapshot().phase());
                assertEquals(beta.id, coordinator.snapshot().durableActivation().orElseThrow()
                        .campaign().orElseThrow().id(),
                        "cancelled-before-commit must keep the prior Campaign durable");

                // Restored Beta must accept roster writes again (metric 4 restore arm).
                postCancelRoundTrip(coordinator, beta, block);
                comparisonPoint(coordinator, beta, alpha,
                        "Beta after cancelled switch block " + block);
                // Metric 1: the cancelled target Campaign's durable roster truth is
                // byte-identical to its last capture.
                assertEquals(alphaBeforeCancel, storeTruth(alpha.path),
                        "cancelled switch must leave the target Campaign roster untouched, "
                                + "block " + block);
                assertContainmentScansClean(alpha, beta, "after cycle C block " + block);

                if (block == CYCLE_BLOCKS / 2) {
                    heapS1 = settledHeapFloor("S1", coordinator,
                            List.of(alpha.path, beta.path));
                }
            }
            heapS2 = settledHeapFloor("S2", coordinator, List.of(alpha.path, beta.path));

            System.out.println("PROBE race outcomes=" + raceOutcomes);
            System.out.println("PROBE boundary outcomes=" + boundaryOutcomes);
            assertEquals(0, admittedBoundaryWrites,
                    "admitted revoked/parked/closed-window roster writes: "
                            + boundaryOutcomes);
            assertContainmentScansClean(alpha, beta, "after all cycles");

            preRestartAlpha = storeTruth(alpha.path);
            preRestartBeta = storeTruth(beta.path);
            harness.closeWindow();
        }

        // Guard: settled-heap slope (corroborating only; cycle-1 handed off 0.59 MB/cycle).
        double slopeMbPerCycle =
                (heapS2 - heapS0) / (1024.0 * 1024.0) / (CYCLE_BLOCKS * 3);
        System.out.println(String.format(java.util.Locale.ROOT,
                "PROBE settled-heap S0=%d S1=%d S2=%d slopeMbPerCycle=%.3f",
                heapS0, heapS1, heapS2, slopeMbPerCycle));

        // Guard: no monotonic warm-switch slowdown (load-caveated, ratio <= 1.5).
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

        // Metrics 2/3/4 tail: durable roster truth of both Campaigns survives restart.
        ProbeHostHarness restartedHarness = new ProbeHostHarness();
        try (AppBootstrap restarted = bootstrapAt(installationPath)) {
            CampaignActivationCoordinator coordinator = await(
                    restarted.openCampaignActivationAsync(campaignRoot, restartedHarness));
            var resumed = await(coordinator.resumeDurableActive());
            assertEquals(CampaignActivationCoordinator.Status.RESUMED, resumed.status(),
                    resumed::toString);
            assertEquals(beta.id, resumed.durableActivation().orElseThrow()
                    .campaign().orElseThrow().id(),
                    "restart resumes the exact durable active Campaign");
            assertEquals(preRestartBeta, storeTruth(beta.path),
                    "restart must not change Beta durable roster truth");
            assertEquals(preRestartAlpha, storeTruth(alpha.path),
                    "restart must not change Alpha durable roster truth");
            comparisonPoint(coordinator, beta, alpha, "Beta after restart");

            // One post-restart namesake edit on Beta: changes exactly e1's row, nothing
            // in Alpha.
            CampaignRuntime betaRuntime = coordinator.activeRuntimeForTesting();
            betaRuntime.components().party().application().updateCharacter(
                    new UpdateCharacterCommand(beta.e1, new CharacterDraft(
                            beta.prefix + "Echo", "Post", 9, 12, 13)));
            awaitFxCondition(() -> memberStatsMatch(
                    memberById(projectionMembersOnCurrentThread(betaRuntime), beta.e1),
                    "Post", 9, 12, 13));
            beta.expectedEchoPlayer = "Post";
            beta.expectedEchoLevel = 9;
            beta.expectedEchoPassivePerception = 12;
            beta.expectedEchoArmorClass = 13;
            comparisonPoint(coordinator, beta, alpha, "Beta after post-restart edit");
            StoreTruth betaAfterEdit = storeTruth(beta.path);
            assertEquals(preRestartBeta.nextCharacterId(), betaAfterEdit.nextCharacterId(),
                    "an update must not consume a character id");
            assertEquals(
                    withoutRow(preRestartBeta.rows(), beta.e1),
                    withoutRow(betaAfterEdit.rows(), beta.e1),
                    "the post-restart edit must change exactly the edited namesake row");
            assertEquals(preRestartAlpha, storeTruth(alpha.path),
                    "the post-restart Beta edit must bump nothing in Alpha");
            assertContainmentScansClean(alpha, beta, "after restart tail");
            restartedHarness.closeWindow();
        }
    }

    // ------------------------------------------------------------------
    // Guard: negative and benign controls (oracle discrimination)
    // ------------------------------------------------------------------

    @Test
    @Order(2)
    void containmentOracleDiscriminatesMisScopedImplantFromBenignWrite() throws Exception {
        runOnFx(() -> { });
        Path caseRoot = temporaryDirectory.resolve("roster-containment-controls");
        Path installationPath = caseRoot.resolve("installation.sqlite");
        Path campaignRoot = caseRoot.resolve("campaigns");

        CampaignHandle alpha = new CampaignHandle("RC-Alpha-");
        CampaignHandle beta = new CampaignHandle("RC-Beta-");
        ProbeHostHarness harness = new ProbeHostHarness();
        try (AppBootstrap bootstrap = bootstrapAt(installationPath)) {
            CampaignActivationCoordinator coordinator = await(
                    bootstrap.openCampaignActivationAsync(campaignRoot, harness));
            var alphaCreated = await(coordinator.create("Alpha", 0L));
            assertEquals(CampaignActivationCoordinator.Status.ACTIVATED, alphaCreated.status(),
                    alphaCreated::toString);
            harness.pulseActiveLayout();
            alpha.id = alphaCreated.durableActivation().orElseThrow()
                    .campaign().orElseThrow().id();
            alpha.path = alphaCreated.campaignPath().orElseThrow();
            seedRoster(coordinator.activeRuntimeForTesting(), alpha);

            var betaCreated = await(coordinator.create("Beta", currentGeneration(coordinator)));
            assertEquals(CampaignActivationCoordinator.Status.ACTIVATED, betaCreated.status(),
                    betaCreated::toString);
            beta.id = betaCreated.durableActivation().orElseThrow()
                    .campaign().orElseThrow().id();
            beta.path = betaCreated.campaignPath().orElseThrow();
            seedRoster(coordinator.activeRuntimeForTesting(), beta);
            assertEquals(0L, crossCampaignRosterRows(alpha, beta),
                    "controls start from clean containment");

            // Negative control: a probe-local, schema-valid, deliberately mis-scoped
            // direct JDBC write of a foreign-named row into Beta's store must trip the
            // cross-campaign containment oracle.
            long originalNextId = nextCharacterId(beta.path);
            try (var connection = DriverManager.getConnection("jdbc:sqlite:" + beta.path);
                    var statement = connection.createStatement()) {
                statement.execute("PRAGMA busy_timeout = 5000");
                statement.execute("INSERT INTO player_characters(id, name) VALUES ("
                        + originalNextId + ", 'RC-Alpha-implant')");
                statement.execute("UPDATE party_roster_metadata SET next_character_id = "
                        + (originalNextId + 1) + " WHERE singleton_id = 1");
            }
            long trippedRows = crossCampaignRosterRows(alpha, beta);
            System.out.println("NEGATIVE-CONTROL crossCampaignRows=" + trippedRows);
            assertTrue(trippedRows > 0,
                    "the containment oracle must detect a mis-scoped foreign-named row");

            // Remove the implant and restore the metadata; the oracle must return to 0.
            try (var connection = DriverManager.getConnection("jdbc:sqlite:" + beta.path);
                    var statement = connection.createStatement()) {
                statement.execute("PRAGMA busy_timeout = 5000");
                statement.execute(
                        "DELETE FROM player_characters WHERE name = 'RC-Alpha-implant'");
                statement.execute("UPDATE party_roster_metadata SET next_character_id = "
                        + originalNextId + " WHERE singleton_id = 1");
            }
            assertEquals(0L, crossCampaignRosterRows(alpha, beta),
                    "removing the implant must restore clean containment");

            // Benign control: one extra production-route same-campaign create must not
            // trip any containment oracle and must appear in projection and store
            // exactly once.
            CampaignRuntime betaRuntime = coordinator.activeRuntimeForTesting();
            String benignName = beta.prefix + "benign";
            betaRuntime.components().party().application().createCharacter(
                    new CreateCharacterCommand(new CharacterDraft(
                            benignName, null, null, null, null)));
            awaitFxCondition(() -> memberByName(
                    projectionMembersOnCurrentThread(betaRuntime), benignName) != null);
            assertEquals(1L, countRosterNamed(beta.path, benignName),
                    "benign create must be durable exactly once");
            assertEquals(1L, projectionMembers(betaRuntime).stream()
                            .filter(member -> benignName.equals(member.name())).count(),
                    "benign create must be visible exactly once");
            comparisonPoint(coordinator, beta, alpha, "controls benign create");
            assertContainmentScansClean(alpha, beta, "controls benign create");
            System.out.println("BENIGN-CONTROL crossCampaignRows="
                    + crossCampaignRosterRows(alpha, beta));
            harness.closeWindow();
        }
    }

    // ------------------------------------------------------------------
    // Roster workload helpers
    // ------------------------------------------------------------------

    /** Per-campaign identity, expectation, and oracle bookkeeping. */
    private static final class CampaignHandle {

        final String prefix;
        CampaignId id;
        Path path;
        long e1;
        long e2;
        long solo;
        String expectedEchoPlayer;
        Integer expectedEchoLevel;
        Integer expectedEchoPassivePerception;
        Integer expectedEchoArmorClass;
        long lastNextCharacterId;

        CampaignHandle(String prefix) {
            this.prefix = prefix;
        }
    }

    /**
     * Seeds one campaign through the production PartyApplicationService: two namesake
     * "Echo" PCs (optional statistics truly absent) and one fully-statted Solo PC.
     */
    private void seedRoster(CampaignRuntime runtime, CampaignHandle handle) throws Exception {
        awaitFxCondition(() -> runtime.components().party().snapshot().current().status()
                == ReadStatus.SUCCESS);
        String echoName = handle.prefix + "Echo";
        var application = runtime.components().party().application();
        application.createCharacter(new CreateCharacterCommand(
                new CharacterDraft(echoName, null, null, null, null)));
        application.createCharacter(new CreateCharacterCommand(
                new CharacterDraft(echoName, null, null, null, null)));
        application.createCharacter(new CreateCharacterCommand(
                new CharacterDraft(handle.prefix + "Solo", null, 3, 14, 16)));
        awaitFxCondition(() -> projectionMembersOnCurrentThread(runtime).size() == 3);
        List<PartyMemberDetails> members = projectionMembers(runtime);
        List<Long> echoIds = members.stream()
                .filter(member -> echoName.equals(member.name()))
                .map(PartyMemberDetails::id)
                .sorted()
                .toList();
        assertEquals(2, echoIds.size(), "both namesakes must exist: " + echoName);
        handle.e1 = echoIds.get(0);
        handle.e2 = echoIds.get(1);
        assertNotEquals(handle.e1, handle.e2,
                "namesakes must have distinct stable identities");
        handle.solo = members.stream()
                .filter(member -> (handle.prefix + "Solo").equals(member.name()))
                .map(PartyMemberDetails::id)
                .findFirst()
                .orElseThrow();
        PartyMemberDetails firstEcho = memberById(members, handle.e1);
        assertNull(firstEcho.playerName(), "seeded namesake player must be truly absent");
        assertNull(firstEcho.level(), "seeded namesake level must be truly absent");
        assertNull(firstEcho.passivePerception(),
                "seeded namesake passive perception must be truly absent");
        assertNull(firstEcho.armorClass(), "seeded namesake AC must be truly absent");
        handle.expectedEchoPlayer = null;
        handle.expectedEchoLevel = null;
        handle.expectedEchoPassivePerception = null;
        handle.expectedEchoArmorClass = null;
    }

    /**
     * Per-block roster CRUD on the active campaign: namesake e1 stat toggle (odd blocks
     * set player/level/pp/ac, even blocks clear all optionals to truly absent), one
     * create, and the deletion of the previous block's create (id resolved from the
     * projection at delete time).
     */
    private void blockMutations(
            CampaignActivationCoordinator coordinator,
            CampaignHandle handle,
            int block
    ) throws Exception {
        CampaignRuntime runtime = coordinator.activeRuntimeForTesting();
        var application = runtime.components().party().application();
        boolean odd = block % 2 == 1;
        String player = odd ? "Mira" : null;
        Integer level = odd ? 7 : null;
        Integer passivePerception = odd ? 15 : null;
        Integer armorClass = odd ? 17 : null;
        application.updateCharacter(new UpdateCharacterCommand(handle.e1, new CharacterDraft(
                handle.prefix + "Echo", player, level, passivePerception, armorClass)));
        awaitFxCondition(() -> memberStatsMatch(
                memberById(projectionMembersOnCurrentThread(runtime), handle.e1),
                player, level, passivePerception, armorClass));
        handle.expectedEchoPlayer = player;
        handle.expectedEchoLevel = level;
        handle.expectedEchoPassivePerception = passivePerception;
        handle.expectedEchoArmorClass = armorClass;

        String createName = handle.prefix + "b" + block;
        application.createCharacter(new CreateCharacterCommand(
                new CharacterDraft(createName, null, null, null, null)));
        awaitFxCondition(() -> memberByName(
                projectionMembersOnCurrentThread(runtime), createName) != null);

        if (block > 1) {
            String previousName = handle.prefix + "b" + (block - 1);
            PartyMemberDetails previous =
                    memberByName(projectionMembers(runtime), previousName);
            assertTrue(previous != null,
                    "previous block's create must still be visible: " + previousName);
            application.deleteCharacter(new DeleteCharacterCommand(previous.id()));
            awaitFxCondition(() -> memberByName(
                    projectionMembersOnCurrentThread(runtime), previousName) == null);
        }
    }

    /** Restored campaign must accept a roster write again after a cancelled switch. */
    private void postCancelRoundTrip(
            CampaignActivationCoordinator coordinator,
            CampaignHandle handle,
            int block
    ) throws Exception {
        CampaignRuntime runtime = coordinator.activeRuntimeForTesting();
        var application = runtime.components().party().application();
        String name = handle.prefix + "postcancel-b" + block;
        application.createCharacter(new CreateCharacterCommand(
                new CharacterDraft(name, null, null, null, null)));
        awaitFxCondition(() -> memberByName(
                projectionMembersOnCurrentThread(runtime), name) != null);
        PartyMemberDetails created = memberByName(projectionMembers(runtime), name);
        application.deleteCharacter(new DeleteCharacterCommand(created.id()));
        awaitFxCondition(() -> memberByName(
                projectionMembersOnCurrentThread(runtime), name) == null);
    }

    /**
     * Deciding metric 3 comparison point: the visible Party/Roster projection equals the
     * per-campaign external JDBC oracle exactly; namesake integrity (metric 2) and id
     * invariants hold; no foreign-campaign entry is visible.
     */
    private void comparisonPoint(
            CampaignActivationCoordinator coordinator,
            CampaignHandle active,
            CampaignHandle foreign,
            String label
    ) throws Exception {
        CampaignRuntime runtime = coordinator.activeRuntimeForTesting();
        awaitFxCondition(() -> runtime.components().party().mutation().current().status()
                == MutationStatus.SUCCESS);
        List<PartyMemberDetails> projection = projectionMembers(runtime);
        StoreTruth store = storeTruth(active.path);

        assertEquals(memberTruthsFromStore(store), memberTruthsFromProjection(projection),
                label + ": visible roster projection must equal the JDBC oracle");
        assertTrue(projection.stream().noneMatch(
                        member -> member.name().startsWith(foreign.prefix)),
                label + ": no foreign-campaign roster entry may be visible");

        // Id invariants: unique positive ids, next_character_id > max(id), monotone.
        Set<Long> uniqueIds = new HashSet<>();
        long maxId = 0L;
        for (RowTruth row : store.rows()) {
            assertTrue(row.id() > 0L, label + ": ids must be positive");
            assertTrue(uniqueIds.add(row.id()), label + ": ids must be unique");
            maxId = Math.max(maxId, row.id());
        }
        assertTrue(store.nextCharacterId() > maxId,
                label + ": next_character_id must exceed max(id)");
        assertTrue(store.nextCharacterId() >= active.lastNextCharacterId,
                label + ": next_character_id must be monotonically non-decreasing");
        active.lastNextCharacterId = store.nextCharacterId();

        // Namesake integrity (metric 2): both Echoes exist under their original ids;
        // e1 carries exactly the block-parity statistics; e2 never gained any optional.
        RowTruth e1Row = rowById(store, active.e1);
        RowTruth e2Row = rowById(store, active.e2);
        String echoName = active.prefix + "Echo";
        assertEquals(echoName, e1Row.name(), label + ": e1 identity");
        assertEquals(echoName, e2Row.name(), label + ": e2 identity");
        assertEquals(active.expectedEchoPlayer, e1Row.playerName(),
                label + ": e1 player parity");
        assertEquals(active.expectedEchoLevel, e1Row.level(), label + ": e1 level parity");
        assertEquals(active.expectedEchoPassivePerception, e1Row.passivePerception(),
                label + ": e1 passive-perception parity");
        assertEquals(active.expectedEchoArmorClass, e1Row.armorClass(),
                label + ": e1 AC parity");
        assertNull(e2Row.playerName(), label + ": e2 must never gain a player");
        assertNull(e2Row.level(), label + ": e2 must never gain a level");
        assertNull(e2Row.passivePerception(),
                label + ": e2 must never gain passive perception");
        assertNull(e2Row.armorClass(), label + ": e2 must never gain an AC");
        RowTruth soloRow = rowById(store, active.solo);
        assertEquals(active.prefix + "Solo", soloRow.name(), label + ": solo identity");
        assertEquals(Integer.valueOf(3), soloRow.level(), label + ": solo level stable");
        assertEquals(Integer.valueOf(14), soloRow.passivePerception(),
                label + ": solo passive perception stable");
        assertEquals(Integer.valueOf(16), soloRow.armorClass(), label + ": solo AC stable");
    }

    private static void assertContainmentScansClean(
            CampaignHandle alpha,
            CampaignHandle beta,
            String label
    ) throws Exception {
        assertEquals(0L, crossCampaignRosterRows(alpha, beta),
                "cross-campaign roster rows " + label);
        assertEquals(0L,
                countRosterLike(alpha.path, "RC-REVOKED-%")
                        + countRosterLike(alpha.path, "RC-CLOSED-%")
                        + countRosterLike(beta.path, "RC-REVOKED-%")
                        + countRosterLike(beta.path, "RC-CLOSED-%"),
                "revoked/closed-window roster rows " + label);
    }

    private static long crossCampaignRosterRows(CampaignHandle alpha, CampaignHandle beta)
            throws Exception {
        return countRosterLike(alpha.path, beta.prefix + "%")
                + countRosterLike(beta.path, alpha.prefix + "%");
    }

    /**
     * Attempts one roster create through a production service reference captured while
     * the runtime was still admitted (the shape a production UI holds across a switch
     * boundary, which bypasses the CampaignRuntime.components() state guard and lands on
     * the WorkflowAdmissionController seam). ADMITTED means the submission was accepted
     * by the admitted lane (the mutation itself is atomic in the store); a synchronous
     * rejection is the visible-refusal arm of metric 4.
     */
    private static String attemptRosterCreate(
            features.party.api.PartyApi application,
            String name
    ) {
        try {
            application.createCharacter(new CreateCharacterCommand(new CharacterDraft(
                    name, null, null, null, null)));
            return "ADMITTED";
        } catch (RuntimeException rejectedSynchronously) {
            return "REJECTED_SYNC:" + rejectedSynchronously.getClass().getSimpleName();
        }
    }

    /** Attempts one roster move; the production API converts rejections to results. */
    private static String attemptRosterMove(
            features.party.api.PartyApi application,
            long characterId
    ) {
        CompletionStage<MutationResult> stage;
        try {
            stage = application.moveCharacters(new MovePartyCharactersCommand(
                    List.of(characterId),
                    new PartyOverworldTravelLocationSnapshot(999L, 999L),
                    false));
        } catch (RuntimeException rejectedSynchronously) {
            return "REJECTED_SYNC:" + rejectedSynchronously.getClass().getSimpleName();
        }
        try {
            MutationResult result = stage.toCompletableFuture().get(2, TimeUnit.SECONDS);
            return result.status() == MutationStatus.SUCCESS
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

    private static boolean isAdmitted(String outcome) {
        return "ADMITTED".equals(outcome);
    }

    // ------------------------------------------------------------------
    // Projection readers (FX-thread idioms)
    // ------------------------------------------------------------------

    /** Reads active plus reserve members; must run on the FX thread or via runOnFx. */
    private static List<PartyMemberDetails> projectionMembersOnCurrentThread(
            CampaignRuntime runtime
    ) {
        PartySnapshotResult result = runtime.components().party().snapshot().current();
        if (result.status() != ReadStatus.SUCCESS) {
            return List.of();
        }
        List<PartyMemberDetails> members = new ArrayList<>(result.snapshot().activeMembers());
        members.addAll(result.snapshot().reserveMembers());
        return members;
    }

    private static List<PartyMemberDetails> projectionMembers(CampaignRuntime runtime)
            throws Exception {
        AtomicReference<List<PartyMemberDetails>> captured = new AtomicReference<>();
        runOnFx(() -> captured.set(projectionMembersOnCurrentThread(runtime)));
        return captured.get();
    }

    private static PartyMemberDetails memberById(List<PartyMemberDetails> members, long id) {
        return members.stream()
                .filter(member -> member.id() == id)
                .findFirst()
                .orElse(null);
    }

    private static PartyMemberDetails memberByName(
            List<PartyMemberDetails> members,
            String name
    ) {
        return members.stream()
                .filter(member -> name.equals(member.name()))
                .findFirst()
                .orElse(null);
    }

    private static boolean memberStatsMatch(
            PartyMemberDetails member,
            String player,
            Integer level,
            Integer passivePerception,
            Integer armorClass
    ) {
        return member != null
                && Objects.equals(player, member.playerName())
                && Objects.equals(level, member.level())
                && Objects.equals(passivePerception, member.passivePerception())
                && Objects.equals(armorClass, member.armorClass());
    }

    // ------------------------------------------------------------------
    // External JDBC roster oracle
    // ------------------------------------------------------------------

    private record RowTruth(
            long id,
            String name,
            String playerName,
            Integer level,
            Integer passivePerception,
            Integer armorClass,
            int inParty,
            Long travelOverworldMapId,
            Long travelOverworldTileId,
            int attachedToPartyToken
    ) { }

    private record StoreTruth(List<RowTruth> rows, long nextCharacterId) {
        private StoreTruth {
            rows = List.copyOf(rows);
        }
    }

    private record MemberTruth(
            long id,
            String name,
            String playerName,
            Integer level,
            Integer passivePerception,
            Integer armorClass,
            MembershipState membership
    ) { }

    private static StoreTruth storeTruth(Path campaignPath) throws Exception {
        Class.forName("org.sqlite.JDBC");
        List<RowTruth> rows = new ArrayList<>();
        long nextCharacterId;
        try (var connection = DriverManager.getConnection("jdbc:sqlite:" + campaignPath);
                var statement = connection.createStatement()) {
            try (var results = statement.executeQuery(
                    "SELECT id, name, player_name, level, passive_perception, ac, in_party, "
                            + "travel_overworld_map_id, travel_overworld_tile_id, "
                            + "attached_to_party_token "
                            + "FROM player_characters ORDER BY id")) {
                while (results.next()) {
                    rows.add(new RowTruth(
                            results.getLong("id"),
                            results.getString("name"),
                            results.getString("player_name"),
                            nullableInteger(results, "level"),
                            nullableInteger(results, "passive_perception"),
                            nullableInteger(results, "ac"),
                            results.getInt("in_party"),
                            nullableLong(results, "travel_overworld_map_id"),
                            nullableLong(results, "travel_overworld_tile_id"),
                            results.getInt("attached_to_party_token")));
                }
            }
            try (var results = statement.executeQuery(
                    "SELECT next_character_id FROM party_roster_metadata "
                            + "WHERE singleton_id = 1")) {
                assertTrue(results.next(), "party_roster_metadata singleton must exist");
                nextCharacterId = results.getLong(1);
            }
        }
        return new StoreTruth(rows, nextCharacterId);
    }

    private static long nextCharacterId(Path campaignPath) throws Exception {
        return storeTruth(campaignPath).nextCharacterId();
    }

    private static List<MemberTruth> memberTruthsFromStore(StoreTruth store) {
        return store.rows().stream()
                .map(row -> new MemberTruth(
                        row.id(),
                        row.name(),
                        row.playerName(),
                        row.level(),
                        row.passivePerception(),
                        row.armorClass(),
                        row.inParty() == 1 ? MembershipState.ACTIVE : MembershipState.RESERVE))
                .toList();
    }

    private static List<MemberTruth> memberTruthsFromProjection(
            List<PartyMemberDetails> members
    ) {
        return members.stream()
                .sorted(java.util.Comparator.comparingLong(PartyMemberDetails::id))
                .map(member -> new MemberTruth(
                        member.id(),
                        member.name(),
                        member.playerName(),
                        member.level(),
                        member.passivePerception(),
                        member.armorClass(),
                        member.membership()))
                .toList();
    }

    private static List<RowTruth> withoutRow(List<RowTruth> rows, long id) {
        return rows.stream().filter(row -> row.id() != id).toList();
    }

    private static RowTruth rowById(StoreTruth store, long id) {
        return store.rows().stream()
                .filter(row -> row.id() == id)
                .findFirst()
                .orElseThrow(() -> new AssertionError(
                        "expected roster row not found in store: id " + id));
    }

    private static long countRosterLike(Path campaignPath, String namePattern)
            throws Exception {
        Class.forName("org.sqlite.JDBC");
        try (var connection = DriverManager.getConnection("jdbc:sqlite:" + campaignPath);
                var statement = connection.prepareStatement(
                        "SELECT COUNT(*) FROM player_characters WHERE name LIKE ?")) {
            statement.setString(1, namePattern);
            try (var results = statement.executeQuery()) {
                results.next();
                return results.getLong(1);
            }
        }
    }

    private static long countRosterNamed(Path campaignPath, String name) throws Exception {
        Class.forName("org.sqlite.JDBC");
        try (var connection = DriverManager.getConnection("jdbc:sqlite:" + campaignPath);
                var statement = connection.prepareStatement(
                        "SELECT COUNT(*) FROM player_characters WHERE name = ?")) {
            statement.setString(1, name);
            try (var results = statement.executeQuery()) {
                results.next();
                return results.getLong(1);
            }
        }
    }

    private static Integer nullableInteger(java.sql.ResultSet results, String column)
            throws Exception {
        int value = results.getInt(column);
        return results.wasNull() ? null : value;
    }

    private static Long nullableLong(java.sql.ResultSet results, String column)
            throws Exception {
        long value = results.getLong(column);
        return results.wasNull() ? null : value;
    }

    // ------------------------------------------------------------------
    // Settled-heap guard sample (corroborating only)
    // ------------------------------------------------------------------

    private long settledHeapFloor(
            String label,
            CampaignActivationCoordinator coordinator,
            List<Path> campaignDatabases
    ) throws Exception {
        awaitCondition(() -> coordinator.snapshot().phase()
                        == CampaignActivationCoordinator.Phase.ACTIVE
                && coordinator.pendingCloseAttemptsForTesting() == 0
                && coordinator.trackedCloseObligationsForTesting() == 0,
                Duration.ofSeconds(30));
        runOnFx(() -> { });
        runOnFx(() -> { });
        awaitFxPulses(3);
        long previousHeap = Long.MAX_VALUE;
        long floor = Long.MAX_VALUE;
        int stableRounds = 0;
        for (int round = 0; round < 15 && stableRounds < 2; round++) {
            System.gc();
            Thread.sleep(150L);
            long currentHeap =
                    ManagementFactory.getMemoryMXBean().getHeapMemoryUsage().getUsed();
            floor = Math.min(floor, currentHeap);
            boolean heapStable = previousHeap != Long.MAX_VALUE
                    && Math.abs(currentHeap - previousHeap) <= previousHeap / 100L;
            stableRounds = heapStable ? stableRounds + 1 : 0;
            previousHeap = currentHeap;
        }
        boolean sidecars = false;
        for (Path database : campaignDatabases) {
            sidecars = sidecars
                    || Files.exists(database.resolveSibling(database.getFileName() + "-wal"))
                    || Files.exists(database.resolveSibling(database.getFileName() + "-shm"))
                    || Files.exists(database.resolveSibling(database.getFileName() + "-journal"));
        }
        System.out.println("PROBE-HEAP " + label + " floorBytes=" + floor
                + " sidecarsPresent=" + sidecars);
        return floor;
    }

    // ------------------------------------------------------------------
    // Coordinator helpers
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

    // ------------------------------------------------------------------
    // Probe-local production host harness (copy of the frozen journey harness)
    // ------------------------------------------------------------------

    private static final class ProbeHostHarness
            implements CampaignActivationCoordinator.SwitchingHost {

        private final Stage window;
        private final CampaignDeskHost production;

        private ProbeHostHarness() throws Exception {
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
            return production.switchCampaign(campaign, generation, shell);
        }

        @Override
        public CampaignActivationCoordinator.RootSwitchResult switchCampaign(
                CampaignSnapshot campaign,
                long generation,
                CampaignActivationCoordinator.PublicationSurface surface
        ) {
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
                throw new AssertionError("Timed out waiting for probe condition");
            }
            java.util.concurrent.locks.LockSupport.parkNanos(TimeUnit.MILLISECONDS.toNanos(5));
        }
    }

    private static void awaitFxCondition(java.util.function.BooleanSupplier condition)
            throws Exception {
        long deadline = System.nanoTime() + TIMEOUT.toNanos();
        while (System.nanoTime() < deadline) {
            AtomicBoolean satisfied = new AtomicBoolean();
            runOnFx(() -> satisfied.set(condition.getAsBoolean()));
            if (satisfied.get()) {
                return;
            }
            java.util.concurrent.locks.LockSupport.parkNanos(TimeUnit.MILLISECONDS.toNanos(5));
        }
        throw new AssertionError("Timed out waiting for JavaFX condition");
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
