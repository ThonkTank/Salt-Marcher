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
import src.domain.sessionplanner.model.session.model.SessionPlan;
import src.domain.sessionplanner.model.session.port.SessionEncounterFactsPort;
import src.domain.sessionplanner.model.session.port.SessionPartyFactsPort;
import src.domain.sessionplanner.model.session.repository.SessionEncounterFactsRepository;
import src.domain.sessionplanner.model.session.repository.SessionPlanRepository;
import src.domain.sessionplanner.model.session.repository.SessionPartyFactsRepository;
import src.domain.sessionplanner.model.session.repository.SessionPlannerPublishedStateRepository;

@SuppressWarnings({
        "PMD.CouplingBetweenObjects",
        "PMD.TooManyMethods"
})
public final class SessionPlannerPublishedStateRepositoryAdapter implements SessionPlannerPublishedStateRepository {

    private static final String LISTENER_PARAMETER = "listener";

    private final SessionPlanRepository repository;
    private final SessionPartyFactsPort partyFactsPort;
    private final SessionPartyFactsRepository partyFactsRepository;
    private final SessionEncounterFactsPort encounterFactsPort;
    private final SessionEncounterFactsRepository encounterFactsRepository;
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
            SessionPartyFactsPort partyFacts,
            SessionPartyFactsRepository partyFactsRepository,
            SessionEncounterFactsPort encounterFacts,
            SessionEncounterFactsRepository encounterFactsRepository
    ) {
        this.repository = Objects.requireNonNull(repository, "repository");
        this.partyFactsPort = Objects.requireNonNull(partyFacts, "partyFacts");
        this.partyFactsRepository = Objects.requireNonNull(partyFactsRepository, "partyFactsRepository");
        this.encounterFactsPort = Objects.requireNonNull(encounterFacts, "encounterFacts");
        this.encounterFactsRepository = Objects.requireNonNull(encounterFactsRepository, "encounterFactsRepository");
    }

    @Override
    public void publishCurrentSession(SessionPlan sessionPlan) {
        SessionPlan safeSession = Objects.requireNonNull(sessionPlan, "sessionPlan");
        currentSessionSnapshot = projector.projectSession(
                safeSession,
                partyFactsPort,
                partyFactsRepository,
                encounterFactsPort,
                encounterFactsRepository);
        currentParticipantsProjection = projector.projectParticipants(safeSession, partyFactsPort);
        currentEncountersProjection = projector.projectEncounters(
                safeSession,
                partyFactsPort,
                partyFactsRepository,
                encounterFactsPort,
                encounterFactsRepository);
        currentStatePanelProjection = projector.projectStatePanel(
                safeSession,
                partyFactsPort,
                partyFactsRepository,
                encounterFactsPort,
                encounterFactsRepository);
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
        Consumer<SessionPlannerSessionSnapshot> safeListener = Objects.requireNonNull(listener, LISTENER_PARAMETER);
        sessionListeners.add(safeListener);
        return () -> sessionListeners.remove(safeListener);
    }

    private Runnable subscribeParticipantsListener(Consumer<SessionPlannerParticipantsProjection> listener) {
        Consumer<SessionPlannerParticipantsProjection> safeListener = Objects.requireNonNull(listener, LISTENER_PARAMETER);
        participantsListeners.add(safeListener);
        return () -> participantsListeners.remove(safeListener);
    }

    private Runnable subscribeEncountersListener(Consumer<SessionPlannerEncountersProjection> listener) {
        Consumer<SessionPlannerEncountersProjection> safeListener = Objects.requireNonNull(listener, LISTENER_PARAMETER);
        encountersListeners.add(safeListener);
        return () -> encountersListeners.remove(safeListener);
    }

    private Runnable subscribeStatePanelListener(Consumer<SessionPlannerStatePanelProjection> listener) {
        Consumer<SessionPlannerStatePanelProjection> safeListener = Objects.requireNonNull(listener, LISTENER_PARAMETER);
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
