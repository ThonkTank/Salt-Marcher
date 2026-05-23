package src.domain.encounter;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import shell.api.ServiceRegistry;
import src.domain.creatures.CreaturesApplicationService;
import src.domain.creatures.published.CreatureActionDetail;
import src.domain.creatures.published.CreatureDetail;
import src.domain.creatures.published.CreatureDetailModel;
import src.domain.creatures.published.CreatureDetailResult;
import src.domain.creatures.published.CreatureEncounterCandidate;
import src.domain.creatures.published.CreatureEncounterCandidatesModel;
import src.domain.creatures.published.CreatureEncounterCandidatesResult;
import src.domain.creatures.published.CreatureLookupStatus;
import src.domain.creatures.published.CreatureQueryStatus;
import src.domain.creatures.published.RefreshCreatureEncounterCandidatesCommand;
import src.domain.creatures.published.SelectCreatureDetailCommand;
import src.domain.encounter.application.ApplyEncounterStateUseCase;
import src.domain.encounter.model.generation.model.EncounterCandidateProfile;
import src.domain.encounter.model.generation.model.EncounterCreatureFacts;
import src.domain.encounter.model.generation.usecase.EncounterGenerationUseCase;
import src.domain.encounter.model.plan.repository.EncounterPlanRepository;
import src.domain.encounter.model.plan.usecase.ListSavedEncounterPlansUseCase;
import src.domain.encounter.model.plan.usecase.LoadEncounterPlanBudgetUseCase;
import src.domain.encounter.model.plan.usecase.LoadSavedEncounterPlanUseCase;
import src.domain.encounter.model.plan.usecase.PublishEncounterPlanBudgetUseCase;
import src.domain.encounter.model.plan.usecase.PublishEncounterSavedPlansUseCase;
import src.domain.encounter.model.plan.usecase.SaveEncounterPlanUseCase;
import src.domain.encounter.model.reference.port.ApplicationEncounterCreatureCatalogPort;
import src.domain.encounter.model.reference.port.ApplicationEncounterTableCandidatePort;
import src.domain.encounter.model.reference.model.EncounterCreatureCandidateCriteria;
import src.domain.encounter.model.reference.model.EncounterCreatureReference;
import src.domain.encounter.model.reference.model.EncounterTableCandidateCriteria;
import src.domain.encounter.model.reference.repository.EncounterCreatureRepository;
import src.domain.encounter.model.reference.repository.EncounterTableCandidateRepository;
import src.domain.encounter.model.session.repository.EncounterPartyFactsRepository;
import src.domain.encounter.model.session.repository.EncounterSessionRepository;
import src.domain.encounter.model.session.repository.EncounterSessionUseCaseAdaptersRepository;
import src.domain.encounter.model.session.usecase.ApplyEncounterSessionUseCase;
import src.domain.encounter.model.session.usecase.LoadEncounterBudgetUseCase;
import src.domain.encounter.model.session.usecase.PublishEncounterSessionUseCase;
import src.domain.encounter.model.session.usecase.UpdateEncounterBuilderInputsUseCase;
import src.domain.encountertable.EncounterTableApplicationService;
import src.domain.encountertable.published.EncounterTableCandidate;
import src.domain.encountertable.published.EncounterTableCandidatesModel;
import src.domain.encountertable.published.EncounterTableCandidatesResult;
import src.domain.encountertable.published.EncounterTableReadStatus;
import src.domain.encountertable.published.RefreshEncounterTableCandidatesCommand;
import src.domain.party.published.ActivePartyCompositionModel;
import src.domain.party.published.ActivePartyCompositionResult;
import src.domain.party.published.ActivePartyModel;
import src.domain.party.published.ActivePartyResult;
import src.domain.party.published.AdventuringDayResult;
import src.domain.party.published.AdventuringDaySummaryModel;
import src.domain.party.published.AwardPartyXpCommand;
import src.domain.party.published.MutationStatus;
import src.domain.party.published.PartyMemberSummary;
import src.domain.party.published.PartyMutationModel;
import src.domain.party.published.ReadStatus;

final class EncounterServiceAssembly {

    private final EncounterPublishedStateServiceAssembly publishedState =
            new EncounterPublishedStateServiceAssembly();

