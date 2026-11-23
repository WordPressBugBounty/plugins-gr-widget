<?php

defined('ABSPATH') || exit;

/**
 * Thin HTTP client for grwidget.com APIs.
 */
class GRWI_API_Client
{
    private string $api_base;

    private bool $retrying_after_404 = false;

    private bool $retrying_after_auth_failure = false;

    /** Effective service authorisation; explicit administrator decisions always win. */
    public static function service_allowed(): bool
    {
        $consent = get_option('grwi_service_consent', null);
        $legacy = self::legacy_authorization();

        return $consent !== null ? (bool) $consent : in_array($legacy, [
            'linked_account', 'configured_business', 'saved_embed',
        ], true);
    }

    /**
     * Make one local compatibility decision, before the saved version is updated.
     * Do not write consent: this records prior service configuration, not a new opt-in.
     * In particular, activation credentials/capability caches alone prove nothing.
     */
    private static function legacy_authorization(): string
    {
        $saved = get_option('grwi_legacy_authorization', null);
        if ($saved !== null) {
            return is_string($saved) ? $saved : 'none';
        }

        $basis = 'none';
        $version = (string) get_option('grwi_plugin_version', '');
        if (get_option('grwi_service_consent', null) === null
            && ($version === '' || version_compare($version, '1.2.5', '<='))) {
            $token = (string) get_option('grwi_api_token', '');
            $registered = (int) get_option('grwi_site_id', 0) > 0
                && (string) get_option('grwi_site_secret', '') !== '';

            if ((bool) get_option('grwi_linked', false) && trim($token) !== '') {
                // Tokens are saved by the administrator's account-link flow, never activation.
                $basis = 'linked_account';
            } elseif ($registered && self::has_configured_business()) {
                $basis = 'configured_business';
            } elseif (self::has_saved_embed()) {
                $basis = $registered ? 'saved_embed' : 'reconnect';
            }
        }

        // add_option is atomic: simultaneous requests cannot replace the first decision.
        add_option('grwi_legacy_authorization', $basis, '', false);

        return (string) get_option('grwi_legacy_authorization', 'none');
    }

    private static function has_configured_business(): bool
    {
        $places = get_option('grwi_remembered_places', []);
        if (! is_array($places)) {
            return false;
        }
        foreach ($places as $place) {
            if (is_array($place) && is_string($place['place_id'] ?? null)
                && trim($place['place_id']) !== ''
                && is_string($place['business_name'] ?? $place['name'] ?? null)
                && trim($place['business_name'] ?? $place['name']) !== '') {
                // Only deliberate business selection/widget creation stores these rows.
                return true;
            }
        }

        return false;
    }

    /** Read only recognised, deliberately saved widget configuration. */
    private static function has_saved_embed(): bool
    {
        require_once __DIR__ . '/class-grwi-legacy-configuration.php';

        return GRWI_Legacy_Configuration::has_saved_embed();
    }

    /** Whether the consent screen should explain recovery rather than first-time setup. */
    public static function has_existing_setup(): bool
    {
        return (int) get_option('grwi_site_id', 0) > 0
            || (string) get_option('grwi_api_token', '') !== ''
            || self::has_configured_business()
            || in_array(self::legacy_authorization(), ['saved_embed', 'reconnect'], true);
    }

    public function __construct()
    {
        self::migrate_stored_api_base();
        $this->api_base = self::resolve_api_base();
    }

    /**
     * Normalize stored API base on every load so stale options cannot break requests.
     */
    public static function migrate_stored_api_base(): void
    {
        $stored = (string) get_option('grwi_api_base_url', '');
        if ($stored === '') {
            return;
        }

        $canonical = self::canonical_api_base($stored);
        if ($canonical !== rtrim($stored, '/')) {
            update_option('grwi_api_base_url', esc_url_raw($canonical), false);
        }
    }

    /**
     * Pick a working API base: validate stored option, otherwise fall back to GRWI_API_BASE.
     */
    public static function resolve_api_base(): string
    {
        $stored = (string) get_option('grwi_api_base_url', '');
        $candidate = self::canonical_api_base($stored !== '' ? $stored : GRWI_API_BASE);

        // Never probe an external endpoint before the administrator opts in.
        if (! self::service_allowed() || $stored === '' || self::validate_api_base($candidate)) {
            return $candidate;
        }

        update_option('grwi_api_base_url', GRWI_API_BASE, false);

        return GRWI_API_BASE;
    }

    /**
     * HEAD-check the health endpoint before trusting a stored API base.
     */
    public static function validate_api_base(string $base): bool
    {
        if (! self::service_allowed()) {
            return false;
        }

        $url = self::canonical_api_base($base) . '/wordpress/health';
        $response = wp_remote_head($url, [
            'timeout' => 8,
            'redirection' => 0,
            'headers' => [
                'Accept' => 'application/json',
                'User-Agent' => 'GR-Widget-WordPress/' . GRWI_VERSION,
                'X-GRWidget-Plugin-Version' => GRWI_VERSION,
            ],
        ]);

        if (is_wp_error($response)) {
            return false;
        }

        return (int) wp_remote_retrieve_response_code($response) === 200;
    }

