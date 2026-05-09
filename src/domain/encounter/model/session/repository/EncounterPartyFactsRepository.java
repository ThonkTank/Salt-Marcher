package src.domain.encounter.model.session.repository;

import java.util.List;
import src.domain.encounter.model.session.model.EncounterSessionValues.PartyMemberData;

public interface EncounterPartyFactsRepository {

    PartyBudgetFacts loadPartyBudgetFacts();

    List<PartyMemberData> loadActiveParty();

    boolean awardXp(List<Long> partyMemberIds, int xpPerCharacter);

    record PartyBudgetFacts(
            Status status,
            List<Integer> activePartyLevels,
            int averageLevel,
            int consumedDailyXp,
            int totalBudgetXp
    ) {

        public PartyBudgetFacts {
            activePartyLevels = activePartyLevels == null ? List.of() : List.copyOf(activePartyLevels);
        }

        public static PartyBudgetFacts success(
                List<Integer> activePartyLevels,
                int averageLevel,
                int consumedDailyXp,
                int totalBudgetXp
        ) {
            return new PartyBudgetFacts(
                    Status.SUCCESS,
                    activePartyLevels,
                    averageLevel,
                    consumedDailyXp,
                    totalBudgetXp);
        }

        public static PartyBudgetFacts noActiveParty() {
            return new PartyBudgetFacts(Status.NO_ACTIVE_PARTY, List.of(), 0, 0, 0);
        }

        public static PartyBudgetFacts storageError() {
            return new PartyBudgetFacts(Status.STORAGE_ERROR, List.of(), 0, 0, 0);
        }
    }

    enum Status {
        SUCCESS,
        NO_ACTIVE_PARTY,
        STORAGE_ERROR;

        public static Status successStatus() {
            return SUCCESS;
        }

        public static Status noActivePartyStatus() {
            return NO_ACTIVE_PARTY;
        }

        public static Status storageErrorStatus() {
            return STORAGE_ERROR;
        }

        public boolean isSuccess() {
            return this == SUCCESS;
        }

        public boolean isNoActiveParty() {
            return this == NO_ACTIVE_PARTY;
        }

        public boolean isStorageError() {
            return this == STORAGE_ERROR;
        }
    }
}
