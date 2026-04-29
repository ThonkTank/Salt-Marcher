tasks.register("checkDocumentationEnforcement") {
    group = "verification"
    description = "Run all Markdown-backed architecture and enforcement documentation checks through one focused root entrypoint."
    dependsOn(gradle.includedBuild("build-harness").task(":documentationEnforcementCheck"))
}
