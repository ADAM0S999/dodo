'use strict';

/**
 * ADAM Bot — lib/textmaker.js
 * Scrapes ephoto360 and similar photo effect generators using native fetch and FormData.
 */

async function textMaker(effectUrl, text) {
  try {
    const textArr = Array.isArray(text) ? text : [text];

    // 1. Fetch effect page
    const pageRes = await fetch(effectUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    if (!pageRes.ok) {
      throw new Error(`Failed to load effect page: HTTP ${pageRes.status}`);
    }

    const html = await pageRes.text();
    const token = (html.match(/name="token" value="([^"]+)"/) || [])[1];
    const build_server = (html.match(/name="build_server" value="([^"]+)"/) || [])[1];
    const build_server_id = (html.match(/name="build_server_id" value="([^"]+)"/) || [])[1];
    const cookie = pageRes.headers.get('set-cookie') || '';

    if (!token || !build_server) {
      throw new Error('Could not find generation token or build server.');
    }

    // 2. Submit initial form to extract form_value_input
    const formData = new FormData();
    for (const t of textArr) {
      formData.append('text[]', t);
    }
    formData.append('token', token);
    formData.append('build_server', build_server);
    formData.append('build_server_id', build_server_id);

    const postRes = await fetch(effectUrl, {
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Cookie': cookie,
      },
      body: formData,
    });

    const postHtml = await postRes.text();
    const formValueRaw =
      (postHtml.match(/id="form_value_input" value="([^"]+)"/) || [])[1] ||
      (postHtml.match(/name="form_value_input" value="([^"]+)"/) || [])[1];

    if (!formValueRaw) {
      throw new Error('Failed to retrieve form value input.');
    }

    const parsed = JSON.parse(formValueRaw.replace(/&quot;/g, '"'));

    // 3. Request image generation
    const buildFormData = new FormData();
    for (const [k, v] of Object.entries(parsed)) {
      if (Array.isArray(v)) {
        for (const item of v) buildFormData.append(`${k}[]`, item);
      } else {
        buildFormData.append(k, v);
      }
    }

    const createRes = await fetch('https://en.ephoto360.com/effect/create-image', {
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Cookie': cookie,
      },
      body: buildFormData,
    });

    const createJson = await createRes.json();
    if (!createJson.success || !createJson.image) {
      throw new Error(createJson.message || 'Image generation failed');
    }

    const finalUrl = `${build_server}${createJson.image}`;
    return { status: true, url: finalUrl };
  } catch (err) {
    return { status: false, error: err.message };
  }
}

module.exports = { textMaker };
