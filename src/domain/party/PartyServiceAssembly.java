package src.domain.party;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Consumer;
import org.jspecify.annotations.Nullable;
import shell.api.ServiceRegistry;
import src.domain.party.model.roster.model.PartyAdventuringDayCalculation;
import src.domain.party.model.roster.model.PartyAdventuringDayLevelProgress;
import src.domain.party.model.roster.model.PartyAdventuringDayPlan;
import src.domain.party.model.roster.model.PartyAdventuringDayProgress;
import src.domain.party.model.roster.model.PartyAdventuringDayProgressEvent;
import src.domain.party.model.roster.model.PartyCharacter;
import src.domain.party.model.roster.model.PartyCharacterProgress;
import src.domain.party.model.roster.model.PartyMembership;
import src.domain.party.model.roster.model.PartyMutationStatus;
import src.domain.party.model.roster.model.PartyTravelLocation;
import src.domain.party.model.roster.repository.PartyEncounterSessionRepository;
import src.domain.party.model.roster.repository.PartyPublishedStateRepository;
import src.domain.party.model.roster.repository.PartyRosterRepository;
import src.domain.party.model.roster.usecase.AdjustPartyXpUseCase;
import src.domain.party.model.roster.usecase.AwardPartyXpUseCase;
import src.domain.party.model.roster.usecase.CalculateAdventuringDayUseCase;
import src.domain.party.model.roster.usecase.CreateCharacterUseCase;
import src.domain.party.model.roster.usecase.DeleteCharacterUseCase;
import src.domain.party.model.roster.usecase.LoadActivePartyCompositionUseCase;
import src.domain.party.model.roster.usecase.LoadActivePartyUseCase;
import src.domain.party.model.roster.usecase.LoadAdventuringDaySummaryUseCase;
import src.domain.party.model.roster.usecase.LoadPartySnapshotUseCase;
import src.domain.party.model.roster.usecase.LoadPartyTravelPositionsUseCase;
import src.domain.party.model.roster.usecase.MovePartyCharactersUseCase;
import src.domain.party.model.roster.usecase.PerformPartyRestUseCase;
import src.domain.party.model.roster.usecase.SetPartyMembershipUseCase;
import src.domain.party.model.roster.usecase.UpdateCharacterUseCase;
import src.domain.party.published.ActivePartyComposition;
import src.domain.party.published.ActivePartyCompositionModel;
import src.domain.party.published.ActivePartyCompositionResult;
import src.domain.party.published.ActivePartyModel;
import src.domain.party.published.ActivePartyResult;
import src.domain.party.published.AdventuringDayBudget;
import src.domain.party.published.AdventuringDayCalculation;
import src.domain.party.published.AdventuringDayCalculationModel;
import src.domain.party.published.AdventuringDayCalculationResult;
import src.domain.party.published.AdventuringDayLevelProgress;
import src.domain.party.published.AdventuringDayPlanningSummary;
import src.domain.party.published.AdventuringDayProgress;
import src.domain.party.published.AdventuringDayProgressEvent;
import src.domain.party.published.AdventuringDayProgressEventType;
import src.domain.party.published.AdventuringDayResult;
import src.domain.party.published.AdventuringDaySummary;
import src.domain.party.published.AdventuringDaySummaryModel;
import src.domain.party.published.MembershipState;
import src.domain.party.published.MutationResult;
import src.domain.party.published.MutationStatus;
import src.domain.party.published.PartyDungeonTravelLocationSnapshot;
import src.domain.party.published.PartyMemberDetails;
import src.domain.party.published.PartyMemberSummary;
import src.domain.party.published.PartyMutationModel;
import src.domain.party.published.PartyOverworldTravelLocationSnapshot;
import src.domain.party.published.PartySnapshot;
import src.domain.party.published.PartySnapshotModel;
import src.domain.party.published.PartySnapshotResult;
import src.domain.party.published.PartySummary;
import src.domain.party.published.PartyTravelLocationSnapshot;
import src.domain.party.published.PartyTravelPositionSnapshot;
import src.domain.party.published.PartyTravelPositionsModel;
import src.domain.party.published.PartyTravelPositionsResult;
import src.domain.party.published.PartyTravelTile;
import src.domain.party.published.ReadStatus;
import src.domain.party.published.RestCadenceStatus;
import src.domain.party.published.RestCadenceUrgency;
import src.domain.party.published.RestMilestone;

