# Gemas de la Selva — notas de diseño

**Stack:** Three.js + Vite (ES modules). Móvil en horizontal, tercera persona, bioma selvático.

## Reglas de gemas (`src/core/gems.js`, con tests)
10 U = 1 D · 10 D = 1 C. Componer/descomponer conserva el valor. El tótem pide cantidades
exactas por tipo (no por valor total), por eso hay que mezclar.

## Niveles (`src/levels/index.js`)
1. **El primer claro** — pide 5 U, en el mapa una D → descomponer.
2. **Tres claros** — 3 escenas con clima distinto (verde / ámbar / niebla), un tótem por tipo: U (4), D (3), C (1).
   Hay 14 D y 2 U repartidas: hay que viajar, **componer** 10 D en una C y **descomponer** lo que sobra.
3. **El río partido** — dos tótems **de suma**: entre los dos hay que reunir 8 U. El jugador elige el reparto
   (4+4, 5+3, 6+2, 7+1) en una ventanita; cada orilla debe aportar ≥ 1 (`minEach`, configurable en el nivel).
4. **Tres ríos** — 3 escenas de río conectadas, cada una con un tótem por orilla (6 en total) y su aro de balanceo.
   Las gemas están repartidas; la C está en la última escena.

Un solver (BFS) en `levels.test.js` garantiza que cada nivel tiene solución y que los niveles 2 y 4 NO se resuelven
sin viajar entre escenas.

## Claridad del mapa
Minimapa que rota con la cámara (marca tótems, gemas, salidas y aros; lo lejano se pega al borde), senderos de
tierra que llevan a cada punto (y en ríos convergen en el aro de cada orilla), balizas de luz sobre tótems y
salidas, menos maleza en la zona jugable y un color de suelo/cielo distinto por escena.

## Interfaz
- **Mezclador**: ventana compacta sobre el juego (el último cuadro queda visible detrás; el render se pausa).
  Columnas C · D · U como un número, Σ valor total y el cambio neto de la última mezcla.
- **Acciones**: burbuja que sale del propio tótem / aro / arco (responde al tocar). Sin botón en la esquina.
- **Depósito** (tótems de suma): tope = no pasarse del total ni dejar sin mínimo a la otra orilla.

## Estructura
- `src/core/` lógica pura con tests (gemas, estado de nivel y sumas, látigo, senderos). `src/levels/` datos. `src/game/` Three.js.
- `src/ui/` HUD, blueprint (compartido con el juego por un store) y menú de niveles (progreso en localStorage).

## Rendimiento ("solo renderizar lo que se ve")
- Vegetación en `InstancedMesh` **por chunks de 20 m**: cada chunk tiene su bounding sphere y el
  frustum culling lo descarta entero. Geometría y material compartidos.
- Terreno = 1 mesh; sin sombras en tiempo real (sombra "blob"); niebla + `far` corto.
- Colisión con rejilla espacial (solo celdas vecinas), altura por función (sin raycasts).
- Blueprint abierto → se cancela el `requestAnimationFrame` (el overlay es opaco).
- Pixel ratio adaptativo (1–1.75) según el tiempo de frame.
- Solo existe en memoria la escena activa; `world.dispose()` libera al cambiar.

## Controles
Móvil: joystick flotante (mitad izquierda), arrastrar a la derecha = cámara, botones Mezclar/Entregar.
Teclado: WASD/flechas, E = entregar, B = mezclador.
