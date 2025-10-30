#!/usr/bin/env python3
"""
Claude Code Auto-Continue Script

Automatically continues Claude Code sessions with rotating prompts,
permission auto-approval, and rate-limit handling.
"""

import argparse
import json
import os
import re
import signal
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Optional

try:
    import pexpect
except ImportError:
    print("Error: pexpect is not installed.")
    print("Install with: pip install pexpect")
    sys.exit(1)


class FilteredLogFile:
    """
    Intelligent log filter that captures Claude's responses while removing ANSI noise.

    Filters out:
    - ANSI escape codes
    - UI rendering artifacts (progress bars, spinners)
    - Repeated screen redraws
    - Control sequences

    Preserves:
    - Claude's text responses
    - Tool usage notifications
    - Error messages
    - Permission dialogs
    """
    def __init__(self, logfile):
        self.logfile = logfile
        self.last_line = ""
        self.line_repeat_count = 0

        # Track tool calls to avoid logging redraws
        self.seen_tool_calls = set()  # Track tool call signatures
        self.current_tool_output = []  # Buffer for current tool output

        # Patterns that indicate meaningful content
        self.meaningful_patterns = [
            r'^[●○■□▪▫►▸•]',  # Bullet points, markers
            r'^\s*(I\'ll|I\'m|Let me|I will|I can|I need)',  # Claude's responses
            r'^\s*(Sure|Okay|Yes|No|Right|Got it)',  # Acknowledgments
            r'Tool:',  # Tool usage
            r'Error:',  # Errors
            r'Do you want',  # Permission dialogs
            r'Choose an option',  # Prompts
            r'⚠️|✓|❯',  # Important symbols
            r'^\s*\d+\.',  # Numbered lists
            r'^\s*-',  # Bullet lists
        ]

    def write(self, data):
        """Filter and write data to logfile"""
        if not data:
            return

        # Strip ANSI codes
        clean = re.sub(r'\x1b\[[0-9;]*[A-Za-z]', '', data)
        clean = re.sub(r'\x1b\].*?\x07', '', clean)
        clean = re.sub(r'\x1b\[.*?[\x40-\x7E]', '', clean)
        clean = clean.replace('\x1b[?25l', '').replace('\x1b[?25h', '')
        clean = clean.replace('\x1b[?2004h', '').replace('\x1b[?2004l', '')
        clean = clean.replace('\x1b[?1004h', '').replace('\x1b[?2026h', '').replace('\x1b[?2026l', '')

        # Skip if only whitespace
        if not clean.strip():
            return

        # Skip very short lines (likely UI artifacts)
        if len(clean.strip()) < 3:
            return

        # Skip UI noise patterns
        ui_noise_patterns = [
            r'^[\s─]+$',  # Only lines/whitespace
            r'Try ["\'].*["\']',  # "Try 'how do I log an error?'"
            r'\? for shortcuts',  # UI hints
            r'Thinking on \(tab to toggle\)',  # UI state
            r'ctrl\+[a-z]',  # Keyboard shortcuts
            r'^[✶✻✽✹✸✷✺]\s+Pondering',  # Spinner + "Pondering"
            r'^[✶✻✽✹✸✷✺]\s+Sussing',  # Spinner + "Sussing"
            r'^[·•]\s+Pondering',  # Bullet + "Pondering"
            r'esc to interrupt',  # UI hints
            r'^\s*\(esc to interrupt',  # UI hints with parens
            r'⎿.*Running',  # Tool output "Running..." (intermediate state)
        ]

        for pattern in ui_noise_patterns:
            if re.search(pattern, clean, re.IGNORECASE):
                return

        # Skip progress indicators, spinners
        if any(char in clean for char in ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏', '✶', '✻', '✽', '✹']):
            # Unless it's meaningful content WITH a spinner (like "● Read(...)")
            if not any(re.search(pattern, clean, re.IGNORECASE) for pattern in self.meaningful_patterns):
                return

        # Track tool calls to avoid redraws
        tool_call_match = re.match(r'^[●○]\s+(Read|Bash|Write|Edit|Grep|Glob|Task)\((.*?)\)', clean)
        if tool_call_match:
            tool_signature = f"{tool_call_match.group(1)}:{tool_call_match.group(2)[:50]}"
            if tool_signature in self.seen_tool_calls:
                # Already logged this tool call, skip redraw
                return
            self.seen_tool_calls.add(tool_signature)

        # Create content hash to detect duplicate blocks
        content_hash = hash(clean.strip())
        if content_hash == hash(self.last_line.strip()):
            return

        self.last_line = clean

        # Check if line contains meaningful content
        is_meaningful = any(re.search(pattern, clean, re.IGNORECASE)
                           for pattern in self.meaningful_patterns)

        # Skip if not meaningful
        if not is_meaningful:
            return

        # Write with timestamp
        timestamp = datetime.now().strftime('%H:%M:%S')

        # Format multi-line content nicely
        lines = clean.split('\n')
        for i, line in enumerate(lines):
            if line.strip():
                if i == 0:
                    self.logfile.write(f"[{timestamp}] {line}\n")
                else:
                    self.logfile.write(f"          {line}\n")

        self.logfile.flush()

    def flush(self):
        """Flush the underlying logfile"""
        if hasattr(self.logfile, 'flush'):
            self.logfile.flush()


class AutoContinue:
    def __init__(self, config_path: str, project_root: str):
        self.project_root = Path(project_root)
        self.state_file = self.project_root / ".auto-continue-state"
        self.lock_file = Path("/tmp/auto-continue-claude.lock")

        # Load config
        with open(config_path) as f:
            self.config = json.load(f)

        self.timeout = self.config.get("timeout", 180)
        self.max_iterations = self.config.get("max_iterations", -1)
        self.enable_quota_wait = self.config.get("enable_quota_wait", True)
        self.prompts = self.config["prompts"]
        self.permission_patterns = self.config["permission_patterns"]
        self.rate_limit_pattern = self.config["rate_limit_pattern"]

        self.child: Optional[pexpect.spawn] = None
        self.iteration = 0
        self.running = True

        # Setup filtered logging
        self.log_file_path = self.project_root / "auto-continue-filtered.log"
        self.log_file = open(self.log_file_path, 'a', buffering=1)
        self.filtered_log = FilteredLogFile(self.log_file)

        # Setup signal handlers
        signal.signal(signal.SIGINT, self._signal_handler)
        signal.signal(signal.SIGTERM, self._signal_handler)

    def _signal_handler(self, signum, frame):
        """Handle Ctrl+C and termination signals"""
        print("\n\n⚠️  Received signal, shutting down gracefully...")
        self.running = False
        self.cleanup()
        sys.exit(0)

    def acquire_lock(self) -> bool:
        """Prevent multiple instances"""
        if self.lock_file.exists():
            try:
                pid = int(self.lock_file.read_text().strip())
                # Check if process is running
                os.kill(pid, 0)
                print(f"⚠️  ERROR: Another instance is running (PID: {pid})")
                print(f"   If incorrect, remove: {self.lock_file}")
                return False
            except (OSError, ValueError):
                print("Removing stale lock file...")
                self.lock_file.unlink()

        self.lock_file.write_text(str(os.getpid()))
        return True

    def release_lock(self):
        """Release lock file"""
        if self.lock_file.exists():
            self.lock_file.unlink()

    def get_next_phase(self) -> str:
        """Get next prompt phase in cycle A → B → C → A"""
        if self.state_file.exists():
            current = self.state_file.read_text().strip()
        else:
            current = "C"  # Start with A next

        cycle = {"A": "B", "B": "C", "C": "A"}
        return cycle.get(current, "A")

    def save_phase(self, phase: str):
        """Save current phase to state file"""
        self.state_file.write_text(phase)

    def get_prompt_text(self, phase: str) -> str:
        """Get prompt text for a phase"""
        prompt_config = self.prompts[phase]
        prompt_text = prompt_config["text"]
        model_pref = prompt_config["model_preference"]

        print(f"\n{'='*60}")
        print(f"Phase: {phase} - {prompt_config['name']}")
        print(f"Model preference: {model_pref}")
        print(f"{'='*60}\n")

        return prompt_text

    def check_permission(self, output: str) -> bool:
        """Check if output contains permission request and auto-approve"""
        if not self.child or not output:
            return False

        for pattern in self.permission_patterns:
            if re.search(pattern, output, re.IGNORECASE):
                print(f"\n{'='*60}")
                print(f"[{datetime.now().strftime('%H:%M:%S')}] ✓ PERMISSION DETECTED - Auto-approving")
                print(f"   Pattern matched: {pattern}")
                # Show context (first 150 chars of output)
                context = output[-150:].replace('\n', ' ')
                print(f"   Context: ...{context}")
                print(f"{'='*60}\n")

                # Send "1" to approve
                self.child.sendline("1")
                return True

        return False

    def handle_rate_limit(self, output: str) -> bool:
        """Check for rate limit and wait until quota resets"""
        if not self.enable_quota_wait:
            return False

        match = re.search(self.rate_limit_pattern, output, re.IGNORECASE)
        if not match:
            return False

        hour = int(match.group(1))
        meridiem = match.group(2).lower()

        # Convert to 24-hour format
        if meridiem == "pm" and hour != 12:
            hour += 12
        elif meridiem == "am" and hour == 12:
            hour = 0

        # Calculate wait time
        now = datetime.now()
        current_seconds = now.hour * 3600 + now.minute * 60 + now.second
        target_seconds = hour * 3600
        wait_seconds = target_seconds - current_seconds

        if wait_seconds < 0:
            wait_seconds += 86400  # Add 24 hours

        hours = wait_seconds // 3600
        minutes = (wait_seconds % 3600) // 60

        print(f"\n{'='*60}")
        print(f"⏰ Rate limit reached")
        print(f"   Waiting until {hour:02d}:00 (in {hours}h {minutes}m)")
        print(f"{'='*60}\n")

        time.sleep(wait_seconds)
        print("✓ Quota reset - restarting Claude\n")
        return True

    def start_claude(self, prompt_text: Optional[str] = None):
        """Start Claude Code process with optional initial prompt"""
        print(f"\n[{datetime.now().strftime('%H:%M:%S')}] Starting Claude Code (iteration {self.iteration + 1})...")

        if prompt_text:
            # Show first 100 chars of prompt
            preview = prompt_text[:100].replace('\n', ' ')
            print(f"   Prompt: {preview}...")

        # Build command with prompt if provided
        if prompt_text:
            cmd = ["claude", prompt_text]
        else:
            cmd = ["claude"]

        self.child = pexpect.spawn(
            cmd[0],
            args=cmd[1:] if len(cmd) > 1 else [],
            encoding='utf-8',
            timeout=self.timeout,
            maxread=50000
        )

        # Attach filtered log to capture Claude's responses
        self.child.logfile_read = self.filtered_log

        print(f"   Claude started, waiting for activity...")

    def monitor_loop(self):
        """Main monitoring loop"""
        output_buffer = ""
        last_output_time = time.time()

        while self.running:
            # Check iteration limit
            if self.max_iterations != -1 and self.iteration >= self.max_iterations:
                print(f"\n✓ Max iterations reached: {self.iteration}")
                break

            try:
                # Try to read any available output (non-blocking)
                try:
                    chunk = self.child.read_nonblocking(size=4096, timeout=0.5)
                    if isinstance(chunk, bytes):
                        chunk = chunk.decode('utf-8', errors='ignore')

                    # Filter out ANSI control codes to detect real output
                    import re as regex
                    clean_chunk = regex.sub(r'\x1b\[[0-9;]*[A-Za-z]', '', chunk)
                    clean_chunk = regex.sub(r'\x1b\].*?\x07', '', clean_chunk)
                    clean_chunk = regex.sub(r'\x1b\[.*?[\x40-\x7E]', '', clean_chunk)
                    clean_chunk = clean_chunk.replace('\x1b[?25l', '').replace('\x1b[?25h', '')
                    clean_chunk = clean_chunk.replace('\x1b[?2004h', '').replace('\x1b[?2004l', '')
                    clean_chunk = clean_chunk.replace('\x1b[?1004h', '').replace('\x1b[?2026h', '').replace('\x1b[?2026l', '')

                    # Only reset timer if we got substantial real output (>5 chars)
                    if clean_chunk.strip() and len(clean_chunk.strip()) > 5:
                        output_buffer += chunk
                        last_output_time = time.time()

                        # Check for permission dialog in accumulated output
                        if self.check_permission(output_buffer):
                            output_buffer = ""  # Clear after handling permission

                except pexpect.TIMEOUT:
                    # No output available right now
                    pass

                except pexpect.EOF:
                    # Claude exited
                    print(f"\n[{datetime.now().strftime('%H:%M:%S')}] Claude exited")

                    # Check for rate limit before exit
                    if output_buffer and self.handle_rate_limit(output_buffer):
                        # Restart after quota reset with same prompt
                        print(f"   Restarting after rate-limit wait...")
                        phase = self.get_next_phase()
                        prompt_text = self.get_prompt_text(phase)
                        self.save_phase(phase)

                        output_buffer = ""
                        last_output_time = time.time()
                        self.start_claude(prompt_text)
                        continue

                    # Normal exit
                    print(f"   Session ended normally.")
                    break

                # Check if we've been idle for the full timeout
                idle_time = time.time() - last_output_time
                if idle_time >= self.timeout:
                    # Check for rate limit
                    if output_buffer and self.handle_rate_limit(output_buffer):
                        # Restart Claude after quota reset with same prompt
                        phase = self.get_next_phase()
                        prompt_text = self.get_prompt_text(phase)
                        self.save_phase(phase)

                        self.child.close()
                        output_buffer = ""
                        last_output_time = time.time()
                        self.start_claude(prompt_text)
                        continue

                    # Normal auto-continue - restart with next prompt
                    self.iteration += 1
                    print(f"\n{'='*60}")
                    print(f"[{datetime.now().strftime('%H:%M:%S')}] Auto-continue triggered (iteration {self.iteration})")
                    print(f"   Idle time: {idle_time:.1f}s")
                    print(f"{'='*60}")

                    # Close old Claude instance
                    print(f"   Closing previous Claude instance...")
                    self.child.close()

                    # Start new instance with next phase prompt
                    phase = self.get_next_phase()
                    prompt_text = self.get_prompt_text(phase)
                    self.save_phase(phase)

                    self.start_claude(prompt_text)
                    output_buffer = ""
                    last_output_time = time.time()

            except Exception as e:
                print(f"\n⚠️  Error in monitor loop: {e}")
                import traceback
                traceback.print_exc()
                break

    def cleanup(self):
        """Cleanup resources"""
        if self.child and self.child.isalive():
            self.child.close()
        if hasattr(self, 'log_file') and self.log_file:
            self.log_file.close()
        self.release_lock()

    def run(self):
        """Main entry point"""
        print("="*60)
        print("Claude Code Auto-Continue (Python)")
        print("="*60)
        print(f"Configuration:")
        print(f"  Timeout: {self.timeout}s")
        print(f"  Max iterations: {self.max_iterations if self.max_iterations != -1 else 'unlimited'}")
        print(f"  Quota wait: {self.enable_quota_wait}")
        print(f"  Project: {self.project_root}")
        print(f"  Filtered log: {self.log_file_path}")
        print(f"\nPrompt Cycle: A → B → C → A → ...")

        for phase, prompt_config in self.prompts.items():
            print(f"  {phase}: {prompt_config['name']} ({prompt_config['model_preference']})")

        next_phase = self.get_next_phase()
        print(f"  Next prompt: Phase {next_phase}")
        print(f"\nPress Ctrl+C to stop at any time.")
        print(f"To monitor Claude's responses: tail -f {self.log_file_path}")
        print("="*60)
        print()

        # Acquire lock
        if not self.acquire_lock():
            return 1

        try:
            # Start Claude with first prompt
            phase = self.get_next_phase()
            prompt_text = self.get_prompt_text(phase)
            self.save_phase(phase)
            self.start_claude(prompt_text)

            # Monitor loop
            self.monitor_loop()

            print("\nSession ended.")
            return 0

        except KeyboardInterrupt:
            print("\n\n⚠️  Interrupted by user")
            return 130

        except Exception as e:
            print(f"\n⚠️  Fatal error: {e}")
            import traceback
            traceback.print_exc()
            return 1

        finally:
            self.cleanup()


def main():
    parser = argparse.ArgumentParser(
        description="Automatic Claude Code session continuation"
    )
    parser.add_argument(
        "--timeout",
        type=int,
        help="Inactivity timeout in seconds (default: from config)"
    )
    parser.add_argument(
        "--max-iterations",
        type=int,
        help="Maximum auto-continues (default: from config)"
    )
    parser.add_argument(
        "--no-quota-wait",
        action="store_true",
        help="Disable automatic rate-limit waiting"
    )
    parser.add_argument(
        "--config",
        default=None,
        help="Path to config file (default: auto-continue-config.json)"
    )

    args = parser.parse_args()

    # Determine paths
    script_dir = Path(__file__).parent
    project_root = script_dir.parent
    config_path = args.config or (script_dir / "auto-continue-config.json")

    if not config_path.exists():
        print(f"Error: Config file not found: {config_path}")
        return 1

    # Create AutoContinue instance
    auto_continue = AutoContinue(str(config_path), str(project_root))

    # Override config with CLI args
    if args.timeout is not None:
        auto_continue.timeout = args.timeout
    if args.max_iterations is not None:
        auto_continue.max_iterations = args.max_iterations
    if args.no_quota_wait:
        auto_continue.enable_quota_wait = False

    # Run
    return auto_continue.run()


if __name__ == "__main__":
    sys.exit(main())
