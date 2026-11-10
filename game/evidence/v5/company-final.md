## Confirmed blocker

**`src/render.js:13-17` + `draw()` decorative-bubble block** — the constructor initializes only `this.g` and `this.reduced`; it never creates `this.bubbles`. The draw path still executes:

```js
const count = this.reduced ? 10 : this.bubbles.length;
...
const b = this.bubbles[i];
```

- **Trigger:** first Cocos render/draw after boot, in either mode.
- **Impact:** deterministic `TypeError` (`this.bubbles` undefined; non-reduced fails at `.length`, reduced at `[i]`). Rendering/game loop cannot produce the intended scene; this is not visual-quality speculation.
- **Reachability:** no alternate definition of `this.bubbles` exists in the supplied complete `render.js`.

This is a source-level blocker. It conflicts with the supplied root browser pass—if that pass truly used this exact frozen file, the ZIP/source correspondence needs rechecking; I cannot reconcile the two.

**Verification limits:** I ran no tests/browser/commands; the finding is from the complete supplied source. No real-phone/Brave or full manual-8/8 claim is made.
