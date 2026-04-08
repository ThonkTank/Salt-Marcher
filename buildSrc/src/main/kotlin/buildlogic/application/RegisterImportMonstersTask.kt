package buildlogic.application

import org.gradle.api.Project
import org.gradle.api.tasks.JavaExec
import org.gradle.api.tasks.TaskProvider

fun Project.registerImportMonstersTask(
    support: ApplicationTaskSupport,
    crawlerMonsters: TaskProvider<out JavaExec>
): TaskProvider<JavaExec> = support.registerJavaExecTask(
    "importMonsters",
    "Run monster importer.",
    "importer.MonsterImporter",
    dependsOnTask = crawlerMonsters
)
