package features.encounter.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import features.creatures.api.CreatureEncounterCandidate;
import features.creatures.api.CreatureFactsQuery;
import features.creatures.api.CreatureFactsSnapshotResult;
import features.creatures.api.CreaturesApi;
import features.encounter.api.GeneratedEncounterBatchStatus;
import features.encounter.api.GeneratedEncounterBlock;
import features.encounter.api.GeneratedEncounterDifficulty;
import features.encounter.api.GeneratedEncounterIntent;
import features.encounter.api.GeneratedEncounterRole;
import features.encounter.api.GeneratedEncounterSource;
import features.encounter.api.CommitGeneratedEncounterBatchCommand;
import features.encounter.api.GeneratedEncounterPlanSummary;
import features.encounter.api.PreparedEncounterBatch;
import features.encounter.api.PreparedEncounterCreature;
import features.encounter.api.PreparedEncounterRoster;
import features.encounter.api.PrepareGeneratedEncounterBatchCommand;
import features.party.api.ActivePartyComposition;
import features.party.api.ActivePartyCompositionModel;
import features.party.api.ActivePartyCompositionResult;
import features.party.api.ReadStatus;
import java.util.ArrayList;
import java.util.ArrayDeque;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import org.junit.jupiter.api.Test;
import platform.execution.DirectExecutionLane;
import platform.execution.ExecutionLane;

final class GeneratedEncounterBatchServiceTest {

    @Test
    void preparesOnceFromOneUnionWithDeterministicRoleSelectionAndRosterDiversity() {
        RecordingCreatures creatures = new RecordingCreatures(List.of(
                candidate(11L, "Guard", "1/2", 100, 60, 15, 0),
                candidate(12L, "Scout", "1/2", 100, 50, 14, 0),
                candidate(21L, "Dragon", "2", 500, 100, 18, 1),
                candidate(22L, "Veteran", "2", 500, 80, 16, 0)));
        RecordingRepository repository = new RecordingRepository();
        GeneratedEncounterBatchService service = service(creatures, repository);

        var result = service.prepare(command()).toCompletableFuture().join();

        assertEquals(GeneratedEncounterBatchStatus.SUCCESS, result.status());
        assertEquals(1, creatures.queries.size());
        assertEquals(List.of(100L, 500L), creatures.queries.getFirst().values());
        assertEquals(0, repository.commits);
        var rosters = result.batch().orElseThrow().rosters();
        assertEquals(3, rosters.size());
        assertNotEquals(rosters.get(0).rosterFingerprint(), rosters.get(1).rosterFingerprint());
        assertEquals(21L, rosters.get(2).creatures().getFirst().creatureId(),
                "BOSS intent prefers the classified boss before fallback");
        assertEquals(200L, rosters.getFirst().summary().baseXp());
        assertTrue(rosters.getFirst().summary().adjustedXp() > 0L);

        var repeated = service.prepare(command()).toCompletableFuture().join();
        assertEquals(result.batch().orElseThrow(), repeated.batch().orElseThrow());
    }

    @Test
    void returnsNoDraftForMissingExactCrAndCapturesPartyOnlyOnce() {
        RecordingCreatures creatures = new RecordingCreatures(List.of(
                candidate(11L, "Wrong CR", "1/4", 100, 50, 15, 0)));
        CountingParty party = new CountingParty();
        GeneratedEncounterBatchService service = new GeneratedEncounterBatchService(
                creatures, party.model(), new RecordingRepository(),
                DirectExecutionLane.INSTANCE, DirectExecutionLane.INSTANCE);

        var result = service.prepare(new PrepareGeneratedEncounterBatchCommand(
                source(), List.of(intent(1, GeneratedEncounterRole.STANDARD, "1/2", 100L, 1))))
                .toCompletableFuture().join();

        assertEquals(GeneratedEncounterBatchStatus.UNRESOLVABLE, result.status());
        assertTrue(result.batch().isEmpty());
        assertEquals(1, party.reads);
        assertEquals(1, creatures.queries.size());
    }

