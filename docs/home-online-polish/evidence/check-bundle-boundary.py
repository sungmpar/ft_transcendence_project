"""Inspect the actual webpack graph produced by Vue CLI --report-json."""
from pathlib import Path
import hashlib
import json
import re

ROOT = Path(__file__).resolve().parents[3]
stats_path = ROOT / 'frontend/dist/report.json'
stats = json.loads(stats_path.read_text())
names = set()


def visit(value):
    if isinstance(value, dict):
        if 'name' in value and any(key in value for key in ['identifier', 'modules', 'moduleType']):
            names.add(value['name'])
        for key in ['modules', 'children']:
            for item in value.get(key, []):
                visit(item)


visit(stats)
forbidden = [name for name in sorted(names) if re.search(
    r'[/\\]backend[/\\]|@nestjs[/\\]|(?:^|[/\\])(?:typeorm|pg|pg-pool)(?:[/\\]|$)', name)]
shared = [name for name in sorted(names) if name.startswith('../shared/')]
report = {
    'status': 'PASS' if names and shared and not forbidden else 'FAIL',
    'source': 'Vue CLI 5 build --report-json actual webpack module graph',
    'reportSha256': hashlib.sha256(stats_path.read_bytes()).hexdigest(),
    'build': stats.get('hash'),
    'modulesExamined': len(names),
    'sharedPureModules': shared,
    'backendNestTypeormPgModules': forbidden,
}
(Path(__file__).parent / 'final-bundle-boundary.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report, indent=2))
assert report['status'] == 'PASS'
