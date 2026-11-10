import * as cc from '../engine/cc.js?v=4ca47e03e619b998ee99';
import { effects } from '../engine/builtin-effects.js?v=4ca47e03e619b998ee99';
import { glsl4 } from '../engine/builtin-glsl4.js?v=4ca47e03e619b998ee99';
export { cc };
export async function boot() {
  cc.game.on(cc.Game.EVENT_POST_SUBSYSTEM_INIT, () => {
    effects.forEach((e, i) => {
      if (!['builtin-graphics', 'builtin-sprite', 'builtin-clear-stencil', 'builtin-unlit'].includes(e.name)) return;
      const effect = Object.assign(new cc.EffectAsset(), structuredClone(e));
      effect.shaders.forEach((s, j) => {
        const original = glsl4[i][j];
        const glsl3 = {};
        for (const stage of ['vert', 'frag']) glsl3[stage] = original[stage].replace(/layout\(set\s*=\s*\d+,\s*binding\s*=\s*\d+\)\s*(?=uniform\s+(?:[iu]?sampler|[iu]?image))/g, '').replace(/layout\(set\s*=\s*\d+,\s*binding\s*=\s*\d+\)/g, 'layout(std140)').replace(/layout\(location\s*=\s*\d+\)\s*/g, '');
        for (const stage of ['vert', 'frag']) glsl3[stage] = glsl3[stage].replace(/uniform CCGlobal \{[^}]*\};/g, 'uniform CCGlobal { vec4 cc_time; vec4 cc_screenSize; vec4 cc_nativeSize; vec4 cc_probeInfo; vec4 cc_debug_view_mode; };');
        s.glsl3 = glsl3;
      });
      effect.onLoaded();
    });
    for (const [name, effectName, defines] of [['ui-graphics-material', 'builtin-graphics', {}], ['ui-base-material', 'builtin-sprite', {
      USE_TEXTURE: false
    }], ['ui-sprite-material', 'builtin-sprite', {
      USE_TEXTURE: true
    }], ['default-clear-stencil', 'builtin-clear-stencil', {}], ['missing-material', 'builtin-unlit', {}]]) {
      const mat = new cc.Material();
      mat.initialize({
        effectName,
        defines
      });
      cc.builtinResMgr.addAsset(name, mat);
    }
  });
  await cc.game.init({
    debugMode: cc.DebugMode.INFO,
    overrideSettings: {
      rendering: {
        renderMode: 0,
        customPipeline: false
      },
      screen: {
        exactFitScreen: false,
        designResolution: {
          width: 420,
          height: 580,
          policy: 4
        }
      },
      splashScreen: {
        totalTime: 0
      },
      profiling: {
        showFPS: false
      }
    }
  });
  const scene = new cc.Scene('Water ring toy');
  const root = new cc.Node('Canvas');
  scene.addChild(root);
  root.layer = cc.Layers.Enum.UI_2D;
  root.addComponent(cc.UITransform).setContentSize(420, 580);
  root.setPosition(210, 290, 0);
  const canvas = root.addComponent(cc.Canvas);
  const cameraNode = new cc.Node('Camera');
  root.addChild(cameraNode);
  cameraNode.setPosition(0, 0, 1000);
  const camera = cameraNode.addComponent(cc.Camera);
  camera.projection = cc.Camera.ProjectionType.ORTHO;
  camera.orthoHeight = 290;
  camera.clearColor = new cc.Color(198, 237, 230, 255);
  camera.visibility = cc.Layers.Enum.UI_2D;
  canvas.cameraComponent = camera;
  const drawNode = new cc.Node('WaterGraphics');
  root.addChild(drawNode);
  drawNode.layer = cc.Layers.Enum.UI_2D;
  drawNode.setPosition(-210, -290);
  drawNode.addComponent(cc.UITransform).setContentSize(420, 580);
  const graphics = drawNode.addComponent(cc.Graphics);
  cc.director.runSceneImmediate(scene);
  cc.cclegacy.view.setDesignResolutionSize(420, 580, cc.cclegacy.ResolutionPolicy.EXACT_FIT);
  cc.cclegacy.view.resizeWithBrowserSize(true);
  cc.game.run();
  return {
    graphics,
    drawNode,
    scene,
    camera
  };
}
