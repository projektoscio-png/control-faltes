# Control de Faltas

Versión actual: **1.2**. La versión aparece abajo en la app, y la app avisa si algún archivo es de otra versión. El historial de cambios está en `CHANGELOG.md`.

Registro de faltas injustificadas y retardos por alumno. Calcula las faltas leves y graves a poner en cada extracción.

**Reglas por defecto** (se pueden cambiar en la app):
- 6 faltas injustificadas = 1 falta leve
- 6 retardos = 1 falta leve
- 6 faltas leves = 1 falta grave

Los totales son acumulados desde principio de curso. Al cerrar una extracción, la app guarda cuántas leves y graves ya se pusieron y la fecha, así que la siguiente solo propone las nuevas.

## Dónde se guardan los datos

En tu Google Drive, en la carpeta **Control de Faltas**:

- `faltas-datos.json`: los datos de la app.
- `copia-cierre-AAAA-MM-DD.json`: una copia que se crea cada vez que cierras una extracción.

La app usa el permiso `drive.file`: solo puede ver los archivos que ella misma crea, no el resto de tu Drive. Este repositorio no contiene datos de alumnos.

## Puesta en marcha

### 1. Publicar en GitHub Pages

1. Crea un repositorio nuevo en GitHub y sube todos los archivos de esta carpeta (en la web: **Add file → Upload files**).
2. En el repositorio: **Settings → Pages → Build and deployment**. En *Source* elige **Deploy from a branch**, rama `main`, carpeta `/ (root)`.
3. Al cabo de un minuto la app estará en `https://TU_USUARIO.github.io/NOMBRE_DEL_REPOSITORIO/`.

### 2. Crear el acceso a Google (una sola vez)

1. Entra en <https://console.cloud.google.com/> y crea un proyecto nuevo.
2. **APIs y servicios → Biblioteca**: busca **Google Drive API** y pulsa **Habilitar**.
3. **Pantalla de consentimiento de OAuth** (Google Auth Platform): tipo **Externo**, pon un nombre a la app y tu correo, y guarda.
4. En **Público / Usuarios de prueba**, añade tu correo. Si prefieres no depender de la lista, pulsa **Publicar aplicación**: el permiso `drive.file` no suele requerir verificación.
5. **Clientes → Crear cliente → Aplicación web**. En **Orígenes de JavaScript autorizados** añade `https://TU_USUARIO.github.io` (sin barra final y sin la ruta del repositorio).
6. Copia el **ID de cliente** (termina en `.apps.googleusercontent.com`).

### 3. Pegar el ID de cliente

Edita `config.js` en GitHub (icono del lápiz) y sustituye `PEGA_AQUI_TU_ID_DE_CLIENTE.apps.googleusercontent.com` por tu ID. Guarda (*Commit changes*) y recarga la app.

Mientras la app esté en modo prueba, Google mostrará un aviso de «aplicación no verificada» al conectar: pulsa **Configuración avanzada → Ir a …** para continuar.

## Uso mensual

1. Abre la app y pulsa **Conectar con Google Drive**.
2. En la página de la extracción, pulsa el marcador **Extraer faltas** (se instala desde la sección «Marcador para extraer los datos» de la app).
3. En la app, **Importar extracción**, pega el texto y **Aplicar importación**.
4. Revisa la columna **A poner ahora**, pon las faltas en el programa del centro y pulsa **Cerrar extracción**.

La sesión de Google dura una hora; si caduca, la app avisa y basta con pulsar **Reconectar**. Si abres la app en dos dispositivos a la vez y guardas en ambos, la app avisa de un conflicto y te deja cargar la versión de Drive.

## Fechas de cada falta

El marcador extrae también la fecha de cada falta y de cada retardo, y la app las guarda por alumno. Haciendo clic en el nombre de un alumno se abre su detalle:

- **Cuenta en curso**: cuántas faltas y retardos lleva hacia la siguiente leve, con sus fechas.
- **Leves**: cada una con la fecha en que se completó (la de la sexta falta o retardo), desde qué fecha cuenta y si está aplicada o pendiente.
- **Graves**: con la fecha en que se completó la sexta leve.
- **Registros puestos**: la fecha de extracción en que registraste cada tanda de leves y graves.

Si el total de un alumno baja respecto a la extracción anterior (por ejemplo, porque se justificó una falta), aparece el aviso **Revisar**. Se quita al cerrar la extracción.

Los alumnos añadidos a mano o importados sin fechas siguen funcionando, pero sin el detalle por fechas.

## Marcador de extracción

Lee la tabla de la página de faltas del centro: nombre, grupo, número de líneas con letra `F` (faltas) y `R` (retardos) con su fecha, solo las de casilla marcada. También toma la fecha final del rango. Todo ocurre en tu navegador y el resultado va al portapapeles.

Formato de cada línea: `Apellidos, nombre ; Grupo ; Faltas ; Retardos ; Fechas de las faltas ; Fechas de los retardos`. Las dos últimas columnas son opcionales y las fechas van en formato `AAAA-MM-DD` separadas por espacios.

Si cambias el marcador en una actualización, vuelve a instalarlo desde la app: el que tienes guardado en el navegador no se actualiza solo.

## Archivos

| Archivo | Contenido |
|---|---|
| `index.html`, `styles.css` | Interfaz |
| `app.js` | Cálculo, tabla, importación y guardado |
| `drive.js` | Conexión con Google Drive |
| `config.js` | ID de cliente y nombres de carpeta y archivo |
