package buildlogic.conventions.hygiene

import org.gradle.api.GradleException
import org.gradle.api.Project
import org.gradle.api.Task
import org.gradle.api.tasks.TaskProvider

fun Project.registerCheckNoDeadLocalCodeTask(): TaskProvider<Task> = tasks.register("checkNoDeadLocalCode") {
    group = "verification"
    description = "Fail when touched Java sources introduce dead local variables, dead assignments, or constant-condition branches."
    val currentProject = this@registerCheckNoDeadLocalCodeTask

    doLast {
        val offenders = currentProject.deadLocalCodeReasons()
        if (offenders.isNotEmpty()) {
            val details = offenders.joinToString(separator = "\n") { offender -> " - $offender" }
            throw GradleException(
                "Dead local Java code detected in touched files.\n" +
                    "Remove the dead local flow or make the branch genuinely data-dependent.\n" +
                    "Offending code:\n$details"
            )
        }
    }
}
