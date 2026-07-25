package app;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
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
import java.nio.charset.StandardCharsets;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import platform.diagnostics.NoopDiagnostics;
import platform.execution.ExecutionLane;
import platform.execution.WorkflowAdmissionController;
import shell.host.AppShell;

final class CampaignActivationCoordinatorTest {

    @TempDir
    Path temporaryDirectory;

    @Test
    void oneParkedRuntimeIsReusedAcrossAlternatingCampaignsWithFreshGenerations()
            throws Exception {
        FakeRegistry registry = new FakeRegistry();
        List<ReusableFakeCandidate> candidates = new ArrayList<>();
        AtomicInteger identity = new AtomicInteger(1);
        CampaignActivationCoordinator coordinator = new CampaignActivationCoordinator(
                NoopDiagnostics.INSTANCE,
                registry,
                temporaryDirectory.resolve("bounded-parked-reuse"),
                (id, path, intent) -> {
                    writeCandidateFile(path);
                    ReusableFakeCandidate candidate = new ReusableFakeCandidate();
                    candidates.add(candidate);
                    return CompletableFuture.completedFuture(candidate);
                },
                new FakeHost(),
                () -> new UUID(20L, identity.getAndIncrement()));

        var alpha = await(coordinator.create("Alpha", 0L));
        var beta = await(coordinator.create("Beta", 1L));
        CampaignId alphaId = alpha.durableActivation().orElseThrow()
                .campaign().orElseThrow().id();
        CampaignId betaId = beta.durableActivation().orElseThrow()
                .campaign().orElseThrow().id();

        assertEquals(3L, await(coordinator.switchTo(alphaId, 2L))
                .durableActivation().orElseThrow().generation());
        assertEquals(4L, await(coordinator.switchTo(betaId, 3L))
                .durableActivation().orElseThrow().generation());

        assertEquals(2, candidates.size());
        assertEquals(2, candidates.get(0).activationCount.get());
        assertEquals(2, candidates.get(1).activationCount.get());
        assertThrowsRejectedMutation(candidates.get(0));
        assertEquals(1, candidates.get(1).acceptMutation());

        coordinator.close();
        assertEquals(1, candidates.get(0).closeAttempts.get());
        assertEquals(1, candidates.get(1).closeAttempts.get());
    }

    @Test
    void staleReuseReturnsTheLoanAndThirdTargetWaitsForSuccessfulEviction()
            throws Exception {
        FakeRegistry registry = new FakeRegistry();
        List<ReusableFakeCandidate> candidates = new ArrayList<>();
        AtomicInteger identity = new AtomicInteger(1);
        CampaignActivationCoordinator coordinator = new CampaignActivationCoordinator(
                NoopDiagnostics.INSTANCE,
                registry,
                temporaryDirectory.resolve("bounded-parked-eviction"),
                (id, path, intent) -> {
                    writeCandidateFile(path);
                    ReusableFakeCandidate candidate = new ReusableFakeCandidate();
                    candidates.add(candidate);
                    return CompletableFuture.completedFuture(candidate);
                },
                new FakeHost(),
                () -> new UUID(21L, identity.getAndIncrement()));

        var alpha = await(coordinator.create("Alpha", 0L));
        var beta = await(coordinator.create("Beta", 1L));
        CampaignId alphaId = alpha.durableActivation().orElseThrow()
                .campaign().orElseThrow().id();

        assertEquals(CampaignActivationCoordinator.Status.STALE_GENERATION,
                await(coordinator.switchTo(alphaId, 1L)).status());
        assertEquals(2, candidates.size());
        assertEquals(1, candidates.get(1).resumeCount.get());

        assertEquals(CampaignActivationCoordinator.Status.ACTIVATED,
                await(coordinator.switchTo(alphaId, 2L)).status());
        candidates.get(1).failCloseAttempts.set(2);

        assertEquals(CampaignActivationCoordinator.Status.PRE_COMMIT_FAILED,
                await(coordinator.create("Gamma", 3L)).status());
        assertEquals(2, candidates.size(), "third factory must wait for deterministic eviction");
        assertEquals(1, candidates.get(1).closeAttempts.get());
        assertEquals(1, candidates.get(0).acceptMutation());

        assertEquals(CampaignActivationCoordinator.Status.PRE_COMMIT_FAILED,
                await(coordinator.create("Delta", 3L)).status());
        assertEquals(2, candidates.size(),
                "an unresolved parked eviction must continue to occupy the bounded slot");
        assertEquals(2, candidates.get(1).closeAttempts.get());

        assertEquals(CampaignActivationCoordinator.Status.ACTIVATED,
                await(coordinator.create("Epsilon", 3L)).status());
        assertEquals(3, candidates.size(),
                "the next factory may run only after the parked eviction has settled");

        coordinator.close();
    }

    @Test
    void changedButValidParkedStateClosesAggregateBeforeColdRetry() throws Exception {
        FakeRegistry registry = new FakeRegistry();
        List<ReusableFakeCandidate> candidates = new ArrayList<>();
        AtomicInteger identity = new AtomicInteger(1);
        try (CampaignActivationCoordinator coordinator = new CampaignActivationCoordinator(
                NoopDiagnostics.INSTANCE,
                registry,
                temporaryDirectory.resolve("changed-parked-cold-retry"),
                (id, path, intent) -> {
                    writeCandidateFile(path);
                    ReusableFakeCandidate candidate = new ReusableFakeCandidate();
                    candidates.add(candidate);
                    return CompletableFuture.completedFuture(candidate);
                },
                new FakeHost(),
                () -> new UUID(23L, identity.getAndIncrement()))) {
            var alpha = await(coordinator.create("Alpha", 0L));
            await(coordinator.create("Beta", 1L));
            ReusableFakeCandidate parkedAlpha = candidates.get(0);
            parkedAlpha.parkedValid.set(false);

            assertEquals(CampaignActivationCoordinator.Status.PRE_COMMIT_FAILED,
                    await(coordinator.switchTo(
                            alpha.durableActivation().orElseThrow().campaign().orElseThrow().id(),
                            2L)).status());
            assertEquals(1, parkedAlpha.closeAttempts.get());
            assertEquals(2, candidates.size());

            assertEquals(CampaignActivationCoordinator.Status.ACTIVATED,
                    await(coordinator.switchTo(
                            alpha.durableActivation().orElseThrow().campaign().orElseThrow().id(),
                            2L)).status());
            assertEquals(3, candidates.size(),
                    "retry must rebuild instead of republishing stale in-memory state");
        }
    }

    @Test
    void delayedPreCommitDrainReturnsBorrowedParkedRuntimeForLaterReuse() throws Exception {
        FakeRegistry registry = new FakeRegistry();
        List<ReusableFakeCandidate> candidates = new ArrayList<>();
        AtomicInteger identity = new AtomicInteger(1);
        try (CampaignActivationCoordinator coordinator = new CampaignActivationCoordinator(
                NoopDiagnostics.INSTANCE, registry,
                temporaryDirectory.resolve("delayed-drain-returns-parked"),
                (id, path, intent) -> {
                    writeCandidateFile(path);
                    ReusableFakeCandidate candidate = new ReusableFakeCandidate();
                    candidates.add(candidate);
                    return CompletableFuture.completedFuture(candidate);
                },
                new FakeHost(),
                () -> new UUID(24L, identity.getAndIncrement()),
                java.time.Duration.ofMillis(100))) {
            var alpha = await(coordinator.create("Alpha", 0L));
            await(coordinator.create("Beta", 1L));
            ReusableFakeCandidate alphaCandidate = candidates.get(0);
            ReusableFakeCandidate betaCandidate = candidates.get(1);
            CompletableFuture<Void> drain = new CompletableFuture<>();
            betaCandidate.setPauseResult(drain);

            assertEquals(CampaignActivationCoordinator.Status.RECOVERY_UNAVAILABLE,
                    await(coordinator.switchTo(
                            alpha.durableActivation().orElseThrow().campaign().orElseThrow().id(),
                            2L)).status());

            drain.complete(null);
            assertEquals(CampaignActivationCoordinator.Status.RESUMED,
                    await(coordinator.recoverDurableActive()).status());
            betaCandidate.setPauseResult(CompletableFuture.completedFuture(null));
            assertEquals(CampaignActivationCoordinator.Status.ACTIVATED,
                    await(coordinator.switchTo(
                            alpha.durableActivation().orElseThrow().campaign().orElseThrow().id(),
                            2L)).status());
            assertEquals(2, candidates.size(), "the returned PARKED runtime must be reused");
            assertEquals(0, alphaCandidate.closeAttempts.get());
            assertEquals(2, alphaCandidate.activationCount.get());
        }
    }

    @Test
    void delayedCommitWithConfirmedPriorReturnsBorrowedParkedRuntimeForLaterReuse()
            throws Exception {
        FakeRegistry registry = new FakeRegistry();
        List<ReusableFakeCandidate> candidates = new ArrayList<>();
        AtomicInteger identity = new AtomicInteger(1);
        try (CampaignActivationCoordinator coordinator = new CampaignActivationCoordinator(
                NoopDiagnostics.INSTANCE, registry,
                temporaryDirectory.resolve("delayed-commit-returns-parked"),
                (id, path, intent) -> {
                    writeCandidateFile(path);
                    ReusableFakeCandidate candidate = new ReusableFakeCandidate();
                    candidates.add(candidate);
                    return CompletableFuture.completedFuture(candidate);
                },
                new FakeHost(),
                () -> new UUID(25L, identity.getAndIncrement()),
                java.time.Duration.ofMillis(100))) {
            var alpha = await(coordinator.create("Alpha", 0L));
            await(coordinator.create("Beta", 1L));
            ReusableFakeCandidate alphaCandidate = candidates.get(0);
            registry.nextCommit = CommitBehavior.NEVER_COMPLETES;

            assertEquals(CampaignActivationCoordinator.Status.RECOVERY_UNAVAILABLE,
                    await(coordinator.switchTo(
                            alpha.durableActivation().orElseThrow().campaign().orElseThrow().id(),
                            2L)).status());
            registry.pendingCommit.complete(new CampaignPointerCommitResult(
                    CampaignPointerCommitResult.Status.STORAGE_ERROR, Optional.empty()));

            assertEquals(CampaignActivationCoordinator.Status.RESUMED,
                    await(coordinator.recoverDurableActive()).status());
            assertEquals(CampaignActivationCoordinator.Status.ACTIVATED,
                    await(coordinator.switchTo(
                            alpha.durableActivation().orElseThrow().campaign().orElseThrow().id(),
                            2L)).status());
            assertEquals(2, candidates.size(), "the prior-confirmed loan must remain reusable");
            assertEquals(0, alphaCandidate.closeAttempts.get());
            assertEquals(2, alphaCandidate.activationCount.get());
        }
    }

    @Test
    void ambiguousCommittedTargetAndPostCommitFailureNeverCacheThePriorRuntime()
            throws Exception {
        FakeRegistry registry = new FakeRegistry();
        List<ReusableFakeCandidate> candidates = new ArrayList<>();
        FakeHost host = new FakeHost();
        AtomicInteger identity = new AtomicInteger(1);
        Path root = temporaryDirectory.resolve("recovery-does-not-cache-prior");
        CampaignActivationCoordinator coordinator = new CampaignActivationCoordinator(
                NoopDiagnostics.INSTANCE,
                registry,
                root,
                (id, path, intent) -> {
                    writeCandidateFile(path);
                    ReusableFakeCandidate candidate = new ReusableFakeCandidate();
                    candidates.add(candidate);
                    return CompletableFuture.completedFuture(candidate);
                },
                host,
                () -> new UUID(22L, identity.getAndIncrement()));

        var alpha = await(coordinator.create("Alpha", 0L));
        CampaignId alphaId = alpha.durableActivation().orElseThrow()
                .campaign().orElseThrow().id();
        registry.nextCommit = CommitBehavior.STORAGE_AFTER_TARGET;

        assertEquals(CampaignActivationCoordinator.Status.ACTIVATED,
                await(coordinator.create("Beta", 1L)).status());
        assertEquals(1, candidates.get(0).closeAttempts.get(),
                "ambiguous commit confirmation must retire rather than cache the prior");

        assertEquals(CampaignActivationCoordinator.Status.ACTIVATED,
                await(coordinator.switchTo(alphaId, 2L)).status());
        assertEquals(3, candidates.size(), "retired prior must be prepared again");

        host.failAfterRootSwap.set(true);
        var failed = await(coordinator.create("Gamma", 3L));
        assertEquals(CampaignActivationCoordinator.Status.RECOVERY_REQUIRED, failed.status());
        assertEquals(1, candidates.get(2).closeAttempts.get(),
                "post-commit publication failure must retire rather than cache the prior");

        coordinator.close();
    }

    @Test
    void createCollisionNeverDeletesOrMutatesPreexistingOrphan() throws Exception {
        UUID collision = UUID.fromString("10000000-0000-0000-0000-000000000001");
        Path orphan = temporaryDirectory.resolve(collision.toString());
        Files.createDirectories(orphan);
        Path payload = orphan.resolve("campaign.sqlite");
        byte[] original = "orphan-owned-data".getBytes(StandardCharsets.UTF_8);
        Files.write(payload, original);
        FakeRegistry registry = new FakeRegistry();
        AtomicInteger prepared = new AtomicInteger();
        try (CampaignActivationCoordinator coordinator = new CampaignActivationCoordinator(
                NoopDiagnostics.INSTANCE,
                registry,
                temporaryDirectory,
                (id, path, intent) -> {
                    prepared.incrementAndGet();
                    return CompletableFuture.completedFuture(new FakeCandidate());
                },
                new FakeHost(),
                () -> collision)) {
            var result = await(coordinator.create("Collision", 0L));
            assertEquals(CampaignActivationCoordinator.Status.PRE_COMMIT_FAILED, result.status());
        }
        assertEquals(0, prepared.get());
        assertArrayEquals(original, Files.readAllBytes(payload));
    }

    @Test
    void createRejectsSymbolicRootAncestorBeforeCreatingAnythingOutsideOwnership() throws Exception {
        Path outside = temporaryDirectory.resolve("outside-root");
        Files.createDirectories(outside);
        Path symbolic = temporaryDirectory.resolve("symbolic-root");
        Files.createSymbolicLink(symbolic, outside);
        Path campaignRoot = symbolic.resolve("must-not-be-created");
        FakeRegistry registry = new FakeRegistry();
        try (CampaignActivationCoordinator coordinator = new CampaignActivationCoordinator(
                NoopDiagnostics.INSTANCE,
                registry,
                campaignRoot,
                (id, path, intent) -> CompletableFuture.completedFuture(new FakeCandidate()),
                new FakeHost())) {
            assertEquals(CampaignActivationCoordinator.Status.PRE_COMMIT_FAILED,
                    await(coordinator.create("Blocked", 0L)).status());
        }
        assertFalse(Files.exists(outside.resolve("must-not-be-created")));
    }

