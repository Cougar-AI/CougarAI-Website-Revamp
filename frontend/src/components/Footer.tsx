import { NavLink } from 'react-router-dom';
import { ArrowUp, Github, Instagram, Linkedin, Mail } from 'lucide-react';
import logo from '@/assets/logo.png';

const navLinkBase = 'text-white/90 hover:text-white transition-colors';

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="relative mt-16 border-t border-white/10 text-white">
      <div className="bg-gradient-to-b from-red-700 via-red-700 to-red-800">
        {/* Accent shimmer line */}
        <div
          aria-hidden
          className="pointer-events-none h-px w-full bg-gradient-to-r from-transparent via-white/50 to-transparent"
        />

        <div className="mx-auto w-full max-w-7xl px-4 py-10">
          <div className="grid grid-cols-1 gap-10 md:grid-cols-4">
            {/* Brand */}
            <div>
              <div className="flex items-center gap-3">
                <img src={logo} alt="CougarAI logo" className="h-9 w-9 rounded" />
                <span className="text-lg font-semibold tracking-wide">CougarAI</span>
              </div>
              <p className="mt-4 max-w-xs text-sm text-white/80">
                Workshops, projects, and a welcoming community for students exploring AI/ML at UH.
              </p>
            </div>

            {/* Explore */}
            <nav className="md:col-span-2 grid grid-cols-2 gap-8">
              <div>
                <p className="mb-3 text-sm font-semibold text-white">Explore</p>
                <ul className="space-y-2 text-sm">
                  <li>
                    <NavLink to="/" className={navLinkBase}>
                      Home
                    </NavLink>
                  </li>
                  <li>
                    <NavLink to="/About" className={navLinkBase}>
                      About
                    </NavLink>
                  </li>
                  <li>
                    <NavLink to="/Memberships" className={navLinkBase}>
                      Memberships
                    </NavLink>
                  </li>
                  <li>
                    <NavLink to="/Calendar" className={navLinkBase}>
                      Calendar
                    </NavLink>
                  </li>
                  <li>
                    <NavLink to="/knowledge-base" className={navLinkBase}>
                      Knowledge Base
                    </NavLink>
                  </li>
                  <li>
                    <NavLink to="/Contact" className={navLinkBase}>
                      Contact
                    </NavLink>
                  </li>
                  <li>
                    <NavLink to="/Sponsor" className={navLinkBase}>
                      Sponsors
                    </NavLink>
                  </li>
                </ul>
              </div>

              {/* Connect */}
              <div>
                <p className="mb-3 text-sm font-semibold text-white">Connect</p>
                <ul className="space-y-2 text-sm">
                  <li>
                    <a className={navLinkBase} href="mailto:cougaraicontact@gmail.com">
                      Email us
                    </a>
                  </li>
                  <li>
                    <a className={navLinkBase} href="https://discord.gg/ucd5ZnDDnf" target="_blank" rel="noreferrer">
                      Discord
                    </a>
                  </li>
                  <li>
                    <a className={navLinkBase} href="https://github.com/Cougar-AI" target="_blank" rel="noreferrer">
                      GitHub
                    </a>
                  </li>
                  <li>
                    <a className={navLinkBase} href="https://www.instagram.com/cougar_ai/" target="_blank" rel="noreferrer">
                      Instagram
                    </a>
                  </li>
                  <li>
                    <a className={navLinkBase} href="https://www.linkedin.com/company/cougar-ai/" target="_blank" rel="noreferrer">
                      LinkedIn
                    </a>
                  </li>
                </ul>
              </div>
            </nav>

            {/* Actions */}
            <div className="flex flex-col items-start gap-4">
              <a
                href="mailto:cougaraicontact@gmail.com"
                className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/50"
              >
                <Mail className="h-4 w-4" />
                cougaraicontact@gmail.com
              </a>

              <div className="flex items-center gap-2 text-white/90">
                <a
                  aria-label="Instagram"
                  href="https://www.instagram.com/cougar_ai/"
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full p-2 hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/50"
                >
                  <Instagram className="h-5 w-5" />
                </a>
                <a
                  aria-label="GitHub"
                  href="https://github.com/Cougar-AI"
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full p-2 hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/50"
                >
                  <Github className="h-5 w-5" />
                </a>
                <a
                  aria-label="LinkedIn"
                  href="https://www.linkedin.com/company/cougar-ai/"
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full p-2 hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/50"
                >
                  <Linkedin className="h-5 w-5" />
                </a>
              </div>

              <button
                type="button"
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="mt-1 inline-flex items-center gap-2 text-xs text-white/90 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/50"
              >
                <ArrowUp className="h-4 w-4" /> Back to top
              </button>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-white/20 pt-6 text-xs text-white/90 md:flex-row">
            <p>© {year} CougarAI. All rights reserved.</p>
            <p className="whitespace-nowrap">
              <span className="align-middle">Made with</span>
              <span aria-hidden className="mx-1">♥</span>
              <span className="align-middle">by student volunteers</span>
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
