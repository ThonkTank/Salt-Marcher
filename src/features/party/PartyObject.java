package features.party;

import database.DatabaseManager;
import features.party.input.AddToPartyInput;
import features.party.input.AwardXpToCharacterInput;
import features.party.input.AwardXpToCharactersInput;
import features.party.input.CalculatePartyLevelInput;
import features.party.input.CreateCharacterAndAddToPartyInput;
import features.party.input.DeleteCharacterInput;
import features.party.input.LoadActivePartyInput;
import features.party.input.LoadActivePartyLevelsForCompositionInput;
import features.party.input.LoadActivePartyLevelsInput;
import features.party.input.LoadAdventuringDayPartyInput;
import features.party.input.LoadPartySnapshotInput;
import features.party.input.PerformLongRestInput;
import features.party.input.PerformShortRestInput;
import features.party.input.RemoveFromPartyInput;
import features.party.input.UpdateCharacterInput;
import features.party.model.PlayerCharacter;
import features.party.repository.PlayerCharacterRepository;
import features.party.service.PartyProgressionRules;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.List;
import java.util.Objects;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * Canonical root seam for party reads, mutations, and party-owned workflow
 * state consumed by shell, encounter, and party-owned UI.
 */
@SuppressWarnings("unused")
public final class PartyObject {
    private static final Logger LOGGER = Logger.getLogger(PartyObject.class.getName());

    public LoadActivePartyInput.LoadedActivePartyInput loadActiveParty(LoadActivePartyInput input) {
        try (Connection conn = DatabaseManager.getConnection()) {
            return new LoadActivePartyInput.LoadedActivePartyInput(
                    LoadActivePartyInput.Status.SUCCESS,
                    PlayerCharacterRepository.getPartyMembers(conn).stream()
                            .map(PartyObject::toPartyMember)
                            .toList());
        } catch (SQLException e) {
            LOGGER.log(Level.WARNING, "PartyObject.loadActiveParty(): DB access failed", e);
            return new LoadActivePartyInput.LoadedActivePartyInput(
                    LoadActivePartyInput.Status.STORAGE_ERROR,
                    List.of());
        }
    }

    public LoadPartySnapshotInput.LoadedPartySnapshotInput loadPartySnapshot(LoadPartySnapshotInput input) {
        try (Connection conn = DatabaseManager.getConnection()) {
            return new LoadPartySnapshotInput.LoadedPartySnapshotInput(
                    LoadPartySnapshotInput.Status.SUCCESS,
                    PlayerCharacterRepository.getPartyMembers(conn).stream()
                            .map(PartyObject::toCharacter)
                            .toList(),
                    PlayerCharacterRepository.getAvailableCharacters(conn).stream()
                            .map(PartyObject::toCharacter)
                            .toList());
        } catch (SQLException e) {
            LOGGER.log(Level.WARNING, "PartyObject.loadPartySnapshot(): DB access failed", e);
            return new LoadPartySnapshotInput.LoadedPartySnapshotInput(
                    LoadPartySnapshotInput.Status.STORAGE_ERROR,
                    List.of(),
                    List.of());
        }
    }

    public LoadAdventuringDayPartyInput.LoadedAdventuringDayPartyInput loadAdventuringDayParty(LoadAdventuringDayPartyInput input) {
        try (Connection conn = DatabaseManager.getConnection()) {
            List<PlayerCharacter> members = PlayerCharacterRepository.getPartyMembers(conn);
            PartyProgressionRules.AdventuringDayStatus status = PartyProgressionRules.computeAdventuringDayStatus(members);
            return new LoadAdventuringDayPartyInput.LoadedAdventuringDayPartyInput(
                    LoadAdventuringDayPartyInput.Status.SUCCESS,
                    new LoadAdventuringDayPartyInput.AdventuringDayPartySummaryInput(
                            members.stream().map(pc -> pc.Level).toList(),
                            status.remainingToShortRest(),
                            status.remainingToLongRest()));
        } catch (SQLException e) {
            LOGGER.log(Level.WARNING, "PartyObject.loadAdventuringDayParty(): DB access failed", e);
            return new LoadAdventuringDayPartyInput.LoadedAdventuringDayPartyInput(
                    LoadAdventuringDayPartyInput.Status.STORAGE_ERROR,
                    null);
        }
    }

    public CalculatePartyLevelInput.CalculatedPartyLevelInput calculatePartyLevel(CalculatePartyLevelInput input) {
        List<Integer> levels = input == null || input.levels() == null ? List.of() : input.levels();
        int calculatedLevel = levels.isEmpty()
                ? 1
                : (int) Math.round(levels.stream().filter(Objects::nonNull).mapToInt(Integer::intValue).average().orElse(1));
        return new CalculatePartyLevelInput.CalculatedPartyLevelInput(calculatedLevel);
    }

