package src.domain.encounter;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.jspecify.annotations.Nullable;
import src.domain.creatures.CreaturesApplicationService;
import src.domain.creatures.published.CreatureDetailResult;
import src.domain.creatures.published.CreatureLookupStatus;
import src.domain.creatures.published.LoadCreatureDetailQuery;
import src.domain.encounter.application.EncounterGenerationUseCase;
import src.domain.encounter.application.ListSavedEncounterPlansUseCase;
import src.domain.encounter.application.LoadEncounterBudgetUseCase;
import src.domain.encounter.application.LoadSavedEncounterPlanUseCase;
import src.domain.encounter.application.SaveEncounterPlanUseCase;
import src.domain.encounter.generation.value.EncounterGenerationRequest;
import src.domain.encounter.session.entity.EncounterSessionRuntimeData;
import src.domain.encounter.session.entity.EncounterSessionViewState;
import src.domain.encounter.session.service.EncounterSessionRuntimeAccess;
import src.domain.party.PartyApplicationService;
import src.domain.party.published.ActivePartyResult;
import src.domain.party.published.AwardPartyXpCommand;
import src.domain.party.published.LoadActivePartyQuery;
import src.domain.party.published.MutationResult;
import src.domain.party.published.MutationStatus;
import src.domain.party.published.PartyMemberSummary;
import src.domain.party.published.ReadStatus;

final class EncounterSessionRuntimeAccessAdapter implements EncounterSessionRuntimeAccess {

    private final PartyApplicationService party;
    private final CreaturesApplicationService creatures;
    private final @Nullable EncounterGenerationUseCase generator;
    private final @Nullable LoadEncounterBudgetUseCase loadBudgetUseCase;
    private final @Nullable SaveEncounterPlanUseCase savePlanUseCase;
    private final @Nullable LoadSavedEncounterPlanUseCase loadSavedPlanUseCase;
    private final @Nullable ListSavedEncounterPlansUseCase listSavedPlansUseCase;

    EncounterSessionRuntimeAccessAdapter(
            PartyApplicationService party,
            CreaturesApplicationService creatures,
            @Nullable EncounterGenerationUseCase generator,
            @Nullable LoadEncounterBudgetUseCase loadBudgetUseCase,
            @Nullable SaveEncounterPlanUseCase savePlanUseCase,
            @Nullable LoadSavedEncounterPlanUseCase loadSavedPlanUseCase,
            @Nullable ListSavedEncounterPlansUseCase listSavedPlansUseCase
    ) {
        this.party = party;
        this.creatures = creatures;
        this.generator = generator;
        this.loadBudgetUseCase = loadBudgetUseCase;
        this.savePlanUseCase = savePlanUseCase;
        this.loadSavedPlanUseCase = loadSavedPlanUseCase;
        this.listSavedPlansUseCase = listSavedPlansUseCase;
    }

    @Override
    public List<EncounterSessionViewState.PartyMemberData> loadActiveParty() {
        ActivePartyResult result = party.loadActiveParty(new LoadActivePartyQuery());
        if (result.status() != ReadStatus.SUCCESS) {
            return List.of();
        }
        List<EncounterSessionViewState.PartyMemberData> members = new ArrayList<>();
        for (PartyMemberSummary member : result.members()) {
            if (member != null && member.id() != null) {
                members.add(new EncounterSessionViewState.PartyMemberData(
                        "pc-" + member.id(),
                        member.id(),
                        member.name(),
                        member.level()));
            }
        }
        return List.copyOf(members);
    }

    @Override
    public Optional<EncounterSessionRuntimeData.BudgetData> loadBudget() {
        LoadEncounterBudgetUseCase useCase = loadBudgetUseCase;
        if (useCase == null) {
            return Optional.empty();
        }
        try {
            LoadEncounterBudgetUseCase.Result result = useCase.execute();
            return result.status() == LoadEncounterBudgetUseCase.Status.SUCCESS && result.budget() != null
                    ? Optional.of(EncounterSessionRuntimeMapper.toSessionBudget(result.budget()))
                    : Optional.empty();
        } catch (RuntimeException exception) {
            return Optional.empty();
        }
    }

