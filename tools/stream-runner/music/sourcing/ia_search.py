import json,sys,urllib.request,urllib.parse
q=sys.argv[1]
u='https://archive.org/advancedsearch.php?'+urllib.parse.urlencode([('q',q),('fl[]','identifier'),('fl[]','title'),('fl[]','creator'),('fl[]','licenseurl'),('rows','100'),('output','json')])
d=json.load(urllib.request.urlopen(urllib.request.Request(u,headers={'User-Agent':'ChessColate-music-research/1.0'}),timeout=60))
if 'response' not in d: print(d); sys.exit()
print(d['response']['numFound'])
for x in d['response']['docs']: print(x.get('identifier'),'|',x.get('title'),'|',x.get('creator'),'|',x.get('licenseurl'))
