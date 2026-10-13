import json,sys,collections
for f in sys.argv[1:]:
    try: d=json.load(open(f))
    except Exception as e: print(f,'ERR',e); continue
    c=collections.Counter(x['license_url'] for x in d)
    print(f,len(d),dict(c))
