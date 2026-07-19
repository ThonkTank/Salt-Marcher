package features.sessionplanner.adapter.sqlite.repository;

import java.util.List;
import java.util.Objects;
import java.util.Optional;
import platform.persistence.SqliteDatabase;
import features.sessionplanner.adapter.sqlite.gateway.local.SqliteSessionPlannerLocalGateway;
import features.sessionplanner.adapter.sqlite.mapper.SessionPlanMapper;
import features.sessionplanner.domain.session.SessionPlan;
import features.sessionplanner.domain.session.SessionPlanSummary;
import features.sessionplanner.domain.session.repository.SessionPlanRepository;
import features.sessionplanner.domain.session.repository.SessionPlanSaveResult;
import features.sessionplanner.domain.session.SessionRevision;
import features.sessionplanner.domain.session.SessionEncounter;
import features.sessionplanner.domain.session.SessionGeneratedRewardReference;
import features.sessionplanner.domain.session.SessionManualLootNote;
import features.sessionplanner.domain.session.SessionRestPlacement;
import features.sessionplanner.application.CommitPreparedSessionCommand;
import features.sessionplanner.application.CommitPreparedSessionResult;
import features.sessionplanner.application.SessionPreparedSessionStore;
import features.sessionplanner.application.PreparedSessionPersistenceFingerprint;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

public final class SqliteSessionPlanRepository implements SessionPlanRepository, SessionPreparedSessionStore {

    private final SqliteSessionPlannerLocalGateway gateway;

    public SqliteSessionPlanRepository() {
        this(new SqliteSessionPlannerLocalGateway());
    }

    public SqliteSessionPlanRepository(SqliteDatabase database) {
        this(new SqliteSessionPlannerLocalGateway(database));
    }

    SqliteSessionPlanRepository(SqliteSessionPlannerLocalGateway gateway) {
        this.gateway = Objects.requireNonNull(gateway, "gateway");
    }

    @Override
    public Optional<SessionPlan> loadCurrent() {
        return gateway.loadCurrent().map(SessionPlanMapper::toDomain);
    }

    @Override
    public Optional<SessionPlan> loadById(long sessionId) {
        return gateway.loadSession(sessionId).map(SessionPlanMapper::toDomain);
    }

    @Override
    public List<SessionPlanSummary> listSessions() {
        return gateway.listSessions().stream()
                .map(record -> new SessionPlanSummary(record.sessionId(), record.displayName()))
                .toList();
    }

    @Override
    public SessionPlanSaveResult insert(SessionPlan sessionPlan) {
        Objects.requireNonNull(sessionPlan, "sessionPlan");
        return toResult(sessionPlan, gateway.insert(SessionPlanMapper.toSnapshot(sessionPlan)));
    }

    @Override
    public SessionPlanSaveResult save(SessionPlan sessionPlan) {
        Objects.requireNonNull(sessionPlan, "sessionPlan");
        return toResult(sessionPlan, gateway.save(SessionPlanMapper.toSnapshot(sessionPlan)));
    }

    @Override
    public void delete(long sessionId) {
        gateway.deleteSession(sessionId);
    }

    @Override
    public long nextSessionId() {
        return gateway.nextSessionId();
    }

    @Override
    public void setCurrentSessionId(long sessionId) {
        gateway.setCurrentSessionId(sessionId);
    }

    @Override
    public CommitPreparedSessionResult commitPreparedSession(CommitPreparedSessionCommand command) {
        if (command == null) {
            return new CommitPreparedSessionResult.Invalid(List.of("Vorbereitete Session fehlt."));
        }
        List<String> errors = validatePreparedCommand(command);
        if (!errors.isEmpty()) {
            return new CommitPreparedSessionResult.Invalid(errors);
        }
        Optional<SessionPlan> existing;
        try {
            existing = loadById(command.sessionId());
        } catch (IllegalStateException exception) {
            return new CommitPreparedSessionResult.StorageFailure(
                    "Session konnte nicht gespeichert werden.");
        }
        if (existing.isEmpty()) {
            return new CommitPreparedSessionResult.NotFound(command.sessionId());
        }
        SessionPlan stable = existing.orElseThrow();
        if (!stable.revision().equals(command.expectedRevision())) {
            return new CommitPreparedSessionResult.Stale(command.expectedRevision(), stable.revision());
        }
        SessionPlan candidate;
        try {
            candidate = toPreparedSession(stable, command);
        } catch (IllegalArgumentException exception) {
            return new CommitPreparedSessionResult.Invalid(List.of("Vorbereitete Session ist ungültig."));
        }
        try {
            SessionPlanSaveResult saved = save(candidate);
            return switch (saved.status()) {
                case SUCCESS -> new CommitPreparedSessionResult.Success(
                        command.expectedRevision(),
                        saved.committedSession().orElseThrow().revision(),
                        saved.committedSession().orElseThrow());
                case STALE -> new CommitPreparedSessionResult.Stale(
                        command.expectedRevision(), saved.currentRevision().orElseThrow());
                case NOT_FOUND -> new CommitPreparedSessionResult.NotFound(command.sessionId());
                case ALREADY_EXISTS -> new CommitPreparedSessionResult.StorageFailure(
                        "Session konnte nicht gespeichert werden.");
            };
        } catch (IllegalStateException exception) {
            return new CommitPreparedSessionResult.StorageFailure(
                    "Session konnte nicht gespeichert werden.");
        }
    }

