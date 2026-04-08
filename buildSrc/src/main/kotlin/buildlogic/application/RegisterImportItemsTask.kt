package buildlogic.application

import org.gradle.api.Project
import org.gradle.api.tasks.JavaExec
import org.gradle.api.tasks.TaskProvider

fun Project.registerImportItemsTask(
    support: ApplicationTaskSupport,
    crawlerItems: TaskProvider<out JavaExec>
): TaskProvider<JavaExec> = support.registerJavaExecTask(
    "importItems",
    "Run item importer.",
    "features.items.importer.ItemImporter",
    dependsOnTask = crawlerItems
)