    @Test
    void missingEmptyAndSymbolicExistingCampaignsEnterRecoveryWithoutFactoryMutation()
            throws Exception {
        UUID id = UUID.fromString("20000000-0000-0000-0000-000000000001");
        CampaignSnapshot campaign = new CampaignSnapshot(new CampaignId(id), "Existing");
        CampaignActivation durable = new CampaignActivation(Optional.of(campaign), 1L);
        for (String variant : List.of("missing", "empty", "symbolic", "symbolic-ancestor")) {
            Path root = temporaryDirectory.resolve(variant);
            Path campaignPath = root.resolve(id.toString()).resolve("campaign.sqlite");
            Files.createDirectories(campaignPath.getParent());
            if (variant.equals("empty")) {
                Files.createFile(campaignPath);
            } else if (variant.equals("symbolic")) {
                Path target = temporaryDirectory.resolve("symbolic-target");
                Files.writeString(target, "preexisting-target");
                Files.createSymbolicLink(campaignPath, target);
            } else if (variant.equals("symbolic-ancestor")) {
                Files.delete(campaignPath.getParent());
                Path outside = temporaryDirectory.resolve("outside-campaign");
                Files.createDirectories(outside);
                Files.writeString(outside.resolve("campaign.sqlite"), "preexisting-target");
                Files.createSymbolicLink(campaignPath.getParent(), outside);
            }
            FakeRegistry registry = new FakeRegistry();
            registry.active = durable;
            AtomicInteger prepared = new AtomicInteger();
            try (CampaignActivationCoordinator coordinator = new CampaignActivationCoordinator(
                    NoopDiagnostics.INSTANCE,
                    registry,
                    root,
                    (candidateId, path, intent) -> {
                        prepared.incrementAndGet();
                        return CompletableFuture.completedFuture(new FakeCandidate());
                    },
                    new FakeHost())) {
                var result = await(coordinator.resumeDurableActive());
                assertEquals(CampaignActivationCoordinator.Status.RECOVERY_REQUIRED, result.status());
                assertEquals(CampaignActivationCoordinator.Phase.RECOVERY_REQUIRED,
                        coordinator.snapshot().phase());
            }
            assertEquals(0, prepared.get(), variant);
            if (variant.equals("missing")) {
                assertFalse(Files.exists(campaignPath));
            } else if (variant.equals("empty")) {
                assertEquals(0L, Files.size(campaignPath));
            } else if (variant.equals("symbolic")) {
                assertTrue(Files.isSymbolicLink(campaignPath));
            } else {
                assertTrue(Files.isSymbolicLink(campaignPath.getParent()));
            }
        }
    }

    @Test
    void explicitPreCommitTargetFailuresWithoutPriorStayIdleAndAllowAnotherSelection()
            throws Exception {
        Path root = temporaryDirectory.resolve("explicit-selection");
        Files.createDirectories(root);
        CampaignSnapshot damaged = registeredCampaign(
                "21000000-0000-0000-0000-000000000001", "Damaged");
        CampaignSnapshot prepareFailure = registeredCampaign(
                "21000000-0000-0000-0000-000000000002", "Prepare failure");
        CampaignSnapshot intact = registeredCampaign(
                "21000000-0000-0000-0000-000000000003", "Intact");
        Files.createDirectories(root.resolve(damaged.id().value().toString()));
        Files.createFile(root.resolve(damaged.id().value().toString()).resolve("campaign.sqlite"));
        writeExistingCampaign(root, prepareFailure);
        writeExistingCampaign(root, intact);

        FakeRegistry registry = new FakeRegistry();
        registry.campaigns.put(damaged.id(), damaged);
        registry.campaigns.put(prepareFailure.id(), prepareFailure);
        registry.campaigns.put(intact.id(), intact);
        FakeHost host = new FakeHost();
        List<FakeCandidate> candidates = new ArrayList<>();
        try (CampaignActivationCoordinator coordinator = new CampaignActivationCoordinator(
                NoopDiagnostics.INSTANCE,
                registry,
                root,
                (id, path, intent) -> {
                    if (id.equals(prepareFailure.id())) {
                        return CompletableFuture.failedFuture(
                                new IllegalStateException("injected prepare failure"));
                    }
                    FakeCandidate candidate = new FakeCandidate();
                    candidates.add(candidate);
                    return CompletableFuture.completedFuture(candidate);
                },
                host)) {
            assertEquals(
                    CampaignActivationCoordinator.Status.PRE_COMMIT_FAILED,
                    await(coordinator.switchTo(damaged.id(), 0L)).status());
            assertEquals(CampaignActivationCoordinator.Phase.IDLE, coordinator.snapshot().phase());
            assertTrue(coordinator.snapshot().failureType().isPresent());

            assertEquals(
                    CampaignActivationCoordinator.Status.PRE_COMMIT_FAILED,
                    await(coordinator.switchTo(prepareFailure.id(), 0L)).status());
            assertEquals(CampaignActivationCoordinator.Phase.IDLE, coordinator.snapshot().phase());
            assertTrue(coordinator.snapshot().failureType().isPresent());

            assertEquals(
                    CampaignActivationCoordinator.Status.ACTIVATED,
                    await(coordinator.switchTo(intact.id(), 0L)).status());
            assertEquals(CampaignActivationCoordinator.Phase.ACTIVE, coordinator.snapshot().phase());
            assertEquals(0, host.recoveryCount.get());
            assertEquals(1, candidates.size());
        }
    }

    @Test
    void recoveryWithoutAggregateCanCommitHealthyAlternativeWithoutTouchingDurableBytes()
            throws Exception {
        Path root = temporaryDirectory.resolve("durable-only-recovery-alternative");
        CampaignSnapshot damaged = registeredCampaign(
                "22000000-0000-0000-0000-000000000001", "Damaged");
        CampaignSnapshot healthy = registeredCampaign(
                "22000000-0000-0000-0000-000000000002", "Healthy");
        writeExistingCampaign(root, damaged);
        writeExistingCampaign(root, healthy);
        Path damagedPath = root.resolve(damaged.id().value().toString()).resolve("campaign.sqlite");
        byte[] damagedBytes = Files.readAllBytes(damagedPath);
        FakeRegistry registry = new FakeRegistry();
        registry.campaigns.put(damaged.id(), damaged);
        registry.campaigns.put(healthy.id(), healthy);
        registry.active = new CampaignActivation(Optional.of(damaged), 1L);
        List<FakeCandidate> candidates = new ArrayList<>();
        FakeHost host = new FakeHost();
        try (CampaignActivationCoordinator coordinator = new CampaignActivationCoordinator(
                NoopDiagnostics.INSTANCE,
                registry,
                root,
                (id, path, intent) -> {
                    if (id.equals(damaged.id())) {
                        return CompletableFuture.failedFuture(
                                new IllegalStateException("injected inaccessible durable store"));
                    }
                    FakeCandidate candidate = new FakeCandidate();
                    candidates.add(candidate);
                    return CompletableFuture.completedFuture(candidate);
                },
                host)) {
            assertEquals(CampaignActivationCoordinator.Status.RECOVERY_REQUIRED,
                    await(coordinator.resumeDurableActive()).status());
            assertEquals(0, candidates.size(), "damaged durable truth owns no aggregate");

            var switched = await(coordinator.switchFromRecovery(healthy.id(), 1L));

            assertEquals(CampaignActivationCoordinator.Status.ACTIVATED, switched.status());
            assertEquals(healthy.id(), switched.durableActivation().orElseThrow()
                    .campaign().orElseThrow().id());
            assertEquals("Healthy", host.visibleRoot.get());
            assertEquals(1, candidates.size());
            assertArrayEquals(damagedBytes, Files.readAllBytes(damagedPath));
        }
        assertArrayEquals(damagedBytes, Files.readAllBytes(damagedPath));
    }

    @Test
    void durableOnlyPreparationTimeoutRestoresDamagedTruthAndAllowsHealthyRetry()
            throws Exception {
        Path root = temporaryDirectory.resolve("durable-only-late-preparation");
        CampaignSnapshot damaged = registeredCampaign(
                "22000000-0000-0000-0000-000000000011", "Damaged");
        CampaignSnapshot healthy = registeredCampaign(
                "22000000-0000-0000-0000-000000000012", "Healthy");
        writeExistingCampaign(root, damaged);
        writeExistingCampaign(root, healthy);
        Path damagedPath = root.resolve(damaged.id().value().toString()).resolve("campaign.sqlite");
        byte[] damagedBytes = Files.readAllBytes(damagedPath);
        FakeRegistry registry = new FakeRegistry();
        registry.campaigns.put(damaged.id(), damaged);
        registry.campaigns.put(healthy.id(), healthy);
        registry.active = new CampaignActivation(Optional.of(damaged), 1L);
        CompletableFuture<CampaignActivationCoordinator.Candidate> delayed =
                new CompletableFuture<>();
        AtomicInteger healthyPreparations = new AtomicInteger();
        FakeCandidate lateCandidate = new FakeCandidate();
        try (CampaignActivationCoordinator coordinator = timedCoordinator(
                registry, root,
                (id, path, intent) -> {
                    if (id.equals(damaged.id())) {
                        return CompletableFuture.failedFuture(
                                new IllegalStateException("injected inaccessible durable store"));
                    }
                    return healthyPreparations.getAndIncrement() == 0
                            ? delayed
                            : CompletableFuture.completedFuture(new FakeCandidate());
                },
                new FakeHost())) {
            assertEquals(CampaignActivationCoordinator.Status.RECOVERY_REQUIRED,
                    await(coordinator.resumeDurableActive()).status());
            assertEquals(CampaignActivationCoordinator.Status.RECOVERY_UNAVAILABLE,
                    await(coordinator.switchFromRecovery(healthy.id(), 1L)).status());

            delayed.complete(lateCandidate);
            assertEquals(CampaignActivationCoordinator.Status.RECOVERY_REQUIRED,
                    await(coordinator.recoverDurableActive()).status());
            assertEquals(damaged.id(), coordinator.snapshot().durableActivation().orElseThrow()
                    .campaign().orElseThrow().id());
            assertEquals(1, lateCandidate.closeAttempts.get());
            assertArrayEquals(damagedBytes, Files.readAllBytes(damagedPath));

            assertEquals(CampaignActivationCoordinator.Status.ACTIVATED,
                    await(coordinator.switchFromRecovery(healthy.id(), 1L)).status());
            assertArrayEquals(damagedBytes, Files.readAllBytes(damagedPath));
        }
    }

    @Test
    void durableOnlyCommitTimeoutRestoresDamagedTruthAndAllowsHealthyRetry()
            throws Exception {
        Path root = temporaryDirectory.resolve("durable-only-late-commit");
        CampaignSnapshot damaged = registeredCampaign(
                "22000000-0000-0000-0000-000000000021", "Damaged");
        CampaignSnapshot healthy = registeredCampaign(
                "22000000-0000-0000-0000-000000000022", "Healthy");
        writeExistingCampaign(root, damaged);
        writeExistingCampaign(root, healthy);
        Path damagedPath = root.resolve(damaged.id().value().toString()).resolve("campaign.sqlite");
        byte[] damagedBytes = Files.readAllBytes(damagedPath);
        FakeRegistry registry = new FakeRegistry();
        registry.campaigns.put(damaged.id(), damaged);
        registry.campaigns.put(healthy.id(), healthy);
        registry.active = new CampaignActivation(Optional.of(damaged), 1L);
        List<FakeCandidate> candidates = new ArrayList<>();
        try (CampaignActivationCoordinator coordinator = timedCoordinator(
                registry, root,
                (id, path, intent) -> {
                    if (id.equals(damaged.id())) {
                        return CompletableFuture.failedFuture(
                                new IllegalStateException("injected inaccessible durable store"));
                    }
                    FakeCandidate candidate = new FakeCandidate();
                    candidates.add(candidate);
                    return CompletableFuture.completedFuture(candidate);
                },
                new FakeHost())) {
            assertEquals(CampaignActivationCoordinator.Status.RECOVERY_REQUIRED,
                    await(coordinator.resumeDurableActive()).status());
            registry.nextCommit = CommitBehavior.NEVER_COMPLETES;
            assertEquals(CampaignActivationCoordinator.Status.RECOVERY_UNAVAILABLE,
                    await(coordinator.switchFromRecovery(healthy.id(), 1L)).status());

            registry.pendingCommit.complete(new CampaignPointerCommitResult(
                    CampaignPointerCommitResult.Status.STORAGE_ERROR, Optional.empty()));
            assertEquals(CampaignActivationCoordinator.Status.RECOVERY_REQUIRED,
                    await(coordinator.recoverDurableActive()).status());
            assertEquals(1, candidates.get(0).closeAttempts.get());
            assertEquals(damaged.id(), coordinator.snapshot().durableActivation().orElseThrow()
                    .campaign().orElseThrow().id());
            assertArrayEquals(damagedBytes, Files.readAllBytes(damagedPath));

            assertEquals(CampaignActivationCoordinator.Status.ACTIVATED,
                    await(coordinator.switchFromRecovery(healthy.id(), 1L)).status());
            assertArrayEquals(damagedBytes, Files.readAllBytes(damagedPath));
        }
    }

    @Test
    void switchingToAlreadyActiveCampaignIsGenerationCheckedNoOp() throws Exception {
        FakeRegistry registry = new FakeRegistry();
        List<FakeCandidate> candidates = new ArrayList<>();
        try (CampaignActivationCoordinator coordinator = coordinator(
                registry, candidates, new FakeHost())) {
            var activated = await(coordinator.create("Alpha", 0L));
            CampaignId activeId = activated.durableActivation().orElseThrow()
                    .campaign().orElseThrow().id();
            FakeCandidate activeCandidate = candidates.get(0);
            activeCandidate.pauseResult = new CompletableFuture<>();
            int commits = registry.commitCalls.get();

            assertEquals(
                    CampaignActivationCoordinator.Status.STALE_GENERATION,
                    await(coordinator.switchTo(activeId, 0L)).status());
            assertEquals(
                    CampaignActivationCoordinator.Status.ACTIVATED,
                    await(coordinator.switchTo(activeId, 1L)).status());

            assertEquals(0, activeCandidate.pauseCount.get());
            assertEquals(1, candidates.size());
            assertEquals(commits, registry.commitCalls.get());
            assertEquals(CampaignActivationCoordinator.Phase.ACTIVE, coordinator.snapshot().phase());
        }
    }

    @Test
    void boundedFactoryAndPublicationStagesLeaveCoordinatorClosable() throws Exception {
        Path root = temporaryDirectory.resolve("bounded-phases");
        FakeRegistry registry = new FakeRegistry();
        CompletableFuture<CampaignActivationCoordinator.Candidate> pendingPreparation =
                new CompletableFuture<>();
        AtomicInteger factoryCalls = new AtomicInteger();
        CampaignActivationCoordinator factoryTimeout = timedCoordinator(
                registry, root,
                (id, path, intent) -> {
                    factoryCalls.incrementAndGet();
                    return pendingPreparation;
                },
                new FakeHost());

        var preparationTimeout =
                await(factoryTimeout.create("Late preparation", 0L));
        Path lateReservation = preparationTimeout.campaignPath().orElseThrow().getParent();
        assertEquals(
                CampaignActivationCoordinator.Status.RECOVERY_UNAVAILABLE,
                preparationTimeout.status());
        assertEquals(CampaignActivationCoordinator.Phase.RECOVERY_UNPUBLISHED,
                factoryTimeout.snapshot().phase());
        assertTrue(Files.exists(lateReservation));
        assertEquals(CampaignActivationCoordinator.Status.RECOVERY_UNAVAILABLE,
                await(factoryTimeout.create("Blocked retry", 0L)).status());
        assertEquals(1, factoryCalls.get());
        FakeCandidate lateCandidate = new FakeCandidate();
        pendingPreparation.complete(lateCandidate);
        assertEquals(CampaignActivationCoordinator.Status.PRE_COMMIT_FAILED,
                await(factoryTimeout.recoverDurableActive()).status());
        assertEquals(CampaignActivationCoordinator.Phase.IDLE, factoryTimeout.snapshot().phase());
        assertEquals(1, lateCandidate.closeAttempts.get());
        assertFalse(Files.exists(lateReservation));
        factoryTimeout.close();

        FakeRegistry publicationRegistry = new FakeRegistry();
        FakeCandidate neverPublished = new FakeCandidate();
        neverPublished.neverCompleteUi = true;
        FakeHost publicationHost = new FakeHost();
        CampaignActivationCoordinator publicationTimeout = timedCoordinator(
                publicationRegistry,
                temporaryDirectory.resolve("bounded-publication"),
                (id, path, intent) -> CompletableFuture.completedFuture(neverPublished),
                publicationHost);
        assertEquals(
                CampaignActivationCoordinator.Status.RECOVERY_UNAVAILABLE,
                await(publicationTimeout.create("Never published", 0L)).status());
        assertEquals(0, publicationHost.switchCount.get());
        neverPublished.neverCompleteUi = false;
        neverPublished.releaseUi(new IllegalStateException("stale publication cancelled"));
        assertEquals(CampaignActivationCoordinator.Status.RESUMED,
                await(publicationTimeout.recoverDurableActive()).status());
        assertEquals(1, publicationHost.switchCount.get());
        publicationTimeout.close();
        assertEquals(1, neverPublished.closeAttempts.get());

        FakeCandidate secondNeverPublished = new FakeCandidate();
        FakeHost neverRecoveryHost = new FakeHost();
        neverRecoveryHost.failAfterRootSwap.set(true);
        neverRecoveryHost.neverCompleteRecovery.set(true);
        CampaignActivationCoordinator recoveryTimeout = timedCoordinator(
                new FakeRegistry(),
                temporaryDirectory.resolve("bounded-recovery"),
                (id, path, intent) -> CompletableFuture.completedFuture(secondNeverPublished),
                neverRecoveryHost);
        assertEquals(
                CampaignActivationCoordinator.Status.RECOVERY_UNAVAILABLE,
                await(recoveryTimeout.create("Never recovered", 0L)).status());
        assertEquals(CampaignActivationCoordinator.Phase.RECOVERY_UNPUBLISHED,
                recoveryTimeout.snapshot().phase());
        neverRecoveryHost.releaseRecovery();
        assertEquals(CampaignActivationCoordinator.Status.RESUMED,
                await(recoveryTimeout.recoverDurableActive()).status());
        recoveryTimeout.close();
    }

