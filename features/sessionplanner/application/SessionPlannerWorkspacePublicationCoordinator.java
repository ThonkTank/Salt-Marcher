package features.sessionplanner.application;

import features.sessionplanner.api.PreparedSceneCatalogModel;
import features.sessionplanner.api.PreparedSceneCatalogSnapshot;
import features.sessionplanner.api.SessionPlannerWorkspaceModel;
import features.sessionplanner.api.SessionPlannerWorkspaceSnapshot;
import features.sessionplanner.api.SessionPreparationSnapshot;
import features.sessionplanner.api.SessionPreparationStatus;
import features.sessionplanner.domain.session.SessionPlan;
import java.util.List;
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
    private final Diagnostics diagnostics;
    private final PublishedState<SessionPlannerWorkspaceSnapshot> workspace;
    private final PublishedState<PreparedSceneCatalogSnapshot> preparedScenes;
    private final SessionPlannerWorkspaceModel workspaceModel;
    private final PreparedSceneCatalogModel preparedSceneModel;
    private long epoch;
    private long publicationRevision;
    private long preparedSceneRevision;
    private boolean running;
    private boolean dirty;
    private boolean sourceMismatchRetried;
    private SourceStamp expectedSource;
    private String statusOverlay = "";
    private SessionPreparationSnapshot acceptedPreparation = SessionPreparationSnapshot.idle();

    public SessionPlannerWorkspacePublicationCoordinator(
            SessionPlannerWorkspaceAssembler assembler,
            UiDispatcher uiDispatcher,
            Diagnostics diagnostics
    ) {
        this.assembler = Objects.requireNonNull(assembler, "assembler");
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
        request(null, SessionPreparationSnapshot.idle());
    }

    public synchronized void authoredMutation(SessionPlan committed) {
        Objects.requireNonNull(committed, "committed");
        statusOverlay = committed.statusText();
        request(new SourceStamp(committed.sessionId(), committed.revision().value()), SessionPreparationSnapshot.idle());
    }

    public synchronized void preparedCommit(SessionPlan committed, SessionPreparationSnapshot ready) {
        Objects.requireNonNull(committed, "committed");
        statusOverlay = committed.statusText();
        request(new SourceStamp(committed.sessionId(), committed.revision().value()),
                Objects.requireNonNull(ready, "ready"));
    }

    public synchronized void providerRefresh() {
        request(expectedSource, workspace.current().preparation());
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
        return locationId <= 0L || workspace.current().currentSession().locationReferences().stream()
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
                current.session(), current.xpBudget(), current.restAdvice(), current.goldBudget(),
                current.availableEncounterPlans(), current.locationReferences(), statusOverlay);
        var catalog = candidate.catalog();
        var catalogWithStatus = new features.sessionplanner.api.SessionPlannerCatalogSnapshot(
                catalog.sessions(), catalog.selectedSessionId(), statusOverlay);
        return new SessionPlannerWorkspaceSnapshot(
                candidate.publicationRevision(), candidate.sourceSessionId(), candidate.sourceSessionRevision(),
                catalogWithStatus, withStatus, candidate.participants(), candidate.sceneTimeline(),
                candidate.statePanel(), candidate.preparation(), candidate.issues());
    }

    private record SourceStamp(long sessionId, long revision) {
    }
}
