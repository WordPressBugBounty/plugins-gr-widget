# Consent regression tests

Run from the repository root with PHP 7.4 or later:

```sh
php tests/consent-regression.php
```

The standalone harness executes production shortcode/block rendering, hosted-script loading,
API client methods, plugin upgrade/activation/cron hooks, admin notices, and the consent form
handler against representative WordPress option and content fixtures. WordPress persistence,
HTTP responses, scheduling and permissions are test doubles; no customer or remote service is
modified. Assertions throw on failure, independent of PHP's assertion configuration.

Validation for this change: 295 assertions pass on PHP 7.4 and 8.3 via WordPress Playground's
PHP Wasm runtime. Changed PHP files also parse successfully on PHP 7.4. No existing automated
test suite or test configuration was present in the repository.

The same linked legacy fixture was rendered using the specified upstream commits:
1.2.4 (`7c6201a4086a87a9bf9906bb0a99b741e2b2dcd9`) emits the original container;
1.2.5 (`6d5243b02204d23e131d4bff40178dfbd53b1145`) emits an empty string;
the fixed implementation emits the original container and hosted-script loader again.
The optional `GRWI_SMOKE=1` and `GRWI_SOURCE_DIR=/path/to/source` environment variables
run that rendering comparison against archived API-client/shortcode/embed sources.

Limits: this is not a live WordPress database/browser integration test. Real hosted review
hydration, production credentials, API last-seen persistence and server active-site counts
were not exercised. The server-side count formula is unchanged. Check a representative
authorised staging site's published shortcode/block, scheduled refresh and server last-seen
timestamp before release.

Additional release QA was run on the controlled WordPress demo with WP_DEBUG enabled,
real MySQL temporary fixture tables, actual hosted reviews and read-only server activity
verification. Anonymous and linked upgrade paths from both specified versions passed.
See docs/legacy-authorization.md for results; these are separate from this standalone harness.
