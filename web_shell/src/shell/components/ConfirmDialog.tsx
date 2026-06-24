import React, { createContext, useContext, useState, useCallback } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
}

interface ConfirmContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

/**
 * Promise-based confirm hook. Usage:
 *
 * ```tsx
 * const confirm = useConfirm();
 * const ok = await confirm({ title: 'Leave Room', message: 'Are you sure?' });
 * if (ok) { ... }
 * ```
 */
export const useConfirm = (): ConfirmContextValue['confirm'] => {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within <ConfirmProvider>');
  return ctx.confirm;
};

// ---------------------------------------------------------------------------
// Provider — renders the dialog overlay when a confirmation is pending
// ---------------------------------------------------------------------------

interface PendingConfirm {
  options: ConfirmOptions;
  resolve: (value: boolean) => void;
}

export const ConfirmProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [pending, setPending] = useState<PendingConfirm | null>(null);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      setPending({ options, resolve });
    });
  }, []);

  const handleConfirm = () => {
    pending?.resolve(true);
    setPending(null);
  };

  const handleCancel = () => {
    pending?.resolve(false);
    setPending(null);
  };

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {pending && (
        <div className="custom-confirm-overlay">
          <div className="custom-confirm-card">
            <h3 className="custom-confirm-title">
              {pending.options.title}
            </h3>
            <p className="custom-confirm-message">
              {pending.options.message}
            </p>
            <div className="custom-confirm-actions">
              <button
                className="custom-confirm-btn-cancel"
                onClick={handleCancel}
              >
                {pending.options.cancelText || 'CANCEL'}
              </button>
              <button
                className="custom-confirm-btn-confirm"
                onClick={handleConfirm}
              >
                {pending.options.confirmText || 'CONFIRM'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
};
