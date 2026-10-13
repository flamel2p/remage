#!/usr/bin/env python3
"""Produce a deterministic private source-preparation packet, never publish it."""
import argparse
import gzip
import hashlib
import io
import json
import sys
import tarfile
from pathlib import Path, PurePosixPath
sys.dont_write_bytecode = True
from archive_helpers import license_members

parser = argparse.ArgumentParser()
parser.add_argument('--downloads', default='release/codec-source/downloads')
parser.add_argument('--application', default='release/codec-source/remage-8f2c5b48a4e8a388591ce309ec5a350531d34178.tar')
parser.add_argument('--output', default='release/codec-source/remage-magick-wasm-0.0.44-source-preparation.tar.gz')
parser.add_argument('--public', action='store_true', help='Reserved gate: refuses while redistribution review is unresolved.')
arguments = parser.parse_args()
if arguments.public:
    raise SystemExit('Public packet refused: Dependencies build-script redistribution rights and release review are unresolved.')
tool = Path(__file__).resolve().parent
lock = json.loads((tool / 'lock.json').read_text())
downloads, output = Path(arguments.downloads), Path(arguments.output)
payload = {}
licenses = []
for source in lock['sources']:
    path = downloads / source['file']
    if hashlib.sha256(path.read_bytes()).hexdigest() != source['sha256'] or path.stat().st_size != source['bytes']:
        raise SystemExit('Source checksum mismatch: ' + source['name'])
    payload['sources/' + source['file']] = path
    with tarfile.open(path, 'r:gz') as archive:
        members = archive.getmembers()
        roots = {PurePosixPath(member.name).parts[0] for member in members}
        if len(roots) != 1 or not next(iter(roots)).endswith('-' + source['commit']):
            raise SystemExit('Unexpected source archive root: ' + source['name'])
        for member in members:
            if PurePosixPath(member.name).is_absolute() or '..' in PurePosixPath(member.name).parts:
                raise SystemExit('Unsafe archive path: ' + member.name)
        for member in license_members(archive, members, next(iter(roots))):
                name = '/'.join(Path(member.name).parts[1:])
                data = archive.extractfile(member).read()
                destination = 'licenses/' + source['name'] + '/' + name
                payload[destination] = data
                licenses.append({'source': source['name'], 'path': name, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()})
application = Path(arguments.application)
application_metadata = json.loads(Path('release/codec-source/application-source.json').read_text())
if application.name != application_metadata['file'] or application.stat().st_size != application_metadata['bytes'] or hashlib.sha256(application.read_bytes()).hexdigest() != application_metadata['sha256']:
    raise SystemExit('Application source archive does not match its recorded identity.')
with tarfile.open(application) as archive:
    for member in archive:
        parts = PurePosixPath(member.name).parts
        if PurePosixPath(member.name).is_absolute() or '..' in parts or any(part in {'.git', '.codex', '.agents', 'node_modules', 'output', 'release'} or part.startswith('.env') for part in parts):
            raise SystemExit('Private or unsafe application archive entry: ' + member.name)
payload['application/' + application.name] = application
payload['application/application-source.json'] = Path('release/codec-source/application-source.json')
layer_metadata = Path('release/codec-source/application-workingtree-source.json')
if layer_metadata.is_file():
    layer = json.loads(layer_metadata.read_text())
    layered_archive = layer_metadata.parent / layer['file']
    patch = layer_metadata.parent / layer['patch']
    if layer['parentCommit'] != application_metadata['commit'] or layer['parentArchiveSha256'] != application_metadata['sha256']:
        raise SystemExit('Layered application parent identity mismatch.')
    if {entry['path'] for entry in layer['files']} != {'src/web/codec.ts', 'src/web/codec.test.ts'}:
        raise SystemExit('Unexpected layered application change set.')
    if layered_archive.stat().st_size != layer['bytes'] or hashlib.sha256(layered_archive.read_bytes()).hexdigest() != layer['sha256'] or hashlib.sha256(patch.read_bytes()).hexdigest() != layer['patchSha256']:
        raise SystemExit('Layered application archive/patch identity mismatch.')
    with tarfile.open(layered_archive) as archive:
        for member in archive:
            parts = PurePosixPath(member.name).parts
            if PurePosixPath(member.name).is_absolute() or '..' in parts or any(part in {'.git', '.codex', '.agents', 'node_modules', 'output', 'release'} or part.startswith('.env') for part in parts):
                raise SystemExit('Private or unsafe layered application entry: ' + member.name)
    for path in [layered_archive, patch, layer_metadata, layer_metadata.parent / 'application-workingtree-web-build.json']:
        payload['application/' + path.name] = path
