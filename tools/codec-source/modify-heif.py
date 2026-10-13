"""Prepare a marked LGPL3 libheif version-header modification after baseline validation."""
import argparse
import difflib
import hashlib
import json
import tarfile
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--work', default='release/codec-source/work')
parser.add_argument('--downloads', default='release/codec-source/downloads')
parser.add_argument('--dry-run', action='store_true')
arguments = parser.parse_args()
lock = json.loads((Path(__file__).resolve().parent / 'lock.json').read_text())
source = next(item for item in lock['sources'] if item['name'] == 'heif')
archive = Path(arguments.downloads) / source['file']
if archive.stat().st_size != source['bytes'] or hashlib.sha256(archive.read_bytes()).hexdigest() != source['sha256']:
    raise SystemExit('Pinned libheif archive checksum mismatch.')
relative = 'libheif/api/libheif/heif_version.h.in'
with tarfile.open(archive, 'r:gz') as tar:
    member = next(member for member in tar if member.isfile() and member.name.endswith('/' + relative))
    original = tar.extractfile(member).read()
path = Path(arguments.work) / 'dependencies/Dependencies/heif' / relative
if path.read_bytes() != original:
    raise SystemExit('libheif source is not pristine; refusing a second/unidentified modification.')
before = '#define LIBHEIF_VERSION "@PROJECT_VERSION_MAJOR@.@PROJECT_VERSION_MINOR@.@PROJECT_VERSION_PATCH@"'
after = '// Remage private relink proof: version string modified 2026-10-12; LGPL notices retained.\n#define LIBHEIF_VERSION "@PROJECT_VERSION_MAJOR@.@PROJECT_VERSION_MINOR@.@PROJECT_VERSION_PATCH@-remage-relink-proof"'
text = original.decode('utf8')
if text.count(before) != 1:
    raise SystemExit('Pinned libheif version template does not match the reviewed modification.')
modified = text.replace(before, after)
patch = ''.join(difflib.unified_diff(text.splitlines(keepends=True), modified.splitlines(keepends=True), fromfile='a/' + relative, tofile='b/' + relative))
if arguments.dry_run:
    print(patch)
else:
    evidence = Path(arguments.work) / 'evidence'
    evidence.mkdir(parents=True, exist_ok=True)
    (evidence / 'libheif-relink-proof.patch').write_text(patch)
    path.write_text(modified)
    result = {'source': source['commit'], 'path': relative, 'originalSha256': hashlib.sha256(original).hexdigest(),
              'modifiedSha256': hashlib.sha256(modified.encode()).hexdigest(), 'marker': '-remage-relink-proof',
              'license': 'Original file LGPL3-or-later header retained; this patch does not relicense libheif.'}
    (evidence / 'libheif-modification.json').write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps(result))
