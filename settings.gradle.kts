pluginManagement {
    includeBuild("tools/gradle/build-logic")
}

rootProject.name = "SaltMarcher"

includeBuild("tools/gradle/build-harness")
includeBuild("tools/quality/rules/quality-rules")
