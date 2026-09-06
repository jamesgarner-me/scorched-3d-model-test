import { modelSites, repoUrl } from './models'
import type { ModelSite } from './models'

function EntryBody({ site }: { site: ModelSite }) {
  return (
    <>
      <span className="entry-head">
        <strong className="entry-name">{site.name}</strong>
        <span className="entry-folder">models/{site.folder}</span>
      </span>
      <span className="entry-blurb">{site.blurb}</span>
      <span className="entry-action" aria-hidden="true">
        {site.status === 'live' ? 'Play' : 'Not deployed'}
      </span>
    </>
  )
}

export default function App() {
  return (
    <div className="page">
      <main className="shell">
        <header className="masthead">
          <p className="kicker">One-shot model comparison</p>
          <h1>Scorched 3D</h1>
          <p className="lede">
            The same planetary artillery brief, handed once to each model and deployed exactly as it
            came back. Pick a build and take a shot.
          </p>
        </header>

        <ul className="directory">
          {modelSites.map((site) => (
            <li key={site.folder}>
              {site.status === 'live' && site.url !== null ? (
                <a className="entry" href={site.url} target="_blank" rel="noopener noreferrer">
                  <EntryBody site={site} />
                </a>
              ) : (
                <div className="entry is-pending" aria-disabled="true">
                  <EntryBody site={site} />
                </div>
              )}
            </li>
          ))}
        </ul>

        <footer className="colophon">
          <p>
            Every build is a frozen first generation from the shared brief. Source and requirements
            live in{' '}
            <a href={repoUrl} target="_blank" rel="noopener noreferrer">
              the repository
            </a>
            .
          </p>
        </footer>
      </main>
    </div>
  )
}
