<?php

defined('ABSPATH') || exit;

/**
 * wp-admin settings and widget management UI.
 */
class GRWI_Admin
{
    /**
     * @param array<int, mixed> $urls
     * @return array<int, mixed>
     */
    public static function resource_hints(array $urls, string $relation_type): array
    {
        if ($relation_type === 'dns-prefetch') {
            $urls[] = 'https://grwidget.com';
        }

        if ($relation_type === 'preconnect') {
            $urls[] = [
                'href' => 'https://grwidget.com',
                'crossorigin' => 'anonymous',
            ];
        }

        return $urls;
    }

    public static function admin_page_url(): string
    {
        return admin_url('admin.php?page=grwi-widget');
    }

    /**
     * Native wp-admin customize screen URL for a widget.
     * Defaults to the Style builder section (same as first-open / post-create).
     *
     * @param string $tab Builder section id (style, install, customize, settings, …). Empty omits tab=.
     */
    public static function customize_url(string $embed_key, string $tab = 'style'): string
    {
        $embed_key = sanitize_text_field($embed_key);

        return $embed_key !== '' ? GRWI_Customize::page_url($embed_key, $tab) : '';
    }

    public static function register(): void
    {
        if (! is_admin()) {
            return;
        }

        add_action('admin_menu', [self::class, 'menu']);
        add_action('admin_enqueue_scripts', [self::class, 'assets']);
        add_action('admin_init', [self::class, 'handle_actions']);
        add_action('admin_notices', [self::class, 'connection_notice']);
        add_action('wp_ajax_grwi_search_places', [self::class, 'ajax_search_places']);
        add_action('wp_ajax_grwi_recent_places', [self::class, 'ajax_recent_places']);
        add_action('wp_ajax_grwi_remember_place', [self::class, 'ajax_remember_place']);
        add_action('wp_ajax_grwi_forget_place', [self::class, 'ajax_forget_place']);
        add_action('wp_ajax_grwi_sync_place', [self::class, 'ajax_sync_place']);
        add_action('wp_ajax_grwi_place_sync_status', [self::class, 'ajax_place_sync_status']);
        add_action('wp_ajax_grwi_delete_widget', [self::class, 'ajax_delete_widget']);
        add_action('wp_ajax_grwi_bulk_delete_widgets', [self::class, 'ajax_bulk_delete_widgets']);
        add_action('wp_ajax_grwi_duplicate_widget', [self::class, 'ajax_duplicate_widget']);
        add_action('wp_ajax_grwi_create_widget', [self::class, 'ajax_create_widget']);
        add_action('wp_ajax_grwi_connect_start', [self::class, 'ajax_connect_start']);
        add_action('wp_ajax_grwi_connect_claim', [self::class, 'ajax_connect_claim']);
        add_action('wp_ajax_grwi_connect_status', [self::class, 'ajax_connect_status']);
        add_action('wp_ajax_grwi_refresh_widgets', [self::class, 'ajax_refresh_widgets']);
        add_action('wp_ajax_grwi_dashboard_widget_preview', [self::class, 'ajax_dashboard_widget_preview']);
        add_action('wp_ajax_grwi_review_prompt', [self::class, 'ajax_review_prompt']);
        add_action('wp_ajax_grwi_install_check', [self::class, 'ajax_install_check']);
        add_action('wp_ajax_grwi_install_guide', [self::class, 'ajax_install_guide']);
        add_action('wp_ajax_grwi_install_help', [self::class, 'ajax_install_help']);
    }

    public static function connection_notice(): void
    {
        if (! is_admin() || ! current_user_can('manage_options')
            || GRWI_API_Client::service_allowed() || ! GRWI_API_Client::has_existing_setup()) {
            return;
        }

        $screen = get_current_screen();
        if (! $screen || ! in_array($screen->id, ['dashboard', 'plugins', 'toplevel_page_grwi-widget'], true)) {
            return;
        }

        // A recovery notice resolves itself after approval; no remote request is needed.
        ?>
        <div class="notice notice-warning">
            <p><strong><?php esc_html_e('GR Widget needs your attention', 'gr-widget'); ?></strong></p>
            <p><?php esc_html_e('Your existing Google review widgets may not appear until you reconnect GR Widget. Your saved widgets and settings are still available.', 'gr-widget'); ?></p>
            <p><a class="button button-primary" href="<?php echo esc_url(self::admin_page_url()); ?>"><?php esc_html_e('Reconnect GR Widget', 'gr-widget'); ?></a></p>
        </div>
        <?php
    }

    public static function menu(): void
    {
        $icon = 'dashicons-star-filled';
        $svg_path = GRWI_PLUGIN_DIR . 'assets/gr-widget-menu.svg';
        if (is_readable($svg_path)) {
            $svg = file_get_contents($svg_path);
            if (is_string($svg) && $svg !== '') {
                $icon = 'data:image/svg+xml;base64,' . base64_encode($svg);
            }
        }

        add_menu_page(
            __('GR Widget', 'gr-widget'),
            __('GR Widget', 'gr-widget'),
            'manage_options',
            'grwi-widget',
            [self::class, 'render_page'],
            $icon,
            99
        );
    }

