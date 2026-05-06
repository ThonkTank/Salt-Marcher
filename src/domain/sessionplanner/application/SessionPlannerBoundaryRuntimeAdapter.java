package src.domain.sessionplanner.application;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.function.Consumer;
import org.jspecify.annotations.Nullable;
import src.domain.sessionplanner.published.SessionPlannerModel;
import src.domain.sessionplanner.published.SessionPlannerSnapshot;
import src.domain.sessionplanner.session.aggregate.SessionPlan;
import src.domain.sessionplanner.session.port.SessionEncounterFactsLookup;
import src.domain.sessionplanner.session.port.SessionPartyFactsLookup;
import src.domain.sessionplanner.session.port.SessionPlanRepository;
import src.domain.sessionplanner.session.port.SessionPlannerPublishedStatePort;

public final class SessionPlannerBoundaryRuntimeAdapter
        implements SessionPlanRepository, SessionPartyFactsLookup, SessionEncounterFactsLookup, SessionPlannerPublishedStatePort {

    private final SessionPlanRepository repository;
    private final SessionPartyFactsLookup partyFacts;
    private final SessionEncounterFactsLookup encounterFacts;
    private final CurrentSessionPlanRuntimeAccess runtime;
    private final SessionPlannerSnapshotProjector projector = new SessionPlannerSnapshotProjector();
    private final List<Consumer<SessionPlannerSnapshot>> sessionListeners = new ArrayList<>();
    public final SessionPlannerModel sessionModel = new SessionPlannerModel(
            this::currentSnapshot,
            this::subscribeSessionListener);
    private @Nullable SessionPlannerSnapshot currentSnapshot;

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
        currentSnapshot = projector.project(Objects.requireNonNull(sessionPlan, "sessionPlan"), this, this);
        notifySessionListeners(currentSnapshot);
    }

    @Override
    public void refreshPublishedState() {
        publishCurrentSession(runtime.reloadCurrent());
    }

    private SessionPlannerSnapshot currentSnapshot() {
        if (currentSnapshot == null) {
            publishCurrentSession(runtime.loadOrCreateCurrent());
        }
        return Objects.requireNonNull(currentSnapshot, "currentSnapshot");
    }

    private Runnable subscribeSessionListener(Consumer<SessionPlannerSnapshot> listener) {
        Consumer<SessionPlannerSnapshot> safeListener = Objects.requireNonNull(listener, "listener");
        sessionListeners.add(safeListener);
        return () -> sessionListeners.remove(safeListener);
    }

    private void notifySessionListeners(SessionPlannerSnapshot snapshot) {
        List<Consumer<SessionPlannerSnapshot>> listeners = List.copyOf(sessionListeners);
        for (Consumer<SessionPlannerSnapshot> listener : listeners) {
            listener.accept(snapshot);
        }
    }
}