    EncounterApplicationService createApplicationService(ServiceRegistry services) {
        EncounterPlanRepository repository = services.require(EncounterPlanRepository.class);
        ActivePartyModel activePartyModel = services.require(ActivePartyModel.class);
        ActivePartyCompositionModel activePartyCompositionModel = services.require(ActivePartyCompositionModel.class);
        AdventuringDaySummaryModel adventuringDaySummaryModel = services.require(AdventuringDaySummaryModel.class);
        PartyMutationModel partyMutationModel = services.require(PartyMutationModel.class);
        EncounterPartyFactsRepository party = new EncounterPartyFactsApplicationRepository(
                () -> loadPartyBudgetFacts(activePartyCompositionModel, adventuringDaySummaryModel),
                () -> loadActiveParty(activePartyModel),
                services.require(src.domain.party.PartyApplicationService.class),
                () -> partyMutationModel.current().status() == MutationStatus.SUCCESS);
        EncounterCreatureRepository creatures = new EncounterCreatureRequestRepository(
                services.require(CreaturesApplicationService.class));
        ApplicationEncounterCreatureCatalogPort creatureCatalog = new EncounterCreatureCatalogPort(
                services.require(CreatureDetailModel.class),
                services.require(CreatureEncounterCandidatesModel.class));
        EncounterTableCandidateRepository encounterTables = new EncounterTableCandidateRequestRepository(
                services.require(EncounterTableApplicationService.class));
        ApplicationEncounterTableCandidatePort tableCandidates =
                new EncounterTableCandidatePort(
                        services.require(EncounterTableCandidatesModel.class));
        return create(repository, party, creatures, creatureCatalog, encounterTables, tableCandidates, publishedState);
    }

    src.domain.encounter.published.EncounterStateModel stateModel(ServiceRegistry services) {
        return publishedState.stateModel();
    }

    src.domain.encounter.published.EncounterBuilderInputsModel builderInputsModel(ServiceRegistry services) {
        return publishedState.builderInputsModel();
    }

    src.domain.encounter.published.EncounterTuningPreviewModel tuningPreviewModel(ServiceRegistry services) {
        return publishedState.tuningPreviewModel();
    }

    src.domain.encounter.published.SavedEncounterPlanListModel savedPlansModel(ServiceRegistry services) {
        return publishedState.savedPlansModel();
    }

    src.domain.encounter.published.EncounterPlanBudgetModel planBudgetModel(ServiceRegistry services) {
        return publishedState.planBudgetModel();
    }

    private static final long INITIAL_PLAN_ID = 0L;

    private static src.domain.encounter.model.session.model.PartyBudgetFacts loadPartyBudgetFacts(
            ActivePartyCompositionModel activePartyCompositionModel,
            AdventuringDaySummaryModel adventuringDaySummaryModel
    ) {
        ActivePartyCompositionResult compositionResult = activePartyCompositionModel.current();
        AdventuringDayResult adventuringDayResult = adventuringDaySummaryModel.current();
        if (compositionResult.status() != ReadStatus.SUCCESS || adventuringDayResult.status() != ReadStatus.SUCCESS) {
            return src.domain.encounter.model.session.model.PartyBudgetFacts.storageError();
        }
        List<Integer> activeLevels = compositionResult.composition().activePartyLevels();
        if (activeLevels.isEmpty()) {
            return src.domain.encounter.model.session.model.PartyBudgetFacts.noActiveParty();
        }
        return src.domain.encounter.model.session.model.PartyBudgetFacts.success(
                activeLevels,
                compositionResult.composition().averageLevel(),
                adventuringDayResult.summary().consumedXp(),
                adventuringDayResult.summary().totalBudgetXp());
    }

    private static List<src.domain.encounter.model.session.model.PartyMemberData> loadActiveParty(
            ActivePartyModel activePartyModel
    ) {
        ActivePartyResult result = activePartyModel.current();
        if (result.status() != ReadStatus.SUCCESS) {
            return List.of();
        }
        List<src.domain.encounter.model.session.model.PartyMemberData> members = new ArrayList<>();
        for (PartyMemberSummary member : result.members()) {
            if (member != null) {
                members.add(toPartyMemberData(member));
            }
        }
        return List.copyOf(members);
    }

    private static src.domain.encounter.model.session.model.PartyMemberData toPartyMemberData(
            PartyMemberSummary member
    ) {
        return new src.domain.encounter.model.session.model.PartyMemberData(
                "pc-" + member.id(),
                member.id(),
                member.name(),
                member.level());
    }

    private static final class EncounterPartyFactsApplicationRepository implements EncounterPartyFactsRepository {