    @Test
    void factoryTimeoutBeforePauseRestoresStillOpenPriorWithoutResumingItsAdmission()
            throws Exception {
        FakeRegistry registry = new FakeRegistry();
        WorkflowAdmissionController admission = new WorkflowAdmissionController();
        AdmissionCandidate prior = new AdmissionCandidate(admission);
        CompletableFuture<CampaignActivationCoordinator.Candidate> latePreparation =
                new CompletableFuture<>();
        AtomicInteger factoryCalls = new AtomicInteger();
        FakeCandidate lateCandidate = new FakeCandidate();
        FakeHost host = new FakeHost();
        try (CampaignActivationCoordinator coordinator = timedCoordinator(
                registry,
                temporaryDirectory.resolve("factory-timeout-open-prior"),
                (id, path, intent) -> factoryCalls.getAndIncrement() == 0
                        ? CompletableFuture.completedFuture(prior)
                        : latePreparation,
                host)) {
            assertEquals(CampaignActivationCoordinator.Status.ACTIVATED,
                    await(coordinator.create("Alpha", 0L)).status());

            assertEquals(CampaignActivationCoordinator.Status.RECOVERY_UNAVAILABLE,
                    await(coordinator.create("Late Beta", 1L)).status());
            assertEquals(0, prior.pauseCount.get());
            assertEquals(0, prior.resumeCount.get());
            assertEquals(1, host.switchCount.get(),
                    "the still-attached prior root must not be republished");
            assertEquals(1, prior.activationCount.get());

            CampaignSnapshot alternative = registeredCampaign(
                    "00000000-0000-0000-0000-0000000000f1", "Alternative");
            registry.campaigns.put(alternative.id(), alternative);
            writeExistingCampaign(
                    temporaryDirectory.resolve("factory-timeout-open-prior"), alternative);
            assertEquals(CampaignActivationCoordinator.Status.RECOVERY_UNAVAILABLE,
                    await(coordinator.switchFromRecovery(alternative.id(), 1L)).status());
            assertEquals(0, host.recoveryCount.get(),
                    "a recovery action cannot detach the healthy prior while preparation runs");
            assertEquals("Alpha", host.visibleRoot.get());

            latePreparation.complete(lateCandidate);
            assertEquals(CampaignActivationCoordinator.Status.RESUMED,
                    await(coordinator.recoverDurableActive()).status());
            assertEquals(0, prior.resumeCount.get());
            assertEquals(1, lateCandidate.closeAttempts.get());
            assertEquals(1, host.switchCount.get(),
                    "settlement must retain the already attached prior root");
            assertEquals(1, prior.activationCount.get());
            assertEquals(1, prior.acceptMutation());
            assertEquals(CampaignActivationCoordinator.Phase.ACTIVE,
                    coordinator.snapshot().phase());
        }
    }

    @Test
    void hostSwitchReleasedAfterPublicationTimeoutCannotOverrideRecoveryOrActivateCandidate()
            throws Exception {
        FakeRegistry registry = new FakeRegistry();
        FakeCandidate candidate = new FakeCandidate();
        candidate.asyncUi = true;
        FakeHost host = new FakeHost();
        host.blockSwitch.set(true);
        CampaignActivationCoordinator coordinator = timedCoordinator(
                registry,
                temporaryDirectory.resolve("late-host-switch"),
                (id, path, intent) -> CompletableFuture.completedFuture(candidate),
                host);

        CompletionStage<CampaignActivationCoordinator.Result> creation =
                coordinator.create("Late root", 0L);
        assertTrue(host.switchEntered.await(5, TimeUnit.SECONDS));
        var timedOut = await(creation);
        assertEquals(CampaignActivationCoordinator.Status.RECOVERY_UNAVAILABLE, timedOut.status());
        assertEquals(0, candidate.activationCount.get());
        assertThrowsRejectedMutation(candidate);

        host.releaseSwitch.countDown();
        awaitCondition(() -> "recovery".equals(host.visibleRoot.get())
                && host.recoveryCount.get() == 1);
        assertEquals(0, candidate.activationCount.get());
        assertThrowsRejectedMutation(candidate);
        CompletionStage<Void> terminalSettlement = coordinator.terminalCloseSettlement();
        if (terminalSettlement != null) {
            await(terminalSettlement);
        }
        coordinator.close();
    }

    @Test
    void publicationDrainReleasedAfterTimeoutCannotActivateOrReplaceRecovery() throws Exception {
        FakeRegistry registry = new FakeRegistry();
        FakeCandidate candidate = new FakeCandidate();
        CompletableFuture<Void> publicationDrain = new CompletableFuture<>();
        candidate.publicationDrain = publicationDrain;
        FakeHost host = new FakeHost();
        CampaignActivationCoordinator coordinator = timedCoordinator(
                registry,
                temporaryDirectory.resolve("late-publication-drain"),
                (id, path, intent) -> CompletableFuture.completedFuture(candidate),
                host);

        var timedOut = await(coordinator.create("Late drain", 0L));
        assertEquals(CampaignActivationCoordinator.Status.RECOVERY_REQUIRED, timedOut.status());
        assertEquals("recovery", host.visibleRoot.get());
        assertEquals(1, host.recoveryCount.get());
        assertEquals(0, candidate.activationCount.get());
        assertThrowsRejectedMutation(candidate);

        publicationDrain.complete(null);
        assertEquals(1, host.recoveryCount.get());
        assertEquals("recovery", host.visibleRoot.get());
        assertEquals(0, candidate.activationCount.get());
        assertThrowsRejectedMutation(candidate);
        coordinator.close();
    }

    @Test
    void recoveryPublicationWaitsForOwnedReadinessCancellationSettlement()
            throws Exception {
        FakeCandidate candidate = new FakeCandidate();
        CompletableFuture<Void> readiness = new CompletableFuture<>();
        CompletableFuture<Void> cancellationSettlement = new CompletableFuture<>();
        AtomicInteger cancellationCount = new AtomicInteger();
        CampaignActivationCoordinator.PublishedRootReadinessAttempt attempt =
                new CampaignActivationCoordinator.PublishedRootReadinessAttempt() {
                    @Override
                    public CompletionStage<Void> completion() {
                        return readiness;
                    }

                    @Override
                    public CompletionStage<Void> cancel() {
                        cancellationCount.incrementAndGet();
                        return cancellationSettlement;
                    }
                };
        FakeHost host = new FakeHost() {
            @Override
            public CampaignActivationCoordinator.PublishedRootReadinessAttempt
                    awaitPublishedRootReady(AppShell shell) {
                return attempt;
            }
        };
        CampaignActivationCoordinator coordinator = timedCoordinator(
                new FakeRegistry(),
                temporaryDirectory.resolve("readiness-cancel-before-recovery"),
                (id, path, intent) -> CompletableFuture.completedFuture(candidate),
                host);

        var timedOut = await(coordinator.create("Cancelled readiness", 0L));

        assertEquals(CampaignActivationCoordinator.Status.RECOVERY_UNAVAILABLE, timedOut.status());
        assertEquals(1, cancellationCount.get());
        assertEquals(0, host.recoveryCount.get(),
                "the host cannot self-heal before the coordinator-owned cancellation settles");
        assertEquals(0, candidate.activationCount.get());

        cancellationSettlement.complete(null);
        awaitCondition(() -> host.recoveryCount.get() == 1);
        assertEquals("recovery", host.visibleRoot.get());
        assertEquals(1, cancellationCount.get(), "readiness is cancelled exactly once");

        readiness.complete(null);
        assertEquals(0, candidate.activationCount.get(),
                "late readiness cannot activate after publication authority was revoked");
        assertEquals(1, host.recoveryCount.get(),
                "the late callback shares the already-published recovery root");
        coordinator.close();
    }

    @Test
    void publicationCommitBoundaryLinearizesTimeoutAndActivationForBothWinnerOrders()
            throws Exception {
        FakeCandidate timeoutWinner = new FakeCandidate();
        timeoutWinner.asyncUi = true;
        timeoutWinner.blockActivationTerminal = true;
        FakeHost timeoutHost = new FakeHost();
        CampaignActivationCoordinator timedOut = timedCoordinator(
                new FakeRegistry(),
                temporaryDirectory.resolve("publication-boundary-timeout-wins"),
                (id, path, intent) -> CompletableFuture.completedFuture(timeoutWinner),
                timeoutHost);
        CountDownLatch timeoutRevocationEntered = new CountDownLatch(1);
        timedOut.installPublicationTimeoutGateForTesting(timeoutRevocationEntered::countDown);
        CompletionStage<CampaignActivationCoordinator.Result> timeoutResult =
                timedOut.create("Timeout wins", 0L);
        assertTrue(timeoutWinner.activationTerminalEntered.await(5, TimeUnit.SECONDS));
        assertTrue(timeoutRevocationEntered.await(5, TimeUnit.SECONDS));
        var revoked = await(timeoutResult);
        assertEquals(CampaignActivationCoordinator.Status.RECOVERY_REQUIRED, revoked.status());
        assertEquals("recovery", timeoutHost.visibleRoot.get());
        assertEquals(1, timeoutHost.recoveryCount.get());
        timeoutWinner.releaseActivationTerminal.countDown();
        assertEquals(1, timeoutHost.recoveryCount.get());
        assertEquals(CampaignActivationCoordinator.Phase.RECOVERY_REQUIRED,
                timedOut.snapshot().phase());
        assertEquals("recovery", timeoutHost.visibleRoot.get());
        assertEquals(0, timeoutWinner.activationCount.get());
        assertThrowsRejectedMutation(timeoutWinner);
        timedOut.close();

        FakeCandidate commitWinner = new FakeCandidate();
        commitWinner.asyncUi = true;
        FakeHost commitHost = new FakeHost();
        CampaignActivationCoordinator committed = timedCoordinator(
                new FakeRegistry(),
                temporaryDirectory.resolve("publication-boundary-commit-wins"),
                (id, path, intent) -> CompletableFuture.completedFuture(commitWinner),
                commitHost);
        CountDownLatch authorizedInsideBoundary = new CountDownLatch(1);
        CountDownLatch releaseCommitBoundary = new CountDownLatch(1);
        CountDownLatch timeoutAttempted = new CountDownLatch(1);
        committed.installPublicationSettlementGateForTesting(() -> {
            authorizedInsideBoundary.countDown();
            awaitLatch(releaseCommitBoundary);
        });
        committed.installPublicationTimeoutGateForTesting(timeoutAttempted::countDown);
        CompletionStage<CampaignActivationCoordinator.Result> commitResult =
                committed.create("Commit wins", 0L);
        assertTrue(authorizedInsideBoundary.await(5, TimeUnit.SECONDS));
        assertTrue(timeoutAttempted.await(5, TimeUnit.SECONDS));
        releaseCommitBoundary.countDown();

        assertEquals(CampaignActivationCoordinator.Status.ACTIVATED,
                await(commitResult).status());
        assertEquals(CampaignActivationCoordinator.Phase.ACTIVE,
                committed.snapshot().phase());
        assertEquals("Commit wins", commitHost.visibleRoot.get());
        assertEquals(0, commitHost.recoveryCount.get());
        assertEquals(1, commitWinner.activationCount.get());
        assertEquals(1, commitWinner.acceptMutation());
        committed.close();
    }

    @Test
    void recoveryPublicationIsMemoizedAcrossTimeoutLateStaleCallbackAndRecovery() throws Exception {
        FakeCandidate candidate = new FakeCandidate();
        CompletableFuture<Void> drain = new CompletableFuture<>();
        candidate.publicationDrain = drain;
        FakeHost host = new FakeHost();
        host.neverCompleteRecovery.set(true);
        CampaignActivationCoordinator coordinator = timedCoordinator(
                new FakeRegistry(),
                temporaryDirectory.resolve("memoized-recovery-publication"),
                (id, path, intent) -> CompletableFuture.completedFuture(candidate),
                host);

        assertEquals(CampaignActivationCoordinator.Status.RECOVERY_UNAVAILABLE,
                await(coordinator.create("Memoized recovery", 0L)).status());
        assertEquals(1, host.recoveryCount.get(),
                "recovery is eligible once the root-swap invocation is terminal");
        drain.complete(null);
        awaitCondition(() -> candidate.uiDispatches.get() >= 1);
        assertEquals(CampaignActivationCoordinator.Status.RECOVERY_UNAVAILABLE,
                await(coordinator.recoverDurableActive()).status());
        assertEquals(1, host.recoveryCount.get(),
                "late stale callbacks and recover must share recovery publication A");

        host.releaseRecovery();
        host.neverCompleteRecovery.set(false);
        assertEquals(CampaignActivationCoordinator.Status.RESUMED,
                await(coordinator.recoverDurableActive()).status());
        assertEquals(1, host.recoveryCount.get());
        coordinator.close();
    }

    @Test
    void terminalCloseSettlementWaitsForEveryCurrentCandidateObligation() throws Exception {
        FakeRegistry registry = new FakeRegistry();
        List<FakeCandidate> candidates = new ArrayList<>();
        CompletableFuture<Void> detachedClose = new CompletableFuture<>();
        CampaignActivationCoordinator coordinator = timedCoordinator(
                registry,
                temporaryDirectory.resolve("aggregate-close-obligations"),
                (id, path, intent) -> {
                    FakeCandidate candidate = new FakeCandidate();
                    if (!candidates.isEmpty()) {
                        candidate.closeResult = detachedClose;
                    }
                    candidates.add(candidate);
                    return CompletableFuture.completedFuture(candidate);
                },
                new FakeHost());
        await(coordinator.create("Alpha", 0L));
        assertEquals(CampaignActivationCoordinator.Status.STALE_GENERATION,
                await(coordinator.create("Rejected", 0L)).status());
        CompletableFuture<Void> activeClose = new CompletableFuture<>();
        candidates.get(0).closeResult = activeClose;
        // The coordinator observes both distinct close stages during terminal close.
        org.junit.jupiter.api.Assertions.assertThrows(
                java.util.concurrent.CompletionException.class, coordinator::close);
        CompletionStage<Void> allTerminal = coordinator.terminalCloseSettlement();
        assertTrue(allTerminal != null);
        activeClose.complete(null);
        assertFalse(allTerminal.toCompletableFuture().isDone());
        detachedClose.complete(null);
        assertTrue(allTerminal.toCompletableFuture().isDone());
    }

