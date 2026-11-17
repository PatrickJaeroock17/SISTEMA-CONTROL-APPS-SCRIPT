# Pollada CCATina 2026: guía de instalación, despliegue y uso

Sistema de control de ventas y entregas con Google Sheets (base de datos), Google Apps Script (backend) y una aplicación web responsive.

## Estado actual

| Etapa | Estado |
|---|---|
| Código generado (backend, interfaz y manifiesto) | ✅ Listo, en la carpeta `src/` |
| Pruebas automáticas del código (simulación de Sheets) | ✅ 74 pruebas de backend y 20 de interfaz, todas OK |
| Hoja de cálculo creada | ⏳ La creas tú (paso 1) |
| Permisos autorizados | ⏳ Los autorizas tú con la cuenta del CCAT (paso 3) |
| Aplicación desplegada y enlace real | ⏳ Paso 6. Hasta ese momento **no existe un enlace** |
| Pruebas DEMO sobre la hoja real | ⏳ Paso 5 |

> No hay una conexión directa entre Claude y tu Google Apps Script. Por eso este paquete contiene todo el código y el propio script crea las pestañas al ejecutarse. No se necesita compartir contraseñas, tokens ni el ID de la hoja con nadie.

---

## 1. Estructura de archivos

| Archivo en Apps Script | Tipo | Contenido |
|---|---|---|
| `Code.gs` | Script | Backend: autenticación, reglas, ventas, entregas, dashboard, auditoría, DEMO y menú |
| `Index.html` | HTML | Estructura de la página |
| `Styles.html` | HTML | Estilos (colores CCAT, móvil y escritorio, impresión) |
| `JavaScript.html` | HTML | Lógica de la interfaz |
| `appsscript.json` | Manifiesto | Zona horaria de Lima, permisos mínimos y configuración de la web app |

La carpeta `test/` solo sirve para verificar el código en una computadora (con Node.js). **No se copia a Apps Script.**

## 2. Pestañas que se crean en la hoja

| Pestaña | Para qué sirve |
|---|---|
| `CONFIG` | Parámetros editables: precio, fecha, lugar, formato de numeración, métodos de pago, si se exige pago confirmado, etc. |
| `LOTES` | L1 Logística, L2 Marketing y L3 pendiente. Lleva cantidad y rango de tickets. |
| `USUARIOS` | Correos autorizados, rol, área, estado y hash del PIN (nunca el PIN). |
| `TICKETS` | Una fila por ticket (`000-001`…). Estado: DISPONIBLE, VENDIDO o ANULADO. |
| `VENTAS` | Una fila por ticket vendido. Si una compra incluye varios tickets, comparten `operacion_id`. Las ventas anuladas no se borran. |
| `ENTREGAS` | Una fila por entrega. Las entregas revertidas no se borran: pasan a REVERTIDO con un motivo. |
| `AUDITORIA` | Registra cada acción, incluidos los intentos de entrega duplicada. |
| `ARCHIVO_DEMO_*` | Solo aparecen cuando se archivan los datos DEMO. |

Columnas añadidas respecto al prompt original:
- `es_demo` en TICKETS, VENTAS y ENTREGAS.
- `fecha_pago` y `pago_confirmado_por` en VENTAS.
- `rango_inicio` y `rango_fin` en LOTES.
- `pin_hash` y `ultimo_acceso` en USUARIOS.

## 3. Instalación (unos 15 minutos)

1. **Crear la hoja.** Usa la cuenta Google que administrará el sistema; se recomienda una cuenta institucional o del CCAT, no una personal. En Google Sheets, crea una hoja nueva llamada `CCAT - Control Pollada 2026`.
   *Si prefieres usar una hoja que ya existe:* el script no borra nada. Solo agrega las pestañas y columnas que falten. Aun así, haz una copia antes (Archivo → Hacer una copia).
2. **Abrir Apps Script.** En la hoja: **Extensiones → Apps Script**. El proyecto queda vinculado a esa hoja, así que el ID de la hoja nunca aparece en el código ni en el navegador.
3. **Pegar los archivos.**
   - En `Código.gs`, borra el contenido y pega `src/Code.gs`. Puedes renombrarlo a `Code`.
   - Con **+ → HTML**, crea tres archivos llamados exactamente `Index`, `Styles` y `JavaScript`, y pega el contenido de cada `.html`.
   - En ⚙️ **Configuración del proyecto**, marca **"Mostrar el archivo de manifiesto appsscript.json"**. Vuelve al editor y reemplaza su contenido por `src/appsscript.json`.
   - Guarda (Ctrl+S).
4. **Inicializar y autorizar.** En el editor, selecciona la función `inicializarSistema` y pulsa **Ejecutar**. Google pedirá permisos:
   - Ver y administrar **solo esta hoja**.
   - Mostrar menús en la hoja.
   - Ver tu correo.

   Si aparece "Google no verificó esta app", entra a **Configuración avanzada → Ir a (proyecto)**. Esto es normal en scripts propios. Al terminar, la hoja tendrá las 7 pestañas y tu correo quedará como ADMIN (U001).
