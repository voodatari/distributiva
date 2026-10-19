/* =========================================================
   Infografía animada con voz · explicación paso a paso de un error
   Cada explicación se divide en «pasos» (beats): una animación en pantalla + frases que lee Piper.
   Las frases se sintetizan por adelantado en el worker de voz, así que el paso siguiente suena sin esperas.
   Si la voz no está disponible, las animaciones siguen solas, con el tiempo de lectura de cada frase.

   Infografia.mostrar(datos)  → promesa que se resuelve al cerrarla
   Infografia.preparar(datos) → empieza a sintetizar las frases (llamar en cuanto se falla)
   Infografia.guion(datos)    → { q, beats } (la versión escrita usa los mismos textos: explicacion.js)

   datos = { tipo: 'reconocer' | 'igualdad' | 'arrastrar', q: <operación>, elegida: … }
     reconocer → elegida: 'parentesis' | 'factor' | 'no' (solo sale en las etiquetas de arriba; la explicación no tiene un paso que las lea)
     igualdad  → elegida: fichas de la igualdad que eligió el alumno
     arrastrar → elegida: fichas de lo que montó el alumno

   La escena mueve las MISMAS fichas de la operación de una forma a la otra (a × (b + c) ⇄ a × b + a × c) y las acompaña con un
   dibujo de puntos (a filas de b + c puntos) que se separa en dos bloques o se junta en uno.
   ========================================================= */
