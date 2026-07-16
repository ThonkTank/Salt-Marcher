package features.sessionplanner.application;

import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.OptionalInt;
import platform.diagnostics.DiagnosticId;
import platform.diagnostics.Diagnostics;
import platform.execution.ExecutionLane;
import features.encounter.api.GeneratedEncounterPlanImportApi;
import features.encounter.api.GeneratedEncounterPlanImportCommand;
import features.encounter.api.GeneratedEncounterPlanImportResult;
import features.sessiongeneration.api.GenerationResponse;
import features.sessiongeneration.api.GenerationResult;
import features.sessiongeneration.api.GenerationRunId;
import features.sessiongeneration.api.GenerationStatus;
import features.sessiongeneration.api.SessionGenerationApi;
import features.sessionplanner.api.ApplyGeneratedSessionCommand;
import features.sessionplanner.api.PreviewGeneratedSessionCommand;
import features.sessionplanner.api.SessionGenerationPreviewSnapshot;
import features.sessionplanner.api.SessionGenerationPreviewStatus;
import features.sessionplanner.domain.session.SessionGeneratedRewardReference;
import features.sessionplanner.domain.session.SessionPlan;
import features.sessionplanner.domain.session.repository.SessionPlanRepository;

public final class SessionGenerationCoordinator {

    private static final DiagnosticId GENERATION_FAILURE =
            new DiagnosticId("sessionplanner.generation-failure");

    private final SessionPlanRepository repository;
    private final SessionPlannerForeignFacts facts;
    private final SessionPlannerPublishedState sessions;
    private final SessionGenerationPublishedState previews;
    private final SessionGenerationApi generation;
    private final GeneratedEncounterPlanImportApi encounterImport;
    private final ExecutionLane executionLane;
    private final Diagnostics diagnostics;
    private long attemptSequence;
    private PreviewBinding binding;

    public SessionGenerationCoordinator(
            SessionPlanRepository repository,
            SessionPlannerForeignFacts facts,
            SessionPlannerPublishedState sessions,
            SessionGenerationPublishedState previews,
            SessionGenerationApi generation,
            GeneratedEncounterPlanImportApi encounterImport,
            ExecutionLane executionLane,
            Diagnostics diagnostics
    ) {
        this.repository = Objects.requireNonNull(repository, "repository");
        this.facts = Objects.requireNonNull(facts, "facts");
        this.sessions = Objects.requireNonNull(sessions, "sessions");
        this.previews = Objects.requireNonNull(previews, "previews");
        this.generation = Objects.requireNonNull(generation, "generation");
        this.encounterImport = Objects.requireNonNull(encounterImport, "encounterImport");
        this.executionLane = Objects.requireNonNull(executionLane, "executionLane");
        this.diagnostics = Objects.requireNonNull(diagnostics, "diagnostics");
    }

    void preview(PreviewGeneratedSessionCommand command) {
        executionLane.execute(() -> previewOnLane(command));
    }

    void apply(ApplyGeneratedSessionCommand command) {
        Objects.requireNonNull(command, "command");
        executionLane.execute(() -> applyOnLane(command));
    }

    void markStale() {
        executionLane.execute(this::markStaleOnLane);
    }

    void draftChanged() {
        if (previews.current().status() == SessionGenerationPreviewStatus.APPLYING) {
            return;
        }
        executionLane.execute(() -> {
            if (previews.current().status() != SessionGenerationPreviewStatus.APPLYING) {
                markStaleOnLane();
            }
        });
    }

    private void markStaleOnLane() {
        attemptSequence++;
        binding = null;
        previews.markStale();
    }

    void refreshGeneratedRewards(SessionPlan session) {
        if (session == null || session.generatedRewards().isEmpty()) {
            return;
        }
        new LinkedHashSet<>(session.generatedRewards().stream()
                .map(SessionGeneratedRewardReference::generationId)
                .toList()).forEach(generationId -> generation.load(new GenerationRunId(generationId))
                        .whenComplete((response, failure) -> executionLane.execute(
                                () -> completeRewardRefresh(session.sessionId(), generationId, response, failure))));
    }

