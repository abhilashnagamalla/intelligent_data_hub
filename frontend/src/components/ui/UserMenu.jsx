import { useContext, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, Settings, User2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AuthContext } from "../../context/AuthContextFixed";

export default function UserMenu() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user, logout } = useContext(AuthContext);
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClick = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClick);
    return () => {
      document.removeEventListener("mousedown", handleClick);
    };
  }, []);

  if (!user) return null;

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-secondary text-sm font-bold text-white shadow-lg"
      >
        {user.picture ? (
          <img src={user.picture} alt={user.name} className="h-full w-full object-cover" />
        ) : (
          <span>{user.name?.charAt(0)?.toUpperCase() || "U"}</span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-3 w-60 rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-2 shadow-[var(--shadow-panel)]">
          <div className="rounded-2xl bg-[var(--surface-muted)] px-4 py-3">
            <div className="font-semibold text-[var(--text-primary)]">{user.name}</div>
            <div className="text-sm text-muted">{user.email}</div>
          </div>
          <button
            type="button"
            onClick={() => {
              navigate("/dashboard/profile");
              setOpen(false);
            }}
            className="mt-2 flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-muted)]"
          >
            <User2 className="h-4 w-4" />
            {t("Profile")}
          </button>
          <button
            type="button"
            onClick={() => {
              navigate("/dashboard/settings");
              setOpen(false);
            }}
            className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-muted)]"
          >
            <Settings className="h-4 w-4" />
            {t("Settings")}
          </button>
          <button
            type="button"
            onClick={() => {
              logout();
              setOpen(false);
            }}
            className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-rose-600 transition-colors hover:bg-rose-50 dark:hover:bg-rose-950/40"
          >
            <LogOut className="h-4 w-4" />
            {t("Logout")}
          </button>
        </div>
      )}
    </div>
  );
}
