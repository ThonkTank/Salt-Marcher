package buildlogic.packaging

import org.gradle.api.Project
import org.gradle.api.Task
import org.gradle.api.tasks.TaskProvider

fun Project.registerInstallDesktopAppTask(
    installDesktopEntries: TaskProvider<*>
): TaskProvider<Task> = tasks.register("installDesktopApp") {
    group = "distribution"
    description = "Build, install, and register Salt Marcher as a desktop application."
    dependsOn(installDesktopEntries)
}
