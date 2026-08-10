import { onBeforeUnmount, ref, type Ref } from "vue";

/** Píxeles que hay que recorrer antes de considerar que es un arrastre y no un clic. */
const DRAG_THRESHOLD_PX = 4;

/** Elementos donde arrastrar significa otra cosa (seleccionar texto, marcar, abrir). */
const INTERACTIVE_SELECTOR =
  "a, button, input, select, textarea, label, [role='button'], [contenteditable='true']";

export interface TableDragScroll {
  /** Ref que hay que enganchar al contenedor con `overflow-x-auto`. */
  containerRef: Ref<HTMLElement | null>;
  /** `true` mientras se está arrastrando; sirve para cambiar el cursor. */
  isDragging: Ref<boolean>;
  onPointerDown: (event: PointerEvent) => void;
}

/**
 * Permite desplazar una tabla ancha arrastrando con el mouse, en vez de obligar
 * a buscar la barra horizontal. Solo actúa con el botón primario y nunca sobre
 * controles (botones, enlaces, inputs), para no robarles el clic.
 *
 * El clic posterior a un arrastre real se cancela: si no, soltar el mouse encima
 * de una fila dispararía su acción después de haber estado solo desplazando.
 */
export function useTableDragScroll(): TableDragScroll {
  const containerRef = ref<HTMLElement | null>(null);
  const isDragging = ref(false);

  let pointerId: number | null = null;
  let startX = 0;
  let startY = 0;
  let startScrollLeft = 0;
  let moved = false;

  function suppressNextClick(event: MouseEvent) {
    event.stopPropagation();
    event.preventDefault();
  }

  function stop() {
    const el = containerRef.value;
    if (el && pointerId != null && el.hasPointerCapture(pointerId)) {
      el.releasePointerCapture(pointerId);
    }
    if (moved) {
      // `capture: true` para llegar antes que los handlers de las filas.
      window.addEventListener("click", suppressNextClick, {
        capture: true,
        once: true,
      });
    }
    pointerId = null;
    moved = false;
    isDragging.value = false;
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", stop);
    window.removeEventListener("pointercancel", stop);
  }

  function onPointerMove(event: PointerEvent) {
    const el = containerRef.value;
    if (!el || pointerId == null) return;
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    if (!moved && Math.abs(dx) < DRAG_THRESHOLD_PX && Math.abs(dy) < DRAG_THRESHOLD_PX) {
      return;
    }
    if (!moved) {
      moved = true;
      isDragging.value = true;
      if (el.setPointerCapture) el.setPointerCapture(pointerId);
    }
    el.scrollLeft = startScrollLeft - dx;
    // Evita que el arrastre seleccione el texto de las celdas.
    event.preventDefault();
  }

  function onPointerDown(event: PointerEvent) {
    if (event.button !== 0) return;
    const el = containerRef.value;
    if (!el) return;
    // Nada que desplazar: dejamos el gesto a la selección de texto.
    if (el.scrollWidth <= el.clientWidth) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest(INTERACTIVE_SELECTOR)) return;

    pointerId = event.pointerId;
    startX = event.clientX;
    startY = event.clientY;
    startScrollLeft = el.scrollLeft;
    moved = false;
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
  }

  onBeforeUnmount(() => {
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", stop);
    window.removeEventListener("pointercancel", stop);
    window.removeEventListener("click", suppressNextClick, { capture: true });
  });

  return { containerRef, isDragging, onPointerDown };
}
