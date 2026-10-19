/* =========================================================
   Distributiva · motor de contenido (mismo código en el navegador y en Node)

   Una operación (q) es una de estas FORMAS:
     'rep'  → propiedad distributiva (expandir): a × (b + c)  ·  (b + c) × a   (también con resta: b − c)
     'fac'  → se puede SACAR FACTOR COMÚN: a × b + a × c  ·  b × a + c × a  ·  a × b + c × a  ·  b × a + a × c   (también con resta)
     'no'   → NO se puede aplicar:       a × (b × c)  ·  a × b + c × d  ·  a × b + c  ·  a ÷ (b + c)
   Colores de los números en toda la web: a (el factor que se repite) amarillo · b azul · c naranja.

   Los números de cada operación son siempre distintos entre sí, para que no haya dos formas válidas de resolverla.
   Cada «ficha» (token) de la operación lleva un id: la explicación animada mueve las MISMAS fichas de una forma a la otra.
   ========================================================= */
(function (global) {

    var MUL = '×', MAS = '+', MEN = '−', DIV = '÷';

    function azar(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
    function elegir(l) { return l[Math.floor(Math.random() * l.length)]; }
    function barajar(l) { l = l.slice(); for (var i = l.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = l[i]; l[i] = l[j]; l[j] = t; } return l; }
    function distinto(lo, hi, excluir) { var v, n = 0; do { v = azar(lo, hi); n++; } while (excluir.indexOf(v) >= 0 && n < 200); return v; }

    /* ---------- fichas ---------- */
    function T(k, v, rol, id) { return { k: k, v: String(v), rol: rol || '', id: id || '' }; }
    function num(v, rol, id) { return T('n', v, rol, id); }
    function ope(v, id) { return T('o', v, '', id); }
    function par(v, id) { return T('p', v, '', id); }
    function con(t, extra) { for (var k in extra) t[k] = extra[k]; return t; }

    /* Operación tal como se ve en la pregunta */
    function antes(q) {
        var a = q.a, b = q.b, c = q.c, d = q.d, op = q.op;
        switch (q.forma + ':' + q.sub) {
            case 'rep:izq': return [num(a, 'a', 'a1'), ope(MUL, 'x1'), par('(', 'p1'), num(b, 'b', 'b'), ope(op, 'op'), num(c, 'c', 'c'), par(')', 'p2')];
            case 'rep:der': return [par('(', 'p1'), num(b, 'b', 'b'), ope(op, 'op'), num(c, 'c', 'c'), par(')', 'p2'), ope(MUL, 'x1'), num(a, 'a', 'a1')];
            case 'fac:aa': return [num(a, 'a', 'a1'), ope(MUL, 'x1'), num(b, 'b', 'b'), ope(op, 'op'), con(num(a, 'a', 'a2'), { hacia: 'a1' }), con(ope(MUL, 'x2'), { hacia: 'x1' }), num(c, 'c', 'c')];
            case 'fac:ba': return [num(b, 'b', 'b'), ope(MUL, 'x1'), num(a, 'a', 'a1'), ope(op, 'op'), num(c, 'c', 'c'), con(ope(MUL, 'x2'), { hacia: 'x1' }), con(num(a, 'a', 'a2'), { hacia: 'a1' })];
            case 'fac:ab': return [num(a, 'a', 'a1'), ope(MUL, 'x1'), num(b, 'b', 'b'), ope(op, 'op'), num(c, 'c', 'c'), ope(MUL, 'x2'), num(a, 'a', 'a2')];
            case 'fac:ba2': return [num(b, 'b', 'b'), ope(MUL, 'x1'), num(a, 'a', 'a1'), ope(op, 'op'), num(a, 'a', 'a2'), ope(MUL, 'x2'), num(c, 'c', 'c')];
            case 'no:prod': return [num(a, 'a', 'a1'), ope(MUL, 'x1'), par('(', 'p1'), num(b, 'b', 'b'), ope(MUL, 'x2'), num(c, 'c', 'c'), par(')', 'p2')];
            case 'no:dist2': return [num(a, 'a', 'a1'), ope(MUL, 'x1'), num(b, 'b', 'b'), ope(op, 'op'), num(c, 'c', 'c'), ope(MUL, 'x2'), num(d, 'd', 'd')];
            case 'no:sola': return [num(a, 'a', 'a1'), ope(MUL, 'x1'), num(b, 'b', 'b'), ope(op, 'op'), num(c, 'c', 'c')];
            case 'no:solader': return [num(c, 'c', 'c'), ope(op, 'op'), num(a, 'a', 'a1'), ope(MUL, 'x1'), num(b, 'b', 'b')];
            case 'no:div': return [num(a, 'a', 'a1'), ope(DIV, 'x1'), par('(', 'p1'), num(b, 'b', 'b'), ope(MAS, 'op'), num(c, 'c', 'c'), par(')', 'p2')];
        }
        return [];
    }

    /* «a1 × b ± a2 × c» con el factor común al principio (para las formas con el factor en otro sitio: se ordenan primero) */
    function normal(q) {
        var a = q.a, b = q.b, c = q.c, op = q.op;
        if (q.forma !== 'fac') return antes(q);
        if (q.sub === 'ab') return [num(a, 'a', 'a1'), ope(MUL, 'x1'), num(b, 'b', 'b'), ope(op, 'op'), con(num(a, 'a', 'a2'), { hacia: 'a1' }), con(ope(MUL, 'x2'), { hacia: 'x1' }), num(c, 'c', 'c')];
        if (q.sub === 'ba2') return [num(a, 'a', 'a1'), ope(MUL, 'x1'), num(b, 'b', 'b'), ope(op, 'op'), con(num(a, 'a', 'a2'), { hacia: 'a1' }), con(ope(MUL, 'x2'), { hacia: 'x1' }), num(c, 'c', 'c')];
        return antes(q);
    }

    /* La operación en la otra forma (propiedad distributiva ⇄ sacar factor común) */
    function despues(q) {
        var a = q.a, b = q.b, c = q.c, op = q.op;
        if (q.forma === 'rep' && q.sub === 'izq') return [num(a, 'a', 'a1'), ope(MUL, 'x1'), num(b, 'b', 'b'), ope(op, 'op'), con(num(a, 'a', 'a2'), { de: 'a1' }), con(ope(MUL, 'x2'), { de: 'x1' }), num(c, 'c', 'c')];
        if (q.forma === 'rep') return [num(b, 'b', 'b'), ope(MUL, 'x1'), num(a, 'a', 'a1'), ope(op, 'op'), num(c, 'c', 'c'), con(ope(MUL, 'x2'), { de: 'x1' }), con(num(a, 'a', 'a2'), { de: 'a1' })];
        if (q.forma === 'fac' && (q.sub === 'ba')) return [par('(', 'p1'), num(b, 'b', 'b'), ope(op, 'op'), num(c, 'c', 'c'), par(')', 'p2'), ope(MUL, 'x1'), num(a, 'a', 'a1')];
        if (q.forma === 'fac') return [num(a, 'a', 'a1'), ope(MUL, 'x1'), par('(', 'p1'), num(b, 'b', 'b'), ope(op, 'op'), num(c, 'c', 'c'), par(')', 'p2')];
        return [];
    }

    /* ---------- texto y voz ---------- */
    function texto(tokens) {
        var s = '';
        tokens.forEach(function (t) { s += t.k === 'o' ? ' ' + t.v + ' ' : t.v; });
        return s.replace(/\s+/g, ' ').replace(/\( /g, '(').replace(/ \)/g, ')').trim();
    }
    function textoHTML(tokens, colores) {
        var s = '';
        tokens.forEach(function (t) { s += t.k === 'o' ? ' ' + t.v + ' ' : (colores && t.rol ? '<b class="rol-' + t.rol + '">' + t.v + '</b>' : t.v); });
        return s.replace(/\s+/g, ' ').replace(/\( /g, '(').replace(/ \)/g, ')').trim();
    }
    function palabraOp(op) { return op === MAS ? 'más' : 'menos'; }
    function nombreOp(op) { return op === MAS ? 'suma' : 'resta'; }
    /* cómo se LEE la operación en voz alta (sin símbolos: la voz no los entiende) */
    function voz(q) {
        var a = q.a, b = q.b, c = q.c, d = q.d, op = q.op, p = palabraOp(op), nom = nombreOp(op);
        switch (q.forma + ':' + q.sub) {
            case 'rep:izq': return a + ' por la ' + nom + ' de ' + b + ' ' + p + ' ' + c;
            case 'rep:der': return 'la ' + nom + ' de ' + b + ' ' + p + ' ' + c + ', por ' + a;
            case 'fac:aa': return a + ' por ' + b + ', ' + p + ', ' + a + ' por ' + c;
            case 'fac:ba': return b + ' por ' + a + ', ' + p + ', ' + c + ' por ' + a;
            case 'fac:ab': return a + ' por ' + b + ', ' + p + ', ' + c + ' por ' + a;
            case 'fac:ba2': return b + ' por ' + a + ', ' + p + ', ' + a + ' por ' + c;
            case 'no:prod': return a + ' por el paréntesis de ' + b + ' por ' + c;
            case 'no:dist2': return a + ' por ' + b + ', ' + p + ', ' + c + ' por ' + d;
            case 'no:sola': return a + ' por ' + b + ', ' + p + ', ' + c;
            case 'no:solader': return c + ', ' + p + ', ' + a + ' por ' + b;
            case 'no:div': return a + ' entre la suma de ' + b + ' más ' + c;
        }
        return '';
    }
    /* un producto/expresión suelta a partir de fichas, para la voz («4 por 3, más, 4 por 5») */
    function vozTokens(tokens) {
        var s = '';
        tokens.forEach(function (t) {
            if (t.k === 'n') s += ' ' + t.v;
            else if (t.k === 'o') s += t.v === MUL ? ' por' : t.v === MAS ? ', más,' : t.v === MEN ? ', menos,' : ' entre';
        });
        return s.replace(/\s+/g, ' ').trim();
    }

    /* La regla con letras de colores */
    function regla(q) {
        var op = q.op, A = '<b class="rol-a">a</b>', B = '<b class="rol-b">b</b>', C = '<b class="rol-c">c</b>', X = ' ' + MUL + ' ', O = ' ' + op + ' ';
        var izq = A + X + '(' + B + O + C + ')', izqR = A + X + B + O + A + X + C;
        var der = '(' + B + O + C + ')' + X + A, derR = B + X + A + O + C + X + A;
        var lado = (q.forma === 'rep' ? q.sub : (q.sub === 'ba' ? 'der' : 'izq'));
        var cual = lado === 'izq' ? [izq, izqR] : [der, derR];
        return q.forma === 'fac' ? cual[1] + ' = ' + cual[0] : cual[0] + ' = ' + cual[1];
    }

    /* ---------- números ---------- */
    function valores(q) {
        var m = q.op === MAS ? 1 : -1;
        return { S: q.b + m * q.c, X: q.a * q.b, Y: q.a * q.c, T: q.a * (q.b + m * q.c) };
    }

    /* ---------- generación ---------- */
    var NIV = {
        1: { a: [2, 9], b: [2, 9], resta: false, rep: ['izq'], fac: ['aa'], no: ['prod', 'dist2', 'sola'] },
        2: { a: [2, 9], b: [2, 12], resta: true, rep: ['izq', 'der'], fac: ['aa', 'ba'], no: ['prod', 'dist2', 'sola'] },
        3: { a: [2, 12], b: [2, 20], resta: true, rep: ['izq', 'der'], fac: ['aa', 'ba', 'ab', 'ba2'], no: ['prod', 'dist2', 'sola', 'div'] }
    };
    var DIVISIONES = [];
    [12, 18, 20, 24, 30, 36, 40, 48, 60].forEach(function (a) {
        for (var b = 2; b <= a; b++) for (var c = b + 1; c <= a; c++)
            if (a % b === 0 && a % c === 0 && a % (b + c) === 0) DIVISIONES.push([a, b, c]);
    });

    function generar(nivel, tipo) {
        if (!NIV[nivel]) nivel = elegir([1, 2, 3]);
        var N = NIV[nivel];
        tipo = tipo || elegir(['rep', 'fac', 'no']);
        var q = { forma: tipo, nivel: nivel, op: MAS };
        if (tipo === 'no') q.sub = elegir(N.no); else q.sub = elegir(N[tipo]);
        if (q.sub === 'div') {
            var dv = elegir(DIVISIONES);
            q.a = dv[0]; q.b = dv[1]; q.c = dv[2];
            if (Math.random() < 0.5) { q.b = dv[2]; q.c = dv[1]; }
        } else {
            q.a = azar(N.a[0], N.a[1]);
            q.b = distinto(N.b[0], N.b[1], [q.a]);
            q.c = distinto(N.b[0], N.b[1], [q.a, q.b]);
            if (q.sub === 'dist2') q.d = distinto(N.b[0], N.b[1], [q.a, q.b, q.c]);
            // signo: con resta el primer término debe ser mayor que el segundo
            var conResta = N.resta && q.sub !== 'prod' && Math.random() < 0.42;
            if (conResta) {
                q.op = MEN;
                if (q.forma !== 'no' && q.b < q.c) { var t = q.b; q.b = q.c; q.c = t; }
                else if (q.sub === 'dist2' && q.a * q.b <= q.c * q.d) { var t2 = q.b; q.b = q.c; q.c = t2; var t3 = q.a; q.a = q.c; q.c = t3; if (q.a * q.b <= q.c * q.d) q.op = MAS; }
                else if (q.sub === 'sola' && q.a * q.b <= q.c) q.op = MAS;
            }
            if (q.sub === 'sola' && q.op === MAS && Math.random() < 0.4) q.sub = 'solader';       // c + a × b
        }
        q.correcta = q.forma === 'rep' ? 'parentesis' : q.forma === 'fac' ? 'factor' : 'no';
        q.tokens = antes(q);
        q.clave = texto(q.tokens);
        return q;
    }

    /* ---------- cálculos de las trampas (lo que daría el «intento» y lo que vale de verdad) ---------- */
    function trampa(q) {
        var a = q.a, b = q.b, c = q.c, d = q.d, op = q.op, m = op === MAS ? 1 : -1;
        switch (q.sub) {
            case 'prod': return { real: a * (b * c), realTxt: a + ' ' + MUL + ' ' + (b * c), intento: (a * b) * (a * c), intentoTxt: (a * b) + ' ' + MUL + ' ' + (a * c),
                intentoOp: a + ' ' + MUL + ' ' + b + ' ' + MUL + ' ' + a + ' ' + MUL + ' ' + c };
            case 'dist2': return { real: a * b + m * c * d, realTxt: (a * b) + ' ' + op + ' ' + (c * d), intento: a * (b + m * d), intentoTxt: a + ' ' + MUL + ' ' + (b + m * d),
                intentoOp: a + ' ' + MUL + ' (' + b + ' ' + op + ' ' + d + ')' };
            case 'sola': return { real: a * b + m * c, realTxt: (a * b) + ' ' + op + ' ' + c, intento: a * (b + m * c), intentoTxt: a + ' ' + MUL + ' ' + (b + m * c),
                intentoOp: a + ' ' + MUL + ' (' + b + ' ' + op + ' ' + c + ')' };
            case 'solader': return { real: c + a * b, realTxt: c + ' + ' + (a * b), intento: a * (b + c), intentoTxt: a + ' ' + MUL + ' ' + (b + c),
                intentoOp: a + ' ' + MUL + ' (' + b + ' + ' + c + ')' };
            case 'div': return { real: a / (b + c), realTxt: a + ' ' + DIV + ' ' + (b + c), intento: a / b + a / c, intentoTxt: (a / b) + ' + ' + (a / c),
                intentoOp: a + ' ' + DIV + ' ' + b + ' + ' + a + ' ' + DIV + ' ' + c };
        }
        return null;
    }

    /* ---------- opciones de la actividad «Elige la igualdad» ---------- */
    function opcionesIgualdad(q) {
        var a = q.a, b = q.b, c = q.c, op = q.op, otro = op === MAS ? MEN : MAS, v = valores(q);
        var S = function (x) { return x.map(function (t) { return t; }); };
        function exp(partes) { // partes: lista de [valor | símbolo]
            return partes.map(function (p) { return /^[0-9]+$/.test(String(p)) ? num(p) : (p === '(' || p === ')') ? par(p) : ope(p); });
        }
        var correcta = despues(q), erroneas = [], valor;
        function evalua(partes) {                 // evalúa una lista de partes con precedencia de × y ÷ sobre + y −
            var s = partes.join(' ').replace(new RegExp(MUL, 'g'), '*').replace(new RegExp(MEN, 'g'), '-').replace(new RegExp(DIV, 'g'), '/');
            return Function('"use strict";return (' + s + ')')();
        }
        var objetivo = v.T;
        if (q.forma === 'rep' && q.sub === 'izq') {
            erroneas = [exp([a, MUL, b, op, c]), exp([a, MUL, b, MUL, a, MUL, c]), exp([a, MUL, b, otro, a, MUL, c]), exp([a, MUL, b, op, a, op, c])];
        } else if (q.forma === 'rep') {
            erroneas = [exp([b, MUL, a, op, c]), exp([b, MUL, a, MUL, c, MUL, a]), exp([b, MUL, a, otro, c, MUL, a]), exp([b, MUL, a, op, c, op, a])];
        } else if (q.sub === 'ba') {
            erroneas = [exp(['(', b, MUL, c, ')', MUL, a]), exp([b, op, c, MUL, a]), exp(['(', b, otro, c, ')', MUL, a]), exp([b, MUL, c, MUL, a])];
        } else {
            erroneas = [exp([a, MUL, '(', b, MUL, c, ')']), exp([a, MUL, b, op, c]), exp([a, MUL, '(', b, otro, c, ')']), exp([a, op, '(', b, op, c, ')'])];
        }
        // solo valen como error las que NO dan lo mismo que la operación y no se repiten
        var vistos = {}, buenas = [];
        vistos[texto(correcta)] = 1;
        erroneas.forEach(function (e) {
            var t = texto(e);
            var partes = e.map(function (x) { return x.v; });
            var val; try { val = evalua(partes); } catch (er) { return; }
            if (val !== objetivo && !vistos[t]) { vistos[t] = 1; buenas.push(e); }
        });
        buenas = barajar(buenas).slice(0, 2);
        var l = [{ tokens: correcta, ok: true }].concat(buenas.map(function (e) { return { tokens: e, ok: false }; }));
        l.forEach(function (o) { o.texto = texto(o.tokens); o.valor = null; });
        return barajar(l);
    }

    /* ---------- arrastrar: plantilla, bandeja y comprobación ---------- */
    function plantillaArrastre(q) {
        var tray = [q.a, q.b, q.c];
        var extra = null;
        if (q.nivel >= 2) { extra = distinto(2, q.nivel === 2 ? 12 : 20, tray); tray.push(extra); }
        return {
            // propiedad distributiva: ▢ [×] ▢ [±] ▢ [×] ▢  ·  sacar factor común: ▢ [×] ( ▢ [±] ▢ )   ([ ] = hueco de OPERACIÓN)
            tipo: q.forma === 'rep' ? 'distributiva' : 'factor',
            huecos: q.forma === 'rep' ? 7 : 5,
            bandeja: barajar(tray)
        };
    }
    function mismo(p, r) { return (p[0] === r[0] && p[1] === r[1]) || (p[0] === r[1] && p[1] === r[0]); }
    function comprobarArrastre(q, s) {
        var a = String(q.a), b = String(q.b), c = String(q.c), op = q.op;
        if (s.some(function (x) { return x == null || x === ''; })) return false;
        s = s.map(String);
        if (q.forma === 'rep') {
            // huecos: 0 número · 1 × · 2 número · 3 signo · 4 número · 5 × · 6 número
            if (s[1] !== MUL || s[5] !== MUL || s[3] !== op) return false;
            if (mismo([s[0], s[2]], [a, b]) && mismo([s[4], s[6]], [a, c])) return true;
            return op === MAS && mismo([s[0], s[2]], [a, c]) && mismo([s[4], s[6]], [a, b]);
        }
        // huecos: 0 número (factor común) · 1 × · 2 número · 3 signo · 4 número
        if (s[0] !== a || s[1] !== MUL || s[3] !== op) return false;
        if (s[2] === b && s[4] === c) return true;
        return op === MAS && s[2] === c && s[4] === b;
    }
    /* lo que ha montado el alumno, como fichas (para mostrarlo en la explicación) */
    function fichasArrastre(q, s) {
        var f = function (x) { return /^[0-9]+$/.test(String(x)) ? num(x) : ope(x); };
        s = s.map(function (x) { return x == null || x === '' ? '?' : x; });
        if (q.forma === 'rep') return s.map(f);
        return [f(s[0]), f(s[1]), par('('), f(s[2]), f(s[3]), f(s[4]), par(')')];
    }
    function valorFichas(tokens) {
        if (tokens.some(function (t) { return t.v === '?'; })) return null;
        var s = tokens.map(function (t) { return t.v; }).join(' ').replace(new RegExp(MUL, 'g'), '*').replace(new RegExp(MEN, 'g'), '-');
        try { return Function('"use strict";return (' + s + ')')(); } catch (e) { return null; }
    }

    /* ---------- nota de respuesta (debajo del tablero) ---------- */
    var MOTIVO_CORTO = {
        prod: 'Dentro del paréntesis hay una multiplicación, no una suma ni una resta.',
        dist2: 'Los dos productos no comparten ningún número: no hay factor común.',
        sola: 'Solo hay un producto y un número suelto: no hay factor común.',
        solader: 'Solo hay un producto y un número suelto: no hay factor común.',
        div: 'Es una división: la propiedad distributiva no sirve al dividir entre una suma.'
    };
    function nota(q) {
        if (q.forma === 'no') return '<b>No se puede.</b> ' + MOTIVO_CORTO[q.sub];
        var s = q.forma === 'rep' ? texto(antes(q)) + ' = ' + texto(despues(q)) : texto(normal(q)) === texto(antes(q)) ? texto(antes(q)) + ' = ' + texto(despues(q)) : texto(antes(q)) + ' = ' + texto(despues(q));
        return '<b>' + (q.forma === 'rep' ? 'Propiedad distributiva' : 'Factor común') + ':</b> ' + s;
    }

    global.Dist = {
        MUL: MUL, MAS: MAS, MEN: MEN, DIV: DIV, NIVELES: NIV,
        generar: generar, antes: antes, despues: despues, normal: normal,
        texto: texto, textoHTML: textoHTML, voz: voz, vozTokens: vozTokens, regla: regla, valores: valores, trampa: trampa,
        palabraOp: palabraOp, nombreOp: nombreOp,
        opcionesIgualdad: opcionesIgualdad, plantillaArrastre: plantillaArrastre, comprobarArrastre: comprobarArrastre,
        fichasArrastre: fichasArrastre, valorFichas: valorFichas, nota: nota, MOTIVO_CORTO: MOTIVO_CORTO,
        barajar: barajar, azar: azar, elegir: elegir
    };
    if (typeof module !== 'undefined' && module.exports) module.exports = global.Dist;

})(typeof window !== 'undefined' ? window : globalThis);