payload['provenance/retrieval.json'] = downloads / 'retrieval.json'
evidence_directory = Path('release/codec-source/work/evidence')
for name in ['rebuild.log', 'rebuild-status.json', 'baseline-executed-driver.sh', 'relink-executed-driver.sh', 'system-packages.txt', 'midbuild-system-packages.txt', 'native-system-packages.txt', 'dependency-python-packages.txt', 'native-python-packages.txt', 'container-os-release.txt', 'emcc-version.txt', 'attempt-summary.json', 'source-inventory.json', 'source-closure.json', 'glib-meson-log.txt', 'highway-cmake-cache.txt', 'jpeg-xl-cmake-cache.txt', 'imagemagick-config.log', 'native-cmake-cache.txt', 'artifact-identities.json', 'relink.log', 'relink-status.json', 'relink-system-packages.txt', 'relink-python-packages.txt', 'libheif-modification.json', 'libheif-relink-proof.patch']:
    path = evidence_directory / name
    if path.is_file():
        payload['evidence/' + name] = path
proof = Path('release/codec-source/adapter-proof/evidence.json')
if proof.is_file():
    payload['evidence/adapter-proof.json'] = proof
for name in ['baseline-adapter-proof', 'relink-adapter-proof', 'baseline-current-adapter-proof', 'relink-current-adapter-proof']:
    proof = Path('release/codec-source') / name / 'evidence.json'
    if proof.is_file():
        payload['evidence/' + name + '.json'] = proof
    log = proof.parent / 'run.log'
    if log.is_file():
        payload['evidence/' + name + '.log'] = log
for stage, directory in [('baseline', 'rebuilt'), ('modified-libheif', 'relinked')]:
    for name in ['magick.wasm', 'magick.js']:
        path = Path('release/codec-source/work') / directory / name
        if path.is_file():
            payload['artifacts/' + stage + '/' + name] = path
    library = Path('release/codec-source/work') / directory / 'dependencies/lib/libheif.a'
    if library.is_file():
        payload['artifacts/' + stage + '/libheif.a'] = library
for name in ['wrapper-tag.json', 'native-tag.json', 'dependencies-tag.json']:
    path = downloads / name
    if path.is_file():
        payload['provenance/' + name] = path
for name in ['lock.json', 'collect.mjs', 'archive_helpers.py', 'prepare.py', 'application.mjs', 'rebuild.sh', 'prove-adapter.mjs', 'verify.mjs', 'pack.py', 'audit.py', 'modify-heif.py', 'relink.sh', 'public-test-fixtures.json']:
    payload['tools/' + name] = tool / name
for path in sorted(Path('docs').glob('codec-source*.md')):
    payload['docs/' + path.name] = path
payload['docs/browser-codec-source-release.md'] = Path('docs/browser-codec-source-release.md')
payload['LICENSE'] = Path('LICENSE')
payload['license-inventory.json'] = (json.dumps(licenses, indent=2) + '\n').encode()
adapter_paths = ['src/web/codec.ts', 'src/web/budgets.ts', 'src/web/inspect.ts', 'src/web/sanitize.ts', 'src/shared/contracts.ts']
def archived_adapter_hashes(path):
    with tarfile.open(path) as archive:
        return {name: hashlib.sha256(archive.extractfile(name).read()).hexdigest() for name in adapter_paths}

application_hashes = archived_adapter_hashes(application)
layer_hashes = archived_adapter_hashes(layered_archive) if layer_metadata.is_file() else None
# Measured published ESM bundle identity; this is not an upstream signature.
wrapper_identity = {'name': lock['module']['package'], 'version': lock['module']['version'],
    'nativeGlueDeclaredVersion': next(source['tag'] for source in lock['sources'] if source['name'] == 'magick-native'),
    'installedEsmBundle': 'dist/index.js', 'bytes': 409450,
    'sha256': 'cf1db24f7e63f560118ef434fd581dc9ef66ad099dc417184765cd6076fb4a1b'}
