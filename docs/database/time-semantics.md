# Semantica temporal

## Tipos conceptuales

| Concepto | Formato | Significado |
|---|---|---|
| Fecha local | `YYYY-MM-DD` | Dia civil en zona actual del dispositivo |
| Hora programada | `HH:mm` | Hora civil local, sin offset |
| Duracion | Segundos enteros | Independiente de zona |
| Auditoria | Timestamp con zona | Instante absoluto de servidor |
| Deadline timer | Timestamp absoluto en memoria | Base de calculo temporal |

## Definicion de Hoy

La fecha se construye con ano, mes y dia locales del runtime JavaScript del dispositivo. No se obtiene de `toISOString()`, `current_date` de Postgres ni zona del servidor. Se envia explicitamente a consultas y mutaciones.

La aplicacion recalcula al montar, recibir active/resume, recuperar visibilidad y cruzar medianoche. Un cambio de zona puede cambiar Hoy; no se migran completions historicas.

## Recurrencia

- Una rutina diaria es elegible para cualquier fecha local.
- Una rutina especifica es elegible si su valor fecha coincide exactamente.
- Una fecha especifica es dia civil, no timestamp, y no se convierte a UTC.
- La hora solo ordena y presenta; no inicia acciones.

## Completions

- La fecha se captura en el momento de marcar o desmarcar.
- No existe un job nocturno de reset.
- Un nuevo dia consulta una nueva clave y por ausencia aparece incompleto.
- Un timer iniciado antes de medianoche continua, pero su final no escribe completion.

## Timer

Las duraciones no cambian al viajar ni cambiar zona. Al recuperar foco, el motor recalcula desde deadlines. Si vencieron varias fases, avanza hasta la correspondiente sin reproducir todas las alertas omitidas.

El snapshot persistido del timer se reconcilia con timestamps absolutos tras reanudar o reiniciar. La recuperacion ante cambios manuales bruscos del reloj no se corrige adicionalmente en el MVP y se documenta como limitacion.