    /**
     * Always return the canonical REST base (scheme + host + /api/v1).
     */
    public static function canonical_api_base(string $base = ''): string
    {
        $base = rtrim(trim($base), '/');
        if ($base === '') {
            return GRWI_API_BASE;
        }

        // Strip mistaken path suffixes from older plugin versions or bad API payloads.
        $base = preg_replace('#(/api/v1)+$#', '/api/v1', $base) ?: GRWI_API_BASE;
        $base = preg_replace('#/integrations/wordpress.*$#', '', $base) ?: GRWI_API_BASE;
        $base = preg_replace('#/wordpress(/anonymous)?.*$#', '', $base) ?: GRWI_API_BASE;
        $base = rtrim($base, '/');

        $parsed = wp_parse_url($base);
        if (empty($parsed['host'])) {
            return GRWI_API_BASE;
        }

        $host = strtolower((string) $parsed['host']);
        $allowed_hosts = ['grwidget.com', 'www.grwidget.com'];
        if (! in_array($host, $allowed_hosts, true)) {
            return GRWI_API_BASE;
        }

        // API credentials must never be transmitted over HTTP or custom ports.
        return 'https://' . $host . '/api/v1';
    }

    public function ensure_registered(bool $refresh_capabilities = true): bool
    {
        if (! self::service_allowed()) {
            return false;
        }

        $site_id = (int) get_option('grwi_site_id', 0);
        $secret = (string) get_option('grwi_site_secret', '');

        if ($site_id > 0 && $secret !== '') {
            if ($refresh_capabilities) {
                $this->refresh_capabilities();
            }

            return true;
        }

        if (! self::service_allowed()) {
            return false;
        }

        return $this->register_site();
    }

    /**
     * Register after explicit setup, or renew an existing site's credentials.
     * Keep the previous credentials until a complete replacement is received.
     */
    private function register_site(): bool
    {
        $response = $this->request('POST', '/wordpress/anonymous/register', [
            'site_url' => home_url('/'),
            'plugin_version' => GRWI_VERSION,
        ]);

        if (is_wp_error($response) || empty($response['site_id']) || empty($response['site_secret'])) {
            return false;
        }

        $site_id = (int) $response['site_id'];
        $secret = sanitize_text_field($response['site_secret']);
        if ($site_id <= 0 || $secret === '') {
            return false;
        }

        update_option('grwi_site_id', $site_id, false);
        update_option('grwi_site_secret', $secret, false);
        $this->store_capabilities($response);

        return true;
    }

    public function refresh_capabilities(): bool
    {
        if ($this->is_linked()) {
            $capabilities = $this->integration_request('GET', '/integrations/wordpress/capabilities', null, $this->linked_site_query());
            if (! is_wp_error($capabilities)) {
                $this->store_capabilities($capabilities);
                update_option('grwi_capabilities_refreshed_at', time(), false);
            }

            $account = $this->integration_request('GET', '/integrations/wordpress/account');
            if (! is_wp_error($account)) {
                update_option('grwi_linked_account', $account, false);
                update_option('grwi_capabilities_refreshed_at', time(), false);

                return true;
            }

            return ! is_wp_error($capabilities);
        }

        if (! $this->is_registered()) {
            return false;
        }

        $response = $this->request('GET', '/wordpress/anonymous/capabilities', null, $this->site_headers());
        if (is_wp_error($response)) {
            return false;
        }

        $this->store_capabilities($response);
        update_option('grwi_capabilities_refreshed_at', time(), false);

        return true;
    }

    /**
     * @return array<string, mixed>|WP_Error
     */
    public function get_widgets()
    {
        if ($this->needs_reconnect()) {
            return new WP_Error('grwi_reconnect', $this->reconnect_message());
        }

        if ($this->is_linked()) {
            return $this->with_reconnect_error(
                $this->integration_request('GET', '/integrations/wordpress/widgets', null, $this->linked_site_query())
            );
        }

        if (! $this->is_registered()) {
            return new WP_Error('grwi_not_registered', __('Site is not registered yet.', 'gr-widget'));
        }

        return $this->reject_linked_anonymous(
            $this->request('GET', '/wordpress/anonymous/widgets', null, $this->site_headers())
        );
    }

    /**
     * @param array<string, mixed> $data
     * @return array<string, mixed>|WP_Error
     */
    public function create_widget(array $data)
    {
        $data = GRWI_Config::sanitize_create($data);
        if (is_wp_error($data)) {
            return $data;
        }

        if ($this->is_linked()) {
            $data['site_hostname'] = wp_parse_url(home_url('/'), PHP_URL_HOST);
            $data['site_id'] = (int) get_option('grwi_site_id', 0);

            return $this->integration_request('POST', '/integrations/wordpress/widgets', $data);
        }

        return $this->reject_linked_anonymous(
            $this->request('POST', '/wordpress/anonymous/widgets', $data, $this->site_headers())
        );
    }

    /**
     * @param array<string, mixed> $data
     * @return array<string, mixed>|WP_Error
     */
    public function update_widget(string $embed_key, array $data)
    {
        $embed_key = sanitize_text_field($embed_key);
        $data = GRWI_Config::sanitize_update($data);
        if (is_wp_error($data)) {
            return $data;
        }

        if ($this->is_linked()) {
            return $this->integration_request(
                'PATCH',
                '/integrations/wordpress/widgets/' . rawurlencode($embed_key),
                $data,
                $this->linked_site_query()
            );
        }

        return $this->reject_linked_anonymous(
            $this->request('PATCH', '/wordpress/anonymous/widgets/' . rawurlencode($embed_key), $data, $this->site_headers())
        );
    }

