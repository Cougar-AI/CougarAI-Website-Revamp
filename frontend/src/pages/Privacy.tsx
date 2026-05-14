export default function Privacy() {
  return (
    <main className="relative min-h-screen font-['Oxanium'] px-4 py-16">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-4xl font-semibold text-white mb-4">Privacy Policy</h1>
        <p className="text-white/50 text-sm mb-8">Last updated: May 13, 2026</p>

        <div className="space-y-6 text-white/70 text-base leading-relaxed">
          <section>
            <h2 className="text-white font-semibold text-lg mb-2">1. Information We Collect</h2>
            <p>
              We collect information you provide directly to us, including your email
              address and password when you create an account. If you sign up for
              membership, we may also collect your first and last name, student ID,
              academic level, and other club-administration details you choose to provide.
            </p>
            <p>
              If you use Google sign-in, we receive basic account information needed to
              authenticate you, such as your email address and Google account verification
              status. If you make a membership payment, payment processing is handled by
              Stripe and we may store payment-related records such as the amount, date,
              and the student ID or email associated with the payment.
            </p>
            <p>
              We also store information generated through use of the site, such as email
              verification status, password reset activity, login/session tokens, event
              attendance, points, and related membership activity.
            </p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-2">2. How We Use It</h2>
            <p>
              We use your information to create and secure your account, manage memberships,
              process dues, communicate about club activities, verify eligibility, track
              event attendance and points, respond to support requests, and maintain the
              security and reliability of the website.
            </p>
            <p>
              If you opt in to club updates, we may use your email address to send
              announcements and membership-related communications. We do not sell your
              personal information.
            </p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-2">3. When We Share Information</h2>
            <p>
              We may share information with service providers that support the website and
              club operations, such as email delivery providers, Google for authentication,
              and Stripe for payment processing. We may also disclose information when
              reasonably necessary to comply with law, protect the club, protect users,
              or investigate misuse of the site.
            </p>
            <p>
              Payment card details are processed by Stripe, not stored directly by CougarAI
              through this website.
            </p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-2">4. Data Storage and Security</h2>
            <p>
              Data is stored in our systems and service-provider systems that support the
              website. We take reasonable administrative, technical, and organizational
              measures to protect information from unauthorized access, disclosure, or misuse.
              No method of storage or transmission is completely secure, so we cannot
              guarantee absolute security.
            </p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-2">5. Cookies and Authentication</h2>
            <p>
              We use session and authentication technologies, including HTTP-only refresh
              cookies and related session tokens, to keep you signed in, protect your account,
              and operate login, verification, and password reset features.
            </p>
            <p>
              We do not use the website for third-party advertising cookies. However, some
              third-party services we embed or rely on, such as Google sign-in or Stripe
              checkout, may use their own cookies or similar technologies as part of their services.
            </p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-2">6. Data Retention</h2>
            <p>
              We keep information for as long as reasonably necessary for account management,
              membership administration, payments, attendance tracking, security, legal compliance,
              and dispute resolution. Retention periods may vary depending on the type of data
              and the purpose for which it was collected.
            </p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-2">7. Your Choices</h2>
            <p>
              You may contact us to request updates or corrections to the information you have
              provided. You may also ask questions about account deletion, membership records,
              or communications preferences, and we will review requests in light of our legal,
              administrative, and security obligations.
            </p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-2">8. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. When we do, we will post the
              revised version on this page and update the &quot;Last updated&quot; date above.
            </p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-lg mb-2">9. Contact</h2>
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
