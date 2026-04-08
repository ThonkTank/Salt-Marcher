package buildlogic.application

import org.gradle.api.Project
import org.gradle.api.tasks.JavaExec
import org.gradle.api.tasks.TaskProvider

fun Project.registerCrawlerSpellsTask(support: ApplicationTaskSupport): TaskProvider<JavaExec> =
    support.registerJavaExecTask("crawlerSpells", "Run spell crawler only.", "features.spells.importer.SpellCrawler")
