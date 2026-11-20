import {test} from 'node:test';import assert from 'node:assert/strict';import {taiwanDay,similarGame,eligible} from '../scripts/content-rules.mjs';
test('Taiwan midnight boundary',()=>{assert.equal(taiwanDay(Date.parse('2026-11-20T16:00Z')),'2026-11-21');assert.equal(taiwanDay(Date.parse('2026-11-20T15:59Z')),'2026-11-20')});
test('Renamed same game is duplicate',()=>{assert.ok(similarGame({title:'a',materials:['布'],how:'成人展示布巾躲貓貓'},{title:'b',materials:['布'],how:'成人展示布巾躲貓貓'}))});
test('Incomplete or expired source rejected',()=>{assert.equal(eligible({}),null);assert.equal(eligible({first_day:'2020-01-01',source_url:'https://example.com'}),null)});
