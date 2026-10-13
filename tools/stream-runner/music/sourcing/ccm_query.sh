#!/bin/bash
# usage: ccm_query.sh outfile "query string"
UA="ChessColate-music-research/1.0 (license-verified CC music collection)"
curl -sS -m 60 -A "$UA" "https://ccmixter.org/api/query?f=json&$2" -o "$1"
sleep 2
