package features.encounter.application;

import features.creatures.api.CreatureEncounterCandidate;
import features.creatures.api.CreatureFactsQuery;
import features.creatures.api.CreatureFactsSnapshotResult;
import features.creatures.api.CreaturesApi;
import features.encounter.api.CommitGeneratedEncounterBatchCommand;
import features.encounter.api.CommittedGeneratedEncounterBatchResult;
import features.encounter.api.CommittedGeneratedEncounterMapping;
import features.encounter.api.GeneratedEncounterBatchStatus;
import features.encounter.api.GeneratedEncounterBlock;
import features.encounter.api.GeneratedEncounterDifficulty;
import features.encounter.api.GeneratedEncounterIntent;
import features.encounter.api.GeneratedEncounterPlanSummary;
import features.encounter.api.GeneratedEncounterPlanSummaryBatchQuery;
import features.encounter.api.GeneratedEncounterPlanSummaryBatchResult;
import features.encounter.api.GeneratedEncounterPlanSummaryEntry;
import features.encounter.api.GeneratedEncounterRole;
import features.encounter.api.PrepareGeneratedEncounterBatchCommand;
import features.encounter.api.PreparedEncounterBatch;
import features.encounter.api.PreparedEncounterCreature;
import features.encounter.api.PreparedEncounterRoster;
import features.encounter.api.PreparedGeneratedEncounterBatchResult;
import features.encounter.domain.generation.EncounterCreatureFacts;
import features.encounter.domain.generation.EncounterDifficultyBandModel;
import features.encounter.domain.generation.EncounterDifficultyThresholds;
import features.encounter.domain.generation.EncounterRole;
import features.encounter.domain.generation.helper.EncounterDifficultyMathHelper;
import features.encounter.domain.generation.helper.EncounterDifficultyTargetHelper;
import features.encounter.domain.generation.helper.EncounterRoleClassificationHelper;
import features.encounter.domain.plan.EncounterPlan;
import features.encounter.domain.plan.EncounterPlanCreature;
import features.party.api.ActivePartyCompositionModel;
import features.party.api.ActivePartyCompositionResult;
import features.party.api.ReadStatus;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import platform.execution.ExecutionLane;
import platform.diagnostics.DiagnosticId;
import platform.diagnostics.Diagnostics;
import platform.diagnostics.Measurement;
import platform.diagnostics.NoopDiagnostics;

public final class GeneratedEncounterBatchService {

    private static final DiagnosticId SUMMARY_READ = new DiagnosticId("encounter.saved-plan-summary.read");

    private static final String INVALID_MESSAGE = "Generated encounter batch is invalid.";
    private static final String UNRESOLVABLE_MESSAGE = "Generated encounter batch cannot be resolved.";
    private static final String STORAGE_MESSAGE = "Generated encounter storage is unavailable.";
    private final CreaturesApi creatures;
    private final ActivePartyCompositionModel activeParty;
    private final GeneratedEncounterBatchRepository repository;
    private final ExecutionLane cpuLane;
    private final ExecutionLane ioLane;
    private final Diagnostics diagnostics;

    public GeneratedEncounterBatchService(
            CreaturesApi creatures,
            ActivePartyCompositionModel activeParty,
            GeneratedEncounterBatchRepository repository,
            ExecutionLane cpuLane,
            ExecutionLane ioLane
    ) {
        this(creatures, activeParty, repository, cpuLane, ioLane, NoopDiagnostics.INSTANCE);
    }

    public GeneratedEncounterBatchService(
            CreaturesApi creatures,
            ActivePartyCompositionModel activeParty,
            GeneratedEncounterBatchRepository repository,
            ExecutionLane cpuLane,
            ExecutionLane ioLane,
            Diagnostics diagnostics
    ) {
        this.creatures = java.util.Objects.requireNonNull(creatures, "creatures");
        this.activeParty = java.util.Objects.requireNonNull(activeParty, "activeParty");
        this.repository = java.util.Objects.requireNonNull(repository, "repository");
        this.cpuLane = java.util.Objects.requireNonNull(cpuLane, "cpuLane");
        this.ioLane = java.util.Objects.requireNonNull(ioLane, "ioLane");
        this.diagnostics = java.util.Objects.requireNonNull(diagnostics, "diagnostics");
    }

