/** Offline geographic extents, retrieved 2026-10-18. Sources are pinned per entry.
 * Natural Earth: Public Domain. OSM-derived bounds: © OpenStreetMap contributors, ODbL.
 * Bounds [west,south,east,north] use the shortest longitude interval (east may exceed 180).
 * Width = longitude span at mid-latitude; height = latitude span, mean Earth radius
 * 6371008.8 m. Rounded to three significant digits. Antarctica uses south-pole
 * azimuthal equidistant XY extents. These are comparison rectangles, not areas.
 * Hamburg and Tokyo use the largest mainland polygon, explicitly named below.
 */
export interface GeographicReference {
  id: string; name: string; category: string; width: number; height: number;
  aliases: string[]; source: string; bounds?: number[]; method?: string;
}
export const geographicReferences: GeographicReference[] = [
  {
    "id": "region-de-bw",
    "name": "Baden-Württemberg",
    "category": "Bundesländer",
    "width": 219000.0,
    "height": 252000.0,
    "aliases": [
      "Baden-Württemberg",
      "DE-BW"
    ],
    "bounds": [
      7.511872,
      47.532743,
      10.495101,
      49.795591
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_1_states_provinces.geojson"
  },
  {
    "id": "region-de-by",
    "name": "Bayern",
    "category": "Bundesländer",
    "width": 354000.0,
    "height": 366000.0,
    "aliases": [
      "Bayern",
      "DE-BY"
    ],
    "bounds": [
      8.976589,
      47.271121,
      13.816862,
      50.562857
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_1_states_provinces.geojson"
  },
  {
    "id": "region-de-be",
    "name": "Berlin",
    "category": "Bundesländer",
    "width": 44600.0,
    "height": 35800.0,
    "aliases": [
      "Berlin",
      "DE-BE"
    ],
    "bounds": [
      13.091635,
      52.342025,
      13.750923,
      52.663556
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_1_states_provinces.geojson"
  },
  {
    "id": "region-de-bb",
    "name": "Brandenburg",
    "category": "Bundesländer",
    "width": 236000.0,
    "height": 244000.0,
    "aliases": [
      "Brandenburg",
      "DE-BB"
    ],
    "bounds": [
      11.27409,
      51.347977,
      14.761403,
      53.543811
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_1_states_provinces.geojson"
  },
  {
    "id": "region-de-hb",
    "name": "Freie Hansestadt Bremen",
    "category": "Bundesländer",
    "width": 32800.0,
    "height": 65900.0,
    "aliases": [
      "Bremen",
      "DE-HB"
    ],
    "bounds": [
      8.49605,
      53.024619,
      8.989922,
      53.617097
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_1_states_provinces.geojson"
  },
  {
    "id": "region-de-hh",
    "name": "Hamburg",
    "category": "Bundesländer",
    "width": 38800.0,
    "height": 36000.0,
    "aliases": [
      "Hamburg",
      "DE-HH"
    ],
    "bounds": [
      9.74081,
      53.404389,
      10.32798,
      53.72778
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_1_states_provinces.geojson"
  },
  {
    "id": "region-de-he",
    "name": "Hessen",
    "category": "Bundesländer",
    "width": 174000.0,
    "height": 251000.0,
    "aliases": [
      "Hessen",
      "DE-HE"
    ],
    "bounds": [
      7.771392,
      49.396288,
      10.232895,
      51.655013
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_1_states_provinces.geojson"
  },
  {
    "id": "region-de-mv",
    "name": "Mecklenburg-Vorpommern",
    "category": "Bundesländer",
    "width": 248000.0,
    "height": 176000.0,
    "aliases": [
      "Mecklenburg-Vorpommern",
      "DE-MV"
    ],
    "bounds": [
      10.601245,
      53.108241,
      14.391261,
      54.688422
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_1_states_provinces.geojson"
  },
  {
    "id": "region-de-ni",
    "name": "Niedersachsen",
    "category": "Bundesländer",
    "width": 332000.0,
    "height": 289000.0,
    "aliases": [
      "Niedersachsen",
      "DE-NI"
    ],
    "bounds": [
      6.659516,
      51.290461,
      11.58134,
      53.892483
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_1_states_provinces.geojson"
  },
  {
    "id": "region-de-nw",
    "name": "Nordrhein-Westfalen",
    "category": "Bundesländer",
    "width": 250000.0,
    "height": 245000.0,
    "aliases": [
      "Nordrhein-Westfalen",
      "DE-NW"
    ],
    "bounds": [
      5.85249,
      50.32308,
      9.462141,
      52.524184
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_1_states_provinces.geojson"
  },
  {
    "id": "region-de-rp",
    "name": "Rheinland-Pfalz",
    "category": "Bundesländer",
    "width": 172000.0,
    "height": 220000.0,
    "aliases": [
      "Rheinland-Pfalz",
      "DE-RP"
    ],
    "bounds": [
      6.096403,
      48.95825,
      8.504577,
      50.932705
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_1_states_provinces.geojson"
  },
  {
    "id": "region-de-sl",
    "name": "Saarland",
    "category": "Bundesländer",
    "width": 75900.0,
    "height": 58300.0,
    "aliases": [
      "Saarland",
      "DE-SL"
    ],
    "bounds": [
      6.342279,
      49.105014,
      7.390588,
      49.629477
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_1_states_provinces.geojson"
  },
  {
    "id": "region-de-sn",
    "name": "Sachsen",
    "category": "Bundesländer",
    "width": 219000.0,
    "height": 168000.0,
    "aliases": [
      "Sachsen",
      "DE-SN"
    ],
    "bounds": [
      11.897393,
      50.160815,
      15.022059,
      51.670076
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_1_states_provinces.geojson"
  },
  {
    "id": "region-de-st",
    "name": "Sachsen-Anhalt",
    "category": "Bundesländer",
    "width": 183000.0,
    "height": 236000.0,
    "aliases": [
      "Sachsen-Anhalt",
      "DE-ST"
    ],
    "bounds": [
      10.569619,
      50.927899,
      13.236846,
      53.050302
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_1_states_provinces.geojson"
  },
  {
    "id": "region-de-sh",
    "name": "Schleswig-Holstein",
    "category": "Bundesländer",
    "width": 223000.0,
    "height": 189000.0,
    "aliases": [
      "Schleswig-Holstein",
      "DE-SH"
    ],
    "bounds": [
      7.879893,
      53.363875,
      11.31422,
      55.065334
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_1_states_provinces.geojson"
  },
  {
    "id": "region-de-th",
    "name": "Thüringen",
    "category": "Bundesländer",
    "width": 194000.0,
    "height": 159000.0,
    "aliases": [
      "Thüringen",
      "DE-TH"
    ],
    "bounds": [
      9.877671,
      50.207272,
      12.647373,
      51.637365
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_1_states_provinces.geojson"
  },
  {
    "id": "physical-1159104133",
    "name": "Großbritannien",
    "category": "Inseln",
    "width": 511000.0,
    "height": 959000.0,
    "aliases": [
      "GREAT BRITAIN",
      "Great Britain"
    ],
    "bounds": [
      -6.133691,
      50.021387,
      1.746582,
      58.65
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_geography_regions_polys.geojson"
  },
  {
    "id": "physical-1159104263",
    "name": "Grönland",
    "category": "Inseln",
    "width": 2140000.0,
    "height": 2640000.0,
    "aliases": [
      "GREENLAND",
      "Greenland"
    ],
    "bounds": [
      -72.818066,
      59.815479,
      -11.425537,
      83.599609
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_geography_regions_polys.geojson"
  },
  {
    "id": "physical-1159104131",
    "name": "Irland",
    "category": "Inseln",
    "width": 326000.0,
    "height": 433000.0,
    "aliases": [
      "IRELAND",
      "Ireland"
    ],
    "bounds": [
      -10.390234,
      51.47373,
      -5.47041,
      55.36582
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_geography_regions_polys.geojson"
  },
  {
    "id": "physical-1159104135",
    "name": "Island",
    "category": "Inseln",
    "width": 514000.0,
    "height": 347000.0,
    "aliases": [
      "ICELAND",
      "Iceland"
    ],
    "bounds": [
      -24.475684,
      63.406689,
      -13.556104,
      66.526074
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_geography_regions_polys.geojson"
  },
  {
    "id": "physical-1159103807",
    "name": "Korsika",
    "category": "Inseln",
    "width": 81600.0,
    "height": 182000.0,
    "aliases": [
      "Corse",
      "Corsica"
    ],
    "bounds": [
      8.565625,
      41.384912,
      9.556445,
      43.021484
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_geography_regions_polys.geojson"
  },
  {
    "id": "physical-1159102805",
    "name": "Kreta",
    "category": "Inseln",
    "width": 251000.0,
    "height": 80200.0,
    "aliases": [
      "Crete",
      "Crete"
    ],
    "bounds": [
      23.549524,
      34.934628,
      26.320215,
      35.655518
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_geography_regions_polys.geojson"
  },
  {
    "id": "physical-1159104265",
    "name": "Madagaskar",
    "category": "Inseln",
    "width": 760000.0,
    "height": 1500000.0,
    "aliases": [
      "MADAGASCAR",
      "Madagascar"
    ],
    "bounds": [
      43.257129,
      -25.570508,
      50.47642,
      -12.07959
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_geography_regions_polys.geojson"
  },
  {
    "id": "physical-1159102819",
    "name": "Mallorca",
    "category": "Inseln",
    "width": 93500.0,
    "height": 74400.0,
    "aliases": [
      "Mallorca",
      "Mallorca"
    ],
    "bounds": [
      2.37002,
      39.30127,
      3.461816,
      39.970053
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_geography_regions_polys.geojson"
  },
  {
    "id": "osm-relation-1434381",
    "name": "Rügen",
    "category": "Inseln",
    "width": 42200.0,
    "height": 51600.0,
    "aliases": [
      "Rügen"
    ],
    "bounds": [
      13.1140107,
      54.2206773,
      13.7665208,
      54.6850775
    ],
    "source": "https://www.openstreetmap.org/relation/1434381"
  },
  {
    "id": "physical-1159103805",
    "name": "Sardinien",
    "category": "Inseln",
    "width": 138000.0,
    "height": 261000.0,
    "aliases": [
      "Sardegna",
      "Sardinia"
    ],
    "bounds": [
      8.180859,
      38.909668,
      9.805273,
      41.25708
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_geography_regions_polys.geojson"
  },
  {
    "id": "physical-1159103809",
    "name": "Sizilien",
    "category": "Inseln",
    "width": 282000.0,
    "height": 179000.0,
    "aliases": [
      "Sicilia",
      "Sicily"
    ],
    "bounds": [
      12.437682,
      36.687842,
      15.634668,
      38.295898
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_geography_regions_polys.geojson"
  },
  {
    "id": "osm-relation-1576925",
    "name": "Sylt",
    "category": "Inseln",
    "width": 13500.0,
    "height": 34700.0,
    "aliases": [
      "Sylt"
    ],
    "bounds": [
      8.2784628,
      54.7461959,
      8.489955,
      55.0586617
    ],
    "source": "https://www.openstreetmap.org/relation/1576925"
  },
  {
    "id": "physical-1159104365",
    "name": "Afrika",
    "category": "Kontinente",
    "width": 7660000.0,
    "height": 8020000.0,
    "aliases": [
      "AFRICA",
      "Africa"
    ],
    "bounds": [
      -17.497975,
      -34.785726,
      51.380035,
      37.317299
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_geography_regions_polys.geojson"
  },
  {
    "id": "physical-1159104367",
    "name": "Antarktika",
    "category": "Kontinente",
    "width": 5370000.0,
    "height": 4390000.0,
    "aliases": [
      "ANTARCTICA",
      "Antarctica"
    ],
    "bounds": [
      53.698464,
      -89.999933,
      411.050281,
      -61.076164
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_geography_regions_polys.geojson",
    "method": "polar-equidistant"
  },
  {
    "id": "physical-1159104597",
    "name": "Asien",
    "category": "Kontinente",
    "width": 13700000.0,
    "height": 8900000.0,
    "aliases": [
      "ASIA",
      "Asia"
    ],
    "bounds": [
      26.095996,
      1.265381,
      190.27085,
      81.280469
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_geography_regions_polys.geojson"
  },
  {
    "id": "physical-1159104363",
    "name": "Australien",
    "category": "Kontinente",
    "width": 4040000.0,
    "height": 3730000.0,
    "aliases": [
      "AUSTRALIA",
      "Australia"
    ],
    "bounds": [
      112.908203,
      -43.619336,
      153.616895,
      -10.051758
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_geography_regions_polys.geojson"
  },
  {
    "id": "physical-1159104603",
    "name": "Europa",
    "category": "Kontinente",
    "width": 5070000.0,
    "height": 4030000.0,
    "aliases": [
      "EUROPE",
      "Europe"
    ],
    "bounds": [
      -9.479736,
      34.934473,
      66.364146,
      71.14209
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_geography_regions_polys.geojson"
  },
  {
    "id": "physical-1159104607",
    "name": "Nordamerika",
    "category": "Kontinente",
    "width": 12700000.0,
    "height": 7560000.0,
    "aliases": [
      "NORTH AMERICA",
      "North America"
    ],
    "bounds": [
      172.494824,
      15.651904,
      348.574463,
      83.599609
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_geography_regions_polys.geojson"
  },
  {
    "id": "physical-1159104361",
    "name": "Südamerika",
    "category": "Kontinente",
    "width": 4800000.0,
    "height": 7550000.0,
    "aliases": [
      "SOUTH AMERICA",
      "South America"
    ],
    "bounds": [
      -81.336621,
      -55.701226,
      -34.887318,
      12.176615
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_geography_regions_polys.geojson"
  },
  {
    "id": "country-gea",
    "name": "Adscharien",
    "category": "Länder und Gebiete",
    "width": 88500.0,
    "height": 53500.0,
    "aliases": [
      "Adjara",
      "Adjara",
      "-99"
    ],
    "bounds": [
      41.520763,
      41.421814,
      42.586648,
      41.902615
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-afg",
    "name": "Afghanistan",
    "category": "Länder und Gebiete",
    "width": 1330000.0,
    "height": 1010000.0,
    "aliases": [
      "Afghanistan",
      "Afghanistan",
      "AF"
    ],
    "bounds": [
      60.486778,
      29.386605,
      74.892307,
      38.473673
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-wsb",
    "name": "Akrotiri",
    "category": "Länder und Gebiete",
    "width": 24700.0,
    "height": 14700.0,
    "aliases": [
      "Akrotiri",
      "Akrotiri Sovereign Base Area",
      "-99"
    ],
    "bounds": [
      32.760102,
      34.568549,
      33.030284,
      34.700948
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-alb",
    "name": "Albanien",
    "category": "Länder und Gebiete",
    "width": 148000.0,
    "height": 336000.0,
    "aliases": [
      "Albania",
      "Albania",
      "AL"
    ],
    "bounds": [
      19.272033,
      39.637013,
      21.036679,
      42.654814
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-dza",
    "name": "Algerien",
    "category": "Länder und Gebiete",
    "width": 2030000.0,
    "height": 2010000.0,
    "aliases": [
      "Algeria",
      "Algeria",
      "DZ"
    ],
    "bounds": [
      -8.682385,
      18.975561,
      11.968861,
      37.09394
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-asm",
    "name": "Amerikanisch-Samoa",
    "category": "Länder und Gebiete",
    "width": 317000.0,
    "height": 387000.0,
    "aliases": [
      "American Samoa",
      "American Samoa",
      "AS"
    ],
    "bounds": [
      -171.086537,
      -14.532892,
      -168.160471,
      -11.051365
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-vir",
    "name": "Amerikanische Jungferninseln",
    "category": "Länder und Gebiete",
    "width": 51000.0,
    "height": 78300.0,
    "aliases": [
      "U.S. Virgin Is.",
      "United States Virgin Islands",
      "VI"
    ],
    "bounds": [
      -65.041493,
      17.682766,
      -64.559397,
      18.386599
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-and",
    "name": "Andorra",
    "category": "Länder und Gebiete",
    "width": 29400.0,
    "height": 24500.0,
    "aliases": [
      "Andorra",
      "Andorra",
      "AD"
    ],
    "bounds": [
      1.406456,
      42.428677,
      1.765091,
      42.649362
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-ago",
    "name": "Angola",
    "category": "Länder und Gebiete",
    "width": 1350000.0,
    "height": 1520000.0,
    "aliases": [
      "Angola",
      "Angola",
      "AO"
    ],
    "bounds": [
      11.669394,
      -18.031405,
      24.061714,
      -4.391204
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-aia",
    "name": "Anguilla",
    "category": "Länder und Gebiete",
    "width": 53100.0,
    "height": 48100.0,
    "aliases": [
      "Anguilla",
      "Anguilla",
      "AI"
    ],
    "bounds": [
      -63.428822,
      18.169094,
      -62.925682,
      18.601264
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-ata",
    "name": "Antarktika",
    "category": "Länder und Gebiete",
    "width": 10200000.0,
    "height": 3280000.0,
    "aliases": [
      "Antarctica",
      "Antarctica",
      "AQ"
    ],
    "bounds": [
      55.17337,
      -90,
      414.71225,
      -60.516209
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-aca",
    "name": "Antigua",
    "category": "Länder und Gebiete",
    "width": 72400.0,
    "height": 26300.0,
    "aliases": [
      "Antigua",
      "Antigua",
      "-99"
    ],
    "bounds": [
      -62.34826,
      16.93197,
      -61.667592,
      17.168769
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-arg",
    "name": "Argentinien",
    "category": "Länder und Gebiete",
    "width": 1730000.0,
    "height": 3700000.0,
    "aliases": [
      "Argentina",
      "Argentina",
      "AR"
    ],
    "bounds": [
      -73.57274,
      -55.052016,
      -53.661552,
      -21.786938
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-arm",
    "name": "Armenien",
    "category": "Länder und Gebiete",
    "width": 269000.0,
    "height": 270000.0,
    "aliases": [
      "Armenia",
      "Armenia",
      "AM"
    ],
    "bounds": [
      43.436294,
      38.863701,
      46.602612,
      41.290452
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-abw",
    "name": "Aruba",
    "category": "Länder und Gebiete",
    "width": 20100.0,
    "height": 23800.0,
    "aliases": [
      "Aruba",
      "Aruba",
      "AW"
    ],
    "bounds": [
      -70.062408,
      12.41767,
      -69.87682,
      12.632148
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-aze",
    "name": "Aserbaidschan",
    "category": "Länder und Gebiete",
    "width": 497000.0,
    "height": 389000.0,
    "aliases": [
      "Azerbaijan",
      "Azerbaijan",
      "AZ"
    ],
    "bounds": [
      44.774559,
      38.392645,
      50.625743,
      41.890442
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-atc",
    "name": "Ashmore- und Cartierinseln",
    "category": "Länder und Gebiete",
    "width": 2470.0,
    "height": 1330.0,
    "aliases": [
      "Ashmore and Cartier Is.",
      "Ashmore and Cartier Islands",
      "-99"
    ],
    "bounds": [
      123.575043,
      -12.438572,
      123.597748,
      -12.426609
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-aus",
    "name": "Australien",
    "category": "Länder und Gebiete",
    "width": 4360000.0,
    "height": 5060000.0,
    "aliases": [
      "Australia",
      "Australia",
      "AU"
    ],
    "bounds": [
      112.919444,
      -54.750421,
      159.106456,
      -9.240167
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-irk",
    "name": "Autonome Region Kurdistan",
    "category": "Länder und Gebiete",
    "width": 357000.0,
    "height": 318000.0,
    "aliases": [
      "Iraqi Kurdistan",
      "Kurdistan Region",
      "-99"
    ],
    "bounds": [
      42.357238,
      34.512803,
      46.327074,
      37.375498
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-pmd",
    "name": "Autonome Region Madeira",
    "category": "Länder und Gebiete",
    "width": 132000.0,
    "height": 343000.0,
    "aliases": [
      "Madeira",
      "Madeira",
      "-99"
    ],
    "bounds": [
      -17.252105,
      30.029242,
      -15.85497,
      33.110785
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-paz",
    "name": "Azoren",
    "category": "Länder und Gebiete",
    "width": 547000.0,
    "height": 311000.0,
    "aliases": [
      "Azores",
      "Azores",
      "-99"
    ],
    "bounds": [
      -31.284901,
      36.934312,
      -25.012196,
      39.728339
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-bhs",
    "name": "Bahamas",
    "category": "Länder und Gebiete",
    "width": 696000.0,
    "height": 669000.0,
    "aliases": [
      "Bahamas",
      "The Bahamas",
      "BS"
    ],
    "bounds": [
      -79.59435,
      20.912399,
      -72.746165,
      26.928412
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-bhr",
    "name": "Bahrain",
    "category": "Länder und Gebiete",
    "width": 43900.0,
    "height": 78700.0,
    "aliases": [
      "Bahrain",
      "Bahrain",
      "BH"
    ],
    "bounds": [
      50.38053,
      25.579891,
      50.819875,
      26.287439
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-kab",
    "name": "Baikonur",
    "category": "Länder und Gebiete",
    "width": 90100.0,
    "height": 91700.0,
    "aliases": [
      "Baikonur",
      "Baikonur",
      "-99"
    ],
    "bounds": [
      62.800642,
      45.565824,
      63.967134,
      46.390839
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-bjn",
    "name": "Bajo-Nuevo-Bank",
    "category": "Länder und Gebiete",
    "width": 309.0,
    "height": 226.0,
    "aliases": [
      "Bajo Nuevo Bank",
      "Bajo Nuevo Bank",
      "-99"
    ],
    "bounds": [
      -79.989288,
      15.794176,
      -79.986399,
      15.79621
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-fqi",
    "name": "Bakerinsel",
    "category": "Länder und Gebiete",
    "width": 2960.0,
    "height": 3950.0,
    "aliases": [
      "Baker I.",
      "Baker Island",
      "-99"
    ],
    "bounds": [
      -176.485829,
      0.190334,
      -176.459177,
      0.225898
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-bgd",
    "name": "Bangladesch",
    "category": "Länder und Gebiete",
    "width": 471000.0,
    "height": 654000.0,
    "aliases": [
      "Bangladesh",
      "Bangladesh",
      "BD"
    ],
    "bounds": [
      88.02179,
      20.738715,
      92.642851,
      26.623544
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-brb",
    "name": "Barbados",
    "category": "Länder und Gebiete",
    "width": 24600.0,
    "height": 32600.0,
    "aliases": [
      "Barbados",
      "Barbados",
      "BB"
    ],
    "bounds": [
      -59.654205,
      13.051174,
      -59.42691,
      13.34455
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-acb",
    "name": "Barbuda",
    "category": "Länder und Gebiete",
    "width": 15500.0,
    "height": 20300.0,
    "aliases": [
      "Barbuda",
      "Barbuda",
      "-99"
    ],
    "bounds": [
      -61.87385,
      17.545559,
      -61.727773,
      17.727688
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-blr",
    "name": "Belarus",
    "category": "Länder und Gebiete",
    "width": 629000.0,
    "height": 547000.0,
    "aliases": [
      "Belarus",
      "Belarus",
      "BY"
    ],
    "bounds": [
      23.165645,
      51.235168,
      32.719532,
      56.156806
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-blz",
    "name": "Belize",
    "category": "Länder und Gebiete",
    "width": 154000.0,
    "height": 290000.0,
    "aliases": [
      "Belize",
      "Belize",
      "BZ"
    ],
    "bounds": [
      -89.236512,
      15.879652,
      -87.78307,
      18.490759
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-ben",
    "name": "Benin",
    "category": "Länder und Gebiete",
    "width": 338000.0,
    "height": 688000.0,
    "aliases": [
      "Benin",
      "Benin",
      "BJ"
    ],
    "bounds": [
      0.759881,
      6.213894,
      3.837419,
      12.399244
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-bmu",
    "name": "Bermuda",
    "category": "Länder und Gebiete",
    "width": 22400.0,
    "height": 15600.0,
    "aliases": [
      "Bermuda",
      "Bermuda",
      "BM"
    ],
    "bounds": [
      -64.885994,
      32.248077,
      -64.647631,
      32.388658
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-btn",
    "name": "Bhutan",
    "category": "Länder und Gebiete",
    "width": 331000.0,
    "height": 185000.0,
    "aliases": [
      "Bhutan",
      "Bhutan",
      "BT"
    ],
    "bounds": [
      88.730067,
      26.696149,
      92.088776,
      28.358399
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-brt",
    "name": "Bir Tawil",
    "category": "Länder und Gebiete",
    "width": 93200.0,
    "height": 31600.0,
    "aliases": [
      "Bir Tawil",
      "Bir Tawil",
      "-99"
    ],
    "bounds": [
      33.181136,
      21.710957,
      34.084179,
      21.995454
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-bol",
    "name": "Bolivien",
    "category": "Länder und Gebiete",
    "width": 1300000.0,
    "height": 1470000.0,
    "aliases": [
      "Bolivia",
      "Bolivia",
      "BO"
    ],
    "bounds": [
      -69.666492,
      -22.897258,
      -57.465661,
      -9.679821
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-bwa",
    "name": "Botswana",
    "category": "Länder und Gebiete",
    "width": 964000.0,
    "height": 1010000.0,
    "aliases": [
      "Botswana",
      "Botswana",
      "BW"
    ],
    "bounds": [
      19.978346,
      -26.891794,
      29.350074,
      -17.781808
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-pnb",
    "name": "Bougainville",
    "category": "Länder und Gebiete",
    "width": 203000.0,
    "height": 408000.0,
    "aliases": [
      "Bougainville",
      "Autonomous Region of Bougainville",
      "-99"
    ],
    "bounds": [
      154.134532,
      -6.876642,
      155.96754,
      -3.206315
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-bvt",
    "name": "Bouvetinsel",
    "category": "Länder und Gebiete",
    "width": 9130.0,
    "height": 9160.0,
    "aliases": [
      "Bouvet I.",
      "Bouvet Island",
      "BV"
    ],
    "bounds": [
      3.345551,
      -54.462498,
      3.486664,
      -54.380141
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-bra",
    "name": "Brasilien",
    "category": "Länder und Gebiete",
    "width": 4870000.0,
    "height": 4340000.0,
    "aliases": [
      "Brazil",
      "Brazil",
      "BR"
    ],
    "bounds": [
      -74.018475,
      -33.74228,
      -28.877065,
      5.267225
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-vgb",
    "name": "Britische Jungferninseln",
    "category": "Länder und Gebiete",
    "width": 53100.0,
    "height": 45800.0,
    "aliases": [
      "British Virgin Is.",
      "British Virgin Islands",
      "VG"
    ],
    "bounds": [
      -64.773997,
      18.334662,
      -64.270741,
      18.746243
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-iot",
    "name": "Britisches Territorium im Indischen Ozean",
    "category": "Länder und Gebiete",
    "width": 136000.0,
    "height": 245000.0,
    "aliases": [
      "Br. Indian Ocean Ter.",
      "British Indian Ocean Territory",
      "IO"
    ],
    "bounds": [
      71.260997,
      -7.432224,
      72.49464,
      -5.226983
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-brn",
    "name": "Brunei",
    "category": "Länder und Gebiete",
    "width": 151000.0,
    "height": 116000.0,
    "aliases": [
      "Brunei",
      "Brunei",
      "BN"
    ],
    "bounds": [
      113.99879,
      4.016681,
      115.360741,
      5.057196
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-bgr",
    "name": "Bulgarien",
    "category": "Länder und Gebiete",
    "width": 511000.0,
    "height": 333000.0,
    "aliases": [
      "Bulgaria",
      "Bulgaria",
      "BG"
    ],
    "bounds": [
      22.345023,
      41.238104,
      28.603526,
      44.228435
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-bfa",
    "name": "Burkina Faso",
    "category": "Länder und Gebiete",
    "width": 860000.0,
    "height": 632000.0,
    "aliases": [
      "Burkina Faso",
      "Burkina Faso",
      "BF"
    ],
    "bounds": [
      -5.522578,
      9.391883,
      2.390169,
      15.079908
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-bdi",
    "name": "Burundi",
    "category": "Länder und Gebiete",
    "width": 205000.0,
    "height": 240000.0,
    "aliases": [
      "Burundi",
      "Burundi",
      "BI"
    ],
    "bounds": [
      28.986892,
      -4.463344,
      30.833962,
      -2.303062
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-cym",
    "name": "Cayman Islands",
    "category": "Länder und Gebiete",
    "width": 177000.0,
    "height": 54900.0,
    "aliases": [
      "Cayman Is.",
      "Cayman Islands",
      "KY"
    ],
    "bounds": [
      -81.416542,
      19.263864,
      -79.726643,
      19.757631
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-chl",
    "name": "Chile",
    "category": "Länder und Gebiete",
    "width": 3840000.0,
    "height": 4270000.0,
    "aliases": [
      "Chile",
      "Chile",
      "CL"
    ],
    "bounds": [
      -109.453725,
      -55.918504,
      -66.420806,
      -17.506588
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-clp",
    "name": "Clipperton-Insel",
    "category": "Länder und Gebiete",
    "width": 2610.0,
    "height": 3280.0,
    "aliases": [
      "Clipperton I.",
      "Clipperton Island",
      "-99"
    ],
    "bounds": [
      -109.234242,
      10.281562,
      -109.210357,
      10.311021
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-cok",
    "name": "Cookinseln",
    "category": "Länder und Gebiete",
    "width": 912000.0,
    "height": 1440000.0,
    "aliases": [
      "Cook Is.",
      "Cook Islands",
      "CK"
    ],
    "bounds": [
      -165.824534,
      -21.938897,
      -157.312815,
      -8.94671
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-cri",
    "name": "Costa Rica",
    "category": "Länder und Gebiete",
    "width": 501000.0,
    "height": 633000.0,
    "aliases": [
      "Costa Rica",
      "Costa Rica",
      "CR"
    ],
    "bounds": [
      -87.117665,
      5.515082,
      -82.562837,
      11.209937
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-cuw",
    "name": "Curaçao",
    "category": "Länder und Gebiete",
    "width": 46900.0,
    "height": 38900.0,
    "aliases": [
      "Curaçao",
      "Curaçao",
      "CW"
    ],
    "bounds": [
      -69.171742,
      12.041327,
      -68.739735,
      12.391506
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-esb",
    "name": "Dekelia",
    "category": "Länder und Gebiete",
    "width": 22500.0,
    "height": 20100.0,
    "aliases": [
      "Dhekelia",
      "Dhekelia Cantonment",
      "-99"
    ],
    "bounds": [
      33.674099,
      34.937893,
      33.921474,
      35.118994
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-knx",
    "name": "Demilitarisierte Zone",
    "category": "Länder und Gebiete",
    "width": 152000.0,
    "height": 93600.0,
    "aliases": [
      "Korean DMZ (south)",
      "Korean Demilitarized Zone",
      "-99"
    ],
    "bounds": [
      126.660516,
      37.782183,
      128.394784,
      38.624335
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-knz",
    "name": "Demilitarisierte Zone",
    "category": "Länder und Gebiete",
    "width": 154000.0,
    "height": 98700.0,
    "aliases": [
      "Korean DMZ (north)",
      "Korean Demilitarized Zone",
      "-99"
    ],
    "bounds": [
      126.607083,
      37.787706,
      128.364919,
      38.675362
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-cod",
    "name": "Demokratische Republik Kongo",
    "category": "Länder und Gebiete",
    "width": 2120000.0,
    "height": 2090000.0,
    "aliases": [
      "Dem. Rep. Congo",
      "Democratic Republic of the Congo",
      "CD"
    ],
    "bounds": [
      12.210541,
      -13.458351,
      31.280447,
      5.37528
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-deu",
    "name": "Deutschland",
    "category": "Länder und Gebiete",
    "width": 639000.0,
    "height": 867000.0,
    "aliases": [
      "Germany",
      "Germany",
      "DE"
    ],
    "bounds": [
      5.85249,
      47.271121,
      15.022059,
      55.065334
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-bhb",
    "name": "Distrikt Brčko",
    "category": "Länder und Gebiete",
    "width": 17900.0,
    "height": 16400.0,
    "aliases": [
      "Brcko District",
      "Brčko",
      "-99"
    ],
    "bounds": [
      18.748038,
      44.7448,
      18.975409,
      44.892233
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-dma",
    "name": "Dominica",
    "category": "Länder und Gebiete",
    "width": 25700.0,
    "height": 48000.0,
    "aliases": [
      "Dominica",
      "Dominica",
      "DM"
    ],
    "bounds": [
      -61.488922,
      15.201809,
      -61.249257,
      15.633857
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-dom",
    "name": "Dominikanische Republik",
    "category": "Länder und Gebiete",
    "width": 388000.0,
    "height": 266000.0,
    "aliases": [
      "Dominican Rep.",
      "Dominican Republic",
      "DO"
    ],
    "bounds": [
      -72.009838,
      17.545559,
      -68.328603,
      19.93769
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-dji",
    "name": "Dschibuti",
    "category": "Länder und Gebiete",
    "width": 182000.0,
    "height": 198000.0,
    "aliases": [
      "Djibouti",
      "Djibouti",
      "DJ"
    ],
    "bounds": [
      41.74911,
      10.929825,
      43.418712,
      12.707913
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-dnk",
    "name": "Dänemark",
    "category": "Länder und Gebiete",
    "width": 437000.0,
    "height": 354000.0,
    "aliases": [
      "Denmark",
      "Denmark",
      "DK"
    ],
    "bounds": [
      8.094005,
      54.56859,
      15.151378,
      57.751166
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-ecu",
    "name": "Ecuador",
    "category": "Länder und Gebiete",
    "width": 1870000.0,
    "height": 742000.0,
    "aliases": [
      "Ecuador",
      "Ecuador",
      "EC"
    ],
    "bounds": [
      -92.011586,
      -5.011373,
      -75.227264,
      1.664374
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-slv",
    "name": "El Salvador",
    "category": "Länder und Gebiete",
    "width": 261000.0,
    "height": 143000.0,
    "aliases": [
      "El Salvador",
      "El Salvador",
      "SV"
    ],
    "bounds": [
      -90.114779,
      13.158637,
      -87.693194,
      14.445373
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-civ",
    "name": "Elfenbeinküste",
    "category": "Länder und Gebiete",
    "width": 674000.0,
    "height": 710000.0,
    "aliases": [
      "Côte d'Ivoire",
      "Ivory Coast",
      "CI"
    ],
    "bounds": [
      -8.61872,
      4.344062,
      -2.506328,
      10.726478
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-eng",
    "name": "England",
    "category": "Länder und Gebiete",
    "width": 545000.0,
    "height": 656000.0,
    "aliases": [
      "England",
      "England",
      "-99"
    ],
    "bounds": [
      -6.348948,
      49.909613,
      1.771169,
      55.805487
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-eri",
    "name": "Eritrea",
    "category": "Länder und Gebiete",
    "width": 719000.0,
    "height": 628000.0,
    "aliases": [
      "Eritrea",
      "Eritrea",
      "ER"
    ],
    "bounds": [
      36.423647,
      12.360022,
      43.123871,
      18.004828
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-est",
    "name": "Estland",
    "category": "Länder und Gebiete",
    "width": 368000.0,
    "height": 240000.0,
    "aliases": [
      "Estonia",
      "Estonia",
      "EE"
    ],
    "bounds": [
      21.832367,
      57.515819,
      28.186475,
      59.670885
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-swz",
    "name": "Eswatini",
    "category": "Länder und Gebiete",
    "width": 133000.0,
    "height": 176000.0,
    "aliases": [
      "eSwatini",
      "Eswatini",
      "SZ"
    ],
    "bounds": [
      30.782906,
      -27.316264,
      32.117398,
      -25.735999
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-flk",
    "name": "Falklandinseln",
    "category": "Länder und Gebiete",
    "width": 247000.0,
    "height": 153000.0,
    "aliases": [
      "Falkland Is.",
      "Falkland Islands",
      "FK"
    ],
    "bounds": [
      -61.318186,
      -52.406523,
      -57.734283,
      -51.027765
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-fji",
    "name": "Fidschi",
    "category": "Länder und Gebiete",
    "width": 765000.0,
    "height": 1030000.0,
    "aliases": [
      "Fiji",
      "Fiji",
      "FJ"
    ],
    "bounds": [
      174.588878,
      -21.711114,
      181.783865,
      -12.475274
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-fin",
    "name": "Finnland",
    "category": "Länder und Gebiete",
    "width": 515000.0,
    "height": 1140000.0,
    "aliases": [
      "Finland",
      "Finland",
      "FI"
    ],
    "bounds": [
      20.623165,
      59.811225,
      31.569525,
      70.07531
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-bfr",
    "name": "Flämisch-Brabant",
    "category": "Länder und Gebiete",
    "width": 237000.0,
    "height": 89800.0,
    "aliases": [
      "Flemish",
      "Flemish Brabant",
      "-99"
    ],
    "bounds": [
      2.5218,
      50.688726,
      5.910158,
      51.496238
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-fxx",
    "name": "Frankreich",
    "category": "Länder und Gebiete",
    "width": 1130000.0,
    "height": 1080000.0,
    "aliases": [
      "France",
      "France",
      "FR"
    ],
    "bounds": [
      -5.132802,
      41.365912,
      9.559581,
      51.087541
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-guf",
    "name": "Französisch-Guayana",
    "category": "Länder und Gebiete",
    "width": 329000.0,
    "height": 404000.0,
    "aliases": [
      "French Guiana",
      "French Guiana",
      "FR-973"
    ],
    "bounds": [
      -54.615292,
      2.110673,
      -51.649037,
      5.744765
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-pyf",
    "name": "Französisch-Polynesien",
    "category": "Länder und Gebiete",
    "width": 2070000.0,
    "height": 2190000.0,
    "aliases": [
      "Fr. Polynesia",
      "French Polynesia",
      "PF"
    ],
    "bounds": [
      -154.536977,
      -27.641209,
      -134.942983,
      -7.950128
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-atf",
    "name": "Französische Süd- und Antarktisgebiete",
    "category": "Länder und Gebiete",
    "width": 3620000.0,
    "height": 4240000.0,
    "aliases": [
      "Fr. S. Antarctic Lands",
      "French Southern and Antarctic Lands",
      "TF"
    ],
    "bounds": [
      39.728282,
      -49.721612,
      77.585216,
      -11.550632
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-fro",
    "name": "Färöer",
    "category": "Länder und Gebiete",
    "width": 71700.0,
    "height": 112000.0,
    "aliases": [
      "Faeroe Is.",
      "Faroe Islands",
      "FO"
    ],
    "bounds": [
      -7.644154,
      61.39411,
      -6.275787,
      62.398912
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-bhf",
    "name": "Föderation Bosnien und Herzegowina",
    "category": "Länder und Gebiete",
    "width": 268000.0,
    "height": 294000.0,
    "aliases": [
      "Fed. of Bos. & Herz.",
      "Federation of Bosnia and Herzegovina",
      "-99"
    ],
    "bounds": [
      15.716074,
      42.574393,
      19.057069,
      45.218533
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-fsm",
    "name": "Föderierte Staaten von Mikronesien",
    "category": "Länder und Gebiete",
    "width": 2770000.0,
    "height": 985000.0,
    "aliases": [
      "Micronesia",
      "Federated States of Micronesia",
      "FM"
    ],
    "bounds": [
      138.063813,
      0.918158,
      163.04656,
      9.77558
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-gab",
    "name": "Gabun",
    "category": "Länder und Gebiete",
    "width": 645000.0,
    "height": 696000.0,
    "aliases": [
      "Gabon",
      "Gabon",
      "GA"
    ],
    "bounds": [
      8.695567,
      -3.936856,
      14.498991,
      2.322495
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-gmb",
    "name": "Gambia",
    "category": "Länder und Gebiete",
    "width": 326000.0,
    "height": 83900.0,
    "aliases": [
      "Gambia",
      "The Gambia",
      "GM"
    ],
    "bounds": [
      -16.829701,
      13.065009,
      -13.818713,
      13.819984
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-gaz",
    "name": "Gazastreifen",
    "category": "Länder und Gebiete",
    "width": 33800.0,
    "height": 41300.0,
    "aliases": [
      "Gaza",
      "Gaza Strip",
      "-99"
    ],
    "bounds": [
      34.200269,
      31.211449,
      34.556032,
      31.583141
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-geg",
    "name": "Georgien",
    "category": "Länder und Gebiete",
    "width": 552000.0,
    "height": 282000.0,
    "aliases": [
      "Georgia",
      "Georgia",
      "-99"
    ],
    "bounds": [
      39.985976,
      41.044111,
      46.694803,
      43.575843
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-gha",
    "name": "Ghana",
    "category": "Länder und Gebiete",
    "width": 490000.0,
    "height": 715000.0,
    "aliases": [
      "Ghana",
      "Ghana",
      "GH"
    ],
    "bounds": [
      -3.262509,
      4.737128,
      1.187968,
      11.162937
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-gib",
    "name": "Gibraltar",
    "category": "Länder und Gebiete",
    "width": 1760.0,
    "height": 3400.0,
    "aliases": [
      "Gibraltar",
      "Gibraltar",
      "GI"
    ],
    "bounds": [
      -5.358387,
      36.1105,
      -5.338773,
      36.14112
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-grd",
    "name": "Grenada",
    "category": "Länder und Gebiete",
    "width": 40100.0,
    "height": 58600.0,
    "aliases": [
      "Grenada",
      "Grenada",
      "GD"
    ],
    "bounds": [
      -61.790517,
      12.002834,
      -61.42162,
      12.529731
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-grc",
    "name": "Griechenland",
    "category": "Länder und Gebiete",
    "width": 752000.0,
    "height": 771000.0,
    "aliases": [
      "Greece",
      "Greece",
      "GR"
    ],
    "bounds": [
      19.626475,
      34.815009,
      28.239757,
      41.750476
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-grl",
    "name": "Grönland",
    "category": "Länder und Gebiete",
    "width": 2150000.0,
    "height": 2650000.0,
    "aliases": [
      "Greenland",
      "Greenland",
      "GL"
    ],
    "bounds": [
      -73.05724,
      59.792629,
      -11.37682,
      83.634101
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-glp",
    "name": "Guadeloupe",
    "category": "Länder und Gebiete",
    "width": 86400.0,
    "height": 74100.0,
    "aliases": [
      "Guadeloupe",
      "Guadeloupe",
      "FR-971"
    ],
    "bounds": [
      -61.797841,
      15.846991,
      -60.989247,
      16.513088
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-gum",
    "name": "Guam",
    "category": "Länder und Gebiete",
    "width": 35500.0,
    "height": 45900.0,
    "aliases": [
      "Guam",
      "Guam",
      "GU"
    ],
    "bounds": [
      144.624197,
      13.241034,
      144.952159,
      13.65412
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-usg",
    "name": "Guantanamo Bay Naval Base",
    "category": "Länder und Gebiete",
    "width": 14400.0,
    "height": 8940.0,
    "aliases": [
      "USNB Guantanamo Bay",
      "Guantanamo Bay Naval Base",
      "-99"
    ],
    "bounds": [
      -75.232859,
      19.891142,
      -75.09495,
      19.971584
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-gtm",
    "name": "Guatemala",
    "category": "Länder und Gebiete",
    "width": 431000.0,
    "height": 454000.0,
    "aliases": [
      "Guatemala",
      "Guatemala",
      "GT"
    ],
    "bounds": [
      -92.246257,
      13.731404,
      -88.220937,
      17.81602
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-ggy",
    "name": "Guernsey",
    "category": "Länder und Gebiete",
    "width": 36300.0,
    "height": 35600.0,
    "aliases": [
      "Guernsey",
      "Guernsey",
      "GG"
    ],
    "bounds": [
      -2.673451,
      49.411566,
      -2.170318,
      49.731391
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-gin",
    "name": "Guinea",
    "category": "Länder und Gebiete",
    "width": 813000.0,
    "height": 610000.0,
    "aliases": [
      "Guinea",
      "Guinea",
      "GN"
    ],
    "bounds": [
      -15.081125,
      7.190208,
      -7.662447,
      12.673388
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-gnb",
    "name": "Guinea-Bissau",
    "category": "Länder und Gebiete",
    "width": 334000.0,
    "height": 195000.0,
    "aliases": [
      "Guinea-Bissau",
      "Guinea-Bissau",
      "GW"
    ],
    "bounds": [
      -16.728437,
      10.927639,
      -13.660712,
      12.679434
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-guy",
    "name": "Guyana",
    "category": "Länder und Gebiete",
    "width": 545000.0,
    "height": 820000.0,
    "aliases": [
      "Guyana",
      "Guyana",
      "GY"
    ],
    "bounds": [
      -61.396713,
      1.18582,
      -56.481819,
      8.55801
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-hti",
    "name": "Haiti",
    "category": "Länder und Gebiete",
    "width": 300000.0,
    "height": 229000.0,
    "aliases": [
      "Haiti",
      "Haiti",
      "HT"
    ],
    "bounds": [
      -74.489166,
      18.025946,
      -71.639111,
      20.089789
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-hmd",
    "name": "Heard und McDonaldinseln",
    "category": "Länder und Gebiete",
    "width": 38500.0,
    "height": 25700.0,
    "aliases": [
      "Heard I. and McDonald Is.",
      "Heard Island and McDonald Islands",
      "HM"
    ],
    "bounds": [
      73.236013,
      -53.19256,
      73.812185,
      -52.961602
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-hnd",
    "name": "Honduras",
    "category": "Länder und Gebiete",
    "width": 669000.0,
    "height": 494000.0,
    "aliases": [
      "Honduras",
      "Honduras",
      "HN"
    ],
    "bounds": [
      -89.363791,
      12.979777,
      -83.130444,
      17.418647
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-hkg",
    "name": "Hongkong",
    "category": "Länder und Gebiete",
    "width": 58000.0,
    "height": 43000.0,
    "aliases": [
      "Hong Kong",
      "Hong Kong",
      "HK"
    ],
    "bounds": [
      113.837332,
      22.177069,
      114.401296,
      22.563946
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-hqi",
    "name": "Howlandinsel",
    "category": "Länder und Gebiete",
    "width": 489.0,
    "height": 1860.0,
    "aliases": [
      "Howland I.",
      "Howland Island",
      "-99"
    ],
    "bounds": [
      -176.640492,
      0.790188,
      -176.636098,
      0.806952
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-ind",
    "name": "Indien",
    "category": "Länder und Gebiete",
    "width": 3030000.0,
    "height": 3200000.0,
    "aliases": [
      "India",
      "India",
      "IN"
    ],
    "bounds": [
      68.143403,
      6.745551,
      97.362253,
      35.495406
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-idn",
    "name": "Indonesien",
    "category": "Länder und Gebiete",
    "width": 5110000.0,
    "height": 1870000.0,
    "aliases": [
      "Indonesia",
      "Indonesia",
      "ID"
    ],
    "bounds": [
      95.012706,
      -10.922621,
      140.977627,
      5.910102
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-irr",
    "name": "Irak",
    "category": "Länder und Gebiete",
    "width": 912000.0,
    "height": 889000.0,
    "aliases": [
      "Iraq",
      "Iraq",
      "-99"
    ],
    "bounds": [
      38.774511,
      29.063137,
      48.559255,
      37.062001
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-irn",
    "name": "Iran",
    "category": "Länder und Gebiete",
    "width": 1810000.0,
    "height": 1640000.0,
    "aliases": [
      "Iran",
      "Iran",
      "IR"
    ],
    "bounds": [
      44.014863,
      25.059408,
      63.319628,
      39.771527
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-irl",
    "name": "Irland",
    "category": "Länder und Gebiete",
    "width": 297000.0,
    "height": 438000.0,
    "aliases": [
      "Ireland",
      "Ireland",
      "IE"
    ],
    "bounds": [
      -10.478179,
      51.445705,
      -5.99352,
      55.386379
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-bri",
    "name": "Isla Brasilera",
    "category": "Länder und Gebiete",
    "width": 3810.0,
    "height": 1130.0,
    "aliases": [
      "Brazilian I.",
      "Brazilian Island",
      "-99"
    ],
    "bounds": [
      -57.642466,
      -30.193092,
      -57.602793,
      -30.182963
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-isl",
    "name": "Island",
    "category": "Länder und Gebiete",
    "width": 519000.0,
    "height": 352000.0,
    "aliases": [
      "Iceland",
      "Iceland",
      "IS"
    ],
    "bounds": [
      -24.539906,
      63.396715,
      -13.502919,
      66.564154
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-imn",
    "name": "Isle of Man",
    "category": "Länder und Gebiete",
    "width": 31100.0,
    "height": 40300.0,
    "aliases": [
      "Isle of Man",
      "Isle of Man",
      "IM"
    ],
    "bounds": [
      -4.790151,
      54.056952,
      -4.31192,
      54.419013
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-isr",
    "name": "Israel",
    "category": "Länder und Gebiete",
    "width": 156000.0,
    "height": 436000.0,
    "aliases": [
      "Israel",
      "Israel",
      "IL"
    ],
    "bounds": [
      34.248351,
      29.489691,
      35.888073,
      33.406722
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-ita",
    "name": "Italien",
    "category": "Länder und Gebiete",
    "width": 996000.0,
    "height": 1290000.0,
    "aliases": [
      "Italy",
      "Italy",
      "IT"
    ],
    "bounds": [
      6.602728,
      35.489244,
      18.517426,
      47.085215
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-jam",
    "name": "Jamaika",
    "category": "Länder und Gebiete",
    "width": 231000.0,
    "height": 91400.0,
    "aliases": [
      "Jamaica",
      "Jamaica",
      "JM"
    ],
    "bounds": [
      -78.374664,
      17.703192,
      -76.187978,
      18.525092
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-njm",
    "name": "Jan Mayen",
    "category": "Länder und Gebiete",
    "width": 42700.0,
    "height": 41500.0,
    "aliases": [
      "Jan Mayen I.",
      "Jan Mayen",
      "-99"
    ],
    "bounds": [
      -9.117421,
      70.806708,
      -7.938466,
      71.180365
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-jpn",
    "name": "Japan",
    "category": "Länder und Gebiete",
    "width": 2830000.0,
    "height": 2370000.0,
    "aliases": [
      "Japan",
      "Japan",
      "JP"
    ],
    "bounds": [
      122.938162,
      24.212104,
      153.985606,
      45.520413
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-dqi",
    "name": "Jarvisinsel",
    "category": "Länder und Gebiete",
    "width": 2340.0,
    "height": 1810.0,
    "aliases": [
      "Jarvis I.",
      "Jarvis Island",
      "-99"
    ],
    "bounds": [
      -160.029978,
      -0.388767,
      -160.008901,
      -0.372491
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-yem",
    "name": "Jemen",
    "category": "Länder und Gebiete",
    "width": 1280000.0,
    "height": 765000.0,
    "aliases": [
      "Yemen",
      "Yemen",
      "YE"
    ],
    "bounds": [
      42.545746,
      12.111444,
      54.540294,
      18.995638
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-jey",
    "name": "Jersey",
    "category": "Länder und Gebiete",
    "width": 17000.0,
    "height": 10600.0,
    "aliases": [
      "Jersey",
      "Jersey",
      "JE"
    ],
    "bounds": [
      -2.242014,
      49.171332,
      -2.00829,
      49.267035
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-jqi",
    "name": "Johnston-Atoll",
    "category": "Länder und Gebiete",
    "width": 3910.0,
    "height": 4620.0,
    "aliases": [
      "Johnston Atoll",
      "Johnston Atoll",
      "-99"
    ],
    "bounds": [
      -169.549509,
      16.721015,
      -169.512766,
      16.7626
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-jor",
    "name": "Jordanien",
    "category": "Länder und Gebiete",
    "width": 413000.0,
    "height": 465000.0,
    "aliases": [
      "Jordan",
      "Jordan",
      "JO"
    ],
    "bounds": [
      34.949385,
      29.189951,
      39.291999,
      33.371685
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-khm",
    "name": "Kambodscha",
    "category": "Länder und Gebiete",
    "width": 575000.0,
    "height": 477000.0,
    "aliases": [
      "Cambodia",
      "Cambodia",
      "KH"
    ],
    "bounds": [
      102.313424,
      10.415774,
      107.610516,
      14.704582
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-cmr",
    "name": "Kamerun",
    "category": "Länder und Gebiete",
    "width": 849000.0,
    "height": 1270000.0,
    "aliases": [
      "Cameroon",
      "Cameroon",
      "CM"
    ],
    "bounds": [
      8.505056,
      1.654551,
      16.207723,
      13.081141
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-can",
    "name": "Kanada",
    "category": "Länder und Gebiete",
    "width": 4550000.0,
    "height": 4610000.0,
    "aliases": [
      "Canada",
      "Canada",
      "CA"
    ],
    "bounds": [
      -141.005564,
      41.669086,
      -52.616607,
      83.116523
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-cpv",
    "name": "Kap Verde",
    "category": "Länder und Gebiete",
    "width": 288000.0,
    "height": 266000.0,
    "aliases": [
      "Cabo Verde",
      "Cape Verde",
      "CV"
    ],
    "bounds": [
      -25.360422,
      14.803941,
      -22.666575,
      17.196601
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-nly",
    "name": "Karibische Niederlande",
    "category": "Länder und Gebiete",
    "width": 588000.0,
    "height": 625000.0,
    "aliases": [
      "Caribbean Netherlands",
      "Caribbean Netherlands",
      "BQ"
    ],
    "bounds": [
      -68.417388,
      12.02204,
      -62.945065,
      17.646918
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-kaz",
    "name": "Kasachstan",
    "category": "Länder und Gebiete",
    "width": 3040000.0,
    "height": 1650000.0,
    "aliases": [
      "Kazakhstan",
      "Kazakhstan",
      "KZ"
    ],
    "bounds": [
      46.478279,
      40.584656,
      87.323796,
      55.43455
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-qat",
    "name": "Katar",
    "category": "Länder und Gebiete",
    "width": 87000.0,
    "height": 178000.0,
    "aliases": [
      "Qatar",
      "Qatar",
      "QA"
    ],
    "bounds": [
      50.750987,
      24.559872,
      51.616547,
      26.160102
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-ken",
    "name": "Kenia",
    "category": "Länder und Gebiete",
    "width": 889000.0,
    "height": 1080000.0,
    "aliases": [
      "Kenya",
      "Kenya",
      "KE"
    ],
    "bounds": [
      33.890468,
      -4.677504,
      41.885019,
      5.030376
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-kqi",
    "name": "Kingmanriff",
    "category": "Länder und Gebiete",
    "width": 1650.0,
    "height": 1660.0,
    "aliases": [
      "Kingman Reef",
      "Kingman Reef",
      "-99"
    ],
    "bounds": [
      -162.400177,
      6.430243,
      -162.385284,
      6.445136
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-kgz",
    "name": "Kirgisistan",
    "category": "Länder und Gebiete",
    "width": 923000.0,
    "height": 453000.0,
    "aliases": [
      "Kyrgyzstan",
      "Kyrgyzstan",
      "KG"
    ],
    "bounds": [
      69.226296,
      39.189237,
      80.257561,
      43.261702
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-kir",
    "name": "Kiribati",
    "category": "Länder und Gebiete",
    "width": 4300000.0,
    "height": 1800000.0,
    "aliases": [
      "Kiribati",
      "Kiribati",
      "KI"
    ],
    "bounds": [
      169.522146,
      -11.461114,
      208.219045,
      4.72309
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-cck",
    "name": "Kokosinseln",
    "category": "Länder und Gebiete",
    "width": 10800.0,
    "height": 8160.0,
    "aliases": [
      "Cocos Is.",
      "Cocos",
      "CC"
    ],
    "bounds": [
      96.821544,
      -12.199965,
      96.921072,
      -12.12656
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-col",
    "name": "Kolumbien",
    "category": "Länder und Gebiete",
    "width": 1650000.0,
    "height": 1980000.0,
    "aliases": [
      "Colombia",
      "Colombia",
      "CO"
    ],
    "bounds": [
      -81.723704,
      -4.236484,
      -66.875061,
      13.578355
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-com",
    "name": "Komoren",
    "category": "Länder und Gebiete",
    "width": 143000.0,
    "height": 113000.0,
    "aliases": [
      "Comoros",
      "Comoros",
      "KM"
    ],
    "bounds": [
      43.213227,
      -12.380304,
      44.529063,
      -11.361261
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-csi",
    "name": "Korallenmeerinseln",
    "category": "Länder und Gebiete",
    "width": 287.0,
    "height": 145.0,
    "aliases": [
      "Coral Sea Is.",
      "Coral Sea Islands",
      "-99"
    ],
    "bounds": [
      154.38852,
      -21.030043,
      154.391287,
      -21.028741
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-kos",
    "name": "Kosovo",
    "category": "Länder und Gebiete",
    "width": 143000.0,
    "height": 158000.0,
    "aliases": [
      "Kosovo",
      "Kosovo",
      "-99"
    ],
    "bounds": [
      20.024751,
      41.84401,
      21.772758,
      43.263071
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-hrv",
    "name": "Kroatien",
    "category": "Länder und Gebiete",
    "width": 469000.0,
    "height": 459000.0,
    "aliases": [
      "Croatia",
      "Croatia",
      "HR"
    ],
    "bounds": [
      13.501475,
      42.416327,
      19.407838,
      46.546979
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-cub",
    "name": "Kuba",
    "category": "Länder und Gebiete",
    "width": 1120000.0,
    "height": 382000.0,
    "aliases": [
      "Cuba",
      "Cuba",
      "CU"
    ],
    "bounds": [
      -84.949615,
      19.827826,
      -74.132883,
      23.26557
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-kwt",
    "name": "Kuwait",
    "category": "Länder und Gebiete",
    "width": 184000.0,
    "height": 174000.0,
    "aliases": [
      "Kuwait",
      "Kuwait",
      "KW"
    ],
    "bounds": [
      46.532436,
      28.533505,
      48.432781,
      30.098216
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-lao",
    "name": "Laos",
    "category": "Länder und Gebiete",
    "width": 799000.0,
    "height": 954000.0,
    "aliases": [
      "Laos",
      "Laos",
      "LA"
    ],
    "bounds": [
      100.097073,
      13.915457,
      107.664363,
      22.496044
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-lso",
    "name": "Lesotho",
    "category": "Länder und Gebiete",
    "width": 235000.0,
    "height": 232000.0,
    "aliases": [
      "Lesotho",
      "Lesotho",
      "LS"
    ],
    "bounds": [
      27.002155,
      -30.658799,
      29.435908,
      -28.570761
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-lva",
    "name": "Lettland",
    "category": "Länder und Gebiete",
    "width": 441000.0,
    "height": 268000.0,
    "aliases": [
      "Latvia",
      "Latvia",
      "LV"
    ],
    "bounds": [
      20.968598,
      55.666991,
      28.217275,
      58.075138
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-lbn",
    "name": "Libanon",
    "category": "Länder und Gebiete",
    "width": 139000.0,
    "height": 181000.0,
    "aliases": [
      "Lebanon",
      "Lebanon",
      "LB"
    ],
    "bounds": [
      35.09962,
      33.05558,
      36.604101,
      34.687548
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-lbr",
    "name": "Liberia",
    "category": "Länder und Gebiete",
    "width": 452000.0,
    "height": 469000.0,
    "aliases": [
      "Liberia",
      "Liberia",
      "LR"
    ],
    "bounds": [
      -11.476186,
      4.347235,
      -7.384118,
      8.565396
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-lby",
    "name": "Libyen",
    "category": "Länder und Gebiete",
    "width": 1580000.0,
    "height": 1520000.0,
    "aliases": [
      "Libya",
      "Libya",
      "LY"
    ],
    "bounds": [
      9.286544,
      19.496124,
      25.156261,
      33.181225
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-lie",
    "name": "Liechtenstein",
    "category": "Länder und Gebiete",
    "width": 10600.0,
    "height": 23400.0,
    "aliases": [
      "Liechtenstein",
      "Liechtenstein",
      "LI"
    ],
    "bounds": [
      9.475886,
      47.0524,
      9.615723,
      47.262801
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-ltu",
    "name": "Litauen",
    "category": "Länder und Gebiete",
    "width": 373000.0,
    "height": 284000.0,
    "aliases": [
      "Lithuania",
      "Lithuania",
      "LT"
    ],
    "bounds": [
      20.924569,
      53.886841,
      26.80072,
      56.442602
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-lux",
    "name": "Luxemburg",
    "category": "Länder und Gebiete",
    "width": 56500.0,
    "height": 81600.0,
    "aliases": [
      "Luxembourg",
      "Luxembourg",
      "LU"
    ],
    "bounds": [
      5.714927,
      49.441324,
      6.502579,
      50.174975
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-mac",
    "name": "Macau",
    "category": "Länder und Gebiete",
    "width": 6960.0,
    "height": 12800.0,
    "aliases": [
      "Macao",
      "Macau",
      "MO"
    ],
    "bounds": [
      113.519867,
      22.105373,
      113.587494,
      22.220771
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-mdg",
    "name": "Madagaskar",
    "category": "Länder und Gebiete",
    "width": 767000.0,
    "height": 1520000.0,
    "aliases": [
      "Madagascar",
      "Madagascar",
      "MG"
    ],
    "bounds": [
      43.222911,
      -25.598565,
      50.503917,
      -11.943617
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-mwi",
    "name": "Malawi",
    "category": "Länder und Gebiete",
    "width": 351000.0,
    "height": 862000.0,
    "aliases": [
      "Malawi",
      "Malawi",
      "MW"
    ],
    "bounds": [
      32.663308,
      -17.135335,
      35.904299,
      -9.381235
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-mys",
    "name": "Malaysia",
    "category": "Länder und Gebiete",
    "width": 2180000.0,
    "height": 723000.0,
    "aliases": [
      "Malaysia",
      "Malaysia",
      "MY"
    ],
    "bounds": [
      99.645228,
      0.85137,
      119.278087,
      7.35578
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-mdv",
    "name": "Malediven",
    "category": "Länder und Gebiete",
    "width": 119000.0,
    "height": 867000.0,
    "aliases": [
      "Maldives",
      "Maldives",
      "MV"
    ],
    "bounds": [
      72.684825,
      -0.688572,
      73.753184,
      7.107245
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-mli",
    "name": "Mali",
    "category": "Länder und Gebiete",
    "width": 1750000.0,
    "height": 1650000.0,
    "aliases": [
      "Mali",
      "Mali",
      "ML"
    ],
    "bounds": [
      -12.26413,
      10.140054,
      4.235638,
      24.995065
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-mlt",
    "name": "Malta",
    "category": "Länder und Gebiete",
    "width": 34500.0,
    "height": 30500.0,
    "aliases": [
      "Malta",
      "Malta",
      "MT"
    ],
    "bounds": [
      14.183604,
      35.801215,
      14.567149,
      36.075588
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-mar",
    "name": "Marokko",
    "category": "Länder und Gebiete",
    "width": 1560000.0,
    "height": 1610000.0,
    "aliases": [
      "Morocco",
      "Morocco",
      "MA"
    ],
    "bounds": [
      -17.013743,
      21.419971,
      -1.031999,
      35.926519
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-mhl",
    "name": "Marshallinseln",
    "category": "Länder und Gebiete",
    "width": 740000.0,
    "height": 1120000.0,
    "aliases": [
      "Marshall Is.",
      "Marshall Islands",
      "MH"
    ],
    "bounds": [
      165.282237,
      4.573798,
      172.029796,
      14.6105
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-mtq",
    "name": "Martinique",
    "category": "Länder und Gebiete",
    "width": 45000.0,
    "height": 52100.0,
    "aliases": [
      "Martinique",
      "Martinique",
      "FR-972"
    ],
    "bounds": [
      -61.228831,
      14.408108,
      -60.810414,
      14.876899
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-mrt",
    "name": "Mauretanien",
    "category": "Länder und Gebiete",
    "width": 1270000.0,
    "height": 1400000.0,
    "aliases": [
      "Mauritania",
      "Mauritania",
      "MR"
    ],
    "bounds": [
      -17.081175,
      14.734399,
      -4.821613,
      27.285416
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-mus",
    "name": "Mauritius",
    "category": "Länder und Gebiete",
    "width": 747000.0,
    "height": 1130000.0,
    "aliases": [
      "Mauritius",
      "Mauritius",
      "MU"
    ],
    "bounds": [
      56.524181,
      -20.517348,
      63.493907,
      -10.323907
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-myt",
    "name": "Mayotte",
    "category": "Länder und Gebiete",
    "width": 26900.0,
    "height": 38000.0,
    "aliases": [
      "Mayotte",
      "Mayotte",
      "FR-976"
    ],
    "bounds": [
      45.042491,
      -12.98919,
      45.290863,
      -12.647231
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-mex",
    "name": "Mexiko",
    "category": "Länder und Gebiete",
    "width": 3230000.0,
    "height": 2020000.0,
    "aliases": [
      "Mexico",
      "Mexico",
      "MX"
    ],
    "bounds": [
      -118.368804,
      14.546279,
      -86.700592,
      32.712836
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-mqi",
    "name": "Midwayinseln",
    "category": "Länder und Gebiete",
    "width": 6710.0,
    "height": 1960.0,
    "aliases": [
      "Midway Is.",
      "Midway Atoll",
      "-99"
    ],
    "bounds": [
      -177.389597,
      28.197659,
      -177.321156,
      28.215318
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-mco",
    "name": "Monaco",
    "category": "Länder und Gebiete",
    "width": 5760.0,
    "height": 5060.0,
    "aliases": [
      "Monaco",
      "Monaco",
      "MC"
    ],
    "bounds": [
      7.36575,
      43.717969,
      7.437454,
      43.763506
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-mng",
    "name": "Mongolei",
    "category": "Länder und Gebiete",
    "width": 2450000.0,
    "height": 1170000.0,
    "aliases": [
      "Mongolia",
      "Mongolia",
      "MN"
    ],
    "bounds": [
      87.735709,
      41.586145,
      119.907027,
      52.129584
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-mne",
    "name": "Montenegro",
    "category": "Länder und Gebiete",
    "width": 157000.0,
    "height": 189000.0,
    "aliases": [
      "Montenegro",
      "Montenegro",
      "ME"
    ],
    "bounds": [
      18.433531,
      41.852362,
      20.355171,
      43.547886
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-msr",
    "name": "Montserrat",
    "category": "Länder und Gebiete",
    "width": 9540.0,
    "height": 16000.0,
    "aliases": [
      "Montserrat",
      "Montserrat",
      "MS"
    ],
    "bounds": [
      -62.230133,
      16.67536,
      -62.140533,
      16.819322
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-moz",
    "name": "Mosambik",
    "category": "Länder und Gebiete",
    "width": 1120000.0,
    "height": 1820000.0,
    "aliases": [
      "Mozambique",
      "Mozambique",
      "MZ"
    ],
    "bounds": [
      30.213845,
      -26.860272,
      40.847992,
      -10.469008
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-mmr",
    "name": "Myanmar",
    "category": "Länder und Gebiete",
    "width": 945000.0,
    "height": 2080000.0,
    "aliases": [
      "Myanmar",
      "Myanmar",
      "MM"
    ],
    "bounds": [
      92.174973,
      9.790717,
      101.173855,
      28.538466
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-nam",
    "name": "Namibia",
    "category": "Länder und Gebiete",
    "width": 1390000.0,
    "height": 1340000.0,
    "aliases": [
      "Namibia",
      "Namibia",
      "NA"
    ],
    "bounds": [
      11.717621,
      -28.959368,
      25.259781,
      -16.951057
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-nru",
    "name": "Nauru",
    "category": "Länder und Gebiete",
    "width": 5700.0,
    "height": 6830.0,
    "aliases": [
      "Nauru",
      "Nauru",
      "NR"
    ],
    "bounds": [
      166.906993,
      -0.551853,
      166.958263,
      -0.490411
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-bqi",
    "name": "Navassa",
    "category": "Länder und Gebiete",
    "width": 2980.0,
    "height": 2470.0,
    "aliases": [
      "Navassa I.",
      "Navassa Island",
      "-99"
    ],
    "bounds": [
      -75.030832,
      18.395006,
      -75.002634,
      18.417263
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-npl",
    "name": "Nepal",
    "category": "Länder und Gebiete",
    "width": 796000.0,
    "height": 453000.0,
    "aliases": [
      "Nepal",
      "Nepal",
      "NP"
    ],
    "bounds": [
      80.030288,
      26.343768,
      88.169067,
      30.416904
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-ncl",
    "name": "Neukaledonien",
    "category": "Länder und Gebiete",
    "width": 801000.0,
    "height": 339000.0,
    "aliases": [
      "New Caledonia",
      "New Caledonia",
      "NC"
    ],
    "bounds": [
      163.615733,
      -22.670668,
      171.343765,
      -19.623712
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-nzl",
    "name": "Neuseeland",
    "category": "Länder und Gebiete",
    "width": 1510000.0,
    "height": 2600000.0,
    "aliases": [
      "New Zealand",
      "New Zealand",
      "NZ"
    ],
    "bounds": [
      165.886485,
      -52.600313,
      183.886119,
      -29.221938
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-nic",
    "name": "Nicaragua",
    "category": "Länder und Gebiete",
    "width": 538000.0,
    "height": 480000.0,
    "aliases": [
      "Nicaragua",
      "Nicaragua",
      "NI"
    ],
    "bounds": [
      -87.685821,
      10.713482,
      -82.725697,
      15.03097
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-nlx",
    "name": "Niederlande",
    "category": "Länder und Gebiete",
    "width": 263000.0,
    "height": 313000.0,
    "aliases": [
      "Netherlands",
      "Netherlands",
      "-99"
    ],
    "bounds": [
      3.349415,
      50.74755,
      7.198506,
      53.558092
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-ner",
    "name": "Niger",
    "category": "Länder und Gebiete",
    "width": 1680000.0,
    "height": 1310000.0,
    "aliases": [
      "Niger",
      "Niger",
      "NE"
    ],
    "bounds": [
      0.152941,
      11.695773,
      15.970322,
      23.517351
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-nga",
    "name": "Nigeria",
    "category": "Länder und Gebiete",
    "width": 1320000.0,
    "height": 1070000.0,
    "aliases": [
      "Nigeria",
      "Nigeria",
      "NG"
    ],
    "bounds": [
      2.671082,
      4.272162,
      14.669936,
      13.880291
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-niu",
    "name": "Niue",
    "category": "Länder und Gebiete",
    "width": 17600.0,
    "height": 19900.0,
    "aliases": [
      "Niue",
      "Niue",
      "NU"
    ],
    "bounds": [
      -169.950429,
      -19.142755,
      -169.782908,
      -18.964044
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-nir",
    "name": "Nordirland",
    "category": "Länder und Gebiete",
    "width": 176000.0,
    "height": 142000.0,
    "aliases": [
      "N. Ireland",
      "Northern Ireland",
      "-99"
    ],
    "bounds": [
      -8.173837,
      54.034573,
      -5.430776,
      55.311347
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-prk",
    "name": "Nordkorea",
    "category": "Länder und Gebiete",
    "width": 550000.0,
    "height": 593000.0,
    "aliases": [
      "North Korea",
      "North Korea",
      "KP"
    ],
    "bounds": [
      124.211316,
      37.675605,
      130.699962,
      43.01027
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-mkd",
    "name": "Nordmazedonien",
    "category": "Länder und Gebiete",
    "width": 213000.0,
    "height": 169000.0,
    "aliases": [
      "North Macedonia",
      "North Macedonia",
      "MK"
    ],
    "bounds": [
      20.444157,
      40.849394,
      23.009582,
      42.370335
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-nfk",
    "name": "Norfolkinsel",
    "category": "Länder und Gebiete",
    "width": 8190.0,
    "height": 9180.0,
    "aliases": [
      "Norfolk Island",
      "Norfolk Island",
      "NF"
    ],
    "bounds": [
      167.91212,
      -29.080011,
      167.996349,
      -28.997491
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-now",
    "name": "Norwegen",
    "category": "Länder und Gebiete",
    "width": 1260000.0,
    "height": 1460000.0,
    "aliases": [
      "Norway",
      "Norway",
      "NO"
    ],
    "bounds": [
      4.643809,
      57.99315,
      31.076996,
      71.165269
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-mnp",
    "name": "Nördliche Marianen",
    "category": "Länder und Gebiete",
    "width": 103000.0,
    "height": 717000.0,
    "aliases": [
      "N. Mariana Is.",
      "Northern Mariana Islands",
      "MP"
    ],
    "bounds": [
      144.90211,
      14.110663,
      145.868907,
      20.555406
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-omn",
    "name": "Oman",
    "category": "Länder und Gebiete",
    "width": 814000.0,
    "height": 1080000.0,
    "aliases": [
      "Oman",
      "Oman",
      "OM"
    ],
    "bounds": [
      51.978615,
      16.642401,
      59.844574,
      26.385972
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-tls",
    "name": "Osttimor",
    "category": "Länder und Gebiete",
    "width": 361000.0,
    "height": 152000.0,
    "aliases": [
      "Timor-Leste",
      "East Timor",
      "TL"
    ],
    "bounds": [
      124.03004,
      -9.501228,
      127.313243,
      -8.135024
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-pak",
    "name": "Pakistan",
    "category": "Länder und Gebiete",
    "width": 1550000.0,
    "height": 1490000.0,
    "aliases": [
      "Pakistan",
      "Pakistan",
      "PK"
    ],
    "bounds": [
      60.844379,
      23.694525,
      77.048971,
      37.054484
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-plw",
    "name": "Palau",
    "category": "Länder und Gebiete",
    "width": 398000.0,
    "height": 572000.0,
    "aliases": [
      "Palau",
      "Palau",
      "PW"
    ],
    "bounds": [
      131.131114,
      2.949042,
      134.727343,
      8.096618
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-lqi",
    "name": "Palmyra",
    "category": "Länder und Gebiete",
    "width": 5090.0,
    "height": 2320.0,
    "aliases": [
      "Palmyra Atoll",
      "Palmyra Atoll",
      "-99"
    ],
    "bounds": [
      -162.103627,
      5.869371,
      -162.057607,
      5.890245
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-pan",
    "name": "Panama",
    "category": "Länder und Gebiete",
    "width": 648000.0,
    "height": 269000.0,
    "aliases": [
      "Panama",
      "Panama",
      "PA"
    ],
    "bounds": [
      -83.053246,
      7.205715,
      -77.16327,
      9.629292
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-pnx",
    "name": "Papua-Neuguinea",
    "category": "Länder und Gebiete",
    "width": 1490000.0,
    "height": 1140000.0,
    "aliases": [
      "Papua New Guinea",
      "Papua New Guinea",
      "-99"
    ],
    "bounds": [
      140.849211,
      -11.636326,
      154.302257,
      -1.346368
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-pfa",
    "name": "Paracel-Inseln",
    "category": "Länder und Gebiete",
    "width": 165000.0,
    "height": 129000.0,
    "aliases": [
      "Paracel Is.",
      "Paracel Islands",
      "-99"
    ],
    "bounds": [
      111.192882,
      15.775377,
      112.736827,
      16.933254
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-pry",
    "name": "Paraguay",
    "category": "Länder und Gebiete",
    "width": 857000.0,
    "height": 923000.0,
    "aliases": [
      "Paraguay",
      "Paraguay",
      "PY"
    ],
    "bounds": [
      -62.650357,
      -27.586842,
      -54.245289,
      -19.286729
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-per",
    "name": "Peru",
    "category": "Länder und Gebiete",
    "width": 1390000.0,
    "height": 2040000.0,
    "aliases": [
      "Peru",
      "Peru",
      "PE"
    ],
    "bounds": [
      -81.337558,
      -18.337746,
      -68.684252,
      -0.029093
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-phl",
    "name": "Philippinen",
    "category": "Länder und Gebiete",
    "width": 1050000.0,
    "height": 1830000.0,
    "aliases": [
      "Philippines",
      "Philippines",
      "PH"
    ],
    "bounds": [
      116.954926,
      4.655707,
      126.617686,
      21.122382
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-pcn",
    "name": "Pitcairninseln",
    "category": "Länder und Gebiete",
    "width": 605000.0,
    "height": 128000.0,
    "aliases": [
      "Pitcairn Is.",
      "Pitcairn Islands",
      "PN"
    ],
    "bounds": [
      -130.753082,
      -25.077081,
      -124.778066,
      -23.924412
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-pol",
    "name": "Polen",
    "category": "Länder und Gebiete",
    "width": 687000.0,
    "height": 650000.0,
    "aliases": [
      "Poland",
      "Poland",
      "PL"
    ],
    "bounds": [
      14.123923,
      48.994013,
      24.143156,
      54.838324
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-prx",
    "name": "Portugal",
    "category": "Länder und Gebiete",
    "width": 282000.0,
    "height": 577000.0,
    "aliases": [
      "Portugal",
      "Portugal",
      "-99"
    ],
    "bounds": [
      -9.497467,
      36.965888,
      -6.205947,
      42.15363
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-bwr",
    "name": "Provinz Wallonisch-Brabant",
    "category": "Länder und Gebiete",
    "width": 252000.0,
    "height": 146000.0,
    "aliases": [
      "Walloon",
      "Walloon Brabant",
      "-99"
    ],
    "bounds": [
      2.842193,
      49.495223,
      6.374525,
      50.811613
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-pri",
    "name": "Puerto Rico",
    "category": "Länder und Gebiete",
    "width": 284000.0,
    "height": 66700.0,
    "aliases": [
      "Puerto Rico",
      "Puerto Rico",
      "PR"
    ],
    "bounds": [
      -67.937815,
      17.922919,
      -65.244618,
      18.522773
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-sop",
    "name": "Puntland",
    "category": "Länder und Gebiete",
    "width": 544000.0,
    "height": 666000.0,
    "aliases": [
      "Puntland",
      "Puntland",
      "-99"
    ],
    "bounds": [
      46.466963,
      5.99872,
      51.417038,
      11.989119
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-bcr",
    "name": "Region Brüssel-Hauptstadt",
    "category": "Länder und Gebiete",
    "width": 16400.0,
    "height": 16700.0,
    "aliases": [
      "Brussels",
      "Brussels Capital Region",
      "-99"
    ],
    "bounds": [
      4.24557,
      50.764639,
      4.479746,
      50.914811
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-twn",
    "name": "Republik China",
    "category": "Länder und Gebiete",
    "width": 380000.0,
    "height": 376000.0,
    "aliases": [
      "Taiwan",
      "Taiwan",
      "CN-TW"
    ],
    "bounds": [
      118.279552,
      21.904608,
      122.005382,
      25.287421
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-cog",
    "name": "Republik Kongo",
    "category": "Länder und Gebiete",
    "width": 837000.0,
    "height": 971000.0,
    "aliases": [
      "Congo",
      "Republic of the Congo",
      "CG"
    ],
    "bounds": [
      11.114016,
      -5.019631,
      18.642407,
      3.708276
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-mda",
    "name": "Republik Moldau",
    "category": "Länder und Gebiete",
    "width": 267000.0,
    "height": 336000.0,
    "aliases": [
      "Moldova",
      "Moldova",
      "MD"
    ],
    "bounds": [
      26.617889,
      45.461774,
      30.131576,
      48.486034
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-cyp",
    "name": "Republik Zypern",
    "category": "Länder und Gebiete",
    "width": 167000.0,
    "height": 62500.0,
    "aliases": [
      "Cyprus",
      "Cyprus",
      "CY"
    ],
    "bounds": [
      32.271739,
      34.625019,
      34.099132,
      35.187082
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-bis",
    "name": "Republika Srpska",
    "category": "Länder und Gebiete",
    "width": 269000.0,
    "height": 303000.0,
    "aliases": [
      "Rep. Srpska",
      "Republika Srpska",
      "-99"
    ],
    "bounds": [
      16.263079,
      42.559212,
      19.618885,
      45.284524
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-rwa",
    "name": "Ruanda",
    "category": "Länder und Gebiete",
    "width": 226000.0,
    "height": 197000.0,
    "aliases": [
      "Rwanda",
      "Rwanda",
      "RW"
    ],
    "bounds": [
      28.857236,
      -2.826855,
      30.887809,
      -1.058694
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-rou",
    "name": "Rumänien",
    "category": "Länder und Gebiete",
    "width": 731000.0,
    "height": 514000.0,
    "aliases": [
      "Romania",
      "Romania",
      "RO"
    ],
    "bounds": [
      20.242826,
      43.65005,
      29.699555,
      48.274832
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-rus",
    "name": "Russland",
    "category": "Länder und Gebiete",
    "width": 9090000.0,
    "height": 4520000.0,
    "aliases": [
      "Russia",
      "Russia",
      "RU"
    ],
    "bounds": [
      19.609548,
      41.192681,
      191.005382,
      81.85871
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-reu",
    "name": "Réunion",
    "category": "Länder und Gebiete",
    "width": 65300.0,
    "height": 56600.0,
    "aliases": [
      "Réunion",
      "Réunion",
      "FR-974"
    ],
    "bounds": [
      55.225434,
      -21.370782,
      55.854503,
      -20.861423
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-blm",
    "name": "Saint-Barthélemy",
    "category": "Länder und Gebiete",
    "width": 8010.0,
    "height": 5240.0,
    "aliases": [
      "St-Barthélemy",
      "Saint Barthélemy",
      "BL"
    ],
    "bounds": [
      -62.86734,
      17.881985,
      -62.791656,
      17.929145
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-maf",
    "name": "Saint-Martin",
    "category": "Länder und Gebiete",
    "width": 14400.0,
    "height": 9870.0,
    "aliases": [
      "St-Martin",
      "Saint Martin",
      "MF"
    ],
    "bounds": [
      -63.14684,
      18.033391,
      -63.010732,
      18.122138
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-spm",
    "name": "Saint-Pierre und Miquelon",
    "category": "Länder und Gebiete",
    "width": 19100.0,
    "height": 43200.0,
    "aliases": [
      "St. Pierre and Miquelon",
      "Saint Pierre and Miquelon",
      "PM"
    ],
    "bounds": [
      -56.396596,
      46.752753,
      -56.144765,
      47.141262
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-slb",
    "name": "Salomonen",
    "category": "Länder und Gebiete",
    "width": 1460000.0,
    "height": 633000.0,
    "aliases": [
      "Solomon Is.",
      "Solomon Islands",
      "SB"
    ],
    "bounds": [
      155.507986,
      -12.290623,
      168.825857,
      -6.599867
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-zmb",
    "name": "Sambia",
    "category": "Länder und Gebiete",
    "width": 1270000.0,
    "height": 1100000.0,
    "aliases": [
      "Zambia",
      "Zambia",
      "ZM"
    ],
    "bounds": [
      21.979878,
      -18.069232,
      33.674203,
      -8.194124
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-wsm",
    "name": "Samoa",
    "category": "Länder und Gebiete",
    "width": 145000.0,
    "height": 65600.0,
    "aliases": [
      "Samoa",
      "Samoa",
      "WS"
    ],
    "bounds": [
      -172.782582,
      -14.05283,
      -171.437693,
      -13.462823
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-smr",
    "name": "San Marino",
    "category": "Länder und Gebiete",
    "width": 8550.0,
    "height": 10100.0,
    "aliases": [
      "San Marino",
      "San Marino",
      "SM"
    ],
    "bounds": [
      12.385629,
      43.892056,
      12.492392,
      43.982567
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-tzz",
    "name": "Sansibar",
    "category": "Länder und Gebiete",
    "width": 77600.0,
    "height": 175000.0,
    "aliases": [
      "Zanzibar",
      "Zanzibar",
      "-99"
    ],
    "bounds": [
      39.177013,
      -6.462823,
      39.878184,
      -4.890313
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-sau",
    "name": "Saudi-Arabien",
    "category": "Länder und Gebiete",
    "width": 2140000.0,
    "height": 1750000.0,
    "aliases": [
      "Saudi Arabia",
      "Saudi Arabia",
      "SA"
    ],
    "bounds": [
      34.572765,
      16.370958,
      55.637565,
      32.121348
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-scr",
    "name": "Scarborough-Riff",
    "category": "Länder und Gebiete",
    "width": 412.0,
    "height": 477.0,
    "aliases": [
      "Scarborough Reef",
      "Scarborough Shoal",
      "-99"
    ],
    "bounds": [
      117.751856,
      15.150082,
      117.755692,
      15.154369
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-sct",
    "name": "Schottland",
    "category": "Länder und Gebiete",
    "width": 768000.0,
    "height": 691000.0,
    "aliases": [
      "Scotland",
      "Scotland",
      "-99"
    ],
    "bounds": [
      -13.691314,
      54.632961,
      -0.754791,
      60.847886
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-swe",
    "name": "Schweden",
    "category": "Länder und Gebiete",
    "width": 677000.0,
    "height": 1520000.0,
    "aliases": [
      "Sweden",
      "Sweden",
      "SE"
    ],
    "bounds": [
      11.108165,
      55.342678,
      24.163414,
      69.036356
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-che",
    "name": "Schweiz",
    "category": "Länder und Gebiete",
    "width": 343000.0,
    "height": 220000.0,
    "aliases": [
      "Switzerland",
      "Switzerland",
      "CH"
    ],
    "bounds": [
      5.954809,
      45.820718,
      10.466627,
      47.801166
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-sen",
    "name": "Senegal",
    "category": "Länder und Gebiete",
    "width": 663000.0,
    "height": 488000.0,
    "aliases": [
      "Senegal",
      "Senegal",
      "SN"
    ],
    "bounds": [
      -17.536041,
      12.305607,
      -11.377776,
      16.691385
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-srs",
    "name": "Serbien",
    "category": "Länder und Gebiete",
    "width": 312000.0,
    "height": 317000.0,
    "aliases": [
      "Serbia",
      "Serbia",
      "-99"
    ],
    "bounds": [
      19.107185,
      42.234945,
      22.984571,
      45.082066
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-ser",
    "name": "Serranilla Bank",
    "category": "Länder und Gebiete",
    "width": 379.0,
    "height": 579.0,
    "aliases": [
      "Serranilla Bank",
      "Serranilla Bank",
      "-99"
    ],
    "bounds": [
      -78.640411,
      15.862087,
      -78.636871,
      15.867296
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-syc",
    "name": "Seychellen",
    "category": "Länder und Gebiete",
    "width": 1110000.0,
    "height": 663000.0,
    "aliases": [
      "Seychelles",
      "Seychelles",
      "SC"
    ],
    "bounds": [
      46.207367,
      -9.755548,
      56.287446,
      -3.791111
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-kas",
    "name": "Siachen-Gletscher",
    "category": "Länder und Gebiete",
    "width": 92700.0,
    "height": 59800.0,
    "aliases": [
      "Siachen Glacier",
      "Siachen Glacier",
      "-99"
    ],
    "bounds": [
      76.777351,
      35.110442,
      77.800346,
      35.647799
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-sle",
    "name": "Sierra Leone",
    "category": "Länder und Gebiete",
    "width": 332000.0,
    "height": 342000.0,
    "aliases": [
      "Sierra Leone",
      "Sierra Leone",
      "SL"
    ],
    "bounds": [
      -13.301096,
      6.91942,
      -10.282236,
      9.996006
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-zwe",
    "name": "Simbabwe",
    "category": "Länder und Gebiete",
    "width": 822000.0,
    "height": 754000.0,
    "aliases": [
      "Zimbabwe",
      "Zimbabwe",
      "ZW"
    ],
    "bounds": [
      25.21937,
      -22.39734,
      33.042768,
      -15.614808
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-sgp",
    "name": "Singapur",
    "category": "Länder und Gebiete",
    "width": 40400.0,
    "height": 20500.0,
    "aliases": [
      "Singapore",
      "Singapore",
      "SG"
    ],
    "bounds": [
      103.640391,
      1.264309,
      104.003429,
      1.448635
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-sxm",
    "name": "Sint Maarten",
    "category": "Länder und Gebiete",
    "width": 10700.0,
    "height": 4780.0,
    "aliases": [
      "Sint Maarten",
      "Sint Maarten",
      "SX"
    ],
    "bounds": [
      -63.118886,
      18.01911,
      -63.017569,
      18.06212
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-svk",
    "name": "Slowakei",
    "category": "Länder und Gebiete",
    "width": 418000.0,
    "height": 206000.0,
    "aliases": [
      "Slovakia",
      "Slovakia",
      "SK"
    ],
    "bounds": [
      16.84448,
      47.750006,
      22.539637,
      49.60178
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-svn",
    "name": "Slowenien",
    "category": "Länder und Gebiete",
    "width": 243000.0,
    "height": 160000.0,
    "aliases": [
      "Slovenia",
      "Slovenia",
      "SI"
    ],
    "bounds": [
      13.365261,
      45.423637,
      16.515302,
      46.863962
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-sox",
    "name": "Somalia",
    "category": "Länder und Gebiete",
    "width": 887000.0,
    "height": 916000.0,
    "aliases": [
      "Somalia",
      "Somalia",
      "-99"
    ],
    "bounds": [
      40.965385,
      -1.696303,
      48.951491,
      6.538292
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-sol",
    "name": "Somaliland",
    "category": "Länder und Gebiete",
    "width": 690000.0,
    "height": 389000.0,
    "aliases": [
      "Somaliland",
      "Somaliland",
      "-99"
    ],
    "bounds": [
      42.647247,
      7.996516,
      48.939112,
      11.498928
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-esp",
    "name": "Spanien",
    "category": "Länder und Gebiete",
    "width": 2030000.0,
    "height": 1800000.0,
    "aliases": [
      "Spain",
      "Spain",
      "ES"
    ],
    "bounds": [
      -18.167226,
      27.642239,
      4.337087,
      43.793443
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-nsv",
    "name": "Spitzbergen",
    "category": "Länder und Gebiete",
    "width": 555000.0,
    "height": 714000.0,
    "aliases": [
      "Svalbard Is.",
      "Svalbard",
      "SJ"
    ],
    "bounds": [
      10.484386,
      74.347357,
      33.640391,
      80.770087
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-lka",
    "name": "Sri Lanka",
    "category": "Länder und Gebiete",
    "width": 246000.0,
    "height": 434000.0,
    "aliases": [
      "Sri Lanka",
      "Sri Lanka",
      "LK"
    ],
    "bounds": [
      79.655772,
      5.923733,
      81.89031,
      9.829576
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-shn",
    "name": "St. Helena",
    "category": "Länder und Gebiete",
    "width": 890000.0,
    "height": 3620000.0,
    "aliases": [
      "Saint Helena",
      "Saint Helena",
      "SH"
    ],
    "bounds": [
      -14.417714,
      -40.397882,
      -5.65038,
      -7.877862
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-kna",
    "name": "St. Kitts und Nevis",
    "category": "Länder und Gebiete",
    "width": 34400.0,
    "height": 35100.0,
    "aliases": [
      "St. Kitts and Nevis",
      "Saint Kitts and Nevis",
      "KN"
    ],
    "bounds": [
      -62.861073,
      17.100531,
      -62.536773,
      17.415839
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-lca",
    "name": "St. Lucia",
    "category": "Länder und Gebiete",
    "width": 21100.0,
    "height": 44200.0,
    "aliases": [
      "Saint Lucia",
      "Saint Lucia",
      "LC"
    ],
    "bounds": [
      -61.078521,
      13.714667,
      -60.882965,
      14.111884
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-vct",
    "name": "St. Vincent und die Grenadinen",
    "category": "Länder und Gebiete",
    "width": 36400.0,
    "height": 88500.0,
    "aliases": [
      "St. Vin. and Gren.",
      "Saint Vincent and the Grenadines",
      "VC"
    ],
    "bounds": [
      -61.459828,
      12.58515,
      -61.123931,
      13.380764
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-sdn",
    "name": "Sudan",
    "category": "Länder und Gebiete",
    "width": 1800000.0,
    "height": 1510000.0,
    "aliases": [
      "Sudan",
      "Sudan",
      "SD"
    ],
    "bounds": [
      21.809449,
      8.681642,
      38.603852,
      22.226965
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-sur",
    "name": "Suriname",
    "category": "Länder und Gebiete",
    "width": 453000.0,
    "height": 465000.0,
    "aliases": [
      "Suriname",
      "Suriname",
      "SR"
    ],
    "bounds": [
      -58.067691,
      1.833507,
      -53.986357,
      6.011574
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-syx",
    "name": "Syrien",
    "category": "Länder und Gebiete",
    "width": 607000.0,
    "height": 557000.0,
    "aliases": [
      "Syria",
      "Syria",
      "SY"
    ],
    "bounds": [
      35.723399,
      32.313042,
      42.377186,
      37.324906
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-stp",
    "name": "São Tomé und Príncipe",
    "category": "Länder und Gebiete",
    "width": 111000.0,
    "height": 186000.0,
    "aliases": [
      "São Tomé and Principe",
      "São Tomé and Príncipe",
      "ST"
    ],
    "bounds": [
      6.461681,
      0.024115,
      7.462738,
      1.699774
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-zaf",
    "name": "Südafrika",
    "category": "Länder und Gebiete",
    "width": 1970000.0,
    "height": 2760000.0,
    "aliases": [
      "South Africa",
      "South Africa",
      "ZA"
    ],
    "bounds": [
      16.469981,
      -46.965753,
      37.977794,
      -22.126452
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-sgs",
    "name": "Südgeorgien und die Südlichen Sandwichinseln",
    "category": "Länder und Gebiete",
    "width": 723000.0,
    "height": 612000.0,
    "aliases": [
      "S. Geo. and the Is.",
      "South Georgia and the South Sandwich Islands",
      "GS"
    ],
    "bounds": [
      -38.087026,
      -59.472752,
      -26.239329,
      -53.972426
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-kor",
    "name": "Südkorea",
    "category": "Länder und Gebiete",
    "width": 653000.0,
    "height": 598000.0,
    "aliases": [
      "South Korea",
      "South Korea",
      "KR"
    ],
    "bounds": [
      124.613617,
      33.197577,
      131.862522,
      38.578074
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-spi",
    "name": "Südpatagonisches Eisfeld",
    "category": "Länder und Gebiete",
    "width": 38300.0,
    "height": 54200.0,
    "aliases": [
      "Southern Patagonian Ice Field",
      "Southern Patagonian Ice Field",
      "-99"
    ],
    "bounds": [
      -73.588036,
      -49.759959,
      -73.057424,
      -49.272754
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-sds",
    "name": "Südsudan",
    "category": "Länder und Gebiete",
    "width": 1300000.0,
    "height": 970000.0,
    "aliases": [
      "S. Sudan",
      "South Sudan",
      "SS"
    ],
    "bounds": [
      24.121556,
      3.490202,
      35.920835,
      12.216155
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-tjk",
    "name": "Tadschikistan",
    "category": "Länder und Gebiete",
    "width": 677000.0,
    "height": 485000.0,
    "aliases": [
      "Tajikistan",
      "Tajikistan",
      "TJ"
    ],
    "bounds": [
      67.34269,
      36.678641,
      75.164125,
      41.039977
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-tza",
    "name": "Tansania",
    "category": "Länder und Gebiete",
    "width": 1230000.0,
    "height": 1190000.0,
    "aliases": [
      "Tanzania",
      "Tanzania",
      "TZ"
    ],
    "bounds": [
      29.321032,
      -11.731272,
      40.449392,
      -0.98583
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-tha",
    "name": "Thailand",
    "category": "Länder und Gebiete",
    "width": 899000.0,
    "height": 1650000.0,
    "aliases": [
      "Thailand",
      "Thailand",
      "TH"
    ],
    "bounds": [
      97.351401,
      5.62989,
      105.650998,
      20.445006
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-tgo",
    "name": "Togo",
    "category": "Länder und Gebiete",
    "width": 214000.0,
    "height": 560000.0,
    "aliases": [
      "Togo",
      "Togo",
      "TG"
    ],
    "bounds": [
      -0.166109,
      6.100491,
      1.782351,
      11.13498
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-tkl",
    "name": "Tokelau",
    "category": "Länder und Gebiete",
    "width": 145000.0,
    "height": 91000.0,
    "aliases": [
      "Tokelau",
      "Tokelau",
      "TK"
    ],
    "bounds": [
      -172.502553,
      -9.361749,
      -171.185658,
      -8.543227
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-ton",
    "name": "Tonga",
    "category": "Länder und Gebiete",
    "width": 242000.0,
    "height": 754000.0,
    "aliases": [
      "Tonga",
      "Tonga",
      "TO"
    ],
    "bounds": [
      -176.219309,
      -22.3388,
      -173.914255,
      -15.559503
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-tto",
    "name": "Trinidad und Tobago",
    "category": "Länder und Gebiete",
    "width": 154000.0,
    "height": 146000.0,
    "aliases": [
      "Trinidad and Tobago",
      "Trinidad and Tobago",
      "TT"
    ],
    "bounds": [
      -61.9287,
      10.04206,
      -60.522084,
      11.35106
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-tcd",
    "name": "Tschad",
    "category": "Länder und Gebiete",
    "width": 1130000.0,
    "height": 1780000.0,
    "aliases": [
      "Chad",
      "Chad",
      "TD"
    ],
    "bounds": [
      13.449184,
      7.455567,
      23.984406,
      23.44472
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-cze",
    "name": "Tschechien",
    "category": "Länder und Gebiete",
    "width": 485000.0,
    "height": 276000.0,
    "aliases": [
      "Czechia",
      "Czech Republic",
      "CZ"
    ],
    "bounds": [
      12.076141,
      48.557916,
      18.837434,
      51.040012
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-tun",
    "name": "Tunesien",
    "category": "Länder und Gebiete",
    "width": 377000.0,
    "height": 791000.0,
    "aliases": [
      "Tunisia",
      "Tunisia",
      "TN"
    ],
    "bounds": [
      7.479832,
      30.228905,
      11.564131,
      37.345201
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-tkm",
    "name": "Turkmenistan",
    "category": "Länder und Gebiete",
    "width": 1230000.0,
    "height": 851000.0,
    "aliases": [
      "Turkmenistan",
      "Turkmenistan",
      "TM"
    ],
    "bounds": [
      52.437671,
      35.140647,
      66.645782,
      42.791188
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-tca",
    "name": "Turks- und Caicosinseln",
    "category": "Länder und Gebiete",
    "width": 140000.0,
    "height": 74400.0,
    "aliases": [
      "Turks and Caicos Is.",
      "Turks and Caicos Islands",
      "TC"
    ],
    "bounds": [
      -72.481313,
      21.290107,
      -71.128896,
      21.959215
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-tuv",
    "name": "Tuvalu",
    "category": "Länder und Gebiete",
    "width": 417000.0,
    "height": 416000.0,
    "aliases": [
      "Tuvalu",
      "Tuvalu",
      "TV"
    ],
    "bounds": [
      176.125255,
      -9.420668,
      179.906749,
      -5.677504
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-tur",
    "name": "Türkei",
    "category": "Länder und Gebiete",
    "width": 1660000.0,
    "height": 698000.0,
    "aliases": [
      "Turkey",
      "Turkey",
      "TR"
    ],
    "bounds": [
      25.663259,
      35.819779,
      44.806993,
      42.098782
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-cyn",
    "name": "Türkische Republik Nordzypern",
    "category": "Länder und Gebiete",
    "width": 181000.0,
    "height": 76600.0,
    "aliases": [
      "N. Cyprus",
      "Turkish Republic of Northern Cyprus",
      "-99"
    ],
    "bounds": [
      32.601899,
      35.002722,
      34.59254,
      35.691962
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-cnm",
    "name": "UN-Pufferzone in Zypern",
    "category": "Länder und Gebiete",
    "width": 131000.0,
    "height": 24600.0,
    "aliases": [
      "Cyprus U.N. Buffer Zone",
      "United Nations Buffer Zone in Cyprus",
      "-99"
    ],
    "bounds": [
      32.584809,
      34.977763,
      34.021961,
      35.199403
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-uga",
    "name": "Uganda",
    "category": "Länder und Gebiete",
    "width": 607000.0,
    "height": 633000.0,
    "aliases": [
      "Uganda",
      "Uganda",
      "UG"
    ],
    "bounds": [
      29.54846,
      -1.475206,
      35.006473,
      4.219692
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-ukr",
    "name": "Ukraine",
    "category": "Länder und Gebiete",
    "width": 1320000.0,
    "height": 796000.0,
    "aliases": [
      "Ukraine",
      "Ukraine",
      "UA"
    ],
    "bounds": [
      22.13284,
      45.213568,
      40.159543,
      52.368949
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-hun",
    "name": "Ungarn",
    "category": "Länder und Gebiete",
    "width": 513000.0,
    "height": 314000.0,
    "aliases": [
      "Hungary",
      "Hungary",
      "HU"
    ],
    "bounds": [
      16.094035,
      45.741343,
      22.877601,
      48.569233
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-syu",
    "name": "United Nations Disengagement Observer Force",
    "category": "Länder und Gebiete",
    "width": 15500.0,
    "height": 76400.0,
    "aliases": [
      "UNDOF Zone",
      "United Nations Disengagement Observer Force",
      "XD"
    ],
    "bounds": [
      35.75759,
      32.744347,
      35.923833,
      33.431242
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-ury",
    "name": "Uruguay",
    "category": "Länder und Gebiete",
    "width": 500000.0,
    "height": 542000.0,
    "aliases": [
      "Uruguay",
      "Uruguay",
      "UY"
    ],
    "bounds": [
      -58.439361,
      -34.973403,
      -53.110836,
      -30.09687
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-uzb",
    "name": "Usbekistan",
    "category": "Länder und Gebiete",
    "width": 1430000.0,
    "height": 931000.0,
    "aliases": [
      "Uzbekistan",
      "Uzbekistan",
      "UZ"
    ],
    "bounds": [
      55.975839,
      37.185147,
      73.148641,
      45.558719
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-vut",
    "name": "Vanuatu",
    "category": "Länder und Gebiete",
    "width": 360000.0,
    "height": 799000.0,
    "aliases": [
      "Vanuatu",
      "Vanuatu",
      "VU"
    ],
    "bounds": [
      166.520518,
      -20.253106,
      169.898936,
      -13.064874
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-vat",
    "name": "Vatikanstadt",
    "category": "Länder und Gebiete",
    "width": 109.0,
    "height": 129.0,
    "aliases": [
      "Vatican",
      "Vatican City",
      "VA"
    ],
    "bounds": [
      12.452714,
      41.902752,
      12.454035,
      41.903915
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-ven",
    "name": "Venezuela",
    "category": "Länder und Gebiete",
    "width": 1490000.0,
    "height": 1670000.0,
    "aliases": [
      "Venezuela",
      "Venezuela",
      "VE"
    ],
    "bounds": [
      -73.391149,
      0.649315,
      -59.815595,
      15.702948
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-are",
    "name": "Vereinigte Arabische Emirate",
    "category": "Länder und Gebiete",
    "width": 488000.0,
    "height": 384000.0,
    "aliases": [
      "United Arab Emirates",
      "United Arab Emirates",
      "AE"
    ],
    "bounds": [
      51.569347,
      22.620946,
      56.383637,
      26.074792
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-usa",
    "name": "Vereinigte Staaten",
    "category": "Länder und Gebiete",
    "width": 9450000.0,
    "height": 5840000.0,
    "aliases": [
      "United States of America",
      "United States of America",
      "US"
    ],
    "bounds": [
      172.476085,
      18.906117,
      293.022675,
      71.412502
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-vnm",
    "name": "Vietnam",
    "category": "Länder und Gebiete",
    "width": 786000.0,
    "height": 1650000.0,
    "aliases": [
      "Vietnam",
      "Vietnam",
      "VN"
    ],
    "bounds": [
      102.118655,
      8.565579,
      109.472423,
      23.366275
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-srv",
    "name": "Vojvodina",
    "category": "Länder und Gebiete",
    "width": 210000.0,
    "height": 171000.0,
    "aliases": [
      "Vojvodina",
      "Vojvodina",
      "-99"
    ],
    "bounds": [
      18.844978,
      44.631783,
      21.539078,
      46.173875
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-chn",
    "name": "Volksrepublik China",
    "category": "Länder und Gebiete",
    "width": 5510000.0,
    "height": 3940000.0,
    "aliases": [
      "China",
      "People's Republic of China",
      "CN"
    ],
    "bounds": [
      73.602256,
      18.169338,
      134.772579,
      53.569444
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-pga",
    "name": "Wake",
    "category": "Länder und Gebiete",
    "width": 199000.0,
    "height": 160000.0,
    "aliases": [
      "Spratly Is.",
      "Wake Island",
      "-99"
    ],
    "bounds": [
      114.02768,
      9.679511,
      115.848806,
      11.117987
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-wqi",
    "name": "Wake",
    "category": "Länder und Gebiete",
    "width": 3460.0,
    "height": 3350.0,
    "aliases": [
      "Wake Atoll",
      "Wake Island",
      "-99"
    ],
    "bounds": [
      166.619395,
      19.27558,
      166.652354,
      19.305732
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-wls",
    "name": "Wales",
    "category": "Länder und Gebiete",
    "width": 181000.0,
    "height": 227000.0,
    "aliases": [
      "Wales",
      "Wales",
      "-99"
    ],
    "bounds": [
      -5.310943,
      51.384223,
      -2.647043,
      53.426947
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-wlf",
    "name": "Wallis und Futuna",
    "category": "Länder und Gebiete",
    "width": 222000.0,
    "height": 123000.0,
    "aliases": [
      "Wallis and Futuna Is.",
      "Wallis and Futuna",
      "WF"
    ],
    "bounds": [
      -178.18574,
      -14.319431,
      -176.1256,
      -13.208917
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-cxr",
    "name": "Weihnachtsinsel",
    "category": "Länder und Gebiete",
    "width": 14500.0,
    "height": 15000.0,
    "aliases": [
      "Christmas I.",
      "Christmas Island",
      "CX"
    ],
    "bounds": [
      105.581798,
      -10.566013,
      105.714692,
      -10.430841
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-web",
    "name": "Westjordanland",
    "category": "Länder und Gebiete",
    "width": 66600.0,
    "height": 133000.0,
    "aliases": [
      "West Bank",
      "West Bank",
      "-99"
    ],
    "bounds": [
      34.867153,
      31.34491,
      35.572536,
      32.54264
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-sah",
    "name": "Westsahara",
    "category": "Länder und Gebiete",
    "width": 854000.0,
    "height": 767000.0,
    "aliases": [
      "W. Sahara",
      "Western Sahara",
      "EH"
    ],
    "bounds": [
      -17.104644,
      20.766913,
      -8.680809,
      27.661465
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-caf",
    "name": "Zentralafrikanische Republik",
    "category": "Länder und Gebiete",
    "width": 1440000.0,
    "height": 975000.0,
    "aliases": [
      "Central African Rep.",
      "Central African Republic",
      "CF"
    ],
    "bounds": [
      14.387266,
      2.236454,
      27.441301,
      11.000828
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-egy",
    "name": "Ägypten",
    "category": "Länder und Gebiete",
    "width": 1210000.0,
    "height": 1070000.0,
    "aliases": [
      "Egypt",
      "Egypt",
      "EG"
    ],
    "bounds": [
      24.688343,
      21.994369,
      36.899181,
      31.65648
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-gnq",
    "name": "Äquatorialguinea",
    "category": "Länder und Gebiete",
    "width": 636000.0,
    "height": 584000.0,
    "aliases": [
      "Eq. Guinea",
      "Equatorial Guinea",
      "GQ"
    ],
    "bounds": [
      5.61199,
      -1.475681,
      11.336341,
      3.772406
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-eth",
    "name": "Äthiopien",
    "category": "Länder und Gebiete",
    "width": 1650000.0,
    "height": 1280000.0,
    "aliases": [
      "Ethiopia",
      "Ethiopia",
      "ET"
    ],
    "bounds": [
      32.9898,
      3.403333,
      47.979169,
      14.879532
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-ald",
    "name": "Åland",
    "category": "Länder und Gebiete",
    "width": 87500.0,
    "height": 64100.0,
    "aliases": [
      "Åland",
      "Åland",
      "AX"
    ],
    "bounds": [
      19.513194,
      59.904486,
      21.09669,
      60.48078
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "country-aut",
    "name": "Österreich",
    "category": "Länder und Gebiete",
    "width": 571000.0,
    "height": 293000.0,
    "aliases": [
      "Austria",
      "Austria",
      "AT"
    ],
    "bounds": [
      9.521155,
      46.378643,
      17.148338,
      49.009774
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_map_units.geojson"
  },
  {
    "id": "osm-relation-62422",
    "name": "Berlin",
    "category": "Städte",
    "width": 45500.0,
    "height": 37500.0,
    "aliases": [
      "Berlin"
    ],
    "bounds": [
      13.088345,
      52.3382448,
      13.7611609,
      52.6755087
    ],
    "source": "https://www.openstreetmap.org/relation/62422"
  },
  {
    "id": "osm-relation-62400",
    "name": "Frankfurt am Main",
    "category": "Städte",
    "width": 23400.0,
    "height": 23500.0,
    "aliases": [
      "Frankfurt am Main"
    ],
    "bounds": [
      8.4727605,
      50.0153529,
      8.8004049,
      50.2271424
    ],
    "source": "https://www.openstreetmap.org/relation/62400"
  },
  {
    "id": "osm-relation-62782",
    "name": "Hamburg (ohne Neuwerk)",
    "category": "Städte",
    "width": 39300.0,
    "height": 38300.0,
    "aliases": [
      "Hamburg"
    ],
    "bounds": [
      9.7301155,
      53.3951118,
      10.3252805,
      53.7394378
    ],
    "source": "https://www.openstreetmap.org/relation/62782"
  },
  {
    "id": "osm-relation-62578",
    "name": "Köln",
    "category": "Städte",
    "width": 27300.0,
    "height": 28300.0,
    "aliases": [
      "Köln"
    ],
    "bounds": [
      6.7725303,
      50.8304399,
      7.162028,
      51.0849743
    ],
    "source": "https://www.openstreetmap.org/relation/62578"
  },
  {
    "id": "osm-relation-175342",
    "name": "London (Greater London)",
    "category": "Städte",
    "width": 58500.0,
    "height": 45000.0,
    "aliases": [
      "Greater London"
    ],
    "bounds": [
      -0.5103751,
      51.2867601,
      0.3340155,
      51.6918741
    ],
    "source": "https://www.openstreetmap.org/relation/175342"
  },
  {
    "id": "osm-relation-5326784",
    "name": "Madrid",
    "category": "Städte",
    "width": 31300.0,
    "height": 36900.0,
    "aliases": [
      "Madrid"
    ],
    "bounds": [
      -3.8889539,
      40.3119774,
      -3.5183264,
      40.6437293
    ],
    "source": "https://www.openstreetmap.org/relation/5326784"
  },
  {
    "id": "osm-relation-62428",
    "name": "München",
    "category": "Städte",
    "width": 26900.0,
    "height": 20700.0,
    "aliases": [
      "München"
    ],
    "bounds": [
      11.360777,
      48.0616244,
      11.7229099,
      48.2481162
    ],
    "source": "https://www.openstreetmap.org/relation/62428"
  },
  {
    "id": "osm-relation-175905",
    "name": "New York City",
    "category": "Städte",
    "width": 47100.0,
    "height": 49000.0,
    "aliases": [
      "New York City"
    ],
    "bounds": [
      -74.258843,
      40.476578,
      -73.700233,
      40.91763
    ],
    "source": "https://www.openstreetmap.org/relation/175905"
  },
  {
    "id": "osm-relation-7444",
    "name": "Paris",
    "category": "Städte",
    "width": 18000.0,
    "height": 9630.0,
    "aliases": [
      "Paris"
    ],
    "bounds": [
      2.224122,
      48.8155755,
      2.4697602,
      48.902156
    ],
    "source": "https://www.openstreetmap.org/relation/7444"
  },
  {
    "id": "osm-relation-41485",
    "name": "Rom",
    "category": "Städte",
    "width": 51400.0,
    "height": 54000.0,
    "aliases": [
      "Roma"
    ],
    "bounds": [
      12.2344416,
      41.6556417,
      12.8557603,
      42.1410285
    ],
    "source": "https://www.openstreetmap.org/relation/41485"
  },
  {
    "id": "osm-relation-1543125",
    "name": "Tokio (Präfektur, Festland)",
    "category": "Städte",
    "width": 87000.0,
    "height": 43400.0,
    "aliases": [
      "Tokyo"
    ],
    "bounds": [
      138.922818,
      35.488919,
      139.885963,
      35.87887
    ],
    "source": "https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_1_states_provinces.geojson"
  },
  {
    "id": "osm-relation-109166",
    "name": "Wien",
    "category": "Städte",
    "width": 29300.0,
    "height": 22800.0,
    "aliases": [
      "Wien"
    ],
    "bounds": [
      16.181831,
      48.1179069,
      16.5775132,
      48.3226679
    ],
    "source": "https://www.openstreetmap.org/relation/109166"
  },
  {
    "id": "world",
    "name": "Welt",
    "category": "Welt",
    "width": 40000000,
    "height": 20000000,
    "aliases": [
      "Erde"
    ],
    "source": "https://github.com/ThonkTank/Salt-Marcher/blob/4062c2b7181eb66e63b1001663551c00ae07d3e2/src/app/atlas-landscape.ts"
  }
];
