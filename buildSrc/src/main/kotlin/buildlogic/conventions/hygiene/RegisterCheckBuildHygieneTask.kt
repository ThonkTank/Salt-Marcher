package buildlogic.conventions.hygiene

import org.gradle.api.Project
import org.gradle.api.Task
import org.gradle.api.tasks.TaskProvider

fun Project.registerCheckBuildHygieneTask(
    checkNoCompiledArtifactsInSource: TaskProvider<out Task>
): TaskProvider<Task> = tasks.register("checkBuildHygiene") {
    group = "verification"
    description = "Run hard mechanical build hygiene checks."
    dependsOn(checkNoCompiledArtifactsInSource)
}