    @Test
    void synchronousNeverReturningFactoryRecoveryAndCloseInvocationsRemainBounded() throws Exception {
        AtomicBoolean releaseFactory = new AtomicBoolean();
        CountDownLatch factoryEntered = new CountDownLatch(1);
        CampaignActivationCoordinator factory = timedCoordinator(
                new FakeRegistry(), temporaryDirectory.resolve("sync-factory-hang"),
                (id, path, intent) -> {
                    factoryEntered.countDown();
                    while (!releaseFactory.get()) {
                        java.util.concurrent.locks.LockSupport.parkNanos(
                                TimeUnit.MILLISECONDS.toNanos(5));
                        Thread.interrupted();
                    }
                    return CompletableFuture.completedFuture(new FakeCandidate());
                }, new FakeHost());
        long factoryStarted = System.nanoTime();
        assertEquals(CampaignActivationCoordinator.Status.RECOVERY_UNAVAILABLE,
                await(factory.create("Hung factory", 0L)).status());
        assertTrue(factoryEntered.await(5, TimeUnit.SECONDS));
        assertTrue(System.nanoTime() - factoryStarted < TimeUnit.SECONDS.toNanos(2));
        assertTrue(factory.invocationWorkersForTesting() <= 4);
        releaseFactory.set(true);

        FakeHost recoveryHost = new FakeHost();
        recoveryHost.failAfterRootSwap.set(true);
        recoveryHost.neverReturnRecoveryInvocation.set(true);
        CampaignActivationCoordinator recovery = timedCoordinator(
                new FakeRegistry(), temporaryDirectory.resolve("sync-recovery-hang"),
                (id, path, intent) -> CompletableFuture.completedFuture(new FakeCandidate()),
                recoveryHost);
        long recoveryStarted = System.nanoTime();
        assertEquals(CampaignActivationCoordinator.Status.RECOVERY_UNAVAILABLE,
                await(recovery.create("Hung recovery", 0L)).status());
        assertTrue(recoveryHost.recoveryInvocationEntered.await(5, TimeUnit.SECONDS));
        assertTrue(System.nanoTime() - recoveryStarted < TimeUnit.SECONDS.toNanos(2));
        assertTrue(recovery.invocationWorkersForTesting() <= 4);
        recoveryHost.releaseRecoveryInvocation.set(true);

        FakeCandidate closingCandidate = new FakeCandidate();
        CampaignActivationCoordinator closing = timedCoordinator(
                new FakeRegistry(), temporaryDirectory.resolve("sync-close-hang"),
                (id, path, intent) -> CompletableFuture.completedFuture(closingCandidate),
                new FakeHost());
        await(closing.create("Hung close", 0L));
        closingCandidate.neverReturnCloseInvocation = true;
        long closeStarted = System.nanoTime();
        org.junit.jupiter.api.Assertions.assertThrows(
                java.util.concurrent.CompletionException.class, closing::close);
        assertTrue(closingCandidate.closeInvocationEntered.await(5, TimeUnit.SECONDS));
        assertTrue(System.nanoTime() - closeStarted < TimeUnit.SECONDS.toNanos(2));
        assertTrue(closing.invocationWorkersForTesting() <= 4);
        closingCandidate.releaseCloseInvocation.set(true);
    }

    @Test
    void repeatedSubmissionsReuseOneNeverSettlingDetachedCloseInvocation() throws Exception {
        List<FakeCandidate> candidates = new ArrayList<>();
        CompletableFuture<Void> neverSettlingClose = new CompletableFuture<>();
        CampaignActivationCoordinator coordinator = timedCoordinator(
                new FakeRegistry(), temporaryDirectory.resolve("memoized-detached-close"),
                (id, path, intent) -> {
                    FakeCandidate candidate = new FakeCandidate();
                    if (candidates.isEmpty()) {
                        candidate.closeResult = neverSettlingClose;
                    }
                    candidates.add(candidate);
                    return CompletableFuture.completedFuture(candidate);
                }, new FakeHost());
        try {
            assertEquals(CampaignActivationCoordinator.Status.ACTIVATED,
                    await(coordinator.create("Alpha", 0L)).status());
            assertEquals(CampaignActivationCoordinator.Status.ACTIVATED_DEGRADED,
                    await(coordinator.create("Beta", 1L)).status());

            for (int attempt = 0; attempt < 12; attempt++) {
                assertEquals(CampaignActivationCoordinator.Status.PRE_COMMIT_FAILED,
                        await(coordinator.create("Blocked " + attempt, 2L)).status());
            }

            assertEquals(1, candidates.get(0).closeAttempts.get(),
                    "a nonterminal close attempt must retain its one candidate invocation");
            assertEquals(1, coordinator.pendingCloseAttemptsForTesting());
            assertEquals(1, coordinator.trackedCloseObligationsForTesting());
            assertTrue(coordinator.invocationWorkersForTesting() <= 4);

            neverSettlingClose.complete(null);
            assertEquals(CampaignActivationCoordinator.Status.ACTIVATED,
                    await(coordinator.create("Gamma", 2L)).status());
        } finally {
            neverSettlingClose.complete(null);
            coordinator.close();
        }
    }

    @Test
    void timedOutCommitRetainsPriorAndReservationUntilCommitIsTerminal() throws Exception {
        FakeRegistry registry = new FakeRegistry();
        List<FakeCandidate> candidates = new ArrayList<>();
        Path root = temporaryDirectory.resolve("timed-commit");
        try (CampaignActivationCoordinator coordinator = timedCoordinator(
                registry,
                root,
                (id, path, intent) -> {
                    FakeCandidate candidate = new FakeCandidate();
                    candidates.add(candidate);
                    return CompletableFuture.completedFuture(candidate);
                },
                new FakeHost())) {
            assertEquals(CampaignActivationCoordinator.Status.ACTIVATED,
                    await(coordinator.create("Alpha", 0L)).status());
            registry.nextCommit = CommitBehavior.NEVER_COMPLETES;

            var timedOut = await(coordinator.create("Beta", 1L));
            Path reservation = timedOut.campaignPath().orElseThrow().getParent();
            assertEquals(CampaignActivationCoordinator.Status.RECOVERY_UNAVAILABLE, timedOut.status());
            assertTrue(Files.exists(reservation));
            assertEquals(0, candidates.get(0).resumeCount.get());
            assertEquals(CampaignActivationCoordinator.Status.RECOVERY_UNAVAILABLE,
                    await(coordinator.recoverDurableActive()).status());
            registry.pendingCommit.complete(new CampaignPointerCommitResult(
                    CampaignPointerCommitResult.Status.STORAGE_ERROR, Optional.empty()));
            assertEquals(CampaignActivationCoordinator.Status.RESUMED,
                    await(coordinator.recoverDurableActive()).status());
            assertFalse(Files.exists(reservation));
            assertEquals(1, candidates.get(0).resumeCount.get());
        }

        FakeRegistry closingRegistry = new FakeRegistry();
        List<FakeCandidate> closingCandidates = new ArrayList<>();
        CampaignActivationCoordinator closing = timedCoordinator(
                closingRegistry,
                temporaryDirectory.resolve("timed-commit-close"),
                (id, path, intent) -> {
                    FakeCandidate candidate = new FakeCandidate();
                    closingCandidates.add(candidate);
                    return CompletableFuture.completedFuture(candidate);
                },
                new FakeHost());
        await(closing.create("Alpha", 0L));
        closingRegistry.nextCommit = CommitBehavior.NEVER_COMPLETES;
        Path ambiguousReservation = await(closing.create("Beta", 1L))
                .campaignPath().orElseThrow().getParent();

        org.junit.jupiter.api.Assertions.assertThrows(
                java.util.concurrent.CompletionException.class, closing::close);
        assertTrue(Files.exists(ambiguousReservation));
        closingRegistry.pendingCommit.complete(new CampaignPointerCommitResult(
                CampaignPointerCommitResult.Status.STORAGE_ERROR, Optional.empty()));
        closing.close();
        assertTrue(Files.exists(ambiguousReservation),
                "terminal shutdown preserves an ambiguous Campaign orphan");
    }

    @Test
    void timedOutPriorDrainNeverAliasesPriorAsTargetAndResumesOnlyAfterTerminalDrain()
            throws Exception {
        FakeRegistry registry = new FakeRegistry();
        List<FakeCandidate> candidates = new ArrayList<>();
        FakeHost host = new FakeHost();
        try (CampaignActivationCoordinator coordinator = timedCoordinator(
                registry,
                temporaryDirectory.resolve("timed-prior-drain"),
                (id, path, intent) -> {
                    FakeCandidate candidate = new FakeCandidate();
                    candidates.add(candidate);
                    return CompletableFuture.completedFuture(candidate);
                },
                host)) {
            var alpha = await(coordinator.create("Alpha", 0L));
            FakeCandidate prior = candidates.get(0);
            CompletableFuture<Void> drain = new CompletableFuture<>();
            prior.pauseResult = drain;

            var beta = await(coordinator.create("Beta", 1L));
            Path betaReservation = beta.campaignPath().orElseThrow().getParent();
            FakeCandidate target = candidates.get(1);
            assertEquals(CampaignActivationCoordinator.Status.RECOVERY_UNAVAILABLE, beta.status());
            assertEquals(0, prior.closeAttempts.get());
            assertEquals(0, prior.resumeCount.get());
            assertEquals(0, target.closeAttempts.get());
            assertTrue(Files.exists(betaReservation));

            drain.complete(null);
            assertEquals(CampaignActivationCoordinator.Status.RESUMED,
                    await(coordinator.recoverDurableActive()).status());
            assertEquals(0, prior.closeAttempts.get());
            assertEquals(1, prior.resumeCount.get());
            assertEquals(1, prior.activationCount.get(),
                    "late successful drain resumes authority without republishing attached root");
            assertEquals(1, host.switchCount.get());
            assertEquals(1, target.closeAttempts.get());
            assertFalse(Files.exists(betaReservation));
            assertEquals(alpha.durableActivation(), coordinator.snapshot().durableActivation());
        }
    }

    @Test
    void exceptionalPriorDrainClosesBothAggregatesAndColdRebuildsDurableTruth()
            throws Exception {
        FakeRegistry registry = new FakeRegistry();
        List<FakeCandidate> candidates = new ArrayList<>();
        AtomicInteger allocations = new AtomicInteger();
        try (CampaignActivationCoordinator coordinator = timedCoordinator(
                registry,
                temporaryDirectory.resolve("exceptional-prior-drain"),
                (id, path, intent) -> {
                    writeCandidateFile(path);
                    FakeCandidate candidate = allocations.getAndIncrement() == 0
                            ? new FakeCandidate() {
                                @Override
                                public CompletionStage<Void> pauseAndDrain() {
                                    pauseCount.incrementAndGet();
                                    throw new IllegalStateException("injected immediate drain failure");
                                }
                            }
                            : new FakeCandidate();
                    candidates.add(candidate);
                    return CompletableFuture.completedFuture(candidate);
                },
                new FakeHost())) {
            var alpha = await(coordinator.create("Alpha", 0L));

            var failed = await(coordinator.create("Beta", 1L));

            assertEquals(CampaignActivationCoordinator.Status.RECOVERY_REQUIRED, failed.status());
            assertEquals(alpha.durableActivation(), failed.durableActivation());
            assertEquals(1, candidates.get(0).closeAttempts.get());
            assertEquals(0, candidates.get(0).resumeCount.get(),
                    "an exceptional drain makes the prior aggregate unsafe to readmit");
            assertEquals(1, candidates.get(1).closeAttempts.get(),
                    "the uncommitted target candidate is released before recovery");

            assertEquals(CampaignActivationCoordinator.Status.RESUMED,
                    await(coordinator.recoverDurableActive()).status());
            assertEquals(3, candidates.size(),
                    "durable Alpha is rebuilt only after the unsafe aggregate closes");
            assertEquals(1, candidates.get(2).activationCount.get());
            assertEquals(1, candidates.get(0).activationCount.get(),
                    "the unsafe Alpha aggregate is never republished");
        }
    }

    @Test
    void successfulActiveFallbackDrainResumesExactlyOnceAfterDefinitePrecommitRejection()
            throws Exception {
        FakeRegistry registry = new FakeRegistry();
        List<FakeCandidate> candidates = new ArrayList<>();
        try (CampaignActivationCoordinator coordinator = timedCoordinator(
                registry,
                temporaryDirectory.resolve("active-fallback-definite-rejection"),
                (id, path, intent) -> {
                    writeCandidateFile(path);
                    FakeCandidate candidate = new FakeCandidate();
                    candidates.add(candidate);
                    return CompletableFuture.completedFuture(candidate);
                },
                new FakeHost())) {
            var alpha = await(coordinator.create("Alpha", 0L));

            var rejected = await(coordinator.create("Rejected", 0L));

            assertEquals(CampaignActivationCoordinator.Status.STALE_GENERATION, rejected.status());
            assertEquals(alpha.durableActivation(), rejected.durableActivation());
            assertEquals(1, candidates.get(0).pauseCount.get());
            assertEquals(1, candidates.get(0).resumeCount.get(),
                    "successful drain transitions to PAUSED before rejection restoration");
            assertEquals(1, candidates.get(0).activationCount.get(),
                    "the still-published fallback is not republished");
            assertEquals(1, candidates.get(1).closeAttempts.get());
        }
    }

    @Test
    void recoveryCannotAllocateWhileFailedPriorCloseRemainsOwned() throws Exception {
        FakeRegistry registry = new FakeRegistry();
        List<FakeCandidate> candidates = new ArrayList<>();
        try (CampaignActivationCoordinator coordinator = timedCoordinator(
                registry,
                temporaryDirectory.resolve("recovery-close-allocation-gate"),
                (id, path, intent) -> {
                    writeCandidateFile(path);
                    FakeCandidate candidate = new FakeCandidate();
                    candidates.add(candidate);
                    return CompletableFuture.completedFuture(candidate);
                },
                new FakeHost())) {
            assertEquals(CampaignActivationCoordinator.Status.ACTIVATED,
                    await(coordinator.create("Alpha", 0L)).status());
            FakeCandidate prior = candidates.get(0);
            prior.failCloseAttempts.set(2);
            CompletableFuture<Void> drain = new CompletableFuture<>();
            prior.pauseResult = drain;

            assertEquals(CampaignActivationCoordinator.Status.RECOVERY_UNAVAILABLE,
                    await(coordinator.create("Beta", 1L)).status());
            drain.completeExceptionally(new IllegalStateException("injected drain failure"));

            assertEquals(CampaignActivationCoordinator.Status.RECOVERY_REQUIRED,
                    await(coordinator.recoverDurableActive()).status());
            assertEquals(2, candidates.size());
            assertEquals(1, prior.closeAttempts.get());

            assertEquals(CampaignActivationCoordinator.Status.RECOVERY_REQUIRED,
                    await(coordinator.recoverDurableActive()).status());
            assertEquals(2, candidates.size(),
                    "recovery must not allocate around an unresolved prior close");
            assertEquals(2, prior.closeAttempts.get());

            assertEquals(CampaignActivationCoordinator.Status.RESUMED,
                    await(coordinator.recoverDurableActive()).status());
            assertEquals(3, candidates.size(),
                    "recovery may rebuild only after the retained prior close settles");
            assertEquals(3, prior.closeAttempts.get());
        }
    }

