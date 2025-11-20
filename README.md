# Escape de Abstracción

**Escape de Abstracción** es un minijuego web pensado para trabajar la **abstracción** y la **búsqueda de patrones** en contextos de enseñanza de programación y pensamiento computacional.

La idea de uso en aula es muy simple:

- El docente proyecta la pantalla con el juego (Genera automáticamente un **QR** con la URL local).
- El juego se sirve dentro de la **intranet / LAN del aula** (con `serve_lan.py`).
- Cada estudiante entra desde su dispositivo (celular, notebook, etc.) y resuelve el puzzle de forma individual o en pequeños grupos.

No requiere backend ni base de datos: es un **juego 100% estático (HTML + CSS + JS)**.

---

## Objetivo del juego

El jugador se encuentra en una oficina con una **puerta cerrada**.  
En las distintas escenas hay **pistas repartidas por el escenario** (post-its, íconos, anotaciones) que describen **relaciones entre pares de conceptos**.

Por ejemplo (idea general):

- `manzana → naranja`
- `naranja → banana`
- `melon → piña`

El juego construye internamente un **mapa de relaciones** (`key → value`) y genera un **código de 3 “llaves”** que representan la combinación para abrir la puerta.  
El desafío del jugador es:

1. Explorar las escenas y **leer las pistas relevantes**.
2. **Ignorar el ruido** (pistas falsas o distractores).
3. Descubrir qué valores finales se obtienen al **encadenar las relaciones** (A → B → C).
4. Seleccionar las tres respuestas correctas en los desplegables para **abrir la puerta**.

Cuando acierta:

- Ve una pantalla de **“Victoria”** con el tiempo total y la cantidad de intentos.
- Puede jugar de nuevo con una **nueva combinación aleatoria** de pistas.

---

## Enfoque educativo

Este juego está diseñado para trabajar específicamente:

- **Abstracción**: enfocarse en la relación esencial entre elementos y no en todos los detalles visuales.
- **Reconocimiento de patrones**: detectar cadenas de “si A entonces B”.
- **Razonamiento lógico**: entender que algunas pistas solo tienen sentido cuando se encadenan.
- **Lectura cuidadosa y filtrado de información**: no todo lo que aparece en pantalla es útil para resolver el problema.

Es ideal para:

- Talleres de **pensamiento computacional**.
- Clases introductorias de **algoritmos** o **estructuras de datos (grafos / mapeos)**.
- Actividades tipo **escape room digital** en el aula.

---

## Stack técnico

- **Frontend**:
  - HTML5 (`index.html`, `game.html`)
  - CSS (`css/styles.css`)
  - JavaScript moderno (`js/menu.js`, `js/game.js`, módulos ES)
- **Datos de niveles**:
  - JSON (`assets/levels.json`) con:
    - Fondos de escena.
    - Posiciones de pistas en porcentaje (x, y, escena).
    - Banco de pares `key → value` para construir el puzzle.
- **Servidor opcional para LAN**:
  - Script Python `serve_lan.py` basado en `http.server`.
  - Soporte para generar QR con la librería `qrcode`.

No hay dependencias de build (no usa bundlers ni frameworks pesados): podés abrirlo con cualquier servidor estático.

---

## Estructura del proyecto

```text
Escape-Abstraccion-main/
├─ index.html           # Pantalla de inicio y selección de nivel
├─ game.html            # Vista principal del juego (puerta + escenas + pistas)
├─ css/
│  └─ styles.css        # Estilos generales y layout responsive
├─ js/
│  ├─ menu.js           # Lógica del menú / selección de niveles
│  └─ game.js           # Mecánicas del puzzle, HUD y lógica del juego
├─ assets/
│  ├─ levels.json       # Definición de niveles, pistas y banco de pares
│  ├─ hoja-pista.png    # Imagen de “hoja de pista” tipo lupa/cuaderno
│  ├─ icono-lupa.png    # Icono de lupa para mostrar la hoja
│  ├─ lobby.jpg         # Fondo de lobby
│  ├─ oficina.jpg       # Fondo de oficina
│  └─ puerta.jpg        # Fondo con la puerta principal
└─ serve_lan.py         # Script de servidor local para LAN + QR
```

---

## 🕹Mecánicas de juego (detalle técnico)

### 1. Niveles y escenas

El archivo `assets/levels.json` define un arreglo de niveles:

- `id`: identificador legible del nivel (`"Oficina-Penguin"`, etc.).
- `scenes`: cantidad de escenas (pantallas) del nivel.
- `backgrounds`: lista de imágenes de fondo por escena.
- `clueLayout`: posiciones de pistas (`x`, `y`, `scene` en porcentajes).
- `bank`: banco de pares `{ "key": ..., "value": ... }` a partir de los cuales se genera el puzzle.

