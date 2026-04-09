package buildlogic.application

import org.gradle.api.Project
import org.gradle.api.tasks.JavaExec
import org.gradle.api.tasks.TaskProvider

fun Project.registerInspectDatabaseTask(support: ApplicationTaskSupport): TaskProvider<JavaExec> =
    support.registerJavaExecTask(
        "inspectDatabase",
        "Inspect the current or requested SQLite database path and optionally print row counts.",
        "importer.DatabaseInspectTool"
    )