        private final java.util.function.Supplier<src.domain.encounter.model.session.model.PartyBudgetFacts>
                partyBudgetFacts;
        private final java.util.function.Supplier<List<src.domain.encounter.model.session.model.PartyMemberData>>
                activeParty;
        private final src.domain.party.PartyApplicationService party;
        private final java.util.function.BooleanSupplier xpAwardSucceeded;

        EncounterPartyFactsApplicationRepository(
                java.util.function.Supplier<src.domain.encounter.model.session.model.PartyBudgetFacts> partyBudgetFacts,
                java.util.function.Supplier<List<src.domain.encounter.model.session.model.PartyMemberData>> activeParty,
                src.domain.party.PartyApplicationService party,
                java.util.function.BooleanSupplier xpAwardSucceeded
        ) {
            this.partyBudgetFacts = Objects.requireNonNull(partyBudgetFacts, "partyBudgetFacts");
            this.activeParty = Objects.requireNonNull(activeParty, "activeParty");
            this.party = Objects.requireNonNull(party, "party");
            this.xpAwardSucceeded = Objects.requireNonNull(xpAwardSucceeded, "xpAwardSucceeded");
        }

        @Override
        public src.domain.encounter.model.session.model.PartyBudgetFacts loadPartyBudgetFacts() {
            return partyBudgetFacts.get();
        }

        @Override
        public List<src.domain.encounter.model.session.model.PartyMemberData> loadActiveParty() {
            return List.copyOf(activeParty.get());
        }

        @Override
        public boolean awardXp(List<Long> partyMemberIds, int xpPerCharacter) {
            party.awardXp(new AwardPartyXpCommand(partyMemberIds, xpPerCharacter));
            return xpAwardSucceeded.getAsBoolean();
        }
    }

    private static final class EncounterCreatureRequestRepository implements EncounterCreatureRepository {

        private static final int DEFAULT_LIMIT = 250;
        private static final int MAX_LIMIT = 1000;
        private static final long NO_CREATURE_ID = 0L;

        private final CreaturesApplicationService creatures;

        EncounterCreatureRequestRepository(CreaturesApplicationService creatures) {
            this.creatures = Objects.requireNonNull(creatures, "creatures");
        }

        @Override
        public void requestCreature(long creatureId) {
            if (creatureId > NO_CREATURE_ID) {
                creatures.selectCreatureDetail(new SelectCreatureDetailCommand(creatureId));
            }
        }

        @Override
        public void requestCandidates(EncounterCreatureCandidateCriteria criteria) {
            EncounterCreatureCandidateCriteria safeCriteria = criteria == null
                    ? new EncounterCreatureCandidateCriteria(List.of(), List.of(), List.of(), 0, 0, 0)
                    : criteria;
            int minimumXp = Math.max(0, safeCriteria.minimumXp());
            int maximumXp = safeCriteria.maximumXp() <= 0 ? Integer.MAX_VALUE : safeCriteria.maximumXp();
            if (minimumXp > maximumXp) {
                return;
            }
            creatures.refreshEncounterCandidates(new RefreshCreatureEncounterCandidatesCommand(
                    safeCriteria.creatureTypes(),
                    safeCriteria.creatureSubtypes(),
                    safeCriteria.biomes(),
                    minimumXp,
                    maximumXp,
                    normalizeLimit(safeCriteria.limit())));
        }

        private static int normalizeLimit(int limit) {
            if (limit <= 0) {
                return DEFAULT_LIMIT;
            }
            return Math.min(limit, MAX_LIMIT);
        }
    }

    private static final class EncounterTableCandidateRequestRepository implements EncounterTableCandidateRepository {

        private final EncounterTableApplicationService encounterTables;

        EncounterTableCandidateRequestRepository(EncounterTableApplicationService encounterTables) {
            this.encounterTables = Objects.requireNonNull(encounterTables, "encounterTables");
        }

        @Override
        public void requestCandidates(EncounterTableCandidateCriteria criteria) {
            EncounterTableCandidateCriteria safeCriteria =
                    criteria == null ? new EncounterTableCandidateCriteria(List.of(), 0) : criteria;
            List<Long> normalizedTableIds = new ArrayList<>();
            for (Long tableId : safeCriteria.tableIds()) {
                if (tableId != null && tableId > 0L && !normalizedTableIds.contains(tableId)) {
                    normalizedTableIds.add(tableId);
                }
            }
            if (normalizedTableIds.isEmpty()) {
                return;
            }
            int effectiveMaximumXp = safeCriteria.maximumXp() <= 0 ? Integer.MAX_VALUE : safeCriteria.maximumXp();
            encounterTables.refreshCandidates(new RefreshEncounterTableCandidatesCommand(
                    List.copyOf(normalizedTableIds),
                    effectiveMaximumXp));
        }
    }

