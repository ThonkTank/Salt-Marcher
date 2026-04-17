package src.domain.party.usecase;

import src.domain.party.entity.PartyCharacter;
import src.domain.party.repository.PartyRosterRepository;
import src.domain.party.valueobject.PartyXpTables;

import java.util.List;

public final class LoadAdventuringDaySummaryUseCase {

    private final PartyRosterRepository repository;

    public LoadAdventuringDaySummaryUseCase(PartyRosterRepository repository) {
        this.repository = repository;
    }

    public AdventuringDayStatus execute() {
        List<PartyCharacter> activeMembers = repository.load().activeMembers();
        if (activeMembers.isEmpty()) {
            return new AdventuringDayStatus(List.of(), 0, 0);
        }

        double remainingToShortRest = 0.0;
        double remainingToLongRest = 0.0;
        for (PartyCharacter character : activeMembers) {
            int totalBudget = PartyXpTables.adventuringDayXpPerCharacter(character.level());
            int shortRestBudget = Math.max(0, (int) Math.round(totalBudget / 3.0));
            remainingToShortRest += Math.max(0, shortRestBudget - character.xpSinceShortRest());
            remainingToLongRest += Math.max(0, totalBudget - character.xpSinceLongRest());
        }

        return new AdventuringDayStatus(
                activeMembers.stream().map(PartyCharacter::level).toList(),
                (int) Math.round(remainingToShortRest / activeMembers.size()),
                (int) Math.round(remainingToLongRest / activeMembers.size()));
    }

    public record AdventuringDayStatus(
            List<Integer> activeLevels,
            int remainingToShortRest,
            int remainingToLongRest
    ) {
        public AdventuringDayStatus {
            activeLevels = activeLevels == null ? List.of() : List.copyOf(activeLevels);
        }
    }
}
