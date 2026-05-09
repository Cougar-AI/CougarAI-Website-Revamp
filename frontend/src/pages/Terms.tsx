export default function Terms() {
  return (
    <main className="relative min-h-screen font-['Oxanium'] px-4 py-16">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-4xl font-semibold text-white mb-4">Terms of Service</h1>
        <p className="text-white/50 text-sm mb-8">Last updated: 2026</p>

        <div className="space-y-6 text-white/70 text-base leading-relaxed">
          <section>
            <h2 className="text-white font-semibold text-lg mb-2">1. Acceptance</h2>
            <p>
              By accessing or using the CougarAI website and services, you agree to be
              bound by these Terms of Service. If you do not agree, please do not use our services.
            </p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-2">2. Use of Services</h2>
            <p>
              You agree to use our services only for lawful purposes and in accordance
              with these terms. You may not use the services in any way that violates
              applicable laws or regulations.
            </p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-2">3. Membership</h2>
            <p>
              Membership in CougarAI is open to University of Houston students. Membership
              dues, if applicable, are non-refundable once processed.
            </p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-2">4. Changes</h2>
            <p>
              We reserve the right to modify these terms at any time. Continued use of
              the services after changes constitutes acceptance of the updated terms.
            </p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-2">5. Contact</h2>
            <p>
              Questions about these terms? Email us at{" "}
              <a href="mailto:cougaraicontact@gmail.com" className="text-rose-400 hover:underline">
                cougaraicontact@gmail.com
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
