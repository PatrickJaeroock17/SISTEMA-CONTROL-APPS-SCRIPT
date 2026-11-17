# Prompt maestro (v2): Sistema de control de ventas y entregas --- Pollada CCATina 2026

> **Cambios de la v2 respecto a la v1**
> 1. Autenticación definida: cuenta Google para el dueño o el dominio, y **correo + PIN con hash** para cuentas @gmail (la v1 dejaba esta decisión abierta, y `getActiveUser()` devuelve vacío para gmail cuando la app se ejecuta como el dueño).
> 2. Script **vinculado** a la hoja: el ID nunca se expone y el propio script crea las pestañas (no hace falta un conector).
> 3. Métodos de pago locales: **Yape y Plin**.
> 4. Confirmación de pago posterior (PENDIENTE → PAGADO), con quien confirma y la fecha. Un ADMIN puede confirmarla desde la pantalla de entregas.
> 5. Separación DEMO explícita (`es_demo` + numeración `DEMO-###`), pruebas automáticas ejecutables desde la app y archivado seguro.
> 6. Normalización de números (`1`, `001` y `000-001` son el mismo ticket) y protección contra inyección de fórmulas y XSS.
> 7. Rendición de cuentas por vendedor (efectivo/digital) y alertas de integridad en el dashboard, tal como pidió la reunión de Logística y Finanzas.
> 8. Plan de contingencia sin internet (lista impresa) y enlace directo `?v=entregas` para el personal de recojo.
> 9. Privacidad: el teléfono del comprador solo lo ven el ADMIN y quien registró la venta.

**Uso:** copia este prompt en tu asistente de programación o en ChatGPT
Work. Debe construir una aplicación funcional conectada a Google Sheets
mediante Google Apps Script. No debe fingir que la conexión ya existe.

## 1. Rol y objetivo

Actúa como desarrollador full-stack senior especializado en Google Apps
Script, Google Sheets, automatización y aplicaciones web.

Necesito implementar un sistema para controlar la venta y entrega de las
polladas de la **Pollada CCATina 2026**. Debe tener dos procesos
independientes conectados a una misma base de datos:

1.  **Ventas:** controlar tickets asignados por lote/área, vendedor,
    comprador, precio, pago y estado.
2.  **Entregas/recojo:** verificar el ticket el día de la actividad y
    registrar su entrega para impedir que se recoja dos veces.

Tecnologías obligatorias: - Google Sheets: base de datos central. -
Google Apps Script: backend, reglas de negocio y conexión con Sheets. -
HTML, CSS y JavaScript: interfaz web responsive servida desde Apps
Script.

No quiero solo una maqueta o explicación. Necesito código completo,
conexión real y guía de despliegue.

## 2. Contexto inicial configurable

Utiliza estos datos como valores editables: - Actividad: **Pollada
CCATina 2026**. - Fecha: **viernes 20 de noviembre de 2026**. - Precio
referencial: **S/ 18 por pollada**. - Métodos de pago: efectivo, Yape, Plin, transferencia, otro. - Lugar de recojo: **instalaciones
del CCAT**. - Cada ticket representa una pollada. - Numeración de
ejemplo: `000-001`, `000-002`, `000-003`. - Lotes iniciales: - Lote 1:
Logística. - Lote 2: Marketing. - Lote 3: pendiente de asignación. - El
código de barras del diseño actual es decorativo. No implementes escaneo
de barras ni QR por ahora; la búsqueda será manual por número de ticket.
- La búsqueda debe aceptar `1`, `001`, `000001` o `000-001` como el mismo ticket.
- Cada lote recibe un rango único de números, que se generan desde la app sin redibujar tickets.

Si una persona compra varias polladas, registra cada ticket en una fila
individual, pero permite agruparlos bajo un mismo ID de operación de
venta.

No inventes vendedores, compradores, teléfonos ni ventas reales. Para
pruebas, usa datos ficticios identificados como DEMO y separados de los
registros reales.

## 3. Conexión y autorización: paso obligatorio

**Comienza verificando qué integraciones y herramientas tienes
disponibles.**

Antes de crear o modificar hojas o scripts:

1.  Solicita conectar y autorizar la cuenta Google que utilizará el
    equipo.
2.  Solicita acceso a Google Sheets y Google Apps Script, o explica cómo
    habilitarlos si no existe conexión directa.
