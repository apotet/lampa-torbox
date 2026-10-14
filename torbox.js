/* My TorBox library for Lampa. v1.0 */
(function(){
'use strict';
if(window.__myTorboxLibrary01)return; window.__myTorboxLibrary01=true;
function toast(s){if(window.Lampa&&Lampa.Noty)Lampa.Noty.show(s);else console.log(s);}
function token(){try{return atob(localStorage.getItem('torbox_api_key_b64')||'');}catch(e){return '';}}
function proxy(){return localStorage.getItem('torbox_proxy_url')||'https://my-torbox-proxy.slonce70.workers.dev';}
function safe(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function proxied(url){var u=new URL(proxy());u.searchParams.set('url',url);return u.toString();}
async function api(route){var key=token();if(!key)throw Error('Сначала введи ключ в Настройки → TorBox');
var ctl=new AbortController(),t=setTimeout(function(){ctl.abort();},25000);
try{var r=await fetch(proxied('https://api.torbox.app/v1/api/'+route),{headers:{'X-Api-Key':key},signal:ctl.signal});if(!r.ok)throw Error('TorBox HTTP '+r.status);
var j=await r.json();if(j.success===false)throw Error(j.detail||j.error||'Ошибка TorBox');return j.data;}finally{clearTimeout(t);}}
var returnController='settings';
function openLibrary(controller){returnController=controller;list();}
function choose(title,items,callback){if(!items.length){toast('Пусто');return;}Lampa.Select.show({title:title,items:items,onSelect:function(item){Lampa.Select.close();callback(item);},onBack:function(){Lampa.Controller.toggle(returnController);}});}
function textSize(n){if(!n)return '';return ' · '+(Number(n)/1073741824).toFixed(1)+' ГБ';}
var recentKey='mytorbox_recent_v1';
function recent(){try{var r=JSON.parse(localStorage.getItem(recentKey)||'[]');return Array.isArray(r)?r.filter(function(v){return v&&typeof v.key==='string'&&isFinite(v.time)&&v.time>0;}):[];}catch(e){return [];}}
function torrentKey(t){return String(t.hash||(t.id!=null?t.id:(t.name||'')));}
function fileKey(f){return String(f.id!=null?f.id:(f.path||f.name||''));}
function remember(t,f){try{var key=torrentKey(t),r=recent().filter(function(v){return v.key!==key;});r.unshift({key:key,file:fileKey(f),time:Date.now()});localStorage.setItem(recentKey,JSON.stringify(r.slice(0,100)));}catch(e){/* Playback remains available if storage is full. */}}
function lastPlayed(t,r){var key=torrentKey(t);for(var i=0;i<r.length;i++)if(r[i].key===key)return r[i];return null;}
function sortLibrary(arr,r){return arr.sort(function(a,b){var ar=lastPlayed(a,r),br=lastPlayed(b,r);return ((br&&br.time)||0)-((ar&&ar.time)||0)||(Date.parse(b.created_at)||0)-(Date.parse(a.created_at)||0);});}
var libraryData=[],libraryQuery='',libraryView=0,metaQueue=[],metaActive=0,metaPending={};
var metaKey='mytorbox_metadata_v3',metadata={};
try{var stored=JSON.parse(localStorage.getItem(metaKey)||'{}');if(stored&&typeof stored==='object'&&!Array.isArray(stored))metadata=stored;}catch(e){}
function normalize(s){return String(s||'').toLowerCase().replace(/ё/g,'е').replace(/[^a-zа-я0-9]/g,'');}
function cleanName(name){
var s=String(name||'Без названия').split('/').pop().replace(/\.(mkv|mp4|avi|m4v|ts|mov|webm)$/i,'').replace(/[._]/g,' '),year='',m,found,re=/\b(19\d{2}|20\d{2})\b/g;
while((found=re.exec(s)))if(found.index>0)m=found;
if(m&&m.index>0){year=m[1];s=s.slice(0,m.index);}
s=s.replace(/(?:\s+Сезон\s*\d+.*|\s+Серии?\s*\d+.*|\s+Season\s*\d+.*)$/i,'').replace(/\b(?:S\d{1,2}(?:E\d{1,3})?|\d{3,4}p|WEB[ -]?DL|WEBRip|BDRemux|BluRay|HDRip|HDTV|DVDRip|HEVC|HDR|H[ -]?26[45]|x26[45])\b.*$/i,'').replace(/\[[^\]]*\]/g,'').replace(/[-–]+/g,' ').replace(/\s+/g,' ').trim();
return {title:s||String(name||'Без названия'),year:year};}
function metaCacheKey(t){var n=cleanName(t.name);return normalize(n.title)+'|'+n.year;}
function cachedMeta(t){var c=metadata[metaCacheKey(t)];return c&&Date.now()-c.at<(c.data?2592000000:43200000)?c:null;}
function saveMetadata(){try{var keys=Object.keys(metadata).sort(function(a,b){return metadata[b].at-metadata[a].at;});var next={};keys.slice(0,250).forEach(function(k){next[k]=metadata[k];});metadata=next;localStorage.setItem(metaKey,JSON.stringify(metadata));}catch(e){}}
function searchNames(t){
var n=cleanName(t.name).title,raw=String(t.name||'').replace(/[._]/g,' '),out=[n];
var alias=n.replace(/\s*\([^)]*\)/g,'').replace(/\s*\[[^\]]*\]/g,'').trim();
if(alias&&alias!==n)out.push(alias);
var parts=n.split(/\s*[-–—|/]\s*/);
if(parts.length>1){out.push(parts[0]);out.push(parts[parts.length-1]);}
var en=raw.match(/([A-Za-z][A-Za-z0-9 '\-]{3,50})(?:\s+(?:S\d|Season|20\d\d|1080p|2160p))/i);
if(en)out.push(en[1].trim());
return out.map(function(x){return x.trim();}).filter(function(x,i,a){return x.length>2&&a.indexOf(x)===i;}).slice(0,4);
}
function matchMetadata(t,results){
var names=searchNames(t),n=cleanName(t.name),scores=(results||[]).filter(function(v){return (v.media_type==='movie'||v.media_type==='tv')&&v.poster_path;}).map(function(v){
var names2=[v.title,v.name,v.original_title,v.original_name].filter(Boolean).map(normalize);
var titleScore=0;names.forEach(function(x){var q=normalize(x);names2.forEach(function(y){if(q&&q===y)titleScore=Math.max(titleScore,100);else if(q.length>5&&y.length>5&&(q.indexOf(y)===0||y.indexOf(q)===0))titleScore=Math.max(titleScore,65);});});
var yr=String(v.release_date||v.first_air_date||'').slice(0,4),yearScore=(!n.year||!yr)?0:(Number(yr)===Number(n.year)?20:(Math.abs(Number(yr)-Number(n.year))===1?-5:-40));
return {item:v,score:titleScore+yearScore};
}).filter(function(x){return x.score>=65;}).sort(function(a,b){return b.score-a.score;});
return scores.length&&(!scores[1]||scores[0].score>scores[1].score)?scores[0].item:null;
}
function resolveMetadata(t,callback){
var c=cachedMeta(t),key=metaCacheKey(t);if(c){callback(c.data);return;}
if(!Lampa.TMDB||!Lampa.TMDB.api||!Lampa.TMDB.key){callback(null);return;}
if(metaPending[key]){metaPending[key].push(callback);return;}
metaPending[key]=[callback];metaQueue.push({key:key,torrent:t});pumpMetadata();}
function pumpMetadata(){while(metaActive<2&&metaQueue.length){(function(job){
metaActive++;
var names=searchNames(job.torrent),all=[],index=0;
function finish(data){metadata[job.key]={at:Date.now(),data:data};saveMetadata();var callbacks=metaPending[job.key]||[];delete metaPending[job.key];metaActive--;callbacks.forEach(function(cb){try{cb(data);}catch(e){}});pumpMetadata();}
function next(){
if(index>=names.length){finish(matchMetadata(job.torrent,all));return;}
var query=names[index++],ctl=new AbortController(),timer=setTimeout(function(){ctl.abort();},6500);
var url=Lampa.TMDB.api('search/multi?api_key='+encodeURIComponent(Lampa.TMDB.key())+'&language=ru-RU&include_adult=false&query='+encodeURIComponent(query));
fetch(url,{signal:ctl.signal}).then(function(r){if(!r.ok)throw Error('Metadata unavailable');return r.json();}).then(function(data){
all=all.concat(data.results||[]);var match=matchMetadata(job.torrent,all);if(match)finish(match);else next();
}).catch(function(){next();}).finally(function(){clearTimeout(timer);});
}
next();
})(metaQueue.shift());}}
function searchLibrary(){if(!Lampa.Input||!Lampa.Input.edit){toast('Клавиатура Lampa недоступна');showLibrary();return;}
Lampa.Input.edit({title:'Поиск в Мой TorBox',value:libraryQuery,free:true,nosave:true},function(value){libraryQuery=String(value||'').trim();showLibrary();});}
function drawCard(row,item,view,load){
if(!item.torrent)return;
var $=window.jQuery||window.$;if(!$)return;
row.addClass('mytorbox-card');row.attr('title',item.torrent.name||'');var poster=row.find('.mytorbox-poster');if(!poster.length){poster=$('<div class="mytorbox-poster">▶</div>');row.prepend(poster);}
if(!load&&!cachedMeta(item.torrent))return;
resolveMetadata(item.torrent,function(data){if(view!==libraryView||!data)return;
row.find('.selectbox-item__title').text(data.title||data.name||item.clean.title);
if(data.poster_path&&/^\/[a-zA-Z0-9_.-]+$/.test(data.poster_path)&&Lampa.TMDB.image){var img=$('<img alt="">');img.attr('src',Lampa.TMDB.image('t/p/w185'+data.poster_path));img.on('error',function(){poster.text('▶');});poster.empty().append(img);}
});}
function showLibrary(){
var view=++libraryView,drawn=0,r=recent(),q=normalize(libraryQuery),arr=sortLibrary(libraryData.slice(),r).filter(function(t){var n=cleanName(t.name),m=cachedMeta(t),d=m&&m.data;return !q||normalize(t.name).indexOf(q)>=0||normalize(n.title).indexOf(q)>=0||(d&&normalize(d.title||d.name).indexOf(q)>=0);});
var items=[{title:'⌕ Поиск по библиотеке',subtitle:libraryQuery?'Запрос: '+safe(libraryQuery):'Найти фильм или сериал',action:'search'}];
if(libraryQuery)items.push({title:'Показать все загрузки',action:'clear'});
if(!arr.length)items.push({title:'Ничего не найдено',subtitle:'Измени запрос или покажи все загрузки',noenter:true});
arr.forEach(function(t){var n=cleanName(t.name),c=cachedMeta(t),d=c&&c.data;items.push({title:safe(d?(d.title||d.name):n.title),subtitle:(lastPlayed(t,r)?'Недавно смотрели · ':'')+(n.year?n.year+' · ':'')+safe(t.download_state||t.status||'')+textSize(t.size)+'<br><small>'+safe(t.name||'')+'</small>',torrent:t,clean:n});});
Lampa.Select.show({title:'Мой TorBox · '+arr.length+(libraryQuery?' / '+libraryData.length:''),items:items,onDraw:function(row,item){drawCard(row,item,view,drawn++<12);},onFocus:function(item,row){var $=window.jQuery||window.$;if($)drawCard($(row),item,view,true);},onSelect:function(item){libraryView++;Lampa.Select.close();if(item.action==='search')searchLibrary();else if(item.action==='clear'){libraryQuery='';showLibrary();}else files(item.torrent);},onBack:function(){libraryView++;Lampa.Controller.toggle(returnController);}});}
function list(){toast('Загружаю библиотеку TorBox…');api('torrents/mylist?limit=1000&bypass_cache=true').then(function(data){
libraryData=Array.isArray(data)?data:(!data?[]:[data]);showLibrary();
}).catch(function(e){toast('Библиотека: '+e.message);});}
function files(torrent){var files=Array.isArray(torrent.files)?torrent.files:[];if(!files.length){toast('В этом торренте нет файлов. Обновляю…');api('torrents/mylist?id='+encodeURIComponent(torrent.id)+'&bypass_cache=true').then(function(r){filesView(torrent,Array.isArray(r)?(r[0]&&r[0].files||[]):(r&&r.files||[]));}).catch(function(e){toast(e.message);});}else filesView(torrent,files);}
function episodeTitle(f,index){
var raw=String(f.name||f.path||''),m=raw.match(/S(\d{1,2})[ ._-]*E(\d{1,3})/i)||raw.match(/(\d{1,2})x(\d{1,3})/i);
if(m)return 'Сезон '+Number(m[1])+' · Серия '+Number(m[2]);
var e=raw.match(/(?:серия|episode|ep)[ ._-]*(\d{1,3})/i);
return e?'Серия '+Number(e[1]):'Видео '+(index+1);
}
function filesView(torrent,arr){var vids=arr.filter(function(f){return /\.(mkv|mp4|avi|m4v|ts|mov|webm)$/i.test(f.name||f.path||'');});if(!vids.length){toast('Видео в этой загрузке не найдено');return;}
var last=lastPlayed(torrent,recent());
if(last)vids.sort(function(a,b){return Number(fileKey(b)===last.file)-Number(fileKey(a)===last.file);});
var entries=vids.map(function(f,i){return {title:safe(episodeTitle(f,i)),subtitle:((last&&fileKey(f)===last.file)?'▶ Последний запуск · ':'')+textSize(f.size).trim()+'<br><small>'+safe((f.name||f.path||'').split('/').pop())+'</small>',file:f};});
Lampa.Select.show({title:safe(cleanName(torrent.name).title),items:entries,onDraw:function(row){var $=window.jQuery||window.$;if($)$(row).addClass('mytorbox-file');},onSelect:function(item){Lampa.Select.close();play(torrent,item.file);},onBack:function(){showLibrary();}});}
function play(torrent,file){toast('Получаю ссылку для воспроизведения…');
api('torrents/requestdl?torrent_id='+encodeURIComponent(torrent.id)+'&file_id='+encodeURIComponent(file.id)+'&token='+encodeURIComponent(token())).then(function(link){
if(typeof link!=='string'||!/^https:\/\//.test(link))throw Error('Нет ссылки для воспроизведения');
var name=(file.name||file.path||torrent.name||'TorBox').split('/').pop();
Lampa.Player.play({url:link,title:name,card:{title:name},movie:{title:name}});
remember(torrent,file);
}).catch(function(e){toast('Воспроизведение: '+e.message);});}
function addMenu(){
if(!window.jQuery&&!window.$){setTimeout(addMenu,500);return;}
var $=window.jQuery||window.$;
var menu=$('.menu .menu__list').eq(0);
if(!menu.length){setTimeout(addMenu,500);return;}
if(menu.find('[data-action="mytorbox_library"]').length)return;
var button=$('<li class="menu__item selector" data-action="mytorbox_library"><div class="menu__ico"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7h18v13H3zM3 7l4-4h10l4 4M8 12h8"/></svg></div><div class="menu__text">Мой TorBox</div></li>');
button.on('hover:enter',function(){openLibrary('menu');});
var home=menu.find('[data-action="main"]').first();
var history=menu.find('[data-action="history"]').first();
var historyName=history.length?history.find('.menu__text').text().trim():'';
if(Lampa.Storage&&Lampa.Storage.get&&Lampa.Storage.set&&!Lampa.Storage.get('mytorbox_menu_position_v05',false)){
var order=Lampa.Storage.get('menu_sort','[]');
if(!Array.isArray(order))order=[];
order=order.filter(function(name){return name!=='Мой TorBox';});
if(!order.length)menu.find('.menu__item .menu__text').each(function(){order.push($(this).text().trim());});
var homeName=home.length?home.find('.menu__text').text().trim():'';
var homeIndex=order.indexOf(homeName);
order.splice(homeIndex>=0?homeIndex+1:0,0,'Мой TorBox');
if(historyName){
order=order.filter(function(name){return name!==historyName;});
order.splice(order.indexOf('Мой TorBox')+1,0,historyName);
}
Lampa.Storage.set('menu_sort',order);
Lampa.Storage.set('mytorbox_menu_position_v05',true);
}
if(home.length)button.insertAfter(home);
else menu.prepend(button);
if(history.length)history.insertAfter(button);
}
function boot(){if(!window.Lampa||!Lampa.SettingsApi||!Lampa.Select){setTimeout(boot,500);return;}
var $=window.jQuery||window.$;if($&&!$('#mytorbox-card-style').length)$('head').append('<style id="mytorbox-card-style">.mytorbox-card{display:block!important;position:relative!important;box-sizing:border-box!important;min-height:7.2em!important;padding:1em 1.2em 1em 6.5em!important;overflow:hidden!important;white-space:normal!important}.mytorbox-card .mytorbox-poster{position:absolute!important;left:1em;top:50%;transform:translateY(-50%);width:4.2em;height:6.1em;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.1);border-radius:.35em;overflow:hidden}.mytorbox-card .mytorbox-poster img{width:100%;height:100%;object-fit:cover}.mytorbox-card .selectbox-item__title,.mytorbox-card .selectbox-item__subtitle{display:block!important;position:relative!important;box-sizing:border-box!important;width:100%!important;max-width:100%!important;min-width:0!important;margin-left:0!important;white-space:normal!important;overflow:hidden!important;overflow-wrap:break-word!important;word-break:normal!important}.mytorbox-card .selectbox-item__title{line-height:1.3!important;display:-webkit-box!important;-webkit-box-orient:vertical;-webkit-line-clamp:2}.mytorbox-card .selectbox-item__subtitle{line-height:1.35!important;font-size:.8em!important;max-height:3.9em;opacity:.8}.mytorbox-card .selectbox-item__subtitle small{display:block!important;font-size:.85em!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;max-width:100%!important;opacity:.65} .mytorbox-file{box-sizing:border-box!important;padding:.65em 1.1em!important;min-height:4.3em!important;overflow:hidden!important}.mytorbox-file .selectbox-item__title,.mytorbox-file .selectbox-item__subtitle{display:block!important;width:100%!important;max-width:100%!important;min-width:0!important;overflow:hidden!important;white-space:normal!important;overflow-wrap:anywhere!important}.mytorbox-file .selectbox-item__title{font-size:1em!important;font-weight:600!important;line-height:1.25!important}.mytorbox-file .selectbox-item__subtitle{font-size:.75em!important;line-height:1.3!important;opacity:.8}.mytorbox-file .selectbox-item__subtitle small{display:block!important;font-size:.85em!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;opacity:.65}</style>');
Lampa.SettingsApi.addComponent({component:'mytorbox_library',name:'Мой TorBox',icon:'<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7h18v13H3zM3 7l4-4h10l4 4M8 12h8"/></svg>'});
Lampa.SettingsApi.addParam({component:'mytorbox_library',param:{name:'mytorbox_open',type:'button'},field:{name:'Открыть библиотеку TorBox',description:'Торренты и файлы, добавленные в TorBox, включая ручные загрузки'},onChange:function(){openLibrary('settings');}});
if(window.appready)addMenu();
else if(Lampa.Listener&&Lampa.Listener.follow)Lampa.Listener.follow('app',function(e){if(e.type==='ready')addMenu();});
else addMenu();
}
boot();
})();








