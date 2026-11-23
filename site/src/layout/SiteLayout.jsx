import { useLang } from '../i18n.jsx';
import { useReveal } from '../shared.jsx';
import Footer from './Footer.jsx';
import Nav from './Nav.jsx';

export function SiteLayout({ children }) {
  const { lang } = useLang();
  useReveal();

  return (
    <div className={`page lang-${lang}`}>
      <Nav />
      <main id="top">{children}</main>
      <Footer />
    </div>
  );
}

export default SiteLayout;
