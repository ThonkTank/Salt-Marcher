pluginManagement {
    includeBuild("tools/gradle/build-logic")
}

apply(from = "tools/gradle/build-isolation.settings.gradle.kts")

rootProject.name = "SaltMarcher"

includeBuild("tools/gradle/build-harness")
includeBuild("tools/quality/rules/quality-rules")
includeBuild("tools/quality/incubator/quality-rules-errorprone")
