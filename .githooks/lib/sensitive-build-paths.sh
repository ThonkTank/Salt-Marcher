#!/usr/bin/env bash

sm_is_sensitive_build_path() {
    local path="${1#./}"

    case "$path" in
        build.gradle.kts|settings.gradle.kts|CODEOWNERS)
            return 0
            ;;
    esac

    return 1
}
