// Authored scene edits. Apply a pasted editor diff with tools/apply-scene-diff.mjs.
export const SCENE_OVERRIDES = {
  "version": 1,
  "fog": {
    "start": -2.2,
    "end": 10.9,
    "color": "#242039",
    "tint": 1,
    "curve": 2.1,
    "revealInnerRadius": 85,
    "revealOuterRadius": 311,
    "revealNoiseEnabled": true,
    "revealNoiseType": "gaussian",
    "revealNoiseSize": 115,
    "revealNoiseShift": 1,
    "revealNoiseMultiply": 0.6,
    "revealNoiseSpeedX": 0.08,
    "revealNoiseSpeedY": 0.41,
    "revealCheckerSize": 1,
    "revealDepthFadeAdd": 0.8,
    "revealDepthFadeMultiply": 1.25
  },
  "lighting": {
    "direction": [-5, 12, 7],
    "intensity": 3,
    "color": "#ffebcb"
  },
  "terrainStyle": {
    "edgeColor": "#fff0c7",
    "edgeStrength": 0.38,
    "edgeWidth": 0.16,
    "baseColor": "#33271f",
    "baseStrength": 0.42,
    "baseWidth": 0.3
  },
  "unitPuckColors": {
    "player": "#d1e8ae",
    "enemy": "#e9a092"
  },
  "locations": {
    "home": {
      "arrival:forest": {
        "position": [
          7.5,
          0.2,
          24.90419
        ],
        "rotation": [
          0,
          -3.14159,
          0
        ],
        "scale": [
          1,
          1,
          1
        ]
      },
      "entry": {
        "position": [
          -2.6688,
          0.2,
          -1.93385
        ],
        "rotation": [
          0,
          0,
          0
        ],
        "scale": [
          1,
          1,
          1
        ]
      },
      "exit:forest:trigger": {
        "position": [
          7.5,
          0.3,
          37.96178
        ],
        "rotation": [
          0,
          0,
          0
        ],
        "scale": [
          6.9,
          0.6,
          2.75013
        ]
      },
      "scenery:assets/hero-house.png:1": {
        "position": [
          -2.57799,
          0,
          -6.09391
        ],
        "rotation": [
          0,
          3.14049,
          0
        ],
        "scale": [
          1,
          1,
          1
        ]
      }
    }
  }
};
