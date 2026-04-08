package buildlogic.conventions.heuristic.owner

import org.gradle.api.Project
import org.gradle.api.Task
import org.gradle.api.tasks.TaskProvider

fun Project.registerCheckOwnerApiBoundaryConventionTask(
    checkOwnerApiBoundarySourcePlacement: TaskProvider<out Task>,
    checkOwnerApiBoundaryOwnerFiles: TaskProvider<out Task>,
    checkOwnerApiBoundaryInputFiles: TaskProvider<out Task>,
    checkOwnerApiBoundaryTaskFiles: TaskProvider<out Task>,
    checkOwnerApiBoundaryStateFiles: TaskProvider<out Task>,
    checkOwnerApiBoundaryRepositoryFiles: TaskProvider<out Task>
): TaskProvider<Task> = tasks.register("checkOwnerApiBoundaryConvention") {
    group = "verification"
    description = "Run touched-file owner boundary heuristics for the canonical *Object/input/task/repository/state grammar."
    dependsOn(checkOwnerApiBoundarySourcePlacement)
    dependsOn(checkOwnerApiBoundaryOwnerFiles)
    dependsOn(checkOwnerApiBoundaryInputFiles)
    dependsOn(checkOwnerApiBoundaryTaskFiles)
    dependsOn(checkOwnerApiBoundaryStateFiles)
    dependsOn(checkOwnerApiBoundaryRepositoryFiles)
}
