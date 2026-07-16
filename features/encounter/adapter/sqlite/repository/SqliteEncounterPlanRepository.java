package features.encounter.adapter.sqlite.repository;

import java.util.List;
import java.util.Objects;
import java.util.Optional;
import platform.persistence.SqliteDatabase;
import features.encounter.adapter.sqlite.gateway.local.SqliteEncounterLocalGateway;
import features.encounter.adapter.sqlite.mapper.EncounterPlanMapper;
import features.encounter.adapter.sqlite.model.EncounterPlanCreatureRecord;
import features.encounter.adapter.sqlite.model.EncounterPlanRecord;
import features.encounter.adapter.sqlite.model.EncounterPlanSnapshotRecord;
import features.encounter.domain.plan.EncounterPlan;
import features.encounter.domain.plan.repository.EncounterPlanRepository;
import features.encounter.domain.plan.EncounterPlanSummary;

public final class SqliteEncounterPlanRepository implements EncounterPlanRepository {

    private final SqliteEncounterLocalGateway gateway;

    public SqliteEncounterPlanRepository() {
        this(new SqliteEncounterLocalGateway());
    }

    public SqliteEncounterPlanRepository(SqliteDatabase database) {
        this(new SqliteEncounterLocalGateway(database));
    }

    SqliteEncounterPlanRepository(SqliteEncounterLocalGateway gateway) {
        this.gateway = Objects.requireNonNull(gateway, "gateway");
    }

    @Override
    public EncounterPlan save(EncounterPlan plan) {
        Objects.requireNonNull(plan, "plan");
        EncounterPlanSnapshotRecord saved = gateway.save(
                new EncounterPlanRecord(
                        plan.id(),
                        plan.name(),
                        plan.generatedLabel(),
                        plan.creatureCount()),
                toRecords(plan));
        return EncounterPlanMapper.toDomainPlan(saved.plan(), saved.creatures());
    }

    @Override
    public Optional<EncounterPlan> load(long planId) {
        return gateway.load(planId)
                .map(saved -> EncounterPlanMapper.toDomainPlan(saved.plan(), saved.creatures()));
    }

    @Override
    public List<EncounterPlanSummary> list() {
        return gateway.list().stream()
                .map(EncounterPlanMapper::toDomainSummary)
                .toList();
    }

    private static List<EncounterPlanCreatureRecord> toRecords(EncounterPlan plan) {
        return plan.creatures().stream()
                .map(creature -> new EncounterPlanCreatureRecord(
                        creature.creatureId(),
                        creature.quantity(),
                        0))
                .toList();
    }
}
