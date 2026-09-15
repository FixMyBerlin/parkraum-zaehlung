import { useSyncExternalStore } from 'react'

/**
 * Hotkeys that must fire while a count input has focus cannot use a library's
 * `ignoreInputs` guard (it would ignore all inputs, count fields included).
 * Disable them instead whenever the user is typing in a real text field (a
 * note, a search box, …) — a `type=number` field does not count as one.
 */
function isTextEntryElement(element: Element | null) {
  if (!(element instanceof HTMLElement)) return false
  if (element.isContentEditable) return true
  if (element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) return true
  if (!(element instanceof HTMLInputElement)) return false
  return element.type !== 'number'
}

function subscribeToFocusChanges(onFocusChange: () => void) {
  document.addEventListener('focusin', onFocusChange)
  document.addEventListener('focusout', onFocusChange)
  return function unsubscribeFromFocusChanges() {
    document.removeEventListener('focusin', onFocusChange)
    document.removeEventListener('focusout', onFocusChange)
  }
}

export function useTextEntryFocused() {
  return useSyncExternalStore(
    subscribeToFocusChanges,
    () => isTextEntryElement(document.activeElement),
    () => false,
  )
}