    /**
     * Ask GR Widget to fetch a public page and look for this widget.
     *
     * @return array<string, mixed>|WP_Error
     */
    public function check_install(string $embed_key, string $url, string $platform = '')
    {
        $embed_key = sanitize_text_field($embed_key);
        $body = [
            'url' => $url,
            'platform' => $platform,
        ];
        $path = '/widgets/' . rawurlencode($embed_key) . '/install-check';

        if ($this->is_linked()) {
            return $this->integration_request('POST', '/integrations/wordpress' . $path, $body, $this->linked_site_query());
        }

        return $this->reject_linked_anonymous(
            $this->request('POST', '/wordpress/anonymous' . $path, $body, $this->site_headers())
        );
    }

    /**
     * @return array<string, mixed>|WP_Error
     */
    public function open_install_guide(string $embed_key, string $platform)
    {
        $embed_key = sanitize_text_field($embed_key);
        $body = ['platform' => $platform];
        $path = '/widgets/' . rawurlencode($embed_key) . '/install-guide';

        if ($this->is_linked()) {
            return $this->integration_request('POST', '/integrations/wordpress' . $path, $body, $this->linked_site_query());
        }

        return $this->reject_linked_anonymous(
            $this->request('POST', '/wordpress/anonymous' . $path, $body, $this->site_headers())
        );
    }

    /**
     * Email support about a not-found install check. The API only accepts this
     * when the last check for the widget was not found.
     *
     * @return array<string, mixed>|WP_Error
     */
    public function request_install_help(string $embed_key, string $message = '')
    {
        $embed_key = sanitize_text_field($embed_key);
        $body = ['message' => $message];
        $path = '/widgets/' . rawurlencode($embed_key) . '/install-check-help';

        if ($this->is_linked()) {
            return $this->integration_request('POST', '/integrations/wordpress' . $path, $body, $this->linked_site_query());
        }

        return $this->reject_linked_anonymous(
            $this->request('POST', '/wordpress/anonymous' . $path, $body, $this->site_headers())
        );
    }

    /**
     * Submit a bug report from the native wp-admin builder.
     *
     * Linked sites must use the integrations route — anonymous site auth returns 403 when linked.
     *
     * @param array{description: string, email: string, context?: string, url?: string, embed_key?: string} $data
     * @return array<string, mixed>|WP_Error
     */
    public function submit_bug_report(array $data)
    {
        $payload = [
            'description' => (string) ($data['description'] ?? ''),
            'email' => (string) ($data['email'] ?? ''),
            'context' => (string) ($data['context'] ?? ''),
            'url' => (string) ($data['url'] ?? ''),
            'embed_key' => sanitize_text_field((string) ($data['embed_key'] ?? '')),
            'plugin_version' => GRWI_VERSION,
        ];

        if ($this->is_linked()) {
            return $this->integration_request(
                'POST',
                '/integrations/wordpress/bug-reports',
                $payload,
                $this->linked_site_query()
            );
        }

        $this->ensure_registered(false);

        return $this->reject_linked_anonymous(
            $this->request('POST', '/wordpress/anonymous/bug-reports', $payload, $this->site_headers())
        );
    }

    /**
     * @return array<string, mixed>|WP_Error
     */
    public function delete_widget(string $embed_key)
    {
        $embed_key = sanitize_text_field($embed_key);

        if ($embed_key === '') {
            return new WP_Error('grwi_missing_key', __('Missing widget key.', 'gr-widget'));
        }

        if ($this->is_linked()) {
            return $this->integration_request(
                'DELETE',
                '/integrations/wordpress/widgets/' . rawurlencode($embed_key),
                null,
                $this->linked_site_query()
            );
        }

        return $this->reject_linked_anonymous(
            $this->request('DELETE', '/wordpress/anonymous/widgets/' . rawurlencode($embed_key), null, $this->site_headers())
        );
    }

    /**
     * @return array<string, mixed>|WP_Error
     */
    public function search_places(string $query)
    {
        $query = sanitize_text_field($query);

        if ($this->is_linked()) {
            return $this->integration_request(
                'GET',
                '/integrations/wordpress/places/search?q=' . rawurlencode($query),
                null,
                $this->linked_site_query()
            );
        }

        if (! $this->ensure_registered(false)) {
            return new WP_Error('grwi_not_registered', __('Site is not registered yet.', 'gr-widget'));
        }

        return $this->reject_linked_anonymous(
            $this->request(
                'GET',
                '/wordpress/anonymous/places/search?q=' . rawurlencode($query),
                null,
                $this->site_headers()
            )
        );
    }

    /**
     * @return array<string, mixed>|WP_Error
     */
    public function recent_places()
    {
        if ($this->is_linked()) {
            return $this->integration_request('GET', '/integrations/wordpress/places/recent', null, $this->linked_site_query());
        }

        return $this->reject_linked_anonymous(
            $this->request('GET', '/wordpress/anonymous/places/recent', null, $this->site_headers())
        );
    }

    /**
     * @param array<string, mixed> $data
     * @return array<string, mixed>|WP_Error
     */
    public function sync_place(array $data)
    {
        if ($this->is_linked()) {
            return $this->integration_request(
                'POST',
                '/integrations/wordpress/places/sync',
                $data,
                $this->linked_site_query()
            );
        }

        return $this->reject_linked_anonymous(
            $this->request('POST', '/wordpress/anonymous/places/sync', $data, $this->site_headers())
        );
    }

    /**
     * @return array<string, mixed>|WP_Error
     */
    public function place_sync_status(string $place_id)
    {
        $place_id = sanitize_text_field($place_id);

        if ($this->is_linked()) {
            return $this->integration_request(
                'GET',
                '/integrations/wordpress/places/' . rawurlencode($place_id) . '/sync-status',
                null,
                $this->linked_site_query()
            );
        }

        return $this->reject_linked_anonymous(
            $this->request(
                'GET',
                '/wordpress/anonymous/places/' . rawurlencode($place_id) . '/sync-status',
                null,
                $this->site_headers()
            )
        );
    }

