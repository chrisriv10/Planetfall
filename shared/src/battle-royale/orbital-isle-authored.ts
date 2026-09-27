import type { BrDistrictPlan, BrRoadSegment, BrStructure } from "./map.js";

/** Fixed, hand-authored connective-district roads. No runtime placement or nearest-road selection. */
export const AUTHORED_BR_SERVICE_ROADS = [
  {
    "id": "service-0",
    "from": {
      "x": -75,
      "y": 0.1,
      "z": -82
    },
    "to": {
      "x": -80.94128113879003,
      "y": 0.1,
      "z": -78.88790035587189
    },
    "width": 10,
    "color": "#263b57",
    "kind": "service"
  },
  {
    "id": "service-1",
    "from": {
      "x": 82,
      "y": 0.1,
      "z": -78
    },
    "to": {
      "x": 77.0730780969175,
      "y": 0.1,
      "z": -79.18010105463054
    },
    "width": 8,
    "color": "#263b57",
    "kind": "service"
  },
  {
    "id": "service-2",
    "from": {
      "x": -76,
      "y": 0.1,
      "z": -214
    },
    "to": {
      "x": -92,
      "y": 0.1,
      "z": -214
    },
    "width": 8,
    "color": "#263b57",
    "kind": "service"
  },
  {
    "id": "service-3",
    "from": {
      "x": -255,
      "y": 0.1,
      "z": -30
    },
    "to": {
      "x": -254,
      "y": 0.1,
      "z": -48
    },
    "width": 8,
    "color": "#263b57",
    "kind": "service"
  },
  {
    "id": "service-4",
    "from": {
      "x": -370,
      "y": 0.1,
      "z": 125
    },
    "to": {
      "x": -365,
      "y": 0.1,
      "z": 125
    },
    "width": 10,
    "color": "#263b57",
    "kind": "service"
  },
  {
    "id": "service-5",
    "from": {
      "x": -405,
      "y": 0.1,
      "z": 15
    },
    "to": {
      "x": -430,
      "y": 0.1,
      "z": 15
    },
    "width": 8,
    "color": "#263b57",
    "kind": "service"
  },
  {
    "id": "service-6",
    "from": {
      "x": -405,
      "y": 0.1,
      "z": -125
    },
    "to": {
      "x": -424.17113546281183,
      "y": 0.1,
      "z": -127.35952436465377
    },
    "width": 8,
    "color": "#263b57",
    "kind": "service"
  },
  {
    "id": "service-7",
    "from": {
      "x": -315,
      "y": 0.1,
      "z": -335
    },
    "to": {
      "x": -315,
      "y": 0.1,
      "z": -325
    },
    "width": 8,
    "color": "#263b57",
    "kind": "service"
  },
  {
    "id": "service-8",
    "from": {
      "x": -160,
      "y": 0.1,
      "z": -420
    },
    "to": {
      "x": -160,
      "y": 0.1,
      "z": -340
    },
    "width": 10,
    "color": "#263b57",
    "kind": "service"
  },
  {
    "id": "service-9",
    "from": {
      "x": 15,
      "y": 0.1,
      "z": -415
    },
    "to": {
      "x": 15,
      "y": 0.1,
      "z": -340
    },
    "width": 8,
    "color": "#263b57",
    "kind": "service"
  },
  {
    "id": "service-10",
    "from": {
      "x": 95,
      "y": 0.1,
      "z": -285
    },
    "to": {
      "x": 112,
      "y": 0.1,
      "z": -285
    },
    "width": 8,
    "color": "#263b57",
    "kind": "service"
  },
  {
    "id": "service-11",
    "from": {
      "x": 285,
      "y": 0.1,
      "z": -275
    },
    "to": {
      "x": 275,
      "y": 0.1,
      "z": -225
    },
    "width": 8,
    "color": "#263b57",
    "kind": "service"
  },
  {
    "id": "service-12",
    "from": {
      "x": 405,
      "y": 0.1,
      "z": -180
    },
    "to": {
      "x": 405,
      "y": 0.1,
      "z": -130
    },
    "width": 10,
    "color": "#263b57",
    "kind": "service"
  },
  {
    "id": "service-13",
    "from": {
      "x": 355,
      "y": 0.1,
      "z": 255
    },
    "to": {
      "x": 309.30248943165805,
      "y": 0.1,
      "z": 175.5260685767966
    },
    "width": 4,
    "color": "#263b57",
    "kind": "service"
  },
  {
    "id": "service-14",
    "from": {
      "x": 375,
      "y": 0.1,
      "z": 135
    },
    "to": {
      "x": 345,
      "y": 0.1,
      "z": 135
    },
    "width": 8,
    "color": "#263b57",
    "kind": "service"
  },
  {
    "id": "service-15",
    "from": {
      "x": 305,
      "y": 0.1,
      "z": 220
    },
    "to": {
      "x": 286.8506341005167,
      "y": 0.1,
      "z": 188.43588539220292
    },
    "width": 8,
    "color": "#263b57",
    "kind": "service"
  },
  {
    "id": "service-16",
    "from": {
      "x": 280,
      "y": 0.1,
      "z": 330
    },
    "to": {
      "x": 225,
      "y": 0.1,
      "z": 330
    },
    "width": 10,
    "color": "#263b57",
    "kind": "service"
  },
  {
    "id": "service-17",
    "from": {
      "x": 75,
      "y": 0.1,
      "z": 415
    },
    "to": {
      "x": 76.64127489661075,
      "y": 0.1,
      "z": 366.9340923135428
    },
    "width": 8,
    "color": "#263b57",
    "kind": "service"
  },
  {
    "id": "service-18",
    "from": {
      "x": -45,
      "y": 0.1,
      "z": 405
    },
    "to": {
      "x": -43.56003707753007,
      "y": 0.1,
      "z": 362.82965727052334
    },
    "width": 8,
    "color": "#263b57",
    "kind": "service"
  },
  {
    "id": "service-19",
    "from": {
      "x": -205,
      "y": 0.1,
      "z": 365
    },
    "to": {
      "x": -202.27175387251054,
      "y": 0.1,
      "z": 353.79470340495396
    },
    "width": 8,
    "color": "#263b57",
    "kind": "service"
  },
  {
    "id": "service-20",
    "from": {
      "x": -265,
      "y": 0.1,
      "z": 235
    },
    "to": {
      "x": -188.06092553012655,
      "y": 0.1,
      "z": 233.11423837083643
    },
    "width": 10,
    "color": "#263b57",
    "kind": "service"
  },
  {
    "id": "service-21",
    "from": {
      "x": -400,
      "y": 0.1,
      "z": 150
    },
    "to": {
      "x": -422.92452830188677,
      "y": 0.1,
      "z": 162.73584905660377
    },
    "width": 8,
    "color": "#263b57",
    "kind": "service"
  },
  {
    "id": "service-22",
    "from": {
      "x": 80,
      "y": 0.1,
      "z": 180
    },
    "to": {
      "x": 80,
      "y": 0.1,
      "z": 220
    },
    "width": 8,
    "color": "#263b57",
    "kind": "service"
  },
  {
    "id": "service-23",
    "from": {
      "x": -145,
      "y": 0.1,
      "z": 85
    },
    "to": {
      "x": -164.0773067331671,
      "y": 0.1,
      "z": 78.45386533665835
    },
    "width": 8,
    "color": "#263b57",
    "kind": "service"
  },
  {
    "id": "service-24",
    "from": {
      "x": 190,
      "y": 0.1,
      "z": -400
    },
    "to": {
      "x": 112,
      "y": 0.1,
      "z": -340
    },
    "width": 10,
    "color": "#263b57",
    "kind": "service"
  },
  {
    "id": "service-25",
    "from": {
      "x": 330,
      "y": 0.1,
      "z": -315
    },
    "to": {
      "x": 275,
      "y": 0.1,
      "z": -225
    },
    "width": 8,
    "color": "#263b57",
    "kind": "service"
  },
  {
    "id": "service-26",
    "from": {
      "x": -250,
      "y": 0.1,
      "z": 365
    },
    "to": {
      "x": -244.75337283175102,
      "y": 0.1,
      "z": 343.45135270183454
    },
    "width": 8,
    "color": "#263b57",
    "kind": "service"
  },
  {
    "id": "service-27",
    "from": {
      "x": -385,
      "y": 0.1,
      "z": -205
    },
    "to": {
      "x": -385,
      "y": 0.1,
      "z": -195
    },
    "width": 8,
    "color": "#263b57",
    "kind": "service"
  },
  {
    "id": "service-28",
    "from": {
      "x": 405,
      "y": 0.1,
      "z": 105
    },
    "to": {
      "x": 345,
      "y": 0.1,
      "z": 105
    },
    "width": 10,
    "color": "#263b57",
    "kind": "service"
  },
  {
    "id": "service-29",
    "from": {
      "x": -360,
      "y": 0.1,
      "z": 310
    },
    "to": {
      "x": -336.41379310344826,
      "y": 0.1,
      "z": 289.0344827586207
    },
    "width": 8,
    "color": "#263b57",
    "kind": "service"
  }
] as const satisfies readonly BrRoadSegment[];

