package src.domain.party;

import java.util.List;
import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.party.application.AwardPartyXpUseCase;
import src.domain.party.application.CreateCharacterUseCase;
import src.domain.party.application.DeleteCharacterUseCase;
import src.domain.party.application.LoadActivePartyCompositionUseCase;
import src.domain.party.application.LoadActivePartyUseCase;
import src.domain.party.application.LoadAdventuringDaySummaryUseCase;
import src.domain.party.application.LoadPartySnapshotUseCase;
import src.domain.party.application.PerformPartyRestUseCase;
import src.domain.party.application.SetPartyMembershipUseCase;
import src.domain.party.application.UpdateCharacterUseCase;
import src.domain.party.published.ActivePartyComposition;
import src.domain.party.published.ActivePartyCompositionResult;
import src.domain.party.published.ActivePartyResult;
import src.domain.party.published.AdventuringDayResult;
import src.domain.party.published.AdventuringDaySummary;
import src.domain.party.published.AwardPartyXpCommand;
import src.domain.party.published.CharacterDraft;
import src.domain.party.published.CreateCharacterCommand;
import src.domain.party.published.DeleteCharacterCommand;
import src.domain.party.published.LoadActivePartyCompositionQuery;
import src.domain.party.published.LoadActivePartyQuery;
import src.domain.party.published.LoadAdventuringDaySummaryQuery;
import src.domain.party.published.LoadPartySnapshotQuery;
import src.domain.party.published.MembershipState;
import src.domain.party.published.MutationResult;
import src.domain.party.published.MutationStatus;
import src.domain.party.published.PerformPartyRestCommand;
import src.domain.party.published.PartyMemberDetails;
import src.domain.party.published.PartyMemberSummary;
import src.domain.party.published.PartySnapshot;
import src.domain.party.published.PartySnapshotResult;
import src.domain.party.published.PartySummary;
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

/**
 * Public backend facade for party management.
 */
public final class PartyApplicationService {

    private final LoadPartySnapshotUseCase loadPartySnapshotUseCase;
    private final LoadActivePartyUseCase loadActivePartyUseCase;
    private final LoadActivePartyCompositionUseCase loadActivePartyCompositionUseCase;
    private final LoadAdventuringDaySummaryUseCase loadAdventuringDaySummaryUseCase;
    private final CreateCharacterUseCase createCharacterUseCase;
    private final UpdateCharacterUseCase updateCharacterUseCase;
    private final DeleteCharacterUseCase deleteCharacterUseCase;
    private final SetPartyMembershipUseCase setPartyMembershipUseCase;
    private final AwardPartyXpUseCase awardPartyXpUseCase;
    private final PerformPartyRestUseCase performPartyRestUseCase;

    public PartyApplicationService(PartyRosterRepository rosterRepository) {
        PartyRosterRepository repository = Objects.requireNonNull(rosterRepository, "rosterRepository");
        this.loadPartySnapshotUseCase = new LoadPartySnapshotUseCase(repository);
        this.loadActivePartyUseCase = new LoadActivePartyUseCase(repository);
        this.loadActivePartyCompositionUseCase = new LoadActivePartyCompositionUseCase(repository);
        this.loadAdventuringDaySummaryUseCase = new LoadAdventuringDaySummaryUseCase(repository);
        this.createCharacterUseCase = new CreateCharacterUseCase(repository);
        this.updateCharacterUseCase = new UpdateCharacterUseCase(repository);
        this.deleteCharacterUseCase = new DeleteCharacterUseCase(repository);
        this.setPartyMembershipUseCase = new SetPartyMembershipUseCase(repository);
        this.awardPartyXpUseCase = new AwardPartyXpUseCase(repository);
        this.performPartyRestUseCase = new PerformPartyRestUseCase(repository);
    }

    public PartySnapshotResult loadSnapshot(LoadPartySnapshotQuery query) {
        try {
            return new PartySnapshotResult(ReadStatus.SUCCESS, mapSnapshot(loadPartySnapshotUseCase.execute()));
        } catch (IllegalStateException exception) {
            return new PartySnapshotResult(ReadStatus.STORAGE_ERROR, emptySnapshot());
        }
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

    public MutationResult createCharacter(CreateCharacterCommand command) {
        CharacterDraft draft = command == null ? null : command.draft();
        MembershipState membership = command == null ? null : command.membership();
        return new MutationResult(mapMutationStatus(createCharacterUseCase.execute(
                toDomainDraft(draft),
                toPartyMembership(membership))));
    }

    public MutationResult updateCharacter(UpdateCharacterCommand command) {
        return new MutationResult(mapMutationStatus(updateCharacterUseCase.execute(
                command == null ? 0L : command.id(),
                toDomainDraft(command == null ? null : command.draft()))));
    }

    public MutationResult deleteCharacter(DeleteCharacterCommand command) {
        long id = command == null ? 0L : command.id();
        return new MutationResult(mapMutationStatus(deleteCharacterUseCase.execute(id)));
    }

    public MutationResult setMembership(SetPartyMembershipCommand command) {
        long id = command == null ? 0L : command.id();
        MembershipState membership = command == null ? null : command.membership();
        return new MutationResult(mapMutationStatus(setPartyMembershipUseCase.execute(id, toPartyMembership(membership))));
    }

    public MutationResult awardXp(AwardPartyXpCommand command) {
        AwardPartyXpCommand effectiveCommand = command == null ? new AwardPartyXpCommand(List.of(), 0) : command;
        return new MutationResult(mapMutationStatus(awardPartyXpUseCase.execute(
                effectiveCommand.ids(),
                effectiveCommand.xpPerCharacter())));
    }

    public MutationResult performRest(PerformPartyRestCommand command) {
        RestType restType = command == null ? null : command.restType();
        return new MutationResult(mapMutationStatus(performPartyRestUseCase.execute(toPartyRestType(restType))));
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
                PartyLevelProgressionPolicy.xpToNextLevel(character.progress().level(), character.progress().currentXp()),
                PartyLevelProgressionPolicy.readyToLevel(character.progress().level(), character.progress().currentXp()),
                character.combat().passivePerception(),
                character.combat().armorClass(),
                character.progress().xpSinceShortRest(),
                character.progress().xpSinceLongRest(),
                character.progress().shortRestsTakenSinceLongRest(),
                toMembershipState(character.membership()));
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
