package buildlogic.application

import org.gradle.api.Project
import org.gradle.api.tasks.JavaExec
import org.gradle.api.tasks.TaskProvider

fun Project.registerImportSpellsTask(
    support: ApplicationTaskSupport,
    crawlerSpells: TaskProvider<out JavaExec>
): TaskProvider<JavaExec> = support.registerJavaExecTask(
    "importSpells",
    "Run spell importer.",
    "features.spells.importer.SpellImporter",
    dependsOnTask = crawlerSpells
)