    public LoadActivePartyLevelsInput.LoadedActivePartyLevelsInput loadActivePartyLevels(LoadActivePartyLevelsInput input)
            throws SQLException {
        Connection conn = requireConnection(input.connection(), "PartyObject.loadActivePartyLevels()");
        return new LoadActivePartyLevelsInput.LoadedActivePartyLevelsInput(
                PlayerCharacterRepository.getActivePartyLevels(conn));
    }

    public LoadActivePartyLevelsForCompositionInput.LoadedActivePartyLevelsForCompositionInput loadActivePartyLevelsForComposition(
            LoadActivePartyLevelsForCompositionInput input) throws SQLException {
        Connection conn = requireConnection(input.connection(), "PartyObject.loadActivePartyLevelsForComposition()");
        return new LoadActivePartyLevelsForCompositionInput.LoadedActivePartyLevelsForCompositionInput(
                PlayerCharacterRepository.getActivePartyLevelsForComposition(conn));
    }

    public AddToPartyInput.AddedToPartyInput addToParty(AddToPartyInput input) {
        if (input == null || input.id() == null) {
            return new AddToPartyInput.AddedToPartyInput(AddToPartyInput.Status.NOT_FOUND);
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            boolean oldAutoCommit = conn.getAutoCommit();
            conn.setAutoCommit(false);
            try {
                boolean updated = PlayerCharacterRepository.addToParty(conn, input.id());
                if (!updated) {
                    conn.rollback();
                    return new AddToPartyInput.AddedToPartyInput(AddToPartyInput.Status.NOT_FOUND);
                }
                conn.commit();
                return new AddToPartyInput.AddedToPartyInput(AddToPartyInput.Status.SUCCESS);
            } catch (SQLException e) {
                conn.rollback();
                throw e;
            } finally {
                conn.setAutoCommit(oldAutoCommit);
            }
        } catch (SQLException e) {
            LOGGER.log(Level.WARNING, "PartyObject.addToParty(): DB access failed", e);
            return new AddToPartyInput.AddedToPartyInput(AddToPartyInput.Status.STORAGE_ERROR);
        }
    }

    public RemoveFromPartyInput.RemovedFromPartyInput removeFromParty(RemoveFromPartyInput input) {
        if (input == null || input.id() == null) {
            return new RemoveFromPartyInput.RemovedFromPartyInput(RemoveFromPartyInput.Status.NOT_FOUND);
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            boolean oldAutoCommit = conn.getAutoCommit();
            conn.setAutoCommit(false);
            try {
                boolean updated = PlayerCharacterRepository.removeFromParty(conn, input.id());
                if (!updated) {
                    conn.rollback();
                    return new RemoveFromPartyInput.RemovedFromPartyInput(RemoveFromPartyInput.Status.NOT_FOUND);
                }
                conn.commit();
                return new RemoveFromPartyInput.RemovedFromPartyInput(RemoveFromPartyInput.Status.SUCCESS);
            } catch (SQLException e) {
                conn.rollback();
                throw e;
            } finally {
                conn.setAutoCommit(oldAutoCommit);
            }
        } catch (SQLException e) {
            LOGGER.log(Level.WARNING, "PartyObject.removeFromParty(): DB access failed", e);
            return new RemoveFromPartyInput.RemovedFromPartyInput(RemoveFromPartyInput.Status.STORAGE_ERROR);
        }
    }

    public DeleteCharacterInput.DeletedCharacterInput deleteCharacter(DeleteCharacterInput input) {
        if (input == null || input.id() == null) {
            return new DeleteCharacterInput.DeletedCharacterInput(DeleteCharacterInput.Status.NOT_FOUND);
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            boolean oldAutoCommit = conn.getAutoCommit();
            conn.setAutoCommit(false);
            try {
                boolean deleted = PlayerCharacterRepository.deleteCharacter(conn, input.id());
                if (!deleted) {
                    conn.rollback();
                    return new DeleteCharacterInput.DeletedCharacterInput(DeleteCharacterInput.Status.NOT_FOUND);
                }
                conn.commit();
                return new DeleteCharacterInput.DeletedCharacterInput(DeleteCharacterInput.Status.SUCCESS);
            } catch (SQLException e) {
                conn.rollback();
                throw e;
            } finally {
                conn.setAutoCommit(oldAutoCommit);
            }
        } catch (SQLException e) {
            LOGGER.log(Level.WARNING, "PartyObject.deleteCharacter(): DB access failed", e);
            return new DeleteCharacterInput.DeletedCharacterInput(DeleteCharacterInput.Status.STORAGE_ERROR);
        }
    }

