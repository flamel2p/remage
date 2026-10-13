"""Inventory original licenses, including the upstream selected license paths."""
import re
from pathlib import PurePosixPath


def license_members(archive, members, root):
    selected = {member.name for member in members if member.isfile() and re.search(r'(^|/)(LICENSE|LICENCE|COPYING|NOTICE|COPYRIGHT)([._-]|$)', member.name, re.I)}
    by_name = {member.name: member for member in members}
    config = by_name.get(root + '/.ImageMagick/Config.txt')
    if config:
        text = archive.extractfile(config).read().decode('utf8', errors='replace')
        match = re.search(r'\[LICENSE_FILE\]\s*([^\[]+)', text)
        if match:
            relative = match.group(1).strip().replace('\\', '/')
            path = PurePosixPath(relative)
            name = root + '/' + relative
            if path.is_absolute() or '..' in path.parts or name not in by_name or not by_name[name].isfile():
                raise ValueError('Missing or unsafe selected license: ' + name)
            selected.add(name)
    return [by_name[name] for name in sorted(selected)]
