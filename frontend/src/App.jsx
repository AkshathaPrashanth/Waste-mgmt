import { useCallback, useEffect, useMemo, useState } from 'react';

const API = '/api';
const demoReports = [
  { id: '1', description: 'Large pile of garbage near the market area.', location: { lat: 28.7041, lng: 77.1025 }, status: 'Pending', riskLevel: 'High', priorityScore: 85, alertTrigger: 'Immediate Action Required', timestamp: new Date().toISOString(), votes: 3, imageUrl: 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=100&q=80' },
  { id: '2', description: 'Construction debris blocking footpath.', location: { lat: 28.705, lng: 77.103 }, status: 'In Progress', riskLevel: 'High', priorityScore: 82, alertTrigger: 'Immediate Action Required', timestamp: new Date(Date.now() - 86400000).toISOString(), votes: 1, imageUrl: 'https://images.unsplash.com/photo-1530587191325-3db32d826c18?w=100&q=80' },
  { id: '3', description: 'Plastic waste scattered in park.', location: { lat: 28.5355, lng: 77.391 }, status: 'Pending', riskLevel: 'Medium', priorityScore: 55, alertTrigger: 'Schedule Cleanup', timestamp: new Date(Date.now() - 172800000).toISOString(), votes: 2, imageUrl: 'https://images.unsplash.com/photo-1595278069441-2cf29f8005a4?w=100&q=80' },
  { id: '4', description: 'Minor litter near street lamp.', location: { lat: 28.536, lng: 77.392 }, status: 'Resolved', riskLevel: 'Low', priorityScore: 25, alertTrigger: 'Routine Cleanup', timestamp: new Date(Date.now() - 259200000).toISOString(), votes: 1 },
  { id: '5', description: 'Overflowing dumpsters.', location: { lat: 28.6139, lng: 77.209 }, status: 'Pending', riskLevel: 'High', priorityScore: 88, alertTrigger: 'Immediate Action Required', timestamp: new Date(Date.now() - 345600000).toISOString(), votes: 5 }
];
const statuses = ['Pending', 'In Progress', 'Resolved'];

async function request(path, options = {}) {
  const response = await fetch(`${API}${path}`, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'The request could not be completed.');
  return data;
}

function App() {
  const [route, setRoute] = useState(window.location.pathname);
  const [reports, setReports] = useState(demoReports);
  const [admin, setAdmin] = useState(() => localStorage.getItem('ecotrack-token') || '');
  const [dashboard, setDashboard] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([{ sender: 'bot', text: "Hi, I'm Binny! 👋 Do you need any help?" }]);
  const [chatInput, setChatInput] = useState('');
  const [filter, setFilter] = useState('All');
  const [period, setPeriod] = useState('All');
  const [loginError, setLoginError] = useState('');
  const [form, setForm] = useState({ description: '', lat: '28.6139', lng: '77.2090', image: null });
  const [submitting, setSubmitting] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [list, stats] = await Promise.all([request('/complaints'), request('/admin/dashboard')]);
      setReports(Array.isArray(list) ? list : []);
      setDashboard(stats);
      setError('');
    } catch (err) {
      setError(`${err.message} Showing sample reports while the backend is unavailable.`);
    }
  }, []);

  useEffect(() => {
    const onPopState = () => setRoute(window.location.pathname);
    window.addEventListener('popstate', onPopState);
    const timer = window.setInterval(refresh, 30000);
    return () => {
      window.removeEventListener('popstate', onPopState);
      window.clearInterval(timer);
    };
  }, [refresh]);

  useEffect(() => {
    refresh();
  }, [route, refresh]);

  function navigate(path) {
    window.history.pushState({}, '', path);
    setRoute(path);
  }

  const sortedReports = useMemo(() => {
    let result = reports;
    if (filter !== 'All') result = result.filter((item) => item.status === filter);
    if (period !== 'All') {
      const days = period === 'Today' ? 1 : period === 'Week' ? 7 : 30;
      result = result.filter((item) => Date.now() - new Date(item.timestamp).getTime() <= days * 86400000);
    }
    return result;
  }, [reports, filter, period]);
  const stats = dashboard?.stats || {
    total: reports.length,
    pending: reports.filter((item) => item.status === 'Pending').length,
    in_progress: reports.filter((item) => item.status === 'In Progress').length,
    resolved: reports.filter((item) => item.status === 'Resolved').length
  };
  const highRisk = reports.filter((item) => item.riskLevel === 'High' && item.status !== 'Resolved');

  async function submitReport(event) {
    event.preventDefault();
    setSubmitting(true);
    setNotice('');
    try {
      const duplicate = await request('/complaints/check-nearby', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: Number(form.lat), lng: Number(form.lng) })
      });
      if (duplicate.hasDuplicate) {
        setNotice('A report is already nearby. Please vote to confirm it instead.');
        return;
      }
      const body = new FormData();
      body.append('lat', form.lat);
      body.append('lng', form.lng);
      body.append('description', form.description);
      if (form.image) body.append('image', form.image);
      await request('/complaints', { method: 'POST', body });
      setNotice('Report submitted. Thanks for helping keep your city clean!');
      setForm({ description: '', lat: form.lat, lng: form.lng, image: null });
      event.target.reset();
      await refresh();
    } catch (err) {
      setNotice(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function vote(id) {
    try {
      await request(`/complaints/${encodeURIComponent(id)}/vote`, { method: 'POST' });
      await refresh();
    } catch (err) { setNotice(err.message); }
  }

  async function login(event) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setLoginError('');
    try {
      const result = await request('/admin/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formData.get('email'), password: formData.get('password') })
      });
      localStorage.setItem('ecotrack-token', result.token);
      setAdmin(result.token);
      navigate('/admin');
    } catch (err) { setLoginError(err.message); }
  }

  async function changeStatus(id, status) {
    try {
      await request(`/admin/complaints/${encodeURIComponent(id)}/status`, {
        method: 'PATCH', headers: { Authorization: `Bearer ${admin}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      await refresh();
    } catch (err) { setNotice(err.message); }
  }

  async function sendAlert() {
    try {
      await request('/admin/send-alert', {
        method: 'POST', headers: { Authorization: `Bearer ${admin}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ clusterId: 'high-risk', location: { lat: 28.6139, lng: 77.209 }, complaints_count: highRisk.length })
      });
      setNotice('Cleanup alert sent to the municipality.');
    } catch (err) { setNotice(err.message); }
  }

  function locateMe() {
    navigator.geolocation?.getCurrentPosition(
      ({ coords }) => setForm((current) => ({ ...current, lat: coords.latitude.toFixed(6), lng: coords.longitude.toFixed(6) })),
      () => setNotice('Could not access location. Check your browser permissions.')
    );
  }

  async function sendChat(event) {
    event.preventDefault();
    const text = chatInput.trim();
    if (!text) return;
    const outgoing = [...chatMessages, { sender: 'user', text }];
    setChatMessages(outgoing);
    setChatInput('');
    try {
      const result = await request('/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: outgoing })
      });
      setChatMessages([...outgoing, { sender: 'bot', text: result.reply }]);
    } catch { setChatMessages([...outgoing, { sender: 'bot', text: 'I could not connect right now. Please try again shortly.' }]); }
  }

  const isAdminPage = route.startsWith('/admin');
  const isMapPage = route.startsWith('/map');
  return (
    <div className="app">
      <Sidebar route={route} navigate={navigate} />
      <main className="main-content">
        {isAdminPage
          ? (admin
            ? <AdminPage reports={reports} stats={stats} onStatus={changeStatus} onAlert={sendAlert} notice={notice} />
            : <AdminLogin onSubmit={login} error={loginError} />)
          : isMapPage
            ? <MapPage reports={reports} period={period} setPeriod={setPeriod} />
            : <Overview reports={reports} stats={stats} highRisk={highRisk} filter={filter} setFilter={setFilter} onVote={vote} onNavigate={navigate} onSubmit={submitReport} form={form} setForm={setForm} locateMe={locateMe} submitting={submitting} notice={notice} error={error} onRefresh={refresh} />}
      </main>
      <ChatWidget open={chatOpen} setOpen={setChatOpen} messages={chatMessages} input={chatInput} setInput={setChatInput} onSubmit={sendChat} />
      {notice && !isAdminPage && <div className="toast" role="status">{notice}<button onClick={() => setNotice('')}>×</button></div>}
    </div>
  );
}

