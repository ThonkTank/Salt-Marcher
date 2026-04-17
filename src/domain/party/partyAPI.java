package src.domain.party;

import src.domain.party.entity.PartyCharacter;
import src.domain.party.repository.PartyRosterRepository;
import src.domain.party.usecase.AwardPartyXpUseCase;
import src.domain.party.usecase.CreateCharacterUseCase;
import src.domain.party.usecase.DeleteCharacterUseCase;
import src.domain.party.usecase.LoadActivePartyCompositionUseCase;
import src.domain.party.usecase.LoadActivePartyUseCase;
import src.domain.party.usecase.LoadAdventuringDaySummaryUseCase;
import src.domain.party.usecase.LoadPartySnapshotUseCase;
import src.domain.party.usecase.PartyRosterStore;
import src.domain.party.usecase.PerformPartyRestUseCase;
import src.domain.party.usecase.SetPartyMembershipUseCase;
import src.domain.party.usecase.UpdateCharacterUseCase;
import src.domain.party.valueobject.PartyMembership;
import src.domain.party.valueobject.PartyMutationStatus;
import src.domain.party.valueobject.PartyRestType;

import java.util.List;

/**
 * Public backend facade for party management.
 */
public final class partyAPI {

    private static final PartyRosterRepository ROSTER_REPOSITORY =
            PartyRosterStore.empty();

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

    public partyAPI() {
        this.loadPartySnapshotUseCase = new LoadPartySnapshotUseCase(ROSTER_REPOSITORY);
        this.loadActivePartyUseCase = new LoadActivePartyUseCase(ROSTER_REPOSITORY);
        this.loadActivePartyCompositionUseCase = new LoadActivePartyCompositionUseCase(ROSTER_REPOSITORY);
        this.loadAdventuringDaySummaryUseCase = new LoadAdventuringDaySummaryUseCase(ROSTER_REPOSITORY);
        this.createCharacterUseCase = new CreateCharacterUseCase(ROSTER_REPOSITORY);
        this.updateCharacterUseCase = new UpdateCharacterUseCase(ROSTER_REPOSITORY);
        this.deleteCharacterUseCase = new DeleteCharacterUseCase(ROSTER_REPOSITORY);
        this.setPartyMembershipUseCase = new SetPartyMembershipUseCase(ROSTER_REPOSITORY);
        this.awardPartyXpUseCase = new AwardPartyXpUseCase(ROSTER_REPOSITORY);
        this.performPartyRestUseCase = new PerformPartyRestUseCase(ROSTER_REPOSITORY);
    }

    public enum ReadStatus {
        SUCCESS,
        STORAGE_ERROR
    }

    public enum MutationStatus {
        SUCCESS,
        NOT_FOUND,
        INVALID_INPUT,
        STORAGE_ERROR
    }

    public enum MembershipState {
        ACTIVE,
        RESERVE
    }

    public enum RestType {
        SHORT_REST,
        LONG_REST
    }

    public record CharacterDraft(
            String name,
            String playerName,
            int level,
            int passivePerception,
            int armorClass
    ) {
    }

    public record PartyMemberSummary(
            Long id,
            String name,
            int level
    ) {
    }

    public record PartyMemberDetails(
            Long id,
            String name,
            String playerName,
            int level,
            int currentXp,
            int xpToNextLevel,
            boolean readyToLevel,
            int passivePerception,
            int armorClass,
            int xpSinceShortRest,
            int xpSinceLongRest,
            MembershipState membership
    ) {
    }

    public record PartySummary(
            int activeCount,
            int reserveCount,
            int averageLevel
    ) {
    }

    public record PartySnapshot(
            List<PartyMemberDetails> activeMembers,
            List<PartyMemberDetails> reserveMembers,
            PartySummary summary
    ) {
        public PartySnapshot {
            activeMembers = activeMembers == null ? List.of() : List.copyOf(activeMembers);
            reserveMembers = reserveMembers == null ? List.of() : List.copyOf(reserveMembers);
        }
    }

    public record ActivePartyResult(
            ReadStatus status,
            List<PartyMemberSummary> members
    ) {
        public ActivePartyResult {
            members = members == null ? List.of() : List.copyOf(members);
        }
    }

    public record PartySnapshotResult(
            ReadStatus status,
            PartySnapshot snapshot
    ) {
    }

    public record ActivePartyComposition(
            List<Integer> activePartyLevels,
            int averageLevel
    ) {
        public ActivePartyComposition {
            activePartyLevels = activePartyLevels == null ? List.of() : List.copyOf(activePartyLevels);
        }
    }

    public record ActivePartyCompositionResult(
            ReadStatus status,
            ActivePartyComposition composition
    ) {
    }

