-- SecuroServ | Esquema inicial para Azure SQL Database.
-- Ejecutar en la base de datos de la aplicación, NO en master.
-- No elimina registros ni crea cuentas de ejemplo.
SET XACT_ABORT ON;
SET NOCOUNT ON;

IF DB_NAME() = N'master'
    THROW 50001, 'Selecciona la base de datos de SecuroServ antes de ejecutar.', 1;

BEGIN TRANSACTION;

IF OBJECT_ID(N'dbo.usuarios', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.usuarios (
        id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_usuarios PRIMARY KEY,
        nombre NVARCHAR(80) NOT NULL,
        usuario NVARCHAR(40) COLLATE Latin1_General_100_CI_AS NOT NULL,
        pin_hash NVARCHAR(512) NOT NULL,
        rol NVARCHAR(20) NOT NULL,
        activo BIT NOT NULL CONSTRAINT DF_usuarios_activo DEFAULT (1),
        intentos_fallidos TINYINT NOT NULL CONSTRAINT DF_usuarios_intentos DEFAULT (0),
        bloqueado_hasta DATETIME2(3) NULL,
        creado_en DATETIME2(3) NOT NULL CONSTRAINT DF_usuarios_creado DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT UQ_usuarios_usuario UNIQUE (usuario),
        CONSTRAINT CK_usuarios_rol CHECK (rol IN (N'Administrador', N'Secretario', N'Ejecutivo', N'Oficinista')),
        CONSTRAINT CK_usuarios_intentos CHECK (intentos_fallidos BETWEEN 0 AND 3),
        CONSTRAINT CK_usuarios_nombre CHECK (LEN(LTRIM(RTRIM(nombre))) > 0),
        CONSTRAINT CK_usuarios_usuario CHECK (LEN(LTRIM(RTRIM(usuario))) BETWEEN 3 AND 40),
        CONSTRAINT CK_usuarios_hash CHECK (LEN(pin_hash) > 0)
    );
END;

IF OBJECT_ID(N'dbo.auditoria', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.auditoria (
        id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_auditoria PRIMARY KEY,
        usuario_id INT NULL,
        usuario NVARCHAR(40) NOT NULL,
        fecha DATETIME2(3) NOT NULL CONSTRAINT DF_auditoria_fecha DEFAULT (SYSUTCDATETIME()),
        resultado VARCHAR(8) NOT NULL,
        detalle NVARCHAR(200) NOT NULL,
        CONSTRAINT FK_auditoria_usuario FOREIGN KEY (usuario_id) REFERENCES dbo.usuarios(id),
        CONSTRAINT CK_auditoria_resultado CHECK (resultado IN ('CORRECTO', 'ERROR'))
    );
    CREATE INDEX IX_auditoria_fecha ON dbo.auditoria(fecha DESC, id DESC);
    CREATE INDEX IX_auditoria_usuario_fecha ON dbo.auditoria(usuario_id, fecha DESC);
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id=OBJECT_ID(N'dbo.usuarios') AND name=N'UX_usuarios_admin_unico'
)
    CREATE UNIQUE INDEX UX_usuarios_admin_unico ON dbo.usuarios(rol) WHERE rol=N'Administrador';

COMMIT TRANSACTION;

SELECT DB_NAME() AS base_de_datos;
SELECT name AS tabla FROM sys.tables WHERE schema_id = SCHEMA_ID(N'dbo') AND name IN (N'usuarios', N'auditoria') ORDER BY name;
SELECT COUNT_BIG(*) AS total_usuarios FROM dbo.usuarios;
SELECT COUNT_BIG(*) AS total_auditorias FROM dbo.auditoria;