    /**
     * @return array<string, mixed>|WP_Error
     */
    public function get_widget_editor(string $embed_key)
    {
        $embed_key = sanitize_text_field($embed_key);

        if ($this->is_linked()) {
            return $this->with_reconnect_error(
                $this->integration_request(
                    'GET',
                    '/integrations/wordpress/widgets/' . rawurlencode($embed_key),
                    null,
                    $this->linked_site_query()
                )
            );
        }

        return $this->reject_linked_anonymous(
            $this->request(
                'GET',
                '/wordpress/anonymous/widgets/' . rawurlencode($embed_key),
                null,
                $this->site_headers()
            )
        );
    }

    /**
     * @return array<string, mixed>|WP_Error
     */
    public function generate_widget_ai_summary(string $embed_key, array $settings)
    {
        if (! $this->is_linked()) return new WP_Error('grwi_ai_requires_account', __('Link an eligible Business or Agency account to generate an AI summary.', 'gr-widget'));
        $settings = array_intersect_key($settings, array_flip(['language','language_mode','ai_summary_language_override','ai_summary_length']));
        $settings['force_regenerate'] = true;
        return $this->integration_request('POST', '/integrations/wordpress/widgets/' . rawurlencode($embed_key) . '/ai-summary', $settings, $this->linked_site_query());
    }

    public function get_widget_preview_data(string $embed_key, bool $dashboard = false)
    {
        $embed_key = sanitize_text_field($embed_key);

        if ($this->is_linked()) {
            return $this->integration_request(
                'GET',
                '/integrations/wordpress/widgets/' . rawurlencode($embed_key) . '/preview-data',
                null,
                array_merge($this->linked_site_query(), $dashboard ? ['dashboard_preview' => '1'] : [])
            );
        }

        return $this->reject_linked_anonymous(
            $this->request(
                'GET',
                '/wordpress/anonymous/widgets/' . rawurlencode($embed_key) . '/preview-data' . ($dashboard ? '?dashboard_preview=1' : ''),
                null,
                $this->site_headers()
            )
        );
    }

    /**
     * @return array<string, mixed>|WP_Error
     */
    public function link_account(string $api_token)
    {
        $api_token = sanitize_text_field($api_token);
        $site_id = (int) get_option('grwi_site_id', 0);
        $secret = (string) get_option('grwi_site_secret', '');

        if ($site_id <= 0 || $secret === '') {
            return new WP_Error('grwi_missing_credentials', __('Site is not registered yet.', 'gr-widget'));
        }

        $response = $this->request('POST', '/integrations/wordpress/link', [
            'site_id' => $site_id,
            'site_secret' => $secret,
        ], [
            'Authorization' => 'Bearer ' . $api_token,
        ]);

        if (is_wp_error($response)) {
            return $response;
        }

        update_option('grwi_api_token', $api_token, false);
        update_option('grwi_linked', 1, false);
        $this->refresh_capabilities();

        return $response;
    }

    /**
     * Start popup connect handshake (anonymous site auth).
     *
     * @return array<string, mixed>|WP_Error
     */
    public function start_connect(?string $opener_origin = null)
    {
        if (! $this->ensure_registered(false)) {
            return new WP_Error('grwi_not_registered', __('Site is not registered yet.', 'gr-widget'));
        }

        $body = [
            'site_name' => wp_specialchars_decode(get_bloginfo('name'), ENT_QUOTES),
        ];

        if (is_string($opener_origin) && $opener_origin !== '') {
            $body['opener_origin'] = esc_url_raw($opener_origin);
        }

        return $this->request(
            'POST',
            '/wordpress/anonymous/connect/start',
            $body,
            $this->site_headers()
        );
    }

    /**
     * Claim one-time API token after popup connect completes.
     *
     * @return array<string, mixed>|WP_Error
     */
    public function claim_connect(string $connect_token)
    {
        $connect_token = sanitize_text_field($connect_token);
        $site_id = (int) get_option('grwi_site_id', 0);
        $secret = (string) get_option('grwi_site_secret', '');

        if ($connect_token === '' || $site_id <= 0 || $secret === '') {
            return new WP_Error('grwi_missing_credentials', __('Site is not registered yet.', 'gr-widget'));
        }

        $response = $this->request('POST', '/wordpress/anonymous/connect/claim', [
            'connect_token' => $connect_token,
            'site_id' => $site_id,
            'site_secret' => $secret,
        ]);

        if (is_wp_error($response)) {
            return $response;
        }

        $api_token = sanitize_text_field((string) ($response['api_token'] ?? ''));
        if ($api_token === '') {
            return new WP_Error('grwi_claim_failed', __('Connect succeeded but no API token was returned.', 'gr-widget'));
        }

        update_option('grwi_api_token', $api_token, false);
        update_option('grwi_linked', 1, false);
        $this->refresh_capabilities();

        return $response;
    }

    /**
     * @return array<string, mixed>|WP_Error
     */
    public function connect_status(string $connect_token)
    {
        $connect_token = sanitize_text_field($connect_token);
        $site_id = (int) get_option('grwi_site_id', 0);
        $secret = (string) get_option('grwi_site_secret', '');

        if ($connect_token === '' || $site_id <= 0 || $secret === '') {
            return new WP_Error('grwi_missing_credentials', __('Site is not registered yet.', 'gr-widget'));
        }

        return $this->request('POST', '/wordpress/anonymous/connect/status', [
            'connect_token' => $connect_token,
            'site_id' => $site_id,
            'site_secret' => $secret,
        ]);
    }