function Sidebar({ route, navigate }) {
  const links = [{ path: '/', icon: '▦', text: 'Overview' }, { path: '/map', icon: '◫', text: 'Live Heatmap' }, { path: '/admin', icon: '⌁', text: 'DSS Admin Panel' }];
  return <aside className="sidebar">
    <button className="logo" onClick={() => navigate('/')}><span className="logo-symbol">♻</span><strong>Track</strong><small>SMART CITY WASTE MGMT</small><i>AI POWERED</i></button>
    <nav>{links.map((link) => <button key={link.path} className={`side-link ${route === link.path || (link.path === '/' && route === '/') ? 'active' : ''}`} onClick={() => navigate(link.path)}><span>{link.icon}</span>{link.text}</button>)}</nav>
    <div className="side-divider" />
    <div className="sidebar-help"><div className="help-mark">♻</div><b>Cleaner streets<br />start with us.</b><small>Report a waste hotspot and help your city respond.</small><button onClick={() => navigate('/')}>Make a report <span>↗</span></button></div>
    <div className="sidebar-footer">© EcoTrack · Community powered</div>
  </aside>;
}

function Overview({ reports, stats, highRisk, filter, setFilter, onVote, onNavigate, onSubmit, form, setForm, locateMe, submitting, notice, error, onRefresh }) {
  return <div className="page overview-page">
    {highRisk.length > 0 && <div className="alert-banner"><span className="alert-icon">♧</span><div><strong>Immediate Action Required</strong><small>{highRisk.length} High-Risk hotspot{highRisk.length !== 1 ? 's' : ''} detected needs urgent cleanup.</small></div><button onClick={() => onNavigate('/admin')}>View hotspots <span>→</span></button></div>}
    <div className="stats-row"><StatCard title="Total Complaints logged" value={stats.total} tone="neutral" /><StatCard title="High Risk Hotspots" value={highRisk.length} tone="red" /><StatCard title="Resolved Spots" value={stats.resolved} tone="green" /></div>
    <section className="dark-panel">
      <div className="panel-title"><h2>Recent Reports</h2><div className="panel-actions"><select value={filter} onChange={(event) => setFilter(event.target.value)} aria-label="Filter reports">{['All', ...statuses].map((item) => <option key={item}>{item}</option>)}</select><button className="refresh" onClick={onRefresh} aria-label="Refresh reports">↻</button></div></div>
      {error && <p className="inline-notice">{error}</p>}
      {reports.filter((item) => filter === 'All' || item.status === filter).map((report) => <ReportRow key={report.id} report={report} onVote={onVote} />)}
      {reports.length === 0 && <div className="empty">No reports yet. Submit the first one for your neighborhood.</div>}
    </section>
    <section className="report-form dark-panel" id="report-form">
      <div className="panel-title"><div><h2>Report a Waste Hotspot</h2><p>Share what you found so your community can take action.</p></div></div>
      <form onSubmit={onSubmit}>
        <label>Description<textarea value={form.description} required minLength="5" maxLength="500" placeholder="Describe the waste hotspot…" onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
        <div className="form-grid"><label>Latitude<input required type="number" step="any" value={form.lat} onChange={(event) => setForm({ ...form, lat: event.target.value })} /></label><label>Longitude<input required type="number" step="any" value={form.lng} onChange={(event) => setForm({ ...form, lng: event.target.value })} /></label><button type="button" className="outline-button" onClick={locateMe}>◎ Use my location</button></div>
        <label className="file-control">Photo (optional)<input type="file" accept="image/*" onChange={(event) => setForm({ ...form, image: event.target.files?.[0] || null })} /></label>
        <button className="green-button" disabled={submitting}>{submitting ? 'Submitting…' : 'Submit report'} <span>→</span></button>
        {notice && <small className="form-message">{notice}</small>}
      </form>
    </section>
  </div>;
}

