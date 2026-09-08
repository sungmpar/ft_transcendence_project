"""Capture this Goal's authorized dirty diff and evidence without changing Git.
Run after implementation, tests and reports are final. No old Goal outputs written.
"""
from datetime import datetime, timezone
from pathlib import Path
import hashlib
import json
import re
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parents[1]
REPORT = ROOT / 'docs/home-online-polish'
REVIEW = REPORT / 'review'
ARCHIVE = REPORT / 'home-online-review-packet.zip'


def git(*args):
    return subprocess.run(['git', *args], cwd=ROOT, capture_output=True, check=True).stdout


def paths(data):
    return [p.decode() for p in data.split(b'\0') if p]


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def source(name):
    return name == 'README.md' or (name.startswith(('frontend/src/', 'backend/src/', 'backend/test/', 'shared/', 'scripts/'))
        and Path(name).suffix in {'.ts', '.vue', '.css', '.js', '.cjs', '.mjs', '.json', '.py', '.sh'})


def omitted(name):
    path = Path(name)
    return (any(part in {'__pycache__', '.pytest_cache', '.cache', 'node_modules', '.DS_Store'} for part in path.parts)
            or path.suffix in {'.pyc', '.pyo', '.pem', '.key'}
            or any(part == '.env' or part.startswith('.env.') for part in path.parts))


def inventory(names):
    selected = []
    for name in names:
        if omitted(name):
            continue
        if not source(name) and not name.startswith('docs/home-online-polish/'):
            raise RuntimeError('Unexpected changed path; confirm ownership before packaging: ' + name)
        if (ROOT / name).is_symlink():
            raise RuntimeError('Review package does not follow symlinks: ' + name)
        selected.append(name)
    return selected


def check_sensitive_text(path):
    if path.suffix.lower() not in {'.md', '.txt', '.json', '.log', '.py', '.ts', '.js', '.cjs', '.mjs', '.sh', '.css', '.vue', '.patch'}:
        return
    value = path.read_text(errors='replace')
    if re.search(r'eyJ[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}', value) or re.search(r'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----', value):
        raise RuntimeError('Potential credential material; inspect without printing its contents: ' + str(path.relative_to(ROOT)))


def main():
    remote = git('remote', 'get-url', 'origin').decode().strip().removesuffix('.git')
    if remote not in ['https://github.com/sungmpar/ft_transcendence_project', 'git@github.com:sungmpar/ft_transcendence_project']:
        raise RuntimeError('Unexpected repository; no package was written')
    modified = paths(git('diff', '--name-only', '-z'))
    untracked = paths(git('ls-files', '--others', '--exclude-standard', '-z'))
    if git('diff', '--cached', '--name-only'):
        raise RuntimeError('Staged changes are outside this Goal’s expected state; inspect before packaging')
    selected = inventory(modified + untracked)
    source_fingerprints = {name: digest(ROOT / name) for name in selected if source(name) and (ROOT / name).is_file()}
    for name in selected:
        if (ROOT / name).is_file():
            check_sensitive_text(ROOT / name)
    REVIEW.mkdir(parents=True, exist_ok=True)
    source_modified = [name for name in modified if name in selected and source(name)]
    patch = git('diff', '--binary', '--', *source_modified) if source_modified else b''
    for name in sorted(name for name in untracked if name in selected and source(name)):
        result = subprocess.run(['git', 'diff', '--no-index', '--binary', '--', '/dev/null', name], cwd=ROOT, capture_output=True)
        if result.returncode not in (0, 1):
            raise RuntimeError('Could not capture an untracked source diff')
        patch += result.stdout
    patch_path = REVIEW / 'source-changes.patch'
    patch_path.write_bytes(patch)
    subprocess.run(['git', 'apply', '--check', '--reverse', str(patch_path)], cwd=ROOT, check=True)
    exclusions = {
        'docs/home-online-polish/review/file-manifest.json',
        'docs/home-online-polish/home-online-review-packet.zip',
        'docs/home-online-polish/evidence/final-review-package.log',
    }
    final_inventory = modified + paths(git('ls-files', '--others', '--exclude-standard', '-z'))
    names = sorted(set(inventory(final_inventory)) - exclusions)
    final_sources = {name: digest(ROOT / name) for name in names if source(name) and (ROOT / name).is_file()}
    if source_fingerprints != final_sources or modified != paths(git('diff', '--name-only', '-z')):
        raise RuntimeError('Source files changed while capturing the patch; wait for writers and rerun')
    for name in names:
        if (ROOT / name).is_file():
            check_sensitive_text(ROOT / name)
    entries = [{'path': name, 'bytes': (ROOT / name).stat().st_size, 'sha256': digest(ROOT / name)}
               for name in names if (ROOT / name).is_file()]
    manifest = {
        'generatedAt': datetime.now(timezone.utc).isoformat(),
        'repository': 'sungmpar/ft_transcendence_project',
        'branch': git('branch', '--show-current').decode().strip(),
        'head': git('rev-parse', 'HEAD').decode().strip(),
        'originMain': git('rev-parse', 'origin/main').decode().strip(),
        'stagedFiles': [], 'modifiedTrackedFiles': modified,
        'omittedRuntimeOrSecretPaths': sorted({name for name in final_inventory if omitted(name)}),
        'sourcePatchSha256': digest(patch_path), 'sourcePatchReverseCheck': 'PASS',
        'files': entries,
    }
    manifest_path = REVIEW / 'file-manifest.json'
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    with zipfile.ZipFile(ARCHIVE, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as package:
        for entry in entries:
            package.write(ROOT / entry['path'], entry['path'])
        package.write(manifest_path, str(manifest_path.relative_to(ROOT)))
    with zipfile.ZipFile(ARCHIVE) as package:
        assert package.testzip() is None
        for entry in entries:
            assert hashlib.sha256(package.read(entry['path'])).hexdigest() == entry['sha256']
    print(json.dumps({'files': len(entries) + 1, 'archive': str(ARCHIVE.relative_to(ROOT)),
                      'bytes': ARCHIVE.stat().st_size, 'reversePatchCheck': 'PASS', 'zipHashVerification': 'PASS'}))


if __name__ == '__main__':
    main()
