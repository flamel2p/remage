#!/bin/bash
set -euo pipefail

# Run only inside the pinned, disposable Emscripten container with /work mounted.
mkdir -p /work/evidence /work/rebuilt
exec > >(tee /work/evidence/rebuild.log) 2>&1
started=$(date -u +%Y-%m-%dT%H:%M:%SZ)
trap 'status=$?; printf "{\"started\":\"%s\",\"finished\":\"%s\",\"exitCode\":%s}\n" "$started" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$status" > /work/evidence/rebuild-status.json' EXIT

emcc --version
uname -a
nproc
cd /work/dependencies
./.github/build/wasm-x86/install.sh
dpkg-query -W > /work/evidence/system-packages.txt
pip3 freeze > /work/evidence/dependency-python-packages.txt
./.github/build/wasm-x86/build.sh

cd /work/native/build/wasm-x86
./install.build-tools.sh
dpkg-query -W > /work/evidence/native-system-packages.txt
pip3 freeze > /work/evidence/native-python-packages.txt
cd /work/native/src/ImageMagick/ImageMagick
../../../build/shared/build.imagemagick.sh wasm x86 Q8
cd /work/native/src/Magick.Native
../../build/shared/build.native.sh wasm x86 Q8
cp Q8/magick.wasm /work/rebuilt/magick.wasm
cp Q8/magick.js /work/rebuilt/magick.js
cp -a /tmp/dependencies /work/rebuilt/dependencies
cp -a /tmp/ImageMagick /work/rebuilt/ImageMagick
sha256sum /work/rebuilt/magick.wasm /work/rebuilt/magick.js