@SuppressWarnings({
        "PMD.CouplingBetweenObjects",
        "PMD.ExcessiveImports",
        "PMD.TooManyMethods"
})
final class PartyServiceAssembly {

    private final AtomicReference<PublishedState> publishedState = new AtomicReference<>();

    PartyApplicationService createApplicationService(ServiceRegistry services) {
        PartyRosterRepository repository = services.require(PartyRosterRepository.class);
        PublishedState state = publishedState(services);
        PartyPublishedStateRepository publishedStateRepository = state;
        PartyEncounterSessionRepository encounterSessionRepository =
                PartyEncounterSessionPublicationRefresh.INSTANCE;
        return new PartyApplicationService(
                new CreateCharacterUseCase(repository, publishedStateRepository, encounterSessionRepository),
                new UpdateCharacterUseCase(repository, publishedStateRepository, encounterSessionRepository),
                new DeleteCharacterUseCase(repository, publishedStateRepository, encounterSessionRepository),
                new SetPartyMembershipUseCase(repository, publishedStateRepository, encounterSessionRepository),
                new AdjustPartyXpUseCase(repository, publishedStateRepository, encounterSessionRepository),
                new AwardPartyXpUseCase(repository, publishedStateRepository),
                new PerformPartyRestUseCase(repository, publishedStateRepository, encounterSessionRepository),
                new MovePartyCharactersUseCase(repository, publishedStateRepository),
                new CalculateAdventuringDayUseCase(publishedStateRepository));
    }

    PartySnapshotModel partySnapshotModel(ServiceRegistry services) {
        return publishedState(services).partySnapshotModel();
    }

    ActivePartyModel activePartyModel(ServiceRegistry services) {
        return publishedState(services).activePartyModel();
    }

    ActivePartyCompositionModel activePartyCompositionModel(ServiceRegistry services) {
        return publishedState(services).activePartyCompositionModel();
    }

    AdventuringDaySummaryModel adventuringDaySummaryModel(ServiceRegistry services) {
        return publishedState(services).adventuringDaySummaryModel();
    }

    PartyTravelPositionsModel partyTravelPositionsModel(ServiceRegistry services) {
        return publishedState(services).partyTravelPositionsModel();
    }

    PartyMutationModel partyMutationModel(ServiceRegistry services) {
        return publishedState(services).partyMutationModel();
    }

    AdventuringDayCalculationModel adventuringDayCalculationModel(ServiceRegistry services) {
        return publishedState(services).adventuringDayCalculationModel();
    }

    private PublishedState publishedState(ServiceRegistry services) {
        PublishedState existing = publishedState.get();
        if (existing != null) {
            return existing;
        }
        PublishedState candidate = new PublishedState(services.require(PartyRosterRepository.class));
        return publishedState.compareAndSet(null, candidate)
                ? candidate
                : Objects.requireNonNull(publishedState.get(), "publishedState");
    }

    private enum PartyEncounterSessionPublicationRefresh implements PartyEncounterSessionRepository {

        INSTANCE;

        @Override
        public void refreshEncounterSession() {
            // Party mutation publication is authoritative; consumers refresh from party published models.
        }
    }

    private static final class PublishedState implements PartyPublishedStateRepository {

        private static final String LISTENER_PARAMETER = "listener";

