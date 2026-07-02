// All dimensions in meters, matching official NBA specifications.

export const COURT_LEN = 28.65;         // 94 ft
export const COURT_WID = 15.24;         // 50 ft
export const RIM_HEIGHT = 3.048;        // 10 ft
export const RIM_RADIUS = 0.2286;       // 18 in diameter
export const RIM_TUBE = 0.021;
export const BALL_RADIUS = 0.121;       // regulation size 7

export const BACKBOARD_FROM_BASELINE = 1.22;   // 4 ft
export const RIM_FROM_BASELINE = 1.575;        // rim center
export const BACKBOARD_W = 1.829;              // 6 ft
export const BACKBOARD_H = 1.067;              // 3.5 ft
export const BACKBOARD_BOTTOM = 2.9;

export const HOOP_X = COURT_LEN / 2 - RIM_FROM_BASELINE;
export const BOARD_X = COURT_LEN / 2 - BACKBOARD_FROM_BASELINE;

export const THREE_PT_R = 7.24;         // 23.75 ft arc
export const THREE_PT_CORNER = 6.71;    // 22 ft in corners
export const KEY_W = 4.88;              // 16 ft
export const KEY_L = 5.79;              // 19 ft from baseline
export const FT_CIRCLE_R = 1.83;
export const CENTER_CIRCLE_R = 1.83;
export const RESTRICTED_R = 1.22;

export const GRAVITY = -9.81;

export const QUARTERS = 4;
export const SHOT_CLOCK = 24;

export const TEAMS = {
  LAL: { name: 'Los Angeles', nick: 'Lakers',   abbr: 'LAL', color: 0x552583, alt: 0xfdb927, jersey: '#552583', trim: '#fdb927' },
  BOS: { name: 'Boston',      nick: 'Celtics',  abbr: 'BOS', color: 0x007a33, alt: 0xffffff, jersey: '#007a33', trim: '#ffffff' },
  GSW: { name: 'Golden State',nick: 'Warriors', abbr: 'GSW', color: 0x1d428a, alt: 0xffc72c, jersey: '#1d428a', trim: '#ffc72c' },
  CHI: { name: 'Chicago',     nick: 'Bulls',    abbr: 'CHI', color: 0xce1141, alt: 0x000000, jersey: '#ce1141', trim: '#ffffff' },
  NYK: { name: 'New York',    nick: 'Knicks',   abbr: 'NYK', color: 0x006bb6, alt: 0xf58426, jersey: '#006bb6', trim: '#f58426' },
  MIA: { name: 'Miami',       nick: 'Heat',     abbr: 'MIA', color: 0x98002e, alt: 0xf9a01b, jersey: '#98002e', trim: '#f9a01b' },
};

// Archetypes by lineup slot: PG, SG, SF, PF, C
export const ARCHETYPES = [
  { pos: 'PG', height: 1.88, speed: 6.6, shooting: 0.82, three: 0.78, number: 1 },
  { pos: 'SG', height: 1.96, speed: 6.3, shooting: 0.84, three: 0.80, number: 2 },
  { pos: 'SF', height: 2.03, speed: 6.0, shooting: 0.78, three: 0.72, number: 3 },
  { pos: 'PF', height: 2.08, speed: 5.6, shooting: 0.74, three: 0.60, number: 4 },
  { pos: 'C',  height: 2.13, speed: 5.3, shooting: 0.70, three: 0.45, number: 5 },
];

export const DIFFICULTY = {
  rookie:  { aiSpeed: 0.85, aiShoot: 0.80, aiSteal: 0.4, label: 'Rookie' },
  pro:     { aiSpeed: 1.00, aiShoot: 1.00, aiSteal: 1.0, label: 'Pro' },
  allstar: { aiSpeed: 1.08, aiShoot: 1.12, aiSteal: 1.6, label: 'All-Star' },
};