    private void completeRewardRefresh(
            long sessionId,
            String generationId,
            GenerationResponse response,
            Throwable failure
    ) {
        if (failure != null || response == null || response.status() != GenerationStatus.SUCCESS
                || response.result().isEmpty()) {
            if (failure != null) {
                reportFailure(failure);
            }
            return;
        }
        Optional<SessionPlan> current = loadCurrent();
        if (current.isEmpty() || current.get().sessionId() != sessionId) {
            return;
        }
        Map<Long, String> labels = SessionGenerationPreviewProjection.rewardLabels(
                response.result().orElseThrow());
        SessionPlan refreshed = current.get().refreshGeneratedRewardLabels(generationId, labels);
        if (refreshed.equals(current.get())) {
            return;
        }
        try {
            SessionPlan saved = repository.save(refreshed);
            markStale();
            sessions.publishCurrentSession(saved);
        } catch (IllegalStateException exception) {
            reportFailure(exception);
        }
    }

    private void previewOnLane(PreviewGeneratedSessionCommand command) {
        long attemptToken = ++attemptSequence;
        binding = null;
        Optional<SessionPlan> current = loadCurrent();
        if (current.isEmpty()) {
            publishError(attemptToken, "Keine Session verfügbar.", 0L, command.seed());
            return;
        }
        SessionGenerationRequestFingerprint fingerprint = fingerprint(
                current.get(), command.encounterCount(), command.seed());
        if (fingerprint == null) {
            publishError(
                    attemptToken,
                    "Alle Session-Teilnehmer müssen mit gültigem Level verfügbar sein.",
                    current.get().sessionId(),
                    command.seed());
            return;
        }
        publishStatus(
                SessionGenerationPreviewStatus.GENERATING,
                "Vorschau wird erzeugt …",
                fingerprint.sessionId(),
                fingerprint.seed());
        try {
            generation.generate(fingerprint.toRequest()).whenComplete((response, failure) -> executionLane.execute(
                    () -> completePreview(attemptToken, fingerprint, response, failure)));
        } catch (RuntimeException exception) {
            reportFailure(exception);
            publishError(
                    attemptToken,
                    "Vorschau konnte nicht erzeugt werden. Bitte erneut versuchen.",
                    fingerprint.sessionId(),
                    fingerprint.seed());
        }
    }

    private void completePreview(
            long attemptToken,
            SessionGenerationRequestFingerprint fingerprint,
            GenerationResponse response,
            Throwable failure
    ) {
        if (!isCurrentAttempt(attemptToken)) {
            return;
        }
        if (!matchesLive(fingerprint)) {
            staleAttempt(attemptToken);
            return;
        }
        if (failure != null) {
            reportFailure(failure);
            publishError(
                    attemptToken,
                    "Vorschau konnte nicht erzeugt werden. Bitte erneut versuchen.",
                    fingerprint.sessionId(),
                    fingerprint.seed());
            return;
        }
        if (response == null || response.status() != GenerationStatus.SUCCESS || response.result().isEmpty()) {
            publishError(
                    attemptToken,
                    SessionGenerationFailureMessages.forPreview(response),
                    fingerprint.sessionId(),
                    fingerprint.seed());
            return;
        }
        GenerationResult result = response.result().orElseThrow();
        PreviewBinding ready = new PreviewBinding(attemptToken, fingerprint, result);
        binding = ready;
        previews.publish(SessionGenerationPreviewProjection.toSnapshot(
                result,
                SessionGenerationPreviewStatus.READY,
                "Vorschau ist bereit.",
                fingerprint.sessionId(),
                attemptToken,
                SessionGenerationPreviewProjection.noHardFailure(result)));
    }

