# Pirate Tides · Marea de saqueo

Prototipo local de guerra pirata en Three.js. El mundo navegable mide 344 × 306 unidades (el doble de ancho y largo que la primera versión) y contiene once islas. Puerto Ron Ron está despejado; las nubes quedan fuera del área navegable.

## Ejecutar y verificar

`npm install`, después `npm run dev -- --port 5174`.

`npm run build` compila. `node --test test/*.test.js` ejecuta las pruebas.

## Controles

| Tecla / acción | Resultado |
| --- | --- |
| W/S, A/D, flechas | Acelerar, frenar, girar |
| Clic en el mar | Navegar a un destino |
| Clic en enemigo, criatura o torre | Fijar y disparar |
| Mantener Espacio | Repetir andanadas |
| Mantener Shift | Acelerar durante hasta 4 s; la resistencia se recupera al descansar |
| C | Servir ron: 7 s de moral y recarga más rápida; 3 raciones iniciales |
| Clic derecho mantenido | Apuntar manualmente |
| Z / R | Cambiar munición / fuego griego |
| V | Sofocar un incendio a bordo |
| E | Conquistar o saquear una isla cercana; repetir durante la invasión para retirarse |
| Q | Abordar un barco cercano |
| B | Astillero: casco, cañones y capacidad |
| F | Compañía: exploradores, guardias, corsarios, especialistas y arsenal |
| J | Defensas de la isla cercana |
| G | Fijar el puesto de una escolta que te sigue |
| T / P / H | Clima / pausa / ocultar interfaz |
| Tab | Carta náutica y destinos descubiertos |
| Rueda | Zoom |
| M / botón de la carta | Alternar mapa cercano y archipiélago completo |

Ajustes visuales → Abrir álbum permite recorrer las once islas de cerca. Pausa la expedición y mantiene las animaciones ambientales. Esc vuelve al barco.

## Identidad de las islas

- Puerto Ron Ron: barrio de casas sobre pilotes, comercios, pasarelas y faro.
- Bastión del Mal Aliento: fortaleza, puerta monumental, capitanía, mercado y pecio.
- Ruinas de la Marea Hueca: santuario escalonado, arcos y piedra luminosa.
- Diente de Ceniza: volcán con cráter, colada, ceniza y un naufragio.
- Cayo Escarcha: refugio nevado, hielo y pinos.
- El Último Amarre: monumento de ancla, ruinas y restos de un barco.
- Cayo del Contrabando: gran faro, aduana y acceso entre rocas.
- Las Calderas del Diablo: dos cráteres y un asentamiento entre coladas.
- Fuerte del Diente Roto: batería corsaria y edificios de tejado rojo.
- Isla de las Malas Decisiones: taberna, pozo y caserío.
- Los Colmillos del Norte: agujas curvas de hielo y refugio.

Los barcos tienen cascos y aparejos propios: cúter de vela latina, bergantín de dos mástiles, galeón de tres y tres cubiertas con castillo elevado, explorador estrecho con mesa de cartas y guardacostas bajo con placas, remos y batería. Los piratas llevan variaciones de sombrero, parche, barba, faja, sable y hebilla. Los especialistas muestran herramientas o mochilas.

## Campaña y ritmo

Empiezas junto al puerto con un adelanto de 200 oro. La carta náutica está prácticamente cubierta. Conservas el terreno descubierto, pero la visión de enemigos depende de vigías, barcos aliados e islas propias. El oro saqueado viaja a bordo y se pierde al hundirse; solo se acredita en el puerto.

- Explorador: 160 oro, máximo dos, velocidad 2,25; no dispara y puede ser destruido. Tier I revela, II detecta tesoros y grandes criaturas (180 oro), III saquea islas pequeñas sin enemigos (260 oro). Tarda 28 s y vuelve al puerto con los cofres.
- Guardacostas: 140 oro, 95 casco, velocidad 5,4 y 8 de daño base. Sigue al capitán hasta fijar una zona con G. Reagrupar desde Compañía permite cambiarla.
- Goleta corsaria: 240 oro, 80 casco, velocidad 8 y 13 de daño base. Dos mástiles con velas latinas, ocho cañones y una silueta propia. Comparte el máximo de tres escoltas con los guardacostas.
- Especialistas: 45 oro para convertir un marinero disponible. Reparadores: +0,18 casco/s por persona después de ocho segundos sin daño. Saqueadores: reducen 18 s de saqueo hasta un mínimo de 10. Todos comparten el límite del barco. Reponer una baja cuesta 15 oro.
- Guarniciones: 5, 8, 12 y 16 piratas; independientes del barco. Se compran en la isla propia con oro asegurado. Las bajas se reponen por separado.
- Torres: 180 casco, destruibles. Mejoras separadas de daño, alcance y cadencia, tres niveles. Cubren el desembarco y deben destruirse antes de conquistar.
- Conquista: entre 28 y 65 s según tropas y un margen pequeño. Hay bajas durante el asalto. La llegada de un defensor disputa y hace retroceder el progreso. El defensor recibe aviso. La IA organiza incursiones periódicas sobre islas azules.
- Hierro, cadenas, brasas y granadas: mejoras independientes de hasta tres niveles. Cadenas ralentizan; brasas queman durante cinco segundos. Las granadas tienen vuelo alto, dos proyectiles y explosión de área de 5,5 m, con recarga más lenta. Los efectos se renuevan sin multiplicarse por cada proyectil. El fuego griego deja una zona temporal y también se mejora.
- Kraken, ballena, serpiente y dragón: ataques de área anunciados con 2,6 s para esquivar. La ballena responde solo si la provocan. Sus derrotas dejan botín y EXP; el rango concede +5 casco, +2% daño y una plaza. Reaparecen después de 90 s.

