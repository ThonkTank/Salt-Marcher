package features.spells.api;

import java.util.Optional;

public interface SpellOffenseProfileLookup {
    SpellOffenseProfileLookup NO_OP = spellName -> Optional.empty();

    Optional<SpellOffenseProfile> findByName(String spellName);

    record SpellOffenseProfile(
            String spellName,
            int spellLevel,
            String castingChannel,
            String targetProfile,
            double expectedDamagePerUse
    ) {}
}