    private static final class EncounterCreatureCatalogPort implements ApplicationEncounterCreatureCatalogPort {

        private final CreatureDetailModel detailModel;
        private final CreatureEncounterCandidatesModel candidatesModel;

        EncounterCreatureCatalogPort(
                CreatureDetailModel detailModel,
                CreatureEncounterCandidatesModel candidatesModel
        ) {
            this.detailModel = Objects.requireNonNull(detailModel, "detailModel");
            this.candidatesModel = Objects.requireNonNull(candidatesModel, "candidatesModel");
        }

        @Override
        public Optional<EncounterCreatureReference> loadCreature() {
            CreatureDetailResult result = detailModel.current();
            if (result.status() != CreatureLookupStatus.SUCCESS || result.detail() == null) {
                return Optional.empty();
            }
            return Optional.of(toReference(result.detail()));
        }

        @Override
        public List<EncounterCandidateProfile> loadCandidates() {
            CreatureEncounterCandidatesResult result = candidatesModel.current();
            if (result.status() != CreatureQueryStatus.SUCCESS) {
                return List.of();
            }
            List<EncounterCandidateProfile> candidates = new ArrayList<>();
            for (CreatureEncounterCandidate candidate : result.candidates()) {
                candidates.add(toProfile(candidate));
            }
            return List.copyOf(candidates);
        }

        private static EncounterCandidateProfile toProfile(CreatureEncounterCandidate candidate) {
            return EncounterCandidateProfile.fromFacts(
                    toFacts(candidate),
                    candidate.selectionWeight());
        }

        private static EncounterCreatureReference toReference(CreatureDetail detail) {
            List<String> actionTypes = new ArrayList<>();
            for (CreatureActionDetail action : detail.actions()) {
                actionTypes.add(action.actionType());
            }
            return new EncounterCreatureReference(
                    detail.id(),
                    detail.name(),
                    detail.creatureType(),
                    detail.challengeRating(),
                    detail.xp(),
                    detail.hitPoints(),
                    detail.hitDiceCount(),
                    detail.hitDiceSides(),
                    detail.hitDiceModifier(),
                    detail.armorClass(),
                    detail.initiativeBonus(),
                    detail.legendaryActionCount(),
                    detail.flySpeed(),
                    detail.swimSpeed(),
                    detail.climbSpeed(),
                    detail.burrowSpeed(),
                    detail.damageResistances(),
                    detail.damageImmunities(),
                    detail.conditionImmunities(),
                    detail.passivePerception(),
                    List.copyOf(actionTypes));
        }

        private static EncounterCreatureFacts toFacts(CreatureEncounterCandidate candidate) {
            return new EncounterCreatureFacts(
                    candidate.id(),
                    candidate.name(),
                    candidate.creatureType(),
                    candidate.challengeRating(),
                    candidate.xp(),
                    candidate.hitPoints(),
                    candidate.hitDiceCount(),
                    candidate.hitDiceSides(),
                    candidate.hitDiceModifier(),
                    candidate.armorClass(),
                    candidate.initiativeBonus(),
                    candidate.legendaryActionCount(),
                    0,
                    0,
                    0,
                    0,
                    null,
                    null,
                    null,
                    0,
                    List.of());
        }
    }

    private static final class EncounterTableCandidatePort implements ApplicationEncounterTableCandidatePort {

        private final EncounterTableCandidatesModel candidatesModel;

        EncounterTableCandidatePort(EncounterTableCandidatesModel candidatesModel) {
            this.candidatesModel = Objects.requireNonNull(candidatesModel, "candidatesModel");
        }

        @Override
        public List<EncounterCandidateProfile> loadCandidates() {
            EncounterTableCandidatesResult result = candidatesModel.current();
            if (result.status() != EncounterTableReadStatus.SUCCESS) {
                return List.of();
            }
            List<EncounterCandidateProfile> candidates = new ArrayList<>();
            for (EncounterTableCandidate candidate : result.candidates()) {
                candidates.add(toProfile(candidate));
            }
            return List.copyOf(candidates);
        }

