import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
const root=resolve('dist');
createServer(async(req,res)=>{try {
 const name=new URL(req.url,'http://localhost').pathname;
 const path=resolve(root,'.'+(name==='/'?'/index.html':name));
 if(!path.startsWith(root+sep)) throw Error();
 res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.png':'image/png','.mp4':'video/mp4','.jpg':'image/jpeg','.webmanifest':'application/manifest+json'})[extname(path)]||'application/octet-stream');
 res.setHeader('Cache-Control','no-cache');res.end(await readFile(path));
}catch {res.writeHead(404).end();}}).listen(4173,'127.0.0.1',()=>console.log('Mob is live at http://127.0.0.1:4173'));