    public CompletionStage<PreparedGeneratedEncounterBatchResult> prepare(
            PrepareGeneratedEncounterBatchCommand command
    ) {
        if (!valid(command)) {
            return CompletableFuture.completedFuture(PreparedGeneratedEncounterBatchResult.failure(
                    GeneratedEncounterBatchStatus.INVALID_REQUEST, INVALID_MESSAGE));
        }
        ActivePartyCompositionResult capturedParty = activeParty.current();
        if (!validParty(capturedParty)) {
            return CompletableFuture.completedFuture(PreparedGeneratedEncounterBatchResult.failure(
                    GeneratedEncounterBatchStatus.UNRESOLVABLE, UNRESOLVABLE_MESSAGE));
        }
        List<Integer> partyLevels = capturedParty.composition().activePartyLevels();
        List<Long> xpUnion = command.intents().stream()
                .flatMap(intent -> intent.blocks().stream())
                .map(GeneratedEncounterBlock::xp)
                .distinct()
                .sorted()
                .toList();
        CompletableFuture<PreparedGeneratedEncounterBatchResult> completion = new CompletableFuture<>();
        try {
            creatures.loadFacts(CreatureFactsQuery.forXpValues(xpUnion)).whenComplete((facts, failure) -> {
                if (failure != null || facts == null
                        || facts.status() == CreatureFactsSnapshotResult.Status.STORAGE_FAILURE) {
                    completion.complete(PreparedGeneratedEncounterBatchResult.failure(
                            GeneratedEncounterBatchStatus.STORAGE_FAILURE, STORAGE_MESSAGE));
                    return;
                }
                if (facts.status() != CreatureFactsSnapshotResult.Status.SUCCESS) {
                    completion.complete(PreparedGeneratedEncounterBatchResult.failure(
                            GeneratedEncounterBatchStatus.INVALID_REQUEST, INVALID_MESSAGE));
                    return;
                }
                try {
                    cpuLane.execute(() -> completion.complete(resolve(command, partyLevels, facts.creatures())));
                } catch (RuntimeException exception) {
                    completion.complete(PreparedGeneratedEncounterBatchResult.failure(
                            GeneratedEncounterBatchStatus.STORAGE_FAILURE, STORAGE_MESSAGE));
                }
            });
        } catch (RuntimeException exception) {
            completion.complete(PreparedGeneratedEncounterBatchResult.failure(
                    GeneratedEncounterBatchStatus.STORAGE_FAILURE, STORAGE_MESSAGE));
        }
        return completion;
    }

    public CompletionStage<CommittedGeneratedEncounterBatchResult> commit(
            CommitGeneratedEncounterBatchCommand command
    ) {
        if (command == null || !validPrepared(command.batch())) {
            return CompletableFuture.completedFuture(CommittedGeneratedEncounterBatchResult.failure(
                    GeneratedEncounterBatchStatus.INVALID_REQUEST, INVALID_MESSAGE));
        }
        CompletableFuture<CommittedGeneratedEncounterBatchResult> completion = new CompletableFuture<>();
        try {
            ioLane.execute(() -> completeCommit(completion, command.batch()));
        } catch (RuntimeException exception) {
            completion.complete(CommittedGeneratedEncounterBatchResult.failure(
                    GeneratedEncounterBatchStatus.STORAGE_FAILURE, STORAGE_MESSAGE));
        }
        return completion;
    }

    public CompletionStage<GeneratedEncounterPlanSummaryBatchResult> loadSummaries(
            GeneratedEncounterPlanSummaryBatchQuery query
    ) {
        if (query == null) {
            return CompletableFuture.completedFuture(GeneratedEncounterPlanSummaryBatchResult.failure(
                    GeneratedEncounterBatchStatus.INVALID_REQUEST, INVALID_MESSAGE));
        }
        ActivePartyCompositionResult capturedParty = activeParty.current();
        if (!validParty(capturedParty)) {
            return CompletableFuture.completedFuture(unresolvableEntries(query.planIds()));
        }
        CompletableFuture<GeneratedEncounterPlanSummaryBatchResult> completion = new CompletableFuture<>();
        try {
            ioLane.execute(() -> loadPlanRows(completion, query, capturedParty.composition().activePartyLevels()));
        } catch (RuntimeException exception) {
            completion.complete(GeneratedEncounterPlanSummaryBatchResult.failure(
                    GeneratedEncounterBatchStatus.STORAGE_FAILURE, STORAGE_MESSAGE));
        }
        return completion;
    }

