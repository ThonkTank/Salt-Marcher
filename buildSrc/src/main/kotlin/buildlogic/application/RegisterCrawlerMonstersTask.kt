package buildlogic.application

import org.gradle.api.Project
import org.gradle.api.tasks.JavaExec
import org.gradle.api.tasks.TaskProvider

fun Project.registerCrawlerMonstersTask(support: ApplicationTaskSupport): TaskProvider<JavaExec> =
    support.registerJavaExecTask("crawlerMonsters", "Run monster crawler only.", "importer.MonsterCrawler")
