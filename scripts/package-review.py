"""Package the current authorized diff and evidence without changing Git state."""
from pathlib import Path
import hashlib, json, subprocess, zipfile
from datetime import datetime, timezone

root = Path(__file__).resolve().parents[1]
review = root / 'docs/arcade-upgrade/review'
review.mkdir(parents=True, exist_ok=True)
archive = root / 'docs/arcade-upgrade/arcade-review-packet.zip'

def git(*args):
    return subprocess.run(['git', *args], cwd=root, capture_output=True, check=True).stdout

def paths(data):
    return [p.decode() for p in data.split(b'\0') if p]

modified = paths(git('diff', '--name-only', '-z'))
new = paths(git('ls-files', '--others', '--exclude-standard', '-z'))
source_new = [p for p in new if not p.startswith('docs/')]
patch = git('diff', '--binary', '--', '.', ':(exclude)docs')
for name in source_new:
    result = subprocess.run(['git', 'diff', '--no-index', '--binary', '--', '/dev/null', name], cwd=root, capture_output=True)
    if result.returncode not in (0, 1): raise RuntimeError('Could not capture an untracked source diff')
    patch += result.stdout
(review / 'source-changes.patch').write_bytes(patch)
# This verifies against the current dirty tree without writing any files.
subprocess.run(['git', 'apply', '--check', '--reverse', str(review / 'source-changes.patch')], cwd=root, check=True)
all_files = sorted(set(modified + paths(git('ls-files', '--others', '--exclude-standard', '-z'))))
# Exclude outputs that would otherwise describe/hash themselves while changing.
generated = {str(archive.relative_to(root)), 'docs/arcade-upgrade/review/file-manifest.json',
             'docs/arcade-upgrade/evidence/final-review-package.log'}
all_files = [p for p in all_files if p not in generated]
entries = [{'path': name, 'bytes': (root/name).stat().st_size,
            'sha256': hashlib.sha256((root/name).read_bytes()).hexdigest()} for name in all_files if (root/name).is_file()]
manifest = {'generatedAt': datetime.now(timezone.utc).isoformat(),
            'repository': 'sungmpar/ft_transcendence_project',
            'branch': git('branch', '--show-current').decode().strip(),
            'head': git('rev-parse', 'HEAD').decode().strip(),
            'originMain': git('rev-parse', 'origin/main').decode().strip(),
            'stagedFiles': paths(git('diff', '--cached', '--name-only', '-z')),
            'modifiedTrackedFiles': modified, 'sourcePatchReverseCheck': 'PASS', 'files': entries}
manifest_path = review / 'file-manifest.json'
manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as package:
    for entry in entries: package.write(root / entry['path'], entry['path'])
    package.write(manifest_path, str(manifest_path.relative_to(root)))
with zipfile.ZipFile(archive) as package:
    assert package.testzip() is None
    for entry in entries:
        assert hashlib.sha256(package.read(entry['path'])).hexdigest() == entry['sha256']
print(json.dumps({'files':len(entries)+1, 'archive':str(archive.relative_to(root)),
                  'bytes':archive.stat().st_size, 'reversePatchCheck':'PASS','zipHashVerification':'PASS'}))
