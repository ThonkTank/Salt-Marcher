package buildlogic.conventions.hygiene

import org.gradle.api.GradleException
import org.gradle.api.Project
import org.gradle.api.Task
import org.gradle.api.tasks.TaskProvider

fun Project.registerCheckNoDeadDeclarationsTask(): TaskProvider<Task> = tasks.register("checkNoDeadDeclarations") {
    group = "verification"
    description = "Fail when touched Java sources introduce unreachable types, fields, constructors, or methods."

    doLast {
        val offenders = project.deadDeclarationReasons()
        if (offenders.isNotEmpty()) {
            val details = offenders.joinToString(separator = "\n") { offender -> " - $offender" }
            throw GradleException(
                "Dead Java declarations detected in touched files.\n" +
                    "Remove the dead declaration or mark intentional retention with @SuppressWarnings(\"unused\").\n" +
                    "Offending declarations:\n$details"
            )
        }
    }
}
