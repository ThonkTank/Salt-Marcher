package features.sessiongeneration.application;

import features.sessiongeneration.api.GenerationRequest;
import features.sessiongeneration.api.GenerationResponse;
import features.sessiongeneration.api.GenerationRunId;
import features.sessiongeneration.api.GenerationStatus;
import features.sessiongeneration.api.SessionGenerationApi;
import features.sessiongeneration.domain.catalog.GenerationCatalog;
import features.sessiongeneration.domain.generation.GeneratedRun;
import features.sessiongeneration.domain.generation.GenerationInput;
import features.sessiongeneration.domain.generation.GenerationRunRepository;
import features.sessiongeneration.domain.generation.GeneratedRunValidator;
import features.sessiongeneration.domain.generation.SessionGenerationEngine;
import java.util.List;
import java.util.Objects;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import platform.execution.ExecutionLane;

public final class SessionGenerationService implements SessionGenerationApi {

    private final GenerationCatalog catalog;
    private final GenerationRunRepository repository;
    private final SessionGenerationEngine engine;
    private final ExecutionLane executionLane;
    private final GeneratedRunValidator validator = new GeneratedRunValidator();

    public SessionGenerationService(
            GenerationCatalog catalog,
            GenerationRunRepository repository,
            SessionGenerationEngine engine,
            ExecutionLane executionLane
    ) {
        this.catalog = Objects.requireNonNull(catalog, "catalog");
        this.repository = Objects.requireNonNull(repository, "repository");
        this.engine = Objects.requireNonNull(engine, "engine");
        this.executionLane = Objects.requireNonNull(executionLane, "executionLane");
    }

    @Override
    public CompletionStage<GenerationResponse> generate(GenerationRequest request) {
        CompletableFuture<GenerationResponse> response = new CompletableFuture<>();
        if (request == null) {
            response.complete(GenerationResponse.failure(GenerationStatus.INVALID_REQUEST, "Generation request is required."));
            return response;
        }
        execute(response, () -> generateNow(request));
        return response;
    }

    @Override
    public CompletionStage<GenerationResponse> load(GenerationRunId runId) {
        CompletableFuture<GenerationResponse> response = new CompletableFuture<>();
        if (runId == null) {
            response.complete(GenerationResponse.failure(GenerationStatus.INVALID_REQUEST, "Generation run id is required."));
            return response;
        }
        execute(response, () -> loadNow(runId));
        return response;
    }

    private GenerationResponse generateNow(GenerationRequest request) {
        GenerationInput input;
        try {
            input = new GenerationInput(
                    request.party().stream()
                            .map(level -> new GeneratedRun.PartyLevel(level.level(), level.players()))
                            .toList(),
                    request.adventureDayFraction(), request.encounterCount(), request.seed());
        } catch (IllegalArgumentException exception) {
            return GenerationResponse.failure(GenerationStatus.INVALID_REQUEST, "Generation input is invalid.");
        }
        GeneratedRun generated;
        try {
            generated = engine.generate(input, catalog.load());
        } catch (IllegalArgumentException | IllegalStateException exception) {
            return GenerationResponse.failure(GenerationStatus.CATALOG_FAILURE, "Generation catalog is unavailable or invalid.");
        }
        if (generated.audits().stream().anyMatch(
                audit -> audit.status() == GeneratedRun.AuditStatus.FAIL)) {
            return GenerationResponse.failure(
                    GenerationStatus.GENERATION_FAILURE,
                    "Generation invariants could not be satisfied.");
        }
        try {
            validator.validate(generated);
            return GenerationResponse.success(GenerationResultMapper.toApi(repository.save(generated)));
        } catch (IllegalStateException exception) {
            return GenerationResponse.failure(GenerationStatus.STORAGE_FAILURE, "Generation run could not be persisted.");
        }
    }

    private GenerationResponse loadNow(GenerationRunId runId) {
        try {
            return repository.load(runId.value())
                    .map(run -> {
                        validator.validate(run);
                        return GenerationResultMapper.toApi(run);
                    })
                    .map(GenerationResponse::success)
                    .orElseGet(() -> GenerationResponse.failure(
                            GenerationStatus.NOT_FOUND, "Generation run was not found."));
        } catch (IllegalStateException exception) {
            return GenerationResponse.failure(GenerationStatus.STORAGE_FAILURE, "Generation run could not be loaded.");
        }
    }

    private void execute(CompletableFuture<GenerationResponse> response, Operation operation) {
        try {
            executionLane.execute(() -> {
                try {
                    response.complete(operation.run());
                } catch (RuntimeException exception) {
                    response.complete(GenerationResponse.failure(
                            GenerationStatus.STORAGE_FAILURE,
                            "Generation operation could not be completed."));
                }
            });
        } catch (RuntimeException exception) {
            response.complete(GenerationResponse.failure(
                    GenerationStatus.STORAGE_FAILURE, "Generation execution is unavailable."));
        }
    }

    @FunctionalInterface
    private interface Operation {
        GenerationResponse run();
    }
}
