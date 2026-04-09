package buildlogic.application

import org.gradle.api.Project
import org.gradle.api.tasks.JavaExec
import org.gradle.api.tasks.TaskProvider

fun Project.registerBackupDatabaseTask(support: ApplicationTaskSupport): TaskProvider<JavaExec> =
    support.registerJavaExecTask(
        "backupDatabase",
        "Copy the current or requested SQLite database to a backup path.",
        "importer.DatabaseBackupTool"
    )
