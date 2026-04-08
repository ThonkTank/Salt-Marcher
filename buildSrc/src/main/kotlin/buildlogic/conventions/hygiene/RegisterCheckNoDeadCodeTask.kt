package buildlogic.conventions.hygiene

import org.gradle.api.Project
import org.gradle.api.Task
import org.gradle.api.tasks.TaskProvider

fun Project.registerCheckNoDeadCodeTask(
    checkNoDeadDeclarations: TaskProvider<out Task>,
    checkNoDeadLocalCode: TaskProvider<out Task>
): TaskProvider<Task> = tasks.register("checkNoDeadCode") {
    group = "verification"
    description = "Fail when touched Java sources introduce dead declarations or dead local code."
    dependsOn(checkNoDeadDeclarations)
    dependsOn(checkNoDeadLocalCode)
}
