/** Evita que la rueda del mouse cambie el valor de un `input[type=number]` enfocado. */
export function blockNumberInputWheel(event: WheelEvent): void {
  if (document.activeElement === event.currentTarget) {
    event.preventDefault()
  }
}
