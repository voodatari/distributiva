/* =========================================================
   Voz · síntesis de voz en español con Piper (Sharvard, España, mujer), en local (WebAssembly en un Web Worker)
   Todo se carga UNA vez al entrar (runtime ONNX, fonemizador espeak-ng y modelo de voz) y se queda
   en memoria; no hay peticiones a servidores externos. Las frases ya sintetizadas se guardan en una caché.
   La síntesis ocurre en un hilo aparte (voz-worker.js): el juego y sus animaciones no se atascan.

   Voz.iniciar(progreso)        → carga todo (promesa; se puede llamar varias veces). progreso(0..1, estado)
   Voz.decir(texto, opciones)   → pronuncia el texto; la promesa se resuelve al terminar o al cortarse
        texto: una cadena, o una lista de segmentos [cadena | { t: cadena, pausa: ms }]
        opciones.pausa      → silencio (ms) tras cada segmento/frase (por defecto 0)
        opciones.rapido     → fundido rápido de la música (para una palabra suelta)
        opciones.vel        → velocidad de todo el texto (0,85 = un poco más lento)
        opciones.claro      → articula la g suave entre vocales (ahogo, lago…)
        opciones.palabra    → { silabas, tonica, portadora }: se le da a Piper el acento correcto (espeak se equivoca con palabras sueltas);
                              con portadora ('la') se sintetiza «la, palabra» y se descarta el «la»: dicha sola, una palabra suena peor
        un segmento { sil: [sílabas], ton: índice } se dice SÍLABA A SÍLABA en un solo enunciado, con las vocales alargadas;
        alFrase recibe como 5.º argumento las marcas (segundos en que empieza cada sílaba)
        opciones.alFrase(i, total, segundos, segmento) → al empezar cada frase
        un segmento { t, pausa, vel, acento } puede llevar su velocidad (vel 1.2 = un 20 % más rápido)
        y su acento ('tonica' | 'atona': una sílaba suelta suena acentuada o no)
   Voz.parar()                  → corta lo que esté sonando
   Voz.precargar(texto)         → sintetiza por adelantado (para que decir() sea instantáneo)
   Voz.estado()                 → 'sin-cargar' | 'cargando' | 'lista' | 'error'
   ========================================================= */