    private void loadPlanRows(
            CompletableFuture<GeneratedEncounterPlanSummaryBatchResult> completion,
            GeneratedEncounterPlanSummaryBatchQuery query,
            List<Integer> partyLevels
    ) {
        final List<EncounterPlan> plans;
        long startedNanos = System.nanoTime();
        try {
            GeneratedEncounterBatchRepository.PlanRead read = repository.loadPlansByIdsWithCount(query.planIds());
            plans = read.plans();
            diagnostics.measurement(new Measurement(
                    SUMMARY_READ, 0L, Math.max(0L, System.nanoTime() - startedNanos),
                    plans.size(), read.statementCount()));
        } catch (RuntimeException exception) {
            completion.complete(GeneratedEncounterPlanSummaryBatchResult.failure(
                    GeneratedEncounterBatchStatus.STORAGE_FAILURE, STORAGE_MESSAGE));
            return;
        }
        if (plans == null) {
            completeSummaryStorageFailure(completion);
            return;
        }
        Map<Long, EncounterPlan> plansById = new HashMap<>();
        Set<Long> creatureIds = new LinkedHashSet<>();
        try {
            for (EncounterPlan plan : plans) {
                if (plan == null) {
                    completeSummaryStorageFailure(completion);
                    return;
                }
                plansById.put(Long.valueOf(plan.id()), plan);
                plan.creatures().forEach(creature -> creatureIds.add(Long.valueOf(creature.creatureId())));
            }
        } catch (RuntimeException exception) {
            completeSummaryStorageFailure(completion);
            return;
        }
        if (creatureIds.isEmpty()) {
            dispatchSummaryProjection(completion, query.planIds(), plansById, Map.of(), partyLevels);
            return;
        }
        final CompletionStage<CreatureFactsSnapshotResult> factsStage;
        try {
            factsStage = creatures.loadFacts(CreatureFactsQuery.forCreatureIds(List.copyOf(creatureIds)));
            if (factsStage == null) {
                completeSummaryStorageFailure(completion);
                return;
            }
        } catch (RuntimeException exception) {
            completeSummaryStorageFailure(completion);
            return;
        }
        try {
            factsStage.whenComplete((facts, failure) -> {
                if (failure != null || facts == null
                        || facts.status() != CreatureFactsSnapshotResult.Status.SUCCESS) {
                    completeSummaryStorageFailure(completion);
                    return;
                }
                try {
                    Map<Long, CreatureEncounterCandidate> factsById = new HashMap<>();
                    facts.creatures().forEach(fact -> factsById.put(Long.valueOf(fact.id()), fact));
                    dispatchSummaryProjection(completion, query.planIds(), plansById, factsById, partyLevels);
                } catch (RuntimeException exception) {
                    completeSummaryStorageFailure(completion);
                }
            });
        } catch (RuntimeException exception) {
            completeSummaryStorageFailure(completion);
        }
    }

    private void dispatchSummaryProjection(
            CompletableFuture<GeneratedEncounterPlanSummaryBatchResult> completion,
            List<Long> requestedIds,
            Map<Long, EncounterPlan> plans,
            Map<Long, CreatureEncounterCandidate> facts,
            List<Integer> partyLevels
    ) {
        try {
            cpuLane.execute(() -> {
                try {
                    completion.complete(summaryEntries(requestedIds, plans, facts, partyLevels));
                } catch (RuntimeException exception) {
                    completeSummaryStorageFailure(completion);
                }
            });
        } catch (RuntimeException exception) {
            completeSummaryStorageFailure(completion);
        }
    }

    private static void completeSummaryStorageFailure(
            CompletableFuture<GeneratedEncounterPlanSummaryBatchResult> completion
    ) {
        completion.complete(GeneratedEncounterPlanSummaryBatchResult.failure(
                GeneratedEncounterBatchStatus.STORAGE_FAILURE, STORAGE_MESSAGE));
    }

