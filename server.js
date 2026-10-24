const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = __dirname;
const port = Number(process.env.PORT || 4173);
const mime = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.json':'application/json; charset=utf-8'};

async function researchParts(req, res) {
  if (!process.env.EXA_API_KEY) return sendJson(res, 503, {error:'Exa is not configured.'});
  try {
    const body = await readBody(req);
    const query = [
      'current PC parts and retailer listings',
      body.use_case ? `for ${body.use_case}` : '',
      body.existing_parts ? `reuse existing parts: ${body.existing_parts}` : '',
      body.modifications || ''
    ].filter(Boolean).join(' ');
    const response = await fetch('https://api.exa.ai/search', {
      method:'POST',
      headers:{'x-api-key':process.env.EXA_API_KEY,'Content-Type':'application/json'},
      body:JSON.stringify({query, type:'auto', numResults:10, contents:{highlights:{maxCharacters:300}}})
    });
    const data = await response.json();
    if (!response.ok) return sendJson(res, response.status, {error:data?.message || 'Exa research failed.'});
    return sendJson(res, 200, {results:(data.results || []).map(result=>({title:result.title || result.url, url:result.url, highlights:result.highlights || []}))});
  } catch (error) { return sendJson(res, 500, {error:'Unable to research parts right now.'}); }
}

async function checkCompatibility(req, res) {
  if (!process.env.GROQ_API_KEY) return sendJson(res, 503, {error:'Compatibility agent is not configured.'});
  try {
    const body = await readBody(req);
    const prompt = `You are a PC hardware compatibility reviewer. Review this proposed build and existing parts. Do not invent specifications. If a fact is unknown, mark it unverified. Return JSON only in this shape: {"status":"pass|issues|incomplete","summary":"short summary","checks":[{"name":"check name","status":"pass|issue|unverified","detail":"brief detail"}]}. Check CPU socket/chipset, memory type, motherboard/case form factor, GPU clearance, cooler fit, PSU wattage/connectors, storage interface, and whether existing parts can be reused.\n\nUse case: ${body.use_case || 'not provided'}\nBudget: $${body.budget || 'not provided'}\nRequested changes: ${body.modifications || 'none'}\nExisting parts: ${body.existing_parts || 'none'}\nProposed parts:\n${JSON.stringify(body.parts || [], null, 2)}`;
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method:'POST',
      headers:{'Authorization':`Bearer ${process.env.GROQ_API_KEY}`,'Content-Type':'application/json'},
      body:JSON.stringify({model:process.env.MODEL_NAME || 'openai/gpt-oss-120b',temperature:0.1,max_tokens:1200,messages:[{role:'system',content:'Return valid JSON only.'},{role:'user',content:prompt}]})
    });
    const data = await response.json();
    if (!response.ok) return sendJson(res, response.status, {error:data?.error?.message || 'Compatibility review failed.'});
    const content = data.choices?.[0]?.message?.content || '';
    const parsed = JSON.parse(content.replace(/^```json\s*|\s*```$/g,''));
    return sendJson(res, 200, parsed);
  } catch (error) { return sendJson(res, 500, {error:'Compatibility review could not be completed.'}); }
}

async function createWhopCheckout(req, res) {
  if (!process.env.WHOP_API_KEY || !process.env.WHOP_PLAN_ID) {
    return sendJson(res, 503, {error:'Whop is not configured yet. Add WHOP_API_KEY and WHOP_PLAN_ID in Render environment variables.'});
  }
  try {
    const body = await readBody(req);
    const base = process.env.WHOP_API_BASE_URL || 'https://api.whop.com/api/v1';
    const response = await fetch(`${base}/checkout_configurations`, {
      method:'POST',
      headers:{'Authorization':`Bearer ${process.env.WHOP_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':crypto.randomUUID()},
      body: JSON.stringify({
        plan_id: process.env.WHOP_PLAN_ID,
        redirect_url: process.env.WHOP_REDIRECT_URL || `${getOrigin(req)}/?checkout=complete`,
        metadata: {source:'speccheck', product:'pc-build-plan'}
      })
    });
    const data = await response.json();
    if (!response.ok) return sendJson(res, response.status, {error:data?.message || data?.error || 'Whop checkout could not be created.'});
    const url = data.purchase_url || data.checkout_url || data.url;
    if (!url) return sendJson(res, 502, {error:'Whop responded without a checkout URL.'});
    return sendJson(res, 200, {url});
  } catch (error) { return sendJson(res, 500, {error:'Unable to connect to Whop right now.'}); }
}
function getOrigin(req) { return `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host}`; }
function readBody(req) { return new Promise((resolve,reject)=>{let data='';req.on('data',chunk=>data+=chunk);req.on('end',()=>resolve(data ? JSON.parse(data) : {}));req.on('error',reject)}); }
function sendJson(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));}

http.createServer((req,res)=>{
  if (req.method === 'POST' && req.url === '/api/research') return researchParts(req,res);
  if (req.method === 'POST' && req.url === '/api/compatibility') return checkCompatibility(req,res);
  if (req.method === 'POST' && req.url === '/api/whop/checkout') return createWhopCheckout(req,res);
  const requested = decodeURIComponent(req.url.split('?')[0]);
  const file = path.join(root, requested === '/' ? 'index.html' : requested);
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return sendJson(res,404,{error:'Not found'});
  res.writeHead(200,{'Content-Type':mime[path.extname(file)] || 'application/octet-stream'});fs.createReadStream(file).pipe(res);
}).listen(port,()=>console.log(`SpecCheck running on port ${port}`));
