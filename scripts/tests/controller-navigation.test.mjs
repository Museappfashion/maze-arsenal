import assert from 'node:assert/strict';
import test from 'node:test';
import {
  activateControllerSelection,
  chooseDirectionalTarget,
  getFocusableControllerElements,
  navigateControllerMenu,
  scrollControllerSidebar,
} from '../../src/input/controllerNavigation.js';

const box = (left, top, width = 100, height = 40) => ({ left, top, right: left + width, bottom: top + height, width, height });

function fixture() {
  const doc = { activeElement: null, defaultView: { Event, getComputedStyle: element => ({ display: 'block', visibility: 'visible', overflowY: 'visible', ...element.style }) } };
  const root = { ownerDocument: doc, children: [], querySelectorAll(selector) {
    if (selector.includes('role="dialog"')) return this.modals ?? [];
    if (selector.includes('myst-store-panel')) return this.panels ?? [];
    if (selector.includes('maze-sidebar')) return this.sidebars ?? [];
    if (selector === '[data-controller-focus]') return this.children.filter(e => e.attrs['data-controller-focus']);
    return this.children;
  }, querySelector(selector) { return this.toggle ?? null; } };
  const make = (rect, overrides = {}) => {
    const element = { nodeType: 1, ownerDocument: doc, tagName: 'BUTTON', tabIndex: 0, disabled: false, style: {}, attrs: {}, rect, parentElement: null,
      getClientRects() { return this.invisible ? [] : [this.rect]; },
      getBoundingClientRect() { return this.rect; },
      closest() { return this.hiddenAncestor ? {} : null; },
      getAttribute(name) { return this.attrs[name] ?? null; },
      setAttribute(name, value) { this.attrs[name] = value; },
      removeAttribute(name) { delete this.attrs[name]; },
      matches(selector) { return selector === ':disabled' ? this.disabled : false; },
      focus() { doc.activeElement = this; },
      click() { this.clicks = (this.clicks ?? 0) + 1; },
      dispatchEvent(event) { (this.events ??= []).push(event.type); return true; },
      ...overrides,
    };
    root.children.push(element);
    return element;
  };
  return { root, doc, make };
}

test('directional navigation stays in a level-card column and never moves backward', () => {
  const current = box(0, 0), nearDiagonal = { id: 'diagonal', rect: box(125, 50) }, below = { id: 'below', rect: box(0, 160) };
  assert.equal(chooseDirectionalTarget(current, [nearDiagonal, below], 'down'), below);
  assert.equal(chooseDirectionalTarget(current, [nearDiagonal, below], 'up'), null);
  assert.equal(chooseDirectionalTarget(current, [{ id: 'left', rect: box(-150, 0) }, nearDiagonal], 'right'), nearDiagonal);
});

test('Dpad skips disabled and hidden controls, moves focus, and selects the highlighted button once', () => {
  const { root, doc, make } = fixture();
  const first = make(box(0, 0));
  make(box(0, 50), { disabled: true });
  make(box(0, 100), { invisible: true });
  make(box(0, 150), { hiddenAncestor: true });
  const next = make(box(0, 200));
  assert.deepEqual(getFocusableControllerElements(root), [first, next]);
  assert.equal(navigateControllerMenu(root, 'down'), true);
  assert.equal(doc.activeElement, first);
  assert.equal(navigateControllerMenu(root, 'down'), true);
  assert.equal(doc.activeElement, next);
  assert.equal(first.attrs['data-controller-focus'], undefined);
  assert.equal(next.attrs['data-controller-focus'], 'true');
  assert.equal(activateControllerSelection(root), true);
  assert.equal(next.clicks, 1);
  assert.equal(navigateControllerMenu(root, 'down'), false);
});

test('active modal confines both navigation and activation to its visible controls', () => {
  const { root, doc, make } = fixture();
  const behind = make(box(0, 0));
  const confirm = make(box(0, 80)), cancel = make(box(120, 80));
  const modal = make(box(0, 60, 250, 100), { querySelectorAll: () => [confirm, cancel] });
  root.modals = [modal];
  doc.activeElement = behind;
  assert.deepEqual(getFocusableControllerElements(root), [confirm, cancel]);
  activateControllerSelection(root);
  assert.equal(behind.clicks, undefined);
  assert.equal(confirm.clicks, 1);
  navigateControllerMenu(root, 'right');
  assert.equal(doc.activeElement, cancel);
});

test('shop navigation includes its close toggle and scrolls the shop, not the page', () => {
  const { root, doc, make } = fixture();
  const toggle = make(box(0, 0)), buy = make(box(0, 650));
  const shop = make(box(0, 50, 300, 300), { style: { overflowY: 'auto' }, scrollHeight: 1200, clientHeight: 300, scrollTop: 0,
    matches: selector => selector === '.myst-store-panel', querySelectorAll: () => [buy] });
  const page = make(box(0, 0, 500, 400), { style: { overflowY: 'auto' }, scrollHeight: 1800, clientHeight: 400, scrollTop: 0 });
  shop.parentElement = page;
  buy.parentElement = shop;root.panels = [shop];root.toggle = toggle;
  assert.deepEqual(getFocusableControllerElements(root), [toggle, buy]);
  doc.activeElement = toggle;
  navigateControllerMenu(root, 'down');
  assert.equal(doc.activeElement, buy);
  assert.equal(shop.scrollTop, 352);
  assert.equal(page.scrollTop, 0);
});

