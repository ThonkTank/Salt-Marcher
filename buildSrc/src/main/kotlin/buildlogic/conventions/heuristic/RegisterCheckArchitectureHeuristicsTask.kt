package buildlogic.conventions.heuristic

import org.gradle.api.Project
import org.gradle.api.Task
import org.gradle.api.tasks.TaskProvider

fun Project.registerCheckArchitectureHeuristicsTask(
    checkOwnerApiBoundaryConvention: TaskProvider<out Task>,
    checkDungeonGeometryConvention: TaskProvider<out Task>
): TaskProvider<Task> = tasks.register("checkArchitectureHeuristics") {
    group = "verification"
    description = "Run architecture-oriented heuristics that guide touched code toward the target structure."
    dependsOn(checkOwnerApiBoundaryConvention)
    dependsOn(checkDungeonGeometryConvention)
}
