package src.data.sessionplanner.repository;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.function.Consumer;
import org.jspecify.annotations.Nullable;
import src.data.sessionplanner.mapper.SessionPlannerPublishedStateProjector;
import src.domain.sessionplanner.published.SessionPlannerCurrentSessionModel;
import src.domain.sessionplanner.published.SessionPlannerEncountersModel;
import src.domain.sessionplanner.published.SessionPlannerEncountersProjection;
import src.domain.sessionplanner.published.SessionPlannerParticipantsModel;
import src.domain.sessionplanner.published.SessionPlannerParticipantsProjection;
import src.domain.sessionplanner.published.SessionPlannerSessionSnapshot;
import src.domain.sessionplanner.published.SessionPlannerStatePanelModel;
import src.domain.sessionplanner.published.SessionPlannerStatePanelProjection;
import src.domain.sessionplanner.session.aggregate.SessionPlan;
import src.domain.sessionplanner.session.port.SessionEncounterFactsLookup;
import src.domain.sessionplanner.session.port.SessionPartyFactsLookup;
import src.domain.sessionplanner.session.port.SessionPlanRepository;
import src.domain.sessionplanner.session.port.SessionPlannerPublishedStateRepository;

public final class SessionPlannerPublishedStateRepositoryAdapter implements SessionPlannerPublishedStateRepository {

    private final SessionPlanRepository repository;
    private final SessionPartyFactsLookup partyFacts;
    private final SessionEncounterFactsLookup encounterFacts;
    private final SessionPlannerPublishedStateProjector projector = new SessionPlannerPublishedStateProjector();
    private final List<Consumer<SessionPlannerSessionSnapshot>> sessionListeners = new ArrayList<>();
    private final List<Consumer<SessionPlannerParticipantsProjection>> participantsListeners = new ArrayList<>();
    private final List<Consumer<SessionPlannerEncountersProjection>> encountersListeners = new ArrayList<>();
    private final List<Consumer<SessionPlannerStatePanelProjection>> statePanelListeners = new ArrayList<>();
    public final SessionPlannerCurrentSessionModel currentSessionModel = new SessionPlannerCurrentSessionModel(
            this::currentSessionSnapshot,
            this::subscribeSessionListener);
    public final SessionPlannerParticipantsModel participantsModel = new SessionPlannerParticipantsModel(
            this::currentParticipantsProjection,
            this::subscribeParticipantsListener);
    public final SessionPlannerEncountersModel encountersModel = new SessionPlannerEncountersModel(
            this::currentEncountersProjection,
            this::subscribeEncountersListener);
    public final SessionPlannerStatePanelModel statePanelModel = new SessionPlannerStatePanelModel(
            this::currentStatePanelProjection,
            this::subscribeStatePanelListener);
    private @Nullable SessionPlannerSessionSnapshot currentSessionSnapshot;
    private @Nullable SessionPlannerParticipantsProjection currentParticipantsProjection;
    private @Nullable SessionPlannerEncountersProjection currentEncountersProjection;
    private @Nullable SessionPlannerStatePanelProjection currentStatePanelProjection;

    public SessionPlannerPublishedStateRepositoryAdapter(
            SessionPlanRepository repository,
            SessionPartyFactsLookup partyFacts,
            SessionEncounterFactsLookup encounterFacts
    ) {
        this.repository = Objects.requireNonNull(repository, "repository");
        this.partyFacts = Objects.requireNonNull(partyFacts, "partyFacts");
        this.encounterFacts = Objects.requireNonNull(encounterFacts, "encounterFacts");
    }

    @Override
    public void publishCurrentSession(SessionPlan sessionPlan) {
        SessionPlan safeSession = Objects.requireNonNull(sessionPlan, "sessionPlan");
        currentSessionSnapshot = projector.projectSession(safeSession, partyFacts, encounterFacts);
        currentParticipantsProjection = projector.projectParticipants(safeSession, partyFacts);
        currentEncountersProjection = projector.projectEncounters(safeSession, partyFacts, encounterFacts);
        currentStatePanelProjection = projector.projectStatePanel(safeSession, partyFacts, encounterFacts);
        notifySessionListeners(currentSessionSnapshot);
        notifyParticipantsListeners(currentParticipantsProjection);
        notifyEncountersListeners(currentEncountersProjection);
        notifyStatePanelListeners(currentStatePanelProjection);
    }