        private final LoadPartySnapshotUseCase loadPartySnapshotUseCase;
        private final LoadActivePartyUseCase loadActivePartyUseCase;
        private final LoadActivePartyCompositionUseCase loadActivePartyCompositionUseCase;
        private final LoadAdventuringDaySummaryUseCase loadAdventuringDaySummaryUseCase;
        private final LoadPartyTravelPositionsUseCase loadPartyTravelPositionsUseCase;
        private final CalculateAdventuringDayUseCase calculateAdventuringDayUseCase;
        private final List<Consumer<PartySnapshotResult>> partySnapshotListeners = new ArrayList<>();
        private final List<Consumer<ActivePartyResult>> activePartyListeners = new ArrayList<>();
        private final List<Consumer<ActivePartyCompositionResult>> activePartyCompositionListeners = new ArrayList<>();
        private final List<Consumer<AdventuringDayResult>> adventuringDaySummaryListeners = new ArrayList<>();
        private final List<Consumer<PartyTravelPositionsResult>> partyTravelPositionsListeners = new ArrayList<>();
        private final List<Consumer<MutationResult>> partyMutationListeners = new ArrayList<>();
        private final List<Consumer<AdventuringDayCalculationResult>> adventuringDayCalculationListeners =
                new ArrayList<>();
        private final PartySnapshotModel partySnapshotModel = new PartySnapshotModel(
                this::currentPartySnapshot,
                this::subscribePartySnapshotListener);
        private final ActivePartyModel activePartyModel = new ActivePartyModel(
                this::currentActiveParty,
                this::subscribeActivePartyListener);
        private final ActivePartyCompositionModel activePartyCompositionModel = new ActivePartyCompositionModel(
                this::currentActivePartyComposition,
                this::subscribeActivePartyCompositionListener);
        private final AdventuringDaySummaryModel adventuringDaySummaryModel = new AdventuringDaySummaryModel(
                this::currentAdventuringDaySummary,
                this::subscribeAdventuringDaySummaryListener);
        private final PartyTravelPositionsModel partyTravelPositionsModel = new PartyTravelPositionsModel(
                this::currentPartyTravelPositions,
                this::subscribePartyTravelPositionsListener);
        private final PartyMutationModel partyMutationModel = new PartyMutationModel(
                this::currentPartyMutation,
                this::subscribePartyMutationListener);
        private final AdventuringDayCalculationModel adventuringDayCalculationModel =
                new AdventuringDayCalculationModel(
                        this::currentAdventuringDayCalculation,
                        this::subscribeAdventuringDayCalculationListener);
        private PartySnapshotResult currentPartySnapshot = Projection.failedSnapshotResult();
        private ActivePartyResult currentActiveParty = Projection.failedActivePartyResult();
        private ActivePartyCompositionResult currentActivePartyComposition =
                Projection.failedActivePartyCompositionResult();
        private AdventuringDayResult currentAdventuringDaySummary = Projection.failedAdventuringDaySummaryResult();
        private PartyTravelPositionsResult currentPartyTravelPositions = Projection.failedPartyTravelPositionsResult();
        private MutationResult currentPartyMutation = Projection.defaultMutationResult();
        private AdventuringDayCalculationResult currentAdventuringDayCalculation =
                Projection.failedAdventuringDayCalculationResult();

        private PublishedState(PartyRosterRepository delegate) {
            PartyRosterRepository repository = Objects.requireNonNull(delegate, "delegate");
            this.loadPartySnapshotUseCase = new LoadPartySnapshotUseCase(repository);
            this.loadActivePartyUseCase = new LoadActivePartyUseCase(repository);
            this.loadActivePartyCompositionUseCase = new LoadActivePartyCompositionUseCase(repository);
            this.loadAdventuringDaySummaryUseCase = new LoadAdventuringDaySummaryUseCase(repository);
            this.loadPartyTravelPositionsUseCase = new LoadPartyTravelPositionsUseCase(repository);
            this.calculateAdventuringDayUseCase = new CalculateAdventuringDayUseCase();
            refreshRepositoryBackedState(false);
        }

        private PartySnapshotModel partySnapshotModel() {
            return partySnapshotModel;
        }

        private ActivePartyModel activePartyModel() {
            return activePartyModel;
        }

        private ActivePartyCompositionModel activePartyCompositionModel() {
            return activePartyCompositionModel;
        }

        private AdventuringDaySummaryModel adventuringDaySummaryModel() {
            return adventuringDaySummaryModel;
        }

        private PartyTravelPositionsModel partyTravelPositionsModel() {
            return partyTravelPositionsModel;
        }

        private PartyMutationModel partyMutationModel() {
            return partyMutationModel;
        }

        private AdventuringDayCalculationModel adventuringDayCalculationModel() {
            return adventuringDayCalculationModel;
        }

