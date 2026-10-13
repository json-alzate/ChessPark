import json,re,time,urllib.request,urllib.parse,datetime,shutil
UA="ChessColate-music-research/1.0 (license-verified CC music collection)"
BASE='/private/tmp/claude-501/music'; RAW=BASE+'/raw/incompetech_2026-10-12'
titles=["Late Night Radio","Study And Relax","Past Sadness","Smooth Lovin","Slow Jam","Groove Grove","Cool Vibes","Soporific","Comfortable Mystery","Thinking of You","Dream Culture","Disquiet","Smoother Move","Blue Paint","Avec Soin","Water Lily","Almost Bliss","Windswept","Summer Day","Immersed","Airship Serenity","Bossa Antigua","BossaBossa","Danse Morialta","Winter Chimes","Two Together","On the Passing of Time","Memory Lane","Feather Waltz","Sunshine (version 2)","Clear Air","Cattails","Midnight Tale","Almost New","Universal","Pepper's Theme","Crossing the Divide"]
p=json.load(open(BASE+'/work/pieces.json'))
byt={}
for x in p: byt.setdefault(x['title'],x)
res=[]
for t in titles:
    x=byt.get(t)
    if not x: print('MISSING',t); continue
    r={'title':t,'record':x}
    url='https://incompetech.com/music/royalty-free/mp3-royaltyfree/'+urllib.parse.quote(x['filename'])
    try:
        data=urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':UA}),timeout=90).read()
        out=RAW+'/'+re.sub(r'[^A-Za-z0-9]+','_',t).strip('_')+'.mp3'
        open(out,'wb').write(data)
        r.update(url=url,file=out,date=datetime.date.today().isoformat(),bytes=len(data))
        open(BASE+'/licencias/incompetech_'+re.sub(r'[^A-Za-z0-9]+','_',t).strip('_')+'.json','w').write(json.dumps({'catalog_source':'https://incompetech.com/music/royalty-free/pieces.json','record':x,'license_declared_by_site':'CC BY 4.0 https://creativecommons.org/licenses/by/4.0/ (see incompetech_faq.html, incompetech_licenses.html, incompetech_llms.txt)'},indent=1))
        print('ok',t,flush=True)
    except Exception as e:
        r['error']=repr(e); print('ERR',t,e,flush=True)
    res.append(r); time.sleep(3)
json.dump(res,open(BASE+'/work/inc_results.json','w'),indent=1)
print('DONE')
