// The exports scripts/dead.ts must sort: one another file uses, one nothing uses, one only a test uses, one a test
// uses that this file uses too, and a number this file alone uses (exported so the bundler inlines it: let be).
export const fixtureUsed = 1;
export const fixtureUnused = 2;
export const fixtureTestOnly = 3;
export const fixtureTested = [4];
export const FIXTURE_SIZE = 8;
export const fixtureSum = () => fixtureTested[0] + FIXTURE_SIZE;
