import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch

SOURCE = Path(__file__).resolve().parents[1] / 'tools/chat-protection.py'
spec = importlib.util.spec_from_file_location('protection', SOURCE)
protection = importlib.util.module_from_spec(spec)
spec.loader.exec_module(protection)


class ProtectionTests(unittest.TestCase):
    def test_only_installed_app_and_control_commands_are_protected(self):
        cases = [
            (protection.APP, [], [], 0, 0o755, True),
            (protection.APP, [b'--type=renderer'], [], 0, 0o755, True),
            (protection.APP, [], [b'ELECTRON_RUN_AS_NODE=1'], 0, 0o755, False),
            (protection.APP, [], [b'ELECTRON_RUN_AS_NODE=true'], 0, 0o755, False),
            (protection.APP, [], [b'ELECTRON_RUN_AS_NODE=0'], 0, 0o755, False),
            (protection.APP, [], [b'ELECTRON_RUN_AS_NODE='], 0, 0o755, True),
            (protection.CONTROL, [b'-c', b'features.code_mode_host=true', b'app-server'], [], 0, 0o755, True),
            (protection.CONTROL, [b'exec-server', b'--remote'], [], 0, 0o755, True),
            (protection.CONTROL, [b'exec', b'build'], [], 0, 0o755, False),
            (protection.CONTROL, [b'exec', b'app-server'], [], 0, 0o755, False),
            (protection.CONTROL, [b'-c', b'app-server', b'exec', b'exec-server'], [], 0, 0o755, False),
            ('/tmp/ChatGPT', [], [], 0, 0o755, False),
            ('/usr/lib/chatgpt/resources/codex-code-mode-host', [], [], 0, 0o755, False),
            (protection.APP, [], [], 1000, 0o755, False),
            (protection.APP, [], [], 0, 0o775, False),
        ]
        for exe, args, env, owner, mode, expected in cases:
            with self.subTest(exe=exe, args=args, owner=owner, mode=mode):
                self.assertEqual(protection.is_control(exe, args, env, owner, mode), expected)

    def test_mixed_scope_adopted_workers_descendants_and_previous_exec_are_killable(self):
        def p(start, parent, group, critical=False):
            return dict(start=start, parent=parent, group=group, critical=critical)
        processes = {
            1: p('1', 0, '/app.scope', True),
            2: p('2', 0, '/app.scope'),  # adopted worker, no parent link
            3: p('3', 1, '/other.scope'),
            4: p('4', 3, '/other.scope/child'),
            5: p('5', 0, '/unrelated.scope'),
            6: p('6', 0, '/moved.scope'),  # previously protected, now exec'ed work
            7: p('new', 0, '/unrelated.scope'),  # PID reuse
        }
        old = {'6': dict(start='6'), '7': dict(start='old')}
        self.assertEqual(protection.related_processes(processes, old), {1, 2, 3, 4, 6})

    def test_scope_and_service_dropins_are_verified(self):
        for suffix, section in [('scope', 'Scope'), ('service', 'Service')]:
            with patch.object(protection, 'userctl') as ctl:
                ctl.return_value.stdout = 'OOMPolicy=continue\nManagedOOMPreference=omit\n'
                protection.configure_unit(1000, 'app.' + suffix)
                self.assertEqual(ctl.call_args_list[0].kwargs['input'],
                                 f'[{section}]\nOOMPolicy=continue\nManagedOOMPreference=omit\n')
                ctl.return_value.stdout = 'OOMPolicy=stop\nManagedOOMPreference=none\n'
                with self.assertRaises(RuntimeError):
                    protection.configure_unit(1000, 'app.' + suffix)

    def test_unit_lookup_does_not_choose_user_manager_or_delegated_subgroup(self):
        base = '/user.slice/user-1000.slice/user@1000.service/'
        self.assertEqual(protection.unit_for(base+'app.slice/app-chat.scope/child', 1000), 'app-chat.scope')
        with self.assertRaises(ValueError):
            protection.unit_for('/system.slice/foreign.service', 1000)


if __name__ == '__main__':
    unittest.main()