    @Test
    void terminalCloseResolvesLatePreparationAndTerminalDrainBeforeClaimingClosed()
            throws Exception {
        FakeRegistry preparationRegistry = new FakeRegistry();
        CompletableFuture<CampaignActivationCoordinator.Candidate> preparation =
                new CompletableFuture<>();
        CampaignActivationCoordinator preparationCoordinator = timedCoordinator(
                preparationRegistry,
                temporaryDirectory.resolve("terminal-preparation"),
                (id, path, intent) -> preparation,
                new FakeHost());
        var preparationTimeout = await(preparationCoordinator.create("Late", 0L));
        Path preparationReservation = preparationTimeout.campaignPath().orElseThrow().getParent();
        FakeCandidate lateCandidate = new FakeCandidate();
        preparation.complete(lateCandidate);

        preparationCoordinator.close();

        assertEquals(1, lateCandidate.closeAttempts.get());
        assertFalse(Files.exists(preparationReservation));
        assertEquals(CampaignActivationCoordinator.Phase.CLOSED,
                preparationCoordinator.snapshot().phase());

        FakeRegistry drainRegistry = new FakeRegistry();
        List<FakeCandidate> drainCandidates = new ArrayList<>();
        CampaignActivationCoordinator drainCoordinator = timedCoordinator(
                drainRegistry,
                temporaryDirectory.resolve("terminal-drain"),
                (id, path, intent) -> {
                    FakeCandidate candidate = new FakeCandidate();
                    drainCandidates.add(candidate);
                    return CompletableFuture.completedFuture(candidate);
                },
                new FakeHost());
        await(drainCoordinator.create("Prior", 0L));
        CompletableFuture<Void> drain = new CompletableFuture<>();
        drainCandidates.get(0).pauseResult = drain;
        var target = await(drainCoordinator.create("Target", 1L));
        Path drainReservation = target.campaignPath().orElseThrow().getParent();
        drain.complete(null);

        drainCoordinator.close();

        assertEquals(1, drainCandidates.get(0).closeAttempts.get());
        assertEquals(0, drainCandidates.get(0).resumeCount.get());
        assertEquals(1, drainCandidates.get(1).closeAttempts.get());
        assertFalse(Files.exists(drainReservation));
        assertEquals(CampaignActivationCoordinator.Phase.CLOSED,
                drainCoordinator.snapshot().phase());
    }

    @Test
    void ambiguousCommittedTargetCloseRetryNeverDeletesItsCampaignFileAndRestarts()
            throws Exception {
        FakeRegistry registry = new FakeRegistry();
        List<FakeCandidate> candidates = new ArrayList<>();
        Path root = temporaryDirectory.resolve("ambiguous-close-retain");
        CampaignActivationCoordinator coordinator = timedCoordinator(
                registry,
                root,
                (id, path, intent) -> {
                    FakeCandidate candidate = new FakeCandidate();
                    candidates.add(candidate);
                    return CompletableFuture.completedFuture(candidate);
                },
                new FakeHost());
        registry.nextCommit = CommitBehavior.NEVER_COMPLETES;
        var timedOut = await(coordinator.create("Committed target", 0L));
        Path campaignFile = timedOut.campaignPath().orElseThrow();
        Files.writeString(campaignFile, "owned-campaign-data");
        CampaignId targetId = new CampaignId(UUID.fromString(
                campaignFile.getParent().getFileName().toString()));
        CampaignSnapshot target = new CampaignSnapshot(targetId, "Committed target");
        CampaignActivation committed = new CampaignActivation(Optional.of(target), 1L);
        registry.campaigns.put(targetId, target);
        registry.active = committed;
        registry.pendingCommit.complete(new CampaignPointerCommitResult(
                CampaignPointerCommitResult.Status.COMMITTED, Optional.of(committed)));
        candidates.get(0).failCloseAttempts.set(1);

        org.junit.jupiter.api.Assertions.assertThrows(
                java.util.concurrent.CompletionException.class, coordinator::close);
        assertTrue(Files.isRegularFile(campaignFile));
        coordinator.close();
        assertTrue(Files.isRegularFile(campaignFile));
        assertEquals(2, candidates.get(0).closeAttempts.get());

        List<FakeCandidate> restartedCandidates = new ArrayList<>();
        try (CampaignActivationCoordinator restarted = timedCoordinator(
                registry,
                root,
                (id, path, intent) -> {
                    FakeCandidate candidate = new FakeCandidate();
                    restartedCandidates.add(candidate);
                    return CompletableFuture.completedFuture(candidate);
                },
                new FakeHost())) {
            assertEquals(CampaignActivationCoordinator.Status.RESUMED,
                    await(restarted.resumeDurableActive()).status());
            assertEquals(campaignFile, restarted.snapshot().campaignPath().orElseThrow());
        }
    }

    @Test
    void ambiguousPriorRecoveryCleansClosedNewReservation() throws Exception {
        FakeRegistry registry = new FakeRegistry();
        List<FakeCandidate> candidates = new ArrayList<>();
        Path root = temporaryDirectory.resolve("ambiguous-prior-cleanup");
        try (CampaignActivationCoordinator coordinator = timedCoordinator(
                registry,
                root,
                (id, path, intent) -> {
                    FakeCandidate candidate = new FakeCandidate();
                    candidates.add(candidate);
                    return CompletableFuture.completedFuture(candidate);
                },
                new FakeHost())) {
            await(coordinator.create("Alpha", 0L));
            registry.nextCommit = CommitBehavior.STORAGE_UNREADABLE_ONCE;

            var ambiguous = await(coordinator.create("Beta", 1L));
            Path reservation = ambiguous.campaignPath().orElseThrow().getParent();
            assertEquals(CampaignActivationCoordinator.Status.RECOVERY_REQUIRED, ambiguous.status());
            assertTrue(Files.exists(reservation));

            assertEquals(CampaignActivationCoordinator.Status.RESUMED,
                    await(coordinator.recoverDurableActive()).status());
            assertFalse(Files.exists(reservation));
        }
    }

    @Test
    void ambiguousCommitRereadSelectsOnlyConfirmedPriorOrConfirmedTarget() throws Exception {
        FakeRegistry registry = new FakeRegistry();
        List<FakeCandidate> candidates = new ArrayList<>();
        try (CampaignActivationCoordinator coordinator = coordinator(registry, candidates, new FakeHost())) {
            var alpha = await(coordinator.create("Alpha", 0L));
            assertEquals(CampaignActivationCoordinator.Status.ACTIVATED, alpha.status());
            FakeCandidate alphaCandidate = candidates.get(0);

            registry.nextCommit = CommitBehavior.STORAGE_AFTER_TARGET;
            var beta = await(coordinator.create("Beta", 1L));
            assertEquals(CampaignActivationCoordinator.Status.ACTIVATED, beta.status());
            assertEquals(0, alphaCandidate.resumeCount.get(), "confirmed target never reopens prior");
            FakeCandidate betaCandidate = candidates.get(1);

            registry.nextCommit = CommitBehavior.EXCEPTION_WITH_PRIOR;
            var gamma = await(coordinator.create("Gamma", 2L));
            assertEquals(CampaignActivationCoordinator.Status.PRE_COMMIT_FAILED, gamma.status());
            assertEquals(1, betaCandidate.resumeCount.get(), "only confirmed prior is resumed");
            assertEquals(1, candidates.get(2).closeAttempts.get());
        }
    }

    @Test
    void delayedAmbiguousTargetRecoveryRetiresPausedPriorExactlyOnce() throws Exception {
        FakeRegistry registry = new FakeRegistry();
        List<FakeCandidate> candidates = new ArrayList<>();
        try (CampaignActivationCoordinator coordinator = coordinator(
                registry, candidates, new FakeHost())) {
            assertEquals(CampaignActivationCoordinator.Status.ACTIVATED,
                    await(coordinator.create("Alpha", 0L)).status());
            FakeCandidate alphaCandidate = candidates.get(0);

            registry.nextCommit = CommitBehavior.TARGET_UNREADABLE_ONCE;
            assertEquals(CampaignActivationCoordinator.Status.RECOVERY_REQUIRED,
                    await(coordinator.create("Beta", 1L)).status());
            assertEquals(0, alphaCandidate.closeAttempts.get());

            assertEquals(CampaignActivationCoordinator.Status.RESUMED,
                    await(coordinator.recoverDurableActive()).status());
            assertEquals(1, alphaCandidate.closeAttempts.get(),
                    "confirmed target recovery must retire the paused prior runtime");
        }
        assertEquals(1, candidates.get(0).closeAttempts.get(),
                "terminal close must not reacquire or close the retired prior twice");
    }

    @Test
    void recoverySwitchContainsDisplacedPriorBeforeAllocatingAnotherCandidate()
            throws Exception {
        FakeRegistry registry = new FakeRegistry();
        Path root = temporaryDirectory.resolve("bounded-recovery-switch");
        CampaignSnapshot alpha = registeredCampaign(
                "00000000-0000-0000-0000-000000000101", "Alpha");
        CampaignSnapshot gamma = registeredCampaign(
                "00000000-0000-0000-0000-000000000103", "Gamma");
        registry.campaigns.put(alpha.id(), alpha);
        registry.campaigns.put(gamma.id(), gamma);
        registry.active = new CampaignActivation(Optional.of(alpha), 1L);
        writeExistingCampaign(root, alpha);
        writeExistingCampaign(root, gamma);
        AtomicInteger liveCandidates = new AtomicInteger();
        AtomicInteger maximumLiveCandidates = new AtomicInteger();
        AtomicInteger identity = new AtomicInteger(102);
        List<Integer> liveBeforeAllocation = new ArrayList<>();
        List<LiveTrackingCandidate> candidates = new ArrayList<>();

        CampaignActivationCoordinator coordinator = new CampaignActivationCoordinator(
                NoopDiagnostics.INSTANCE,
                registry,
                root,
                (id, path, intent) -> {
                    liveBeforeAllocation.add(liveCandidates.get());
                    LiveTrackingCandidate candidate = new LiveTrackingCandidate(
                            liveCandidates, maximumLiveCandidates);
                    candidates.add(candidate);
                    return CompletableFuture.completedFuture(candidate);
                },
                new FakeHost(),
                () -> new UUID(0L, identity.getAndIncrement()));
        try {
            assertEquals(CampaignActivationCoordinator.Status.RESUMED,
                    await(coordinator.resumeDurableActive()).status());
            registry.nextCommit = CommitBehavior.TARGET_UNREADABLE_ONCE;
            var ambiguous = await(coordinator.create("Beta", 1L));
            assertEquals(CampaignActivationCoordinator.Status.RECOVERY_REQUIRED,
                    ambiguous.status());
            Path committedBeta = ambiguous.campaignPath().orElseThrow().getParent();
            candidates.get(0).failCloseAttempts.set(1);

            var blocked = await(coordinator.switchFromRecovery(gamma.id(), 2L));
            assertEquals(CampaignActivationCoordinator.Status.RECOVERY_REQUIRED,
                    blocked.status());
            assertEquals(2, candidates.size(),
                    "a failed displaced-prior close blocks Gamma allocation");
            assertEquals(2, liveCandidates.get());

            var switched = await(coordinator.switchFromRecovery(gamma.id(), 2L));

            assertEquals(CampaignActivationCoordinator.Status.ACTIVATED, switched.status());
            assertEquals(3, candidates.size());
            assertEquals(List.of(0, 1, 1), liveBeforeAllocation,
                    "Gamma allocation begins only after displaced Alpha is closed");
            assertEquals(2, maximumLiveCandidates.get(),
                    "recovery switching never owns more than active-plus-one candidates");
            assertEquals(2, candidates.get(0).closeAttempts.get());
            assertEquals(1, candidates.get(1).closeAttempts.get(),
                    "committed Beta remains the fallback until Gamma commits");
            assertEquals(1, liveCandidates.get());
            assertTrue(Files.exists(committedBeta),
                    "the durably committed fallback Campaign remains reopenable");
        } finally {
            coordinator.close();
        }
    }

    @Test
    void recoverySwitchRetryDeletesFreshAbandonedReservationAfterConfirmedPrior()
            throws Exception {
        FakeRegistry registry = new FakeRegistry();
        Path root = temporaryDirectory.resolve("abandoned-recovery-reservation");
        CampaignSnapshot gamma = registeredCampaign(
                "00000000-0000-0000-0000-000000000113", "Gamma");
        registry.campaigns.put(gamma.id(), gamma);
        writeExistingCampaign(root, gamma);
        AtomicInteger identity = new AtomicInteger(111);
        List<FakeCandidate> candidates = new ArrayList<>();
        CampaignActivationCoordinator coordinator = new CampaignActivationCoordinator(
                NoopDiagnostics.INSTANCE,
                registry,
                root,
                (id, path, intent) -> {
                    FakeCandidate candidate = new FakeCandidate();
                    candidates.add(candidate);
                    return CompletableFuture.completedFuture(candidate);
                },
                new FakeHost(),
                () -> new UUID(0L, identity.getAndIncrement()));
        try {
            assertEquals(CampaignActivationCoordinator.Status.ACTIVATED,
                    await(coordinator.create("Alpha", 0L)).status());
            registry.nextCommit = CommitBehavior.STORAGE_UNREADABLE_ONCE;
            var ambiguous = await(coordinator.create("Beta", 1L));
            Path betaReservation = ambiguous.campaignPath().orElseThrow().getParent();
            assertEquals(CampaignActivationCoordinator.Status.RECOVERY_REQUIRED,
                    ambiguous.status());
            assertTrue(Files.exists(betaReservation));
            candidates.get(1).failCloseAttempts.set(2);

            assertEquals(CampaignActivationCoordinator.Status.RECOVERY_REQUIRED,
                    await(coordinator.switchFromRecovery(gamma.id(), 1L)).status());
            assertTrue(Files.exists(betaReservation),
                    "failed close must retain the fresh reservation and its retry ownership");

            assertEquals(CampaignActivationCoordinator.Status.RECOVERY_REQUIRED,
                    await(coordinator.switchFromRecovery(gamma.id(), 1L)).status());
            assertTrue(Files.exists(betaReservation),
                    "a second failed close must still retain the matching reservation");
            assertEquals(2, candidates.size(),
                    "no replacement allocation is allowed while close ownership is pending");

            assertEquals(CampaignActivationCoordinator.Status.ACTIVATED,
                    await(coordinator.switchFromRecovery(gamma.id(), 1L)).status());
            assertFalse(Files.exists(betaReservation),
                    "successful close retry must delete the never-committed reservation");
            assertEquals(3, candidates.get(1).closeAttempts.get());
        } finally {
            coordinator.close();
        }
    }

    @Test
    void recoveryReplacementPreparationFailureRepublishesExactDurablePriorAggregate()
            throws Exception {
        FakeRegistry registry = new FakeRegistry();
        Path root = temporaryDirectory.resolve("replacement-prior-prepare-failure");
        CampaignSnapshot gamma = registeredCampaign(
                "00000000-0000-0000-0000-000000000123", "Gamma");
        registry.campaigns.put(gamma.id(), gamma);
        writeExistingCampaign(root, gamma);
        List<FakeCandidate> candidates = new ArrayList<>();
        FakeHost host = new FakeHost();
        AtomicInteger identity = new AtomicInteger(121);
        try (CampaignActivationCoordinator coordinator = new CampaignActivationCoordinator(
                NoopDiagnostics.INSTANCE,
                registry,
                root,
                (id, path, intent) -> {
                    if (id.equals(gamma.id())) {
                        return CompletableFuture.failedFuture(
                                new IllegalStateException("injected replacement prepare failure"));
                    }
                    FakeCandidate candidate = new FakeCandidate();
                    candidates.add(candidate);
                    return CompletableFuture.completedFuture(candidate);
                },
                host,
                () -> new UUID(0L, identity.getAndIncrement()))) {
            var alpha = await(coordinator.create("Alpha", 0L));
            FakeCandidate alphaCandidate = candidates.get(0);
            registry.nextCommit = CommitBehavior.STORAGE_UNREADABLE_ONCE;
            assertEquals(CampaignActivationCoordinator.Status.RECOVERY_REQUIRED,
                    await(coordinator.create("Beta", 1L)).status());
            assertEquals("recovery", host.visibleRoot.get());

            var rejected = await(coordinator.switchFromRecovery(gamma.id(), 1L));

            assertEquals(CampaignActivationCoordinator.Status.PRE_COMMIT_FAILED,
                    rejected.status());
            assertEquals(CampaignActivationCoordinator.Phase.ACTIVE,
                    coordinator.snapshot().phase());
            assertEquals(alpha.durableActivation(), rejected.durableActivation());
            assertEquals("Alpha", host.visibleRoot.get(),
                    "the recovery-cleared host must receive the retained Alpha shell again");
            assertEquals(2, alphaCandidate.activationCount.get(),
                    "replacement rejection republishes the same aggregate, not a rebuilt one");
            assertEquals(0, alphaCandidate.closeAttempts.get());
            assertEquals(2, candidates.size(), "Gamma preparation must not create a candidate");
        }
    }

