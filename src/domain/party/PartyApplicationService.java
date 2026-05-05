package src.domain.party;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.Supplier;
import org.jspecify.annotations.Nullable;
import src.domain.party.application.AdjustPartyXpUseCase;
import src.domain.party.application.AwardPartyXpUseCase;
import src.domain.party.application.CalculateAdventuringDayUseCase;
import src.domain.party.application.CreateCharacterUseCase;
import src.domain.party.application.DeleteCharacterUseCase;
import src.domain.party.application.LoadActivePartyCompositionUseCase;
import src.domain.party.application.LoadActivePartyUseCase;
import src.domain.party.application.LoadAdventuringDaySummaryUseCase;
import src.domain.party.application.LoadPartySnapshotUseCase;
import src.domain.party.application.LoadPartyTravelPositionsUseCase;
import src.domain.party.application.MovePartyCharactersUseCase;
import src.domain.party.application.PerformPartyRestUseCase;
import src.domain.party.application.SetPartyMembershipUseCase;
import src.domain.party.application.UpdateCharacterUseCase;
import src.domain.party.published.ActivePartyComposition;
import src.domain.party.published.ActivePartyCompositionResult;
import src.domain.party.published.ActivePartyResult;
import src.domain.party.published.AdjustPartyXpCommand;
import src.domain.party.published.AdventuringDayBudget;
import src.domain.party.published.AdventuringDayCalculation;
import src.domain.party.published.AdventuringDayCalculationModel;
import src.domain.party.published.AdventuringDayCalculationResult;
import src.domain.party.published.AdventuringDayLevelProgress;
import src.domain.party.published.AdventuringDayProgress;
import src.domain.party.published.AdventuringDayProgressEvent;
import src.domain.party.published.AdventuringDayProgressEventType;
import src.domain.party.published.AdventuringDayResult;
import src.domain.party.published.AdventuringDaySummaryModel;
import src.domain.party.published.AdventuringDaySummary;
import src.domain.party.published.AwardPartyXpCommand;
import src.domain.party.published.CalculateAdventuringDayQuery;
import src.domain.party.published.CharacterDraft;
import src.domain.party.published.CreateCharacterCommand;
import src.domain.party.published.DeleteCharacterCommand;
import src.domain.party.published.LoadActivePartyCompositionQuery;
import src.domain.party.published.LoadActivePartyQuery;
import src.domain.party.published.LoadAdventuringDaySummaryQuery;
import src.domain.party.published.LoadAdventuringDayCalculationModelQuery;
import src.domain.party.published.LoadPartySnapshotQuery;
import src.domain.party.published.LoadPartyMutationQuery;
import src.domain.party.published.LoadPartyTravelPositionsQuery;
import src.domain.party.published.MembershipState;
import src.domain.party.published.MovePartyCharactersCommand;
import src.domain.party.published.MutationResult;
import src.domain.party.published.MutationStatus;
import src.domain.party.published.PerformPartyRestCommand;
import src.domain.party.published.PartyDungeonTravelLocationKind;
import src.domain.party.published.PartyDungeonTravelLocationSnapshot;
import src.domain.party.published.PartyMemberDetails;
import src.domain.party.published.PartyMutationModel;
import src.domain.party.published.PartyMemberSummary;
import src.domain.party.published.PartySnapshotModel;
import src.domain.party.published.PartyOverworldTravelLocationSnapshot;
import src.domain.party.published.PartySnapshot;
import src.domain.party.published.PartySnapshotResult;
import src.domain.party.published.PartySummary;
import src.domain.party.published.PartyTravelHeading;
import src.domain.party.published.PartyTravelLocationSnapshot;
import src.domain.party.published.PartyTravelPositionSnapshot;
import src.domain.party.published.PartyTravelPositionsResult;
import src.domain.party.published.PartyTravelTile;
import src.domain.party.published.ReadStatus;
import src.domain.party.published.RestCadenceStatus;
import src.domain.party.published.RestCadenceUrgency;
import src.domain.party.published.RestMilestone;
import src.domain.party.published.RestType;
import src.domain.party.published.SetPartyMembershipCommand;
import src.domain.party.published.UpdateCharacterCommand;
import src.domain.party.roster.entity.PartyCharacter;
import src.domain.party.roster.policy.PartyLevelProgressionPolicy;
import src.domain.party.roster.port.PartyRosterRepository;
import src.domain.party.roster.value.PartyCharacterDraft;
import src.domain.party.roster.value.PartyMembership;
import src.domain.party.roster.value.PartyMutationStatus;
import src.domain.party.roster.value.PartyRestType;
import src.domain.party.roster.value.PartyTravelLocation;

