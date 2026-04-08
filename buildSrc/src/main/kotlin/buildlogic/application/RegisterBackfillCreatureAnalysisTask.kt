package buildlogic.application

import org.gradle.api.Project
import org.gradle.api.tasks.JavaExec
import org.gradle.api.tasks.TaskProvider

fun Project.registerBackfillCreatureAnalysisTask(support: ApplicationTaskSupport): TaskProvider<JavaExec> =
    support.registerJavaExecTask(
        "backfillCreatureAnalysis",
        "Reimport crawled monsters from stored HTML and refresh encounter-analysis caches.",
        "importer.CreatureAnalysisBackfillTool"
    )