    private static SessionPlan toPreparedSession(
            SessionPlan stable,
            CommitPreparedSessionCommand command
    ) {
        List<SessionEncounter> scenes = command.scenes().stream()
                .map(scene -> new SessionEncounter(
                        scene.sceneId(),
                        scene.encounterPlanId(),
                        scene.allocation(),
                        scene.title(),
                        scene.notes(),
                        scene.locationId()))
                .toList();
        List<SessionRestPlacement> rests = command.rests().stream()
                .map(rest -> SessionRestPlacement.fromPersistence(
                        rest.leftSceneId(), rest.rightSceneId(), rest.kind()))
                .toList();
        List<SessionManualLootNote> notes = command.manualLootNotes().stream()
                .map(note -> new SessionManualLootNote(
                        note.noteId(), note.sceneId(), note.authoredText()))
                .toList();
        List<SessionGeneratedRewardReference> rewards = command.generatedRewardReferences().stream()
                .map(reward -> new SessionGeneratedRewardReference(
                        reward.sceneId(), reward.generationRunIdentity(),
                        reward.treasureId(), reward.lastKnownLabel()))
                .toList();
        long nextSceneId = scenes.stream().mapToLong(SessionEncounter::encounterId).max().orElse(0L) + 1L;
        long nextNoteId = notes.stream().mapToLong(SessionManualLootNote::noteId).max().orElse(0L) + 1L;
        return new SessionPlan(
                stable.sessionId(),
                stable.revision(),
                stable.displayName(),
                stable.participantRefs(),
                stable.encounterDays(),
                scenes,
                rests,
                notes,
                rewards,
                command.selectedSceneId(),
                "Generierte Session vorbereitet.",
                Math.max(1L, nextSceneId),
                Math.max(1L, nextNoteId));
    }

