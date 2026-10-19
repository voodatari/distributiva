/**
 * Distributiva · navegación, partida, resultados y ranking local
 * Actividades: reconocer (factor común / no se puede) · igualdad (elige la igualdad correcta) · arrastrar (mueve las piezas) · mezcla (las tres)
 * Modos: timeattack · sudden_death · survival · practice (con explicación de cada error; en los demás modos, si en Opciones
 *        «Explicar los fallos» está en «Siempre», el juego se pausa por completo —también el reloj— mientras se explica el fallo)
 * Todo es local: ranking, nombre y ajustes en localStorage (sin cuentas ni servidor).
 */
const app = {

    // --- ESTADO ---
    state: {
        playerName: '',
        mode: 'timeattack',
        actividad: 'reconocer',
        nivel: 1,                 // 1, 2, 3 · 0 = mixto
        tiempo: 60,               // contrarreloj
        score: 0, streak: 0, maxStreak: 0,
        total: 0, aciertos: 0, lives: 3,
        timeRemaining: 0, timerId: null,
        isPlaying: false, pausado: false,
        q: null,                  // pregunta en curso
        recientes: [],            // últimas operaciones, para no repetir enseguida
        falladas: [],             // operaciones falladas en la partida
        timeouts: [],
        lastRankingKey: null
    },

    TIPOS: {
        reconocer: { nombre: 'Reconocer', icono: '🔎', velocidad: [2500, 5000] },
        igualdad: { nombre: 'Elige la igualdad', icono: '⚖️', velocidad: [4000, 8000] },
        arrastrar: { nombre: 'Arrastrar', icono: '✋', velocidad: [8000, 15000] },
        mezcla: { nombre: 'Todo junto', icono: '🧩', velocidad: [4000, 8000] }
    },
    MODOS: { timeattack: 'CONTRARRELOJ', sudden_death: 'MUERTE SÚBITA', survival: 'SUPERVIVENCIA', practice: 'PRÁCTICA' },
    // Cuenta atrás 3-2-1 antes de empezar: desactivada (no hay modo con ranking compartido)
    CUENTA_ATRAS: false,
    ANONIMO: 'Anónimo',
    MULT_NIVEL: { 1: 1, 2: 1.5, 3: 2 },
    DESC_NIVEL: {
        1: 'Nivel 1 · sumas con números pequeños (del 2 al 9).',
        2: 'Nivel 2 · también restas y el factor común a la izquierda o a la derecha.',
        3: 'Nivel 3 · números mayores, el factor común en cualquier sitio y trampas con divisiones.',
        0: 'Mixto · mezcla los tres niveles.'
    },

    // --- ALMACENAMIENTO (todo local, sin cuentas) ---
    leer(k, def) { try { const v = localStorage.getItem('distributiva.' + k); return v === null ? def : JSON.parse(v); } catch (e) { return def; } },
    guardar(k, v) { try { localStorage.setItem('distributiva.' + k, JSON.stringify(v)); } catch (e) {} },

    later(fn, ms) { const id = setTimeout(fn, ms); this.state.timeouts.push(id); return id; },
    clearLater() { this.state.timeouts.forEach(clearTimeout); this.state.timeouts = []; },
    $(id) { return document.getElementById(id); },

    // --- NAVEGACIÓN ---
    showScreen(screenId, sinSonido) {
        if (!sinSonido) Sonido.efecto('click');
        document.body.classList.toggle('en-juego', screenId === 'screen-game');     // el botón de opciones no se ve durante la partida
        document.querySelectorAll('.screen').forEach(s => {
            s.classList.remove('active');
            setTimeout(() => { if (!s.classList.contains('active')) s.classList.add('hidden'); }, 400);
        });
        const target = this.$(screenId);
        target.classList.remove('hidden');
        setTimeout(() => target.classList.add('active'), 50);

        if (screenId === 'screen-home') this.seguirCinta(900);
        if (screenId === 'screen-ranking') this.abrirRanking();
        if (screenId === 'screen-config') this.pintarConfig();
        if (screenId === 'screen-config' || screenId === 'screen-results') { this.ajustarPanel(screenId); setTimeout(() => this.ajustarPanel(screenId), 450); }
        if (['screen-home', 'screen-modes', 'screen-config'].includes(screenId)) Sonido.musica('menu');
        else if (screenId === 'screen-results' || screenId === 'screen-ranking') Sonido.musica('fin');
    },

    /* Ajusta el contenido de un panel al alto disponible (sin scroll) reduciéndolo un poco si hace falta */
    ajustarPanel(screenId) {
        const pantalla = this.$(screenId); if (!pantalla) return;
        const panel = pantalla.querySelector('.glass-panel'), cont = pantalla.querySelector('.panel-contenido');
        if (!panel || !cont) return;
        cont.style.zoom = 1;
        let z = 1;
        while (panel.scrollHeight > panel.clientHeight + 1 && z > 0.7) { z -= 0.04; cont.style.zoom = z.toFixed(2); }
    },

    // --- INICIALIZACIÓN ---
    init() {
        const nameInput = this.$('player-name'), btnStart = this.$('btn-start');
        const guardado = this.leer('nombre', '');
        if (guardado) { nameInput.value = guardado; this.state.playerName = guardado; }

        const cfg = this.leer('config', {});
        if (this.TIPOS[cfg.actividad]) this.state.actividad = cfg.actividad;
        if ([0, 1, 2, 3].includes(cfg.nivel)) this.state.nivel = cfg.nivel;
        if ([30, 60, 90, 120].includes(cfg.tiempo)) this.state.tiempo = cfg.tiempo;

        nameInput.addEventListener('input', e => { this.state.playerName = e.target.value.trim(); });
        const empezar = () => {
            // sin nombre se juega como «Anónimo» (y no se guarda: la próxima vez el campo sale vacío)
            const nombre = nameInput.value.trim();
            this.state.playerName = nombre || this.ANONIMO;
            this.guardar('nombre', nombre);
            this.showScreen('screen-modes');
        };
        nameInput.addEventListener('keydown', e => { if (e.key === 'Enter') { nameInput.blur(); empezar(); } });
        btnStart.addEventListener('click', empezar);

        document.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => this.showScreen(b.dataset.go)));

        document.querySelectorAll('.mode-card').forEach(card => card.addEventListener('click', () => {
            this.state.mode = card.dataset.mode;
            this.showScreen('screen-config');
        }));
        document.querySelectorAll('.activity-card').forEach(card => card.addEventListener('click', () => {
            Sonido.efecto('click');
            this.state.actividad = card.dataset.actividad;
            this.pintarConfig();
        }));
        this.$('level-seg').addEventListener('click', e => {
            const b = e.target.closest('button'); if (!b) return;
            Sonido.efecto('click');
            this.state.nivel = parseInt(b.dataset.nivel, 10);
            this.pintarConfig();
            this.ajustarPanel('screen-config');
        });
        this.$('time-seg').addEventListener('click', e => {
            const b = e.target.closest('button'); if (!b) return;
            Sonido.efecto('click');
            this.state.tiempo = parseInt(b.dataset.tiempo, 10);
            this.pintarConfig();
        });
        this.$('btn-play').addEventListener('click', () => {
            this.guardar('config', { actividad: this.state.actividad, nivel: this.state.nivel, tiempo: this.state.tiempo });
            this.startGame();
        });

        this.$('btn-abort').addEventListener('click', () => this.abortar());
        this.$('btn-retry').addEventListener('click', () => { Sonido.efecto('click'); this.startGame(); });
        this.$('btn-otra-actividad').addEventListener('click', () => this.showScreen('screen-config'));   // el mismo modo, otra actividad / nivel
        this.$('btn-change-name').addEventListener('click', () => this.abrirCambioNombre());
        this.$('btn-name-cancel').addEventListener('click', () => { Sonido.efecto('click'); cerrarModal(this.$('modal-change-name')); });
        this.$('btn-name-ok').addEventListener('click', () => this.confirmarNombre());
        this.$('new-player-name').addEventListener('keydown', e => { if (e.key === 'Enter') this.confirmarNombre(); });

        this.$('ranking-mode-select').addEventListener('change', () => this.renderRanking());
        this.$('ranking-activity-select').addEventListener('change', () => this.renderRanking());

        window.addEventListener('resize', () => {
            this.ajustarTablero();
            ['screen-config', 'screen-results'].forEach(id => { if (this.$(id).classList.contains('active')) this.ajustarPanel(id); });
            this.posicionarCinta();
        });
        if (document.fonts) document.fonts.addEventListener('loadingdone', () => this.ajustarTablero());
        document.addEventListener('keydown', e => this.teclado(e));
        if (window.ResizeObserver) { const pp = document.querySelector('#screen-home .glass-panel'); if (pp) new ResizeObserver(() => this.posicionarCinta()).observe(pp); }
        this.seguirCinta(900);
        this.pintarConfig();
    },

    /* la cinta «v1.0» se coloca sobre la esquina superior derecha de la tarjeta del menú principal */
    posicionarCinta() {
        const sec = this.$('screen-home'), c = sec && sec.querySelector('.cinta-version'), p = sec && sec.querySelector('.glass-panel');
        if (!c || !p) return;
        // medidas de maquetación (offset*), no getBoundingClientRect: la pantalla entra con un scale() y la cinta, que está dentro, ya se escala con ella
        let x = 0, y = 0, el = p;
        while (el && el !== sec) { x += el.offsetLeft; y += el.offsetTop; el = el.offsetParent; }
        Object.assign(c.style, { left: x + 'px', top: y + 'px', width: p.offsetWidth + 'px', height: p.offsetHeight + 'px',
            borderRadius: getComputedStyle(p).borderTopRightRadius });
    },
    /* mientras la tarjeta entra con su animación, la cinta la sigue en cada fotograma (si no, se ve un momento fuera de su sitio) */
    seguirCinta(ms) {
        const fin = performance.now() + ms;
        const paso = () => { this.posicionarCinta(); if (performance.now() < fin) requestAnimationFrame(paso); };
        paso();
    },

    pintarConfig() {
        const s = this.state;
        document.querySelectorAll('.activity-card').forEach(c => c.classList.toggle('selected', c.dataset.actividad === s.actividad));
        document.querySelectorAll('#level-seg button').forEach(b => b.classList.toggle('selected', parseInt(b.dataset.nivel, 10) === s.nivel));
        document.querySelectorAll('#time-seg button').forEach(b => b.classList.toggle('selected', parseInt(b.dataset.tiempo, 10) === s.tiempo));
        this.$('time-row').style.display = s.mode === 'timeattack' ? '' : 'none';
        this.$('level-hint').textContent = this.DESC_NIVEL[s.nivel];
        this.$('config-title').textContent = this.MODOS[s.mode].charAt(0) + this.MODOS[s.mode].slice(1).toLowerCase() + ' · ¿qué quieres practicar?';
    },

    abrirCambioNombre() {
        Sonido.efecto('click');
        const input = this.$('new-player-name');
        input.value = this.state.playerName === this.ANONIMO ? '' : this.state.playerName;
        abrirModal(this.$('modal-change-name'));
        input.focus();
    },
    confirmarNombre() {
        Sonido.efecto('click');
        const val = this.$('new-player-name').value.trim();
        this.state.playerName = val || this.ANONIMO;       // vacío: «Anónimo»
        this.guardar('nombre', val);
        this.$('player-name').value = val;
        this.$('btn-start').disabled = false;
        cerrarModal(this.$('modal-change-name'));
    },

    // --- OPERACIONES ---
    /* Reconocer: «quitando el paréntesis», «sacando factor común» o «no se puede» (a partes iguales); Elige la igualdad y Arrastrar solo usan las operaciones que sí se pueden transformar (en los dos sentidos) */
    nuevaOperacion(tipo) {
        const s = this.state;
        const nivel = s.nivel || Dist.elegir([1, 2, 3]);
        const forma = tipo === 'reconocer' ? Dist.elegir(['rep', 'fac', 'no']) : Dist.elegir(['rep', 'fac']);
        let op = null;
        for (let i = 0; i < 14; i++) {
            op = Dist.generar(nivel, forma);
            if (!s.recientes.includes(op.clave)) break;
        }
        s.recientes.push(op.clave);
        if (s.recientes.length > 40) s.recientes.shift();
        return op;
    },

    // --- PARTIDA ---
    startGame() {
        const s = this.state;
        this.clearLater();
        clearInterval(s.timerId);
        if (this.arrastre) { this.arrastre.destruir(); this.arrastre = null; }
        Object.assign(s, { score: 0, streak: 0, maxStreak: 0, total: 0, aciertos: 0, lives: 3, q: null, falladas: [], recientes: [], isPlaying: false, pausado: false });
        Voz.parar();
        updateStreak(0);
        this.$('hud-score').textContent = '0';
        this.$('question-area').innerHTML = '';
        this.$('question-text').innerHTML = '';
        this.$('step-indicator').innerHTML = '';
        this.$('answer-note').innerHTML = '';
        document.querySelector('.game-board').classList.remove('shake');      // nada de la partida anterior (sacudida de fallo) se arrastra a la nueva
        this.$('feedback-overlay').className = 'feedback-fx';

        const hudTimer = this.$('hud-time-container'), hudLives = this.$('hud-lives-container'), hudScore = this.$('hud-score-container');
        this.$('hud-time').classList.remove('danger');
        hudScore.classList.remove('centered');
        hudTimer.classList.remove('hidden');
        hudLives.classList.add('hidden');
        this.$('hud-time-label').textContent = 'TIEMPO';

        this.$('current-mode-name').textContent = this.MODOS[s.mode];
        this.$('current-activity-name').textContent = this.TIPOS[s.actividad].nombre.toUpperCase();
        this.$('btn-abort').textContent = s.mode === 'practice' ? '🏁 Terminar' : '✖ Abortar';

        if (s.mode === 'timeattack') {
            s.timeRemaining = s.tiempo;
        } else if (s.mode === 'sudden_death') {
            hudTimer.classList.add('hidden');
            hudScore.classList.add('centered');
        } else if (s.mode === 'survival') {
            hudLives.classList.remove('hidden');
            this.$('hud-time-label').textContent = 'RELOJ';
            s.timeRemaining = 20;
            this.pintarVidas();
        } else {   // práctica: reloj que sube
            s.timeRemaining = 0;
        }
        this.pintarTiempo();

        this.showScreen('screen-game', true);
        Sonido.musica(s.mode, true);   // cada partida empieza su música desde el principio

        const comenzar = () => {
            s.isPlaying = true;
            if (s.mode !== 'sudden_death') this.iniciarReloj();
            this.siguientePregunta();
        };
        if (s.mode === 'practice' || !this.CUENTA_ATRAS) {
            if (s.mode !== 'practice') Sonido.efecto('start');
            comenzar();
        } else {
            Sonido.efecto('start');
            showCountdown(comenzar, '<div class="countdown-header">' + this.MODOS[s.mode] + ' · ' + this.TIPOS[s.actividad].nombre + '</div>');
        }
    },

    async abortar() {
        const s = this.state;
        Sonido.efecto('click');
        if (s.mode === 'practice' && s.isPlaying) { this.endGame(); return; }
        if (s.isPlaying) {
            const ok = await confirmDialog('Se perderá esta partida.', { title: '¿Abandonar?', icon: '🚪', okText: 'Abandonar', cancelText: 'Seguir jugando', danger: true });
            if (!ok || !s.isPlaying) return;
        }
        s.isPlaying = false;
        Voz.parar();
        clearInterval(s.timerId);
        this.clearLater();
        if (this.arrastre) { this.arrastre.destruir(); this.arrastre = null; }
        this.showScreen('screen-home');
    },

    iniciarReloj() {
        const s = this.state;
        clearInterval(s.timerId);
        s.timerId = setInterval(() => {
            if (!s.isPlaying || s.pausado) return;          // pausado: mientras se explica un fallo
            if (s.mode === 'practice') s.timeRemaining++;
            else s.timeRemaining--;
            this.pintarTiempo();
            const hudTime = this.$('hud-time');
            const peligro = (s.mode === 'timeattack' && s.timeRemaining <= 10) || (s.mode === 'survival' && s.timeRemaining <= 5);
            hudTime.classList.toggle('danger', peligro);
            if (peligro && s.timeRemaining > 0) Sonido.efecto('click', 0.25);

            if (s.mode !== 'practice' && s.timeRemaining <= 0) {
                if (s.mode === 'survival') this.tiempoAgotadoPregunta();
                else this.endGame();
            }
        }, 1000);
    },

    pintarTiempo() {
        const t = Math.max(0, this.state.timeRemaining);
        this.$('hud-time').textContent = String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0');
    },
    pintarVidas() { this.$('hud-lives').textContent = '❤️'.repeat(Math.max(0, this.state.lives)) || '💔'; },

    // --- PREGUNTAS ---
    siguientePregunta() {
        const s = this.state;
        if (!s.isPlaying) return;
        if (this.arrastre) { this.arrastre.destruir(); this.arrastre = null; }
        const tipo = s.actividad === 'mezcla' ? Dist.elegir(['reconocer', 'igualdad', 'arrastrar']) : s.actividad;
        const op = this.nuevaOperacion(tipo);
        const q = { tipo, op, nivel: op.nivel, resuelta: false, inicio: Date.now() };
        if (tipo === 'igualdad') q.opciones = Dist.opcionesIgualdad(op);
        if (tipo === 'arrastrar') q.plantilla = Dist.plantillaArrastre(op);
        s.q = q;
        if (s.mode === 'survival') {
            s.timeRemaining = Math.max(8, 20 - Math.floor(s.aciertos / 5));
            this.pintarTiempo();
            this.$('hud-time').classList.remove('danger');
        }
        this.$('answer-note').innerHTML = '';
        this.pintarPregunta();
    },

    /* la operación como fichas (mismas clases que en la explicación) */
    exprHTML(tokens) { return tokens.map(t => '<span class="tk tk-' + t.k + '">' + esc(t.v) + '</span>').join(''); },

    pintarPregunta() {
        const q = this.state.q, op = q.op, area = this.$('question-area'), texto = this.$('question-text');
        area.classList.remove('bloqueado');
        const ind = this.$('step-indicator');
        ind.innerHTML = this.state.actividad === 'mezcla' ? this.TIPOS[q.tipo].icono + ' ' + this.TIPOS[q.tipo].nombre : '';

        if (q.tipo === 'reconocer') {
            texto.innerHTML = '¿Se puede aplicar la <b>propiedad distributiva</b>?';
            const A = '<b class="rol-a">a</b>', B = '<b class="rol-b">b</b>', C = '<b class="rol-c">c</b>';
            area.innerHTML = '<div class="expr-grande">' + this.exprHTML(op.tokens) + '</div><div class="options-grid tres">' + [
                ['parentesis', 'Sí, quitando el paréntesis', A + ' × (' + B + ' + ' + C + ') ➜ ' + A + ' × ' + B + ' + ' + A + ' × ' + C],
                ['factor', 'Sí, sacando factor común', A + ' × ' + B + ' + ' + A + ' × ' + C + ' ➜ ' + A + ' × (' + B + ' + ' + C + ')'],
                ['no', 'No, no se puede', 'No encaja']
            ].map(o => '<button type="button" class="option-btn" data-resp="' + o[0] + '"><span class="tit">' + o[1] + '</span><span class="sub">' + o[2] + '</span></button>').join('') + '</div>';
            area.querySelectorAll('.option-btn').forEach(b => b.addEventListener('click', () => this.responder(b.dataset.resp, b)));
        } else if (q.tipo === 'igualdad') {
            texto.innerHTML = op.forma === 'rep' ? '<b>Propiedad distributiva</b>: ¿qué operación vale lo mismo?' : '<b>Saca factor común</b>: ¿qué operación vale lo mismo?';
            area.innerHTML = '<div class="expr-grande">' + this.exprHTML(op.tokens) + '<span class="igual">=</span><span class="interr">?</span></div><div class="options-grid">' +
                q.opciones.map((o, i) => '<button type="button" class="option-btn" data-i="' + i + '"><span class="expr">' + esc(o.texto) + '</span></button>').join('') + '</div>';
            area.querySelectorAll('.option-btn').forEach(b => b.addEventListener('click', () => this.responder(parseInt(b.dataset.i, 10), b)));
        } else {
            texto.innerHTML = op.forma === 'rep' ? '<b>Propiedad distributiva</b>: monta la operación' : '<b>Saca factor común</b>: monta la operación';
            area.innerHTML = '<div class="expr-grande">' + this.exprHTML(op.tokens) + '</div>';
            this.arrastre = Arrastre.montar(area, op, q.plantilla);
            area.querySelector('[data-acc="borrar"]').addEventListener('click', () => { Sonido.efecto('click'); this.arrastre.borrar(); });
            area.querySelector('[data-acc="comprobar"]').addEventListener('click', () => this.comprobarArrastre());
        }
        this.$('answer-note').className = 'answer-note';
        this.ajustarTablero();
        requestAnimationFrame(() => this.ajustarTablero());
    },

    /* Si el tablero no cabe (móvil bajo, ventana pequeña), todo lo de dentro (en «em») se reduce a la vez */
    ajustarTablero() {
        const b = document.querySelector('.game-board'); if (!b || !this.$('screen-game').classList.contains('active') && !this.state.isPlaying) return;
        let esc = 1;
        b.style.setProperty('--esc', '1');
        // se mide con rectángulos reales (Range): con el contenido centrado, scrollWidth no avisa del desborde por la izquierda
        const rango = document.createRange();
        const desborda = e => {
            rango.selectNodeContents(e);
            const c = rango.getBoundingClientRect(), r = e.getBoundingClientRect(), t = b.getBoundingClientRect(), cs = getComputedStyle(b);
            const izq = t.left + parseFloat(cs.paddingLeft) - 1, der = t.right - parseFloat(cs.paddingRight) + 1;      // dentro del relleno del tablero
            return c.width > 0 && (c.width > r.width + 1 || c.left < izq || c.right > der);
        };
        const noCabe = () => b.scrollHeight > b.clientHeight + 1 || [...b.querySelectorAll('.expr-grande, .plantilla, .bandeja, .option-btn, .answer-note')].some(desborda);
        for (let n = 0; n < 16 && noCabe() && esc > 0.5; n++) { esc -= 0.04; b.style.setProperty('--esc', esc.toFixed(2)); }
    },

    comprobarArrastre() {
        const q = this.state.q;
        if (!q || q.resuelta || !this.arrastre) return;
        if (!this.arrastre.lleno()) { Sonido.efecto('click', 0.5); this.arrastre.pedirHuecos(); return; }
        this.responder(this.arrastre.valores(), null);
    },

    teclado(e) {
        const q = this.state.q;
        if (!this.state.isPlaying || !q || q.resuelta || e.ctrlKey || e.metaKey || e.altKey) return;
        if (!this.$('screen-game').classList.contains('active') || this.state.pausado) return;
        if (q.tipo === 'arrastrar') { if (e.key === 'Enter') { e.preventDefault(); this.comprobarArrastre(); } return; }
        const n = parseInt(e.key, 10);
        if (!n || n > 3) return;
        const b = this.$('question-area').querySelectorAll('.option-btn')[n - 1];
        if (b) b.click();
    },

    // --- RESPUESTAS ---
    evaluar(q, valor) {
        if (q.tipo === 'reconocer') return valor === q.op.correcta;
        if (q.tipo === 'igualdad') return !!q.opciones[valor].ok;
        return Dist.comprobarArrastre(q.op, valor);
    },

    notaRespuesta(q, ok) { return (ok ? '¡Bien! ' : '') + Dist.nota(q.op); },

    marcarCorrecto(q, valor, boton) {
        const area = this.$('question-area');
        area.classList.add('bloqueado');
        const ok = this.evaluar(q, valor);
        if (q.tipo === 'reconocer') {
            area.querySelectorAll('.option-btn').forEach(b => { if (b.dataset.resp === q.op.correcta) b.classList.add('correct'); });
            if (!ok && boton) boton.classList.add('wrong');
        } else if (q.tipo === 'igualdad') {
            area.querySelectorAll('.option-btn').forEach(b => { if (q.opciones[parseInt(b.dataset.i, 10)].ok) b.classList.add('correct'); });
            if (!ok && boton) boton.classList.add('wrong');
        } else {
            this.arrastre.marcar(ok);
            area.querySelectorAll('.acciones-arrastre button').forEach(b => b.disabled = true);
        }
        return ok;
    },

    /* lo que eligió el alumno, tal como lo necesita la explicación */
    elegidaParaExplicar(q, valor) {
        if (q.tipo === 'reconocer') return valor;
        if (q.tipo === 'igualdad') return q.opciones[valor].tokens;
        return Dist.fichasArrastre(q.op, valor);
    },

    async responder(valor, boton) {
        const s = this.state, q = s.q;
        if (!s.isPlaying || !q || q.resuelta) return;
        q.resuelta = true;
        if (boton) boton.blur();

        const ok = this.marcarCorrecto(q, valor, boton);
        const dt = Date.now() - q.inicio;
        s.total++;
        this.$('answer-note').innerHTML = this.notaRespuesta(q, ok);

        if (ok) {
            s.aciertos++;
            s.streak++;
            if (s.streak > s.maxStreak) s.maxStreak = s.streak;
            this.feedback(true);
            let extra = 0;
            if (s.mode !== 'practice') {
                const [t0, t1] = this.TIPOS[q.tipo].velocidad;
                if (dt < t0) { extra = 20; this.popup('¡Velocidad luz!', 'super'); }
                else if (dt < t1) { extra = 10; this.popup('¡Qué rápido!', 'high'); }
            }
            const puntos = Math.round((10 + extra + Math.min(s.streak, 15) * 2) * (this.MULT_NIVEL[q.nivel] || 1));
            s.score += puntos;
            this.$('hud-score').textContent = s.score;
            floatText('+' + puntos, this.$('hud-score'), 'float-good');
            updateStreak(s.streak);
            this.later(() => this.siguientePregunta(), 800);
            return;
        }

        // --- fallo ---
        s.streak = 0;
        updateStreak(0);
        if (!s.falladas.includes(q.op.clave)) s.falladas.push(q.op.clave);
        this.feedback(false);

        if (s.mode === 'survival') { s.lives--; this.pintarVidas(); }
        const terminada = s.mode === 'sudden_death' || (s.mode === 'survival' && s.lives <= 0);
        if (VozUI.explicarEn(s.mode)) {
            // explicación: el juego (y el reloj) se detiene por completo hasta que se cierra
            s.pausado = true;
            // si este fallo termina la partida (muerte súbita, o última vida en supervivencia), ya suena la música de fin
            if (terminada) Sonido.musica('fin');
            const datos = { tipo: q.tipo, q: q.op, elegida: this.elegidaParaExplicar(q, valor) };
            const animada = VozUI.explicacion();
            if (animada) Infografia.preparar(datos);      // empieza a sintetizar la narración mientras se ve la respuesta correcta
            await new Promise(r => this.later(r, 900));
            if (!s.isPlaying) return;
            await (animada ? Infografia.mostrar(datos) : Explicacion.mostrar(datos));
            s.pausado = false;
            if (!s.isPlaying) return;
            if (terminada) { this.endGame(); return; }
            this.siguientePregunta();
        } else if (VozUI.respuestaEn(s.mode)) {      // sin explicación: ventana con la respuesta correcta (el juego y el reloj se paran)
            if (terminada) Sonido.musica('fin');
            await this.mostrarRespuesta(q);
            if (!s.isPlaying) return;
            if (terminada) { this.endGame(); return; }
            this.siguientePregunta();
        } else if (s.mode === 'practice') {      // práctica sin explicaciones
            this.later(() => this.siguientePregunta(), 1800);
        } else if (s.mode === 'sudden_death') {
            this.later(() => this.endGame(), 2000);
        } else if (s.mode === 'survival') {
            if (s.lives <= 0) this.later(() => this.endGame(), 2000);
            else this.later(() => this.siguientePregunta(), 1800);
        } else {   // contrarreloj
            this.later(() => this.siguientePregunta(), 1500);
        }
    },

    /* Ventana con la respuesta correcta tras un fallo (cuando no se explica). El juego y el reloj están parados mientras está abierta;
       se cierra con el botón, Intro, espacio o Escape. Devuelve una promesa que se cumple al cerrarla. */
    mostrarRespuesta(q, titulo) {
        const s = this.state, op = q.op;
        s.pausado = true;
        return new Promise(resolve => {
            const previo = document.activeElement;
            const velo = document.createElement('div');
            velo.className = 'dialog-overlay resp-overlay';
            velo.innerHTML = '<div class="dialog-box" role="dialog" aria-modal="true" aria-labelledby="resp-titulo">' +
                '<div class="dialog-icon">💡</div>' +
                '<h3 id="resp-titulo" class="dialog-title">' + (titulo || 'La respuesta correcta') + '</h3>' +
                '<div class="resp-expr">' + esc(Dist.texto(op.tokens)) + '</div>' +
                '<p class="dialog-message">' + this.notaRespuesta(q, false) + '</p>' +
                '<div class="dialog-actions"><button type="button" class="btn-primary resp-ok">¡Entendido! Siguiente ➜</button></div>' +
                '</div>';
            document.body.appendChild(velo);
            let cerrado = false;
            const cerrar = () => {
                if (cerrado) return;
                cerrado = true;
                document.removeEventListener('keydown', onKey, true);
                Sonido.efecto('click');
                velo.classList.add('dialog-out');
                setTimeout(() => velo.remove(), 200);
                if (previo && typeof previo.focus === 'function') previo.focus();
                s.pausado = false;
                resolve();
            };
            const onKey = ev => { if (ev.key === 'Escape' || ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); ev.stopPropagation(); cerrar(); } };
            document.addEventListener('keydown', onKey, true);
            velo.querySelector('.resp-ok').addEventListener('click', cerrar);
            setTimeout(() => { const bt = velo.querySelector('.resp-ok'); if (bt && !cerrado) bt.focus({ preventScroll: true }); }, 50);
        });
    },

    tiempoAgotadoPregunta() {      // supervivencia: se acabó el reloj de la pregunta
        const s = this.state, q = s.q;
        if (!q || q.resuelta) return;
        q.resuelta = true;
        this.$('question-area').classList.add('bloqueado');
        s.total++;
        s.streak = 0;
        updateStreak(0);
        if (!s.falladas.includes(q.op.clave)) s.falladas.push(q.op.clave);
        s.lives--;
        this.pintarVidas();
        this.$('answer-note').innerHTML = '⏰ ¡Tiempo! ' + this.notaRespuesta(q, false);
        this.feedback(false);
        if (VozUI.respuestaEn(s.mode) && !VozUI.explicarEn(s.mode)) {      // ventana con la respuesta (el reloj se para mientras está abierta)
            (async () => {
                if (s.lives <= 0) Sonido.musica('fin');
                await this.mostrarRespuesta(q, '⏰ ¡Se acabó el tiempo!');
                if (!s.isPlaying) return;
                if (s.lives <= 0) this.endGame(); else this.siguientePregunta();
            })();
            return;
        }
        if (s.lives <= 0) this.later(() => this.endGame(), 2000);
        else this.later(() => this.siguientePregunta(), 1800);
    },

    feedback(ok) {
        Sonido.efecto(ok ? 'acierto' : 'error');
        const overlay = this.$('feedback-overlay');
        // el color no se quita al acabar (si no, desaparecía de golpe): solo se sube y se baja la opacidad, con un fundido rápido
        clearTimeout(this._tFeedback);
        overlay.className = 'feedback-fx ' + (ok ? 'correct' : 'wrong');
        void overlay.offsetWidth;
        overlay.classList.add('on');
        if (!ok) restartAnimation(document.querySelector('.game-board'), 'shake');
        this._tFeedback = setTimeout(() => { overlay.classList.remove('on'); }, 220);
    },

    popup(texto, clase) {
        const board = document.querySelector('.game-board');
        const pop = document.createElement('div');
        pop.className = 'speed-popup speed-text-' + clase;
        pop.textContent = texto;
        board.appendChild(pop);
        setTimeout(() => pop.remove(), 1200);
    },

    // --- FIN DE PARTIDA ---
    endGame() {
        const s = this.state;
        if (!s.isPlaying) return;
        Voz.parar();
        s.isPlaying = false;
        clearInterval(s.timerId);
        this.clearLater();
        if (this.arrastre) { this.arrastre.destruir(); this.arrastre = null; }

        const precision = s.total > 0 ? Math.round(s.aciertos / s.total * 100) : 0;
        animateCount(this.$('res-score'), s.score);
        this.$('res-jugador').textContent = s.playerName;
        this.$('res-accuracy').textContent = precision + '%';
        this.$('res-streak').textContent = s.maxStreak;
        this.$('res-detail').textContent = this.MODOS[s.mode].charAt(0) + this.MODOS[s.mode].slice(1).toLowerCase() +
            ' · ' + this.TIPOS[s.actividad].nombre + ' · ' + (s.nivel ? 'nivel ' + s.nivel : 'nivel mixto') +
            ' · ' + s.aciertos + ' de ' + s.total + ' correctas';

        const rep = this.$('res-repasar');
        if (s.falladas.length) {
            rep.innerHTML = '<b>Para repasar:</b><br>' + s.falladas.slice(0, 8).map(w => '<span class="pal">' + esc(w) + '</span>').join('');
        } else rep.innerHTML = s.total ? '¡Sin ninguna operación para repasar!' : '';

        const msg = this.$('res-message');
        if (!s.total) msg.textContent = 'Esta vez no ha dado tiempo a responder.';
        else if (precision >= 90) msg.textContent = '¡Maestro de la distributiva!';
        else if (precision >= 70) msg.textContent = '¡Muy buen trabajo!';
        else if (precision >= 50) msg.textContent = 'Vas por buen camino. ¡Sigue practicando!';
        else msg.textContent = 'Repasa las operaciones de arriba y vuelve a intentarlo.';

        if (s.mode !== 'practice' && s.score > 0) this.guardarRanking();
        if (precision >= 90 && s.total >= 8) launchConfetti();

        this.later(() => this.showScreen('screen-results', true), 600);
    },

    // --- RANKING LOCAL ---
    claveRanking(modo, tiempo) { return modo === 'timeattack' ? 'timeattack_' + tiempo : modo; },

    guardarRanking() {
        const s = this.state;
        const modoKey = this.claveRanking(s.mode, s.tiempo);
        const clave = modoKey + '|' + s.actividad;
        const todos = this.leer('ranking', {});
        const lista = todos[clave] || [];
        lista.push({ name: s.playerName, score: s.score, date: new Date().toLocaleDateString('es-ES') });
        lista.sort((a, b) => b.score - a.score);
        todos[clave] = lista.slice(0, 10);
        this.guardar('ranking', todos);
        s.lastRankingKey = { modo: modoKey, actividad: s.actividad };
    },

    abrirRanking() {
        const k = this.state.lastRankingKey;
        if (k) {
            this.$('ranking-mode-select').value = k.modo;
            this.$('ranking-activity-select').value = k.actividad;
        }
        this.renderRanking();
    },

    renderRanking() {
        const clave = this.$('ranking-mode-select').value + '|' + this.$('ranking-activity-select').value;
        const datos = this.leer('ranking', {})[clave] || [];
        const tbody = this.$('ranking-body');
        tbody.innerHTML = '';
        if (!datos.length) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center muted">Aún no hay puntuaciones.</td></tr>';
            return;
        }
        datos.forEach((e, i) => {
            const tr = document.createElement('tr');
            tr.innerHTML = '<td>' + (i + 1) + '</td><td>' + esc(e.name) + '</td><td>' + esc(e.score) + '</td><td>' + esc(e.date) + '</td>';
            tbody.appendChild(tr);
        });
    }
};

document.addEventListener('DOMContentLoaded', () => app.init());