3.  Pregunta si se usará una hoja existente o se creará una nueva.
4.  Si existe, pide seleccionarla o compartir su enlace/ID. Nunca
    inventes el ID.
5.  Si es nueva, solicita confirmación antes de crearla. Nombre
    sugerido: `CCAT - Control Pollada 2026`.
6.  Pide los permisos necesarios antes de leer, crear o modificar datos.
7.  Nunca solicites contraseñas, códigos de verificación, cookies ni
    tokens privados.
8.  No afirmes que la conexión o despliegue se completó sin confirmación
    real.

Arquitectura recomendada: proyecto Apps Script **vinculado** a la hoja (Extensiones → Apps Script), con una función `inicializarSistema()` que cree las pestañas sin borrar nada. Así no hace falta exponer el ID de la hoja ni un conector externo.

Si no puedes conectarte directamente, entrega todos los archivos de
código y guía al usuario para pegarlos en Apps Script, autorizar
permisos y desplegar la aplicación web. Distingue entre código generado,
conexión autorizada, hoja creada y aplicación desplegada. No simules una
conexión.

## 4. Arquitectura y módulos

Construye una aplicación web responsive en español, servida desde Google
Apps Script.

### Módulo A --- Ventas

Debe permitir: - Registrar una venta de uno o varios tickets. - Buscar
tickets por número. - Seleccionar lote, área y vendedor. - Registrar
nombre del comprador y teléfono opcional. - Registrar automáticamente
fecha y hora. - Registrar precio unitario, total, método de pago
(efectivo, transferencia u otro) y estado de pago (PAGADO, PENDIENTE,
ANULADO). - Añadir observaciones. - Mostrar confirmación antes de
guardar. - Consultar historial de ventas. - Permitir correcciones solo a
administradores, dejando auditoría.

**Regla crítica:** un ticket no puede venderse dos veces. Antes de
guardar, Apps Script debe verificar que exista, esté asignado y esté
disponible. No basta con validar en el navegador.

Si se venden varios tickets en una operación, guarda una fila por ticket
y comparte el mismo `operacion_id`.

### Módulo B --- Entregas / recojo

Debe ser una interfaz separada, pensada para el personal que entrega las
polladas.

Flujo: 1. El encargado escribe el número del ticket. 2. Apps Script
consulta Sheets. 3. La pantalla muestra número, comprador, estado de
pago y estado de entrega. 4. Si cumple las reglas, aparece **Confirmar
entrega**. 5. Al confirmar, registra fecha/hora, encargado identificado
(si la autenticación lo permite) y observaciones. 6. Cambia el estado a
ENTREGADO y muestra confirmación.

Reglas obligatorias: - Ticket inexistente: `Ticket no encontrado`. -
Ticket sin venta: bloquear. - Pago pendiente: bloquear si la
configuración exige pago confirmado; mostrar
`Pago pendiente. Solicita validación al administrador`. - Ticket ya
entregado: bloquear y mostrar
`ALERTA: este ticket ya fue entregado el [fecha y hora]`. - Ticket
anulado: bloquear. - Todas las reglas deben validarse nuevamente en el
backend antes de modificar Sheets. - Usa `LockService` durante la
verificación y actualización para reducir el riesgo de dos entregas
simultáneas del mismo ticket. - Las correcciones/reversiones solo las
puede hacer un administrador, con motivo obligatorio y registro en
auditoría. Nunca borres silenciosamente una entrega.

## 5. Estructura de Google Sheets

Crea estas pestañas. Si la hoja ya tiene datos, inspecciona primero y
solicita autorización antes de modificar. Nunca borres datos existentes.

### `CONFIG`

`nombre_actividad`, `fecha_actividad`, `precio_unitario`,
`lugar_recojo`, `formato_numeracion`, `requiere_pago_confirmado`,
`metodos_pago`, `version_sistema`, `restringir_ventas_por_area`, `permitir_login_pin`.

### `LOTES`

`lote_id`, `nombre_lote`, `area`, `responsable`, `cantidad_asignada`,
`estado`, `observaciones`.

### `USUARIOS`

`usuario_id`, `nombre`, `correo`, `rol`, `area`, `estado`.

