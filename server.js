const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const ROOT = __dirname;
const DB_PATH = path.join(ROOT, 'data.json');
const PORT = Number(process.env.PORT || 3000);
let db = { accounts: [], drivers: [], bookings: [] };
try { if (fs.existsSync(DB_PATH)) db = { ...db, ...JSON.parse(fs.readFileSync(DB_PATH, 'utf8')) }; } catch (e) { console.error('Could not read data.json:', e.message); }
function save() { fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2)); }
function send(res, status, data, headers={}) { res.writeHead(status, { 'Content-Type':'application/json; charset=utf-8', 'Access-Control-Allow-Origin':'*', 'Access-Control-Allow-Headers':'Content-Type', 'Access-Control-Allow-Methods':'GET,POST,DELETE,OPTIONS', ...headers }); res.end(JSON.stringify(data)); }
function readBody(req) { return new Promise((resolve,reject)=>{let s='';req.on('data',c=>{s+=c;if(s.length>1e6)reject(new Error('Request too large'));});req.on('end',()=>{try{resolve(s?JSON.parse(s):{});}catch{reject(new Error('Invalid JSON'));}});}); }
function normalizeDriver(d) { const from=d.from||{}; const to=d.to||{}; return { id:String(d.id||crypto.randomUUID()), ownerEmail:String(d.ownerEmail||d.email||''), name:String(d.name||''), phone:String(d.phone||''), email:String(d.email||d.ownerEmail||''), car:String(d.car||''), plate:String(d.plate||''), from:{...from,region:String(from.region||d.fromRegion||''),text:String(from.text||d.fromRegion||'')}, to:{...to,region:String(to.region||d.toRegion||''),text:String(to.text||d.toRegion||'')}, date:d.date||'', seats:Math.max(1,Number(d.seats||d.available||1)), available:Math.max(0,Number(d.available??d.seats??1)), price:Math.max(0,Number(d.price||d.earnPerPassenger||0)), status:d.status||'active', updatedAt:new Date().toISOString() }; }
const server=http.createServer(async(req,res)=>{
 if(req.method==='OPTIONS'){res.writeHead(204,{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Methods':'GET,POST,DELETE,OPTIONS'});return res.end();}
 const url=new URL(req.url,`http://${req.headers.host||'localhost'}`); const p=url.pathname;
 try {
  if(p.startsWith('/api/')){
   if(p==='/api/health'&&req.method==='GET')return send(res,200,{ok:true,service:'Viloyatga Boramiz API'});
   if(p==='/api/accounts'&&req.method==='POST'){
    const a=await readBody(req); if(!a.name||!a.email||!a.role)return send(res,400,{error:'Ism, email va rol talab qilinadi'});
    const account={name:String(a.name),phone:String(a.phone||''),email:String(a.email).toLowerCase(),role:String(a.role),car:String(a.car||''),plate:String(a.plate||''),licenseFileName:String(a.licenseFileName||''),experienceYears:Math.max(0,Number(a.experienceYears||0)),ownCar:typeof a.ownCar==='boolean'?a.ownCar:null,updatedAt:new Date().toISOString()};
    const i=db.accounts.findIndex(x=>x.email===account.email&&x.role===account.role);if(i>=0)db.accounts[i]=account;else db.accounts.push(account);save();return send(res,200,{account});
   }
   if(p==='/api/drivers'&&req.method==='GET'){
    const from=url.searchParams.get('from'),to=url.searchParams.get('to'),ownerEmail=(url.searchParams.get('ownerEmail')||'').toLowerCase();
    const drivers=db.drivers.filter(d=>(ownerEmail?String(d.ownerEmail||d.email||'').toLowerCase()===ownerEmail:(d.status==='active'&&d.available>0&&(!from||d.from.region===from)&&(!to||d.to.region===to))));return send(res,200,{drivers});
   }
   if(p==='/api/drivers'&&req.method==='POST'){
    const raw=await readBody(req); const d=normalizeDriver(raw);if(!d.ownerEmail||!d.from.region||!d.to.region)return send(res,400,{error:'Haydovchi emaili, jo‘nash va borish viloyati kerak'});
    const i=db.drivers.findIndex(x=>x.id===d.id||x.ownerEmail===d.ownerEmail&&x.id===d.id);if(i>=0)db.drivers[i]={...db.drivers[i],...d};else db.drivers.push(d);save();return send(res,201,{driver:d});
   }
   if(p==='/api/bookings'&&req.method==='POST'){
    const b=await readBody(req);const d=db.drivers.find(x=>x.id===String(b.driverId)&&x.status==='active');if(!d)return send(res,404,{error:'Haydovchi e’loni topilmadi'});
    const count=Math.max(1,Math.min(4,Number(b.count||1)));if(d.available<count)return send(res,409,{error:'Haydovchida yetarli bo‘sh joy yo‘q'});
    const booking={id:crypto.randomUUID(),driverId:d.id,driverName:d.name,driverEmail:d.ownerEmail,passengerName:String(b.passenger?.name||''),passengerPhone:String(b.passenger?.phone||''),passengerEmail:String(b.passenger?.email||'').toLowerCase(),from:b.from||{},to:b.to||{},count,payment:b.payment==='card'?'card':'cash',travelDate:String(b.travelDate||''),status:'requested',createdAt:new Date().toISOString()};
    d.available-=count;db.bookings.unshift(booking);save();return send(res,201,{booking});
   }
   if(p==='/api/bookings'&&req.method==='GET'){
    const email=(url.searchParams.get('email')||'').toLowerCase();const driverEmail=(url.searchParams.get('driverEmail')||'').toLowerCase();
    const bookings=db.bookings.filter(b=>(email&&b.passengerEmail===email)||(driverEmail&&b.driverEmail===driverEmail));return send(res,200,{bookings});
   }
   const match=p.match(/^\/api\/bookings\/([^/]+)$/);
   if(match&&req.method==='DELETE'){
    const b=await readBody(req);const i=db.bookings.findIndex(x=>x.id===decodeURIComponent(match[1]));if(i<0)return send(res,404,{error:'Bron topilmadi'});const booking=db.bookings[i];if(String(b.email||'').toLowerCase()!==booking.passengerEmail)return send(res,403,{error:'Faqat bron qilgan yo‘lovchi bekor qilishi mumkin'});if(booking.status==='requested'){const d=db.drivers.find(x=>x.id===booking.driverId);if(d)d.available=Math.min(d.seats,d.available+booking.count);booking.status='cancelled';booking.cancelledAt=new Date().toISOString();save();}return send(res,200,{booking});
   }
   return send(res,404,{error:'API endpoint topilmadi'});
  }
  if(p==='/'||p==='/index.html'||p==='/Car%20driving%20on%20road.svg'||p==='/Car driving on road.svg'){
   const file=p==='/'||p==='/index.html'?path.join(ROOT,'index.html'):path.join(ROOT,'assets','Car driving on road.svg');const type=file.endsWith('.svg')?'image/svg+xml; charset=utf-8':'text/html; charset=utf-8';res.writeHead(200,{'Content-Type':type});return fs.createReadStream(file).pipe(res);
  }
  if(p.startsWith('/assets/')){const file=path.join(ROOT,p.slice(1));if(!file.startsWith(path.join(ROOT,'assets')))return send(res,403,{error:'Forbidden'});if(!fs.existsSync(file))return send(res,404,{error:'Not found'});res.writeHead(200,{'Content-Type':file.endsWith('.svg')?'image/svg+xml':'application/octet-stream'});return fs.createReadStream(file).pipe(res);}
  res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});res.end('Not found');
 } catch(e){console.error(e);send(res,500,{error:e.message||'Server xatosi'});}
});
server.listen(PORT,()=>console.log(`Viloyatga Boramiz server: http://localhost:${PORT}`));
