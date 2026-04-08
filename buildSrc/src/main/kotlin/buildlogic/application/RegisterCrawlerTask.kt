package buildlogic.application

import org.gradle.api.Project
import org.gradle.api.Task
import org.gradle.api.tasks.TaskProvider

fun Project.registerCrawlerTask(importMonsters: TaskProvider<*>): TaskProvider<Task> =
    tasks.register("crawler") {
        group = "application"
        description = "Run monster crawler + importer."
        dependsOn(importMonsters)
    }