        @Override
        public void publishRepositoryBackedState(
                PartyPublishedStateRepository.StatePublication publication
        ) {
            refreshRepositoryBackedState(true);
        }

        @Override
        public void publishMutationStatus(PartyMutationStatus status) {
            currentPartyMutation = new MutationResult(Projection.mapMutationStatus(status));
            notifyPartyMutationListeners(currentPartyMutation);
        }

        @Override
        public void publishStorageErrorMutation(
                PartyPublishedStateRepository.StatePublication publication
        ) {
            currentPartyMutation = Projection.storageErrorMutationResult();
            notifyPartyMutationListeners(currentPartyMutation);
        }

        @Override
        public void publishAdventuringDayCalculation(
                PartyPublishedStateRepository.AdventuringDayCalculationPublication publication
        ) {
            PartyPublishedStateRepository.AdventuringDayCalculationPublication safePublication =
                    publication == null
                            ? new PartyPublishedStateRepository.AdventuringDayCalculationPublication(List.of(), 0)
                            : publication;
            currentAdventuringDayCalculation = readAdventuringDayCalculationResult(
                    safePublication.levels(),
                    safePublication.totalGroupXp());
            notifyAdventuringDayCalculationListeners(currentAdventuringDayCalculation);
        }

        private void refreshRepositoryBackedState(boolean notify) {
            currentPartySnapshot = readSnapshotResult();
            currentActiveParty = readActivePartyResult();
            currentActivePartyComposition = readActivePartyCompositionResult();
            currentAdventuringDaySummary = readAdventuringDaySummaryResult();
            currentPartyTravelPositions = readPartyTravelPositionsResult();
            if (notify) {
                notifyPartySnapshotListeners(currentPartySnapshot);
                notifyActivePartyListeners(currentActiveParty);
                notifyActivePartyCompositionListeners(currentActivePartyComposition);
                notifyAdventuringDaySummaryListeners(currentAdventuringDaySummary);
                notifyPartyTravelPositionsListeners(currentPartyTravelPositions);
            }
        }

        private PartySnapshotResult readSnapshotResult() {
            try {
                return new PartySnapshotResult(
                        ReadStatus.SUCCESS,
                        Projection.mapSnapshot(loadPartySnapshotUseCase.execute()));
            } catch (IllegalStateException exception) {
                return Projection.failedSnapshotResult();
            }
        }

        private ActivePartyResult readActivePartyResult() {
            try {
                return Projection.mapActivePartyResult(loadActivePartyUseCase.execute());
            } catch (IllegalStateException exception) {
                return Projection.failedActivePartyResult();
            }
        }

        private ActivePartyCompositionResult readActivePartyCompositionResult() {
            try {
                return Projection.mapActivePartyCompositionResult(loadActivePartyCompositionUseCase.execute());
            } catch (IllegalStateException exception) {
                return Projection.failedActivePartyCompositionResult();
            }
        }

        private AdventuringDayResult readAdventuringDaySummaryResult() {
            try {
                return Projection.mapAdventuringDaySummaryResult(loadAdventuringDaySummaryUseCase.execute());
            } catch (IllegalStateException exception) {
                return Projection.failedAdventuringDaySummaryResult();
            }
        }

        private PartyTravelPositionsResult readPartyTravelPositionsResult() {
            try {
                return Projection.mapTravelPositionsResult(loadPartyTravelPositionsUseCase.execute(List.of()));
            } catch (IllegalStateException exception) {
                return Projection.failedPartyTravelPositionsResult();
            }
        }

        private AdventuringDayCalculationResult readAdventuringDayCalculationResult(
                List<Integer> levels,
                int totalGroupXp
        ) {
            try {
                return Projection.mapAdventuringDayCalculationResult(calculateAdventuringDayUseCase.execute(
                        levels == null ? List.of() : levels,
                        totalGroupXp));
            } catch (IllegalStateException exception) {
                return Projection.mapAdventuringDayCalculationResult(
                        calculateAdventuringDayUseCase.execute(List.of(), 0));
            }
        }

        private PartySnapshotResult currentPartySnapshot() {
            return currentPartySnapshot;
        }

