package buildlogic.application

import org.gradle.api.Project
import org.gradle.api.Task
import org.gradle.api.tasks.TaskProvider

fun Project.registerCrawlerItemsPipelineTask(importItems: TaskProvider<*>): TaskProvider<Task> =
    tasks.register("crawlerItemsPipeline") {
        group = "application"
        description = "Run item crawler + importer."
        dependsOn(importItems)
    }