    private void completeCommit(
            CompletableFuture<CommittedGeneratedEncounterBatchResult> completion,
            PreparedEncounterBatch batch
    ) {
        try {
            GeneratedEncounterBatchRepository.CommitOutcome outcome = repository.commit(batch);
            if (outcome.status() == GeneratedEncounterBatchRepository.CommitOutcome.Status.CONFLICT) {
                completion.complete(CommittedGeneratedEncounterBatchResult.failure(
                        GeneratedEncounterBatchStatus.CONFLICT, "Generated encounter batch conflicts with stored truth."));
                return;
            }
            if (!validMappings(batch, outcome.mappings())) {
                completion.complete(CommittedGeneratedEncounterBatchResult.failure(
                        GeneratedEncounterBatchStatus.STORAGE_FAILURE, STORAGE_MESSAGE));
                return;
            }
            Map<Integer, PreparedEncounterRoster> rosters = new HashMap<>();
            batch.rosters().forEach(roster -> rosters.put(Integer.valueOf(roster.encounterNumber()), roster));
            List<CommittedGeneratedEncounterMapping> mappings = outcome.mappings().stream()
                    .map(mapping -> committed(mapping, rosters.get(Integer.valueOf(mapping.encounterNumber()))))
                    .toList();
            completion.complete(CommittedGeneratedEncounterBatchResult.success(mappings));
        } catch (RuntimeException exception) {
            completion.complete(CommittedGeneratedEncounterBatchResult.failure(
                    GeneratedEncounterBatchStatus.STORAGE_FAILURE, STORAGE_MESSAGE));
        }
    }

    private static CommittedGeneratedEncounterMapping committed(
            GeneratedEncounterBatchRepository.Mapping mapping,
            PreparedEncounterRoster roster
    ) {
        if (roster == null) {
            throw new IllegalStateException("repository returned an unknown encounter mapping");
        }
        GeneratedEncounterPlanSummary source = roster.summary();
        GeneratedEncounterPlanSummary summary = new GeneratedEncounterPlanSummary(
                mapping.planId(), source.label(), source.roster(), source.creatureCount(), source.baseXp(),
                source.adjustedXp(), source.difficulty(), source.displaySummary());
        return new CommittedGeneratedEncounterMapping(mapping.encounterNumber(), mapping.planId(), summary);
    }

    private static PreparedGeneratedEncounterBatchResult resolve(
            PrepareGeneratedEncounterBatchCommand command,
            List<Integer> partyLevels,
            List<CreatureEncounterCandidate> candidates
    ) {
        try {
            Map<Long, List<RankedCandidate>> byXp = candidatesByXp(candidates);
            Map<Long, Integer> batchUsage = new HashMap<>();
            Set<String> rosterFingerprints = new HashSet<>();
            List<PreparedEncounterRoster> rosters = new ArrayList<>();
            for (GeneratedEncounterIntent intent : command.intents()) {
                PreparedEncounterRoster roster = resolveRoster(
                        command, intent, partyLevels, byXp, batchUsage, rosterFingerprints);
                if (roster == null) {
                    return PreparedGeneratedEncounterBatchResult.failure(
                            GeneratedEncounterBatchStatus.UNRESOLVABLE, UNRESOLVABLE_MESSAGE);
                }
                rosters.add(roster);
                roster.creatures().forEach(creature -> batchUsage.merge(
                        Long.valueOf(creature.creatureId()), Integer.valueOf(creature.quantity()), Integer::sum));
                rosterFingerprints.add(roster.rosterFingerprint());
            }
            String batchFingerprint = fingerprint(batchFingerprintText(command, rosters));
            return PreparedGeneratedEncounterBatchResult.success(new PreparedEncounterBatch(
                    command.source(), batchFingerprint, rosters));
        } catch (ArithmeticException | IllegalArgumentException exception) {
            return PreparedGeneratedEncounterBatchResult.failure(
                    GeneratedEncounterBatchStatus.INVALID_REQUEST, INVALID_MESSAGE);
        }
    }