    public static function assets(string $hook): void
    {
        if ($hook !== 'toplevel_page_grwi-widget') {
            return;
        }

        if (function_exists('nocache_headers')) {
            nocache_headers();
        }

        wp_enqueue_style('grwi-admin', GRWI_PLUGIN_URL . 'assets/admin.css', [], self::asset_version('assets/admin.css'));

        $client = new GRWI_API_Client();
        if (! $client->is_registered() && ! $client->is_linked()) {
            // Show a locally rendered opt-in screen without loading remote scripts.
            return;
        }
        if ($client->is_registered()) {
            $client->refresh_capabilities();
        }
        add_filter('wp_resource_hints', [self::class, 'resource_hints'], 10, 2);
        $caps = $client->capabilities();
        $admin_deps = ['jquery'];
        $preview_script = GRWI_PLUGIN_URL . 'assets/grw-preview.js';
        wp_enqueue_script('grwi-preview', $preview_script, [], self::asset_version('assets/grw-preview.js'), true);
        $admin_deps[] = 'grwi-preview';
        wp_enqueue_script('grwi-preview-opts', GRWI_PLUGIN_URL . 'assets/admin-preview-opts.js', ['jquery'], GRWI_VERSION, true);
        $admin_deps[] = 'grwi-preview-opts';
        wp_enqueue_script('grwi-admin', GRWI_PLUGIN_URL . 'assets/admin.js', $admin_deps, self::asset_version('assets/admin.js'), true);
        wp_enqueue_script('grwi-install-check', GRWI_PLUGIN_URL . 'assets/install-check.js', ['grwi-admin'], self::asset_version('assets/install-check.js'), true);

        $embed_script = (string) get_option('grwi_embed_script_url', GRWI_EMBED_SCRIPT);
        if ($embed_script !== '') {
            wp_enqueue_script('grwi-embed', esc_url($embed_script), [], GRWI_VERSION, true);
        }
        wp_localize_script('grwi-admin', 'grwiAdmin', [
            'ajaxUrl' => admin_url('admin-ajax.php'),
            'nonce' => wp_create_nonce('grwi_admin'),
            'layoutCatalog' => $caps['layout_catalog'] ?? [],
            'layoutSections' => $caps['layout_sections'] ?? [],
            'layoutPreviewDemo' => $caps['layout_preview_demo'] ?? null,
            'layoutPreviewTheme' => $caps['layout_preview_theme'] ?? 'light',
            'layoutPickerPreviewUrl' => $caps['layout_picker_preview_url'] ?? 'https://grwidget.com/embed/layout-picker',
            'previewScriptUrl' => $preview_script,
            'embedScriptUrl' => $caps['embed_script_url'] ?? '',
            'apiBaseUrl' => $caps['api_base_url'] ?? '',
            'upgradeUrl' => $caps['upgrade_url'] ?? 'https://grwidget.com/blog/wordpress-plugin-upgrade?source=wordpress',
            'trialUrl' => $caps['trial_url'] ?? 'https://grwidget.com/pricing?source=wordpress&plan=site&cycle=monthly',
            'upgradeCheckoutUrl' => $caps['upgrade_checkout_url'] ?? '',
            'businessTrialUrl' => $caps['business_trial_url'] ?? '',
            'businessUpgradeCheckoutUrl' => $caps['business_upgrade_checkout_url'] ?? '',
            'agencyTrialUrl' => $caps['agency_trial_url'] ?? '',
            'agencyUpgradeCheckoutUrl' => $caps['agency_upgrade_checkout_url'] ?? '',
            'isLinked' => $client->is_linked(),
            'trialEligible' => array_key_exists('trial_eligible', $caps) && $caps['trial_eligible'] !== null
                ? (int) (bool) $caps['trial_eligible']
                : '',
            'trialCopy' => is_array($caps['trial_copy'] ?? null) ? $caps['trial_copy'] : [],
            'previewFirst' => ! empty($caps['preview_first']),
            'previewFirstCatalog' => is_array($caps['preview_first_catalog'] ?? null) ? $caps['preview_first_catalog'] : [],
            'dashboardUrl' => self::admin_page_url(),
            'i18n' => [
                'searching' => __('Searching…', 'gr-widget'),
                'noResults' => __('No businesses found.', 'gr-widget'),
                'searchFailed' => __('Search failed. Try again.', 'gr-widget'),
                'searchUnavailable' => __('Business search is temporarily unavailable. Please try again later.', 'gr-widget'),
                'removeBusiness' => __('Remove business', 'gr-widget'),
                'copied' => __('Copied!', 'gr-widget'),
                'copiedShortcode' => __('Shortcode copied to your clipboard.', 'gr-widget'),
                'copy' => __('Copy', 'gr-widget'),
                'copyShortcode' => __('Copy shortcode', 'gr-widget'),
                /* translators: %s: widget name. */
                'deleteConfirmNamed' => __('Delete “%s”? This will remove the widget from pages where its shortcode or block is used.', 'gr-widget'),
                'thisWidget' => __('this widget', 'gr-widget'),
                'duplicateFailed' => __('Could not duplicate widget.', 'gr-widget'),
                /* translators: %d: number of widgets. */
                'widgetCountSingular' => __('%d widget on this site', 'gr-widget'),
                /* translators: %d: number of widgets. */
                'widgetCountPlural' => __('%d widgets on this site', 'gr-widget'),
                'selectBusiness' => __('Select a business above before creating a widget.', 'gr-widget'),
                'selectBusinessContinue' => __('Select a business to continue', 'gr-widget'),
                'upgrade' => __('Upgrade', 'gr-widget'),
                'lockedLayout' => __('This layout is available with a 7-day free trial on GRWidget.com.', 'gr-widget'),
                'lockedLayoutHint' => __('Preview only — start a 7-day free trial on GRWidget.com to use this layout.', 'gr-widget'),
                'lockedPreviewNoticeSite' => __('Site plan required', 'gr-widget'),
                'lockedPreviewNoticeBusiness' => __('Business plan required', 'gr-widget'),
                'lockedPreviewNoticeAgency' => __('Agency plan required', 'gr-widget'),
                'lockedPreviewNoticeLink' => __('Free account required', 'gr-widget'),
                /* translators: %s: layout name */
                'lockedPreviewNoticeLinkBody' => __('Link a free account to use %s. No card required.', 'gr-widget'),
                /* translators: %s: layout name */
                'lockedPreviewNoticeSiteBody' => __('Start a 7-day trial to use %s immediately.', 'gr-widget'),
                /* translators: %s: layout name */
                'lockedPreviewNoticeSiteBodyIneligible' => __('Upgrade to Site to use %s.', 'gr-widget'),
                /* translators: %s: layout name */
                'lockedPreviewCtaSite' => __('View Site plan to use %s', 'gr-widget'),
                /* translators: %s: layout name */
                'lockedPreviewCtaBusiness' => __('View Business plan to use %s', 'gr-widget'),
                /* translators: %s: layout name */
                'lockedPreviewCtaAgency' => __('View Agency plan to use %s', 'gr-widget'),
                /* translators: %s: layout name */
                'lockedPreviewCtaLink' => __('Link free account to use %s', 'gr-widget'),
                'lockedPreviewPickAnother' => __('Choose an available layout', 'gr-widget'),
                'lockedPreviewTrialLead' => __('7-day trial · No charge today · Card required at checkout', 'gr-widget'),
                'lockedPreviewLinkSupporting' => __('Free · About 20 seconds', 'gr-widget'),
                'lockedPreviewWidgetsUnchanged' => __('Existing widgets remain unchanged', 'gr-widget'),
                /* translators: %s: layout name */
                'previewingHeading' => __('Previewing: %s', 'gr-widget'),
                'previewingPillLink' => __('PREVIEWING · FREE ACCOUNT REQUIRED', 'gr-widget'),
                'previewingPillSite' => __('PREVIEWING · SITE PLAN', 'gr-widget'),
                /* translators: %s: layout name */
                'previewRailTitle' => __('%s selected for preview', 'gr-widget'),
                /* translators: %d: number of other layouts unlocked by linking */
                'previewRailLinkBody' => __('Link a free account to unlock this and %d other layouts.', 'gr-widget'),
                'previewRailLinkBodyOne' => __('Link a free account to unlock this and 1 other layout.', 'gr-widget'),
                'previewRailLinkBodyOnly' => __('Link a free account to unlock this layout.', 'gr-widget'),
                /* translators: %d: number of other Site layouts */
                'previewRailSiteBody' => __('Start a 7-day trial to use this and %d other layouts immediately.', 'gr-widget'),
                'previewRailSiteBodyOne' => __('Start a 7-day trial to use this and 1 other layout immediately.', 'gr-widget'),
                'previewRailSiteBodyOnly' => __('Start a 7-day trial to use this layout immediately.', 'gr-widget'),
                /* translators: %s: layout name */
                'linkLayoutTitle' => __('Unlock %s with a free account', 'gr-widget'),
                'linkLayoutBody' => __('Link a free account to unlock this layout. Free includes 22 layouts; Site unlocks 31 with up to 30 reviews, reviewer photos, filters and bi-weekly syncing.', 'gr-widget'),
                'linkLayoutCta' => __('Link free account', 'gr-widget'),
                'linkLayoutSecondary' => __('Continue with current layout', 'gr-widget'),
                'linkLayoutFooter' => __('No payment required', 'gr-widget'),
                'widgetAllowanceTitle' => __('Widget limit reached', 'gr-widget'),
                'widgetAllowanceBody' => __('Link a free GR Widget account to create more widgets and unlock extra layouts.', 'gr-widget'),
                'widgetAllowanceCta' => __('Link free account', 'gr-widget'),
                'widgetAllowanceLinkedBody' => __('Upgrade on GRWidget.com for more widgets and every layout.', 'gr-widget'),
                'widgetAllowanceLinkedCta' => __('Start free trial', 'gr-widget'),
                'widgetAllowanceSecondary' => __('Not now', 'gr-widget'),
                /* translators: %s: layout name */
                'siteLayoutTitle' => __('Unlock %s with Site', 'gr-widget'),
                /* translators: %s: layout name. */
                'siteLayoutBody' => __('Display your reviews using the %s. Site also includes 31 layouts, up to 30 reviews, reviewer photos, filters, bi-weekly syncing and full design control.', 'gr-widget'),
                'siteLayoutSupporting' => __('$0 today. Your first payment of $5.99 is after 7 days unless you cancel.', 'gr-widget'),
                'siteLayoutCta' => __('Start 7-day Site trial', 'gr-widget'),
                'siteLayoutSecondary' => __('Continue with current layout', 'gr-widget'),
                'siteLayoutFooter' => __('Cancel anytime during the trial', 'gr-widget'),
                'trialUnknownSupporting' => __('Trial eligibility will be confirmed before payment.', 'gr-widget'),
                'trialIneligibleSupporting' => __('Charged at checkout. Cancel anytime.', 'gr-widget'),
                /* translators: %s: required plan name. */
                'previewFirstToastBody' => __('Preview and customise it freely. You’ll need %s to publish this design.', 'gr-widget'),
                /* translators: %s: required plan name. */
                'previewFirstBannerTitle' => __('Your design uses %s features', 'gr-widget'),
                /* translators: 1: list of premium features, 2: required plan name. */
                'previewFirstBannerBody' => __('%1$s require %2$s to publish. Keep designing for free—your current live widget won’t change.', 'gr-widget'),
                /* translators: 1: premium feature name, 2: required plan name. */
                'previewFirstBannerBodySingular' => __('%1$s requires %2$s to publish. Keep designing for free—your current live widget won’t change.', 'gr-widget'),
                'previewFirstContinueEditing' => __('Continue editing', 'gr-widget'),
                'brandingHiddenTitle' => __('Branding hidden in this preview', 'gr-widget'),
                'brandingHiddenBody' => __('Upgrade to Site to publish your widget without the GR Widget link.', 'gr-widget'),
                'brandingHiddenEntitledBody' => __('The GR Widget link is hidden in this preview. You can restore it anytime.', 'gr-widget'),
                'brandingTrialCta' => __('Start your 7-day Site trial', 'gr-widget'),
                'previewFirstStartTrial' => __('Start my free trial', 'gr-widget'),
                'previewFirstDraftSaved' => __('Draft saved. Your current live widget is unchanged.', 'gr-widget'),
                /* translators: %s: widget design name. */
                'previewFirstPublishTitle' => __('Your %s design is ready', 'gr-widget'),
                'customizeUpgradeCta' => __('Upgrade to Site', 'gr-widget'),
                'unlinkTitle' => __('Unlink this site?', 'gr-widget'),
                'unlinkBody' => __('Unlink this site from your GR Widget account? Your widgets stay in this plugin; link again later to manage them in the web builder.', 'gr-widget'),
                'unlinkConfirm' => __('Unlink account', 'gr-widget'),
                'cancel' => __('Cancel', 'gr-widget'),
                'creating' => __('Creating widget…', 'gr-widget'),
                'createWidget' => __('Create widget', 'gr-widget'),
                'lockedLayoutCreate' => __('That layout is locked on your current plan. Choose an available layout or unlock it first.', 'gr-widget'),
                'livePreview' => __('Live preview', 'gr-widget'),
                'customiseWidget' => __('Customize', 'gr-widget'),
                'editStyle' => __('Edit', 'gr-widget'),
                'preview' => __('Preview', 'gr-widget'),
                'previewFailed' => __('Could not load preview.', 'gr-widget'),
                'previewFallback' => __('Live preview unavailable — showing layout preview.', 'gr-widget'),
                'syncBackgroundTitle' => __('Syncing reviews in the background', 'gr-widget'),
                'syncBackgroundHint' => __('You can continue building your widget — live review data will appear in the preview shortly.', 'gr-widget'),
                'syncFailedTitle' => __('Could not sync reviews', 'gr-widget'),
                'syncFailedHint' => __('Review sync did not finish. You can keep building with demo reviews, or try again.', 'gr-widget'),
                'syncComplete' => __('Your reviews are synced and ready', 'gr-widget'),
                'syncPreviewDemo' => __('Preview uses your business name and rating with demo reviews until sync completes.', 'gr-widget'),
                'syncPreviewReady' => __('Showing your synced Google reviews.', 'gr-widget'),
                'deleteWidget' => __('Delete', 'gr-widget'),
                'deleteConfirm' => __('Delete this widget permanently? Shortcodes and blocks using it will stop working.', 'gr-widget'),
                'deleteFailed' => __('Could not delete widget.', 'gr-widget'),
                'deleted' => __('Widget deleted.', 'gr-widget'),
                'deleting' => __('Deleting…', 'gr-widget'),
                'createFailed' => __('Could not create widget.', 'gr-widget'),
                'created' => __('Widget created successfully.', 'gr-widget'),
                'connectOpening' => __('Opening GRWidget.com…', 'gr-widget'),
                'connectWaiting' => __('Waiting for you to finish in the popup…', 'gr-widget'),
                'connectClaiming' => __('Finishing connection…', 'gr-widget'),
                'connectSuccess' => __('Connected! Reloading…', 'gr-widget'),
                'connectFailed' => __('Could not start account connect. Try again.', 'gr-widget'),
                'connectPopupBlocked' => __('Pop-up blocked. Allow pop-ups for this site and try again.', 'gr-widget'),
                'connectHint' => '',
                'closeDialog' => __('Close', 'gr-widget'),
            ],
            'isLinked' => $client->is_linked(),
            'siteName' => wp_specialchars_decode(get_bloginfo('name'), ENT_QUOTES),
            'syncPollMs' => 1500,
            'syncTimeoutMs' => 45000,
        ]);
    }

