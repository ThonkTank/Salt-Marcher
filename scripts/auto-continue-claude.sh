#!/bin/bash
# Automatic Claude Code Session Continuation
#
# Starts Claude Code and automatically submits continuation prompts when idle.
# Uses expect for automation and detects completion via inactivity timeout.
#
# Usage:
#   ./auto-continue-claude.sh [OPTIONS]
#
# Options:
#   --timeout SECONDS     Wait time before considering Claude idle (default: 180)
#   --max-iterations N    Maximum auto-continues (default: unlimited, -1)
#   --no-quota-wait       Disable automatic rate-limit waiting (not recommended)
#   --debug               Enable verbose logging
#
# Features:
#   - Automatic continuation on inactivity
#   - Rate-limit detection with auto-wait until quota reset
#   - Sleep prevention (systemd-inhibit)
#   - Automatic restart after quota reset

set -e

# Default configuration
TIMEOUT=180  # 3 minutes of inactivity before auto-continue
MAX_ITERATIONS=-1
DEBUG=false
ENABLE_QUOTA_WAIT=true
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --timeout)
            TIMEOUT="$2"
            shift 2
            ;;
        --max-iterations)
            MAX_ITERATIONS="$2"
            shift 2
            ;;
        --no-quota-wait)
            ENABLE_QUOTA_WAIT=false
            shift
            ;;
        --debug)
            DEBUG=true
            shift
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Check for expect
if ! command -v expect &> /dev/null; then
    echo "Error: 'expect' is not installed."
    echo "Install with: sudo dnf install expect"
    exit 1
fi

# The continuation prompt
CONTINUATION_PROMPT="Lies dir die Arbeitsweisen, Ziele und die Roadmap in CLAUDE.md durch. Mache dich mit der bisherigen Implementation des Projekts vertraut. Stelle sicher, dass die Roadmap aktuell, die nächsten Arbeitsschritte klar formuliert, relevante Dokumentation up to date und die CLAUDE.md nicht länger als 40k zeichen ist (Verändere allerdings NIEMALS die angegebenen Ziele und Arbeitsweisen!). Fahre dann mit der Implementation des Projekts fort. Halte Roadmap und Dokumentation mit deinem Fortschritt aktuell."

# Helper function: Parse AM/PM time and calculate seconds until that time
parse_and_wait_for_quota() {
    local time_str="$1"

    echo ""
    echo "=========================================="
    echo "⏳ Rate Limit Detected!"
    echo "=========================================="
    echo "Claude meldet: Nächstes Kontingent um $time_str"
    echo ""

    # Parse time (e.g., "9:00 AM" or "3:30 PM")
    local hour=$(echo "$time_str" | grep -oP '\d+(?=:)')
    local minute=$(echo "$time_str" | grep -oP '(?<=:)\d+')
    local meridiem=$(echo "$time_str" | grep -oP '(AM|PM|am|pm)' | tr '[:lower:]' '[:upper:]')

    if [[ -z "$hour" ]] || [[ -z "$meridiem" ]]; then
        echo "⚠️  Konnte Zeit nicht parsen: $time_str"
        echo "   Warte 1 Stunde und versuche es erneut..."
        sleep 3600
        return
    fi

    # Default minute to 00 if not specified
    minute=${minute:-00}

    # Convert to 24h format
    if [[ "$meridiem" == "PM" ]] && [[ "$hour" -ne 12 ]]; then
        hour=$((hour + 12))
    elif [[ "$meridiem" == "AM" ]] && [[ "$hour" -eq 12 ]]; then
        hour=0
    fi

    # Calculate seconds until target time
    local now_seconds=$(date +%s)
    local target_seconds=$(date -d "today $hour:$minute:00" +%s)

    # If target is in the past (today), add 24 hours
    if [[ $target_seconds -le $now_seconds ]]; then
        target_seconds=$(date -d "tomorrow $hour:$minute:00" +%s)
    fi

    local wait_seconds=$((target_seconds - now_seconds))
    local wait_minutes=$((wait_seconds / 60))
    local target_time=$(date -d "@$target_seconds" "+%Y-%m-%d %H:%M:%S")

    echo "Zielzeit: $target_time"
    echo "Wartezeit: ${wait_minutes} Minuten (${wait_seconds} Sekunden)"
    echo ""
    echo "Pausiere bis zum nächsten Kontingent..."
    echo "Drücke Ctrl+C zum Abbrechen."
    echo "=========================================="
    echo ""

    # Wait with periodic updates
    local remaining=$wait_seconds
    while [[ $remaining -gt 0 ]]; do
        if [[ $remaining -gt 300 ]]; then
            # Show update every 5 minutes if wait is long
            local remaining_min=$((remaining / 60))
            echo "⏰ Noch ${remaining_min} Minuten bis zum Neustart..."
            sleep 300
            remaining=$((remaining - 300))
        elif [[ $remaining -gt 60 ]]; then
            # Show update every minute in last 5 minutes
            local remaining_min=$((remaining / 60))
            echo "⏰ Noch ${remaining_min} Minuten..."
            sleep 60
            remaining=$((remaining - 60))
        else
            # Count down last minute
            echo "⏰ Noch ${remaining} Sekunden..."
            sleep "$remaining"
            remaining=0
        fi
    done

    echo ""
    echo "✓ Kontingent sollte jetzt verfügbar sein!"
    echo "  Starte Claude Code neu..."
    echo ""
    sleep 2
}

