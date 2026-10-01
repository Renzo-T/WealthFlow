// Approximate coordinates (to about a mile) of US cities and towns, for "how far from home" when Plaid gives a
// city and state but no coordinates. Not exhaustive: a city that isn't here falls back to comparing states.
// Format: City,ST,lat,lon; entries separated by semicolons.
const CITIES = `
Austin,TX,30.27,-97.74;Round Rock,TX,30.51,-97.68;Pflugerville,TX,30.44,-97.62;Cedar Park,TX,30.51,-97.82;Georgetown,TX,30.63,-97.68;
Hutto,TX,30.54,-97.55;Leander,TX,30.58,-97.85;Kyle,TX,29.99,-97.88;Buda,TX,30.09,-97.84;San Marcos,TX,29.88,-97.94;Lakeway,TX,30.36,-97.98;
Bee Cave,TX,30.31,-97.95;Manor,TX,30.34,-97.56;Lockhart,TX,29.88,-97.67;Bastrop,TX,30.11,-97.32;Dripping Springs,TX,30.19,-98.09;
New Braunfels,TX,29.70,-98.12;San Antonio,TX,29.42,-98.49;Boerne,TX,29.79,-98.73;Fredericksburg,TX,30.27,-98.87;Temple,TX,31.10,-97.34;
Killeen,TX,31.12,-97.73;Belton,TX,31.06,-97.46;Waco,TX,31.55,-97.15;West,TX,31.80,-97.09;Hillsboro,TX,32.01,-97.13;Dallas,TX,32.78,-96.80;
Fort Worth,TX,32.76,-97.33;Arlington,TX,32.74,-97.11;Plano,TX,33.02,-96.70;Irving,TX,32.81,-96.95;Garland,TX,32.91,-96.64;Frisco,TX,33.15,-96.82;
McKinney,TX,33.20,-96.62;Denton,TX,33.21,-97.13;Coppell,TX,32.95,-97.02;Grapevine,TX,32.93,-97.08;Richardson,TX,32.95,-96.73;Carrollton,TX,32.95,-96.89;
Gainesville,TX,33.63,-97.13;Houston,TX,29.76,-95.37;Sugar Land,TX,29.62,-95.63;Katy,TX,29.79,-95.82;The Woodlands,TX,30.17,-95.46;Pasadena,TX,29.69,-95.21;
Galveston,TX,29.30,-94.80;College Station,TX,30.63,-96.33;Bryan,TX,30.67,-96.37;Corpus Christi,TX,27.80,-97.40;Cuero,TX,29.09,-97.29;Victoria,TX,28.81,-97.00;
Center,TX,31.79,-94.18;Tyler,TX,32.35,-95.30;Longview,TX,32.50,-94.74;Lubbock,TX,33.58,-101.86;Amarillo,TX,35.22,-101.83;Midland,TX,32.00,-102.08;
Odessa,TX,31.85,-102.37;El Paso,TX,31.76,-106.49;Abilene,TX,32.45,-99.73;San Angelo,TX,31.46,-100.44;Laredo,TX,27.51,-99.51;McAllen,TX,26.20,-98.23;
Brownsville,TX,25.90,-97.50;Beaumont,TX,30.08,-94.13;Wichita Falls,TX,33.91,-98.49;Marfa,TX,30.31,-104.02;Alpine,TX,30.36,-103.66;South Padre Island,TX,26.11,-97.17;
Seattle,WA,47.61,-122.33;Bellevue,WA,47.61,-122.20;Redmond,WA,47.67,-122.12;Kirkland,WA,47.68,-122.21;Bothell,WA,47.76,-122.21;Renton,WA,47.48,-122.21;
Kent,WA,47.38,-122.23;Tacoma,WA,47.25,-122.44;Everett,WA,47.98,-122.20;Issaquah,WA,47.53,-122.03;Sammamish,WA,47.62,-122.04;Lynnwood,WA,47.82,-122.32;
Shoreline,WA,47.76,-122.34;Olympia,WA,47.04,-122.90;Spokane,WA,47.66,-117.43;Bellingham,WA,48.75,-122.48;Vancouver,WA,45.64,-122.66;Leavenworth,WA,47.60,-120.66;
Portland,OR,45.52,-122.68;Beaverton,OR,45.49,-122.80;Hillsboro,OR,45.52,-122.99;Gresham,OR,45.50,-122.43;Troutdale,OR,45.54,-122.39;Lake Oswego,OR,45.42,-122.67;
North Plains,OR,45.60,-123.00;Tillamook,OR,45.46,-123.84;Cannon Beach,OR,45.89,-123.96;Seaside,OR,45.99,-123.92;Astoria,OR,46.19,-123.83;Rockaway Beach,OR,45.61,-123.94;
Cascade Locks,OR,45.67,-121.89;Hood River,OR,45.71,-121.52;Salem,OR,44.94,-123.04;Eugene,OR,44.05,-123.09;Bend,OR,44.06,-121.32;Medford,OR,42.33,-122.87;
San Francisco,CA,37.77,-122.42;Oakland,CA,37.80,-122.27;Berkeley,CA,37.87,-122.27;San Jose,CA,37.34,-121.89;Palo Alto,CA,37.44,-122.14;Mountain View,CA,37.39,-122.08;
Sunnyvale,CA,37.37,-122.04;Santa Clara,CA,37.35,-121.96;Cupertino,CA,37.32,-122.03;Menlo Park,CA,37.45,-122.18;San Mateo,CA,37.56,-122.32;Fremont,CA,37.55,-121.99;
Sacramento,CA,38.58,-121.49;Napa,CA,38.30,-122.29;Santa Cruz,CA,36.97,-122.03;Monterey,CA,36.60,-121.89;Los Angeles,CA,34.05,-118.24;Santa Monica,CA,34.02,-118.49;
Pasadena,CA,34.15,-118.14;Long Beach,CA,33.77,-118.19;Burbank,CA,34.18,-118.31;Glendale,CA,34.14,-118.26;Anaheim,CA,33.84,-117.91;Irvine,CA,33.68,-117.83;
Santa Ana,CA,33.75,-117.87;San Diego,CA,32.72,-117.16;Palm Springs,CA,33.83,-116.55;Santa Barbara,CA,34.42,-119.70;Fresno,CA,36.74,-119.79;Lake Tahoe,CA,38.94,-119.98;
South Lake Tahoe,CA,38.93,-119.98;Yosemite Valley,CA,37.75,-119.59;Riverside,CA,33.95,-117.40;Bakersfield,CA,35.37,-119.02;
New York,NY,40.71,-74.01;Brooklyn,NY,40.68,-73.94;Queens,NY,40.73,-73.79;Bronx,NY,40.84,-73.86;Long Island City,NY,40.74,-73.95;Jamaica,NY,40.70,-73.81;
Buffalo,NY,42.89,-78.88;Rochester,NY,43.16,-77.61;Albany,NY,42.65,-73.76;Syracuse,NY,43.05,-76.15;Ithaca,NY,42.44,-76.50;
Jersey City,NJ,40.73,-74.08;Newark,NJ,40.74,-74.17;Hoboken,NJ,40.74,-74.03;Princeton,NJ,40.36,-74.67;Atlantic City,NJ,39.36,-74.42;
Boston,MA,42.36,-71.06;Cambridge,MA,42.37,-71.11;Somerville,MA,42.39,-71.10;Canton,MA,42.16,-71.14;Worcester,MA,42.26,-71.80;Springfield,MA,42.10,-72.59;
Providence,RI,41.82,-71.41;Newport,RI,41.49,-71.31;Hartford,CT,41.76,-72.67;New Haven,CT,41.31,-72.92;Stamford,CT,41.05,-73.54;Portland,ME,43.66,-70.26;
Burlington,VT,44.48,-73.21;Manchester,NH,42.99,-71.46;Philadelphia,PA,39.95,-75.17;Pittsburgh,PA,40.44,-80.00;Harrisburg,PA,40.27,-76.88;
Baltimore,MD,39.29,-76.61;Annapolis,MD,38.98,-76.49;Bethesda,MD,38.98,-77.09;Washington,DC,38.91,-77.04;Arlington,VA,38.88,-77.10;Alexandria,VA,38.80,-77.05;
Richmond,VA,37.54,-77.44;Virginia Beach,VA,36.85,-75.98;Norfolk,VA,36.85,-76.29;Charlottesville,VA,38.03,-78.48;
Atlanta,GA,33.75,-84.39;Savannah,GA,32.08,-81.09;Athens,GA,33.96,-83.38;Charlotte,NC,35.23,-80.84;Raleigh,NC,35.78,-78.64;Durham,NC,35.99,-78.90;
Chapel Hill,NC,35.91,-79.06;Asheville,NC,35.60,-82.55;Wilmington,NC,34.23,-77.94;Charleston,SC,32.78,-79.93;Columbia,SC,34.00,-81.03;Greenville,SC,34.85,-82.40;
Myrtle Beach,SC,33.69,-78.89;Miami,FL,25.76,-80.19;Miami Beach,FL,25.79,-80.13;Fort Lauderdale,FL,26.12,-80.14;West Palm Beach,FL,26.72,-80.05;
Orlando,FL,28.54,-81.38;Kissimmee,FL,28.29,-81.41;Lake Buena Vista,FL,28.39,-81.52;Tampa,FL,27.95,-82.46;St. Petersburg,FL,27.77,-82.64;Sarasota,FL,27.34,-82.53;
Jacksonville,FL,30.33,-81.66;Tallahassee,FL,30.44,-84.28;Gainesville,FL,29.65,-82.32;Key West,FL,24.56,-81.78;Naples,FL,26.14,-81.79;Destin,FL,30.39,-86.50;
Pensacola,FL,30.42,-87.22;Nashville,TN,36.16,-86.78;Memphis,TN,35.15,-90.05;Knoxville,TN,35.96,-83.92;Chattanooga,TN,35.05,-85.31;Gatlinburg,TN,35.71,-83.51;
Birmingham,AL,33.52,-86.80;Huntsville,AL,34.73,-86.59;Mobile,AL,30.69,-88.04;Montgomery,AL,32.37,-86.30;Jackson,MS,32.30,-90.18;Biloxi,MS,30.40,-88.89;
New Orleans,LA,29.95,-90.07;Baton Rouge,LA,30.45,-91.15;Lafayette,LA,30.22,-92.02;Shreveport,LA,32.53,-93.75;Little Rock,AR,34.75,-92.29;Fayetteville,AR,36.06,-94.16;
Bentonville,AR,36.37,-94.21;Hot Springs,AR,34.50,-93.06;Louisville,KY,38.25,-85.76;Lexington,KY,38.04,-84.50;Newport,KY,39.09,-84.50;Covington,KY,39.08,-84.51;
Cincinnati,OH,39.10,-84.51;Columbus,OH,39.96,-83.00;Cleveland,OH,41.50,-81.69;Dayton,OH,39.76,-84.19;Toledo,OH,41.65,-83.54;Akron,OH,41.08,-81.52;
Indianapolis,IN,39.77,-86.16;Bloomington,IN,39.17,-86.53;Fort Wayne,IN,41.08,-85.14;Chicago,IL,41.88,-87.63;Evanston,IL,42.05,-87.69;Naperville,IL,41.75,-88.15;
Springfield,IL,39.80,-89.64;Champaign,IL,40.12,-88.24;Detroit,MI,42.33,-83.05;Ann Arbor,MI,42.28,-83.74;Grand Rapids,MI,42.96,-85.67;Lansing,MI,42.73,-84.56;
Traverse City,MI,44.76,-85.62;Milwaukee,WI,43.04,-87.91;Madison,WI,43.07,-89.40;Green Bay,WI,44.51,-88.01;Minneapolis,MN,44.98,-93.27;St. Paul,MN,44.95,-93.09;
Bloomington,MN,44.84,-93.30;Duluth,MN,46.79,-92.10;Des Moines,IA,41.59,-93.62;Iowa City,IA,41.66,-91.53;Omaha,NE,41.26,-95.93;Lincoln,NE,40.81,-96.70;
Kansas City,MO,39.10,-94.58;St. Louis,MO,38.63,-90.20;Springfield,MO,37.21,-93.29;Branson,MO,36.64,-93.22;Columbia,MO,38.95,-92.33;Kansas City,KS,39.11,-94.63;
Overland Park,KS,38.98,-94.67;Wichita,KS,37.69,-97.34;Lawrence,KS,38.97,-95.24;Oklahoma City,OK,35.47,-97.52;Tulsa,OK,36.15,-95.99;Norman,OK,35.22,-97.44;
Denver,CO,39.74,-104.99;Boulder,CO,40.01,-105.27;Aurora,CO,39.73,-104.83;Colorado Springs,CO,38.83,-104.82;Fort Collins,CO,40.59,-105.08;Vail,CO,39.64,-106.37;
Breckenridge,CO,39.48,-106.04;Aspen,CO,39.19,-106.82;Estes Park,CO,40.38,-105.52;Durango,CO,37.28,-107.88;Salt Lake City,UT,40.76,-111.89;Park City,UT,40.65,-111.50;
Provo,UT,40.23,-111.66;Moab,UT,38.57,-109.55;St. George,UT,37.10,-113.58;Springdale,UT,37.19,-112.99;Las Vegas,NV,36.17,-115.14;Henderson,NV,36.04,-114.98;
Reno,NV,39.53,-119.81;Carson City,NV,39.16,-119.77;Phoenix,AZ,33.45,-112.07;Scottsdale,AZ,33.49,-111.93;Tempe,AZ,33.43,-111.94;Mesa,AZ,33.42,-111.83;
Tucson,AZ,32.22,-110.97;Flagstaff,AZ,35.20,-111.65;Sedona,AZ,34.87,-111.76;Grand Canyon Village,AZ,36.05,-112.14;Page,AZ,36.91,-111.46;
Albuquerque,NM,35.08,-106.65;Santa Fe,NM,35.69,-105.94;Taos,NM,36.41,-105.57;Las Cruces,NM,32.32,-106.76;Boise,ID,43.62,-116.20;Sun Valley,ID,43.70,-114.35;
Coeur d'Alene,ID,47.68,-116.78;Bozeman,MT,45.68,-111.04;Missoula,MT,46.87,-113.99;Whitefish,MT,48.41,-114.34;Billings,MT,45.78,-108.50;Jackson,WY,43.48,-110.76;
Cheyenne,WY,41.14,-104.82;Rapid City,SD,44.08,-103.23;Sioux Falls,SD,43.55,-96.73;Fargo,ND,46.88,-96.79;Anchorage,AK,61.22,-149.90;Fairbanks,AK,64.84,-147.72;
Juneau,AK,58.30,-134.42;Honolulu,HI,21.31,-157.86;Kailua,HI,21.40,-157.74;Lahaina,HI,20.88,-156.68;Kahului,HI,20.89,-156.47;Kihei,HI,20.76,-156.45;Hilo,HI,19.72,-155.08;
Kailua-Kona,HI,19.64,-155.99;Lihue,HI,21.98,-159.37;San Juan,PR,18.47,-66.11;Wilmington,DE,39.74,-75.55;Charleston,WV,38.35,-81.63;Morgantown,WV,39.63,-79.96
`;