    @Test
    void summariesPreserveRequestOrderReportMissingAndUnresolvableAndUseOneIdSnapshot() {
        RecordingCreatures creatures = new RecordingCreatures(List.of(
                candidate(11L, "Current Guard", "1/2", 100, 60, 15, 0)));
        CountingParty party = new CountingParty();
        GeneratedEncounterBatchRepository repository = new GeneratedEncounterBatchRepository() {
            @Override
            public CommitOutcome commit(features.encounter.api.PreparedEncounterBatch batch) {
                throw new AssertionError("summary read must not write");
            }

            @Override
            public List<features.encounter.domain.plan.EncounterPlan> loadPlansByIds(List<Long> planIds) {
                return List.of(
                        new features.encounter.domain.plan.EncounterPlan(
                                1L, "Historical", "", List.of(
                                        new features.encounter.domain.plan.EncounterPlanCreature(
                                                11L, 2, "Old Guard"))),
                        new features.encounter.domain.plan.EncounterPlan(
                                2L, "Broken", "", List.of(
                                        new features.encounter.domain.plan.EncounterPlanCreature(99L, 1, "Old"))));
            }
        };
        GeneratedEncounterBatchService service = new GeneratedEncounterBatchService(
                creatures, party.model(), repository,
                DirectExecutionLane.INSTANCE, DirectExecutionLane.INSTANCE);

        var result = service.loadSummaries(
                new features.encounter.api.GeneratedEncounterPlanSummaryBatchQuery(List.of(3L, 1L, 2L)))
                .toCompletableFuture().join();

        assertEquals(GeneratedEncounterBatchStatus.SUCCESS, result.status());
        assertEquals(List.of(
                features.encounter.api.GeneratedEncounterPlanSummaryEntry.Status.MISSING,
                features.encounter.api.GeneratedEncounterPlanSummaryEntry.Status.FOUND,
                features.encounter.api.GeneratedEncounterPlanSummaryEntry.Status.UNRESOLVABLE),
                result.entries().stream().map(entry -> entry.status()).toList());
        assertEquals("Current Guard", result.entries().get(1).summary().orElseThrow()
                .roster().getFirst().displayName());
        assertEquals(1, creatures.queries.size());
        assertEquals(CreatureFactsQuery.Mode.CREATURE_IDS, creatures.queries.getFirst().mode());
        assertEquals(List.of(11L, 99L), creatures.queries.getFirst().values());
        assertEquals(1, party.reads);
    }

    @Test
    void summaryRepositoryReadRunsOnIoAndProjectionRunsOnCpuIncludingMissingOnly() {
        RecordingLane cpu = new RecordingLane();
        RecordingLane io = new RecordingLane();
        RecordingCreatures creatures = new RecordingCreatures(List.of(
                candidate(11L, "Current Guard", "1/2", 100, 60, 15, 0)));
        boolean[] repositoryReadOnIo = {false};
        GeneratedEncounterBatchRepository repository = repositoryWithPlans(plan(1L, 11L), () ->
                repositoryReadOnIo[0] = io.running);
        GeneratedEncounterBatchService service = service(creatures, repository, cpu, io);

        var result = service.loadSummaries(
                new features.encounter.api.GeneratedEncounterPlanSummaryBatchQuery(List.of(1L)));

        assertEquals(1, io.pending());
        assertFalse(result.toCompletableFuture().isDone());
        io.runNext();
        assertTrue(repositoryReadOnIo[0]);
        assertEquals(1, cpu.pending());
        assertFalse(result.toCompletableFuture().isDone());
        cpu.runNext();
        assertEquals(GeneratedEncounterBatchStatus.SUCCESS, result.toCompletableFuture().join().status());

        RecordingLane missingCpu = new RecordingLane();
        RecordingLane missingIo = new RecordingLane();
        GeneratedEncounterBatchService missingService = service(
                new RecordingCreatures(List.of()), repositoryWithPlans(List.of(), () -> { }),
                missingCpu, missingIo);
        var missing = missingService.loadSummaries(
                new features.encounter.api.GeneratedEncounterPlanSummaryBatchQuery(List.of(99L)));
        missingIo.runNext();
        assertEquals(1, missingCpu.pending(), "missing-only projection still belongs to the CPU lane");
        assertFalse(missing.toCompletableFuture().isDone());
        missingCpu.runNext();
        assertEquals(features.encounter.api.GeneratedEncounterPlanSummaryEntry.Status.MISSING,
                missing.toCompletableFuture().join().entries().getFirst().status());
    }

