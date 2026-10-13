import json,os,re,shutil,collections,datetime,html
B='/private/tmp/claude-501/music'; W=B+'/work'
pool={x['upload_id']:x for x in json.load(open(W+'/pool.json'))}
ccm=json.load(open(W+'/ccm_results.json')); par=json.load(open(W+'/ccm_parents.json'))
pr={}
for f in ['probe_ccm','probe_commons','probe_inc']: pr.update(json.load(open(f'{W}/{f}.json')))
cpool=json.load(open(W+'/commons_pool.json')); cres=json.load(open(W+'/commons_results.json'))
DISC=B+'/descartados_audio'; os.makedirs(DISC+'/excedentes',exist_ok=True); os.makedirs(DISC+'/rechazadas',exist_ok=True)
accepted=[]; discarded=[]
def disc(**k): discarded.append(k)
def move(f,sub):
    d=f"{DISC}/{sub}/{os.path.basename(os.path.dirname(f))}"; os.makedirs(d,exist_ok=True)
    if os.path.exists(f): shutil.move(f,d+'/'+os.path.basename(f))
CCBY3='https://creativecommons.org/licenses/by/3.0/'; CC0='https://creativecommons.org/publicdomain/zero/1.0/'; CCBY4='https://creativecommons.org/licenses/by/4.0/'
cand=[]
for k,r in ccm.items():
    x=pool[int(k)]; p=pr[r['file']]
    bpm=x['upload_extra'].get('bpm'); reason=None
    try: bn=float(bpm)
    except: bn=None
    if not (90<=p['dur']<=360): reason=f"duración real {round(p['dur'])} s fuera de 90-360 s (la ficha decía {x['files'][0]['file_format_info'].get('ps')})"
    elif bn and bn>100: reason=f"BPM declarado por el autor {bpm} (>100, no es ritmo calmado)"
    elif float(p['lra'])>15: reason=f"rango dinámico muy amplio (LRA {p['lra']} LU): riesgo de cambios de volumen bruscos"
    elif k=='38234': reason="masterización extremadamente comprimida/fuerte (-6.7 LUFS, LRA 1.0), hip hop clásico: no apto como fondo suave"
    elif k=='25388': reason="'Unlimited Bass Edition': graves exagerados, no apto como fondo suave"
    name=x['upload_name']; author=x['user_real_name'] or x['user_name']
    lic_url=CC0 if 'zero' in x['license_url'] else (CCBY3 if 'by/3.0' in x['license_url'] else None)
    entry=dict(id=f"ccmixter-{k}",title=name,author=author,author_username=x['user_name'],source='ccMixter',
      page_url=x['file_page_url'],license_name='CC0 1.0 (dominio público)' if lic_url==CC0 else 'CC BY 3.0',license_url=lic_url,
      license_verified_on_page=('Creative Commons CC0 (CC Zero)' if lic_url==CC0 else 'Licensed under Creative Commons Attribution (3.0)'),
      audio_download_url=r['download_url'],download_date=r['download_date'],duration_sec=round(p['dur'],1),
      filename=os.path.relpath(r['file'],B),license_evidence_file=os.path.relpath(r['evidence_file'],B),
      codec=p['codec'],loudness_lufs=float(p['lufs']),lra=float(p['lra']),bpm_declared=bpm,tags=x['upload_extra'].get('usertags'),
      samples_from=par.get(k,[]),
      attribution=(f"\"{name}\" by {author} ({x['file_page_url']}) – licensed under {'CC0 1.0' if lic_url==CC0 else 'CC BY 3.0'} ({lic_url})"
        +(f". Contains samples from: {', '.join(par[k])}" if par.get(k) else '')))
    if reason:
        disc(track=f"{author} – {name}",source='ccMixter',url=x['file_page_url'],motivo=reason,archivo=os.path.relpath(r['file'],B)); move(r['file'],'rechazadas'); continue
    cand.append(entry)