/**
 * Public backend facade for party management.
 */
public final class PartyApplicationService {

    private static final String QUERY_PARAMETER = "query";
    private static final String LISTENER_PARAMETER = "listener";

    private final LoadPartySnapshotUseCase loadPartySnapshotUseCase;
    private final LoadActivePartyUseCase loadActivePartyUseCase;
    private final LoadActivePartyCompositionUseCase loadActivePartyCompositionUseCase;
    private final LoadAdventuringDaySummaryUseCase loadAdventuringDaySummaryUseCase;
    private final CalculateAdventuringDayUseCase calculateAdventuringDayUseCase;
    private final LoadPartyTravelPositionsUseCase loadPartyTravelPositionsUseCase;
    private final CreateCharacterUseCase createCharacterUseCase;
    private final UpdateCharacterUseCase updateCharacterUseCase;
    private final DeleteCharacterUseCase deleteCharacterUseCase;
    private final SetPartyMembershipUseCase setPartyMembershipUseCase;
    private final AdjustPartyXpUseCase adjustPartyXpUseCase;
    private final AwardPartyXpUseCase awardPartyXpUseCase;
    private final PerformPartyRestUseCase performPartyRestUseCase;
    private final MovePartyCharactersUseCase movePartyCharactersUseCase;
    private final List<Consumer<PartySnapshotResult>> partySnapshotListeners = new ArrayList<>();
    private final List<Consumer<AdventuringDayResult>> adventuringDaySummaryListeners = new ArrayList<>();
    private final List<Consumer<MutationResult>> partyMutationListeners = new ArrayList<>();
    private final List<Consumer<AdventuringDayCalculationResult>> adventuringDayCalculationListeners = new ArrayList<>();
    private final PartySnapshotModel partySnapshotModel = new PartySnapshotModel(
            this::currentPartySnapshot,
            this::subscribePartySnapshotListener);
    private final AdventuringDaySummaryModel adventuringDaySummaryModel = new AdventuringDaySummaryModel(
            this::currentAdventuringDaySummary,
            this::subscribeAdventuringDaySummaryListener);
    private final PartyMutationModel partyMutationModel = new PartyMutationModel(
            this::currentPartyMutation,
            this::subscribePartyMutationListener);
    private final AdventuringDayCalculationModel adventuringDayCalculationModel = new AdventuringDayCalculationModel(
            this::currentAdventuringDayCalculation,
            this::subscribeAdventuringDayCalculationListener);
    private PartySnapshotResult currentPartySnapshot = new PartySnapshotResult(ReadStatus.STORAGE_ERROR, emptySnapshot());
    private AdventuringDayResult currentAdventuringDaySummary = new AdventuringDayResult(
            ReadStatus.STORAGE_ERROR,
            new AdventuringDaySummary(List.of(), 0, 0, 0, 0, 0, List.of()));
    private MutationResult currentPartyMutation = new MutationResult(MutationStatus.SUCCESS);
    private AdventuringDayCalculationResult currentAdventuringDayCalculation =
            new AdventuringDayCalculationResult(
                    ReadStatus.STORAGE_ERROR,
                    new AdventuringDayCalculation(
                            new AdventuringDayBudget(0, 0, 0, 0, 0),
                            new AdventuringDayProgress(0, 0, 0, 0, 0.0, 0, 0, List.of(), List.of())));

    public PartyApplicationService(PartyRosterRepository rosterRepository) {
        PartyRosterRepository repository = Objects.requireNonNull(rosterRepository, "rosterRepository");
        this.loadPartySnapshotUseCase = new LoadPartySnapshotUseCase(repository);
        this.loadActivePartyUseCase = new LoadActivePartyUseCase(repository);
        this.loadActivePartyCompositionUseCase = new LoadActivePartyCompositionUseCase(repository);
        this.loadAdventuringDaySummaryUseCase = new LoadAdventuringDaySummaryUseCase(repository);
        this.calculateAdventuringDayUseCase = new CalculateAdventuringDayUseCase();
        this.loadPartyTravelPositionsUseCase = new LoadPartyTravelPositionsUseCase(repository);
        this.createCharacterUseCase = new CreateCharacterUseCase(repository);
        this.updateCharacterUseCase = new UpdateCharacterUseCase(repository);
        this.deleteCharacterUseCase = new DeleteCharacterUseCase(repository);
        this.setPartyMembershipUseCase = new SetPartyMembershipUseCase(repository);
        this.adjustPartyXpUseCase = new AdjustPartyXpUseCase(repository);
        this.awardPartyXpUseCase = new AwardPartyXpUseCase(repository);
        this.performPartyRestUseCase = new PerformPartyRestUseCase(repository);
        this.movePartyCharactersUseCase = new MovePartyCharactersUseCase(repository);
        refreshPartySurface();
    }