    private static PreparedEncounterRoster resolveRoster(
            PrepareGeneratedEncounterBatchCommand command,
            GeneratedEncounterIntent intent,
            List<Integer> partyLevels,
            Map<Long, List<RankedCandidate>> candidatesByXp,
            Map<Long, Integer> batchUsage,
            Set<String> previousRosters
    ) {
        List<BlockSelection> selections = new ArrayList<>();
        Map<Long, Integer> rosterUsage = new HashMap<>();
        for (GeneratedEncounterBlock block : intent.blocks()) {
            List<RankedCandidate> candidates = candidatesByXp.getOrDefault(Long.valueOf(block.xp()), List.of())
                    .stream()
                    .filter(candidate -> block.challengeRating().equals(candidate.fact().challengeRating()))
                    .sorted(candidateComparator(command, intent, block, batchUsage, rosterUsage))
                    .toList();
            if (candidates.isEmpty()) {
                return null;
            }
            RankedCandidate selected = candidates.getFirst();
            selections.add(new BlockSelection(block, candidates, 0));
            rosterUsage.merge(Long.valueOf(selected.fact().id()), Integer.valueOf(block.quantity()), Integer::sum);
        }
        selections = diversify(selections, previousRosters);
        List<PreparedEncounterCreature> roster = aggregate(selections);
        String rosterFingerprint = rosterFingerprint(roster);
        String intentFingerprint = intentFingerprint(intent);
        GeneratedEncounterPlanSummary summary = summarize(0L, intent.displayLabel(), roster, candidatesByXp, partyLevels);
        return new PreparedEncounterRoster(
                intent.encounterNumber(), intent.displayLabel(), intentFingerprint, rosterFingerprint, roster, summary);
    }

    private static List<BlockSelection> diversify(
            List<BlockSelection> original,
            Set<String> previousRosters
    ) {
        if (!previousRosters.contains(rosterFingerprint(aggregate(original)))) {
            return original;
        }
        List<BlockSelection> best = null;
        int bestRank = Integer.MAX_VALUE;
        for (int blockIndex = 0; blockIndex < original.size(); blockIndex++) {
            BlockSelection selection = original.get(blockIndex);
            for (int rank = 1; rank < selection.candidates().size(); rank++) {
                List<BlockSelection> changed = new ArrayList<>(original);
                changed.set(blockIndex, new BlockSelection(selection.block(), selection.candidates(), rank));
                if (!previousRosters.contains(rosterFingerprint(aggregate(changed))) && rank < bestRank) {
                    best = changed;
                    bestRank = rank;
                }
            }
        }
        return best == null ? original : List.copyOf(best);
    }

    private static Comparator<RankedCandidate> candidateComparator(
            PrepareGeneratedEncounterBatchCommand command,
            GeneratedEncounterIntent intent,
            GeneratedEncounterBlock block,
            Map<Long, Integer> batchUsage,
            Map<Long, Integer> rosterUsage
    ) {
        return Comparator.comparingInt((RankedCandidate candidate) -> roleRank(block.requestedRole(), candidate.role()))
                .thenComparingInt(candidate -> batchUsage.getOrDefault(Long.valueOf(candidate.fact().id()), 0))
                .thenComparingInt(candidate -> rosterUsage.getOrDefault(Long.valueOf(candidate.fact().id()), 0))
                .thenComparing(candidate -> tieBreak(command, intent, block, candidate.fact().id()))
                .thenComparingLong(candidate -> candidate.fact().id());
    }

    private static int roleRank(GeneratedEncounterRole requested, EncounterRole actual) {
        EncounterRole preferred = switch (requested) {
            case MINION -> EncounterRole.MINION;
            case STANDARD, SUPPORT -> EncounterRole.STANDARD;
            case ELITE -> EncounterRole.ELITE;
            case BOSS -> EncounterRole.BOSS;
        };
        if (actual == preferred) {
            return 0;
        }
        return switch (actual) {
            case STANDARD -> 1;
            case MINION -> 2;
            case ELITE -> 3;
            case BOSS -> 4;
            case BRUTE -> 5;
            case SKIRMISHER -> 6;
        };
    }

    private static String tieBreak(
            PrepareGeneratedEncounterBatchCommand command,
            GeneratedEncounterIntent intent,
            GeneratedEncounterBlock block,
            long candidateId
    ) {
        var source = command.source();
        return fingerprint(source.engineVersion() + '|' + source.preparationIdentity() + '|'
                + source.generationRunIdentity() + '|' + intent.encounterNumber() + '|'
                + block.blockId() + '|' + candidateId);
    }