function StatCard({ title, value, tone }) {
  return <article className={`stat-card ${tone}`}><span>{title}</span><strong>{value ?? 0}</strong></article>;
}

function ReportRow({ report, onVote, admin = false, onStatus }) {
  const risk = (report.riskLevel || 'Low').toLowerCase();
  return <article className="report-row">
    <div className="report-thumb">{report.imageUrl ? <img src={report.imageUrl} alt="" /> : <span>♻</span>}</div>
    <div className="report-info"><strong>{report.description}</strong><small>{new Date(report.timestamp).toLocaleDateString()} <span>•</span> Risk: <b className={`risk-text ${risk}`}>{report.riskLevel || 'Low'}</b> <span>•</span> Priority: {report.priorityScore ?? 30}/100 <span>•</span> <b className="votes">♟ {report.votes || 1} {report.votes === 1 ? 'vote' : 'votes'}</b></small><em className={`alert-tag ${risk}`}>{report.alertTrigger || 'Routine Cleanup'}</em></div>
    {!admin && <button className="vote-action" onClick={() => onVote(report.id)}>👍 Vote <small>({report.votes || 1})</small></button>}
    {admin ? <select className={`status-select ${report.status?.toLowerCase().replace(' ', '-')}`} value={report.status} onChange={(event) => onStatus(report.id, event.target.value)}>{statuses.map((status) => <option key={status}>{status}</option>)}</select> : <span className={`status-badge ${report.status?.toLowerCase().replace(' ', '-')}`}>{report.status}</span>}
  </article>;
}

