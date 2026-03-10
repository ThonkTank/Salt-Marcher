package features.spells.api;

import features.spells.model.Spell;
import features.spells.repository.SpellRepository;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.Optional;

public final class SpellReadApi {
    private SpellReadApi() {
        throw new AssertionError("No instances");
    }

    public static SpellOffenseProfileLookup offenseProfileLookup(Connection conn) {
        return new DatabaseSpellOffenseProfileLookup(conn);
    }

    public static Spell findByExactName(Connection conn, String spellName) throws SQLException {
        return SpellRepository.findByExactName(conn, spellName);
    }

    public static Optional<SpellOffenseProfileLookup.SpellOffenseProfile> findOffenseProfileByName(
            Connection conn,
            String spellName) throws SQLException {
        Spell spell = SpellRepository.findByExactName(conn, spellName);
        if (spell == null || !spell.IsOffensive) {
            return Optional.empty();
        }
        String targetProfile = spell.TargetProfile == null || spell.TargetProfile.isBlank()
                ? "utility"
                : spell.TargetProfile;
        double expectedDamagePerUse = switch (targetProfile) {
            case "large_aoe" -> spell.ExpectedDamageLargeAoe;
            case "small_aoe" -> spell.ExpectedDamageSmallAoe;
            case "single" -> spell.ExpectedDamageSingle;
            default -> Math.max(
                    spell.ExpectedDamageSingle,
                    Math.max(spell.ExpectedDamageSmallAoe, spell.ExpectedDamageLargeAoe));
        };
        if (expectedDamagePerUse <= 0.0) {
            return Optional.empty();
        }
        return Optional.of(new SpellOffenseProfileLookup.SpellOffenseProfile(
                spell.Name,
                spell.Level,
                spell.CastingChannel,
                targetProfile,
                expectedDamagePerUse));
    }
}
