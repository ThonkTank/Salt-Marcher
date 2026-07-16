package features.scene.api;

/** Complete command vocabulary of the running-scene workspace. */
public sealed interface SceneCommand {

    record Initialize() implements SceneCommand { }

    record Refresh() implements SceneCommand { }

    record Create(String title) implements SceneCommand {
        public Create {
            title = title == null ? "" : title.trim();
        }
    }

    record ImportPrepared(long sessionId, long preparedSceneId) implements SceneCommand { }

    record Focus(long sceneId) implements SceneCommand { }

    record UpdateDetails(long sceneId, String title, String notes) implements SceneCommand {
        public UpdateDetails {
            title = title == null ? "" : title.trim();
            notes = notes == null ? "" : notes.trim();
        }
    }

    record Delete(long sceneId) implements SceneCommand { }

    record AssignPc(long sceneId, long partyMemberId) implements SceneCommand { }

    record UnassignPc(long partyMemberId) implements SceneCommand { }

    record AssignNpc(long sceneId, long npcId) implements SceneCommand { }

    record UnassignNpc(long npcId) implements SceneCommand { }

    record SetLocation(long sceneId, long locationId) implements SceneCommand { }
}
