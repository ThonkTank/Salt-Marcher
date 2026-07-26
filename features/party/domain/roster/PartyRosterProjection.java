package features.party.domain.roster;

import java.util.ArrayList;
import java.util.List;
import org.jspecify.annotations.Nullable;

public record PartyRosterProjection(
        List<PartyCharacter> activeMembers,
        List<PartyCharacter> reserveMembers,
        List<Integer> activeLevelsByComposition,
        @Nullable Integer averageActiveLevel
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
        boolean incompleteComposition = false;
        for (PartyCharacter character : activeMembersByLevel) {
            Integer level = character.progress().level();
            if (level != null) {
                activeLevels.add(level);
                totalLevel += level;
            } else {
                incompleteComposition = true;
            }
        }

        if (incompleteComposition) {
            activeLevels.clear();
        }
        Integer averageLevel = activeLevels.isEmpty()
                ? null
                : (int) Math.round((double) totalLevel / activeLevels.size());
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
        Integer firstLevel = first.progress().level();
        Integer secondLevel = second.progress().level();
        if (firstLevel == null && secondLevel != null) {
            return 1;
        }
        if (firstLevel != null && secondLevel == null) {
            return -1;
        }
        int levelComparison = firstLevel == null ? 0 : Integer.compare(firstLevel, secondLevel);
        if (levelComparison != 0) {
            return levelComparison;
        }
        return Long.compare(first.id(), second.id());
    }
}
