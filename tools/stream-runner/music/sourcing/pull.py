import json,time,urllib.request
UA="ChessColate-music-research/1.0 (license-verified CC music collection)"
out='/private/tmp/claude-501/music/work/q2'
tags="lofi chill chillout ambient downtempo piano jazz trip_hop hip_hop relaxing mellow lounge acoustic guitar electronica".split()
for lic in ['by','pd']:
  for t in tags:
    for off in range(0,120,20):
      f=f'{out}/{lic}_{t}_{off}.json'
      url=f'https://ccmixter.org/api/query?f=json&lic={lic}&tags=instrumental,{t}&limit=20&offset={off}&sort=rank'
      try:
        r=urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':UA}),timeout=60).read()
        d=json.loads(r)
      except Exception as e:
        print('FAIL',f,e,flush=True); time.sleep(5); break
      open(f,'wb').write(r); print(lic,t,off,len(d),flush=True)
      time.sleep(2)
      if len(d)<20: break
print('DONE')
