#!/bin/bash
cd /private/tmp/claude-501/music/work/q
UA="ChessColate-music-research/1.0 (license-verified CC music collection)"
for lic in by pd; do
 for t in lofi chill chillout ambient downtempo piano jazz trip_hop hip_hop relaxing mellow lounge acoustic guitar electronica; do
  for off in 0 100 200; do
   f="${lic}_${t}_${off}.json"
   curl -sS -m 60 -A "$UA" "https://ccmixter.org/api/query?f=json&lic=$lic&tags=instrumental,$t&limit=100&offset=$off&sort=rank" -o "$f" || echo FAIL $f
   n=$(python3 -I -c "import json,sys; print(len(json.load(open(sys.argv[1]))))" "$f" 2>/dev/null || echo 0)
   sleep 2
   [ "$n" -lt 100 ] && break
  done
 done
done
echo DONE
