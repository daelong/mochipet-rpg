#!/usr/bin/env python3
"""Static policy/resource checks. NOT a GDScript parser, antivirus, or runtime test.
Uses the Python standard library only; safe to run on an isolated source checkout.
"""
from __future__ import annotations
import argparse
import ast
import hashlib
import json
import re
import struct
import sys
import zlib
import os
from pathlib import Path


def source_files(root: Path):
    # Dependencies, caches and generated test/build output are not game source.
    excluded = {'.git', '.godot', 'node_modules', '.pnpm-store', 'dist', 'build',
                'exports', 'releases', 'test-results', 'playwright-report',
                'coverage', '__pycache__', '.venv', 'venv'}
    for folder, directories, names in os.walk(root):
        directories[:] = [d for d in directories if d not in excluded]
        for name in names:
            yield Path(folder) / name


def audit(root: Path) -> dict:
    checks: list[dict[str, object]] = []
    def check(name: str, ok: bool, detail: str = '') -> None:
        checks.append({'name': name, 'passed': bool(ok), 'detail': detail})
    main = (root/'scripts/main.gd').read_text(encoding='utf-8')
    save = (root/'scripts/save_store.gd').read_text(encoding='utf-8')
    guard = (root/'scripts/session_guard.gd').read_text(encoding='utf-8')
    project = (root/'project.godot').read_text(encoding='utf-8')
    nsis = (root/'packaging/installer.nsi').read_text(encoding='utf-8')
    build = (root/'packaging/build_windows.ps1').read_text(encoding='utf-8')
    export = (root/'export_presets.cfg').read_text(encoding='utf-8')
    game = '\n'.join((main, save, guard))
    # Lexical rules are intentionally conservative and not a malware verdict.
    network = re.search(r'\b(HTTPRequest|HTTPClient|WebSocketPeer|ENetMultiplayerPeer|TCPServer|UDPServer|PacketPeerUDP|StreamPeerTCP|WebRTCPeerConnection|WebSocketMultiplayerPeer)\b', game)
    check('no_game_network_API_tokens', network is None)
    check('no_shell_or_external_process_launch', not re.search(r'OS\.(execute|create_process|shell_open|shell_show_in_file_manager)|Expression\.new|load_resource_pack|bytes_to_var|str_to_var|get_var\(', game))
    check('no_input_hooks_or_capture_API_tokens', not re.search(r'get_screen_capture|screen_get_image|AudioEffectRecord|CameraServer|set_mouse_mode|Input\.is_physical_key_pressed', game))
    check('normal_window_startup', all(s in project for s in ('window/size/transparent=false','window/size/borderless=false','window/size/always_on_top=false')))
    check('overlay_opt_in_gate_is_disabled', 'experimental_desktop_overlay=false' in project and 'mode_button.disabled = not bool(ProjectSettings.get_setting(' in main)
    check('no_fullscreen_hit_polygon', 'mouse_passthrough_polygon =' not in main)
    check('frame_and_effect_limits', all(s in main for s in ('const FPS_ACTIVE := 30','const FPS_PAUSED := 10','const MAX_FLOATS := 24','floats.pop_front()')))
    check('minimized_pause', 'Window.MODE_MINIMIZED' in main and 'game_paused or minimized' in main)
    check('captioned_window_close_handler', 'win.close_requested.connect(_request_quit)' in main)
    check('single_instance_file_guard', 'DirAccess.make_dir_absolute(LOCK_DIR)' in guard and 'OS.is_process_running(previous)' in guard)
    check('save_size_and_schema_guards', all(s in save for s in ('const LIMIT_BYTES := 65536','file.get_length() > LIMIT_BYTES','"future"','read_only = true')))
    check('save_schema_types_finite_and_bounds', 'is_finite(number)' in save and 'TYPE_FLOAT' in save and 'clampf(number' in save)
    check('temporary_write_reopen_and_backup', all(s in save for s in ('_write_checked(TEMP, value)','_read(name)','save.previous.json','DirAccess.rename_absolute(_path(TEMP), _path(MAIN))')))
    check('reset_confirmation_and_backup', 'reset_confirm.confirmed.connect(_reset_confirmed)' in main and 'before-reset.json' in save and 'get_sha256' in save)
    check('no_auto_hunt_resume', 'data.hunt = false' in main and 'clean.hunt = false' in save)
    check('save_coalescing', 'autosave_time >= 10.0' in main and 'save_retry_wait = 30.0' in main)
    check('separate_app_data_folder', 'config/custom_user_dir_name="MochiPetRPG/desktop-v041"' in project)
    check('unbounded_engine_file_logs_disabled', 'file_logging/enable_file_logging.pc=false' in project)
    check('installer_requests_user_not_admin', 'RequestExecutionLevel user' in nsis and 'RequestExecutionLevel admin' not in nsis)
    # Strip comments to avoid false positives for the installer-policy prose.
    nsis_code = '\n'.join(l for l in nsis.splitlines() if not l.lstrip().startswith(';'))
    ps_code = '\n'.join(l for l in build.splitlines() if not l.lstrip().startswith('#'))
    check('installer_is_offline', not re.search(r'inetc::|NSISdl::|nsExec::|ExecWait|(?im:^\s*Exec\b)|https?://', nsis_code))
    check('builder_no_download_or_policy_change', not re.search(r'Invoke-WebRequest|Start-BitsTransfer|Invoke-Expression|Set-ExecutionPolicy|Set-MpPreference|Add-MpPreference|ExecutionPolicy\s+Bypass', ps_code, re.I))
    check('installer_no_machinewide_or_autorun_changes', not re.search(r'\bHKLM\b|CurrentVersion\\Run|schtasks|netsh|regsvr32|MpPreference|Firewall', nsis_code, re.I))
    check('installer_postinstall_launch_opt_in', '!define MUI_FINISHPAGE_RUN_NOTCHECKED' in nsis)
    check('uninstall_no_recursive_delete_or_save_delete', 'RMDir /r' not in nsis_code and '$APPDATA' not in nsis_code and 'desktop-v041' not in nsis_code)
    check('developer_tests_gate_export', build.index('test_save_store.gd') < build.index('--export-release') and build.index('test_resources.gd') < build.index('--export-release'))
    check('export_excludes_developer_tools', 'tests/*,docs/*,packaging/*' in export and 'binary_format/embed_pck=false' in export)
    check('no_user_save_data_bundled', not any(p.name in {'save.json','mochipet_desktop_save.json','owner.json'} for p in source_files(root)))
    check('no_executable_bundled_in_source', not any(p.suffix.lower() in {'.exe','.dll','.so','.dylib'} for p in source_files(root)))
    # Asset paths are fixed strings and whitelist identifiers, never save-derived paths.
    ids_match = re.search(r'const PET_IDS := (\[.*\])', save)
    ids = ast.literal_eval(ids_match.group(1)) if ids_match else []
    char_ids = re.findall(r'^\s*\["((?:z_|m_)[^"]+)"', main, re.M)
    # There are two array entries per line in the original character catalog.
    catalog = main[main.index('const CHARACTERS :='):main.index('const ZONES :=')]
    char_ids = re.findall(r'\["((?:z_|m_)[^"]+)"', catalog)
    check('character_whitelist_consistent', len(ids)==28 and len(set(ids))==28 and set(ids)==set(char_ids))
    files = []
    for pet_id in ids:
        for state in ('idle','walk','play','eat','happy','sad','sleep'):
            for frame in range(2):
                files.append(root/f'assets/pets/{pet_id}/{state}_{frame}_right.png')
    for monster in ('slime','mushroom','bat','foxfire','golem','shade','ghost','moon'):
        files.append(root/f'assets/monsters/{monster}.png')
    check('all_400_asset_paths_exist', len(files)==400 and all(p.is_file() for p in files))
    image_errors = []
    asset_hashes = {}
    for p in files:
        if not p.is_file():
            image_errors.append(str(p.relative_to(root)))
            continue
        data = p.read_bytes()
        asset_hashes[str(p.relative_to(root))] = hashlib.sha256(data).hexdigest()
        try:
            if data[:8] != b'\x89PNG\r\n\x1a\n':
                raise ValueError('signature')
            width, height = struct.unpack('>II', data[16:24])
            if not (1 <= width <= 4096 and 1 <= height <= 4096):
                raise ValueError('dimensions')
            offset, end = 8, False
            while offset < len(data):
                length = struct.unpack_from('>I', data, offset)[0]
                tag = data[offset+4:offset+8]
                contents = data[offset+8:offset+8+length]
                crc = struct.unpack_from('>I', data, offset+8+length)[0]
                if zlib.crc32(tag+contents)&0xffffffff != crc:
                    raise ValueError('CRC')
                offset += length + 12
                if tag == b'IEND':
                    end = True
                    break
            if not end:
                raise ValueError('IEND')
        except (ValueError, struct.error) as exc:
            image_errors.append(f'{p.relative_to(root)}: {exc}')
    check('png_chunk_integrity_and_dimensions', not image_errors, '; '.join(image_errors[:3]))
    check('no_duplicate_gd_functions', all(len(re.findall(r'^func (\w+)\(', text, re.M)) == len(set(re.findall(r'^func (\w+)\(', text, re.M))) for text in (main,save,guard)))
    return {
        'scope': 'Static lexical policy, package layout, and PNG integrity checks only. No GDScript execution or malware scan.',
        'checks': checks,
        'total': len(checks),
        'passed': sum(bool(c['passed']) for c in checks),
        'asset_files': len(asset_hashes),
        'asset_sha256': asset_hashes,
        'not_tested': ['Godot parse/runtime', 'NSIS compile/install/uninstall', 'Windows/macOS GUI', 'Defender/third-party antivirus', 'network capture', 'battery/CPU benchmarks', 'disk-full/power-loss', 'SmartScreen/signing'],
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument('--report', type=Path)
    args = parser.parse_args()
    result = audit(args.root.resolve())
    for item in result['checks']:
        print(('PASS' if item['passed'] else 'FAIL'), item['name'])
    print(f"STATIC ONLY: {result['passed']}/{result['total']} checks; {result['asset_files']} PNG files")
    if args.report:
        args.report.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
    return 0 if result['passed'] == result['total'] else 1


if __name__ == '__main__':
    sys.exit(main())
