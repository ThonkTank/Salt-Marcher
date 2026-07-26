package features.party.application;

import static org.junit.jupiter.api.Assertions.assertEquals;

import features.party.domain.roster.PartyCharacterDraft;
import features.party.domain.roster.PartyMembership;
import features.party.domain.roster.PartyRoster;
import java.util.List;
import org.junit.jupiter.api.Test;
import platform.ui.DirectUiDispatcher;

final class ActivePartyFactsPublicationTest {

    @Test
    void sameSizeReplacementPublishesOneNewRevisionWithoutChangingCapturedFacts() {
        PartyPublishedState state = new PartyPublishedState(DirectUiDispatcher.INSTANCE);
        PartyRoster firstRoster = activeRoster("Aria", 3);
        state.publishRoster(firstRoster);
        var first = state.activePartyFactsModel().current();

        PartyRoster secondRoster = firstRoster.updateCharacter(
                1L, new PartyCharacterDraft("Borin", null, 10, null, null)).roster();
        state.publishRoster(secondRoster);
        var second = state.activePartyFactsModel().current();

        assertEquals(1L, first.facts().revision());
        assertEquals("Aria", first.facts().members().getFirst().name());
        assertEquals(List.of(3), first.facts().composition().activePartyLevels());
        assertEquals(2L, second.facts().revision());
        assertEquals("Borin", second.facts().members().getFirst().name());
        assertEquals(List.of(10), second.facts().composition().activePartyLevels());
    }

    private static PartyRoster activeRoster(String name, int level) {
        PartyRoster roster = new PartyRoster(1L, List.of())
                .createCharacter(new PartyCharacterDraft(name, null, level, null, null))
                .roster();
        return roster.setMembership(1L, PartyMembership.ACTIVE).roster();
    }
}
