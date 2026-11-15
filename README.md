# SecuroServ

Sistema de acceso mediante PIN de 8 dígitos, roles y auditoría. El frontend y el backend se ejecutan localmente; la base de datos se aloja en Azure SQL.

## Iniciar

1. Ejecutar `npm install`.
2. Copiar `.env.example` a `.env` y completar las credenciales de Azure SQL.
3. Crear las tablas con `database/001_schema.sql` desde SSMS y configurar el administrador inicial.
4. Comprobar la conexión con `npm run db:check`.
5. Ejecutar `npm run dev:server` y, en otra terminal, `npm run dev`.

Aplicación: http://127.0.0.1:5174/ · API: http://127.0.0.1:3001/

## Frontend

React, Vite, TypeScript y Tailwind CSS.

```text
src/
├── main.tsx                 Inicio de React
├── App.tsx                  Login y pantallas por rol
├── api.ts                   Solicitudes al backend
├── App.css                  Diseño y responsividad
├── index.css                Estilos generales
└── components/ui/
    └── button.tsx           Botón reutilizable

public/assets/               Logo y recursos visuales
vite.config.ts               Puerto y proxy de la API
```

## Backend

Node.js, Express, TypeScript y mssql.

```text
server/
├── index.ts                 Inicio del servidor
├── app.ts                   Rutas de la API
├── auth.ts                  Login, sesiones, roles y registro
├── pin.ts                   Hash y verificación del PIN
├── config.ts                Configuración del entorno
├── database.ts              Conexión con Azure SQL
└── check-database.ts        Prueba de conexión y tablas
```

## Funciones

- Acceso por PIN numérico, con borrado del último dígito.
- Roles: administrador, secretario, ejecutivo y oficinista.
- Registro de usuarios y consulta de auditorías exclusivos del administrador.
- Un único administrador y bloqueo de cinco minutos tras tres PIN incorrectos.
- PIN almacenado como hash y auditoría de accesos correctos y fallidos.

## Base de datos y pruebas

La carpeta `database/` contiene el SQL, el dump de estructura, el modelo DBML y el diagrama de las tablas. El dump no incluye registros ni credenciales.

Comprobaciones: `npm run build`, `npm run check:server` y `npm test`. La prueba `npm run test:integration` usa Azure SQL y elimina la cuenta temporal que crea.

Las sesiones se cierran al reiniciar el backend. No subir `.env` a Git; se conserva únicamente `.env.example` como plantilla.
