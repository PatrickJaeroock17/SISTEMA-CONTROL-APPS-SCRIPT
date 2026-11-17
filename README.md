# 🐔 Sistema de Control de Ventas y Entregas · Pollada CCATina 2026

Aplicación web para controlar la **venta de tickets** y la **entrega (recojo) de pedidos** de la Pollada CCATina 2026 del CCAT (FIIS-UNI). Funciona sobre **Google Sheets + Google Apps Script**, sin servidores propios ni costo, y se usa desde el celular o la computadora.

> Proyecto real, construido para un evento estudiantil. Los datos de ventas, personas y accesos **no** están en este repositorio: solo el código.

## Qué resuelve

Una pollada tiene dos equipos trabajando a la vez: quienes **venden** y quienes **entregan**. El sistema evita los problemas típicos: tickets vendidos dos veces, entregas duplicadas, pagos sin confirmar y falta de trazabilidad.

| Módulo | Qué hace |
|---|---|
| **Ventas** | Registra la venta de un ticket numerado, con comprador, medio de pago y estado de pago. Permite confirmar el pago, anular y corregir. |
| **Entregas** | Verifica un ticket y confirma el recojo. Bloquea tickets no vendidos, anulados, sin pago confirmado o ya entregados. Permite revertir con motivo. |
| **Dashboard** | Metas, vendidos, entregados, pendientes y recaudación por lote, área y vendedor. |
| **Tickets** | Generación de rangos por lote y consulta del estado de cada número. |
| **Reportes** | Reportes filtrables y chequeo de integridad de los datos. |
| **Configuración** | Parámetros del evento, lotes, usuarios y auditoría. |

Ventas y Entregas son **módulos independientes**: cada uno tiene su propio enlace (`/exec?v=entregas`) y su propio rol, para que el personal de recojo solo vea lo que necesita.

## Decisiones de diseño

- **Un solo punto de entrada** `api(action, payload, token)`; todas las demás funciones son privadas.
- **Roles con permisos por ruta:** `ADMIN`, `VENTAS`, `ENTREGAS`, `LECTURA`. Los permisos se validan **en el servidor**, no solo en la pantalla.
- **Acceso:** cuenta Google para el dueño o el dominio y, para el resto, **correo + PIN**. El PIN se guarda como hash SHA-256 con sal (en las propiedades del script, nunca en la hoja), con sesión temporal y bloqueo tras 5 intentos fallidos.
- **Concurrencia:** `LockService` en ventas y entregas para que dos personas no registren el mismo ticket a la vez.
- **Auditoría completa:** cada acción queda en la pestaña `AUDITORIA` (quién, cuándo, valor anterior y nuevo, motivo). **No se borra nada:** se usan estados `ANULADO` / `REVERTIDO`.
- **Seguridad de datos:** neutralización de inyección de fórmulas en Sheets y escape de HTML en la interfaz.
- **Datos DEMO separados:** tickets `DEMO-###`, lote `LDEMO`, filtro Reales / Solo DEMO y archivado a pestañas `ARCHIVO_DEMO_*`, para poder probar sin contaminar los datos reales.
- **Normalización de números de ticket** (`1`, `001` y `000-001` son el mismo ticket) e IDs secuenciales que no se reutilizan.

## Estructura

```
src/
  Code.gs           Backend: rutas, permisos, reglas de negocio, auditoría, DEMO
  Index.html        Estructura de la app (SPA)
  JavaScript.html   Lógica de la interfaz
  Styles.html       Estilos responsive (tema CCAT)
  appsscript.json   Manifiesto de Apps Script
test/
  mock.js           Simulación de los servicios de Apps Script (Sheets, Lock, Cache, etc.)
  run.js            74 pruebas del backend
  ui.js             20 pruebas de la interfaz con jsdom
docs/
  GUIA_DESPLIEGUE.md  Instalación, despliegue y operación el día del evento
  PROMPT_DISENO.md    Especificación de la que parte el sistema
```

## Pruebas

Las pruebas corren en Node y no necesitan cuenta de Google, porque `test/mock.js` simula los servicios de Apps Script.

```bash
npm install
npm test
```

Cubren, entre otras cosas: roles y permisos, bloqueo por intentos fallidos, venta y entrega duplicadas, tickets anulados, reversión de entregas, formato de números, integridad y separación DEMO.

## Instalación

1. Crea una hoja de Google y abre **Extensiones → Apps Script**.
2. Copia los archivos de `src/` (`Code.gs`, `Index.html`, `JavaScript.html`, `Styles.html`, `appsscript.json`).
3. Recarga la hoja y usa el menú **🐔 Pollada CCAT → Inicializar** para crear las pestañas.
4. Despliega como **Aplicación web** (ejecutar como tú; acceso a cualquier cuenta Google).

Detalle paso a paso, configuración y operación del evento en [`docs/GUIA_DESPLIEGUE.md`](docs/GUIA_DESPLIEGUE.md).

## Tecnologías

Google Apps Script (JavaScript) · Google Sheets como base de datos · HTML/CSS/JS sin frameworks · Node.js + jsdom para pruebas.

## Autor

**Patrick Tello** · Estudiante de Ingeniería Industrial, UNI.

## Licencia

[MIT](LICENSE)
