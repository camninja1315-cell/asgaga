'use client';

import { useEffect, useState } from 'react';

export default function SettingsClient() {
  const [text, setText] = useState('');
  const [status, setStatus] = useState<string>('');

  async function load() {
    setStatus('Loading...');
    const r = await fetch('/api/settings', { cache: 'no-store' });
    const j = await r.json();
    setText(JSON.stringify(j, null, 2));
    setStatus('');
  }

  async function save() {
    setStatus('Saving...');
    let obj: unknown;
    try {
      obj = JSON.parse(text);
    } catch (e: any) {
      setStatus('Invalid JSON: ' + String(e?.message ?? e));
      return;
    }
    const r = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(obj),
    });
    const j = await r.json();
    if (!r.ok) {
      setStatus('Save failed: ' + (j?.error ?? r.status));
      return;
    }
    setText(JSON.stringify(j, null, 2));
    setStatus('Saved.');
    setTimeout(() => setStatus(''), 1500);
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>Settings</div>
          <div className="muted small">
            Fully settings-driven. Stored in Postgres if <code>POSTGRES_URL</code> is set; otherwise stored in-memory (non-persistent on Vercel).
          </div>
        </div>
        <div className="row">
          <button className="button" onClick={load}>Reload</button>
          <button className="button" onClick={save}>Save</button>
        </div>
      </div>
      <div style={{ marginTop: 12 }}>
        <textarea className="textarea" rows={26} value={text} onChange={(e) => setText(e.target.value)} />
      </div>
      {status ? <div className="muted small" style={{ marginTop: 10 }}>{status}</div> : null}
    </div>
  );
}
