class Praxy {
  #events = [];
  #components = {};

  component(cmpt, mounted) {
    const uuids = [];

    const cmptName = cmpt.name ?? this.#generateUUID(uuids);
    if (this.#components[cmptName] != null) {
      throw new Error(`Praxy->component: "${cmptName}" already exists`);
    }

    const map = {};
    const fors = {};
    const target = cmpt.target;
    const el = target ? document.querySelector(target) : document.body;

    if (el == null) {
      throw new Error(
        `Praxy->component: Your mount point "${target ?? document.body}" doesn't exist`
      );
    }

    this.#components[cmptName] = {
      ...cmpt,
      fors,
    };

    const tmp = document.createElement('template');
    tmp.innerHTML = cmpt.template.trim();

    if (tmp.content.childNodes.length > 1) {
      throw new Error(
        `Praxy->component: Your template for "${cmptName}" must have a single root element.`
      );
    }

    const root = tmp.content.children[0].cloneNode();

    const sample = cmpt.inherit ? this.#components[cmpt.inherit].data : cmpt.data;
    const data = sample
      ? new Proxy(sample, {
          set: (data, key, value) => {
            const s = Reflect.set(data, key, value);
            this.#renderFor(root, uuids, data, map, fors);
            this.#map(root, uuids, data, map);
            this.#render(root, map);
            return s;
          },
          get: (data, key) => {
            return Reflect.get(data, key);
          },
        })
      : null;

    if (data) {
      this.#renderFor(tmp.content, uuids, data, map, fors);
      this.#map(tmp.content, uuids, data, map);
    }

    if (tmp.content.children.length > 1) {
      root.append(tmp.content.children[0].cloneNode(true));
    } else {
      tmp.content.children[0].childNodes.forEach((node) => {
        root.append(node.cloneNode(true));
      });
      if (tmp.content.children[0].attributes) {
        for (const attr of tmp.content.children[0].attributes) {
          root.setAttribute(attr.name, attr.value);
        }
      }
    }
    el.append(root);

    if (data) {
      this.#render(root, map);
    }