        private ActivePartyResult currentActiveParty() {
            return currentActiveParty;
        }

        private ActivePartyCompositionResult currentActivePartyComposition() {
            return currentActivePartyComposition;
        }

        private AdventuringDayResult currentAdventuringDaySummary() {
            return currentAdventuringDaySummary;
        }

        private PartyTravelPositionsResult currentPartyTravelPositions() {
            return currentPartyTravelPositions;
        }

        private MutationResult currentPartyMutation() {
            return currentPartyMutation;
        }

        private AdventuringDayCalculationResult currentAdventuringDayCalculation() {
            return currentAdventuringDayCalculation;
        }

        private Runnable subscribePartySnapshotListener(Consumer<PartySnapshotResult> listener) {
            Consumer<PartySnapshotResult> safeListener = Objects.requireNonNull(listener, LISTENER_PARAMETER);
            partySnapshotListeners.add(safeListener);
            return () -> partySnapshotListeners.remove(safeListener);
        }

        private Runnable subscribeActivePartyListener(Consumer<ActivePartyResult> listener) {
            Consumer<ActivePartyResult> safeListener = Objects.requireNonNull(listener, LISTENER_PARAMETER);
            activePartyListeners.add(safeListener);
            return () -> activePartyListeners.remove(safeListener);
        }

        private Runnable subscribeActivePartyCompositionListener(Consumer<ActivePartyCompositionResult> listener) {
            Consumer<ActivePartyCompositionResult> safeListener = Objects.requireNonNull(listener, LISTENER_PARAMETER);
            activePartyCompositionListeners.add(safeListener);
            return () -> activePartyCompositionListeners.remove(safeListener);
        }

        private Runnable subscribeAdventuringDaySummaryListener(Consumer<AdventuringDayResult> listener) {
            Consumer<AdventuringDayResult> safeListener = Objects.requireNonNull(listener, LISTENER_PARAMETER);
            adventuringDaySummaryListeners.add(safeListener);
            return () -> adventuringDaySummaryListeners.remove(safeListener);
        }

        private Runnable subscribePartyTravelPositionsListener(Consumer<PartyTravelPositionsResult> listener) {
            Consumer<PartyTravelPositionsResult> safeListener = Objects.requireNonNull(listener, LISTENER_PARAMETER);
            partyTravelPositionsListeners.add(safeListener);
            return () -> partyTravelPositionsListeners.remove(safeListener);
        }

        private Runnable subscribePartyMutationListener(Consumer<MutationResult> listener) {
            Consumer<MutationResult> safeListener = Objects.requireNonNull(listener, LISTENER_PARAMETER);
            partyMutationListeners.add(safeListener);
            return () -> partyMutationListeners.remove(safeListener);
        }

        private Runnable subscribeAdventuringDayCalculationListener(
                Consumer<AdventuringDayCalculationResult> listener
        ) {
            Consumer<AdventuringDayCalculationResult> safeListener =
                    Objects.requireNonNull(listener, LISTENER_PARAMETER);
            adventuringDayCalculationListeners.add(safeListener);
            return () -> adventuringDayCalculationListeners.remove(safeListener);
        }

        private void notifyPartySnapshotListeners(PartySnapshotResult snapshot) {
            for (Consumer<PartySnapshotResult> listener : List.copyOf(partySnapshotListeners)) {
                listener.accept(snapshot);
            }
        }

        private void notifyActivePartyListeners(ActivePartyResult result) {
            for (Consumer<ActivePartyResult> listener : List.copyOf(activePartyListeners)) {
                listener.accept(result);
            }
        }

        private void notifyActivePartyCompositionListeners(ActivePartyCompositionResult result) {
            for (Consumer<ActivePartyCompositionResult> listener : List.copyOf(activePartyCompositionListeners)) {
                listener.accept(result);
            }
        }

        private void notifyAdventuringDaySummaryListeners(AdventuringDayResult result) {
            for (Consumer<AdventuringDayResult> listener : List.copyOf(adventuringDaySummaryListeners)) {
                listener.accept(result);
            }
        }

