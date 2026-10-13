#!/bin/bash
set -euo pipefail

# Run after the baseline was linked/validated and modify-heif.py was applied.
mkdir -p /work/evidence /work/relinked
exec > >(tee /work/evidence/relink.log) 2>&1
started=$(date -u +%Y-%m-%dT%H:%M:%SZ)
trap 'status=$?; printf "{\"started\":\"%s\",\"finished\":\"%s\",\"exitCode\":%s}\n" "$started" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$status" > /work/evidence/relink-status.json' EXIT

test -f /work/rebuilt/magick.wasm
test -f /work/evidence/libheif-modification.json
test ! -e /tmp/dependencies || { echo 'Fresh container required: /tmp/dependencies exists.'; exit 1; }
test ! -e /tmp/ImageMagick || { echo 'Fresh container required: /tmp/ImageMagick exists.'; exit 1; }
cp -a /work/rebuilt/dependencies /tmp/dependencies
cp -a /work/rebuilt/ImageMagick /tmp/ImageMagick
export CMAKE_PREFIX_PATH=/tmp/dependencies
export CPPFLAGS=-I/tmp/dependencies/include
export LDFLAGS=-L/tmp/dependencies/lib
export PKG_CONFIG_PATH=/tmp/dependencies/lib/pkgconfig
export EM_PKG_CONFIG_PATH=$PKG_CONFIG_PATH
cd /work/native/build/wasm-x86
./install.build-tools.sh
dpkg-query -W > /work/evidence/relink-system-packages.txt
pip3 freeze > /work/evidence/relink-python-packages.txt
emcc --version
nproc

# Preserve the baseline dependency configure options and refresh its generated header.
cd /work/dependencies/Dependencies/heif/__build
emcmake cmake ..
emmake make -j"$(nproc)" install
grep -- '-remage-relink-proof' /tmp/dependencies/include/libheif/heif_version.h

# Existing generated Makefiles retain the exact baseline ImageMagick options.
cd /work/native/src/ImageMagick/ImageMagick
emmake make -j"$(nproc)" install
cd /work/native/src/Magick.Native
../../build/shared/build.native.sh wasm x86 Q8
cp Q8/magick.wasm /work/relinked/magick.wasm
cp Q8/magick.js /work/relinked/magick.js
mkdir -p /work/relinked/dependencies/lib
cp /tmp/dependencies/lib/libheif.a /work/relinked/dependencies/lib/libheif.a
sha256sum /work/relinked/magick.wasm /work/relinked/magick.js
