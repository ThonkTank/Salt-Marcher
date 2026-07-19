package features.sessionplanner.application;

import features.encounter.api.EncounterApi;
import features.encounter.api.GeneratedEncounterBatchStatus;
import features.encounter.api.GeneratedEncounterPlanSummary;
import features.encounter.api.GeneratedEncounterPlanSummaryBatchQuery;
import features.encounter.api.GeneratedEncounterPlanSummaryBatchResult;
import features.encounter.api.GeneratedEncounterPlanSummaryEntry;
import features.encounter.api.SavedEncounterPlanSearchHit;
import features.encounter.api.SearchSavedEncounterPlansQuery;
import features.encounter.api.SearchSavedEncounterPlansResult;
import features.sessionplanner.api.PreparedSceneCatalogModel;
import features.sessionplanner.api.PreparedSceneCatalogSnapshot;
import features.sessionplanner.api.SessionPlannerWorkspaceModel;
import features.sessionplanner.api.SessionPlannerWorkspaceSnapshot;
import features.sessionplanner.api.SearchSessionEncounterPlansCommand;
import features.sessionplanner.api.SessionEncounterPlanSearchSnapshot;
import features.sessionplanner.api.SessionPreparationSnapshot;
import features.sessionplanner.api.SessionPreparationStatus;
import features.sessionplanner.domain.session.SessionPlan;
import java.util.List;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.CompletionStage;
import platform.state.PublishedState;
import platform.ui.UiDispatcher;
import platform.diagnostics.DiagnosticId;
import platform.diagnostics.Diagnostics;

/** Latest-epoch-wins publication with one in-flight assembly and one dirty bit. */
public final class SessionPlannerWorkspacePublicationCoordinator {

    private static final DiagnosticId STORAGE_FAILURE = new DiagnosticId("sessionplanner.storage-failure");

    private final SessionPlannerWorkspaceAssembler assembler;
    private final EncounterApi encounters;
    private final Diagnostics diagnostics;
    private final PublishedState<SessionPlannerWorkspaceSnapshot> workspace;
    private final PublishedState<PreparedSceneCatalogSnapshot> preparedScenes;
    private final SessionPlannerWorkspaceModel workspaceModel;
    private final PreparedSceneCatalogModel preparedSceneModel;
    private long epoch;
    private long publicationRevision;
    private long preparedSceneRevision;
    private long searchEpoch;
    private boolean running;
    private boolean dirty;
    private boolean sourceMismatchRetried;
    private SourceStamp expectedSource;
    private String statusOverlay = "";
    private SessionPreparationSnapshot acceptedPreparation = SessionPreparationSnapshot.idle();

    public SessionPlannerWorkspacePublicationCoordinator(
            SessionPlannerWorkspaceAssembler assembler,
            EncounterApi encounters,
            UiDispatcher uiDispatcher,
            Diagnostics diagnostics
    ) {
        this.assembler = Objects.requireNonNull(assembler, "assembler");
        this.encounters = Objects.requireNonNull(encounters, "encounters");
        this.diagnostics = Objects.requireNonNull(diagnostics, "diagnostics");
        UiDispatcher dispatcher = Objects.requireNonNull(uiDispatcher, "uiDispatcher");
        workspace = new PublishedState<>(SessionPlannerWorkspaceSnapshot.empty(), dispatcher);
        preparedScenes = new PublishedState<>(PreparedSceneCatalogSnapshot.empty(), dispatcher);
        workspaceModel = new SessionPlannerWorkspaceModel(workspace::current, workspace::subscribe);
        preparedSceneModel = new PreparedSceneCatalogModel(preparedScenes::current, preparedScenes::subscribe);
    }

    public SessionPlannerWorkspaceModel model() {
        return workspaceModel;
    }

    public PreparedSceneCatalogModel preparedScenes() {
        return preparedSceneModel;
    }

    public SessionPlannerWorkspaceSnapshot current() {
        return workspace.current();
    }

    public synchronized void initialize() {
        statusOverlay = "";
        invalidateEncounterSearch();
        request(null, SessionPreparationSnapshot.idle());
    }

