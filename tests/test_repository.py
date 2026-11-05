"""Repository layout checks only. Does not run Godot or certify security.
Run: python3 -m unittest discover -s tests -p 'test_repository.py' -v
Uses the Python standard library and writes no project/game files.
"""
from __future__ import annotations

import csv
import json
import re
import unittest
import os
from pathlib import Path
from urllib.parse import unquote

ROOT = Path(__file__).resolve().parents[1]
IGNORED_DIRS = {'.git', '.godot', 'build', 'dist', 'exports', 'releases',
                '.venv', 'venv', '__pycache__', '.idea', '.vscode',
                'node_modules', '.pnpm-store', 'test-results', 'playwright-report', 'coverage'}


def source_files() -> list[Path]:
    files = []
    for folder, directories, names in os.walk(ROOT):
        directories[:] = [d for d in directories if d not in IGNORED_DIRS]
        files.extend(Path(folder) / name for name in names)
    return sorted(files)


def read_csv(name: str) -> list[dict[str, str]]:
    with (ROOT / 'docs/catalogs' / name).open(encoding='utf-8', newline='') as f:
        return list(csv.DictReader(f))


class RepositoryTests(unittest.TestCase):
    def test_required_project_and_document_files(self) -> None:
        paths = (
            'project.godot', 'export_presets.cfg', 'scenes/Main.tscn',
            'scripts/main.gd', 'scripts/save_store.gd', 'scripts/session_guard.gd',
            'tests/static_audit.py', 'tests/test_save_store.gd', 'tests/test_resources.gd',
            'packaging/build_windows.ps1', 'packaging/installer.nsi',
            'README.md', 'AGENTS.md', 'SECURITY.md', 'LICENSE_POLICY.md',
            '.gitignore', '.gitattributes', '.editorconfig',
            'docs/GITHUB_UPLOAD.md', 'docs/DEVELOPMENT.md', 'docs/PROJECT_STATUS.md',
            'docs/REPOSITORY_REVIEW.md', 'docs/source_provenance.json',
        )
        for name in paths:
            with self.subTest(path=name):
                self.assertTrue((ROOT / name).is_file(), name)

    def test_literal_godot_resource_references(self) -> None:
        for path in source_files():
            if path.suffix not in {'.gd', '.tscn', '.godot'}:
                continue
            text = path.read_text(encoding='utf-8')
            for name in re.findall(r'[\"\']res://([^\"\']+)[\"\']', text):
                if '%' in name:  # Formatted asset paths are covered by static_audit.
                    continue
                with self.subTest(file=str(path.relative_to(ROOT)), resource=name):
                    self.assertTrue((ROOT / name).is_file(), name)

    def test_character_catalog_matches_code(self) -> None:
        text = (ROOT / 'scripts/main.gd').read_text(encoding='utf-8')
        block = text[text.index('const CHARACTERS :='):text.index('const ZONES :=')]
        expected = re.findall(r'\["((?:z_|m_)[^"]+)", "([^"]+)", "([^"]+)"\]', block)
        rows = read_csv('characters.csv')
        self.assertEqual([(r['id'], r['display_name'], r['base_skill_name']) for r in rows], expected)
        self.assertEqual(len({r['id'] for r in rows}), 28)
        for row in rows:
            self.assertEqual(row['group'], 'zodiac' if row['id'].startswith('z_') else 'MBTI')
            self.assertTrue((ROOT / row['asset_directory']).is_dir())

    def test_zone_catalog_matches_code(self) -> None:
        text = (ROOT / 'scripts/main.gd').read_text(encoding='utf-8')
        block = text[text.index('const ZONES :=') + len('const ZONES :='):text.index('\n\nvar data')]
        expected = json.loads(block)
        rows = read_csv('zones.csv')
        self.assertEqual(len(rows), len(expected))
        for index, (row, zone) in enumerate(zip(rows, expected)):
            self.assertEqual(int(row['id']), index)
            self.assertEqual(row['name'], zone['name'])
            self.assertEqual(row['monster_ids'].split(';'), zone['mobs'])
            for col, key in [('unlock_level', 'level'), ('monster_hp', 'hp'),
                             ('monster_attack', 'attack'), ('xp_reward', 'xp'),
                             ('base_coin_reward', 'coin')]:
                self.assertEqual(int(row[col]), zone[key])

    def test_shop_catalog_count_labels_and_prices(self) -> None:
        text = (ROOT / 'scripts/main.gd').read_text(encoding='utf-8')
        block = text[text.index('func _show_shop'):text.index('func _shop_item')]
        entries = re.findall(r'_shop_item\(body, "([^"]+)", (\d+),', block)
        rows = read_csv('shop.csv')
        self.assertEqual(len(rows), len(entries))
        for row, (label, price) in zip(rows, entries):
            self.assertIn(row['item'], label)
            self.assertEqual(int(row['coins']), int(price))

    def test_ignore_rules_preserve_godot_source_metadata(self) -> None:
        rules = {s.strip() for s in (ROOT / '.gitignore').read_text(encoding='utf-8').splitlines()
                 if s.strip() and not s.lstrip().startswith('#')}
        self.assertTrue({'.godot/', '/build/', '*.exe', '*.pck', '*.zip', '.env',
                         '*.pfx', '*.p12', 'save.json', 'before-reset.json'} <= rules)
        self.assertFalse({'*.uid', '*.import', '*.gd', '*.png', '*.json', 'export_presets.cfg'} & rules)

    def test_no_release_binaries_credentials_or_player_saves_in_source(self) -> None:
        suffixes = {'.exe', '.msi', '.dll', '.pck', '.dmg', '.pkg', '.so', '.dylib',
                    '.zip', '.7z', '.p12', '.pfx', '.pem', '.key', '.keystore', '.jks'}
        names = {'save.json', 'save.previous.json', 'save.pending.json', 'before-reset.json',
                 'mochipet_desktop_save.json', 'owner.json', 'export_credentials.cfg', '.env'}
        for path in source_files():
            with self.subTest(file=str(path.relative_to(ROOT))):
                self.assertNotIn(path.suffix.lower(), suffixes)
                self.assertNotIn(path.name, names)
                self.assertFalse(path.name.startswith('.env.') and path.name != '.env.example')
                self.assertFalse(any(x.endswith('.app') for x in path.relative_to(ROOT).parts))

    def test_local_markdown_links_resolve(self) -> None:
        for path in source_files():
            if path.suffix != '.md':
                continue
            for target in re.findall(r'\[[^\]\n]+\]\(([^)\n]+)\)', path.read_text(encoding='utf-8')):
                if re.match(r'^(?:https?://|mailto:|#)', target):
                    continue
                target = unquote(target.split('#', 1)[0])
                resolved = (path.parent / target).resolve()
                with self.subTest(file=str(path.relative_to(ROOT)), link=target):
                    self.assertTrue(resolved.is_relative_to(ROOT))
                    self.assertTrue(resolved.exists(), target)

    def test_png_counts(self) -> None:
        self.assertEqual(len(list((ROOT / 'assets/pets').rglob('*.png'))), 392)
        self.assertEqual(len(list((ROOT / 'assets/monsters').rglob('*.png'))), 8)

    def test_current_settings_do_not_claim_or_enable_release(self) -> None:
        config = (ROOT / 'project.godot').read_text(encoding='utf-8')
        export = (ROOT / 'export_presets.cfg').read_text(encoding='utf-8')
        self.assertIn('config/version="0.4.1-review"', config)
        self.assertIn('experimental_desktop_overlay=false', config)
        self.assertIn('codesign/enable=false', export)
        self.assertFalse((ROOT / '.github/workflows').exists())


if __name__ == '__main__':
    unittest.main()