const KEY = (city, region) => `${(city ?? '').trim().toLowerCase()}|${(region ?? '').trim().toUpperCase()}`;
const TABLE = new Map(CITIES.split(';').map((s) => s.trim()).filter(Boolean).map((s) => {
  const [city, st, lat, lon] = s.split(',');
  return [KEY(city, st), [Number(lat), Number(lon)]];
}));

// [lat, lon] for a US city and state, or null when it isn't in the table.
export const cityCoords = (city, region) => TABLE.get(KEY(city, region)) ?? null;

// Great-circle distance in miles.
export function miles([lat1, lon1], [lat2, lon2]) {
  const r = (d) => (d * Math.PI) / 180;
  const a = Math.sin(r(lat2 - lat1) / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lon2 - lon1) / 2) ** 2;
  return 3958.8 * 2 * Math.asin(Math.sqrt(a));
}

export const US_STATES = new Set(('AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR '
  + 'PA RI SC SD TN TX UT VT VA WA WV WI WY PR').split(' '));
// Card descriptions end with a 3-letter country code for purchases abroad ("TOKYO JPN").
export const COUNTRIES = { JPN: 'Japan', MEX: 'Mexico', CAN: 'Canada', GBR: 'United Kingdom', FRA: 'France', ITA: 'Italy', DEU: 'Germany',
  ESP: 'Spain', PRT: 'Portugal', NLD: 'Netherlands', IRL: 'Ireland', CHE: 'Switzerland', AUT: 'Austria', KOR: 'South Korea', TWN: 'Taiwan',
  THA: 'Thailand', VNM: 'Vietnam', SGP: 'Singapore', HKG: 'Hong Kong', CHN: 'China', AUS: 'Australia', NZL: 'New Zealand', ISL: 'Iceland',
  GRC: 'Greece', HRV: 'Croatia', CZE: 'Czechia', DNK: 'Denmark', SWE: 'Sweden', NOR: 'Norway', FIN: 'Finland', BEL: 'Belgium', IDN: 'Indonesia',
  PHL: 'Philippines', MYS: 'Malaysia', IND: 'India', ARE: 'United Arab Emirates', TUR: 'Turkey', BRA: 'Brazil', ARG: 'Argentina', CHL: 'Chile',
  PER: 'Peru', COL: 'Colombia', CRI: 'Costa Rica', BHS: 'Bahamas', DOM: 'Dominican Republic', JAM: 'Jamaica', MAR: 'Morocco', EGY: 'Egypt', ZAF: 'South Africa' };

export const STATE_NAMES = { AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut',
  DE: 'Delaware', DC: 'Washington, DC', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
  KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota',
  MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico',
  NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island',
  SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington',
  WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming', PR: 'Puerto Rico' };
