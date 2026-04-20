package src.domain.party;

import src.domain.party.published.ActivePartyCompositionResult;
import src.domain.party.published.ActivePartyResult;
import src.domain.party.published.AdventuringDayResult;
import src.domain.party.published.CharacterDraft;
import src.domain.party.published.MembershipState;
import src.domain.party.published.MutationResult;
import src.domain.party.published.PartySnapshotResult;
import src.domain.party.published.RestType;
import src.domain.party.roster.repository.PartyRosterRepository;
import src.domain.party.application.PartyMutationOperations;
import src.domain.party.application.PartyQueryOperations;
import src.domain.party.roster.value.PartyMembership;
import src.domain.party.roster.value.PartyRestType;

import java.util.List;
import java.util.Objects;

/**
 * Public backend facade for party management.
 */
public final class PartyApplicationService {

    @FunctionalInterface
    public interface Factory {

        PartyApplicationService create();
    }

    private final PartyQueryOperations queries;
    private final PartyMutationOperations mutations;

    public PartyApplicationService(PartyRosterRepository rosterRepository) {
        PartyRosterRepository repository = Objects.requireNonNull(rosterRepository, "rosterRepository");
        this.queries = new PartyQueryOperations(repository);
        this.mutations = new PartyMutationOperations(repository);
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
        return mutations.createCharacter(draft, toPartyMembership(membership));
    }

    public MutationResult updateCharacter(long id, CharacterDraft draft) {
        return mutations.updateCharacter(id, draft);
    }

    public MutationResult deleteCharacter(long id) {
        return mutations.deleteCharacter(id);
    }

    public MutationResult setMembership(long id, MembershipState membership) {
        return mutations.setMembership(id, toPartyMembership(membership));
    }

    public MutationResult awardXp(List<Long> ids, int xpPerCharacter) {
        return mutations.awardXp(ids, xpPerCharacter);
    }

    public MutationResult performRest(RestType restType) {
        return mutations.performRest(toPartyRestType(restType));
    }

    private static PartyMembership toPartyMembership(MembershipState membershipState) {
        if (membershipState == null) {
            return PartyMembership.RESERVE;
        }
        return membershipState == MembershipState.ACTIVE ? PartyMembership.ACTIVE : PartyMembership.RESERVE;
    }

    private static PartyRestType toPartyRestType(RestType restType) {
        if (restType == null) {
            return PartyRestType.SHORT_REST;
        }
        return restType == RestType.LONG_REST ? PartyRestType.LONG_REST : PartyRestType.SHORT_REST;
    }
}