        private void notifyPartyTravelPositionsListeners(PartyTravelPositionsResult result) {
            for (Consumer<PartyTravelPositionsResult> listener : List.copyOf(partyTravelPositionsListeners)) {
                listener.accept(result);
            }
        }

        private void notifyPartyMutationListeners(MutationResult result) {
            for (Consumer<MutationResult> listener : List.copyOf(partyMutationListeners)) {
                listener.accept(result);
            }
        }

        private void notifyAdventuringDayCalculationListeners(AdventuringDayCalculationResult result) {
            for (Consumer<AdventuringDayCalculationResult> listener : List.copyOf(adventuringDayCalculationListeners)) {
                listener.accept(result);
            }
        }
    }

    private interface Projection {

        private static PartySnapshotResult failedSnapshotResult() {
            return new PartySnapshotResult(ReadStatus.STORAGE_ERROR, emptySnapshot());
        }

        private static ActivePartyResult failedActivePartyResult() {
            return new ActivePartyResult(ReadStatus.STORAGE_ERROR, List.of());
        }

        private static ActivePartyCompositionResult failedActivePartyCompositionResult() {
            return new ActivePartyCompositionResult(
                    ReadStatus.STORAGE_ERROR,
                    new ActivePartyComposition(List.of(), 1));
        }

        private static AdventuringDayResult failedAdventuringDaySummaryResult() {
            return new AdventuringDayResult(
                    ReadStatus.STORAGE_ERROR,
                    new AdventuringDaySummary(List.of(), 0, 0, 0, 0, 0, List.of()));
        }

        private static PartyTravelPositionsResult failedPartyTravelPositionsResult() {
            return new PartyTravelPositionsResult(ReadStatus.STORAGE_ERROR, List.of(), null);
        }

        private static MutationResult defaultMutationResult() {
            return new MutationResult(MutationStatus.SUCCESS);
        }

        private static MutationResult storageErrorMutationResult() {
            return new MutationResult(MutationStatus.STORAGE_ERROR);
        }

        private static AdventuringDayCalculationResult failedAdventuringDayCalculationResult() {
            return new AdventuringDayCalculationResult(
                    ReadStatus.STORAGE_ERROR,
                    new AdventuringDayCalculation(
                            new AdventuringDayBudget(0, 0, 0, 0, 0),
                            new AdventuringDayProgress(0, 0, 0, 0, 0.0, 0, 0, List.of(), List.of())),
                    AdventuringDayPlanningSummary.empty());
        }

        private static PartySnapshot mapSnapshot(LoadPartySnapshotUseCase.PartySnapshotProjection projection) {
            return new PartySnapshot(
                    projection.activeMembers().stream().map(Projection::mapDetails).toList(),
                    projection.reserveMembers().stream().map(Projection::mapDetails).toList(),
                    new PartySummary(
                            projection.activeMembers().size(),
                            projection.reserveMembers().size(),
                            projection.averageLevel()));
        }

        private static ActivePartyResult mapActivePartyResult(List<PartyCharacter> activeMembers) {
            return new ActivePartyResult(
                    ReadStatus.SUCCESS,
                    activeMembers.stream().map(Projection::mapSummary).toList());
        }

        private static ActivePartyCompositionResult mapActivePartyCompositionResult(
                LoadActivePartyCompositionUseCase.ActiveComposition composition
        ) {
            return new ActivePartyCompositionResult(
                    ReadStatus.SUCCESS,
                    new ActivePartyComposition(composition.activePartyLevels(), composition.averageActiveLevel()));
        }

        private static AdventuringDayResult mapAdventuringDaySummaryResult(
                LoadAdventuringDaySummaryUseCase.AdventuringDayStatus dayStatus
        ) {
            return new AdventuringDayResult(
                    ReadStatus.SUCCESS,
                    new AdventuringDaySummary(
                            dayStatus.activeLevels(),
                            dayStatus.remainingToShortRest(),
                            dayStatus.remainingToLongRest(),
                            dayStatus.consumedXp(),
                            dayStatus.totalBudgetXp(),
                            dayStatus.consumedPercent(),
                            dayStatus.restCadenceStatuses().stream()
                                    .map(Projection::mapRestCadenceStatus)
                                    .toList()));
        }