Roles: - `ADMIN`: configura, consulta todo y corrige. - `VENTAS`:
registra y consulta ventas según permisos. - `ENTREGAS`: valida y
registra recojos. - `LECTURA`: consulta reportes.

No guardes contraseñas en texto plano. Prioriza cuentas Google y lista
de correos autorizados. Explica las limitaciones de
`Session.getActiveUser().getEmail()` según el modo de despliegue de Apps
Script. Si no puedes identificar de forma confiable al usuario, no
simules autenticación segura: informa la limitación y pide elegir una
configuración adecuada.

Implementación requerida (v2):
- Despliegue con "Ejecutar como: propietario" y "Acceso: cualquier usuario con cuenta de Google".
- Si `getActiveUser()` devuelve un correo registrado, entra directo.
- Si no, ingresa con correo + PIN de 6 a 10 dígitos, guardado como hash SHA-256 con sal en Script Properties.
- Token de sesión temporal en `CacheService` (6 h).
- Bloqueo tras 5 intentos fallidos.
- No dar permiso de edición de la hoja a vendedores ni al personal de entregas.

### `TICKETS`

Una fila por ticket: `ticket_id`, `numero_ticket`, `lote_id`, `area`,
`vendedor_asignado`, `estado_ticket` (DISPONIBLE, VENDIDO, ANULADO),
`fecha_asignacion`, `observaciones`, `es_demo`.

### `VENTAS`

Una fila por ticket vendido: `venta_id`, `operacion_id`, `ticket_id`,
`numero_ticket`, `lote_id`, `vendedor`, `comprador`,
`telefono_comprador`, `fecha_venta`, `precio_unitario`, `monto_total`,
`metodo_pago`, `estado_pago`, `registrado_por`, `observaciones`, `fecha_pago`, `pago_confirmado_por`, `es_demo`.

El estado PENDIENTE pasa a PAGADO solo con la acción "Confirmar pago". Puede hacerlo el ADMIN, o el vendedor que registró la venta, y queda auditado.

No dupliques ventas. Si se anula una venta, conserva la fila y cambia su
estado.

### `ENTREGAS`

`entrega_id`, `ticket_id`, `numero_ticket`, `comprador`,
`fecha_hora_entrega`, `entregado_por`, `estado_entrega` (ENTREGADO,
REVERTIDO), `motivo_correccion`, `observaciones`, `es_demo`.

Conserva historial suficiente para detectar intentos duplicados y
correcciones.

### `AUDITORIA`

`fecha_hora`, `usuario`, `accion`, `modulo`, `id_registro`,
`valor_anterior`, `valor_nuevo`, `motivo`.

No guardes contraseñas ni tokens.

## 6. Dashboard

Crea un panel que consulte datos reales de Sheets y muestre: - Total de
tickets. - Tickets asignados por lote. - Disponibles, vendidos y
anulados. - Pagados y con pago pendiente. - Entregados y pendientes de
recojo. - Recaudación confirmada y monto pendiente de cobro. - Ventas
por vendedor y área.

Incluye filtros por lote, área, vendedor y estado. No uses valores fijos
ni datos demo en producción.

Distingue claramente: - **Vendido:** existe una venta. - **Pagado:** el
pago fue confirmado. - **Entregado:** la pollada fue recogida.

No confundas ventas registradas con dinero efectivamente cobrado.

Incluye también:
- **Rendición de cuentas por vendedor:** cobrado en efectivo y en digital, y pendiente.
- **Alertas de integridad:** tickets con más de una venta o entrega activa, y estados inconsistentes.

## 7. Diseño de interfaz

Quiero una interfaz: - Profesional, moderna y sencilla. - En español y
adaptable a celulares y computadoras. - Inspirada en la identidad CCAT:
azul oscuro, azul eléctrico, amarillo y blanco. - Con botones grandes
para el módulo de entregas. - Con mensajes claros de éxito, advertencia
y error. - Con campos obligatorios identificados y confirmación para
operaciones sensibles.

Navegación: `Dashboard`, `Ventas`, `Entregas`, `Tickets`, `Reportes` y
`Configuración`.

Prioriza la rapidez del recojo: buscar ticket, verificar información y
confirmar entrega.

Además:
- Enlace directo `?v=entregas` para el personal de recojo.
- Lista imprimible y CSV como respaldo si falla internet el día del evento.

