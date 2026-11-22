import {test} from 'node:test';
import assert from 'node:assert/strict';
import {modeUrl,readDemoMode} from './mode';

test('only the exact demo query selects computer versus computer',()=>{
  assert.equal(readDemoMode('?mode=demo'),true);
  assert.equal(readDemoMode('?mode=play'),false);
  assert.equal(readDemoMode('?mode=DEMO'),false);
});

test('switching mode updates only the mode query without adding history',()=>{
  const href='https://example.test/game?seed=42&mode=play#planet';
  assert.equal(modeUrl(href,true),'/game?seed=42&mode=demo#planet');
  assert.equal(modeUrl(href,false),'/game?seed=42#planet');
});
