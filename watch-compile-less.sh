#/usr/bin/env bash
SHDIR=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
DIR="$( dirname "$1" )"
FILEBASE="$( basename -s .less "$1" )"
CSSFILE="$DIR/${FILEBASE}.css"
LESSC="$SHDIR/ds-less $1"
nodemon -w $DIR --exec $LESSC -e "less css" -i $CSSFILE