    private static Map<Long, List<RankedCandidate>> candidatesByXp(List<CreatureEncounterCandidate> facts) {
        Map<Long, List<RankedCandidate>> result = new LinkedHashMap<>();
        for (CreatureEncounterCandidate fact : facts) {
            if (fact == null || fact.id() <= 0L || fact.xp() <= 0 || fact.name().isBlank()
                    || fact.challengeRating().isBlank()) {
                continue;
            }
            EncounterCreatureFacts domainFacts = new EncounterCreatureFacts(
                    fact.id(), fact.name(), fact.creatureType(), fact.challengeRating(), fact.xp(), fact.hitPoints(),
                    fact.hitDiceCount(), fact.hitDiceSides(), fact.hitDiceModifier(), fact.armorClass(),
                    fact.initiativeBonus(), fact.legendaryActionCount(), 0, 0, 0, 0,
                    null, null, null, 0, List.of());
            EncounterRole role = EncounterRoleClassificationHelper.classify(domainFacts).role();
            result.computeIfAbsent(Long.valueOf(fact.xp()), ignored -> new ArrayList<>())
                    .add(new RankedCandidate(fact, role));
        }
        return result;
    }

    private static List<PreparedEncounterCreature> aggregate(List<BlockSelection> selections) {
        Map<Long, PreparedEncounterCreature> creatures = new LinkedHashMap<>();
        for (BlockSelection selection : selections) {
            CreatureEncounterCandidate fact = selection.selected().fact();
            PreparedEncounterCreature existing = creatures.get(Long.valueOf(fact.id()));
            int quantity = selection.block().quantity();
            if (existing == null) {
                creatures.put(Long.valueOf(fact.id()), new PreparedEncounterCreature(fact.id(), quantity, fact.name()));
            } else {
                creatures.put(Long.valueOf(fact.id()), new PreparedEncounterCreature(
                        fact.id(), Math.addExact(existing.quantity(), quantity), existing.displayName()));
            }
        }
        return List.copyOf(creatures.values());
    }

    private static GeneratedEncounterPlanSummary summarize(
            long planId,
            String label,
            List<PreparedEncounterCreature> roster,
            Map<Long, List<RankedCandidate>> candidatesByXp,
            List<Integer> partyLevels
    ) {
        Map<Long, CreatureEncounterCandidate> facts = new HashMap<>();
        candidatesByXp.values().stream().flatMap(List::stream)
                .forEach(candidate -> facts.put(Long.valueOf(candidate.fact().id()), candidate.fact()));
        long baseXp = 0L;
        int count = 0;
        for (PreparedEncounterCreature creature : roster) {
            CreatureEncounterCandidate fact = facts.get(Long.valueOf(creature.creatureId()));
            if (fact == null) {
                throw new IllegalArgumentException("missing creature facts");
            }
            baseXp = Math.addExact(baseXp, Math.multiplyExact((long) fact.xp(), creature.quantity()));
            count = Math.addExact(count, creature.quantity());
        }
        long adjustedXp = Math.round(baseXp * EncounterDifficultyTargetHelper.multiplierFor(count, partyLevels.size()));
        if (adjustedXp <= 0L) {
            throw new IllegalArgumentException("adjusted XP is invalid");
        }
        GeneratedEncounterDifficulty difficulty = difficulty(adjustedXp, partyLevels);
        String rosterText = roster.stream()
                .map(creature -> creature.quantity() + "x " + creature.displayName())
                .collect(java.util.stream.Collectors.joining(", "));
        return new GeneratedEncounterPlanSummary(
                planId, label, roster, count, baseXp, adjustedXp, difficulty, rosterText);
    }

    private static GeneratedEncounterDifficulty difficulty(long adjustedXp, List<Integer> partyLevels) {
        if (adjustedXp > Integer.MAX_VALUE) {
            return GeneratedEncounterDifficulty.DEADLY;
        }
        EncounterDifficultyThresholds thresholds = EncounterDifficultyMathHelper.thresholdsFor(partyLevels);
        return switch (EncounterDifficultyBandModel.bandFor((int) adjustedXp, thresholds)) {
            case EASY -> GeneratedEncounterDifficulty.EASY;
            case MEDIUM -> GeneratedEncounterDifficulty.MEDIUM;
            case HARD -> GeneratedEncounterDifficulty.HARD;
            case DEADLY -> GeneratedEncounterDifficulty.DEADLY;
            default -> GeneratedEncounterDifficulty.EASY;
        };
    }