    public function apply_linked_token(string $api_token): void
    {
        update_option('grwi_api_token', sanitize_text_field($api_token), false);
        update_option('grwi_linked', 1, false);
        $this->refresh_capabilities();
    }

    public function save_api_token(string $api_token): void
    {
        update_option('grwi_api_token', sanitize_text_field($api_token), false);
    }

    public function is_linked(): bool
    {
        return self::service_allowed() && (bool) get_option('grwi_linked', false) && (string) get_option('grwi_api_token', '') !== '';
    }

    /**
     * Site is marked linked in WordPress but the API token is missing.
     */
    public function needs_reconnect(): bool
    {
        return self::service_allowed() && (bool) get_option('grwi_linked', false) && (string) get_option('grwi_api_token', '') === '';
    }

    /**
     * Cached capabilities merged with safe local defaults when the API is unreachable.
     *
     * @return array<string, mixed>
     */
    public function capabilities(): array
    {
        $caps = get_option('grwi_capabilities', []);
        if (! is_array($caps)) {
            $caps = [];
        }

        if ($caps === []) {
            return self::default_capabilities();
        }

        if ($this->is_linked()) {
            return $caps;
        }

        $defaults = self::default_capabilities();

        $effective = array_replace_recursive($defaults, $caps);
        // A stale linked/legacy capability cache cannot grant anonymous plan limits.
        foreach (['max_widgets', 'max_reviews_display', 'max_reviews_sync'] as $key) {
            $effective['limits'][$key] = $defaults['limits'][$key];
        }
        return $effective;
    }

    public function is_registered(): bool
    {
        return self::service_allowed() && (int) get_option('grwi_site_id', 0) > 0
            && (string) get_option('grwi_site_secret', '') !== '';
    }

    /**
     * True when the plugin has talked to grwidget.com recently or holds valid credentials.
     */
    public function is_api_connected(): bool
    {
        if ($this->is_registered()) {
            return true;
        }

        $refreshed = (int) get_option('grwi_capabilities_refreshed_at', 0);

        return $refreshed > 0 && (time() - $refreshed) < WEEK_IN_SECONDS;
    }

