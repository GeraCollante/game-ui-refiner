# refiner-ui/tools

Static analysis para `../index.html`. Detecta los bugs que ya nos quemaron en este proyecto.

## Setup (una vez)

```bash
cd refiner-ui/tools
npm install
```

(instala `acorn` localmente, ~200KB, no toca el resto del repo)

## Uso

```bash
# Chequea ../index.html (default)
node check.mjs

# O via npm script
npm run check

# O contra otro archivo
node check.mjs path/to/otro.html
```

Exit code: `0` si está limpio, `1` si encuentra problemas.

## Qué chequea

| # | Check | Por qué importa |
|---|---|---|
| 1 | Existe el bloque inline `<script>...</script>` antes de `</body>` | Estructura básica |
| 2 | No hay `</script>` literal dentro del JS | Cierra el tag prematuramente y rompe todo el script (nos pasó) |
| 3 | Balance de `{}` `()` `[]` | Detecta truncamiento o edits rotos |
| 4 | Parsea con acorn (ECMAScript 2023) | Sintaxis válida |
| 5 | Recursión directa o indirecta entre funciones (Tarjan SCC) | Detecta `A → A` y `A → B → A` (nos pasó con `callModel`) |
| 6 | IDs referenciados desde JS (`$('foo')`, `getElementById('foo')`) que no están declarados en el HTML | Refactors que mueven elementos sin actualizar selectores |

## Cuándo correrlo

Ideal: antes de cada commit grande, o como pre-commit hook.

Mínimo: cada vez que hagas un edit que toque varias funciones, después de cualquier rename con `replace_all`, o cuando aparezca un error raro en el browser.

## Limitaciones honestas

- **No detecta runtime issues**: bugs lógicos, race conditions, fetch fallidos
- **No analiza closures**: la detección de recursion solo mira llamadas a funciones top-level (declaration o `const x = () => {}`); funciones anidadas pueden colarse
- **No revisa CSS/HTML semántico**: solo el bloque JS principal y los IDs
- **Asume un solo bloque `<script>` inline grande** antes de `</body>` (los `<script src="...">` del header se ignoran)
