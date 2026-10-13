import json,re,html,time,urllib.request,urllib.parse,datetime,os,subprocess,sys
UA="ChessColate-music-research/1.0 (license-verified CC music collection)"
BASE='/private/tmp/claude-501/music'
RAW=BASE+'/raw/ccmixter_2026-10-12'
pool={x['upload_id']:x for x in json.load(open(BASE+'/work/pool.json'))}
ids=json.load(open(BASE+'/work/cand_ids.json'))
resf=BASE+'/work/ccm_results.json'
res=json.load(open(resf)) if os.path.exists(resf) else {}
def fetch(url,ref=None):
    h={'User-Agent':UA}
    if ref: h['Referer']=ref
    return urllib.request.urlopen(urllib.request.Request(url,headers=h),timeout=90).read()
def slug(s): return re.sub(r'[^A-Za-z0-9]+','_',s).strip('_')[:60]
for i in ids:
    if str(i) in res: continue
    x=pool[i]; r={'id':i}
    try:
        page=fetch(x['file_page_url']); time.sleep(2)
        t=page.decode('utf-8',errors='replace')
        fn=f"{BASE}/licencias/ccmixter_{i}_{slug(x['user_name'])}_{slug(x['upload_name'])}.html"
        open(fn,'wb').write(page)
        s=re.sub(r'<(script|style).*?</\1>','',t,flags=re.S); s=re.sub(r'<[^>]+>',' ',s); s=html.unescape(re.sub(r'\s+',' ',s))
        m=re.search(r'Licensed under ([^.]{5,80}?)\s*(Click here|\.)',s)
        r['page_license_text']=m.group(1) if m else None
        r['page_snippet_parents']=[s[max(0,k.start()-100):k.end()+200] for k in re.finditer(r'(Remix of|Uses samples from|Sampled from|Samples:)',s)][:2]
        r['evidence_file']=fn
        mp3=[f for f in x['files'] if f['file_format_info'].get('format-name')=='audio-mp3-mp3']
        if not mp3: r['error']='no mp3 file'; res[str(i)]=r; json.dump(res,open(resf,'w'),indent=1); continue
        f=mp3[0]; url=f['download_url']
        # encode URL safely
        u=urllib.parse.urlsplit(url); url2=urllib.parse.urlunsplit((u.scheme,u.netloc,urllib.parse.quote(u.path,safe='/%'),u.query,''))
        data=fetch(url2,x['file_page_url']); time.sleep(2)
        out=f"{RAW}/{i}_{slug(x['user_name'])}_{slug(x['upload_name'])}.mp3"
        open(out,'wb').write(data)
        r.update(download_url=url,download_date=datetime.date.today().isoformat(),file=out,bytes=len(data),sha1_api=f['file_extra'].get('sha1'))
    except Exception as e:
        r['error']=repr(e)
    res[str(i)]=r; json.dump(res,open(resf,'w'),indent=1)
    print(i,r.get('error') or 'ok',flush=True)
print('DONE')
