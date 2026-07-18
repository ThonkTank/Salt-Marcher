package features.sessiongeneration.application;

import features.sessiongeneration.api.CommitGenerationRunCommand;
import features.sessiongeneration.api.GenerationDraft;
import features.sessiongeneration.api.GenerationDraftResponse;
import features.sessiongeneration.api.GenerationRequest;
import features.sessiongeneration.api.GenerationResponse;
import features.sessiongeneration.api.GenerationRewardBatchQuery;
import features.sessiongeneration.api.GenerationRewardBatchResponse;
import features.sessiongeneration.api.GenerationRewardReference;
import features.sessiongeneration.api.GenerationRunId;
import features.sessiongeneration.api.GenerationRunResponse;
import features.sessiongeneration.api.GenerationStatus;
import features.sessiongeneration.api.SessionGenerationApi;
import features.sessiongeneration.domain.catalog.GenerationCatalog;
import features.sessiongeneration.domain.catalog.GenerationCatalog.CatalogSnapshot;
import features.sessiongeneration.domain.generation.GeneratedRun;
import features.sessiongeneration.domain.generation.GeneratedRunDraft;
import features.sessiongeneration.domain.generation.GeneratedRunValidator;
import features.sessiongeneration.domain.generation.GenerationInput;
import features.sessiongeneration.domain.generation.GenerationRewardBatch;
import features.sessiongeneration.domain.generation.GenerationRunCommitResult;
import features.sessiongeneration.domain.generation.GenerationRunIdentityConflictException;
import features.sessiongeneration.domain.generation.GenerationRunRepository;
import features.sessiongeneration.domain.generation.SessionGenerationEngine;
import java.util.List;
import java.util.Objects;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.function.Supplier;
import platform.execution.ExecutionLane;

public final class SessionGenerationService implements SessionGenerationApi {

    private final GenerationCatalog catalog;
    private final GenerationRunRepository repository;
    private final SessionGenerationEngine engine;
    private final ExecutionLane cpuLane;
    private final ExecutionLane ioLane;
    private final GeneratedRunValidator validator = new GeneratedRunValidator();

    public SessionGenerationService(
            GenerationCatalog catalog,
            GenerationRunRepository repository,
            SessionGenerationEngine engine,
            ExecutionLane cpuLane,
            ExecutionLane ioLane
    ) {
        this.catalog = Objects.requireNonNull(catalog, "catalog");
        this.repository = Objects.requireNonNull(repository, "repository");
        this.engine = Objects.requireNonNull(engine, "engine");
        this.cpuLane = Objects.requireNonNull(cpuLane, "cpuLane");
        this.ioLane = Objects.requireNonNull(ioLane, "ioLane");
    }

    @Override
    public CompletionStage<GenerationDraftResponse> draft(GenerationRequest request) {
        CompletableFuture<GenerationDraftResponse> response = new CompletableFuture<>();
        if (request == null) {
            response.complete(GenerationDraftResponse.failure(
                    GenerationStatus.INVALID_REQUEST, "Generation request is required."));
            return response;
        }
        schedule(ioLane, response, () -> {
            CatalogSnapshot snapshot;
            try {
                snapshot = catalog.load();
            } catch (IllegalArgumentException | IllegalStateException exception) {
                response.complete(GenerationDraftResponse.failure(
                        GenerationStatus.CATALOG_FAILURE, "Generation catalog is unavailable or invalid."));
                return;
            }
            schedule(cpuLane, response, () -> response.complete(draftNow(request, snapshot)),
                    () -> GenerationDraftResponse.failure(
                            GenerationStatus.GENERATION_FAILURE, "Generation execution is unavailable."));
        }, () -> GenerationDraftResponse.failure(
                GenerationStatus.CATALOG_FAILURE, "Generation catalog execution is unavailable."));
        return response;
    }

    @Override
    public CompletionStage<GenerationRunResponse> commit(CommitGenerationRunCommand command) {
        CompletableFuture<GenerationRunResponse> response = new CompletableFuture<>();
        if (command == null) {
            response.complete(GenerationRunResponse.failure(
                    GenerationStatus.INVALID_REQUEST, "Generation draft is required."));
            return response;
        }
        executeIo(response, () -> commitNow(command), () -> GenerationRunResponse.failure(
                GenerationStatus.STORAGE_FAILURE, "Generation run could not be persisted."));
        return response;
    }

    @Override
    public CompletionStage<GenerationRunResponse> loadRun(GenerationRunId runId) {
        CompletableFuture<GenerationRunResponse> response = new CompletableFuture<>();
        if (runId == null) {
            response.complete(GenerationRunResponse.failure(
                    GenerationStatus.INVALID_REQUEST, "Generation run id is required."));
            return response;
        }
        executeIo(response, () -> loadNow(runId), () -> GenerationRunResponse.failure(
                GenerationStatus.STORAGE_FAILURE, "Generation run could not be loaded."));
        return response;
    }

