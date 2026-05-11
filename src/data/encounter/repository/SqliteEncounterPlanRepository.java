package src.data.encounter.repository;

import java.util.List;
import java.util.Objects;
import java.util.Optional;
import src.data.encounter.gateway.local.SqliteEncounterLocalGateway;
import src.data.encounter.mapper.EncounterPlanMapper;
import src.data.encounter.model.EncounterPlanCreatureRecord;
import src.data.encounter.model.EncounterPlanRecord;
import src.data.encounter.model.EncounterPlanSnapshotRecord;
import src.domain.encounter.model.plan.model.EncounterPlan;
import src.domain.encounter.model.plan.repository.EncounterPlanRepository;
import src.domain.encounter.model.plan.model.EncounterPlanSummary;

public final class SqliteEncounterPlanRepository implements EncounterPlanRepository {

    private final SqliteEncounterLocalGateway gateway;

    public SqliteEncounterPlanRepository() {
        this(new SqliteEncounterLocalGateway());
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