    public static function handle_actions(): void
    {
        if (! current_user_can('manage_options')) {
            return;
        }

        if (empty($_POST['grwi_action'])) {
            return;
        }

        check_admin_referer('grwi_admin_action');

        $client = new GRWI_API_Client();
        $action = sanitize_key((string) wp_unslash($_POST['grwi_action']));
        $redirect = self::admin_page_url();

        if ($action === 'enable_service') {
            // The administrator explicitly authorises communication with GRWidget.com.
            // This code only runs after the nonce + manage_options checks above.
            update_option('grwi_service_consent', 1, false);
            if (! $client->ensure_registered(false)) {
                $redirect = add_query_arg('grwi_connect_error', '1', $redirect);
            } elseif (! wp_next_scheduled('grwi_refresh_capabilities')) {
                wp_schedule_event(time() + HOUR_IN_SECONDS, 'twicedaily', 'grwi_refresh_capabilities');
            }
            wp_safe_redirect($redirect);
            exit;
        }

        if ($action === 'create_widget') {
            $result = self::create_widget_from_request($client);

            if (is_wp_error($result)) {
                $notice = $client->api_error_notice($result);
                $redirect = add_query_arg('grwi_error', rawurlencode($notice['message']), $redirect);
                if ($notice['upgrade_url'] !== '') {
                    $redirect = add_query_arg('grwi_upgrade', $notice['upgrade_url'], $redirect);
                }
            } else {
                $embed_key = '';
                if (is_array($result)) {
                    $embed_key = sanitize_text_field((string) ($result['embed_key'] ?? ''));
                    if ($embed_key === '') {
                        $widget = $result['widget'] ?? [];
                        if (is_array($widget)) {
                            $embed_key = sanitize_text_field((string) ($widget['embed_key'] ?? ''));
                        }
                    }
                }
                if ($embed_key !== '') {
                    // Open builder on Style (Install remains available via tab=install).
                    $redirect = add_query_arg(
                        'grwi_created',
                        '1',
                        self::customize_url($embed_key, 'style')
                    );
                } else {
                    $redirect = add_query_arg('grwi_created', '1', $redirect);
                }
            }
        }

        if ($action === 'link_account') {
            $token = sanitize_text_field(wp_unslash($_POST['api_token'] ?? ''));
            if ($token === '') {
                $redirect = add_query_arg('grwi_error', rawurlencode(__('API token is required.', 'gr-widget')), $redirect);
            } else {
                $result = $client->link_account($token);
                if (is_wp_error($result)) {
                    $redirect = add_query_arg('grwi_error', rawurlencode($result->get_error_message()), $redirect);
                } else {
                    $redirect = add_query_arg('grwi_linked', '1', $redirect);
                }
            }
        }

        if ($action === 'save_token') {
            $token = sanitize_text_field(wp_unslash($_POST['api_token'] ?? ''));
            $client->save_api_token($token);
            update_option('grwi_linked', $token !== '' ? 1 : 0, false);
            $client->refresh_capabilities();
            $redirect = add_query_arg('grwi_saved', '1', $redirect);
        }

        if ($action === 'refresh_capabilities') {
            $client->refresh_capabilities();
            $redirect = add_query_arg('grwi_refreshed', '1', $redirect);
        }

        if ($action === 'unlink_account') {
            $result = $client->unlink_account();
            if (is_wp_error($result)) {
                $redirect = add_query_arg('grwi_error', rawurlencode($result->get_error_message()), $redirect);
            } else {
                $redirect = add_query_arg('grwi_unlinked', '1', $redirect);
            }
        }

        wp_safe_redirect($redirect);
        exit;
    }

    public static function ajax_connect_start(): void
    {
        check_ajax_referer('grwi_admin', 'nonce');

        if (! current_user_can('manage_options')) {
            wp_send_json_error(['message' => __('Forbidden.', 'gr-widget')], 403);
        }

        $client = new GRWI_API_Client();
        $origin = esc_url_raw(wp_unslash($_POST['opener_origin'] ?? ''));
        $result = $client->start_connect($origin !== '' ? $origin : null);

        if (is_wp_error($result)) {
            wp_send_json_error(['message' => $result->get_error_message()], 500);
        }

        wp_send_json_success($result);
    }

    public static function ajax_connect_claim(): void
    {
        check_ajax_referer('grwi_admin', 'nonce');

        if (! current_user_can('manage_options')) {
            wp_send_json_error(['message' => __('Forbidden.', 'gr-widget')], 403);
        }

        $token = sanitize_text_field(wp_unslash($_POST['connect_token'] ?? ''));
        if ($token === '') {
            wp_send_json_error(['message' => __('Missing connect token.', 'gr-widget')], 422);
        }

        $client = new GRWI_API_Client();
        $result = $client->claim_connect($token);

        if (is_wp_error($result)) {
            wp_send_json_error(['message' => $result->get_error_message()], 409);
        }

        wp_send_json_success([
            'linked' => true,
            'migrated_widgets' => (int) ($result['migrated_widgets'] ?? 0),
            'reload_url' => add_query_arg('grwi_linked', '1', self::admin_page_url()),
        ]);
    }