    public PartySnapshotResult loadSnapshot(LoadPartySnapshotQuery query) {
        currentPartySnapshot = readSnapshotResult();
        notifyPartySnapshotListeners(currentPartySnapshot);
        return currentPartySnapshot;
    }

    public ActivePartyResult loadActiveParty(LoadActivePartyQuery query) {
        try {
            return new ActivePartyResult(
                    ReadStatus.SUCCESS,
                    loadActivePartyUseCase.execute().stream().map(PartyApplicationService::mapSummary).toList());
        } catch (IllegalStateException exception) {
            return new ActivePartyResult(ReadStatus.STORAGE_ERROR, List.of());
        }
    }

    public ActivePartyCompositionResult loadActivePartyComposition(LoadActivePartyCompositionQuery query) {
        try {
            LoadActivePartyCompositionUseCase.ActiveComposition composition = loadActivePartyCompositionUseCase.execute();
            return new ActivePartyCompositionResult(
                    ReadStatus.SUCCESS,
                    new ActivePartyComposition(composition.activePartyLevels(), composition.averageActiveLevel()));
        } catch (IllegalStateException exception) {
            return new ActivePartyCompositionResult(
                    ReadStatus.STORAGE_ERROR,
                    new ActivePartyComposition(List.of(), 1));
        }
    }

    public AdventuringDayResult loadAdventuringDaySummary(LoadAdventuringDaySummaryQuery query) {
        currentAdventuringDaySummary = readAdventuringDaySummaryResult();
        notifyAdventuringDaySummaryListeners(currentAdventuringDaySummary);
        return currentAdventuringDaySummary;
    }

    public AdventuringDayCalculationResult calculateAdventuringDay(CalculateAdventuringDayQuery query) {
        currentAdventuringDayCalculation = readAdventuringDayCalculationResult(query);
        notifyAdventuringDayCalculationListeners(currentAdventuringDayCalculation);
        return currentAdventuringDayCalculation;
    }

    public PartyTravelPositionsResult loadTravelPositions(LoadPartyTravelPositionsQuery query) {
        try {
            LoadPartyTravelPositionsQuery effectiveQuery = query == null
                    ? new LoadPartyTravelPositionsQuery(List.of())
                    : query;
            LoadPartyTravelPositionsUseCase.Result result =
                    loadPartyTravelPositionsUseCase.execute(effectiveQuery.characterIds());
            return new PartyTravelPositionsResult(
                    ReadStatus.SUCCESS,
                    result.positions().stream()
                            .map(PartyApplicationService::mapTravelPosition)
                            .toList(),
                    mapTravelLocation(result.partyTokenLocation()));
        } catch (IllegalStateException exception) {
            return new PartyTravelPositionsResult(ReadStatus.STORAGE_ERROR, List.of(), null);
        }
    }

    public MutationResult createCharacter(CreateCharacterCommand command) {
        CharacterDraft draft = command == null ? null : command.draft();
        MembershipState membership = command == null ? null : command.membership();
        return runMutation(() -> createCharacterUseCase.execute(
                toDomainDraft(draft),
                toPartyMembership(membership)));
    }

    public MutationResult updateCharacter(UpdateCharacterCommand command) {
        return runMutation(() -> updateCharacterUseCase.execute(
                command == null ? 0L : command.id(),
                toDomainDraft(command == null ? null : command.draft())));
    }

    public MutationResult deleteCharacter(DeleteCharacterCommand command) {
        long id = command == null ? 0L : command.id();
        return runMutation(() -> deleteCharacterUseCase.execute(id));
    }

    public MutationResult setMembership(SetPartyMembershipCommand command) {
        long id = command == null ? 0L : command.id();
        MembershipState membership = command == null ? null : command.membership();
        return runMutation(() -> setPartyMembershipUseCase.execute(id, toPartyMembership(membership)));
    }

