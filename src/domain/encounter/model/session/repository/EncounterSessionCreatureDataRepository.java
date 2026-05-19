package src.domain.encounter.model.session.repository;

import java.util.List;
import java.util.Optional;
import src.domain.encounter.model.generation.model.GeneratedEncounterCreatureData;
import src.domain.encounter.model.reference.model.EncounterCreatureReference;
import src.domain.encounter.model.reference.repository.EncounterCreatureRepository;
import src.domain.encounter.model.session.model.CreatureDetailData;
import src.domain.encounter.model.session.model.EncounterCreatureData;

final class EncounterSessionCreatureDataRepository {

    private static final String DEFAULT_CREATURE_ROLE = "Creature";
    private static final String AUTO_RESOLVED_MESSAGE =
            "Auto-Einstellungen wurden fuer diese Generierung auf konkrete Zielwerte aufgeloest.";
    private static final String FALLBACK_MESSAGE =
            "Kein exakter Treffer war verfuegbar. Die beste gefundene Alternative wurde uebernommen.";

    private final EncounterCreatureRepository creatures;

    EncounterSessionCreatureDataRepository(EncounterCreatureRepository creatures) {
        this.creatures = creatures;
    }

    EncounterCreatureData toCreature(GeneratedEncounterCreatureData creature) {
        Optional<CreatureDetailData> detail = toCreatureDetail(creature.creatureId());
        if (detail.isPresent()) {
            CreatureDetailData current = detail.orElseThrow();
            return detailedCreature(creature, current);
        }
        return fallbackCreature(creature);
    }

    Optional<CreatureDetailData> toCreatureDetail(long creatureId) {
        return creatures.loadCreature(creatureId).map(EncounterSessionCreatureDataRepository::toCreatureDetail);
    }

    List<String> advisoryMessages(boolean autoResolved, boolean fallbackUsed) {
        List<String> messages = new java.util.ArrayList<>();
        if (autoResolved) {
            messages.add(AUTO_RESOLVED_MESSAGE);
        }
        if (fallbackUsed) {
            messages.add(FALLBACK_MESSAGE);
        }
        return List.copyOf(messages);
    }

    private static EncounterCreatureData detailedCreature(
            GeneratedEncounterCreatureData creature,
            CreatureDetailData current
    ) {
        return new EncounterCreatureData(
                "monster-" + current.id(),
                current.id(),
                current.name(),
                current.challengeRating(),
                current.xp(),
                Math.max(1, current.hitPoints()),
                current.armorClass(),
                current.initiativeBonus(),
                current.creatureType(),
                normalizeRole(creature.role()),
                creature.quantity(),
                creature.tags());
    }

    private static EncounterCreatureData fallbackCreature(GeneratedEncounterCreatureData creature) {
        return new EncounterCreatureData(
                "monster-" + creature.creatureId(),
                creature.creatureId(),
                creature.name(),
                creature.challengeRating(),
                creature.xp(),
                1,
                10,
                0,
                "",
                normalizeRole(creature.role()),
                creature.quantity(),
                creature.tags());
    }

    private static String normalizeRole(String role) {
        return role == null || role.isBlank() ? DEFAULT_CREATURE_ROLE : role;
    }

    private static CreatureDetailData toCreatureDetail(EncounterCreatureReference creature) {
        return new CreatureDetailData(
                creature.id(),
                creature.name(),
                creature.challengeRating(),
                creature.xp(),
                creature.hitPoints(),
                creature.armorClass(),
                creature.initiativeBonus(),
                creature.creatureType());
    }
}
