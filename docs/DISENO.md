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

## Interfaz y HUD Móvil
- **Joystick táctil permanente (inferior izquierda)**: base de vidrio esmeralda tallada (~126px) con runas cardinales, pomo 3D claymorphic con gema esmeralda incrustada, halo luminoso al arrastrar y física de resorte. Controlable tanto con toque en móviles como con arrastre de ratón en escritorio.
- **Botón de acción móvil primario (inferior derecha)**: estilo Brawl Stars / Genshin Impact (~76px), táctil con relieve 3D, animación de entrada y respuesta inmediata en `pointerdown`. Iconografía contextual según la interacción (tótem, látigo, portal).
- **Barra de inventario (superior izquierda)**: píldora de vidrio esmeralda con reflejos (`backdrop-filter: blur`), cápsulas individuales por tipo de gema (U = verde esmeralda, D = ámbar oro, C = rosa rubí) y números en fuente tabular.
- **Minimapa con bisel dorado**: marco relicario tallado en oro/vegetal, indicador de orientación norte en 12 o'clock y brillo de lente.
- **Objetivo / Tótems (centro superior)**: diseño limpio "Iconos > Texto" con runa de tótem, fichas visuales de gemas requeridas y checkmark (✓) brillante neón al completar.
- **Acciones superiores (superior derecha)**: botón de Menú con icono SVG y botón Mezclador con icono de gema mágica y micro-animación de pulso encantado.
- **Mezclador**: ventana compacta sobre el juego (el último cuadro queda visible detrás; el render se pausa). Columnas C · D · U como un número, Σ valor total y el cambio neto de la última mezcla.
- **Depósito** (tótems de suma): tope = no pasarse del total ni dejar sin mínimo a la otra orilla.
- **Teclado (desktop)**: WASD / flechas, E / Enter = interactuar, B / Tab = mezclador.

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

## Rediseño: un mundo circular por capas
- Cada nivel es **un solo mundo circular** dividido de norte a sur en capas a distinta altura:
  **Pradera** (alta, abierta, luminosa) · **Bosque** · **Bosque profundo** (bajo, denso, oscuro). El nivel 1 usa 2 capas; los demás, 3.
- Entre capas hay **acantilados** (roca, no se trepan) y **rampas** (sendero de arena entre paredes de roca). Sin pantallas de carga.
- El cielo, la niebla, el color del suelo y la espesura se mezclan de forma continua según la capa en que estás.
- Nivel 1: la D está en la pradera y el tótem en el bosque. Nivel 2: tótem C arriba, D en medio, U abajo.
- Nivel 3: **un único río de norte a sur**, perpendicular a las capas, las parte todas por la mitad en orilla Oeste y Este (suma 8 U, reparto libre). Cae en cascada en cada acantilado. La D necesaria está en el bosque profundo del lado oeste.
- Nivel 4: el mismo río único atraviesa las tres capas; hay un aro de látigo por capa (3) y un tótem en cada orilla de cada capa (6).
- Las rampas alternan de orilla (arriba por el Este, abajo por el Oeste), así que hay que cruzar el río para recorrer todo.
- Lógica pura: `core/terrain.js` (alturas, pendientes, `walk`), `core/paths.js` (grafo de navegación y senderos).
- Tests: alcanzabilidad real a pie (rampas + látigo), sin rampas las capas quedan aisladas, senderos solo cruzan capa por rampas.

## Escenificación, ritmo y caídas

- **Más bosque:** el bosque se agrupa en bosquetes con claros entre ellos; hay pinos altos, helechos (bosque y profundo) y flores de colores (pradera). Espesura: pradera abierta < bosque < bosque profundo.
- **Ritmo de carrera:** caminar sin parar en línea recta da hasta **+30 %** de velocidad (7,28 m/s sobre 5,6). El HUD muestra el porcentaje en vivo (⚡ +N %) y avisa al llegar al máximo.
- **Caídas:** subir está limitado (acantilado = pared), bajar no. Caminar al borde de una capa alta hace caer al jugador con gravedad. Si la caída pasa de 1,2 m queda aturdido: pausa total (35 % del tiempo), luego recupera la velocidad poco a poco; se aplasta, se encorva y la cámara se hunde un instante.
- La cámara se acerca si el relieve tapa al jugador; el cauce del río y su talud son un muro (no se baja al agua).