    private SessionPlannerSessionSnapshot currentSessionSnapshot() {
        loadPublishedState();
        return Objects.requireNonNull(currentSessionSnapshot, "currentSessionSnapshot");
    }

    private SessionPlannerParticipantsProjection currentParticipantsProjection() {
        loadPublishedState();
        return Objects.requireNonNull(currentParticipantsProjection, "currentParticipantsProjection");
    }

    private SessionPlannerEncountersProjection currentEncountersProjection() {
        loadPublishedState();
        return Objects.requireNonNull(currentEncountersProjection, "currentEncountersProjection");
    }

    private SessionPlannerStatePanelProjection currentStatePanelProjection() {
        loadPublishedState();
        return Objects.requireNonNull(currentStatePanelProjection, "currentStatePanelProjection");
    }

    private void loadPublishedState() {
        if (currentSessionSnapshot != null
                && currentParticipantsProjection != null
                && currentEncountersProjection != null
                && currentStatePanelProjection != null) {
            return;
        }
        Optional<SessionPlan> currentSession = repository.loadCurrent();
        if (currentSession.isEmpty()) {
            currentSessionSnapshot = SessionPlannerSessionSnapshot.empty("Session ist noch nicht geladen.");
            currentParticipantsProjection = SessionPlannerParticipantsProjection.empty();
            currentEncountersProjection = SessionPlannerEncountersProjection.empty();
            currentStatePanelProjection = SessionPlannerStatePanelProjection.empty();
            return;
        }
        publishCurrentSession(currentSession.get());
    }

    private Runnable subscribeSessionListener(Consumer<SessionPlannerSessionSnapshot> listener) {
        Consumer<SessionPlannerSessionSnapshot> safeListener = Objects.requireNonNull(listener, "listener");
        sessionListeners.add(safeListener);
        return () -> sessionListeners.remove(safeListener);
    }

    private Runnable subscribeParticipantsListener(Consumer<SessionPlannerParticipantsProjection> listener) {
        Consumer<SessionPlannerParticipantsProjection> safeListener = Objects.requireNonNull(listener, "listener");
        participantsListeners.add(safeListener);
        return () -> participantsListeners.remove(safeListener);
    }

    private Runnable subscribeEncountersListener(Consumer<SessionPlannerEncountersProjection> listener) {
        Consumer<SessionPlannerEncountersProjection> safeListener = Objects.requireNonNull(listener, "listener");
        encountersListeners.add(safeListener);
        return () -> encountersListeners.remove(safeListener);
    }

    private Runnable subscribeStatePanelListener(Consumer<SessionPlannerStatePanelProjection> listener) {
        Consumer<SessionPlannerStatePanelProjection> safeListener = Objects.requireNonNull(listener, "listener");
        statePanelListeners.add(safeListener);
        return () -> statePanelListeners.remove(safeListener);
    }

    private void notifySessionListeners(SessionPlannerSessionSnapshot snapshot) {
        for (Consumer<SessionPlannerSessionSnapshot> listener : List.copyOf(sessionListeners)) {
            listener.accept(snapshot);
        }
    }

    private void notifyParticipantsListeners(SessionPlannerParticipantsProjection projection) {
        for (Consumer<SessionPlannerParticipantsProjection> listener : List.copyOf(participantsListeners)) {
            listener.accept(projection);
        }
    }

    private void notifyEncountersListeners(SessionPlannerEncountersProjection projection) {
        for (Consumer<SessionPlannerEncountersProjection> listener : List.copyOf(encountersListeners)) {
            listener.accept(projection);
        }
    }

    private void notifyStatePanelListeners(SessionPlannerStatePanelProjection projection) {
        for (Consumer<SessionPlannerStatePanelProjection> listener : List.copyOf(statePanelListeners)) {
            listener.accept(projection);
        }
    }
}