    public static function ajax_connect_status(): void
    {
        check_ajax_referer('grwi_admin', 'nonce');

        if (! current_user_can('manage_options')) {
            wp_send_json_error(['message' => __('Forbidden.', 'gr-widget')], 403);
        }

        $token = sanitize_text_field(wp_unslash($_POST['connect_token'] ?? ''));
        if ($token === '') {
            wp_send_json_error(['message' => __('Missing connect token.', 'gr-widget')], 422);
        }

        $client = new GRWI_API_Client();
        $result = $client->connect_status($token);

        if (is_wp_error($result)) {
            wp_send_json_error(['message' => $result->get_error_message()], 500);
        }

        wp_send_json_success($result);
    }

    public static function ajax_install_check(): void
    {
        check_ajax_referer('grwi_admin', 'nonce');

        if (! current_user_can('manage_options')) {
            wp_send_json_error(['message' => __('You do not have permission to check this widget.', 'gr-widget')], 403);
        }

        $embed_key = isset($_POST['embed_key']) ? sanitize_text_field(wp_unslash($_POST['embed_key'])) : '';
        $url = isset($_POST['url']) ? esc_url_raw(wp_unslash($_POST['url'])) : '';
        $platform = isset($_POST['platform']) ? sanitize_key(wp_unslash($_POST['platform'])) : '';
        if ($embed_key === '' || $url === '') {
            wp_send_json_error([
                'message' => __('Enter a full page address, starting with http:// or https://.', 'gr-widget'),
                'validation' => true,
            ], 422);
        }

        $client = new GRWI_API_Client();
        $result = $client->check_install($embed_key, $url, $platform);
        if (is_wp_error($result)) {
            self::send_install_check_error($result);
        }

        wp_send_json_success($result);
    }

    public static function ajax_install_guide(): void
    {
        check_ajax_referer('grwi_admin', 'nonce');

        if (! current_user_can('manage_options')) {
            wp_send_json_error(['message' => __('You do not have permission to open this guide.', 'gr-widget')], 403);
        }

        $embed_key = isset($_POST['embed_key']) ? sanitize_text_field(wp_unslash($_POST['embed_key'])) : '';
        $platform = isset($_POST['platform']) ? sanitize_key(wp_unslash($_POST['platform'])) : '';
        if ($embed_key === '' || $platform === '') {
            wp_send_json_error(['message' => __('Choose where you added the widget.', 'gr-widget')], 422);
        }

        $client = new GRWI_API_Client();
        $result = $client->open_install_guide($embed_key, $platform);
        if (is_wp_error($result)) {
            self::send_install_check_error($result);
        }

        wp_send_json_success($result);
    }

    public static function ajax_install_help(): void
    {
        check_ajax_referer('grwi_admin', 'nonce');

        if (! current_user_can('manage_options')) {
            wp_send_json_error(['message' => __('You do not have permission to contact support.', 'gr-widget')], 403);
        }

        $embed_key = isset($_POST['embed_key']) ? sanitize_text_field(wp_unslash($_POST['embed_key'])) : '';
        $message = isset($_POST['message']) ? sanitize_textarea_field(wp_unslash($_POST['message'])) : '';
        if ($embed_key === '') {
            wp_send_json_error(['message' => __('Choose a widget first.', 'gr-widget')], 422);
        }

        $client = new GRWI_API_Client();
        $result = $client->request_install_help($embed_key, $message);
        if (is_wp_error($result)) {
            self::send_install_check_error($result);
        }

        wp_send_json_success($result);
    }

    /**
     * @param WP_Error $error
     */
    private static function send_install_check_error(WP_Error $error): void
    {
        $data = $error->get_error_data();
        $status = is_array($data) ? (int) ($data['status'] ?? 500) : 500;
        $body = is_array($data) && is_array($data['body'] ?? null) ? $data['body'] : [];
        $message = '';
        if (! empty($body['errors']['url'][0]) && is_string($body['errors']['url'][0])) {
            wp_send_json_error([
                'message' => $body['errors']['url'][0],
                'validation' => true,
            ], 422);
        }
        if (! empty($body['message']) && is_string($body['message'])) {
            $message = $body['message'];
        }
        if ($message === '') {
            $message = $error->get_error_message();
        }
        if ($status < 400 || $status > 599) {
            $status = 500;
        }
        wp_send_json_error(['message' => $message], $status);
    }

    /**
     * Re-fetch the widget list for a linked account (web-builder widgets included).
     * Invoked once from admin.js when the GR Widget screen loads.
     */
    /** Combine authenticated review data with the latest saved design, including an unpublished draft. */
    public static function dashboard_preview_payload(array $preview, array $editor): array
    {
        $layout = (string) ($editor['builder']['layout'] ?? $editor['widget']['layout'] ?? $preview['layout'] ?? 'badge_card');
        $preview['layout'] = $layout;
        $preview['layout_label'] = $editor['builder']['layout_label'] ?? $editor['widget']['layout_label'] ?? '';
        $preview['config'] = is_array($editor['config'] ?? null) ? $editor['config'] : ($preview['config'] ?? []);
        $preview['theme'] = $preview['config']['theme'] ?? $preview['theme'] ?? 'light';
        $preview['has_unpublished_draft'] = !empty($editor['has_unpublished_draft']) || !empty($editor['draft_differs_from_live']);
        $preview['preview_state'] = $preview['has_unpublished_draft'] || (isset($editor['widget']['is_active']) && !$editor['widget']['is_active']) ? 'draft' : 'live';
        $meta = $editor['builder']['preview'] ?? [];
        $preview['preview_meta'] = array_intersect_key($meta, array_flip(['layout_full_defaults','layout_full_defaults_by_layout','layout_master_defaults']));
        if (isset($preview['preview_meta']['layout_full_defaults_by_layout'])) $preview['preview_meta']['layout_full_defaults_by_layout'] = [$layout => $meta['layout_full_defaults_by_layout'][$layout] ?? []];
        return $preview;
    }

    public static function ajax_dashboard_widget_preview(): void
    {
        check_ajax_referer('grwi_admin', 'nonce');
        if (!current_user_can('manage_options')) wp_send_json_error(['message'=>__('Forbidden.', 'gr-widget')], 403);
        $key = sanitize_text_field(wp_unslash($_POST['embed_key'] ?? ''));
        if ($key === '') wp_send_json_error(['message'=>__('Missing widget key.', 'gr-widget')], 422);
        $client = new GRWI_API_Client();
        $preview = $client->get_widget_preview_data($key, true);
        if (!is_wp_error($preview) && !empty($preview['saved_design_preview'])) wp_send_json_success($preview);
        $editor = $client->get_widget_editor($key);
        if (is_wp_error($preview) || is_wp_error($editor)) wp_send_json_error(['message'=>__('Could not load the saved widget preview.', 'gr-widget')], 502);
        wp_send_json_success(self::dashboard_preview_payload($preview, $editor));
    }

    public static function ajax_refresh_widgets(): void
    {
        check_ajax_referer('grwi_admin', 'nonce');

        if (! current_user_can('manage_options')) {
            wp_send_json_error(['message' => __('Forbidden.', 'gr-widget')], 403);
        }

        $client = new GRWI_API_Client();
        if ($client->is_linked()) {
            $client->refresh_capabilities();
        }

        $result = $client->get_widgets();
        if (is_wp_error($result)) {
            $status = 500;
            $data = $result->get_error_data();
            if (is_array($data) && isset($data['status'])) {
                $status = (int) $data['status'];
            }
            wp_send_json_error(['message' => $result->get_error_message()], max(400, $status));
        }

        $widgets = is_array($result['widgets'] ?? null) ? $result['widgets'] : [];
        $embed_keys = [];
        foreach ($widgets as $widget) {
            if (! is_array($widget)) {
                continue;
            }
            $key = sanitize_text_field((string) ($widget['embed_key'] ?? ''));
            if ($key !== '') {
                $embed_keys[] = $key;
            }
        }

        wp_send_json_success([
            'widgets' => $widgets,
            'embed_keys' => $embed_keys,
            'picker' => self::widget_picker_items($widgets),
            'can_create' => (bool) ($result['can_create'] ?? true),
        ]);
    }

