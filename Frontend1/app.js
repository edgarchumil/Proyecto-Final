//Direccion de la API Global
const API = "http://127.0.0.1:8000/api";

//Almacenamiento de tokens de JWT
const storage = {
    get access() { return localStorage.getItem("access"); },
    set access(v) { localStorage.setItem("access", v); },
    get refresh() { return localStorage.getItem("refresh"); },
    set refresh(v) { localStorage.setItem("refresh", v); },
    clear() { localStorage.removeItem("access"); localStorage.removeItem("refresh"); }
};

//Refresh de JWT 
async function api(path, opts = {}, retry = true) {
    const headers = Object.assign({ "Content-Type": "application/json" }, opts.headers || {});
    if (storage.access) headers["Authorization"] = `Bearer ${storage.access}`;
    const res = await fetch(`${API}${path}`, { ...opts, headers });

    // Si expira el access token, intenta refrescar una sola vez
    if (res.status === 401 && storage.refresh && retry) {
        const ok = await refreshToken();
        if (ok) return api(path, opts, false);
    }
    if (!res.ok) {
        let msg = `${res.status} ${res.statusText}`;
        try { const err = await res.json(); msg += `\n${JSON.stringify(err)}`; } catch { }
        throw new Error(msg);
    }
    // si no hay contenido (204), evita .json()
    if (res.status === 204) return null;
    return res.json();
}

async function refreshToken() {
    try {
        const r = await fetch(`${API}/auth/token/refresh/`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refresh: storage.refresh })
        });
        if (!r.ok) return false;
        const data = await r.json();
        if (data.access) { storage.access = data.access; return true; }
        return false;
    } catch {
        return false;
    }
}

function setAuthedUI(isAuthed) {
    qs("#auth").style.display = isAuthed ? "none" : "block";
    qs("#register").style.display = isAuthed ? "none" : "block";
    qs("#app").style.display = isAuthed ? "block" : "none";
    qs("#btn-logout").style.display = isAuthed ? "inline-block" : "none";
    updateLayoutMode();
}

function updateLayoutMode() {
    const grid = qs("#auth-grid");
    if (!grid) return;
    const vis = [
        qs("#auth").style.display !== "none",
        qs("#register").style.display !== "none",
        qs("#app").style.display !== "none",
    ].filter(Boolean).length;

    // Si solo hay 1 tarjeta visible (login o registro), usa layout de una columna centrada
    const onlyAuthOrReg =
        (qs("#auth").style.display !== "none" && qs("#register").style.display === "none" && qs("#app").style.display === "none") ||
        (qs("#register").style.display !== "none" && qs("#auth").style.display === "none" && qs("#app").style.display === "none");

    if (onlyAuthOrReg || vis === 1) grid.classList.add("single");
    else grid.classList.remove("single");
}

// Navegación entre formularios
function gotoRegister() {
    qs("#auth").style.display = "none";
    qs("#register").style.display = "block";
    qs("#app").style.display = "none";
    updateLayoutMode();
    focusLater("#reg-username");
}

function gotoLogin() {
    qs("#register").style.display = "none";
    qs("#auth").style.display = "block";
    qs("#app").style.display = "none";
    updateLayoutMode();
    focusLater("#login-username");
}

//Registrarse
async function doRegister() {
    const username = qs("#reg-username").value.trim();
    const email = qs("#reg-email").value.trim();
    const password = qs("#reg-password").value.trim();
    const msg = qs("#msg");

    // Validaciones mínimas cliente
    if (!username) return setMsg(msg, "El usuario es obligatorio.");
    if (!password || password.length < 6) return setMsg(msg, "La contraseña debe tener al menos 6 caracteres.");

    setMsg(msg, "Creando cuenta...");
    try {
        const data = await api("/users/register/", {
            method: "POST",
            body: JSON.stringify({ username, email, password })
        });
        setMsg(msg, `Usuario creado: ${data.username}. Ahora inicia sesión.`);
        gotoLogin();
        qs("#login-username").value = username;
    } catch (e) {
        setMsg(msg, "Error al registrar:\n" + e.message);
    }
}

async function doLogin() {
    const username = qs("#login-username").value.trim();
    const password = qs("#login-password").value.trim();
    if (!username || !password) {
        alert("Completa usuario y contraseña.");
        return;
    }
    try {
        const r = await fetch(`${API}/auth/token/`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password })
        });
        if (!r.ok) {
            let t = `${r.status} ${r.statusText}`;
            try { const j = await r.json(); t += `\n${JSON.stringify(j)}`; } catch { }
            throw new Error(t);
        }
        const data = await r.json();
        storage.access = data.access;
        storage.refresh = data.refresh;
        setAuthedUI(true);
        await loadProfile();
    } catch (e) {
        alert("Login fallido:\n" + e.message);
    }
}

async function loadProfile() {
    try {
        const me = await api("/users/me/");
        qs("#welcome").textContent = `Bienvenido, ${me.username}`;
        qs("#output").textContent = JSON.stringify(me, null, 2);
    } catch (e) {
        qs("#output").textContent = "Error:\n" + e.message;
    }
}

function doLogout() {
    storage.clear();
    setAuthedUI(false);
    gotoLogin();
}

//Declaraciones en el DOM
function qs(sel) { return document.querySelector(sel); }
function on(sel, ev, fn) { document.querySelector(sel)?.addEventListener(ev, fn); }
function setMsg(el, text) { if (el) el.textContent = text; }
function focusLater(sel) { setTimeout(() => qs(sel)?.focus(), 0); }

//Inicio
document.addEventListener("DOMContentLoaded", () => {
    // Listeners principales
    on("#btn-register", "click", doRegister);
    on("#btn-login", "click", doLogin);
    on("#btn-logout", "click", doLogout);

    // Cambiar entre login / registro
    on("#btn-goto-register", "click", gotoRegister);
    on("#btn-goto-login", "click", gotoLogin);

    // Enter en password para login
    on("#login-password", "keydown", (e) => { if (e.key === "Enter") doLogin(); });

    // Estado inicial
    const isAuthed = !!storage.access;
    setAuthedUI(isAuthed);
    if (isAuthed) loadProfile(); else gotoLogin();

    // Asegurar centrado inicial
    updateLayoutMode();
});
