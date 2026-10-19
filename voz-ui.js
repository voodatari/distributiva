/* =========================================================
   Voz · interfaz: opciones e indicador de carga
   - «Explicación con voz»: al fallar se muestra la infografía animada narrada (si no, la explicación escrita)
   - «Explicar los fallos»: No · En práctica · Siempre (por defecto; también en contrarreloj, muerte súbita y supervivencia: el juego se pausa)
   - «Ver la respuesta al fallar»: ventana con la respuesta correcta cuando no se explica
   El motor (Piper) se carga entero al entrar en la web y se queda en memoria; los ajustes se guardan en localStorage.
   ========================================================= */
window.VozUI = (function () {

    var K_EXP = 'distributiva.explicaAnimada', K_CUANDO = 'distributiva.explicarFallos', K_RESP = 'distributiva.verRespuesta';
    function leer(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
    function escribir(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
    function $(id) { return document.getElementById(id); }

    var explica = leer(K_EXP) !== '0';        // activada por defecto
    var cuando = leer(K_CUANDO); if (['no', 'practica', 'siempre'].indexOf(cuando) < 0) cuando = 'siempre';     // por defecto: en todos los modos
    var verRespuesta = leer(K_RESP) === '1';     // ventana con la respuesta correcta al fallar, también en los demás modos (en práctica siempre, si no se explica)
    var chip = $('voz-carga'), texto = $('voz-carga-texto'), barra = $('voz-carga-barra');
    var botonExp = $('voz-explica-button'), botonResp = $('resp-toggle-button'), segCuando = $('explicar-seg');
    var ocultar = null;

    function pintar() {
        botonExp.setAttribute('aria-pressed', String(explica));
        botonResp.setAttribute('aria-pressed', String(verRespuesta));
        segCuando.querySelectorAll('button').forEach(function (b) { b.classList.toggle('selected', b.dataset.explicar === cuando); });
    }

    function esconderChip(ms) {
        ocultar = setTimeout(function () { chip.classList.add('fuera'); setTimeout(function () { chip.classList.add('hidden'); }, 450); }, ms);
    }

    /* indicador de carga: se muestra mientras se descarga y se inicia el modelo */
    function alProgreso(f, estado) {
        clearTimeout(ocultar);
        if (estado === 'cargando' && f < 1) {
            chip.classList.remove('hidden', 'fuera', 'error');
            texto.textContent = '🗣️ Cargando la voz… ' + Math.round(f * 100) + ' %';
            barra.style.width = Math.round(f * 100) + '%';
        } else if (estado === 'lista') {
            barra.style.width = '100%';
            texto.textContent = '✓ Voz lista';
            chip.classList.remove('hidden', 'error');
            esconderChip(1300);
        } else if (estado === 'error') {
            chip.classList.remove('hidden', 'fuera'); chip.classList.add('error');
            texto.textContent = 'No se pudo cargar la voz: el juego sigue sin ella';
            esconderChip(4500);
        }
    }

    function cargar() {
        if (!explica) return;
        // que el navegador no borre la voz guardada en el dispositivo cuando le falte espacio (si lo permite)
        try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {}); } catch (e) {}
        Voz.iniciar(alProgreso).catch(function () {});
    }

    function sonar() { if (window.Sonido) Sonido.efecto('click'); }

    botonExp.addEventListener('click', function () {
        sonar(); explica = !explica; escribir(K_EXP, explica ? '1' : '0'); if (explica) cargar(); else Voz.parar(); pintar();
    });

    botonResp.addEventListener('click', function () {
        sonar(); verRespuesta = !verRespuesta; escribir(K_RESP, verRespuesta ? '1' : '0'); pintar();
    });

    segCuando.addEventListener('click', function (e) {
        var b = e.target.closest('button'); if (!b) return;
        sonar(); cuando = b.dataset.explicar; escribir(K_CUANDO, cuando); pintar();
    });

    // empieza a cargar en cuanto se entra en la web
    cargar();
    pintar();

    return {
        explicacion: function () { return explica; },
        /* ¿se explica un fallo en este modo de juego? */
        explicarEn: function (modo) { return cuando === 'siempre' || (cuando === 'practica' && modo === 'practice'); },
        /* ¿se muestra la ventana con la respuesta correcta? Solo si no se explica: en práctica siempre; en los demás modos si el jugador lo activa */
        respuestaEn: function (modo) { return !(cuando === 'siempre' || (cuando === 'practica' && modo === 'practice')) && (modo === 'practice' || verRespuesta); }
    };

})();
