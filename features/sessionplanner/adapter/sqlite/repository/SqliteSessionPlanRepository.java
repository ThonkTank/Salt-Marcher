package features.sessionplanner.adapter.sqlite.repository;

import java.util.List;
import java.util.Objects;
import java.util.Optional;
import platform.persistence.SqliteDatabase;
import features.sessionplanner.adapter.sqlite.gateway.local.SqliteSessionPlannerLocalGateway;
import features.sessionplanner.adapter.sqlite.mapper.SessionPlanMapper;
import features.sessionplanner.domain.session.SessionPlan;
import features.sessionplanner.domain.session.SessionPlanSummary;
import features.sessionplanner.domain.session.repository.SessionPlanRepository;

public final class SqliteSessionPlanRepository implements SessionPlanRepository {

    private final SqliteSessionPlannerLocalGateway gateway;

    public SqliteSessionPlanRepository() {
        this(new SqliteSessionPlannerLocalGateway());
    }

    public SqliteSessionPlanRepository(SqliteDatabase database) {
        this(new SqliteSessionPlannerLocalGateway(database));
    }

    SqliteSessionPlanRepository(SqliteSessionPlannerLocalGateway gateway) {
        this.gateway = Objects.requireNonNull(gateway, "gateway");
    }

    @Override
    public Optional<SessionPlan> loadCurrent() {
        return gateway.loadCurrent().map(SessionPlanMapper::toDomain);
    }

    @Override
    public Optional<SessionPlan> loadById(long sessionId) {
        return gateway.loadSession(sessionId).map(SessionPlanMapper::toDomain);
    }

    @Override
    public List<SessionPlanSummary> listSessions() {
        return gateway.listSessions().stream()
                .map(record -> new SessionPlanSummary(record.sessionId(), record.displayName()))
                .toList();
    }

    @Override
    public SessionPlan save(SessionPlan sessionPlan) {
        Objects.requireNonNull(sessionPlan, "sessionPlan");
        return SessionPlanMapper.toDomain(gateway.save(SessionPlanMapper.toSnapshot(sessionPlan)));
    }

    @Override
    public void rename(long sessionId, String displayName) {
        gateway.renameSession(sessionId, displayName);
    }

    @Override
    public void delete(long sessionId) {
        gateway.deleteSession(sessionId);
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