En `js/menu.js`:

- Se carga `levels.json`.
- Se llena el `<select>` de niveles.
- Al pulsar “Iniciar”, se navega a `game.html?level=X`.

### 2. Generación del puzzle

En `js/game.js`:

- Se carga el nivel seleccionado (`LEVEL`).
- Se clona el layout de pistas (`clues`) y el banco de pares (`BANK`).
- Se construye una combinación:

  1. Se generan pistas base a partir de pares del banco.
  2. Se eligen 3 claves (`doorCode`) con valores distintos.
  3. Una de las claves se convierte en **relación compuesta** A → B → C (encadenando pares).
  4. Se rellenan pistas falsas evitando:
     - Duplicar valores.
     - Crear relaciones verdaderas extra que rompan el puzzle.

- El resultado: un conjunto de pistas en pantalla donde **solo algunas** forman el mapa verdadero que conduce a la solución del código de la puerta.

### 3. Interacción del jugador

- El jugador recorre las escenas y puede:
  - Pasar entre escenas (puerta, oficina, lobby).
  - Abrir una **hoja de pista** con todas las pistas encontradas.
- En la parte derecha, tiene tres `<select>` (`#sel0`, `#sel1`, `#sel2`) donde elige el **valor final** para cada una de las 3 claves del código.
- Al hacer clic en “Comprobar”:
  - `validate(userSolution)` compara la respuesta del jugador con la solución correcta calculada en `computeCorrectSolution()`, que recorre el grafo de relaciones hasta llegar al valor final.
  - Si acierta:
    - Muestra mensaje de éxito.
    - Abre el panel de victoria (`openWin()`), con:
      - Tiempo total.
      - Número de clics/intententos.
  - Si no:
    - Muestra mensaje de error y una pista textual para seguir intentando.

---

## Puesta en marcha (local)

### Opción 1 – Con servidor simple de Python

Dentro de la carpeta del proyecto:

```bash
# Python 3
python -m http.server 8000
```

Luego abrí en el navegador:

- `http://localhost:8000/index.html`

### Opción 2 – Usando `serve_lan.py` (recomendado para el aula)

`serve_lan.py` es un pequeño helper para:

- Levantar un servidor HTTP en un puerto concreto.
- Detectar la IP local de la máquina.
- (Opcional) Abrir el navegador automáticamente.
- (Opcional) Mostrar un QR con la URL para que los estudiantes se conecten rápido desde sus celulares.

Uso típico:

```bash
# Activar tu entorno y luego:
python serve_lan.py -p 5500
```

> Si el puerto ya está en uso, el script te avisa y podés probar con otro, por ejemplo `-p 8080`.

---

## Uso en aula (sugerencia)

1. **Preparar el servidor**  
   En la computadora del docente:

   ```bash
   python serve_lan.py -p 5500 --open-qr
   ```

2. **Proyectar la pantalla**  
   Proyectar `index.html` o `game.html` (según el flujo que quieras) en la pantalla del aula.

3. **Estudiantes se conectan**  
   - Desde sus celulares/notebooks, los estudiantes escanean el QR o escriben la IP local + puerto según indique el script (por ejemplo `http://192.168.0.10:5500`).
   - Cada uno juega en su propio dispositivo, pero todos ven la misma temática en la pantalla principal.

4. **Discusión**  
   - Una vez que varios estudiantes hayan resuelto el puzzle, se puede discutir:
     - ¿Qué pistas eran esenciales?
     - ¿Cuáles eran ruido?
     - ¿Cómo se dieron cuenta de que algunas relaciones se podían encadenar?

---

## Personalización de niveles

El archivo `assets/levels.json` es el corazón de la personalización:

- Podés cambiar la **temática**:
  - Nombres de claves (`key`).
  - Valores (`value`).
  - Fondos (`backgrounds`).
- Podés mover las pistas cambiando:
  - `x`, `y` (porcentajes de posición).
  - `scene` (índice de escena).

Esto abre la puerta a:

- Diseñar distintos niveles para distintas edades.
- Trabajar con vocabulario de otras materias (ciencias, idiomas, historia, etc.).
- Crear versiones específicas para un taller o evento.

---

## Autor

**Alejandro Arriola**  
Docente de programación y desarrollador de experiencias educativas jugables en constante formación.

- Itch.io: https://alevarriola.itch.io
- GitHub: [@alevarriola](https://github.com/alevarriola)