    private void applyOnLane(ApplyGeneratedSessionCommand command) {
        PreviewBinding active = binding;
        SessionGenerationPreviewSnapshot currentPreview = previews.current();
        if (active == null || !matches(command, active)) {
            return;
        }
        if (!isActive(active)
                || currentPreview.status() != SessionGenerationPreviewStatus.READY
                || !currentPreview.applyEnabled()) {
            if (currentPreview.status() != SessionGenerationPreviewStatus.STALE) {
                publishStatus(
                        SessionGenerationPreviewStatus.ERROR,
                        "Es gibt keine anwendbare Vorschau.",
                        currentPreview.sessionId(),
                        currentPreview.seed());
            }
            return;
        }
        if (!matchesLive(active.fingerprint())) {
            staleAttempt(active.attemptToken());
            return;
        }
        publishFromBinding(active, SessionGenerationPreviewStatus.APPLYING,
                "Generierte Session wird angewandt …");
        try {
            generation.load(active.result().runId()).whenComplete((response, failure) -> executionLane.execute(
                    () -> completeGenerationLoad(active, response, failure)));
        } catch (RuntimeException exception) {
            reportFailure(exception);
            publishFromBinding(active, SessionGenerationPreviewStatus.ERROR,
                    "Persistierte Vorschau konnte nicht geladen werden. Bitte erneut versuchen.");
        }
    }

    private void completeGenerationLoad(
            PreviewBinding active,
            GenerationResponse response,
            Throwable failure
    ) {
        if (!isActiveAndLive(active)) {
            staleActive(active);
            return;
        }
        if (failure != null || response == null || response.status() != GenerationStatus.SUCCESS
                || response.result().isEmpty()) {
            if (failure != null) {
                reportFailure(failure);
            }
            publishFromBinding(active, SessionGenerationPreviewStatus.ERROR,
                    SessionGenerationFailureMessages.forLoad(response));
            return;
        }
        GenerationResult result = response.result().orElseThrow();
        if (!result.equals(active.result()) || !SessionGenerationPreviewProjection.noHardFailure(result)) {
            publishFromBinding(active, SessionGenerationPreviewStatus.ERROR,
                    "Persistierte Vorschau stimmt nicht mit der freigegebenen Vorschau überein.");
            return;
        }
        try {
            GeneratedEncounterPlanImportCommand command = GeneratedSessionAssembly.toImportCommand(result);
            if (!isActiveAndLive(active)) {
                staleActive(active);
                return;
            }
            encounterImport.importGeneratedPlans(command)
                    .whenComplete((imported, importFailure) -> executionLane.execute(() -> completeEncounterImport(
                            active, result, imported, importFailure)));
        } catch (RuntimeException exception) {
            reportFailure(exception);
            publishFromBinding(active, SessionGenerationPreviewStatus.ERROR,
                    "Generierte Encounter-Daten konnten nicht vorbereitet werden. Bitte Vorschau neu erzeugen.");
        }
    }

    private void completeEncounterImport(
            PreviewBinding active,
            GenerationResult result,
            GeneratedEncounterPlanImportResult imported,
            Throwable failure
    ) {
        if (!isActiveAndLive(active)) {
            staleActive(active);
            return;
        }
        if (failure != null || imported == null
                || imported.status() != GeneratedEncounterPlanImportResult.Status.SUCCESS) {
            if (failure != null) {
                reportFailure(failure);
            }
            publishFromBinding(active, SessionGenerationPreviewStatus.ERROR,
                    SessionGenerationFailureMessages.forEncounterImport(imported));
            return;
        }
        SessionPlan candidate;
        try {
            candidate = GeneratedSessionAssembly.toSessionPlan(
                    active.fingerprint().sessionSnapshot(), result, imported.plans());
        } catch (RuntimeException exception) {
            reportFailure(exception);
            publishFromBinding(active, SessionGenerationPreviewStatus.ERROR,
                    "Generierte Session konnte nicht zusammengesetzt werden. Bitte Vorschau neu erzeugen.");
            return;
        }
        if (!isActiveAndLive(active)) {
            staleActive(active);
            return;
        }
        SessionPlan saved;
        try {
            saved = repository.save(candidate);
        } catch (IllegalStateException exception) {
            reportFailure(exception);
            sessions.publishCurrentSessionWithoutCatalogRefresh(
                    active.fingerprint().sessionSnapshot()
                            .withStatus("Session konnte nicht gespeichert werden."));
            publishFromBinding(active, SessionGenerationPreviewStatus.ERROR,
                    "Session konnte nicht gespeichert werden. Ein erneuter Versuch verwendet dieselben Encounter-Pläne.");
            return;
        }
        sessions.publishCurrentSession(saved);
        if (!isActive(active)) {
            return;
        }
        binding = null;
        attemptSequence = active.attemptToken() + 1L;
        previews.publish(SessionGenerationPreviewProjection.toSnapshot(
                result,
                SessionGenerationPreviewStatus.APPLIED,
                "Generierte Session wurde angewandt.",
                saved.sessionId(),
                active.attemptToken(),
                false));
    }

