package buildlogic.packaging

import org.gradle.api.Project
import org.gradle.api.tasks.Sync
import org.gradle.api.tasks.TaskProvider

fun Project.registerStageJpackageInputTask(
    support: PackagingSupport
): TaskProvider<Sync> = support.registerStageJpackageInputTask()