    @Override
    public CompletionStage<GenerationRewardBatchResponse> loadRewards(GenerationRewardBatchQuery query) {
        CompletableFuture<GenerationRewardBatchResponse> response = new CompletableFuture<>();
        if (query == null) {
            response.complete(GenerationRewardBatchResponse.failure(
                    GenerationStatus.INVALID_REQUEST, "Generation reward query is required."));
            return response;
        }
        executeIo(response, () -> loadRewardsNow(query), () -> GenerationRewardBatchResponse.failure(
                GenerationStatus.STORAGE_FAILURE, "Generation rewards could not be loaded."));
        return response;
    }

    @Deprecated(forRemoval = true)
    @Override
    public CompletionStage<GenerationResponse> generate(GenerationRequest request) {
        return draft(request).thenCompose(draftResponse -> {
            if (draftResponse.status() != GenerationStatus.SUCCESS || draftResponse.draft().isEmpty()) {
                return CompletableFuture.completedFuture(GenerationResponse.failure(
                        draftResponse.status(), draftResponse.message()));
            }
            GenerationDraft draft = draftResponse.draft().orElseThrow();
            return commit(new CommitGenerationRunCommand(draft)).thenApply(commitResponse ->
                    commitResponse.status() == GenerationStatus.SUCCESS
                            ? GenerationResponse.success(draft.result())
                            : GenerationResponse.failure(commitResponse.status(), commitResponse.message()));
        });
    }

    @Deprecated(forRemoval = true)
    @Override
    public CompletionStage<GenerationResponse> load(GenerationRunId runId) {
        return loadRun(runId).thenApply(response -> response.status() == GenerationStatus.SUCCESS
                ? GenerationResponse.success(response.result().orElseThrow())
                : GenerationResponse.failure(response.status(), response.message()));
    }

    private GenerationDraftResponse draftNow(GenerationRequest request, CatalogSnapshot snapshot) {
        GenerationInput input;
        try {
            input = new GenerationInput(
                    request.party().stream()
                            .map(level -> new GeneratedRun.PartyLevel(level.level(), level.players()))
                            .toList(),
                    request.adventureDayFraction(), request.encounterCount(), request.seed());
        } catch (IllegalArgumentException exception) {
            return GenerationDraftResponse.failure(GenerationStatus.INVALID_REQUEST, "Generation input is invalid.");
        }
        GeneratedRun generated;
        try {
            generated = engine.generate(input, snapshot);
            generated = withRunId(generated, GenerationRunIdentity.assign(request.preparationIdentity(), generated));
        } catch (IllegalArgumentException | IllegalStateException exception) {
            return GenerationDraftResponse.failure(
                    GenerationStatus.GENERATION_FAILURE, "Generation could not be completed.");
        }
        if (generated.audits().stream().anyMatch(audit -> audit.status() == GeneratedRun.AuditStatus.FAIL)) {
            return GenerationDraftResponse.failure(
                    GenerationStatus.GENERATION_FAILURE, "Generation invariants could not be satisfied.");
        }
        try {
            validator.validate(generated);
            GeneratedRunDraft domainDraft = GeneratedRunDraft.from(generated);
            return GenerationDraftResponse.success(new GenerationDraft(
                    GenerationResultMapper.toApi(domainDraft.run()), domainDraft.contentFingerprint()));
        } catch (IllegalStateException exception) {
            return GenerationDraftResponse.failure(
                    GenerationStatus.GENERATION_FAILURE, "Generation invariants could not be satisfied.");
        }
    }

    private GenerationRunResponse commitNow(CommitGenerationRunCommand command) {
        GeneratedRunDraft draft;
        try {
            draft = GenerationResultMapper.toDomain(command.draft());
            validator.validate(draft.run());
            if (!draft.contentFingerprint().equals(
                    features.sessiongeneration.domain.generation.GenerationContentFingerprint.v1(draft.run()))) {
                return GenerationRunResponse.failure(
                        GenerationStatus.INVALID_REQUEST, "Generation draft is invalid.");
            }
        } catch (IllegalArgumentException | IllegalStateException exception) {
            return GenerationRunResponse.failure(GenerationStatus.INVALID_REQUEST, "Generation draft is invalid.");
        }
        try {
            GenerationRunCommitResult committed = repository.commit(draft);
            return GenerationRunResponse.committed(
                    GenerationResultMapper.toApi(committed.draft().run()),
                    committed.outcome() == GenerationRunCommitResult.Outcome.INSERTED
                            ? GenerationRunResponse.CommitOutcome.INSERTED
                            : GenerationRunResponse.CommitOutcome.ALREADY_PRESENT);
        } catch (GenerationRunIdentityConflictException exception) {
            return GenerationRunResponse.failure(
                    GenerationStatus.IDENTITY_CONFLICT, "Generation run identity is already in use.");
        } catch (IllegalStateException exception) {
            return GenerationRunResponse.failure(
                    GenerationStatus.STORAGE_FAILURE, "Generation run could not be persisted.");
        }
    }