    @Test
    void synchronousForeignFactsFailureAndRejectedCpuCompleteStorageFailure() {
        RecordingLane throwingCpu = new RecordingLane();
        RecordingLane throwingIo = new RecordingLane();
        RecordingCreatures throwingCreatures = new RecordingCreatures(List.of());
        throwingCreatures.throwOnLoad = true;
        GeneratedEncounterBatchService throwingService = service(
                throwingCreatures, repositoryWithPlans(plan(1L, 11L), () -> { }),
                throwingCpu, throwingIo);

        var throwing = throwingService.loadSummaries(
                new features.encounter.api.GeneratedEncounterPlanSummaryBatchQuery(List.of(1L)));
        throwingIo.runNext();
        assertTrue(throwing.toCompletableFuture().isDone());
        assertEquals(GeneratedEncounterBatchStatus.STORAGE_FAILURE,
                throwing.toCompletableFuture().join().status());

        RecordingLane rejectedCpu = new RecordingLane();
        rejectedCpu.reject = true;
        RecordingLane rejectedIo = new RecordingLane();
        GeneratedEncounterBatchService rejectedService = service(
                new RecordingCreatures(List.of(
                        candidate(11L, "Guard", "1/2", 100, 60, 15, 0))),
                repositoryWithPlans(plan(1L, 11L), () -> { }), rejectedCpu, rejectedIo);

        var rejected = rejectedService.loadSummaries(
                new features.encounter.api.GeneratedEncounterPlanSummaryBatchQuery(List.of(1L)));
        rejectedIo.runNext();
        assertTrue(rejected.toCompletableFuture().isDone());
        assertEquals(GeneratedEncounterBatchStatus.STORAGE_FAILURE,
                rejected.toCompletableFuture().join().status());
    }

    @Test
    void commitRejectsPreparedSummariesThatDoNotStructurallyMatchTheirRosters() {
        PreparedEncounterBatch valid = preparedBatch();
        PreparedEncounterRoster first = valid.rosters().getFirst();
        GeneratedEncounterPlanSummary sourceSummary = first.summary();
        List<PreparedEncounterBatch> malformed = List.of(
                replaceFirstSummary(valid, summary(
                        sourceSummary, 99L, first.displayLabel(), first.creatures(), sourceSummary.creatureCount())),
                replaceFirstSummary(valid, summary(
                        sourceSummary, 0L, "Wrong label", first.creatures(), sourceSummary.creatureCount())),
                replaceFirstSummary(valid, summary(
                        sourceSummary, 0L, first.displayLabel(),
                        List.of(new PreparedEncounterCreature(999L, 1, "Other")),
                        sourceSummary.creatureCount())),
                replaceFirstSummary(valid, summary(
                        sourceSummary, 0L, first.displayLabel(), first.creatures(),
                        sourceSummary.creatureCount() + 1)));
        OutcomeRepository repository = new OutcomeRepository(new GeneratedEncounterBatchRepository.CommitOutcome(
                GeneratedEncounterBatchRepository.CommitOutcome.Status.COMMITTED, validMappings(valid)));
        GeneratedEncounterBatchService service = service(
                new RecordingCreatures(List.of()), repository,
                DirectExecutionLane.INSTANCE, DirectExecutionLane.INSTANCE);

        for (PreparedEncounterBatch batch : malformed) {
            var result = service.commit(new CommitGeneratedEncounterBatchCommand(batch))
                    .toCompletableFuture().join();
            assertEquals(GeneratedEncounterBatchStatus.INVALID_REQUEST, result.status());
            assertTrue(result.mappings().isEmpty());
        }
        assertEquals(0, repository.commits);
    }

    @Test
    void commitRejectsPartialReorderedAndDuplicateRepositoryMappingsAsStorageFailure() {
        PreparedEncounterBatch batch = preparedBatch();
        List<GeneratedEncounterBatchRepository.Mapping> valid = validMappings(batch);
        List<List<GeneratedEncounterBatchRepository.Mapping>> malformed = List.of(
                valid.subList(0, valid.size() - 1),
                new ArrayList<>(valid.reversed()),
                List.of(
                        new GeneratedEncounterBatchRepository.Mapping(1, 901L),
                        new GeneratedEncounterBatchRepository.Mapping(1, 902L),
                        new GeneratedEncounterBatchRepository.Mapping(3, 903L)),
                List.of(
                        new GeneratedEncounterBatchRepository.Mapping(1, 901L),
                        new GeneratedEncounterBatchRepository.Mapping(2, 901L),
                        new GeneratedEncounterBatchRepository.Mapping(3, 903L)));

        for (List<GeneratedEncounterBatchRepository.Mapping> mappings : malformed) {
            OutcomeRepository repository = new OutcomeRepository(new GeneratedEncounterBatchRepository.CommitOutcome(
                    GeneratedEncounterBatchRepository.CommitOutcome.Status.COMMITTED, mappings));
            GeneratedEncounterBatchService service = service(
                    new RecordingCreatures(List.of()), repository,
                    DirectExecutionLane.INSTANCE, DirectExecutionLane.INSTANCE);

            var result = service.commit(new CommitGeneratedEncounterBatchCommand(batch))
                    .toCompletableFuture().join();

            assertEquals(GeneratedEncounterBatchStatus.STORAGE_FAILURE, result.status());
            assertTrue(result.mappings().isEmpty());
            assertEquals(1, repository.commits);
        }
    }