    private boolean isActiveAndLive(PreviewBinding active) {
        return isActive(active) && matchesLive(active.fingerprint());
    }

    private boolean isActive(PreviewBinding active) {
        return binding == active && isCurrentAttempt(active.attemptToken());
    }

    private boolean isCurrentAttempt(long attemptToken) {
        return attemptSequence == attemptToken;
    }

    private boolean matchesLive(SessionGenerationRequestFingerprint expected) {
        Optional<SessionPlan> current = loadCurrent();
        if (current.isEmpty()) {
            return false;
        }
        SessionGenerationRequestFingerprint live = fingerprint(
                current.get(), expected.encounterCount(), expected.seed());
        return expected.equals(live);
    }

    private void staleActive(PreviewBinding active) {
        if (isActive(active)) {
            staleAttempt(active.attemptToken());
        }
    }

    private void staleAttempt(long attemptToken) {
        if (attemptSequence == attemptToken) {
            attemptSequence = attemptToken + 1L;
            binding = null;
            previews.markStale();
        }
    }

    private SessionGenerationRequestFingerprint fingerprint(
            SessionPlan session,
            OptionalInt encounterCount,
            long seed
    ) {
        return SessionGenerationRequestFingerprint.from(session, facts, encounterCount, seed).orElse(null);
    }

    private Optional<SessionPlan> loadCurrent() {
        try {
            return repository.loadCurrent();
        } catch (IllegalStateException exception) {
            reportFailure(exception);
            return Optional.empty();
        }
    }

    private void publishError(
            long attemptToken,
            String message,
            long fallbackSessionId,
            long fallbackSeed
    ) {
        if (!isCurrentAttempt(attemptToken)) {
            return;
        }
        binding = null;
        publishStatus(SessionGenerationPreviewStatus.ERROR, message, fallbackSessionId, fallbackSeed);
    }

    private void publishStatus(
            SessionGenerationPreviewStatus status,
            String message,
            long fallbackSessionId,
            long fallbackSeed
    ) {
        previews.publish(SessionGenerationPreviewProjection.withStatus(
                previews.current(), status, message, fallbackSessionId, fallbackSeed));
    }

    private void publishFromBinding(
            PreviewBinding active,
            SessionGenerationPreviewStatus status,
            String message
    ) {
        if (!isActive(active)) {
            return;
        }
        previews.publish(SessionGenerationPreviewProjection.toSnapshot(
                active.result(),
                status,
                message,
                active.fingerprint().sessionId(),
                active.attemptToken(),
                false));
    }

    private static boolean matches(ApplyGeneratedSessionCommand command, PreviewBinding active) {
        return command.attemptToken() == active.attemptToken()
                && command.sessionId() == active.fingerprint().sessionId()
                && command.generationId().equals(active.result().runId().value());
    }

    private void reportFailure(Throwable failure) {
        diagnostics.failure(GENERATION_FAILURE, failure.getClass());
    }

    private record PreviewBinding(
            long attemptToken,
            SessionGenerationRequestFingerprint fingerprint,
            GenerationResult result
    ) {
    }
}
