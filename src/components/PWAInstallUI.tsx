import React, { useEffect } from 'react';
import {
  Download,
  MoreVertical,
  Share,
  Smartphone,
  WifiOff,
  X,
} from 'lucide-react';

interface MobileInstallBannerProps {
  isInstalled: boolean;
  dismissed: boolean;
  isInstallable: boolean;
  onInstallClick: () => void;
  onDismiss: () => void;
}

export const MobileInstallBanner: React.FC<MobileInstallBannerProps> = ({
  isInstalled,
  dismissed,
  isInstallable,
  onInstallClick,
  onDismiss,
}) => {
  if (isInstalled || dismissed) return null;

  return (
    <div className="lg:hidden bg-white dark:bg-[#11161D] border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <img
          src="/assets/aistudio/a7fc4615-62c9-4406-a7e4-dc3cdedcf5c3_6d58de95.png"
          alt="Icono de la aplicación HYM_YT"
          referrerPolicy="no-referrer"
          className="w-10 h-10 rounded-lg object-cover shrink-0 border border-slate-200 dark:border-slate-700"
        />
        <div className="min-w-0">
          <div className="font-display text-xs font-semibold text-slate-900 dark:text-white truncate">
            Descargar app móvil
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
            Horarios y partidos disponibles sin conexión
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={onInstallClick}
          className="min-h-[44px] px-3.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors whitespace-nowrap"
        >
          {isInstallable ? 'Instalar' : 'Cómo instalar'}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Ocultar aviso de descarga móvil"
          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

interface OfflineIndicatorProps {
  isOnline: boolean;
}

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({
  isOnline,
}) => {
  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 rounded-xl px-4 py-2.5 flex items-center gap-2.5 text-xs font-medium"
    >
      <WifiOff className="w-4 h-4 shrink-0 text-amber-700 dark:text-amber-400" />
      <span>
        Modo sin conexión · Mostrando los partidos y horarios guardados en tu
        dispositivo.
      </span>
    </div>
  );
};

interface PWAInstallModalProps {
  open: boolean;
  isIOS: boolean;
  isInstallable: boolean;
  onTriggerNativeInstall: () => Promise<void>;
  onClose: () => void;
}

export const PWAInstallModal: React.FC<PWAInstallModalProps> = ({
  open,
  isIOS,
  isInstallable,
  onTriggerNativeInstall,
  onClose,
}) => {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60">
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Descargar aplicación móvil de HYM_YT"
        className="relative z-10 w-full max-w-md bg-white dark:bg-[#11161D] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <Smartphone className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
            <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white truncate">
              Descargar app móvil
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar guía de instalación"
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          <div className="flex items-center gap-3.5">
            <img
              src="/assets/aistudio/a7fc4615-62c9-4406-a7e4-dc3cdedcf5c3_6d58de95.png"
              alt="Icono oficial de Calendario de Fútbol HYM_YT"
              referrerPolicy="no-referrer"
              className="w-14 h-14 rounded-xl object-cover shrink-0 border border-slate-200 dark:border-slate-700"
            />
            <div className="min-w-0">
              <div className="font-display text-sm font-bold text-slate-900 dark:text-white">
                Calendario de Fútbol HYM_YT
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                Instálala en tu pantalla de inicio para abrirla a pantalla
                completa y consultar horarios sin conexión.
              </p>
            </div>
          </div>

          {isInstallable ? (
            <div className="space-y-3">
              <button
                type="button"
                onClick={onTriggerNativeInstall}
                className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors whitespace-nowrap"
              >
                <Download className="w-4 h-4" />
                <span>Instalar aplicación en este dispositivo</span>
              </button>
            </div>
          ) : isIOS ? (
            <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <div className="text-xs font-semibold text-slate-900 dark:text-white">
                Pasos en iPhone y iPad (Safari)
              </div>
              <ol className="space-y-2.5 text-xs text-slate-600 dark:text-slate-300">
                <li className="flex items-start gap-2.5">
                  <span className="font-mono tabular-nums font-semibold text-emerald-700 dark:text-emerald-400 shrink-0">
                    1.
                  </span>
                  <span className="flex items-center gap-1.5 flex-wrap">
                    Pulsa el botón <Share className="w-3.5 h-3.5 inline" />{' '}
                    <strong className="text-slate-900 dark:text-white">
                      Compartir
                    </strong>{' '}
                    en la barra inferior de Safari.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="font-mono tabular-nums font-semibold text-emerald-700 dark:text-emerald-400 shrink-0">
                    2.
                  </span>
                  <span>
                    Desliza hacia abajo y selecciona{' '}
                    <strong className="text-slate-900 dark:text-white">
                      Añadir a pantalla de inicio
                    </strong>
                    .
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="font-mono tabular-nums font-semibold text-emerald-700 dark:text-emerald-400 shrink-0">
                    3.
                  </span>
                  <span>
                    Pulsa{' '}
                    <strong className="text-slate-900 dark:text-white">
                      Añadir
                    </strong>{' '}
                    arriba a la derecha para guardar el icono de HYM_YT.
                  </span>
                </li>
              </ol>
            </div>
          ) : (
            <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <div className="text-xs font-semibold text-slate-900 dark:text-white">
                Pasos en Android (Chrome) o navegador móvil
              </div>
              <ol className="space-y-2.5 text-xs text-slate-600 dark:text-slate-300">
                <li className="flex items-start gap-2.5">
                  <span className="font-mono tabular-nums font-semibold text-emerald-700 dark:text-emerald-400 shrink-0">
                    1.
                  </span>
                  <span className="flex items-center gap-1 flex-wrap">
                    Abre el menú del navegador{' '}
                    <MoreVertical className="w-3.5 h-3.5 inline" /> en la
                    esquina superior derecha.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="font-mono tabular-nums font-semibold text-emerald-700 dark:text-emerald-400 shrink-0">
                    2.
                  </span>
                  <span>
                    Pulsa{' '}
                    <strong className="text-slate-900 dark:text-white">
                      Instalar aplicación
                    </strong>{' '}
                    o{' '}
                    <strong className="text-slate-900 dark:text-white">
                      Añadir a pantalla de inicio
                    </strong>
                    .
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="font-mono tabular-nums font-semibold text-emerald-700 dark:text-emerald-400 shrink-0">
                    3.
                  </span>
                  <span>
                    Confirma la instalación para acceder con el icono HYM_YT y
                    uso sin conexión.
                  </span>
                </li>
              </ol>
            </div>
          )}
        </div>

        <div className="px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};
