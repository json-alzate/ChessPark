import json,time,urllib.request,re,sys
UA="ChessColate-music-research/1.0 (license-verified CC music collection)"
out='/private/tmp/claude-501/music/work/q2'
fails=[l.split('q2/')[1].split(' ')[0] for l in open('/private/tmp/claude-501/music/work/pull.log') if l.startswith('FAIL')]
def get(url):
    r=urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':UA}),timeout=60).read()
    try: return json.loads(r.decode('utf-8'))
    except UnicodeDecodeError: return json.loads(r.decode('latin-1'))
for f in fails:
    lic,rest=f[:-5].split('_',1); t,off=rest.rsplit('_',1); off=int(off)
    # continue paging this tag from this offset with small pages
    o=off
    while o<100:
        url=f'https://ccmixter.org/api/query?f=json&lic={lic}&tags=instrumental,{t}&limit=5&offset={o}&sort=rank'
        try: d=get(url)
        except Exception as e:
            print('FAIL',lic,t,o,e,flush=True); o+=5; time.sleep(3); continue
        json.dump(d,open(f'{out}/r_{lic}_{t}_{o}.json','w')); print(lic,t,o,len(d),flush=True)
        time.sleep(2); o+=5
        if len(d)<5: break
print('DONE')
