import { createPortal } from 'react-dom';

type OverlayConfirmProps = {
  open: boolean;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export const OverlayConfirm = ({
  open,
  title = '확인',
  message,
  confirmLabel = '확인',
  cancelLabel = '취소',
  onConfirm,
  onCancel,
}: OverlayConfirmProps) => {
  if (!open) return null;

  return createPortal(
    <div className="overlay-confirm-backdrop" role="presentation" onClick={onCancel}>
      <div
        className="overlay-confirm-card"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <h3>{title}</h3>
        <p>{message}</p>
        <div className="overlay-confirm-actions">
          <button type="button" className="overlay-confirm-btn overlay-confirm-btn-cancel" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button type="button" className="overlay-confirm-btn overlay-confirm-btn-confirm" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};
