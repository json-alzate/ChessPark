import json,os,shutil,collections
B='/private/tmp/claude-501/music'; W=B+'/work'
man=json.load(open(B+'/manifest.json')); inc=json.load(open(B+'/manifest_opcional_incompetech.json'))
disc=json.load(open(B+'/descartadas_parcial.json'))
pool=json.load(open(W+'/pool.json'))
c=collections.Counter(x['license_url'] for x in pool)
n25=sum(1 for x in pool if x['license_url'].endswith('/by/2.5/'))
group=[
 dict(track=f"{n25} pistas de ccMixter con licencia CC BY 2.5",source='ccMixter',url='https://ccmixter.org/api/query?lic=by',motivo="CC BY 2.5 no está en la lista cerrada de licencias permitidas (solo CC0, CC BY 3.0/4.0). No se descargaron."),
 dict(track=f"~{len(pool)-n25-99} pistas más del pool ccMixter (CC BY 3.0 / CC0, tag 'instrumental' + estilo chill/ambient/piano/jazz/hip_hop/etc.)",source='ccMixter',url='https://ccmixter.org/api/query',motivo="No descargadas: sobraban pistas. Se prefirieron las de tag/BPM más calmados; se omitieron por criterio previo: paquetes de samples/stems/loops/prácticas, BPM declarado >100, tags de estilo agresivo/oscuro/épico/rock/trap/DnB, duración fuera de 1,5–6 min, o simplemente excedente. Ninguna se descartó por dudas de licencia."),
 dict(track="Pistas con vocales/spoken word/rap/a cappella",source='ccMixter',url='',motivo="Excluidas desde la consulta (tags vocals, female_vocals, male_vocals, spoken_word, rap, etc.) y por revisión de la descripción. No se escucharon pistas una a una."),
 dict(track="Pistas CC BY-NC, BY-SA, ND, 'sampling', ccPlus-only",source='ccMixter',url='',motivo="Licencias prohibidas; la consulta a la API se filtró con lic=by y lic=pd (CC0), por lo que nunca se descargaron."),
 dict(track="~25 pistas más de Wikimedia Commons (Broke For Free, Sappheiros, Scott Buckley, TeknoAXE, Komiku, Kuromaru, raspberrymusic, MusicLFiles, SoundAudio, Little Glass Men, Epsilon not, JiSh, Evan Schaeffer, Axletree, Kai Engel resto)",source='Wikimedia Commons',url='https://commons.wikimedia.org/',motivo="Todas figuran con la categoría 'License review needed' (licencia no revisada por un revisor de Commons) y no pude confirmarlas en una fuente primaria del autor; además upload.wikimedia.org devolvió HTTP 429 (Retry-After 600 s) ante descargas seguidas y no insistí. Con ccMixter había material de sobra. Solo Chris Zabriskie se aceptó porque su web declara CC BY 4.0 para toda su música."),
 dict(track="Pistas CC BY-SA / CC BY 2.0 / dominio público 'piano roll' de Commons (Little Glass Men aparte)",source='Wikimedia Commons',url='',motivo="BY-SA y 2.0 fuera de la lista permitida; las transcripciones 'public domain' de piano rolls son subidas de usuarios con atribución de PD no verificable por pista."),
 dict(track="Pistas de Internet Archive (p. ej. Joel Putman, Lorenzo Gambino 'Lofi Jazz', Loyalty Freak...)",source='Internet Archive',url='https://archive.org/',motivo="La licencia (licenseurl) la pone quien sube el archivo y hay casos claramente falsos (p. ej. CC0 en discos de Twenty One Pilots); no hay forma de verificar que el uploader sea el titular. No se descargó nada."),
 dict(track="Free Music Archive",source='Free Music Archive',url='https://freemusicarchive.org/',motivo="Las URLs antiguas devuelven 404 y no pude navegar el catálogo actual sin saltar protecciones; se omitió."),
]
json.dump(disc+group,open(B+'/descartadas.json','w'),indent=1,ensure_ascii=False)
os.remove(B+'/descartadas_parcial.json')
# move unreferenced evidence
ref=set()
for e in man+inc:
    v=e['license_evidence_file']; ref.update(v if isinstance(v,list) else [v])
os.makedirs(B+'/licencias/_descartadas',exist_ok=True)
for f in os.listdir(B+'/licencias'):
    p='licencias/'+f
    if os.path.isfile(B+'/'+p) and p not in ref and not f.endswith('.api.json'):
        shutil.move(B+'/'+p,B+'/licencias/_descartadas/'+f)
# api.json companions of accepted commons
for f in os.listdir(B+'/licencias'):
    if f.endswith('.api.json'):
        base=f[:-9]+'.html'
        if 'licencias/'+base not in ref: shutil.move(B+'/licencias/'+f,B+'/licencias/_descartadas/'+f)
print(len(disc),len(group))
