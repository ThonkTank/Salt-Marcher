package src.domain.party;

import src.domain.party.repository.PartyRosterRepository;
import src.domain.party.usecase.PartyMutationOperations;
import src.domain.party.usecase.PartyQueryOperations;
import src.domain.party.valueobject.PartyMembership;
import src.domain.party.valueobject.PartyRestType;

import java.util.List;
import java.util.Objects;

/**
 * Public backend facade for party management.
 */
public final class partyAPI {

    private final PartyQueryOperations queries;
    private final PartyMutationOperations mutations;

    public partyAPI(PartyRosterRepository rosterRepository) {
        PartyRosterRepository repository = Objects.requireNonNull(rosterRepository, "rosterRepository");
        this.queries = new PartyQueryOperations(repository);
        this.mutations = new PartyMutationOperations(repository);
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
        return queries.loadSnapshot();
    }

    public ActivePartyResult loadActiveParty() {
        return queries.loadActiveParty();
    }

    public ActivePartyCompositionResult loadActivePartyComposition() {
        return queries.loadActivePartyComposition();
    }

    public AdventuringDayResult loadAdventuringDaySummary() {
        return queries.loadAdventuringDaySummary();
    }

    public MutationResult createCharacter(CharacterDraft draft, MembershipState membership) {
        return mutations.createCharacter(draft, PartyMembership.fromApi(membership));
    }

    public MutationResult updateCharacter(long id, CharacterDraft draft) {
        return mutations.updateCharacter(id, draft);
    }

    public MutationResult deleteCharacter(long id) {
        return mutations.deleteCharacter(id);
    }

    public MutationResult setMembership(long id, MembershipState membership) {
        return mutations.setMembership(id, PartyMembership.fromApi(membership));
    }

    public MutationResult awardXp(List<Long> ids, int xpPerCharacter) {
        return mutations.awardXp(ids, xpPerCharacter);
    }

    public MutationResult performRest(RestType restType) {
        return mutations.performRest(PartyRestType.fromApi(restType));
    }
}