/** Fixed street, parcel, courtyard, and elevation plan for every secondary district. */
export const AUTHORED_BR_DISTRICT_PLANS = [
  {
    "id": "central-heights",
    "origin": {
      "x": -75,
      "y": 0,
      "z": -82
    },
    "elevation": 0,
    "kind": "neighborhood",
    "approach": {
      "x": -0.8858315352801556,
      "y": 0,
      "z": 0.46400699467055706
    },
    "streets": [
      {
        "id": "local-central-heights-approach",
        "from": {
          "x": -75,
          "y": 0.1,
          "z": -82
        },
        "to": {
          "x": -85.79870823960567,
          "y": 0.1,
          "z": -132.78767468939557
        },
        "width": 7,
        "color": "#304761",
        "kind": "local"
      },
      {
        "id": "local-central-heights",
        "from": {
          "x": -68.1664424421245,
          "y": 0.1,
          "z": -99.12607634874966
        },
        "to": {
          "x": -103.43097403708684,
          "y": 0.1,
          "z": -166.44927303004147
        },
        "width": 7,
        "color": "#304761",
        "kind": "local",
        "intentionalTerminus": true
      }
    ],
    "parcels": [
      {
        "id": "central-heights-parcel-1",
        "position": {
          "x": -59.36929164771133,
          "y": 0,
          "z": -131.89973403141238
        },
        "entrance": "south",
        "role": "anchor"
      },
      {
        "id": "central-heights-parcel-2",
        "position": {
          "x": -71.47987420861287,
          "y": 0,
          "z": -155.01993710222442
        },
        "entrance": "north",
        "role": "support"
      },
      {
        "id": "central-heights-parcel-3",
        "position": {
          "x": -112,
          "y": 0,
          "z": -85
        },
        "entrance": "north",
        "role": "service"
      }
    ],
    "openZone": {
      "position": {
        "x": -101.00337380587864,
        "y": 0,
        "z": -110.09140528189619
      },
      "radius": 12,
      "purpose": "courtyard"
    }
  },
  {
    "id": "relay-market",
    "origin": {
      "x": 82,
      "y": 0,
      "z": -78
    },
    "elevation": 0,
    "kind": "commercial",
    "approach": {
      "x": -0.9724929204096405,
      "y": 0,
      "z": -0.23293243602626149
    },
    "streets": [
      {
        "id": "local-relay-market-approach",
        "from": {
          "x": 82,
          "y": 0.1,
          "z": -78
        },
        "to": {
          "x": 122.70494319558914,
          "y": 0.1,
          "z": -33.28861890475915
        },
        "width": 8,
        "color": "#304761",
        "kind": "local"
      },
      {
        "id": "local-relay-market",
        "from": {
          "x": 113.38764575453868,
          "y": 0.1,
          "z": 5.611097911626473
        },
        "to": {
          "x": 132.0222406366396,
          "y": 0.1,
          "z": -72.18833572114477
        },
        "width": 8,
        "color": "#304761",
        "kind": "local",
        "intentionalTerminus": true
      }
    ],
    "parcels": [
      {
        "id": "relay-market-parcel-1",
        "position": {
          "x": 141.92769247865633,
          "y": 0,
          "z": -14.802518450624987
        },
        "entrance": "south",
        "role": "anchor"
      },
      {
        "id": "relay-market-parcel-2",
        "position": {
          "x": 148.21686825136538,
          "y": 0,
          "z": -41.059827301685274
        },
        "entrance": "north",
        "role": "support"
      },
      {
        "id": "relay-market-parcel-3",
        "position": {
          "x": 94.27553937858394,
          "y": 0,
          "z": -26.2162078159118
        },
        "entrance": "south",
        "role": "service"
      }
    ],
    "openZone": {
      "position": {
        "x": 100.564715151293,
        "y": 0,
        "z": -52.47351666697209
      },
      "radius": 12,
      "purpose": "courtyard"
    }
  },
  {
    "id": "comet-hotel",
    "origin": {
      "x": -76,
      "y": 0,
      "z": -214
    },
    "elevation": 0,
    "kind": "commercial",
    "approach": {
      "x": -1,
      "y": 0,
      "z": 0
    },
    "streets": [
      {
        "id": "local-comet-hotel-approach",
        "from": {
          "x": -76,
          "y": 0.1,
          "z": -214
        },
        "to": {
          "x": -90,
          "y": 0.1,
          "z": -282
        },
        "width": 8,
        "color": "#304761",
        "kind": "local"
      },
      {
        "id": "local-comet-hotel",
        "from": {
          "x": -90,
          "y": 0.1,
          "z": -242
        },
        "to": {
          "x": -90,
          "y": 0.1,
          "z": -322
        },
        "width": 8,
        "color": "#304761",
        "kind": "local",
        "intentionalTerminus": true
      }
    ],
    "parcels": [
      {
        "id": "comet-hotel-parcel-1",
        "position": {
          "x": -67,
          "y": 0,
          "z": -268.5
        },
        "entrance": "south",
        "role": "anchor"
      },
      {
        "id": "comet-hotel-parcel-2",
        "position": {
          "x": -67,
          "y": 0,
          "z": -295.5
        },
        "entrance": "north",
        "role": "support"
      },
      {
        "id": "comet-hotel-parcel-3",
        "position": {
          "x": -116,
          "y": 0,
          "z": -268.5
        },
        "entrance": "south",
        "role": "service"
      }
    ],
    "openZone": {
      "position": {
        "x": -116,
        "y": 0,
        "z": -295.5
      },
      "radius": 12,
      "purpose": "courtyard"
    }
  },
  {
    "id": "horizon-homes",
    "origin": {
      "x": -255,
      "y": 0,
      "z": -30
    },
    "elevation": 0,
    "kind": "neighborhood",
    "approach": {
      "x": 0.05547001962252291,
      "y": 0,
      "z": -0.9984603532054125
    },
    "streets": [
      {
        "id": "local-horizon-homes-approach",
        "from": {
          "x": -255,
          "y": 0.1,
          "z": -30
        },
        "to": {
          "x": -204.30040206501405,
          "y": 0.1,
          "z": -41.20494396374963
        },
        "width": 7,
        "color": "#304761",
        "kind": "local"
      },
      {
        "id": "local-horizon-homes",
        "from": {
          "x": -242.24189548681971,
          "y": 0.1,
          "z": -43.3128047094055
        },
        "to": {
          "x": -166.3589086432084,
          "y": 0.1,
          "z": -39.09708321809376
        },
        "width": 7,
        "color": "#304761",
        "kind": "local",
        "intentionalTerminus": true
      }
    ],
    "parcels": [
      {
        "id": "horizon-homes-parcel-1",
        "position": {
          "x": -218.6061201256627,
          "y": 0,
          "z": -18.964239596099063
        },
        "entrance": "east",
        "role": "anchor"
      },
      {
        "id": "horizon-homes-parcel-2",
        "position": {
          "x": -192.54630490700146,
          "y": 0,
          "z": -17.516472083951218
        },
        "entrance": "west",
        "role": "support"
      },
      {
        "id": "horizon-homes-parcel-3",
        "position": {
          "x": -189.93921398474288,
          "y": 0,
          "z": -64.44410868460561
        },
        "entrance": "west",
        "role": "service"
      }
    ],
    "openZone": {
      "position": {
        "x": -215.99902920340412,
        "y": 0,
        "z": -65.89187619675346
      },
      "radius": 12,
      "purpose": "courtyard"
    }
  },
  {
    "id": "academy-dorms",
    "origin": {
      "x": -370,
      "y": 0,
      "z": 125
    },
    "elevation": 0,
    "kind": "campus",
    "approach": {
      "x": 1,
      "y": 0,
      "z": 0
    },
    "streets": [
      {
        "id": "local-academy-dorms-approach",
        "from": {
          "x": -370,
          "y": 0.1,
          "z": 125
        },
        "to": {
          "x": -368,
          "y": 0.1,
          "z": 91
        },
        "width": 8,
        "color": "#304761",
        "kind": "local"
      },
      {
        "id": "local-academy-dorms",
        "from": {
          "x": -368,
          "y": 0.1,
          "z": 49
        },
        "to": {
          "x": -368,
          "y": 0.1,
          "z": 133
        },
        "width": 8,
        "color": "#304761",
        "kind": "local",
        "intentionalTerminus": true
      }
    ],
    "parcels": [
      {
        "id": "academy-dorms-parcel-1",
        "position": {
          "x": -391,
          "y": 0,
          "z": 77.05
        },
        "entrance": "north",
        "role": "anchor"
      },
      {
        "id": "academy-dorms-parcel-2",
        "position": {
          "x": -391,
          "y": 0,
          "z": 104.95
        },
        "entrance": "south",
        "role": "support"
      },
      {
        "id": "academy-dorms-parcel-3",
        "position": {
          "x": -342,
          "y": 0,
          "z": 77.05
        },
        "entrance": "north",
        "role": "service"
      }
    ],
    "openZone": {
      "position": {
        "x": -342,
        "y": 0,
        "z": 104.95
      },
      "radius": 12,
      "purpose": "garden"
    }
  },
  {
    "id": "west-overlook",
    "origin": {
      "x": -405,
      "y": 0,
      "z": 15
    },
    "elevation": 0,
    "kind": "civic",
    "approach": {
      "x": -1,
      "y": 0,
      "z": 0
    },
    "streets": [
      {
        "id": "local-west-overlook-approach",
        "from": {
          "x": -405,
          "y": 0.1,
          "z": 15
        },
        "to": {
          "x": -374,
          "y": 0.1,
          "z": -35
        },
        "width": 8,
        "color": "#304761",
        "kind": "local"
      },
      {
        "id": "local-west-overlook",
        "from": {
          "x": -374,
          "y": 0.1,
          "z": 5
        },
        "to": {
          "x": -374,
          "y": 0.1,
          "z": -75
        },
        "width": 8,
        "color": "#304761",
        "kind": "local",
        "intentionalTerminus": true
      }
    ],
    "parcels": [
      {
        "id": "west-overlook-parcel-1",
        "position": {
          "x": -351,
          "y": 0,
          "z": -21.049999999999997
        },
        "entrance": "south",
        "role": "anchor"
      },
      {
        "id": "west-overlook-parcel-2",
        "position": {
          "x": -351,
          "y": 0,
          "z": -48.95
        },
        "entrance": "north",
        "role": "support"
      },
      {
        "id": "west-overlook-parcel-3",
        "position": {
          "x": -400,
          "y": 0,
          "z": -48.95
        },
        "entrance": "north",
        "role": "service"
      }
    ],
    "openZone": {
      "position": {
        "x": -400,
        "y": 0,
        "z": -21.049999999999997
      },
      "radius": 12,
      "purpose": "courtyard"
    }
  },
  {
    "id": "signal-station",
    "origin": {
      "x": -405,
      "y": 0,
      "z": -125
    },
    "elevation": 0,
    "kind": "workyard",
    "approach": {
      "x": -0.9925110109136314,
      "y": 0,
      "z": -0.12215520134321622
    },
    "streets": [
      {
        "id": "local-signal-station-approach",
        "from": {
          "x": -405,
          "y": 0.1,
          "z": -125
        },
        "to": {
          "x": -378.20220270533196,
          "y": 0.1,
          "z": -121.70180956373316
        },
        "width": 9,
        "color": "#26364d",
        "kind": "local"
      },
      {
        "id": "local-signal-station",
        "from": {
          "x": -383.8213419671199,
          "y": 0.1,
          "z": -76.04630306170611
        },
        "to": {
          "x": -372.583063443544,
          "y": 0.1,
          "z": -167.35731606576022
        },
        "width": 9,
        "color": "#26364d",
        "kind": "local",
        "intentionalTerminus": true
      }
    ],
    "parcels": [
      {
        "id": "signal-station-parcel-1",
        "position": {
          "x": -357.2983938754741,
          "y": 0,
          "z": -103.2601915109495
        },
        "entrance": "south",
        "role": "anchor"
      },
      {
        "id": "signal-station-parcel-2",
        "position": {
          "x": -353.45050503316276,
          "y": 0,
          "z": -134.5242883547289
        },
        "entrance": "north",
        "role": "support"
      },
      {
        "id": "signal-station-parcel-3",
        "position": {
          "x": -407.9164554320693,
          "y": 0,
          "z": -109.49010677945353
        },
        "entrance": "south",
        "role": "service"
      }
    ],
    "openZone": {
      "position": {
        "x": -404.06856658975795,
        "y": 0,
        "z": -140.7542036232329
      },
      "radius": 15,
      "purpose": "yard"
    }
  },
  {
    "id": "salvage-row",
    "origin": {
      "x": -315,
      "y": 0,
      "z": -335
    },
    "elevation": 0,
    "kind": "salvage",
    "approach": {
      "x": 0,
      "y": 0,
      "z": 1
    },
    "streets": [
      {
        "id": "local-salvage-row-approach",
        "from": {
          "x": -315,
          "y": 0.1,
          "z": -335
        },
        "to": {
          "x": -247,
          "y": 0.1,
          "z": -345
        },
        "width": 8,
        "color": "#26364d",
        "kind": "local"
      },
      {
        "id": "local-salvage-row",
        "from": {
          "x": -203,
          "y": 0.1,
          "z": -345
        },
        "to": {
          "x": -291,
          "y": 0.1,
          "z": -345
        },
        "width": 8,
        "color": "#26364d",
        "kind": "local",
        "intentionalTerminus": true
      }
    ],
    "parcels": [
      {
        "id": "salvage-row-parcel-1",
        "position": {
          "x": -231.7,
          "y": 0,
          "z": -368
        },
        "entrance": "west",
        "role": "anchor"
      },
      {
        "id": "salvage-row-parcel-2",
        "position": {
          "x": -262.3,
          "y": 0,
          "z": -368
        },
        "entrance": "east",
        "role": "support"
      },
      {
        "id": "salvage-row-parcel-3",
        "position": {
          "x": -231.7,
          "y": 0,
          "z": -318
        },
        "entrance": "west",
        "role": "service"
      }
    ],
    "openZone": {
      "position": {
        "x": -262.3,
        "y": 0,
        "z": -318
      },
      "radius": 12,
      "purpose": "salvage"
    }
  },
  {
    "id": "emergency-depot",
    "origin": {
      "x": -160,
      "y": 0,
      "z": -420
    },
    "elevation": 0,
    "kind": "salvage",
    "approach": {
      "x": 0,
      "y": 0,
      "z": 1
    },
    "streets": [
      {
        "id": "local-emergency-depot-approach",
        "from": {
          "x": -160,
          "y": 0.1,
          "z": -420
        },
        "to": {
          "x": -92,
          "y": 0.1,
          "z": -402
        },
        "width": 8,
        "color": "#26364d",
        "kind": "local"
      },
      {
        "id": "local-emergency-depot",
        "from": {
          "x": -48,
          "y": 0.1,
          "z": -402
        },
        "to": {
          "x": -136,
          "y": 0.1,
          "z": -402
        },
        "width": 8,
        "color": "#26364d",
        "kind": "local",
        "intentionalTerminus": true
      }
    ],
    "parcels": [
      {
        "id": "emergency-depot-parcel-1",
        "position": {
          "x": -76.7,
          "y": 0,
          "z": -425
        },
        "entrance": "west",
        "role": "anchor"
      },
      {
        "id": "emergency-depot-parcel-2",
        "position": {
          "x": -107.3,
          "y": 0,
          "z": -425
        },
        "entrance": "east",
        "role": "support"
      },
      {
        "id": "emergency-depot-parcel-3",
        "position": {
          "x": -76.7,
          "y": 0,
          "z": -375
        },
        "entrance": "west",
        "role": "service"
      }
    ],
    "openZone": {
      "position": {
        "x": -107.3,
        "y": 0,
        "z": -375
      },
      "radius": 12,
      "purpose": "salvage"
    }
  },
  {
    "id": "south-terminal",
    "origin": {
      "x": 15,
      "y": 0,
      "z": -415
    },
    "elevation": 0,
    "kind": "civic",
    "approach": {
      "x": 0,
      "y": 0,
      "z": 1
    },
    "streets": [
      {
        "id": "local-south-terminal-approach",
        "from": {
          "x": 15,
          "y": 0.1,
          "z": -415
        },
        "to": {
          "x": 15,
          "y": 0.1,
          "z": -384
        },
        "width": 8,
        "color": "#304761",
        "kind": "local"
      },
      {
        "id": "local-south-terminal",
        "from": {
          "x": 55,
          "y": 0.1,
          "z": -384
        },
        "to": {
          "x": -25,
          "y": 0.1,
          "z": -384
        },
        "width": 8,
        "color": "#304761",
        "kind": "local",
        "intentionalTerminus": true
      }
    ],
    "parcels": [
      {
        "id": "south-terminal-parcel-1",
        "position": {
          "x": 32.05,
          "y": 0,
          "z": -407
        },
        "entrance": "west",
        "role": "anchor"
      },
      {
        "id": "south-terminal-parcel-2",
        "position": {
          "x": -2.0500000000000007,
          "y": 0,
          "z": -407
        },
        "entrance": "east",
        "role": "support"
      },
      {
        "id": "south-terminal-parcel-3",
        "position": {
          "x": -2.0500000000000007,
          "y": 0,
          "z": -358
        },
        "entrance": "east",
        "role": "service"
      }
    ],
    "openZone": {
      "position": {
        "x": 32.05,
        "y": 0,
        "z": -358
      },
      "radius": 12,
      "purpose": "courtyard"
    }
  },
  {
    "id": "cargo-spur",
    "origin": {
      "x": 95,
      "y": 0,
      "z": -285
    },
    "elevation": 0,
    "kind": "workyard",
    "approach": {
      "x": 1,
      "y": 0,
      "z": 0
    },
    "streets": [
      {
        "id": "local-cargo-spur-approach",
        "from": {
          "x": 95,
          "y": 0.1,
          "z": -285
        },
        "to": {
          "x": 164,
          "y": 0.1,
          "z": -285
        },
        "width": 9,
        "color": "#26364d",
        "kind": "local"
      },
      {
        "id": "local-cargo-spur",
        "from": {
          "x": 164,
          "y": 0.1,
          "z": -331
        },
        "to": {
          "x": 164,
          "y": 0.1,
          "z": -239
        },
        "width": 9,
        "color": "#26364d",
        "kind": "local",
        "intentionalTerminus": true
      }
    ],
    "parcels": [
      {
        "id": "cargo-spur-parcel-1",
        "position": {
          "x": 141,
          "y": 0,
          "z": -304.25
        },
        "entrance": "north",
        "role": "anchor"
      },
      {
        "id": "cargo-spur-parcel-2",
        "position": {
          "x": 141,
          "y": 0,
          "z": -265.75
        },
        "entrance": "south",
        "role": "support"
      },
      {
        "id": "cargo-spur-parcel-3",
        "position": {
          "x": 192,
          "y": 0,
          "z": -304.25
        },
        "entrance": "north",
        "role": "service"
      }
    ],
    "openZone": {
      "position": {
        "x": 192,
        "y": 0,
        "z": -265.75
      },
      "radius": 15,
      "purpose": "yard"
    }
  },
  {
    "id": "dock-service",
    "origin": {
      "x": 285,
      "y": 0,
      "z": -275
    },
    "elevation": 0,
    "kind": "workyard",
    "approach": {
      "x": -0.19611613513818404,
      "y": 0,
      "z": 0.9805806756909201
    },
    "streets": [
      {
        "id": "local-dock-service-approach",
        "from": {
          "x": 285,
          "y": 0.1,
          "z": -275
        },
        "to": {
          "x": 295.7863874326001,
          "y": 0.1,
          "z": -237.1495859183305
        },
        "width": 9,
        "color": "#26364d",
        "kind": "local"
      },
      {
        "id": "local-dock-service",
        "from": {
          "x": 340.8930985143825,
          "y": 0.1,
          "z": -228.12824370197404
        },
        "to": {
          "x": 250.6796763508178,
          "y": 0.1,
          "z": -246.17092813468696
        },
        "width": 9,
        "color": "#26364d",
        "kind": "local",
        "intentionalTerminus": true
      }
    ],
    "parcels": [
      {
        "id": "dock-service-parcel-1",
        "position": {
          "x": 334.61738218996055,
          "y": 0,
          "z": -252.8388767293852
        },
        "entrance": "west",
        "role": "anchor"
      },
      {
        "id": "dock-service-parcel-2",
        "position": {
          "x": 265.97673489159615,
          "y": 0,
          "z": -266.5670061890581
        },
        "entrance": "east",
        "role": "support"
      },
      {
        "id": "dock-service-parcel-3",
        "position": {
          "x": 324.61545929791316,
          "y": 0,
          "z": -202.82926226914827
        },
        "entrance": "west",
        "role": "service"
      }
    ],
    "openZone": {
      "position": {
        "x": 255.97481199954876,
        "y": 0,
        "z": -216.55739172882116
      },
      "radius": 15,
      "purpose": "yard"
    }
  },
  {
    "id": "engine-gate",
    "origin": {
      "x": 405,
      "y": 0,
      "z": -180
    },
    "elevation": 0,
    "kind": "workyard",
    "approach": {
      "x": 0,
      "y": 0,
      "z": 1
    },
    "streets": [
      {
        "id": "local-engine-gate-approach",
        "from": {
          "x": 405,
          "y": 0.1,
          "z": -180
        },
        "to": {
          "x": 387,
          "y": 0.1,
          "z": -127
        },
        "width": 9,
        "color": "#26364d",
        "kind": "local"
      },
      {
        "id": "local-engine-gate",
        "from": {
          "x": 433,
          "y": 0.1,
          "z": -127
        },
        "to": {
          "x": 341,
          "y": 0.1,
          "z": -127
        },
        "width": 9,
        "color": "#26364d",
        "kind": "local",
        "intentionalTerminus": true
      }
    ],
    "parcels": [
      {
        "id": "engine-gate-parcel-1",
        "position": {
          "x": 422,
          "y": 0,
          "z": -150
        },
        "entrance": "west",
        "role": "anchor"
      },
      {
        "id": "engine-gate-parcel-2",
        "position": {
          "x": 352,
          "y": 0,
          "z": -150
        },
        "entrance": "east",
        "role": "support"
      },
      {
        "id": "engine-gate-parcel-3",
        "position": {
          "x": 352,
          "y": 0,
          "z": -99
        },
        "entrance": "east",
        "role": "service"
      }
    ],
    "openZone": {
      "position": {
        "x": 422,
        "y": 0,
        "z": -99
      },
      "radius": 15,
      "purpose": "yard"
    }
  },
  {
    "id": "east-checkpoint",
    "origin": {
      "x": 355,
      "y": 0,
      "z": 255
    },
    "elevation": 0,
    "kind": "workyard",
    "approach": {
      "x": -0.49847112425808277,
      "y": 0,
      "z": -0.8669063030575352
    },
    "streets": [
      {
        "id": "local-east-checkpoint-approach",
        "from": {
          "x": 355,
          "y": 0.1,
          "z": 255
        },
        "to": {
          "x": 330.42320630831887,
          "y": 0.1,
          "z": 248.36816678160986
        },
        "width": 9,
        "color": "#26364d",
        "kind": "local"
      },
      {
        "id": "local-east-checkpoint",
        "from": {
          "x": 304.4160172165928,
          "y": 0.1,
          "z": 263.3223005093523
        },
        "to": {
          "x": 356.4303954000449,
          "y": 0.1,
          "z": 233.41403305386737
        },
        "width": 9,
        "color": "#26364d",
        "kind": "local",
        "intentionalTerminus": true
      }
    ],
    "parcels": [
      {
        "id": "east-checkpoint-parcel-1",
        "position": {
          "x": 309.46574643190297,
          "y": 0,
          "z": 286.94983179918546
        },
        "entrance": "east",
        "role": "anchor"
      },
      {
        "id": "east-checkpoint-parcel-2",
        "position": {
          "x": 374.3103379006066,
          "y": 0,
          "z": 249.66419170468086
        },
        "entrance": "west",
        "role": "support"
      },
      {
        "id": "east-checkpoint-parcel-3",
        "position": {
          "x": 354.86996405454136,
          "y": 0,
          "z": 215.854845885437
        },
        "entrance": "west",
        "role": "service"
      }
    ],
    "openZone": {
      "position": {
        "x": 290.0253725858377,
        "y": 0,
        "z": 253.1404859799416
      },
      "radius": 10,
      "purpose": "yard"
    }
  },
  {
    "id": "helios-relay",
    "origin": {
      "x": 375,
      "y": 0,
      "z": 135
    },
    "elevation": 0,
    "kind": "workyard",
    "approach": {
      "x": -1,
      "y": 0,
      "z": 0
    },
    "streets": [
      {
        "id": "local-helios-relay-approach",
        "from": {
          "x": 375,
          "y": 0.1,
          "z": 135
        },
        "to": {
          "x": 356,
          "y": 0.1,
          "z": 117
        },
        "width": 9,
        "color": "#26364d",
        "kind": "local"
      },
      {
        "id": "local-helios-relay",
        "from": {
          "x": 356,
          "y": 0.1,
          "z": 163
        },
        "to": {
          "x": 356,
          "y": 0.1,
          "z": 71
        },
        "width": 9,
        "color": "#26364d",
        "kind": "local",
        "intentionalTerminus": true
      }
    ],
    "parcels": [
      {
        "id": "helios-relay-parcel-1",
        "position": {
          "x": 379,
          "y": 0,
          "z": 152
        },
        "entrance": "south",
        "role": "anchor"
      },
      {
        "id": "helios-relay-parcel-2",
        "position": {
          "x": 379,
          "y": 0,
          "z": 82
        },
        "entrance": "north",
        "role": "support"
      },
      {
        "id": "helios-relay-parcel-3",
        "position": {
          "x": 328,
          "y": 0,
          "z": 82
        },
        "entrance": "north",
        "role": "service"
      }
    ],
    "openZone": {
      "position": {
        "x": 328,
        "y": 0,
        "z": 152
      },
      "radius": 15,
      "purpose": "yard"
    }
  },
  {
    "id": "orbital-overlook",
    "origin": {
      "x": 305,
      "y": 0,
      "z": 220
    },
    "elevation": 0,
    "kind": "civic",
    "approach": {
      "x": -0.4984711242580826,
      "y": 0,
      "z": -0.8669063030575352
    },
    "streets": [
      {
        "id": "local-orbital-overlook-approach",
        "from": {
          "x": 305,
          "y": 0.1,
          "z": 220
        },
        "to": {
          "x": 252.53049600744268,
          "y": 0.1,
          "z": 265.16581838929756
        },
        "width": 8,
        "color": "#304761",
        "kind": "local"
      },
      {
        "id": "local-orbital-overlook",
        "from": {
          "x": 217.85424388514127,
          "y": 0.1,
          "z": 285.1046633596209
        },
        "to": {
          "x": 287.2067481297441,
          "y": 0.1,
          "z": 245.22697341897424
        },
        "width": 8,
        "color": "#304761",
        "kind": "local",
        "intentionalTerminus": true
      }
    ],
    "parcels": [
      {
        "id": "orbital-overlook-parcel-1",
        "position": {
          "x": 251.90198893772595,
          "y": 0,
          "z": 292.05833554302114
        },
        "entrance": "east",
        "role": "anchor"
      },
      {
        "id": "orbital-overlook-parcel-2",
        "position": {
          "x": 276.0886747930312,
          "y": 0,
          "z": 278.15099117622066
        },
        "entrance": "west",
        "role": "support"
      },
      {
        "id": "orbital-overlook-parcel-3",
        "position": {
          "x": 251.66358970438515,
          "y": 0,
          "z": 235.6725823264014
        },
        "entrance": "west",
        "role": "service"
      }
    ],
    "openZone": {
      "position": {
        "x": 227.47690384907992,
        "y": 0,
        "z": 249.5799266932019
      },
      "radius": 12,
      "purpose": "courtyard"
    }
  },
  {
    "id": "farm-service",
    "origin": {
      "x": 280,
      "y": 0,
      "z": 330
    },
    "elevation": 0,
    "kind": "agricultural",
    "approach": {
      "x": -1,
      "y": 0,
      "z": 0
    },
    "streets": [
      {
        "id": "local-farm-service-approach",
        "from": {
          "x": 280,
          "y": 0.1,
          "z": 330
        },
        "to": {
          "x": 275,
          "y": 0.1,
          "z": 348
        },
        "width": 8,
        "color": "#304761",
        "kind": "local"
      },
      {
        "id": "local-farm-service",
        "from": {
          "x": 275,
          "y": 0.1,
          "z": 391
        },
        "to": {
          "x": 275,
          "y": 0.1,
          "z": 305
        },
        "width": 8,
        "color": "#304761",
        "kind": "local",
        "intentionalTerminus": true
      }
    ],
    "parcels": [
      {
        "id": "farm-service-parcel-1",
        "position": {
          "x": 298,
          "y": 0,
          "z": 363.3
        },
        "entrance": "south",
        "role": "anchor"
      },
      {
        "id": "farm-service-parcel-2",
        "position": {
          "x": 298,
          "y": 0,
          "z": 332.7
        },
        "entrance": "north",
        "role": "support"
      },
      {
        "id": "farm-service-parcel-3",
        "position": {
          "x": 246,
          "y": 0,
          "z": 363.3
        },
        "entrance": "south",
        "role": "service"
      }
    ],
    "openZone": {
      "position": {
        "x": 246,
        "y": 0,
        "z": 332.7
      },
      "radius": 12,
      "purpose": "garden"
    }
  },
  {
    "id": "solar-field",
    "origin": {
      "x": 75,
      "y": 0,
      "z": 415
    },
    "elevation": 0,
    "kind": "agricultural",
    "approach": {
      "x": 0.03412645200477783,
      "y": 0,
      "z": -0.9994175229970533
    },
    "streets": [
      {
        "id": "local-solar-field-approach",
        "from": {
          "x": 75,
          "y": 0.1,
          "z": 415
        },
        "to": {
          "x": 74.692861931957,
          "y": 0.1,
          "z": 423.9947577069735
        },
        "width": 8,
        "color": "#304761",
        "kind": "local"
      },
      {
        "id": "local-solar-field",
        "from": {
          "x": 31.7179084430837,
          "y": 0.1,
          "z": 422.52732027076803
        },
        "to": {
          "x": 117.6678154208303,
          "y": 0.1,
          "z": 425.4621951431789
        },
        "width": 8,
        "color": "#304761",
        "kind": "local",
        "intentionalTerminus": true
      }
    ],
    "parcels": [
      {
        "id": "solar-field-parcel-1",
        "position": {
          "x": 58.616865433992196,
          "y": 0,
          "z": 446.4592260202326
        },
        "entrance": "east",
        "role": "anchor"
      },
      {
        "id": "solar-field-parcel-2",
        "position": {
          "x": 89.19904163770202,
          "y": 0,
          "z": 447.5034954515788
        },
        "entrance": "west",
        "role": "support"
      },
      {
        "id": "solar-field-parcel-3",
        "position": {
          "x": 90.97361714195047,
          "y": 0,
          "z": 395.53378425573203
        },
        "entrance": "west",
        "role": "service"
      }
    ],
    "openZone": {
      "position": {
        "x": 60.39144093824064,
        "y": 0,
        "z": 394.4895148243859
      },
      "radius": 12,
      "purpose": "garden"
    }
  },
  {
    "id": "north-gardens",
    "origin": {
      "x": -45,
      "y": 0,
      "z": 405
    },
    "elevation": 0,
    "kind": "agricultural",
    "approach": {
      "x": 0.03412645200477734,
      "y": 0,
      "z": -0.9994175229970532
    },
    "streets": [
      {
        "id": "local-north-gardens-approach",
        "from": {
          "x": -45,
          "y": 0.1,
          "z": 405
        },
        "to": {
          "x": -25.81605876588584,
          "y": 0.1,
          "z": 370.63466283118913
        },
        "width": 8,
        "color": "#304761",
        "kind": "local"
      },
      {
        "id": "local-north-gardens",
        "from": {
          "x": -68.79101225475912,
          "y": 0.1,
          "z": 369.1672253949837
        },
        "to": {
          "x": 17.15889472298745,
          "y": 0.1,
          "z": 372.1021002673946
        },
        "width": 8,
        "color": "#304761",
        "kind": "local",
        "intentionalTerminus": true
      }
    ],
    "parcels": [
      {
        "id": "north-gardens-parcel-1",
        "position": {
          "x": -60.58116294389552,
          "y": 0,
          "z": 392.4609664919589
        },
        "entrance": "east",
        "role": "anchor"
      },
      {
        "id": "north-gardens-parcel-2",
        "position": {
          "x": 7.379228619904097,
          "y": 0,
          "z": 394.7815652282838
        },
        "entrance": "west",
        "role": "support"
      },
      {
        "id": "north-gardens-parcel-3",
        "position": {
          "x": 9.153804124152522,
          "y": 0,
          "z": 342.81185403243705
        },
        "entrance": "west",
        "role": "service"
      }
    ],
    "openZone": {
      "position": {
        "x": -58.8065874396471,
        "y": 0,
        "z": 340.4912552961122
      },
      "radius": 12,
      "purpose": "garden"
    }
  },
  {
    "id": "mall-annex",
    "origin": {
      "x": -205,
      "y": 0,
      "z": 365
    },
    "elevation": 0,
    "kind": "commercial",
    "approach": {
      "x": 0.23656716409508025,
      "y": 0,
      "z": -0.9716151382476559
    },
    "streets": [
      {
        "id": "local-mall-annex-approach",
        "from": {
          "x": -205,
          "y": 0.1,
          "z": 365
        },
        "to": {
          "x": -238.44045841029765,
          "y": 0.1,
          "z": 290.988272947396
        },
        "width": 8,
        "color": "#304761",
        "kind": "local"
      },
      {
        "id": "local-mall-annex",
        "from": {
          "x": -277.30506394020387,
          "y": 0.1,
          "z": 281.5255863835928
        },
        "to": {
          "x": -199.5758528803914,
          "y": 0.1,
          "z": 300.45095951119924
        },
        "width": 8,
        "color": "#304761",
        "kind": "local",
        "intentionalTerminus": true
      }
    ],
    "parcels": [
      {
        "id": "mall-annex-parcel-1",
        "position": {
          "x": -286.14676169825754,
          "y": 0,
          "z": 303.0447494889561
        },
        "entrance": "east",
        "role": "anchor"
      },
      {
        "id": "mall-annex-parcel-2",
        "position": {
          "x": -201.6162446707115,
          "y": 0,
          "z": 323.62609276522807
        },
        "entrance": "west",
        "role": "support"
      },
      {
        "id": "mall-annex-parcel-3",
        "position": {
          "x": -274.55497065759863,
          "y": 0,
          "z": 255.43560771482097
        },
        "entrance": "east",
        "role": "service"
      }
    ],
    "openZone": {
      "position": {
        "x": -190.02445363005256,
        "y": 0,
        "z": 276.0169509910929
      },
      "radius": 12,
      "purpose": "courtyard"
    }
  },
  {
    "id": "academy-commons",
    "origin": {
      "x": -265,
      "y": 0,
      "z": 235
    },
    "elevation": 0,
    "kind": "campus",
    "approach": {
      "x": 0.9996997700170718,
      "y": 0,
      "z": -0.02450244534355572
    },
    "streets": [
      {
        "id": "local-academy-commons-approach",
        "from": {
          "x": -265,
          "y": 0.1,
          "z": 235
        },
        "to": {
          "x": -233.0096073594537,
          "y": 0.1,
          "z": 234.2159217490062
        },
        "width": 8,
        "color": "#304761",
        "kind": "local"
      },
      {
        "id": "local-academy-commons",
        "from": {
          "x": -234.03871006388303,
          "y": 0.1,
          "z": 192.2285314082892
        },
        "to": {
          "x": -231.98050465502436,
          "y": 0.1,
          "z": 276.2033120897232
        },
        "width": 8,
        "color": "#304761",
        "kind": "local",
        "intentionalTerminus": true
      }
    ],
    "parcels": [
      {
        "id": "academy-commons-parcel-1",
        "position": {
          "x": -256.5495966499145,
          "y": 0,
          "z": 212.46617912512696
        },
        "entrance": "north",
        "role": "anchor"
      },
      {
        "id": "academy-commons-parcel-2",
        "position": {
          "x": -255.45580748977818,
          "y": 0,
          "z": 257.09277685868904
        },
        "entrance": "south",
        "role": "support"
      },
      {
        "id": "academy-commons-parcel-3",
        "position": {
          "x": -207.564307919078,
          "y": 0,
          "z": 211.26555930329272
        },
        "entrance": "north",
        "role": "service"
      }
    ],
    "openZone": {
      "position": {
        "x": -206.47051875894167,
        "y": 0,
        "z": 255.89215703685483
      },
      "radius": 12,
      "purpose": "garden"
    }
  },
  {
    "id": "west-park",
    "origin": {
      "x": -400,
      "y": 0,
      "z": 150
    },
    "elevation": 0,
    "kind": "campus",
    "approach": {
      "x": -0.8741572761215376,
      "y": 0,
      "z": 0.48564293117863233
    },
    "streets": [
      {
        "id": "local-west-park-approach",
        "from": {
          "x": -400,
          "y": 0.1,
          "z": 150
        },
        "to": {
          "x": -340.7515623962069,
          "y": 0.1,
          "z": 194.8734068409056
        },
        "width": 8,
        "color": "#304761",
        "kind": "local"
      },
      {
        "id": "local-west-park",
        "from": {
          "x": -320.35455928670433,
          "y": 0.1,
          "z": 231.5880124380102
        },
        "to": {
          "x": -361.1485655057095,
          "y": 0.1,
          "z": 158.158801243801
        },
        "width": 8,
        "color": "#304761",
        "kind": "local",
        "intentionalTerminus": true
      }
    ],
    "parcels": [
      {
        "id": "west-park-parcel-1",
        "position": {
          "x": -313.87122615546957,
          "y": 0,
          "z": 195.8981134256925
        },
        "entrance": "south",
        "role": "anchor"
      },
      {
        "id": "west-park-parcel-2",
        "position": {
          "x": -327.42066393535345,
          "y": 0,
          "z": 171.5091254219016
        },
        "entrance": "north",
        "role": "support"
      },
      {
        "id": "west-park-parcel-3",
        "position": {
          "x": -356.7049326854249,
          "y": 0,
          "z": 219.69461705344548
        },
        "entrance": "south",
        "role": "service"
      }
    ],
    "openZone": {
      "position": {
        "x": -370.2543704653088,
        "y": 0,
        "z": 195.30562904965458
      },
      "radius": 12,
      "purpose": "garden"
    }
  },
  {
    "id": "coolant-plant",
    "origin": {
      "x": 80,
      "y": 0,
      "z": 180
    },
    "elevation": 0,
    "kind": "workyard",
    "approach": {
      "x": 0,
      "y": 0,
      "z": 1
    },
    "streets": [
      {
        "id": "local-coolant-plant-approach",
        "from": {
          "x": 80,
          "y": 0.1,
          "z": 180
        },
        "to": {
          "x": 98,
          "y": 0.1,
          "z": 215
        },
        "width": 9,
        "color": "#26364d",
        "kind": "local"
      },
      {
        "id": "local-coolant-plant",
        "from": {
          "x": 144,
          "y": 0.1,
          "z": 215
        },
        "to": {
          "x": 52,
          "y": 0.1,
          "z": 215
        },
        "width": 9,
        "color": "#26364d",
        "kind": "local",
        "intentionalTerminus": true
      }
    ],
    "parcels": [
      {
        "id": "coolant-plant-parcel-1",
        "position": {
          "x": 133,
          "y": 0,
          "z": 192
        },
        "entrance": "west",
        "role": "anchor"
      },
      {
        "id": "coolant-plant-parcel-2",
        "position": {
          "x": 63,
          "y": 0,
          "z": 192
        },
        "entrance": "east",
        "role": "support"
      },
      {
        "id": "coolant-plant-parcel-3",
        "position": {
          "x": 133,
          "y": 0,
          "z": 243
        },
        "entrance": "west",
        "role": "service"
      }
    ],
    "openZone": {
      "position": {
        "x": 63,
        "y": 0,
        "z": 243
      },
      "radius": 15,
      "purpose": "yard"
    }
  },
  {
    "id": "central-security",
    "origin": {
      "x": -145,
      "y": 0,
      "z": 85
    },
    "elevation": 0,
    "kind": "civic",
    "approach": {
      "x": -0.9458646319475188,
      "y": 0,
      "z": -0.32456139331532496
    },
    "streets": [
      {
        "id": "local-central-security-approach",
        "from": {
          "x": -145,
          "y": 0.1,
          "z": 85
        },
        "to": {
          "x": -114.88070270033782,
          "y": 0.1,
          "z": 148.19673986982687
        },
        "width": 8,
        "color": "#304761",
        "kind": "local"
      },
      {
        "id": "local-central-security",
        "from": {
          "x": -127.86315843295083,
          "y": 0.1,
          "z": 186.0313251477276
        },
        "to": {
          "x": -101.89824696772482,
          "y": 0.1,
          "z": 110.36215459192613
        },
        "width": 8,
        "color": "#304761",
        "kind": "local",
        "intentionalTerminus": true
      }
    ],
    "parcels": [
      {
        "id": "central-security-parcel-1",
        "position": {
          "x": -97.65344760229368,
          "y": 0,
          "z": 168.85646353174724
        },
        "entrance": "south",
        "role": "anchor"
      },
      {
        "id": "central-security-parcel-2",
        "position": {
          "x": -88.59818472879611,
          "y": 0,
          "z": 142.46684030041143
        },
        "entrance": "north",
        "role": "support"
      },
      {
        "id": "central-security-parcel-3",
        "position": {
          "x": -144.0008145677221,
          "y": 0,
          "z": 152.95295525929632
        },
        "entrance": "south",
        "role": "service"
      }
    ],
    "openZone": {
      "position": {
        "x": -134.94555169422455,
        "y": 0,
        "z": 126.56333202796053
      },
      "radius": 12,
      "purpose": "courtyard"
    }
  },
  {
    "id": "south-shipworks",
    "origin": {
      "x": 190,
      "y": 0,
      "z": -400
    },
    "elevation": 0,
    "kind": "workyard",
    "approach": {
      "x": -0.7926239891046002,
      "y": 0,
      "z": 0.6097107608496924
    },
    "streets": [
      {
        "id": "local-south-shipworks-approach",
        "from": {
          "x": 190,
          "y": 0.1,
          "z": -400
        },
        "to": {
          "x": 162.258160381339,
          "y": 0.1,
          "z": -378.66012337026075
        },
        "width": 9,
        "color": "#26364d",
        "kind": "local"
      },
      {
        "id": "local-south-shipworks",
        "from": {
          "x": 190.30485538042484,
          "y": 0.1,
          "z": -342.19941987144915
        },
        "to": {
          "x": 134.21146538225315,
          "y": 0.1,
          "z": -415.12082686907235
        },
        "width": 9,
        "color": "#26364d",
        "kind": "local",
        "intentionalTerminus": true
      }
    ],
    "parcels": [
      {
        "id": "south-shipworks-parcel-1",
        "position": {
          "x": 195.85322330415704,
          "y": 0,
          "z": -372.70934634436776
        },
        "entrance": "south",
        "role": "anchor"
      },
      {
        "id": "south-shipworks-parcel-2",
        "position": {
          "x": 165.12380095733255,
          "y": 0,
          "z": -412.6575953952396
        },
        "entrance": "north",
        "role": "support"
      },
      {
        "id": "south-shipworks-parcel-3",
        "position": {
          "x": 124.69997751299795,
          "y": 0,
          "z": -381.5623465919053
        },
        "entrance": "north",
        "role": "service"
      }
    ],
    "openZone": {
      "position": {
        "x": 155.42939985982244,
        "y": 0,
        "z": -341.61409754103346
      },
      "radius": 15,
      "purpose": "yard"
    }
  },
  {
    "id": "east-freight",
    "origin": {
      "x": 330,
      "y": 0,
      "z": -315
    },
    "elevation": 0,
    "kind": "workyard",
    "approach": {
      "x": -0.5214500094539749,
      "y": 0,
      "z": 0.853281833651959
    },
    "streets": [
      {
        "id": "local-east-freight-approach",
        "from": {
          "x": 330,
          "y": 0.1,
          "z": -315
        },
        "to": {
          "x": 296.39017666337566,
          "y": 0.1,
          "z": -294.521235992353
        },
        "width": 9,
        "color": "#26364d",
        "kind": "local"
      },
      {
        "id": "local-east-freight",
        "from": {
          "x": 335.6411410113658,
          "y": 0.1,
          "z": -270.5345355574702
        },
        "to": {
          "x": 257.1392123153855,
          "y": 0.1,
          "z": -318.50793642723585
        },
        "width": 9,
        "color": "#26364d",
        "kind": "local",
        "intentionalTerminus": true
      }
    ],
    "parcels": [
      {
        "id": "east-freight-parcel-1",
        "position": {
          "x": 344.22136389419927,
          "y": 0,
          "z": -292.24581776928113
        },
        "entrance": "west",
        "role": "anchor"
      },
      {
        "id": "east-freight-parcel-2",
        "position": {
          "x": 272.54568986743476,
          "y": 0,
          "z": -336.04761856341497
        },
        "entrance": "east",
        "role": "support"
      },
      {
        "id": "east-freight-parcel-3",
        "position": {
          "x": 245.95173938528205,
          "y": 0,
          "z": -292.53024504716507
        },
        "entrance": "east",
        "role": "service"
      }
    ],
    "openZone": {
      "position": {
        "x": 317.6274134120466,
        "y": 0,
        "z": -248.7284442530312
      },
      "radius": 15,
      "purpose": "yard"
    }
  },
  {
    "id": "northwest-housing",
    "origin": {
      "x": -250,
      "y": 0,
      "z": 365
    },
    "elevation": 0,
    "kind": "neighborhood",
    "approach": {
      "x": 0.23656716409508116,
      "y": 0,
      "z": -0.9716151382476557
    },
    "streets": [
      {
        "id": "local-northwest-housing-approach",
        "from": {
          "x": -250,
          "y": 0.1,
          "z": 365
        },
        "to": {
          "x": -187.24211089649054,
          "y": 0.1,
          "z": 394.6891790939327
        },
        "width": 7,
        "color": "#304761",
        "kind": "local"
      },
      {
        "id": "local-northwest-housing",
        "from": {
          "x": -224.16348614990147,
          "y": 0.1,
          "z": 385.6996268583196
        },
        "to": {
          "x": -150.32073564307962,
          "y": 0.1,
          "z": 403.67873132954577
        },
        "width": 7,
        "color": "#304761",
        "kind": "local",
        "intentionalTerminus": true
      }
    ],
    "parcels": [
      {
        "id": "northwest-housing-parcel-1",
        "position": {
          "x": -220.85999467985945,
          "y": 0,
          "z": 410.17587951487144
        },
        "entrance": "east",
        "role": "anchor"
      },
      {
        "id": "northwest-housing-parcel-2",
        "position": {
          "x": -164.50631666149542,
          "y": 0,
          "z": 423.89677503238613
        },
        "entrance": "west",
        "role": "support"
      },
      {
        "id": "northwest-housing-parcel-3",
        "position": {
          "x": -153.3876599490266,
          "y": 0,
          "z": 378.23086353474633
        },
        "entrance": "west",
        "role": "service"
      }
    ],
    "openZone": {
      "position": {
        "x": -209.74133796739062,
        "y": 0,
        "z": 364.50996801723164
      },
      "radius": 12,
      "purpose": "courtyard"
    }
  },
  {
    "id": "west-salvage",
    "origin": {
      "x": -385,
      "y": 0,
      "z": -205
    },
    "elevation": 0,
    "kind": "salvage",
    "approach": {
      "x": 0,
      "y": 0,
      "z": 1
    },
    "streets": [
      {
        "id": "local-west-salvage-approach",
        "from": {
          "x": -385,
          "y": 0.1,
          "z": -205
        },
        "to": {
          "x": -367,
          "y": 0.1,
          "z": -153
        },
        "width": 8,
        "color": "#26364d",
        "kind": "local"
      },
      {
        "id": "local-west-salvage",
        "from": {
          "x": -323,
          "y": 0.1,
          "z": -153
        },
        "to": {
          "x": -411,
          "y": 0.1,
          "z": -153
        },
        "width": 8,
        "color": "#26364d",
        "kind": "local",
        "intentionalTerminus": true
      }
    ],
    "parcels": [
      {
        "id": "west-salvage-parcel-1",
        "position": {
          "x": -333,
          "y": 0,
          "z": -176
        },
        "entrance": "west",
        "role": "anchor"
      },
      {
        "id": "west-salvage-parcel-2",
        "position": {
          "x": -401,
          "y": 0,
          "z": -176
        },
        "entrance": "east",
        "role": "support"
      },
      {
        "id": "west-salvage-parcel-3",
        "position": {
          "x": -333,
          "y": 0,
          "z": -126
        },
        "entrance": "west",
        "role": "service"
      }
    ],
    "openZone": {
      "position": {
        "x": -401,
        "y": 0,
        "z": -126
      },
      "radius": 12,
      "purpose": "salvage"
    }
  },
  {
    "id": "east-rim",
    "origin": {
      "x": 405,
      "y": 0,
      "z": 105
    },
    "elevation": 0,
    "kind": "workyard",
    "approach": {
      "x": -1,
      "y": 0,
      "z": 0
    },
    "streets": [
      {
        "id": "local-east-rim-approach",
        "from": {
          "x": 405,
          "y": 0.1,
          "z": 105
        },
        "to": {
          "x": 403,
          "y": 0.1,
          "z": 71
        },
        "width": 9,
        "color": "#26364d",
        "kind": "local"
      },
      {
        "id": "local-east-rim",
        "from": {
          "x": 403,
          "y": 0.1,
          "z": 101
        },
        "to": {
          "x": 403,
          "y": 0.1,
          "z": 41
        },
        "width": 9,
        "color": "#26364d",
        "kind": "local",
        "intentionalTerminus": true
      }
    ],
    "parcels": [
      {
        "id": "east-rim-parcel-1",
        "position": {
          "x": 426,
          "y": 0,
          "z": 80.9
        },
        "entrance": "south",
        "role": "anchor"
      },
      {
        "id": "east-rim-parcel-2",
        "position": {
          "x": 426,
          "y": 0,
          "z": 61.1
        },
        "entrance": "north",
        "role": "support"
      },
      {
        "id": "east-rim-parcel-3",
        "position": {
          "x": 387,
          "y": 0,
          "z": 61.1
        },
        "entrance": "north",
        "role": "service"
      }
    ],
    "openZone": {
      "position": {
        "x": 387,
        "y": 0,
        "z": 80.9
      },
      "radius": 10,
      "purpose": "yard"
    }
  },
  {
    "id": "west-rim",
    "origin": {
      "x": -360,
      "y": 0,
      "z": 310
    },
    "elevation": 0,
    "kind": "campus",
    "approach": {
      "x": 0.7474093186836601,
      "y": 0,
      "z": -0.6643638388299192
    },
    "streets": [
      {
        "id": "local-west-rim-approach",
        "from": {
          "x": -360,
          "y": 0.1,
          "z": 310
        },
        "to": {
          "x": -327.44617189733384,
          "y": 0.1,
          "z": 214.16551624878412
        },
        "width": 8,
        "color": "#304761",
        "kind": "local"
      },
      {
        "id": "local-west-rim",
        "from": {
          "x": -347.3770870622314,
          "y": 0.1,
          "z": 191.74323668827432
        },
        "to": {
          "x": -307.5152567324363,
          "y": 0.1,
          "z": 236.5877958092939
        },
        "width": 8,
        "color": "#304761",
        "kind": "local",
        "intentionalTerminus": true
      }
    ],
    "parcels": [
      {
        "id": "west-rim-parcel-1",
        "position": {
          "x": -369.483793799297,
          "y": 0,
          "z": 201.49277602310337
        },
        "entrance": "north",
        "role": "anchor"
      },
      {
        "id": "west-rim-parcel-2",
        "position": {
          "x": -319.7893786548191,
          "y": 0,
          "z": 257.39899306064115
        },
        "entrance": "south",
        "role": "support"
      },
      {
        "id": "west-rim-parcel-3",
        "position": {
          "x": -290.64041522615634,
          "y": 0,
          "z": 231.48880334627427
        },
        "entrance": "south",
        "role": "service"
      }
    ],
    "openZone": {
      "position": {
        "x": -340.33483037063434,
        "y": 0,
        "z": 175.5825863087365
      },
      "radius": 10,
      "purpose": "garden"
    }
  }
] as const satisfies readonly BrDistrictPlan[];

