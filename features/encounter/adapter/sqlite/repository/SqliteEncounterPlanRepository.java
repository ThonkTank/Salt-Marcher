package features.encounter.adapter.sqlite.repository;

import features.encounter.adapter.sqlite.gateway.local.SqliteEncounterLocalGateway;
import features.encounter.adapter.sqlite.mapper.EncounterPlanMapper;
import features.encounter.adapter.sqlite.model.EncounterPlanCreatureRecord;
import features.encounter.adapter.sqlite.model.EncounterPlanRecord;
import features.encounter.adapter.sqlite.model.EncounterPlanSnapshotRecord;
import features.encounter.domain.plan.EncounterPlan;
import features.encounter.domain.plan.EncounterPlanSummary;
import features.encounter.domain.plan.repository.EncounterPlanRepository;

import platform.persistence.FeatureStoreDefinition;
import platform.persistence.FeatureStoreHandle;

import java.util.List;
import java.util.Objects;
import java.util.Optional;

public final class SqliteEncounterPlanRepository
        implements EncounterPlanRepository, features.encounter.application.GeneratedEncounterBatchRepository {

    private final SqliteEncounterLocalGateway gateway;

    public static FeatureStoreDefinition storeDefinition() {
        return SqliteEncounterLocalGateway.storeDefinition();
    }

    public SqliteEncounterPlanRepository(FeatureStoreHandle store) {
        this(new SqliteEncounterLocalGateway(store));
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
        return EncounterPlanMapper.toDomainPlan(saved);
    }

    @Override
    public Optional<EncounterPlan> load(long planId) {
        return gateway.load(planId)
                .map(EncounterPlanMapper::toDomainPlan);
    }

    @Override
    public List<EncounterPlanSummary> list() {
        return gateway.list().stream()
                .map(EncounterPlanMapper::toDomainSummary)
                .toList();
    }

    @Override
    public features.encounter.application.GeneratedEncounterBatchRepository.CommitOutcome commit(
            features.encounter.api.PreparedEncounterBatch batch
    ) {
        return gateway.commitGeneratedBatch(batch);
    }

    @Override
    public List<EncounterPlan> loadPlansByIds(List<Long> planIds) {
        return gateway.loadPlansByIds(planIds).stream()
                .map(EncounterPlanMapper::toDomainPlan)
                .toList();
    }

    private static List<EncounterPlanCreatureRecord> toRecords(EncounterPlan plan) {
        return plan.creatures().stream()
                .map(creature -> new EncounterPlanCreatureRecord(
                        creature.creatureId(),
                        creature.quantity(),
                        0,
                        creature.lastKnownDisplayName()))
                .toList();
    }
}