test('Dpad scrolls a fully disabled shop while leaving the toggle focused and background page fixed', () => {
  const { root, doc, make } = fixture();
  const toggle = make(box(0, 0)), unavailable = make(box(0, 650), { disabled: true });
  const shop = make(box(0, 50, 300, 300), { style: { overflowY: 'auto' }, scrollHeight: 1200, clientHeight: 300, scrollTop: 0,
    matches: selector => selector === '.myst-store-panel', querySelectorAll: () => [unavailable] });
  const page = make(box(0, 0, 500, 400), { style: { overflowY: 'auto' }, scrollHeight: 1800, clientHeight: 400, scrollTop: 0 });
  shop.parentElement = page;unavailable.parentElement = shop;
  root.panels = [shop];root.toggle = toggle;doc.activeElement = toggle;
  assert.deepEqual(getFocusableControllerElements(root), [toggle]);
  assert.equal(navigateControllerMenu(root, 'down'), true);
  assert.equal(shop.scrollTop, 195);
  assert.equal(doc.activeElement, toggle);
  assert.equal(page.scrollTop, 0);
  assert.equal(navigateControllerMenu(root, 'right'), false);
  assert.equal(shop.scrollTop, 195);
  assert.equal(navigateControllerMenu(root, 'up'), true);
  assert.equal(shop.scrollTop, 0);
  assert.equal(navigateControllerMenu(root, 'up'), false);
});

test('an empty-focusable shop still scrolls and clamps at its own content bounds', () => {
  const { root, make } = fixture();
  const unavailable = make(box(0, 650), { disabled: true });
  const shop = make(box(0, 50, 300, 300), { style: { overflowY: 'auto' }, scrollHeight: 650, clientHeight: 300, scrollTop: 0,
    matches: selector => selector === '.myst-store-panel', querySelectorAll: () => [unavailable] });
  root.panels = [shop];
  assert.deepEqual(getFocusableControllerElements(root), []);
  assert.equal(navigateControllerMenu(root, 'down'), true);
  assert.equal(shop.scrollTop, 195);
  navigateControllerMenu(root, 'down');
  assert.equal(shop.scrollTop, 350);
  assert.equal(navigateControllerMenu(root, 'down'), false);
  assert.equal(navigateControllerMenu(root, 'up'), true);
  assert.equal(shop.scrollTop, 155);
});

test('at the final shop control Dpad scrolls remaining content, while an existing focus target takes priority', () => {
  const { root, doc, make } = fixture();
  const first = make(box(0, 150)), last = make(box(0, 280));
  const shop = make(box(0, 50, 300, 300), { style: { overflowY: 'auto' }, scrollHeight: 1200, clientHeight: 300, scrollTop: 0,
    matches: selector => selector === '.myst-store-panel', querySelectorAll: () => [first, last] });
  first.parentElement = shop;last.parentElement = shop;root.panels = [shop];doc.activeElement = first;
  assert.equal(navigateControllerMenu(root, 'down'), true);
  assert.equal(doc.activeElement, last);
  assert.equal(shop.scrollTop, 0);
  assert.equal(navigateControllerMenu(root, 'down'), true);
  assert.equal(doc.activeElement, last);
  assert.equal(shop.scrollTop, 195);
  assert.equal(navigateControllerMenu(root, 'up'), true);
  assert.equal(doc.activeElement, first);
});

test('left/right adjusts bounded volume and select values with native input/change events', () => {
  const { root, doc, make } = fixture();
  const range = make(box(0, 0), { tagName: 'INPUT', type: 'range', min: '0', max: '1', step: '.1', value: '.9' });
  doc.activeElement = range;
  navigateControllerMenu(root, 'right');
  assert.equal(range.value, '1');
  assert.deepEqual(range.events, ['input', 'change']);
  navigateControllerMenu(root, 'right');
  assert.deepEqual(range.events, ['input', 'change']);
  const select = make(box(0, 60), { tagName: 'SELECT', selectedIndex: 0, options: [{ index: 0 }, { index: 1, disabled: true }, { index: 2 }] });
  doc.activeElement = select;
  navigateControllerMenu(root, 'right');
  assert.equal(select.selectedIndex, 2);
  assert.deepEqual(select.events, ['input', 'change']);
  navigateControllerMenu(root, 'left');
  assert.equal(select.selectedIndex, 0);
});

test('Circle sidebar scroll is bounded and cannot scroll hidden sidebars or unrelated page content', () => {
  const { root, make } = fixture();
  const hidden = make(box(0, 0), { invisible: true, style: { overflowY: 'auto' }, scrollHeight: 1800, clientHeight: 500, scrollTop: 0 });
  const visible = make(box(0, 0), { style: { overflowY: 'auto' }, scrollHeight: 1000, clientHeight: 500, scrollTop: 0 });
  root.sidebars = [hidden, visible];
  assert.equal(scrollControllerSidebar(root, 320), true);
  assert.equal(visible.scrollTop, 320);
  assert.equal(hidden.scrollTop, 0);
  scrollControllerSidebar(root, 320);
  assert.equal(visible.scrollTop, 500);
  assert.equal(scrollControllerSidebar(root, 320), false);
  assert.equal(scrollControllerSidebar(root, -200), true);
  assert.equal(visible.scrollTop, 300);
});