    if (mounted) {
      mounted({
        data,
        root,
        on: this.#on.bind(this),
        closest: this.#closest.bind(this),
      });
    }
  }

  #map(node, uuids, data, map) {
    if (!node.children) {
      return;
    }
    for (let i = 0; i < node.children.length; i++) {
      const child = node.children[i];
      this.#map(child, uuids, data, map);

      if (child.attributes && child.hasAttribute('px-for')) {
        return;
      }

      if (
        Array.from(child.childNodes)?.some((c) => c.nodeValue?.match(/{{(.*?)}}/g)) ||
        (child.attributes && child.hasAttribute('k'))
      ) {
        const uuid = child.getAttribute('k') ?? this.#generateUUID(uuids);
        if (!child.hasAttribute('k')) {
          child.setAttribute('k', uuid);
        }
        const parent = child.parentNode;
        const isFor =
          (parent.attributes && parent.hasAttribute('px-for')) ||
          child.hasAttribute('i') ||
          this.#closest(child, 'i', null, 'px-for');
        const matches = map[uuid]?.keys ?? new Set();
        const clone = map[uuid]?.clone ?? child.cloneNode(true);
        const nodes = map[uuid]?.clone.childNodes ?? child.childNodes;

        const live = Array.from(nodes).map((node) => {
          const n = node.cloneNode(true);
          if (node.nodeName === '#text') {
            n.nodeValue = n.nodeValue.replaceAll(/{{(.*?)}}/g, (match) => {
              const isTernary = match.includes('?') && match.includes(':');
              let k = match.replace(/{{|}}/g, '').trim();
              if (isTernary) {
                const [lh, rh] = k.split('?');
                const key = lh.trim().split('.');
                const match = lh.trim();
                const [v1, v2] = rh.split(':');
                const v = this.#getValue(child, data, key, match, isFor);
                const val = v ? v1.trim() : v2.trim();
                if (!val.includes("'") && !val.includes('"')) {
                  // the evaluated value is a variable
                  const loopItem = this.#getValue(child, data, [val], val, isFor);
                  const rootValue = this.#getValue(child, data, [val], val, false);
                  return loopItem[val] ?? rootValue;
                }
                matches.add(key);
                return val.replaceAll(/['"]/g, '');
              } else {
                k = k.split('.');
              }
              matches.add(k[0]);
              return this.#getValue(child, data, k, match, isFor);
            });
          }
          return n;
        });

        map[uuid] = {
          live,
          clone,
          keys: matches,
          parent: child.parentNode.cloneNode(),
        };
      }
    }
  }

  #getValue(child, data, k, match, isFor) {
    let v = data[k[0]];
    if (isFor) {
      const index = this.#closest(child, 'i')?.getAttribute('i') ?? child.getAttribute('i');
      const parent = this.#closest(child, 'px-for');
      const [_, values] = parent.getAttribute('px-for')?.split(' in ');
      v = data[values][index];
      if (!v) {
        throw new Error(
          `Praxy->map: No value found for "${match}". This may be due to a change in the template.`
        );
      }
    }
    if (match.includes('.')) {
      k.forEach((key) => {
        if (v[key] != null) {
          v = v[key];
        }
      });
    }
    return v;
  }

  #render(root, map) {
    Object.keys(map).forEach((key) => {
      const m = map[key];
      const domEl =
        root.children.length === 0 || (root.attributes && root.getAttribute('k') === key)
          ? root
          : root.querySelector(`[k="${key}"]`);
      if (!domEl) {
        delete map[key];
        return;
      }
      if (domEl.childNodes.length !== m.live.length) {
        console.warn(
          `Praxy->render: The number of live nodes (${m.live.length}) doesn't match the number of DOM nodes (${domEl.childNodes.length}).`,
          'This may be due to a change in the template. DOM have been synced to match again.'
        );
        while (domEl.firstChild) {
          domEl.removeChild(domEl.lastChild);
        }
        m.live.forEach((node) => {
          domEl.append(node);
        });
      }
      const domStr = Array.from(domEl.childNodes)
        .map((c) => c.nodeValue)
        .join('');
      const liveStr = m.live.map((c) => c.nodeValue).join('');
      if (domStr !== liveStr) {
        m.live.forEach((node, i) => {
          const c = domEl.childNodes[i];
          // Don't replace nodes that's already been processed
          if (c.attributes && c.hasAttribute('k')) {
            return;
          }
          if (!c.isEqualNode(node)) {
            domEl.replaceChild(node, c);
          }
        });
      }
    });
  }

  #renderFor(root, uuids, data, map, fors) {
    root.querySelectorAll('[px-for]')?.forEach((el) => {
      const parent = el;
      const uuid = parent.getAttribute('k') ?? this.#generateUUID(uuids);
      const f = fors[uuid];
      const children = Array.from(parent.children);
      const clone = f ? f.clone : children[0]?.cloneNode(true);
      const firstRender = f == null;
      if (firstRender) {
        fors[uuid] = {
          clone,
          parent,
        };
      }
      const attr = parent.getAttribute('px-for');
      const [_, value] = attr.split(' in ');
      const arr = data[value];
      if (firstRender) {
        parent.setAttribute('k', uuid);
        for (let i = 0; i < arr?.length; i++) {
          const c = clone.cloneNode(true);
          c.setAttribute('i', i);
          parent.append(c);
        }
        Array.from(parent.children)
          .find((c) => !c.hasAttribute('i'))
          ?.remove();
        return;
      }
      // sync nodes
      children.forEach((c) => {
        const index = c.getAttribute('i');
        const item = arr[index];
        if (item == null) {
          delete map[c.getAttribute('k')];
          c.remove();
        }
      });
      // sync data
      // TODO: The user could have re-ordered the array.
      // The current implementation always adds new items to the end.
      arr.forEach((_, i) => {
        const index = children[i]?.getAttribute('i');
        if (index == null) {
          const c = clone.cloneNode(true);
          this.#events.forEach(({event, target, fire}) => {
            this.#on(event, target, fire, c, true);
          });
          c.setAttribute('i', i);
          parent.append(c);
        }
      });
    });
  }

  #closest(el, attrName, attrValue, end = document.body) {
    let parent = el.parentNode;
    while (parent != null) {
      const stop = typeof end === 'string' ? parent.attributes && parent.hasAttribute(end) : end;
      if (parent === stop) {
        return;
      }
      if (attrValue == null) {
        if (parent.attributes && parent.hasAttribute(attrName)) {
          return parent;
        }
      } else if (parent.attributes && parent.getAttribute(attrName) === attrValue) {
        return parent;
      }
      parent = parent.parentNode;
    }
    return;
  }

  #generateUUID(uuids) {
    const uuid = Math.random().toString(36).substring(5);
    while (uuids.includes(uuid)) {
      return this.#generateUUID(uuids);
    }
    uuids.push(uuid);
    return uuid;
  }

  #on(event, target, fire, parent, silent = false) {
    const els = (parent ?? document).querySelectorAll(target);
    if (!els?.length || fire == null) {
      if (!silent) {
        console.error(`Praxy->on: No possible matches for "${target}" or no callback provided.`);
      }
    }

    els.forEach((el) => {
      if (!this.#events.find((ev) => ev.target === target)) {
        this.#events.push({event, target, fire});
      }

      el.addEventListener(event, async ({target}) => {
        let item = null;
        let cmptName = null;
        const loop = this.#closest(target, 'px-for');
        if (loop) {
          const k = loop.getAttribute('k');
          const [_, values] = loop.getAttribute('px-for')?.split(' in ');
          for (const [, value] of Object.entries(this.#components)) {
            if (value.fors[k] != null) {
              cmptName = value.name;
            }
          }
          const data = this.#components[cmptName]?.data;
          const i = this.#closest(target, 'i')?.getAttribute('i');
          item = data?.[values]?.[i];
        }
        await fire({
          target,
          item,
        });
      });
    });
  }
}

function html(...strings) {
  return strings.join('');
}

export {Praxy, html};