    private static GeneratedEncounterPlanSummaryBatchResult summaryEntries(
            List<Long> requestedIds,
            Map<Long, EncounterPlan> plans,
            Map<Long, CreatureEncounterCandidate> facts,
            List<Integer> partyLevels
    ) {
        List<GeneratedEncounterPlanSummaryEntry> entries = new ArrayList<>();
        for (Long requestedId : requestedIds) {
            EncounterPlan plan = plans.get(requestedId);
            if (plan == null) {
                entries.add(new GeneratedEncounterPlanSummaryEntry(
                        requestedId.longValue(), GeneratedEncounterPlanSummaryEntry.Status.MISSING,
                        java.util.Optional.empty()));
                continue;
            }
            GeneratedEncounterPlanSummary summary = summaryFromPlan(plan, facts, partyLevels);
            entries.add(summary == null
                    ? new GeneratedEncounterPlanSummaryEntry(
                            requestedId.longValue(), GeneratedEncounterPlanSummaryEntry.Status.UNRESOLVABLE,
                            java.util.Optional.empty())
                    : new GeneratedEncounterPlanSummaryEntry(
                            requestedId.longValue(), GeneratedEncounterPlanSummaryEntry.Status.FOUND,
                            java.util.Optional.of(summary)));
        }
        return GeneratedEncounterPlanSummaryBatchResult.success(entries);
    }

    private static GeneratedEncounterPlanSummary summaryFromPlan(
            EncounterPlan plan,
            Map<Long, CreatureEncounterCandidate> facts,
            List<Integer> partyLevels
    ) {
        List<PreparedEncounterCreature> roster = new ArrayList<>();
        Map<Long, List<RankedCandidate>> candidatesByXp = new HashMap<>();
        for (EncounterPlanCreature creature : plan.creatures()) {
            CreatureEncounterCandidate fact = facts.get(Long.valueOf(creature.creatureId()));
            if (fact == null) {
                return null;
            }
            String displayName = fact.name().isBlank()
                    ? creature.lastKnownDisplayName()
                    : fact.name();
            if (displayName.isBlank()) {
                return null;
            }
            roster.add(new PreparedEncounterCreature(creature.creatureId(), creature.quantity(), displayName));
            candidatesByXp.computeIfAbsent(Long.valueOf(fact.xp()), ignored -> new ArrayList<>())
                    .add(new RankedCandidate(fact, EncounterRole.STANDARD));
        }
        try {
            return summarize(plan.id(), plan.name(), roster, candidatesByXp, partyLevels);
        } catch (ArithmeticException | IllegalArgumentException exception) {
            return null;
        }
    }

    private static GeneratedEncounterPlanSummaryBatchResult unresolvableEntries(List<Long> ids) {
        return GeneratedEncounterPlanSummaryBatchResult.success(ids.stream()
                .map(id -> new GeneratedEncounterPlanSummaryEntry(
                        id.longValue(), GeneratedEncounterPlanSummaryEntry.Status.UNRESOLVABLE,
                        java.util.Optional.empty()))
                .toList());
    }

    private static boolean valid(PrepareGeneratedEncounterBatchCommand command) {
        if (command == null || command.source() == null || command.intents().isEmpty()) {
            return false;
        }
        Set<Integer> encounterNumbers = new HashSet<>();
        Set<String> blockIds = new HashSet<>();
        try {
            for (GeneratedEncounterIntent intent : command.intents()) {
                if (intent == null || !encounterNumbers.add(Integer.valueOf(intent.encounterNumber()))
                        || intent.displayLabel().isBlank() || intent.targetXp() <= 0L || intent.blocks().isEmpty()) {
                    return false;
                }
                for (GeneratedEncounterBlock block : intent.blocks()) {
                    if (block == null || block.xp() <= 0L || block.quantity() <= 0
                            || !blockIds.add(intent.encounterNumber() + "|" + block.blockId())) {
                        return false;
                    }
                    Math.multiplyExact(block.xp(), block.quantity());
                }
            }
            return true;
        } catch (ArithmeticException exception) {
            return false;
        }
    }

    private static boolean validParty(ActivePartyCompositionResult result) {
        return result != null && result.status() == ReadStatus.SUCCESS && result.composition() != null
                && !result.composition().activePartyLevels().isEmpty()
                && result.composition().activePartyLevels().stream()
                        .allMatch(level -> level != null && level.intValue() >= 1 && level.intValue() <= 20);
    }