    public UpdateCharacterInput.UpdatedCharacterInput updateCharacter(UpdateCharacterInput input) {
        if (input == null || input.id() == null) {
            return new UpdateCharacterInput.UpdatedCharacterInput(UpdateCharacterInput.Status.NOT_FOUND);
        }
        if (input.name() == null
                || input.level() == null
                || input.passivePerception() == null
                || input.armorClass() == null) {
            return new UpdateCharacterInput.UpdatedCharacterInput(UpdateCharacterInput.Status.STORAGE_ERROR);
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            boolean oldAutoCommit = conn.getAutoCommit();
            conn.setAutoCommit(false);
            try {
                PlayerCharacter existing = PlayerCharacterRepository.getCharacterById(conn, input.id());
                if (existing == null) {
                    conn.rollback();
                    return new UpdateCharacterInput.UpdatedCharacterInput(UpdateCharacterInput.Status.NOT_FOUND);
                }
                boolean updated = PlayerCharacterRepository.updateCharacter(
                        conn,
                        input.id(),
                        input.name(),
                        input.playerName(),
                        input.level(),
                        PartyProgressionRules.normalizeCurrentXpForLevel(input.level(), existing.CurrentXp),
                        input.passivePerception(),
                        input.armorClass());
                if (!updated) {
                    conn.rollback();
                    return new UpdateCharacterInput.UpdatedCharacterInput(UpdateCharacterInput.Status.NOT_FOUND);
                }
                conn.commit();
                return new UpdateCharacterInput.UpdatedCharacterInput(UpdateCharacterInput.Status.SUCCESS);
            } catch (SQLException e) {
                conn.rollback();
                throw e;
            } finally {
                conn.setAutoCommit(oldAutoCommit);
            }
        } catch (SQLException e) {
            LOGGER.log(Level.WARNING, "PartyObject.updateCharacter(): DB access failed", e);
            return new UpdateCharacterInput.UpdatedCharacterInput(UpdateCharacterInput.Status.STORAGE_ERROR);
        }
    }

    public CreateCharacterAndAddToPartyInput.CreatedCharacterAndAddedToPartyInput createCharacterAndAddToParty(
            CreateCharacterAndAddToPartyInput input) {
        if (input == null
                || input.name() == null
                || input.level() == null
                || input.passivePerception() == null
                || input.armorClass() == null) {
            return new CreateCharacterAndAddToPartyInput.CreatedCharacterAndAddedToPartyInput(
                    CreateCharacterAndAddToPartyInput.Status.STORAGE_ERROR);
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            boolean oldAutoCommit = conn.getAutoCommit();
            conn.setAutoCommit(false);
            try {
                PlayerCharacter created = PlayerCharacterRepository.createCharacter(
                        conn,
                        input.name(),
                        input.playerName(),
                        input.level(),
                        input.passivePerception(),
                        input.armorClass(),
                        true);
                if (created == null) {
                    conn.rollback();
                    return new CreateCharacterAndAddToPartyInput.CreatedCharacterAndAddedToPartyInput(
                            CreateCharacterAndAddToPartyInput.Status.STORAGE_ERROR);
                }
                conn.commit();
                return new CreateCharacterAndAddToPartyInput.CreatedCharacterAndAddedToPartyInput(
                        CreateCharacterAndAddToPartyInput.Status.SUCCESS);
            } catch (SQLException e) {
                conn.rollback();
                throw e;
            } finally {
                conn.setAutoCommit(oldAutoCommit);
            }
        } catch (SQLException e) {
            LOGGER.log(Level.WARNING, "PartyObject.createCharacterAndAddToParty(): DB access failed", e);
            return new CreateCharacterAndAddToPartyInput.CreatedCharacterAndAddedToPartyInput(
                    CreateCharacterAndAddToPartyInput.Status.STORAGE_ERROR);
        }
    }

    public AwardXpToCharacterInput.AwardedXpToCharacterInput awardXpToCharacter(AwardXpToCharacterInput input) {
        if (input == null || input.id() == null || input.xpAmount() == null || input.xpAmount() <= 0) {
            return new AwardXpToCharacterInput.AwardedXpToCharacterInput(AwardXpToCharacterInput.Status.NOT_FOUND);
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            boolean oldAutoCommit = conn.getAutoCommit();
            conn.setAutoCommit(false);
            try {
                int updated = PlayerCharacterRepository.awardXpToCharacter(conn, input.id(), input.xpAmount());
                if (updated <= 0) {
                    conn.rollback();
                    return new AwardXpToCharacterInput.AwardedXpToCharacterInput(AwardXpToCharacterInput.Status.NOT_FOUND);
                }
                conn.commit();
                return new AwardXpToCharacterInput.AwardedXpToCharacterInput(AwardXpToCharacterInput.Status.SUCCESS);
            } catch (SQLException e) {
                conn.rollback();
                throw e;
            } finally {
                conn.setAutoCommit(oldAutoCommit);
            }
        } catch (SQLException e) {
            LOGGER.log(Level.WARNING, "PartyObject.awardXpToCharacter(): DB access failed", e);
            return new AwardXpToCharacterInput.AwardedXpToCharacterInput(AwardXpToCharacterInput.Status.STORAGE_ERROR);
        }
    }

