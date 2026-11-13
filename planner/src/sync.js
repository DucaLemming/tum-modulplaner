/* ===== Geräte-Sync über GitHub (v86) =====
   Quelle: planner/src/sync.js, eingebettet mit scripts/embed.py (nicht im HTML bearbeiten).
   Der Plan liegt wie bisher im localStorage (Schlüssel tum_*). Zusätzlich wird er als eine Datei
   (Standard: plan.json im privaten Repo tum-modulplaner-data) über die GitHub Contents API geteilt.
   - Token: fine-grained PAT, nur dieses Repo, "Contents: Read and write". Liegt nur im Browser
     (localStorage "tum-sync"), nie in plan.json.
   - Schreiben: 1,5 s nach der letzten Änderung (PUT mit dem aktuellen sha).
   - Lesen: beim Laden, wenn der Tab wieder sichtbar wird, und alle 60 s.
   - Konflikt: der ganze Stand mit dem neueren updatedAt gewinnt. Wird das Schreiben abgelehnt
     (sha geändert), wird einmal neu gelesen und dieselbe Regel angewendet.
   - Ein Stand von einem anderen Gerät wird in den localStorage geschrieben und die Seite neu geladen. */
(function(){
  'use strict';
  const CFG_K='tum-sync', META_K='tum-sync-meta', NOTE_K='tum-sync-note';
  const DEF={repo:'DucaLemming/tum-modulplaner-data',branch:'main',path:'plan.json'};
  /* nur für dieses Gerät (Ansicht), nicht synchronisiert */
  const LOCAL=new Set(['tum_wksem','tum_wkmax','tum_exsem','tum_wkf','tum_recnotes']);
  const isSynced=k=>typeof k==='string'&&k.startsWith('tum_')&&!LOCAL.has(k);
  const API='https://api.github.com';
  const LS=window.localStorage, SP=Storage.prototype;
  const _set=SP.setItem, _rem=SP.removeItem;
  const rawSet=(k,v)=>{try{_set.call(LS,k,v);}catch(e){}};
  const rawRem=k=>{try{_rem.call(LS,k);}catch(e){}};
  const jget=(k,d)=>{try{const s=LS.getItem(k);return s?JSON.parse(s):d;}catch(e){return d;}};
  const esc2=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  let cfg=jget(CFG_K,null);                 /* {repo,branch,path,token} oder null */
  let meta=jget(META_K,{});                 /* {updatedAt,baseAt,sha,dirty,lastOk} */
  let ready=false, busy=false, again=false, pushT=null, status='off', errTxt='', choice=null;
  const saveMeta=()=>rawSet(META_K,JSON.stringify(meta));
  const saveCfg=()=>{if(cfg)rawSet(CFG_K,JSON.stringify(cfg));else rawRem(CFG_K);};
  const on=()=>!!(cfg&&cfg.token&&cfg.repo);

  /* ---------- lokaler Stand ---------- */
  function snapshot(){const o={};for(let i=0;i<LS.length;i++){const k=LS.key(i);if(isSynced(k))o[k]=LS.getItem(k);}
    const s={};Object.keys(o).sort().forEach(k=>s[k]=o[k]);return s;}
  /* ein leerer Planer schreibt beim Laden schon Standardwerte; ein Plan ist es erst mit Modulen oder eigenen Terminen */
  function hasPlan(o){const n=k=>{try{const v=JSON.parse(o[k]||'null');return v?(Array.isArray(v)?v.length:Object.keys(v).length):0;}catch(e){return 0;}};
    return n('tum_plan')>0||n('tum_blocks')>0||n('tum_extra')>0;}
  const sameKeys=(a,b)=>{const ka=Object.keys(a),kb=Object.keys(b);return ka.length===kb.length&&ka.every(k=>a[k]===b[k]);};
  function localChanged(){
    meta.updatedAt=new Date().toISOString();meta.dirty=true;saveMeta();
    if(on()){setStatus('pending');clearTimeout(pushT);pushT=setTimeout(()=>sync('push'),1500);}
  }
  /* jede Änderung an tum_* abfangen (alle save…-Funktionen des Planers schreiben direkt in den localStorage) */
  SP.setItem=function(k,v){
    if(this===LS&&isSynced(k)){const old=LS.getItem(k);_set.call(this,k,v);if(ready&&old!==String(v))localChanged();return;}
    return _set.call(this,k,v);};
  SP.removeItem=function(k){
    if(this===LS&&isSynced(k)){const had=LS.getItem(k)!==null;_rem.call(this,k);if(ready&&had)localChanged();return;}
    return _rem.call(this,k);};

  /* ---------- GitHub ---------- */
  const b64e=s=>{const b=new TextEncoder().encode(s);let t='';for(let i=0;i<b.length;i+=0x8000)t+=String.fromCharCode.apply(null,b.subarray(i,i+0x8000));return btoa(t);};
  const b64d=s=>{const t=atob(String(s).replace(/\s+/g,''));const b=new Uint8Array(t.length);for(let i=0;i<t.length;i++)b[i]=t.charCodeAt(i);return new TextDecoder().decode(b);};
  const encPath=p=>String(p).split('/').map(encodeURIComponent).join('/');
  async function gh(method,url,body){
    const r=await fetch(API+url,{method,cache:'no-store',headers:Object.assign({'Accept':'application/vnd.github+json','Authorization':'Bearer '+cfg.token,'X-GitHub-Api-Version':'2022-11-28'},body?{'Content-Type':'application/json'}:{}),body:body?JSON.stringify(body):undefined});
    let j=null;try{j=await r.json();}catch(e){}
    return {st:r.status,ok:r.ok,j};
  }
  function httpErr(r,what){
    const m=r.j&&r.j.message?': '+r.j.message:'';
    if(r.st===401)return 'Token ungültig oder abgelaufen (401)';
    if(r.st===403)return 'Zugriff verweigert (403). Hat das Token "Contents: Read and write" für '+cfg.repo+'?'+m;
    if(r.st===404)return what+' nicht gefunden (404). Repo-Name richtig, Token für dieses Repo freigegeben?';
    return what+' fehlgeschlagen ('+r.st+')'+m;
  }
  /* liest plan.json: {none:true} wenn Datei oder Branch fehlen */
  async function readRemote(){
    const r=await gh('GET','/repos/'+cfg.repo+'/contents/'+encPath(cfg.path)+'?ref='+encodeURIComponent(cfg.branch)+'&t='+Date.now());
    if(r.st===404){
      const rp=await gh('GET','/repos/'+cfg.repo);
      if(!rp.ok)throw new Error(httpErr(rp,'Repo '+cfg.repo));
      return {none:true,defBranch:rp.j.default_branch};
    }
    if(!r.ok)throw new Error(httpErr(r,'Lesen'));
    let d;try{d=JSON.parse(b64d(r.j.content));}catch(e){throw new Error(cfg.path+' ist kein gültiges JSON');}
    if(!d||typeof d.keys!=='object'||!d.updatedAt)throw new Error(cfg.path+' hat nicht das erwartete Format');
    return {sha:r.j.sha,updatedAt:d.updatedAt,keys:d.keys,device:d.device||''};
  }
  async function ensureBranch(defBranch){
    const b=await gh('GET','/repos/'+cfg.repo+'/branches/'+encodeURIComponent(cfg.branch));
    if(b.ok)return;
    if(b.st!==404)throw new Error(httpErr(b,'Branch '+cfg.branch));
    const h=await gh('GET','/repos/'+cfg.repo+'/git/ref/heads/'+encodeURIComponent(defBranch));
    if(!h.ok)throw new Error(httpErr(h,'Branch '+defBranch));
    const c=await gh('POST','/repos/'+cfg.repo+'/git/refs',{ref:'refs/heads/'+cfg.branch,sha:h.j.object.sha});
    if(!c.ok&&c.st!==422)throw new Error(httpErr(c,'Branch '+cfg.branch+' anlegen'));
  }
  function devName(){const u=navigator.userAgent;return (/Android/.test(u)?'Android':/iPhone|iPad/.test(u)?'iOS':/Windows/.test(u)?'Windows':/Mac/.test(u)?'Mac':/Linux/.test(u)?'Linux':'Browser');}
  /* schreibt den lokalen Stand; gibt 'conflict' zurück, wenn sich der sha geändert hat */
  async function writeRemote(sha){
    if(!meta.updatedAt)meta.updatedAt=new Date().toISOString();
    const at=meta.updatedAt, keys=snapshot();
    const doc={v:1,app:'tum-modulplaner',updatedAt:at,device:devName(),keys};
    const body={message:'Plan-Sync '+at.slice(0,16).replace('T',' ')+' ('+doc.device+')',content:b64e(JSON.stringify(doc,null,1)+'\n'),branch:cfg.branch};
    if(sha)body.sha=sha;
    const r=await gh('PUT','/repos/'+cfg.repo+'/contents/'+encPath(cfg.path),body);
    if(r.st===409||(r.st===422&&/sha/i.test((r.j&&r.j.message)||'')))return 'conflict';
    if(!r.ok)throw new Error(httpErr(r,'Speichern'));
    meta.sha=r.j.content.sha;meta.baseAt=at;
    /* während des Schreibens geändert? dann bleibt dirty und es wird noch einmal geschrieben */
    if(meta.updatedAt===at)meta.dirty=false;else again=true;
    meta.lastOk=Date.now();saveMeta();return 'ok';
  }
  function typing(){const a=document.activeElement;return !!(a&&/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)&&!a.closest('#syDlg'));}
  function applyRemote(R){
    const cur=snapshot();
    meta={updatedAt:R.updatedAt,baseAt:R.updatedAt,sha:R.sha,dirty:false,lastOk:Date.now()};
    if(sameKeys(cur,R.keys)){saveMeta();return false;}
    Object.keys(cur).forEach(k=>{if(!(k in R.keys))rawRem(k);});
    Object.keys(R.keys).forEach(k=>{if(isSynced(k))rawSet(k,String(R.keys[k]));});
    saveMeta();
    try{sessionStorage.setItem(NOTE_K,'Plan von '+(R.device||'anderem Gerät')+' geladen (Stand '+fmtAt(R.updatedAt)+')');}catch(e){}
    ready=false;location.reload();return true;
  }
  const fmtAt=s=>{const d=new Date(s);return isNaN(d)?String(s):d.toLocaleString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});};

  /* ---------- Ablauf ---------- */
  async function sync(why){
    if(!on())return;
    if(busy){again=true;return;}
    busy=true;again=false;clearTimeout(pushT);setStatus('busy');
    try{await syncOnce(false);if(status==='busy')setStatus(meta.dirty?'pending':'ok');}
    catch(e){errTxt=String(e&&e.message||e);if(/Failed to fetch|NetworkError|Load failed/i.test(errTxt))errTxt='Keine Verbindung zu GitHub';setStatus('err');}
    busy=false;
    if(again&&on()&&status!=='err'&&status!=='choose'){again=false;sync('again');}
  }
  async function syncOnce(retried){
    const R=await readRemote();
    const loc=snapshot(), hasLocal=hasPlan(loc);
    if(R.none){
      if(!hasLocal)return;                               /* nichts zu teilen */
      await ensureBranch(R.defBranch);
      const w=await writeRemote(null);
      if(w==='conflict'&&!retried)return syncOnce(true);
      if(w==='conflict')throw new Error('Speichern abgelehnt (Datei wurde gleichzeitig geändert)');
      return;
    }
    const push=async()=>{const w=await writeRemote(R.sha);
      if(w==='conflict'){if(retried)throw new Error('Speichern abgelehnt (Datei wurde gleichzeitig geändert)');return syncOnce(true);}};
    if(sameKeys(loc,R.keys)){meta.sha=R.sha;meta.baseAt=R.updatedAt;meta.updatedAt=R.updatedAt;meta.dirty=false;meta.lastOk=Date.now();saveMeta();return;}
    if(!meta.baseAt){                                    /* erstes Verbinden dieses Geräts */
      if(!hasLocal){applyRemote(R);return;}
      choice=R;setStatus('choose');openDlg();return;     /* beide Seiten haben einen Plan: fragen */
    }
    if(R.updatedAt===meta.baseAt){if(meta.dirty)await push();else{meta.sha=R.sha;meta.lastOk=Date.now();saveMeta();}return;}
    /* anderes Gerät hat gespeichert */
    if(meta.dirty&&meta.updatedAt&&meta.updatedAt>R.updatedAt){await push();return;}
    if(typing()){again=false;setTimeout(()=>sync('typing'),4000);return;}
    applyRemote(R);
  }
  async function choose(which){
    const R=choice;choice=null;if(!R)return;
    if(which==='remote'){applyRemote(R);setStatus('ok');renderDlg();return;}
    busy=true;setStatus('busy');
    try{meta.updatedAt=new Date().toISOString();meta.dirty=true;saveMeta();
      const w=await writeRemote(R.sha);if(w==='conflict')throw new Error('Speichern abgelehnt, bitte noch einmal synchronisieren');
      setStatus('ok');}
    catch(e){errTxt=String(e&&e.message||e);setStatus('err');}
    busy=false;renderDlg();
  }

  /* ---------- Verbinden per Link: …#/connect/<owner%2Frepo>/<token>[/<branch>/<pfad>] ---------- */
  function connectLink(){
    let h='#/connect/'+encodeURIComponent(cfg.repo)+'/'+encodeURIComponent(cfg.token);
    if(cfg.branch!==DEF.branch||cfg.path!==DEF.path)h+='/'+encodeURIComponent(cfg.branch)+'/'+encodeURIComponent(cfg.path);
    return location.href.split('#')[0]+h;
  }
  function takeHash(){
    const m=/^#\/connect\/([^/]+)\/([^/]+)(?:\/([^/]+)\/([^/]+))?$/.exec(location.hash||'');
    if(!m)return false;
    try{cfg={repo:decodeURIComponent(m[1]),token:decodeURIComponent(m[2]),branch:m[3]?decodeURIComponent(m[3]):DEF.branch,path:m[4]?decodeURIComponent(m[4]):DEF.path};}catch(e){return false;}
    saveCfg();meta.baseAt=null;meta.sha=null;saveMeta();
    try{history.replaceState(null,'',location.pathname+location.search);}catch(e){location.hash='';}
    return true;
  }

  /* ---------- Oberfläche ---------- */
  const ST={off:['☁ Sync','Geräte-Sync ist aus. Klicken zum Einrichten.'],ok:['☁ ✓','Plan ist mit GitHub synchron.'],busy:['☁ ⟳','Synchronisiere …'],
    pending:['☁ …','Änderungen werden gleich gespeichert.'],err:['☁ ⚠','Sync-Fehler'],choose:['☁ ?','Zwei verschiedene Pläne gefunden: bitte wählen.']};
  let btn=null;
  function setStatus(s){status=s;if(!btn)return;const t=ST[s]||ST.off;btn.textContent=t[0];
    btn.title=s==='err'?'Sync-Fehler: '+errTxt:t[1]+(s==='ok'&&meta.lastOk?' Zuletzt geprüft: '+new Date(meta.lastOk).toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'})+'.':'');
    btn.classList.toggle('sywarn',s==='err'||s==='choose');
    if(document.getElementById('syDlg'))renderDlg();}
  function css(){const s=document.createElement('style');s.textContent=`
#syncBtn.sywarn{background:#9b2c2c;border-color:#c53030}
#syDlg{position:fixed;inset:0;background:rgba(20,30,40,.45);z-index:210;display:flex;align-items:center;justify-content:center;padding:16px}
#syDlg .sybox{position:relative;background:#fff;border-radius:12px;max-width:560px;width:100%;max-height:90vh;overflow:auto;padding:18px 22px;box-shadow:0 20px 60px rgba(0,0,0,.35);font-size:13px;color:var(--ink)}
#syDlg h3{margin:0 0 6px;font-size:16px}#syDlg p{margin:7px 0}#syDlg .sysm{font-size:12px;color:var(--muted)}
#syDlg label{display:block;margin:7px 0 2px;font-size:12px;font-weight:600}
#syDlg input{width:100%;box-sizing:border-box;padding:6px 8px;border:1px solid var(--line);border-radius:6px;font:inherit}
#syDlg .syrow{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;align-items:center}
#syDlg .sybtn{background:#2c3e4d;color:#fff;border:1px solid #43586a;border-radius:7px;padding:7px 12px;font-size:13px;cursor:pointer}
#syDlg .sybtn.sec{background:#fff;color:var(--ink);border-color:var(--line)}#syDlg .sybtn.red{background:#fff;color:#9b2c2c;border-color:#e3b3b3}
#syDlg .syx{position:absolute;top:8px;right:12px;border:0;background:none;font-size:22px;cursor:pointer;color:var(--muted)}
#syDlg .syerr{background:#fde8e8;border:1px solid #f1b5b5;color:#7f1d1d;border-radius:7px;padding:6px 9px;margin:8px 0}
#syDlg .syok{background:#e8f6ec;border:1px solid #b5dcc0;color:#1f6b3a;border-radius:7px;padding:6px 9px;margin:8px 0}
#syDlg .sywarnb{background:#fef3c7;border:1px solid #f59e0b;color:#7c2d12;border-radius:7px;padding:6px 9px;margin:8px 0}
#syDlg .syqr{display:flex;gap:14px;align-items:flex-start;margin-top:10px;flex-wrap:wrap}#syDlg .syqr svg{width:190px;height:190px;border:1px solid var(--line);border-radius:6px;background:#fff}
#syDlg .sylink{word-break:break-all;font-family:ui-monospace,Consolas,monospace;font-size:11px;background:#f6f8fa;border-radius:6px;padding:6px;flex:1 1 220px}
#syDlg ol{margin:6px 0;padding-left:20px}#syDlg li{margin:2px 0}
#syToast{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);background:#1f6b3a;color:#fff;padding:8px 14px;border-radius:8px;font-size:13px;z-index:220;box-shadow:0 6px 20px rgba(0,0,0,.3)}`;
    document.head.appendChild(s);}
  function toast(t){const d=document.createElement('div');d.id='syToast';d.textContent='☁ '+t;document.body.appendChild(d);setTimeout(()=>d.remove(),6000);}
  let showLink=false;
  function openDlg(){if(!document.getElementById('syDlg')){const d=document.createElement('div');d.id='syDlg';document.body.appendChild(d);
      d.addEventListener('mousedown',e=>{if(e.target===d)closeDlg();});}
    renderDlg();}
  function closeDlg(){const d=document.getElementById('syDlg');if(d)d.remove();showLink=false;}
  function qrSvg(text){
    if(typeof qrcode!=='function')return '';
    try{const q=qrcode(0,'M');q.addData(text);q.make();const n=q.getModuleCount(),m=4;let p='';
      for(let r=0;r<n;r++)for(let c=0;c<n;c++)if(q.isDark(r,c))p+='M'+(c+m)+' '+(r+m)+'h1v1h-1z';
      return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+(n+2*m)+' '+(n+2*m)+'" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="'+p+'" fill="#000"/></svg>';
    }catch(e){return '';}
  }
  function renderDlg(){
    const d=document.getElementById('syDlg');if(!d)return;
    const keep={};d.querySelectorAll('input').forEach(i=>keep[i.id]=i.value);
    let h='<div class="sybox"><button class="syx" id="syX" title="Schließen">×</button><h3>☁ Geräte-Sync</h3>';
    if(status==='choose'&&choice){
      const n=Object.keys(jget('tum_plan',{})).length;let rn=0;try{rn=Object.keys(JSON.parse(choice.keys.tum_plan||'{}')).length;}catch(e){}
      h+=`<div class="sywarnb"><b>Auf diesem Gerät und auf GitHub liegen verschiedene Pläne.</b> Welcher soll gelten? Der andere wird überschrieben.</div>
      <table style="border-collapse:collapse;width:100%;font-size:12.5px"><tr><th style="text-align:left;padding:3px 6px"></th><th style="text-align:left;padding:3px 6px">Dieses Gerät</th><th style="text-align:left;padding:3px 6px">GitHub</th></tr>
      <tr><td style="padding:3px 6px">Module im Plan</td><td style="padding:3px 6px">${n}</td><td style="padding:3px 6px">${rn}</td></tr>
      <tr><td style="padding:3px 6px">Stand</td><td style="padding:3px 6px">${meta.updatedAt?esc2(fmtAt(meta.updatedAt)):'unbekannt'}</td><td style="padding:3px 6px">${esc2(fmtAt(choice.updatedAt))}${choice.device?' ('+esc2(choice.device)+')':''}</td></tr></table>
      <div class="syrow"><button class="sybtn" id="syUseR">Plan von GitHub laden</button><button class="sybtn sec" id="syUseL">Plan dieses Geräts hochladen</button></div>
      <p class="sysm">Tipp: vorher links „⤓ Plan als Textdatei“ sichern, wenn du unsicher bist.</p>`;
    }else if(!on()){
      h+=`<p>Hält deinen Plan auf allen Geräten gleich. Der Plan wird als Datei <code>${esc2(DEF.path)}</code> im privaten GitHub-Repo <code>${esc2(DEF.repo)}</code> gespeichert.</p>
      <p class="sysm"><b>Einmalig Token anlegen:</b></p><ol class="sysm"><li>GitHub → Settings → Developer settings → Personal access tokens → <b>Fine-grained tokens</b> → Generate new token</li>
      <li>Repository access: <b>Only select repositories</b> → nur das Daten-Repo (<code>tum-modulplaner-data</code>)</li><li>Permissions → Repository permissions → <b>Contents: Read and write</b></li><li>Token kopieren und hier einfügen</li></ol>
      <label for="syRepo">Repo (owner/name)</label><input id="syRepo" value="${esc2(DEF.repo)}" autocomplete="off" spellcheck="false">
      <label for="syTok">Token</label><input id="syTok" type="password" placeholder="github_pat_…" autocomplete="off" spellcheck="false">
      <details style="margin-top:8px"><summary class="sysm" style="cursor:pointer">Branch und Dateiname ändern</summary>
      <label for="syBr">Branch</label><input id="syBr" value="${esc2(DEF.branch)}" autocomplete="off" spellcheck="false">
      <label for="syPath">Datei</label><input id="syPath" value="${esc2(DEF.path)}" autocomplete="off" spellcheck="false"></details>
      ${status==='err'?'<div class="syerr">'+esc2(errTxt)+'</div>':''}
      <div class="syrow"><button class="sybtn" id="syConn">Verbinden</button></div>
      <p class="sysm">Das Token bleibt nur in diesem Browser und wird nie in die Plandatei geschrieben.</p>`;
    }else{
      const web=/^https?:$/.test(location.protocol);
      h+=`<p>Verbunden mit <b>${esc2(cfg.repo)}</b>, Datei <code>${esc2(cfg.path)}</code> auf Branch <code>${esc2(cfg.branch)}</code>.</p>`;
      if(status==='err')h+='<div class="syerr">'+esc2(errTxt)+'</div>';
      else if(status==='busy')h+='<div class="syok">Synchronisiere …</div>';
      else if(status==='pending')h+='<div class="syok">Änderungen werden gleich gespeichert …</div>';
      else h+='<div class="syok">✓ Synchron'+(meta.baseAt?'. Stand des Plans: '+esc2(fmtAt(meta.baseAt)):'')+(meta.lastOk?'. Zuletzt geprüft: '+esc2(new Date(meta.lastOk).toLocaleTimeString('de-DE')):'')+'</div>';
      h+=`<p class="sysm">Gespeichert wird 1,5 s nach jeder Änderung. Gelesen wird beim Öffnen, beim Zurückkehren in den Tab und alle 60 s. Bei gleichzeitigen Änderungen gewinnt der neuere Stand als Ganzes.</p>
      <div class="syrow"><button class="sybtn" id="syNow">Jetzt synchronisieren</button><button class="sybtn sec" id="syAdd">Weiteres Gerät verbinden</button><button class="sybtn red" id="syOff">Trennen</button></div>`;
      if(showLink){
        if(web){const L=connectLink();h+=`<div class="sywarnb">Dieser Link enthält dein Token. Nur auf eigenen Geräten öffnen, nicht weitergeben.</div><div class="syqr">${qrSvg(L)}<div class="sylink" id="syL">${esc2(L)}</div></div><div class="syrow"><button class="sybtn sec" id="syCopy">Link kopieren</button><span class="sysm" id="syCopyMsg"></span></div>`;}
        else h+=`<div class="sywarnb">Der Verbindungslink mit QR-Code funktioniert nur, wenn der Planer über eine Webadresse geöffnet ist (z. B. GitHub Pages). Diese Datei ist lokal geöffnet: auf dem anderen Gerät den Planer öffnen, „☁ Sync“ wählen und dasselbe Repo und Token eintragen.</div>`;
      }
    }
    h+='</div>';d.innerHTML=h;
    Object.keys(keep).forEach(id=>{const i=document.getElementById(id);if(i&&keep[id])i.value=keep[id];});
    const $=id=>document.getElementById(id);
    $('syX').onclick=closeDlg;
    if($('syUseR'))$('syUseR').onclick=()=>choose('remote');
    if($('syUseL'))$('syUseL').onclick=()=>choose('local');
    if($('syConn'))$('syConn').onclick=()=>{
      const repo=$('syRepo').value.trim().replace(/^https?:\/\/github\.com\//,'').replace(/\.git$/,'').replace(/\/+$/,''),tok=$('syTok').value.trim();
      if(!/^[^/\s]+\/[^/\s]+$/.test(repo)){errTxt='Repo bitte als owner/name angeben';setStatus('err');return;}
      if(!tok){errTxt='Token fehlt';setStatus('err');return;}
      cfg={repo,token:tok,branch:$('syBr').value.trim()||DEF.branch,path:$('syPath').value.trim().replace(/^\/+/,'')||DEF.path};
      meta.baseAt=null;meta.sha=null;saveMeta();saveCfg();
      /* klappt die Verbindung nicht, wird das Token wieder verworfen */
      (async()=>{busy=true;setStatus('busy');let okc=false;
        try{await syncOnce(false);okc=true;if(status==='busy')setStatus('ok');}
        catch(e){errTxt=String(e&&e.message||e);if(/Failed to fetch|NetworkError|Load failed/i.test(errTxt))errTxt='Keine Verbindung zu GitHub';cfg=null;saveCfg();setStatus('err');}
        busy=false;if(okc)renderDlg();})();
    };
    if($('syNow'))$('syNow').onclick=()=>sync('manual');
    if($('syAdd'))$('syAdd').onclick=()=>{showLink=!showLink;renderDlg();};
    if($('syOff'))$('syOff').onclick=()=>{cfg=null;saveCfg();meta.baseAt=null;meta.sha=null;saveMeta();clearTimeout(pushT);showLink=false;setStatus('off');};
    if($('syCopy'))$('syCopy').onclick=async()=>{let ok=false;try{await navigator.clipboard.writeText(connectLink());ok=true;}catch(e){}
      $('syCopyMsg').textContent=ok?'Kopiert.':'Kopieren nicht möglich, bitte den Link markieren.';};
  }

  /* ---------- Start ---------- */
  function init(){
    css();
    btn=document.createElement('button');btn.className='btn ghost';btn.id='syncBtn';btn.onclick=openDlg;
    const hd=document.querySelector('header'),sr=hd&&hd.querySelector('.search');
    if(hd)hd.insertBefore(btn,sr||null);
    const viaLink=takeHash();
    setStatus(on()?'ok':'off');
    try{const n=sessionStorage.getItem(NOTE_K);if(n){sessionStorage.removeItem(NOTE_K);toast(n);}}catch(e){}
    /* Schreibzugriffe während des Ladens (Umstellungen alter Stände, erstes Rendern) zählen nicht als Änderung */
    const go=()=>setTimeout(()=>{ready=true;if(on())sync(viaLink?'link':'load');},0);
    if(document.readyState==='complete')go();else window.addEventListener('load',go);
    document.addEventListener('visibilitychange',()=>{if(!document.hidden&&ready)sync('visible');});
    setInterval(()=>{if(!document.hidden&&ready&&status!=='choose')sync('timer');},60000);
    window.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.getElementById('syDlg')&&status!=='choose')closeDlg();});
  }
  window.TUMSYNC={link:()=>cfg&&cfg.repo&&cfg.token&&/^https?:$/.test(location.protocol)?connectLink():null,web:()=>/^https?:$/.test(location.protocol),qr:qrSvg,sync,ready:()=>ready,status:()=>status,snapshot,isSynced,meta:()=>meta,cfg:()=>cfg&&Object.assign({},cfg,{token:cfg.token?'***':''})};
  try{init();}catch(e){console.error('Sync',e);}
})();
