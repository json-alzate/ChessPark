import json,re,time,urllib.request,urllib.parse,datetime,os,html
UA="ChessColate-music-research/1.0 (contact via Claude Code; license-verified CC music collection)"
BASE='/private/tmp/claude-501/music'; RAW=BASE+'/raw/commons_2026-10-12'
os.makedirs(RAW,exist_ok=True)
pool=json.load(open(BASE+'/work/commons_pool.json'))
sel=json.load(open(BASE+'/work/commons_sel.json'))
resf=BASE+'/work/commons_results.json'
res=json.load(open(resf)) if os.path.exists(resf) else {}
def fetch(u):
    for k in range(4):
        try: return urllib.request.urlopen(urllib.request.Request(u,headers={'User-Agent':UA}),timeout=120).read()
        except urllib.error.HTTPError as e:
            if e.code==429:
                ra=int(e.headers.get('Retry-After') or 120); print('429 wait',ra,flush=True); time.sleep(min(ra+10,700)); continue
            raise
    raise RuntimeError('429 persist')
def slug(s): return re.sub(r'[^A-Za-z0-9]+','_',s).strip('_')[:70]
for title in sel:
    if title in res: continue
    x=pool[title]; r={'title':title}
    try:
        page=fetch(x['desc']); time.sleep(4)
        base=slug(title[5:])
        fn=f"{BASE}/licencias/commons_{base}.html"; open(fn,'wb').write(page)
        r['evidence_file']=fn
        meta=fetch('https://commons.wikimedia.org/w/api.php?'+urllib.parse.urlencode({'action':'query','titles':title,'prop':'imageinfo','iiprop':'extmetadata|url|sha1|size|timestamp','format':'json'})); time.sleep(4)
        open(f"{BASE}/licencias/commons_{base}.api.json",'wb').write(meta)
        durl=x['url'].split('?')[0]; data=fetch(durl); time.sleep(100)
        ext=os.path.splitext(urllib.parse.urlsplit(x['url']).path)[1]
        out=f"{RAW}/{base}{ext}"; open(out,'wb').write(data)
        r.update(download_url=durl,download_date=datetime.date.today().isoformat(),file=out,bytes=len(data))
    except Exception as e:
        r['error']=repr(e)
    res[title]=r; json.dump(res,open(resf,'w'),indent=1); print(title,r.get('error') or 'ok',flush=True)
print('DONE')
