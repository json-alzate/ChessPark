# usage: python3 -I probe.py <outjson> <dir> [<dir>...]   (files are only passed as args to ffprobe/ffmpeg)
import json,subprocess,sys,os,re
out=sys.argv[1]; dirs=sys.argv[2:]
res=json.load(open(out)) if os.path.exists(out) else {}
for d in dirs:
    for f in sorted(os.listdir(d)):
        p=os.path.join(d,f)
        if p in res: continue
        r={}
        try:
            o=subprocess.run(['ffprobe','-v','error','-print_format','json','-show_format','-show_streams',p],capture_output=True,text=True,timeout=60)
            j=json.loads(o.stdout or '{}')
            a=[s for s in j.get('streams',[]) if s.get('codec_type')=='audio']
            v=[s for s in j.get('streams',[]) if s.get('codec_type')=='video' and not s.get('disposition',{}).get('attached_pic')]
            if not a: r['error']='no audio stream'
            else:
                r.update(codec=a[0]['codec_name'],sr=a[0].get('sample_rate'),ch=a[0].get('channels'),dur=float(j['format'].get('duration') or a[0].get('duration') or 0),br=j['format'].get('bit_rate'),fmt=j['format'].get('format_name'),video_streams=len(v))
                e=subprocess.run(['ffmpeg','-nostats','-hide_banner','-i',p,'-af','ebur128=peak=true','-f','null','-'],capture_output=True,text=True,timeout=300)
                t=e.stderr[e.stderr.rfind('Summary:'):]
                g=lambda k:(re.search(k+r':\s+(-?[\d.]+)',t) or [None,None])[1]
                r.update(lufs=g('I'),lra=g('LRA'),tp=g('Peak'))
                # silence check
                s=subprocess.run(['ffmpeg','-nostats','-hide_banner','-i',p,'-af','silencedetect=n=-50dB:d=3','-f','null','-'],capture_output=True,text=True,timeout=300)
                r['silences']=len(re.findall('silence_start',s.stderr))
        except Exception as ex: r['error']=repr(ex)
        res[p]=r; json.dump(res,open(out,'w'),indent=1)
        print(f,r.get('error') or (round(r['dur']),r.get('lufs'),r.get('lra')),flush=True)
print('DONE')