    private GenerationRunResponse loadNow(GenerationRunId runId) {
        try {
            return repository.load(runId.value())
                    .map(GeneratedRunDraft::run)
                    .map(run -> {
                        validator.validate(run);
                        return GenerationResultMapper.toApi(run);
                    })
                    .map(GenerationRunResponse::success)
                    .orElseGet(() -> GenerationRunResponse.failure(
                            GenerationStatus.NOT_FOUND, "Generation run was not found."));
        } catch (IllegalStateException exception) {
            return GenerationRunResponse.failure(
                    GenerationStatus.STORAGE_FAILURE, "Generation run could not be loaded.");
        }
    }

    private GenerationRewardBatchResponse loadRewardsNow(GenerationRewardBatchQuery query) {
        try {
            List<features.sessiongeneration.domain.generation.GenerationRewardReference> references =
                    query.references().stream().map(reference ->
                            new features.sessiongeneration.domain.generation.GenerationRewardReference(
                                    reference.runId().value(), reference.treasureId())).toList();
            GenerationRewardBatch batch = repository.loadRewards(references);
            return GenerationRewardBatchResponse.success(
                    batch.resolved().stream().map(SessionGenerationService::toApi).toList(),
                    batch.missing().stream().map(SessionGenerationService::toApi).toList());
        } catch (IllegalArgumentException exception) {
            return GenerationRewardBatchResponse.failure(
                    GenerationStatus.INVALID_REQUEST, "Generation reward query is invalid.");
        } catch (IllegalStateException exception) {
            return GenerationRewardBatchResponse.failure(
                    GenerationStatus.STORAGE_FAILURE, "Generation rewards could not be loaded.");
        }
    }

    private static GenerationRewardBatchResponse.ResolvedReward toApi(GenerationRewardBatch.ResolvedReward reward) {
        GeneratedRun.TreasurePlan treasure = reward.treasure();
        return new GenerationRewardBatchResponse.ResolvedReward(
                toApi(reward.reference()),
                new features.sessiongeneration.api.GenerationResult.Treasure(
                        treasure.treasureId(),
                        features.sessiongeneration.api.GenerationResult.StockClass.valueOf(
                                treasure.stockClass().name()),
                        features.sessiongeneration.api.GenerationResult.RewardChannel.valueOf(
                                treasure.channel().name()),
                        treasure.anchorEncounterNumber(), treasure.theme(), treasure.magicType(), treasure.targetCp(),
                        treasure.nonMagicSlots(), treasure.magicSlots()),
                reward.loot().stream().map(line -> new features.sessiongeneration.api.GenerationResult.LootItem(
                        line.lineId(), line.treasureId(),
                        features.sessiongeneration.api.GenerationResult.LootRole.valueOf(line.role().name()),
                        line.itemId(), line.text(), line.quantity(), line.unitCp(), line.actualCp(),
                        line.totalCapacity(), line.allowedContainers(), line.magicRarity(), line.cursed())).toList(),
                reward.packing().stream().map(row -> new features.sessiongeneration.api.GenerationResult.Packing(
                        row.lineId(), row.treasureId(), row.containerType(), row.containerCount(),
                        row.containerId(), row.valid())).toList());
    }

    private static GenerationRewardReference toApi(
            features.sessiongeneration.domain.generation.GenerationRewardReference reference
    ) {
        return new GenerationRewardReference(new GenerationRunId(reference.runId()), reference.treasureId());
    }

    private static GeneratedRun withRunId(GeneratedRun run, String runId) {
        return new GeneratedRun(
                runId, run.engineVersion(), run.catalogVersion(), run.catalogContentHash(), run.seed(),
                run.party(), run.session(), run.encounterTargets(), run.encounters(), run.treasures(), run.loot(),
                run.packing(), run.rewards(), run.formattedText(), run.audits());
    }

    private <T> void executeIo(
            CompletableFuture<T> response,
            Supplier<T> operation,
            Supplier<T> failure
    ) {
        schedule(ioLane, response, () -> {
            try {
                response.complete(operation.get());
            } catch (RuntimeException exception) {
                response.complete(failure.get());
            }
        }, failure);
    }

    private static <T> void schedule(
            ExecutionLane lane,
            CompletableFuture<T> response,
            Runnable operation,
            Supplier<T> failure
    ) {
        try {
            lane.execute(operation);
        } catch (RuntimeException exception) {
            response.complete(failure.get());
        }
    }
}
