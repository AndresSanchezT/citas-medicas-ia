import { useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';

interface DragState {
  pointerId: number;
  startX: number;
  startY: number;
  startOffsetX: number;
  startOffsetY: number;
}

// Margen mínimo que debe quedar visible del modal al arrastrarlo, para que nunca se
// pueda perder por completo fuera de la pantalla (y con él, el botón de cerrar).
const MARGEN_VISIBLE_PX = 48;

export function Modal({
  title,
  onClose,
  children,
  width = 420,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  width?: number;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);

  function onHeaderPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    // Botón izquierdo (o toque) únicamente; el botón de cerrar detiene la propagación
    // por su cuenta, así que nunca llega hasta acá.
    if (e.button !== undefined && e.button !== 0) return;
    dragRef.current = { pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, startOffsetX: offset.x, startOffsetY: offset.y };
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
  }

  function onHeaderPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;

    let nextX = drag.startOffsetX + (e.clientX - drag.startX);
    let nextY = drag.startOffsetY + (e.clientY - drag.startY);

    const panel = panelRef.current;
    if (panel) {
      const rect = panel.getBoundingClientRect();
      // El rect ya incluye el offset actual, así que la posición "sin offset" (para
      // calcular límites) es rect menos offset.x/offset.y.
      const left0 = rect.left - offset.x;
      const top0 = rect.top - offset.y;
      const minX = MARGEN_VISIBLE_PX - (left0 + rect.width);
      const maxX = window.innerWidth - MARGEN_VISIBLE_PX - left0;
      const minY = MARGEN_VISIBLE_PX - (top0 + rect.height);
      const maxY = window.innerHeight - MARGEN_VISIBLE_PX - top0;
      nextX = Math.min(Math.max(nextX, minX), maxX);
      nextY = Math.min(Math.max(nextY, minY), maxY);
    }

    setOffset({ x: nextX, y: nextY });
  }

  function onHeaderPointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId === e.pointerId) {
      dragRef.current = null;
      setDragging(false);
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
      }}
    >
      <div
        ref={panelRef}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-lg)',
          padding: '1.5rem',
          width,
          maxWidth: '90vw',
          maxHeight: '85vh',
          overflowY: 'auto',
          transform: `translate(${offset.x}px, ${offset.y}px)`,
        }}
      >
        <div
          onPointerDown={onHeaderPointerDown}
          onPointerMove={onHeaderPointerMove}
          onPointerUp={onHeaderPointerUp}
          onPointerCancel={onHeaderPointerUp}
          title="Arrastrar para mover"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1.1rem',
            marginLeft: '-0.5rem',
            marginRight: '-0.5rem',
            marginTop: '-0.25rem',
            padding: '0.25rem 0.5rem',
            borderRadius: 'var(--radius-md)',
            cursor: dragging ? 'grabbing' : 'grab',
            userSelect: dragging ? 'none' : undefined,
            touchAction: 'none',
          }}
        >
          <h2 style={{ margin: 0 }}>{title}</h2>
          <button
            onClick={onClose}
            onPointerDown={(e) => e.stopPropagation()}
            aria-label="Cerrar"
            style={{ border: 'none', background: 'none', fontSize: 16, color: 'var(--text-muted)', padding: 4, cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
