// Authored scene edits. Saved by the local scene editor or tools/apply-scene-diff.mjs.
export const SCENE_OVERRIDES = {
  "version": 1,
  "fog": {
    "enabled": true,
    "revealEnabled": true,
    "start": 5.7,
    "end": 16.6,
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
    "direction": [
      -5,
      12,
      7
    ],
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
    "player": "#fee5c3",
    "enemy": "#6b5d57"
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
    },
    "camp": {
      "fog-paths": {
        "paths": [
          {
            "id": "arrival:moss-shrine",
            "points": [
              [
                0,
                -9.5
              ],
              [
                0,
                -7.125
              ],
              [
                0,
                -4.75
              ],
              [
                0,
                -2.375
              ],
              [
                0,
                0
              ]
            ]
          },
          {
            "id": "arrival:ash-road",
            "points": [
              [
                6.6155604110301365,
                8.291543531992403
              ],
              [
                5.214440421005054,
                5.321354777110251
              ],
              [
                3.335531732998876,
                4.283602296621616
              ],
              [
                1.0830203598864179,
                4.7725168431110205
              ],
              [
                0,
                0
              ]
            ],
            "radii": [
              0.779,
              1.033,
              1,
              1,
              1
            ]
          }
        ]
      },
      "scenery:assets/env-troll-hut.png:3": {
        "position": [
          -7.83317,
          0,
          6.09074
        ],
        "rotation": [
          0,
          -1.03364,
          0
        ],
        "scale": [
          1,
          1,
          1
        ]
      }
    }
  },
  "itemMagnet": {
    "radius": 2.7,
    "worldDuration": 0.93,
    "worldArc": 2.1,
    "iconDuration": 0.8,
    "iconArc": 283
  },
  "screenEffects": {
    "ssao": false,
    "tiltShift": true,
    "ssaoKernelRadius": 5,
    "ssaoMinDistance": 0.008,
    "ssaoMaxDistance": 0.12,
    "tiltShiftFocus": 0.48,
    "tiltShiftBlur": 12,
    "tiltShiftUpperGradientShift": 0,
    "tiltShiftLowerGradientShift": 0,
    "tiltShiftGradientMultiplier": 0.45,
    "tiltShiftShowGradient": false
  }
};
