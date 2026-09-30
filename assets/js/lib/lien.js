// Données du bail <-> fragment d'URL (#...). Le fragment n'est jamais envoyé au serveur.
// Format : "z" + base64url(deflate-raw(JSON)) ; repli "j" + base64url(JSON) si la compression n'est pas disponible.

function versBase64url(octets) {
  let s = '';
  for (let i = 0; i < octets.length; i += 0x8000) s += String.fromCharCode(...octets.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function depuisBase64url(t) {
  const b = atob(t.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((t.length + 3) % 4));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
}

async function transformer(octets, flux) {
  const s = new Blob([octets]).stream().pipeThrough(flux);
  return new Uint8Array(await new Response(s).arrayBuffer());
}

/** Retire les champs vides pour raccourcir le lien */
function compacter(o) {
  if (Array.isArray(o)) return o.map(compacter);
  if (o && typeof o === 'object') {
    const r = {};
    for (const [k, v] of Object.entries(o)) {
      const c = compacter(v);
      if (c === '' || c === null || c === undefined || c === false) continue;
      if (typeof c === 'object' && !Array.isArray(c) && !Object.keys(c).length) continue;
      r[k] = c;
    }
    return r;
  }
  return o;
}

export async function encoder(bail) {
  const json = new TextEncoder().encode(JSON.stringify(compacter(bail)));
  if (typeof CompressionStream !== 'undefined') {
    try {
      return 'z' + versBase64url(await transformer(json, new CompressionStream('deflate-raw')));
    } catch { /* repli ci-dessous */ }
  }
  return 'j' + versBase64url(json);
}

export async function decoder(fragment) {
  const t = String(fragment || '').replace(/^#/, '').trim();
  if (t.length < 2) return null;
  try {
    let octets = depuisBase64url(t.slice(1));
    if (t[0] === 'z') octets = await transformer(octets, new DecompressionStream('deflate-raw'));
    else if (t[0] !== 'j') return null;
    const o = JSON.parse(new TextDecoder().decode(octets));
    return o && typeof o === 'object' ? o : null;
  } catch {
    return null;
  }
}
