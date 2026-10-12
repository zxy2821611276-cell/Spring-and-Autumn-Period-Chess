import {findRoom,createRoom,saveRoom} from '../../../db/rooms';
import {initial,move,Side,Game} from '../../../lib/game';
export const dynamic='force-dynamic';
export const runtime='nodejs';
// Allow the public Netlify origin even when the function sees an internal URL.
function isAllowedOrigin(req: Request): boolean {
  const origin = req.headers.get('origin');
  if (!origin) return true;
  const allowed = new Set<string>([new URL(req.url).origin]);
  if (process.env.URL) {
    try { allowed.add(new URL(process.env.URL).origin); } catch { /* fallback */ }
  }
  if (process.env.SITE_NAME) {
    allowed.add(`https://${process.env.SITE_NAME}.netlify.app`);
  }
  return allowed.has(origin);
}
type Player={key:string,name:string};
type Room={players:Player[],phase:string,target:number,hands:(string|null)[],rps:any,winner:number|null,white:number,game:Game|null,history:Game[],request:null|{kind:string,by:number},seen:string[]};
function token(req:Request){return (req.headers.get('cookie')||'').split('; ').find(x=>x.startsWith('cq_player='))?.slice(10)||'';}
async function hash(t:string){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(t)))].map(x=>x.toString(16).padStart(2,'0')).join('');}
function publicRoom(r:Room,id:string,revision:number,key:string){const me=r.players.findIndex(p=>p.key===key);return {id,revision,phase:r.phase,target:r.target,players:r.players.map(p=>({name:p.name})),me,white:r.white,game:r.game,rps:r.rps,rpsWinner:r.winner,submitted:r.hands.map(Boolean),request:r.request,canUndo:r.history.length>0};}
function reply(data:any,status=200,t?:string){return Response.json(data,{status,headers:{'Cache-Control':'no-store',...(t?{'Set-Cookie':`cq_player=${t}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=31536000`}:{})}});}
export async function GET(req:Request){try{const id=new URL(req.url).searchParams.get('id')?.toUpperCase();if(!id||!/^[A-Z0-9]{8}$/.test(id))return reply({error:'请输入8位房间码'},400);const row=await findRoom(id);if(!row)return reply({error:'房间不存在，请核对房间码'},404);return reply(publicRoom(JSON.parse(row.data),id,row.revision,await hash(token(req))));}catch{return reply({error:'连接失败，请稍后重试'},500);}}
export async function POST(req:Request){try{if(!isAllowedOrigin(req))return reply({error:'请求来源无效'},403);const text=await req.text();if(text.length>4096)return reply({error:'请求过大'},413);const a=JSON.parse(text),old=token(req),t=old||crypto.randomUUID()+crypto.randomUUID(),key=await hash(t);const name=String(a.name||'棋友').trim().slice(0,16)||'棋友';if(a.action==='create'){const r:Room={players:[{key,name}],phase:'waiting',target:a.target===8?8:6,hands:[null,null],rps:null,winner:null,white:0,game:null,history:[],request:null,seen:[]};const savedId=await createRoom(JSON.stringify(r));return reply(publicRoom(r,savedId,0,key),200,t);}
const id=String(a.id||'').toUpperCase();if(!/^[A-Z0-9]{8}$/.test(id))return reply({error:'请输入8位房间码'},400);const row=await findRoom(id);if(!row)return reply({error:'房间不存在'},404);const r:Room=JSON.parse(row.data);let me=r.players.findIndex(p=>p.key===key);if(a.action==='join'){if(me<0){if(r.players.length>=2)return reply({error:'房间已满，可选择观战'},409);r.players.push({key,name});me=1;r.phase='rps';}}else{if(me<0)return reply({error:'观战者不能操作棋局'},403);if(r.seen.includes(a.requestId))return reply(publicRoom(r,id,row.revision,key));if(a.revision!==row.revision)return reply({error:'棋局已更新，请按最新局面操作'},409);
switch(a.action){case 'rps':if(r.phase!=='rps'||r.hands[me]||!['rock','paper','scissors'].includes(a.hand))throw Error('当前不能提交猜拳');r.hands[me]=a.hand;if(r.hands.every(Boolean)){const [x,y]=r.hands;r.rps={hands:[...r.hands],tie:x===y};if(x===y)r.hands=[null,null];else{r.winner=({rock:'scissors',scissors:'paper',paper:'rock'} as any)[x!]===y?0:1;r.phase='choose';}}break;
case 'choose':if(r.phase!=='choose'||r.winner!==me||!['w','b'].includes(a.side))throw Error('等待猜拳胜者选择');r.white=a.side==='w'?me:1-me;r.game=initial(r.target);r.phase='playing';break;
case 'move':{if(r.phase!=='playing'||!r.game||r.game.winner)throw Error('当前不能行动');if((me===r.white?'w':'b')!==r.game.turn)throw Error('还没有轮到你');const next=move(r.game,a.move);r.history.push(r.game);r.game=next;r.request=null;break;}
case 'resign':if(!r.game||r.game.winner)throw Error('当前不能认输');r.history.push(structuredClone(r.game));r.game.winner=me===r.white?'b':'w';r.game.reason='对方认输';r.request=null;break;
case 'request':if(!r.game||r.request||!['undo','draw','rematch'].includes(a.kind))throw Error('当前不能发起请求');if(a.kind==='undo'&&!r.history.length)throw Error('暂无可撤销行动');if(a.kind==='draw'&&r.game.winner)throw Error('对局已经结束');if(a.kind==='rematch'&&!r.game.winner)throw Error('请先完成当前对局');r.request={kind:a.kind,by:me};break;
case 'respond':if(!r.request||r.request.by===me)throw Error('没有待处理请求');if(a.accept){if(r.request.kind==='undo'){r.game=r.history.pop()!;}else if(r.request.kind==='draw'){r.history.push(structuredClone(r.game!));r.game!.winner='draw';r.game!.reason='双方同意和棋';}else{r.phase='rps';r.game=null;r.history=[];r.hands=[null,null];r.rps=null;r.winner=null;}}r.request=null;break;
default:throw Error('未知操作');}r.seen.push(String(a.requestId));r.seen=r.seen.slice(-100);}
const saved=await saveRoom(id,row.revision,JSON.stringify(r));if(!saved)return reply({error:'房间刚刚更新，请重试'},409);return reply(publicRoom(r,id,row.revision+1,key),200,t);
}catch(e){return reply({error:e instanceof Error?e.message:'请求失败'},400);}}
