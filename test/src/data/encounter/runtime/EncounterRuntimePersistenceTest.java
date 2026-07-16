package src.data.encounter.runtime;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import src.domain.encounter.model.generation.EncounterGenerationInputs;
import src.domain.encounter.model.session.Combatant;
import src.domain.encounter.model.session.EncounterCreatureData;
import src.domain.encounter.model.session.EncounterSessionMemento;
import src.domain.encounter.model.session.GeneratedEncounterData;
import src.domain.encounter.model.session.InitiativeEntryData;
import src.domain.encounter.model.session.CombatantKind;
import src.domain.encounter.model.session.ResultStateData;

class EncounterRuntimePersistenceTest {
    @Test
    void completeContextMementoSurvivesSqliteRoundTrip() {
        EncounterCreatureData creature = new EncounterCreatureData(
                "world-npc-8", 101L, 8L, "Wache", "1", 200, 18, 14, 2,
                "Humanoid", "Szenen-NPC", 1, List.of("guard"));
        EncounterSessionMemento expected = new EncounterSessionMemento(
                EncounterSessionMemento.CURRENT_FORMAT_VERSION,
                2,
                "Kampf läuft",
                EncounterGenerationInputs.empty(),
                List.of(creature),
                Optional.empty(),
                3L,
                List.of(new GeneratedEncounterData("Torwache", "Medium", 200, List.of(creature), List.of("Hinweis"))),
                List.of("Aktiver Ort"),
                0,
                200,
                "Medium",
                "Torwache",
                true,
                4L,
                List.of(new InitiativeEntryData("pc-1", "Held", CombatantKind.PLAYER_CHARACTER, 16)),
                List.of(Combatant.playerCharacter("pc-1", "Held", 16, 0)),
                0,
                3,
                ResultStateData.empty());
        SqliteEncounterRuntimeStateRepository repository = new SqliteEncounterRuntimeStateRepository();

        repository.saveAll(Map.of("scene:901", expected));
        EncounterSessionMemento restored = repository.loadAll().get("scene:901");

        assertEquals(expected.status(), restored.status());
        assertEquals(3, restored.round());
        assertEquals("Wache", restored.roster().getFirst().name());
        assertEquals("Torwache", restored.generatedAlternatives().getFirst().title());
        assertTrue(restored.generationHistoryPresent());
    }
}