    private static GeneratedEncounterBatchService service(
            RecordingCreatures creatures, RecordingRepository repository
    ) {
        ActivePartyCompositionModel party = new ActivePartyCompositionModel(
                () -> new ActivePartyCompositionResult(
                        ReadStatus.SUCCESS, new ActivePartyComposition(List.of(3, 3, 3, 3), 3)),
                listener -> () -> { });
        return new GeneratedEncounterBatchService(
                creatures, party, repository, DirectExecutionLane.INSTANCE, DirectExecutionLane.INSTANCE);
    }

    private static GeneratedEncounterBatchService service(
            CreaturesApi creatures,
            GeneratedEncounterBatchRepository repository,
            ExecutionLane cpu,
            ExecutionLane io
    ) {
        ActivePartyCompositionModel party = new ActivePartyCompositionModel(
                () -> new ActivePartyCompositionResult(
                        ReadStatus.SUCCESS, new ActivePartyComposition(List.of(3, 3, 3, 3), 3)),
                listener -> () -> { });
        return new GeneratedEncounterBatchService(creatures, party, repository, cpu, io);
    }

    private static GeneratedEncounterBatchRepository repositoryWithPlans(
            features.encounter.domain.plan.EncounterPlan plan,
            Runnable onRead
    ) {
        return repositoryWithPlans(List.of(plan), onRead);
    }

    private static GeneratedEncounterBatchRepository repositoryWithPlans(
            List<features.encounter.domain.plan.EncounterPlan> plans,
            Runnable onRead
    ) {
        return new GeneratedEncounterBatchRepository() {
            @Override
            public CommitOutcome commit(PreparedEncounterBatch batch) {
                throw new AssertionError("summary read must not write");
            }

            @Override
            public List<features.encounter.domain.plan.EncounterPlan> loadPlansByIds(List<Long> planIds) {
                onRead.run();
                return plans;
            }
        };
    }

    private static features.encounter.domain.plan.EncounterPlan plan(long planId, long creatureId) {
        return new features.encounter.domain.plan.EncounterPlan(
                planId, "Plan " + planId, "", List.of(
                        new features.encounter.domain.plan.EncounterPlanCreature(
                                creatureId, 1, "Stored")));
    }

    private static PreparedEncounterBatch preparedBatch() {
        RecordingCreatures creatures = new RecordingCreatures(List.of(
                candidate(11L, "Guard", "1/2", 100, 60, 15, 0),
                candidate(12L, "Scout", "1/2", 100, 50, 14, 0),
                candidate(21L, "Dragon", "2", 500, 100, 18, 1),
                candidate(22L, "Veteran", "2", 500, 80, 16, 0)));
        return service(creatures, new RecordingRepository()).prepare(command())
                .toCompletableFuture().join().batch().orElseThrow();
    }

    private static PreparedEncounterBatch replaceFirstSummary(
            PreparedEncounterBatch batch,
            GeneratedEncounterPlanSummary summary
    ) {
        List<PreparedEncounterRoster> rosters = new ArrayList<>(batch.rosters());
        PreparedEncounterRoster first = rosters.getFirst();
        rosters.set(0, new PreparedEncounterRoster(
                first.encounterNumber(), first.displayLabel(), first.intentFingerprint(),
                first.rosterFingerprint(), first.creatures(), summary));
        return new PreparedEncounterBatch(batch.source(), batch.batchFingerprint(), rosters);
    }

    private static GeneratedEncounterPlanSummary summary(
            GeneratedEncounterPlanSummary source,
            long planId,
            String label,
            List<PreparedEncounterCreature> roster,
            int count
    ) {
        return new GeneratedEncounterPlanSummary(
                planId, label, roster, count, source.baseXp(), source.adjustedXp(),
                source.difficulty(), source.displaySummary());
    }

