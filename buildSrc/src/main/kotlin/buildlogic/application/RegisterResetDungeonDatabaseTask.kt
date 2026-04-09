package buildlogic.application

import org.gradle.api.Project
import org.gradle.api.tasks.JavaExec
import org.gradle.api.tasks.TaskProvider

fun Project.registerResetDungeonDatabaseTask(support: ApplicationTaskSupport): TaskProvider<JavaExec> =
    support.registerJavaExecTask(
        "resetDungeonDatabase",
        "Reset the dungeon tables in the current app database after creating a backup by default.",
        "importer.DatabaseResetTool",
        taskArgs = listOf("--target=dungeon")
    )
