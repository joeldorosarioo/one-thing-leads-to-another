function createUiElement(tag = 'div', options = {}) {
  const listeners = new Map();

  const element = {
    ...options,
    tag,
    text: options.text ?? '',
    value: '',
    dataset: {},
    children: [],
    classes: new Set((options.cls ?? '').split(' ').filter(Boolean)),

    createEl(childTag, childOptions) {
      const child = createUiElement(childTag, childOptions);
      element.children.push(child);
      return child;
    },

    createDiv(childOptions) {
      return element.createEl('div', childOptions);
    },

    empty() {
      element.children.length = 0;
    },

    addClass(...names) {
      names.forEach(name => element.classes.add(name));
    },

    removeClass(name) {
      element.classes.delete(name);
    },

    toggleClass(name, enabled) {
      if (enabled) element.classes.add(name);
      else element.classes.delete(name);
    },

    setText(text) {
      element.text = text;
    },

    setAttribute(name, value) {
      element[name] = value;
    },

    addEventListener(name, handler) {
      listeners.set(name, handler);
    },

    trigger(name) {
      return listeners.get(name)?.();
    },

    querySelectorAll(selector) {
      return element.children.flatMap(child => {
        const matches = selector.startsWith('.') ? child.classes.has(selector.slice(1)) : child.tag === selector;
        return [...(matches ? [child] : []), ...child.querySelectorAll(selector)];
      });
    },

    querySelector(selector) {
      return element.querySelectorAll(selector)[0] ?? null;
    }
  };

  return element;
}

module.exports = { createUiElement };
