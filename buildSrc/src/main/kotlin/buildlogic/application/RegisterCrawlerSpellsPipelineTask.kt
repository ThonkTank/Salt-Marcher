package buildlogic.application

import org.gradle.api.Project
import org.gradle.api.Task
import org.gradle.api.tasks.TaskProvider

fun Project.registerCrawlerSpellsPipelineTask(importSpells: TaskProvider<*>): TaskProvider<Task> =
    tasks.register("crawlerSpellsPipeline") {
        group = "application"
        description = "Run spell crawler + importer."
        dependsOn(importSpells)
    }
