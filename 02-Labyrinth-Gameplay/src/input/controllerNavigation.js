// Controller menus use the same native controls as keyboard and mouse users.
// No key events are synthesized: gameplay also listens for those globally.
const FOCUSABLE = 'button, a[href], input:not([type="hidden"]), select, textarea, [role="button"][tabindex="0"]';
const MODALS = '[role="dialog"][aria-modal="true"], dialog[open], [data-controller-menu-scope]';

const documentOf = root => root?.ownerDocument ?? (root?.nodeType === 9 ? root : null);
const styleOf = element => documentOf(element)?.defaultView?.getComputedStyle?.(element) ?? element?.style ?? {};

export function isControllerElementVisible(element) {
  if (!element || element.hidden || element.closest?.('[hidden], [inert], [aria-hidden="true"]')) return false;
  if (element.getClientRects && element.getClientRects().length === 0) return false;
  for (let node = element; node?.nodeType === 1; node = node.parentElement) {
    const style = styleOf(node);
    if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') return false;
  }
  return true;
}

function isAvailable(element) {
  return isControllerElementVisible(element) && !element.disabled &&
    element.getAttribute?.('aria-disabled') !== 'true' &&
    !element.matches?.(':disabled') && element.tabIndex >= 0;
}

function findScope(root) {
  if (!root?.querySelectorAll) return { root, toggle: null };
  const modals = [...root.querySelectorAll(MODALS)].filter(isControllerElementVisible);
  if (root.matches?.(MODALS) && isControllerElementVisible(root)) modals.unshift(root);
  if (modals.length) return { root: modals[modals.length - 1], toggle: null };

  // These existing popovers are not modal dialogs. Keep their own toggle in
  // the navigation scope so they can be closed without reaching behind them.
  const panels = [...root.querySelectorAll('.myst-store-panel, .first-page-expanded-panel')]
    .filter(isControllerElementVisible);
  const panel = panels[panels.length - 1];
  if (!panel) return { root, toggle: null };
  const toggleSelector = panel.matches('.myst-store-panel') ? '.first-page-myst-store-button' :
    panel.matches('.developer-letter-expanded') ? '.first-page-letter-button' :
    panel.matches('.support-expanded') ? '.first-page-support-button' : '.first-page-settings-button';
  return { root: panel, toggle: root.querySelector(toggleSelector) };
}

export function getFocusableControllerElements(root) {
  const scope = findScope(root);
  const elements = [...(scope.root?.querySelectorAll?.(FOCUSABLE) ?? [])];
  if (scope.root?.matches?.(FOCUSABLE)) elements.unshift(scope.root);
  if (scope.toggle && !elements.includes(scope.toggle)) elements.unshift(scope.toggle);
  return elements.filter(isAvailable);
}

const rectCenter = rect => ({
  x: (rect.left + rect.right) / 2,
  y: (rect.top + rect.bottom) / 2,
});

/** Return a candidate { rect, ... } lying in the requested direction. */
export function chooseDirectionalTarget(currentRect, candidates, direction) {
  const vertical = direction === 'up' || direction === 'down';
  if (!vertical && direction !== 'left' && direction !== 'right') return null;
  const origin = rectCenter(currentRect), sign = direction === 'up' || direction === 'left' ? -1 : 1;
  let best = null;
  for (const candidate of candidates) {
    const rect = candidate.rect, center = rectCenter(rect);
    const forward = sign * (vertical ? center.y - origin.y : center.x - origin.x);
    if (forward < 2) continue;
    const perpendicular = Math.abs(vertical ? center.x - origin.x : center.y - origin.y);
    const overlap = vertical ? Math.min(rect.right, currentRect.right) - Math.max(rect.left, currentRect.left) :
      Math.min(rect.bottom, currentRect.bottom) - Math.max(rect.top, currentRect.top);
    // Stay in the current row/column when possible, then choose the nearest
    // forward control. This handles both level-card grids and long shop lists.
    const aligned = overlap > 0;
    const score = forward + perpendicular * .35;
    if (!best || (aligned && !best.aligned) || (aligned === best.aligned && score < best.score)) {
      best = { candidate, aligned, score };
    }
  }
  return best?.candidate ?? null;
}

function scrollable(element) {
  const style = styleOf(element);
  return element?.scrollHeight > element?.clientHeight + 1 && /^(auto|scroll|overlay)$/.test(style.overflowY);
}

function scrollMenuDirection(root, direction) {
  if (direction !== 'up' && direction !== 'down') return false;
  const scope = findScope(root).root;
  if (!scope) return false;
  const active = documentOf(root)?.activeElement;
  let target = null;
  // A menu's own scroller remains usable even when every Buy button is
  // disabled. Do not escape an open popover and scroll the page behind it.
  if (active !== scope && scope.contains?.(active)) {
    for (let node = active?.parentElement; node; node = node.parentElement) {
      if (isControllerElementVisible(node) && scrollable(node)) { target = node; break; }
      if (node === scope) break;
    }
  }
  if (!target && isControllerElementVisible(scope) && scrollable(scope)) target = scope;
  if (!target) {
    target = [...(scope.querySelectorAll?.('*') ?? [])]
      .find(element => isControllerElementVisible(element) && scrollable(element));
  }
  if (!target && scope === root) {
    const page = documentOf(root)?.scrollingElement;
    if (page?.scrollHeight > page?.clientHeight + 1) target = page;
  }
  if (!target) return false;
  const before = target.scrollTop;
  const amount = Math.max(80, Math.min(300, target.clientHeight * .65));
  target.scrollTop = Math.max(0, Math.min(target.scrollHeight - target.clientHeight,
    before + (direction === 'down' ? amount : -amount)));
  return target.scrollTop !== before;
}