/** Fixed building identities and architectural metadata for every secondary
 * district. Final world positions and entrances come from the road-first
 * spatial plan so a building can never drift away from its named site. */
export const AUTHORED_BR_SECONDARY_STRUCTURE_BLUEPRINTS = [
  {
    "id": "central-heights-1",
    "districtId": "central-heights",
    "position": {
      "x": -59.36929164771133,
      "y": 0,
      "z": -131.89973403141238
    },
    "size": {
      "x": 20,
      "y": 8,
      "z": 18
    },
    "color": "#65c9ff",
    "style": "city",
    "floors": 1,
    "entrance": "south",
    "roofAccess": true,
    "roofAccessSide": "north",
    "enterable": true,
    "archetype": "apartment"
  },
  {
    "id": "central-heights-2",
    "districtId": "central-heights",
    "position": {
      "x": -71.47987420861287,
      "y": 0,
      "z": -155.01993710222442
    },
    "size": {
      "x": 16,
      "y": 7,
      "z": 20
    },
    "color": "#65c9ff",
    "style": "city",
    "floors": 1,
    "entrance": "north",
    "roofAccess": false,
    "enterable": false,
    "archetype": "shop"
  },
  {
    "id": "central-heights-3",
    "districtId": "central-heights",
    "position": {
      "x": -112,
      "y": 0,
      "z": -85
    },
    "size": {
      "x": 18,
      "y": 9,
      "z": 16
    },
    "color": "#65c9ff",
    "style": "city",
    "floors": 1,
    "entrance": "north",
    "roofAccess": false,
    "enterable": false,
    "archetype": "utility"
  },
  {
    "id": "relay-market-1",
    "districtId": "relay-market",
    "position": {
      "x": 141.92769247865633,
      "y": 0,
      "z": -14.802518450624987
    },
    "size": {
      "x": 22,
      "y": 11,
      "z": 20
    },
    "color": "#72def4",
    "style": "city",
    "floors": 2,
    "entrance": "south",
    "roofAccess": true,
    "roofAccessSide": "north",
    "enterable": true,
    "archetype": "hotel"
  },
  {
    "id": "relay-market-2",
    "districtId": "relay-market",
    "position": {
      "x": 148.21686825136538,
      "y": 0,
      "z": -41.059827301685274
    },
    "size": {
      "x": 18,
      "y": 9,
      "z": 22
    },
    "color": "#72def4",
    "style": "city",
    "floors": 1,
    "entrance": "north",
    "roofAccess": false,
    "enterable": false,
    "archetype": "transit"
  },
  {
    "id": "relay-market-3",
    "districtId": "relay-market",
    "position": {
      "x": 94.27553937858394,
      "y": 0,
      "z": -26.2162078159118
    },
    "size": {
      "x": 20,
      "y": 5,
      "z": 18
    },
    "color": "#72def4",
    "style": "city",
    "floors": 1,
    "entrance": "south",
    "roofAccess": false,
    "enterable": false,
    "archetype": "warehouse"
  },
  {
    "id": "comet-hotel-1",
    "districtId": "comet-hotel",
    "position": {
      "x": -67,
      "y": 0,
      "z": -268.5
    },
    "size": {
      "x": 24,
      "y": 14,
      "z": 22
    },
    "color": "#ee7ac4",
    "style": "city",
    "floors": 2,
    "entrance": "south",
    "roofAccess": true,
    "roofAccessSide": "north",
    "enterable": true,
    "archetype": "hotel"
  },
  {
    "id": "comet-hotel-2",
    "districtId": "comet-hotel",
    "position": {
      "x": -67,
      "y": 0,
      "z": -295.5
    },
    "size": {
      "x": 20,
      "y": 5,
      "z": 18
    },
    "color": "#ee7ac4",
    "style": "city",
    "floors": 1,
    "entrance": "north",
    "roofAccess": false,
    "enterable": false,
    "archetype": "shop"
  },
  {
    "id": "comet-hotel-3",
    "districtId": "comet-hotel",
    "position": {
      "x": -116,
      "y": 0,
      "z": -268.5
    },
    "size": {
      "x": 14,
      "y": 7,
      "z": 20
    },
    "color": "#ee7ac4",
    "style": "city",
    "floors": 1,
    "entrance": "south",
    "roofAccess": false,
    "enterable": false,
    "archetype": "office"
  },
  {
    "id": "horizon-homes-1",
    "districtId": "horizon-homes",
    "position": {
      "x": -218.6061201256627,
      "y": 0,
      "z": -18.964239596099063
    },
    "size": {
      "x": 20,
      "y": 17,
      "z": 18
    },
    "color": "#d98edc",
    "style": "city",
    "floors": 2,
    "entrance": "east",
    "roofAccess": true,
    "roofAccessSide": "west",
    "enterable": true,
    "archetype": "apartment"
  },
  {
    "id": "horizon-homes-2",
    "districtId": "horizon-homes",
    "position": {
      "x": -192.54630490700146,
      "y": 0,
      "z": -17.516472083951218
    },
    "size": {
      "x": 14,
      "y": 7,
      "z": 20
    },
    "color": "#d98edc",
    "style": "city",
    "floors": 1,
    "entrance": "west",
    "roofAccess": false,
    "enterable": false,
    "archetype": "shop"
  },
  {
    "id": "horizon-homes-3",
    "districtId": "horizon-homes",
    "position": {
      "x": -189.93921398474288,
      "y": 0,
      "z": -64.44410868460561
    },
    "size": {
      "x": 16,
      "y": 9,
      "z": 16
    },
    "color": "#d98edc",
    "style": "city",
    "floors": 1,
    "entrance": "west",
    "roofAccess": false,
    "enterable": false,
    "archetype": "apartment"
  },
  {
    "id": "academy-dorms-1",
    "districtId": "academy-dorms",
    "position": {
      "x": -391,
      "y": 0,
      "z": 77.05
    },
    "size": {
      "x": 22,
      "y": 8,
      "z": 20
    },
    "color": "#a88cff",
    "style": "academy",
    "floors": 1,
    "entrance": "north",
    "roofAccess": false,
    "enterable": true,
    "archetype": "apartment"
  },
  {
    "id": "academy-dorms-2",
    "districtId": "academy-dorms",
    "position": {
      "x": -391,
      "y": 0,
      "z": 104.95
    },
    "size": {
      "x": 16,
      "y": 9,
      "z": 22
    },
    "color": "#a88cff",
    "style": "academy",
    "floors": 1,
    "entrance": "south",
    "roofAccess": false,
    "enterable": false,
    "archetype": "academy"
  },
  {
    "id": "academy-dorms-3",
    "districtId": "academy-dorms",
    "position": {
      "x": -342,
      "y": 0,
      "z": 77.05
    },
    "size": {
      "x": 18,
      "y": 5,
      "z": 18
    },
    "color": "#a88cff",
    "style": "academy",
    "floors": 1,
    "entrance": "north",
    "roofAccess": false,
    "enterable": false,
    "archetype": "shop"
  },
  {
    "id": "west-overlook-1",
    "districtId": "west-overlook",
    "position": {
      "x": -351,
      "y": 0,
      "z": -21.049999999999997
    },
    "size": {
      "x": 24,
      "y": 11,
      "z": 22
    },
    "color": "#75b8e8",
    "style": "nexus",
    "floors": 2,
    "entrance": "south",
    "roofAccess": false,
    "enterable": true,
    "archetype": "shop"
  },
  {
    "id": "west-overlook-2",
    "districtId": "west-overlook",
    "position": {
      "x": -351,
      "y": 0,
      "z": -48.95
    },
    "size": {
      "x": 18,
      "y": 5,
      "z": 18
    },
    "color": "#75b8e8",
    "style": "nexus",
    "floors": 1,
    "entrance": "north",
    "roofAccess": false,
    "enterable": false,
    "archetype": "utility"
  },
  {
    "id": "west-overlook-3",
    "districtId": "west-overlook",
    "position": {
      "x": -400,
      "y": 0,
      "z": -48.95
    },
    "size": {
      "x": 20,
      "y": 7,
      "z": 20
    },
    "color": "#75b8e8",
    "style": "nexus",
    "floors": 1,
    "entrance": "north",
    "roofAccess": false,
    "enterable": false,
    "archetype": "hotel"
  },
  {
    "id": "signal-station-1",
    "districtId": "signal-station",
    "position": {
      "x": -357.2983938754741,
      "y": 0,
      "z": -103.2601915109495
    },
    "size": {
      "x": 20,
      "y": 14,
      "z": 18
    },
    "color": "#5b95c9",
    "style": "industrial",
    "floors": 2,
    "entrance": "south",
    "roofAccess": false,
    "enterable": true,
    "archetype": "transit"
  },
  {
    "id": "signal-station-2",
    "districtId": "signal-station",
    "position": {
      "x": -353.45050503316276,
      "y": 0,
      "z": -134.5242883547289
    },
    "size": {
      "x": 20,
      "y": 7,
      "z": 20
    },
    "color": "#5b95c9",
    "style": "industrial",
    "floors": 1,
    "entrance": "north",
    "roofAccess": false,
    "enterable": false,
    "archetype": "warehouse"
  },
  {
    "id": "signal-station-3",
    "districtId": "signal-station",
    "position": {
      "x": -407.9164554320693,
      "y": 0,
      "z": -109.49010677945353
    },
    "size": {
      "x": 14,
      "y": 9,
      "z": 16
    },
    "color": "#5b95c9",
    "style": "industrial",
    "floors": 1,
    "entrance": "south",
    "roofAccess": false,
    "enterable": false,
    "archetype": "office"
  },
  {
    "id": "salvage-row-1",
    "districtId": "salvage-row",
    "position": {
      "x": -231.7,
      "y": 0,
      "z": -368
    },
    "size": {
      "x": 22,
      "y": 17,
      "z": 20
    },
    "color": "#db705d",
    "style": "wreck",
    "floors": 2,
    "entrance": "west",
    "roofAccess": false,
    "enterable": true,
    "archetype": "lab"
  },
  {
    "id": "salvage-row-2",
    "districtId": "salvage-row",
    "position": {
      "x": -262.3,
      "y": 0,
      "z": -368
    },
    "size": {
      "x": 14,
      "y": 9,
      "z": 22
    },
    "color": "#db705d",
    "style": "wreck",
    "floors": 1,
    "entrance": "east",
    "roofAccess": false,
    "enterable": false,
    "archetype": "industrial"
  },
  {
    "id": "salvage-row-3",
    "districtId": "salvage-row",
    "position": {
      "x": -231.7,
      "y": 0,
      "z": -318
    },
    "size": {
      "x": 16,
      "y": 5,
      "z": 18
    },
    "color": "#db705d",
    "style": "wreck",
    "floors": 1,
    "entrance": "west",
    "roofAccess": false,
    "enterable": false,
    "archetype": "greenhouse"
  },
  {
    "id": "emergency-depot-1",
    "districtId": "emergency-depot",
    "position": {
      "x": -76.7,
      "y": 0,
      "z": -425
    },
    "size": {
      "x": 24,
      "y": 8,
      "z": 22
    },
    "color": "#f47b64",
    "style": "wreck",
    "floors": 1,
    "entrance": "west",
    "roofAccess": false,
    "enterable": false,
    "archetype": "hangar"
  },
  {
    "id": "emergency-depot-2",
    "districtId": "emergency-depot",
    "position": {
      "x": -107.3,
      "y": 0,
      "z": -425
    },
    "size": {
      "x": 16,
      "y": 5,
      "z": 18
    },
    "color": "#f47b64",
    "style": "wreck",
    "floors": 1,
    "entrance": "east",
    "roofAccess": false,
    "enterable": false,
    "archetype": "academy"
  },
  {
    "id": "emergency-depot-3",
    "districtId": "emergency-depot",
    "position": {
      "x": -76.7,
      "y": 0,
      "z": -375
    },
    "size": {
      "x": 18,
      "y": 7,
      "z": 20
    },
    "color": "#f47b64",
    "style": "wreck",
    "floors": 1,
    "entrance": "west",
    "roofAccess": false,
    "enterable": false,
    "archetype": "mall"
  },
  {
    "id": "south-terminal-1",
    "districtId": "south-terminal",
    "position": {
      "x": 32.05,
      "y": 0,
      "z": -407
    },
    "size": {
      "x": 20,
      "y": 11,
      "z": 18
    },
    "color": "#5ca9da",
    "style": "nexus",
    "floors": 2,
    "entrance": "west",
    "roofAccess": false,
    "enterable": false,
    "archetype": "tower"
  },
  {
    "id": "south-terminal-2",
    "districtId": "south-terminal",
    "position": {
      "x": -2.0500000000000007,
      "y": 0,
      "z": -407
    },
    "size": {
      "x": 18,
      "y": 7,
      "z": 20
    },
    "color": "#5ca9da",
    "style": "nexus",
    "floors": 1,
    "entrance": "east",
    "roofAccess": false,
    "enterable": false,
    "archetype": "apartment"
  },
  {
    "id": "south-terminal-3",
    "districtId": "south-terminal",
    "position": {
      "x": -2.0500000000000007,
      "y": 0,
      "z": -358
    },
    "size": {
      "x": 20,
      "y": 9,
      "z": 16
    },
    "color": "#5ca9da",
    "style": "nexus",
    "floors": 1,
    "entrance": "east",
    "roofAccess": false,
    "enterable": false,
    "archetype": "shop"
  },
  {
    "id": "cargo-spur-1",
    "districtId": "cargo-spur",
    "position": {
      "x": 141,
      "y": 0,
      "z": -304.25
    },
    "size": {
      "x": 22,
      "y": 14,
      "z": 20
    },
    "color": "#d88b47",
    "style": "dock",
    "floors": 2,
    "entrance": "north",
    "roofAccess": false,
    "enterable": false,
    "archetype": "utility"
  },
  {
    "id": "cargo-spur-2",
    "districtId": "cargo-spur",
    "position": {
      "x": 141,
      "y": 0,
      "z": -265.75
    },
    "size": {
      "x": 20,
      "y": 9,
      "z": 22
    },
    "color": "#d88b47",
    "style": "dock",
    "floors": 1,
    "entrance": "south",
    "roofAccess": false,
    "enterable": false,
    "archetype": "hotel"
  },
  {
    "id": "cargo-spur-3",
    "districtId": "cargo-spur",
    "position": {
      "x": 192,
      "y": 0,
      "z": -304.25
    },
    "size": {
      "x": 14,
      "y": 5,
      "z": 18
    },
    "color": "#d88b47",
    "style": "dock",
    "floors": 1,
    "entrance": "north",
    "roofAccess": false,
    "enterable": false,
    "archetype": "transit"
  },
  {
    "id": "dock-service-1",
    "districtId": "dock-service",
    "position": {
      "x": 334.61738218996055,
      "y": 0,
      "z": -252.8388767293852
    },
    "size": {
      "x": 24,
      "y": 17,
      "z": 22
    },
    "color": "#f0a052",
    "style": "dock",
    "floors": 2,
    "entrance": "west",
    "roofAccess": false,
    "enterable": false,
    "archetype": "warehouse"
  },
  {
    "id": "dock-service-2",
    "districtId": "dock-service",
    "position": {
      "x": 265.97673489159615,
      "y": 0,
      "z": -266.5670061890581
    },
    "size": {
      "x": 14,
      "y": 5,
      "z": 18
    },
    "color": "#f0a052",
    "style": "dock",
    "floors": 1,
    "entrance": "east",
    "roofAccess": false,
    "enterable": false,
    "archetype": "office"
  },
  {
    "id": "dock-service-3",
    "districtId": "dock-service",
    "position": {
      "x": 324.61545929791316,
      "y": 0,
      "z": -202.82926226914827
    },
    "size": {
      "x": 16,
      "y": 7,
      "z": 20
    },
    "color": "#f0a052",
    "style": "dock",
    "floors": 1,
    "entrance": "west",
    "roofAccess": false,
    "enterable": false,
    "archetype": "lab"
  },
  {
    "id": "engine-gate-1",
    "districtId": "engine-gate",
    "position": {
      "x": 422,
      "y": 0,
      "z": -150
    },
    "size": {
      "x": 20,
      "y": 8,
      "z": 18
    },
    "color": "#579edf",
    "style": "industrial",
    "floors": 1,
    "entrance": "west",
    "roofAccess": false,
    "enterable": false,
    "archetype": "industrial"
  },
  {
    "id": "engine-gate-2",
    "districtId": "engine-gate",
    "position": {
      "x": 352,
      "y": 0,
      "z": -150
    },
    "size": {
      "x": 16,
      "y": 7,
      "z": 20
    },
    "color": "#579edf",
    "style": "industrial",
    "floors": 1,
    "entrance": "east",
    "roofAccess": false,
    "enterable": false,
    "archetype": "greenhouse"
  },
  {
    "id": "engine-gate-3",
    "districtId": "engine-gate",
    "position": {
      "x": 352,
      "y": 0,
      "z": -99
    },
    "size": {
      "x": 18,
      "y": 9,
      "z": 16
    },
    "color": "#579edf",
    "style": "industrial",
    "floors": 1,
    "entrance": "east",
    "roofAccess": false,
    "enterable": false,
    "archetype": "hangar"
  },
  {
    "id": "east-checkpoint-1",
    "districtId": "east-checkpoint",
    "position": {
      "x": 309.46574643190297,
      "y": 0,
      "z": 286.94983179918546
    },
    "size": {
      "x": 22,
      "y": 11,
      "z": 20
    },
    "color": "#65b8ff",
    "style": "industrial",
    "floors": 2,
    "entrance": "east",
    "roofAccess": false,
    "enterable": false,
    "archetype": "academy"
  },
  {
    "id": "east-checkpoint-2",
    "districtId": "east-checkpoint",
    "position": {
      "x": 374.3103379006066,
      "y": 0,
      "z": 249.66419170468086
    },
    "size": {
      "x": 18,
      "y": 9,
      "z": 22
    },
    "color": "#65b8ff",
    "style": "industrial",
    "floors": 1,
    "entrance": "west",
    "roofAccess": false,
    "enterable": false,
    "archetype": "mall"
  },
  {
    "id": "east-checkpoint-3",
    "districtId": "east-checkpoint",
    "position": {
      "x": 354.86996405454136,
      "y": 0,
      "z": 215.854845885437
    },
    "size": {
      "x": 20,
      "y": 5,
      "z": 18
    },
    "color": "#65b8ff",
    "style": "industrial",
    "floors": 1,
    "entrance": "west",
    "roofAccess": false,
    "enterable": false,
    "archetype": "tower"
  },
  {
    "id": "helios-relay-1",
    "districtId": "helios-relay",
    "position": {
      "x": 379,
      "y": 0,
      "z": 152
    },
    "size": {
      "x": 24,
      "y": 14,
      "z": 22
    },
    "color": "#ffd84d",
    "style": "reactor",
    "floors": 2,
    "entrance": "south",
    "roofAccess": false,
    "enterable": false,
    "archetype": "apartment"
  },
  {
    "id": "helios-relay-2",
    "districtId": "helios-relay",
    "position": {
      "x": 379,
      "y": 0,
      "z": 82
    },
    "size": {
      "x": 20,
      "y": 5,
      "z": 18
    },
    "color": "#ffd84d",
    "style": "reactor",
    "floors": 1,
    "entrance": "north",
    "roofAccess": false,
    "enterable": false,
    "archetype": "shop"
  },
  {
    "id": "helios-relay-3",
    "districtId": "helios-relay",
    "position": {
      "x": 328,
      "y": 0,
      "z": 82
    },
    "size": {
      "x": 14,
      "y": 7,
      "z": 20
    },
    "color": "#ffd84d",
    "style": "reactor",
    "floors": 1,
    "entrance": "north",
    "roofAccess": false,
    "enterable": false,
    "archetype": "utility"
  },
  {
    "id": "orbital-overlook-1",
    "districtId": "orbital-overlook",
    "position": {
      "x": 251.90198893772595,
      "y": 0,
      "z": 292.05833554302114
    },
    "size": {
      "x": 20,
      "y": 17,
      "z": 18
    },
    "color": "#73c8e8",
    "style": "nexus",
    "floors": 2,
    "entrance": "east",
    "roofAccess": false,
    "enterable": false,
    "archetype": "hotel"
  },
  {
    "id": "orbital-overlook-2",
    "districtId": "orbital-overlook",
    "position": {
      "x": 276.0886747930312,
      "y": 0,
      "z": 278.15099117622066
    },
    "size": {
      "x": 14,
      "y": 7,
      "z": 20
    },
    "color": "#73c8e8",
    "style": "nexus",
    "floors": 1,
    "entrance": "west",
    "roofAccess": false,
    "enterable": false,
    "archetype": "transit"
  },
  {
    "id": "orbital-overlook-3",
    "districtId": "orbital-overlook",
    "position": {
      "x": 251.66358970438515,
      "y": 0,
      "z": 235.6725823264014
    },
    "size": {
      "x": 16,
      "y": 9,
      "z": 16
    },
    "color": "#73c8e8",
    "style": "nexus",
    "floors": 1,
    "entrance": "west",
    "roofAccess": false,
    "enterable": false,
    "archetype": "warehouse"
  },
  {
    "id": "farm-service-1",
    "districtId": "farm-service",
    "position": {
      "x": 298,
      "y": 0,
      "z": 363.3
    },
    "size": {
      "x": 22,
      "y": 8,
      "z": 20
    },
    "color": "#63ef8b",
    "style": "farm",
    "floors": 1,
    "entrance": "south",
    "roofAccess": false,
    "enterable": false,
    "archetype": "office"
  },
  {
    "id": "farm-service-2",
    "districtId": "farm-service",
    "position": {
      "x": 298,
      "y": 0,
      "z": 332.7
    },
    "size": {
      "x": 16,
      "y": 9,
      "z": 22
    },
    "color": "#63ef8b",
    "style": "farm",
    "floors": 1,
    "entrance": "north",
    "roofAccess": false,
    "enterable": false,
    "archetype": "lab"
  },
  {
    "id": "farm-service-3",
    "districtId": "farm-service",
    "position": {
      "x": 246,
      "y": 0,
      "z": 363.3
    },
    "size": {
      "x": 18,
      "y": 5,
      "z": 18
    },
    "color": "#63ef8b",
    "style": "farm",
    "floors": 1,
    "entrance": "south",
    "roofAccess": false,
    "enterable": false,
    "archetype": "industrial"
  },
  {
    "id": "solar-field-1",
    "districtId": "solar-field",
    "position": {
      "x": 58.616865433992196,
      "y": 0,
      "z": 446.4592260202326
    },
    "size": {
      "x": 24,
      "y": 11,
      "z": 22
    },
    "color": "#63d99c",
    "style": "farm",
    "floors": 2,
    "entrance": "east",
    "roofAccess": false,
    "enterable": false,
    "archetype": "greenhouse"
  },
  {
    "id": "solar-field-2",
    "districtId": "solar-field",
    "position": {
      "x": 89.19904163770202,
      "y": 0,
      "z": 447.5034954515788
    },
    "size": {
      "x": 18,
      "y": 5,
      "z": 18
    },
    "color": "#63d99c",
    "style": "farm",
    "floors": 1,
    "entrance": "west",
    "roofAccess": false,
    "enterable": false,
    "archetype": "hangar"
  },
  {
    "id": "solar-field-3",
    "districtId": "solar-field",
    "position": {
      "x": 90.97361714195047,
      "y": 0,
      "z": 395.53378425573203
    },
    "size": {
      "x": 20,
      "y": 7,
      "z": 20
    },
    "color": "#63d99c",
    "style": "farm",
    "floors": 1,
    "entrance": "west",
    "roofAccess": false,
    "enterable": false,
    "archetype": "academy"
  },
  {
    "id": "north-gardens-1",
    "districtId": "north-gardens",
    "position": {
      "x": -60.58116294389552,
      "y": 0,
      "z": 392.4609664919589
    },
    "size": {
      "x": 20,
      "y": 14,
      "z": 18
    },
    "color": "#69d89a",
    "style": "farm",
    "floors": 2,
    "entrance": "east",
    "roofAccess": false,
    "enterable": false,
    "archetype": "mall"
  },
  {
    "id": "north-gardens-2",
    "districtId": "north-gardens",
    "position": {
      "x": 7.379228619904097,
      "y": 0,
      "z": 394.7815652282838
    },
    "size": {
      "x": 20,
      "y": 7,
      "z": 20
    },
    "color": "#69d89a",
    "style": "farm",
    "floors": 1,
    "entrance": "west",
    "roofAccess": false,
    "enterable": false,
    "archetype": "tower"
  },
  {
    "id": "north-gardens-3",
    "districtId": "north-gardens",
    "position": {
      "x": 9.153804124152522,
      "y": 0,
      "z": 342.81185403243705
    },
    "size": {
      "x": 14,
      "y": 9,
      "z": 16
    },
    "color": "#69d89a",
    "style": "farm",
    "floors": 1,
    "entrance": "west",
    "roofAccess": false,
    "enterable": false,
    "archetype": "apartment"
  },
  {
    "id": "mall-annex-1",
    "districtId": "mall-annex",
    "position": {
      "x": -286.14676169825754,
      "y": 0,
      "z": 303.0447494889561
    },
    "size": {
      "x": 22,
      "y": 17,
      "z": 20
    },
    "color": "#c565ff",
    "style": "mall",
    "floors": 2,
    "entrance": "east",
    "roofAccess": false,
    "enterable": false,
    "archetype": "shop"
  },
  {
    "id": "mall-annex-2",
    "districtId": "mall-annex",
    "position": {
      "x": -201.6162446707115,
      "y": 0,
      "z": 323.62609276522807
    },
    "size": {
      "x": 14,
      "y": 9,
      "z": 22
    },
    "color": "#c565ff",
    "style": "mall",
    "floors": 1,
    "entrance": "west",
    "roofAccess": false,
    "enterable": false,
    "archetype": "utility"
  },
  {
    "id": "mall-annex-3",
    "districtId": "mall-annex",
    "position": {
      "x": -274.55497065759863,
      "y": 0,
      "z": 255.43560771482097
    },
    "size": {
      "x": 16,
      "y": 5,
      "z": 18
    },
    "color": "#c565ff",
    "style": "mall",
    "floors": 1,
    "entrance": "east",
    "roofAccess": false,
    "enterable": false,
    "archetype": "hotel"
  },
  {
    "id": "academy-commons-1",
    "districtId": "academy-commons",
    "position": {
      "x": -256.5495966499145,
      "y": 0,
      "z": 212.46617912512696
    },
    "size": {
      "x": 24,
      "y": 8,
      "z": 22
    },
    "color": "#9f8ae8",
    "style": "academy",
    "floors": 1,
    "entrance": "north",
    "roofAccess": false,
    "enterable": false,
    "archetype": "transit"
  },
  {
    "id": "academy-commons-2",
    "districtId": "academy-commons",
    "position": {
      "x": -255.45580748977818,
      "y": 0,
      "z": 257.09277685868904
    },
    "size": {
      "x": 16,
      "y": 5,
      "z": 18
    },
    "color": "#9f8ae8",
    "style": "academy",
    "floors": 1,
    "entrance": "south",
    "roofAccess": false,
    "enterable": false,
    "archetype": "warehouse"
  },
  {
    "id": "academy-commons-3",
    "districtId": "academy-commons",
    "position": {
      "x": -207.564307919078,
      "y": 0,
      "z": 211.26555930329272
    },
    "size": {
      "x": 18,
      "y": 7,
      "z": 20
    },
    "color": "#9f8ae8",
    "style": "academy",
    "floors": 1,
    "entrance": "north",
    "roofAccess": false,
    "enterable": false,
    "archetype": "office"
  },
  {
    "id": "west-park-1",
    "districtId": "west-park",
    "position": {
      "x": -313.87122615546957,
      "y": 0,
      "z": 195.8981134256925
    },
    "size": {
      "x": 20,
      "y": 11,
      "z": 18
    },
    "color": "#70c98f",
    "style": "academy",
    "floors": 2,
    "entrance": "south",
    "roofAccess": false,
    "enterable": false,
    "archetype": "lab"
  },
  {
    "id": "west-park-2",
    "districtId": "west-park",
    "position": {
      "x": -327.42066393535345,
      "y": 0,
      "z": 171.5091254219016
    },
    "size": {
      "x": 18,
      "y": 7,
      "z": 20
    },
    "color": "#70c98f",
    "style": "academy",
    "floors": 1,
    "entrance": "north",
    "roofAccess": false,
    "enterable": false,
    "archetype": "industrial"
  },
  {
    "id": "west-park-3",
    "districtId": "west-park",
    "position": {
      "x": -356.7049326854249,
      "y": 0,
      "z": 219.69461705344548
    },
    "size": {
      "x": 20,
      "y": 9,
      "z": 16
    },
    "color": "#70c98f",
    "style": "academy",
    "floors": 1,
    "entrance": "south",
    "roofAccess": false,
    "enterable": false,
    "archetype": "greenhouse"
  },
  {
    "id": "coolant-plant-1",
    "districtId": "coolant-plant",
    "position": {
      "x": 133,
      "y": 0,
      "z": 192
    },
    "size": {
      "x": 22,
      "y": 14,
      "z": 20
    },
    "color": "#44bdd8",
    "style": "industrial",
    "floors": 2,
    "entrance": "west",
    "roofAccess": false,
    "enterable": false,
    "archetype": "hangar"
  },
  {
    "id": "coolant-plant-2",
    "districtId": "coolant-plant",
    "position": {
      "x": 63,
      "y": 0,
      "z": 192
    },
    "size": {
      "x": 20,
      "y": 9,
      "z": 22
    },
    "color": "#44bdd8",
    "style": "industrial",
    "floors": 1,
    "entrance": "east",
    "roofAccess": false,
    "enterable": false,
    "archetype": "academy"
  },
  {
    "id": "coolant-plant-3",
    "districtId": "coolant-plant",
    "position": {
      "x": 133,
      "y": 0,
      "z": 243
    },
    "size": {
      "x": 14,
      "y": 5,
      "z": 18
    },
    "color": "#44bdd8",
    "style": "industrial",
    "floors": 1,
    "entrance": "west",
    "roofAccess": false,
    "enterable": false,
    "archetype": "mall"
  },
  {
    "id": "central-security-1",
    "districtId": "central-security",
    "position": {
      "x": -97.65344760229368,
      "y": 0,
      "z": 168.85646353174724
    },
    "size": {
      "x": 24,
      "y": 17,
      "z": 22
    },
    "color": "#778fd8",
    "style": "nexus",
    "floors": 2,
    "entrance": "south",
    "roofAccess": false,
    "enterable": false,
    "archetype": "tower"
  },
  {
    "id": "central-security-2",
    "districtId": "central-security",
    "position": {
      "x": -88.59818472879611,
      "y": 0,
      "z": 142.46684030041143
    },
    "size": {
      "x": 14,
      "y": 5,
      "z": 18
    },
    "color": "#778fd8",
    "style": "nexus",
    "floors": 1,
    "entrance": "north",
    "roofAccess": false,
    "enterable": false,
    "archetype": "apartment"
  },
  {
    "id": "central-security-3",
    "districtId": "central-security",
    "position": {
      "x": -144.0008145677221,
      "y": 0,
      "z": 152.95295525929632
    },
    "size": {
      "x": 16,
      "y": 7,
      "z": 20
    },
    "color": "#778fd8",
    "style": "nexus",
    "floors": 1,
    "entrance": "south",
    "roofAccess": false,
    "enterable": false,
    "archetype": "shop"
  },
  {
    "id": "south-shipworks-1",
    "districtId": "south-shipworks",
    "position": {
      "x": 195.85322330415704,
      "y": 0,
      "z": -372.70934634436776
    },
    "size": {
      "x": 20,
      "y": 8,
      "z": 18
    },
    "color": "#da8b48",
    "style": "dock",
    "floors": 1,
    "entrance": "south",
    "roofAccess": false,
    "enterable": false,
    "archetype": "utility"
  },
  {
    "id": "south-shipworks-2",
    "districtId": "south-shipworks",
    "position": {
      "x": 165.12380095733255,
      "y": 0,
      "z": -412.6575953952396
    },
    "size": {
      "x": 16,
      "y": 7,
      "z": 20
    },
    "color": "#da8b48",
    "style": "dock",
    "floors": 1,
    "entrance": "north",
    "roofAccess": false,
    "enterable": false,
    "archetype": "hotel"
  },
  {
    "id": "south-shipworks-3",
    "districtId": "south-shipworks",
    "position": {
      "x": 124.69997751299795,
      "y": 0,
      "z": -381.5623465919053
    },
    "size": {
      "x": 18,
      "y": 9,
      "z": 16
    },
    "color": "#da8b48",
    "style": "dock",
    "floors": 1,
    "entrance": "north",
    "roofAccess": false,
    "enterable": false,
    "archetype": "transit"
  },
  {
    "id": "east-freight-1",
    "districtId": "east-freight",
    "position": {
      "x": 344.22136389419927,
      "y": 0,
      "z": -292.24581776928113
    },
    "size": {
      "x": 22,
      "y": 11,
      "z": 20
    },
    "color": "#e19450",
    "style": "dock",
    "floors": 2,
    "entrance": "west",
    "roofAccess": false,
    "enterable": false,
    "archetype": "warehouse"
  },
  {
    "id": "east-freight-2",
    "districtId": "east-freight",
    "position": {
      "x": 272.54568986743476,
      "y": 0,
      "z": -336.04761856341497
    },
    "size": {
      "x": 18,
      "y": 9,
      "z": 22
    },
    "color": "#e19450",
    "style": "dock",
    "floors": 1,
    "entrance": "east",
    "roofAccess": false,
    "enterable": false,
    "archetype": "office"
  },
  {
    "id": "east-freight-3",
    "districtId": "east-freight",
    "position": {
      "x": 245.95173938528205,
      "y": 0,
      "z": -292.53024504716507
    },
    "size": {
      "x": 20,
      "y": 5,
      "z": 18
    },
    "color": "#e19450",
    "style": "dock",
    "floors": 1,
    "entrance": "east",
    "roofAccess": false,
    "enterable": false,
    "archetype": "lab"
  },
  {
    "id": "northwest-housing-1",
    "districtId": "northwest-housing",
    "position": {
      "x": -220.85999467985945,
      "y": 0,
      "z": 410.17587951487144
    },
    "size": {
      "x": 24,
      "y": 14,
      "z": 22
    },
    "color": "#b78bdc",
    "style": "city",
    "floors": 2,
    "entrance": "east",
    "roofAccess": false,
    "enterable": false,
    "archetype": "apartment"
  },
  {
    "id": "northwest-housing-2",
    "districtId": "northwest-housing",
    "position": {
      "x": -164.50631666149542,
      "y": 0,
      "z": 423.89677503238613
    },
    "size": {
      "x": 20,
      "y": 5,
      "z": 18
    },
    "color": "#b78bdc",
    "style": "city",
    "floors": 1,
    "entrance": "west",
    "roofAccess": false,
    "enterable": false,
    "archetype": "apartment"
  },
  {
    "id": "northwest-housing-3",
    "districtId": "northwest-housing",
    "position": {
      "x": -153.3876599490266,
      "y": 0,
      "z": 378.23086353474633
    },
    "size": {
      "x": 14,
      "y": 7,
      "z": 20
    },
    "color": "#b78bdc",
    "style": "city",
    "floors": 1,
    "entrance": "west",
    "roofAccess": false,
    "enterable": false,
    "archetype": "shop"
  },
  {
    "id": "west-salvage-1",
    "districtId": "west-salvage",
    "position": {
      "x": -333,
      "y": 0,
      "z": -176
    },
    "size": {
      "x": 20,
      "y": 17,
      "z": 18
    },
    "color": "#cf6b61",
    "style": "wreck",
    "floors": 2,
    "entrance": "west",
    "roofAccess": false,
    "enterable": false,
    "archetype": "academy"
  },
  {
    "id": "west-salvage-2",
    "districtId": "west-salvage",
    "position": {
      "x": -401,
      "y": 0,
      "z": -176
    },
    "size": {
      "x": 14,
      "y": 7,
      "z": 20
    },
    "color": "#cf6b61",
    "style": "wreck",
    "floors": 1,
    "entrance": "east",
    "roofAccess": false,
    "enterable": false,
    "archetype": "mall"
  },
  {
    "id": "west-salvage-3",
    "districtId": "west-salvage",
    "position": {
      "x": -333,
      "y": 0,
      "z": -126
    },
    "size": {
      "x": 16,
      "y": 9,
      "z": 16
    },
    "color": "#cf6b61",
    "style": "wreck",
    "floors": 1,
    "entrance": "west",
    "roofAccess": false,
    "enterable": false,
    "archetype": "tower"
  },
  {
    "id": "east-rim-1",
    "districtId": "east-rim",
    "position": {
      "x": 426,
      "y": 0,
      "z": 80.9
    },
    "size": {
      "x": 15.84,
      "y": 8,
      "z": 14.399999999999999
    },
    "color": "#68b8de",
    "style": "industrial",
    "floors": 1,
    "entrance": "south",
    "roofAccess": false,
    "enterable": false,
    "archetype": "apartment"
  },
  {
    "id": "east-rim-2",
    "districtId": "east-rim",
    "position": {
      "x": 426,
      "y": 0,
      "z": 61.1
    },
    "size": {
      "x": 11.52,
      "y": 9,
      "z": 15.84
    },
    "color": "#68b8de",
    "style": "industrial",
    "floors": 1,
    "entrance": "north",
    "roofAccess": false,
    "enterable": false,
    "archetype": "shop"
  },
  {
    "id": "east-rim-3",
    "districtId": "east-rim",
    "position": {
      "x": 387,
      "y": 0,
      "z": 61.1
    },
    "size": {
      "x": 12.959999999999999,
      "y": 5,
      "z": 12.959999999999999
    },
    "color": "#68b8de",
    "style": "industrial",
    "floors": 1,
    "entrance": "north",
    "roofAccess": false,
    "enterable": false,
    "archetype": "utility"
  },
  {
    "id": "west-rim-1",
    "districtId": "west-rim",
    "position": {
      "x": -369.483793799297,
      "y": 0,
      "z": 201.49277602310337
    },
    "size": {
      "x": 17.28,
      "y": 11,
      "z": 15.84
    },
    "color": "#8f8bd6",
    "style": "academy",
    "floors": 2,
    "entrance": "north",
    "roofAccess": false,
    "enterable": false,
    "archetype": "hotel"
  },
  {
    "id": "west-rim-2",
    "districtId": "west-rim",
    "position": {
      "x": -319.7893786548191,
      "y": 0,
      "z": 257.39899306064115
    },
    "size": {
      "x": 12.959999999999999,
      "y": 5,
      "z": 12.959999999999999
    },
    "color": "#8f8bd6",
    "style": "academy",
    "floors": 1,
    "entrance": "south",
    "roofAccess": false,
    "enterable": false,
    "archetype": "transit"
  },
  {
    "id": "west-rim-3",
    "districtId": "west-rim",
    "position": {
      "x": -290.64041522615634,
      "y": 0,
      "z": 231.48880334627427
    },
    "size": {
      "x": 14.399999999999999,
      "y": 7,
      "z": 14.399999999999999
    },
    "color": "#8f8bd6",
    "style": "academy",
    "floors": 1,
    "entrance": "south",
    "roofAccess": false,
    "enterable": false,
    "archetype": "warehouse"
  }
] as const satisfies readonly BrStructure[];
