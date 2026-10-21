const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync('torbox-library.js','utf8').replace('boot();\n})();','globalThis.hooks={parseResume,resumeMatch,resumeLibrary,installResumeBridge};\n})();');
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
 assert.match(x.dialogs[0].title,/^Несчастный случай · v1\.3\.1$/);
 assert.equal(x.dialogs[0].items[0].title,'Видео 1');assert.equal(x.dialogs[0].items[0].file.id,1);
 assert.match(x.dialogs[0].items[0].subtitle,/Выбранное видео/);
});
test('resume uses only owned TorBox uploads and puts the requested S01E04 first without playback',async()=>{
 const t={id:10,name:'Special.Ops.Lioness.S01.1080p',files};const x=setup([t]);
 await x.hooks.resumeLibrary({t:'Спецназ: Львица',s:1,e:4});
 assert.equal(x.calls.length,1);assert.equal(x.dialogs.length,1);assert.equal(x.dialogs[0].items[0].file.id,4);
 assert.match(x.dialogs[0].items[0].subtitle,/Запрошенная серия/);assert.equal(x.dialogs[0].items.length,5);
});
test('continue without episode uses the saved last file; explicit request wins over history',async()=>{
 const t={id:10,name:'Friends.S01.1080p',files:files.map(f=>({...f,name:f.name.replace('Special.Ops.Lioness','Friends')}))};
 const x=setup([t],[{key:'10',file:'2',time:Date.now()}]);
 await x.hooks.resumeLibrary({t:'Друзья'});assert.equal(x.dialogs.at(-1).items[0].file.id,2);
 await x.hooks.resumeLibrary({t:'Друзья',s:1,e:4});assert.equal(x.dialogs.at(-1).items[0].file.id,4);
});
test('missing titles never fall back to the Lampa catalog; duplicate downloads require selection',async()=>{
 const x=setup([{id:1,name:'Other.S01',files}]);await x.hooks.resumeLibrary({t:'Львица'});
 assert.equal(x.searches.length,0);assert.equal(x.dialogs.length,0);assert.match(x.notices.at(-1),/не найден/);
 const y=setup([{id:1,name:'Lioness.S01',files},{id:2,name:'Lioness.S01',files}]);await y.hooks.resumeLibrary({t:'Львица',s:1,e:4});
 assert.equal(y.dialogs[0].items.length,2);assert.ok(y.dialogs[0].items.every(i=>i.torrent));
});
test('invalid seasons and unknown payload fields are rejected; ordinary searches pass through unchanged',()=>{
 const x=setup([]);x.hooks.installResumeBridge();
 const o={input:'Горячие головы'};assert.equal(x.context.Lampa.Search.open(o),42);assert.equal(x.searches[0],o);
 for(const req of [{t:'Львица',s:0},{t:'Львица',e:-1},{t:'Львица',url:'https://evil'},{t:'Львица',play:true},{t:[]},{t:'x'.repeat(101)}])assert.throws(()=>x.hooks.parseResume('__NEY_TORBOX__:'+JSON.stringify(req)));
});