        private static PartyTravelPositionsResult mapTravelPositionsResult(LoadPartyTravelPositionsUseCase.Result result) {
            return new PartyTravelPositionsResult(
                    ReadStatus.SUCCESS,
                    result.positions().stream()
                            .map(Projection::mapTravelPosition)
                            .toList(),
                    mapTravelLocation(result.partyTokenLocation()));
        }

        private static AdventuringDayCalculationResult mapAdventuringDayCalculationResult(
                PartyAdventuringDayCalculation calculation
        ) {
            AdventuringDayCalculation publishedCalculation = new AdventuringDayCalculation(
                    mapAdventuringDayBudget(calculation.plan()),
                    mapAdventuringDayProgress(calculation.progress()));
            return new AdventuringDayCalculationResult(
                    ReadStatus.SUCCESS,
                    publishedCalculation,
                    new AdventuringDayPlanningSummary(
                            calculation.plan().totalBudgetXp(),
                            calculation.plan().firstShortRestXp(),
                            calculation.plan().secondShortRestXp(),
                            calculation.plannedShortRests(),
                            calculation.plannedLongRests()));
        }

        private static MutationStatus mapMutationStatus(PartyMutationStatus status) {
            if (status == null) {
                return MutationStatus.STORAGE_ERROR;
            }
            if (PartyMutationStatus.SUCCESS.equals(status)) {
                return MutationStatus.SUCCESS;
            }
            if (PartyMutationStatus.NOT_FOUND.equals(status)) {
                return MutationStatus.NOT_FOUND;
            }
            if (PartyMutationStatus.INVALID_INPUT.equals(status)) {
                return MutationStatus.INVALID_INPUT;
            }
            return MutationStatus.STORAGE_ERROR;
        }

        private static PartyMemberSummary mapSummary(PartyCharacter character) {
            return new PartyMemberSummary(
                    character.id(),
                    character.identity().name(),
                    character.progress().level());
        }

        private static PartyMemberDetails mapDetails(PartyCharacter character) {
            return new PartyMemberDetails(
                    character.id(),
                    character.identity().name(),
                    character.identity().playerName(),
                    character.progress().level(),
                    character.progress().currentXp(),
                    PartyCharacterProgress.minimumXpForLevel(character.progress().level()),
                    PartyCharacterProgress.nextLevelXp(character.progress().level()),
                    PartyCharacterProgress.xpToNextLevel(character.progress().level(), character.progress().currentXp()),
                    PartyCharacterProgress.readyToLevel(character.progress().level(), character.progress().currentXp()),
                    character.combat().passivePerception(),
                    character.combat().armorClass(),
                    character.progress().xpSinceShortRest(),
                    character.progress().xpSinceLongRest(),
                    character.progress().shortRestsTakenSinceLongRest(),
                    toMembershipState(character.membership()));
        }

        private static PartyTravelPositionSnapshot mapTravelPosition(
                LoadPartyTravelPositionsUseCase.TravelPosition position
        ) {
            return new PartyTravelPositionSnapshot(
                    position.characterId(),
                    position.attachedToPartyToken(),
                    mapTravelLocation(position.location()));
        }

        private static @Nullable PartyTravelLocationSnapshot mapTravelLocation(@Nullable PartyTravelLocation location) {
            if (location != null && location.isDungeon()) {
                return new PartyDungeonTravelLocationSnapshot(
                        location.mapId(),
                        toPublishedDungeonLocationKind(location.dungeonLocationKind()),
                        location.dungeonOwnerId(),
                        new PartyTravelTile(
                                location.dungeonTile().q(),
                                location.dungeonTile().r(),
                                location.dungeonTile().level()),
                        toPublishedHeading(location.dungeonHeading()));
            }
            if (location != null && location.isOverworld()) {
                return new PartyOverworldTravelLocationSnapshot(location.mapId(), location.overworldTileId());
            }
            return null;
        }

        private static RestCadenceStatus mapRestCadenceStatus(LoadAdventuringDaySummaryUseCase.RestCadence status) {
            if (status == null) {
                return new RestCadenceStatus(
                        null,
                        RestMilestone.valueOf("LONG_REST"),
                        0,
                        RestCadenceUrgency.valueOf("NORMAL"));
            }
            return new RestCadenceStatus(
                    status.characterId(),
                    toPublishedRestMilestone(status.nextMilestone()),
                    status.xpDelta(),
                    toPublishedRestCadenceUrgency(status.urgency()));
        }