    public synchronized void authoredMutation(SessionPlan committed) {
        Objects.requireNonNull(committed, "committed");
        statusOverlay = committed.statusText();
        invalidateEncounterSearch();
        request(new SourceStamp(committed.sessionId(), committed.revision().value()), SessionPreparationSnapshot.idle());
    }

    public synchronized void preparedCommit(SessionPlan committed, SessionPreparationSnapshot ready) {
        Objects.requireNonNull(committed, "committed");
        statusOverlay = committed.statusText();
        invalidateEncounterSearch();
        request(new SourceStamp(committed.sessionId(), committed.revision().value()),
                Objects.requireNonNull(ready, "ready"));
    }

    public synchronized void providerRefresh() {
        invalidateEncounterSearch();
        request(expectedSource, workspace.current().preparation());
    }

    public synchronized void authoredIntent() {
        invalidateEncounterSearch();
    }

    public synchronized void searchEncounterPlans(SearchSessionEncounterPlansCommand command) {
        Objects.requireNonNull(command, "command");
        SessionPlannerWorkspaceSnapshot stable = workspace.current();
        long selectedScene = stable.currentSession().session().selectedEncounterId();
        String normalized = command.query().trim().toLowerCase(Locale.ROOT);
        long requestEpoch = ++searchEpoch;
        if (stable.sourceSessionId() <= 0L || command.sceneToken() != selectedScene) {
            publishEncounterSearch(new SessionEncounterPlanSearchSnapshot(
                    requestEpoch, stable.sourceSessionId(), stable.sourceSessionRevision(), selectedScene,
                    normalized, SessionEncounterPlanSearchSnapshot.Status.FAILED, List.of(), false,
                    "Die ausgewählte Szene hat sich geändert."));
            return;
        }
        if (normalized.isBlank()) {
            publishEncounterSearch(new SessionEncounterPlanSearchSnapshot(
                    requestEpoch, stable.sourceSessionId(), stable.sourceSessionRevision(), selectedScene,
                    "", SessionEncounterPlanSearchSnapshot.Status.IDLE, List.of(), false, ""));
            return;
        }
        if (normalized.length() < 2) {
            publishEncounterSearch(new SessionEncounterPlanSearchSnapshot(
                    requestEpoch, stable.sourceSessionId(), stable.sourceSessionRevision(), selectedScene,
                    normalized, SessionEncounterPlanSearchSnapshot.Status.TOO_SHORT, List.of(), false,
                    "Mindestens 2 Zeichen eingeben."));
            return;
        }
        publishEncounterSearch(new SessionEncounterPlanSearchSnapshot(
                requestEpoch, stable.sourceSessionId(), stable.sourceSessionRevision(), selectedScene,
                normalized, SessionEncounterPlanSearchSnapshot.Status.SEARCHING, List.of(), false,
                "Encounter werden gesucht …"));
        final java.util.concurrent.CompletionStage<SearchSavedEncounterPlansResult> stage;
        try {
            stage = encounters.searchSavedPlans(new SearchSavedEncounterPlansQuery(normalized));
        } catch (RuntimeException failure) {
            failEncounterSearch(requestEpoch, stable, selectedScene);
            return;
        }
        if (stage == null) {
            failEncounterSearch(requestEpoch, stable, selectedScene);
            return;
        }
        stage.whenComplete((result, failure) -> completeEncounterSearchRoots(
                requestEpoch, stable.sourceSessionId(), stable.sourceSessionRevision(), selectedScene,
                normalized, result, failure));
    }

    public synchronized void publishPreparation(SessionPreparationSnapshot preparation) {
        acceptedPreparation = Objects.requireNonNull(preparation, "preparation");
        epoch++;
        SessionPlannerWorkspaceSnapshot stable = workspace.current()
                .withPreparation(acceptedPreparation)
                .withPublicationRevision(++publicationRevision);
        workspace.publish(stable);
        if (running) {
            dirty = true;
        }
    }

    public boolean locationExists(long locationId) {
        return locationId <= 0L || workspace.current().selectedScene().locationChoices().stream()
                .anyMatch(location -> location.locationId() == locationId);
    }

    private void request(SourceStamp source, SessionPreparationSnapshot terminalPreparation) {
        epoch++;
        expectedSource = source;
        acceptedPreparation = Objects.requireNonNull(terminalPreparation, "terminalPreparation");
        sourceMismatchRetried = false;
        if (running) {
            dirty = true;
            return;
        }
        start(epoch);
    }