    public record AdventuringDaySummary(
            List<Integer> activePartyLevels,
            int remainingToShortRest,
            int remainingToLongRest
    ) {
        public AdventuringDaySummary {
            activePartyLevels = activePartyLevels == null ? List.of() : List.copyOf(activePartyLevels);
        }
    }

    public record AdventuringDayResult(
            ReadStatus status,
            AdventuringDaySummary summary
    ) {
    }

    public record MutationResult(
            MutationStatus status
    ) {
    }

    public PartySnapshotResult loadSnapshot() {
        try {
            PartySnapshot snapshot = mapSnapshot(loadPartySnapshotUseCase.execute());
            return new PartySnapshotResult(ReadStatus.SUCCESS, snapshot);
        } catch (RuntimeException exception) {
            return new PartySnapshotResult(ReadStatus.STORAGE_ERROR, emptySnapshot());
        }
    }

    public ActivePartyResult loadActiveParty() {
        try {
            return new ActivePartyResult(
                    ReadStatus.SUCCESS,
                    loadActivePartyUseCase.execute().stream().map(this::mapSummary).toList());
        } catch (RuntimeException exception) {
            return new ActivePartyResult(ReadStatus.STORAGE_ERROR, List.of());
        }
    }

    public ActivePartyCompositionResult loadActivePartyComposition() {
        try {
            ActivePartyComposition composition = loadActivePartyCompositionUseCase.execute();
            return new ActivePartyCompositionResult(ReadStatus.SUCCESS, composition);
        } catch (RuntimeException exception) {
            return new ActivePartyCompositionResult(
                    ReadStatus.STORAGE_ERROR,
                    new ActivePartyComposition(List.of(), 1));
        }
    }

    public AdventuringDayResult loadAdventuringDaySummary() {
        try {
            LoadAdventuringDaySummaryUseCase.AdventuringDayStatus dayStatus = loadAdventuringDaySummaryUseCase.execute();
            return new AdventuringDayResult(
                    ReadStatus.SUCCESS,
                    new AdventuringDaySummary(
                            dayStatus.activeLevels(),
                            dayStatus.remainingToShortRest(),
                            dayStatus.remainingToLongRest()));
        } catch (RuntimeException exception) {
            return new AdventuringDayResult(
                    ReadStatus.STORAGE_ERROR,
                    new AdventuringDaySummary(List.of(), 0, 0));
        }
    }

    public MutationResult createCharacter(CharacterDraft draft, MembershipState membership) {
        return new MutationResult(mapMutationStatus(
                createCharacterUseCase.execute(draft, PartyMembership.fromApi(membership))));
    }

    public MutationResult updateCharacter(long id, CharacterDraft draft) {
        return new MutationResult(mapMutationStatus(updateCharacterUseCase.execute(id, draft)));
    }

    public MutationResult deleteCharacter(long id) {
        return new MutationResult(mapMutationStatus(deleteCharacterUseCase.execute(id)));
    }

    public MutationResult setMembership(long id, MembershipState membership) {
        return new MutationResult(mapMutationStatus(
                setPartyMembershipUseCase.execute(id, PartyMembership.fromApi(membership))));
    }

    public MutationResult awardXp(List<Long> ids, int xpPerCharacter) {
        return new MutationResult(mapMutationStatus(awardPartyXpUseCase.execute(ids, xpPerCharacter)));
    }

    public MutationResult performRest(RestType restType) {
        return new MutationResult(mapMutationStatus(
                performPartyRestUseCase.execute(PartyRestType.fromApi(restType))));
    }

    private PartySnapshot mapSnapshot(LoadPartySnapshotUseCase.PartySnapshotProjection projection) {
        return new PartySnapshot(
                projection.activeMembers().stream().map(this::mapDetails).toList(),
                projection.reserveMembers().stream().map(this::mapDetails).toList(),
                new PartySummary(
                        projection.activeMembers().size(),
                        projection.reserveMembers().size(),
                        projection.averageLevel()));
    }

    private PartyMemberSummary mapSummary(PartyCharacter character) {
        return new PartyMemberSummary(character.id(), character.name(), character.level());
    }

    private PartyMemberDetails mapDetails(PartyCharacter character) {
        return new PartyMemberDetails(
                character.id(),
                character.name(),
                character.playerName(),
                character.level(),
                character.currentXp(),
                character.xpToNextLevel(),
                character.readyToLevel(),
                character.passivePerception(),
                character.armorClass(),
                character.xpSinceShortRest(),
                character.xpSinceLongRest(),
                character.membership().toApi());
    }

    private PartySnapshot emptySnapshot() {
        return new PartySnapshot(List.of(), List.of(), new PartySummary(0, 0, 1));
    }

    private MutationStatus mapMutationStatus(PartyMutationStatus status) {
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
}
