"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type Anomaly = {
  id: string;
  score: number;
  year: number;
  partner: string;
  partnerCode: number;
  hs: string;
  product: string;
  imports: number;
  exports: number;
  gap: number;
  gapRatio: number;
  tier: string;
  components: Record<string, number>;
  caveats: string[];
};

type DashboardData = {
  generatedAt: string;
  source: string;
  scope: string;
  summary: {
    tradeAnalyzed: string;
    mirrorPairs: number;
    highPriority: number;
    partners: number;
    products: number;
    tierA: number;
    tierB: number;
    tierC: number;
  };
  years: number[];
  anomalies: Anomaly[];
  validation: {
    injected: number;
    stable_reference_n: number;
    severity: string;
    recall_at_1pct: number;
    recall_at_5pct: number;
    mean_percentile: number;
  };
};

type View = "overview" | "explorer" | "model" | "methods";

const formatMoney = (value: number) => {
  if (Math.abs(value) >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toLocaleString()}`;
};

const componentLabels: Record<string, string> = {
  mirror: "Mirror gap",
  temporal: "Temporal shift",
  unitValue: "Unit value",
  modelAgreement: "Model agreement",
  materiality: "Materiality",
};

export default function Dashboard({ data }: { data: DashboardData }) {
  const [view, setView] = useState<View>("overview");
  const [year, setYear] = useState("all");
  const [partner, setPartner] = useState("all");
  const [minimumScore, setMinimumScore] = useState(85);
  const [selectedId, setSelectedId] = useState(data.anomalies[0]?.id ?? "");
  const partners = useMemo(
    () => Array.from(new Set(data.anomalies.map((item) => item.partner))).sort(),
    [data.anomalies],
  );
  const filtered = useMemo(
    () =>
      data.anomalies.filter(
        (item) =>
          (year === "all" || item.year === Number(year)) &&
          (partner === "all" || item.partner === partner) &&
          item.score >= minimumScore,
      ),
    [data.anomalies, minimumScore, partner, year],
  );
  const selected = data.anomalies.find((item) => item.id === selectedId) ?? data.anomalies[0];

  const showCase = (id: string) => {
    setSelectedId(id);
    setView("explorer");
  };

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <header className="site-header">
        <a className="brand" href="#main-content" aria-label="TradeWatch Lebanon home">
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
          <span><strong>TradeWatch</strong><small>Lebanon</small></span>
        </a>
        <nav className="view-nav" aria-label="Dashboard sections">
          {([
            ["overview", "Command center"],
            ["explorer", "Anomaly explorer"],
            ["model", "Model lab"],
            ["methods", "Methods"],
          ] as [View, string][]).map(([id, label]) => (
            <button key={id} type="button" data-active={view === id} onClick={() => setView(id)}>{label}</button>
          ))}
          <Link href="/ai">How AI works</Link>
        </nav>
        <div className="source-stamp"><span aria-hidden="true" /> Official data<br /><b>Snapshot cached</b></div>
      </header>

      <div className="caveat-strip" role="note">
        <strong>Research signal, not an accusation.</strong>
        <span>Mirror discrepancies can arise from valuation, timing, routing, classification, estimation, and revisions.</span>
      </div>

      <main id="main-content">
        {view === "overview" && (
          <>
            <section className="hero-section">
              <div className="eyebrow"><span /> Auditable anomaly intelligence</div>
              <h1>Where does Lebanon’s trade data <em>stop looking normal?</em></h1>
              <p>TradeWatch pairs Lebanon’s reported imports with partner-country exports, learns the shape of normal discrepancies, and shows analysts where to look first.</p>
              <div className="hero-actions">
                <button className="primary-button" type="button" onClick={() => setView("explorer")}>Explore flagged flows <span aria-hidden="true">→</span></button>
                <button className="text-button" type="button" onClick={() => setView("model")}>Review validation</button>
              </div>
              <div className="scope-note"><span>Live MVP scope</span>{data.scope} · {data.source}</div>
            </section>

            <section className="kpi-grid" aria-label="Dataset summary">
              {[
                [data.summary.tradeAnalyzed, "Trade analyzed", "value on both mirror sides"],
                [data.summary.mirrorPairs.toLocaleString(), "Matched flows", `${data.summary.products} HS4 products`],
                [data.summary.highPriority.toLocaleString(), "High-priority flags", "score at or above 85"],
                [data.summary.partners.toLocaleString(), "Partner countries", `${data.years[0]}–${data.years.at(-1)}`],
              ].map(([value, label, note], index) => (
                <article className="kpi-card" key={label}>
                  <span className={`kpi-index index-${index + 1}`}>0{index + 1}</span>
                  <strong>{value}</strong><h2>{label}</h2><p>{note}</p>
                </article>
              ))}
            </section>

            <section className="overview-grid">
              <article className="panel priority-panel">
                <div className="panel-heading">
                  <div><span className="section-kicker">Priority queue</span><h2>Highest-scoring evidence files</h2></div>
                  <button className="text-button compact" type="button" onClick={() => setView("explorer")}>View all</button>
                </div>
                <div className="priority-list">
                  {data.anomalies.slice(0, 5).map((item, index) => (
                    <button className="priority-row" type="button" onClick={() => showCase(item.id)} key={item.id}>
                      <span className="rank">{String(index + 1).padStart(2, "0")}</span>
                      <span className="priority-copy"><b>HS {item.hs} · {item.product}</b><small>{item.partner} · {item.year} · gap {formatMoney(item.gap)}</small></span>
                      <span className="score-ring" style={{ "--score": `${item.score * 3.6}deg` } as React.CSSProperties}><b>{item.score}</b><small>score</small></span>
                    </button>
                  ))}
                </div>
              </article>

              <aside className="panel signal-panel">
                <span className="section-kicker">Evidence quality</span>
                <h2>What the score combines</h2>
                <div className="signal-stack">
                  {Object.entries(selected.components).map(([name, value]) => (
                    <div className="signal-item" key={name}>
                      <span><b>{componentLabels[name]}</b><small>{value.toFixed(1)} percentile / robust score</small></span>
                      <div className="meter"><i style={{ width: `${Math.min(100, value)}%` }} /></div>
                    </div>
                  ))}
                </div>
                <div className="tier-summary">
                  <div><b>{data.summary.tierA.toLocaleString()}</b><span>Tier A</span><small>value + quantity comparable</small></div>
                  <div><b>{data.summary.tierB.toLocaleString()}</b><span>Tier B</span><small>value comparable only</small></div>
                  <div><b>{data.summary.tierC.toLocaleString()}</b><span>Tier C</span><small>missing mirror, kept separate</small></div>
                </div>
              </aside>
            </section>
          </>
        )}

        {view === "explorer" && (
          <section className="workspace-section">
            <div className="workspace-heading">
              <div><span className="section-kicker">Evidence workspace</span><h1>Anomaly explorer</h1><p>Filter the ranked queue, then open a case to see both official records and the score’s evidence trail.</p></div>
              <div className="result-count" role="status"><b>{filtered.length}</b><span>visible cases</span></div>
            </div>
            <div className="filter-bar">
              <label>Year<select value={year} onChange={(event) => setYear(event.target.value)}><option value="all">All years</option>{data.years.map((item) => <option key={item}>{item}</option>)}</select></label>
              <label>Partner<select value={partner} onChange={(event) => setPartner(event.target.value)}><option value="all">All partners</option>{partners.map((item) => <option key={item}>{item}</option>)}</select></label>
              <label className="score-filter">Minimum score <output>{minimumScore}</output><input aria-label="Minimum investigation priority score" type="range" min="75" max="95" step="1" value={minimumScore} onChange={(event) => setMinimumScore(Number(event.target.value))} /></label>
            </div>
            <div className="explorer-grid">
              <div className="table-panel">
                <div className="table-wrap">
                  <table>
                    <caption className="sr-only">Ranked statistical trade anomalies</caption>
                    <thead><tr><th>Score</th><th>Flow</th><th>Partner</th><th>Lebanon imports</th><th>Partner exports</th><th>Gap</th><th><span className="sr-only">Action</span></th></tr></thead>
                    <tbody>
                      {filtered.map((item) => (
                        <tr key={item.id} data-selected={selected?.id === item.id}>
                          <td><span className="score-pill">{item.score}</span></td>
                          <td><b>HS {item.hs}</b><small>{item.product}</small><small>{item.year} · Tier {item.tier}</small></td>
                          <td>{item.partner}</td><td>{formatMoney(item.imports)}</td><td>{formatMoney(item.exports)}</td><td>{formatMoney(item.gap)}</td>
                          <td><button className="open-case" type="button" onClick={() => setSelectedId(item.id)} aria-label={`Open evidence file for HS ${item.hs} with ${item.partner}`}>Open</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!filtered.length && <div className="empty-state"><b>No cases match these filters</b><p>Lower the minimum score or clear a partner and year filter.</p><button type="button" onClick={() => { setYear("all"); setPartner("all"); setMinimumScore(85); }}>Clear filters</button></div>}
                </div>
              </div>
              {selected && <CaseFile item={selected} />}
            </div>
          </section>
        )}

        {view === "model" && (
          <section className="workspace-section model-section">
            <div className="workspace-heading"><div><span className="section-kicker">Model lab</span><h1>Validation without fraud labels</h1><p>No verified fraud labels exist in UN Comtrade. The MVP tests sensitivity by perturbing stable mirror pairs and measuring where known injections rank.</p></div></div>
            <div className="validation-hero">
              <div className="validation-score"><span>Recall at top 1%</span><strong>{Math.round(data.validation.recall_at_1pct * 100)}%</strong><small>{data.validation.injected} injected events</small></div>
              <div className="validation-copy"><span className="status-chip"><i /> Feasibility gate passed</span><h2>Severe injected anomalies surfaced at the very top.</h2><p>{data.validation.severity}. The clean reference set contained {data.validation.stable_reference_n.toLocaleString()} historically close mirror pairs.</p><div className="validation-stats"><span><b>{Math.round(data.validation.recall_at_5pct * 100)}%</b> recall at top 5%</span><span><b>{data.validation.mean_percentile.toFixed(1)}</b> mean percentile</span></div></div>
            </div>
            <div className="method-cards">
              {[['01','Robust baseline','Median and MAD expose extreme signed mirror ratios without distribution assumptions.'],['02','Isolation Forest','A multivariate detector combines gap, scale, unit-value, and temporal features.'],['03','Local Outlier Factor','Local neighborhoods surface flows that differ from similar observations.'],['04','Priority ensemble','Model agreement and economic materiality become an explainable 0–100 queue.']].map(([n,title,copy]) => <article key={n}><span>{n}</span><h2>{title}</h2><p>{copy}</p></article>)}
            </div>
            <div className="honesty-callout"><b>Why there is no “fraud accuracy”</b><p>Unsupervised models estimate unusualness. Synthetic validation shows the detector reacts to controlled perturbations; it does not prove that real high-scoring flows are unlawful.</p></div>
          </section>
        )}

        {view === "methods" && (
          <section className="workspace-section methods-section">
            <div className="workspace-heading"><div><span className="section-kicker">Methods & limitations</span><h1>Built for audit, not accusation</h1><p>Every score can be traced to two official records, deterministic features, and visible caveats.</p></div></div>
            <div className="methods-grid">
              <article className="method-flow"><span className="section-kicker">Pipeline</span><h2>From records to a review queue</h2>{['Query both reporting directions','Match exact year + partner + HS4','Classify comparability tier','Engineer mirror and history features','Score with three methods','Generate case evidence and caveats'].map((item,index)=><div key={item}><i>{index+1}</i><span><b>{item}</b><small>{index===1?'Never pairs a different year, flow, or classification revision.':'Deterministic and cached for reproduction.'}</small></span></div>)}</article>
              <article className="limitations"><span className="section-kicker">Interpretive boundary</span><h2>Common reasons records differ</h2><ul>{['CIF import valuation versus FOB export valuation','Departure and arrival may fall in different periods','Re-exports and transit through third countries','Country of origin versus country of consignment','HS classification and statistical revisions','Estimated, suppressed, or missing quantities','Exchange-rate and conversion effects'].map((item)=><li key={item}><span aria-hidden="true">—</span>{item}</li>)}</ul></article>
            </div>
            <blockquote>“A high score means a flow is statistically unusual under this method. It does not establish fraud, smuggling, corruption, tax loss, or wrongdoing.”</blockquote>
            <div className="provenance"><div><span>Source</span><b>UN Comtrade public preview API</b></div><div><span>Classification</span><b>HS 2017 · annual · HS4</b></div><div><span>Snapshot</span><b>{new Date(data.generatedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</b></div><div><span>Scope</span><b>{data.scope}</b></div></div>
          </section>
        )}
      </main>

      <footer><span>TradeWatch Lebanon · LebNet AI Fellowship prototype</span><span>Research and risk-prioritization use only</span></footer>
    </div>
  );
}

function CaseFile({ item }: { item: Anomaly }) {
  return (
    <aside className="case-panel" aria-label={`Evidence file for HS ${item.hs}`}>
      <div className="case-top"><div><span className="section-kicker">Evidence file</span><h2>HS {item.hs}</h2><p>{item.product}</p></div><span className="large-score"><b>{item.score}</b><small>priority</small></span></div>
      <dl className="case-meta"><div><dt>Partner</dt><dd>{item.partner}</dd></div><div><dt>Year</dt><dd>{item.year}</dd></div><div><dt>Comparability</dt><dd>Tier {item.tier}</dd></div></dl>
      <div className="mirror-records"><article><span>Lebanon reported imports</span><strong>{formatMoney(item.imports)}</strong><small>Destination-side record</small></article><i aria-hidden="true">↔</i><article><span>Partner reported exports</span><strong>{formatMoney(item.exports)}</strong><small>Origin-side mirror</small></article></div>
      <div className="gap-callout"><span>Absolute difference</span><strong>{formatMoney(item.gap)}</strong><small>{item.gapRatio.toFixed(1)}% symmetric relative gap</small></div>
      <div className="component-list"><h3>Why it ranked highly</h3>{Object.entries(item.components).map(([name,value])=><div key={name}><span>{componentLabels[name]}</span><b>{value.toFixed(1)}</b><i><em style={{width:`${Math.min(value,100)}%`}} /></i></div>)}</div>
      <div className="case-caveats"><h3>Caveats to investigate</h3><ul>{item.caveats.map((caveat)=><li key={caveat}>{caveat}</li>)}</ul></div>
      <p className="case-conclusion">Statistically unusual flow requiring contextual investigation. This analysis does not establish fraud or wrongdoing.</p>
    </aside>
  );
}
