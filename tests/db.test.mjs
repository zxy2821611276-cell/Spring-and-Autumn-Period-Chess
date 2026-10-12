import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {createRequire} from 'node:module';const ts=createRequire(import.meta.url)('typescript');
const dbRows = new Map();
function getDatabase(){return {sql(strings,...args){
  const query = strings.join(' ? ').replace(/\s+/g,' ').trim();
  if (query.startsWith('SELECT')) {
    const row=dbRows.get(args[0]); return Promise.resolve(row?[{data:row.data,revision:row.revision}]:[]);
  }
  if (query.startsWith('INSERT')) {
    const [id,data,createdAt]=args;
    if(dbRows.has(id))return Promise.resolve([]);
    dbRows.set(id,{data,revision:0,createdAt});return Promise.resolve([{id}]);
  }
  if (query.startsWith('UPDATE')) {
    const [data,id,revision]=args;
    const current=dbRows.get(id);
    if(!current||current.revision!==revision)return Promise.resolve([]);
    current.revision++;current.data=data;
    return Promise.resolve([{revision:current.revision}]);
  }
  throw Error('unexpected statement: '+query);
}}}
globalThis.__cqTestGetDB=getDatabase;
let source=fs.readFileSync('db/rooms.ts','utf8').replace('import { getDatabase } from "@netlify/database";', 'const getDatabase=globalThis.__cqTestGetDB;');
const temp='tests/.db-test.mjs';
fs.writeFileSync(temp,ts.transpile(source,{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}));
const {findRoom,createRoom,saveRoom}=await import('./.db-test.mjs');
test('database adapter preserves serialisation and revision-based compare-and-swap',async()=>{
  const id=await createRoom('{"phase":"waiting"}');assert.match(id,/^[A-F0-9]{8}$/);
  assert.deepEqual(await findRoom(id),{data:'{"phase":"waiting"}',revision:0});
  assert.equal(await saveRoom(id,0,'{"phase":"playing"}'),true);
  assert.equal(await saveRoom(id,0,'{"phase":"bad"}'),false);
  const row=await findRoom(id);assert.equal(row.revision,1);assert.equal(row.data,'{"phase":"playing"}');
  assert.equal(await findRoom('FFFFFFFF'),null);
});
process.on('exit',()=>{try{fs.unlinkSync(temp)}catch{}});