    @Test
    void activeRecoveryFallbackSuccessfulDrainResumesExactlyOnceOnDefiniteRejection()
            throws Exception {
        FakeRegistry registry = new FakeRegistry();
        Path root = temporaryDirectory.resolve("active-recovery-fallback-rejection");
        CampaignSnapshot gamma = registeredCampaign(
                "00000000-0000-0000-0000-000000000143", "Gamma");
        CampaignSnapshot delta = registeredCampaign(
                "00000000-0000-0000-0000-000000000144", "Delta");
        registry.campaigns.put(gamma.id(), gamma);
        registry.campaigns.put(delta.id(), delta);
        writeExistingCampaign(root, gamma);
        writeExistingCampaign(root, delta);
        List<FakeCandidate> candidates = new ArrayList<>();
        FakeHost host = new FakeHost();
        try (CampaignActivationCoordinator coordinator = timedCoordinator(
                registry,
                root,
                (id, path, intent) -> {
                    writeCandidateFile(path);
                    FakeCandidate candidate = new FakeCandidate();
                    candidates.add(candidate);
                    return CompletableFuture.completedFuture(candidate);
                },
                host)) {
            await(coordinator.create("Alpha", 0L));
            FakeCandidate alpha = candidates.get(0);
            registry.nextCommit = CommitBehavior.STORAGE_UNREADABLE_ONCE;
            assertEquals(CampaignActivationCoordinator.Status.RECOVERY_REQUIRED,
                    await(coordinator.create("Beta", 1L)).status());
            assertEquals(1, alpha.pauseCount.get());
            assertEquals(0, alpha.resumeCount.get());

            host.failAfterRootSwap.set(true);
            registry.nextCommit = CommitBehavior.DEFINITE_STALE_ONCE;
            assertEquals(CampaignActivationCoordinator.Status.RECOVERY_REQUIRED,
                    await(coordinator.switchFromRecovery(gamma.id(), 1L)).status());
            assertEquals(1, alpha.resumeCount.get(),
                    "the initially PAUSED fallback resumes before its failed republication");

            registry.nextCommit = CommitBehavior.DEFINITE_STALE_ONCE;
            var rejected = await(coordinator.switchFromRecovery(delta.id(), 1L));

            assertEquals(CampaignActivationCoordinator.Status.STALE_GENERATION, rejected.status());
            assertEquals(2, alpha.pauseCount.get(),
                    "the now-ACTIVE fallback is drained once before replacement");
            assertEquals(2, alpha.resumeCount.get(),
                    "the successful ACTIVE drain is recorded as PAUSED and resumed exactly once");
            assertEquals(2, alpha.activationCount.get(),
                    "only the final successful fallback republication activates it again");
        }
    }

    @Test
    void committedTargetAggregateSurvivesReplacementCommitTimeoutAndIsRepublished()
            throws Exception {
        FakeRegistry registry = new FakeRegistry();
        Path root = temporaryDirectory.resolve("replacement-committed-target-timeout");
        CampaignSnapshot gamma = registeredCampaign(
                "00000000-0000-0000-0000-000000000133", "Gamma");
        registry.campaigns.put(gamma.id(), gamma);
        writeExistingCampaign(root, gamma);
        List<FakeCandidate> candidates = new ArrayList<>();
        FakeHost host = new FakeHost();
        try (CampaignActivationCoordinator coordinator = timedCoordinator(
                registry,
                root,
                (id, path, intent) -> {
                    FakeCandidate candidate = new FakeCandidate();
                    candidates.add(candidate);
                    return CompletableFuture.completedFuture(candidate);
                },
                host)) {
            await(coordinator.create("Alpha", 0L));
            registry.nextCommit = CommitBehavior.TARGET_UNREADABLE_ONCE;
            var beta = await(coordinator.create("Beta", 1L));
            assertEquals(CampaignActivationCoordinator.Status.RECOVERY_REQUIRED, beta.status());
            FakeCandidate alphaCandidate = candidates.get(0);
            FakeCandidate betaCandidate = candidates.get(1);
            registry.nextCommit = CommitBehavior.NEVER_COMPLETES;

            var timedOut = await(coordinator.switchFromRecovery(gamma.id(), 2L));

            assertEquals(CampaignActivationCoordinator.Status.RECOVERY_UNAVAILABLE,
                    timedOut.status());
            assertEquals(1, alphaCandidate.closeAttempts.get(),
                    "non-durable Alpha is contained before Gamma allocation");
            assertEquals(0, betaCandidate.closeAttempts.get(),
                    "durable Beta remains owned while Gamma commit is unresolved");
            assertEquals(0, betaCandidate.pauseCount.get(),
                    "a committed but not yet published fallback remains PREPARED, not ACTIVE");
            CampaignActivation durableBeta = registry.active;
            registry.pendingCommit.complete(new CampaignPointerCommitResult(
                    CampaignPointerCommitResult.Status.STALE_GENERATION,
                    Optional.of(durableBeta)));

            var recovered = await(coordinator.recoverDurableActive());

            assertEquals(CampaignActivationCoordinator.Status.RESUMED, recovered.status());
            assertEquals(Optional.of(durableBeta), recovered.durableActivation());
            assertEquals("Beta", host.visibleRoot.get());
            assertEquals(1, betaCandidate.activationCount.get(),
                    "the retained committed Beta aggregate is published exactly once");
            assertEquals(0, betaCandidate.closeAttempts.get());
            assertEquals(1, candidates.get(2).closeAttempts.get(),
                    "the never-committed Gamma candidate is contained after timeout settles");
        }
    }

    @Test
    void confirmedPriorRecoveryReportsDegradedWhenTargetCloseRemainsOwned()
            throws Exception {
        FakeRegistry registry = new FakeRegistry();
        List<FakeCandidate> candidates = new ArrayList<>();
        Path root = temporaryDirectory.resolve("degraded-confirmed-prior-recovery");
        AtomicReference<Path> betaReservation = new AtomicReference<>();
        try (CampaignActivationCoordinator coordinator = timedCoordinator(
                registry,
                root,
                (id, path, intent) -> {
                    FakeCandidate candidate = new FakeCandidate();
                    candidates.add(candidate);
                    return CompletableFuture.completedFuture(candidate);
                },
                new FakeHost())) {
            var alpha = await(coordinator.create("Alpha", 0L));
            registry.nextCommit = CommitBehavior.STORAGE_UNREADABLE_ONCE;
            var ambiguous = await(coordinator.create("Beta", 1L));
            assertEquals(CampaignActivationCoordinator.Status.RECOVERY_REQUIRED,
                    ambiguous.status());
            betaReservation.set(ambiguous.campaignPath().orElseThrow().getParent());
            candidates.get(1).failCloseAttempts.set(1);

            var recovered = await(coordinator.recoverDurableActive());

            assertEquals(CampaignActivationCoordinator.Status.ACTIVATED_DEGRADED,
                    recovered.status());
            assertEquals(CampaignActivationCoordinator.Phase.ACTIVE_DEGRADED,
                    coordinator.snapshot().phase());
            assertEquals(alpha.durableActivation(), recovered.durableActivation());
            assertTrue(Files.exists(betaReservation.get()));
            assertEquals(1, candidates.get(1).closeAttempts.get());
        }
        assertFalse(Files.exists(betaReservation.get()),
                "terminal retry must close the target and delete its abandoned reservation");
    }

    @Test
    void recoverySwitchReportsDegradedActivationWhenRetiringPausedPriorFails()
            throws Exception {
        FakeRegistry registry = new FakeRegistry();
        Path root = temporaryDirectory.resolve("degraded-recovery-switch");
        CampaignSnapshot alpha = registeredCampaign(
                "00000000-0000-0000-0000-000000000201", "Alpha");
        CampaignSnapshot gamma = registeredCampaign(
                "00000000-0000-0000-0000-000000000203", "Gamma");
        registry.campaigns.put(alpha.id(), alpha);
        registry.campaigns.put(gamma.id(), gamma);
        registry.active = new CampaignActivation(Optional.of(alpha), 1L);
        writeExistingCampaign(root, alpha);
        writeExistingCampaign(root, gamma);
        AtomicInteger identity = new AtomicInteger(202);
        List<FakeCandidate> candidates = new ArrayList<>();
        CampaignActivationCoordinator coordinator = new CampaignActivationCoordinator(
                NoopDiagnostics.INSTANCE,
                registry,
                root,
                (id, path, intent) -> {
                    FakeCandidate candidate = new FakeCandidate();
                    candidates.add(candidate);
                    return CompletableFuture.completedFuture(candidate);
                },
                new FakeHost(),
                () -> new UUID(0L, identity.getAndIncrement()));
        try {
            assertEquals(CampaignActivationCoordinator.Status.RESUMED,
                    await(coordinator.resumeDurableActive()).status());
            registry.nextCommit = CommitBehavior.TARGET_UNREADABLE_ONCE;
            assertEquals(CampaignActivationCoordinator.Status.RECOVERY_REQUIRED,
                    await(coordinator.create("Beta", 1L)).status());
            candidates.get(1).failCloseAttempts.set(5);

            var switched = await(coordinator.switchFromRecovery(gamma.id(), 2L));

            assertEquals(CampaignActivationCoordinator.Status.ACTIVATED_DEGRADED,
                    switched.status());
            assertEquals(CampaignActivationCoordinator.Phase.ACTIVE_DEGRADED,
                    coordinator.snapshot().phase());
            assertEquals(gamma.id(), coordinator.snapshot().durableActivation().orElseThrow()
                    .campaign().orElseThrow().id());
            assertEquals(3, candidates.size());
            assertEquals(1, candidates.get(1).closeAttempts.get());
            assertEquals(CampaignActivationCoordinator.Status.PRE_COMMIT_FAILED,
                    await(coordinator.create("Delta", 3L)).status(),
                    "the retained close obligation blocks another candidate allocation");
            assertEquals(3, candidates.size());
        } finally {
            candidates.get(1).failCloseAttempts.set(candidates.get(1).closeAttempts.get());
            coordinator.close();
        }
    }

    @Test
    void unresolvedDetachedCloseBlocksEveryFurtherCandidateAllocation() throws Exception {
        FakeRegistry registry = new FakeRegistry();
        List<FakeCandidate> candidates = new ArrayList<>();
        try (CampaignActivationCoordinator coordinator = coordinator(
                registry, candidates, new FakeHost())) {
            assertEquals(CampaignActivationCoordinator.Status.ACTIVATED,
                    await(coordinator.create("Alpha", 0L)).status());
            candidates.get(0).failCloseAttempts.set(5);

            var beta = await(coordinator.create("Beta", 1L));
            assertEquals(CampaignActivationCoordinator.Status.ACTIVATED_DEGRADED, beta.status());
            assertEquals(2, candidates.size());
            CampaignId betaId = beta.durableActivation().orElseThrow()
                    .campaign().orElseThrow().id();

            assertEquals(CampaignActivationCoordinator.Status.ACTIVATED_DEGRADED,
                    await(coordinator.switchTo(betaId, 2L)).status(),
                    "a same-active no-op allocates no candidate and retains its truthful status");
            assertEquals(CampaignActivationCoordinator.Status.STALE_GENERATION,
                    await(coordinator.switchTo(betaId, 1L)).status(),
                    "generation validation precedes the candidate-allocation gate");

            assertEquals(CampaignActivationCoordinator.Status.PRE_COMMIT_FAILED,
                    await(coordinator.create("Gamma", 2L)).status());
            assertEquals(CampaignActivationCoordinator.Status.PRE_COMMIT_FAILED,
                    await(coordinator.create("Delta", 2L)).status());
            assertEquals(2, candidates.size(),
                    "an unresolved full-candidate close must cap runtime ownership");

            assertEquals(CampaignActivationCoordinator.Status.ACTIVATED,
                    await(coordinator.create("Epsilon", 2L)).status());
            assertEquals(3, candidates.size(),
                    "allocation may continue only after the retained close obligation settles");
        }
    }

    @Test
    void unreadableAmbiguousCommitBlocksAlreadyQueuedNormalTransition() throws Exception {
        FakeRegistry registry = new FakeRegistry();
        List<FakeCandidate> candidates = new ArrayList<>();
        try (CampaignActivationCoordinator coordinator = coordinator(registry, candidates, new FakeHost())) {
            assertEquals(
                    CampaignActivationCoordinator.Status.ACTIVATED,
                    await(coordinator.create("Alpha", 0L)).status());
            registry.nextCommit = CommitBehavior.BLOCK_THEN_STORAGE_UNREADABLE;
            CompletionStage<CampaignActivationCoordinator.Result> beta = coordinator.create("Beta", 1L);
            assertTrue(registry.commitEntered.await(5, TimeUnit.SECONDS));
            CompletionStage<CampaignActivationCoordinator.Result> queued = coordinator.create("Queued", 2L);
            int commitsBeforeRelease = registry.commitCalls.get();
            registry.releaseCommit.countDown();

            assertEquals(CampaignActivationCoordinator.Status.RECOVERY_REQUIRED, await(beta).status());
            assertEquals(CampaignActivationCoordinator.Status.RECOVERY_REQUIRED, await(queued).status());
            assertEquals(commitsBeforeRelease, registry.commitCalls.get(),
                    "queued normal transition never crosses the recovery gate");
            assertEquals(CampaignActivationCoordinator.Phase.RECOVERY_REQUIRED,
                    coordinator.snapshot().phase());
        }
    }

    @Test
    void postRootSwapFailureShowsRecoveryAndNeverPresentsCandidateAsNormal() throws Exception {
        FakeRegistry registry = new FakeRegistry();
        FakeHost host = new FakeHost();
        List<FakeCandidate> candidates = new ArrayList<>();
        try (CampaignActivationCoordinator coordinator = coordinator(registry, candidates, host)) {
            assertEquals(
                    CampaignActivationCoordinator.Status.ACTIVATED,
                    await(coordinator.create("Alpha", 0L)).status());
            host.failAfterRootSwap.set(true);

            var failed = await(coordinator.create("Beta", 1L));

            assertEquals(CampaignActivationCoordinator.Status.RECOVERY_REQUIRED, failed.status());
            assertEquals("recovery", host.visibleRoot.get());
            assertEquals(1, host.recoveryCount.get());
            assertEquals(0, candidates.get(1).activationCount.get(),
                    "candidate never gains normal mutation authority after partial publication");
        }
    }

    @Test
    void failedRecoveryRootPublicationNeverClaimsVisibleRecovery() throws Exception {
        FakeRegistry registry = new FakeRegistry();
        FakeHost host = new FakeHost();
        List<FakeCandidate> candidates = new ArrayList<>();
        try (CampaignActivationCoordinator coordinator = coordinator(registry, candidates, host)) {
            assertEquals(
                    CampaignActivationCoordinator.Status.ACTIVATED,
                    await(coordinator.create("Alpha", 0L)).status());
            host.throwAfterRootSwap.set(true);
            host.failRecoveryPublication.set(true);

            var failed = await(coordinator.create("Beta", 1L));

            assertEquals(CampaignActivationCoordinator.Status.RECOVERY_UNAVAILABLE, failed.status());
            assertEquals(CampaignActivationCoordinator.Phase.RECOVERY_UNPUBLISHED,
                    coordinator.snapshot().phase());
            assertEquals("Beta", host.visibleRoot.get());
            assertEquals(
                    CampaignActivationCoordinator.Status.RECOVERY_UNAVAILABLE,
                    await(coordinator.create("Blocked", 2L)).status());
        }
    }

