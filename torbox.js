/* My TorBox library for Lampa. v0.6 */
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
function list(){toast('Загружаю библиотеку TorBox…');api('torrents/mylist?limit=1000&bypass_cache=true').then(function(data){
var arr=Array.isArray(data)?data:(!data?[]:[data]),r=recent();sortLibrary(arr,r);
choose('Мой TorBox · '+arr.length,arr.map(function(t){return {title:safe(t.name||'Без названия'),subtitle:(lastPlayed(t,r)?'Недавно смотрели · ':'')+safe(t.download_state||t.status||'')+textSize(t.size),torrent:t};}),function(item){files(item.torrent);});
}).catch(function(e){toast('Библиотека: '+e.message);});}
function files(torrent){var files=Array.isArray(torrent.files)?torrent.files:[];if(!files.length){toast('В этом торренте нет файлов. Обновляю…');api('torrents/mylist?id='+encodeURIComponent(torrent.id)+'&bypass_cache=true').then(function(r){filesView(torrent,Array.isArray(r)?(r[0]&&r[0].files||[]):(r&&r.files||[]));}).catch(function(e){toast(e.message);});}else filesView(torrent,files);}
function filesView(torrent,arr){var vids=arr.filter(function(f){return /\.(mkv|mp4|avi|m4v|ts|mov|webm)$/i.test(f.name||f.path||'');});if(!vids.length){toast('Видео в этой загрузке не найдено');return;}
var last=lastPlayed(torrent,recent());
if(last)vids.sort(function(a,b){return Number(fileKey(b)===last.file)-Number(fileKey(a)===last.file);});
choose(safe(torrent.name||'Файлы'),vids.map(function(f){return {title:safe(f.name||f.path||'Видео'),subtitle:((last&&fileKey(f)===last.file)?'Последний запуск · ':'')+textSize(f.size).trim(),file:f};}),function(item){play(torrent,item.file);});}
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
Lampa.SettingsApi.addComponent({component:'mytorbox_library',name:'Мой TorBox',icon:'<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7h18v13H3zM3 7l4-4h10l4 4M8 12h8"/></svg>'});
Lampa.SettingsApi.addParam({component:'mytorbox_library',param:{name:'mytorbox_open',type:'button'},field:{name:'Открыть библиотеку TorBox',description:'Торренты и файлы, добавленные в TorBox, включая ручные загрузки'},onChange:function(){openLibrary('settings');}});
if(window.appready)addMenu();
else if(Lampa.Listener&&Lampa.Listener.follow)Lampa.Listener.follow('app',function(e){if(e.type==='ready')addMenu();});
else addMenu();
}
boot();
})();








