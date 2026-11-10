const path = require('node:path');
const root = path.resolve(__dirname, '..');
const fs = require('node:fs');
const engine = path.join(root, 'vendor/cocos-engine');
const { buildEngine } = require(path.join(engine, 'node_modules/@cocos/ccbuild'));
(async () => {
  process.chdir(engine);
  require(path.join(engine, 'scripts/build-debug-infos.js'));
  await buildEngine({engine, out:path.join(root,'engine'), mode:'BUILD',platform:'HTML5', moduleFormat:'esm', features:['base','gfx-webgl2','2d','graphics','legacy-pipeline'], compress:false, targets:{chrome:'90'}, sourceMap:false, flags:{DEBUG:true}, split:false});
  for (const name of ['builtin-effects', 'builtin-glsl4']) fs.copyFileSync(path.join(engine, 'tests/fixtures', name + '.ts'), path.join(root, 'engine', name + '.js'));
  fs.copyFileSync(path.join(engine, 'LICENSE.md'), path.join(root, 'vendor/COCOS-LICENSE.txt'));
})().catch(e=>{console.error(e); process.exitCode=1;});
