# Third-party software and artwork

- **Cocos Engine 3.8.7** — Xiamen Yaji Software Co., Ltd. and contributors, MIT. Fixed official commit `6a204c1b6ca1cbe8d090d622d8697c3398def153`. Full MIT notice: `vendor/COCOS-LICENSE.txt`. `engine/cc.js` is compiled from the unmodified official source by upstream `@cocos/ccbuild`; `engine/builtin-effects.js` and `engine/builtin-glsl4.js` are the corresponding official MIT test fixtures. The small project adapter changes their WebGL2 shader declarations in memory. Upstream source/license provenance and exact reproduction: `ENGINE-SOURCE.json`, `tools/bootstrap.mjs`, `tools/build-engine.cjs`. The actual base/graphics bundle includes adapted Earcut polygon triangulation, bit algorithms attributed to Mikola Lysenko, MurmurHash attributed to Gary Court/Austin Appleby, legacy Cocos copyright holders, and the Babel decorator helper. Relevant source notices and supplemental upstream ISC/MIT license texts are preserved in the checked-in **`vendor/runtime-notices/`**, and copied into **`dist/vendor/runtime-notices/`** by every release build. These are not hidden in the ignored source checkout. Earcut upstream notice is ISC (Mapbox), so MIT is not asserted over every part of the bundle. Native/editor, Spine, PhysX, DragonBones, FreeType and other optional modules are excluded; their source-tree presence after bootstrap is not a claim that they are shipped.
- **cannon-es 0.20.0** — Stefan Hedman, Paul Lewis, Jussi Kalliokoski, Dmitry Ulanov, and contributors, MIT. Locked npm dependency, browser runtime `vendor/cannon-es.js`, complete notice `vendor/CANNON-LICENSE`. Repository: <https://github.com/pmndrs/cannon-es>.

All game code, procedural toy/glass/ring/seabed graphics, UI, favicon, and synthesized audio were created for this project. No Steam screenshots, commercial models, fonts, music, extracted assets, or third-party game art are used in the playable build. The Steam reference is gameplay inspiration only. No remote CDN, analytics, account, advertisement, payment, or network API is used at runtime.

The project does not claim the Cocos Creator editor's license or redistributes its editor binaries. It is an independently bootstrapped game using the genuine open-source Cocos Engine 3.8.7 runtime. Cocos is a trademark of its respective owner; no affiliation is implied.

## Runtime notice provenance

The fixed Cocos source files `cocos/2d/assembler/graphics/webgl/earcut.ts`, `cocos/core/math/bits.ts`, `cocos/core/algorithm/murmurhash2_gc.ts` and `cocos/core/utils/js.ts` were inspected. Their leading copyright/license/author blocks are preserved in `vendor/runtime-notices/*-SOURCE-NOTICE.txt` / `COCOS-LEGACY-COPYRIGHTS.txt`. The compiled bundle contains the corresponding Earcut, bit and MurmurHash algorithms. Babel's `_applyDecoratedDescriptor` is also present; its installed build dependency's MIT notice is included as `BABEL-MIT.txt`.

Supplemental original attribution/license texts were obtained on 2026-11-10 from:

- Earcut ISC: <https://raw.githubusercontent.com/mapbox/earcut/v2.2.4/LICENSE>. This preserves upstream attribution; it is not a claim that Cocos's adapted source has an independently established Earcut version.
- Bit-twiddle MIT: <https://raw.githubusercontent.com/mikolalysenko/bit-twiddle/master/LICENSE>. The Cocos source explicitly attributes Mikola Lysenko.
- MurmurHash MIT: the `License (MIT)` section of <https://raw.githubusercontent.com/garycourt/murmurhash-js/master/README.md>. A separate `/LICENSE` URL returned 404; no license text was invented from that error.

Build-only npm tools remain in the ignored fixed-lockfile checkout and are not copied into the game release. The runtime notice inventory above records the inspected bundle/algorithm evidence; it is not a legal opinion or a guarantee about every upstream historical attribution.
