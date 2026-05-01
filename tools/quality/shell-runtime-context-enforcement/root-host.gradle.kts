import org.gradle.api.plugins.quality.Pmd
import org.gradle.kotlin.dsl.named
import org.gradle.kotlin.dsl.registering

val shellRuntimeContextRulesetFile = layout.projectDirectory.file(
    "tools/quality/shell-runtime-context-enforcement/pmd/ruleset.xml"
)

val checkShellRuntimeContextEnforcement by tasks.registering(Pmd::class) {
    group = "verification"
    description = "Run the dedicated ShellRuntimeContext PMD architecture rule bundle."
    dependsOn(gradle.includedBuild("quality-rules").task(":jar"))

    ignoreFailures = false
    ruleSets = listOf()
    ruleSetFiles = files(shellRuntimeContextRulesetFile)
    source = fileTree("shell/api") {
        include("ShellRuntimeContext.java")
    }
    classpath = files()

    reports {
        html.required.set(true)
        xml.required.set(true)
    }
}

tasks.matching { it.name == "checkArchitecture" }.configureEach {
    dependsOn(checkShellRuntimeContextEnforcement)
}

tasks.named("check") {
    dependsOn(checkShellRuntimeContextEnforcement)
}