    /**
     * Dropdown items for the Gutenberg block (label + embed key).
     *
     * @param  array<int, mixed>  $widgets
     * @return array<int, array{embedKey: string, label: string}>
     */
    public static function widget_picker_items(array $widgets): array
    {
        $items = [];
        foreach ($widgets as $widget) {
            if (! is_array($widget)) {
                continue;
            }
            $embed_key = sanitize_text_field((string) ($widget['embed_key'] ?? ''));
            if ($embed_key === '') {
                continue;
            }

            $name = sanitize_text_field((string) ($widget['name'] ?? ''));
            $business = sanitize_text_field((string) ($widget['business_name'] ?? ''));
            $layout = sanitize_text_field((string) ($widget['layout'] ?? ''));
            $label = $name;
            if ($label === '' || ($business !== '' && strcasecmp($label, $business) === 0)) {
                $label = $business !== '' ? $business : $embed_key;
                if ($business !== '' && $layout !== '') {
                    $label = $business . ' — ' . $layout;
                }
            }
            if ($label === '') {
                $label = $embed_key;
            }

            $items[] = [
                'embedKey' => $embed_key,
                'label' => $label,
            ];
        }

        return $items;
    }

    public static function ajax_search_places(): void
    {
        check_ajax_referer('grwi_admin', 'nonce');

        if (! current_user_can('manage_options')) {
            wp_send_json_error(['message' => __('Forbidden.', 'gr-widget')], 403);
        }

        $query = sanitize_text_field(wp_unslash($_GET['q'] ?? $_POST['q'] ?? ''));
        if (strlen($query) < 3) {
            wp_send_json_error(['message' => __('Enter at least 3 characters.', 'gr-widget')], 422);
        }

        $client = new GRWI_API_Client();
        if (! $client->ensure_registered(false)) {
            wp_send_json_error(['message' => __('Could not register this site with GRWidget.com.', 'gr-widget')], 500);
        }

        $result = $client->search_places($query);

        if (is_wp_error($result)) {
            wp_send_json_error([
                'message' => $client->is_reconnect_error($result)
                    ? $client->reconnect_message()
                    : self::customer_facing_search_message($client->user_facing_message($result->get_error_message())),
                'reconnect' => $client->is_reconnect_error($result),
            ], $client->is_reconnect_error($result) ? 401 : 500);
        }

        if (! empty($result['error']) && is_string($result['error'])) {
            wp_send_json_error(['message' => self::customer_facing_search_message($result['error'])], 503);
        }

        wp_send_json_success($result);
    }

    public static function ajax_recent_places(): void
    {
        check_ajax_referer('grwi_admin', 'nonce');

        if (! current_user_can('manage_options')) {
            wp_send_json_error(['message' => __('Forbidden.', 'gr-widget')], 403);
        }

        $client = new GRWI_API_Client();
        $result = $client->recent_places();
        $remote = [];
        if (! is_wp_error($result) && is_array($result)) {
            $remote = $result['places'] ?? $result['results'] ?? [];
        }

        wp_send_json_success([
            'places' => self::merged_available_places(is_array($remote) ? $remote : []),
        ]);
    }

    public static function ajax_remember_place(): void
    {
        check_ajax_referer('grwi_admin', 'nonce');

        if (! current_user_can('manage_options')) {
            wp_send_json_error(['message' => __('Forbidden.', 'gr-widget')], 403);
        }

        $place = self::normalize_remembered_place([
            'place_id' => sanitize_text_field(wp_unslash($_POST['place_id'] ?? '')),
            'business_name' => sanitize_text_field(wp_unslash($_POST['business_name'] ?? $_POST['name'] ?? '')),
            'formatted_address' => sanitize_text_field(wp_unslash($_POST['formatted_address'] ?? '')),
            'rating' => isset($_POST['rating']) ? sanitize_text_field(wp_unslash($_POST['rating'])) : null,
            'review_count' => isset($_POST['review_count']) ? sanitize_text_field(wp_unslash($_POST['review_count'])) : null,
        ]);

        if ($place === null) {
            wp_send_json_error(['message' => __('Place details required.', 'gr-widget')], 422);
        }

        self::remember_place($place);

        wp_send_json_success(['places' => self::merged_available_places()]);
    }

    public static function ajax_forget_place(): void
    {
        check_ajax_referer('grwi_admin', 'nonce');

        if (! current_user_can('manage_options')) {
            wp_send_json_error(['message' => __('Forbidden.', 'gr-widget')], 403);
        }

        $place_id = sanitize_text_field(wp_unslash($_POST['place_id'] ?? ''));
        if ($place_id === '') {
            wp_send_json_error(['message' => __('Place ID required.', 'gr-widget')], 422);
        }

        self::forget_place($place_id);

        wp_send_json_success(['places' => self::merged_available_places()]);
    }

