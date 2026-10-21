const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync('torbox-library.js','utf8').replace('boot();\n})();','globalThis.hooks={parseResume,resumeMatch,resumeLibrary,installResumeBridge,resumeNames,play};\n})();');
function setup(torrents,history=[]){
 const calls=[],dialogs=[],searches=[],notices=[];
 const storage={mytorbox_recent_v1:JSON.stringify(history)};
 const context={console,URL,AbortController,setTimeout,clearTimeout,atob,localStorage:{getItem:k=>k==='torbox_api_key_b64'?btoa('fixture-key'):(storage[k]||null),setItem:(k,v)=>storage[k]=v},Lampa:{Select:{show:d=>dialogs.push(d),closeAll(){}},Controller:{toggle(){}},Noty:{show:s=>notices.push(s)},Search:{open:function(o){searches.push(o);return 42;}},Player:{play(){throw Error('Must not autoplay');}}},fetch:async url=>{const route=new URL(url).searchParams.get('url');calls.push(route);assert.match(route,/torrents\/mylist/);return {ok:true,json:async()=>({success:true,data:torrents})};}};
 context.window=context;vm.createContext(context);vm.runInContext(source,context);
 return {context,calls,dialogs,searches,notices,hooks:context.hooks};
}
const files=[1,2,3,4,5].map(n=>({id:n,name:`Special.Ops.Lioness.S01E0${n}.mkv`,size:1e9}));
test('movie resume shows the saved file under the requested localized title without catalog search',async()=>{
 const t={id:44,name:'Несчастный случай (Accident Man) (2018).mkv',files:[{id:1,name:'Accident.Man.2018.mkv',size:24e9}]};
 const x=setup([t],[{key:'44',file:'1',time:Date.now()}]);await x.hooks.resumeLibrary({t:'Несчастный случай'});
 assert.equal(x.searches.length,0);assert.equal(x.dialogs.length,1);
 assert.match(x.dialogs[0].title,/^Несчастный случай · v1\.4\.1$/);
 assert.equal(x.dialogs[0].items[0].title,'Видео 1');assert.equal(x.dialogs[0].items[0].file.id,1);
 assert.match(x.dialogs[0].items[0].subtitle,/Выбранное видео/);
});
test('resume uses only owned TorBox uploads and puts the requested S01E04 first without playback',async()=>{
 const t={id:10,name:'Спецназ: Львица Special Ops Lioness Сезон 1 1080p',files};const x=setup([t]);
 await x.hooks.resumeLibrary({t:'Спецназ: Львица',s:1,e:4});
 assert.equal(x.calls.length,1);assert.equal(x.dialogs.length,1);assert.equal(x.dialogs[0].items[0].file.id,4);
 assert.match(x.dialogs[0].items[0].subtitle,/Запрошенная серия/);assert.equal(x.dialogs[0].items.length,5);
});
test('continue without episode uses the saved last file; explicit request wins over history',async()=>{
 const t={id:10,name:'Friends.S01.1080p',files:files.map(f=>({...f,name:f.name.replace('Special.Ops.Lioness','Friends')}))};
 const x=setup([t],[{key:'10',file:'2',time:Date.now()}]);
 await x.hooks.resumeLibrary({t:'Friends'});assert.equal(x.dialogs.at(-1).items[0].file.id,2);
 await x.hooks.resumeLibrary({t:'Friends',s:1,e:4});assert.equal(x.dialogs.at(-1).items[0].file.id,4);
});
test('missing titles never fall back to the Lampa catalog; duplicate downloads require selection',async()=>{
 const x=setup([{id:1,name:'Other.S01',files}]);await x.hooks.resumeLibrary({t:'Львица'});
 assert.equal(x.searches.length,0);assert.equal(x.dialogs.length,1);assert.match(x.dialogs[0].items[0].title,/не найден/);
 const y=setup([{id:1,name:'Львица Lioness Сезон 1',files},{id:2,name:'Львица Lioness Сезон 1',files}]);await y.hooks.resumeLibrary({t:'Львица',s:1,e:4});
 assert.match(y.dialogs[0].items[0].title,/несколько загрузок/);
});
test('invalid seasons and unknown payload fields are rejected; ordinary searches pass through unchanged',()=>{
 const x=setup([]);x.hooks.installResumeBridge();
 const o={input:'Горячие головы'};assert.equal(x.context.Lampa.Search.open(o),42);assert.equal(x.searches[0],o);
 for(const req of [{t:'Львица',s:0},{t:'Львица',e:-1},{t:'Львица',url:'https://evil'},{t:'Львица',play:true},{t:[]},{t:'x'.repeat(101)}])assert.throws(()=>x.hooks.parseResume('__NEY_TORBOX__:'+JSON.stringify(req)));
});
test('bilingual titles match generically and sequels do not collide',()=>{
 const x=setup([]);
 for(const [ru,en] of [['Друзья','Friends'],['Поступь хаоса','Chaos Walking'],['Грань будущего','Edge of Tomorrow'],['Надежда','Hope']]){
  const t={name:`${ru} ${en} Сезон 1 [2020, WEB-DL]`};
  assert.equal(x.hooks.resumeMatch(t,ru),true);assert.equal(x.hooks.resumeMatch(t,en),true);
 }
 assert.equal(x.hooks.resumeMatch({name:'John Wick 2 (2017)'},'John Wick'),false);
 assert.equal(x.hooks.resumeMatch({name:'Hope 2 (2026)'},'Other 2'),false);
});
test('no remembered file never starts an arbitrary first episode or movie',async()=>{
 for(const files2 of [files,[{id:1,name:'Movie.mkv',size:1e9}]]){
  const x=setup([{id:1,name:'Example',files:files2}]);await x.hooks.resumeLibrary({t:'Example'});
  assert.match(x.dialogs.at(-1).items[0].title,/Нет истории/);
 }
});
test('Search.open replacement retains the library guard',async()=>{
 const x=setup([]);x.hooks.installResumeBridge();
 let replaced=0;x.context.Lampa.Search.open=()=>{replaced++;return 7;};
 assert.equal(x.context.Lampa.Search.open({input:'ordinary'}),7);
 x.context.Lampa.Search.open({input:'__NEY_TORBOX__:{"t":"Missing"}'});
 await new Promise(r=>setImmediate(r));assert.equal(replaced,1);assert.match(x.dialogs.at(-1).items[0].title,/не найден/);
});
test('recent history selects the most recently watched owned record; absent yesterday stops',async()=>{
 const x=setup([{id:1,name:'First',files},{id:2,name:'Second',files}],[{key:'1',file:'3',time:Date.now()-5000},{key:'2',file:'4',time:Date.now()}]);
 await x.hooks.resumeLibrary({t:'@recent'});assert.equal(x.dialogs.at(-1).items[0].file.id,4);assert.match(x.dialogs.at(-1).title,/Second/);
 await x.hooks.resumeLibrary({t:'@yesterday'});assert.match(x.dialogs.at(-1).items[0].title,/Нет истории/);
});
test('234-episode launch resolves one CDN link and keeps the complete ordered ViMu playlist',async()=>{
 const files=Array.from({length:234},(_,i)=>({id:i+1,name:`Example.S${String(Math.floor(i/24)+1).padStart(2,'0')}E${String(i%24+1).padStart(2,'0')}.mkv`,size:1e9}));
 const x=setup([]);let requests=0,launch,queue;
 x.context.fetch=async()=>{requests++;return {ok:true,json:async()=>({success:true,data:'https://cdn.example.invalid/fixture.mkv'})};};
 x.context.Lampa.Player={play:d=>{launch=d;},playlist:q=>queue=q,callback:()=>{}};
 x.context.Lampa.Storage={set(){}};
 await x.hooks.play({id:10,name:'Example',files},files[2],files);
 assert.equal(requests,1);assert.equal(queue.length,232);assert.equal(launch.playlist,queue);
 assert.equal(queue[0].episode,3);assert.equal(queue[1].episode,4);
 const next=new URL(queue[1].url);assert.equal(next.origin,'https://api.torbox.app');assert.equal(next.searchParams.get('redirect'),'true');assert.equal(next.searchParams.get('file_id'),'4');
});
test('movies use the same native Android ViMu launch route as series',async()=>{
 const x=setup([]);let launch;
 x.context.fetch=async()=>({ok:true,json:async()=>({success:true,data:'https://cdn.example.invalid/movie.mkv'})});
 x.context.Lampa.Player={play:d=>{launch=d;},playlist(){},callback(){}};
 const file={id:1,name:'Example.mkv',size:1e9};await x.hooks.play({id:11,name:'Example'},file,[file]);
 assert.equal(launch.launch_player,'android');assert.equal(launch.playlist.length,1);
});
test('recovery chooses the exact filename, not the history file',async()=>{
 const t={id:10,name:'Example',files};const x=setup([t],[{key:'10',file:'2',time:Date.now()}]);
 await x.hooks.resumeLibrary({t:'Example',f:files[3].name,z:120000});
 assert.equal(x.dialogs.at(-1).items[0].file.id,4);
 await x.hooks.resumeLibrary({t:'Example',f:'Missing.S01E99.mkv',z:120000});
 assert.match(x.dialogs.at(-1).items[0].title,/серия не найдена/);
});
test('session handoff contains only bounded owned filenames and sizes, never stream URLs or keys',async()=>{
 const x=setup([]);let handoff,launch;
 x.context.AndroidJS={openBrowser:u=>handoff=u};
 x.context.fetch=async()=>({ok:true,json:async()=>({success:true,data:'https://cdn.example.invalid/movie.mkv'})});
 x.context.Lampa.Player={play:d=>launch=d,playlist(){},callback(){}};
 const f={id:1,name:'Example.mkv',size:1e9};await x.hooks.play({id:11,name:'Example'},f,[f],{t:'Example',n:'a'.repeat(32)});
 const payload=JSON.parse(new URL(handoff).searchParams.get('data'));assert.equal(payload.selected,'Example.mkv');
 assert.equal(payload.files.length,1);assert.deepEqual(Object.keys(payload.files[0]).sort(),['name','size']);
 assert.ok(!JSON.stringify(payload).includes('https'));assert.ok(!JSON.stringify(payload).includes('fixture-key'));assert.ok(launch);
});
test('recovery supplies a saved position and restores the native resume preference',async()=>{
 const x=setup([]);const changes=[];let launch;
 x.context.AndroidJS={storageChange:j=>changes.push(JSON.parse(j))};x.context.Lampa.Storage={field:()=> 'ask'};
 x.context.fetch=async()=>({ok:true,json:async()=>({success:true,data:'https://cdn.example.invalid/movie.mkv'})});
 x.context.Lampa.Player={play:d=>launch=d,playlist(){},callback(){}};
 const f={id:1,name:'Example.mkv',size:1e9};await x.hooks.play({id:11,name:'Example'},f,[f],{t:'Example',f:f.name,z:123000});
 assert.equal(launch.timeline.time,123);assert.equal(launch.position,123);assert.equal(changes[0].value,'continue');
 await new Promise(r=>setTimeout(r,1100));assert.equal(changes.at(-1).value,'ask');
 for(const req of [{t:'Example',n:'invalid'},{t:'Example',f:'https://evil'},{t:'Example',z:1200},{t:'Example',f:'Example.mkv',z:-1}])assert.throws(()=>x.hooks.parseResume('__NEY_TORBOX__:'+JSON.stringify(req)));
});

test('startup recovery without a measured position preserves the native resume choice',async()=>{
 const x=setup([]);const changes=[];let launch;
 x.context.AndroidJS={storageChange:j=>changes.push(j)};
 x.context.fetch=async()=>({ok:true,json:async()=>({success:true,data:'https://cdn.example.invalid/movie.mkv'})});
 x.context.Lampa.Player={play:d=>launch=d,playlist(){},callback(){}};
 const f={id:1,name:'Example.mkv',size:1e9};await x.hooks.play({id:11,name:'Example'},f,[f],{t:'Example',f:f.name});
 assert.equal(changes.length,0);assert.equal(launch.position,undefined);assert.ok(launch);
});
