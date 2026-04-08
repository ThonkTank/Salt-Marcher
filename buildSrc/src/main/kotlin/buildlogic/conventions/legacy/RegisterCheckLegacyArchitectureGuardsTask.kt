package buildlogic.conventions.legacy

import org.gradle.api.Project
import org.gradle.api.Task
import org.gradle.api.tasks.TaskProvider

fun Project.registerCheckLegacyArchitectureGuardsTask(
    checkNoStdStreamsInFeatureServicesAndRepositories: TaskProvider<out Task>,
    checkRepositorySqlExceptionConvention: TaskProvider<out Task>,
    checkFeatureApiBoundaryConvention: TaskProvider<out Task>,
    checkDungeonEditorArchitectureConvention: TaskProvider<out Task>
): TaskProvider<Task> = tasks.register("checkLegacyArchitectureGuards") {
    group = "verification"
    description = "Run legacy migration guards that are kept for manual use but are no longer part of the default build gate."
    dependsOn(checkNoStdStreamsInFeatureServicesAndRepositories)
    dependsOn(checkRepositorySqlExceptionConvention)
    dependsOn(checkFeatureApiBoundaryConvention)
    dependsOn(checkDungeonEditorArchitectureConvention)
}