window.Infografia = (function () {

    var MUL = Dist.MUL, MAS = Dist.MAS, MEN = Dist.MEN;

    function el(tag, cls, html) { var x = document.createElement(tag); if (cls) x.className = cls; if (html != null) x.innerHTML = html; return x; }
    /* número con el color de su papel (a amarillo · b azul · c naranja) */
    function N(rol, v) { return '<b class="rol-' + rol + '">' + v + '</b>'; }

    /* tiempos (ms): silencio entre frases y entre pasos */
    var PAUSA_FRASE = 650, PAUSA_PASO = 1200;

    var NOMBRE_ACCION = { parentesis: 'Sí, quitando el paréntesis', factor: 'Sí, sacando factor común', no: 'No, no se puede' };

    /* ---------- guiones ---------- */
    /* Las dos etiquetas de arriba («Tu respuesta» / «Correcta») se ven desde el primer paso y durante toda la explicación;
       no hay un paso aparte que las lea (la respuesta correcta se llega a explicar en el último paso). */
    function etiquetas(d) {
        if (d.tipo === 'reconocer') return { mal: NOMBRE_ACCION[d.elegida], bien: NOMBRE_ACCION[d.q.correcta] };
        return { mal: Dist.texto(d.elegida), bien: d.q.forma === 'no' ? '' : Dist.texto(Dist.despues(d.q)) };
    }
    function beatTitulo(d) {
        var q = d.q, t = etiquetas(d);
        return {
            cap: 'Vamos a mirar <b>' + Dist.texto(q.tokens) + '</b>',
            voz: ['Vamos a mirar esta operación, ' + Dist.voz(q) + '.'],
            anim: function (e) { e.pildoras(t.mal, t.bien); e.expr(Dist.antes(q)); }
        };
    }

    /* «Elige la igualdad» y «Arrastrar»: si lo que montó el alumno NO vale lo mismo, se comprueba con números */
    function beatTuIgualdad(d) {
        if (d.tipo === 'reconocer') return null;
        var q = d.q, v = Dist.valores(q), u = Dist.valorFichas(d.elegida);
        if (u == null || u === v.T) return null;
        var mia = Dist.texto(d.elegida);
        return {
            cap: 'Comprobamos tu igualdad: <b>' + Dist.texto(q.tokens) + ' = ' + v.T + '</b>, pero <b>' + mia + ' = <span class="ig-mal">' + u + '</span></b>. ¡No son iguales!',
            voz: ['Vamos a comprobar tu igualdad.', 'La operación de partida da ' + v.T + '.', 'Pero la tuya da ' + u + '.', 'No son iguales, así que no vale.'],
            anim: function (e) {
                e.centro('calculos');
                e.calculos([Dist.texto(q.tokens) + ' = <b>' + v.T + '</b>', mia + ' = <b class="ig-mal">' + u + '</b>']);
            },
            seg: function (e, i) { if (i === 1) e.verCalculo(0); else if (i === 2) e.verCalculo(1); else if (i === 3) e.marca(false, '¡No coinciden!'); }
        };
    }

    function guionDistributiva(q) {
        var a = q.a, b = q.b, c = q.c, V = Dist.valores(q), suma = q.op === MAS, izq = q.sub === 'izq', op = q.op;
        var pal = Dist.palabraOp(op), nom = Dist.nombreOp(op), antes = Dist.antes(q), desp = Dist.despues(q);
        var B = [];

        B.push({
            cap: izq ? 'El ' + N('a', a) + ' multiplica a <b>todo lo que hay dentro del paréntesis</b>, donde hay una <b>' + nom + '</b>.'
                     : 'Todo el paréntesis, donde hay una <b>' + nom + '</b>, se multiplica por ' + N('a', a) + '.',
            voz: izq ? ['El ' + a + ' multiplica a todo lo que hay dentro del paréntesis.', 'Y dentro del paréntesis hay una ' + nom + ', de ' + b + ' ' + pal + ' ' + c + '.']
                     : ['Todo lo que hay dentro del paréntesis se multiplica por ' + a + '.', 'Y dentro del paréntesis hay una ' + nom + ', de ' + b + ' ' + pal + ' ' + c + '.'],
            anim: function (e) { e.colorear(true); },
            seg: function (e, i) { e.limpiarResaltes(); if (i === 0) e.pulso(['a1']); else { e.pulso(['b', 'op', 'c']); e.bocadillo(nom); } }
        });

        B.push({
            cap: suma
                ? (izq ? 'Lo dibujamos con puntos: <b>' + a + ' filas</b>, y en cada fila ' + N('b', b) + ' puntos azules y ' + N('c', c) + ' naranjas.'
                       : 'Lo dibujamos con puntos: <b>' + (b + c) + ' columnas</b> de ' + N('a', a) + ' puntos; ' + N('b', b) + ' azules y ' + N('c', c) + ' naranjas.')
                : (izq ? 'Lo dibujamos con puntos: <b>' + a + ' filas</b> de ' + N('b', b) + ' puntos. De cada fila vamos a quitar ' + N('c', c) + ', los naranjas.'
                       : 'Lo dibujamos con puntos: <b>' + b + ' columnas</b> de ' + N('a', a) + ' puntos. Vamos a quitar ' + N('c', c) + ' columnas, las naranjas.'),
            voz: suma
                ? (izq ? ['Lo vamos a dibujar con puntos.', 'Hacemos ' + a + ' filas.', 'En cada fila ponemos ' + b + ' puntos azules,', 'y ' + c + ' puntos naranjas.']
                       : ['Lo vamos a dibujar con puntos.', 'Hacemos ' + (b + c) + ' columnas de ' + a + ' puntos.', 'Hay ' + b + ' columnas azules,', 'y ' + c + ' columnas naranjas.'])
                : (izq ? ['Lo vamos a dibujar con puntos.', 'Hacemos ' + a + ' filas de ' + b + ' puntos.', 'Y de cada fila vamos a quitar ' + c + ' puntos, los naranjas.']
                       : ['Lo vamos a dibujar con puntos.', 'Hacemos ' + b + ' columnas de ' + a + ' puntos.', 'Y vamos a quitar ' + c + ' columnas, las naranjas.']),
            anim: function (e) { e.limpiarResaltes(); e.centro('modelo'); e.modelo({ vis: true }); },
            seg: function (e, i) {
                if (suma) { if (i === 1) e.pulsoModelo('izq'); else if (i === 2) e.pulsoModelo('b'); else if (i === 3) e.pulsoModelo('c'); }
                else { if (i === 1) e.pulsoModelo('izq'); else if (i === 2) e.pulsoModelo('c'); }
            }
        });

        B.push(suma ? {
            cap: 'Separamos los colores: ahora hay <b>dos bloques</b>.',
            voz: ['Separamos los dos colores.', 'Ahora tenemos dos bloques.'],
            anim: function (e) { e.modelo({ sep: true }); }
        } : {
            cap: 'Quitamos los puntos naranjas ' + (izq ? 'de cada fila' : 'de cada columna') + '. Queda el bloque azul.',
            voz: ['Quitamos los puntos naranjas ' + (izq ? 'de cada fila' : 'de cada columna') + '.', 'Lo que queda es el bloque azul.'],
            anim: function (e) { e.modelo({ quitado: true }); }
        });

        B.push(suma ? {
            cap: 'El bloque azul es <b>' + N('a', a) + ' × ' + N('b', b) + ' = ' + V.X + '</b> y el naranja es <b>' + N('a', a) + ' × ' + N('c', c) + ' = ' + V.Y + '</b>.',
            voz: ['El bloque azul tiene ' + a + ' por ' + b + ', que son ' + V.X + ' puntos.', 'Y el naranja tiene ' + a + ' por ' + c + ', que son ' + V.Y + ' puntos.'],
            anim: function (e) { e.modelo({ eti: '' }); },
            seg: function (e, i) { e.modelo({ eti: i === 0 ? 'b' : 'bc' }); }
        } : {
            cap: 'Antes había <b>' + N('a', a) + ' × ' + N('b', b) + ' = ' + V.X + '</b> puntos y hemos quitado <b>' + N('a', a) + ' × ' + N('c', c) + ' = ' + V.Y + '</b>.',
            voz: ['Al principio teníamos ' + a + ' por ' + b + ', que son ' + V.X + ' puntos.', 'Y hemos quitado ' + a + ' por ' + c + ', que son ' + V.Y + '.'],
            anim: function (e) { e.modelo({ eti: '' }); },
            seg: function (e, i) { e.modelo({ eti: i === 0 ? 'b' : 'bc' }); }
        });

        B.push({
            cap: 'Pasamos el dibujo a números: el ' + N('a', a) + ' multiplica a <b>cada</b> número del paréntesis.',
            voz: ['Ahora lo escribimos con números.', 'El ' + a + ' multiplica al ' + b + ', y también multiplica al ' + c + '.', 'Y el paréntesis ya no hace falta.'],
            anim: function (e) { e.limpiarResaltes(); },
            seg: function (e, i) { if (i === 1) { e.expr(desp); e.pulso(['a1', 'a2']); } }
        });

        var lineaIzq = Dist.textoHTML(antes) + ' = ' + (izq ? a + ' ' + MUL + ' ' + V.S : V.S + ' ' + MUL + ' ' + a) + ' = <b>' + V.T + '</b>';
        var lineaDer = Dist.textoHTML(desp) + ' = ' + V.X + ' ' + op + ' ' + V.Y + ' = <b>' + V.T + '</b>';
        B.push({
            cap: 'Comprobamos: <b>las dos dan lo mismo</b>.',
            voz: ['Vamos a comprobarlo.', 'Con el paréntesis, ' + b + ' ' + pal + ' ' + c + ' son ' + V.S + ', y ' + a + ' por ' + V.S + ' son ' + V.T + '.',
                'Con la propiedad distributiva, ' + a + ' por ' + b + ' son ' + V.X + ', ' + a + ' por ' + c + ' son ' + V.Y + ', y ' + V.X + ' ' + pal + ' ' + V.Y + ' son ' + V.T + '.', '¡Las dos dan lo mismo!'],
            anim: function (e) { e.limpiarResaltes(); e.centro('calculos'); e.calculos([lineaIzq, lineaDer]); },
            seg: function (e, i) { if (i === 1) e.verCalculo(0); else if (i === 2) e.verCalculo(1); else if (i === 3) e.marca(true, '¡Igual!'); }
        });

        B.push({
            cap: '<b>Propiedad distributiva</b>: el número de fuera multiplica a cada número del paréntesis.',
            voz: ['Esta es la propiedad distributiva.', 'El número de fuera multiplica a cada número del paréntesis, y el resultado no cambia.'],
            anim: function (e) { e.centro('insignia'); e.insignia(Dist.regla(q), 'Propiedad distributiva'); },
            final: true
        });
        return B;
    }

    function guionFactor(q) {
        var a = q.a, b = q.b, c = q.c, V = Dist.valores(q), suma = q.op === MAS, izq = q.sub !== 'ba', op = q.op;
        var pal = Dist.palabraOp(op), nom = Dist.nombreOp(op), antes = Dist.antes(q), norm = Dist.normal(q), desp = Dist.despues(q);
        var reordena = q.sub === 'ab' || q.sub === 'ba2';
        var B = [];

        if (reordena) B.push({
            cap: 'Primero ponemos el ' + N('a', a) + ' al principio de los dos productos: <b>el orden de los factores no cambia el producto</b>.',
            voz: ['Primero ponemos el ' + a + ' al principio de los dos productos.', 'El orden de los factores no cambia el producto.'],
            anim: function (e) { e.colorear(true); },
            seg: function (e, i) { if (i === 1) { e.expr(norm); } else e.pulso(['a1', 'a2']); }
        });

        B.push({
            cap: 'Miramos los dos productos: el ' + N('a', a) + ' está en <b>los dos</b>. Es el <b>factor común</b>.',
            voz: ['Miramos los dos productos.', '¿Hay algún número que se repita? Sí, el ' + a + ' está en los dos.', 'Es el factor común.'],
            anim: function (e) { e.colorear(true); e.expr(norm); },
            seg: function (e, i) { e.limpiarResaltes(); if (i === 1) e.pulso(['a1', 'a2']); else if (i === 2) { e.pulso(['a1', 'a2']); e.bocadillo('factor común'); } }
        });

        B.push({
            cap: suma
                ? (izq ? 'Dibujamos cada producto: <b>' + a + ' filas de ' + N('b', b) + '</b> puntos (azul) y <b>' + a + ' filas de ' + N('c', c) + '</b> (naranja).'
                       : 'Dibujamos cada producto: <b>' + b + ' columnas de ' + N('a', a) + '</b> puntos (azul) y <b>' + c + ' columnas de ' + N('a', a) + '</b> (naranja).')
                : 'Dibujamos <b>' + N('a', a) + ' × ' + N('b', b) + ' = ' + V.X + '</b> puntos, y marcamos en naranja los <b>' + N('a', a) + ' × ' + N('c', c) + ' = ' + V.Y + '</b> que vamos a quitar.',
            voz: suma
                ? (izq ? ['Dibujamos cada producto con puntos.', a + ' filas de ' + b + ' puntos, en azul,', 'y ' + a + ' filas de ' + c + ' puntos, en naranja.']
                       : ['Dibujamos cada producto con puntos.', b + ' columnas de ' + a + ' puntos, en azul,', 'y ' + c + ' columnas de ' + a + ' puntos, en naranja.'])
                : ['Dibujamos ' + a + ' por ' + b + ', que son ' + V.X + ' puntos.', 'Y marcamos en naranja ' + a + ' por ' + c + ', que son ' + V.Y + ' puntos, los que vamos a quitar.'],
            anim: function (e) { e.limpiarResaltes(); e.centro('modelo'); e.modelo({ vis: true, sep: suma, eti: suma ? 'bc' : 'bc' }); },
            seg: function (e, i) { if (suma) { if (i === 1) e.pulsoModelo('b'); else if (i === 2) e.pulsoModelo('c'); } else if (i === 1) e.pulsoModelo('c'); }
        });

        B.push(suma ? {
            cap: 'Juntamos los dos bloques: tenemos <b>' + (izq ? a + ' filas' : a + ' puntos en cada columna') + '</b>, y en total <b>(' + N('b', b) + ' + ' + N('c', c) + ')</b>' + (izq ? ' puntos en cada fila.' : ' columnas.'),
            voz: izq ? ['Juntamos los dos bloques.', 'Ahora hay ' + a + ' filas, y en cada fila hay ' + b + ' más ' + c + ' puntos.']
                     : ['Juntamos los dos bloques.', 'Ahora hay ' + a + ' puntos en cada columna, y ' + b + ' más ' + c + ' columnas.'],
            anim: function (e) { e.modelo({ sep: false, unido: true, eti: '' }); }
        } : {
            cap: 'Quitamos lo naranja: queda ' + (izq ? '<b>' + a + ' filas</b> de <b>(' + N('b', b) + ' − ' + N('c', c) + ')</b> puntos.' : '<b>' + (b - c) + ' columnas</b> de ' + N('a', a) + ' puntos.'),
            voz: izq ? ['Quitamos los puntos naranjas.', 'Quedan ' + a + ' filas, y en cada fila hay ' + b + ' menos ' + c + ' puntos.']
                     : ['Quitamos los puntos naranjas.', 'Quedan ' + b + ' menos ' + c + ' columnas de ' + a + ' puntos.'],
            anim: function (e) { e.modelo({ quitado: true, eti: '' }); }
        });

        B.push({
            cap: 'Pasamos el dibujo a números: sacamos el ' + N('a', a) + ' fuera, <b>una sola vez</b>, y dentro del paréntesis ponemos lo que queda.',
            voz: ['Ahora lo escribimos con números.', 'Sacamos el ' + a + ' fuera, para escribirlo una sola vez.', 'Y dentro del paréntesis ponemos lo que queda, ' + b + ' ' + pal + ' ' + c + '.'],
            anim: function (e) { e.limpiarResaltes(); },
            seg: function (e, i) { if (i === 1) { e.expr(desp); e.pulso(['a1']); } }
        });

        var lineaProd = Dist.textoHTML(norm) + ' = ' + V.X + ' ' + op + ' ' + V.Y + ' = <b>' + V.T + '</b>';
        var lineaFac = Dist.textoHTML(desp) + ' = ' + (izq ? a + ' ' + MUL + ' ' + V.S : V.S + ' ' + MUL + ' ' + a) + ' = <b>' + V.T + '</b>';
        B.push({
            cap: 'Comprobamos: <b>las dos dan lo mismo</b>.',
            voz: ['Vamos a comprobarlo.', 'Con los productos, ' + a + ' por ' + b + ' son ' + V.X + ', ' + a + ' por ' + c + ' son ' + V.Y + ', y ' + V.X + ' ' + pal + ' ' + V.Y + ' son ' + V.T + '.',
                'Con el factor común, ' + b + ' ' + pal + ' ' + c + ' son ' + V.S + ', y ' + a + ' por ' + V.S + ' son ' + V.T + '.', '¡Las dos dan lo mismo!'],
            anim: function (e) { e.limpiarResaltes(); e.centro('calculos'); e.calculos([lineaProd, lineaFac]); },
            seg: function (e, i) { if (i === 1) e.verCalculo(0); else if (i === 2) e.verCalculo(1); else if (i === 3) e.marca(true, '¡Igual!'); }
        });

        B.push({
            cap: '<b>Sacar factor común</b>: el número repetido se saca fuera y multiplica a la ' + nom + ' de los demás.',
            voz: ['Esto es sacar factor común, y también es la propiedad distributiva.', 'Si un número está en los dos productos, se saca fuera y multiplica a la ' + nom + ' de los otros números.'],
            anim: function (e) { e.centro('insignia'); e.insignia(Dist.regla(q), 'Factor común'); },
            final: true
        });
        return B;
    }

    function guionNo(q) {
        var a = q.a, b = q.b, c = q.c, d = q.d, op = q.op, pal = Dist.palabraOp(op), t = Dist.trampa(q), B = [];
        var antes = Dist.antes(q), txt = Dist.textoHTML(antes);
        var cierre = function (cap, voz) {
            return { cap: cap, voz: voz, anim: function (e) { e.limpiarResaltes(); e.centro('insignia'); e.insignia('<span class="ig-nopuede">' + Dist.texto(antes) + '</span>', 'No se puede', Dist.MOTIVO_CORTO[q.sub]); }, final: true };
        };
        var intento = function (lineas, vozs, marcaTxt) {
            return {
                cap: 'Si lo intentáramos igualmente, <b>no saldría lo mismo</b>.',
                voz: ['Vamos a probar a hacerlo igualmente.'].concat(vozs),
                anim: function (e) { e.limpiarResaltes(); e.centro('calculos'); e.calculos(lineas); },
                seg: function (e, i) { if (i >= 1 && i <= lineas.length) e.verCalculo(i - 1); else if (i === lineas.length + 1) e.marca(false, marcaTxt || '¡No coinciden!'); }
            };
        };
        switch (q.sub) {
            case 'prod':
                B.push({
                    cap: 'Dentro del paréntesis hay una <b>multiplicación</b>, no una suma ni una resta.',
                    voz: ['Fíjate bien en el paréntesis.', 'Dentro hay una multiplicación, ' + b + ' por ' + c + '.', 'La propiedad distributiva solo funciona cuando dentro hay una suma o una resta.'],
                    anim: function (e) { e.colorear(true); },
                    seg: function (e, i) { e.limpiarResaltes(); if (i === 1) { e.malo(['x2']); e.pulso(['b', 'c']); e.bocadillo('multiplicación'); } }
                });
                B.push(intento([txt + ' = ' + a + ' ' + MUL + ' ' + (b * c) + ' = <b>' + t.real + '</b>', t.intentoOp + ' = ' + t.intentoTxt + ' = <b class="ig-mal">' + t.intento + '</b>'],
                    ['La operación de verdad, ' + b + ' por ' + c + ' son ' + (b * c) + ', y ' + a + ' por ' + (b * c) + ' son ' + t.real + '.',
                     'Haciéndolo igualmente, ' + a + ' por ' + b + ' son ' + (a * b) + ', ' + a + ' por ' + c + ' son ' + (a * c) + ', y ' + (a * b) + ' por ' + (a * c) + ' son ' + t.intento + '.', 'No da lo mismo.']));
                B.push(cierre('<b>No se puede</b>: solo hay multiplicaciones. Se multiplica y ya está.', ['Aquí no se puede aplicar la propiedad distributiva.', 'Solo hay multiplicaciones, así que no hay ninguna suma ni resta que multiplicar.']));
                break;
            case 'dist2':
                B.push({
                    cap: 'Para sacar factor común, un número debe estar en <b>los dos</b> productos. Aquí hay ' + N('a', a) + ' y ' + N('b', b) + ' en uno, y ' + N('c', c) + ' y ' + N('d', d) + ' en el otro: <b>no se repite ninguno</b>.',
                    voz: ['Para sacar factor común, tiene que haber un número repetido en los dos productos.', 'Aquí tenemos ' + a + ' y ' + b + ' en uno, y ' + c + ' y ' + d + ' en el otro.', 'No se repite ninguno.'],
                    anim: function (e) { e.colorear(true); },
                    seg: function (e, i) { e.limpiarResaltes(); if (i === 1) e.pulso(['a1', 'b', 'c', 'd']); else if (i === 2) { e.malo(['a1', 'b', 'c', 'd']); e.bocadillo('ninguno se repite'); } }
                });
                B.push(intento([txt + ' = ' + (a * b) + ' ' + op + ' ' + (c * d) + ' = <b>' + t.real + '</b>', a + ' ' + MUL + ' (' + b + ' ' + op + ' ' + d + ') = ' + t.intentoTxt + ' = <b class="ig-mal">' + t.intento + '</b>'],
                    ['La operación de verdad da ' + t.real + '.', 'Si sacáramos el ' + a + ' sin que esté en los dos, saldría ' + t.intento + '.', 'No da lo mismo.']));
                B.push(cierre('<b>No se puede</b>: no hay ningún factor común.', ['Aquí no se puede sacar factor común.', 'Ningún número se repite en los dos productos.']));
                break;
            case 'sola': case 'solader':
                B.push({
                    cap: 'Aquí hay un producto (<b>' + N('a', a) + ' × ' + N('b', b) + '</b>) y un número suelto (' + N('c', c) + '). Para sacar factor común hacen falta <b>dos productos</b> con un número repetido.',
                    voz: ['Aquí hay un solo producto, ' + a + ' por ' + b + ', y un número suelto, el ' + c + '.', 'Para sacar factor común hacen falta dos productos con un número repetido.'],
                    anim: function (e) { e.colorear(true); },
                    seg: function (e, i) { e.limpiarResaltes(); if (i === 0) e.pulso(['a1', 'b', 'x1']); else { e.malo(['c']); e.bocadillo('un número suelto'); } }
                });
                B.push(intento([txt + ' = ' + t.realTxt + ' = <b>' + t.real + '</b>', t.intentoOp + ' = ' + t.intentoTxt + ' = <b class="ig-mal">' + t.intento + '</b>'],
                    ['La operación de verdad da ' + t.real + '.', 'Si metiéramos el ' + c + ' dentro de un paréntesis con el ' + b + ', saldría ' + t.intento + '.', 'No da lo mismo.']));
                B.push(cierre('<b>No se puede</b>: falta un segundo producto con un número repetido.', ['Aquí no se puede aplicar la propiedad distributiva.', 'No hay dos productos con un número repetido.']));
                break;
            case 'div':
                B.push({
                    cap: 'Esto es una <b>división</b>. La propiedad distributiva es de la <b>multiplicación</b>: no se puede aplicar al dividir entre una suma.',
                    voz: ['Fíjate, aquí hay una división.', 'La propiedad distributiva es de la multiplicación.', 'Cuando se divide entre una suma, no se puede aplicar.'],
                    anim: function (e) { e.colorear(true); },
                    seg: function (e, i) { e.limpiarResaltes(); if (i === 0) { e.malo(['x1']); e.bocadillo('división'); } else if (i === 2) e.pulso(['b', 'op', 'c']); }
                });
                B.push(intento([txt + ' = ' + a + ' ' + Dist.DIV + ' ' + (b + c) + ' = <b>' + t.real + '</b>', t.intentoOp + ' = ' + t.intentoTxt + ' = <b class="ig-mal">' + t.intento + '</b>'],
                    ['La operación de verdad, ' + b + ' más ' + c + ' son ' + (b + c) + ', y ' + a + ' entre ' + (b + c) + ' son ' + t.real + '.',
                     'Haciéndolo igualmente, ' + a + ' entre ' + b + ' son ' + (a / b) + ', ' + a + ' entre ' + c + ' son ' + (a / c) + ', y suman ' + t.intento + '.', 'No da lo mismo.']));
                B.push(cierre('<b>No se puede</b>: una división entre una suma no se puede transformar así.', ['Aquí no se puede aplicar la propiedad distributiva.', 'Cuando se divide entre una suma, no se puede aplicar.']));
                break;
        }
        return B;
    }

    function guion(d) {
        var q = d.q, b = [beatTitulo(d)];
        var tu = beatTuIgualdad(d); if (tu) b.push(tu);
        return { q: q, beats: b.concat(q.forma === 'rep' ? guionDistributiva(q) : q.forma === 'fac' ? guionFactor(q) : guionNo(q)) };
    }

    var preparados = {};
    function clave(d) { return d.tipo + '|' + d.q.clave + '|' + (d.tipo === 'reconocer' ? d.elegida : Dist.texto(d.elegida || [])); }
    function preparar(d) {
        var k = clave(d);
        if (!preparados[k]) {
            preparados[k] = guion(d);
            if (Voz.estado() !== 'error') preparados[k].beats.forEach(function (x) { Voz.precargar(x.voz); });   // en orden, en el worker
        }
        return preparados[k];
    }

    /* ---------- escena (los elementos animados) ---------- */
    function pintarFila(fila, tokens, colores) {
        fila.innerHTML = '';
        tokens.forEach(function (t) { fila.appendChild(crearFicha(t)); });
    }
    function crearFicha(t) {
        var c = el('span', 'tk tk-' + t.k + (t.rol ? ' rol-' + t.rol : ''), t.v);
        c.dataset.id = t.id; if (t.hacia) c.dataset.hacia = t.hacia;
        return c;
    }

    function Escena(raiz, q, datos) {
        this.q = q; this.raiz = raiz; this.timers = []; this.rapido = false; this.fichas = []; this.estado = {};
        raiz.innerHTML = '';
        var L = el('div', 'ig-lienzo');
        this.pildorasEl = el('div', 'ig-pildoras');
        this.zona = el('div', 'ig-exprzona');
        this.bocadilloEl = el('div', 'ig-bocadillo');
        this.exprEl = el('div', 'ig-expr');
        this.zona.appendChild(this.bocadilloEl); this.zona.appendChild(this.exprEl);
        this.centroEl = el('div', 'ig-centro');
        this.calcEl = el('div', 'ig-calculos');
        this.insEl = el('div', 'ig-insignia');
        if (q.forma !== 'no') { this.construirModelo(); this.centroEl.appendChild(this.modeloEl); }
        this.centroEl.appendChild(this.calcEl); this.centroEl.appendChild(this.insEl);
        L.appendChild(this.pildorasEl); L.appendChild(this.zona); L.appendChild(this.centroEl);
        raiz.appendChild(L);
        this.lienzo = L; L.classList.add('vacio');
        this.encajar();
    }
    var P = Escena.prototype;

    /* ----- iconos (SVG, estilo de los controles de reproducción de Windows 11) ----- */
    var ICO = {
        anterior: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="5" width="2.6" height="14" rx="1.3"/><path d="M19 6.6v10.8c0 .9-1 1.4-1.7.9l-7.8-5.4a1.1 1.1 0 0 1 0-1.8l7.8-5.4c.7-.5 1.7 0 1.7.9z"/></svg>',
        siguiente: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="16.4" y="5" width="2.6" height="14" rx="1.3"/><path d="M5 6.6v10.8c0 .9 1 1.4 1.7.9l7.8-5.4a1.1 1.1 0 0 0 0-1.8L6.7 5.7C6 5.2 5 5.7 5 6.6z"/></svg>',
        pausa: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="5" width="4.2" height="14" rx="1.4"/><rect x="13.8" y="5" width="4.2" height="14" rx="1.4"/></svg>',
        seguir: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.6v12.8c0 .9 1 1.4 1.7.9l9.6-6.4a1.1 1.1 0 0 0 0-1.8L9.7 4.7C9 4.2 8 4.7 8 5.6z"/></svg>',
        repetir: '<svg viewBox="0 0 24 24" aria-hidden="true" class="trazo"><path d="M19 12a7 7 0 1 1-2.05-4.95"/><path d="M19.5 4.3v4.8h-4.8"/></svg>',
        saltar: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6.8v10.4c0 .8.9 1.3 1.6.8l6.6-5.2a1 1 0 0 0 0-1.6L4.6 6C3.9 5.5 3 6 3 6.8z"/><path d="M11 6.8v10.4c0 .8.9 1.3 1.6.8l6.6-5.2a1 1 0 0 0 0-1.6L12.6 6c-.7-.5-1.6 0-1.6.8z"/><rect x="19.4" y="5.5" width="2.2" height="13" rx="1.1"/></svg>',
        flecha: '<svg viewBox="0 0 24 24" aria-hidden="true" class="trazo"><path d="M5 12h13.5"/><path d="M13 6.5l5.5 5.5-5.5 5.5"/></svg>'
    };
    function ico(n) { return '<span class="ig-ico">' + ICO[n] + '</span>'; }

    P.tarde = function (ms, fn) { if (this.rapido) fn(); else this.timers.push(setTimeout(fn, ms)); };
    P.parar = function () { this.timers.forEach(clearTimeout); this.timers = []; };

    /* ---- la operación: las mismas fichas se mueven de una forma a la otra (técnica FLIP) ---- */
    P.expr = function (tokens) {
        var fila = this.exprEl, viejos = {}, antes = {}, nuevos = [], nuevosId = {}, quitados = [], self = this;
        var animar = !this.rapido && fila.children.length > 0 && fila.animate;
        [].slice.call(fila.children).forEach(function (c) {
            if (c.classList.contains('fantasma')) { c.remove(); return; }
            viejos[c.dataset.id] = c; antes[c.dataset.id] = c.getBoundingClientRect();
        });
        tokens.forEach(function (t) {
            var c = viejos[t.id];
            if (c) delete viejos[t.id]; else { c = crearFicha(t); nuevosId[t.id] = t; }
            c.className = 'tk tk-' + t.k + (t.rol ? ' rol-' + t.rol : '') + (c.classList.contains('pulso') ? ' pulso' : '') + (c.classList.contains('malo') ? ' malo' : '');
            c.textContent = t.v; c.dataset.id = t.id;
            if (t.hacia) c.dataset.hacia = t.hacia; else delete c.dataset.hacia;
            nuevos.push(c);
        });
        Object.keys(viejos).forEach(function (id) { quitados.push({ el: viejos[id], rect: antes[id] }); });
        fila.innerHTML = '';
        nuevos.forEach(function (c) { fila.appendChild(c); });
        this.fichas = tokens;
        if (!animar) return;
        var filaR = fila.getBoundingClientRect(), despues = {};
        nuevos.forEach(function (c) { despues[c.dataset.id] = c.getBoundingClientRect(); });
        nuevos.forEach(function (c) {
            var id = c.dataset.id, r = despues[id], a = antes[id];
            if (nuevosId[id]) {
                var de = nuevosId[id].de, o = de && antes[de];
                if (o) c.animate([{ transform: 'translate(' + (o.left - r.left) + 'px,' + (o.top - r.top) + 'px) scale(0.7)', opacity: 0 }, { opacity: 1, offset: 0.25 }, { transform: 'none', opacity: 1 }], { duration: 1100, easing: 'cubic-bezier(0.3, 0.1, 0.2, 1)' });
                else c.animate([{ opacity: 0, transform: 'scale(0.4)' }, { opacity: 1, transform: 'none' }], { duration: 650, easing: 'cubic-bezier(0.2, 1.4, 0.4, 1)', delay: 250, fill: 'backwards' });
            } else if (a && (Math.abs(a.left - r.left) > 1 || Math.abs(a.top - r.top) > 1)) {
                c.animate([{ transform: 'translate(' + (a.left - r.left) + 'px,' + (a.top - r.top) + 'px)' }, { transform: 'none' }], { duration: 900, easing: 'cubic-bezier(0.45, 0, 0.2, 1)' });
            }
        });
        // las fichas que sobran (paréntesis, o el factor repetido) se desvanecen; el factor repetido «vuelve» al primero
        quitados.forEach(function (x) {
            var g = x.el, hacia = g.dataset.hacia && despues[g.dataset.hacia];
            g.classList.add('fantasma');
            g.style.left = (x.rect.left - filaR.left) + 'px'; g.style.top = (x.rect.top - filaR.top) + 'px';
            fila.appendChild(g);
            var dx = hacia ? hacia.left - x.rect.left : 0, dy = hacia ? hacia.top - x.rect.top : 0;
            var anim = g.animate([{ transform: 'none', opacity: 1 }, { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(' + (hacia ? 0.8 : 0.5) + ')', opacity: 0 }], { duration: hacia ? 1100 : 700, easing: 'cubic-bezier(0.3, 0.1, 0.2, 1)', fill: 'forwards' });
            anim.onfinish = function () { g.remove(); };
            self.tarde(1300, function () { if (g.parentNode) g.remove(); });
        });
    };
    P.colorear = function (on) { this.exprEl.classList.toggle('colores', !!on); this.estado.colores = !!on; };
    P.ficha = function (id) { return this.exprEl.querySelector('.tk[data-id="' + id + '"]:not(.fantasma)'); };
    P.pulso = function (ids) { var self = this; ids.forEach(function (id) { var f = self.ficha(id); if (f) { f.classList.remove('pulso'); void f.offsetWidth; f.classList.add('pulso'); } }); };
    P.malo = function (ids) { var self = this; ids.forEach(function (id) { var f = self.ficha(id); if (f) f.classList.add('malo'); }); };
    P.limpiarResaltes = function () {
        [].forEach.call(this.exprEl.querySelectorAll('.pulso, .malo'), function (f) { f.classList.remove('pulso', 'malo'); });
        this.bocadilloEl.classList.remove('ver');
        if (this.modeloEl) [].forEach.call(this.modeloEl.querySelectorAll('.late'), function (f) { f.classList.remove('late'); });
    };
    P.bocadillo = function (txt) { var b = this.bocadilloEl; b.textContent = txt; b.classList.remove('ver'); void b.offsetWidth; b.classList.add('ver'); };
    P.pildoras = function (mal, bien) {
        this.pildorasEl.innerHTML = '<span class="ig-pill mal">✗ Tu respuesta <b>' + mal + '</b></span><span class="ig-pill bien">✓ Correcta <b>' + bien + '</b></span>';
        [].forEach.call(this.pildorasEl.children, function (x, i) { x.style.animationDelay = (i * 350) + 'ms'; x.classList.add('ver'); });
    };

    /* ---- la zona central: el dibujo de puntos, las cuentas o la regla (una a la vez, en el mismo sitio) ---- */
    P.centro = function (vista) { this.centroEl.dataset.vista = vista || ''; this.lienzo.classList.toggle('vacio', !vista); };

    P.calculos = function (lineas) {
        var c = this.calcEl;
        c.innerHTML = '';
        lineas.forEach(function (l) { c.appendChild(el('div', 'calc-linea', l)); });
        c.appendChild(el('div', 'calc-marca', ''));
        this.encajarTextos();
    };
    P.verCalculo = function (i) { var l = this.calcEl.children[i]; if (l) l.classList.add('ver'); };
    P.marca = function (ok, texto) {
        var m = this.calcEl.lastElementChild; if (!m) return;
        m.className = 'calc-marca ' + (ok ? 'ok' : 'mal'); m.textContent = (ok ? '✓ ' : '✗ ') + texto;
        void m.offsetWidth; m.classList.add('ver');
    };
    P.insignia = function (html, titulo, sub) {
        this.insEl.innerHTML = '<div class="ins-titulo">' + titulo + '</div><div class="ins-regla">' + html + '</div>' + (sub ? '<div class="ins-sub">' + sub + '</div>' : '');
        this.insEl.className = 'ig-insignia ' + (titulo === 'No se puede' ? 'no' : 'si');
        void this.insEl.offsetWidth; this.insEl.classList.add('ver');
        this.encajarTextos();
    };

    /* ---- el dibujo de puntos: a filas, b azules + c naranjas (con resta: b puntos de los que se quitan c) ---- */
    P.construirModelo = function () {
        var q = this.q, V = Dist.valores(q), suma = q.op === MAS, a = q.a, b = q.b, c = q.c;
        var m = el('div', 'ig-modelo' + (suma ? '' : ' resta'));
        var colsB = suma ? b : b - c, colsC = c;
        m.style.setProperty('--filas', a); m.style.setProperty('--cb', colsB); m.style.setProperty('--cc', colsC);
        m.innerHTML =
            '<div class="mod-cuerpo">' +
                '<div class="mod-izq">' + a + '</div>' +
                '<div class="mod-top mod-top-b">' + (suma ? b : (b - c)) + '</div>' +
                '<div class="mod-top mod-top-c">' + c + '</div>' +
                '<div class="mod-top mod-top-todo"><span class="t-corto">' + (suma ? b + ' + ' + c : b) + '</span><span class="t-largo">' + a + ' × ' + b + ' = ' + V.X + '</span></div>' +
                '<div class="mod-rect mod-b"></div>' +
                '<div class="mod-rect mod-c"></div>' +
                '<div class="mod-prod mod-prod-b"><span>' + (suma ? a + ' × ' + b : 'queda') + '</span><span>= ' + (suma ? V.X : a * (b - c)) + '</span></div>' +
                '<div class="mod-prod mod-prod-c"><span>' + a + ' × ' + c + '</span><span>= ' + V.Y + '</span></div>' +
            '</div>';
        this.modeloEl = m;
        this.modeloQ = { colsB: colsB, colsC: colsC, filas: a };
    };
    P.modelo = function (f) {
        var m = this.modeloEl; if (!m) return;
        if ('vis' in f) m.classList.toggle('vis', !!f.vis);
        if ('sep' in f) m.classList.toggle('sep', !!f.sep);
        if ('unido' in f) m.classList.toggle('unido', !!f.unido);
        if ('quitado' in f) m.classList.toggle('quitado', !!f.quitado);
        if ('eti' in f) { m.classList.toggle('eti-b', f.eti.indexOf('b') >= 0); m.classList.toggle('eti-c', f.eti.indexOf('c') >= 0); m.classList.toggle('eti', !!f.eti); }
    };
    P.pulsoModelo = function (cual) {
        var m = this.modeloEl; if (!m) return;
        var x = cual === 'izq' ? m.querySelector('.mod-izq') : cual === 'b' ? m.querySelector('.mod-b') : m.querySelector('.mod-c');
        var y = cual === 'b' ? m.querySelector('.mod-top-b') : cual === 'c' ? m.querySelector('.mod-top-c') : null;
        [x, y].forEach(function (z) { if (z) { z.classList.remove('late'); void z.offsetWidth; z.classList.add('late'); } });
    };

    /* ---- medidas: tamaño de la operación, del dibujo y de los textos largos (todo cabe, sin cortes ni scroll) ---- */
    P.encajar = function () {
        var raiz = this.raiz, q = this.q, W = raiz.clientWidth || 300, L = this.lienzo;
        var rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
        // 1) la operación más ancha que saldrá (antes, ordenada y después) debe caber a lo ancho
        var formas = [Dist.antes(q)];
        if (q.forma !== 'no') { formas.push(Dist.normal(q)); formas.push(Dist.despues(q)); }
        var med = el('div', 'ig-expr ig-medida'); med.style.fontSize = '100px';
        raiz.appendChild(med);
        var max = 1;
        formas.forEach(function (t) { pintarFila(med, t); max = Math.max(max, med.getBoundingClientRect().width); });
        raiz.removeChild(med);
        var tam = Math.min(3.6 * rem, 0.94 * W * 100 / max);
        L.style.setProperty('--ig-tam', tam.toFixed(1) + 'px');
        // 2) el dibujo de puntos: cabe en el espacio que queda en la zona central
        if (this.modeloEl) {
            var r = this.centroEl.getBoundingClientRect(), mq = this.modeloQ;
            var libreH = r.height - 5.2 * rem, libreW = r.width - 4.2 * rem - 1.6 * rem;
            var cols = mq.colsB + mq.colsC;
            var u = Math.max(4, Math.min(libreH / mq.filas, libreW / cols, 2.6 * rem));
            this.modeloEl.style.setProperty('--u', u.toFixed(1) + 'px');
            this.modeloEl.classList.toggle('sin-puntos', u < 9);
        }
        this.encajarTextos();
    };
    P.encajarTextos = function () {
        // cuentas y regla: una sola línea cada una; si no caben a lo ancho se reduce la letra
        var fit = function (e) {
            e.style.fontSize = '';
            var base = parseFloat(getComputedStyle(e).fontSize) || 16, n = 0;
            while (e.scrollWidth > e.clientWidth + 1 && n++ < 40) e.style.fontSize = (base * (1 - n * 0.025)) + 'px';
        };
        [].forEach.call(this.calcEl.querySelectorAll('.calc-linea'), fit);
        [].forEach.call(this.insEl.querySelectorAll('.ins-regla'), fit);
    };

    /* ---------- ventana (reproductor) ---------- */
    /* La explicación avanza sola de un paso al siguiente. Con ◀ ▶ (o las flechas del teclado, o tocando un punto)
       se salta a otro paso: a partir de ese momento ya NO avanza sola, solo a mano. */
    function mostrar(datos) {
        return new Promise(function (resolve) {
            var previo = document.activeElement;
            var script;
            try { script = preparar(datos); } catch (e) { console.warn('Infografia', e); return Explicacion.mostrar(datos).then(resolve); }
            var beats = script.beats, q = script.q, total = beats.length;

            var velo = el('div', 'dialog-overlay ig-overlay');
            velo.innerHTML =
                '<div class="dialog-box ig-box" role="dialog" aria-modal="true" aria-label="Explicación animada">' +
                    '<button type="button" class="close-x ig-cerrar" aria-label="Cerrar">✕</button>' +
                    '<div class="ig-cabecera"><span class="ig-claqueta">🎬 Explicación</span><span class="ig-voz-estado"></span><div class="ig-puntos"></div></div>' +
                    '<div class="ig-escenario"></div>' +
                    '<div class="ig-subtitulo"></div>' +
                    '<div class="ig-nav">' +
                        '<button type="button" class="btn-secondary ig-atras" aria-label="Paso anterior">' + ico('anterior') + '<span class="ig-txt"> Atrás</span></button>' +
                        '<button type="button" class="btn-secondary ig-pausa" aria-label="Pausar al terminar este paso"></button>' +
                        '<button type="button" class="btn-secondary ig-repetir" aria-label="Repetir este paso">' + ico('repetir') + '<span class="ig-txt"> Repetir</span></button>' +
                        '<button type="button" class="btn-secondary ig-adelante" aria-label="Paso siguiente"><span class="ig-txt">Adelante </span>' + ico('siguiente') + '</button>' +
                    '</div>' +
                    '<div class="dialog-actions ig-acciones"><button type="button" class="btn-primary ig-ok">Saltar ' + ico('saltar') + '</button></div>' +
                '</div>';
            document.body.appendChild(velo);

            var puntos = velo.querySelector('.ig-puntos'), sub = velo.querySelector('.ig-subtitulo'), estadoVoz = velo.querySelector('.ig-voz-estado');
            var botonOk = velo.querySelector('.ig-ok'), botonRep = velo.querySelector('.ig-repetir');
            var botonAtras = velo.querySelector('.ig-atras'), botonAdelante = velo.querySelector('.ig-adelante'), botonPausa = velo.querySelector('.ig-pausa');
            beats.forEach(function (x, k) { var p = el('button', 'ig-punto'); p.type = 'button'; p.dataset.k = k; p.setAttribute('aria-label', 'Ir al paso ' + (k + 1)); puntos.appendChild(p); });

            var cerrado = false, ejecucion = 0, escena = null;
            var idx = 0, manual = false, terminado = false;
            var pausaPedida = false, detenido = false, ultimoVoz = '';     // pausa: se detiene al terminar el paso en curso
            Sonido.mantenerBajo(true);                          // la música se queda baja mientras dura la explicación

            function cerrar() {
                if (cerrado) return;
                cerrado = true; ejecucion++;
                document.removeEventListener('keydown', onKey, true);
                window.removeEventListener('resize', alRedimensionar);
                if (escena) escena.parar();
                Voz.parar();
                Sonido.mantenerBajo(false);                         // y sube suave al cerrarla
                Sonido.efecto('click');
                velo.classList.add('dialog-out');
                setTimeout(function () { velo.remove(); }, 200);
                if (previo && typeof previo.focus === 'function') previo.focus();
                resolve();
            }

            function pintar(vozTexto) {
                ultimoVoz = vozTexto || '';
                var finTotal = terminado && idx >= total - 1 && !manual;      // solo al acabar la última fase quedan todos como hechos
                [].forEach.call(puntos.children, function (p, k) { p.className = 'ig-punto' + (k < idx || finTotal ? ' hecho' : '') + (k === idx && !finTotal ? ' ahora' : ''); });
                botonAtras.disabled = idx <= 0;
                botonAdelante.disabled = idx >= total - 1;
                botonOk.innerHTML = terminado && idx >= total - 1 ? '¡Entendido! Siguiente ' + ico('flecha') : 'Saltar ' + ico('saltar');
                var etiqueta = detenido ? 'en pausa' : pausaPedida ? 'se parará al terminar este paso' : manual ? 'modo manual' : '';
                estadoVoz.textContent = (vozTexto || '') + (etiqueta ? (vozTexto ? ' · ' : '') + etiqueta : '');
                var seguir = manual || pausaPedida;
                botonPausa.innerHTML = seguir ? ico('seguir') + '<span class="ig-txt"> Seguir</span>' : ico('pausa') + '<span class="ig-txt"> Pausa</span>';
                botonPausa.setAttribute('aria-label', seguir ? 'Seguir con la explicación' : 'Pausar al terminar este paso');
                botonPausa.disabled = idx >= total - 1 && terminado;
            }

            function esperar(ms, yo) { return new Promise(function (ok) { setTimeout(ok, ms); }).then(function () { return yo === ejecucion; }); }

            /* la escena tal como queda justo antes del paso i (los pasos anteriores se aplican de golpe) */
            function construirEscena(hasta) {
                if (escena) escena.parar();
                escena = new Escena(velo.querySelector('.ig-escenario'), q, datos);
                (function (e) { setTimeout(function () { if (escena === e) e.encajar(); }, 450); })(escena);   // otra vez, ya abierta la ventana y con las fuentes cargadas
                escena.rapido = true;
                for (var k = 0; k < hasta; k++) {
                    var x = beats[k];
                    x.anim(escena);
                    if (x.seg) x.voz.forEach(function (sg, qq) { x.seg(escena, qq); });
                }
                escena.limpiarResaltes();
                escena.rapido = false;
                escena.encajar();
            }

            /* muestra el paso i y lo cuenta; devuelve false si se canceló por el camino */
            async function ejecutarPaso(i, yo) {
                var b = beats[i];
                idx = i; terminado = false;
                var conVoz = Voz.estado() === 'lista';
                pintar(conVoz ? '🔊' : (Voz.estado() === 'cargando' ? '⏳ cargando la voz…' : ''));
                sub.classList.remove('ver'); void sub.offsetWidth;
                sub.innerHTML = b.cap; sub.classList.add('ver');
                b.anim(escena);
                if (conVoz) {
                    var ultSeg = -1;
                    await Voz.decir(b.voz, {
                        pausa: PAUSA_FRASE,
                        alFrase: function (fi, tot, dur, seg) {
                            if (yo !== ejecucion || seg === ultSeg) return;
                            ultSeg = seg;
                            if (b.seg) b.seg(escena, seg, fi, dur);
                        }
                    });
                } else {
                    // sin voz: cada frase dura lo que tardaría en leerse
                    var acumulado = 0;
                    b.voz.forEach(function (x, k) {
                        if (b.seg) { var cuando = acumulado; escena.tarde(cuando, function () { b.seg(escena, k); }); }
                        acumulado += 800 + x.length * 62 + PAUSA_FRASE;
                    });
                    if (!(await esperar(acumulado, yo))) return false;
                }
                return yo === ejecucion;
            }

            /* reproduce desde el paso i; en modo manual se queda en ese paso, si no sigue solo hasta el final */
            async function correr(i, reconstruir) {
                var yo = ++ejecucion;
                Voz.parar();
                if (escena) escena.parar();
                if (reconstruir || !escena) construirEscena(i);
                for (var j = i; j < total; j++) {
                    if (!(await ejecutarPaso(j, yo))) return;
                    terminado = true;
                    if (manual) { pintar(''); return; }                 // a mano: aquí se detiene
                    if (pausaPedida && j < total - 1) { detenido = true; pintar(''); return; }   // pausa: se detiene al terminar el paso
                    if (j < total - 1) {
                        terminado = false; pintar('');
                        if (!(await esperar(PAUSA_PASO, yo))) return;
                    }
                }
                pintar('');
                try { botonOk.focus({ preventScroll: true }); } catch (e) {}
            }

            function ir(i) {
                manual = true; pausaPedida = false; detenido = false;       // desde aquí ya no avanza solo
                i = Math.max(0, Math.min(total - 1, i));
                Sonido.efecto('click');
                correr(i, true);
            }

            function onKey(ev) {
                if (ev.key === 'ArrowLeft') { ev.preventDefault(); ev.stopPropagation(); if (idx > 0) ir(idx - 1); }
                else if (ev.key === 'ArrowRight') { ev.preventDefault(); ev.stopPropagation(); if (idx < total - 1) ir(idx + 1); }
                else if (ev.key === 'p' || ev.key === 'P') { ev.preventDefault(); ev.stopPropagation(); pulsarPausa(); }
                else if (ev.key === 'Escape' || ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); ev.stopPropagation(); cerrar(); }
            }
            document.addEventListener('keydown', onKey, true);
            function alRedimensionar() { if (escena) escena.encajar(); }
            window.addEventListener('resize', alRedimensionar);
            botonOk.addEventListener('click', cerrar);
            velo.querySelector('.ig-cerrar').addEventListener('click', cerrar);
            botonAtras.addEventListener('click', function () { if (idx > 0) ir(idx - 1); });
            botonAdelante.addEventListener('click', function () { if (idx < total - 1) ir(idx + 1); });
            botonRep.addEventListener('click', function () { ir(idx); });
            /* Pausa: no corta el paso en curso, pero al terminarlo no pasa al siguiente. «Seguir» reanuda en automático */
            function pulsarPausa() {
                if (botonPausa.disabled) return;
                Sonido.efecto('click');
                if (!manual && !pausaPedida) { pausaPedida = true; pintar(ultimoVoz); return; }          // pedir pausa
                if (pausaPedida && !detenido && !manual) { pausaPedida = false; pintar(ultimoVoz); return; }   // arrepentirse
                var sig = terminado ? idx + 1 : idx;                                                       // reanudar
                manual = false; pausaPedida = false; detenido = false;
                if (sig < total) correr(sig, !terminado); else pintar('');
            }
            botonPausa.addEventListener('click', pulsarPausa);
            puntos.addEventListener('click', function (ev) { var p = ev.target.closest('.ig-punto'); if (p) ir(parseInt(p.dataset.k, 10)); });

            correr(0, true);
        });
    }

    return { mostrar: mostrar, preparar: preparar, guion: guion };

})();
