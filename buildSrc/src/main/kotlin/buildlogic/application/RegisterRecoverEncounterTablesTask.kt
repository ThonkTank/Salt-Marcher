package buildlogic.application

import org.gradle.api.Project
import org.gradle.api.tasks.JavaExec
import org.gradle.api.tasks.TaskProvider

fun Project.registerRecoverEncounterTablesTask(support: ApplicationTaskSupport): TaskProvider<JavaExec> =
    support.registerJavaExecTask(
        "recoverEncounterTables",
        "Restore encounter tables from backup JSON. Pass --args='--latest' or --args='data/backups/encounter-tables-...json'.",
        "importer.EncounterTableRecoveryTool"
    )
