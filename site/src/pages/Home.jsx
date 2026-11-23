import Hero from '../sections/Hero.jsx';
import Stage from '../sections/Stage.jsx';
import Recovery from '../sections/Recovery.jsx';
import Spotlights from '../sections/Spotlights.jsx';
import Features from '../sections/Features.jsx';
import Start from '../sections/Start.jsx';
import Principles from '../sections/Principles.jsx';
import Faq from '../sections/Faq.jsx';
import { CtaBand } from '../sections/Finale.jsx';

export default function HomePage() {
  return (
    <>
      <Hero />
      <Stage />
      <Recovery />
      <Spotlights />
      <Features />
      <Start />
      <Principles />
      <Faq />
      <CtaBand />
    </>
  );
}
