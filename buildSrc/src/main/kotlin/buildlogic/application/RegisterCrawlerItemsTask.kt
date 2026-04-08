package buildlogic.application

import org.gradle.api.Project
import org.gradle.api.tasks.JavaExec
import org.gradle.api.tasks.TaskProvider

fun Project.registerCrawlerItemsTask(support: ApplicationTaskSupport): TaskProvider<JavaExec> =
    support.registerJavaExecTask("crawlerItems", "Run item crawler only.", "features.items.importer.ItemCrawler")
