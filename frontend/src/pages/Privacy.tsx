export default function Privacy() {
  return (
    <main className="relative min-h-screen font-['Oxanium'] px-4 py-16">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-4xl font-semibold text-white mb-4">Privacy Policy</h1>
        <p className="text-white/50 text-sm mb-8">Last updated: 2026</p>

        <div className="space-y-6 text-white/70 text-base leading-relaxed">
          <section>
            <h2 className="text-white font-semibold text-lg mb-2">1. Information We Collect</h2>
            <p>
              We collect information you provide directly, such as your name, email address,
              and student ID when you register or sign up for membership.
            </p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-2">2. How We Use It</h2>
            <p>
              Your information is used to manage your membership, communicate club updates,
              and track event attendance and points. We do not sell your data to third parties.
            </p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-2">3. Data Storage</h2>
            <p>
              Data is stored securely on our servers. We take reasonable measures to protect
              your information from unauthorized access.
            </p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-2">4. Cookies</h2>
            <p>
              We use session tokens to keep you logged in. No third-party tracking cookies
              are used.
            </p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-2">5. Contact</h2>
            <p>
              Questions about this policy? Email us at{" "}
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