    public AwardXpToCharactersInput.AwardedXpToCharactersInput awardXpToCharacters(AwardXpToCharactersInput input) {
        if (input == null
                || input.ids() == null
                || input.ids().isEmpty()
                || input.xpPerCharacter() == null
                || input.xpPerCharacter() <= 0) {
            return new AwardXpToCharactersInput.AwardedXpToCharactersInput(AwardXpToCharactersInput.Status.NOT_FOUND);
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            boolean oldAutoCommit = conn.getAutoCommit();
            conn.setAutoCommit(false);
            try {
                int updated = PlayerCharacterRepository.awardXpToCharacters(conn, input.ids(), input.xpPerCharacter());
                if (updated <= 0) {
                    conn.rollback();
                    return new AwardXpToCharactersInput.AwardedXpToCharactersInput(AwardXpToCharactersInput.Status.NOT_FOUND);
                }
                conn.commit();
                return new AwardXpToCharactersInput.AwardedXpToCharactersInput(AwardXpToCharactersInput.Status.SUCCESS);
            } catch (SQLException e) {
                conn.rollback();
                throw e;
            } finally {
                conn.setAutoCommit(oldAutoCommit);
            }
        } catch (SQLException e) {
            LOGGER.log(Level.WARNING, "PartyObject.awardXpToCharacters(): DB access failed", e);
            return new AwardXpToCharactersInput.AwardedXpToCharactersInput(AwardXpToCharactersInput.Status.STORAGE_ERROR);
        }
    }

    public PerformShortRestInput.PerformedShortRestInput performShortRest(PerformShortRestInput input) {
        try (Connection conn = DatabaseManager.getConnection()) {
            boolean oldAutoCommit = conn.getAutoCommit();
            conn.setAutoCommit(false);
            try {
                PlayerCharacterRepository.performShortRest(conn);
                conn.commit();
                return new PerformShortRestInput.PerformedShortRestInput(PerformShortRestInput.Status.SUCCESS);
            } catch (SQLException e) {
                conn.rollback();
                throw e;
            } finally {
                conn.setAutoCommit(oldAutoCommit);
            }
        } catch (SQLException e) {
            LOGGER.log(Level.WARNING, "PartyObject.performShortRest(): DB access failed", e);
            return new PerformShortRestInput.PerformedShortRestInput(PerformShortRestInput.Status.STORAGE_ERROR);
        }
    }

    public PerformLongRestInput.PerformedLongRestInput performLongRest(PerformLongRestInput input) {
        try (Connection conn = DatabaseManager.getConnection()) {
            boolean oldAutoCommit = conn.getAutoCommit();
            conn.setAutoCommit(false);
            try {
                PlayerCharacterRepository.performLongRest(conn);
                conn.commit();
                return new PerformLongRestInput.PerformedLongRestInput(PerformLongRestInput.Status.SUCCESS);
            } catch (SQLException e) {
                conn.rollback();
                throw e;
            } finally {
                conn.setAutoCommit(oldAutoCommit);
            }
        } catch (SQLException e) {
            LOGGER.log(Level.WARNING, "PartyObject.performLongRest(): DB access failed", e);
            return new PerformLongRestInput.PerformedLongRestInput(PerformLongRestInput.Status.STORAGE_ERROR);
        }
    }

    private static LoadActivePartyInput.PartyMemberInput toPartyMember(PlayerCharacter pc) {
        return new LoadActivePartyInput.PartyMemberInput(
                pc.Id,
                pc.Name,
                pc.Level);
    }

    private static LoadPartySnapshotInput.CharacterInput toCharacter(PlayerCharacter pc) {
        return new LoadPartySnapshotInput.CharacterInput(
                pc.Id,
                pc.Name,
                pc.PlayerName,
                pc.Level,
                pc.CurrentXp,
                pc.XpSinceLongRest,
                pc.XpSinceShortRest,
                pc.PassivePerception,
                pc.ArmorClass);
    }

    private static Connection requireConnection(Connection connection, String context) {
        if (connection == null) {
            throw new IllegalArgumentException(context + ": connection is required");
        }
        return connection;
    }
}
