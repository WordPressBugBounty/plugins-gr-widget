# Legacy service authorisation compatibility (1.2.6)

## Cause and implementation

1.2.5 changed `GRWI_API_Client::service_allowed()` to require the new consent option on every
installation. Existing credentials and published embeds were retained, but that check hid
shortcode/block containers, prevented script loading and API requests, and cleared refresh
schedules when the consent option was absent.

The shared method now honours any stored consent decision first, including false/0/empty
refusals. If no decision exists, a one-time local migration records a separate
`grwi_legacy_authorization` basis without changing `grwi_service_consent`:

* `linked_account`: linked flag plus a nonempty account API token. Account linking is a
  deliberate action, not an activation effect.
* `configured_business`: existing site ID/secret plus a saved, nonempty business name and
  place ID from deliberate business selection.
* `saved_embed`: existing site ID/secret plus a saved, nonempty widget shortcode (including
  the pre-1.0 alias), Gutenberg embed block, or HTML embed container in local posts or
  classic Text/Custom HTML/Block widget settings, or the recognised placement fields in Elementor and Bricks metadata. Divi shortcode and code modules in post_content are recognised. Revisions and trash are excluded; saved drafts
  and reusable block posts count as deliberate configuration.
* `reconnect`: a saved embed exists but registration credentials are missing. No service
  authorisation is granted; the recovery notice is shown.
* `none`: no sufficient basis, or an explicit consent decision already exists.

Candidates must have a saved plugin version no later than 1.2.5, or no saved version.
Version alone never grants authorisation. Durable configuration recovers customers already
running 1.2.5 even after that release overwrote their prior version.

The decision is stored before the upgrade changes the saved version. New installations
record `none` before configuration; later settings cannot manufacture legacy status.
Explicit decisions are checked on every call, so revoking consent immediately overrides
an earlier recovery. Atomic option creation preserves the first migration decision.
The pre-1.0 option migration also runs before activation eligibility is evaluated.

All existing API, shortcode, Gutenberg, embed and schedule gates continue using this shared
check. The redundant explicit-only gate in registration now uses the effective state too.
Valid existing credentials, account links, widget IDs/keys, capabilities and existing
twice-daily timestamps are retained; a refresh removed by 1.2.5 is scheduled again.
No customer widget is created, changed or deleted by the migration. Uninstall removes the
new local migration option along with existing plugin options.

## Manual recovery and notice

Registration credentials, automatic capability caches, a saved version or a link flag
without a token do not prove deliberate configuration. These installations still need
explicit approval. Customers with only remote widget records, embeds in theme files or
unsupported page-builder metadata and no usable local configuration may also need to reconnect.

Administrators (`manage_options`) see the requested WordPress-native recovery notice on
Dashboard, Plugins and the GR Widget screen only when service authorisation is absent and
existing setup is detectable. The CTA is a plain link to the existing disclosure/setup
screen; it does not grant consent. Approval still requires the existing nonce-protected
POST and capability check. The notice disappears as soon as authorisation is restored.
Fresh installations retain the ordinary setup screen without a misleading recovery alert.

## Security, policy and release limits

No eligibility check calls the service. Existing hostname/HTTPS restrictions, redirect
blocking, sanitisation, configuration validation, credential handling, nonces, capability
checks and disclosure/privacy links are retained. The server active-site formula is not
changed. Successful authorised requests can again reach the existing activity-recording
path; production last-seen persistence was verified read-only before and after a real demo capability refresh (19:31:22 to 19:43:09 UTC on 2026-11-15).

WordPress.org Guideline 7 expressly discusses configured SaaS plugins:
https://developer.wordpress.org/plugins/wordpress-org/detailed-plugin-guidelines/#7-plugins-may-not-track-users-without-their-consent

This implementation uses account linking and deliberate service configuration as evidence
of existing SaaS authorisation; it does not grant authorisation from automatic registration.
The reinstatement thread was reviewed on 2026-11-15. The review called out unconsented
external calls; no explicit instruction requiring every existing configured customer to
accept a new checkbox was found. The final relisting email adds no such condition. This
is not a claim that the Plugins Team has separately approved this implementation, nor a
blanket grandfathering exception.

Final QA: 295 standalone assertions pass on PHP 7.4 and 8.3. Real WordPress 7.1.4/MySQL
verified seven storage formats across both upgrade origins, stored opt-outs and example
exclusions (58 checks). A 50,000-post negative scan took 1.62 seconds with zero retained
memory increase; content is read in keyset batches of 20. Only four documented builder
metadata keys are queried. No unrelated metadata is scanned.

The original anonymous demo widget rendered under 1.2.4, disappeared under 1.2.5, and
recovered under 1.2.6 with its original key and actual hosted rating/review count. A temporary,
user-approved linked-account test verified both 1.2.4 and 1.2.5 origins, unchanged site ID,
secret and token, all three original widget keys, ten real review records and twice-daily
refresh. Browser rendering and console checks passed. The demo was unlinked afterward
through the normal service API, with all widget keys intact. Real WordPress setup/notice/
opt-out checks passed with WP_DEBUG enabled and zero unconsented requests. The actual ZIP
installed successfully through WordPress and Plugin Check reported no errors/findings.