5. **Recargar la hoja.** Aparece el menú **🐔 Pollada CCAT**.

## 4. Configurar antes de vender

1. **Revisar `CONFIG`** (desde la app, en Configuración, o en la hoja). Los valores por defecto son:
   - Precio: S/ 18.
   - Fecha: 2026-11-20.
   - Formato de numeración: `000-000`.
   - `requiere_pago_confirmado = SI`.
   - Métodos de pago: EFECTIVO, YAPE, PLIN, TRANSFERENCIA, OTRO.
2. **Revisar `LOTES`.** Pon nombre del responsable a L1 y L2. Cuando se defina el Lote 3, cámbialo a ACTIVO. **Solo se venden tickets de lotes ACTIVOS.**
3. **Crear los tickets** en la pestaña Tickets → *Generar tickets por rango*. Ejemplo: L1 del 1 al 100 y L2 del 101 al 200. Los números repetidos se omiten y se informan. También puedes pegar una lista.
4. **Crear usuarios** en Configuración → Usuarios, con nombre, correo, rol y un PIN de 6 a 10 dígitos que se entrega en privado.

| Rol | Puede |
|---|---|
| ADMIN | Todo: configurar, generar tickets, corregir y anular ventas, confirmar cualquier pago y revertir entregas |
| VENTAS | Registrar ventas, confirmar el pago de las ventas que registró y ver sus ventas, el dashboard y los reportes |
| ENTREGAS | Solo la pantalla de recojo: buscar un ticket y confirmar la entrega |
| LECTURA | Dashboard, tickets y reportes |

## 5. Probar con datos DEMO (obligatorio antes de usarlo en serio)

1. Ve a Configuración → **Cargar 30 tickets DEMO**. Se crean los tickets `DEMO-001`… en el lote `LDEMO`.
2. Pulsa **Ejecutar pruebas DEMO**. Corre automáticamente estos casos sobre la hoja real, usando solo tickets DEMO:

| Caso | Resultado esperado |
|---|---|
| Registrar ticket disponible | Venta registrada |
| Vender de nuevo el mismo ticket | Bloqueado |
| Buscar ticket inexistente | "Ticket no encontrado" |
| Entregar ticket no vendido | Bloqueado |
| Entregar ticket con pago pendiente | Bloqueado (si `requiere_pago_confirmado = SI`) |
| Entregar ticket pagado | ENTREGADO |
| Entregarlo otra vez | Bloqueado, con "ALERTA: este ticket ya fue entregado el [fecha y hora]" |
| Entregar o vender ticket anulado | Bloqueado |
| Dos confirmaciones del mismo ticket | Solo una se registra (LockService) |
| Revertir entrega sin motivo / con motivo | Rechazado / revertido y auditado |
| Dashboard | Los indicadores coinciden con lo que hay en Sheets |

3. **Prueba manual de concurrencia.** Dos personas, en dos celulares, abren Entregas y buscan el mismo ticket DEMO pagado. Pulsan **Confirmar entrega** casi a la vez. Una debe ver "ENTREGADO" y la otra la ALERTA.
4. **Archivar DEMO.** Con Configuración → **Archivar DEMO** (o el menú de la hoja), solo se mueven a pestañas `ARCHIVO_DEMO_*` las filas marcadas `es_demo = TRUE` **y** con número `DEMO-###`. Las ventas reales no se tocan y la auditoría se conserva. Hazlo antes de empezar las ventas reales.

## 6. Desplegar la aplicación web

1. En Apps Script, ve a **Implementar → Nueva implementación → ⚙️ Aplicación web**.
2. Configura:
   - **Ejecutar como: Yo** (la cuenta dueña de la hoja).
   - **Quién tiene acceso: Cualquier usuario con una cuenta de Google.**
3. Pulsa Implementar y copia la URL que termina en `/exec`. **Ese es el enlace real.**
4. Comparte los enlaces:
   - Equipo completo: `URL/exec`
   - Personal de recojo: `URL/exec?v=entregas`, que abre directamente la pantalla de entregas. Los usuarios con rol ENTREGAS solo ven esa pantalla.
5. **No compartas la hoja con permiso de edición** con vendedores ni con el personal de entregas. Todo se hace desde la app. Quien edita la hoja directamente se salta las validaciones. Si alguien de LECTURA quiere ver la hoja, compártela solo como lector.

### Quién accede y con qué permisos

