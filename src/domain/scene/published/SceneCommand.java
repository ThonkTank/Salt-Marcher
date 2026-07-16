package src.domain.scene.published;

public sealed interface SceneCommand permits SceneCommand.Create, SceneCommand.ImportPrepared,
        SceneCommand.Focus, SceneCommand.UpdateDetails, SceneCommand.Delete,
        SceneCommand.AssignPc, SceneCommand.UnassignPc, SceneCommand.AddNpc,
        SceneCommand.RemoveNpc, SceneCommand.SetLocation {

    record Create(String title) implements SceneCommand { }
    record ImportPrepared(long sessionId, long sceneId) implements SceneCommand { }
    record Focus(long sceneId) implements SceneCommand { }
    record UpdateDetails(long sceneId, String title, String notes) implements SceneCommand { }
    record Delete(long sceneId) implements SceneCommand { }
    record AssignPc(long sceneId, long partyMemberId) implements SceneCommand { }
    record UnassignPc(long partyMemberId) implements SceneCommand { }
    record AddNpc(long sceneId, long npcId) implements SceneCommand { }
    record RemoveNpc(long sceneId, long npcId) implements SceneCommand { }
    record SetLocation(long sceneId, long locationId) implements SceneCommand { }
}
