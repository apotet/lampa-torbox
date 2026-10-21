/* My TorBox library for Lampa. v1.2.2 — native ViMu episode playlist */
(function(){
'use strict';
if(window.__myTorboxLibrary01)return; window.__myTorboxLibrary01=true;
var VERSION='1.2.2',playbackSession=0,ownedPlayback=0,latestSelect=null;
window.__myTorboxLibraryVersion=VERSION;
function playerOwnsScreen(){
if(!ownedPlayback)return false;
var data=typeof Lampa.Player.playdata==='function'?Lampa.Player.playdata():null;
return data?data.mytorbox_session===ownedPlayback:typeof Lampa.Player.opened!=='function'||Lampa.Player.opened();
}
function restorePlayerControls(){if(playerOwnsScreen()){dismissSelect();if(typeof Lampa.Player.toggle==='function')Lampa.Player.toggle();}}
function showLibraryDialog(options){
if(playerOwnsScreen()){restorePlayerControls();return;}
options.mytorbox_dialog=true;Lampa.Select.show(options);
}
function bindPlaybackLifecycle(){
if(Lampa.Player.listener&&Lampa.Player.listener.follow){
Lampa.Player.listener.follow('start',function(data){if(data&&data.mytorbox_session){ownedPlayback=data.mytorbox_session;dismissSelect();}});
Lampa.Player.listener.follow('ready',function(data){if(data&&data.mytorbox_session===ownedPlayback)restorePlayerControls();});
}
if(Lampa.Select.listener&&Lampa.Select.listener.follow)Lampa.Select.listener.follow('fullshow',function(event){
latestSelect=event&&event.active;
if(event&&event.active&&event.active.mytorbox_dialog&&playerOwnsScreen()){
var dialog=event.active,session=ownedPlayback;
// fullshow fires before Select installs its controller: reclaim only afterwards.
setTimeout(function(){if(latestSelect===dialog&&ownedPlayback===session)restorePlayerControls();},0);
}
});
}
function toast(s){if(window.Lampa&&Lampa.Noty)Lampa.Noty.show(s);else console.log(s);}
function token(){try{return atob(localStorage.getItem('torbox_api_key_b64')||'');}catch(e){return '';}}
function proxy(){return localStorage.getItem('torbox_proxy_url')||'https://my-torbox-proxy.slonce70.workers.dev';}
function safe(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function proxied(url){var u=new URL(proxy());u.searchParams.set('url',url);return u.toString();}
async function api(route,signal){var key=token();if(!key)throw Error('Сначала введи ключ в Настройки → TorBox');
var ctl=new AbortController(),t=setTimeout(function(){ctl.abort();},25000);
var cancel=function(){ctl.abort();};if(signal){signal.addEventListener('abort',cancel);if(signal.aborted)cancel();}
try{var r=await fetch(proxied('https://api.torbox.app/v1/api/'+route),{headers:{'X-Api-Key':key},signal:ctl.signal});if(!r.ok)throw Error('TorBox HTTP '+r.status);
var j=await r.json();if(j.success===false)throw Error(j.detail||j.error||'Ошибка TorBox');return j.data;}finally{clearTimeout(t);if(signal)signal.removeEventListener('abort',cancel);}}
var returnController='settings';
function openLibrary(controller){returnController=controller;list();}
// Select.close() means Back: it invokes onBack and can reopen the library.
// Selection already hides the dialog; dismiss without navigation callbacks.
function dismissSelect(){if(typeof Lampa.Select.closeAll==='function')Lampa.Select.closeAll();else Lampa.Select.hide();}
function choose(title,items,callback){if(!items.length){toast('Пусто');return;}showLibraryDialog({title:title,items:items,onSelect:function(item){dismissSelect();callback(item);},onBack:function(){Lampa.Controller.toggle(returnController);}});}
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
showLibraryDialog({title:'Мой TorBox · '+arr.length+' · v'+VERSION+(libraryQuery?' / '+libraryData.length:''),items:items,onDraw:function(row,item){drawCard(row,item,view,drawn++<12);},onFocus:function(item,row){var $=window.jQuery||window.$;if($)drawCard($(row),item,view,true);},onSelect:function(item){libraryView++;dismissSelect();if(item.action==='search')searchLibrary();else if(item.action==='clear'){libraryQuery='';showLibrary();}else files(item.torrent);},onBack:function(){libraryView++;Lampa.Controller.toggle(returnController);}});}
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
showLibraryDialog({title:safe(cleanName(torrent.name).title)+' · v'+VERSION,items:entries,onDraw:function(row){var $=window.jQuery||window.$;if($)$(row).addClass('mytorbox-file');},onSelect:function(item){dismissSelect();play(torrent,item.file,arr);},onBack:function(){showLibrary();}});}
function episodeNumbers(f){var raw=String(f.name||f.path||'');
var m=raw.match(/S(\d{1,2})[ ._-]*E(\d{1,3})/i)||raw.match(/\b(\d{1,2})x(\d{1,3})\b/i);
if(m)return {season:Number(m[1]),episode:Number(m[2])};
var e=raw.match(/(?:серия|episode|ep)[ ._-]*(\d{1,3})/i);return e?{episode:Number(e[1])}:null;}
function orderedVideos(arr){return arr.filter(function(f){var name=String(f.name||f.path||'');
return /\.(mkv|mp4|avi|m4v|ts|mov|webm)$/i.test(name)&&!/(?:^|[\/\\ ._-])(?:samples?|trailers?|teasers?|extras?|featurettes?|тизер|трейлер)(?:[\/\\ ._-]|$)/i.test(name);
}).slice().sort(function(a,b){var an=episodeNumbers(a),bn=episodeNumbers(b);
if(an&&bn){var diff=(an.season||0)-(bn.season||0)||an.episode-bn.episode;if(diff)return diff;}
return String(a.name||a.path||'').localeCompare(String(b.name||b.path||''),undefined,{numeric:true});});}
var playbackRequest=null;
async function play(torrent,file,allFiles){
if(playbackRequest)playbackRequest.abort();
var ctl=new AbortController();playbackRequest=ctl;
var session=++playbackSession;
var loadingActive=false;
function stopLoading(){if(loadingActive){loadingActive=false;Lampa.Loading.stop();}}
if(Lampa.Loading){Lampa.Loading.start(function(){ctl.abort();},'Подготавливаю воспроизведение…');loadingActive=true;}
try{
var available=Array.isArray(allFiles)?allFiles:(Array.isArray(torrent.files)?torrent.files:[]);
var ordered=orderedVideos(available),cache=cachedMeta(torrent),meta=cache&&cache.data;
var serial=!!((meta&&meta.media_type==='tv')||ordered.filter(function(f){return !!episodeNumbers(f);}).length>1);
var selected=ordered.findIndex(function(f){return fileKey(f)===fileKey(file);});
var queue=serial&&selected>=0?ordered.slice(selected):[file];
var card=meta||{title:cleanName(torrent.name).title};
if(serial&&!meta)card={name:cleanName(torrent.name).title,original_name:cleanName(torrent.name).title,media_type:'tv'};
async function item(f){var link=await api('torrents/requestdl?torrent_id='+encodeURIComponent(torrent.id)+'&file_id='+encodeURIComponent(f.id)+'&token='+encodeURIComponent(token()),ctl.signal);
if(typeof link!=='string'||!/^https?:\/\//i.test(link))throw Error('Нет ссылки для воспроизведения');
var cfg={url:link,title:String(f.name||f.path||torrent.name||'TorBox').split('/').pop(),card:card,movie:card};
var ep=episodeNumbers(f);if(ep){if(ep.season!=null)cfg.season=ep.season;cfg.episode=ep.episode;}
if(Lampa.Timeline&&Lampa.Utils&&Lampa.Utils.hash)cfg.timeline=Lampa.Timeline.view(Lampa.Utils.hash('mytorbox:'+torrentKey(torrent)+':'+fileKey(f)));
cfg.callback=function(){remember(torrent,f);};return cfg;}
var first=await item(file),resolved=new Array(queue.length);resolved[0]=first;
var cursor=1;
await Promise.all(Array.from({length:Math.min(3,queue.length-1)},async function(){
while(cursor<queue.length&&!ctl.signal.aborted){var index=cursor++;try{resolved[index]=await item(queue[index]);}catch(e){resolved[index]=null;}}
}));
if(ctl.signal.aborted){if(playbackRequest===ctl){stopLoading();filesView(torrent,available);}return;}
var failed=resolved.findIndex(function(v){return !v;});
var playlist=failed<0?resolved:resolved.slice(0,failed);
if(failed>=0)toast('Следующая недоступная серия не будет пропущена. Её можно будет открыть из списка.');
// Pass the complete ordered queue to Android/ViMu in the launch payload.
// ViMu advances locally, even when Android reclaims Lampa in the background.
if(serial)playlist.forEach(function(cfg){cfg.launch_player='android';});
var launch=Object.assign({},playlist[0],{playlist:playlist});
if(playlist.length>1&&Lampa.Storage)Lampa.Storage.set('playlist_next',true);
// Loading.stop restores the old controller even if its layer was already removed.
// Release it once, BEFORE Player.play takes ownership of the remote.
stopLoading();
dismissSelect();
ownedPlayback=launch.mytorbox_session||0;
if(Lampa.Player.play(launch)===false)throw Error('Плеер не запущен');
if(typeof Lampa.Player.playlist==='function')Lampa.Player.playlist(playlist);
remember(torrent,file);
Lampa.Player.callback(function(){if(ownedPlayback===session)ownedPlayback=0;filesView(torrent,available);});
}catch(e){if(ownedPlayback===session)ownedPlayback=0;if(!ctl.signal.aborted)toast('Воспроизведение: '+e.message);if(playbackRequest===ctl){stopLoading();filesView(torrent,allFiles||torrent.files||[file]);}}
finally{if(playbackRequest===ctl){playbackRequest=null;stopLoading();}}
}
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
bindPlaybackLifecycle();
var $=window.jQuery||window.$;if($&&!$('#mytorbox-card-style').length)$('head').append('<style id="mytorbox-card-style">.mytorbox-card{display:block!important;position:relative!important;box-sizing:border-box!important;min-height:7.2em!important;padding:1em 1.2em 1em 6.5em!important;overflow:hidden!important;white-space:normal!important}.mytorbox-card .mytorbox-poster{position:absolute!important;left:1em;top:50%;transform:translateY(-50%);width:4.2em;height:6.1em;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.1);border-radius:.35em;overflow:hidden}.mytorbox-card .mytorbox-poster img{width:100%;height:100%;object-fit:cover}.mytorbox-card .selectbox-item__title,.mytorbox-card .selectbox-item__subtitle{display:block!important;position:relative!important;box-sizing:border-box!important;width:100%!important;max-width:100%!important;min-width:0!important;margin-left:0!important;white-space:normal!important;overflow:hidden!important;overflow-wrap:break-word!important;word-break:normal!important}.mytorbox-card .selectbox-item__title{line-height:1.3!important;display:-webkit-box!important;-webkit-box-orient:vertical;-webkit-line-clamp:2}.mytorbox-card .selectbox-item__subtitle{line-height:1.35!important;font-size:.8em!important;max-height:3.9em;opacity:.8}.mytorbox-card .selectbox-item__subtitle small{display:block!important;font-size:.85em!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;max-width:100%!important;opacity:.65} .mytorbox-file{box-sizing:border-box!important;padding:.65em 1.1em!important;min-height:4.3em!important;overflow:hidden!important}.mytorbox-file .selectbox-item__title,.mytorbox-file .selectbox-item__subtitle{display:block!important;width:100%!important;max-width:100%!important;min-width:0!important;overflow:hidden!important;white-space:normal!important;overflow-wrap:anywhere!important}.mytorbox-file .selectbox-item__title{font-size:1em!important;font-weight:600!important;line-height:1.25!important}.mytorbox-file .selectbox-item__subtitle{font-size:.75em!important;line-height:1.3!important;opacity:.8}.mytorbox-file .selectbox-item__subtitle small{display:block!important;font-size:.85em!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;opacity:.65}</style>');
Lampa.SettingsApi.addComponent({component:'mytorbox_library',name:'Мой TorBox',icon:'<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7h18v13H3zM3 7l4-4h10l4 4M8 12h8"/></svg>'});
Lampa.SettingsApi.addParam({component:'mytorbox_library',param:{name:'mytorbox_open',type:'button'},field:{name:'Открыть библиотеку TorBox',description:'Торренты и файлы, добавленные в TorBox, включая ручные загрузки'},onChange:function(){openLibrary('settings');}});
if(window.appready)addMenu();
else if(Lampa.Listener&&Lampa.Listener.follow)Lampa.Listener.follow('app',function(e){if(e.type==='ready')addMenu();});
else addMenu();
}
boot();
})();









