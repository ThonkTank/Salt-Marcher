package features.sessionplanner.api;

import java.util.List;
import java.util.Objects;

/** Sole immutable view-facing Session Planner publication. */
public record SessionPlannerWorkspaceSnapshot(
        long publicationRevision,
        long sourceSessionId,
        long sourceSessionRevision,
        SessionPlannerCatalogSnapshot catalog,
        SessionPlannerSessionSnapshot currentSession,
        SessionPlannerParticipantsProjection participants,
        SessionPlannerSceneTimelineProjection sceneTimeline,
        SessionPlannerStatePanelProjection statePanel,
        SessionEncounterPlanSearchSnapshot encounterPlanSearch,
        SessionPreparationSnapshot preparation,
        List<Issue> issues
) {

    public SessionPlannerWorkspaceSnapshot {
        publicationRevision = Math.max(0L, publicationRevision);
        sourceSessionId = Math.max(0L, sourceSessionId);
        sourceSessionRevision = Math.max(0L, sourceSessionRevision);
        catalog = catalog == null ? SessionPlannerCatalogSnapshot.empty() : catalog;
        currentSession = currentSession == null
                ? SessionPlannerSessionSnapshot.empty("Session ist noch nicht geladen.") : currentSession;
        participants = participants == null ? SessionPlannerParticipantsProjection.empty() : participants;
        sceneTimeline = sceneTimeline == null ? SessionPlannerSceneTimelineProjection.empty() : sceneTimeline;
        statePanel = statePanel == null ? SessionPlannerStatePanelProjection.empty() : statePanel;
        encounterPlanSearch = encounterPlanSearch == null
                ? SessionEncounterPlanSearchSnapshot.idle() : encounterPlanSearch;
        preparation = preparation == null ? SessionPreparationSnapshot.idle() : preparation;
        issues = issues == null ? List.of() : List.copyOf(issues);
    }

    public static SessionPlannerWorkspaceSnapshot empty() {
        return new SessionPlannerWorkspaceSnapshot(
                0L, 0L, 0L, SessionPlannerCatalogSnapshot.empty(),
                SessionPlannerSessionSnapshot.empty("Session ist noch nicht geladen."),
                SessionPlannerParticipantsProjection.empty(), SessionPlannerSceneTimelineProjection.empty(),
                SessionPlannerStatePanelProjection.empty(), SessionEncounterPlanSearchSnapshot.idle(),
                SessionPreparationSnapshot.idle(), List.of());
    }

    public SessionPlannerWorkspaceSnapshot withPublicationRevision(long revision) {
        return new SessionPlannerWorkspaceSnapshot(
                revision, sourceSessionId, sourceSessionRevision, catalog, currentSession,
                participants, sceneTimeline, statePanel, encounterPlanSearch, preparation, issues);
    }

    public SessionPlannerWorkspaceSnapshot withPreparation(SessionPreparationSnapshot next) {
        return new SessionPlannerWorkspaceSnapshot(
                publicationRevision, sourceSessionId, sourceSessionRevision, catalog, currentSession,
                participants, sceneTimeline, statePanel, encounterPlanSearch, next, issues);
    }

    public SessionPlannerWorkspaceSnapshot withEncounterPlanSearch(SessionEncounterPlanSearchSnapshot next) {
        return new SessionPlannerWorkspaceSnapshot(
                publicationRevision, sourceSessionId, sourceSessionRevision, catalog, currentSession,
                participants, sceneTimeline, statePanel, next, preparation, issues);
    }

    public SessionPlannerWorkspaceSnapshot withIssue(Issue issue) {
        List<Issue> next = new java.util.ArrayList<>(issues);
        next.add(Objects.requireNonNull(issue, "issue"));
        return new SessionPlannerWorkspaceSnapshot(
                publicationRevision, sourceSessionId, sourceSessionRevision, catalog, currentSession,
                participants, sceneTimeline, statePanel, encounterPlanSearch, preparation, next);
    }

    public record Issue(Owner owner, Kind kind, String reference, String message) {
        public Issue {
            owner = Objects.requireNonNull(owner, "owner");
            kind = Objects.requireNonNull(kind, "kind");
            reference = reference == null ? "" : reference.trim();
            message = message == null ? "" : message.trim();
        }
    }

    public enum Owner { SESSION_PLANNER, PARTY, ENCOUNTER, SESSION_GENERATION, WORLD_PLANNER }
    public enum Kind { UNAVAILABLE, OWNER_FAILURE, MALFORMED_RESPONSE, STORAGE_FAILURE }
}
