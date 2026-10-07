"""Publish staged, validated snapshots. A login redirect is a failed machine-access probe."""
import argparse, concurrent.futures, json, os, sys, time, urllib.request, urllib.error
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,*args,**kwargs): return None

def main():
    p=argparse.ArgumentParser();p.add_argument('--probe',action='store_true');p.add_argument('--base-url',default=os.environ.get('FFQUANT_BASE_URL'));p.add_argument('--artifacts',action='store_true');args=p.parse_args()
    token=os.environ.get('FFQUANT_INGEST_TOKEN')
    if not token or not args.base_url: raise SystemExit('Set FFQUANT_BASE_URL and FFQUANT_INGEST_TOKEN; secrets must not be command-line arguments.')
    opener=urllib.request.build_opener(NoRedirect)
    def call(value=None):
        headers={'Authorization':'Bearer '+token,'Content-Type':'application/json'}
        if os.environ.get('FFQUANT_SITE_AUTH'):headers['OAI-Sites-Authorization']='Bearer '+os.environ['FFQUANT_SITE_AUTH']
        request=urllib.request.Request(args.base_url.rstrip('/')+'/api/ingest',data=None if value is None else json.dumps(value,separators=(',',':')).encode(),headers=headers)
        try:
            with opener.open(request,timeout=90) as response:
                if 'application/json' not in response.headers.get('Content-Type',''):raise RuntimeError('Machine access returned a login page or non-JSON response.')
                return json.load(response)
        except urllib.error.HTTPError as e:raise RuntimeError(f'Publishing failed with HTTP {e.code}; no access policy changes were attempted.') from e
    result=call();print(json.dumps(result),flush=True)
    if not result.get('ready'):raise RuntimeError('Ingestion storage is not ready.')
    if args.probe:return
    snapshot=json.loads((ROOT/'research'/'output'/'snapshot.json').read_text());ident=snapshot['manifest']['id']
    begun=call({'action':'begin','id':ident,'manifest':snapshot['manifest']})
    if begun.get('state')=='ready':print('Identical snapshot already published; no changes.');return
    for i in range(0,len(snapshot['players']),100):call({'action':'players','id':ident,'players':[json.dumps(p,separators=(',',':'),allow_nan=False) for p in snapshot['players'][i:i+100]]})
    if args.artifacts:
        files=[ROOT/'public'/'data'/key for key in snapshot['manifest']['artifacts']]
        def upload(path):
            for attempt in range(3):
                try:return call({'action':'artifact','id':ident,'key':path.relative_to(ROOT/'public'/'data').as_posix(),'content':path.read_text()})
                except Exception:
                    if attempt==2:raise
                    time.sleep(2**attempt)
        with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
            for i,_ in enumerate(pool.map(upload,files)):
                if i%250==0:print(f'Uploaded artifacts {i}/{len(files)}',flush=True)
    print(json.dumps(call({'action':'publish','id':ident})))
if __name__=='__main__':main()