    /**
     * Local defaults for offline / first-load degraded mode (free-tier assumptions only).
     *
     * @return array<string, mixed>
     */
    public static function default_capabilities(): array
    {
        $anonymous_layouts = [
            'badge_card',
            'badge_review_request',
            'feed_list',
            'feed_carousel',
            'sticker_light',
        ];
        $link_account_layouts = [
            'badge_inline',
            'badge_compact',
            'badge_reviews_button',
            'feed_grid',
            'feed_mini_slider',
            'feed_classic_slider',
            'feed_classic_list',
            'feed_classic_grid',
            'sticker_tag',
            'badge_inline_reviews',
            'badge_essential',
            'badge_text_rating',
            'badge_stacked',
            'badge_micro_strip',
        ];
        $all_layouts = [
            'badge_card' => ['label' => __('Rating Badge', 'gr-widget'), 'family' => 'badge'],
            'badge_inline' => ['label' => __('Inline badge', 'gr-widget'), 'family' => 'badge'],
            'badge_compact' => ['label' => __('Compact badge', 'gr-widget'), 'family' => 'badge'],
            'badge_review_request' => ['label' => __('Review request', 'gr-widget'), 'family' => 'badge'],
            'badge_reviews_button' => ['label' => __('Reviews button', 'gr-widget'), 'family' => 'badge'],
            'badge_avatar' => ['label' => __('Avatar review badge', 'gr-widget'), 'family' => 'badge'],
            'badge_inline_reviews' => ['label' => __('Inline rating & reviews', 'gr-widget'), 'family' => 'badge'],
            'badge_essential' => ['label' => __('Essential rating', 'gr-widget'), 'family' => 'badge'],
            'badge_text_rating' => ['label' => __('Text rating', 'gr-widget'), 'family' => 'badge'],
            'badge_stacked' => ['label' => __('Stacked rating', 'gr-widget'), 'family' => 'badge'],
            'badge_micro_strip' => ['label' => __('Micro rating strip', 'gr-widget'), 'family' => 'badge'],
            'feed_list' => ['label' => __('List feed', 'gr-widget'), 'family' => 'feed'],
            'feed_carousel' => ['label' => __('Slider feed', 'gr-widget'), 'family' => 'feed'],
            'feed_grid' => ['label' => __('Grid feed', 'gr-widget'), 'family' => 'feed'],
            'feed_masonry' => ['label' => __('Masonry feed', 'gr-widget'), 'family' => 'feed'],
            'feed_slider' => ['label' => __('Carousel feed', 'gr-widget'), 'family' => 'feed'],
            'feed_review_ribbon' => ['label' => __('Review ribbon', 'gr-widget'), 'family' => 'feed'],
            'feed_mini_slider' => ['label' => __('Mini review slider', 'gr-widget'), 'family' => 'feed'],
            'feed_reputation_snapshot' => ['label' => __('Reputation snapshot', 'gr-widget'), 'family' => 'feed'],
            'feed_review_mosaic' => ['label' => __('Review mosaic', 'gr-widget'), 'family' => 'feed'],
            'feed_photo_spotlight' => ['label' => __('Photo spotlight', 'gr-widget'), 'family' => 'feed'],
            'feed_classic_carousel' => ['label' => __('Classic Carousel', 'gr-widget'), 'family' => 'feed'],
            'feed_classic_slider' => ['label' => __('Classic Slider', 'gr-widget'), 'family' => 'feed'],
            'feed_classic_list' => ['label' => __('Classic List', 'gr-widget'), 'family' => 'feed'],
            'feed_classic_grid' => ['label' => __('Classic Grid', 'gr-widget'), 'family' => 'feed'],
            'feed_classic_masonry' => ['label' => __('Classic Masonry', 'gr-widget'), 'family' => 'feed'],
            'sticker_light' => ['label' => __('Classic sticker', 'gr-widget'), 'family' => 'sticker'],
            'sticker_tag' => ['label' => __('Tag sticker', 'gr-widget'), 'family' => 'sticker'],
            'sticker_bold' => ['label' => __('Bold sticker', 'gr-widget'), 'family' => 'sticker'],
            'sticker_ribbon' => ['label' => __('Ribbon sticker', 'gr-widget'), 'family' => 'sticker'],
            'sticker_pill' => ['label' => __('Pill sticker', 'gr-widget'), 'family' => 'sticker'],
        ];

        $layout_catalog = [];
        foreach ($all_layouts as $key => $meta) {
            $locked = ! in_array($key, $anonymous_layouts, true);
            $business_layouts = [
                'feed_reputation_snapshot',
                'feed_photo_spotlight',
                'feed_review_mosaic',
            ];
            if (in_array($key, $anonymous_layouts, true)) {
                $entitlement = 'unlinked';
            } elseif (in_array($key, $link_account_layouts, true)) {
                $entitlement = 'linked_free';
            } elseif (in_array($key, $business_layouts, true)) {
                $entitlement = 'business';
            } else {
                $entitlement = 'site';
            }
            $upgrade_plan = null;
            if ($locked && $entitlement === 'business') {
                $upgrade_plan = 'Business';
            } elseif ($locked && $entitlement === 'site') {
                $upgrade_plan = 'Site';
            }
            $layout_catalog[] = [
                'key' => $key,
                'label' => $meta['label'],
                'family' => $meta['family'],
                'locked' => $locked,
                'entitlement' => $entitlement,
                'upgrade_plan' => $upgrade_plan,
            ];
        }

        return [
            'plan' => 'wordpress',
            'plan_name' => __('Unlinked', 'gr-widget'),
            'embed_script_url' => GRWI_EMBED_SCRIPT,
            'api_base_url' => GRWI_API_BASE,
            'limits' => [
                'max_widgets' => 1,
                'max_domains' => 1,
                'max_google_businesses' => 1,
                'max_reviews_display' => 5,
                'max_reviews_sync' => 5,
                'layouts' => $anonymous_layouts,
                'sync_hours' => 168,
                'hide_branding' => true,
            ],
            'features' => [
                'hide_branding' => true,
                'remove_branding' => true,
            ],
            'layout_catalog' => $layout_catalog,
            'layout_sections' => [
                'badges' => [
                    'title' => __('Badges & ratings', 'gr-widget'),
                    'hint' => '',
                    'layouts' => ['badge_card', 'badge_avatar', 'badge_compact', 'badge_inline', 'badge_inline_reviews', 'badge_essential', 'badge_text_rating', 'badge_stacked', 'badge_micro_strip', 'badge_reviews_button'],
                ],
                'collect' => [
                    'title' => __('Collect reviews', 'gr-widget'),
                    'hint' => '',
                    'layouts' => ['badge_review_request'],
                ],
                'carousels' => [
                    'title' => __('Carousels & sliders', 'gr-widget'),
                    'hint' => '',
                    'layouts' => ['feed_slider', 'feed_classic_carousel', 'feed_carousel', 'feed_mini_slider', 'feed_classic_slider'],
                ],
                'grids' => [
                    'title' => __('Grids & lists', 'gr-widget'),
                    'hint' => '',
                    'layouts' => ['feed_grid', 'feed_masonry', 'feed_list', 'feed_review_mosaic', 'feed_classic_grid', 'feed_classic_masonry', 'feed_classic_list'],
                ],
                'highlights' => [
                    'title' => __('Review highlights', 'gr-widget'),
                    'hint' => '',
                    'layouts' => ['feed_review_ribbon', 'feed_reputation_snapshot', 'feed_photo_spotlight'],
                ],
                'stickers' => [
                    'title' => __('Stickers', 'gr-widget'),
                    'hint' => '',
                    'layouts' => ['sticker_light', 'sticker_bold', 'sticker_ribbon', 'sticker_tag', 'sticker_pill'],
                ],
            ],
            'layout_preview_theme' => 'light',
            'preview_script_url' => 'https://grwidget.com/js/grw-preview.js',
            'layout_picker_preview_url' => 'https://grwidget.com/embed/layout-picker',
            'usage' => [
                'can_create' => true,
            ],
            'upgrade_url' => 'https://grwidget.com/blog/wordpress-plugin-upgrade?source=wordpress',
            'trial_url' => 'https://grwidget.com/pricing?source=wordpress&plan=site&cycle=monthly',
            'link_url' => 'https://grwidget.com/dashboard/account?source=wordpress&wp_link=1#wordpress',
            'preview_first' => false,
        ];
    }

    /**
     * @param array<string, mixed> $payload
     */
    private function store_capabilities(array $payload): void
    {
        if (! empty($payload['embed_script_url'])) {
            update_option('grwi_embed_script_url', esc_url_raw($payload['embed_script_url']), false);
        }

        if (! empty($payload['api_base_url'])) {
            $normalized = self::canonical_api_base((string) $payload['api_base_url']);
            if (self::validate_api_base($normalized)) {
                update_option('grwi_api_base_url', esc_url_raw($normalized), false);
                $this->api_base = $normalized;
            }
        }

        if (! empty($payload['account']) && is_array($payload['account'])) {
            update_option('grwi_linked_account', $payload['account'], false);
        }

        update_option('grwi_capabilities', $payload, false);
    }