function revealFocused(element) {
  for (let parent = element.parentElement; parent; parent = parent.parentElement) {
    if (!scrollable(parent)) continue;
    const rect = element.getBoundingClientRect(), bounds = parent.getBoundingClientRect();
    const padding = 12;
    if (rect.top < bounds.top + padding) parent.scrollTop += rect.top - bounds.top - padding;
    else if (rect.bottom > bounds.bottom - padding) parent.scrollTop += rect.bottom - bounds.bottom + padding;
    break;
  }
}

function focusElement(root, element) {
  for (const previous of root?.querySelectorAll?.('[data-controller-focus]') ?? []) previous.removeAttribute('data-controller-focus');
  element.focus?.({ preventScroll: true });
  element.setAttribute?.('data-controller-focus', 'true');
  revealFocused(element);
}

function dispatchValueChange(element) {
  const EventClass = documentOf(element)?.defaultView?.Event ?? globalThis.Event;
  if (!EventClass) return;
  element.dispatchEvent(new EventClass('input', { bubbles: true }));
  element.dispatchEvent(new EventClass('change', { bubbles: true }));
}

function adjustControl(element, direction) {
  if (direction !== 'left' && direction !== 'right') return false;
  const step = direction === 'right' ? 1 : -1;
  if (element.tagName === 'SELECT') {
    const options = [...element.options].filter(option => !option.disabled && !option.parentElement?.disabled);
    const selected = options.findIndex(option => option.index === element.selectedIndex);
    const next = options[Math.max(0, Math.min(options.length - 1, selected + step))];
    if (next && next.index !== element.selectedIndex) {
      element.selectedIndex = next.index;
      dispatchValueChange(element);
    }
    return true;
  }
  if (element.tagName !== 'INPUT' || !['range', 'number'].includes(element.type)) return false;
  const minimum = element.min !== '' ? Number(element.min) : element.type === 'range' ? 0 : -Infinity;
  const maximum = element.max !== '' ? Number(element.max) : element.type === 'range' ? 100 : Infinity;
  const increment = element.step && element.step !== 'any' ? Number(element.step) : 1;
  const value = Number(element.value), next = Math.max(minimum, Math.min(maximum, value + increment * step));
  if (Number.isFinite(next) && next !== value) {
    // React tracks the own value setter. The prototype setter lets its input
    // event detect this change just as it detects a user's native adjustment.
    const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), 'value')?.set;
    const nextValue = String(Math.round(next * 1e10) / 1e10);
    if (setter) setter.call(element, nextValue); else element.value = nextValue;
    dispatchValueChange(element);
  }
  return true;
}

export function navigateControllerMenu(root, direction) {
  const elements = getFocusableControllerElements(root);
  if (!elements.length) return scrollMenuDirection(root, direction);
  const active = documentOf(root)?.activeElement;
  if (!elements.includes(active)) {
    focusElement(root, elements[0]);
    return true;
  }
  if (adjustControl(active, direction)) return true;
  const candidates = elements.filter(element => element !== active).map(element => ({ element, rect: element.getBoundingClientRect() }));
  const next = chooseDirectionalTarget(active.getBoundingClientRect(), candidates, direction);
  if (!next) return scrollMenuDirection(root, direction);
  focusElement(root, next.element);
  return true;
}

export function activateControllerSelection(root) {
  const elements = getFocusableControllerElements(root);
  if (!elements.length) return false;
  const active = documentOf(root)?.activeElement;
  const target = elements.includes(active) ? active : elements[0];
  focusElement(root, target);
  if (target.tagName === 'SELECT') return adjustControl(target, 'right');
  if (target.tagName === 'INPUT' && !['button', 'submit', 'checkbox', 'radio'].includes(target.type)) return true;
  target.click?.();
  return true;
}

export function scrollControllerSidebar(root, amount = 320) {
  if (!Number.isFinite(amount) || amount === 0) return false;
  const selectors = '.maze-sidebar, .three-d-settings-popover';
  const candidates = [...(root?.querySelectorAll?.(selectors) ?? [])];
  if (root?.matches?.(selectors)) candidates.unshift(root);
  const sidebar = candidates.find(element => isControllerElementVisible(element) && scrollable(element));
  if (!sidebar) return false;
  const before = sidebar.scrollTop;
  sidebar.scrollTop = Math.max(0, Math.min(sidebar.scrollHeight - sidebar.clientHeight, before + amount));
  return sidebar.scrollTop !== before;
}
