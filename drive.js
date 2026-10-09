/* Control de Faltas v1.2 · drive.js */
/* Almacenamiento en Google Drive (carpeta propia de la app).
   Scope drive.file: la app solo ve los archivos que ella misma crea. */
(function(){
  var C = window.APP_CONFIG || {};
  var SCOPE = 'https://www.googleapis.com/auth/drive.file';
  var BASE = 'https://www.googleapis.com/drive/v3';
  var UP = 'https://www.googleapis.com/upload/drive/v3';
  var token = null, tokenExp = 0, client = null, pending = null, folderId = null, fileId = null;

  function configured(){ return !!C.CLIENT_ID && C.CLIENT_ID.indexOf('PEGA_AQUI') !== 0; }

  function waitGis(){
    return new Promise(function(res, rej){
      var n = 0;
      (function t(){
        if(window.google && google.accounts && google.accounts.oauth2) return res();
        if(++n > 80) return rej(new Error('gis'));
        setTimeout(t, 100);
      })();
    });
  }

  function ensureClient(){
    if(client) return;
    client = google.accounts.oauth2.initTokenClient({
      client_id: C.CLIENT_ID,
      scope: SCOPE,
      callback: function(r){
        var p = pending; pending = null; if(!p) return;
        if(r.error){ p.rej(new Error(r.error)); return; }
        token = r.access_token; tokenExp = Date.now() + (Number(r.expires_in || 3600) - 60) * 1000;
        p.res(token);
      },
      error_callback: function(e){
        var p = pending; pending = null;
        if(p) p.rej(new Error((e && e.type) || 'auth'));
      }
    });
  }

  function auth(){
    return new Promise(function(res, rej){
      ensureClient();
      pending = { res: res, rej: rej };
      client.requestAccessToken({ prompt: '' });
    });
  }

  function getToken(){
    if(token && Date.now() < tokenExp) return token;
    throw new Error('expired');
  }

  async function api(url, opts){
    var t = getToken();
    opts = opts || {};
    opts.headers = Object.assign({ Authorization: 'Bearer ' + t }, opts.headers || {});
    var r = await fetch(url, opts);
    if(r.status === 401){ token = null; throw new Error('expired'); }
    if(!r.ok){ var tx = await r.text(); throw new Error('drive ' + r.status + ': ' + tx.slice(0, 200)); }
    return r;
  }

  function enc(s){ return encodeURIComponent(s); }

  async function ensureFolder(){
    if(folderId) return folderId;
    var q = "name='" + C.FOLDER_NAME + "' and mimeType='application/vnd.google-apps.folder' and trashed=false";
    var r = await api(BASE + '/files?spaces=drive&fields=files(id,name)&q=' + enc(q));
    var j = await r.json();
    var f = j.files && j.files[0];
    if(!f){
      var c = await api(BASE + '/files?fields=id', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: C.FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' })
      });
      f = await c.json();
    }
    folderId = f.id;
    return folderId;
  }

  async function findIn(name){
    var q = "name='" + name + "' and '" + folderId + "' in parents and trashed=false";
    var r = await api(BASE + '/files?spaces=drive&fields=files(id,name)&q=' + enc(q));
    var j = await r.json();
    return (j.files && j.files[0]) || null;
  }

  async function createFile(name, text){
    var b = 'cfb' + Date.now();
    var body = '--' + b + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify({ name: name, parents: [folderId], mimeType: 'application/json' }) +
      '\r\n--' + b + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + text +
      '\r\n--' + b + '--';
    var r = await api(UP + '/files?uploadType=multipart&fields=id', {
      method: 'POST',
      headers: { 'Content-Type': 'multipart/related; boundary=' + b },
      body: body
    });
    return (await r.json()).id;
  }

  async function updateFile(id, text){
    await api(UP + '/files/' + id + '?uploadType=media&fields=id', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: text
    });
  }

  async function connect(){
    if(!configured()) throw new Error('config');
    await waitGis();
    await auth();
    await ensureFolder();
  }

  async function load(){
    await ensureFolder();
    try{
      if(!fileId){
        var f = await findIn(C.DATA_FILE);
        if(!f) return null;
        fileId = f.id;
      }
      var r = await api(BASE + '/files/' + fileId + '?alt=media');
      return JSON.parse(await r.text());
    }catch(e){
      if(/drive 404/.test(e.message)){ fileId = null; return null; }
      throw e;
    }
  }

  async function save(obj){
    await ensureFolder();
    var text = JSON.stringify(obj);
    if(!fileId){
      var f = await findIn(C.DATA_FILE);
      if(f) fileId = f.id;
    }
    if(fileId) await updateFile(fileId, text);
    else fileId = await createFile(C.DATA_FILE, text);
  }

  async function backup(name, obj){
    await ensureFolder();
    var text = JSON.stringify(obj);
    var f = await findIn(name);
    if(f) await updateFile(f.id, text); else await createFile(name, text);
  }

  function disconnect(){
    try{ if(token && window.google) google.accounts.oauth2.revoke(token, function(){}); }catch(e){}
    token = null; tokenExp = 0; folderId = null; fileId = null;
  }

  function explain(e){
    var m = (e && e.message) || '';
    if(m === 'config') return 'Falta configurar el ID de cliente en config.js.';
    if(m === 'gis') return 'No se pudo cargar el inicio de sesión de Google. Revisa tu conexión.';
    if(m === 'expired') return 'La sesión de Google ha caducado. Pulsa Reconectar.';
    if(m === 'popup_closed' || m === 'popup_failed_to_open') return 'No se completó el inicio de sesión. Permite las ventanas emergentes e inténtalo otra vez.';
    if(m === 'access_denied') return 'Google ha denegado el acceso. Comprueba que tu correo está en los usuarios de prueba.';
    if(/drive 403/.test(m)) return 'Drive ha rechazado la petición (403). Comprueba que la API de Google Drive está habilitada.';
    return 'Error de Drive: ' + m;
  }

  window.Drive = {
    version: '1.2',
    configured: configured, connect: connect, load: load, save: save, backup: backup,
    disconnect: disconnect, explain: explain,
    folderUrl: function(){ return 'https://drive.google.com/drive/folders/' + folderId; }
  };
})();
