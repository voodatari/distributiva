# Distributiva

**▶ Jugar: https://voodatari.github.io/distributiva/** (funciona en el navegador del ordenador, la tablet o el móvil; no hace falta instalar nada)

Juego de aula (5.º de primaria) para reconocer **cuándo se puede aplicar la propiedad distributiva de la multiplicación** y cuándo no, en los dos sentidos:

- `a × (b + c)  →  a × b + a × c`
- `a × b + a × c  →  a × (b + c)` (sacar factor común)

Sin cuentas ni base de datos: el ranking, el nombre y los ajustes se guardan en el navegador.

## Actividades

| Actividad | Qué se hace |
|---|---|
| 🔎 **Reconocer** | Se ve una operación: «¿Se puede aplicar la propiedad distributiva?» → **Sí, quitando el paréntesis**, **Sí, sacando factor común** o **No, no se puede** |
| ⚖️ **Elige la igualdad** | Tres operaciones; ¿cuál vale lo mismo? (en los dos sentidos) |
| ✋ **Arrastrar** | Se monta la operación moviendo números y operaciones (×, +, −) a los huecos; los de operación son violetas (ratón o dedo; también tocar pieza y luego hueco) |
| 🧩 **Todo junto** | Las tres mezcladas |

Niveles: 🌱 1 (sumas, números del 2 al 9) · 🌿 2 (también restas, factor a izquierda o derecha) · 🌳 3 (números mayores, factor en cualquier sitio, trampas con divisiones) · 🎲 Mixto.

Casos en los que **no se puede**: `a × (b × c)` (dentro del paréntesis hay una multiplicación), `a × b + c × d` (ningún número se repite), `a × b + c` (solo hay un producto) y `a ÷ (b + c)` (es una división).

## Modos

⏱️ Contrarreloj (30/60/90/120 s) · 💀 Muerte súbita · ❤️ Supervivencia (3 vidas y un reloj que se acelera) · 🎓 Práctica.

## Cuando se falla

«Explicar los fallos»: No · En práctica · **Siempre** (por defecto). El juego y el reloj se paran mientras se explica. La explicación (animada y narrada con voz Piper, o escrita con los mismos textos):

1. Muestra la operación con sus números de color (**a** amarillo, **b** azul, **c** naranja).
2. Dibuja los puntos (a filas de b + c) y los separa en bloques o los junta.
3. **Mueve las mismas fichas** de la operación de una forma a la otra (el factor se copia a cada término, o el repetido se saca fuera y aparece el paréntesis).
4. Comprueba con números que las dos formas dan lo mismo.
5. Resume con la regla. En los casos que no se puede, prueba igualmente y se ve que **no sale lo mismo**.

Controles: Atrás · Pausa/Seguir · Repetir · Adelante, puntos de paso, flechas del teclado, Saltar / ¡Entendido!.

## Requisitos y notas

- Navegador moderno (Chrome, Edge, Firefox, Safari). La **voz** de las explicaciones se genera en el propio dispositivo (Piper, WebAssembly): la primera visita descarga unos 75 MB y después queda guardada y funciona sin conexión. Si no carga, el juego sigue con la explicación escrita.
- La música de `1`, `2`, `3` y `fin` está en OGG: las versiones antiguas de Safari (iPhone/iPad) pueden no reproducirla; el resto del juego funciona igual.
- Tras una actualización, recarga sin caché (Ctrl + F5; en iPhone, cerrar y abrir la pestaña) si se sigue viendo la versión anterior.

## Archivos

`distributiva.js` (generador de operaciones, trampas, opciones, comprobación del arrastre; también funciona en Node) · `app.js` (pantallas, modos, partida, ranking) · `arrastre.js` (arrastrar y soltar) · `infografia.js` (explicación animada) · `explicacion.js` (versión escrita) · `voz*.js` + `piper/` (voz en el navegador) · `escala.js` (escala fija y clases móviles) · `sonido.js`, `bucle.js`, `fondo.js`, `efectos.js`, `rendimiento.js`, `ajustes.js`.