function MapPage({ reports, period, setPeriod }) {
  const active = reports.filter((report) => report.status !== 'Resolved');
  return <div className="map-page">
    <header className="map-toolbar"><h1>Live Heatmap &amp; Black Spots</h1><div className="period-tabs">{['All', 'Today', 'Week', 'Month'].map((value) => <button key={value} className={period === value ? 'selected' : ''} onClick={() => setPeriod(value)}>{value}</button>)}</div><div className="map-key"><i className="red-key" /><i className="amber-key" /></div></header>
    <div className="large-map">
      <div className="map-grid" /><div className="map-water water-one" /><div className="map-water water-two" /><div className="map-park park-one" /><div className="map-park park-two" />
      {active.map((report, index) => {
        const lat = Number(report.location?.lat), lng = Number(report.location?.lng);
        const left = Math.min(93, Math.max(7, 13 + ((lng - 77.05) / .4) * 70));
        const top = Math.min(90, Math.max(10, 78 - ((lat - 28.5) / .3) * 62));
        return <button key={report.id} className={`pin pin-${(report.riskLevel || 'low').toLowerCase()}`} title={`${report.description} — ${report.status}`} style={{ left: `${left}%`, top: `${top}%`, animationDelay: `${index * .12}s` }}><span>●</span><small>{report.description}</small></button>;
      })}
      <div className="map-attribution">Map data · Community reports</div>
      <span className="district district-one">NORTH DISTRICT</span><span className="district district-two">CITY CENTRE</span><span className="district district-three">SOUTH DISTRICT</span>
    </div>
  </div>;
}

function AdminLogin({ onSubmit, error }) {
  return <div className="admin-login-page"><form className="admin-login-card" onSubmit={onSubmit}>
    <header><span>♙</span><div><h1>Admin Portal</h1><small>EcoTrack Smart Waste Management</small></div></header>
    <div className="admin-login-body"><label>Email Address<input type="email" name="email" required defaultValue="admin@ecotrack.com" autoComplete="username" /><small>Demo: admin@ecotrack.com</small></label><label>Password<input type="password" name="password" required defaultValue="admin@123" autoComplete="current-password" /><small>Demo: admin@123</small></label>{error && <p className="login-error">{error}</p>}<button className="green-button">↪ Sign In</button><div className="demo-box"><b>Demo Credentials:</b><br />Email: admin@ecotrack.com<br />Password: admin@123</div></div>
  </form></div>;
}

function AdminPage({ reports, stats, onStatus, onAlert, notice }) {
  return <div className="admin-dashboard page"><div className="admin-heading"><div><p className="eyebrow">DECISION SUPPORT SYSTEM</p><h1>Operations dashboard</h1><p>Monitor hotspots and coordinate cleanup response.</p></div><button className="green-button" onClick={onAlert}>♧ Send municipality alert</button></div><div className="stats-row"><StatCard title="Total Complaints logged" value={stats.total} tone="neutral" /><StatCard title="High Risk Hotspots" value={reports.filter((r) => r.riskLevel === 'High' && r.status !== 'Resolved').length} tone="red" /><StatCard title="Resolved Spots" value={stats.resolved} tone="green" /></div><section className="dark-panel admin-reports"><div className="panel-title"><h2>Manage reports</h2><span className="admin-chip">ADMIN ACCESS</span></div>{reports.map((report) => <ReportRow key={report.id} report={report} onVote={() => {}} admin onStatus={onStatus} />)}</section>{notice && <p className="inline-notice">{notice}</p>}</div>;
}

function ChatWidget({ open, setOpen, messages, input, setInput, onSubmit }) {
  return <>{open
    ? <section className="chat-card"><header><b>Hi, I'm Binny! 👋</b><button onClick={() => setOpen(false)}>×</button></header><div className="chat-history">{messages.slice(-3).map((message, index) => <small key={index}>{message.text}</small>)}</div><form onSubmit={onSubmit}><input aria-label="Message Binny" value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ask me anything…" /><button aria-label="Send message">↑</button></form></section>
    : <button className="chat-teaser" onClick={() => setOpen(true)}><b>Hi, I'm Binny! 👋</b><small>Do you need any help?</small></button>}
    <button className="chat-launcher" onClick={() => setOpen(!open)} aria-label="Toggle Binny chat">◔</button></>;
}

export default App;