    private static boolean validPrepared(PreparedEncounterBatch batch) {
        if (batch == null || batch.rosters().isEmpty()) {
            return false;
        }
        Set<Integer> numbers = new LinkedHashSet<>();
        try {
            for (PreparedEncounterRoster roster : batch.rosters()) {
                if (roster == null || !numbers.add(Integer.valueOf(roster.encounterNumber()))
                        || roster.creatures().isEmpty()) {
                    return false;
                }
                Set<Long> creatureIds = new HashSet<>();
                int creatureCount = 0;
                for (PreparedEncounterCreature creature : roster.creatures()) {
                    if (creature == null || creature.creatureId() <= 0L || creature.quantity() <= 0
                            || creature.displayName().isBlank()
                            || !creatureIds.add(Long.valueOf(creature.creatureId()))) {
                        return false;
                    }
                    creatureCount = Math.addExact(creatureCount, creature.quantity());
                }
                GeneratedEncounterPlanSummary summary = roster.summary();
                if (summary.planId() != 0L
                        || !summary.label().equals(roster.displayLabel())
                        || !summary.roster().equals(roster.creatures())
                        || creatureCount <= 0
                        || summary.creatureCount() != creatureCount
                        || !roster.rosterFingerprint().equals(rosterFingerprint(roster.creatures()))) {
                    return false;
                }
            }
        } catch (ArithmeticException exception) {
            return false;
        }
        return batch.batchFingerprint().equals(fingerprint(batchFingerprintText(batch)));
    }

    private static boolean validMappings(
            PreparedEncounterBatch batch,
            List<GeneratedEncounterBatchRepository.Mapping> mappings
    ) {
        if (mappings == null || mappings.size() != batch.rosters().size()) {
            return false;
        }
        Set<Integer> encounterNumbers = new HashSet<>();
        Set<Long> planIds = new HashSet<>();
        for (int index = 0; index < batch.rosters().size(); index++) {
            GeneratedEncounterBatchRepository.Mapping mapping = mappings.get(index);
            PreparedEncounterRoster roster = batch.rosters().get(index);
            if (mapping == null || mapping.encounterNumber() != roster.encounterNumber()
                    || mapping.planId() <= 0L
                    || !encounterNumbers.add(Integer.valueOf(mapping.encounterNumber()))
                    || !planIds.add(Long.valueOf(mapping.planId()))) {
                return false;
            }
        }
        return true;
    }

    private static String intentFingerprint(GeneratedEncounterIntent intent) {
        StringBuilder value = new StringBuilder().append(intent.encounterNumber()).append('|')
                .append(intent.displayLabel()).append('|').append(intent.targetXp()).append('|')
                .append(intent.difficulty().name());
        intent.blocks().forEach(block -> value.append('|').append(block.blockId()).append(':')
                .append(block.requestedRole()).append(':').append(block.challengeRating()).append(':')
                .append(block.xp()).append(':').append(block.quantity()));
        return fingerprint(value.toString());
    }

    private static String rosterFingerprint(List<PreparedEncounterCreature> roster) {
        StringBuilder value = new StringBuilder();
        roster.forEach(creature -> value.append('|').append(creature.creatureId()).append(':')
                .append(creature.quantity()));
        return fingerprint(value.toString());
    }

    private static String batchFingerprintText(
            PrepareGeneratedEncounterBatchCommand command,
            List<PreparedEncounterRoster> rosters
    ) {
        StringBuilder value = new StringBuilder().append(command.source().engineVersion()).append('|')
                .append(command.source().preparationIdentity()).append('|')
                .append(command.source().generationRunIdentity()).append('|').append(rosters.size());
        rosters.forEach(roster -> value.append('|').append(roster.encounterNumber()).append(':')
                .append(roster.intentFingerprint()).append(':').append(roster.rosterFingerprint()));
        return value.toString();
    }

    private static String batchFingerprintText(PreparedEncounterBatch batch) {
        StringBuilder value = new StringBuilder().append(batch.source().engineVersion()).append('|')
                .append(batch.source().preparationIdentity()).append('|')
                .append(batch.source().generationRunIdentity()).append('|').append(batch.rosters().size());
        batch.rosters().forEach(roster -> value.append('|').append(roster.encounterNumber()).append(':')
                .append(roster.intentFingerprint()).append(':').append(roster.rosterFingerprint()));
        return value.toString();
    }

    private static String fingerprint(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is unavailable", exception);
        }
    }

    private record RankedCandidate(CreatureEncounterCandidate fact, EncounterRole role) {
    }

    private record BlockSelection(
            GeneratedEncounterBlock block,
            List<RankedCandidate> candidates,
            int selectedIndex
    ) {
        RankedCandidate selected() {
            return candidates.get(selectedIndex);
        }
    }
}
