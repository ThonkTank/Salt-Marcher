package buildlogic.verification

import org.gradle.api.Project
import org.gradle.api.Task
import org.gradle.api.tasks.TaskProvider

fun Project.registerCheckConventionsTask(
    checkBuildHygiene: TaskProvider<out Task>,
    checkLocalBuildPolicies: TaskProvider<out Task>,
    checkArchitectureHeuristics: TaskProvider<out Task>
): TaskProvider<Task> = tasks.register("checkConventions") {
    group = "verification"
    description = "Run the default convention gate: hygiene, local policies, and architecture heuristics."
    dependsOn(checkBuildHygiene)
    dependsOn(checkLocalBuildPolicies)
    dependsOn(checkArchitectureHeuristics)
}
