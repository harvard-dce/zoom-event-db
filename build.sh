#! /bin/bash

set -euo pipefail

SOURCE="$PWD/zoomEvent"
DESTINATION="$PWD/build"
rm -fr $DESTINATION
mkdir -p $DESTINATION

pushd $SOURCE
npm install
zip -r $DESTINATION/zoomEvent.zip .
popd