        private static AdventuringDayBudget mapAdventuringDayBudget(PartyAdventuringDayPlan plan) {
            return new AdventuringDayBudget(
                    plan.totalBudgetXp(),
                    plan.perThirdXp(),
                    plan.firstShortRestXp(),
                    plan.secondShortRestXp(),
                    plan.characterCount());
        }

        private static AdventuringDayProgress mapAdventuringDayProgress(PartyAdventuringDayProgress progress) {
            return new AdventuringDayProgress(
                    progress.totals().totalGroupXp(),
                    progress.totals().perCharacterAwardedXp(),
                    progress.totals().partySize(),
                    progress.longRests(),
                    progress.totals().totalDays(),
                    progress.shortRests(),
                    progress.longRests(),
                    progress.levelProgressions().stream()
                            .map(Projection::mapLevelProgress)
                            .toList(),
                    progress.events().stream()
                            .map(Projection::mapProgressEvent)
                            .toList());
        }

        private static AdventuringDayLevelProgress mapLevelProgress(PartyAdventuringDayLevelProgress progress) {
            return new AdventuringDayLevelProgress(
                    progress.startLevel(),
                    progress.endLevel(),
                    progress.characterCount(),
                    progress.levelUps());
        }

        private static AdventuringDayProgressEvent mapProgressEvent(PartyAdventuringDayProgressEvent event) {
            return new AdventuringDayProgressEvent(
                    event.groupXp(),
                    toPublishedProgressEventType(event),
                    event.dayNumber(),
                    event.newLevel(),
                    event.affectedCharacters(),
                    event.partialDay());
        }

        private static AdventuringDayProgressEventType toPublishedProgressEventType(
                PartyAdventuringDayProgressEvent event
        ) {
            if (event.isLevelUp()) {
                return AdventuringDayProgressEventType.LEVEL_UP;
            }
            if (event.isShortRest()) {
                return AdventuringDayProgressEventType.SHORT_REST;
            }
            return AdventuringDayProgressEventType.LONG_REST;
        }

        private static PartySnapshot emptySnapshot() {
            return new PartySnapshot(List.of(), List.of(), new PartySummary(0, 0, 1));
        }

        private static MembershipState toMembershipState(PartyMembership membership) {
            return PartyMembership.ACTIVE.equals(membership) ? MembershipState.ACTIVE : MembershipState.RESERVE;
        }

        private static src.domain.party.published.PartyDungeonTravelLocationKind toPublishedDungeonLocationKind(
                src.domain.party.model.roster.model.PartyDungeonTravelLocationKind locationKind
        ) {
            return src.domain.party.published.PartyDungeonTravelLocationKind.valueOf(locationKind.name());
        }

        private static src.domain.party.published.PartyTravelHeading toPublishedHeading(
                src.domain.party.model.roster.model.PartyTravelHeading heading
        ) {
            return src.domain.party.published.PartyTravelHeading.valueOf(heading.name());
        }

        private static RestMilestone toPublishedRestMilestone(int milestone) {
            if (milestone == LoadAdventuringDaySummaryUseCase.RestCadence.SHORT_REST_ONE) {
                return RestMilestone.SHORT_REST_ONE;
            }
            if (milestone == LoadAdventuringDaySummaryUseCase.RestCadence.SHORT_REST_TWO) {
                return RestMilestone.SHORT_REST_TWO;
            }
            return RestMilestone.LONG_REST;
        }

        private static RestCadenceUrgency toPublishedRestCadenceUrgency(int urgency) {
            if (urgency == LoadAdventuringDaySummaryUseCase.RestCadence.OVERDUE) {
                return RestCadenceUrgency.OVERDUE;
            }
            if (urgency == LoadAdventuringDaySummaryUseCase.RestCadence.SOON) {
                return RestCadenceUrgency.SOON;
            }
            return RestCadenceUrgency.NORMAL;
        }
    }
}
