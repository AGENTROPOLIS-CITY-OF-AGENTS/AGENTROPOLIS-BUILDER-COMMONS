import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateResource, authorizeBuild } from '../packages/resource-intelligence/index.mjs';
const valid = {name:'Example',url:'https://example.org/tool',license:'Apache-2.0',provenance:{source:'upstream',checkedAt:'2026-11-05'},security:{reviewedAt:'2026-11-05',risk:'low'},benchmark:{reproducible:true,score:0.91},requestedState:'approved'};
test('verified resource may become eligible but has no execution authority',()=>{const r=evaluateResource(valid);assert.equal(r.eligible,true);assert.equal(r.executionAuthority,false);assert.equal(r.state,'approved')});
test('unknown evidence blocks approval',()=>{const r=evaluateResource({...valid,license:'UNKNOWN'});assert.equal(r.eligible,false);assert.equal(r.state,'reviewed')});
test('high risk blocks approval',()=>{const r=evaluateResource({...valid,security:{reviewedAt:'2026-11-05',risk:'high'}});assert.equal(r.eligible,false)});
test('local URLs rejected',()=>{for(const url of ['http://example.org','https://localhost/a','https://127.0.0.1/a','https://192.168.1.2/a']) assert.throws(()=>evaluateResource({...valid,url}))});
test('build requires all five gates',()=>{assert.equal(authorizeBuild({identity:true,mandate:true,policy:true,toolPermission:true}).allowed,false);assert.equal(authorizeBuild({identity:true,mandate:true,policy:true,toolPermission:true,humanApproval:true}).allowed,true)});
