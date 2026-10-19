# Historial de cambios

Formato de versión: `X.Y.Z`, igual que el número que llevan los archivos en `index.html` (`?v=…`) y la cinta del menú principal.

## [1.0.2] - 2026-10-19
Primera versión publicada: https://voodatari.github.io/distributiva/
- **Arrastrar**: ahora también se arrastra la multiplicación. Los huecos y las piezas de operación (× + −) son violetas y los de número, blancos; cada pieza solo cabe en su clase de hueco.
- **Explicación**: se quita el paso hablado «Has elegido… pero la correcta es…» (se repetía con el último paso). Las etiquetas «Tu respuesta / Correcta» se quedan arriba durante toda la explicación.
- **Reconocer**: la pregunta es «¿Se puede aplicar la propiedad distributiva?» con tres respuestas: «Sí, quitando el paréntesis», «Sí, sacando factor común» y «No, no se puede».
- **Música**: `titulo.ogg`→`titulo.mp3` y `start.mp3` como al principio; `1`, `2`, `3` y `fin` en OGG (bucle exacto).
- Medida de desborde del tablero más estricta (cuenta el relleno interior): la plantilla de arrastrar ya no toca el borde en móvil.

## [1.0.1] - 2026-10-19
- **Música en OGG**: `1`, `2`, `3` y `fin` pasan de `.mp3` a `.ogg` (las pistas ya vienen preparadas para loopear). El bucle usa Web Audio y repite la pista **entera**, de la primera a la última muestra: ya no se recorta el «silencio» de los extremos, que solo hace falta con los MP3 (relleno del codificador) y podía mover el punto de bucle. Comprobado: `loopStart = 0`, `loopEnd` = duración exacta del buffer, y da la vuelta sin parar. En Firefox sigue el `<audio loop>`, que con OGG no tiene hueco.

## [1.0.0] - 2026-10-19
Primera versión. Parte de la base de Silabeador (modos, ranking local, ajustes, voz Piper en el navegador, música, escala fija y vista móvil), con identidad propia: cuaderno cuadriculado azul y números con color (**a** amarillo · **b** azul · **c** naranja).

- **Actividades**
  - **Reconocer**: se ve una operación («¿Se puede aplicar la propiedad distributiva?») y se elige entre **Sí, quitando el paréntesis** (a × (b + c)), **Sí, sacando factor común** (a × b + a × c) y **No, no se puede** (sin «repartir»: es una palabra que no se ha dado en clase).
  - **Elige la igualdad**: tres operaciones, una vale lo mismo (los errores típicos: olvidar el segundo producto, multiplicar en vez de sumar, cambiar el signo…). Sirve en los dos sentidos: a × (b + c) → a × b + a × c y al revés.
  - **Arrastrar** (nuevo): se monta la operación moviendo números **y operaciones (×, + y −)** a los huecos (los huecos y piezas de operación son violetas, para ver que ahí no va un número), con ratón o con el dedo. También vale tocar una pieza y luego un hueco; una pieza colocada se puede mover o sacar arrastrándola fuera.
  - **Todo junto**: las tres actividades mezcladas.
- **Operaciones**: con suma y con resta; el factor repetido a la izquierda o a la derecha, y en niveles altos en cualquier sitio (`3 × 11 + 2 × 3`); y las **trampas** que no se pueden: `a × (b × c)`, `a × b + c × d`, `a × b + c`, `a ÷ (b + c)`. Todos los números de una operación son distintos entre sí (una sola forma válida de resolverla). Niveles 1-3 y Mixto.
- **Explicación animada y narrada al fallar** (o escrita, con los mismos textos): la operación aparece con sus números de color; las *mismas fichas* se mueven de una forma a la otra (el factor se copia a cada término, o el repetido se junta en uno y aparece el paréntesis); un dibujo de puntos (a filas de b + c) se separa en bloques o se junta; se comprueba con números que las dos formas dan lo mismo; y se resume con la regla. En los casos que no se puede, se prueba igualmente y se ve que **no sale lo mismo**. Pasos, pausa, atrás/adelante y repetir como en Silabeador.
- **Modos**: Contrarreloj, Muerte súbita, Supervivencia y Práctica; «Explicar los fallos» (No · En práctica · Siempre) con el juego y el reloj parados mientras se explica; «Ver la respuesta al fallar».
- **Móvil / iPhone** desde el primer día: clases `html.estrecho` / `html.corta` y `--alto` puestas por `escala.js` (sin duplicar el CSS para la ventana virtual de Safari), tablero de tamaño constante, nota de respuesta con sitio reservado (0 px de desplazamiento al contestar), desbloqueo de audio con `touchend`/`click`, `text-size-adjust`, medidas con rectángulos reales.
- Sin cuentas, sin base de datos ni modo docente: todo local (ranking, nombre y ajustes en el navegador).
