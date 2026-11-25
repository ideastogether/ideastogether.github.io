import {test} from 'node:test';
import assert from 'node:assert/strict';
import '../assets/game-discovery.js';
const {filter,pick,daily}=globalThis.GameDiscovery;
const game=(id,extra={})=>({id,status:'approved',age:3,materials:['紙杯'],tags:['室內'],duration_label:'5–15 分鐘',...extra});
const rows=[game('a'),game('b',{age:5}),game('c',{status:'pending'}),game('d',{duration_label:null}),game('e',{materials:[],duration_label:'5 分鐘內'})];
test('All conditions must match; missing time and unpublished games excluded',()=>{
  assert.deepEqual(filter(rows,{age:'3',time:'15',scene:'室內',materials:['紙杯']}).map(g=>g.id),['a','e']);
  assert.deepEqual(filter(rows,{age:'3',time:'5',materials:[]}).map(g=>g.id),['e']);
  assert.deepEqual(filter(rows,{scene:'戶外'}),[]);
});
test('Stored age indices map to minimum actual age; legacy index 6 is six years',()=>{
  assert.equal(filter([game('x',{age:6})],{age:'5'}).length,0);
  assert.equal(filter([game('x',{age:6})],{age:'6'}).length,1);
  assert.equal(filter([game('x',{age:8})],{age:'9'}).length,0);
});
test('Abilities and incomplete legacy records remain compatible',()=>{
  assert.equal(filter(rows).length,4);
  assert.equal(filter(rows,{abilities:['手眼協調']}).length,0);
  assert.equal(filter([game('x',{abilities:['手眼協調']})],{abilities:['手眼協調']}).length,1);
});
test('At most three unique recommendations; prioritize alternatives when rerolling',()=>{
  const pool=Array.from({length:8},(_,i)=>game(String(i)));
  const first=pick(pool,[],()=>0.5),next=pick(pool,first.map(g=>g.id),()=>0.5);
  assert.equal(first.length,3);assert.equal(new Set(first.map(g=>g.id)).size,3);
  assert.ok(next.every(g=>!first.includes(g)));
  assert.equal(pick([]).length,0);assert.equal(pick(pool.slice(0,1),['0']).length,1);
});
test('Daily recommendation is stable across input ordering and rotates at Taiwan midnight',()=>{
  const pool=[game('a'),game('b'),game('c',{status:'pending'})];
  const before=new Date('2026-11-25T15:59:59Z'),after=new Date('2026-11-25T16:00:00Z');
  assert.equal(daily(pool,before).id,daily([...pool].reverse(),before).id);
  assert.notEqual(daily(pool,before).id,daily(pool,after).id);assert.equal(daily([]),null);
});