Cada costado recarga por separado: la andanada sale del lado que apunta al objetivo y premia el ángulo (plena potencia de través, penalización de proa/popa); cruzar la T da +15%. La munición de cadena destroza el aparejo y ralentiza el barco hasta repararlo. El abordaje se roba el 60% del oro que lleva el rival. En combate intenso los diálogos de tripulación se diferencian hasta que la mar se calma.

Los valores son una primera base de balance y requieren sesiones de juego. El mapa tiene más distancias, el saqueo tarda y no hay producción automática de oro. La partida termina al conquistar una base; el reloj muestra el tiempo transcurrido.

## Pulido visual y experiencia

[Ver capturas reales de la revisión visual](docs/visual-review/README.md).

La bienvenida ilustrada explica el ciclo de explorar, equiparse y conquistar antes de arrancar el reloj. El puerto compara casco, velocidad y daño de los tres tipos de apoyo; las mejoras de explorador tienen una sección independiente. La goleta corsaria es una unidad funcional con estadísticas propias, no una tarjeta decorativa.

Las costas incorporan arena y vegetación con colores más coherentes, espuma, reflejos suaves, destellos en aguas bajas, palmeras animadas y seis botes de pesca amarrados a los puertos y cayos. Los botes son ambientación y respetan la visibilidad de su isla. La geometría del terreno conserva su estilo voxel. El suavizado de bordes y la resolución del render mejoran la lectura de cascos y aparejos; Calidad baja sigue disponible.

La guía de la expedición responde al estado real de la partida: invasión, incendio, casco dañado, combate, saqueo y botín. Se puede plegar y arranca compacta en pantallas pequeñas. El marcador de navegación queda anclado al destino real sobre el agua, incluido el ajuste de ruta que evita las costas; se retira al tomar el timón manualmente. La pausa admite P, Escape y botón; el resultado muestra bajas causadas, mejor racha, daño y duración reales.

El HUD inferior izquierdo tiene una composición propia en `flagship-hud.js` y `flagship-hud.css`: retrato del bergantín, rango, casco, plazas de tripulación ocupadas y vacantes, velas, experiencia y velocidad. El daño deja una estela que permite leer cuánto casco se perdió; la reparación en puerto lleva un brillo suave y las subidas de rango un destello dorado. El retrato navega sobre un pequeño shader de agua, limitado a 12 actualizaciones por segundo (4 en calidad baja), con fondo CSS de respaldo. Las cifras siguen la capacidad real del barco, incluidas sus mejoras. La distribución reserva espacio para los controles y el minimapa; en pantallas muy angostas conserva los datos y traslada el rango al encabezado.

Las ilustraciones nuevas, sus prompts y usos están en [`public/assets/voyage/GENERATION.md`](public/assets/voyage/GENERATION.md). Se distribuyen como WebP optimizados. Manrope y Cormorant Garamond se sirven localmente en WOFF2 con sus licencias OFL, sin solicitudes a Google Fonts durante la partida. Las nuevas animaciones decorativas respetan la preferencia de movimiento reducido.

## Técnica y alcance

La interfaz de combate usa ilustraciones raster generadas para estandartes, reloj de timón, medallones, iconos y avisos con retratos de seis tripulantes. Los marcos conservan su relación de aspecto; el texto se coloca con HTML y los mensajes largos continúan en otra página. La composición vive en `hud-reference.css`. Las imágenes elegidas y sus prompts están en `public/assets/pirate-ui/v2/GENERATION.md`. El retrato del barco se renderiza una sola vez a partir del modelo real y se actualiza al comprar mejoras. Oro a bordo, cofres y caja están separados; el rango, la EXP y la tripulación muestran los valores de la partida.

La carta cercana sigue al capitán. La carta completa conserva las proporciones y encaja todo el rectángulo del mar dentro de la brújula. Los exploradores marcan sus descubrimientos y los comunican mediante un aviso con retrato.

Escena 3D procedural con acabado pixelado, geometría agrupada, articulaciones conservadas, espuma y reflejos, velas animadas y partículas reutilizadas. Cinco climas con transiciones de luz, lluvia, relámpagos, nieve y oleaje. Los destellos respetan movimiento reducido. Sonido opcional.

Sigue siendo una partida local con IA. No se han implementado multijugador en red, cuentas ni persistencia. El álbum es una vista artística del prototipo y permite ver islas aún no descubiertas durante la expedición.

Módulos principales: `game.js` integra la simulación; `campaign.js` administra flota, territorio e interfaz; `campaign-rules.js` contiene reglas comprobables; `exploration.js` maneja niebla; `fauna-combat.js` los ataques de criaturas; `landmarks.js` la arquitectura; `world-detail.js`, `world.js`, `pixel-art.js`, `sea-effects.js` y `weather.js` construyen el aspecto gráfico.
