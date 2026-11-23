import { ArrowRight, Copy, SquareTerminal } from 'lucide-react';
import {
  siClaude,
  siCursor,
  siDeepseek,
  siGithubcopilot,
  siGooglegemini,
  siOpencode,
} from 'simple-icons';
import { useT } from '../i18n.jsx';
import { Brand, Icon, REPO, useCopyPrompt } from '../shared.jsx';

const OpenAIIcon = ({ size = 14, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1683a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4947zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1683a.0757.0757 0 0 1-.071 0l-4.8303-2.7866A4.504 4.504 0 0 1 2.3408 7.8956zm16.0993 3.8558L12.5973 8.3829l2.02-1.1636a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.401-.686zM20.1774 7.744a4.485 4.485 0 0 1 .5346 3.0137l-.142-.0852-4.783-2.7582a.7712.7712 0 0 0-.7806 0L9.1636 11.2828V8.9504a.0804.0804 0 0 1 .0332-.0615l4.9807-2.8763a4.4992 4.4992 0 0 1 6.0001 1.7313zM10.7401 12.074l2.5-1.4435 2.5 1.4435v2.887l-2.5 1.4435-2.5-1.4435z" />
  </svg>
);

const AGENTS = [
  { name: 'Claude Code', icon: (p) => <Brand icon={siClaude} {...p} /> },
  { name: 'Cursor', icon: (p) => <Brand icon={siCursor} {...p} /> },
  { name: 'Codex', icon: (p) => <OpenAIIcon {...p} /> },
  { name: 'DeepSeek Harness', icon: (p) => <Brand icon={siDeepseek} {...p} /> },
  { name: 'Gemini CLI', icon: (p) => <Brand icon={siGooglegemini} {...p} /> },
  { name: 'Copilot CLI', icon: (p) => <Brand icon={siGithubcopilot} {...p} /> },
  { name: 'OpenCode', icon: (p) => <Brand icon={siOpencode} {...p} /> },
  { name: 'OMP', icon: (p) => <SquareTerminal strokeWidth={1.85} aria-hidden="true" {...p} /> },
];

export default function Hero() {
  const H = useT().hero;
  const copyPrompt = useCopyPrompt();

  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="wrap">
        <a className="hero-eyebrow" href={H.eyebrowHref} target="_blank" rel="noreferrer">
          <span className="hero-eyebrow-dot" aria-hidden="true" />
          <span className="hero-eyebrow-tag">{H.eyebrowTag}</span>
          <span>{H.eyebrow}</span>
          <ArrowRight size={13} aria-hidden="true" />
        </a>

        <h1 id="hero-title" className="hero-title">{H.title}</h1>
        <p className="hero-sub">{H.sub}</p>

        <div className="hero-actions">
          <button onClick={copyPrompt} className="btn btn-primary btn-lg" type="button">
            <Copy size={15} />
            <span>{H.cta}</span>
          </button>
          <a href={REPO} target="_blank" rel="noreferrer" className="btn btn-secondary btn-lg">
            <Icon.github width="15" height="15" />
            <span>{H.gh}</span>
          </a>
        </div>

        <div className="hero-hosts">
          <span className="hero-hosts-label">{H.hostsLabel}</span>
          {AGENTS.map((host) => (
            <span key={host.name} className="host-chip">
              {host.icon({ size: 13 })}
              <span>{host.name}</span>
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
