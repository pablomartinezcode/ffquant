"""Owner setup helper for the explicitly selected FFQuant GitHub repository.

Requires PyNaCl. Reuses Git Credential Manager without logging credentials.
The platform service token is accepted through a hidden terminal prompt only.
"""
import argparse, base64, getpass, json, os, subprocess, urllib.request, urllib.error
from pathlib import Path

REPO='pablomartinezcode/ffquant'
SITE='https://ffquant.gabagoober.chatgpt.site'
ROOT=Path(__file__).resolve().parents[1]

def main():
    p=argparse.ArgumentParser();p.add_argument('--configure',action='store_true');p.add_argument('--dispatch',action='store_true');p.add_argument('--status',action='store_true');args=p.parse_args()
    result=subprocess.run(['git','credential','fill'],input=f'protocol=https\nhost=github.com\npath={REPO}.git\n\n',text=True,capture_output=True,env={**os.environ,'GIT_TERMINAL_PROMPT':'0','GCM_INTERACTIVE':'never'})
    fields=dict(line.split('=',1) for line in result.stdout.splitlines() if '=' in line);token=fields.get('password')
    if not token:raise SystemExit('GitHub credentials unavailable. Authenticate Git Credential Manager first.')
    def api(path,method='GET',value=None):
        request=urllib.request.Request('https://api.github.com/repos/'+REPO+path,method=method,data=None if value is None else json.dumps(value).encode(),headers={'Authorization':'Bearer '+token,'Accept':'application/vnd.github+json','Content-Type':'application/json','User-Agent':'FFQuant-setup','X-GitHub-Api-Version':'2022-11-28'})
        try:
            with urllib.request.urlopen(request,timeout=30) as r:return json.load(r) if r.status!=204 else None
        except urllib.error.HTTPError as e:raise RuntimeError(f'GitHub {method} {path} failed with HTTP {e.code}.') from None
    if args.configure:
        from nacl.public import PublicKey,SealedBox
        repo=api('')
        if not repo.get('permissions',{}).get('admin'):raise SystemExit('Repository admin access is required to configure Actions.')
        service=getpass.getpass('Private Site service token (hidden): ')
        envfile=dict(line.split('=',1) for line in (ROOT/'.dev.vars').read_text().splitlines() if '=' in line and not line.startswith('#'))
        ingest=envfile['FFQUANT_INGEST_TOKEN'].strip().strip('"')
        # This checkpoint runs before persisting anything in GitHub.
        req=urllib.request.Request(SITE+'/api/ingest',headers={'Authorization':'Bearer '+ingest,'OAI-Sites-Authorization':'Bearer '+service})
        with urllib.request.urlopen(req,timeout=30) as response:
            probe=json.load(response)
            if not probe.get('ready'):raise SystemExit('Hosted ingestion is not ready.')
        public=api('/actions/secrets/public-key');box=SealedBox(PublicKey(base64.b64decode(public['key'])))
        for name,value in [('FFQUANT_INGEST_TOKEN',ingest),('FFQUANT_SITE_AUTH',service)]:
            encrypted=base64.b64encode(box.encrypt(value.encode())).decode();api('/actions/secrets/'+name,'PUT',{'encrypted_value':encrypted,'key_id':public['key_id']})
        existing={v['name'] for v in api('/actions/variables')['variables']}
        for name,value in [('FFQUANT_BASE_URL',SITE),('FFQUANT_PIPELINE_ENABLED','true')]:
            api('/actions/variables'+('/'+name if name in existing else ''),'PATCH' if name in existing else 'POST',{'name':name,'value':value})
        print('Hosted probe passed. Encrypted Actions secrets and repository variables configured.')
    if args.dispatch:
        api('/actions/workflows/refresh.yml/dispatches','POST',{'ref':'main'});print('Refresh NFL data workflow dispatched.')
    if args.status:
        runs=api('/actions/workflows/refresh.yml/runs?per_page=3')['workflow_runs']
        print(json.dumps([{'id':r['id'],'status':r['status'],'conclusion':r['conclusion'],'url':r['html_url'],'headSha':r['head_sha'],'createdAt':r['created_at']} for r in runs]))
if __name__=='__main__':main()