# Export the function for use in expect
export -f parse_and_wait_for_quota

# Create expect script
EXPECT_SCRIPT=$(cat <<'EXPECT_EOF'
#!/usr/bin/expect -f

set timeout $env(TIMEOUT)
set max_iterations $env(MAX_ITERATIONS)
set continuation_prompt $env(CONTINUATION_PROMPT)
set debug $env(DEBUG)
set project_root $env(PROJECT_ROOT)
set enable_quota_wait $env(ENABLE_QUOTA_WAIT)

log_user 1

proc debug_log {msg} {
    global debug
    if {$debug == "true"} {
        puts "\n[DEBUG] $msg"
    }
}

proc send_continuation {} {
    global continuation_prompt
    debug_log "Sending continuation prompt..."
    send -- "$continuation_prompt\r"
    debug_log "Prompt sent!"
}

proc check_for_rate_limit {output} {
    global enable_quota_wait

    if {$enable_quota_wait == "false"} {
        return 0
    }

    # Common rate limit patterns
    # Examples: "9:00 AM", "3:30 PM", "12:45 PM"
    set patterns {
        {(\d{1,2}:\d{2}\s*[AP]M)}
        {available.*?at\s+(\d{1,2}:\d{2}\s*[AP]M)}
        {try.*?again.*?(\d{1,2}:\d{2}\s*[AP]M)}
        {reset.*?at\s+(\d{1,2}:\d{2}\s*[AP]M)}
        {limit.*?until\s+(\d{1,2}:\d{2}\s*[AP]M)}
    }

    set keywords {limit quota exceeded usage rate available reset}

    # Check if output contains rate limit keywords
    set has_keyword 0
    foreach kw $keywords {
        if {[string match -nocase "*$kw*" $output]} {
            set has_keyword 1
            break
        }
    }

    if {!$has_keyword} {
        return 0
    }

    # Try to extract time
    foreach pattern $patterns {
        if {[regexp -nocase $pattern $output match time_str]} {
            debug_log "Rate limit detected with time: $time_str"

            # Call bash function to parse and wait
            exec bash -c "source $env(SCRIPT_PATH); parse_and_wait_for_quota \"$time_str\""
            return 1
        }
    }

    return 0
}

# Change to project directory
cd $project_root

set iteration 0
set should_exit 0

# Main restart loop
while {!$should_exit} {
    debug_log "Starting Claude Code (attempt [expr $iteration + 1])..."
    spawn claude

    set claude_running 1
    set sent_initial 0

    # Wait for initial prompt and send first command
    expect {
        timeout {
            debug_log "Timeout waiting for initial prompt"
            set claude_running 0
        }
        -re {.*} {
            if {!$sent_initial} {
                debug_log "Claude Code started, sending initial prompt"
                send_continuation
                set sent_initial 1
            }
        }
    }

    if {!$claude_running} {
        puts "\n⚠️  Claude Code konnte nicht gestartet werden"
        break
    }

    # Main loop: wait for idle, check for rate limits, and auto-continue
    set output_buffer ""

    while {$claude_running} {
        if {$max_iterations != -1 && $iteration >= $max_iterations} {
            debug_log "Max iterations reached: $iteration"
            set should_exit 1
            break
        }

        expect {
            timeout {
                # No output for TIMEOUT seconds - Claude is idle

                # Check if buffered output contains rate limit
                if {[check_for_rate_limit $output_buffer]} {
                    # Rate limit detected, bash function handled the wait
                    # Exit this expect loop to restart claude
                    set claude_running 0
                    break
                }

                # No rate limit, continue normally
                incr iteration
                puts "\n"
                puts "=========================================="
                puts "Auto-continue triggered (iteration $iteration)"
                puts "=========================================="
                send_continuation
                set output_buffer ""
            }
            eof {
                debug_log "Claude Code exited"
                set claude_running 0

                # Check if buffered output contains rate limit before exit
                if {[check_for_rate_limit $output_buffer]} {
                    # Don't exit the main loop, restart claude
                } else {
                    # Normal exit
                    set should_exit 1
                }
                break
            }
            -re {(.*)\n} {
                # Capture output line by line
                set line $expect_out(1,string)
                append output_buffer "$line\n"

                # Keep only last 5000 chars to prevent memory issues
                if {[string length $output_buffer] > 5000} {
                    set output_buffer [string range $output_buffer end-5000 end]
                }

                # Check for rate limit in real-time
                if {[check_for_rate_limit $line]} {
                    set claude_running 0
                    break
                }

                exp_continue
            }
        }
    }

    # Small delay before potential restart
    sleep 1
}

debug_log "Script completed after $iteration iterations"
EXPECT_EOF
)