    private static List<String> validatePreparedCommand(CommitPreparedSessionCommand command) {
        List<String> errors = new ArrayList<>();
        String expectedFingerprint = PreparedSessionPersistenceFingerprint.compute(
                command.sessionId(), command.expectedRevision(), command.preparationIdentity(),
                command.scenes().stream().map(scene -> new PreparedSessionPersistenceFingerprint.Scene(
                        scene.sceneId(), scene.encounterNumber(),
                        scene.allocation().budgetPercentage().stripTrailingZeros().toPlainString(),
                        scene.title(), scene.notes(), scene.locationId())).toList(),
                command.rests().stream().map(rest -> new PreparedSessionPersistenceFingerprint.Rest(
                        rest.leftSceneId(), rest.rightSceneId(), rest.kind())).toList(),
                command.selectedSceneId(),
                command.manualLootNotes().stream().map(note -> new PreparedSessionPersistenceFingerprint.ManualLootNote(
                        note.noteId(), note.sceneId(), note.authoredText())).toList(),
                command.generatedRewardReferences().stream()
                        .map(reward -> new PreparedSessionPersistenceFingerprint.GeneratedRewardReference(
                                reward.sceneId(), reward.generationRunIdentity(), reward.treasureId(),
                                reward.lastKnownLabel())).toList(),
                command.committedGenerationRunIdentity(),
                command.encounterPlanMappings().stream()
                        .map(mapping -> new PreparedSessionPersistenceFingerprint.EncounterPlanMapping(
                                mapping.encounterNumber(), mapping.planId())).toList());
        if (!expectedFingerprint.equals(command.preparedContentFingerprint())) {
            errors.add("Vorbereitungsfingerabdruck stimmt nicht mit dem Inhalt überein.");
        }
        if (command.scenes().isEmpty()) {
            errors.add("Vorbereitete Szenen fehlen.");
            return List.copyOf(errors);
        }
        Set<Long> sceneIds = new HashSet<>();
        Map<Integer, Long> mappedPlans = new HashMap<>();
        Set<Long> mappedPlanIds = new HashSet<>();
        int previousEncounterNumber = 0;
        BigDecimal allocation = BigDecimal.ZERO;
        for (CommitPreparedSessionCommand.EncounterPlanMapping mapping : command.encounterPlanMappings()) {
            if (mapping.encounterNumber() != previousEncounterNumber + 1
                    || mappedPlans.put(mapping.encounterNumber(), mapping.planId()) != null
                    || !mappedPlanIds.add(mapping.planId())) {
                errors.add("Encounter-Zuordnung ist unvollständig oder ungeordnet.");
                break;
            }
            previousEncounterNumber = mapping.encounterNumber();
        }
        Set<Integer> sceneEncounterNumbers = new HashSet<>();
        for (CommitPreparedSessionCommand.Scene scene : command.scenes()) {
            if (!sceneIds.add(scene.sceneId())) {
                errors.add("Szenen-IDs sind nicht eindeutig.");
            }
            allocation = allocation.add(scene.allocation().budgetPercentage());
            if (scene.encounterNumber() == 0) {
                if (scene.encounterPlanId() != 0L) {
                    errors.add("Encounter-freie Szene enthält einen Encounter-Plan.");
                }
            } else if (!sceneEncounterNumbers.add(scene.encounterNumber())
                    || !Objects.equals(mappedPlans.get(scene.encounterNumber()), scene.encounterPlanId())) {
                errors.add("Szenen-Encounter-Zuordnung ist ungültig.");
            }
        }
        if (!sceneEncounterNumbers.equals(mappedPlans.keySet())) {
            errors.add("Encounter-Zuordnung ist nicht vollständig.");
        }
        if (allocation.compareTo(new BigDecimal("100")) != 0) {
            errors.add("Szenen-Budget muss genau 100 Prozent ergeben.");
        }
        if (!sceneIds.contains(command.selectedSceneId())) {
            errors.add("Ausgewählte Szene fehlt.");
        }
        Set<Long> noteIds = new HashSet<>();
        for (CommitPreparedSessionCommand.ManualLootNote note : command.manualLootNotes()) {
            if (!sceneIds.contains(note.sceneId()) || !noteIds.add(note.noteId())) {
                errors.add("Manuelle Beutenotizen sind ungültig.");
                break;
            }
        }
        Set<String> rewardKeys = new HashSet<>();
        for (CommitPreparedSessionCommand.GeneratedRewardReference reward : command.generatedRewardReferences()) {
            if (!sceneIds.contains(reward.sceneId())
                    || !reward.generationRunIdentity().equals(command.committedGenerationRunIdentity())
                    || !rewardKeys.add(reward.generationRunIdentity() + ":" + reward.treasureId())) {
                errors.add("Generierte Belohnungsreferenzen sind ungültig.");
                break;
            }
        }
        Set<String> restGaps = new HashSet<>();
        for (CommitPreparedSessionCommand.Rest rest : command.rests()) {
            if (!adjacent(command.scenes(), rest.leftSceneId(), rest.rightSceneId())
                    || !restGaps.add(rest.leftSceneId() + ":" + rest.rightSceneId())) {
                errors.add("Rastpositionen sind ungültig.");
                break;
            }
        }
        return List.copyOf(errors);
    }

    private static boolean adjacent(
            List<CommitPreparedSessionCommand.Scene> scenes,
            long left,
            long right
    ) {
        for (int index = 0; index < scenes.size() - 1; index++) {
            if (scenes.get(index).sceneId() == left && scenes.get(index + 1).sceneId() == right) {
                return true;
            }
        }
        return false;
    }

    private static SessionPlanSaveResult toResult(
            SessionPlan expected,
            SqliteSessionPlannerLocalGateway.SaveOutcome outcome
    ) {
        Optional<SessionRevision> current = outcome.currentRevision().map(SessionRevision::new);
        Optional<SessionPlan> committed = outcome.snapshot().map(SessionPlanMapper::toDomain);
        SessionPlanSaveResult.Status status = switch (outcome.status()) {
            case SUCCESS -> SessionPlanSaveResult.Status.SUCCESS;
            case STALE -> SessionPlanSaveResult.Status.STALE;
            case NOT_FOUND -> SessionPlanSaveResult.Status.NOT_FOUND;
            case ALREADY_EXISTS -> SessionPlanSaveResult.Status.ALREADY_EXISTS;
        };
        return new SessionPlanSaveResult(status, expected.revision(), current, committed);
    }
}
