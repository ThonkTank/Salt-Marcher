package src.domain.party.model.roster.model;

import java.util.ArrayList;
import java.util.List;

public record PartyRosterProjection(
        List<PartyCharacter> activeMembers,
        List<PartyCharacter> reserveMembers,
        List<Integer> activeLevelsByComposition,
        int averageActiveLevel
) {
    public PartyRosterProjection {
        activeMembers = activeMembers == null ? List.of() : List.copyOf(activeMembers);
        reserveMembers = reserveMembers == null ? List.of() : List.copyOf(reserveMembers);
        activeLevelsByComposition = activeLevelsByComposition == null ? List.of() : List.copyOf(activeLevelsByComposition);
    }

    @Override
    public List<PartyCharacter> activeMembers() {
        return List.copyOf(activeMembers);
    }

    @Override
    public List<PartyCharacter> reserveMembers() {
        return List.copyOf(reserveMembers);
    }

    @Override
    public List<Integer> activeLevelsByComposition() {
        return List.copyOf(activeLevelsByComposition);
    }

    public static PartyRosterProjection from(List<PartyCharacter> characters) {
        List<PartyCharacter> activeMembers = new ArrayList<>();
        List<PartyCharacter> reserveMembers = new ArrayList<>();
        for (PartyCharacter character : characters) {
            if (character.membership().isActive()) {
                activeMembers.add(character);
            } else {
                reserveMembers.add(character);
            }
        }
        activeMembers.sort(PartyRosterProjection::compareActiveMembers);
        reserveMembers.sort(PartyRosterProjection::compareReserveMembers);

        List<PartyCharacter> activeMembersByLevel = new ArrayList<>(activeMembers);
        activeMembersByLevel.sort(PartyRosterProjection::compareActiveLevels);
        List<Integer> activeLevels = new ArrayList<>(activeMembersByLevel.size());
        int totalLevel = 0;
        for (PartyCharacter character : activeMembersByLevel) {
            int level = character.progress().level();
            activeLevels.add(level);
            totalLevel += level;
        }

        int averageLevel = activeMembers.isEmpty()
                ? 1
                : (int) Math.round((double) totalLevel / activeMembers.size());
        return new PartyRosterProjection(activeMembers, reserveMembers, activeLevels, averageLevel);
    }

    private static int compareActiveMembers(PartyCharacter first, PartyCharacter second) {
        return Long.compare(first.id(), second.id());
    }

    private static int compareReserveMembers(PartyCharacter first, PartyCharacter second) {
        int nameComparison = String.CASE_INSENSITIVE_ORDER.compare(
                first.identity().name(),
                second.identity().name());
        if (nameComparison != 0) {
            return nameComparison;
        }
        return Long.compare(first.id(), second.id());
    }

    private static int compareActiveLevels(PartyCharacter first, PartyCharacter second) {
        int levelComparison = Integer.compare(first.progress().level(), second.progress().level());
        if (levelComparison != 0) {
            return levelComparison;
        }
        return Long.compare(first.id(), second.id());
    }
}