        private static EncounterCandidateProfile toProfile(EncounterTableCandidate candidate) {
            return EncounterCandidateProfile.fromFacts(
                    new EncounterCreatureFacts(
                            candidate.creatureId(),
                            candidate.name(),
                            candidate.creatureType(),
                            candidate.challengeRating(),
                            candidate.xp(),
                            candidate.hitPoints(),
                            candidate.hitDiceCount(),
                            candidate.hitDiceSides(),
                            candidate.hitDiceModifier(),
                            candidate.armorClass(),
                            candidate.initiativeBonus(),
                            candidate.legendaryActionCount(),
                            0,
                            0,
                            0,
                            0,
                            null,
                            null,
                            null,
                            0,
                            List.of()),
                    candidate.weight());
        }
    }

    private static EncounterApplicationService create(
            EncounterPlanRepository encounterPlans,
            EncounterPartyFactsRepository party,
            EncounterCreatureRepository creatures,
            ApplicationEncounterCreatureCatalogPort creatureCatalog,
            EncounterTableCandidateRepository encounterTables,
            ApplicationEncounterTableCandidatePort tableCandidates,
            EncounterPublishedStateServiceAssembly publishedState
    ) {
        LoadEncounterBudgetUseCase loadBudgetUseCase = new LoadEncounterBudgetUseCase(party);
        SaveEncounterPlanUseCase savePlanUseCase = new SaveEncounterPlanUseCase(encounterPlans);
        LoadSavedEncounterPlanUseCase loadSavedPlanUseCase = new LoadSavedEncounterPlanUseCase(encounterPlans);
        ListSavedEncounterPlansUseCase listSavedPlansUseCase = new ListSavedEncounterPlansUseCase(encounterPlans);
        LoadEncounterPlanBudgetUseCase loadPlanBudgetUseCase =
                new LoadEncounterPlanBudgetUseCase(encounterPlans, party, creatures, creatureCatalog);
        ApplyEncounterSessionUseCase applySessionUseCase = createApplySessionUseCase(
                party,
                creatures,
                creatureCatalog,
                encounterTables,
                tableCandidates,
                savePlanUseCase,
                loadSavedPlanUseCase,
                listSavedPlansUseCase,
                loadBudgetUseCase);
        PublishEncounterSessionUseCase publishSessionUseCase =
                new PublishEncounterSessionUseCase(publishedState.sessionRepository(), loadBudgetUseCase);
        PublishEncounterSavedPlansUseCase publishSavedPlansUseCase =
                new PublishEncounterSavedPlansUseCase(publishedState.planRepository(), listSavedPlansUseCase);
        PublishEncounterPlanBudgetUseCase publishPlanBudgetUseCase =
                new PublishEncounterPlanBudgetUseCase(publishedState.planRepository(), loadPlanBudgetUseCase);
        publishSessionUseCase.execute(applySessionUseCase.session());
        publishSavedPlansUseCase.execute();
        publishPlanBudgetUseCase.execute(INITIAL_PLAN_ID);
        return new EncounterApplicationService(
                new ApplyEncounterStateUseCase(applySessionUseCase, publishSessionUseCase, publishSavedPlansUseCase),
                new UpdateEncounterBuilderInputsUseCase(applySessionUseCase, publishSessionUseCase),
                publishPlanBudgetUseCase);
    }

    private static ApplyEncounterSessionUseCase createApplySessionUseCase(
            EncounterPartyFactsRepository party,
            EncounterCreatureRepository creatures,
            ApplicationEncounterCreatureCatalogPort creatureCatalog,
            EncounterTableCandidateRepository encounterTables,
            ApplicationEncounterTableCandidatePort tableCandidates,
            SaveEncounterPlanUseCase savePlanUseCase,
            LoadSavedEncounterPlanUseCase loadSavedPlanUseCase,
            ListSavedEncounterPlansUseCase listSavedPlansUseCase,
            LoadEncounterBudgetUseCase loadBudgetUseCase
    ) {
        EncounterGenerationUseCase generator =
                new EncounterGenerationUseCase(party, creatures, creatureCatalog, encounterTables, tableCandidates);
        return new ApplyEncounterSessionUseCase(
                new EncounterSessionRepository(
                        party,
                        creatures,
                        creatureCatalog,
                        new EncounterSessionUseCaseAdaptersRepository(
                                generator::execute,
                                () -> {
                                    LoadEncounterBudgetUseCase.Result result = loadBudgetUseCase.execute();
                                    return new EncounterSessionUseCaseAdaptersRepository.EncounterBudgetLoadResult(
                                            result.status(),
                                            result.budget());
                                },
                                savePlanUseCase::execute,
                                loadSavedPlanUseCase::execute,
                                listSavedPlansUseCase::execute)));
    }
}
