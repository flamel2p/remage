"""Verify a frozen private packet and report credential-pattern paths, never values."""
import argparse
import hashlib
import io
import json
import re
import tarfile
from pathlib import Path, PurePosixPath

parser = argparse.ArgumentParser()
parser.add_argument('packet', nargs='?', default='release/codec-source/remage-magick-wasm-0.0.44-source-preparation.tar.gz')
arguments = parser.parse_args()
packet = Path(arguments.packet)
metadata = json.loads(packet.with_name(packet.name + '.json').read_text())
if packet.stat().st_size != metadata['bytes'] or hashlib.sha256(packet.read_bytes()).hexdigest() != metadata['sha256']:
    raise SystemExit('Packet checksum/length mismatch.')
expected = {entry['path']: entry for entry in metadata['entries']}
pattern = re.compile(rb'\b(?:gh[pousr]_[A-Za-z0-9]{30,}|AKIA[A-Z0-9]{16}|sk-(?:proj-)?[A-Za-z0-9_-]{32,})\b|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----')
credential_paths = []
application_files = 0
source_archives = 0
reviewed_fixtures = []
with tarfile.open(packet, 'r:gz') as archive:
    fixture_record = json.loads(archive.extractfile('remage-codec-source/tools/public-test-fixtures.json').read())
    known_fixtures = {item['source'] + '-' + item['commit'] + '/' + item['path']: item for item in fixture_record['fixtures']}
    actual = archive.getmembers()
    if len(actual) != len(expected) or len({member.name for member in actual}) != len(actual):
        raise SystemExit('Unexpected or duplicate packet entries.')
    for member in actual:
        parts = PurePosixPath(member.name).parts
        if member.name not in expected or not member.isfile() or PurePosixPath(member.name).is_absolute() or '..' in parts:
            raise SystemExit('Unsafe/unexpected packet entry: ' + member.name)
        data = archive.extractfile(member).read()
        identity = expected[member.name]
        if len(data) != identity['bytes'] or hashlib.sha256(data).hexdigest() != identity['sha256']:
            raise SystemExit('Packet entry mismatch: ' + member.name)
        if '/sources/' in member.name:
            source_archives += 1
            # Public official source bytes are independently sealed; scan their files too.
            with tarfile.open(fileobj=io.BytesIO(data), mode='r:gz') as source:
                for file in source:
                    if file.isfile():
                        content = source.extractfile(file).read()
                        if pattern.search(content):
                            fixture = known_fixtures.get(file.name)
                            if fixture and len(content) == fixture['bytes'] and hashlib.sha256(content).hexdigest() == fixture['sha256']:
                                reviewed_fixtures.append(file.name)
                            else:
                                credential_paths.append(member.name + '::' + file.name)
        elif member.name.endswith('.tar') and '/application/' in member.name:
            with tarfile.open(fileobj=io.BytesIO(data), mode='r:') as application:
                for file in application:
                    parts = PurePosixPath(file.name).parts
                    if any(part in {'.git', '.codex', '.agents', 'node_modules', 'output', 'release'} or part.startswith('.env') for part in parts):
                        raise SystemExit('Private application path: ' + file.name)
                    if file.isfile():
                        application_files += 1
                        if pattern.search(application.extractfile(file).read()):
                            credential_paths.append(member.name + '::' + file.name)
        elif pattern.search(data):
            credential_paths.append(member.name)
result = {'schema': 1, 'packetSha256': metadata['sha256'], 'verifiedFiles': len(actual), 'sourceArchives': source_archives,
          'applicationFiles': application_files, 'credentialPatternPaths': credential_paths,
          'reviewedPublicTestFixturePaths': reviewed_fixtures,
          'limits': 'High-confidence token/private-key patterns only; not an exhaustive secret detector or a license audit.'}
print(json.dumps(result))
if credential_paths:
    raise SystemExit(2)