    @Test
    void failedRecoveryPublicationRetainsAttachedPriorPublicationTruth() throws Exception {
        FakeRegistry registry = new FakeRegistry();
        FakeHost host = new FakeHost();
        List<FakeCandidate> candidates = new ArrayList<>();
        try (CampaignActivationCoordinator coordinator = coordinator(registry, candidates, host)) {
            assertEquals(CampaignActivationCoordinator.Status.ACTIVATED,
                    await(coordinator.create("Alpha", 0L)).status());
            host.failRecoveryPublication.set(true);
            registry.nextCommit = CommitBehavior.STORAGE_UNREADABLE_ONCE;

            var failed = await(coordinator.create("Beta", 1L));

            assertEquals(CampaignActivationCoordinator.Status.RECOVERY_UNAVAILABLE, failed.status());
            assertEquals("Alpha", host.visibleRoot.get());
            assertEquals(1, host.switchCount.get());
            host.failRecoveryPublication.set(false);

            assertEquals(CampaignActivationCoordinator.Status.RESUMED,
                    await(coordinator.recoverDurableActive()).status());
            assertEquals("Alpha", host.visibleRoot.get());
            assertEquals(1, host.switchCount.get(),
                    "failed recovery publication must not make the retained shell look detached");
            assertEquals(1, candidates.getFirst().resumeCount.get());
        }
    }

    @Test
    void detachedCloseFailureRetainsOwnershipAndRetriesBeforeNextTransition() throws Exception {
        FakeRegistry registry = new FakeRegistry();
        List<FakeCandidate> candidates = new ArrayList<>();
        try (CampaignActivationCoordinator coordinator = coordinator(registry, candidates, new FakeHost())) {
            assertEquals(
                    CampaignActivationCoordinator.Status.ACTIVATED,
                    await(coordinator.create("Alpha", 0L)).status());
            candidates.get(0).failCloseAttempts.set(1);

            var beta = await(coordinator.create("Beta", 1L));
            assertEquals(CampaignActivationCoordinator.Status.ACTIVATED_DEGRADED, beta.status());
            assertEquals(CampaignActivationCoordinator.Phase.ACTIVE_DEGRADED,
                    coordinator.snapshot().phase());
            assertEquals(1, candidates.get(0).closeAttempts.get());

            var gamma = await(coordinator.create("Gamma", 2L));
            assertEquals(CampaignActivationCoordinator.Status.ACTIVATED, gamma.status());
            assertEquals(2, candidates.get(0).closeAttempts.get(),
                    "owned detached candidate is retried before another normal transition");
        }
    }

    @Test
    void terminalCloseRetainsOwnershipUntilRepeatedFailuresActuallyClose() throws Exception {
        FakeRegistry registry = new FakeRegistry();
        List<FakeCandidate> candidates = new ArrayList<>();
        CampaignActivationCoordinator coordinator = coordinator(registry, candidates, new FakeHost());
        assertEquals(
                CampaignActivationCoordinator.Status.ACTIVATED,
                await(coordinator.create("Alpha", 0L)).status());
        FakeCandidate candidate = candidates.get(0);
        candidate.failCloseAttempts.set(2);

        org.junit.jupiter.api.Assertions.assertThrows(java.util.concurrent.CompletionException.class,
                coordinator::close);
        assertEquals(CampaignActivationCoordinator.Phase.CLOSE_FAILED, coordinator.snapshot().phase());
        assertEquals(1, candidate.closeAttempts.get());
        assertEquals(CampaignActivationCoordinator.Status.CLOSED,
                await(coordinator.create("Rejected after close intent", 1L)).status());

        org.junit.jupiter.api.Assertions.assertThrows(java.util.concurrent.CompletionException.class,
                coordinator::close);
        assertEquals(CampaignActivationCoordinator.Phase.CLOSE_FAILED, coordinator.snapshot().phase());
        assertEquals(2, candidate.closeAttempts.get());

        coordinator.close();
        assertEquals(CampaignActivationCoordinator.Phase.CLOSED, coordinator.snapshot().phase());
        assertEquals(3, candidate.closeAttempts.get());
    }

    @Test
    void failedReservationDeletionRemainsDegradedAndOwnedUntilTerminalRetrySucceeds()
            throws Exception {
        FakeRegistry registry = new FakeRegistry();
        List<FakeCandidate> candidates = new ArrayList<>();
        AtomicReference<Path> rejectedReservation = new AtomicReference<>();
        AtomicInteger cleanupAttempts = new AtomicInteger();
        AtomicInteger identities = new AtomicInteger(1);
        Path root = temporaryDirectory.resolve("cleanup-obligation");
        CampaignActivationCoordinator coordinator = new CampaignActivationCoordinator(
                NoopDiagnostics.INSTANCE,
                registry,
                root,
                (id, path, intent) -> {
                    if (!candidates.isEmpty()) {
                        rejectedReservation.set(path.getParent());
                    }
                    FakeCandidate candidate = new FakeCandidate();
                    candidates.add(candidate);
                    return CompletableFuture.completedFuture(candidate);
                },
                new FakeHost(),
                () -> new UUID(2L, identities.getAndIncrement()),
                java.time.Duration.ofMillis(100),
                java.time.Duration.ofMillis(100),
                () -> { },
                directory -> {
                    if (cleanupAttempts.incrementAndGet() <= 3) {
                        throw new IOException("injected reservation delete failure");
                    }
                    deleteTree(directory);
                });
        var alpha = await(coordinator.create("Alpha", 0L));
        CampaignActivation alphaActivation = alpha.durableActivation().orElseThrow();

        assertEquals(CampaignActivationCoordinator.Status.STALE_GENERATION,
                await(coordinator.create("Rejected", 0L)).status());
        assertTrue(Files.exists(rejectedReservation.get()));
        assertEquals(CampaignActivationCoordinator.Phase.ACTIVE_DEGRADED,
                coordinator.snapshot().phase());
        assertEquals(CampaignActivationCoordinator.Status.ACTIVATED_DEGRADED,
                await(coordinator.switchTo(
                        alphaActivation.campaign().orElseThrow().id(),
                        alphaActivation.generation())).status());

        org.junit.jupiter.api.Assertions.assertThrows(
                java.util.concurrent.CompletionException.class, coordinator::close);
        assertEquals(CampaignActivationCoordinator.Phase.CLOSE_FAILED,
                coordinator.snapshot().phase());
        assertTrue(coordinator.snapshot().durableActivation().isPresent());
        assertTrue(Files.exists(rejectedReservation.get()));

        coordinator.close();
        assertEquals(CampaignActivationCoordinator.Phase.CLOSED, coordinator.snapshot().phase());
        assertFalse(Files.exists(rejectedReservation.get()));
        assertEquals(4, cleanupAttempts.get());
    }

    @Test
    void cleanupErrorIsContainedBeforePriorResumeAndRetryDeletesOnlyRejectedReservation()
            throws Exception {
        FakeRegistry registry = new FakeRegistry();
        List<FakeCandidate> candidates = new ArrayList<>();
        AtomicReference<Path> rejectedReservation = new AtomicReference<>();
        AtomicInteger cleanupAttempts = new AtomicInteger();
        AtomicInteger identities = new AtomicInteger(1);
        Path root = temporaryDirectory.resolve("cleanup-error-obligation");
        CampaignActivationCoordinator coordinator = new CampaignActivationCoordinator(
                NoopDiagnostics.INSTANCE,
                registry,
                root,
                (id, path, intent) -> {
                    if (!candidates.isEmpty()) {
                        rejectedReservation.set(path.getParent());
                    }
                    FakeCandidate candidate = new FakeCandidate();
                    candidates.add(candidate);
                    return CompletableFuture.completedFuture(candidate);
                },
                new FakeHost(),
                () -> new UUID(3L, identities.getAndIncrement()),
                java.time.Duration.ofMillis(100),
                java.time.Duration.ofMillis(100),
                () -> { },
                directory -> {
                    if (cleanupAttempts.incrementAndGet() == 1) {
                        throw new AssertionError("injected cleanup error");
                    }
                    deleteTree(directory);
                });
        var alpha = await(coordinator.create("Alpha", 0L));
        Path alphaFile = alpha.campaignPath().orElseThrow();
        CampaignActivation alphaActivation = alpha.durableActivation().orElseThrow();

        assertEquals(CampaignActivationCoordinator.Status.STALE_GENERATION,
                await(coordinator.create("Rejected", 0L)).status());
        assertEquals(CampaignActivationCoordinator.Phase.ACTIVE_DEGRADED,
                coordinator.snapshot().phase());
        assertEquals(1, candidates.get(0).resumeCount.get());
        assertTrue(Files.exists(alphaFile));
        assertTrue(Files.exists(rejectedReservation.get()));

        assertEquals(CampaignActivationCoordinator.Status.ACTIVATED,
                await(coordinator.switchTo(
                        alphaActivation.campaign().orElseThrow().id(),
                        alphaActivation.generation())).status());
        assertEquals(CampaignActivationCoordinator.Phase.ACTIVE, coordinator.snapshot().phase());
        assertTrue(Files.exists(alphaFile));
        assertFalse(Files.exists(rejectedReservation.get()));
        coordinator.close();
    }

    @Test
    void repeatedCloseAndCleanupFailureBlocksReservationAndCandidateGrowth()
            throws Exception {
        FakeRegistry registry = new FakeRegistry();
        List<FakeCandidate> candidates = new ArrayList<>();
        AtomicInteger identities = new AtomicInteger(1);
        AtomicBoolean failCleanup = new AtomicBoolean(true);
        Path root = temporaryDirectory.resolve("close-cleanup-allocation-gate");
        CampaignActivationCoordinator coordinator = new CampaignActivationCoordinator(
                NoopDiagnostics.INSTANCE,
                registry,
                root,
                (id, path, intent) -> {
                    writeCandidateFile(path);
                    FakeCandidate candidate = new FakeCandidate();
                    if (candidates.size() == 1) {
                        candidate.failCloseAttempts.set(2);
                    }
                    candidates.add(candidate);
                    return CompletableFuture.completedFuture(candidate);
                },
                new FakeHost(),
                () -> new UUID(4L, identities.getAndIncrement()),
                java.time.Duration.ofMillis(100),
                java.time.Duration.ofMillis(100),
                () -> { },
                directory -> {
                    if (failCleanup.get()) {
                        throw new IOException("injected reservation cleanup failure");
                    }
                    deleteTree(directory);
                });
        try {
            assertEquals(CampaignActivationCoordinator.Status.ACTIVATED,
                    await(coordinator.create("Alpha", 0L)).status());
            var rejectedResult = await(coordinator.create("Beta", 0L));
            assertEquals(CampaignActivationCoordinator.Status.STALE_GENERATION,
                    rejectedResult.status());
            assertEquals(2, candidates.size());
            assertEquals(3, identities.get());

            assertEquals(CampaignActivationCoordinator.Status.PRE_COMMIT_FAILED,
                    await(coordinator.create("Gamma", 1L)).status());
            assertEquals(CampaignActivationCoordinator.Status.PRE_COMMIT_FAILED,
                    await(coordinator.create("Gamma", 1L)).status());
            assertEquals(2, candidates.size(),
                    "close and cleanup obligations block every later factory allocation");
            assertEquals(3, identities.get(),
                    "no identity is consumed after the two initial reservations");
            try (var directories = Files.list(root)) {
                assertEquals(2L, directories.count(),
                        "failed cleanup retains exactly its owned reservation without growth");
            }

            failCleanup.set(false);
            assertEquals(CampaignActivationCoordinator.Status.ACTIVATED,
                    await(coordinator.create("Gamma", 1L)).status());
            assertEquals(3, candidates.size());
        } finally {
            failCleanup.set(false);
            coordinator.close();
        }
    }

    @Test
    void permanentCloseFailureNeverDropsOwnershipOrClaimsClosed() throws Exception {
        FakeRegistry registry = new FakeRegistry();
        List<FakeCandidate> candidates = new ArrayList<>();
        CampaignActivationCoordinator coordinator = coordinator(registry, candidates, new FakeHost());
        await(coordinator.create("Alpha", 0L));
        FakeCandidate candidate = candidates.get(0);
        candidate.failCloseAttempts.set(Integer.MAX_VALUE);

        for (int attempt = 1; attempt <= 3; attempt++) {
            org.junit.jupiter.api.Assertions.assertThrows(
                    java.util.concurrent.CompletionException.class, coordinator::close);
            assertEquals(CampaignActivationCoordinator.Phase.CLOSE_FAILED,
                    coordinator.snapshot().phase());
            assertTrue(coordinator.snapshot().durableActivation().isPresent());
            assertEquals(attempt, candidate.closeAttempts.get());
        }

        candidate.failCloseAttempts.set(3);
        coordinator.close();
        assertEquals(CampaignActivationCoordinator.Phase.CLOSED, coordinator.snapshot().phase());
    }

    @Test
    void acceptedSubmitCompletesBeforeCloseAndLaterSubmitIsClosed() throws Exception {
        FakeRegistry registry = new FakeRegistry();
        CountDownLatch factoryEntered = new CountDownLatch(1);
        CountDownLatch releaseFactory = new CountDownLatch(1);
        CampaignActivationCoordinator coordinator = new CampaignActivationCoordinator(
                NoopDiagnostics.INSTANCE,
                registry,
                temporaryDirectory,
                (id, path, intent) -> {
                    factoryEntered.countDown();
                    awaitLatch(releaseFactory);
                    return CompletableFuture.completedFuture(new FakeCandidate());
                },
                new FakeHost());
        CompletionStage<CampaignActivationCoordinator.Result> accepted = coordinator.create("Alpha", 0L);
        assertTrue(factoryEntered.await(5, TimeUnit.SECONDS));
        Thread closer = new Thread(coordinator::close, "coordinator-close-race");
        closer.start();
        releaseFactory.countDown();

        assertEquals(CampaignActivationCoordinator.Status.ACTIVATED, await(accepted).status());
        closer.join(TimeUnit.SECONDS.toMillis(5));
        assertFalse(closer.isAlive());
        assertEquals(
                CampaignActivationCoordinator.Status.CLOSED,
                await(coordinator.create("Late", 1L)).status());
    }

    private CampaignActivationCoordinator coordinator(
            FakeRegistry registry,
            List<FakeCandidate> candidates,
            FakeHost host
    ) {
        AtomicInteger identity = new AtomicInteger(1);
        return new CampaignActivationCoordinator(
                NoopDiagnostics.INSTANCE,
                registry,
                temporaryDirectory.resolve("campaigns-" + UUID.randomUUID()),
                (id, path, intent) -> {
                    FakeCandidate candidate = new FakeCandidate();
                    candidates.add(candidate);
                    return CompletableFuture.completedFuture(candidate);
                },
                host,
                () -> new UUID(0L, identity.getAndIncrement()));
    }

    private CampaignActivationCoordinator timedCoordinator(
            FakeRegistry registry,
            Path root,
            CampaignActivationCoordinator.CandidateFactory factory,
            FakeHost host
    ) {
        AtomicInteger identity = new AtomicInteger(1);
        return new CampaignActivationCoordinator(
                NoopDiagnostics.INSTANCE, registry, root, factory, host,
                () -> new UUID(1L, identity.getAndIncrement()),
                java.time.Duration.ofMillis(100));
    }

    private static CampaignSnapshot registeredCampaign(String id, String name) {
        return new CampaignSnapshot(new CampaignId(UUID.fromString(id)), name);
    }

    private static void writeExistingCampaign(Path root, CampaignSnapshot campaign) throws Exception {
        Path directory = root.resolve(campaign.id().value().toString());
        Files.createDirectories(directory);
        Files.writeString(directory.resolve("campaign.sqlite"), "existing-campaign");
    }

    private static void writeCandidateFile(Path path) {
        try {
            Files.writeString(path, "prepared-campaign");
        } catch (IOException failure) {
            throw new java.io.UncheckedIOException(failure);
        }
    }

    private static void deleteTree(Path directory) throws IOException {
        try (var paths = Files.walk(directory)) {
            paths.sorted(java.util.Comparator.reverseOrder()).forEach(path -> {
                try {
                    Files.deleteIfExists(path);
                } catch (IOException failure) {
                    throw new java.io.UncheckedIOException(failure);
                }
            });
        } catch (java.io.UncheckedIOException failure) {
            throw failure.getCause();
        }
    }