# Export variables for expect
export TIMEOUT
export MAX_ITERATIONS
export SCRIPT_PATH="${BASH_SOURCE[0]}"
export CONTINUATION_PROMPT
export DEBUG
export PROJECT_ROOT
export ENABLE_QUOTA_WAIT

echo "=========================================="
echo "Claude Code Auto-Continue"
echo "=========================================="
echo "Configuration:"
echo "  Timeout: ${TIMEOUT}s"
echo "  Max iterations: ${MAX_ITERATIONS:-unlimited}"
echo "  Quota wait: $ENABLE_QUOTA_WAIT"
echo "  Debug: $DEBUG"
echo "  Project: $PROJECT_ROOT"
echo ""
echo "Starting Claude Code with auto-continue..."
echo "Press Ctrl+C to stop at any time."
echo ""
echo "💤 Sleep prevention: Active (systemd-inhibit)"
echo "   Laptop bleibt während der Session wach"
echo "=========================================="
echo ""

# Check if systemd-inhibit is available
if command -v systemd-inhibit &> /dev/null; then
    # Run the expect script with sleep prevention
    echo "$EXPECT_SCRIPT" | systemd-inhibit --what=idle:sleep:handle-lid-switch \
                                             --who="Claude Auto-Continue" \
                                             --why="Running automated Claude Code sessions" \
                                             expect
else
    echo "⚠️  Warning: systemd-inhibit not found, sleep prevention disabled"
    echo ""
    # Run without sleep prevention
    echo "$EXPECT_SCRIPT" | expect
fi

echo ""
echo "Session ended."
