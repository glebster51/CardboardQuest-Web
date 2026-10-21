// Authored scene edits. Apply a pasted editor diff with tools/apply-scene-diff.mjs.
export const SCENE_OVERRIDES = {
  "version": 1,
  "fog": {
    "start": -2.2,
    "end": 10.9,
    "color": "#242039",
    "tint": 1,
    "curve": 2.1
  },
  "lighting": {
    "direction": [-5, 12, 7],
    "intensity": 3,
    "color": "#ffebcb"
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