    public MutationResult awardXp(AwardPartyXpCommand command) {
        AwardPartyXpCommand effectiveCommand = command == null ? new AwardPartyXpCommand(List.of(), 0) : command;
        return runMutation(() -> awardPartyXpUseCase.execute(effectiveCommand.ids(), effectiveCommand.xpPerCharacter()));
    }

    public MutationResult adjustXp(AdjustPartyXpCommand command) {
        AdjustPartyXpCommand effectiveCommand = command == null ? new AdjustPartyXpCommand(List.of(), 0) : command;
        return runMutation(() -> adjustPartyXpUseCase.execute(effectiveCommand.ids(), effectiveCommand.xpDelta()));
    }

    public MutationResult performRest(PerformPartyRestCommand command) {
        RestType restType = command == null ? null : command.restType();
        return runMutation(() -> performPartyRestUseCase.execute(toPartyRestType(restType)));
    }

    public MutationResult moveCharacters(MovePartyCharactersCommand command) {
        MovePartyCharactersCommand effectiveCommand = command == null
                ? new MovePartyCharactersCommand(List.of(), null, true)
                : command;
        return runMutation(() -> movePartyCharactersUseCase.execute(
                effectiveCommand.characterIds(),
                toDomainTravelLocation(effectiveCommand.target()),
                effectiveCommand.attachToPartyToken()));
    }

    public PartySnapshotModel loadSnapshotModel(LoadPartySnapshotQuery query) {
        Objects.requireNonNull(query, QUERY_PARAMETER);
        return partySnapshotModel;
    }

    public AdventuringDaySummaryModel loadAdventuringDaySummaryModel(LoadAdventuringDaySummaryQuery query) {
        Objects.requireNonNull(query, QUERY_PARAMETER);
        return adventuringDaySummaryModel;
    }

    public PartyMutationModel loadPartyMutationModel(LoadPartyMutationQuery query) {
        Objects.requireNonNull(query, QUERY_PARAMETER);
        return partyMutationModel;
    }

    public AdventuringDayCalculationModel loadAdventuringDayCalculationModel(
            LoadAdventuringDayCalculationModelQuery query
    ) {
        Objects.requireNonNull(query, QUERY_PARAMETER);
        return adventuringDayCalculationModel;
    }

    private static MutationResult mutationResult(Supplier<PartyMutationStatus> operation) {
        try {
            return new MutationResult(mapMutationStatus(operation.get()));
        } catch (IllegalStateException exception) {
            return new MutationResult(MutationStatus.STORAGE_ERROR);
        }
    }

    private MutationResult runMutation(Supplier<PartyMutationStatus> operation) {
        MutationResult result = mutationResult(operation);
        refreshPartySurface();
        currentPartyMutation = result;
        notifyPartyMutationListeners(result);
        return result;
    }

    private void refreshPartySurface() {
        currentPartySnapshot = readSnapshotResult();
        currentAdventuringDaySummary = readAdventuringDaySummaryResult();
        notifyPartySnapshotListeners(currentPartySnapshot);
        notifyAdventuringDaySummaryListeners(currentAdventuringDaySummary);
    }

    private PartySnapshotResult readSnapshotResult() {
        try {
            return new PartySnapshotResult(ReadStatus.SUCCESS, mapSnapshot(loadPartySnapshotUseCase.execute()));
        } catch (IllegalStateException exception) {
            return new PartySnapshotResult(ReadStatus.STORAGE_ERROR, emptySnapshot());
        }
    }

