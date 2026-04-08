package buildlogic.application

import org.gradle.api.Project
import org.gradle.api.tasks.JavaExec
import org.gradle.api.tasks.TaskProvider

fun Project.registerCrawlerSpellsSlugsTask(support: ApplicationTaskSupport): TaskProvider<JavaExec> =
    support.registerJavaExecTask(
        "crawlerSpellsSlugs",
        "Build spell slug list only.",
        "features.spells.importer.SpellCrawler",
        taskArgs = listOf("--build-slugs")
    )