    private static List<GeneratedEncounterBatchRepository.Mapping> validMappings(PreparedEncounterBatch batch) {
        List<GeneratedEncounterBatchRepository.Mapping> mappings = new ArrayList<>();
        for (int index = 0; index < batch.rosters().size(); index++) {
            mappings.add(new GeneratedEncounterBatchRepository.Mapping(
                    batch.rosters().get(index).encounterNumber(), 901L + index));
        }
        return List.copyOf(mappings);
    }

    private static PrepareGeneratedEncounterBatchCommand command() {
        return new PrepareGeneratedEncounterBatchCommand(source(), List.of(
                intent(1, GeneratedEncounterRole.STANDARD, "1/2", 100L, 2),
                intent(2, GeneratedEncounterRole.SUPPORT, "1/2", 100L, 2),
                intent(3, GeneratedEncounterRole.BOSS, "2", 500L, 1)));
    }

    private static GeneratedEncounterIntent intent(
            int number, GeneratedEncounterRole role, String cr, long xp, int quantity
    ) {
        return new GeneratedEncounterIntent(
                number, "Encounter " + number, xp * quantity, GeneratedEncounterDifficulty.MEDIUM,
                List.of(new GeneratedEncounterBlock("block-" + number, role, cr, xp, quantity)));
    }

    private static GeneratedEncounterSource source() {
        return new GeneratedEncounterSource("engine-v1", "prep-1", "run-1");
    }

    private static CreatureEncounterCandidate candidate(
            long id, String name, String cr, int xp, int hp, int ac, int legendary
    ) {
        return new CreatureEncounterCandidate(
                id, name, "humanoid", cr, xp, hp, 1, 8, 0, ac, 0, legendary, 1);
    }

    private static final class RecordingCreatures implements CreaturesApi {
        private final List<CreatureEncounterCandidate> candidates;
        private final List<CreatureFactsQuery> queries = new ArrayList<>();
        private boolean throwOnLoad;

        private RecordingCreatures(List<CreatureEncounterCandidate> candidates) {
            this.candidates = candidates;
        }

        @Override
        public CompletionStage<CreatureFactsSnapshotResult> loadFacts(CreatureFactsQuery query) {
            queries.add(query);
            if (throwOnLoad) {
                throw new IllegalStateException("simulated synchronous facts failure");
            }
            return CompletableFuture.completedFuture(CreatureFactsSnapshotResult.success(candidates));
        }

        @Override public void refreshReferenceIndex(features.creatures.api.RefreshCreatureReferenceIndexCommand command) { }
        @Override public void selectCreatureDetail(features.creatures.api.SelectCreatureDetailCommand command) { }
        @Override public void refreshEncounterCandidates(
                features.creatures.api.RefreshCreatureEncounterCandidatesCommand command) { }
    }

    private static final class OutcomeRepository implements GeneratedEncounterBatchRepository {
        private final CommitOutcome outcome;
        private int commits;

        private OutcomeRepository(CommitOutcome outcome) {
            this.outcome = outcome;
        }

        @Override
        public CommitOutcome commit(PreparedEncounterBatch batch) {
            commits++;
            return outcome;
        }

        @Override
        public List<features.encounter.domain.plan.EncounterPlan> loadPlansByIds(List<Long> planIds) {
            return List.of();
        }
    }

    private static final class RecordingLane implements ExecutionLane {
        private final ArrayDeque<Runnable> tasks = new ArrayDeque<>();
        private boolean reject;
        private boolean running;

        @Override
        public void execute(Runnable work) {
            if (reject) {
                throw new IllegalStateException("lane rejected work");
            }
            tasks.addLast(work);
        }

        int pending() {
            return tasks.size();
        }

        void runNext() {
            Runnable task = tasks.removeFirst();
            running = true;
            try {
                task.run();
            } finally {
                running = false;
            }
        }

        @Override
        public void close() {
            tasks.clear();
        }
    }

    private static final class RecordingRepository implements GeneratedEncounterBatchRepository {
        private int commits;

        @Override
        public CommitOutcome commit(features.encounter.api.PreparedEncounterBatch batch) {
            commits++;
            throw new AssertionError("prepare must not write");
        }

        @Override
        public List<features.encounter.domain.plan.EncounterPlan> loadPlansByIds(List<Long> planIds) {
            return List.of();
        }
    }

    private static final class CountingParty {
        private int reads;

        ActivePartyCompositionModel model() {
            return new ActivePartyCompositionModel(() -> {
                reads++;
                return new ActivePartyCompositionResult(
                        ReadStatus.SUCCESS, new ActivePartyComposition(List.of(3, 3, 3, 3), 3));
            }, listener -> () -> { });
        }
    }
}
