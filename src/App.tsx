import { useState, useEffect } from "react";
import { motion, MotionConfig, useReducedMotion } from "motion/react";
import {
  ArrowRight,
  ShieldCheck,
  Delete,
  LockKeyhole,
  LogOut,
  Users,
  ScrollText,
  ChevronLeft,
  Search,
  Check,
  Info,
  UserRound,
  Plus,
} from "lucide-react";
import { Button } from "./components/ui/button";
import "./App.css";
import { api, ApiError } from "./api";
type Role = "Administrador" | "Secretario" | "Ejecutivo" | "Oficinista";
type User = {
  username: string;
  name: string;
  role: Role;
  id: number;
};
type Audit = {
  id: string;
  username: string;
  at: string;
  result: "CORRECTO" | "ERROR";
  detail: string;
};
const roles: Role[] = ["Secretario", "Ejecutivo", "Oficinista"];

export default function App() {
  const reduceMotion = useReducedMotion();
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [lock, setLock] = useState<{ username: string; until: number } | null>(
    null,
  );
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [session, setSession] = useState<User | null>(null);
  const [view, setView] = useState<"home" | "audit" | "register">("home");
  const signedIn = !!session;
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [view, signedIn]);
  const [audits, setAudits] = useState<Audit[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("TODOS");
  const [notice, setNotice] = useState("");
  const [noticeKind, setNoticeKind] = useState<"success" | "error">("success");
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const remaining =
    lock?.username === username.trim().toLowerCase()
      ? Math.max(0, Math.ceil((lock.until - now) / 1000))
      : 0;
  useEffect(() => {
    let active = true;
    api<{ user: User }>("/auth/me")
      .then((data) => {
        if (active) setSession(data.user);
      })
      .catch((e) => {
        if (active && (!(e instanceof ApiError) || e.status !== 401))
          setError(e.message);
      })
      .finally(() => {
        if (active) setChecking(false);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (view !== "audit" || session?.role !== "Administrador") return;
    const controller = new AbortController();
    setAuditLoading(true);
    setAuditError("");
    const timer = setTimeout(() => {
      api<{ items: Audit[]; total: number }>(
        `/audits?${new URLSearchParams({ page: String(page), search: query, result: filter })}`,
        { signal: controller.signal },
      )
        .then((data) => {
          if (!controller.signal.aborted) {
            setAudits(data.items);
            setTotal(data.total);
          }
        })
        .catch((e) => {
          if (!controller.signal.aborted) {
            setAuditError(e.message);
            if (e instanceof ApiError && e.status === 401) {
              setSession(null);
              setView("home");
              setError("Tu sesión terminó. Vuelve a ingresar.");
            }
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) setAuditLoading(false);
        });
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [view, session, query, filter, page]);
  function digit(d: string) {
    if (busy || checking || remaining || pin.length >= 8) return;
    if (!pin.length && d === "0") {
      setError("El PIN no puede empezar con 0.");
      return;
    }
    setPin(pin + d);
    setError("");
  }
  async function login() {
    if (busy || checking) return;
    if (!username.trim()) {
      setError("Escribe tu nombre de usuario.");
      return;
    }
    if (!remaining && !/^[1-9][0-9]{7}$/.test(pin)) {
      setError("Ingresa un PIN de 8 dígitos sin cero inicial.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const data = await api<{ user: User }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ username: username.trim().toLowerCase(), pin }),
      });
      setSession(data.user);
      setView("home");
      setLock(null);
      setPage(1);
      setAudits([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo iniciar sesión.");
      if (e instanceof ApiError && e.lockedUntil)
        setLock({
          username: username.trim().toLowerCase(),
          until: Date.parse(e.lockedUntil),
        });
    } finally {
      setPin("");
      setBusy(false);
    }
  }
  async function logout() {
    if (busy) return;
    setBusy(true);
    try {
      await api("/auth/logout", { method: "POST" });
      setSession(null);
      setUsername("");
      setPin("");
      setError("");
      setNotice("");
      setView("home");
      setAudits([]);
      setTotal(0);
      setQuery("");
      setFilter("TODOS");
      setPage(1);
    } catch (e) {
      setNoticeKind("error");
      setNotice(e instanceof Error ? e.message : "No se pudo cerrar sesión.");
    } finally {
      setBusy(false);
    }
  }
  async function register(form: HTMLFormElement) {
    if (busy) return;
    const data = new FormData(form);
    setBusy(true);
    setNotice("");
    try {
      const result = await api<{ message: string }>("/users", {
        method: "POST",
        body: JSON.stringify({
          name: String(data.get("name")).trim(),
          username: String(data.get("username")).trim().toLowerCase(),
          pin: String(data.get("pin")),
          role: data.get("role"),
        }),
      });
      form.reset();
      setNoticeKind("success");
      setNotice(result.message);
    } catch (e) {
      setNoticeKind("error");
      setNotice(
        e instanceof Error ? e.message : "No se pudo registrar el usuario.",
      );
      if (e instanceof ApiError && e.status === 401) {
        setSession(null);
        setView("home");
        setError("Tu sesión terminó. Vuelve a ingresar.");
      }
    } finally {
      setBusy(false);
    }
  }
  const filtered = audits;
  return (
    <MotionConfig reducedMotion="user">
      <div className="app">
        <header className="topbar">
          <a className="brand" href="#" onClick={(e) => e.preventDefault()}>
            <img
              className="brand-logo"
              src="/assets/securoserv-logo.png"
              alt=""
              width="32"
              height="32"
            />
            SECURO<span className="brand-light">SERV</span>
            <span className="brand-divider" />
            <span className="brand-caption">Seguridad corporativa</span>
          </a>
        </header>
        {!session ? (
          <motion.main
            key="login"
            initial={{ opacity: 0, y: reduceMotion ? 0 : 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", bounce: 0, duration: 0.35 }}
            className="login-layout"
          >
            <section className="intro">
              <div className="eyebrow">DIVISIÓN DE SEGURIDAD PRIVADA</div>
              <h1>
                Tu organización.
                <br />
                <span>Bajo control.</span>
              </h1>
              <p className="intro-copy">
                La confianza se gana. El acceso se verifica.
                <br />
                Identifícate para entrar a tu organización.
              </p>
              <div className="security-art" aria-hidden="true">
                <div className="orbit orbit-one" />
                <div className="orbit orbit-two" />
                <img
                  className="intro-logo"
                  src="/assets/securoserv-logo.png"
                  alt=""
                  width="150"
                  height="150"
                />
              </div>
            </section>
            <section className="login-panel">
              <div className="login-card">
                <div className="card-heading">
                  <h2>Acceso de personal</h2>
                  <p></p>
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    login();
                  }}
                >
                  <label htmlFor="username">Usuario</label>
                  <div className="input-icon">
                    <UserRound size={18} />
                    <input
                      id="username"
                      autoComplete="username"
                      maxLength={40}
                      disabled={busy || checking}
                      placeholder="Tu nombre de usuario"
                      value={username}
                      onChange={(e) => {
                        setUsername(e.target.value);
                        setError("");
                      }}
                    />
                  </div>
                  <div className="pin-label">
                    <label>PIN de seguridad</label>
                    <span>{pin.length} de 8 dígitos</span>
                  </div>
                  <div
                    className="pin-display"
                    role="group"
                    aria-label={`${pin.length} de 8 dígitos ingresados`}
                  >
                    {Array.from({ length: 8 }, (_, i) => (
                      <span
                        key={i}
                        className={
                          i < pin.length
                            ? "filled"
                            : i === pin.length
                              ? "current"
                              : ""
                        }
                      >
                        {i < pin.length ? "●" : ""}
                      </span>
                    ))}
                  </div>
                  <div className="keypad">
                    {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => digit(n)}
                        disabled={!!remaining || busy || checking}
                      >
                        {n}
                      </button>
                    ))}
                    <span className="keypad-empty">
                      <ShieldCheck size={20} />
                    </span>
                    <button
                      type="button"
                      onClick={() => digit("0")}
                      disabled={!!remaining || busy || checking}
                    >
                      0
                    </button>
                    <button
                      type="button"
                      className="delete-key"
                      aria-label="Borrar último dígito"
                      disabled={busy || checking}
                      onClick={() => {
                        setPin(pin.slice(0, -1));
                        setError("");
                      }}
                    >
                      <Delete size={22} />
                    </button>
                  </div>
                  {(error || remaining > 0) && (
                    <div className="error-message" role="alert">
                      {remaining
                        ? `Cuenta bloqueada. Reintenta en ${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}.`
                        : error}
                    </div>
                  )}
                  <Button
                    type="submit"
                    className="login-button w-full"
                    disabled={
                      busy ||
                      checking ||
                      !username.trim() ||
                      (!remaining && pin.length !== 8)
                    }
                  >
                    {checking
                      ? "Comprobando sesión…"
                      : busy
                        ? "Validando…"
                        : "Iniciar sesión"}{" "}
                    <ArrowRight size={18} />
                  </Button>
                </form>
              </div>
            </section>
          </motion.main>
        ) : (
          <motion.main
            key={view}
            initial={{ opacity: 0, y: reduceMotion ? 0 : 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", bounce: 0, duration: 0.35 }}
            className="workspace"
          >
            <div className="workspace-top">
              <div>
                <div className="eyebrow">CENTRO DE OPERACIONES</div>
                <h1>
                  {view === "audit"
                    ? "Auditoría de accesos"
                    : view === "register"
                      ? "Registrar usuario"
                      : `Hola, ${session.name.split(" ")[0]}.`}
                </h1>
                <p>
                  {view === "home"
                    ? "Bienvenido al centro de operaciones de SecuroServ."
                    : view === "audit"
                      ? "Consulta los intentos de acceso y su resultado."
                      : "Crea una cuenta y asigna su nivel de acceso."}
                </p>
              </div>
              <Button variant="outline" onClick={logout} disabled={busy}>
                <LogOut size={16} />
                Cerrar sesión
              </Button>
            </div>
            {notice && view !== "register" && (
              <p
                className={`form-notice notice-${noticeKind}`}
                role={noticeKind === "error" ? "alert" : "status"}
              >
                {notice}
              </p>
            )}
            <div className="identity-strip">
              <div className="avatar">
                {session.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")}
              </div>
              <div>
                <strong>{session.name}</strong>
                <span>@{session.username}</span>
              </div>
              <span className="role-badge">{session.role}</span>
              <span className="session-active">
                <span />
                Sesión iniciada
              </span>
            </div>
            {view === "home" ? (
              <>
                <div className="welcome-banner">
                  <span className="welcome-icon">
                    <ShieldCheck size={36} />
                  </span>
                  <div>
                    <h2>Todo listo, {session.role.toLowerCase()}.</h2>
                    <p>
                      {session.role === "Administrador"
                        ? "Gestiona los usuarios y supervisa la actividad de acceso."
                        : "Tu identidad se verificó correctamente. Ya puedes cerrar sesión cuando termines."}
                    </p>
                  </div>
                  <LockKeyhole
                    className="banner-lock"
                    size={72}
                    strokeWidth={1}
                  />
                </div>
                {session.role === "Administrador" && (
                  <div className="admin-actions">
                    <button onClick={() => setView("audit")}>
                      <span className="action-icon">
                        <ScrollText />
                      </span>
                      <h3>Auditoría de accesos</h3>
                      <p>
                        Revisa los ingresos, errores y bloqueos del sistema.
                      </p>
                      <span className="action-link">
                        Ver auditorías <ArrowRight size={17} />
                      </span>
                    </button>
                    <button
                      onClick={() => {
                        setView("register");
                        setNotice("");
                      }}
                    >
                      <span className="action-icon">
                        <Users />
                      </span>
                      <h3>Registro de usuarios</h3>
                      <p>Crea cuentas para los miembros de tu equipo.</p>
                      <span className="action-link">
                        Registrar usuario <Plus size={17} />
                      </span>
                    </button>
                  </div>
                )}
              </>
            ) : (
              <>
                <button
                  className="back-link"
                  onClick={() => {
                    setView("home");
                    setNotice("");
                  }}
                >
                  <ChevronLeft size={16} />
                  Volver al inicio
                </button>
                {view === "audit" ? (
                  <section className="data-panel">
                    <div className="table-toolbar">
                      <div className="input-icon">
                        <Search size={17} />
                        <input
                          aria-label="Buscar auditorías"
                          placeholder="Buscar usuario o detalle…"
                          value={query}
                          onChange={(e) => {
                            setQuery(e.target.value);
                            setPage(1);
                          }}
                        />
                      </div>
                      <select
                        aria-label="Filtrar resultado"
                        value={filter}
                        onChange={(e) => {
                          setFilter(e.target.value);
                          setPage(1);
                        }}
                      >
                        <option value="TODOS">Todos los resultados</option>
                        <option>CORRECTO</option>
                        <option>ERROR</option>
                      </select>
                      <span>
                        {total} {total === 1 ? "registro" : "registros"}
                      </span>
                    </div>
                    {auditError && (
                      <p className="error-message" role="alert">
                        {auditError}
                      </p>
                    )}
                    {auditLoading && (
                      <p className="empty-state" role="status">
                        Consultando auditorías…
                      </p>
                    )}
                    <div className="table-scroll" aria-busy={auditLoading}>
                      <table>
                        <thead>
                          <tr>
                            <th>Usuario</th>
                            <th>Fecha y hora</th>
                            <th>Resultado</th>
                            <th>Detalle</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filtered.map((a) => (
                            <tr key={a.id}>
                              <td data-label="Usuario">
                                <strong>{a.username}</strong>
                              </td>
                              <td data-label="Fecha y hora">
                                {new Date(a.at).toLocaleString("es-PE", {
                                  timeZone: "America/Lima",
                                })}
                              </td>
                              <td data-label="Resultado">
                                <span
                                  className={`result ${a.result === "ERROR" ? "bad" : ""}`}
                                >
                                  {a.result === "CORRECTO" ? (
                                    <Check size={13} />
                                  ) : (
                                    <Info size={13} />
                                  )}{" "}
                                  {a.result}
                                </span>
                              </td>
                              <td data-label="Detalle">{a.detail}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {!auditLoading && !auditError && !filtered.length && (
                        <p className="empty-state">
                          No hay registros que coincidan con tu búsqueda.
                        </p>
                      )}
                    </div>
                    <div className="audit-pagination">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={page <= 1 || auditLoading}
                        onClick={() => setPage(page - 1)}
                      >
                        Anterior
                      </Button>
                      <span>
                        Página {page} de {Math.max(1, Math.ceil(total / 50))}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={page * 50 >= total || auditLoading}
                        onClick={() => setPage(page + 1)}
                      >
                        Siguiente
                      </Button>
                    </div>
                  </section>
                ) : (
                  <section className="register-panel">
                    <h2>Datos de la nueva cuenta</h2>
                    <p>El usuario podrá ingresar con el PIN que le asignes.</p>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        register(e.currentTarget);
                      }}
                    >
                      <fieldset disabled={busy} className="register-fields">
                        <label htmlFor="new-name">Nombre completo</label>
                        <input
                          id="new-name"
                          name="name"
                          required
                          maxLength={80}
                          placeholder="Ej. María Torres"
                        />
                        <label htmlFor="new-user">Nombre de usuario</label>
                        <input
                          id="new-user"
                          name="username"
                          required
                          pattern="[a-zA-Z0-9._-]{3,40}"
                          placeholder="Ej. mariat"
                        />
                        <label htmlFor="new-role">Rol</label>
                        <select id="new-role" name="role">
                          {roles.map((r) => (
                            <option key={r}>{r}</option>
                          ))}
                        </select>
                        <label htmlFor="new-pin">PIN inicial</label>
                        <input
                          id="new-pin"
                          name="pin"
                          type="password"
                          inputMode="numeric"
                          pattern="[1-9][0-9]{7}"
                          minLength={8}
                          maxLength={8}
                          required
                          placeholder="8 dígitos; no debe empezar con 0"
                        />
                        <Button type="submit" disabled={busy}>
                          <Plus size={17} />
                          {busy ? "Registrando…" : "Registrar usuario"}
                        </Button>
                      </fieldset>
                      {notice && (
                        <p
                          role={noticeKind === "error" ? "alert" : "status"}
                          className={`form-notice notice-${noticeKind}`}
                        >
                          {notice}
                        </p>
                      )}
                    </form>
                  </section>
                )}
              </>
            )}
          </motion.main>
        )}
        <footer>
          <span>© {new Date().getFullYear()} SecuroServ</span>
        </footer>
      </div>
    </MotionConfig>
  );
}
