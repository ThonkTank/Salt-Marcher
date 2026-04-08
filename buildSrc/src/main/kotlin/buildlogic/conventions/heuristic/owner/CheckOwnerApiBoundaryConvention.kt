package buildlogic.conventions.heuristic.owner

import org.gradle.api.Project
import org.gradle.api.Task
import org.gradle.api.tasks.TaskProvider

fun Project.registerCheckOwnerApiBoundaryConventionTask(
    checkOwnerApiBoundaryRoleDispatch: TaskProvider<out Task>,
    checkOwnerApiBoundaryBucketFiles: TaskProvider<out Task>,
    checkOwnerApiBoundaryOwnerFiles: TaskProvider<out Task>,
    checkOwnerApiBoundaryInputFiles: TaskProvider<out Task>,
    checkOwnerApiBoundaryTaskFiles: TaskProvider<out Task>,
    checkOwnerApiBoundaryStateFiles: TaskProvider<out Task>,
    checkOwnerApiBoundaryRepositoryFiles: TaskProvider<out Task>,
    checkOwnerApiBoundaryApiCallers: TaskProvider<out Task>
): TaskProvider<Task> = tasks.register("checkOwnerApiBoundaryConvention") {
    group = "verification"
    description = "Run touched-file owner boundary dispatch plus one validation task per canonical role."
    dependsOn(checkOwnerApiBoundaryRoleDispatch)
    dependsOn(checkOwnerApiBoundaryBucketFiles)
    dependsOn(checkOwnerApiBoundaryOwnerFiles)
    dependsOn(checkOwnerApiBoundaryInputFiles)
    dependsOn(checkOwnerApiBoundaryTaskFiles)
    dependsOn(checkOwnerApiBoundaryStateFiles)
    dependsOn(checkOwnerApiBoundaryRepositoryFiles)
    dependsOn(checkOwnerApiBoundaryApiCallers)
}