    private void start(long assemblyEpoch) {
        running = true;
        dirty = false;
        CompletionStage<SessionPlannerWorkspaceAssembly> stage;
        try {
            stage = assembler.assemble(acceptedPreparation);
        } catch (RuntimeException failure) {
            complete(assemblyEpoch, null, failure);
            return;
        }
        if (stage == null) {
            complete(assemblyEpoch, null, new IllegalStateException("workspace assembly returned no stage"));
            return;
        }
        try {
            stage.whenComplete((result, failure) -> complete(assemblyEpoch, result, failure));
        } catch (RuntimeException failure) {
            complete(assemblyEpoch, null, failure);
        }
    }

    private synchronized void complete(
            long assemblyEpoch,
            SessionPlannerWorkspaceAssembly result,
            Throwable failure
    ) {
        running = false;
        boolean epochCurrent = assemblyEpoch == epoch;
        if (failure != null || result == null) {
            if (epochCurrent) {
                diagnostics.failure(STORAGE_FAILURE,
                        failureType(failure));
                publishPlannerFailure();
            }
        } else if (epochCurrent && sourceMatches(result.workspace())) {
            publish(result);
        } else if (epochCurrent && !sourceMismatchRetried) {
            sourceMismatchRetried = true;
            dirty = true;
        } else if (epochCurrent) {
            publishPlannerFailure();
        }
        if (dirty || assemblyEpoch != epoch) {
            start(epoch);
        }
    }

    private boolean sourceMatches(SessionPlannerWorkspaceSnapshot candidate) {
        return expectedSource == null || expectedSource.sessionId() == candidate.sourceSessionId()
                && expectedSource.revision() == candidate.sourceSessionRevision();
    }

    private void publish(SessionPlannerWorkspaceAssembly result) {
        SessionPlannerWorkspaceSnapshot candidate = applyStatusOverlay(result.workspace())
                .withSelectedSceneSearch(retainedSearch(result.workspace(), workspace.current()))
                .withPreparation(acceptedPreparation)
                .withPublicationRevision(++publicationRevision);
        workspace.publish(candidate);
        statusOverlay = "";
        PreparedSceneCatalogSnapshot scenes = result.preparedScenes();
        preparedScenes.publish(new PreparedSceneCatalogSnapshot(
                ++preparedSceneRevision, scenes.scenes(), scenes.statusText()));
    }

    private void publishPlannerFailure() {
        SessionPreparationSnapshot failed = new SessionPreparationSnapshot(
                SessionPreparationStatus.FAILED,
                "Session-Planner-Daten konnten nicht geladen werden.",
                workspace.current().sourceSessionId(),
                workspace.current().preparation().attemptId(),
                false);
        SessionPlannerWorkspaceSnapshot stable = workspace.current().withPreparation(failed).withIssue(
                new SessionPlannerWorkspaceSnapshot.Issue(
                        SessionPlannerWorkspaceSnapshot.Owner.SESSION_PLANNER,
                        SessionPlannerWorkspaceSnapshot.Kind.STORAGE_FAILURE,
                        "",
                        "Session-Planner-Daten konnten nicht geladen werden."))
                .withPublicationRevision(++publicationRevision);
        workspace.publish(stable);
    }

    private static Class<? extends Throwable> failureType(Throwable failure) {
        if (failure == null) {
            return IllegalStateException.class;
        }
        Throwable cause = failure.getCause();
        return failure instanceof java.util.concurrent.CompletionException && cause != null
                ? cause.getClass() : failure.getClass();
    }

    private SessionPlannerWorkspaceSnapshot applyStatusOverlay(SessionPlannerWorkspaceSnapshot candidate) {
        if (statusOverlay.isBlank()) {
            return candidate;
        }
        var current = candidate.currentSession();
        var withStatus = new features.sessionplanner.api.SessionPlannerSessionSnapshot(
                current.session(), current.xpBudget(), current.restAdvice(), statusOverlay);
        var catalog = candidate.catalog();
        var catalogWithStatus = new features.sessionplanner.api.SessionPlannerCatalogSnapshot(
                catalog.sessions(), catalog.selectedSessionId(), statusOverlay);
        return new SessionPlannerWorkspaceSnapshot(
                candidate.publicationRevision(), candidate.sourceSessionId(), candidate.sourceSessionRevision(),
                catalogWithStatus, withStatus, candidate.participants(), candidate.sceneTimeline(),
                candidate.selectedScene(), candidate.preparation(), candidate.issues());
    }

