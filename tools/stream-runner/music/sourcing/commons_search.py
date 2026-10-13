import json,sys,time,urllib.request,urllib.parse,re,html
UA="ChessColate-music-research/1.0 (contact via Claude Code)"
import os
PF='/private/tmp/claude-501/music/work/commons_pool.json'
out=json.load(open(PF)) if os.path.exists(PF) else {}
terms=sys.argv[1:]
for q in terms:
    for off in (0,):
        params={'action':'query','generator':'search','gsrsearch':q+' filetype:audio','gsrnamespace':'6','gsrlimit':'50','gsroffset':str(off),'prop':'imageinfo','iiprop':'extmetadata|url|mime|size|metadata','format':'json'}
        u='https://commons.wikimedia.org/w/api.php?'+urllib.parse.urlencode(params)
        try: d=json.load(urllib.request.urlopen(urllib.request.Request(u,headers={'User-Agent':UA}),timeout=60))
        except Exception as e: print('ERR',q,e); break
        pg=d.get('query',{}).get('pages',{})
        for p in pg.values():
            ii=p['imageinfo'][0]; m=ii['extmetadata']
            lic=m.get('LicenseShortName',{}).get('value')
            dur=None
            for md in ii.get('metadata') or []:
                if md['name']=='length': dur=md['value']
            art=re.sub(r'<[^>]+>','',html.unescape(m.get('Artist',{}).get('value','')))[:50]
            out[p['title']]=dict(title=p['title'],license=lic,licurl=m.get('LicenseUrl',{}).get('value'),artist=art,dur=dur,url=ii['url'],desc=ii['descriptionurl'],mime=ii['mime'],size=ii['size'])
        time.sleep(5)
        if len(pg)<50: break
json.dump(out,open(PF,'w'),indent=1)
print(len(out))
