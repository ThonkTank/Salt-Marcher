package src.data.sessionplanner.runtime;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.function.Consumer;
import org.jspecify.annotations.Nullable;
import src.domain.sessionplanner.application.CurrentSessionPlanRuntimeAccess;
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
import src.domain.sessionplanner.session.port.SessionPlannerRuntimeRepository;

public final class SessionPlannerBoundaryRuntimeAdapter implements SessionPlannerRuntimeRepository {

    private final SessionPlanRepository repository;
    private final SessionPartyFactsLookup partyFacts;
    private final SessionEncounterFactsLookup encounterFacts;
    private final CurrentSessionPlanRuntimeAccess runtime;
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
    private @Nullable SessionPlannerPublishedState currentPublishedState;

    public SessionPlannerBoundaryRuntimeAdapter(
            SessionPlanRepository repository,
            SessionPartyFactsLookup partyFacts,
            SessionEncounterFactsLookup encounterFacts
    ) {
        this.repository = Objects.requireNonNull(repository, "repository");
        this.partyFacts = Objects.requireNonNull(partyFacts, "partyFacts");
        this.encounterFacts = Objects.requireNonNull(encounterFacts, "encounterFacts");
        this.runtime = new CurrentSessionPlanRuntimeAccess(this, this, this);
    }

    @Override
    public Optional<SessionPlan> loadCurrent() {
        return repository.loadCurrent();
    }

    @Override
    public SessionPlan save(SessionPlan sessionPlan) {
        return repository.save(sessionPlan);
    }

    @Override
    public long nextSessionId() {
        return repository.nextSessionId();
    }

    @Override
    public void setCurrentSessionId(long sessionId) {
        repository.setCurrentSessionId(sessionId);
    }

    @Override
    public ActivePartyMembersFact loadActivePartyMembers() {
        return partyFacts.loadActivePartyMembers();
    }

    @Override
    public AdventuringDayFact calculateAdventuringDay(List<Integer> levels, int plannedEncounterXp) {
        return partyFacts.calculateAdventuringDay(levels, plannedEncounterXp);
    }

    @Override
    public EncounterPlanListFact listEncounterPlans() {
        return encounterFacts.listEncounterPlans();
    }

    @Override
    public EncounterPlanFact loadEncounterPlan(long encounterPlanId) {
        return encounterFacts.loadEncounterPlan(encounterPlanId);
    }

    @Override
    public void publishCurrentSession(SessionPlan sessionPlan) {
        currentPublishedState = projector.project(Objects.requireNonNull(sessionPlan, "sessionPlan"), this, this);
        notifySessionListeners(currentPublishedState.session());
        notifyParticipantsListeners(currentPublishedState.participants());
        notifyEncountersListeners(currentPublishedState.encounters());
        notifyStatePanelListeners(currentPublishedState.statePanel());
    }

    private SessionPlannerSessionSnapshot currentSessionSnapshot() {
        return requirePublishedState().session();
    }

    private SessionPlannerParticipantsProjection currentParticipantsProjection() {
        return requirePublishedState().participants();
    }

    private SessionPlannerEncountersProjection currentEncountersProjection() {
        return requirePublishedState().encounters();
    }

    private SessionPlannerStatePanelProjection currentStatePanelProjection() {
        return requirePublishedState().statePanel();
    }

    private SessionPlannerPublishedState requirePublishedState() {
        if (currentPublishedState == null) {
            publishCurrentSession(runtime.loadOrCreateCurrent());
        }
        return Objects.requireNonNull(currentPublishedState, "currentPublishedState");
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
        List<Consumer<SessionPlannerSessionSnapshot>> listeners = List.copyOf(sessionListeners);
        for (Consumer<SessionPlannerSessionSnapshot> listener : listeners) {
            listener.accept(snapshot);
        }
    }

    private void notifyParticipantsListeners(SessionPlannerParticipantsProjection projection) {
        List<Consumer<SessionPlannerParticipantsProjection>> listeners = List.copyOf(participantsListeners);
        for (Consumer<SessionPlannerParticipantsProjection> listener : listeners) {
            listener.accept(projection);
        }
    }

    private void notifyEncountersListeners(SessionPlannerEncountersProjection projection) {
        List<Consumer<SessionPlannerEncountersProjection>> listeners = List.copyOf(encountersListeners);
        for (Consumer<SessionPlannerEncountersProjection> listener : listeners) {
            listener.accept(projection);
        }
    }

    private void notifyStatePanelListeners(SessionPlannerStatePanelProjection projection) {
        List<Consumer<SessionPlannerStatePanelProjection>> listeners = List.copyOf(statePanelListeners);
        for (Consumer<SessionPlannerStatePanelProjection> listener : listeners) {
            listener.accept(projection);
        }
    }
}
