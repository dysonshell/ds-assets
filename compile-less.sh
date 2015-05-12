#/usr/bin/env bash
DIR="$( dirname "$1" )"
FILEBASE="$( basename -s .less "$1" )"
CSSFILE="$DIR/${FILEBASE}.css"
lessc $1 --source-map="${CSSFILE}.map" --source-map-url="/${CSSFILE}.map" --source-map-basepath=$(pwd) --source-map-rootpath=/ > "$DIR/${FILEBASE}.css" > $CSSFILE
REGREP='s#"file":"[^"]*undefined"#"file":"/'"$CSSFILE"'\"#g'
sed -i.bak $REGREP ${CSSFILE}.map
rm -rf ${CSSFILE}.map.bak
