package buildlogic.application

import org.gradle.api.Project
import org.gradle.api.tasks.JavaExec
import org.gradle.api.tasks.TaskProvider

fun Project.registerSqliteQueryTask(support: ApplicationTaskSupport): TaskProvider<JavaExec> =
    support.registerJavaExecTask(
        "sqliteQuery",
        "Run ad-hoc SQLite queries without requiring a system sqlite3 binary. Usage: ./gradlew sqliteQuery --args='data/game.db .tables \"select * from dungeon_maps\"'",
        "importer.SqliteQueryTool"
    )
