package buildlogic.conventions.heuristic.owner

import org.gradle.api.Project
import org.gradle.api.Task
import org.gradle.api.tasks.TaskProvider

fun Project.registerCheckOwnerApiBoundaryRoleDispatchTask(
    support: OwnerConventionSupport
): TaskProvider<Task> = support.registerCheck(
    taskName = "checkOwnerApiBoundaryRoleDispatch",
    taskDescription = "Fail when touched owner-boundary files cannot be dispatched cleanly into the canonical owner/layer grammar.",
    failureHeader = "Owner role dispatch drift detected.",
    failureSummary = "Touched files must keep package declarations aligned with the filesystem grammar and must map to a valid owner, layer, or *Bucket role."
) { sourceFile, _ ->
    support.roleDispatchReasons(sourceFile)
}