    /**
     * Hide ops-internal Places errors (budget, Admin → API, keys) from wp-admin search.
     */
    public static function customer_facing_search_message(string $message): string
    {
        $generic = __('Business search is temporarily unavailable. Please try again later.', 'gr-widget');
        $trimmed = trim($message);
        if ($trimmed === '') {
            return $generic;
        }

        $lower = strtolower($trimmed);
        if (
            strpos($lower, 'admin') !== false
            || strpos($lower, 'budget') !== false
            || strpos($lower, 'daily request') !== false
            || strpos($lower, 'api key') !== false
            || strpos($lower, '.env') !== false
            || strpos($lower, 'google cloud') !== false
            || strpos($lower, 'google_places') !== false
        ) {
            return $generic;
        }

        return $trimmed;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public static function remembered_places(): array
    {
        $raw = get_option('grwi_remembered_places', []);
        if (! is_array($raw)) {
            return [];
        }

        $places = [];
        foreach ($raw as $row) {
            $place = self::normalize_remembered_place(is_array($row) ? $row : []);
            if ($place !== null) {
                $places[] = $place;
            }
        }

        return $places;
    }

    /**
     * @return array<int, string>
     */
    public static function hidden_recent_place_ids(): array
    {
        $raw = get_option('grwi_hidden_recent_place_ids', []);
        if (! is_array($raw)) {
            return [];
        }

        $ids = [];
        foreach ($raw as $id) {
            $value = sanitize_text_field((string) $id);
            if ($value !== '') {
                $ids[] = $value;
            }
        }

        return array_values(array_unique($ids));
    }

    /**
     * @param  array<string, mixed>  $input
     * @return array<string, mixed>|null
     */
    public static function normalize_remembered_place(array $input): ?array
    {
        $place_id = sanitize_text_field((string) ($input['place_id'] ?? $input['id'] ?? ''));
        $name = sanitize_text_field((string) ($input['business_name'] ?? $input['name'] ?? ''));
        if ($place_id === '' || $name === '') {
            return null;
        }

        $rating = $input['rating'] ?? null;
        if ($rating !== null && $rating !== '') {
            $rating = round((float) $rating, 1);
        } else {
            $rating = null;
        }

        $review_count = $input['review_count'] ?? null;
        if ($review_count !== null && $review_count !== '') {
            $review_count = absint($review_count);
        } else {
            $review_count = null;
        }

        return [
            'place_id' => $place_id,
            'business_name' => $name,
            'name' => $name,
            'formatted_address' => sanitize_text_field((string) ($input['formatted_address'] ?? '')),
            'rating' => $rating,
            'review_count' => $review_count,
        ];
    }

    /**
     * @param  array<string, mixed>  $place
     */
    public static function remember_place(array $place): void
    {
        $normalized = self::normalize_remembered_place($place);
        if ($normalized === null) {
            return;
        }

        $place_id = $normalized['place_id'];
        $places = [];
        foreach (self::remembered_places() as $row) {
            if (($row['place_id'] ?? '') !== $place_id) {
                $places[] = $row;
            }
        }
        array_unshift($places, $normalized);
        $places = array_slice($places, 0, 12);
        update_option('grwi_remembered_places', $places, false);

        $hidden = [];
        foreach (self::hidden_recent_place_ids() as $id) {
            if ($id !== $place_id) {
                $hidden[] = $id;
            }
        }
        update_option('grwi_hidden_recent_place_ids', $hidden, false);
    }

    public static function forget_place(string $place_id): void
    {
        $place_id = sanitize_text_field($place_id);
        if ($place_id === '') {
            return;
        }

        $places = [];
        foreach (self::remembered_places() as $row) {
            if (($row['place_id'] ?? '') !== $place_id) {
                $places[] = $row;
            }
        }
        update_option('grwi_remembered_places', $places, false);

        $hidden = self::hidden_recent_place_ids();
        if (! in_array($place_id, $hidden, true)) {
            $hidden[] = $place_id;
        }
        update_option('grwi_hidden_recent_place_ids', $hidden, false);
    }

    /**
     * @param  array<int, mixed>  $remote
     * @return array<int, array<string, mixed>>
     */
    public static function merged_available_places(array $remote = []): array
    {
        $hidden = array_fill_keys(self::hidden_recent_place_ids(), true);
        $merged = [];
        $seen = [];

        $candidates = array_merge(self::remembered_places(), $remote);
        foreach ($candidates as $row) {
            $place = self::normalize_remembered_place(is_array($row) ? $row : []);
            if ($place === null) {
                continue;
            }
            $id = $place['place_id'];
            if (isset($hidden[$id]) || isset($seen[$id])) {
                continue;
            }
            $seen[$id] = true;
            $merged[] = $place;
            if (count($merged) >= 12) {
                break;
            }
        }

        return $merged;
    }

    public static function ajax_sync_place(): void
    {
        check_ajax_referer('grwi_admin', 'nonce');

        if (! current_user_can('manage_options')) {
            wp_send_json_error(['message' => __('Forbidden.', 'gr-widget')], 403);
        }

        $place_id = sanitize_text_field(wp_unslash($_POST['place_id'] ?? ''));
        $business_name = sanitize_text_field(wp_unslash($_POST['business_name'] ?? ''));

        if ($place_id === '' || $business_name === '') {
            wp_send_json_error(['message' => __('Place details required.', 'gr-widget')], 422);
        }

        $client = new GRWI_API_Client();
        $client->ensure_registered();
        $result = $client->sync_place([
            'place_id' => $place_id,
            'business_name' => $business_name,
            'formatted_address' => sanitize_text_field(wp_unslash($_POST['formatted_address'] ?? '')),
            'rating' => isset($_POST['rating']) ? floatval($_POST['rating']) : null,
            'review_count' => isset($_POST['review_count']) ? absint($_POST['review_count']) : null,
        ]);

        if (is_wp_error($result)) {
            if ($client->is_reconnect_error($result)) {
                wp_send_json_error([
                    'message' => $client->reconnect_message(),
                    'reconnect' => true,
                ], 401);
            }

            $notice = $client->api_error_notice($result);
            wp_send_json_error([
                'message' => $notice['message'],
                'upgrade_url' => $notice['upgrade_url'],
            ], $notice['status']);
        }

        wp_send_json_success($result);
    }

    public static function ajax_place_sync_status(): void
    {
        check_ajax_referer('grwi_admin', 'nonce');

        if (! current_user_can('manage_options')) {
            wp_send_json_error(['message' => __('Forbidden.', 'gr-widget')], 403);
        }

        $place_id = sanitize_text_field(wp_unslash($_GET['place_id'] ?? $_POST['place_id'] ?? ''));
        if ($place_id === '') {
            wp_send_json_error(['message' => __('Place ID required.', 'gr-widget')], 422);
        }

        $client = new GRWI_API_Client();
        $result = $client->place_sync_status($place_id);

        if (is_wp_error($result)) {
            wp_send_json_error([
                'message' => $client->is_reconnect_error($result)
                    ? $client->reconnect_message()
                    : $client->user_facing_message($result->get_error_message()),
                'reconnect' => $client->is_reconnect_error($result),
            ], $client->is_reconnect_error($result) ? 401 : 500);
        }

        wp_send_json_success($result);
    }

    public static function ajax_create_widget(): void
    {
        check_ajax_referer('grwi_admin', 'nonce');

        if (! current_user_can('manage_options')) {
            wp_send_json_error(['message' => __('Forbidden.', 'gr-widget')], 403);
        }

        $client = new GRWI_API_Client();
        $result = self::create_widget_from_request($client);

        if (is_wp_error($result)) {
            $notice = $client->api_error_notice($result);
            wp_send_json_error([
                'message' => $notice['message'],
                'upgrade_url' => $notice['upgrade_url'],
            ], $notice['status']);
        }

        wp_send_json_success($result);
    }

    /**
     * @return array<string, mixed>|WP_Error
     */
    private static function create_widget_from_request(GRWI_API_Client $client)
    {
        // Nonce verified by handle_actions() and ajax_create_widget() before calling this helper.
        // phpcs:ignore WordPress.Security.NonceVerification.Missing
        $place_id = sanitize_text_field(wp_unslash($_POST['place_id'] ?? ''));
        // phpcs:ignore WordPress.Security.NonceVerification.Missing
        $business_name = sanitize_text_field(wp_unslash($_POST['business_name'] ?? ''));
        // phpcs:ignore WordPress.Security.NonceVerification.Missing
        $layout = sanitize_text_field(wp_unslash($_POST['layout'] ?? 'badge_card'));

        if ($place_id === '' || $business_name === '') {
            return new WP_Error(
                'grwi_missing_place',
                __('Select a business from the search results before creating a widget.', 'gr-widget'),
                ['status' => 422]
            );
        }

        $client->ensure_registered(false);

        // phpcs:ignore WordPress.Security.NonceVerification.Missing
        $formatted_address = sanitize_text_field(wp_unslash($_POST['formatted_address'] ?? ''));
        // phpcs:ignore WordPress.Security.NonceVerification.Missing
        $rating = isset($_POST['rating']) && $_POST['rating'] !== '' ? floatval($_POST['rating']) : null;
        // phpcs:ignore WordPress.Security.NonceVerification.Missing
        $review_count = isset($_POST['review_count']) && $_POST['review_count'] !== '' ? absint($_POST['review_count']) : null;

        // Reject locked layouts if the UI was bypassed (API also enforces).
        // Preview-first: paid layouts may be created as unpublished drafts.
        $caps = $client->capabilities();
        $preview_first = ! empty($caps['preview_first']);
        foreach ($caps['layout_catalog'] ?? [] as $row) {
            if (! is_array($row)) {
                continue;
            }
            if (sanitize_key($row['key'] ?? '') !== sanitize_key($layout)) {
                continue;
            }
            if (! empty($row['locked']) && ! $preview_first) {
                return new WP_Error(
                    'grwi_layout_locked',
                    __('That layout is locked on your current plan. Choose an available layout or unlock it first.', 'gr-widget'),
                    ['status' => 422]
                );
            }
            break;
        }

        $api_result = $client->create_widget([
            'place_id' => $place_id,
            'business_name' => $business_name,
            'formatted_address' => $formatted_address,
            'rating' => $rating,
            'review_count' => $review_count,
            'layout' => $layout,
        ]);

        if (is_wp_error($api_result)) {
            return $api_result;
        }

        $widget = is_array($api_result) ? ($api_result['widget'] ?? $api_result) : [];
        $embed_key = is_array($widget) ? sanitize_text_field($widget['embed_key'] ?? '') : '';
        $shortcode = $embed_key !== '' ? '[grwi_widget id="' . $embed_key . '"]' : '';
        $embed_snippet = is_array($widget) ? (string) ($widget['embed_snippet'] ?? '') : '';

        $customize_url = self::customize_url($embed_key, 'style');
        if ($customize_url !== '') {
            $customize_url = add_query_arg('grwi_created', '1', $customize_url);
        }

        return [
            'widget' => $widget,
            'embed_key' => $embed_key,
            'shortcode' => $shortcode,
            'embed_snippet' => $embed_snippet,
            'customize_url' => $customize_url,
            'reviews_syncing' => ! empty($api_result['reviews_syncing']),
        ];
    }

    /**
     * One-time WordPress.org review ask. Dismiss and the close control are permanent.
     * Maybe later hides it for a week. Leave a review records that they went to the form.
     */
    public static function ajax_review_prompt(): void
    {
        check_ajax_referer('grwi_admin', 'nonce');

        if (! current_user_can('manage_options')) {
            wp_send_json_error(['message' => __('Forbidden.', 'gr-widget')], 403);
        }

        $choice = sanitize_key((string) wp_unslash($_POST['choice'] ?? ''));
        if (! in_array($choice, ['dismiss', 'later', 'review'], true)) {
            wp_send_json_error(['message' => __('Unknown choice.', 'gr-widget')], 422);
        }

        $stored = [
            'status' => $choice === 'later' ? 'later' : ($choice === 'review' ? 'reviewed' : 'dismissed'),
            'until' => $choice === 'later' ? time() + WEEK_IN_SECONDS : 0,
        ];
        update_option('grwi_wp_review_prompt', $stored, false);

        wp_send_json_success(['status' => $stored['status']]);
    }

    public static function ajax_delete_widget(): void
    {
        check_ajax_referer('grwi_admin', 'nonce');

        if (! current_user_can('manage_options')) {
            wp_send_json_error(['message' => __('Forbidden.', 'gr-widget')], 403);
        }

        $embed_key = sanitize_text_field(wp_unslash($_POST['embed_key'] ?? ''));
        if ($embed_key === '') {
            wp_send_json_error(['message' => __('Missing widget key.', 'gr-widget')], 422);
        }

        $client = new GRWI_API_Client();
        $client->ensure_registered();
        $result = $client->delete_widget($embed_key);

        if (is_wp_error($result)) {
            wp_send_json_error(['message' => $result->get_error_message()], 500);
        }

        wp_send_json_success(['deleted' => true]);
    }

    public static function ajax_duplicate_widget(): void
    {
        check_ajax_referer('grwi_admin', 'nonce');

        if (! current_user_can('manage_options')) {
            wp_send_json_error(['message' => __('Forbidden.', 'gr-widget')], 403);
        }

        $embed_key = sanitize_text_field(wp_unslash($_POST['embed_key'] ?? ''));
        if ($embed_key === '') {
            wp_send_json_error(['message' => __('Missing widget key.', 'gr-widget')], 422);
        }

        $client = new GRWI_API_Client();
        $client->ensure_registered();

        $preview = $client->get_widget_preview_data($embed_key);
        if (is_wp_error($preview)) {
            wp_send_json_error(['message' => $preview->get_error_message()], 500);
        }

        $place = is_array($preview['place'] ?? null) ? $preview['place'] : [];
        $place_id = sanitize_text_field((string) ($place['place_id'] ?? ''));
        $business_name = sanitize_text_field((string) ($place['business_name'] ?? ''));
        $layout = sanitize_text_field((string) ($preview['layout'] ?? 'badge_card'));
        $config = is_array($preview['config'] ?? null) ? $preview['config'] : null;

        if ($place_id === '' || $business_name === '') {
            wp_send_json_error(['message' => __('Could not read the source widget place.', 'gr-widget')], 422);
        }

        $source_name = '';
        $editor = $client->get_widget_editor($embed_key);
        if (! is_wp_error($editor) && is_array($editor)) {
            $source_widget = is_array($editor['widget'] ?? null) ? $editor['widget'] : $editor;
            $source_name = sanitize_text_field((string) ($source_widget['name'] ?? ''));
            if ($layout === '' && ! empty($source_widget['layout'])) {
                $layout = sanitize_text_field((string) $source_widget['layout']);
            }
            if ($config === null && is_array($source_widget['config'] ?? null)) {
                $config = $source_widget['config'];
            }
        }

        $duplicate_name = $source_name !== ''
            ? sprintf(
                /* translators: %s: original widget name */
                __('Copy of %s', 'gr-widget'),
                $source_name
            )
            : sprintf(
                /* translators: %s: business name */
                __('Copy of %s', 'gr-widget'),
                $business_name
            );

        $created = $client->create_widget([
            'place_id' => $place_id,
            'business_name' => $business_name,
            'formatted_address' => sanitize_text_field((string) ($place['formatted_address'] ?? '')),
            'rating' => isset($place['rating']) && is_numeric($place['rating']) ? (float) $place['rating'] : null,
            'review_count' => isset($place['review_count']) && is_numeric($place['review_count']) ? (int) $place['review_count'] : null,
            'layout' => $layout !== '' ? $layout : 'badge_card',
            'name' => $duplicate_name,
        ]);

        if (is_wp_error($created)) {
            $status = 500;
            $data = $created->get_error_data();
            if (is_array($data) && isset($data['status'])) {
                $status = (int) $data['status'];
            }
            wp_send_json_error(['message' => $created->get_error_message()], max(400, $status));
        }

        $widget = is_array($created) ? ($created['widget'] ?? $created) : [];
        $new_key = is_array($widget) ? sanitize_text_field((string) ($widget['embed_key'] ?? '')) : '';

        if ($new_key !== '' && is_array($config) && $config !== []) {
            $client->update_widget($new_key, [
                'name' => $duplicate_name,
                'config' => $config,
            ]);
        } elseif ($new_key !== '') {
            $client->update_widget($new_key, [
                'name' => $duplicate_name,
            ]);
        }

        $customize_url = self::customize_url($new_key, 'style');

        wp_send_json_success([
            'embed_key' => $new_key,
            'customize_url' => $customize_url,
            'widget' => $widget,
        ]);
    }

    public static function ajax_bulk_delete_widgets(): void
    {
        check_ajax_referer('grwi_admin', 'nonce');

        if (! current_user_can('manage_options')) {
            wp_send_json_error(['message' => __('Forbidden.', 'gr-widget')], 403);
        }

        // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized -- Each key sanitized via sanitize_text_field below.
        $raw_keys = wp_unslash($_POST['embed_keys'] ?? []);
        if (! is_array($raw_keys)) {
            wp_send_json_error(['message' => __('No widgets selected.', 'gr-widget')], 422);
        }

        $embed_keys = array_values(array_unique(array_filter(array_map(
            static fn ($key): string => sanitize_text_field((string) $key),
            $raw_keys
        ))));

        if ($embed_keys === []) {
            wp_send_json_error(['message' => __('No widgets selected.', 'gr-widget')], 422);
        }

        $client = new GRWI_API_Client();
        $client->ensure_registered();

        $deleted = [];
        $failed = [];

        foreach ($embed_keys as $embed_key) {
            $result = $client->delete_widget($embed_key);

            if (is_wp_error($result)) {
                $failed[] = [
                    'embed_key' => $embed_key,
                    'message' => $result->get_error_message(),
                ];
            } else {
                $deleted[] = $embed_key;
            }
        }

        if ($deleted === [] && $failed !== []) {
            wp_send_json_error([
                'message' => __('Could not delete the selected widgets.', 'gr-widget'),
                'deleted' => [],
                'failed' => $failed,
            ], 500);
        }

        wp_send_json_success([
            'deleted' => $deleted,
            'failed' => $failed,
        ]);
    }

    /**
     * Explicit opt-in for new, unregistered installations. No outbound calls
     * or hosted JavaScript are required to render this screen.
     */
    private static function render_consent_screen(): void
    {
        ?>
        <div class="wrap grw-admin">
            <h1><?php esc_html_e('Set up GR Widget', 'gr-widget'); ?></h1>
            <p><?php esc_html_e('GR Widget uses GRWidget.com (operated by EXTHUS LTD) to find Google businesses, host and synchronise reviews, create widgets, and render them on your website. A GRWidget.com account is not required to start.', 'gr-widget'); ?></p>
            <p><?php esc_html_e('When you connect, this plugin sends your website URL and plugin version to GRWidget.com to register your site. When you choose to search for businesses or create widgets, the service receives your search terms, selected business information, and widget settings. Pages with published GR Widget embeds load the hosted script and send the visitor request to GRWidget.com.', 'gr-widget'); ?></p>
            <p><?php esc_html_e('After connecting, previews and published widgets may load Google Fonts and Google-hosted reviewer images when those options are selected. Those browser requests disclose the IP address and browser information to the provider. Use the inherited font and disable photos to avoid these optional requests.', 'gr-widget'); ?></p>
            <p>
                <a href="<?php echo esc_url('https://grwidget.com/privacy'); ?>" target="_blank" rel="noopener noreferrer"><?php esc_html_e('Privacy policy', 'gr-widget'); ?></a>
                &nbsp;|&nbsp;
                <a href="<?php echo esc_url('https://grwidget.com/terms'); ?>" target="_blank" rel="noopener noreferrer"><?php esc_html_e('Terms of service', 'gr-widget'); ?></a>
                &nbsp;|&nbsp;
                <a href="<?php echo esc_url('https://policies.google.com/privacy'); ?>" target="_blank" rel="noopener noreferrer"><?php esc_html_e('Google privacy policy', 'gr-widget'); ?></a>
            </p>
            <?php if (! empty($_GET['grwi_connect_error'])) : // phpcs:ignore WordPress.Security.NonceVerification.Recommended ?>
                <div class="notice notice-error"><p><?php esc_html_e('Could not connect to GRWidget.com. Check connectivity and try again.', 'gr-widget'); ?></p></div>
            <?php endif; ?>
            <form method="post" action="<?php echo esc_url(self::admin_page_url()); ?>">
                <?php wp_nonce_field('grwi_admin_action'); ?>
                <input type="hidden" name="grwi_action" value="enable_service" />
                <?php submit_button(__('Connect this website to GRWidget.com', 'gr-widget')); ?>
            </form>
            <p class="description"><?php esc_html_e('Activating this plugin alone does not register your site or contact GRWidget.com. Connecting is optional until you want to use the hosted widget features.', 'gr-widget'); ?></p>
            <p class="description"><?php esc_html_e('If you used an earlier version without this consent step, your saved widgets and connection details are retained. Confirm the connection here to resume the hosted service.', 'gr-widget'); ?></p>
        </div>
        <?php
    }

    public static function render_page(): void
    {
        if (! current_user_can('manage_options')) {
            return;
        }

        $client = new GRWI_API_Client();
        $registered = $client->is_registered();
        if (! $registered && ! $client->is_linked()) {
            self::render_consent_screen();
            return;
        }
        // Linked accounts: live-fetch widgets on this screen so web-builder widgets
        // appear without a manual Refresh click. Guarded so a re-init does not loop.
        static $grwi_admin_widgets_response = null;
        if ($client->is_linked()) {
            $client->refresh_capabilities();
        }
        $caps = $client->capabilities();
        $api_connected = $client->is_api_connected();
        if ($grwi_admin_widgets_response === null) {
            $grwi_admin_widgets_response = $client->get_widgets();
        }
        $widgets_response = $grwi_admin_widgets_response;
        $widgets = [];
        $can_create = true;
        $widgets_error = '';
        $connection_notice = '';
        $getting_started = false;

        if (! $registered && ! $api_connected) {
            $connection_notice = __(
                'Could not reach GRWidget.com right now. Check your network connection and refresh this page. Existing widgets and shortcodes on your site will keep working; creating new widgets requires a connection.',
                'gr-widget'
            );
        }

        $widgets_reconnect = false;
        if (is_wp_error($widgets_response)) {
            $widgets_reconnect = $client->is_reconnect_error($widgets_response);
            $widgets_error = $widgets_reconnect
                ? $client->reconnect_message()
                : $client->user_facing_message($widgets_response->get_error_message());
            $getting_started = false;
        } else {
            $widgets = $widgets_response['widgets'] ?? [];
            $can_create = (bool) ($widgets_response['can_create'] ?? true);
            $getting_started = $widgets === [];
        }

        $layout_catalog = $caps['layout_catalog'] ?? [];
        $layout_sections = $caps['layout_sections'] ?? [];
        $layout_labels = [];
        $layout_meta = [];
        $locked_layout_keys = [];
        foreach ($layout_catalog as $layout) {
            $key = sanitize_key($layout['key'] ?? '');
            if ($key !== '') {
                $layout_labels[$key] = sanitize_text_field($layout['label'] ?? $key);
                $layout_meta[$key] = $layout;
                if (! empty($layout['locked'])) {
                    $locked_layout_keys[] = $key;
                }
            }
        }

        // Full sections (unlocked + locked) so unlinked/linked Free can browse every layout.
        $picker_layout_sections = [];
        foreach ($layout_sections as $section_key => $section) {
            if (! is_array($section)) {
                continue;
            }
            $section_keys = array_values(array_filter(
                $section['layouts'] ?? [],
                static fn (string $key): bool => isset($layout_meta[$key])
            ));
            if ($section_keys === []) {
                continue;
            }
            $row = array_merge($section, ['layouts' => $section_keys]);
            if (is_string($section_key) && $section_key !== '' && ! is_numeric($section_key)) {
                $row['key'] = sanitize_key($section_key);
            }
            $picker_layout_sections[] = $row;
        }

        if ($picker_layout_sections === [] && $layout_meta !== []) {
            $picker_layout_sections = [
                [
                    'title' => __('Layouts', 'gr-widget'),
                    'hint' => '',
                    'layouts' => array_keys($layout_meta),
                ],
            ];
        }

        // Back-compat alias used by older view snippets.
        $free_layout_sections = $picker_layout_sections;

        $has_locked_layouts = $locked_layout_keys !== [];

        $default_layout = 'badge_card';
        foreach ($layout_catalog as $layout) {
            $key = sanitize_key($layout['key'] ?? '');
            if ($key !== '' && empty($layout['locked'])) {
                $default_layout = $key;
                break;
            }
        }

        $upgrade_url = esc_url($caps['upgrade_url'] ?? 'https://grwidget.com/blog/wordpress-plugin-upgrade?source=wordpress');
        $trial_url = esc_url($caps['trial_url'] ?? 'https://grwidget.com/pricing?source=wordpress&plan=site&cycle=monthly');
        $link_url = esc_url($caps['link_url'] ?? 'https://grwidget.com/dashboard/account?source=wordpress&wp_link=1#wordpress');
        $site_id = (int) get_option('grwi_site_id', 0);
        $is_linked = $client->is_linked();
        $linked_account = get_option('grwi_linked_account', []);
        if (! is_array($linked_account)) {
            $linked_account = [];
        }

        // Two-step conversion: paid upgrade UI only after link, for limited plans.
        // Prefer layout locks from capabilities; Free linked always qualifies even if
        // a stale/partial caps payload omitted locked catalog rows.
        $grwi_plan_name = (string) ($linked_account['plan_name'] ?? $caps['plan_name'] ?? '');
        $grwi_account_is_free = $is_linked && (
            ! empty($linked_account['is_free'])
            || strcasecmp($grwi_plan_name, 'Free') === 0
            || strcasecmp((string) ($caps['plan'] ?? ''), 'free') === 0
        );

        if ($grwi_account_is_free && ! $has_locked_layouts) {
            $defaults = GRWI_API_Client::default_capabilities();
            foreach ($defaults['layout_catalog'] ?? [] as $layout) {
                if (! is_array($layout)) {
                    continue;
                }
                $key = sanitize_key($layout['key'] ?? '');
                if ($key === '') {
                    continue;
                }
                $entitlement = sanitize_key($layout['entitlement'] ?? '');
                if ($entitlement === '' || $entitlement === 'link_account') {
                    $legacy = sanitize_key($layout['lock_tier'] ?? '');
                    if ($legacy === 'link_account') {
                        $entitlement = 'linked_free';
                    } elseif ($legacy === 'site' || $entitlement === '') {
                        $entitlement = 'site';
                    }
                }
                // Offline defaults are unlinked: only Site-tier rows stay locked after Free link.
                if ($entitlement !== 'site') {
                    continue;
                }
                if (! isset($layout_meta[$key])) {
                    $layout_labels[$key] = sanitize_text_field($layout['label'] ?? $key);
                    $layout_meta[$key] = array_merge($layout, [
                        'locked' => true,
                        'entitlement' => 'site',
                        'upgrade_plan' => 'Site',
                    ]);
                } else {
                    $layout_meta[$key]['locked'] = true;
                    $layout_meta[$key]['entitlement'] = 'site';
                    $layout_meta[$key]['upgrade_plan'] = 'Site';
                }
                if (! in_array($key, $locked_layout_keys, true)) {
                    $locked_layout_keys[] = $key;
                }
            }
            $has_locked_layouts = $locked_layout_keys !== [];
            $picker_layout_sections = [];
            foreach ($defaults['layout_sections'] ?? [] as $section) {
                if (! is_array($section)) {
                    continue;
                }
                $section_keys = array_values(array_filter(
                    $section['layouts'] ?? [],
                    static fn (string $key): bool => isset($layout_meta[$key])
                ));
                if ($section_keys !== []) {
                    $picker_layout_sections[] = array_merge($section, ['layouts' => $section_keys]);
                }
            }
            $free_layout_sections = $picker_layout_sections;
        }

        // Unlinked visitors get the trial box so they can create an account and start a trial.
        // Linked Free / locked layouts: true. Fully unlocked paid plans (e.g. Agency): false.
        $show_paid_upgrade_ui = ! $is_linked || $has_locked_layouts || $grwi_account_is_free;

        // Same shortfall as the web dashboard: Google has more reviews than this plan syncs.
        $grwi_review_gap = [];
        if (is_array($widgets_response) && is_array($widgets_response['review_sync_gap'] ?? null)) {
            $grwi_review_gap = $widgets_response['review_sync_gap'];
        } elseif ($is_linked && is_array($linked_account['usage']['review_sync_gap'] ?? null)) {
            $grwi_review_gap = $linked_account['usage']['review_sync_gap'];
        }

        include GRWI_PLUGIN_DIR . 'includes/views/admin-page.php';
    }

    /**
     * Cache-bust local dashboard assets when their file contents change.
     * The plugin version stays put; Nathan bumps that separately.
     */
    private static function asset_version(string $relative_path): string
    {
        $path = GRWI_PLUGIN_DIR . ltrim($relative_path, '/');
        if (is_readable($path)) {
            $mtime = @filemtime($path);
            if ($mtime) {
                return GRWI_VERSION . '.' . $mtime;
            }
        }

        return GRWI_VERSION;
    }
}

