package src.domain.dungeon.model.editor.usecase;

import java.util.List;
import java.util.Objects;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorRoomNarrationInput;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorSessionWorkflow;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues;

public final class SaveDungeonEditorRoomNarrationUseCase {
    private final DungeonEditorSessionWorkflow workflow;
    private final SaveDungeonEditorAuthoredRoomNarrationUseCase saveRoomNarrationUseCase;
    private final ApplyDungeonEditorSessionEffectUseCase effectUseCase;

    public SaveDungeonEditorRoomNarrationUseCase(
            DungeonEditorSessionWorkflow workflow,
            SaveDungeonEditorAuthoredRoomNarrationUseCase saveRoomNarrationUseCase,
            ApplyDungeonEditorSessionEffectUseCase effectUseCase
    ) {
        this.workflow = Objects.requireNonNull(workflow, "workflow");
        this.saveRoomNarrationUseCase = Objects.requireNonNull(saveRoomNarrationUseCase, "saveRoomNarrationUseCase");
        this.effectUseCase = Objects.requireNonNull(effectUseCase, "effectUseCase");
    }

    public void execute(RoomNarrationInput roomNarrationInput) {
        DungeonEditorRoomNarrationInput roomNarration = roomNarrationInput == null
                ? DungeonEditorRoomNarrationInput.empty()
                : roomNarrationInput.roomNarration();
        if (roomNarration == null || !DungeonEditorWorkspaceValues.hasId(roomNarration.roomId())) {
            return;
        }
        if (workflow.selectedMapId() != null) {
            saveRoomNarrationUseCase.execute(workflow.selectedMapId(), roomNarration);
        }
        workflow.narrationSaved(effectUseCase.currentFacts().mutationStatusText());
        effectUseCase.publishCurrent();
    }

    public record RoomNarrationInput(
            long roomId,
            String visualDescription,
            List<ExitInput> exits
    ) {
        public RoomNarrationInput {
            roomId = Math.max(0L, roomId);
            visualDescription = visualDescription == null ? "" : visualDescription;
            exits = safeExits(exits);
        }

        @Override
        public List<ExitInput> exits() {
            return List.copyOf(exits);
        }

        private DungeonEditorRoomNarrationInput roomNarration() {
            List<DungeonEditorWorkspaceValues.RoomExitNarration> roomExits =
                    new java.util.ArrayList<>(exits.size());
            for (ExitInput exit : exits) {
                roomExits.add(exit.roomExitNarration());
            }
            return new DungeonEditorRoomNarrationInput(
                    roomId,
                    visualDescription,
                    roomExits);
        }

        private static List<ExitInput> safeExits(List<ExitInput> exits) {
            if (exits == null || exits.isEmpty()) {
                return List.of();
            }
            List<ExitInput> safeExits = new java.util.ArrayList<>(exits.size());
            for (ExitInput exit : exits) {
                safeExits.add(exit == null ? ExitInput.empty() : exit);
            }
            return List.copyOf(safeExits);
        }
    }

    public static final class ExitInput {
        private final String label;
        private final int q;
        private final int r;
        private final int level;
        private final String direction;
        private final String description;

        public ExitInput(String label, int q, int r, int level, String direction, String description) {
            this.label = label == null ? "" : label;
            this.q = q;
            this.r = r;
            this.level = level;
            this.direction = direction == null ? "" : direction;
            this.description = description == null ? "" : description;
        }

        private static ExitInput empty() {
            return new ExitInput("", 0, 0, 0, "", "");
        }

        private DungeonEditorWorkspaceValues.RoomExitNarration roomExitNarration() {
            return new DungeonEditorWorkspaceValues.RoomExitNarration(
                    label,
                    new DungeonEditorWorkspaceValues.Cell(q, r, level),
                    direction,
                    description);
        }
    }
}
