package src.data.sessionplanner.repository;

import java.util.Objects;
import java.util.Optional;
import src.data.sessionplanner.gateway.local.SqliteSessionPlannerLocalGateway;
import src.data.sessionplanner.mapper.SessionPlanMapper;
import src.domain.sessionplanner.model.session.SessionPlan;
import src.domain.sessionplanner.model.session.repository.SessionPlanRepository;

public final class SqliteSessionPlanRepository implements SessionPlanRepository {

    private final SqliteSessionPlannerLocalGateway gateway;

    public SqliteSessionPlanRepository() {
        this(new SqliteSessionPlannerLocalGateway());
    }

    SqliteSessionPlanRepository(SqliteSessionPlannerLocalGateway gateway) {
        this.gateway = Objects.requireNonNull(gateway, "gateway");
    }

    @Override
    public Optional<SessionPlan> loadCurrent() {
        return gateway.loadCurrent().map(SessionPlanMapper::toDomain);
    }

    @Override
    public SessionPlan save(SessionPlan sessionPlan) {
        Objects.requireNonNull(sessionPlan, "sessionPlan");
        return SessionPlanMapper.toDomain(gateway.save(SessionPlanMapper.toSnapshot(sessionPlan)));
    }

    @Override
    public long nextSessionId() {
        return gateway.nextSessionId();
    }

    @Override
    public void setCurrentSessionId(long sessionId) {
        gateway.setCurrentSessionId(sessionId);
    }
}