    @Override
    public EncounterSessionRuntimeData.GenerationResultData generate(EncounterGenerationRequest request) {
        EncounterGenerationUseCase useCase = generator;
        if (useCase == null) {
            return new EncounterSessionRuntimeData.GenerationResultData(
                    EncounterSessionRuntimeData.GenerationStatus.STORAGE_ERROR,
                    List.of(),
                    "Encounter generator service is not registered.",
                    Optional.empty(),
                    false);
        }
        try {
            return EncounterSessionRuntimeMapper.toSessionGenerationResult(useCase.execute(request));
        } catch (RuntimeException exception) {
            return new EncounterSessionRuntimeData.GenerationResultData(
                    EncounterSessionRuntimeData.GenerationStatus.STORAGE_ERROR,
                    List.of(),
                    "Encounter generation failed.",
                    Optional.empty(),
                    false);
        }
    }

    @Override
    public EncounterSessionRuntimeData.SavePlanOutcome savePlan(EncounterSessionRuntimeData.SavedPlanData plan) {
        SaveEncounterPlanUseCase useCase = savePlanUseCase;
        if (useCase == null) {
            return new EncounterSessionRuntimeData.SavePlanOutcome(
                    EncounterSessionRuntimeData.SavedPlanStatus.STORAGE_ERROR,
                    Optional.empty(),
                    "Encounter plan storage is not registered.");
        }
        SaveEncounterPlanUseCase.Result result = useCase.execute(
                Math.max(0L, plan.id()),
                plan.name(),
                plan.generatedLabel(),
                plan.creatures().stream()
                        .map(EncounterSessionRuntimeMapper::toPlanCreature)
                        .toList());
        return new EncounterSessionRuntimeData.SavePlanOutcome(
                EncounterSessionRuntimeMapper.toSessionSavePlanStatus(result.status()),
                result.plan() == null ? Optional.empty() : Optional.of(EncounterSessionRuntimeMapper.toSessionSavedPlan(result.plan())),
                result.message());
    }

    @Override
    public EncounterSessionRuntimeData.LoadPlanOutcome loadPlan(long planId) {
        LoadSavedEncounterPlanUseCase useCase = loadSavedPlanUseCase;
        if (useCase == null) {
            return new EncounterSessionRuntimeData.LoadPlanOutcome(
                    EncounterSessionRuntimeData.SavedPlanStatus.STORAGE_ERROR,
                    Optional.empty(),
                    "Encounter plan storage is not registered.");
        }
        LoadSavedEncounterPlanUseCase.Result result = useCase.execute(planId);
        return new EncounterSessionRuntimeData.LoadPlanOutcome(
                EncounterSessionRuntimeMapper.toSessionLoadPlanStatus(result.status()),
                result.plan() == null ? Optional.empty() : Optional.of(EncounterSessionRuntimeMapper.toSessionSavedPlan(result.plan())),
                result.message());
    }

    @Override
    public EncounterSessionRuntimeData.ListPlansOutcome listPlans() {
        ListSavedEncounterPlansUseCase useCase = listSavedPlansUseCase;
        if (useCase == null) {
            return new EncounterSessionRuntimeData.ListPlansOutcome(
                    EncounterSessionRuntimeData.SavedPlanStatus.STORAGE_ERROR,
                    List.of(),
                    "Encounter plan storage is not registered.");
        }
        ListSavedEncounterPlansUseCase.Result result = useCase.execute();
        return new EncounterSessionRuntimeData.ListPlansOutcome(
                EncounterSessionRuntimeMapper.toSessionListPlansStatus(result.status()),
                result.plans().stream().map(EncounterSessionRuntimeMapper::toSessionSavedPlanSummary).toList(),
                result.message());
    }

    @Override
    public Optional<EncounterSessionRuntimeData.CreatureDetailData> loadCreature(long creatureId) {
        CreatureDetailResult result = creatures.loadCreatureDetail(new LoadCreatureDetailQuery(creatureId));
        if (result.status() != CreatureLookupStatus.SUCCESS || result.detail() == null) {
            return Optional.empty();
        }
        return Optional.of(EncounterSessionRuntimeMapper.toSessionCreatureDetail(result.detail()));
    }

    @Override
    public EncounterSessionRuntimeData.AwardXpOutcome awardXp(List<Long> partyMemberIds, int xpPerCharacter) {
        MutationResult result = party.awardXp(new AwardPartyXpCommand(partyMemberIds, xpPerCharacter));
        return new EncounterSessionRuntimeData.AwardXpOutcome(result != null && result.status() == MutationStatus.SUCCESS);
    }
}