    private synchronized void completeEncounterSearchRoots(
            long requestEpoch,
            long sessionId,
            long sessionRevision,
            long selectedScene,
            String normalized,
            SearchSavedEncounterPlansResult result,
            Throwable failure
    ) {
        if (!searchCurrent(requestEpoch, sessionId, sessionRevision, selectedScene)) {
            return;
        }
        if (failure != null || result == null || result.status() != SearchSavedEncounterPlansResult.Status.SUCCESS) {
            failEncounterSearch(requestEpoch, workspace.current(), selectedScene);
            return;
        }
        LinkedHashMap<Long, SavedEncounterPlanSearchHit> hits = new LinkedHashMap<>();
        for (SavedEncounterPlanSearchHit hit : result.hits()) {
            if (hit == null || hits.putIfAbsent(hit.planId(), hit) != null) {
                failEncounterSearch(requestEpoch, workspace.current(), selectedScene);
                return;
            }
        }
        LinkedHashSet<Long> hydrateIds = new LinkedHashSet<>(hits.keySet());
        workspace.current().sceneTimeline().sceneHeaders().stream()
                .map(features.sessionplanner.api.SessionPlannerSceneTimelineProjection.SceneHeader::linkedEncounterPlanId)
                .filter(id -> id > 0L)
                .forEach(hydrateIds::add);
        if (hydrateIds.isEmpty()) {
            publishReadySearch(requestEpoch, sessionId, sessionRevision, selectedScene, normalized,
                    hits, Map.of(), result.hasMore());
            return;
        }
        final java.util.concurrent.CompletionStage<GeneratedEncounterPlanSummaryBatchResult> summaries;
        try {
            summaries = encounters.loadGeneratedPlanSummaries(
                    new GeneratedEncounterPlanSummaryBatchQuery(List.copyOf(hydrateIds)));
        } catch (RuntimeException summaryFailure) {
            failEncounterSearch(requestEpoch, workspace.current(), selectedScene);
            return;
        }
        if (summaries == null) {
            failEncounterSearch(requestEpoch, workspace.current(), selectedScene);
            return;
        }
        List<Long> requestedIds = List.copyOf(hydrateIds);
        summaries.whenComplete((response, summaryFailure) -> completeEncounterSearchSummaries(
                requestEpoch, sessionId, sessionRevision, selectedScene, normalized,
                hits, result.hasMore(), requestedIds, response, summaryFailure));
    }

    private synchronized void completeEncounterSearchSummaries(
            long requestEpoch,
            long sessionId,
            long sessionRevision,
            long selectedScene,
            String normalized,
            Map<Long, SavedEncounterPlanSearchHit> hits,
            boolean hasMore,
            List<Long> requestedIds,
            GeneratedEncounterPlanSummaryBatchResult response,
            Throwable failure
    ) {
        if (!searchCurrent(requestEpoch, sessionId, sessionRevision, selectedScene)) {
            return;
        }
        if (failure != null || response == null || response.status() != GeneratedEncounterBatchStatus.SUCCESS
                || response.entries().size() != requestedIds.size()) {
            failEncounterSearch(requestEpoch, workspace.current(), selectedScene);
            return;
        }
        Map<Long, GeneratedEncounterPlanSummary> summaries = new LinkedHashMap<>();
        for (int index = 0; index < requestedIds.size(); index++) {
            long expectedId = requestedIds.get(index);
            GeneratedEncounterPlanSummaryEntry entry = response.entries().get(index);
            if (entry == null || entry.requestedPlanId() != expectedId) {
                failEncounterSearch(requestEpoch, workspace.current(), selectedScene);
                return;
            }
            if (entry.status() == GeneratedEncounterPlanSummaryEntry.Status.FOUND) {
                GeneratedEncounterPlanSummary summary = entry.summary().orElse(null);
                if (summary == null || summary.planId() != expectedId || summaries.put(expectedId, summary) != null) {
                    failEncounterSearch(requestEpoch, workspace.current(), selectedScene);
                    return;
                }
            }
        }
        publishReadySearch(requestEpoch, sessionId, sessionRevision, selectedScene, normalized,
                hits, summaries, hasMore);
    }