    /**
     * @return true|WP_Error
     */
    public function unlink_account()
    {
        if (! $this->is_linked()) {
            return new WP_Error('grwi_not_linked', __('Site is not linked to a GR Widget account.', 'gr-widget'));
        }

        $result = $this->integration_request('POST', '/integrations/wordpress/unlink', null, $this->linked_site_query());
        if (is_wp_error($result)) {
            return $result;
        }

        $this->clear_linked_state();
        $this->refresh_capabilities();

        return true;
    }

    /**
     * @return array<string, string>
     */
    private function site_headers(): array
    {
        return [
            'X-GRWidget-Site-Id' => (string) (int) get_option('grwi_site_id', 0),
            'X-GRWidget-Site-Secret' => (string) get_option('grwi_site_secret', ''),
            'X-GRWidget-Home-Url' => home_url('/'),
        ];
    }

    /**
     * @param array<string, mixed>|null $body
     * @param array<string, string> $extra_headers
     * @return array<string, mixed>|WP_Error
     */
    private function request(string $method, string $path, ?array $body = null, array $extra_headers = [])
    {
        // A denied/unconfigured installation must not contact the service,
        // including via AJAX calls made without using the setup screen.
        if (! self::service_allowed()) {
            return new WP_Error('grwi_consent_required', __('Connect GR Widget from its setup screen before using the service.', 'gr-widget'));
        }

        $url = self::canonical_api_base($this->api_base) . $path;
        $args = [
            'method' => $method,
            'timeout' => substr($path, -11) === '/ai-summary' ? 90 : 20,
            'redirection' => 0,
            'headers' => array_merge([
                'Accept' => 'application/json',
                'Content-Type' => 'application/json',
                'User-Agent' => 'GR-Widget-WordPress/' . GRWI_VERSION,
                'X-GRWidget-Plugin-Version' => GRWI_VERSION,
            ], $extra_headers),
        ];

        if ($body !== null) {
            $args['body'] = wp_json_encode($body);
        }

        $response = wp_remote_request($url, $args);
        if (is_wp_error($response)) {
            return $response;
        }

        $code = (int) wp_remote_retrieve_response_code($response);
        $raw = (string) wp_remote_retrieve_body($response);
        $decoded = json_decode($raw, true);
        if (! is_array($decoded)) {
            $decoded = ['error' => $raw !== '' ? $raw : __('Unexpected API response.', 'gr-widget')];
        }

        $decoded = GRWI_Config::without_code_controls($decoded);

        if ($code === 404) {
            if (! $this->retrying_after_404) {
                $this->retrying_after_404 = true;
                $this->api_base = GRWI_API_BASE;
                update_option('grwi_api_base_url', GRWI_API_BASE, false);

                return $this->request($method, $path, $body, $extra_headers);
            }
        }

        if (($code === 401 || $code === 404) && $this->should_recover_site_credentials($extra_headers)) {
            if ($this->recover_site_credentials()) {
                return $this->request($method, $path, $body, $this->merge_site_headers($extra_headers));
            }
        }

        if ($code >= 400) {
            return new WP_Error('grwi_api_error', $this->format_error_message($code, $decoded, $url), ['status' => $code, 'body' => $decoded, 'url' => $url]);
        }

        return $decoded;
    }

    /**
     * @param  array<string, mixed>  $decoded
     */
    private function format_error_message(int $code, array $decoded, string $url): string
    {
        $message = '';

        if (! empty($decoded['error']) && is_string($decoded['error'])) {
            $message = $decoded['error'];
        } elseif (! empty($decoded['message']) && is_string($decoded['message'])) {
            $message = $decoded['message'];

            if (! empty($decoded['errors']) && is_array($decoded['errors'])) {
                $details = [];
                foreach ($decoded['errors'] as $field => $messages) {
                    if (is_array($messages)) {
                        foreach ($messages as $item) {
                            if (is_string($item) && $item !== '') {
                                $details[] = $item;
                            }
                        }
                    } elseif (is_string($messages) && $messages !== '') {
                        $details[] = $messages;
                    }
                }

                if ($details !== []) {
                    $message .= ' ' . implode(' ', $details);
                }
            }
        }

        if ($message === '') {
            $message = sprintf(
                /* translators: %d: HTTP status code. */
                __('API request failed (HTTP %d).', 'gr-widget'),
                $code
            );
        } elseif ($code >= 400) {
            $message = sprintf(
                /* translators: 1: HTTP status code, 2: error message from API. */
                __('API error (HTTP %1$d): %2$s', 'gr-widget'),
                $code,
                $message
            );
        }

        return $this->user_facing_message($message);
    }

    /**
     * Customer-facing message and upgrade link from an API error.
     * Uses the API body so a plan limit is not wrapped as a generic HTTP failure.
     *
     * @return array{message: string, upgrade_url: string, status: int}
     */
    public function api_error_notice(WP_Error $error): array
    {
        $data = $error->get_error_data();
        $body = is_array($data) && is_array($data['body'] ?? null) ? $data['body'] : [];
        $status = is_array($data) ? (int) ($data['status'] ?? 0) : 0;
        if ($status < 400 || $status >= 600) {
            $status = 500;
        }

        $raw = '';
        if (! empty($body['error']) && is_string($body['error'])) {
            $raw = $body['error'];
        } elseif (! empty($body['message']) && is_string($body['message'])) {
            $raw = $body['message'];
        }
        if ($raw === '') {
            $raw = $error->get_error_message();
        }

        $upgrade = '';
        if (! empty($body['upgrade_url']) && is_string($body['upgrade_url'])) {
            $upgrade = $this->safe_upgrade_url($body['upgrade_url']);
        }

        return [
            'message' => $this->user_facing_message($raw),
            'upgrade_url' => $upgrade,
            'status' => $status,
        ];
    }