# Commons (Zabriskie verified at artist's site)
alb={'Cylinder_One':'cylinders','A_New_Day':'neptuneflux','Your_Mothers':'neptuneflux','Oceans_Continue':'neptuneflux','To_Hide':'neptuneflux','What_Does':'dtv','49th':'uvp','Divider':'divider'}
for t,r in cres.items():
    p=pr[r['file']]; x=cpool[t]; name=re.sub(r'^File:','',t)
    if 'Kai Engel' in t:
        disc(track=name,source='Wikimedia Commons',url=x['desc'],motivo="La página de Commons declara CC BY 4.0 pero consta 'License review needed' (sin revisar) y la fuente primaria del autor no declara la licencia por pista (el autor indica que se retira de Creative Commons). Verificación insuficiente.",archivo=os.path.relpath(r['file'],B)); move(r['file'],'rechazadas'); continue
    key=[v for k2,v in alb.items() if k2 in r['file']][0]
    title=re.sub(r'^Chris Zabriskie - \d+ - ','',name).rsplit('.',1)[0]
    if float(p['lra'])>15:
        disc(track=f"Chris Zabriskie – {title}",source='Wikimedia Commons',url=x['desc'],motivo=f"rango dinámico muy amplio (LRA {p['lra']} LU): riesgo de cambios de volumen bruscos",archivo=os.path.relpath(r['file'],B)); move(r['file'],'rechazadas'); continue
    cand.append(dict(id='commons-'+re.sub(r'[^a-z0-9]+','-',title.lower()),title=title,author='Chris Zabriskie',author_username=None,source='Wikimedia Commons (licencia confirmada en la web del autor)',
      page_url=x['desc'],artist_page_url=f'https://chriszabriskie.com/{key}/',license_name='CC BY 4.0',license_url=CCBY4,
      license_verified_on_page="Commons: 'licensed under the Creative Commons Attribution 4.0 International license' (marcada como 'License review needed'); web del autor: https://chriszabriskie.com/use/ ('All of my music is free to use in creative projects under CC BY 4.0, commercial use OK') y página del álbum con enlace a by/4.0",
      audio_download_url=r['download_url'],download_date=r['download_date'],duration_sec=round(p['dur'],1),filename=os.path.relpath(r['file'],B),
      license_evidence_file=[os.path.relpath(r['evidence_file'],B),f'licencias/chriszabriskie_album_{key}.html','licencias/chriszabriskie_use-my-music.html'],
      codec=p['codec'],loudness_lufs=float(p['lufs']),lra=float(p['lra']),bpm_declared=None,tags=None,samples_from=[],
      attribution=f"\"{title}\" by Chris Zabriskie (https://chriszabriskie.com/{key}/) – licensed under CC BY 4.0 ({CCBY4})"))
# cap per author
by=collections.defaultdict(list)
for e in cand: by[e['author']].append(e)
final=[]
for a,l in by.items():
    l.sort(key=lambda e:e['loudness_lufs'])  # quietest first kept
    for e in l[:6]: final.append(e)
    for e in l[6:]:
        disc(track=f"{e['author']} – {e['title']}",source=e['source'],url=e['page_url'],motivo="Licencia verificada y audio válido, pero excedente por autor (máx. 6 pistas por autor para repartir el riesgo de Content ID). Se descartó la más fuerte/comprimida. Disponible en descartados_audio/excedentes/ si hiciera falta.",archivo=e['filename'])
        f=B+'/'+e['filename']; move(f,'excedentes')
final.sort(key=lambda e:(e['author'].lower(),e['title'].lower()))
json.dump(final,open(B+'/manifest.json','w'),indent=1,ensure_ascii=False)
# Incompetech optional
inc=[]
ir=json.load(open(W+'/inc_results.json'))
for r in ir:
    if r.get('error'): continue
    x=r['record']; p=pr[r['file']]
    inc.append(dict(id='incompetech-'+x['isrc'],title=x['title'],author='Kevin MacLeod',source='Incompetech',page_url='https://incompetech.com/music/royalty-free/music.html',catalog_record_url='https://incompetech.com/music/royalty-free/pieces.json',isrc=x['isrc'],
      license_name='CC BY 4.0',license_url=CCBY4,license_verified_on_page="FAQ: 'YouTube videos... Yes, AND you can monetize' + 'streaming sites? Yes' ; licencia CC BY 4.0 declarada en llms.txt/FAQ/Licenses del sitio (no hay página HTML por pista, el catálogo es JS)",
      audio_download_url=r['url'],download_date=r['date'],duration_sec=round(p['dur'],1),filename=os.path.relpath(r['file'],B),
      license_evidence_file=['licencias/incompetech_faq.html','licencias/incompetech_licenses.html','licencias/incompetech_llms.txt','licencias/incompetech_youtube-contentid.html','licencias/incompetech_'+re.sub(r'[^A-Za-z0-9]+','_',x['title']).strip('_')+'.json'],
      loudness_lufs=float(p['lufs']),lra=float(p['lra']),bpm_declared=x['bpm'],tags=x['feel'],
      attribution=f"\"{x['title']}\" Kevin MacLeod (incompetech.com)\nLicensed under Creative Commons: By Attribution 4.0 License\nhttps://creativecommons.org/licenses/by/4.0/"))
json.dump(inc,open(B+'/manifest_opcional_incompetech.json','w'),indent=1,ensure_ascii=False)
json.dump(discarded,open(B+'/descartadas_parcial.json','w'),indent=1,ensure_ascii=False)
tot=sum(e['duration_sec'] for e in final)
print(len(final),'tracks',round(tot/60,1),'min',len({e['author'] for e in final}),'authors')
print(collections.Counter(e['license_name'] for e in final)); print(collections.Counter(e['source'] for e in final))
print('incompetech',len(inc),round(sum(e['duration_sec'] for e in inc)/60,1))
print(len(discarded),'discarded so far')