def completed_proof(stage, directory, marker=None):
    status_path = evidence_directory / ('rebuild-status.json' if stage == 'baseline' else 'relink-status.json')
    module_path = Path('release/codec-source/work') / directory / 'magick.wasm'
    status = json.loads(status_path.read_text()) if status_path.is_file() else None
    if not status or status.get('exitCode') != 0 or not module_path.is_file():
        return False
    module_sha = hashlib.sha256(module_path.read_bytes()).hexdigest()
    names = [stage + '-adapter-proof']
    if layer_metadata.is_file():
        names.append(stage + '-current-adapter-proof')
    pairs = {(source, target) for source in ['png', 'jpeg', 'webp'] for target in ['png', 'jpeg', 'webp']}
    for name in names:
        path = Path('release/codec-source') / name / 'evidence.json'
        if not path.is_file():
            return False
        proof = json.loads(path.read_text())
        expected_sources = layer_hashes if '-current-' in name else application_hashes
        if proof.get('sourceFiles') != expected_sources or any(proof.get('wrapper', {}).get(key) != value for key, value in wrapper_identity.items()):
            return False
        if proof['wasm']['sha256'] != module_sha or proof['wasm']['bytes'] != module_path.stat().st_size or len(proof['cases']) != 9 or {(case['input'], case['output']) for case in proof['cases']} != pairs:
            return False
        if marker and (proof['expectedMarker'] != marker or not any(marker in (item.get('version') or '') for item in proof['supportedFormats'])):
            return False
    return True

baseline_complete = completed_proof('baseline', 'rebuilt')
modified_complete = completed_proof('relink', 'relinked', '-remage-relink-proof')
baseline_library = Path('release/codec-source/work/rebuilt/dependencies/lib/libheif.a')
modified_library = Path('release/codec-source/work/relinked/dependencies/lib/libheif.a')
modified_complete = modified_complete and baseline_library.is_file() and modified_library.is_file() and hashlib.sha256(baseline_library.read_bytes()).hexdigest() != hashlib.sha256(modified_library.read_bytes()).hexdigest()
gates = ['Dependencies build-script redistribution grant unresolved', 'artifact-specific legal review', 'published original binary source/build attestation and byte-reproduction not established', 'durable public source/binary publication with matching identities']
if not baseline_complete:
    gates.append('successful baseline source rebuild and actual-adapter proof')
if not modified_complete:
    gates.append('modified-component rebuild/relink and observable actual-adapter proof')
payload['PREPARATION-STATUS.json'] = (json.dumps({'schema': 1, 'publicDistributionAuthorized': False,
    'scope': 'Private exact-source and rebuild preparation; not a compliance certificate.',
    'openGates': gates, 'localProofs': {'baselineRebuildAndAdapter': baseline_complete, 'modifiedComponentRelinkAndAdapter': modified_complete},
    'applicationArchive': {'file': application.name, 'sha256': hashlib.sha256(application.read_bytes()).hexdigest()},
    'originalWasm': lock['module'], 'sourceArchives': len(lock['sources'])}, indent=2) + '\n').encode()
output.parent.mkdir(parents=True, exist_ok=True)
entries = []
partial = output.with_name(output.name + '.partial')
with partial.open('wb') as destination, gzip.GzipFile(fileobj=destination, mode='wb', filename='', mtime=0) as compressed, tarfile.open(fileobj=compressed, mode='w|', format=tarfile.PAX_FORMAT) as archive:
    for name, value in sorted(payload.items()):
        data = value.read_bytes() if isinstance(value, Path) else value
        info = tarfile.TarInfo('remage-codec-source/' + name)
        info.size, info.mtime, info.uid, info.gid, info.mode = len(data), 0, 0, 0, 0o644
        archive.addfile(info, io.BytesIO(data))
        entries.append({'path': info.name, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()})
partial.replace(output)
result = {'schema': 1, 'publicDistributionAuthorized': False, 'archive': str(output), 'bytes': output.stat().st_size, 'sha256': hashlib.sha256(output.read_bytes()).hexdigest(), 'files': len(payload), 'sourceArchives': len(lock['sources']), 'licenseFiles': len(licenses), 'entries': entries}
output.with_name(output.name + '.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps({key: value for key, value in result.items() if key != 'entries'}))