    private function safe_upgrade_url(string $url): string
    {
        $url = esc_url_raw($url);
        $parts = wp_parse_url($url);
        if (! is_array($parts) || strtolower((string) ($parts['scheme'] ?? '')) !== 'https') {
            return '';
        }

        $host = strtolower((string) ($parts['host'] ?? ''));
        if (! in_array($host, ['grwidget.com', 'www.grwidget.com', 'staging.grwidget.com'], true)) {
            return '';
        }

        return $url;
    }

    /**
     * Strip API URLs and tokens from messages shown in wp-admin.
     */
    public function user_facing_message(string $message): string
    {
        $message = preg_replace('#\s*URL:\s*\S+#i', '', $message) ?? $message;
        $message = preg_replace('#https?://[^\s<>"\']+#i', '', $message) ?? $message;
        $message = preg_replace('/\bgrw_[A-Za-z0-9_\-]+\b/', '', $message) ?? $message;
        $message = trim(preg_replace('/\s{2,}/', ' ', $message) ?? $message);

        return $message !== '' ? $message : __('Could not reach GR Widget right now. Try again.', 'gr-widget');
    }

    public function reconnect_message(): string
    {
        return __('This site is linked to a GR Widget account, but the connection needs to be refreshed. Reconnect to load your widgets. Existing embeds on your site keep working.', 'gr-widget');
    }

    /**
     * @return bool
     */
    public function is_reconnect_error($error): bool
    {
        if (! $error instanceof WP_Error) {
            return false;
        }

        if (in_array($error->get_error_code(), ['grwi_no_token', 'grwi_reconnect'], true)) {
            return true;
        }

        $data = $error->get_error_data();
        $status = is_array($data) ? (int) ($data['status'] ?? 0) : 0;

        return $this->is_linked() && $status === 401;
    }

    /**
     * Map linked-credential failures to a reconnect WP_Error.
     *
     * @param  array<string, mixed>|WP_Error  $result
     * @return array<string, mixed>|WP_Error
     */
    public function with_reconnect_error($result)
    {
        if (! is_wp_error($result) || ! $this->is_reconnect_error($result)) {
            return $result;
        }

        return new WP_Error('grwi_reconnect', $this->reconnect_message(), $result->get_error_data());
    }

    /**
     * Anonymous routes return 403 once the hosted site is linked. Never retry them.
     *
     * @param  array<string, mixed>|WP_Error  $result
     * @return array<string, mixed>|WP_Error
     */
    private function reject_linked_anonymous($result)
    {
        if (! is_wp_error($result)) {
            return $result;
        }

        $data = $result->get_error_data();
        $status = is_array($data) ? (int) ($data['status'] ?? 0) : 0;
        $message = $result->get_error_message();

        if ($status === 403 && stripos($message, 'already linked') !== false) {
            return new WP_Error('grwi_reconnect', $this->reconnect_message(), $data);
        }

        return $result;
    }

    /**
     * @param array<string, mixed>|null $body
     * @return array<string, mixed>|WP_Error
     */
    private function integration_request(string $method, string $path, ?array $body = null, array $query = [])
    {
        $token = (string) get_option('grwi_api_token', '');
        if ($token === '') {
            return new WP_Error('grwi_no_token', __('API token required.', 'gr-widget'));
        }

        if ($query !== []) {
            $path .= (strpos($path, '?') !== false ? '&' : '?') . http_build_query($query);
        }

        return $this->request($method, $path, $body, [
            'Authorization' => 'Bearer ' . $token,
            'X-GRWidget-Home-Url' => home_url('/'),
        ]);
    }

    private function clear_linked_state(): void
    {
        delete_option('grwi_api_token');
        update_option('grwi_linked', 0, false);
        delete_option('grwi_linked_account');
    }

    /**
     * @param  array<string, string>  $extra_headers
     */
    private function should_recover_site_credentials(array $extra_headers): bool
    {
        if ($this->retrying_after_auth_failure || $this->is_linked()) {
            return false;
        }

        return isset($extra_headers['X-GRWidget-Site-Secret'])
            || isset($extra_headers['X-GRWidget-Site-Id']);
    }

    /**
     * @param  array<string, string>  $extra_headers
     * @return array<string, string>
     */
    private function merge_site_headers(array $extra_headers): array
    {
        if (! isset($extra_headers['X-GRWidget-Site-Secret']) && ! isset($extra_headers['X-GRWidget-Site-Id'])) {
            return $extra_headers;
        }

        return array_merge($extra_headers, $this->site_headers());
    }

    private function recover_site_credentials(): bool
    {
        // Existing registrations remain connected after upgrading to opt-in setup.
        // Never use credential recovery to register a new, unconsented site.
        if (! $this->is_registered()) {
            return false;
        }

        $this->retrying_after_auth_failure = true;

        return $this->register_site();
    }

    /**
     * @return array<string, int|string>
     */
    private function linked_site_query(): array
    {
        $site_id = (int) get_option('grwi_site_id', 0);

        return $site_id > 0 ? ['site_id' => $site_id] : [];
    }
}