- La app **se ejecuta con la cuenta del dueño**. Los usuarios no necesitan acceso a la hoja; la app lee y escribe en su nombre, siempre pasando por las reglas del backend.
- **Limitación de `Session.getActiveUser().getEmail()`:** con "Ejecutar como: Yo", Google solo entrega el correo del visitante si es el propio dueño o si ambos pertenecen al mismo dominio de Google Workspace. Con cuentas @gmail.com, el correo llega vacío. Por eso el sistema usa dos métodos:
  - **Cuenta Google reconocida:** el dueño (y, en Workspace, los usuarios del mismo dominio) entra directo.
  - **Correo + PIN:** para todos los demás. El PIN se guarda solo como hash SHA-256 con sal. La sesión dura 6 horas. Tras 5 intentos fallidos, el usuario queda bloqueado 10 minutos.
- **Alternativa:** "Ejecutar como: usuario que accede" identifica a todos por su cuenta Google, pero obliga a darles permiso de **edición** de la hoja, y con eso podrían saltarse la app. **No se recomienda.**
- **"Cualquier persona" (anónimo):** también funcionaría con PIN, pero la página quedaría abierta a cualquiera con el enlace. Úsalo solo si alguien del equipo no tiene cuenta Google.

## 7. Actualizar versiones

1. Edita el código en Apps Script y guarda.
2. Ve a **Implementar → Gestionar implementaciones → ✏️ (lápiz) → Versión: Nueva versión → Implementar**. **La URL no cambia.**
3. Si actualizas `Code.gs` con columnas nuevas, ejecuta **🐔 Pollada CCAT → Inicializar / reparar hojas**. Solo agrega lo que falte.
4. Actualiza `version_sistema` en `Code.gs` (`APP.VERSION`).
5. Antes de cambios grandes: Archivo → Descargar → .xlsx (respaldo).

## 8. Operación el día del evento (viernes 20/11)

- **El día anterior:**
  - Revisa el dashboard: que no haya alertas de integridad y que no queden pagos pendientes.
  - Cobra o regulariza los pagos pendientes.
  - Imprime **Reportes → Imprimir** como lista de respaldo (tiene una columna ☐ para marcar a mano si falla internet).
  - Descarga el CSV.
- **En el punto de recojo:**
  - Ten 1 o 2 celulares con `?v=entregas` y datos móviles.
  - Ten a un ADMIN cerca para los pagos pendientes: puede confirmarlos desde la misma pantalla de entregas.
- **Si se cae internet:** usa la lista impresa y anota número, hora y quién entregó. Al volver la conexión, registra esas entregas en la app con la observación "registrada en contingencia".
- **Cierre de caja:** Reportes → *Rendición por vendedor* muestra lo cobrado (efectivo y digital) y lo pendiente por vendedor.

## 9. Seguridad implementada

| Medida | Cómo |
|---|---|
| Unicidad | `numero_ticket` y `ticket_id` únicos. IDs correlativos `OP-`, `V-` y `E-` que no se reutilizan, ni siquiera después de archivar DEMO. |
| Venta y entrega únicas | Se validan en el backend dentro de `LockService`, con relectura de la hoja. Una operación con un solo ticket inválido no guarda nada. |
| Validación backend | El navegador solo muestra información. Todas las reglas se verifican en `Code.gs`. |
| Funciones privadas | Todo termina en `_` salvo `api()`, `doGet()` y las funciones del menú, que solo puede ejecutar quien edita la hoja y además verifican que sea ADMIN. |
| Inyección | Los textos que empiezan con `= + - @` se guardan como texto, sin fórmulas. Toda la información se escapa en la interfaz (sin XSS). |
| Privacidad | El teléfono del comprador solo lo ven el ADMIN y quien registró la venta. ENTREGAS no lo ve. |
| Historial | Nada se borra: ventas → ANULADO, entregas → REVERTIDO, ambos con motivo obligatorio y registro en auditoría. |
| Hojas protegidas | VENTAS, ENTREGAS, AUDITORIA, USUARIOS y CONFIG muestran una advertencia si se intentan editar a mano. |

## 10. Checklist de aceptación

- [ ] La hoja `CCAT - Control Pollada 2026` está creada con la cuenta correcta y tiene las 7 pestañas.
- [ ] `CONFIG` revisado (precio, fecha, `requiere_pago_confirmado`).
- [ ] Lotes con responsable; tickets generados sin duplicados.
- [ ] Usuarios creados con su rol y PIN entregado en privado.
- [ ] Pruebas DEMO: todas ✅. Prueba manual con 2 celulares OK.
- [ ] DEMO archivado. El dashboard (Reales) muestra 0 ventas antes de empezar.
- [ ] App desplegada ("Ejecutar como: Yo", "Cualquier usuario con cuenta de Google") y enlaces repartidos.
- [ ] La hoja **no** está compartida con edición a vendedores ni al personal de entregas.
- [ ] Lista de respaldo impresa el día anterior.

## 11. Verificar el código en una computadora (opcional)

```bash
cd test && npm install jsdom@24
node run.js   # 74 pruebas de reglas de negocio con una simulación de Sheets
node ui.js    # 20 pruebas de la interfaz
```
