package buildlogic.application

import org.gradle.api.Project
import org.gradle.api.tasks.JavaExec
import org.gradle.api.tasks.TaskProvider

fun Project.registerCrawlerItemsSlugsTask(support: ApplicationTaskSupport): TaskProvider<JavaExec> =
    support.registerJavaExecTask(
        "crawlerItemsSlugs",
        "Build magic-item slug list only.",
        "features.items.importer.ItemCrawler",
        taskArgs = listOf("--build-slugs")
    )