    private AdventuringDayResult readAdventuringDaySummaryResult() {
        try {
            LoadAdventuringDaySummaryUseCase.AdventuringDayStatus dayStatus =
                    loadAdventuringDaySummaryUseCase.execute();
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
                                    .map(PartyApplicationService::mapRestCadenceStatus)
                                    .toList()));
        } catch (IllegalStateException exception) {
            return new AdventuringDayResult(
                    ReadStatus.STORAGE_ERROR,
                    new AdventuringDaySummary(List.of(), 0, 0, 0, 0, 0, List.of()));
        }
    }

    private AdventuringDayCalculationResult readAdventuringDayCalculationResult(CalculateAdventuringDayQuery query) {
        try {
            CalculateAdventuringDayQuery effectiveQuery = query == null
                    ? new CalculateAdventuringDayQuery(List.of(), 0)
                    : query;
            return new AdventuringDayCalculationResult(
                    ReadStatus.SUCCESS,
                    mapAdventuringDayCalculation(calculateAdventuringDayUseCase.execute(
                            effectiveQuery.levels(),
                            effectiveQuery.totalGroupXp())));
        } catch (IllegalStateException exception) {
            return new AdventuringDayCalculationResult(
                    ReadStatus.STORAGE_ERROR,
                    mapAdventuringDayCalculation(calculateAdventuringDayUseCase.execute(List.of(), 0)));
        }
    }

    private PartySnapshotResult currentPartySnapshot() {
        return currentPartySnapshot;
    }

    private AdventuringDayResult currentAdventuringDaySummary() {
        return currentAdventuringDaySummary;
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

    private Runnable subscribeAdventuringDaySummaryListener(Consumer<AdventuringDayResult> listener) {
        Consumer<AdventuringDayResult> safeListener = Objects.requireNonNull(listener, LISTENER_PARAMETER);
        adventuringDaySummaryListeners.add(safeListener);
        return () -> adventuringDaySummaryListeners.remove(safeListener);
    }

    private Runnable subscribePartyMutationListener(Consumer<MutationResult> listener) {
        Consumer<MutationResult> safeListener = Objects.requireNonNull(listener, LISTENER_PARAMETER);
        partyMutationListeners.add(safeListener);
        return () -> partyMutationListeners.remove(safeListener);
    }

    private Runnable subscribeAdventuringDayCalculationListener(Consumer<AdventuringDayCalculationResult> listener) {
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

    private void notifyAdventuringDaySummaryListeners(AdventuringDayResult summary) {
        for (Consumer<AdventuringDayResult> listener : List.copyOf(adventuringDaySummaryListeners)) {
            listener.accept(summary);
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

    private static PartySnapshot mapSnapshot(LoadPartySnapshotUseCase.PartySnapshotProjection projection) {
        return new PartySnapshot(
                projection.activeMembers().stream().map(PartyApplicationService::mapDetails).toList(),
                projection.reserveMembers().stream().map(PartyApplicationService::mapDetails).toList(),
                new PartySummary(
                        projection.activeMembers().size(),
                        projection.reserveMembers().size(),
                        projection.averageLevel()));
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
                PartyLevelProgressionPolicy.minimumXpForLevel(character.progress().level()),
                PartyLevelProgressionPolicy.nextLevelXp(character.progress().level()),
                PartyLevelProgressionPolicy.xpToNextLevel(character.progress().level(), character.progress().currentXp()),
                PartyLevelProgressionPolicy.readyToLevel(character.progress().level(), character.progress().currentXp()),
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

    private static @Nullable PartyTravelLocationSnapshot mapTravelLocation(
            @Nullable PartyTravelLocation location
    ) {
        if (location instanceof src.domain.party.roster.value.PartyDungeonTravelLocation dungeon) {
            return new PartyDungeonTravelLocationSnapshot(
                    dungeon.mapId(),
                    PartyDungeonTravelLocationKind.valueOf(dungeon.locationKind().name()),
                    dungeon.ownerId(),
                    new PartyTravelTile(
                            dungeon.tile().q(),
                            dungeon.tile().r(),
                            dungeon.tile().level()),
                    PartyTravelHeading.valueOf(dungeon.heading().name()));
        }
        if (location instanceof src.domain.party.roster.value.PartyOverworldTravelLocation overworld) {
            return new PartyOverworldTravelLocationSnapshot(overworld.mapId(), overworld.tileId());
        }
        return null;
    }

    private static @Nullable PartyTravelLocation toDomainTravelLocation(
            @Nullable PartyTravelLocationSnapshot location
    ) {
        if (location instanceof PartyDungeonTravelLocationSnapshot dungeon) {
            return new src.domain.party.roster.value.PartyDungeonTravelLocation(
                    dungeon.mapId(),
                    src.domain.party.roster.value.PartyDungeonTravelLocationKind.valueOf(dungeon.locationKind().name()),
                    dungeon.ownerId(),
                    new src.domain.party.roster.value.PartyTravelTile(
                            dungeon.tile().q(),
                            dungeon.tile().r(),
                            dungeon.tile().level()),
                    src.domain.party.roster.value.PartyTravelHeading.valueOf(dungeon.heading().name()));
        }
        if (location instanceof PartyOverworldTravelLocationSnapshot overworld) {
            return new src.domain.party.roster.value.PartyOverworldTravelLocation(
                    overworld.mapId(),
                    overworld.tileId());
        }
        return null;
    }

    private static RestCadenceStatus mapRestCadenceStatus(LoadAdventuringDaySummaryUseCase.RestCadenceStatus status) {
        return new RestCadenceStatus(
                status.characterId(),
                switch (status.nextMilestone()) {
                    case SHORT_REST_ONE -> RestMilestone.SHORT_REST_ONE;
                    case SHORT_REST_TWO -> RestMilestone.SHORT_REST_TWO;
                    case LONG_REST -> RestMilestone.LONG_REST;
                },
                status.xpDelta(),
                switch (status.urgency()) {
                    case NORMAL -> RestCadenceUrgency.NORMAL;
                    case SOON -> RestCadenceUrgency.SOON;
                    case OVERDUE -> RestCadenceUrgency.OVERDUE;
                });
    }

    private static AdventuringDayCalculation mapAdventuringDayCalculation(
            CalculateAdventuringDayUseCase.Result result
    ) {
        return new AdventuringDayCalculation(
                mapAdventuringDayBudget(result.budget()),
                mapAdventuringDayProgress(result.progress()));
    }

    private static AdventuringDayBudget mapAdventuringDayBudget(CalculateAdventuringDayUseCase.Budget budget) {
        return new AdventuringDayBudget(
                budget.totalXp(),
                budget.perThirdXp(),
                budget.firstShortRestXp(),
                budget.secondShortRestXp(),
                budget.characterCount());
    }

    private static AdventuringDayProgress mapAdventuringDayProgress(CalculateAdventuringDayUseCase.Progress progress) {
        return new AdventuringDayProgress(
                progress.totalGroupXp(),
                progress.perCharacterAwardedXp(),
                progress.partySize(),
                progress.fullDays(),
                progress.totalDays(),
                progress.shortRests(),
                progress.longRests(),
                progress.levelProgressions().stream()
                        .map(PartyApplicationService::mapAdventuringDayLevelProgress)
                        .toList(),
                progress.events().stream()
                        .map(PartyApplicationService::mapAdventuringDayProgressEvent)
                        .toList());
    }

    private static AdventuringDayLevelProgress mapAdventuringDayLevelProgress(
            CalculateAdventuringDayUseCase.LevelProgress progress
    ) {
        return new AdventuringDayLevelProgress(
                progress.startLevel(),
                progress.endLevel(),
                progress.characterCount(),
                progress.levelUps());
    }

    private static AdventuringDayProgressEvent mapAdventuringDayProgressEvent(
            CalculateAdventuringDayUseCase.ProgressEvent event
    ) {
        return new AdventuringDayProgressEvent(
                event.groupXp(),
                AdventuringDayProgressEventType.valueOf(event.type().name()),
                event.dayNumber(),
                event.newLevel(),
                event.affectedCharacters(),
                event.partialDay());
    }

    private static PartySnapshot emptySnapshot() {
        return new PartySnapshot(List.of(), List.of(), new PartySummary(0, 0, 1));
    }

    private static MutationStatus mapMutationStatus(PartyMutationStatus status) {
        if (status == null) {
            return MutationStatus.STORAGE_ERROR;
        }
        return switch (status) {
            case SUCCESS -> MutationStatus.SUCCESS;
            case NOT_FOUND -> MutationStatus.NOT_FOUND;
            case INVALID_INPUT -> MutationStatus.INVALID_INPUT;
            case STORAGE_ERROR -> MutationStatus.STORAGE_ERROR;
        };
    }

    private static PartyMembership toPartyMembership(@Nullable MembershipState membershipState) {
        if (membershipState == null) {
            return PartyMembership.RESERVE;
        }
        return membershipState == MembershipState.ACTIVE ? PartyMembership.ACTIVE : PartyMembership.RESERVE;
    }

    private static MembershipState toMembershipState(PartyMembership membership) {
        return membership == PartyMembership.ACTIVE ? MembershipState.ACTIVE : MembershipState.RESERVE;
    }

    private static PartyRestType toPartyRestType(@Nullable RestType restType) {
        if (restType == null) {
            return PartyRestType.SHORT_REST;
        }
        return restType == RestType.LONG_REST ? PartyRestType.LONG_REST : PartyRestType.SHORT_REST;
    }

    private static PartyCharacterDraft toDomainDraft(@Nullable CharacterDraft draft) {
        if (draft == null) {
            return new PartyCharacterDraft("", "", 0, 0, 0);
        }
        return new PartyCharacterDraft(
                draft.name(),
                draft.playerName(),
                draft.level(),
                draft.passivePerception(),
                draft.armorClass());
    }
}