    private static <T> T await(CompletionStage<T> stage) throws Exception {
        return stage.toCompletableFuture().get(10, TimeUnit.SECONDS);
    }

    private static void awaitLatch(CountDownLatch latch) {
        try {
            if (!latch.await(5, TimeUnit.SECONDS)) {
                throw new AssertionError("latch timed out");
            }
        } catch (InterruptedException interrupted) {
            Thread.currentThread().interrupt();
            throw new AssertionError(interrupted);
        }
    }

    private static void awaitCondition(java.util.function.BooleanSupplier condition) {
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(5);
        while (!condition.getAsBoolean()) {
            if (System.nanoTime() >= deadline) {
                throw new AssertionError("condition timed out");
            }
            Thread.onSpinWait();
        }
    }

    private static void assertThrowsRejectedMutation(FakeCandidate candidate) {
        org.junit.jupiter.api.Assertions.assertThrows(
                RejectedExecutionException.class, candidate::acceptMutation);
    }

    private enum CommitBehavior {
        NORMAL,
        STORAGE_AFTER_TARGET,
        TARGET_UNREADABLE_ONCE,
        DEFINITE_STALE_ONCE,
        EXCEPTION_WITH_PRIOR,
        BLOCK_THEN_STORAGE_UNREADABLE,
        STORAGE_UNREADABLE_ONCE,
        NEVER_COMPLETES
    }

    private static final class FakeRegistry implements CampaignRegistryApi {
        private final java.util.Map<CampaignId, CampaignSnapshot> campaigns =
                new java.util.LinkedHashMap<>();
        private final AtomicInteger commitCalls = new AtomicInteger();
        private volatile CampaignActivation active = CampaignActivation.none();
        private volatile CommitBehavior nextCommit = CommitBehavior.NORMAL;
        private final CountDownLatch commitEntered = new CountDownLatch(1);
        private final CountDownLatch releaseCommit = new CountDownLatch(1);
        private volatile boolean activeUnreadable;
        private final AtomicInteger activeUnreadableReads = new AtomicInteger();
        private CompletableFuture<CampaignPointerCommitResult> pendingCommit;

        @Override
        public CompletionStage<CampaignPointerCommitResult> registerAndCommitActivePointer(
                CampaignId campaignId,
                String name,
                long expectedGeneration
        ) {
            commitCalls.incrementAndGet();
            CampaignSnapshot target = new CampaignSnapshot(campaignId, name.strip());
            CommitBehavior behavior = nextCommit;
            nextCommit = CommitBehavior.NORMAL;
            if (behavior == CommitBehavior.BLOCK_THEN_STORAGE_UNREADABLE) {
                commitEntered.countDown();
                awaitLatch(releaseCommit);
                activeUnreadable = true;
                return CompletableFuture.completedFuture(storageError());
            }
            if (behavior == CommitBehavior.EXCEPTION_WITH_PRIOR) {
                return CompletableFuture.failedFuture(new IllegalStateException("commit completion failed"));
            }
            if (behavior == CommitBehavior.STORAGE_UNREADABLE_ONCE) {
                activeUnreadableReads.set(1);
                return CompletableFuture.completedFuture(storageError());
            }
            if (behavior == CommitBehavior.NEVER_COMPLETES) {
                pendingCommit = new CompletableFuture<>();
                return pendingCommit;
            }
            if (behavior == CommitBehavior.DEFINITE_STALE_ONCE) {
                return CompletableFuture.completedFuture(new CampaignPointerCommitResult(
                        CampaignPointerCommitResult.Status.STALE_GENERATION,
                        Optional.of(active)));
            }
            if (active.generation() != expectedGeneration) {
                return CompletableFuture.completedFuture(new CampaignPointerCommitResult(
                        CampaignPointerCommitResult.Status.STALE_GENERATION,
                        Optional.of(active)));
            }
            campaigns.put(campaignId, target);
            active = new CampaignActivation(Optional.of(target), expectedGeneration + 1L);
            if (behavior == CommitBehavior.TARGET_UNREADABLE_ONCE) {
                activeUnreadableReads.set(1);
                return CompletableFuture.completedFuture(storageError());
            }
            if (behavior == CommitBehavior.STORAGE_AFTER_TARGET) {
                return CompletableFuture.completedFuture(storageError());
            }
            return CompletableFuture.completedFuture(committed());
        }

        @Override
        public CompletionStage<CampaignListResult> list() {
            return CompletableFuture.completedFuture(new CampaignListResult(
                    CampaignListResult.Status.SUCCESS, List.copyOf(campaigns.values())));
        }

        @Override
        public CompletionStage<CampaignReadResult> read(CampaignId campaignId) {
            CampaignSnapshot campaign = campaigns.get(campaignId);
            return CompletableFuture.completedFuture(campaign == null
                    ? new CampaignReadResult(CampaignReadResult.Status.NOT_FOUND, Optional.empty())
                    : new CampaignReadResult(CampaignReadResult.Status.FOUND, Optional.of(campaign)));
        }

        @Override
        public CompletionStage<CampaignActiveResult> active() {
            return CompletableFuture.completedFuture(activeUnreadable
                    || activeUnreadableReads.getAndUpdate(value -> Math.max(0, value - 1)) > 0
                    ? new CampaignActiveResult(CampaignActiveResult.Status.STORAGE_ERROR, Optional.empty())
                    : new CampaignActiveResult(CampaignActiveResult.Status.SUCCESS, Optional.of(active)));
        }

        @Override
        public CompletionStage<CampaignPointerCommitResult> commitActivePointer(
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

        private CampaignPointerCommitResult committed() {
            return new CampaignPointerCommitResult(
                    CampaignPointerCommitResult.Status.COMMITTED, Optional.of(active));
        }

        private static CampaignPointerCommitResult storageError() {
            return new CampaignPointerCommitResult(
                    CampaignPointerCommitResult.Status.STORAGE_ERROR, Optional.empty());
        }
    }

    private static class FakeCandidate implements CampaignActivationCoordinator.Candidate {
        protected final AtomicInteger pauseCount = new AtomicInteger();
        protected final AtomicInteger resumeCount = new AtomicInteger();
        protected final AtomicInteger activationCount = new AtomicInteger();
        protected final AtomicInteger closeAttempts = new AtomicInteger();
        protected final AtomicInteger failCloseAttempts = new AtomicInteger();
        protected final AtomicBoolean mutationAccepted = new AtomicBoolean();
        private CompletionStage<Void> pauseResult = CompletableFuture.completedFuture(null);
        private CompletionStage<Void> publicationDrain = CompletableFuture.completedFuture(null);
        private @org.jspecify.annotations.Nullable CompletionStage<Void> closeResult;
        private boolean neverReturnCloseInvocation;
        private final CountDownLatch closeInvocationEntered = new CountDownLatch(1);
        private final AtomicBoolean releaseCloseInvocation = new AtomicBoolean();
        private boolean neverCompleteUi;
        private boolean asyncUi;
        private boolean blockActivationTerminal;
        private final AtomicInteger uiDispatches = new AtomicInteger();
        private final CountDownLatch activationTerminalEntered = new CountDownLatch(1);
        private final CountDownLatch releaseActivationTerminal = new CountDownLatch(1);
        private java.util.function.Consumer<Throwable> pendingUiTerminal;
        private CompletableFuture<Void> pendingUiStage;

        @Override public AppShell shell() { return null; }

        @Override public CampaignRuntime runtimeForTesting() { return null; }

        @Override public CompletionStage<Void> pauseAndDrain() {
            pauseCount.incrementAndGet();
            return pauseResult;
        }

        protected void setPauseResult(CompletionStage<Void> result) {
            pauseResult = java.util.Objects.requireNonNull(result, "result");
        }

        @Override public void resumeAdmission() { resumeCount.incrementAndGet(); }

        @Override
        public CampaignRuntime.CandidatePreparation<Boolean> preparePublication(
                java.util.function.Supplier<Boolean> publication
        ) {
            return new CampaignRuntime.CandidatePreparation<>(
                    publication.get(), publicationDrain);
        }

        @Override
        public CompletionStage<Void> dispatchUiTracked(
                Runnable work,
                java.util.function.Consumer<Throwable> terminalHandler
        ) {
            int dispatchNumber = uiDispatches.incrementAndGet();
            if (neverCompleteUi) {
                pendingUiTerminal = terminalHandler;
                pendingUiStage = new CompletableFuture<>();
                return pendingUiStage;
            }
            if (asyncUi) {
                CompletableFuture<Void> terminal = new CompletableFuture<>();
                Thread dispatch = new Thread(() -> {
                    try {
                        work.run();
                        if (blockActivationTerminal && dispatchNumber == 2) {
                            activationTerminalEntered.countDown();
                            awaitLatch(releaseActivationTerminal);
                        }
                        terminalHandler.accept(null);
                        terminal.complete(null);
                    } catch (RuntimeException | Error failure) {
                        terminalHandler.accept(failure);
                        terminal.completeExceptionally(failure);
                    }
                }, "fake-campaign-ui");
                dispatch.setDaemon(true);
                dispatch.start();
                return terminal;
            }
            try {
                work.run();
                terminalHandler.accept(null);
                return CompletableFuture.completedFuture(null);
            } catch (RuntimeException | Error failure) {
                terminalHandler.accept(failure);
                return CompletableFuture.failedFuture(failure);
            }
        }

        private void releaseUi(Throwable failure) {
            pendingUiTerminal.accept(failure);
            if (failure == null) {
                pendingUiStage.complete(null);
            } else {
                pendingUiStage.completeExceptionally(failure);
            }
        }

        @Override public void activateVisibleShell() {
            activationCount.incrementAndGet();
            mutationAccepted.set(true);
        }

        protected int acceptMutation() {
            if (!mutationAccepted.get()) {
                throw new RejectedExecutionException("Candidate is not active");
            }
            return 1;
        }

        @Override
        public CompletionStage<Void> closeAsync() {
            int attempt = closeAttempts.incrementAndGet();
            if (neverReturnCloseInvocation) {
                closeInvocationEntered.countDown();
                while (!releaseCloseInvocation.get()) {
                    java.util.concurrent.locks.LockSupport.parkNanos(
                            TimeUnit.MILLISECONDS.toNanos(5));
                    Thread.interrupted();
                }
            }
            if (closeResult != null) {
                return closeResult;
            }
            if (attempt <= failCloseAttempts.get()) {
                return CompletableFuture.failedFuture(new IllegalStateException("injected close failure"));
            }
            return CompletableFuture.completedFuture(null);
        }
    }

    private static final class LiveTrackingCandidate extends FakeCandidate {
        private final AtomicInteger liveCandidates;
        private final AtomicBoolean live = new AtomicBoolean(true);

        private LiveTrackingCandidate(
                AtomicInteger liveCandidates,
                AtomicInteger maximumLiveCandidates
        ) {
            this.liveCandidates = liveCandidates;
            int current = liveCandidates.incrementAndGet();
            maximumLiveCandidates.accumulateAndGet(current, Math::max);
        }

        @Override
        public CompletionStage<Void> closeAsync() {
            return super.closeAsync().thenRun(() -> {
                if (live.compareAndSet(true, false)) {
                    liveCandidates.decrementAndGet();
                }
            });
        }
    }

    private static final class ReusableFakeCandidate extends FakeCandidate {
        private final AtomicBoolean parkedValid = new AtomicBoolean(true);

        @Override
        public boolean reusableWhileParked() {
            return true;
        }

        @Override
        public boolean parkedStateStillValid() {
            return parkedValid.get();
        }

        @Override
        public CompletionStage<Void> pauseAndDrain() {
            mutationAccepted.set(false);
            return super.pauseAndDrain();
        }

        @Override
        public void resumeAdmission() {
            super.resumeAdmission();
            mutationAccepted.set(true);
        }
    }

    private static final class AdmissionCandidate extends FakeCandidate {
        private final WorkflowAdmissionController admission;
        private final ExecutionLane admittedMutation;
        private final AtomicInteger mutations = new AtomicInteger();

        private AdmissionCandidate(WorkflowAdmissionController admission) {
            this.admission = admission;
            admittedMutation = admission.admit(new ExecutionLane() {
                @Override public void execute(Runnable work) { work.run(); }
                @Override public void close() { }
            });
        }

        @Override
        public CompletionStage<Void> pauseAndDrain() {
            pauseCount.incrementAndGet();
            return admission.pauseAndDrain();
        }

        @Override
        public void resumeAdmission() {
            resumeCount.incrementAndGet();
            admission.resume();
        }

        @Override
        public CompletionStage<Void> closeAsync() {
            closeAttempts.incrementAndGet();
            return admission.revokeAndDrain().thenRun(admission::closeDelegatesAfterDrain);
        }

        @Override
        protected int acceptMutation() {
            admittedMutation.execute(mutations::incrementAndGet);
            return mutations.get();
        }
    }

    private static class FakeHost implements CampaignActivationCoordinator.SwitchingHost {
        private final AtomicBoolean failAfterRootSwap = new AtomicBoolean();
        private final AtomicBoolean throwAfterRootSwap = new AtomicBoolean();
        private final AtomicBoolean failRecoveryPublication = new AtomicBoolean();
        private final AtomicBoolean neverCompleteRecovery = new AtomicBoolean();
        private final AtomicBoolean neverReturnRecoveryInvocation = new AtomicBoolean();
        private final AtomicBoolean releaseRecoveryInvocation = new AtomicBoolean();
        private final CountDownLatch recoveryInvocationEntered = new CountDownLatch(1);
        private final AtomicBoolean blockSwitch = new AtomicBoolean();
        private final AtomicReference<String> visibleRoot = new AtomicReference<>("none");
        private final AtomicInteger recoveryCount = new AtomicInteger();
        private final AtomicInteger switchCount = new AtomicInteger();
        private final CountDownLatch switchEntered = new CountDownLatch(1);
        private final CountDownLatch releaseSwitch = new CountDownLatch(1);
        private CompletableFuture<Void> pendingRecovery;

        @Override
        public CampaignActivationCoordinator.RootSwitchResult switchCampaign(
                CampaignSnapshot campaign,
                long generation,
                AppShell shell
        ) {
            if (blockSwitch.get()) {
                switchEntered.countDown();
                awaitLatch(releaseSwitch);
            }
            visibleRoot.set(campaign.name());
            switchCount.incrementAndGet();
            if (throwAfterRootSwap.compareAndSet(true, false)) {
                throw new IllegalStateException("injected failure after root swap");
            }
            if (failAfterRootSwap.compareAndSet(true, false)) {
                visibleRoot.set("recovery");
                return CampaignActivationCoordinator.RootSwitchResult.RECOVERY_VISIBLE;
            }
            return CampaignActivationCoordinator.RootSwitchResult.CAMPAIGN_ROOT_VISIBLE;
        }

        @Override
        public CompletionStage<Void> showRecovery(
                Optional<CampaignActivation> durableActivation,
                Class<? extends Throwable> failureType
        ) {
            if (neverReturnRecoveryInvocation.get()) {
                recoveryInvocationEntered.countDown();
                while (!releaseRecoveryInvocation.get()) {
                    java.util.concurrent.locks.LockSupport.parkNanos(
                            TimeUnit.MILLISECONDS.toNanos(5));
                    Thread.interrupted();
                }
            }
            if (failRecoveryPublication.get()) {
                return CompletableFuture.failedFuture(
                        new IllegalStateException("injected recovery-root failure"));
            }
            if (neverCompleteRecovery.get()) {
                recoveryCount.incrementAndGet();
                pendingRecovery = new CompletableFuture<>();
                return pendingRecovery;
            }
            visibleRoot.set("recovery");
            recoveryCount.incrementAndGet();
            return CompletableFuture.completedFuture(null);
        }

        private void releaseRecovery() {
            pendingRecovery.complete(null);
        }
    }
}