    private void publishReadySearch(
            long requestEpoch,
            long sessionId,
            long sessionRevision,
            long selectedScene,
            String normalized,
            Map<Long, SavedEncounterPlanSearchHit> hits,
            Map<Long, GeneratedEncounterPlanSummary> summaries,
            boolean hasMore
    ) {
        List<SessionEncounterPlanSearchSnapshot.Result> results = hits.values().stream().map(hit -> {
            GeneratedEncounterPlanSummary summary = summaries.get(hit.planId());
            return summary == null
                    ? new SessionEncounterPlanSearchSnapshot.Result(
                            hit.planId(), hit.name(), hit.summaryText(), 0, "",
                            "Encounter-Plan ist nicht verfügbar.", false)
                    : new SessionEncounterPlanSearchSnapshot.Result(
                            hit.planId(), summary.label().isBlank() ? hit.name() : summary.label(),
                            summary.displaySummary().isBlank() ? hit.summaryText() : summary.displaySummary(),
                            Math.toIntExact(summary.adjustedXp()), summary.difficulty().name(), "", true);
        }).toList();
        publishEncounterSearch(new SessionEncounterPlanSearchSnapshot(
                requestEpoch, sessionId, sessionRevision, selectedScene, normalized,
                SessionEncounterPlanSearchSnapshot.Status.READY, results, hasMore,
                results.isEmpty() ? "Keine gespeicherten Encounter gefunden." : ""));
    }

    private synchronized void failEncounterSearch(
            long requestEpoch,
            SessionPlannerWorkspaceSnapshot source,
            long selectedScene
    ) {
        if (!searchCurrent(requestEpoch, source.sourceSessionId(), source.sourceSessionRevision(), selectedScene)) {
            return;
        }
        publishEncounterSearch(new SessionEncounterPlanSearchSnapshot(
                requestEpoch, source.sourceSessionId(), source.sourceSessionRevision(), selectedScene,
                source.selectedScene().encounterPlanSearch().normalizedQuery(), SessionEncounterPlanSearchSnapshot.Status.FAILED,
                List.of(), false, "Encounter-Suche konnte nicht geladen werden."));
    }

    private boolean searchCurrent(long requestEpoch, long sessionId, long sessionRevision, long selectedScene) {
        SessionPlannerWorkspaceSnapshot current = workspace.current();
        return requestEpoch == searchEpoch
                && current.sourceSessionId() == sessionId
                && current.sourceSessionRevision() == sessionRevision
                && current.currentSession().session().selectedEncounterId() == selectedScene;
    }

    private void publishEncounterSearch(SessionEncounterPlanSearchSnapshot search) {
        workspace.publish(workspace.current()
                .withSelectedSceneSearch(search)
                .withPublicationRevision(++publicationRevision));
    }

    private void invalidateEncounterSearch() {
        searchEpoch++;
        if (workspace.current().selectedScene().encounterPlanSearch().status()
                    == SessionEncounterPlanSearchSnapshot.Status.IDLE
                && workspace.current().selectedScene().encounterPlanSearch().results().isEmpty()) {
            return;
        }
        workspace.publish(workspace.current()
                .withSelectedSceneSearch(SessionEncounterPlanSearchSnapshot.idle())
                .withPublicationRevision(++publicationRevision));
    }

    private static SessionEncounterPlanSearchSnapshot retainedSearch(
            SessionPlannerWorkspaceSnapshot candidate,
            SessionPlannerWorkspaceSnapshot current
    ) {
        SessionEncounterPlanSearchSnapshot search = current.selectedScene().encounterPlanSearch();
        return candidate.sourceSessionId() == search.sourceSessionId()
                && candidate.sourceSessionRevision() == search.sourceSessionRevision()
                && candidate.selectedScene().sceneToken() == search.selectedSceneToken()
                ? search : SessionEncounterPlanSearchSnapshot.idle();
    }

    private record SourceStamp(long sessionId, long revision) {
    }
}
