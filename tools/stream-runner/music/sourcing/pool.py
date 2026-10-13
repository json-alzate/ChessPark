import json,glob,collections
pool={}
for f in glob.glob('/private/tmp/claude-501/music/work/q2/*.json'):
    try: d=json.load(open(f))
    except: continue
    for x in d: pool[x['upload_id']]=x
print(len(pool))
c=collections.Counter(x['license_url'] for x in pool.values()); print(c)
json.dump(list(pool.values()),open('/private/tmp/claude-501/music/work/pool.json','w'))