## 8. Seguridad e integridad

Implementa: 1. Numeración e identificadores únicos. 2. Validación de
tickets existentes y asignados. 3. Bloqueo de ventas duplicadas. 4.
Bloqueo de entregas duplicadas. 5. Validación backend en operaciones
sensibles. 6. `LockService` para operaciones concurrentes. 7. Auditoría
de acciones. 8. Manejo de errores y mensajes claros. 9. Protección de
hojas y rangos sensibles cuando sea viable. 10. Permisos por rol y lista
de usuarios autorizados. 11. No exponer innecesariamente el ID de Sheets
ni funciones administrativas en el frontend. 12. No borrar el historial:
usar estados de anulación o reversión.

Explica quién podrá acceder, con qué cuenta se ejecutará el script y qué
permisos tendrá la aplicación. No configures acceso público sin advertir
sus implicancias.

## 9. Entregables técnicos

Entrega: 1. Estructura de archivos de Apps Script. 2. Código completo de
backend `.gs`. 3. Interfaz completa `.html`, CSS y JavaScript. 4.
Función para inicializar pestañas y encabezados. 5. Función para
importar/generar tickets desde una lista y validar duplicados. 6.
Funciones de registro y consulta de ventas. 7. Funciones de búsqueda y
confirmación de entregas. 8. Dashboard y reportes. 9. Auditoría y
correcciones administrativas. 10. Configuración de Script Properties si
se necesita. 11. Guía para autorizar, probar y desplegar como aplicación
web. 12. Guía para actualizar versiones. 13. Casos de prueba y checklist
de aceptación.

No entregues fragmentos incompletos ni reemplaces lógica esencial con
comentarios como `// completar aquí`. Si es extenso, entrega cada
archivo completo por separado.

## 10. Pruebas obligatorias

Usa datos DEMO claramente identificados y separados de los reales.
Comprueba:

  -----------------------------------------------------------------------
  Caso                                Resultado esperado
  ----------------------------------- -----------------------------------
  Registrar ticket disponible         Venta registrada

  Vender de nuevo el mismo ticket     Bloqueado

  Buscar ticket inexistente           Ticket no encontrado

  Entregar ticket no vendido          Bloqueado

  Entregar ticket con pago pendiente  Bloqueado si requiere pago
                                      confirmado

  Entregar ticket pagado              Estado ENTREGADO

  Entregarlo otra vez                 Bloqueado; mostrar primera
                                      fecha/hora

  Entregar ticket anulado             Bloqueado

  Dos encargados intentan entregar a  Solo una operación confirmada
  la vez                              

  Administrador revierte entrega      Exige motivo y deja auditoría

  Consultar dashboard                 Indicadores coinciden con Sheets
  -----------------------------------------------------------------------

Incluye un procedimiento seguro para limpiar o archivar datos DEMO sin
afectar ventas reales.

## 11. Forma de trabajo por etapas

**Etapa 1 --- Conexión y diagnóstico** - Verifica integraciones
disponibles. - Solicita conectar Google Sheets y Google Apps Script. -
Confirma si se usará hoja existente o nueva. - Inspecciona sin borrar ni
sobrescribir.

**Etapa 2 --- Diseño de datos** - Presenta pestañas, columnas,
relaciones y reglas. - Señala decisiones pendientes. - Espera aprobación
antes de modificar la hoja real.

**Etapa 3 --- Implementación** - Construye backend e interfaz. - Conecta
con Sheets. - Implementa permisos, validaciones y auditoría.

**Etapa 4 --- Pruebas** - Ejecuta pruebas DEMO. - Corrige errores. -
Verifica prevención de duplicados en backend.

**Etapa 5 --- Despliegue** - Solicita autorización. - Despliega la
aplicación web. - Entrega el enlace real y guía de uso. - Explica cómo
actualizarla y quién la administrará.

### Criterio final de aceptación

El sistema solo estará listo para uso real cuando esté conectado a la
hoja correcta, ventas y entregas funcionen por separado, no sea posible
vender ni entregar dos veces un ticket, los indicadores coincidan con
Sheets, los permisos estén configurados y las pruebas no tengan errores
críticos.

**Comienza por la Etapa 1. No generes una falsa conexión ni modifiques
la hoja real sin autorización explícita.**
