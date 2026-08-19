import Link from "next/link";
import dashboardData from "@/artifacts/dashboard.json";

const percentage = (value: number | null) =>
  value === null ? "Not available" : `${Math.round(value * 100)}%`;

export default function TradeWatchAiPage() {
  const { summary, validation } = dashboardData;

  return (
    <div className="app-shell explainer-page trade-explainer">
      <a className="skip-link" href="#ai-content">Skip to content</a>
      <header className="site-header">
        <Link className="brand" href="/" aria-label="TradeWatch Lebanon dashboard">
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
          <span><strong>TradeWatch</strong><small>Lebanon</small></span>
        </Link>
        <nav className="view-nav" aria-label="TradeWatch pages">
          <Link href="/">Dashboard</Link>
          <Link href="/ai" aria-current="page">How AI works</Link>
        </nav>
        <div className="source-stamp"><span aria-hidden="true" /> AI-assisted<br /><b>Human review first</b></div>
      </header>

      <main id="ai-content">
        <section className="explainer-hero">
          <span className="eyebrow"><span /> AI explained</span>
          <h1>How TradeWatch turns trade data into an <em>investigation queue.</em></h1>
          <p>TradeWatch uses machine learning to find trade flows that are statistically unusual—not to decide that anyone has done something wrong. The output is an evidence file for a human analyst to review.</p>
          <dl className="explainer-facts" aria-label="TradeWatch AI summary">
            <div><dt>AI type</dt><dd>Unsupervised anomaly detection</dd></div>
            <div><dt>Decision</dt><dd>Prioritize review, never accuse</dd></div>
            <div><dt>Data</dt><dd>Official bilateral trade records</dd></div>
          </dl>
        </section>

        <section className="explainer-section problem-section">
          <div className="section-intro"><span className="section-kicker">The Lebanon problem</span><h2>Too many records, too little time for every discrepancy.</h2></div>
          <p>Lebanon’s import records and partner countries’ export records often differ for legitimate reasons: freight valuation, arrival timing, re-exports, transit, classification changes, estimates, and revisions. TradeWatch helps reviewers focus on the discrepancies that most deserve context—not on every difference.</p>
        </section>

        <section className="explainer-section">
          <div className="section-intro"><span className="section-kicker">Technical pipeline</span><h2>Five traceable steps from source data to a reviewable case.</h2></div>
          <ol className="ai-flow" aria-label="TradeWatch AI pipeline">
            <li><span>01</span><div><h3>Pair the two reporting sides</h3><p>Lebanon’s reported imports are matched to a partner’s reported exports at the exact year, partner, and HS4 product code.</p></div></li>
            <li><span>02</span><div><h3>Measure comparable signals</h3><p>The pipeline calculates mirror gaps, unit-value differences, changes over time, economic materiality, and a comparability tier.</p></div></li>
            <li><span>03</span><div><h3>Learn what looks unusual</h3><p>Three complementary detectors score observations without needing a historical list of proven fraud cases.</p></div></li>
            <li><span>04</span><div><h3>Combine evidence into a queue</h3><p>Model agreement and materiality become a transparent 0–100 investigation-priority score.</p></div></li>
            <li><span>05</span><div><h3>Show the evidence and caveats</h3><p>Every ranked flow keeps both original records, score components, and reasons the records may legitimately differ.</p></div></li>
          </ol>
        </section>

        <section className="explainer-section model-section-explained">
          <div className="section-intro"><span className="section-kicker">The AI model</span><h2>Three ways to detect an outlier, then one explainable priority score.</h2></div>
          <div className="model-explainer-grid">
            <article><span>01</span><h3>Robust baseline</h3><p>Median and median absolute deviation identify extreme mirror ratios without assuming trade data follows a neat bell curve.</p></article>
            <article><span>02</span><h3>Isolation Forest</h3><p>A multivariable detector identifies flows that are unusually isolated across gap, scale, unit value, and temporal features.</p></article>
            <article><span>03</span><h3>Local Outlier Factor</h3><p>A neighborhood detector catches flows that look unusual compared with similar observations, even if they are not globally extreme.</p></article>
            <article><span>04</span><h3>Priority ensemble</h3><p>Agreement across methods plus the value at stake produces a ranked queue that reviewers can understand and audit.</p></article>
          </div>
        </section>

        <section className="explainer-section split-explainer">
          <article>
            <span className="section-kicker">What validates it</span>
            <h2>Controlled sensitivity testing</h2>
            <p>Because UN Comtrade does not label transactions as “fraud,” the project starts with historically close mirror pairs and introduces known, severe perturbations. The model should rank those injections far above normal observations.</p>
            <dl className="metric-list">
              <div><dt>{validation.injected.toLocaleString()}</dt><dd>severe synthetic perturbations</dd></div>
              <div><dt>{percentage(validation.recall_at_1pct)}</dt><dd>recalled in the top 1% in this scoped test</dd></div>
              <div><dt>{summary.mirrorPairs.toLocaleString()}</dt><dd>matched flows in the MVP dataset</dd></div>
            </dl>
          </article>
          <article className="limit-card">
            <span className="section-kicker">What it cannot say</span>
            <h2>Unusual is not unlawful.</h2>
            <ul>
              <li>A high score is not a fraud probability.</li>
              <li>The model cannot establish smuggling, corruption, tax loss, or intent.</li>
              <li>Lower-scoring records may still require review for other reasons.</li>
              <li>Human context and source documentation remain essential.</li>
            </ul>
          </article>
        </section>

        <section className="explainer-section stack-section">
          <div className="section-intro"><span className="section-kicker">Built to be reproduced</span><h2>The technical foundation behind the dashboard.</h2></div>
          <div className="stack-grid"><div><b>Source data</b><span>UN Comtrade public preview API</span></div><div><b>Data pipeline</b><span>Python, cached raw responses, deterministic feature engineering</span></div><div><b>Model artifacts</b><span>Parquet mirror-pair table and a JSON dashboard contract</span></div><div><b>Interface</b><span>React dashboard built for analyst review and caveats</span></div></div>
        </section>
      </main>

      <footer><span>TradeWatch Lebanon · LebNet AI Fellowship prototype</span><span>AI-assisted triage for human investigation</span></footer>
    </div>
  );
}
