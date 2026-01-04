import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Photon Autodash',
  description: 'LLM-powered Photon-SOL autonomous dashboard',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="container">
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>Photon Autodash</div>
              <div className="muted small">Discover → Score → Monitor → (Optional) Execute + Learn</div>
            </div>
            <div className="row">
              <a className="badge" href="/">Dashboard</a>
              <a className="badge" href="/settings">Settings</a>
            </div>
          </div>
          {children}
        </div>
      </body>
    </html>
  );
}