window.Voz = (function () {

    /* Cómo se dice una palabra sílaba a sílaba:
       'trozos'   → cada sílaba por separado, escrita con guion («di-» «ri-» «gen-» «te-»), con una pausa corta; la tónica con acento y algo más lenta
       'continuo' → toda la palabra en un solo enunciado con las vocales alargadas (se probó: sonaba peor) */
    var MODO_SILABEO = 'trozos';
    var PAUSA_ENTRE_SILABAS = 280, VEL_ATONA_TROZOS = 0.6, VEL_TONICA_TROZOS = 0.45;
    function textoSilaba(s, k) { return s.replace(/^rr/, 'r').replace(/^x/, k === 0 ? 's' : 'ks') + '-'; }   // «rrí» lo lee espeak como letras («erre-í»); x → s / ks

    var estado = 'sin-cargar', error = null, promesaCarga = null, progresoActual = 0;
    var escuchas = [];                    // funciones que quieren saber el progreso
    var worker = null, tasa = 22050;
    var pendientes = {}, idSig = 1;       // peticiones de síntesis en curso
    var cache = new Map();                // texto → Promise<Float32Array>
    var ctx = null, fuente = null, token = 0, hablando = 0, rapidoAct = false;

    function avisarProgreso(f) { progresoActual = f; escuchas.forEach(function (fn) { try { fn(f, estado); } catch (e) {} }); }

    function iniciar(progreso) {
        if (progreso) { escuchas.push(progreso); progreso(progresoActual, estado); }
        if (promesaCarga) return promesaCarga;
        if (!window.Worker || !window.WebAssembly) { estado = 'error'; error = new Error('Este navegador no admite WebAssembly'); avisarProgreso(0); return Promise.reject(error); }
        estado = 'cargando';
        promesaCarga = new Promise(function (ok, mal) {
            try { worker = new Worker('voz-worker.js?v=20261012c'); } catch (e) { estado = 'error'; error = e; promesaCarga = null; return mal(e); }
            worker.onmessage = function (ev) {
                var m = ev.data;
                if (m.t === 'progreso') avisarProgreso(m.f);
                else if (m.t === 'lista') { tasa = m.sr; estado = 'lista'; avisarProgreso(1); ok(); }
                else if (m.t === 'error') { estado = 'error'; error = new Error(m.msg); console.warn('Voz: no se pudo cargar Piper', m.msg); avisarProgreso(progresoActual); mal(error); }
                else if (m.t === 'pcm' && pendientes[m.id]) { pendientes[m.id].ok({ pcm: m.pcm, marcas: m.marcas }); delete pendientes[m.id]; }
                else if (m.t === 'fallo' && pendientes[m.id]) { pendientes[m.id].mal(new Error(m.msg)); delete pendientes[m.id]; }
            };
            worker.onerror = function (ev) { if (estado !== 'lista') { estado = 'error'; error = new Error(ev.message || 'Error en el worker'); avisarProgreso(progresoActual); mal(error); } };
            worker.postMessage({ t: 'init' });
        });
        promesaCarga.catch(function () {});
        return promesaCarga;
    }

    function sintetizar(texto, vel, acento, claro, extra) {
        vel = vel || 1;
        var clave = vel === 1 && !acento && !claro && !extra ? texto : texto + '|' + vel + '|' + (acento || '') + '|' + (claro ? 'c' : '') + (extra ? '|' + extra.tipo + ':' + extra.silabas.join('-') + ':' + extra.tonica + ':' + (extra.portadora || '') : '');      // la misma frase a otra velocidad es otro audio
        if (cache.has(clave)) return cache.get(clave);
        var p = iniciar().then(function () {
            return new Promise(function (ok, mal) {
                var id = idSig++;
                pendientes[id] = { ok: ok, mal: mal };
                worker.postMessage({ t: 'sint', id: id, texto: texto, escala: 1 / vel, acento: acento || null, claro: !!claro, extra: extra || null });
            });
        });
        cache.set(clave, p);
        p.catch(function () { cache.delete(clave); });
        return p;
    }

    function contexto() {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!ctx && AC) { try { ctx = new AC(); } catch (e) {} }
        if (ctx && ctx.state === 'suspended') { var r = ctx.resume(); if (r && r.catch) r.catch(function () {}); }
        return ctx;
    }

    function atenuar(on, rapido) {
        return (window.Sonido && Sonido.atenuar) ? Sonido.atenuar(on, rapido) : Promise.resolve();
    }

    function parar() {
        token++;
        if (fuente) { try { fuente.onended = null; fuente.stop(); } catch (e) {} fuente = null; }
        if (hablando) { hablando = 0; atenuar(false, rapidoAct); }
    }

    function reproducir(pcm, miToken) {
        return new Promise(function (ok) {
            var c = contexto();
            if (!c || miToken !== token) return ok();
            var buf = c.createBuffer(1, pcm.length, tasa);
            buf.copyToChannel(pcm, 0);
            var src = c.createBufferSource();
            src.buffer = buf; src.connect(c.destination);
            fuente = src;
            src.onended = function () { if (fuente === src) fuente = null; ok(); };
            src.start();
        });
    }

    function pausar(ms, miToken) {
        return new Promise(function (ok) { setTimeout(ok, ms); }).then(function () { return miToken === token; });
    }

    /* Trocea un texto en frases para empezar a hablar antes de tenerlo todo sintetizado */
    function frases(texto) {
        var t = String(texto).replace(/\s+/g, ' ').trim();
        if (!t) return [];
        var partes = t.match(/[^.!?…:;]+[.!?…:;]*\s*/g) || [t];
        var out = [];
        partes.forEach(function (p) {
            p = p.trim();
            if (!p) return;
            if (p.length <= 200) out.push(p);
            else p.split(/,\s*/).forEach(function (x, i, a) { if (x.trim()) out.push(x.trim() + (i < a.length - 1 ? ',' : '')); });
        });
        return out;
    }

    /* cadena o lista de segmentos → lista plana de { texto, pausa, seg } */
    function normalizar(entrada, pausaPorDefecto, def) {
        def = def || {};
        var out = [];
        (Array.isArray(entrada) ? entrada : [entrada]).forEach(function (el, idx) {
            if (typeof el === 'object' && el.sil && MODO_SILABEO === 'trozos') {      // una síntesis por sílaba
                el.sil.forEach(function (s, k) {
                    var t = textoSilaba(s, k), esTon = k === el.ton;
                    out.push({ texto: t, pausa: k < el.sil.length - 1 ? PAUSA_ENTRE_SILABAS : (el.pausa != null ? el.pausa : pausaPorDefecto), seg: idx, silK: k,
                        vel: esTon ? VEL_TONICA_TROZOS : VEL_ATONA_TROZOS, acento: esTon ? 'tonica' : 'atona', claro: true,
                        extra: { tipo: 'silabaTexto', texto: t, tonica: esTon, silabas: [t] } });
                });
                return;
            }
            if (typeof el === 'object' && el.sil) {            // sílaba a sílaba, en un solo enunciado
                out.push({ texto: el.sil.join('-'), pausa: el.pausa != null ? el.pausa : pausaPorDefecto, seg: idx, vel: 1, acento: null, claro: true,
                    extra: { tipo: 'silabeo', silabas: el.sil, tonica: el.ton, palabra: el.sil.join('') } });
                return;
            }
            var texto = typeof el === 'string' ? el : el.t;
            var pausa = typeof el === 'object' && el.pausa != null ? el.pausa : pausaPorDefecto;
            frases(texto).forEach(function (f) {
                out.push({ texto: f, pausa: pausa, seg: idx, vel: typeof el === 'object' && el.vel ? el.vel : (def.vel || 1), acento: typeof el === 'object' ? el.acento : null, claro: !!def.claro,
                    extra: def.palabra ? { tipo: 'palabra', silabas: def.palabra.silabas, tonica: def.palabra.tonica, portadora: def.palabra.portadora } : null });
            });
        });
        return out;
    }

    async function decir(texto, opciones) {
        opciones = opciones || {};
        if (estado === 'error') return false;
        parar();
        var miToken = token;
        try { await iniciar(); } catch (e) { return false; }
        if (miToken !== token) return false;
        var lista = normalizar(texto, opciones.pausa || 0, { vel: opciones.vel, claro: opciones.claro, palabra: opciones.palabra });
        if (!lista.length) return false;
        var siguiente = sintetizar(lista[0].texto, lista[0].vel, lista[0].acento, lista[0].claro, lista[0].extra);
        hablando = 1; rapidoAct = !!opciones.rapido;
        try {
            await atenuar(true, rapidoAct);                  // la voz espera a que la música haya terminado de bajar
            if (miToken !== token) return false;
            for (var i = 0; i < lista.length; i++) {
                var resp = await siguiente, pcm = resp.pcm;
                if (miToken !== token) return false;
                if (i + 1 < lista.length) siguiente = sintetizar(lista[i + 1].texto, lista[i + 1].vel, lista[i + 1].acento, lista[i + 1].claro, lista[i + 1].extra);   // mientras suena esta, se prepara la siguiente (en el worker)
                if (opciones.alFrase) { try { opciones.alFrase(i, lista.length, pcm.length / tasa, lista[i].seg, resp.marcas, lista[i].silK); } catch (e) {} }
                await reproducir(pcm, miToken);
                if (miToken !== token) return false;
                if (lista[i].pausa && i + 1 < lista.length && !(await pausar(lista[i].pausa, miToken))) return false;
            }
        } catch (e) { return false; }
        if (miToken === token) { hablando = 0; atenuar(false, rapidoAct); }
        return true;
    }

    function precargar(texto, opciones) {
        opciones = opciones || {};
        if (estado === 'error') return Promise.resolve();
        return Promise.all(normalizar(texto, 0, { vel: opciones.vel, claro: opciones.claro, palabra: opciones.palabra }).map(function (f) { return sintetizar(f.texto, f.vel, f.acento, f.claro, f.extra); })).catch(function () {});
    }

    /* Primer toque del usuario: los navegadores móviles solo dejan sonar el audio a partir de ahí */
    function desbloquear() {
        var c = contexto();
        if (c) {
            try { var b = c.createBuffer(1, 1, 22050), s = c.createBufferSource(); s.buffer = b; s.connect(c.destination); s.start(0); } catch (e) {}
        }
    }
    ['pointerdown', 'keydown', 'touchend'].forEach(function (ev) { document.addEventListener(ev, desbloquear, { capture: true, passive: true }); });

    return {
        iniciar: iniciar,
        decir: decir,
        parar: parar,
        precargar: precargar,
        estado: function () { return estado; }
    };

})();
