(function(){
  var state = { rev: 0, config: null, alumnos: {} };
  var baseRev = 0, listeners = [], connected = false, saving = false, dirty = false, conflict = false, saveTimer = null;
  var BM_CODE = "(function(){var d=document,rows=d.querySelectorAll('table.taula tr'),data=[],sf=0,sr=0,fecha='';rows.forEach(function(tr){var a=tr.querySelector('td.alumne-auto-assist a');if(!a)return;if(!fecha){try{fecha=new URL(a.href,location.href).searchParams.get('data2')||''}catch(e){}}var n=a.textContent.replace(/\\s+/g,' ').replace(/ ,/g,',').trim();var g=tr.querySelectorAll('td')[2];g=g?g.textContent.replace(/\\s+/g,' ').trim():'';var f=0,r=0;tr.querySelectorAll('.linia-auto-assist').forEach(function(l){var c=l.querySelector('input[type=checkbox]');if(c&&!c.checked)return;var k=l.querySelector('.f_al2');k=k?k.textContent.trim().toUpperCase():'';if(k==='F'){f++;sf=1}else if(k==='R'){r++;sr=1}});data.push([n,g,f,r])});if(!data.length){alert('No se han encontrado alumnos en esta pagina.');return}var t=(fecha?'\\x23fecha='+fecha+'\\n':'')+data.map(function(x){return x[0]+';'+x[1]+';'+(sf?x[2]:'')+';'+(sr?x[3]:'')}).join('\\n');var o=d.createElement('div');o.style.cssText='position:fixed;z-index:2147483647;top:8vh;left:0;right:0;margin:0 auto;width:min(616px,88vw);background:#fff;color:#111;border:2px solid #1B5E7A;border-radius:8px;padding:12px;font:14px sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.4)';var m=d.createElement('div');m.style.marginBottom='8px';var ta=d.createElement('textarea');ta.value=t;ta.style.cssText='width:min(616px,88vw);height:220px;font:12px monospace';var b=d.createElement('button');b.textContent='Cerrar';b.style.marginTop='8px';b.onclick=function(){o.remove()};o.appendChild(m);o.appendChild(ta);o.appendChild(b);d.body.appendChild(o);ta.focus();ta.select();var ok=false;try{ok=d.execCommand('copy')}catch(e){}m.textContent=data.length+' alumnos. '+(ok?'Copiado al portapapeles: pegalo en la app.':'Pulsa Ctrl+C para copiar y pegalo en la app.')})()";
  var $$ = function(s){ return document.querySelector(s); };
  function notify(){ listeners.forEach(function(l){ l(); }); }
  function newId(){ return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function hhmm(){ var d = new Date(); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }
  function setStatus(t, c){ var e = $$('#saveStatus'); e.textContent = t; e.className = 'status ' + (c || ''); }
  function downloadText(name, text, mime){
    var b = new Blob([text], { type: mime }), u = URL.createObjectURL(b), a = document.createElement('a');
    a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function(){ URL.revokeObjectURL(u); }, 1500);
  }

  function persist(){
    if(!connected) return;
    dirty = true;
    if(conflict) return;
    setStatus('Cambios sin guardar…');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(flush, 700);
  }

  async function flush(){
    if(!connected || !dirty || conflict) return;
    if(saving){ clearTimeout(saveTimer); saveTimer = setTimeout(flush, 500); return; }
    saving = true; dirty = false;
    setStatus('Guardando en Drive…');
    try{
      var remote = await Drive.load();
      if(remote && (remote.rev || 0) !== baseRev){
        conflict = true; dirty = true;
        $$('#conflict').hidden = false;
        setStatus('Conflicto con Drive', 'bad');
        return;
      }
      state.rev = baseRev + 1;
      await Drive.save(state);
      baseRev = state.rev;
      $$('#reauth').hidden = true;
      setStatus(dirty ? 'Cambios sin guardar…' : 'Guardado en Drive a las ' + hhmm(), dirty ? '' : 'ok');
    }catch(e){
      dirty = true;
      if(e && e.message === 'expired'){
        $$('#reauth').hidden = false;
        setStatus('Sesión caducada: pulsa Reconectar', 'bad');
      } else {
        setStatus('No se pudo guardar. Reintentando…', 'bad');
        clearTimeout(saveTimer); saveTimer = setTimeout(flush, 10000);
      }
    }finally{
      saving = false;
    }
  }

  function makeDb(){
    function docRef(path){
      var p = path.split('/'), col = p[0], id = p[1];
      var get = function(){ return col === 'config' ? state.config : state.alumnos[id]; };
      var put = function(v){
        if(col === 'config') state.config = v;
        else if(v === null) delete state.alumnos[id];
        else state.alumnos[id] = v;
        persist(); notify(); return Promise.resolve();
      };
      return {
        id: id,
        update: function(o){ return put(Object.assign({}, get() || {}, o)); },
        set: function(o){ return put(Object.assign({}, o)); },
        delete: function(){ return put(null); },
        onSnapshot: function(next){
          var l = function(){ var v = get(); next({ exists: !!v, data: function(){ return v; } }); };
          listeners.push(l); setTimeout(l, 0); return function(){};
        }
      };
    }
    return {
      doc: docRef,
      collection: function(name){
        return {
          add: function(o){ var id = newId(); state.alumnos[id] = Object.assign({}, o); persist(); notify(); return Promise.resolve({ id: id }); },
          onSnapshot: function(next){
            var l = function(){
              next({ docs: Object.keys(state.alumnos).map(function(id){ var v = state.alumnos[id]; return { id: id, data: function(){ return v; } }; }) });
            };
            listeners.push(l); setTimeout(l, 0); return function(){};
          }
        };
      }
    };
  }

  async function loadAll(){
    var data = await Drive.load();
    if(data && data.alumnos && typeof data.alumnos === 'object' && !Array.isArray(data.alumnos)) state = data;
    else state = { rev: 0, config: null, alumnos: {} };
    baseRev = state.rev || 0;
    conflict = false; dirty = false;
    $$('#conflict').hidden = true;
    notify();
    return !!data;
  }

  function showConnected(on){
    connected = on;
    $$('#login').hidden = on;
    $$('#appMain').hidden = !on;
    $$('#bAuth').textContent = on ? 'Desconectar' : 'Conectar con Google Drive';
    var fl = $$('#folderLink');
    if(on){ fl.href = Drive.folderUrl(); fl.hidden = false; } else fl.hidden = true;
  }

  async function connect(){
    var msg = $$('#loginMsg'); msg.textContent = ''; setStatus('Conectando…');
    try{
      await Drive.connect();
      var had = await loadAll();
      showConnected(true);
      if(had) setStatus('Datos cargados desde Drive', 'ok');
      else { dirty = true; flush(); }
    }catch(e){
      showConnected(false); setStatus('');
      msg.textContent = Drive.explain(e);
    }
  }

  $$('#bLogin').addEventListener('click', connect);
  $$('#bAuth').addEventListener('click', function(){
    if(!connected){ connect(); return; }
    if(dirty || saving){ setStatus('Espera a que termine de guardar', 'bad'); return; }
    Drive.disconnect();
    state = { rev: 0, config: null, alumnos: {} };
    showConnected(false); notify(); setStatus('');
  });
  $$('#reauth').addEventListener('click', async function(){
    try{ await Drive.connect(); $$('#reauth').hidden = true; dirty = true; flush(); }
    catch(e){ setStatus(Drive.explain(e), 'bad'); }
  });
  $$('#bReload').addEventListener('click', async function(){
    try{ await loadAll(); setStatus('Versión de Drive cargada', 'ok'); }
    catch(e){ setStatus(Drive.explain(e), 'bad'); }
  });
  $$('#bmLink').setAttribute('href', 'javascript:' + BM_CODE);
  $$('#bmLink').addEventListener('click', function(e){ e.preventDefault(); });
  $$('#bmCopy').addEventListener('click', function(){
    var t = 'javascript:' + BM_CODE;
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(t).then(function(){ toast('Código copiado'); }, function(){ toast('No se pudo copiar.'); });
    } else toast('No se pudo copiar.');
  });
  if(!Drive.configured()){ $$('#nodb').hidden = false; $$('#bLogin').disabled = true; $$('#bAuth').disabled = true; }
  window.addEventListener('beforeunload', function(e){ if(dirty || saving){ e.preventDefault(); e.returnValue = ''; } });

  var $ = function(s){ return document.querySelector(s); };
  var db = makeDb(), dl = true;
  var students = [];
  var config = { fecha: todayISO(), uf: 6, ur: 6, ul: 6 };
  var deleting = null, pendingRender = false, importRows = [], importFecha = null;

  function todayISO(){ var d=new Date(); var m=String(d.getMonth()+1).padStart(2,'0'), day=String(d.getDate()).padStart(2,'0'); return d.getFullYear()+'-'+m+'-'+day; }
  function fmt(iso){ if(!iso) return '—'; var p=String(iso).split('-'); return p.length===3 ? p[2]+'/'+p[1]+'/'+p[0] : iso; }
  function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
  function norm(s){ return String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/\s+/g,' ').trim(); }
  function toast(msg){ var t=$('#toast'); t.textContent=msg; t.classList.add('on'); clearTimeout(toast.h); toast.h=setTimeout(function(){t.classList.remove('on');},2600); }
  function plural(n,a,b){ return n===1?a:b; }

  function calc(s){
    var f=Math.max(0,+s.faltas||0), r=Math.max(0,+s.retardos||0);
    var uf=Math.max(1,config.uf), ur=Math.max(1,config.ur), ul=Math.max(1,config.ul);
    var lf=Math.floor(f/uf), lr=Math.floor(r/ur), leves=lf+lr, graves=Math.floor(leves/ul);
    return { lf:lf, lr:lr, leves:leves, graves:graves, sf:f%uf, sr:r%ur, sl:leves%ul,
      nl:Math.max(0,leves-(+s.levesAplicadas||0)), ng:Math.max(0,graves-(+s.gravesAplicadas||0)) };
  }

  function visible(){
    var q=norm($('#q').value), g=$('#grupo').value, only=$('#soloPend').checked;
    return students.filter(function(s){
      if(q && norm(s.nombre).indexOf(q)<0) return false;
      if(g && (s.grupo||'')!==g) return false;
      if(only){ var c=calc(s); if(!c.nl && !c.ng) return false; }
      return true;
    }).sort(function(a,b){ return (a.grupo||'').localeCompare(b.grupo||'','es') || a.nombre.localeCompare(b.nombre,'es'); });
  }

  function ctr(label,val,max){
    var p=Math.min(100,Math.round(val/max*100));
    return '<span class="ctr"><b>'+label+'</b><i style="--p:'+p+'%"></i><em>'+val+'/'+max+'</em></span>';
  }

  function render(){
    // grupos
    var sel=$('#grupo'), cur=sel.value, gs={};
    students.forEach(function(s){ if(s.grupo) gs[s.grupo]=1; });
    var opts='<option value="">Todos los grupos</option>'+Object.keys(gs).sort(function(a,b){return a.localeCompare(b,'es');}).map(function(g){return '<option value="'+esc(g)+'">'+esc(g)+'</option>';}).join('');
    if(sel.innerHTML!==opts){ sel.innerHTML=opts; sel.value=gs[cur]?cur:''; }

    // resumen
    var tl=0,tg=0,tp=0;
    students.forEach(function(s){ var c=calc(s); tl+=c.nl; tg+=c.ng; if(c.nl||c.ng) tp++; });
    $('#sAlumnos').textContent=students.length; $('#sPend').textContent=tp; $('#sLeves').textContent=tl; $('#sGraves').textContent=tg;
    $('#bDelEx').hidden=!students.some(function(s){return s.ejemplo;});

    var rows=visible();
    $('#empty').hidden = rows.length>0;
    if(!rows.length && students.length){ $('#empty').innerHTML='<b>Sin resultados</b>Prueba con otro filtro.'; }
    else if(!students.length){ $('#empty').innerHTML='<b>Aún no hay alumnos</b>Añade uno o pega la extracción con «Importar extracción».'; }

    $('#tbody').innerHTML = rows.map(function(s){
      var c=calc(s), pend=c.nl||c.ng;
      var pc = pend
        ? '<div class="pendcell">'+(c.nl?'<span class="badge l">+'+c.nl+' '+plural(c.nl,'leve','leves')+'</span>':'')+(c.ng?'<span class="badge g">+'+c.ng+' '+plural(c.ng,'grave','graves')+'</span>':'')+'<button class="small" data-act="apply" data-id="'+esc(s.id)+'">Aplicar</button></div>'
        : '<span class="badge ok">Al día</span>';
      var del = deleting===s.id
        ? '<button class="small danger" data-act="delyes" data-id="'+esc(s.id)+'">¿Eliminar?</button> <button class="small" data-act="delno">No</button>'
        : '<button class="small" data-act="del" data-id="'+esc(s.id)+'" aria-label="Eliminar '+esc(s.nombre)+'">Eliminar</button>';
      return '<tr class="'+(pend?'pend':'')+(c.ng?' g':'')+'">'
        +'<td class="name">'+esc(s.nombre)+(s.ejemplo?'<span class="ex">ejemplo</span>':'')+'<small>'+esc(s.grupo||'Sin grupo')+'</small></td>'
        +'<td><input type="number" min="0" step="1" inputmode="numeric" value="'+(+s.faltas||0)+'" data-id="'+esc(s.id)+'" data-field="faltas" aria-label="Faltas injustificadas de '+esc(s.nombre)+'"></td>'
        +'<td><input type="number" min="0" step="1" inputmode="numeric" value="'+(+s.retardos||0)+'" data-id="'+esc(s.id)+'" data-field="retardos" aria-label="Retardos de '+esc(s.nombre)+'"></td>'
        +'<td><div class="ctrs">'+ctr('F',c.sf,config.uf)+ctr('R',c.sr,config.ur)+ctr('L',c.sl,config.ul)+'</div></td>'
        +'<td class="num" title="'+c.lf+' por faltas + '+c.lr+' por retardos">'+c.leves+'</td>'
        +'<td class="num">'+c.graves+'</td>'
        +'<td class="num muted">'+(+s.levesAplicadas||0)+' / '+(+s.gravesAplicadas||0)+'</td>'
        +'<td class="num muted">'+fmt(s.fechaUltimaLeve)+'</td>'
        +'<td>'+pc+'</td>'
        +'<td>'+del+'</td></tr>';
    }).join('');
  }

  function scheduleRender(){
    var a=document.activeElement;
    if(a && a.tagName==='INPUT' && a.closest && a.closest('#tbody')){ pendingRender=true; return; }
    render();
  }

  // ---------- escritura ----------
  function guard(){ if(!db){ toast('No se puede guardar en esta vista.'); return false; } return true; }
  function fail(e){ toast('No se pudo guardar'+(e&&e.code?' ('+e.code+')':'')+'.'); }
  async function inChunks(items, fn){
    for(var i=0;i<items.length;i+=8){ await Promise.all(items.slice(i,i+8).map(fn)); }
  }
  function saveConfig(){
    if(!db) return;
    db.doc('config/main').set({ fecha:config.fecha, uf:config.uf, ur:config.ur, ul:config.ul }).catch(fail);
  }
  function applyRecord(s){
    var c=calc(s), f=config.fecha;
    return db.doc('alumnos/'+s.id).update({
      levesAplicadas:c.leves, gravesAplicadas:c.graves,
      fechaUltimaLeve: c.nl>0 ? f : (s.fechaUltimaLeve||null),
      fechaUltimaGrave: c.ng>0 ? f : (s.fechaUltimaGrave||null)
    });
  }

  // ---------- eventos ----------
  $('#tbody').addEventListener('change',function(e){
    var el=e.target; if(!el.matches('input[data-field]')) return;
    if(!guard()){ render(); return; }
    var v=parseInt(el.value,10);
    if(isNaN(v)||v<0){ render(); return; }
    var o={}; o[el.dataset.field]=v;
    db.doc('alumnos/'+el.dataset.id).update(o).catch(fail);
  });
  $('#tbody').addEventListener('focusout',function(){
    setTimeout(function(){ if(pendingRender && !(document.activeElement && document.activeElement.closest && document.activeElement.closest('#tbody') && document.activeElement.tagName==='INPUT')){ pendingRender=false; render(); } },0);
  });
  $('#tbody').addEventListener('click',function(e){
    var b=e.target.closest('button[data-act]'); if(!b) return;
    var act=b.dataset.act, id=b.dataset.id;
    var s=students.filter(function(x){return x.id===id;})[0];
    if(act==='apply' && s && guard()){
      applyRecord(s).then(function(){ toast('Registrado: '+s.nombre); }).catch(fail);
    } else if(act==='del'){ deleting=id; render(); }
    else if(act==='delno'){ deleting=null; render(); }
    else if(act==='delyes' && guard()){
      deleting=null; db.doc('alumnos/'+id).delete().then(function(){ toast('Alumno eliminado'); }).catch(fail);
    }
  });

  ['#q','#grupo','#soloPend'].forEach(function(s){ $(s).addEventListener('input',render); });

  $('#fecha').addEventListener('change',function(){ if(this.value){ config.fecha=this.value; saveConfig(); } });
  [['#uF','uf'],['#uR','ur'],['#uL','ul']].forEach(function(p){
    $(p[0]).addEventListener('change',function(){
      var v=parseInt(this.value,10);
      if(isNaN(v)||v<1){ this.value=config[p[1]]; return; }
      config[p[1]]=v; saveConfig(); render();
    });
  });

  // añadir
  $('#bAdd').addEventListener('click',function(){ $('#addPanel').hidden=false; $('#aNombre').focus(); });
  $('#aCancel').addEventListener('click',function(){ $('#addPanel').hidden=true; });
  $('#addForm').addEventListener('submit',function(e){
    e.preventDefault(); if(!guard()) return;
    var nombre=$('#aNombre').value.trim(); if(!nombre) return;
    var dup=students.some(function(s){return norm(s.nombre)===norm(nombre);});
    if(dup){ toast('Ese alumno ya está en la lista.'); return; }
    var data={ nombre:nombre, grupo:$('#aGrupo').value.trim(), faltas:Math.max(0,parseInt($('#aFaltas').value,10)||0),
      retardos:Math.max(0,parseInt($('#aRet').value,10)||0), levesAplicadas:0, gravesAplicadas:0, fechaUltimaLeve:null, fechaUltimaGrave:null };
    db.collection('alumnos').add(data).then(function(){
      toast('Alumno añadido'); $('#aNombre').value=''; $('#aFaltas').value='0'; $('#aRet').value='0'; $('#aNombre').focus();
    }).catch(fail);
  });

  // importar
  function parseImport(text){
    importFecha=null;
    var rows=[];
    text.split(/\r?\n/).forEach(function(line){
      line=line.trim(); if(!line) return;
      var mf=line.match(/^#fecha=(\d{4}-\d{2}-\d{2})$/); if(mf){ importFecha=mf[1]; return; }
      var p=line.split(/\t|;/).map(function(x){return x.trim();});
      if(p.length<3 && line.indexOf(',')>=0) p=line.split(',').map(function(x){return x.trim();});
      if(p.length<3) return;
      var nombre, grupo='', f, r;
      if(p.length===3){ nombre=p[0]; f=p[1]; r=p[2]; }
      else { nombre=p[0]; grupo=p[1]; f=p[2]; r=p[3]; }
      if(!/^\d*$/.test(String(f))||!/^\d*$/.test(String(r))||(f===''&&r==='')) return; // cabecera u otra fila no válida
      if(!nombre) return;
      rows.push({ nombre:nombre, grupo:grupo, faltas:f===''?null:parseInt(f,10), retardos:r===''?null:parseInt(r,10) });
    });
    return rows;
  }
  function previewImport(){
    importRows=parseImport($('#impText').value);
    var upd=0, nue=0;
    importRows.forEach(function(r){ if(students.some(function(s){return norm(s.nombre)===norm(r.nombre);})) upd++; else nue++; });
    $('#impInfo').textContent = importRows.length ? importRows.length+' filas válidas: '+upd+' se actualizan, '+nue+' son nuevos.'+(importFecha?' Fecha de la extracción: '+fmt(importFecha)+'.':'') : 'Sin filas válidas todavía.';
    $('#impGo').disabled = !importRows.length;
  }
  $('#bImp').addEventListener('click',function(){ $('#impPanel').hidden=false; $('#impText').focus(); });
  $('#impCancel').addEventListener('click',function(){ $('#impPanel').hidden=true; });
  $('#impText').addEventListener('input',previewImport);
  $('#impFile').addEventListener('change',function(){
    var f=this.files&&this.files[0]; if(!f) return;
    var rd=new FileReader(); rd.onload=function(){ $('#impText').value=String(rd.result||''); previewImport(); }; rd.readAsText(f);
  });
  $('#impGo').addEventListener('click',async function(){
    if(!guard()) return;
    var btn=this; btn.disabled=true;
    try{
      if(importFecha && importFecha!==config.fecha){ config.fecha=importFecha; syncConfigInputs(); saveConfig(); }
      await inChunks(importRows,function(r){
        var s=students.filter(function(x){return norm(x.nombre)===norm(r.nombre);})[0];
        if(s){
          var o={}; if(r.faltas!==null) o.faltas=r.faltas; if(r.retardos!==null) o.retardos=r.retardos; if(r.grupo) o.grupo=r.grupo;
          return db.doc('alumnos/'+s.id).update(o);
        }
        return db.collection('alumnos').add({ nombre:r.nombre, grupo:r.grupo, faltas:r.faltas||0, retardos:r.retardos||0,
          levesAplicadas:0, gravesAplicadas:0, fechaUltimaLeve:null, fechaUltimaGrave:null });
      });
      toast('Extracción importada: '+importRows.length+' alumnos');
      $('#impText').value=''; importRows=[]; previewImport(); $('#impPanel').hidden=true;
    }catch(e){ fail(e); btn.disabled=false; }
  });

  // cerrar extracción
  $('#bClose').addEventListener('click',function(){
    var tl=0,tg=0,n=0; students.forEach(function(s){ var c=calc(s); tl+=c.nl; tg+=c.ng; if(c.nl||c.ng) n++; });
    if(!n){ toast('No hay sanciones pendientes.'); return; }
    $('#confirmText').textContent='Se registrarán '+tl+' '+plural(tl,'leve','leves')+' y '+tg+' '+plural(tg,'grave','graves')+' ('+n+' '+plural(n,'alumno','alumnos')+') con fecha '+fmt(config.fecha)+'.';
    $('#confirmClose').hidden=false;
  });
  $('#bCloseNo').addEventListener('click',function(){ $('#confirmClose').hidden=true; });
  $('#bCloseYes').addEventListener('click',async function(){
    if(!guard()) return;
    $('#confirmClose').hidden=true;
    var list=students.filter(function(s){ var c=calc(s); return c.nl||c.ng; });
    try{ await inChunks(list,applyRecord); toast('Extracción cerrada: '+list.length+' alumnos registrados'); Drive.backup('copia-cierre-'+config.fecha+'.json',state).catch(function(){}); }
    catch(e){ fail(e); }
  });

  // borrar ejemplos
  $('#bDelEx').addEventListener('click',async function(){
    if(!guard()) return;
    try{ await inChunks(students.filter(function(s){return s.ejemplo;}),function(s){return db.doc('alumnos/'+s.id).delete();}); toast('Ejemplos borrados'); }
    catch(e){ fail(e); }
  });

  // exportar CSV
  $('#bCsv').addEventListener('click',async function(){
    if(!dl){ toast('La descarga no está disponible en esta vista.'); return; }
    var head=['Alumno','Grupo','Faltas injustificadas','Retardos','Leves totales','Graves totales','Leves a poner','Graves a poner','Faltas sobrantes','Retardos sobrantes','Ultima leve'];
    var q=function(v){ v=String(v==null?'':v); return /[;"\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v; };
    var lines=[head.join(';')];
    visible().forEach(function(s){
      var c=calc(s);
      lines.push([s.nombre,s.grupo||'',s.faltas||0,s.retardos||0,c.leves,c.graves,c.nl,c.ng,c.sf,c.sr,s.fechaUltimaLeve||''].map(q).join(';'));
    });
    try{ downloadText('faltas_'+config.fecha+'.csv','﻿'+lines.join('\r\n'),'text/csv;charset=utf-8'); }
    catch(e){ if(!e||e.code!=='declined') toast('No se pudo exportar.'); }
  });

  $('#bBackup').addEventListener('click',function(){
    downloadText('control-faltas-copia-'+todayISO()+'.json',JSON.stringify(state),'application/json');
  });
  $('#bRestore').addEventListener('change',function(){
    var f=this.files&&this.files[0]; if(!f) return;
    var rd=new FileReader();
    rd.onload=function(){
      try{
        var p=JSON.parse(rd.result);
        if(!p||typeof p.alumnos!=='object'||Array.isArray(p.alumnos)) throw new Error('formato');
        p.rev=baseRev; state=p; persist(); notify(); toast('Copia restaurada');
      }catch(e){ toast('El archivo no es una copia válida.'); }
    };
    rd.readAsText(f);
    this.value='';
  });

  // ---------- arranque ----------
  function syncConfigInputs(){
    $('#fecha').value=config.fecha; $('#uF').value=config.uf; $('#uR').value=config.ur; $('#uL').value=config.ul;
  }
  syncConfigInputs(); render();

  (async function init(){
    db.doc('config/main').onSnapshot(function(snap){
      if(snap.exists){
        var d=snap.data();
        config={ fecha:d.fecha||config.fecha, uf:+d.uf||6, ur:+d.ur||6, ul:+d.ul||6 };
        if(document.activeElement && document.activeElement.matches && document.activeElement.matches('#fecha,#uF,#uR,#uL')){ /* no pisar lo que se escribe */ }
        else syncConfigInputs();
      }
      scheduleRender();
    },function(){});
    db.collection('alumnos').onSnapshot(function(snap){
      students=snap.docs.map(function(d){ var o=Object.assign({},d.data()); o.id=d.id; return o; });
      scheduleRender();
    });
  })();
})();
