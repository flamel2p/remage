#!/usr/bin/env python3
"""Verify and unpack only pinned source archives into a fresh isolated build tree."""
import argparse
import hashlib
import json
import posixpath
import sys
import tarfile
from pathlib import Path, PurePosixPath
sys.dont_write_bytecode = True
from archive_helpers import license_members

parser = argparse.ArgumentParser()
parser.add_argument('--downloads', default='release/codec-source/downloads')
parser.add_argument('--work', default='release/codec-source/work')
arguments = parser.parse_args()
if not hasattr(tarfile, 'data_filter'):
    raise SystemExit('Python 3.12+ with tarfile.data_filter is required. No files were extracted.')
tool = Path(__file__).resolve().parent
lock = json.loads((tool / 'lock.json').read_text())
downloads, work = Path(arguments.downloads).resolve(), Path(arguments.work).resolve()
if work.exists():
    raise SystemExit('Build tree exists; select a fresh --work directory. No existing files were removed.')
checked = []
for source in lock['sources']:
    archive = downloads / source['file']
    digest = hashlib.sha256(archive.read_bytes()).hexdigest()
    if digest != source['sha256'] or archive.stat().st_size != source['bytes']:
        raise SystemExit('Source checksum mismatch: ' + source['name'])
    with tarfile.open(archive, 'r:gz') as tar:
        members = tar.getmembers()
        roots = {PurePosixPath(member.name).parts[0] for member in members}
        if len(roots) != 1 or not next(iter(roots)).endswith('-' + source['commit']):
            raise SystemExit('Unexpected source commit/root: ' + source['name'])
        root = next(iter(roots))
        for member in members:
            path = PurePosixPath(member.name)
            if path.is_absolute() or '..' in path.parts or member.isdev() or member.isfifo():
                raise SystemExit('Unsafe archive entry: ' + member.name)
            if member.issym() or member.islnk():
                target = posixpath.normpath(posixpath.join(posixpath.dirname(member.name), member.linkname) if member.issym() else member.linkname)
                if target != root and not target.startswith(root + '/'):
                    raise SystemExit('Unsafe archive link: ' + member.name)
        licenses = [member.name[len(root) + 1:] for member in license_members(tar, members, root)]
        if not licenses and source['name'] != 'dependencies':
            raise SystemExit('No license text in source archive: ' + source['name'])
        checked.append({'source': source, 'root': root, 'licenses': licenses, 'licenseReviewRequired': not bool(licenses)})
work.mkdir(parents=True)
for item in checked:
    source, root = item['source'], item['root']
    location = {'magick-native': work / 'native', 'dependencies': work / 'dependencies', 'imagemagick': work / 'native/src/ImageMagick/ImageMagick', 'magick-wasm': work / 'wrapper'}.get(source['name'], work / 'dependencies/Dependencies' / source['name'])
    location.mkdir(parents=True, exist_ok=True)
    with tarfile.open(downloads / source['file'], 'r:gz') as tar:
        for member in tar.getmembers():
            local = member.name[len(root):].lstrip('/')
            if not local:
                continue
            member.name = local
            if member.islnk():
                member.linkname = member.linkname[len(root):].lstrip('/')
            tar.extract(member, location, filter='data')
(work / 'source-inventory.json').write_text(json.dumps([{key: value for key, value in item.items() if key != 'root'} for item in checked], indent=2) + '\n')
print(json.dumps({'verifiedSources': len(checked), 'work': str(work), 'licenseFiles': sum(len(item['licenses']) for item in checked)}))
